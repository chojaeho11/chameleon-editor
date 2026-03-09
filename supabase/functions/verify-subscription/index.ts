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
    const country = session.metadata?.country || 'KR'
    const isLifetime = planType === 'lifetime'

    let currentPeriodEnd: string | null = null
    if (isLifetime) {
      // Lifetime: set expiry far in the future (2099)
      currentPeriodEnd = '2099-12-31T23:59:59.000Z'
    } else if (typeof subscription === 'object' && subscription?.current_period_end) {
      currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
    }

    // 5. Upsert into subscriptions table (service role bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id,
        stripe_subscription_id: stripeSubId || `lifetime_${session.id}`,
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

    // 7. Grant mileage equal to subscription fee (KRW basis)
    //    Monthly: 30,000 / Annual: 165,000 / Lifetime: 1,000,000
    const MILEAGE_MAP: Record<string, Record<string, number>> = {
      'KR': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'JP': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'US': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'CN': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'AR': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'ES': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'DE': { monthly: 30000, annual: 165000, lifetime: 1000000 },
      'FR': { monthly: 30000, annual: 165000, lifetime: 1000000 },
    }
    const mileageAmount = (MILEAGE_MAP[country] || MILEAGE_MAP['KR'])[planType] || 30000
    const mileageKey = `sub_mileage_${planType}_${session.id}`

    try {
      // Prevent duplicate: check by session_id in description
      const { data: existingLog } = await supabase.from('wallet_logs')
        .select('id').eq('user_id', user_id)
        .like('description', `%${session.id}%`).maybeSingle()

      if (!existingLog) {
        const { data: pf } = await supabase.from('profiles')
          .select('mileage').eq('id', user_id).single()
        const currentMileage = parseInt(pf?.mileage || '0') || 0
        await supabase.from('profiles')
          .update({ mileage: currentMileage + mileageAmount }).eq('id', user_id)
        await supabase.from('wallet_logs').insert({
          user_id, type: 'subscription_mileage',
          amount: mileageAmount,
          description: `##SUB_MILEAGE## ${planType} subscription (session: ${session.id})`
        })
        console.log(`[Mileage] Granted ${mileageAmount} for ${planType} plan`)
      }
    } catch (mileErr) {
      console.error('[Mileage] Grant error:', mileErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: stripeSubId || `lifetime_${session.id}`,
        plan_type: planType,
        status: 'active',
        mileage_granted: mileageAmount,
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
