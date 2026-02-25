// supabase/functions/cancel-stripe-payment/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, cancelReason } = await req.json()

    if (!session_id) {
      throw new Error('session_id is required')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    // 1. Checkout Session에서 payment_intent 조회
    const sessionRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${secretKey}` },
    })

    const session = await sessionRes.json()

    if (!sessionRes.ok) {
      console.error('Stripe Session Error:', session)
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to retrieve session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const paymentIntent = session.payment_intent
    if (!paymentIntent) {
      return new Response(
        JSON.stringify({ error: 'No payment_intent found for this session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 2. Refund 생성
    const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        payment_intent: paymentIntent,
        reason: 'requested_by_customer',
      }),
    })

    const refund = await refundRes.json()

    if (!refundRes.ok) {
      console.error('Stripe Refund Error:', refund)
      return new Response(
        JSON.stringify({ error: refund.error?.message || 'Refund failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: refund }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
