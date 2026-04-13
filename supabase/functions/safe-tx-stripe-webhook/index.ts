// supabase/functions/safe-tx-stripe-webhook/index.ts
// 중고장터 안전거래 Stripe checkout.session.completed webhook
// Stripe Dashboard → Webhooks → Endpoint URL로 이 함수 등록
// Event: checkout.session.completed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const signature = parts.find(p => p.startsWith('v1='))?.split('=')[1]
    if (!timestamp || !signature) return false
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp)) > 300) return false
    const signedPayload = `${timestamp}.${payload}`
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return expectedSig === signature
  } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const webhookSecret = Deno.env.get('STRIPE_SAFE_TX_WEBHOOK_SECRET') || Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    if (!supabaseUrl || !serviceRoleKey) throw new Error('supabase env missing')

    const payload = await req.text()
    const sigHeader = req.headers.get('stripe-signature') || ''

    // Signature 검증 (secret 있으면 필수)
    if (webhookSecret) {
      const ok = await verifyStripeSignature(payload, sigHeader, webhookSecret)
      if (!ok) return new Response('invalid signature', { status: 400, headers: corsHeaders })
    }

    const event = JSON.parse(payload)
    if (event.type !== 'checkout.session.completed') {
      return new Response(JSON.stringify({ ignored: event.type }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const session = event.data.object
    // order_id를 SAFE-{txId} 형식으로 넣었음 (market.html 참고)
    const orderIdRef = session.client_reference_id || session.metadata?.order_id || ''
    const match = /^SAFE-(\d+)$/.exec(orderIdRef)
    if (!match) {
      return new Response(JSON.stringify({ skipped: 'not safe-tx', orderIdRef }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }
    const txId = match[1]

    const sb = createClient(supabaseUrl, serviceRoleKey)

    // tx 조회 + 중복 처리 방지
    const { data: tx } = await sb.from('community_safe_transactions').select('*').eq('id', txId).maybeSingle()
    if (!tx) return new Response('tx not found', { status: 404, headers: corsHeaders })
    if (tx.status === 'paid') return new Response(JSON.stringify({ already: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // 금액 검증 (Stripe은 cents/smallest unit)
    const paidAmount = session.amount_total // USD cents 또는 JPY (zero-decimal)
    // 우리는 DB에 KRW total 저장. session 통화/금액 변환은 client에서 처리했으므로 여기선 단순 존재만 확인.
    if (!paidAmount || session.payment_status !== 'paid') {
      return new Response('not paid', { status: 400, headers: corsHeaders })
    }

    // DB 업데이트
    await sb.from('community_safe_transactions').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
    }).eq('id', txId)

    await sb.from('community_secondhand').update({ status: 'sold' }).eq('id', tx.item_id)

    return new Response(JSON.stringify({ success: true, txId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    console.error('safe-tx-stripe-webhook error:', error)
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
