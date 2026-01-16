import { sb, initConfig, currentUser, cartData, PRODUCT_DB } from "./config.js";

// [긴급 수정] 번역 사전 (한글 데이터)
const I18N_KO = {
    "mp_menu_dashboard": "대시보드",
    "mp_menu_designs": "내 디자인",
    "mp_menu_sales": "판매중 (수익)",
    "mp_menu_orders": "주문 내역",
    "mp_menu_profit": "수익금 & 예치금",
    "btn_logout": "로그아웃",
    "mp_welcome_title": "반갑습니다!",
    "mp_welcome_desc": "오늘도 멋진 디자인을 만들어보세요.",
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
    "btn_delete": "삭제"
};

// [긴급 수정] window.t 함수 강제 주입 (오류 방지)
if (typeof window.t !== 'function') {
    window.t = function(key) {
        return I18N_KO[key] || key;
    };
}

// [1] 초기화
document.addEventListener("DOMContentLoaded", async () => {
    // 1. 설정 로드
    await initConfig();
    
    // 2. 번역 적용 (HTML의 data-i18n 태그들을 한글로 변환)
    applyTranslations();

    if (!currentUser) {
        alert("로그인이 필요한 서비스입니다.");
        location.href = 'index.html';
        return;
    }

    // 유저 이름 표시 (오류 방지를 위해 try-catch 추가)
    try {
        const userName = currentUser.user_metadata?.full_name || 'Customer';
        const displayTitle = document.getElementById('userNameDisplay');
        if(displayTitle) {
            // window.t가 안전하게 정의되었으므로 호출 가능
            const tpl = window.t('mp_welcome_user') || "{name}님, 환영합니다!";
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
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N_KO[key]) {
            // 버튼 안에 아이콘이 있는 경우 텍스트 노드만 교체하거나 innerHTML 사용
            if(el.children.length > 0) {
                // 아이콘 유지를 위해 텍스트만 찾아서 교체 시도 (간단히는 innerHTML 덮어쓰기)
                const icon = el.querySelector('i');
                if(icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.append(" " + I18N_KO[key]);
                } else {
                    el.innerText = I18N_KO[key];
                }
            } else {
                el.innerText = I18N_KO[key];
            }
        }
    });
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
            
            const rate = newRole === 'platinum' ? '10%' : '5%';
            alert(`🎉 축하합니다! '${newRole.toUpperCase()}' 등급으로 승급되었습니다.\n(${rate} 할인 적용)`);
            location.reload(); 
        }
    } catch (e) {
        console.error("등급 체크 오류:", e);
    }
}

