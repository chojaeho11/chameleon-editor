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

    const userName = currentUser.user_metadata?.full_name || '고객';
    document.getElementById('userNameDisplay').innerText = `반갑습니다, ${userName}님!`;
    
    loadDashboardStats();
    
    window.switchTab = switchTab;
    window.logout = logout;
    window.loadDesignToEditor = loadDesignToEditor;
    window.deleteDesign = deleteDesign;
    window.cancelOrder = cancelOrder;
    window.reOrder = reOrder; // ★ 다시 담기 기능 연결
});

// [2] 탭 전환
function switchTab(tabId) {
    const navItems = document.querySelectorAll('.mp-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    
    const currentNav = Array.from(navItems).find(el => el.getAttribute('onclick')?.includes(`'${tabId}'`));
    if(currentNav) currentNav.classList.add('active');

    document.querySelectorAll('.mp-section').forEach(el => el.classList.remove('active'));
    const targetSection = document.getElementById('tab-' + tabId);
    if(targetSection) targetSection.classList.add('active');

    if (tabId === 'designs') loadMyDesigns();
    if (tabId === 'orders') loadOrders();
}

// [3] 대시보드 통계
async function loadDashboardStats() {
    const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
    const mileage = profile ? profile.mileage : 0;
    
    const elMileage = document.getElementById('mileageDisplay');
    if(elMileage) elMileage.innerText = mileage.toLocaleString() + ' P';

    const { count: designCount } = await sb.from('user_designs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
    
    const elDesign = document.getElementById('designCount');
    if(elDesign) elDesign.innerText = (designCount || 0) + ' 개';
    
    const { count: orderCount } = await sb.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .neq('status', '완료됨')
        .neq('status', '취소됨');

    const elOrder = document.getElementById('activeOrderCount');
    if(elOrder) elOrder.innerText = (orderCount || 0) + ' 건';
}

// [4] 내 디자인 목록
async function loadMyDesigns() {
    const grid = document.getElementById('designGrid');
    if(!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;">로딩 중...</div>';
    
    const { data, error } = await sb.from('user_designs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    grid.innerHTML = '';
    
    if (error || !data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999; background:#fff;">저장된 디자인이 없습니다.</div>';
        return;
    }

    data.forEach(d => {
        const div = document.createElement('div');
        div.className = 'mp-design-card';
        div.innerHTML = `
            <img src="${d.thumb_url}" class="mp-design-thumb" onclick="loadDesignToEditor(${d.id})" title="클릭하여 편집">
            <div class="mp-design-body">
                <div class="mp-design-title">${d.title}</div>
                <div style="font-size:11px; color:#888;">${new Date(d.created_at).toLocaleDateString()}</div>
                <div style="display:flex; gap:5px; margin-top:5px;">
                    <button class="btn-round primary" style="flex:1; height:30px; font-size:12px; justify-content:center;" onclick="loadDesignToEditor(${d.id})">
                        <i class="fa-solid fa-pen"></i> 편집
                    </button>
                    <button class="btn-round" style="width:30px; height:30px; padding:0; color:red; justify-content:center; border:1px solid #fee2e2;" onclick="deleteDesign(${d.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
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

// [5] 주문 목록
async function loadOrders() {
    const tbody = document.getElementById('orderListBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">로딩 중...</td></tr>';

    const { data: orders, error } = await sb.from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#999;">주문 내역이 없습니다.</td></tr>';
        return;
    }

    // ★ 전역 변수에 주문 데이터 저장 (재주문 시 사용)
    window.myOrdersData = orders;

    orders.forEach(o => {
        let badgeClass = 'status-wait';
        if (o.status === '완료됨' || o.status === '배송완료') badgeClass = 'status-done';
        if (o.status === '취소됨') badgeClass = 'status-cancel';

        let summary = "상품 정보 없음";
        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        
        if (Array.isArray(items) && items.length > 0) {
            summary = items[0].productName || items[0].product?.name || "상품";
            if (items.length > 1) summary += ` 외 ${items.length - 1}건`;
        }

        const canCancel = (o.status === '접수대기' || o.status === '입금대기');

        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="font-weight:bold;">${new Date(o.created_at).toLocaleDateString()}</div>
                    <div style="font-size:11px; color:#888;">${o.id}</div>
                </td>
                <td>
                    <div style="font-weight:bold;">${summary}</div>
                    <div style="font-size:12px; color:#666;">${items.length}개 품목</div>
                </td>
                <td style="font-weight:bold;">${(o.total_amount || 0).toLocaleString()}원</td>
                <td><span class="status-badge ${badgeClass}">${o.status}</span></td>
                <td>
                    <div style="display:flex; gap:5px; flex-direction:column;">
                        ${canCancel ? `<button class="btn-cancel-order" onclick="cancelOrder('${o.id}')">취소</button>` : ''}
                        <button class="btn-round" style="height:28px; font-size:11px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; justify-content:center;" onclick="reOrder('${o.id}')">
                            <i class="fa-solid fa-cart-plus"></i> 다시담기
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function cancelOrder(orderId) {
    if (!confirm("주문을 취소하시겠습니까?")) return;
    await sb.from('orders').update({ status: '취소됨' }).eq('id', orderId);
    loadOrders();
}

// ★ [핵심 기능] 다시 담기 (재주문) 로직 구현
async function reOrder(orderId) {
    if (!window.myOrdersData) return;
    const order = window.myOrdersData.find(o => o.id == orderId); // == 사용 (타입 유연성)
    if (!order) return alert("주문 정보를 찾을 수 없습니다.");

    let items = order.items;
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { 
            console.error(e);
            return alert("주문 상품 데이터 오류");
        }
    }

    if (!Array.isArray(items) || items.length === 0) return alert("담을 상품이 없습니다.");

    if (!confirm("해당 주문의 상품들을 장바구니에 다시 담으시겠습니까?")) return;

    // 현재 장바구니에 추가
    items.forEach(item => {
        // 새 UID 생성하여 중복 방지
        const newItem = { ...item, uid: Date.now() + Math.random() };
        cartData.push(newItem);
    });

    // 로컬 스토리지 저장
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
    localStorage.setItem(storageKey, JSON.stringify(cartData));

    // ★ 알림 및 장바구니 페이지로 이동
    if (confirm("장바구니에 담겼습니다. 장바구니로 이동할까요?")) {
        // index.html로 이동하면서 장바구니를 열도록 플래그 설정
        localStorage.setItem('open_cart_on_load', 'true');
        location.href = 'index.html';
    }
}

async function logout() {
    if(confirm("로그아웃 하시겠습니까?")) {
        await sb.auth.signOut();
        location.href = 'index.html';
    }
}