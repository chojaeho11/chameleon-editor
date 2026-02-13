// supabase/functions/verify-stripe-payment/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, db_id } = await req.json()

    if (!session_id || !db_id) {
      throw new Error('Missing required fields: session_id, db_id')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    // Stripe Checkout Session 조회하여 결제 상태 확인
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    })

    const session = await response.json()

    if (!response.ok) {
      console.error('Stripe API Error:', session)
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to retrieve session' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 결제 상태 확인
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Payment not completed. Status: ${session.payment_status}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 메타데이터의 order_id와 db_id 일치 확인
    if (session.metadata?.order_id && String(session.metadata.order_id) !== String(db_id)) {
      return new Response(
        JSON.stringify({ error: 'Order ID mismatch' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
      }),
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