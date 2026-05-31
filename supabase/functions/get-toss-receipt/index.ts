// supabase/functions/get-toss-receipt/index.ts
// 2026-05-31: 토스 카드매출전표 URL 조회 — 마이페이지 [카드매출전표 인쇄] 버튼용.
// 결제 승인 시 receipt.url 을 DB 에 저장 안 했던 과거 주문도 paymentKey 만 있으면 조회 가능.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey } = await req.json()
    if (!paymentKey) {
      throw new Error('paymentKey is required')
    }

    const secretKey = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY')
    if (!secretKey) {
      throw new Error('TOSS_PAYMENTS_SECRET_KEY is not configured')
    }

    // GET https://api.tosspayments.com/v1/payments/{paymentKey}
    const basicAuth = btoa(secretKey + ':')
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[get-toss-receipt] Toss API error:', data)
      return new Response(
        JSON.stringify({ error: data.message || 'Toss API error', code: data.code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // data.receipt.url 이 공개 매출전표 URL (https://dashboard.tosspayments.com/receipt/sales/...)
    const receiptUrl = data?.receipt?.url || null
    if (!receiptUrl) {
      return new Response(
        JSON.stringify({ error: '매출전표 URL 없음 (현금영수증/계좌이체 등 카드 외 결제일 수 있음)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    return new Response(
      JSON.stringify({
        url: receiptUrl,
        paymentKey: data.paymentKey,
        method: data.method,           // '카드' / '계좌이체' / '간편결제' 등
        approvedAt: data.approvedAt,
        totalAmount: data.totalAmount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('[get-toss-receipt] error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
