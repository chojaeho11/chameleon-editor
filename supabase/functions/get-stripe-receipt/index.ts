// supabase/functions/get-stripe-receipt/index.ts
// 2026-06-22 v699: Stripe 카드매출전표 URL 조회 — 마이페이지 [카드매출전표 인쇄] 버튼용 (해외 결제).
//   Toss 와 동일한 패턴 (get-toss-receipt 참고).
//   verify-stripe-payment 가 결제 완료 시 orders.toss_payment_key 에 session_id (cs_...) 저장.
//   여기서는 Checkout Session → latest_charge.receipt_url 추출해 클라이언트에 반환.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()
    if (!sessionId) {
      throw new Error('sessionId is required')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    // Stripe Checkout Session 조회 (payment_intent.latest_charge 까지 확장)
    //   expand 파라미터로 한 번에 nested 객체까지 가져옴.
    const url = new URL(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`)
    url.searchParams.append('expand[]', 'payment_intent.latest_charge')
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    })

    const session: any = await response.json()

    if (!response.ok) {
      console.error('[get-stripe-receipt] Stripe API error:', session)
      return new Response(
        JSON.stringify({ error: session?.error?.message || 'Stripe API error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `결제 미완료 상태: ${session.payment_status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const pi = session.payment_intent
    const charge = pi && typeof pi === 'object' ? pi.latest_charge : null
    const receiptUrl = (charge && typeof charge === 'object' ? charge.receipt_url : null) || null

    if (!receiptUrl) {
      // 폴백 — 핀안내 URL 없으면 Stripe 의 hosted invoice URL 시도
      const hosted = session?.invoice ? null : null
      return new Response(
        JSON.stringify({
          error: 'Stripe receipt URL not yet available (may take a few minutes after payment).',
          paymentStatus: session.payment_status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    return new Response(
      JSON.stringify({
        url: receiptUrl,
        sessionId: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        paid_at: charge?.created ? new Date(charge.created * 1000).toISOString() : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('[get-stripe-receipt] error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
