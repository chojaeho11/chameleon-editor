// mypage.js
import { sb, initConfig, currentUser, cartData, PRODUCT_DB } from "./config.js";

// [1] 초기화
document.addEventListener("DOMContentLoaded", async () => {
    await initConfig();
    
    if (!currentUser) {
        alert("로그인이 필요한 서비스입니다.");
        location.href = 'index.html';
        return;
    }

    // 유저 이름 표시
    const userName = currentUser.user_metadata?.full_name || '고객';
    const email = currentUser.email || '';
    const displayTitle = document.getElementById('userNameDisplay');
    if(displayTitle) displayTitle.innerText = `반갑습니다, ${userName}님!`;
    
    // 대시보드 통계 및 지갑 로그 로드
    loadDashboardStats();
    loadWalletLogs();
    
    // 전역 함수 연결
    window.switchTab = switchTab;
    window.logout = logout;
    window.loadDesignToEditor = loadDesignToEditor;
    window.deleteDesign = deleteDesign;
    window.cancelOrder = cancelOrder;
    window.reOrder = reOrder;
});

// [2] 탭 전환 기능
function switchTab(tabId) {
    const navItems = document.querySelectorAll('.mp-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    
    // 클릭된 탭 활성화
    const currentNav = Array.from(navItems).find(el => el.getAttribute('onclick')?.includes(`'${tabId}'`));
    if(currentNav) currentNav.classList.add('active');

    // 섹션 전환
    document.querySelectorAll('.mp-section').forEach(el => el.classList.remove('active'));
    const targetSection = document.getElementById('tab-' + tabId);
    if(targetSection) targetSection.classList.add('active');

    // 탭별 데이터 로드
    if (tabId === 'designs') loadMyDesigns();
    if (tabId === 'orders') loadOrders();
}

// [3] 등급 자동 승급 체크
async function checkAndUpgradeTier(userId, currentRole) {
    if (currentRole === 'admin' || currentRole === 'franchise') return;

    try {
        // DB에 저장된 통계값 활용
        const { data: profile } = await sb.from('profiles')
            .select('total_spend, logo_count')
            .eq('id', userId)
            .single();

        const totalSpend = profile?.total_spend || 0;
        const logoCount = profile?.logo_count || 0;

        let newRole = 'customer';

        // 승급 조건
        if (logoCount >= 100 || totalSpend >= 10000000) {
            newRole = 'platinum';
        } else if (logoCount >= 10 || totalSpend >= 5000000) {
            newRole = 'gold';
        }

        // 등급 업데이트 (상승시에만)
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

        // 화면 업데이트
        const elMileage = document.getElementById('mileageDisplay');
        if(elMileage) elMileage.innerText = (profile.mileage || 0).toLocaleString() + ' P';

        const elSpend = document.getElementById('totalSpendDisplay');
        if(elSpend) elSpend.innerText = (profile.total_spend || 0).toLocaleString() + ' 원';

        const elLogo = document.getElementById('logoCountDisplay');
        if(elLogo) elLogo.innerText = (profile.logo_count || 0) + ' 개';

        const elDeposit = document.getElementById('depositTotal');
        if(elDeposit) elDeposit.innerText = (profile.deposit || 0).toLocaleString();
        
        // 수익금(가칭) 표시 (현재는 0으로 고정하거나 별도 로직 필요)
        const elProfit = document.getElementById('profitTotal');
        if(elProfit) elProfit.innerText = "0"; // 추후 구현 필요 시 수정

        // 등급 체크 실행
        await checkAndUpgradeTier(currentUser.id, profile.role);

        // 진행중인 주문 건수 (실시간 조회)
        const { count: orderCount } = await sb.from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id)
            .neq('status', '완료됨')
            .neq('status', '취소됨')
            .neq('status', '배송완료');

        const elOrder = document.getElementById('activeOrderCount');
        if(elOrder) elOrder.innerText = (orderCount || 0) + ' 건';

    } catch(e) {
        console.warn("대시보드 로드 실패:", e);
    }
}

// [5] 디자인 목록 로드
async function loadMyDesigns() {
    const grid = document.getElementById('designGrid');
    if(!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;">로딩 중...</div>';
    
    const { data, error } = await sb.from('user_designs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    grid.innerHTML = '';
    if (!data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;">저장된 디자인이 없습니다.</div>';
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
                    <button class="btn-round primary" onclick="loadDesignToEditor(${d.id})" style="flex:1; font-size:12px; height:30px; justify-content:center;">편집</button>
                    <button class="btn-round" onclick="deleteDesign(${d.id})" style="width:30px; height:30px; color:red; border-color:#fee2e2; justify-content:center;"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        grid.appendChild(div);
    });
}

function loadDesignToEditor(id) {
    if(!confirm("이 디자인을 에디터로 불러오시겠습니까?")) return;
    localStorage.setItem('load_design_id', id); 
    location.href = 'index.html'; 
}

async function deleteDesign(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await sb.from('user_designs').delete().eq('id', id);
    loadMyDesigns();
}

// [6] 주문 목록 로드
// [6] 주문 목록 로드 (수정됨: ID 오류 해결)
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
        if(['완료됨','배송완료'].includes(o.status)) badgeClass = 'status-done';
        if(o.status === '취소됨') badgeClass = 'status-cancel';

        const canCancel = ['접수대기','입금대기'].includes(o.status);

        // ★ [핵심 수정] String(o.id)를 사용하여 숫자 ID도 안전하게 처리
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