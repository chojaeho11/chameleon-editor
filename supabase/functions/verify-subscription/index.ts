// supabase/functions/verify-subscription/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, user_id } = await req.json()

    if (!session_id || !user_id) {
      throw new Error('Missing required fields: session_id, user_id')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase config missing')

    // 1. Retrieve Stripe Checkout Session
    const sessionResp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=subscription`,
      {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      }
    )
    const session = await sessionResp.json()

    if (!sessionResp.ok) {
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to retrieve session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Verify payment status
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Payment not completed. Status: ${session.payment_status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Verify user_id matches metadata
    if (session.metadata?.user_id && session.metadata.user_id !== user_id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 4. Extract subscription data
    const subscription = session.subscription
    const stripeSubId = typeof subscription === 'string' ? subscription : subscription?.id
    const stripeCustomerId = session.customer
    const planType = session.metadata?.plan_type || 'monthly'
    const currentPeriodEnd = typeof subscription === 'object' && subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null

    // 5. Upsert into subscriptions table (service role bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id,
        stripe_subscription_id: stripeSubId,
        stripe_customer_id: stripeCustomerId,
        plan_type: planType,
        status: 'active',
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError)
    }

    // 6. Update profiles.role to 'subscriber'
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'subscriber' })
      .eq('id', user_id)

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: stripeSubId,
        plan_type: planType,
        status: 'active',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
