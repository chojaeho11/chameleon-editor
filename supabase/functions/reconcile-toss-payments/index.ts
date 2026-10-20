// supabase/functions/reconcile-toss-payments/index.ts
// 2026-10-20 (사장님: "카드결제 미결제 뜨는 버그 근본해결"):
//   카드가 실제로 토스에서 승인됐는데도 주문이 '미결제'로 남는 문제의 근본 안전망.
//   브라우저 success.html 미복귀 + 웹훅 미전달(둘 다 실패) 이어도, 서버가 주기적으로
//   토스 '거래내역(transactions)' 을 직접 당겨와 DB 주문과 대사(reconcile)해 결제완료로 확정한다.
//
//   ★ 토스 body/웹훅을 믿지 않고, 각 건을 토스 payment API 로 재검증(status DONE + 금액 일치)한 뒤에만 flip.
//      중도이탈(미승인) 주문은 애초에 토스 거래내역에 DONE 으로 없으므로 절대 건드리지 않음 → 안전.
//
//   [호출] pg_cron 15분마다 POST (아래 setup). 수동/드라이런도 가능: body { days?:number, dryRun?:boolean }
//   [배포] npx supabase functions deploy reconcile-toss-payments --no-verify-jwt

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 미결제 계열만 결제완료로 승격 — 환불완료/취소됨/이미 결제완료 는 건드리지 않는다.
const FLIPPABLE = new Set(['미결제', '결제대기', '입금대기', '상담대기', '임시작성', '결제실패'])

function deriveMethod(p: any): string {
  const easy = p?.easyPay?.provider || ''
  const m = p?.method || ''
  const map: Record<string, string> = {
    '카카오페이': '카카오페이', '네이버페이': '네이버페이', '토스페이': '토스페이', '삼성페이': '삼성페이', '애플페이': '애플페이',
    'KAKAOPAY': '카카오페이', 'NAVERPAY': '네이버페이', 'TOSSPAY': '토스페이', 'SAMSUNGPAY': '삼성페이', 'APPLEPAY': '애플페이',
  }
  if (easy) return map[easy] || easy
  if (m === '카드' || m === 'CARD') { const c = p?.card?.company || p?.card?.issuerCode || ''; return c ? `카드(${c})` : '카드결제' }
  if (m === '가상계좌' || m === 'VIRTUAL_ACCOUNT') return '가상계좌'
  if (m === '계좌이체' || m === 'TRANSFER') return '계좌이체'
  if (m === '휴대폰' || m === 'MOBILE_PHONE') return '휴대폰결제'
  return m || '카드/간편결제'
}

// 토스 orderId → DB 주문 id. 'CP-<ts>-<id>'(패브릭 단독) / 'ORD-<ts>-<id>'(메인). 그 외(SAFE- 등)는 skip.
function extractDbId(orderId: string): string | null {
  if (!orderId || !/^(CP|ORD)-/.test(String(orderId))) return null
  const parts = String(orderId).split('-')
  const last = parts[parts.length - 1]
  return /^\d+$/.test(last) ? last : null
}

