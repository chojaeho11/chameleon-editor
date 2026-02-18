import { sb, initConfig, currentUser, cartData, PRODUCT_DB } from "./config.js?v=123";

// KRW → 현지 통화 표시 헬퍼
function fmtMoney(krw) {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const rate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[country]) || 1;
    const converted = (krw || 0) * rate;
    if (country === 'JP') return '¥' + Math.floor(converted).toLocaleString();
    if (country === 'US') return '$' + Math.round(converted).toLocaleString();
    if (country === 'CN') return '¥' + Math.round(converted).toLocaleString();
    if (country === 'AR') return Math.round(converted).toLocaleString() + ' ﷼';
    if (country === 'ES' || country === 'DE' || country === 'FR') return '€' + converted.toFixed(2);
    return converted.toLocaleString() + '원';
}

// [긴급 수정] 번역 사전 (한글 데이터)
const I18N_KO = {
    "mp_menu_dashboard": "대시보드",
    "mp_menu_designs": "내 디자인",
    "mp_menu_sales": "판매중 (수익)",
    "mp_menu_orders": "주문 내역",
    "mp_menu_profit": "수익금 & 예치금",
    "btn_logout": "로그아웃",
    "mp_welcome_title": "반갑습니다!",
    "mp_welcome_desc": "혹시 설치시공이 필요하다면 주문내역에서 시공입찰에 참여한 가까운 파트너스에게 연락해보세요. 저렴하고 친절합니다.",
    "btn_back_to_editor": "에디터로 돌아가기",
    "mp_label_mileage": "보유 마일리지",
    "mp_label_total_spend": "총 구매금액",
    "mp_label_logo_count": "공유한 로고",
    "mp_label_active_orders": "진행중 주문",
    "mp_welcome_user": "{name}님, 환영합니다!",
    "msg_loading": "로딩 중...",
    "msg_no_designs": "저장된 디자인이 없습니다.",
    "confirm_load_design": "이 디자인을 에디터로 불러오시겠습니까?",
    "confirm_delete": "정말 삭제하시겠습니까?",
    "btn_edit": "편집",
    "btn_delete": "삭제",
    "btn_documents": "서류",
    "doc_quotation": "견적서",
    "doc_receipt": "영수증",
    "doc_order_sheet": "작업지시서",
    "doc_statement": "거래명세서",
    "btn_reorder": "다시담기",
    "btn_cancel": "취소",
    "btn_cancel_order": "주문취소",
    "btn_write_review": "후기 작성",
    "msg_review_completed": "후기 작성 완료",
    "msg_no_orders": "주문 내역이 없습니다.",
    "msg_no_product_info": "상품 정보 없음",
    "label_product": "상품",
    "label_more_items": "건",
    "confirm_cancel_order": "이 주문을 취소하시겠습니까?",
    "confirm_reorder": "이 상품들을 장바구니에 다시 담으시겠습니까?",
    "confirm_go_to_cart": "장바구니로 이동하시겠습니까?",
    "confirm_logout": "로그아웃 하시겠습니까?",
    "btn_close": "닫기",
    "msg_no_bids_yet": "아직 입찰이 없습니다.\n파트너가 검토 중입니다. 잠시만 기다려주세요.",
    "msg_no_sales": "판매 중인 디자인이 없습니다.",
    "msg_no_records": "내역이 없습니다.",
    "msg_no_reviews": "등록된 후기가 없습니다.",
    "label_partner_reviews": "파트너 후기",
    "label_deposit": "입금",
    "label_payment": "결제",
    "label_withdrawal": "출금",
    "label_admin_adjust": "관리자 조정",
    "label_other": "기타",
    // 주문 상태 번역
    "status_접수대기": "접수대기",
    "status_입금대기": "입금대기",
    "status_접수됨": "접수됨",
    "status_제작준비": "제작준비",
    "status_제작중": "제작중",
    "status_배송중": "배송중",
    "status_배송완료": "배송완료",
    "status_구매확정": "구매확정",
    "status_완료됨": "완료됨",
    "status_취소됨": "취소됨",
    "status_임시작성": "임시작성"
};

// 주문 상태 번역 함수
function translateStatus(rawStatus) {
    return window.t('status_' + rawStatus, rawStatus);
}

// window.t 함수 초기화 (번역 로드 전 한국어 fallback)
if (typeof window.t !== 'function') {
    window.t = function(key, fallback) {
        return (window.translations && window.translations[key]) || I18N_KO[key] || fallback || key;
    };
}

// 다국어 번역 파일 로드
async function loadMyPageTranslations() {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const langMap = { 'KR': 'kr', 'JP': 'ja', 'US': 'en', 'CN': 'zh', 'AR': 'ar', 'ES': 'es', 'DE': 'de', 'FR': 'fr' };
    const lang = langMap[country] || 'kr';
    if (lang === 'kr') return; // 한국어는 I18N_KO로 충분

    try {
        const jsonPath = `long/${lang}_123.json?t=${Date.now()}`;
        const res = await fetch(jsonPath);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        window.translations = data;
        // window.t를 번역 데이터 우선으로 갱신
        window.t = function(key, fallback) {
            return (window.translations && window.translations[key]) || fallback || key;
        };
    } catch(e) {
        console.warn('마이페이지 번역 로드 실패, 한국어 유지:', e);
    }
}

// [1] 초기화
document.addEventListener("DOMContentLoaded", async () => {
    // 1. 설정 로드
    await initConfig();

    // 2. 다국어 번역 로드 (JP/US인 경우 JSON 파일에서 로드)
    await loadMyPageTranslations();

    // 3. 번역 적용 (HTML의 data-i18n 태그들)
    applyTranslations();

    if (!currentUser) {
        alert(window.t('msg_login_required') || "Login is required.");
        location.href = 'index.html';
        return;
    }

    // 유저 이름 표시 (오류 방지를 위해 try-catch 추가)
    try {
        const userName = currentUser.user_metadata?.full_name || 'Customer';
        const displayTitle = document.getElementById('userNameDisplay');
        if(displayTitle) {
            // window.t가 안전하게 정의되었으므로 호출 가능
            const tpl = window.t('mp_welcome_user') || "Welcome, {name}!";
            displayTitle.innerText = tpl.replace('{name}', userName);
        }
    } catch(e) { console.warn("유저명 표시 오류", e); }
    
    // 대시보드 통계 및 지갑 로그 로드
    loadDashboardStats();
    loadWalletLogs();
    
    // ★ [핵심] 전역 함수 연결 (이 코드가 실행되어야 버튼이 작동함)
    window.switchTab = switchTab;
    window.logout = logout;
    window.loadDesignToEditor = loadDesignToEditor;
    window.deleteDesign = deleteDesign;
    window.cancelOrder = cancelOrder;
    window.reOrder = reOrder;
    window.openWithdrawModal = openWithdrawModal;
    window.requestWithdrawal = requestWithdrawal;
});

// [번역 적용 함수]
function applyTranslations() {
    const dict = window.translations || {};
    const t = (k) => dict[k] || I18N_KO[k] || '';
    // data-i18n 속성
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (text) {
            // HTML 태그 포함 시 innerHTML, 아니면 innerText
            if (text.includes('<')) {
                el.innerHTML = text;
            } else {
                el.innerText = text;
            }
        }
    });
    // data-i18n-placeholder 속성
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = t(key);
        if (text) el.placeholder = text;
    });

    // 국가별 통화 단위 설정
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const currUnit = { KR: '원', JP: '¥', US: '$', CN: '¥', AR: '﷼', ES: '€', DE: '€', FR: '€' }[country] || '원';
    const depositUnit = document.getElementById('depositCurrencyUnit');
    if (depositUnit) depositUnit.innerText = currUnit;
    const wdCurrLabel = document.getElementById('wdCurrencyLabel');
    if (wdCurrLabel) wdCurrLabel.innerText = currUnit;

    // 해외 사이트에서 주민등록번호 행 숨김 (JP/US는 Tax ID/マイナンバー로 변경됨)
    // KR 이외에서는 placeholder도 변경
    if (country !== 'KR') {
        const phoneInput = document.getElementById('wdPhone');
        if (phoneInput) phoneInput.placeholder = '';
    }
}

