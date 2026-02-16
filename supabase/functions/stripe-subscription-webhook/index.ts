// supabase/functions/stripe-subscription-webhook/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA256 for Stripe webhook signature verification
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!timestamp || !signature) return false

    // Check timestamp tolerance (5 minutes)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp)) > 300) return false

    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

    return expectedSig === signature
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase config missing')
    }

    const body = await req.text()
    const sigHeader = req.headers.get('stripe-signature') || ''

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const isValid = await verifyStripeSignature(body, sigHeader, webhookSecret)
      if (!isValid) {
        console.error('Invalid webhook signature')
        return new Response('Invalid signature', { status: 400 })
      }
    }

    const event = JSON.parse(body)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log(`Webhook event: ${event.type}`)

    switch (event.type) {
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.user_id
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status

        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)

        // Update profile role based on status
        if (userId && status === 'active') {
          await supabase.from('profiles').update({ role: 'subscriber' }).eq('id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.user_id

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)

        // Revert profile role
        if (userId) {
          await supabase.from('profiles').update({ role: null }).eq('id', userId)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.subscription

        if (subId) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subId)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Webhook Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
