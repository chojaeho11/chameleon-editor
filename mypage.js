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
        if(['완료됨','배송완료','결제완료'].includes(o.status)) badgeClass = 'status-done';
        if(o.status === '취소됨') badgeClass = 'status-cancel';

        const canCancel = ['접수대기','입금대기'].includes(o.status);
        const safeId = String(o.id); 
        const displayId = safeId.length > 8 ? safeId.substring(0,8) + '...' : safeId;

        tbody.innerHTML += `
            <tr>
                <td>
                    ${new Date(o.created_at).toLocaleDateString()}<br>
                    <small style="color:#888;">${displayId}</small>
                </td>
                <td><div style="font-weight:bold;">${summary}</div></td>
                <td style="font-weight:bold;">${(o.total_amount || 0).toLocaleString()}원</td>
                <td><span class="status-badge ${badgeClass}">${o.status}</span></td>
                <td>
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