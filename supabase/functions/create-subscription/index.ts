// supabase/functions/create-subscription/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stripe Price IDs per country and plan type
// These must be created in Stripe Dashboard first
const PRICE_MAP: Record<string, { monthly: string; annual: string; currency: string }> = {
  'KR': { monthly: 'price_kr_monthly', annual: 'price_kr_annual', currency: 'krw' },
  'JP': { monthly: 'price_jp_monthly', annual: 'price_jp_annual', currency: 'jpy' },
  'US': { monthly: 'price_us_monthly', annual: 'price_us_annual', currency: 'usd' },
  'CN': { monthly: 'price_cn_monthly', annual: 'price_cn_annual', currency: 'cny' },
  'AR': { monthly: 'price_ar_monthly', annual: 'price_ar_annual', currency: 'sar' },
  'ES': { monthly: 'price_es_monthly', annual: 'price_es_annual', currency: 'eur' },
  'DE': { monthly: 'price_de_monthly', annual: 'price_de_annual', currency: 'eur' },
  'FR': { monthly: 'price_fr_monthly', annual: 'price_fr_annual', currency: 'eur' },
}

// Fallback: create price on-the-fly if no Price ID configured
const AMOUNT_MAP: Record<string, { monthly: number; annual: number; currency: string }> = {
  'KR': { monthly: 5000, annual: 48000, currency: 'krw' },
  'JP': { monthly: 900, annual: 8640, currency: 'jpy' },
  'US': { monthly: 900, annual: 8640, currency: 'usd' },   // cents
  'CN': { monthly: 6000, annual: 57600, currency: 'cny' },
  'AR': { monthly: 3500, annual: 33600, currency: 'sar' },
  'ES': { monthly: 900, annual: 8640, currency: 'eur' },    // cents
  'DE': { monthly: 900, annual: 8640, currency: 'eur' },
  'FR': { monthly: 900, annual: 8640, currency: 'eur' },
}

// Zero-decimal currencies (no cents)
const ZERO_DECIMAL = new Set(['krw', 'jpy', 'cny', 'sar'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { country, plan_type, user_id, user_email, success_url, cancel_url } = await req.json()

    if (!country || !plan_type || !user_id || !success_url || !cancel_url) {
      throw new Error('Missing required fields')
    }

    if (plan_type !== 'monthly' && plan_type !== 'annual') {
      throw new Error('plan_type must be monthly or annual')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    const priceConfig = PRICE_MAP[country] || PRICE_MAP['US']
    const amountConfig = AMOUNT_MAP[country] || AMOUNT_MAP['US']
    const priceId = plan_type === 'monthly' ? priceConfig.monthly : priceConfig.annual

    // Build Stripe Checkout Session params
    const params = new URLSearchParams()
    params.append('mode', 'subscription')
    params.append('payment_method_types[]', 'card')

    // Check if we have a real Stripe Price ID (starts with 'price_' from Stripe)
    if (priceId && priceId.startsWith('price_') && priceId.length > 20) {
      // Use pre-created Price ID
      params.append('line_items[0][price]', priceId)
      params.append('line_items[0][quantity]', '1')
    } else {
      // Create price inline using amount
      const currency = amountConfig.currency
      const amount = plan_type === 'monthly' ? amountConfig.monthly : amountConfig.annual
      const interval = plan_type === 'monthly' ? 'month' : 'year'

      params.append('line_items[0][price_data][currency]', currency)
      params.append('line_items[0][price_data][product_data][name]', 'Chameleon PRO Subscription')
      params.append('line_items[0][price_data][product_data][description]',
        plan_type === 'monthly' ? 'Monthly PRO subscription' : 'Annual PRO subscription (20% OFF)')
      params.append('line_items[0][price_data][unit_amount]', String(amount))
      params.append('line_items[0][price_data][recurring][interval]', interval)
      params.append('line_items[0][quantity]', '1')
    }

    // Success/cancel URLs with session_id
    const finalSuccessUrl = success_url.includes('?')
      ? `${success_url}&session_id={CHECKOUT_SESSION_ID}`
      : `${success_url}?session_id={CHECKOUT_SESSION_ID}`
    params.append('success_url', finalSuccessUrl)
    params.append('cancel_url', cancel_url)

    // Customer email for Stripe
    if (user_email) {
      params.append('customer_email', user_email)
    }

    // Metadata
    params.append('metadata[user_id]', user_id)
    params.append('metadata[country]', country)
    params.append('metadata[plan_type]', plan_type)
    params.append('subscription_data[metadata][user_id]', user_id)
    params.append('subscription_data[metadata][country]', country)
    params.append('subscription_data[metadata][plan_type]', plan_type)

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
        JSON.stringify({ error: data.error?.message || 'Stripe session creation failed', stripe_error: data.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ sessionId: data.id, url: data.url }),
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
