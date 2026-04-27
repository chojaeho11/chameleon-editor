// supabase/functions/confirm-payment/index.ts
// Toss Payments 결제 승인 (confirm) API 호출

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey, orderId, amount, dbId } = await req.json()

    if (!paymentKey || !orderId || !amount) {
      throw new Error('Missing required parameters: paymentKey, orderId, amount')
    }

    const secretKey = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY')
    if (!secretKey) {
      throw new Error('TOSS_PAYMENTS_SECRET_KEY is not configured')
    }

    // Toss 결제 승인 API 호출
    const basicAuth = btoa(secretKey + ':')
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Toss Confirm Error:', data)
      return new Response(
        JSON.stringify({ error: data.message || 'Payment confirmation failed', code: data.code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 결제수단 세분화 (토스 응답에서 실제 결제수단 추출)
    let paymentMethod = '카드/간편결제'
    const easyPayProvider = data.easyPay?.provider || ''
    const tossMethod = data.method || ''

    if (easyPayProvider) {
      // 간편결제 (카카오페이, 네이버페이, 토스페이 등)
      const providerMap: Record<string, string> = {
        '카카오페이': '카카오페이',
        '네이버페이': '네이버페이',
        '토스페이': '토스페이',
        '삼성페이': '삼성페이',
        '애플페이': '애플페이',
        'KAKAOPAY': '카카오페이',
        'NAVERPAY': '네이버페이',
        'TOSSPAY': '토스페이',
        'SAMSUNGPAY': '삼성페이',
        'APPLEPAY': '애플페이',
      }
      paymentMethod = providerMap[easyPayProvider] || easyPayProvider
    } else if (tossMethod === '카드' || tossMethod === 'CARD') {
      // 신용/체크카드 — 카드사 정보 추가
      const cardCompany = data.card?.company || data.card?.issuerCode || ''
      paymentMethod = cardCompany ? `카드(${cardCompany})` : '카드결제'
    } else if (tossMethod === '가상계좌' || tossMethod === 'VIRTUAL_ACCOUNT') {
      paymentMethod = '가상계좌'
    } else if (tossMethod === '계좌이체' || tossMethod === 'TRANSFER') {
      paymentMethod = '계좌이체'
    } else if (tossMethod === '휴대폰' || tossMethod === 'MOBILE_PHONE') {
      paymentMethod = '휴대폰결제'
    } else if (tossMethod) {
      paymentMethod = tossMethod
    }

    // 결제 승인 성공 — DB 업데이트 (paymentKey + 실제 결제수단 저장)
    if (dbId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${dbId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            status: '접수됨',
            payment_status: '결제완료',
            payment_method: paymentMethod,
            toss_payment_key: paymentKey,
          }),
        })

        // ★★ 결제 확정 → Google Drive 자동 동기화 (서버 사이드 트리거, fire-and-forget)
        // success.html에서도 트리거하지만, 사용자가 탭 닫아도 동기화 보장하기 위해 서버에서도 호출
        try {
          fetch(`${supabaseUrl}/functions/v1/sync-order-to-drive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            body: JSON.stringify({ order_id: dbId }),
          }).then(r => r.json())
            .then(d => console.log('[drive sync] confirm-payment trigger:', d?.skipped || d?.customer_folder_url || d))
            .catch(e => console.warn('[drive sync] confirm-payment fetch failed:', e?.message || e))
        } catch (e: any) {
          console.warn('[drive sync] confirm-payment enqueue failed:', e?.message || e)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentKey: data.paymentKey || paymentKey,
        paymentMethod,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Confirm Payment Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
