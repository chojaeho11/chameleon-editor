// supabase/functions/create-stripe-session/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, currency, order_id, success_url, cancel_url } = await req.json()

    if (!amount || !currency || !order_id) {
      throw new Error('Missing required fields: amount, currency, order_id')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    // Stripe Checkout Session 생성 (REST API 직접 호출)
    const params = new URLSearchParams()
    params.append('mode', 'payment')
    params.append('payment_method_types[]', 'card')
    params.append('line_items[0][price_data][currency]', currency)
    params.append('line_items[0][price_data][product_data][name]', `Chameleon Order #${order_id}`)
    // Stripe amount: USD는 센트 단위, JPY는 그대로
    const stripeAmount = currency === 'jpy' ? amount : Math.round(amount * 100)
    params.append('line_items[0][price_data][unit_amount]', String(stripeAmount))
    params.append('line_items[0][quantity]', '1')
    // success_url에 session_id 템플릿 추가
    const finalSuccessUrl = success_url.includes('?')
      ? `${success_url}&session_id={CHECKOUT_SESSION_ID}`
      : `${success_url}?session_id={CHECKOUT_SESSION_ID}`
    params.append('success_url', finalSuccessUrl)
    params.append('cancel_url', cancel_url)
    params.append('metadata[order_id]', String(order_id))

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Stripe API Error:', data)
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Stripe session creation failed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // sessionId 반환 (order.js에서 stripe.redirectToCheckout에 사용)
    return new Response(
      JSON.stringify({ sessionId: data.id, url: data.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})