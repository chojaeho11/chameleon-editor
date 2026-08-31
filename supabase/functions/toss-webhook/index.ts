// supabase/functions/toss-webhook/index.ts
// 2026-08-03 (버그#18): 토스 결제 웹훅 — 브라우저가 success.html 로 못 돌아와도(모바일 앱전환/탭종료/네트워크)
//   서버가 토스로부터 직접 결제완료 통보를 받아 주문을 '결제완료'로 확정한다.
//   이게 없으면 카드가 실제로 승인됐는데도 주문은 계속 '미결제/결제대기' 로 남는다(재접수 반복 원인).
//
//   ★ 활성화: 토스페이먼츠 상점관리자 > 개발자센터 > 웹훅 에서
//     이벤트 PAYMENT_STATUS_CHANGED (+ DEPOSIT_CALLBACK) 를
//     URL  https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/toss-webhook  로 등록.
//
//   보안: 웹훅 body 를 그대로 믿지 않고, paymentKey 로 토스 API 를 재조회해
//         status/amount 를 서버가 직접 검증한 뒤에만 '결제완료' 로 flip 한다.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 미결제 계열만 결제완료로 승격 — 환불완료/취소됨/이미 결제완료 는 건드리지 않는다(환불 로직 무관).
const FLIPPABLE = new Set(['미결제', '결제대기', '입금대기', '상담대기', '임시작성', '결제실패'])

function deriveMethod(p: any): string {
  const easy = p?.easyPay?.provider || ''
  const m = p?.method || ''
  const map: Record<string, string> = {
    '카카오페이': '카카오페이', '네이버페이': '네이버페이', '토스페이': '토스페이',
    '삼성페이': '삼성페이', '애플페이': '애플페이',
    'KAKAOPAY': '카카오페이', 'NAVERPAY': '네이버페이', 'TOSSPAY': '토스페이',
    'SAMSUNGPAY': '삼성페이', 'APPLEPAY': '애플페이',
  }
  if (easy) return map[easy] || easy
  if (m === '카드' || m === 'CARD') {
    const c = p?.card?.company || p?.card?.issuerCode || ''
    return c ? `카드(${c})` : '카드결제'
  }
  if (m === '가상계좌' || m === 'VIRTUAL_ACCOUNT') return '가상계좌'
  if (m === '계좌이체' || m === 'TRANSFER') return '계좌이체'
  if (m === '휴대폰' || m === 'MOBILE_PHONE') return '휴대폰결제'
  return m || '카드/간편결제'
}

// 토스 orderId 형식에서 주문 DB id 추출.
//   'CP-<ts>-<id>'  = cotton_checkout.html (패브릭 단독 결제)
//   'ORD-<ts>-<id>' = 메인 사이트 결제 (order.js:4623) — 2026-08-31 버그#47: 이게 누락돼 메인사이트
//                     카드주문이 브라우저 미복귀 시 웹훅으로 확정 안 되던 문제 → ORD- 도 인식.
//   ★ 그 외 접두사(중고장터 'SAFE-' 등)는 건드리지 않음.
function extractDbId(orderId: string): string | null {
  if (!orderId || !/^(CP|ORD)-/.test(String(orderId))) return null
  const parts = String(orderId).split('-')
  const last = parts[parts.length - 1]
  return /^\d+$/.test(last) ? last : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 웹훅은 어떤 경우에도 2xx 로 응답(비2xx면 토스가 재시도 폭주). 처리 결과는 로그로만.
  const ack = (info: unknown) =>
    new Response(JSON.stringify({ ok: true, info }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  try {
    const body = await req.json().catch(() => ({}))
    const data = body?.data || body
    const eventType = body?.eventType || ''
    const orderId = data?.orderId || ''
    const paymentKey = data?.paymentKey || ''

    // DEPOSIT_CALLBACK(가상계좌 입금)은 body 가 flat + paymentKey 없음 → orderId 로 조회.
    if (!orderId) return ack('missing orderId')

    const dbId = extractDbId(orderId)
    if (!dbId) return ack('non-CP orderId, skip: ' + orderId)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const tossSecret = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY') || ''
    if (!supabaseUrl || !supabaseKey || !tossSecret) return ack('env missing')

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    }

    // 1) 주문 조회 — 이미 결제완료면 멱등 종료.
    const oRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${dbId}&select=id,payment_status,total_amount`, { headers: adminHeaders })
    const oRows = await oRes.json()
    const order = Array.isArray(oRows) ? oRows[0] : null
    if (!order) return ack('order not found: ' + dbId)
    if (order.payment_status === '결제완료' || order.payment_status === '입금확인') return ack('already paid')
    if (!FLIPPABLE.has(order.payment_status)) return ack('non-flippable status: ' + order.payment_status)

    // 2) ★ 토스 API 재조회로 실제 승인 여부/금액 서버 검증 (웹훅 body 신뢰 안 함)
    //    paymentKey 있으면 그걸로, 없으면(가상계좌 콜백) orderId 로 결제 조회.
    const basicAuth = btoa(tossSecret + ':')
    const lookupUrl = paymentKey
      ? `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`
      : `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`
    const pRes = await fetch(lookupUrl, { headers: { Authorization: `Basic ${basicAuth}` } })
    const p = await pRes.json()
    if (!pRes.ok) return ack('toss lookup failed: ' + (p?.message || pRes.status))
    if (p?.status !== 'DONE') return ack('toss status not DONE: ' + p?.status)

    // 금액 대조 — 주문 total_amount 와 토스 승인액이 다르면 flip 안 함(조작/불일치 방어).
    const paid = Number(p?.totalAmount ?? p?.balanceAmount ?? 0)
    const expected = Number(order.total_amount || 0)
    if (expected > 0 && paid > 0 && Math.abs(paid - expected) > 1) {
      return ack(`amount mismatch order=${expected} toss=${paid}`)
    }

    // 3) 결제완료 확정
    await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${dbId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        status: '접수됨',
        payment_status: '결제완료',
        payment_method: deriveMethod(p),
        toss_payment_key: p?.paymentKey || paymentKey,
      }),
    })
    console.log(`[toss-webhook] ${eventType} → order ${dbId} 결제완료 (${deriveMethod(p)})`)

    // 4) Drive 동기화 (응답 후에도 완주)
    try {
      const syncTask = fetch(`${supabaseUrl}/functions/v1/sync-order-to-drive`, {
        method: 'POST', headers: adminHeaders, body: JSON.stringify({ order_id: dbId }),
      }).then(r => r.json()).then(d => console.log('[toss-webhook] drive sync', d?.skipped || d)).catch(() => {})
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(syncTask)
    } catch (_) {}

    return ack('flipped to 결제완료: ' + dbId)
  } catch (e: any) {
    console.error('[toss-webhook] error:', e?.message || e)
    // 그래도 2xx (토스 재시도 폭주 방지). 실패는 로그로 추적.
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  }
})
