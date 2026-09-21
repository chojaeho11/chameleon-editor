// global_franchise.js — 관리자 "가맹 관리" 섹션 (2026-09-15)
//   승인된 가맹점·리셀러의 매출 조회 + 본사↔가맹점 채팅(franchise_messages).
import { sb } from "./global_config.js?v=435";

const _fmEsc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _fmWon = (n) => '₩' + Number(n || 0).toLocaleString();
const _FM_DONE = ['완료됨', '완료', '구매확정', '배송완료', '발송완료'];
const _fmToast = (m, k) => { try { if (window.showToast) return window.showToast(m, k); } catch (e) {} alert(m); };
// 2026-09-21(사장님): 신청 유형(가맹점/리셀러)은 franchise 테마 JSON 의 applicantType 에 저장됨.
const _FM_THEME_BASE = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/logos/franchise/themes/';
async function _fmApplicantType(slug) {
    try {
        const r = await fetch(_FM_THEME_BASE + encodeURIComponent(slug) + '.json?_t=' + Date.now());
        if (!r.ok) return 'reseller';
        const t = await r.json();
        return (t && t.applicantType === 'franchise') ? 'franchise' : 'reseller';
    } catch (e) { return 'reseller'; }
}

window.loadFranchiseManagement = async () => {
    const wrap = document.getElementById('fmList');
    const sum = document.getElementById('fmSummary');
    if (!wrap) return;
    wrap.innerHTML = '<div style="padding:20px;color:#64748b;"><span class="spinner"></span> 불러오는 중…</div>';

    let frs = [], pendingFrs = [], orders = [], msgs = [], roles = {}, setts = [];
    try {
        // 2026-09-21(사장님): 승인 전 신청자도 여기서 보이게 — 전체 조회 후 pending/approved 분리.
        const { data } = await sb.from('franchises')
            .select('id,owner_id,slug,company_name,phone,email,country,status,created_at')
            .order('created_at', { ascending: false });
        const _all = data || [];
        pendingFrs = _all.filter((f) => (f.status || 'pending') === 'pending');
        frs = _all.filter((f) => f.status === 'approved');
    } catch (e) { wrap.innerHTML = '<div style="color:#ef4444;padding:16px;">가맹점 로드 실패: ' + _fmEsc(e.message || e) + '</div>'; return; }

    const slugs = frs.map((f) => f.slug);
    // 2026-09-21(사장님): 주문·요청은 대기 신청자 것도 함께 조회 (관리 패널에서 보이도록).
    const allSlugs = [...frs, ...pendingFrs].map((f) => f.slug);
    const ownerIds = frs.map((f) => f.owner_id).filter(Boolean);
    try { const { data } = await sb.from('orders').select('id,order_date,total_amount,franchise_slug,status').in('franchise_slug', allSlugs).order('order_date', { ascending: false }).limit(3000); orders = data || []; } catch (e) {}
    try { const { data } = await sb.from('franchise_messages').select('*').in('franchise_slug', allSlugs).order('created_at', { ascending: true }).limit(3000); msgs = data || []; } catch (e) {}
    try { const { data } = await sb.from('franchise_settlements').select('*').in('franchise_slug', slugs).order('created_at', { ascending: false }).limit(3000); setts = data || []; } catch (e) {}
    if (ownerIds.length) { try { const { data } = await sb.from('profiles').select('id,role').in('id', ownerIds); (data || []).forEach((p) => { roles[p.id] = p.role; }); } catch (e) {} }

    const ordByFr = {}, msgByFr = {}, setByFr = {};
    orders.forEach((o) => { (ordByFr[o.franchise_slug] = ordByFr[o.franchise_slug] || []).push(o); });
    msgs.forEach((m) => { (msgByFr[m.franchise_slug] = msgByFr[m.franchise_slug] || []).push(m); });
    setts.forEach((s) => { (setByFr[s.franchise_slug] = setByFr[s.franchise_slug] || []).push(s); });

    // 정산 원장 합계 (franchise_settlements: status eligible/requested = 미정산, paid = 기송금)
    const _setSums = (slug) => {
        let owed = 0, paid = 0;
        (setByFr[slug] || []).forEach((s) => {
            const p = Number(s.payout_amount || 0);
            if (s.status === 'paid') paid += p; else owed += p;
        });
        return { owed, paid };
    };

    let gSales = 0, nFr = 0, nRe = 0, gOwed = 0, gPaid = 0;
    frs.forEach((f) => {
        (ordByFr[f.slug] || []).forEach((o) => { gSales += Number(o.total_amount || 0); });
        if (roles[f.owner_id] === 'franchise') nFr++; else nRe++;
        const ss = _setSums(f.slug); gOwed += ss.owed; gPaid += ss.paid;
    });
    if (sum) {
        sum.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">'
            + (pendingFrs.length ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#b91c1c;">🕒 대기 신청</div><div style="font-size:22px;font-weight:800;color:#dc2626;">' + pendingFrs.length + '</div></div>' : '')
            + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#9a3412;">🏭 가맹점</div><div style="font-size:22px;font-weight:800;color:#c2410c;">' + nFr + '</div></div>'
            + '<div style="background:#ede9fe;border:1px solid #c4b5fd;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#6d28d9;">🚀 리셀러</div><div style="font-size:22px;font-weight:800;color:#6d28d9;">' + nRe + '</div></div>'
            + '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#166534;">총 매출</div><div style="font-size:22px;font-weight:800;color:#16a34a;">' + _fmWon(gSales) + '</div></div>'
            + '<div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#854d0e;">미정산 합계</div><div style="font-size:22px;font-weight:800;color:#ca8a04;">' + _fmWon(gOwed) + '</div></div>'
            + '<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:10px 18px;"><div style="font-size:12px;color:#1e40af;">기송금 누계</div><div style="font-size:22px;font-weight:800;color:#2563eb;">' + _fmWon(gPaid) + '</div></div>'
            + '</div>';
    }

    // 2026-09-21(사장님): [관리] 패널 — 사업자·연락 정보 + 주문 내역 + 요청(본사↔가맹). 버튼 토글로 펼침.
    const _fmMgmtContent = (f) => {
        const ords = (ordByFr[f.slug] || []);
        const ms = (msgByFr[f.slug] || []);
        let sales = 0; ords.forEach((o) => { sales += Number(o.total_amount || 0); });
        const orderRows = ords.slice(0, 50).map((o) => {
            const d = o.order_date ? new Date(o.order_date).toLocaleDateString() : '-';
            return '<tr><td style="padding:4px 8px;">' + d + '</td><td style="padding:4px 8px;">#' + o.id + '</td><td style="padding:4px 8px;text-align:right;">' + _fmWon(o.total_amount) + '</td><td style="padding:4px 8px;">' + (_FM_DONE.indexOf(o.status) >= 0 ? '✅ 완료' : _fmEsc(o.status || '진행중')) + '</td></tr>';
        }).join('');
        const thread = ms.length ? ms.map((m) => {
            const hq = m.sender === 'hq';
            const t = m.created_at ? new Date(m.created_at).toLocaleString() : '';
            return '<div style="margin:5px 0;padding:8px 11px;border-radius:9px;background:' + (hq ? '#eef2ff' : '#f1f5f9') + ';max-width:78%;' + (hq ? 'margin-left:auto;' : '') + '"><div style="font-size:13px;color:#1e293b;white-space:pre-wrap;">' + _fmEsc(m.body) + '</div><div style="font-size:10px;color:#94a3b8;margin-top:3px;">' + (hq ? '본사' : '🏪 ' + _fmEsc(f.company_name || '')) + ' · ' + t + '</div></div>';
        }).join('') : '<div style="color:#94a3b8;font-size:13px;padding:10px;">아직 요청·메시지가 없습니다. 먼저 요청을 보내보세요.</div>';
        return '<div class="fm-mgmt" style="display:none;margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:12px;">'
            + '<div style="font-size:12px;color:#475569;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:10px;">'
              + '📇 <b>연락 정보</b> · ' + _fmEsc(f.company_name || f.slug) + ' · ' + _fmEsc(f.phone || '-') + ' · ' + _fmEsc(f.email || '-') + ' · ' + _fmEsc(f.country || '-')
              + ' · <a href="/store/' + _fmEsc(f.slug) + '" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;">🔗 매장 보기</a>'
            + '</div>'
            + '<div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">🧾 주문 내역 (' + ords.length + '건 · 매출 ' + _fmWon(sales) + ')</div>'
            + '<div style="overflow-x:auto;margin-bottom:14px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:5px 8px;text-align:left;">주문일</th><th style="padding:5px 8px;text-align:left;">번호</th><th style="padding:5px 8px;text-align:right;">금액</th><th style="padding:5px 8px;text-align:left;">상태</th></tr></thead><tbody>' + (orderRows || '<tr><td colspan="4" style="padding:10px;color:#94a3b8;">주문 없음</td></tr>') + '</tbody></table></div>'
            + '<div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:6px;">📨 요청 (본사 → ' + _fmEsc(f.company_name || '가맹점') + ')</div>'
            + '<div style="max-height:240px;overflow-y:auto;padding:6px 8px;background:#fafafa;border-radius:8px;">' + thread + '</div>'
            + '<div style="display:flex;gap:6px;margin-top:8px;">'
              + '<textarea id="fmMsg-' + _fmEsc(f.slug) + '" rows="2" placeholder="요청·전달할 내용을 입력하세요…" style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;resize:vertical;"></textarea>'
              + '<button class="btn btn-sm" style="background:#6366f1;color:#fff;align-self:stretch;" onclick="fmSendMsg(\'' + _fmEsc(f.slug) + '\',this)">요청 보내기</button>'
            + '</div>'
          + '</div>';
    };
    const _fmMgmtBtn = '<button class="btn btn-sm" style="background:#e0e7ff;color:#3730a3;font-weight:700;" onclick="var p=this.closest(&quot;.fm-card&quot;).querySelector(&quot;.fm-mgmt&quot;);if(p){p.style.display=p.style.display===&quot;none&quot;?&quot;block&quot;:&quot;none&quot;;}">🛠 관리</button>';

    // 2026-09-21(사장님): 대기 중인 가맹/리셀러 신청 — [승인](신청 유형으로) + [반려] + [관리].
    const pendTypes = pendingFrs.length ? await Promise.all(pendingFrs.map((f) => _fmApplicantType(f.slug))) : [];
    const _fmTypeBadge = (t) => (t === 'franchise')
        ? '<span style="background:#ffedd5;color:#c2410c;border:1px solid #fdba74;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">🏭 가맹점 신청</span>'
        : '<span style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">🚀 리셀러 신청</span>';
    const pendHtml = pendingFrs.length ? (
        '<div class="card" style="margin-bottom:16px;border:1.5px solid #fecaca;background:#fff7f7;">'
        + '<div style="font-size:15px;font-weight:800;color:#b91c1c;margin-bottom:10px;">🕒 대기 중인 신청 (' + pendingFrs.length + ')</div>'
        + pendingFrs.map((f, i) => {
            const d = f.created_at ? new Date(f.created_at).toLocaleDateString() : '-';
            const sl = _fmEsc(f.slug);
            const oid = _fmEsc(f.owner_id || '');
            const at = pendTypes[i];                 // 'franchise' | 'reseller'
            const apprLabel = (at === 'franchise') ? '✅ 가맹점 승인(20%)' : '✅ 리셀러 승인(10%)';
            const apprBg = (at === 'franchise') ? '#c2410c' : '#6366f1';
            return '<div class="fm-card" style="border:1px solid #fecaca;border-radius:10px;padding:12px 14px;margin-bottom:8px;background:#fff;">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">'
                  + '<div style="font-size:13px;color:#334155;min-width:240px;">'
                    + '<b style="font-size:14px;">' + _fmEsc(f.company_name || f.slug) + '</b> ' + _fmTypeBadge(at) + ' <span style="background:#f59e0b22;color:#b45309;border:1px solid #f59e0b66;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;">대기</span><br>'
                    + '<span style="color:#94a3b8;font-size:12px;">' + _fmEsc(f.phone || '') + ' · ' + _fmEsc(f.email || '') + ' · ' + _fmEsc(f.country || '') + ' · 신청 ' + d + '</span>'
                  + '</div>'
                  + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
                    + '<button class="btn btn-sm" style="background:' + apprBg + ';color:#fff;font-weight:800;" onclick="fmApproveApplicant(\'' + sl + '\',\'' + oid + '\',\'' + at + '\',this)">' + apprLabel + '</button>'
                    + '<button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;" onclick="fmRejectApplicant(\'' + sl + '\',this)">❌ 반려</button>'
                    + _fmMgmtBtn
                  + '</div>'
                + '</div>'
                + _fmMgmtContent(f)
              + '</div>';
        }).join('')
        + '</div>'
    ) : '';

    const apprHtml = (!frs.length) ? '<div style="padding:16px;color:#64748b;font-size:13px;">승인된 가맹점·리셀러가 없습니다.</div>' : frs.map((f) => {
        const ords = ordByFr[f.slug] || [];
        let sales = 0, doneN = 0;
        ords.forEach((o) => { sales += Number(o.total_amount || 0); if (_FM_DONE.indexOf(o.status) >= 0) doneN++; });
        const role = roles[f.owner_id];
        const tier = role === 'franchise'
            ? '<span style="background:#ffedd5;color:#c2410c;border:1px solid #fdba74;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">🏭 가맹점 20%</span>'
            : '<span style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;">🚀 리셀러 10%</span>';
        const orderRows = ords.slice(0, 50).map((o) => {
            const d = o.order_date ? new Date(o.order_date).toLocaleDateString() : '-';
            return '<tr><td style="padding:4px 8px;">' + d + '</td><td style="padding:4px 8px;">#' + o.id + '</td><td style="padding:4px 8px;text-align:right;">' + _fmWon(o.total_amount) + '</td><td style="padding:4px 8px;">' + (_FM_DONE.indexOf(o.status) >= 0 ? '✅ 완료' : _fmEsc(o.status || '진행중')) + '</td></tr>';
        }).join('');
        const ms = msgByFr[f.slug] || [];
        const unread = ms.length && ms[ms.length - 1].sender === 'franchise';
        const thread = ms.length ? ms.map((m) => {
            const hq = m.sender === 'hq';
            const t = m.created_at ? new Date(m.created_at).toLocaleString() : '';
            return '<div style="margin:5px 0;padding:8px 11px;border-radius:9px;background:' + (hq ? '#eef2ff' : '#f1f5f9') + ';max-width:78%;' + (hq ? 'margin-left:auto;' : '') + '"><div style="font-size:13px;color:#1e293b;white-space:pre-wrap;">' + _fmEsc(m.body) + '</div><div style="font-size:10px;color:#94a3b8;margin-top:3px;">' + (hq ? '본사' : '🏪 ' + _fmEsc(f.company_name || '가맹점')) + ' · ' + t + '</div></div>';
        }).join('') : '<div style="color:#94a3b8;font-size:13px;padding:10px;">아직 메시지가 없습니다. 먼저 인사를 보내보세요.</div>';

        return '<div class="card fm-card" style="margin-bottom:14px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">'
              + '<div><b style="font-size:16px;">' + _fmEsc(f.company_name || f.slug) + '</b> ' + tier + (unread ? ' <span style="color:#ef4444;font-weight:800;font-size:12px;">🔴 새 요청</span>' : '') + '<br>'
                + '<a href="/store/' + _fmEsc(f.slug) + '" target="_blank" rel="noopener" style="color:#2563eb;font-size:12px;text-decoration:underline;">🔗 /store/' + _fmEsc(f.slug) + '</a> <span style="color:#94a3b8;font-size:12px;">· ' + _fmEsc(f.phone || '') + ' · ' + _fmEsc(f.email || '') + '</span></div>'
              + '<div style="text-align:right;"><div style="font-size:12px;color:#64748b;">매출 / 완료주문</div><div style="font-size:17px;font-weight:800;color:#16a34a;">' + _fmWon(sales) + ' <span style="font-size:12px;color:#64748b;">/ ' + doneN + '건</span></div><div style="margin-top:6px;">' + _fmMgmtBtn + '</div></div>'
            + '</div>'
            + (function () {
                const ss = _setSums(f.slug);
                const payBtn = ss.owed > 0
                    ? '<button class="btn btn-sm" style="background:#ca8a04;color:#fff;font-weight:700;" onclick="fmPayout(\'' + _fmEsc(f.slug) + '\',' + ss.owed + ',this)">💸 ' + _fmWon(ss.owed) + ' 송금완료 처리</button>'
                    : '<span style="font-size:13px;color:#16a34a;font-weight:700;">정산 완료</span>';
                return '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#fafafa;border-radius:8px;padding:8px 12px;">'
                    + '<div style="font-size:13px;color:#334155;">정산 — 미정산 <b style="color:#ca8a04;">' + _fmWon(ss.owed) + '</b> · 기송금 <b style="color:#2563eb;">' + _fmWon(ss.paid) + '</b></div>'
                    + '<div>' + payBtn + '</div>'
                  + '</div>';
              })()
            + _fmMgmtContent(f)
          + '</div>';
    }).join('');
    wrap.innerHTML = pendHtml + apprHtml;
};

// 2026-09-21(사장님): 가맹관리 화면에서 신청 승인/반려 — 처리 후 이 화면을 새로고침.
//   RLS 로 UPDATE 0행(조용한 실패) 대비 .select() 로 반영 확인.
const _FM_RLS_MSG = '권한(RLS)으로 반영되지 않았습니다. _franchise_admin_rls.sql 을 Supabase SQL Editor 에서 먼저 실행하세요.';
window.fmApproveApplicant = async (slug, ownerId, role, btn) => {
    role = (role === 'franchise') ? 'franchise' : 'reseller';
    const pctTxt = (role === 'franchise') ? '가맹점 20%' : '리셀러 10%';
    if (!confirm('[' + slug + '] 을(를) ' + pctTxt + ' 로 승인합니다.\n\n승인 시 이 회원은 본사 상품을 ' + (role === 'franchise' ? '20' : '10') + '% 할인가로 매입할 수 있습니다. 계속할까요?')) return;
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
    try {
        const r1 = await sb.from('franchises').update({ status: 'approved' }).eq('slug', slug).select('id');
        if (r1.error) throw r1.error;
        if (!r1.data || !r1.data.length) throw new Error(_FM_RLS_MSG);
        let roleSkipped = false;
        if (ownerId) {
            // 관리자/매니저 계정은 등급 변경 안 함 (본인 계정 승인 시 관리자 권한 상실 방지).
            let cur = null;
            try { const { data: p } = await sb.from('profiles').select('role').eq('id', ownerId).single(); cur = p && p.role; } catch (e) {}
            if (['admin', 'superadmin', 'manager'].indexOf(cur) >= 0) {
                roleSkipped = true;
            } else {
                const r2 = await sb.from('profiles').update({ role }).eq('id', ownerId).select('id');
                if (r2.error) throw r2.error;
                if (!r2.data || !r2.data.length) throw new Error('상태는 승인됐지만 등급 부여가 RLS 로 막혔습니다. ' + _FM_RLS_MSG);
            }
        }
        _fmToast(roleSkipped ? '승인 완료 — 관리자/매니저 계정이라 등급은 변경하지 않았습니다.' : ('승인 완료 — ' + pctTxt), 'success');
        loadFranchiseManagement();
        if (window.loadFranchiseApplications) { try { window.loadFranchiseApplications(); } catch (e) {} }
    } catch (e) { _fmToast('승인 실패: ' + (e.message || e), 'error'); if (btn) { btn.disabled = false; btn.textContent = orig; } }
};
window.fmRejectApplicant = async (slug, btn) => {
    if (!confirm('[' + slug + '] 신청을 반려합니다.\n\n반려해도 신청자가 다시 저장하면 재신청됩니다. 계속할까요?')) return;
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
    try {
        const r = await sb.from('franchises').update({ status: 'rejected' }).eq('slug', slug).select('id');
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error(_FM_RLS_MSG);
        _fmToast('반려 처리됨', 'success');
        loadFranchiseManagement();
        if (window.loadFranchiseApplications) { try { window.loadFranchiseApplications(); } catch (e) {} }
    } catch (e) { _fmToast('반려 실패: ' + (e.message || e), 'error'); if (btn) { btn.disabled = false; btn.textContent = orig; } }
};

window.fmSendMsg = async (slug, btn) => {
    const ta = document.getElementById('fmMsg-' + slug);
    const body = ta ? ta.value.trim() : '';
    if (!body) return;
    const orig = btn ? btn.textContent : '전송';
    if (btn) { btn.disabled = true; btn.textContent = '전송 중…'; }
    try {
        const r = await sb.from('franchise_messages').insert({ franchise_slug: slug, sender: 'hq', body });
        if (r.error) throw r.error;
        if (r.data === null && r.status && r.status >= 400) throw new Error('전송 실패(권한)');
        _fmToast('메시지 전송됨', 'success');
        loadFranchiseManagement();
    } catch (e) { _fmToast('전송 실패: ' + (e.message || e), 'error'); if (btn) { btn.disabled = false; btn.textContent = orig; } }
};

window.fmPayout = async (slug, amount, btn) => {
    if (!(amount > 0)) return;
    if (!confirm('[' + slug + '] 에 ' + _fmWon(amount) + ' 을(를) 송금 완료로 처리할까요?\n\n(실제 계좌이체는 별도로 진행하세요. 이 처리는 정산 원장을 "송금완료"로 표시합니다.)')) return;
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '처리 중…'; }
    try {
        const r = await sb.from('franchise_settlements').update({ status: 'paid' })
            .eq('franchise_slug', slug).in('status', ['eligible', 'requested']).select('id');
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('반영된 정산 건이 없습니다. (미정산 건이 없거나 권한 문제)');
        _fmToast(r.data.length + '건 송금완료 처리됨', 'success');
        loadFranchiseManagement();
    } catch (e) { _fmToast('정산 처리 실패: ' + (e.message || e), 'error'); if (btn) { btn.disabled = false; btn.textContent = orig; } }
};