// [2] 탭 전환 기능
function switchTab(tabId) {
    const navItems = document.querySelectorAll('.mp-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    
    // 클릭된 탭 활성화 (이벤트 타겟이 아닌 ID로 찾기)
    // HTML onclick에서 호출하므로, 해당 함수를 가진 요소를 찾거나 수동 지정 필요
    // 여기서는 간단히 모든 nav 아이템 중 onclick 속성에 tabId가 포함된 것을 찾음
    for(let el of navItems) {
        if(el.getAttribute('onclick') && el.getAttribute('onclick').includes(tabId)) {
            el.classList.add('active');
            break;
        }
    }

    // 섹션 전환
    document.querySelectorAll('.mp-section').forEach(el => el.classList.remove('active'));
    const targetSection = document.getElementById('tab-' + tabId);
    if(targetSection) targetSection.classList.add('active');

    // 탭별 데이터 로드
    if (tabId === 'designs') loadMyDesigns();
    if (tabId === 'orders') loadOrders();
    if (tabId === 'sales') loadMySales();
}

// [3] 등급 자동 승급 체크
async function checkAndUpgradeTier(userId, currentRole) {
    if (currentRole === 'admin' || currentRole === 'franchise') return;

    try {
        const { data: profile } = await sb.from('profiles')
            .select('total_spend, logo_count')
            .eq('id', userId)
            .single();

        const totalSpend = profile?.total_spend || 0;
        const logoCount = profile?.logo_count || 0;

        let newRole = 'customer';

        if (logoCount >= 100 || totalSpend >= 10000000) {
            newRole = 'platinum';
        } else if (logoCount >= 10 || totalSpend >= 5000000) {
            newRole = 'gold';
        }

        const levels = { 'customer': 0, 'gold': 1, 'platinum': 2 };
        if (newRole !== currentRole && levels[newRole] > levels[currentRole]) {
            await sb.from('profiles').update({ role: newRole }).eq('id', userId);
            
            const rate = newRole === 'platinum' ? '5%' : '3%';
            alert(window.t('msg_tier_upgraded', `Congratulations! Upgraded to '${newRole.toUpperCase()}'.\n(${rate} discount applied)`));
            location.reload(); 
        }
    } catch (e) {
        console.error("등급 체크 오류:", e);
    }
}

// [4] 대시보드 통계 로드 (패널티 경고창 기능 강화)
async function loadDashboardStats() {
    try {
        // ★ [수정] contributor_tier와 penalty_reason을 명시적으로 조회
        const { data: profile, error } = await sb.from('profiles')
            .select('mileage, role, total_spend, logo_count, deposit, contributor_tier, penalty_reason')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;

        // ★ [핵심] 패널티 등급 확인 및 알림 표시 로직
        const tier = profile.contributor_tier || 'regular';
        const warningBox = document.getElementById('penaltyWarningBox');
        
        if (tier === 'penalty') {
            const reason = profile.penalty_reason || window.t('msg_default_penalty_reason', 'Policy violation / Copyright issue');
            
            // 경고 박스가 없으면 생성해서 삽입
            if (!warningBox) {
                const alertHtml = `
                    <div id="penaltyWarningBox" style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:15px; border-radius:12px; margin-bottom:20px; display:flex; align-items:start; gap:10px;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:20px; margin-top:2px;"></i>
                        <div>
                            <strong style="display:block; font-size:15px; margin-bottom:4px;">${window.t('msg_penalty_notice_title', 'Account Penalty Notice')}</strong>
                            <div style="font-size:13px;">${window.t('msg_penalty_notice_body', 'Your account has been placed under <b>penalty status</b>.<br>During this period, sales revenue is limited to <b>50P per registration</b>.')}</div>
                            <div style="margin-top:8px; font-size:12px; background:white; padding:6px 10px; border-radius:6px; border:1px solid #fca5a5; display:inline-block;">
                                <b>${window.t('label_reason', 'Reason')}:</b> ${reason}
                            </div>
                        </div>
                    </div>`;
                const dashboardTab = document.getElementById('tab-dashboard');
                // 대시보드 맨 위에 삽입
                if(dashboardTab) dashboardTab.insertAdjacentHTML('afterbegin', alertHtml);
            }
        } else {
            // 패널티가 풀렸으면 경고 박스 제거
            if (warningBox) warningBox.remove();
        }

        // 기존 통계 데이터 바인딩
        const elMileage = document.getElementById('mileageDisplay');
        if(elMileage) elMileage.innerText = fmtMoney(profile.mileage || 0).replace(/[원¥$]/g, '').trim() + ' P';

        const elSpend = document.getElementById('totalSpendDisplay');
        if(elSpend) elSpend.innerText = fmtMoney(profile.total_spend || 0);

        const elLogo = document.getElementById('logoCountDisplay');
        if(elLogo) elLogo.innerText = (profile.logo_count || 0);

        const elTotalDeposit = document.getElementById('displayTotalDeposit');
        if(elTotalDeposit) elTotalDeposit.innerText = fmtMoney(profile.deposit || 0).replace(/[원¥$]/g, '').trim();

        const elTotalMileage = document.getElementById('displayTotalMileage');
        if(elTotalMileage) elTotalMileage.innerText = fmtMoney(profile.mileage || 0).replace(/[원¥$]/g, '').trim();

        // 등급 승급 체크
        await checkAndUpgradeTier(currentUser.id, profile.role);

        // 진행중 주문 건수 조회
        const { count: orderCount } = await sb.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .neq('status', '완료됨')
            .neq('status', '취소됨')
            .neq('status', '배송완료');

        const elOrder = document.getElementById('activeOrderCount');
        if(elOrder) elOrder.innerText = (orderCount || 0);

        const recentLogArea = document.getElementById('recentLogs');
        if(recentLogArea) {
             recentLogArea.innerHTML = `<li>${window.t('msg_no_recent_revenue', 'No revenue in the last 30 days.')}</li>`;
        }

    } catch(e) {
        console.warn("대시보드 로드 실패:", e);
    }
}

// [5] 디자인 목록 로드
async function loadMyDesigns() {
    const grid = document.getElementById('designGrid');
    if(!grid) return;
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:30px;">${window.t('msg_loading')}</div>`;
    
    const { data, error } = await sb.from('user_designs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    grid.innerHTML = '';
    if (!data || data.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">${window.t('msg_no_designs')}</div>`;
        return;
    }

    data.forEach(d => {
        const div = document.createElement('div');
        div.className = 'mp-design-card';
        div.innerHTML = `
            <img src="${d.thumb_url}" class="mp-design-thumb" onclick="loadDesignToEditor(${d.id})">
            <div class="mp-design-body">
                <div class="mp-design-title">${d.title}</div>
                <div style="font-size:11px; color:#888;">${new Date(d.created_at).toLocaleDateString()}</div>
                <div style="display:flex; gap:5px; margin-top:5px;">
                    <button class="btn-round primary" onclick="loadDesignToEditor(${d.id})" style="flex:1; font-size:12px; height:30px; justify-content:center;">${window.t('btn_edit')}</button>
                    <button class="btn-round" onclick="deleteDesign(${d.id})" style="width:30px; height:30px; color:red; border-color:#fee2e2; justify-content:center;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        grid.appendChild(div);
    });
}

function loadDesignToEditor(id) {
    if(!confirm(window.t('confirm_load_design'))) return;
    localStorage.setItem('load_design_id', id); 
    location.href = 'index.html'; 
}

async function deleteDesign(id) {
    if (!confirm(window.t('confirm_delete'))) return;
    await sb.from('user_designs').delete().eq('id', id);
    loadMyDesigns();
}

// [6] 주문 목록 로드
async function loadOrders() {
    const tbody = document.getElementById('orderListBody');
    if(!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px;">${window.t('msg_loading', 'Loading...')}</td></tr>`;

    const { data: orders } = await sb.from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:50px; color:#999;">${window.t('msg_no_orders', 'No order history.')}</td></tr>`;
        return;
    }

    window.myOrdersData = orders;

    orders.forEach(o => {
        let items = [];
        try { items = (typeof o.items === 'string') ? JSON.parse(o.items) : o.items; } catch(e) {}
        
        let summary = window.t('msg_no_product_info', "No product info");
        if (Array.isArray(items) && items.length > 0) {
            summary = items[0].productName || items[0].product?.name || window.t('label_product', "Product");
            if (items.length > 1) summary += ` + ${items.length - 1} ${window.t('label_more_items', 'more')}`;
        }

        let badgeClass = 'status-wait';
        if(['완료됨','배송완료','구매확정'].includes(o.status)) badgeClass = 'status-done';
        if(o.status === '취소됨') badgeClass = 'status-cancel';

        const canCancel = ['접수대기','입금대기'].includes(o.status);
        const safeId = String(o.id); 
        const displayId = safeId.length > 8 ? safeId.substring(0,8) + '...' : safeId;

        // [수정됨] 상태별 버튼 분기 처리
        let actionBtn = '';

        if (o.status === '배송완료') {
            actionBtn = `<button onclick="window.openPartnerReviewModal('${o.id}')" class="btn-round" style="margin-top:5px; background:#f59e0b; color:white; border:none; padding:4px 10px; font-size:11px; width:100%;">${window.t('btn_write_review', 'Write Partner Review')}</button>`;
        }
        else if (o.status === '구매확정') {
            actionBtn = `<span style="font-size:11px; color:#16a34a; font-weight:bold;">${window.t('msg_review_completed', 'Review Completed')}</span>`;
        }

        // 상태 번역
        const translatedStatus = translateStatus(o.status);

        tbody.innerHTML += `
            <tr>
                <td style="white-space:nowrap;">
                    ${new Date(o.created_at).toLocaleDateString()}<br>
                    <small style="color:#888;">#${o.id}</small>
                </td>
                <td><div style="font-weight:bold;">${summary}</div></td>
                <td style="font-weight:bold; white-space:nowrap;">${fmtMoney(o.total_amount || 0)}</td>
                <td>
                    <span class="status-badge ${badgeClass}">${translatedStatus}</span>
                    ${actionBtn}
                </td>
                <td style="min-width:110px;">
                    <div style="display:flex; flex-direction:column; gap:3px;">
                        <div style="display:flex; gap:3px;">
                            ${canCancel ? `<button class="btn-cancel-order" onclick="cancelOrder('${o.id}')" style="flex:1; font-size:10px; padding:3px 6px;">${window.t('btn_cancel', 'Cancel')}</button>` : ''}
                            <button onclick="reOrder('${o.id}')" style="flex:1; height:24px; font-size:10px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; cursor:pointer; white-space:nowrap;">${window.t('btn_reorder', 'Reorder')}</button>
                        </div>
                        <div style="position:relative;">
                            <button onclick="toggleDocDropdown(event, '${o.id}')" style="width:100%; height:24px; font-size:10px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; border-radius:6px; cursor:pointer;">📄 ${window.t('btn_documents', 'Documents')} ▾</button>
                            <div id="docDrop-${o.id}" class="doc-dropdown" style="display:none; position:absolute; bottom:100%; left:0; right:0; background:white; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:100; margin-bottom:4px; overflow:hidden;">
                                <div onclick="downloadOrderDoc('${o.id}','quotation')" style="padding:7px 10px; font-size:11px; cursor:pointer; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">📋 ${window.t('doc_quotation', 'Quotation')}</div>
                                <div onclick="downloadOrderDoc('${o.id}','receipt')" style="padding:7px 10px; font-size:11px; cursor:pointer; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">🧾 ${window.t('doc_receipt', 'Receipt')}</div>
                                <div onclick="downloadOrderDoc('${o.id}','order_sheet')" style="padding:7px 10px; font-size:11px; cursor:pointer; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">📝 ${window.t('doc_order_sheet', 'Work Order')}</div>
                                <div onclick="downloadOrderDoc('${o.id}','statement')" style="padding:7px 10px; font-size:11px; cursor:pointer;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">📑 ${window.t('doc_statement', 'Invoice')}</div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
    });
}

async function cancelOrder(orderId) {
    if (!confirm(window.t('confirm_cancel_order', "Cancel this order?"))) return;
    await sb.from('orders').update({ status: '취소됨' }).eq('id', orderId);
    loadOrders();
}

async function reOrder(orderId) {
    const order = window.myOrdersData?.find(o => o.id == orderId);
    if (!order) return;
    
    let items = [];
    try { items = (typeof order.items === 'string') ? JSON.parse(order.items) : order.items; } catch(e) {}
    
    if (confirm(window.t('confirm_reorder', "Add these items to cart again?"))) {
        items.forEach(item => {
            const newItem = { ...item, uid: Date.now() + Math.random() };
            cartData.push(newItem);
        });
        localStorage.setItem(`chameleon_cart_${currentUser.id}`, JSON.stringify(cartData));
        if(confirm(window.t('confirm_go_to_cart', "Go to cart?"))) {
            localStorage.setItem('open_cart_on_load', 'true');
            location.href = 'index.html';
        }
    }
}

// [신규] 판매중인 디자인 로드
// [신규] 판매중인 디자인 로드 (패널티 적용 수정판)
async function loadMySales() {
    const grid = document.getElementById('mySalesGrid');
    if(!grid) return;
    grid.innerHTML = window.t('msg_loading', 'Loading...');

    // 1. 라이브러리(디자인) 조회
    const { data } = await sb.from('library').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if(!data || data.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">${window.t('msg_no_sales', 'No designs for sale.')}</div>`;
        return;
    }

    // ★ [핵심] 현재 유저의 '패널티 등급' 여부를 DB에서 다시 조회
    const { data: profile } = await sb.from('profiles')
        .select('contributor_tier')
        .eq('id', currentUser.id)
        .single();
    
    // 패널티인지 확인
    const isPenalty = profile?.contributor_tier === 'penalty';

    grid.innerHTML = '';
    let total = 0;

    data.forEach(d => {
        // 기본 보상: 로고 150P, 기타 100P
        let reward = d.category === 'logo' ? 150 : 100;
        
        // ★ [패널티 적용] 등급이 penalty라면 무조건 50P로 고정
        if (isPenalty) {
            reward = 50; 
        }

        total += reward;
        
        // 화면 표시 스타일 (패널티면 빨간색)
        const rewardStyle = isPenalty ? 'color:#ef4444; font-weight:bold;' : 'color:#16a34a;';
        const displayReward = fmtMoney(reward).replace(/[원¥$]/g, '').trim();
        const rewardText = isPenalty ? `${window.t('msg_penalty_applied', 'Penalty applied')}: ${displayReward}P` : `${window.t('msg_registration_reward', 'Registration reward')}: ${displayReward}P`;

        grid.innerHTML += `
            <div class="mp-design-card">
                <img src="${d.thumb_url}" class="mp-design-thumb" style="height:150px; object-fit:cover;">
                <div class="mp-design-body">
                    <div style="font-weight:bold;">${d.title || window.t('msg_untitled', 'Untitled')}</div>
                    <div style="font-size:12px; color:#666;">${d.category}</div>
                    <div style="margin-top:5px; font-size:12px; ${rewardStyle}">${rewardText}</div>
                </div>
            </div>`;
    });

    const elTotal = document.getElementById('totalSalesPoint');
    if(elTotal) elTotal.innerText = fmtMoney(total).replace(/[원¥$]/g, '').trim() + ' P';
}

// [수정] 출금 모달 열기 (예치금 deposit 조회)
function openWithdrawModal() {
    const cfg = window.SITE_CONFIG || {};
    const country = cfg.COUNTRY || 'KR';
    const currUnit = { KR: '원', JP: '¥', US: '$', CN: '¥', AR: '﷼', ES: '€', DE: '€', FR: '€' }[country] || '원';

    sb.from('profiles').select('deposit').eq('id', currentUser.id).single().then(({data}) => {
        const currentDeposit = data?.deposit || 0;
        const displayAmount = fmtMoney(currentDeposit).replace(/[원¥$]/g, '').trim();
        document.getElementById('wdCurrentMileage').innerText = displayAmount;
        const wdCurrLabel = document.getElementById('wdCurrencyLabel');
        if (wdCurrLabel) wdCurrLabel.innerText = currUnit;
        document.getElementById('withdrawModal').style.display = 'flex';
    });
}

// [신규] 출금 신청
async function requestWithdrawal() {
    const amt = parseInt(document.getElementById('wdAmount').value);
    const bank = document.getElementById('wdBank').value;
    const acc = document.getElementById('wdAccount').value;
    const holder = document.getElementById('wdHolder').value;
    const phone = document.getElementById('wdPhone') ? document.getElementById('wdPhone').value : '';
    const rrn = document.getElementById('wdRRN') ? document.getElementById('wdRRN').value : '';

    const curEl = document.getElementById('wdCurrentMileage');
    const cur = curEl ? parseInt(curEl.innerText.replace(/,/g,'')) : 0;

    const cfg = window.SITE_CONFIG || {};
    const wdCountry = cfg.COUNTRY || 'KR';
    const wdRate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[wdCountry]) || 1;
    const minAmounts = { 'KR': 1000, 'JP': 200, 'US': 20 };
    const minLocal = minAmounts[wdCountry] || 1000;
    if(!amt || amt < minLocal) return alert(window.t('msg_min_withdraw', `Minimum withdrawal amount is ${minLocal}.`));
    if(amt > cur) return alert(window.t('msg_insufficient_deposit', "Insufficient deposit balance."));

    if(!bank || !acc || !holder) return alert(window.t('msg_enter_bank_info', "Please enter bank account info."));
    if(!phone || !rrn) return alert(window.t('msg_enter_contact_id', "Please enter contact and ID number."));

    if(!confirm(window.t('confirm_withdraw_request', `입력하신 정보로 출금을 신청하시겠습니까?\n(입력 정보 오류 시 입금이 지연될 수 있습니다.)`))) return;

    // 역환산: 사용자 입력(현지 통화) → KRW로 변환하여 DB 저장
    const amtKRW = Math.round(amt / wdRate);

    try {
        const { error: reqError } = await sb.from('withdrawal_requests').insert({
            user_id: currentUser.id,
            amount: amtKRW,
            bank_name: bank, 
            account_number: acc, 
            account_holder: holder,
            contact_phone: phone,
            rrn: rrn,
            status: 'pending'
        });

        if (reqError) throw reqError;

        // ★ [중요] 예치금(deposit)에서 차감 (KRW 기준)
        // cur는 표시용(환산된 값)이므로 KRW로 역환산하여 차감
        const curKRW = Math.round(cur / wdRate);
        const { error: profileError } = await sb.from('profiles')
            .update({ deposit: curKRW - amtKRW })
            .eq('id', currentUser.id);

        if (profileError) throw profileError;

        const wdDesc = window.t('label_withdrawal', 'Withdrawal') + `(${bank})`;
        await sb.from('wallet_logs').insert({
            user_id: currentUser.id, type: 'withdraw_req', amount: -amtKRW, description: wdDesc
        });

        alert(window.t('msg_withdraw_success', "출금 신청이 완료되었습니다.\n관리자 확인 후(D+5일 내) 입금됩니다."));
        document.getElementById('withdrawModal').style.display = 'none';
        
        // 초기화
        document.getElementById('wdAmount').value = '';
        loadDashboardStats();

    } catch (e) {
        console.error(e);
        alert(window.t('err_prefix', "Error: ") + e.message);
    }
}

// [7] 입출금 내역 로드
async function loadWalletLogs() {
    const tbody = document.getElementById('walletListBody');
    if(!tbody) return;

    const { data: logs } = await sb.from('wallet_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if(!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px;">${window.t('msg_no_records', 'No records found.')}</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    logs.forEach(log => {
        const isPlus = log.amount > 0;
        const color = isPlus ? '#2563eb' : '#ef4444';
        const sign = isPlus ? '+' : '';
        const isReferral = log.type === 'referral_bonus';

        let typeName = window.t('label_other', 'Other');
        if(isReferral) typeName = window.t('referral_badge', '추천');
        else if(log.type?.includes('deposit')) typeName = window.t('label_deposit', 'Deposit');
        else if(log.type?.includes('payment')) typeName = window.t('label_payment', 'Payment');
        else if(log.type?.includes('withdraw')) typeName = window.t('label_withdrawal', 'Withdrawal');
        else if(log.type?.includes('admin')) typeName = window.t('label_admin_adjust', 'Admin Adjust');

        const badgeStyle = isReferral
            ? 'background:linear-gradient(135deg,#ede9fe,#e0e7ff); color:#7c3aed; border:1px solid #a78bfa; font-weight:bold;'
            : 'background:#f1f5f9; color:#64748b;';

        let descHtml = log.description || '-';
        if (isReferral) {
            // ##REFERRAL##이름##주문번호## 구조화 포맷 파싱
            let refDesc = log.description || '';
            const refMatch = refDesc.match(/##REFERRAL##(.+?)##(.+?)##/);
            if (refMatch) {
                const buyerName = refMatch[1];
                const orderNum = refMatch[2];
                refDesc = window.t('referral_log_desc', '{name}님의 추천으로 예치금이 적립되었습니다.')
                    .replace('{name}', buyerName)
                    + ` (${window.t('label_order_num', '주문')}: ${orderNum})`;
            }
            descHtml = `<div style="font-weight:600; color:#6d28d9;">${refDesc}</div>
                <div style="margin-top:4px; font-size:11px; color:#666; line-height:1.5; background:#f5f3ff; padding:6px 10px; border-radius:6px; border-left:3px solid #7c3aed;">
                    ${window.t('referral_log_info', '예치금은 현금처럼 사용 가능합니다. 출금 시 3.3%의 세금이 공제됩니다.')}
                </div>`;
        }

        tbody.innerHTML += `
            <tr${isReferral ? ' style="background:#faf5ff;"' : ''}>
                <td>${new Date(log.created_at).toLocaleDateString()}</td>
                <td><span class="status-badge" style="${badgeStyle}">${isReferral ? '🎁 ' : ''}${typeName}</span></td>
                <td>${descHtml}</td>
                <td style="text-align:right; font-weight:bold; color:${isReferral ? '#7c3aed' : color};">${sign}${log.amount.toLocaleString()}</td>
            </tr>`;
    });
}

async function logout() {
    if(confirm(window.t('confirm_logout', "Log out?"))) {
        await sb.auth.signOut();
        location.href = 'index.html';
    }
}
// [수정됨] 오타 수정 완료된 함수
window.checkBidsForOrder = async function(orderId) {
    // 1. 입찰 내역 조회
    const { data: bids, error } = await sb.from('bids')
        .select('*')
        .eq('order_id', orderId)
        .order('price', { ascending: true });

    if(error || !bids || bids.length === 0) {
        alert(window.t('msg_no_bids_yet', "No bids received yet.\nPartners are reviewing. Please wait."));
        return;
    }

    // 2. 파트너 평점 정보 조회
    // (여기서 map(b => ...) 부분은 안전하지만, 아래쪽 forEach에서 헷갈리지 않게 bid로 통일합니다)
    const partnerIds = bids.map(bid => bid.partner_id); 
    let profileMap = {};
    
    try {
        const { data: profiles } = await sb.from('profiles')
            .select('id, avg_rating, review_count, company_name')
            .in('id', partnerIds);
        
        if(profiles) {
            profiles.forEach(p => { profileMap[p.id] = p; });
        }
    } catch(e) {
        console.warn("평점 로드 실패:", e);
    }

    // 3. 모달 UI 생성
    const old = document.getElementById('bidListModal');
    if(old) old.remove();

    let listHtml = '';
    
    // ★ 여기가 문제였을 수 있습니다. bid로 통일합니다.
    bids.forEach(bid => {
        const isSelected = bid.status === 'selected';
        
        // 파트너 정보 (없으면 기본값)
        const partnerInfo = profileMap[bid.partner_id] || { avg_rating: 0, review_count: 0, company_name: bid.company_name };

        // 별점 생성
        const score = partnerInfo.avg_rating || 0;
        let stars = '';
        for(let i=0; i<5; i++) stars += i < Math.round(score) ? '⭐' : '<span style="opacity:0.3">⭐</span>';

        // 후기 보기 링크
        const reviewText = partnerInfo.review_count > 0
            ? `<span style="font-size:11px; color:#64748b; text-decoration:underline; cursor:pointer;" onclick="viewPartnerReviews('${bid.partner_id}')">${window.t('btn_view_reviews', 'View Reviews')} (${partnerInfo.review_count})</span>`
            : `<span style="font-size:11px; color:#ccc;">${window.t('msg_no_reviews', 'No reviews')}</span>`;

        let actionArea = '';
        if(isSelected) {
            actionArea = `
                <div style="margin-top:10px; padding:10px; background:#dcfce7; border:1px solid #bbf7d0; border-radius:8px; text-align:center;">
                    <div style="font-weight:bold; color:#166534; font-size:14px;">${window.t('msg_selection_complete', 'Selection Complete')}</div>
                    <div style="font-size:18px; font-weight:900; color:#1e293b; margin-top:5px;">${bid.partner_phone}</div>
                    <div style="font-size:12px; color:#166534;">${window.t('msg_contact_partner', 'Contact this number to arrange a schedule.')}</div>
                </div>`;
        } else {
            actionArea = `<button onclick="window.selectBid('${bid.id}', '${bid.order_id}')" class="btn-round primary" style="width:100%; margin-top:10px; height:40px; justify-content:center;">${window.t('btn_select_partner', 'Select This Partner')}</button>`;
        }

        listHtml += `
            <div style="padding:20px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:15px; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                    <div>
                        <div style="font-weight:bold; font-size:16px; color:#1e293b;">${partnerInfo.company_name || window.t('label_partner', 'Partner')}</div>
                        <div style="margin-top:2px;">${stars} <span style="font-size:12px; font-weight:bold; color:#1e293b;">${score.toFixed(1)}</span> ${reviewText}</div>
                    </div>
                    <div style="font-weight:800; color:#6366f1; font-size:18px;">${bid.price.toLocaleString()}</div>
                </div>
                <div style="background:#f8fafc; padding:10px; border-radius:8px; font-size:13px; color:#475569; line-height:1.5; margin-top:10px;">
                    "${bid.message}"
                </div>
                ${actionArea}
            </div>
        `;
    });

    const modalHtml = `
        <div id="bidListModal" class="modal-overlay" style="display:flex; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; backdrop-filter:blur(2px);">
            <div class="modal-box" style="width:450px; max-height:85vh; overflow-y:auto; background:#f8fafc; padding:0; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <div style="background:white; padding:20px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:10;">
                    <h3 style="margin:0; font-size:18px;">${window.t('msg_received_bids', 'Received Bids')} (${bids.length})</h3>
                    <p style="color:#64748b; font-size:13px; margin:5px 0 0 0;">${window.t('msg_compare_bids', 'Compare prices and ratings to select a partner.')}</p>
                </div>
                <div style="padding:20px;">
                    ${listHtml}
                </div>
                <div style="padding:15px; text-align:center;">
                    <button onclick="document.getElementById('bidListModal').remove()" class="btn-round" style="width:100%; background:#e2e8f0; color:#334155; border:none; height:45px; justify-content:center;">${window.t('btn_close', 'Close')}</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// [추가] 파트너 후기 모달 보기 함수 (함수가 없다면 추가)
window.viewPartnerReviews = async function(partnerId) {
    const { data: reviews } = await sb.from('partner_reviews')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', {ascending: false})
        .limit(10);

    let html = '';
    if(!reviews || reviews.length === 0) {
        html = `<div style="padding:20px; text-align:center; color:#999;">${window.t('msg_no_reviews', 'No reviews registered.')}</div>`;
    } else {
        reviews.forEach(r => {
            let stars = '⭐'.repeat(r.rating);
            html += `
                <div style="border-bottom:1px solid #eee; padding:10px 0;">
                    <div style="font-size:12px; color:#f59e0b;">${stars}</div>
                    <div style="font-size:13px; color:#333; margin-top:4px;">${r.comment}</div>
                    <div style="font-size:11px; color:#aaa; margin-top:2px;">${new Date(r.created_at).toLocaleDateString()}</div>
                </div>
            `;
        });
    }

    const reviewModal = document.createElement('div');
    reviewModal.style.cssText = "position:fixed; inset:0; z-index:20001; background:rgba(0,0,0,0.3); display:flex; justify-content:center; align-items:center;";
    reviewModal.innerHTML = `
        <div style="background:white; width:350px; padding:20px; border-radius:12px; max-height:60vh; overflow-y:auto; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h4 style="margin:0 0 10px 0;">${window.t('label_partner_reviews', 'Partner Reviews')}</h4>
            ${html}
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:15px; padding:10px; border:1px solid #ddd; background:white; border-radius:8px; cursor:pointer;">${window.t('btn_close', 'Close')}</button>
        </div>
    `;
    document.body.appendChild(reviewModal);
};

// [파트너 선택 실행 함수] (함수가 없다면 추가)
// [파트너 선택 실행 함수] (수정됨: 고객 연락처 입력)
window.selectBid = async function(bidId, orderId) {
    // 1. 고객 연락처 입력받기
    const myPhone = prompt(window.t('prompt_enter_phone', "Enter your phone number to share with the partner:"), "010-");

    if(!myPhone) return alert(window.t('msg_phone_required', "Phone number is required to connect with the partner."));

    if(!confirm(window.t('confirm_select_partner', `Share your number (${myPhone}) with the partner\nand confirm this selection?`))) return;

    // 2. 해당 입찰 승인
    const { error: err1 } = await sb.from('bids').update({ status: 'selected' }).eq('id', bidId);
    if(err1) return alert(window.t('err_prefix', "Error: ") + err1.message);

    // 3. 나머지 입찰 거절
    await sb.from('bids').update({ status: 'rejected' }).eq('order_id', orderId).neq('id', bidId);
    
    // 4. 주문 상태 변경 + 고객 연락처 저장
    await sb.from('orders').update({ 
        status: '제작준비',
        selected_customer_phone: myPhone // [핵심] 고객 연락처 저장
    }).eq('id', orderId);

    alert(window.t('msg_matching_complete', "Matching complete!\nPartner contact info is now available."));
    document.getElementById('bidListModal').remove();
    
    // 화면 갱신 (입찰 내역 다시 불러와서 매칭된 정보 보여주기)
    window.checkBidsForOrder(orderId);
    loadOrders();
};
// ==========================================
// [고객용] 실시간 입찰 알림 시스템 (TTS)
// ==========================================
let lastBidCountGlobal = 0;

async function monitorMyBids() {
    if (!currentUser) return;

    // 내 주문들에 달린 입찰 개수 조회
    // (복잡한 조인 대신, 내 주문 ID를 먼저 가져오고 입찰 수를 셈)
    const { data: myOrders } = await sb.from('orders').select('id').eq('user_id', currentUser.id);
    
    if (myOrders && myOrders.length > 0) {
        const orderIds = myOrders.map(o => o.id);
        
        const { count: bidCount } = await sb.from('bids')
            .select('*', { count: 'exact', head: true })
            .in('order_id', orderIds);

        // 이전보다 입찰 수가 늘어났으면 알림
        if (lastBidCountGlobal !== 0 && bidCount > lastBidCountGlobal) {
            speakTTS(window.t('msg_new_bid_notification', "A partner has submitted a bid. Please check the quotes."));
            
            // 현재 보고 있는 탭이 '주문내역'이라면 리스트 새로고침
            const orderTab = document.getElementById('tab-orders');
            if (orderTab && orderTab.classList.contains('active')) {
                loadOrders();
            }
        }
        lastBidCountGlobal = bidCount || 0;
    }
}

function speakTTS(text) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(text);
        const country = (window.SITE_CONFIG || {}).COUNTRY || 'KR';
        msg.lang = { KR: 'ko-KR', JP: 'ja-JP', US: 'en-US', CN: 'zh-CN', AR: 'ar-SA', ES: 'es-ES' }[country] || 'ko-KR';
        msg.rate = 1.0;
        window.speechSynthesis.speak(msg);
    }
}

// 10초마다 입찰 확인
setInterval(monitorMyBids, 10000);
// [신규] 후기 작성 모달 열기
window.openPartnerReviewModal = async function(orderId) {
    // 해당 주문의 파트너(입찰 승자) 찾기
    const { data: bids } = await sb.from('bids').select('partner_id').eq('order_id', orderId).eq('status', 'selected').single();
    
    if(!bids || !bids.partner_id) {
        alert(window.t('msg_no_matched_partner', "No matched partner found."));
        return;
    }

    const partnerId = bids.partner_id;
    const rating = prompt(window.t('prompt_enter_rating', "Enter partner rating (1-5):"), "5");
    if(!rating) return;
    
    const comment = prompt(window.t('prompt_enter_review', "Leave a review for other customers:"), window.t('default_review', "Great service and quality work."));
    if(!comment) return;

    // [핵심] partner_reviews 테이블에 저장 (공개용)
    const { error } = await sb.from('partner_reviews').insert({
        order_id: orderId,
        partner_id: partnerId,
        customer_id: currentUser.id,
        rating: parseInt(rating),
        comment: comment
    });

    if (error) {
            alert((window.t('msg_save_failed') || "Save Failed: ") + error.message);
        } else {
            await sb.from('orders').update({ status: '구매확정' }).eq('id', orderId);
            alert(window.t('msg_review_saved') || "Thank you for your review!");
            loadOrders(); 
        }
};
// [누락된 함수 복구] 5. 내 리뷰/평점 로드
    async function loadMyReviews() {
        if (!myPartnerInfo) return;

        // 평점 정보 표시
        const avg = myPartnerInfo.avg_rating || 0;
        const count = myPartnerInfo.review_count || 0;
        
        const avgEl = document.getElementById('myAvgRating');
        if(avgEl) avgEl.innerText = avg.toFixed(1);
        
        const countEl = document.getElementById('myReviewCount');
        if(countEl) countEl.innerText = count;
        
        let stars = '';
        for(let i=0; i<5; i++) stars += i < Math.round(avg) ? '★' : '☆';
        
        const starEl = document.getElementById('myStarDisplay');
        if(starEl) starEl.innerText = stars;

        // 리뷰 리스트 로드
        const list = document.getElementById('reviewList');
        if(!list) return;

        const { data: reviews } = await sb.from('partner_reviews')
            .select('*')
            .eq('partner_id', myPartnerInfo.id)
            .order('created_at', { ascending: false });
            
        list.innerHTML = '';
        if(reviews && reviews.length > 0) {
            reviews.forEach(r => {
                let rStars = '';
                for(let i=0; i<5; i++) rStars += i < r.rating ? '★' : '☆';
                
                list.innerHTML += `
                    <div class="order-card">
                        <div style="color:#f59e0b; font-size:18px; margin-bottom:5px;">${rStars}</div>
                        <div style="font-weight:bold; color:#334155; margin-bottom:10px;">"${r.comment}"</div>
                        <div style="font-size:12px; color:#94a3b8; text-align:right;">${new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                `;
            });
        } else {
            list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">${window.t('msg_no_reviews', 'No reviews registered yet.')}</div>`;
        }
    }
    // [신규] 강력한 소리 재생 함수 (마이페이지용)

// ============================================================
// [서류 다운로드] PDF 생성 시스템 (마이페이지 전용)
// ============================================================

// 드롭다운 토글
window.toggleDocDropdown = function(e, orderId) {
    e.stopPropagation();
    // 모든 드롭다운 닫기
    document.querySelectorAll('.doc-dropdown').forEach(d => { if(d.id !== `docDrop-${orderId}`) d.style.display = 'none'; });
    const dd = document.getElementById(`docDrop-${orderId}`);
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', () => document.querySelectorAll('.doc-dropdown').forEach(d => d.style.display = 'none'));

// 언어 감지
const _pdfUrlParams = new URLSearchParams(window.location.search);
let _pdfLang = _pdfUrlParams.get('lang');
if (!_pdfLang) {
    const h = window.location.hostname;
    if (h.includes('cafe0101.com')) _pdfLang = 'ja';
    else if (h.includes('cafe3355.com')) _pdfLang = 'us';
    else _pdfLang = 'kr';
}
const PDF_LANG = _pdfLang.toLowerCase();

// 다국어 라벨
const PDF_LABELS = {
    kr: {
        quote_title: "견 적 서", receipt_title: "영 수 증", statement_title: "거 래 명 세 서", ordersheet_title: "작 업 지 시 서",
        recipient: "[ 수신자 ]", name: "성   명 :", phone: "연 락 처 :", address: "주   소 :",
        provider_labels: ["등록번호", "상      호", "대      표", "주      소", "업      태", "연 락 처"],
        provider_values: ["470-81-02808", "(주)카멜레온프린팅", "조재호", "경기 화성시 우정읍 한말길 72-2", "제조업 / 서비스업", "031-366-1984"],
        headers: ["No", "품목명", "규격/옵션", "수량", "단가", "금액"],
        supply_price: "공급가액 :", vat: "부 가 세 :", discount: "할인금액 :", mileage: "마일리지 :",
        total_amount: "합계금액 (VAT포함)", footer_claim: "위와 같이 청구(영수)합니다.",
        payment_card: "신용카드로 결제되었습니다.", payment_bank: "계좌이체로 결제되었습니다.", payment_deposit: "예치금으로 결제되었습니다.",
        opt_default: "기본 사양", opt_add: "추가 옵션",
        staff_make: "제 작 담 당", staff_check: "검 수 / 출 고", staff_ship: "배 송 담 당",
        os_order_no: "주 문 번 호", os_date: "접 수 일 자", os_customer: "주   문   자", os_phone: "연   락   처",
        os_address: "배 송 주 소", os_request: "요 청 사 항", os_none: "없음", os_unspecified: "미지정",
        os_delivery_date: "배송 희망일", os_prod_spec: "제 작 사 양", os_qty_unit: "개", os_qty_label: "수량",
        os_design_preview: "디자인 시안 확인", os_no_image: "이미지 없음 (파일 별도 확인)"
    },
    ja: {
        quote_title: "御 見 積 書", receipt_title: "領 収 書", statement_title: "納 品 書", ordersheet_title: "発 注 書",
        recipient: "[ 受信者 ]", name: "氏   名 :", phone: "連絡先 :", address: "住   所 :",
        provider_labels: ["登録番号", "商      号", "代      表", "住      所", "業      態", "連絡先"],
        provider_values: ["2025-京畿華城-0033", "(株)カメレオンプリンティング", "趙 宰鎬", "京畿道 華城市 雨汀邑 ハンマルギル 72-2", "製造業 / サービス業", "047-712-1148"],
        headers: ["No", "品名", "仕様/オプション", "数量", "単価", "金額"],
        supply_price: "税抜金額 :", vat: "消費税 :", discount: "割引金額 :", mileage: "ポイント使用 :",
        total_amount: "合計金額 (税込)", footer_claim: "上記の通り、相違なく領収いたしました。",
        payment_card: "クレジットカード決済完了", payment_bank: "銀行振込完了", payment_deposit: "デポジット決済完了",
        opt_default: "基本仕様", opt_add: "追加オプション",
        staff_make: "制作担当", staff_check: "検品/出荷", staff_ship: "配送担当",
        os_order_no: "注文番号", os_date: "受付日", os_customer: "注文者", os_phone: "連絡先",
        os_address: "配送先住所", os_request: "備考・要望", os_none: "なし", os_unspecified: "未指定",
        os_delivery_date: "配送希望日", os_prod_spec: "製作仕様", os_qty_unit: "個", os_qty_label: "数量",
        os_design_preview: "デザインプレビュー", os_no_image: "画像なし（ファイルを別途ご確認ください）"
    },
    us: {
        quote_title: "QUOTATION", receipt_title: "RECEIPT", statement_title: "INVOICE", ordersheet_title: "WORK ORDER",
        recipient: "[ Customer ]", name: "Name :", phone: "Phone :", address: "Addr :",
        provider_labels: ["Reg No.", "Company", "CEO", "Address", "Type", "Contact"],
        provider_values: ["470-81-02808", "Chameleon Printing Inc.", "Jae-ho Cho", "72-2 Hanmal-gil, Ujeong-eup, Hwaseong-si", "Manufacturing", "+82-31-366-1984"],
        headers: ["No", "Item", "Spec/Option", "Qty", "Price", "Amount"],
        supply_price: "Subtotal :", vat: "Sales Tax :", discount: "Discount :", mileage: "Points Used :",
        total_amount: "Grand Total", footer_claim: "Authorized Signature",
        payment_card: "Paid by Credit Card", payment_bank: "Paid by Bank Transfer", payment_deposit: "Paid by Deposit",
        opt_default: "Basic Spec", opt_add: "Add-ons",
        staff_make: "Production", staff_check: "Inspection", staff_ship: "Shipping",
        os_order_no: "Order No.", os_date: "Date", os_customer: "Customer", os_phone: "Phone",
        os_address: "Ship To", os_request: "Notes", os_none: "None", os_unspecified: "TBD",
        os_delivery_date: "Requested Delivery", os_prod_spec: "SPECIFICATIONS", os_qty_unit: "pcs", os_qty_label: "Qty",
        os_design_preview: "Design Preview", os_no_image: "No image (see attached file)"
    }
};
const PTXT = PDF_LABELS[PDF_LANG] || PDF_LABELS['kr'];

// 폰트 설정
const PDF_FONT_CONFIG = {
    kr: { url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf", name: "NanumGothic" },
    jp: { url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP-Regular.ttf", name: "NotoSansJP" },
    us: { url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf", name: "NanumGothic" },
    cn: { url: "https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf", name: "NotoSansSC" },
    ar: { url: "https://fonts.gstatic.com/s/notosansarabic/v33/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvuw.ttf", name: "NotoSansArabic" },
    es: { url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf", name: "Inter" }
};
const _fontKey = { 'ja': 'jp', 'jp': 'jp', 'en': 'us', 'us': 'us', 'kr': 'kr', 'zh': 'cn', 'cn': 'cn', 'ar': 'ar', 'es': 'es' }[PDF_LANG] || 'kr';
const PDF_FONT = PDF_FONT_CONFIG[_fontKey] || PDF_FONT_CONFIG['kr'];
const PDF_FONT_NAME = PDF_FONT.name;
let _pdfFontCache = null;

const STAMP_URL = "https://gdadmin.signmini.com/data/etc/stampImage";

// 헬퍼: hex → CMYK
function _hexCMYK(hex) {
    hex = (hex.charAt(0) === "#") ? hex.substring(1, 7) : hex;
    if (hex.length !== 6) return [0, 0, 0, 1];
    let r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
    if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 1];
    if (r === 255 && g === 255 && b === 255) return [0, 0, 0, 0];
    let c = 1 - (r / 255), m = 1 - (g / 255), y = 1 - (b / 255), k2 = Math.min(c, Math.min(m, y));
    return [(c - k2) / (1 - k2), (m - k2) / (1 - k2), (y - k2) / (1 - k2), k2];
}

// 헬퍼: 텍스트 그리기
function _dt(doc, text, x, y, opts = {}, colorHex = "#000000") {
    if (!text) return;
    const [c, m, yk, k] = _hexCMYK(colorHex);
    doc.setTextColor(c, m, yk, k);
    doc.setFont(PDF_FONT_NAME, opts.weight || "normal");
    doc.text(String(text), x, y, opts);
}

// 헬퍼: 선 그리기
function _dl(doc, x1, y1, x2, y2, colorHex = "#000000", w = 0.1) {
    const [c, m, yk, k] = _hexCMYK(colorHex);
    doc.setDrawColor(c, m, yk, k); doc.setLineWidth(w); doc.line(x1, y1, x2, y2);
}

// 헬퍼: 셀 그리기
function _dc(doc, x, y, w, h, text, align = 'center', fontSize = 9, isHeader = false) {
    doc.setFontSize(fontSize);
    if (isHeader) { doc.setFillColor(240, 240, 240); doc.rect(x, y, w, h, 'F'); }
    doc.setDrawColor(0); doc.setLineWidth(0.1); doc.rect(x, y, w, h);
    doc.setTextColor(0, 0, 0, 1);
    doc.setFont(PDF_FONT_NAME, isHeader ? 'bold' : 'normal');
    const textX = align === 'left' ? x + 2 : (align === 'right' ? x + w - 2 : x + w / 2);
    if (Array.isArray(text)) {
        const lineH = fontSize * 0.45;
        const totalH = (text.length - 1) * lineH * 1.15;
        const startY = y + (h / 2) - (totalH / 2) + (fontSize / 3.5);
        doc.text(text, textX, startY, { align, lineHeightFactor: 1.15 });
    } else {
        doc.text(String(text), textX, y + (h / 2) + (fontSize / 3.5), { align, maxWidth: w - 4 });
    }
}

// 헬퍼: 통화 포맷
function _fmtPdf(val) {
    const num = Number(val) || 0;
    if (PDF_LANG === 'ja' || PDF_LANG === 'jp') return '¥' + Math.floor(num).toLocaleString();
    if (PDF_LANG === 'us' || PDF_LANG === 'en') return '$' + Math.round(num).toLocaleString();
    return num.toLocaleString();
}

// 폰트 로드
async function _loadFont(doc) {
    if (!_pdfFontCache) {
        try {
            const langMap = { 'kr': 'KR', 'jp': 'JA', 'ja': 'JA', 'us': 'EN', 'en': 'EN', 'zh': 'ZH', 'cn': 'ZH', 'ar': 'AR', 'es': 'ES' };
            const dbLang = langMap[PDF_LANG] || 'KR';
            const { data } = await sb.from('site_fonts').select('file_url').eq('site_code', dbLang).order('id', { ascending: true }).limit(1);
            const url = (data && data[0]?.file_url) || PDF_FONT.url;
            const res = await fetch(url, { mode: 'cors' });
            if (res.ok) _pdfFontCache = await res.arrayBuffer();
        } catch (e) {
            try { const r = await fetch(PDF_FONT_CONFIG['kr'].url); if (r.ok) _pdfFontCache = await r.arrayBuffer(); } catch (err) { }
        }
    }
    if (_pdfFontCache) {
        const bytes = new Uint8Array(_pdfFontCache);
        let binary = ''; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const fontData = window.btoa(binary);
        if (!doc.existsFileInVFS(PDF_FONT_NAME + ".ttf")) {
            doc.addFileToVFS(PDF_FONT_NAME + ".ttf", fontData);
            doc.addFont(PDF_FONT_NAME + ".ttf", PDF_FONT_NAME, "normal");
            doc.addFont(PDF_FONT_NAME + ".ttf", PDF_FONT_NAME, "bold");
        }
        doc.setFont(PDF_FONT_NAME);
    }
}

// 이미지 → DataURL 변환
function _imgToDataUrl(url) {
    return new Promise(resolve => {
        if (!url) return resolve(null);
        const timeout = setTimeout(() => resolve(null), 10000);
        const img = new Image(); img.crossOrigin = "Anonymous"; img.src = url;
        img.onload = () => {
            clearTimeout(timeout);
            let w = img.width, h = img.height;
            const MAX = 1200;
            if (w > MAX || h > MAX) { if (w > h) { h = Math.round((h * MAX) / w); w = MAX; } else { w = Math.round((w * MAX) / h); h = MAX; } }
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            try { resolve(c.toDataURL('image/jpeg', 0.7)); } catch (e) { resolve(null); }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(null); };
    });
}

// ============ 공통 문서 생성 (견적서/영수증/거래명세서) ============
async function _genCommonDoc(doc, title, orderInfo, cartItems, discountAmt, usedMileage) {
    doc.setFontSize(26);
    _dt(doc, title, 105, 22, { align: 'center', weight: 'bold' });
    _dl(doc, 15, 28, 195, 28, "#000000", 0.5);

    const topY = 35, leftX = 15;
    doc.setFontSize(10);
    _dt(doc, PTXT.recipient, leftX, topY);
    _dt(doc, `${PTXT.name}  ${orderInfo.manager || '-'}`, leftX, topY + 8);
    _dt(doc, `${PTXT.phone}  ${orderInfo.phone || '-'}`, leftX, topY + 14);
    _dt(doc, `${PTXT.address}  ${orderInfo.address || '-'}`, leftX, topY + 20, { maxWidth: 85 });

    const boxX = 105, boxY = 32, cellH = 7, labelW = 20, valW = 70;
    const pL = PTXT.provider_labels, pV = PTXT.provider_values;
    for (let i = 0; i < pL.length; i++) {
        _dc(doc, boxX, boxY + (i * cellH), labelW, cellH, pL[i], 'center', 9, true);
        _dc(doc, boxX + labelW, boxY + (i * cellH), valW, cellH, pV[i], 'left', 9, false);
    }

    // 직인
    try {
        const res = await fetch(STAMP_URL); const blob = await res.blob();
        const reader = new FileReader();
        await new Promise(resolve => { reader.onloadend = () => { if (reader.result) doc.addImage(reader.result, 'PNG', boxX + labelW + 45, boxY + cellH + 1, 14, 14); resolve(); }; reader.readAsDataURL(blob); });
    } catch (e) { }

    let y = 85;
    const cols = [10, 50, 40, 20, 30, 30];
    const hdrs = PTXT.headers;
    let curX = 15;
    hdrs.forEach((h, i) => { _dc(doc, curX, y, cols[i], 8, h, 'center', 10, true); curX += cols[i]; });
    y += 8;

    const _cr = window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE;
    const ADDON = window.ADDON_DB || {};
    let totalAmt = 0, no = 1;

    cartItems.forEach(item => {
        if (!item.product) return;
        let pdfName = item.productName || item.product.name;
        let pdfPrice = item.product.price || item.price || 0;

        if (PDF_LANG === 'ja' || PDF_LANG === 'jp') {
            if (item.product.name_jp) pdfName = item.product.name_jp;
            if (_cr && _cr.JP) pdfPrice = Math.round(pdfPrice * _cr.JP);
        } else if (PDF_LANG === 'us' || PDF_LANG === 'en') {
            if (item.product.name_us) pdfName = item.product.name_us;
            if (_cr && _cr.US) pdfPrice = Math.round(pdfPrice * _cr.US * 100) / 100;
        }

        const pTotal = (pdfPrice || 0) * (item.qty || 1);
        totalAmt += pTotal;
        const splitTitle = doc.splitTextToSize(pdfName, cols[1] - 4);
        const rowHeight = Math.max(8, 4 + (splitTitle.length * 5));

        curX = 15;
        _dc(doc, curX, y, cols[0], rowHeight, no++, 'center'); curX += cols[0];
        _dc(doc, curX, y, cols[1], rowHeight, splitTitle, 'left'); curX += cols[1];
        _dc(doc, curX, y, cols[2], rowHeight, PTXT.opt_default, 'left'); curX += cols[2];
        _dc(doc, curX, y, cols[3], rowHeight, String(item.qty || 1), 'center'); curX += cols[3];
        _dc(doc, curX, y, cols[4], rowHeight, _fmtPdf(pdfPrice), 'right'); curX += cols[4];
        _dc(doc, curX, y, cols[5], rowHeight, _fmtPdf(pTotal), 'right');
        y += rowHeight;
        if (y > 260) { doc.addPage(); y = 20; }

        // 옵션
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON[code]; if (!add) return;
                const uQty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                let addPrice = add.price || 0, addName = add.display_name || add.name || code;
                if (PDF_LANG === 'ja' || PDF_LANG === 'jp') { if (_cr && _cr.JP) addPrice = Math.round(addPrice * _cr.JP); if (add.name_jp) addName = add.name_jp; }
                else if (PDF_LANG === 'us' || PDF_LANG === 'en') { if (_cr && _cr.US) addPrice = Math.round(addPrice * _cr.US * 100) / 100; if (add.name_us) addName = add.name_us; }
                const aTotal = addPrice * uQty; totalAmt += aTotal;
                const splitAddon = doc.splitTextToSize("└ " + addName, cols[1] - 4);
                const addonH = Math.max(8, 4 + (splitAddon.length * 5));
                curX = 15;
                _dc(doc, curX, y, cols[0], addonH, "", 'center'); curX += cols[0];
                _dc(doc, curX, y, cols[1], addonH, splitAddon, 'left', 8); curX += cols[1];
                _dc(doc, curX, y, cols[2], addonH, PTXT.opt_add, 'left', 8); curX += cols[2];
                _dc(doc, curX, y, cols[3], addonH, String(uQty), 'center'); curX += cols[3];
                _dc(doc, curX, y, cols[4], addonH, _fmtPdf(addPrice), 'right'); curX += cols[4];
                _dc(doc, curX, y, cols[5], addonH, _fmtPdf(aTotal), 'right');
                y += addonH;
                if (y > 260) { doc.addPage(); y = 20; }
            });
        }
    });

    y += 5;
    const afterDiscount = totalAmt - (discountAmt || 0);
    const finalAmt = afterDiscount - (usedMileage || 0);
    const vat = Math.floor(finalAmt / 11);
    const supply = finalAmt - vat;

    const sX = 105;
    _dt(doc, PTXT.supply_price, sX, y + 5, { align: 'right' }); _dt(doc, _fmtPdf(supply), 195, y + 5, { align: 'right' }); y += 6;
    _dt(doc, PTXT.vat, sX, y + 5, { align: 'right' }); _dt(doc, _fmtPdf(vat), 195, y + 5, { align: 'right' }); y += 6;
    if (discountAmt > 0) {
        _dt(doc, PTXT.discount, sX, y + 5, { align: 'right' }, "#ff0000"); _dt(doc, "-" + _fmtPdf(discountAmt), 195, y + 5, { align: 'right' }, "#ff0000"); y += 6;
    }
    if (usedMileage > 0) {
        _dt(doc, PTXT.mileage, sX, y + 5, { align: 'right' }, "#ff0000"); _dt(doc, "-" + usedMileage.toLocaleString() + " P", 195, y + 5, { align: 'right' }, "#ff0000"); y += 6;
    }
    y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(sX - 20, y, 195, y); y += 8;
    _dt(doc, PTXT.total_amount, sX, y, { align: 'right', weight: 'bold' });
    doc.setFontSize(14); _dt(doc, _fmtPdf(finalAmt), 195, y, { align: 'right', weight: 'bold' }, "#1a237e");

    // 결제 정보 (영수증/명세서만)
    if (title === PTXT.receipt_title || title === PTXT.statement_title) {
        y += 8; doc.setFontSize(10);
        let ml = PTXT.payment_card;
        if (orderInfo.payMethod === 'bank') ml = `${PTXT.payment_bank} (${orderInfo.depositor || ''})`;
        else if (orderInfo.payMethod === 'deposit') ml = PTXT.payment_deposit;
        doc.setTextColor(100, 100, 100);
        _dt(doc, `[${ml}]`, 105, y, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(10); _dt(doc, PTXT.footer_claim, 105, 250, { align: 'center' });
    doc.setFontSize(10); _dt(doc, new Date().toLocaleDateString(), 105, 262, { align: 'center' });
    return doc.output('blob');
}

// ============ 작업지시서 (간소화 - fabric 없이 썸네일 사용) ============
async function _genOrderSheet(doc, orderInfo, cartItems) {
    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (!item.product) continue;
        if (i > 0) doc.addPage();

        // 헤더 바
        const [c, m, yk, k] = _hexCMYK("#1a237e");
        doc.setFillColor(c, m, yk, k); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(0, 0, 0, 0); doc.setFontSize(22);
        _dt(doc, PTXT.ordersheet_title, 105, 14, { align: 'center', weight: 'bold' }, "#ffffff");

        // 주문정보 박스
        const startY = 30, boxH = 50;
        doc.setTextColor(0, 0, 0, 1); doc.setDrawColor(0); doc.setLineWidth(0.4);
        doc.rect(15, startY, 180, boxH);
        doc.setFontSize(10);
        let curY = startY + 8;
        _dt(doc, `${PTXT.os_order_no} :  ${orderInfo.id || '-'}`, 20, curY, { weight: 'bold' });
        _dt(doc, `${PTXT.os_date} :  ${new Date(orderInfo.orderDate || Date.now()).toLocaleDateString()}`, 80, curY);
        doc.setDrawColor(200); doc.setLineWidth(0.1); doc.line(20, curY + 3, 130, curY + 3); curY += 8;
        doc.setFontSize(11);
        _dt(doc, `${PTXT.os_customer} :  ${orderInfo.manager || '-'}`, 20, curY); curY += 6;
        _dt(doc, `${PTXT.os_phone} :  ${orderInfo.phone || '-'}`, 20, curY); curY += 6;
        _dt(doc, `${PTXT.os_address} :`, 20, curY); doc.setFontSize(10); _dt(doc, `${orderInfo.address || '-'}`, 45, curY, { maxWidth: 90 }); curY += 10;
        doc.setFontSize(11);
        _dt(doc, `${PTXT.os_request} :`, 20, curY);
        _dt(doc, `${orderInfo.note || PTXT.os_none}`, 45, curY, { maxWidth: 130, weight: 'bold' }, "#1d4ed8");

        // 배송희망일
        let dateStr = PTXT.os_unspecified;
        if (orderInfo.date) {
            const parts = orderInfo.date.split('-');
            dateStr = parts.length === 3 ? `${parts[1]}.${parts[2]}` : orderInfo.date;
        }
        doc.setFontSize(12);
        _dt(doc, PTXT.os_delivery_date, 165, startY + 12, { align: 'center', weight: 'bold' }, "#ff0000");
        doc.setFontSize(42);
        _dt(doc, dateStr, 165, startY + 32, { align: 'center', weight: 'bold' }, "#ff0000");
        doc.setDrawColor(255, 0, 0); doc.setLineWidth(0.5); doc.roundedRect(135, startY + 5, 55, 35, 3, 3);

        // 제작사양 섹션
        const prodY = startY + boxH + 10;
        doc.setFillColor(240, 240, 240); doc.setDrawColor(0); doc.setLineWidth(0.1);
        doc.rect(15, prodY, 180, 10, 'FD');
        doc.setTextColor(0); doc.setFontSize(11);
        _dt(doc, PTXT.os_prod_spec, 20, prodY + 7, { weight: 'bold' });
        _dt(doc, `${PTXT.os_qty_label}: ${item.qty || 1}${PTXT.os_qty_unit}`, 185, prodY + 7, { align: 'right', weight: 'bold' }, "#ff0000");

        const pName = item.productName || item.product.name || '';
        const infoY = prodY + 18; doc.setFontSize(16);
        _dt(doc, pName, 20, infoY, { weight: 'bold' });

        doc.setFontSize(11); let optY = infoY + 8;
        const ADDON = window.ADDON_DB || {};
        if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON[code]; if (!add) return;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                _dt(doc, `• ${add.display_name || add.name || code} (x${qty})`, 25, optY); optY += 6;
            });
        } else {
            _dt(doc, "• " + PTXT.opt_default, 25, optY); optY += 6;
        }

        // 이미지 영역 (썸네일 사용)
        const imgBoxY = optY + 5, footerY = 255, imgBoxH = footerY - imgBoxY - 5;
        doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(15, imgBoxY, 180, imgBoxH);
        _dt(doc, `< ${PTXT.os_design_preview} >`, 105, imgBoxY - 2, { align: 'center' });

        const thumbUrl = item.thumb || item.product.img || null;
        let imgData = null;
        if (thumbUrl) imgData = await _imgToDataUrl(thumbUrl);
        if (imgData) {
            try {
                let fmt = 'PNG'; if (imgData.startsWith('data:image/jpeg')) fmt = 'JPEG';
                const p = doc.getImageProperties(imgData);
                const innerW = 176, innerH = imgBoxH - 4;
                let w = innerW, h = (p.height * w) / p.width;
                if (h > innerH) { h = innerH; w = (p.width * h) / p.height; }
                doc.addImage(imgData, fmt, 105 - (w / 2), imgBoxY + (imgBoxH / 2) - (h / 2), w, h);
            } catch (e) { }
        } else {
            _dt(doc, PTXT.os_no_image, 105, imgBoxY + (imgBoxH / 2), { align: 'center' });
        }

        // 서명란
        const signW = 180, signH = 25;
        doc.setDrawColor(0); doc.setLineWidth(0.1); doc.rect(15, footerY, signW, signH);
        const colW = signW / 3;
        doc.line(15, footerY + 8, 15 + signW, footerY + 8);
        doc.line(15 + colW, footerY, 15 + colW, footerY + signH);
        doc.line(15 + colW * 2, footerY, 15 + colW * 2, footerY + signH);
        doc.setFontSize(10);
        _dt(doc, PTXT.staff_make, 15 + colW / 2, footerY + 5.5, { align: 'center' });
        _dt(doc, PTXT.staff_check, 15 + colW * 1.5, footerY + 5.5, { align: 'center' });
        _dt(doc, PTXT.staff_ship, 15 + colW * 2.5, footerY + 5.5, { align: 'center' });
        doc.setFontSize(8); _dt(doc, "Generated by Chameleon Printing System", 105, 292, { align: 'center' }, "#888888");
    }
    return doc.output('blob');
}

// ============ 메인: 서류 다운로드 함수 ============
window.downloadOrderDoc = async function (orderId, docType) {
    const order = window.myOrdersData?.find(o => String(o.id) === String(orderId));
    if (!order) return alert('Order not found');

    // 닫기
    document.querySelectorAll('.doc-dropdown').forEach(d => d.style.display = 'none');

    // 1. 저장된 파일 먼저 찾기 (견적서/작업지시서)
    if (docType === 'quotation' || docType === 'order_sheet') {
        const files = order.files || [];
        const found = files.find(f => f.type === docType || f.name === (docType === 'quotation' ? 'quotation.pdf' : 'order_sheet.pdf'));
        if (found && found.url) {
            window.open(found.url, '_blank');
            return;
        }
    }

    // 2. jsPDF 확인
    if (!window.jspdf) return alert('PDF library not loaded. Please refresh and try again.');

    // 3. 주문 데이터 변환
    let items = [];
    try { items = (typeof order.items === 'string') ? JSON.parse(order.items) : (order.items || []); } catch (e) { }

    const pmLower = (order.payment_method || '').toLowerCase();
    const orderInfo = {
        id: order.id,
        manager: order.manager_name || '',
        phone: order.phone || '',
        address: order.address || '',
        note: order.request_note || '',
        date: order.delivery_target_date || '',
        orderDate: order.created_at,
        payMethod: (pmLower.includes('카드') || pmLower.includes('card') || pmLower.includes('stripe')) ? 'card'
            : pmLower.includes('무통장') ? 'bank'
                : pmLower.includes('예치금') ? 'deposit' : 'card',
        depositor: order.depositor_name || ''
    };

    // 4. PDF 생성
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await _loadFont(doc);

    let blob;
    const titleMap = { quotation: PTXT.quote_title, receipt: PTXT.receipt_title, statement: PTXT.statement_title };

    if (docType === 'order_sheet') {
        blob = await _genOrderSheet(doc, orderInfo, items);
    } else {
        const title = titleMap[docType] || PTXT.quote_title;
        blob = await _genCommonDoc(doc, title, orderInfo, items, order.discount_amount || 0, 0);
    }

    if (!blob) return alert('PDF generation failed');

    // 5. 다운로드
    const nameMap = { quotation: 'Quotation', receipt: 'Receipt', statement: 'Invoice', order_sheet: 'WorkOrder' };
    const fileName = `${nameMap[docType] || 'Document'}_${orderId}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
};
