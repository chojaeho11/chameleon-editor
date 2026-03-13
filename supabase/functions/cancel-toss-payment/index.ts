// supabase/functions/cancel-toss-payment/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey, cancelReason } = await req.json()

    const secretKey = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY')
    if (!secretKey) {
      throw new Error('TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다.')
    }

    const basicAuth = btoa(secretKey + ':')

    // 1. 먼저 결제 상태 조회
    const lookupRes = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    })

    if (lookupRes.ok) {
      const payment = await lookupRes.json()
      console.log('Payment status:', payment.status, 'paymentKey:', paymentKey)

      // 이미 취소된 결제면 바로 성공 반환
      if (payment.status === 'CANCELED' || payment.status === 'EXPIRED' || payment.status === 'ABORTED') {
        return new Response(
          JSON.stringify({ success: true, alreadyCanceled: true, status: payment.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // 승인되지 않은 결제 (IN_PROGRESS, READY 등) — 실제 결제가 완료되지 않은 것
      if (payment.status !== 'DONE') {
        return new Response(
          JSON.stringify({ success: true, notCharged: true, status: payment.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    } else {
      // 조회 실패 (paymentKey가 유효하지 않을 수 있음)
      const lookupErr = await lookupRes.json()
      console.error('Payment lookup failed:', lookupErr)

      // NOT_FOUND_PAYMENT = 결제가 존재하지 않음 (confirm 안 한 경우 등)
      if (lookupErr.code === 'NOT_FOUND_PAYMENT' || lookupErr.code === 'INVALID_PAYMENT_KEY') {
        return new Response(
          JSON.stringify({ success: true, notFound: true, message: '결제 기록 없음 (미승인 결제)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // 2. DONE 상태인 결제만 취소 API 호출
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: cancelReason || '관리자 취소' }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Toss Cancel Error:', data)
      return new Response(
        JSON.stringify({ error: data.message || '취소 실패', code: data.code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || '알 수 없는 오류가 발생했습니다.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})