function kstDateStr(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  return k.getUTCFullYear() + '-' + String(k.getUTCMonth() + 1).padStart(2, '0') + '-' + String(k.getUTCDate()).padStart(2, '0')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    let days = 3, dryRun = false
    try { const b = await req.json(); if (b?.days) days = Math.min(31, Math.max(1, +b.days)); if (b?.dryRun) dryRun = true } catch (_) {}

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const tossSecret = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY') || ''
    if (!supabaseUrl || !supabaseKey || !tossSecret) return json({ ok: false, error: 'env missing' }, 200)
    const adminHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey }
    const tossAuth = { Authorization: `Basic ${btoa(tossSecret + ':')}` }

    const now = new Date()
    const startDate = kstDateStr(new Date(now.getTime() - days * 86400000))
    const endDate = kstDateStr(now)

    // 1) 토스 거래내역 당겨오기 (startingAfter 로 페이지네이션)
    const txns: any[] = []
    let startingAfter = ''
    for (let page = 0; page < 50; page++) {   // 최대 50페이지 안전 상한
      const url = `https://api.tosspayments.com/v1/transactions?startDate=${startDate}&endDate=${endDate}&limit=10000` + (startingAfter ? `&startingAfter=${encodeURIComponent(startingAfter)}` : '')
      const r = await fetch(url, { headers: tossAuth })
      const arr = await r.json()
      if (!r.ok) return json({ ok: false, error: 'toss transactions failed', detail: arr?.message || r.status, startDate, endDate }, 200)
      if (!Array.isArray(arr) || arr.length === 0) break
      txns.push(...arr)
      if (arr.length < 10000) break
      startingAfter = arr[arr.length - 1]?.transactionKey || ''
      if (!startingAfter) break
    }

    // 2) ORD-/CP- orderId 만 추려 dbId ↔ paymentKey 매핑 (한 주문의 최신 paymentKey 유지)
    const byDbId: Record<string, { orderId: string; paymentKey: string }> = {}
    for (const t of txns) {
      const orderId = t?.orderId || ''
      const dbId = extractDbId(orderId)
      if (!dbId) continue
      if (t?.paymentKey) byDbId[dbId] = { orderId, paymentKey: t.paymentKey }
      else if (!byDbId[dbId]) byDbId[dbId] = { orderId, paymentKey: '' }
    }
    const dbIds = Object.keys(byDbId)
    if (!dbIds.length) return json({ ok: true, startDate, endDate, txns: txns.length, candidates: 0, flipped: 0, note: 'no CP/ORD transactions' })

    // 3) 그 중 DB 에서 아직 미결제(FLIPPABLE) 인 주문만 조회
    const unpaid: Record<string, any> = {}
    for (let i = 0; i < dbIds.length; i += 150) {
      const chunk = dbIds.slice(i, i + 150)
      const oRes = await fetch(`${supabaseUrl}/rest/v1/orders?id=in.(${chunk.join(',')})&select=id,payment_status,total_amount,status`, { headers: adminHeaders })
      const oRows = await oRes.json()
      if (Array.isArray(oRows)) oRows.forEach((o: any) => { if (FLIPPABLE.has(o.payment_status)) unpaid[o.id] = o })
    }
    const targetIds = Object.keys(unpaid)

    // 4) 각 미결제 건을 토스 payment API 로 재검증(status DONE + 금액 일치) 후 flip
    const flipped: any[] = [], skipped: any[] = []
    for (const dbId of targetIds) {
      const { orderId, paymentKey } = byDbId[dbId]
      const order = unpaid[dbId]
      try {
        const lookupUrl = paymentKey
          ? `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`
          : `https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`
        const pRes = await fetch(lookupUrl, { headers: tossAuth })
        const p = await pRes.json()
        if (!pRes.ok) { skipped.push({ dbId, reason: 'lookup ' + (p?.message || pRes.status) }); continue }
        if (p?.status !== 'DONE') { skipped.push({ dbId, reason: 'status ' + p?.status }); continue }
        const paid = Number(p?.totalAmount ?? p?.balanceAmount ?? 0)
        const expected = Number(order.total_amount || 0)
        if (expected > 0 && paid > 0 && Math.abs(paid - expected) > 1) { skipped.push({ dbId, reason: `amount order=${expected} toss=${paid}` }); continue }

        if (dryRun) { flipped.push({ dbId, orderId, method: deriveMethod(p), amount: paid, DRYRUN: true }); continue }

        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${dbId}`, {
          method: 'PATCH', headers: { ...adminHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: '접수됨', payment_status: '결제완료', payment_method: deriveMethod(p), toss_payment_key: p?.paymentKey || paymentKey }),
        })
        flipped.push({ dbId, orderId, method: deriveMethod(p), amount: paid })

        // Drive 동기화 (best-effort)
        try {
          const syncTask = fetch(`${supabaseUrl}/functions/v1/sync-order-to-drive`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ order_id: dbId }) }).catch(() => {})
          // @ts-ignore
          if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(syncTask)
        } catch (_) {}
      } catch (e) { skipped.push({ dbId, reason: 'err ' + ((e as any)?.message || e) }) }
    }

    return json({ ok: true, startDate, endDate, txns: txns.length, candidates: dbIds.length, unpaid_in_db: targetIds.length, flipped: flipped.length, flipped_detail: flipped, skipped: skipped.slice(0, 20), dryRun })
  } catch (e) {
    return json({ ok: false, error: (e as any)?.message || String(e) }, 200)
  }
})
