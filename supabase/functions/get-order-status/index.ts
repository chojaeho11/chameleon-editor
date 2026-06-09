// supabase/functions/get-order-status/index.ts
// 2026-06-10: 게스트 주문조회 (일본 고객 注文照会 기능)
//   - order_id + phone(끝 4자리) 매칭으로 조회
//   - 매칭 시 status / payment_status / total_amount / items / created_at 만 반환 (PII 최소화)
//   - 매칭 실패 시 일관된 404 메시지 (가입 ID 노출 방지)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, phone } = await req.json()

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id required' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const SB_URL = Deno.env.get('SUPABASE_URL') || ''
    const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!SB_URL || !SB_KEY) throw new Error('Supabase env missing')

    const url = `${SB_URL}/rest/v1/orders?id=eq.${encodeURIComponent(String(order_id))}&select=id,status,payment_status,total_amount,items,site_code,phone,manager_name,created_at,delivery_target_date,request_note`
    const resp = await fetch(url, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Accept': 'application/json',
      }
    })
    const rows = await resp.json()
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const order = rows[0]

    // phone 끝 4자리 매칭 (전화 입력은 옵션 — 없으면 미니멀 응답만)
    const inputDigits = digitsOnly(phone || '')
    const orderDigits = digitsOnly(order.phone || '')
    const phoneMatches = inputDigits.length >= 4 && orderDigits.endsWith(inputDigits.slice(-4))

    // 매칭 실패: 미니멀 응답 (주문이 존재한다는 사실은 알려주되, PII 노출 X)
    if (!phoneMatches) {
      return new Response(JSON.stringify({
        ok: true,
        minimal: true,
        order: {
          id: order.id,
          status: order.status,
          payment_status: order.payment_status,
          created_at: order.created_at,
          site_code: order.site_code,
        }
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 매칭 성공: 풀 데이터 (manager_name 은 의도적으로 마스킹)
    return new Response(JSON.stringify({
      ok: true,
      minimal: false,
      order: {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
        items: order.items,
        site_code: order.site_code,
        created_at: order.created_at,
        delivery_target_date: order.delivery_target_date,
        manager_name_masked: (order.manager_name || '').replace(/.(?=.{1})/g, '*'),
        request_note: order.request_note,
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('get-order-status error:', error)
    return new Response(JSON.stringify({ error: error.message || 'unknown' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
