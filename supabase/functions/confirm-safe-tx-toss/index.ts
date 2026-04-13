// supabase/functions/confirm-safe-tx-toss/index.ts
// 중고장터 안전거래 Toss 결제 승인 (서버 검증)
// 클라이언트는 successUrl에서 paymentKey/orderId/amount를 받아 이 함수로 POST
// 서버에서 실제 DB price와 대조 + Toss API confirm 호출 후에만 status='paid'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { paymentKey, orderId, amount, txId } = await req.json()
    if (!paymentKey || !orderId || !amount || !txId) {
      throw new Error('Missing: paymentKey, orderId, amount, txId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const tossSecret = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY') || ''
    if (!supabaseUrl || !supabaseKey) throw new Error('supabase env missing')
    if (!tossSecret) throw new Error('toss secret missing')

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    }

    // 1. DB에서 해당 tx 조회 + 상품 가격 검증
    const txRes = await fetch(`${supabaseUrl}/rest/v1/community_safe_transactions?id=eq.${txId}&select=*`, { headers: adminHeaders })
    const txRows = await txRes.json()
    const tx = Array.isArray(txRows) ? txRows[0] : null
    if (!tx) throw new Error('tx not found')
    if (tx.status === 'paid') {
      return new Response(JSON.stringify({ success: true, already: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // 상품 가격 재조회 → 금액 조작 방지
    const itemRes = await fetch(`${supabaseUrl}/rest/v1/community_secondhand?id=eq.${tx.item_id}&select=id,price,status,seller_id`, { headers: adminHeaders })
    const itemRows = await itemRes.json()
    const item = Array.isArray(itemRows) ? itemRows[0] : null
    if (!item) throw new Error('item not found')
    const expectedTotal = Math.round(item.price * 1.2) // 20% 수수료
    if (Number(amount) !== expectedTotal) {
      throw new Error(`amount mismatch: expected ${expectedTotal}, got ${amount}`)
    }

    // 2. Toss 결제 승인 API 호출 (실제 결제 검증)
    const basicAuth = btoa(tossSecret + ':')
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
    const tossData = await tossRes.json()
    if (!tossRes.ok) {
      // 실패 → tx 취소, 상품 다시 active
      await fetch(`${supabaseUrl}/rest/v1/community_safe_transactions?id=eq.${txId}`, {
        method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      await fetch(`${supabaseUrl}/rest/v1/community_secondhand?id=eq.${tx.item_id}`, {
        method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'active' })
      })
      return new Response(JSON.stringify({ error: tossData.message || 'Toss confirm failed', code: tossData.code }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    // 3. 성공 → DB 업데이트 (paid + Toss paymentKey 저장)
    await fetch(`${supabaseUrl}/rest/v1/community_safe_transactions?id=eq.${txId}`, {
      method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString(), toss_payment_key: paymentKey, amount: Number(amount) })
    })
    // 상품은 escrow(예치중) 상태로 (구매자 수령 확인 시 해제 예정)
    await fetch(`${supabaseUrl}/rest/v1/community_secondhand?id=eq.${tx.item_id}`, {
      method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'sold' })
    })

    return new Response(JSON.stringify({ success: true, paymentKey, amount: Number(amount) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    console.error('confirm-safe-tx-toss error:', error)
    return new Response(JSON.stringify({ error: error.message || 'unknown' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