// [4] 대시보드 통계 로드
async function loadDashboardStats() {
    try {
        const { data: profile, error } = await sb.from('profiles')
            .select('mileage, role, total_spend, logo_count, deposit')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;

        const elMileage = document.getElementById('mileageDisplay');
        if(elMileage) elMileage.innerText = (profile.mileage || 0).toLocaleString() + ' P';

        const elSpend = document.getElementById('totalSpendDisplay');
        if(elSpend) elSpend.innerText = (profile.total_spend || 0).toLocaleString() + ' 원';

        const elLogo = document.getElementById('logoCountDisplay');
        if(elLogo) elLogo.innerText = (profile.logo_count || 0) + ' 개';

        const elDeposit = document.getElementById('depositTotal');
        if(elDeposit) elDeposit.innerText = (profile.deposit || 0).toLocaleString();
        
        const elProfit = document.getElementById('profitTotal');
        if(elProfit) elProfit.innerText = (profile.mileage || 0).toLocaleString();

        await checkAndUpgradeTier(currentUser.id, profile.role);

        const { count: orderCount } = await sb.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .neq('status', '완료됨')
            .neq('status', '취소됨')
            .neq('status', '배송완료');

        const elOrder = document.getElementById('activeOrderCount');
        if(elOrder) elOrder.innerText = (orderCount || 0) + ' 건';

        // 최근 수익 알림 로드 (더미 또는 실제 데이터)
        const recentLogArea = document.getElementById('recentLogs');
        if(recentLogArea) {
             recentLogArea.innerHTML = '<li>최근 30일간 수익 내역이 없습니다.</li>';
             // 필요시 wallet_logs 조회하여 업데이트
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
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">로딩 중...</td></tr>';

    const { data: orders } = await sb.from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#999;">주문 내역이 없습니다.</td></tr>';
        return;
    }

    window.myOrdersData = orders;

    orders.forEach(o => {
        let items = [];
        try { items = (typeof o.items === 'string') ? JSON.parse(o.items) : o.items; } catch(e) {}
        
        let summary = "상품 정보 없음";
        if (Array.isArray(items) && items.length > 0) {
            summary = items[0].productName || items[0].product?.name || "상품";
            if (items.length > 1) summary += ` 외 ${items.length - 1}건`;
        }

        let badgeClass = 'status-wait';
        if(['완료됨','배송완료','구매확정'].includes(o.status)) badgeClass = 'status-done';
        if(o.status === '취소됨') badgeClass = 'status-cancel';

        const canCancel = ['접수대기','입금대기'].includes(o.status);
        const safeId = String(o.id); 
        const displayId = safeId.length > 8 ? safeId.substring(0,8) + '...' : safeId;

        // [수정됨] 상태별 버튼 분기 처리
        let actionBtn = '';
        
        if (o.status === '접수대기' || o.status === '접수됨') {
            // 1. 견적 확인 버튼
            actionBtn = `<button onclick="window.checkBidsForOrder('${o.id}')" class="btn-round" style="margin-top:5px; background:#4f46e5; color:white; border:none; padding:4px 10px; font-size:11px; width:100%;">📢 도착한 견적 확인</button>`;
        } 
        else if (o.status === '배송완료') {
            // 2. 후기 작성 버튼 (파트너가 납품 완료했을 때)
            actionBtn = `<button onclick="window.openPartnerReviewModal('${o.id}')" class="btn-round" style="margin-top:5px; background:#f59e0b; color:white; border:none; padding:4px 10px; font-size:11px; width:100%;">⭐ 파트너 후기 작성</button>`;
        }
        else if (o.status === '구매확정') {
            actionBtn = `<span style="font-size:11px; color:#16a34a; font-weight:bold;">✅ 후기작성 완료</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    ${new Date(o.created_at).toLocaleDateString()}<br>
                    <small style="color:#888;">${displayId}</small>
                </td>
                <td><div style="font-weight:bold;">${summary}</div></td>
                <td style="font-weight:bold;">${(o.total_amount || 0).toLocaleString()}원</td>
                <td>
                    <span class="status-badge ${badgeClass}">${o.status}</span>
                    ${actionBtn}
                </td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${canCancel ? `<button class="btn-cancel-order" onclick="cancelOrder('${o.id}')">취소</button>` : ''}
                        <button class="btn-round" onclick="reOrder('${o.id}')" style="height:26px; font-size:11px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; justify-content:center;">다시담기</button>
                    </div>
                </td>
            </tr>`;
    });
}

async function cancelOrder(orderId) {
    if (!confirm("주문을 취소하시겠습니까?")) return;
    await sb.from('orders').update({ status: '취소됨' }).eq('id', orderId);
    loadOrders();
}

async function reOrder(orderId) {
    const order = window.myOrdersData?.find(o => o.id == orderId);
    if (!order) return;
    
    let items = [];
    try { items = (typeof order.items === 'string') ? JSON.parse(order.items) : order.items; } catch(e) {}
    
    if (confirm("해당 상품을 장바구니에 다시 담으시겠습니까?")) {
        items.forEach(item => {
            const newItem = { ...item, uid: Date.now() + Math.random() };
            cartData.push(newItem);
        });
        localStorage.setItem(`chameleon_cart_${currentUser.id}`, JSON.stringify(cartData));
        if(confirm("장바구니로 이동할까요?")) {
            localStorage.setItem('open_cart_on_load', 'true');
            location.href = 'index.html';
        }
    }
}

// [신규] 판매중인 디자인 로드
async function loadMySales() {
    const grid = document.getElementById('mySalesGrid');
    if(!grid) return;
    grid.innerHTML = '로딩 중...';

    const { data } = await sb.from('library').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    
    if(!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">판매중인 디자인이 없습니다.</div>';
        return;
    }

    grid.innerHTML = '';
    let total = 0;
    data.forEach(d => {
        const reward = d.category === 'logo' ? 150 : 100;
        total += reward;
        grid.innerHTML += `
            <div class="mp-design-card">
                <img src="${d.thumb_url}" class="mp-design-thumb" style="height:150px; object-fit:cover;">
                <div class="mp-design-body">
                    <div style="font-weight:bold;">${d.title || '제목없음'}</div>
                    <div style="font-size:12px; color:#666;">${d.category}</div>
                    <div style="margin-top:5px; font-size:12px; color:#16a34a;">🎁 등록보상: ${reward}P</div>
                </div>
            </div>`;
    });
    const elTotal = document.getElementById('totalSalesPoint');
    if(elTotal) elTotal.innerText = total.toLocaleString() + ' P';
}

// [신규] 출금 모달 열기
function openWithdrawModal() {
    sb.from('profiles').select('mileage').eq('id', currentUser.id).single().then(({data}) => {
        document.getElementById('wdCurrentMileage').innerText = (data?.mileage || 0).toLocaleString();
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

    if(!amt || amt < 1000) return alert("최소 1,000P 부터 신청 가능합니다.");
    if(amt > cur) return alert("보유 포인트가 부족합니다.");
    
    if(!bank || !acc || !holder) return alert("계좌 정보를 입력해주세요.");
    if(!phone || !rrn) return alert("연락처와 주민등록번호를 입력해주세요.");

    if(!confirm(`${amt.toLocaleString()}P를 출금 신청하시겠습니까?\n(3.3% 세금 공제 후 입금됩니다)`)) return;

    try {
        const { error: reqError } = await sb.from('withdrawal_requests').insert({
            user_id: currentUser.id, 
            amount: amt, 
            bank_name: bank, 
            account_number: acc, 
            account_holder: holder,
            contact_phone: phone,
            rrn: rrn,
            status: 'pending'
        });

        if (reqError) throw reqError;

        const { error: profileError } = await sb.from('profiles').update({ mileage: cur - amt }).eq('id', currentUser.id);
        if (profileError) throw profileError;

        await sb.from('wallet_logs').insert({
            user_id: currentUser.id, type: 'withdraw_req', amount: -amt, description: `출금신청(${bank})`
        });

        alert("✅ 출금 신청 완료! 관리자 확인 후 입금됩니다.");
        document.getElementById('withdrawModal').style.display = 'none';
        
        // 초기화
        document.getElementById('wdAmount').value = '';
        loadDashboardStats();

    } catch (e) {
        console.error(e);
        alert("오류 발생: " + e.message);
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">내역이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    logs.forEach(log => {
        const isPlus = log.amount > 0;
        const color = isPlus ? '#2563eb' : '#ef4444';
        const sign = isPlus ? '+' : '';
        
        let typeName = '기타';
        if(log.type?.includes('deposit')) typeName = '충전/입금';
        if(log.type?.includes('payment')) typeName = '사용/결제';
        if(log.type?.includes('withdraw')) typeName = '출금/차감';
        if(log.type?.includes('admin')) typeName = '관리자조정';

        tbody.innerHTML += `
            <tr>
                <td>${new Date(log.created_at).toLocaleDateString()}</td>
                <td><span class="status-badge" style="background:#f1f5f9; color:#64748b;">${typeName}</span></td>
                <td>${log.description || '-'}</td>
                <td style="text-align:right; font-weight:bold; color:${color};">${sign}${log.amount.toLocaleString()}원</td>
            </tr>`;
    });
}

async function logout() {
    if(confirm("로그아웃 하시겠습니까?")) {
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
        alert("아직 도착한 견적(입찰)이 없습니다.\n파트너사들이 확인 중이니 잠시만 기다려주세요.");
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
            ? `<span style="font-size:11px; color:#64748b; text-decoration:underline; cursor:pointer;" onclick="viewPartnerReviews('${bid.partner_id}')">후기 ${partnerInfo.review_count}개 보기</span>` 
            : `<span style="font-size:11px; color:#ccc;">후기 없음</span>`;

        let actionArea = '';
        if(isSelected) {
            actionArea = `
                <div style="margin-top:10px; padding:10px; background:#dcfce7; border:1px solid #bbf7d0; border-radius:8px; text-align:center;">
                    <div style="font-weight:bold; color:#166534; font-size:14px;">✅ 선택 완료</div>
                    <div style="font-size:18px; font-weight:900; color:#1e293b; margin-top:5px;">📞 ${bid.partner_phone}</div>
                    <div style="font-size:12px; color:#166534;">위 번호로 연락하여 일정을 조율하세요.</div>
                </div>`;
        } else {
            actionArea = `<button onclick="window.selectBid('${bid.id}', '${bid.order_id}')" class="btn-round primary" style="width:100%; margin-top:10px; height:40px; justify-content:center;">이 파트너 선택하기</button>`;
        }

        listHtml += `
            <div style="padding:20px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:15px; background:white; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                    <div>
                        <div style="font-weight:bold; font-size:16px; color:#1e293b;">${partnerInfo.company_name || '파트너사'}</div>
                        <div style="margin-top:2px;">${stars} <span style="font-size:12px; font-weight:bold; color:#1e293b;">${score.toFixed(1)}</span> ${reviewText}</div>
                    </div>
                    <div style="font-weight:800; color:#6366f1; font-size:18px;">${bid.price.toLocaleString()}원</div>
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
                    <h3 style="margin:0; font-size:18px;">📋 도착한 견적서 (${bids.length}건)</h3>
                    <p style="color:#64748b; font-size:13px; margin:5px 0 0 0;">가격과 평점을 비교하고 파트너를 선택하세요.</p>
                </div>
                <div style="padding:20px;">
                    ${listHtml}
                </div>
                <div style="padding:15px; text-align:center;">
                    <button onclick="document.getElementById('bidListModal').remove()" class="btn-round" style="width:100%; background:#e2e8f0; color:#334155; border:none; height:45px; justify-content:center;">닫기</button>
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
        html = '<div style="padding:20px; text-align:center; color:#999;">등록된 후기가 없습니다.</div>';
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
            <h4 style="margin:0 0 10px 0;">💬 파트너 후기</h4>
            ${html}
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:15px; padding:10px; border:1px solid #ddd; background:white; border-radius:8px; cursor:pointer;">닫기</button>
        </div>
    `;
    document.body.appendChild(reviewModal);
};

// [파트너 선택 실행 함수] (함수가 없다면 추가)
// [파트너 선택 실행 함수] (수정됨: 고객 연락처 입력)
window.selectBid = async function(bidId, orderId) {
    // 1. 고객 연락처 입력받기
    const myPhone = prompt("파트너에게 전달할 고객님의 연락처를 입력해주세요:", "010-");
    
    if(!myPhone) return alert("연락처를 입력해야 파트너와 연결될 수 있습니다.");
    
    if(!confirm(`입력하신 번호(${myPhone})를 파트너에게 전달하고\n이 업체를 최종 선택하시겠습니까?`)) return;

    // 2. 해당 입찰 승인
    const { error: err1 } = await sb.from('bids').update({ status: 'selected' }).eq('id', bidId);
    if(err1) return alert("오류 발생: " + err1.message);

    // 3. 나머지 입찰 거절
    await sb.from('bids').update({ status: 'rejected' }).eq('order_id', orderId).neq('id', bidId);
    
    // 4. 주문 상태 변경 + 고객 연락처 저장
    await sb.from('orders').update({ 
        status: '제작준비',
        selected_customer_phone: myPhone // [핵심] 고객 연락처 저장
    }).eq('id', orderId);

    alert("✅ 매칭이 완료되었습니다!\n파트너 연락처가 공개되었습니다.");
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
            speakTTS("입찰에 참여한 파트너스가 있습니다. 견적을 확인해주세요.");
            
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
        msg.lang = 'ko-KR';
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
        alert("매칭된 파트너 정보를 찾을 수 없습니다.");
        return;
    }

    const partnerId = bids.partner_id;
    const rating = prompt("파트너의 평점을 입력해주세요 (1~5점):", "5");
    if(!rating) return;
    
    const comment = prompt("다른 고객들이 볼 수 있도록 후기를 남겨주세요:", "친절하고 꼼꼼하게 시공해주셨습니다.");
    if(!comment) return;

    // [핵심] partner_reviews 테이블에 저장 (공개용)
    const { error } = await sb.from('partner_reviews').insert({
        order_id: orderId,
        partner_id: partnerId,
        customer_id: currentUser.id,
        rating: parseInt(rating),
        comment: comment
    });

    if(error) {
        alert("후기 저장 실패: " + error.message);
    } else {
        // 주문 상태도 '구매확정'으로 변경
        await sb.from('orders').update({ status: '구매확정' }).eq('id', orderId);
        
        // 파트너 평균 평점 업데이트 (RPC 함수가 있다면 좋지만, 없다면 생략 가능)
        alert("소중한 후기가 등록되었습니다! 감사합니다.");
        loadOrders(); // 목록 새로고침
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
            list.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#999;">아직 등록된 후기가 없습니다.</div>';
        }
    }
    // [신규] 강력한 소리 재생 함수 (마이페이지용)
