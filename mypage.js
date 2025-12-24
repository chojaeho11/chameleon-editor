// mypage.js
// ★ [수정 1] PRODUCT_DB 추가 (이게 없으면 상품 정보를 못 불러와서 엑박이 뜹니다)
import { sb, initConfig, currentUser, PRODUCT_DB } from "./config.js";

// ============================================================
// [1] 초기화 및 이벤트 리스너
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. 설정 및 세션 로드 (여기서 PRODUCT_DB가 채워짐)
    await initConfig();
    
    // 2. 로그인 체크 (비로그인 접근 차단)
    if (!currentUser) {
        alert("로그인이 필요한 서비스입니다.");
        location.href = 'index.html';
        return;
    }

    // 3. 사용자 정보 UI 표시
    document.getElementById('userNameDisplay').innerText = `반갑습니다, ${currentUser.user_metadata?.full_name || '고객'}님!`;
    if(document.getElementById('mpUserName')) {
        document.getElementById('mpUserName').innerText = currentUser.user_metadata?.full_name || '고객님';
        document.getElementById('mpUserEmail').innerText = currentUser.email;
    }

    // 4. 초기 데이터 로드 (대시보드)
    loadDashboardStats();
    
    // 5. HTML onclick 이벤트를 위한 전역 함수 연결
    window.switchTab = switchTab;
    window.logout = logout;
    
    // 디자인 관련
    window.loadDesignToEditor = loadDesignToEditor;
    window.deleteDesign = deleteDesign;
    
    // 주문 관련
    window.cancelOrder = cancelOrder;
    window.reOrder = reOrder;
    
    // 수익/기타
    window.saveBankInfo = saveBankInfo;
    window.returnToEditor = returnToEditor;
});

// ============================================================
// [2] 네비게이션 및 탭 전환
// ============================================================

// 3) 에디터로 돌아가기
function returnToEditor() {
    location.href = 'index.html';
}

// 탭 전환 로직
function switchTab(tabId) {
    // 사이드바 메뉴 활성화 처리
    const navItems = document.querySelectorAll('.mp-nav-item');
    navItems.forEach(el => el.classList.remove('active'));
    
    // 현재 클릭된 요소 찾기 (event 객체 활용)
    const currentNav = Array.from(navItems).find(el => el.getAttribute('onclick')?.includes(`'${tabId}'`));
    if(currentNav) currentNav.classList.add('active');

    // 섹션 컨텐츠 전환
    document.querySelectorAll('.mp-section').forEach(el => el.classList.remove('active'));
    const targetSection = document.getElementById('tab-' + tabId);
    if(targetSection) targetSection.classList.add('active');

    // 탭별 데이터 로드
    if (tabId === 'designs') loadMyDesigns();
    if (tabId === 'orders') loadOrders();
    if (tabId === 'profit') {
        loadBankInfo();
        loadRevenueAssets();
    }
}

// ============================================================
// [3] 대시보드 (요약 통계)
// ============================================================
async function loadDashboardStats() {
    // 1. 마일리지/수익금
    const { data: profile } = await sb.from('profiles').select('mileage').eq('id', currentUser.id).single();
    const mileage = profile ? profile.mileage : 0;
    
    const els = ['mileageDisplay', 'profitTotal', 'mpUserMileage'];
    els.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = mileage.toLocaleString() + (id.includes('Total') ? '' : ' P');
    });

    // 2. 진행중 주문 수
    const { count: orderCount } = await sb.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .neq('status', '완료됨')
        .neq('status', '취소됨');
    
    if(document.getElementById('activeOrderCount')) {
        document.getElementById('activeOrderCount').innerText = (orderCount || 0) + ' 건';
    }

    // 3. 디자인 수
    const { count: designCount } = await sb.from('user_designs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
    
    if(document.getElementById('designCount')) {
        document.getElementById('designCount').innerText = (designCount || 0) + ' 개';
    }

    // 4. 최근 수익 알림 (로그 5개)
    const { data: logs } = await sb.from('mileage_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(5);
    
    const logList = document.getElementById('recentLogs');
    if(logList) {
        logList.innerHTML = '';
        if (logs && logs.length > 0) {
            logs.forEach(log => {
                const color = log.amount > 0 ? '#16a34a' : '#ef4444';
                const sign = log.amount > 0 ? '+' : '';
                logList.innerHTML += `
                    <li style="margin-bottom:8px; display:flex; justify-content:space-between; font-size:13px; border-bottom:1px solid #f1f5f9; padding-bottom:5px;">
                        <span>${log.description || '마일리지 변동'}</span>
                        <span style="font-weight:bold; color:${color};">${sign}${log.amount.toLocaleString()} P</span>
                    </li>`;
            });
        } else {
            logList.innerHTML = '<li style="padding:10px; color:#999;">최근 활동 내역이 없습니다.</li>';
        }
    }
}

// ============================================================
// [4] 내 디자인 관리 (6칸 그리드 & 편집 이동)
// ============================================================
async function loadMyDesigns() {
    const grid = document.getElementById('designGrid');
    if(!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;">디자인을 불러오는 중입니다...</div>';
    
    // 2) 18개 제한하여 로드
    const { data, error } = await sb.from('user_designs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(18);

    grid.innerHTML = '';
    
    if (error || !data || data.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999; background:#fff; border-radius:8px;">저장된 디자인이 없습니다.<br>에디터에서 멋진 디자인을 만들어보세요!</div>';
        return;
    }

    data.forEach(d => {
        // HTML 생성
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

// 1) 편집 버튼: ID를 저장하고 index.html로 이동
function loadDesignToEditor(id) {
    if(!confirm("이 디자인을 에디터로 불러오시겠습니까?")) return;
    
    // main.js에서 이 값을 확인하여 자동으로 캔버스에 로드함
    localStorage.setItem('load_design_id', id);
    location.href = 'index.html';
}

async function deleteDesign(id) {
    if (!confirm("정말 삭제하시겠습니까? (복구 불가)")) return;
    
    const { error } = await sb.from('user_designs').delete().eq('id', id);
    if (error) {
        alert("삭제 실패: " + error.message);
    } else {
        // 성공 시 목록 새로고침
        loadMyDesigns();
        loadDashboardStats(); // 카운트 갱신
    }
}

// ============================================================
// [5] 주문 관리 (취소 & 재주문)
// ============================================================
async function loadOrders() {
    const tbody = document.getElementById('orderListBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">주문 내역을 불러오는 중...</td></tr>';

    const { data: orders, error } = await sb.from('orders')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';
    
    if (error || !orders || orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:50px; color:#999;">주문 내역이 없습니다.</td></tr>';
        return;
    }

    orders.forEach(o => {
        // 상태 뱃지 스타일
        let badgeClass = 'status-wait'; // 기본: 대기/진행중
        if (o.status === '완료됨' || o.status === '배송완료') badgeClass = 'status-done';
        if (o.status === '취소됨') badgeClass = 'status-cancel';

        // 상품명 요약
        let summary = "상품 정보 없음";
        // items가 JSON 문자열일 경우 파싱, 객체일 경우 바로 사용
        let items = o.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch(e) { items = []; }
        }
        
        if (Array.isArray(items) && items.length > 0) {
            summary = items[0].productName || items[0].product?.name || "상품";
            if (items.length > 1) summary += ` 외 ${items.length - 1}건`;
        }

        // 취소 가능 여부 (접수대기, 입금대기 상태일 때만)
        const canCancel = (o.status === '접수대기' || o.status === '입금대기');

        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="font-weight:bold; color:#333;">${new Date(o.created_at).toLocaleDateString()}</div>
                    <div style="font-size:11px; color:#888;">${o.id}</div>
                </td>
                <td>
                    <div style="font-weight:bold; color:#334155;">${summary}</div>
                    <div style="font-size:12px; color:#64748b;">${items.length}개 품목</div>
                </td>
                <td style="font-weight:bold; color:#0f172a;">${(o.total_amount || 0).toLocaleString()}원</td>
                <td><span class="status-badge ${badgeClass}">${o.status}</span></td>
                <td>
                    <div style="display:flex; gap:5px; flex-direction:column;">
                        ${canCancel ? `<button class="btn-cancel-order" onclick="cancelOrder('${o.id}')">주문취소</button>` : ''}
                        <button class="btn-round" style="height:28px; font-size:11px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; justify-content:center;" onclick="reOrder('${o.id}')">
                            <i class="fa-solid fa-cart-plus"></i> 다시담기
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// ============================================================
// [주문 관리] 재주문(다시담기) 기능 수정 (여기가 중요)
// ============================================================
async function reOrder(orderId) {
    if(!confirm("이 주문의 상품들을 장바구니에 다시 담으시겠습니까?")) return;
    
    // 1. 주문 정보 가져오기
    const { data } = await sb.from('orders').select('items').eq('id', orderId).single();
    if(!data || !data.items) return alert("주문 정보를 찾을 수 없습니다.");

    let items = data.items;
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
    }

    // 2. 현재 장바구니 로드
    const cartKey = `chameleon_cart_${currentUser.id}`;
    let currentCart = [];
    try {
        currentCart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    } catch(e) {}
    
    // 3. 아이템 복구 및 추가
    items.forEach(oldItem => {
        // 깊은 복사
        let newItem = JSON.parse(JSON.stringify(oldItem));
        
        // (A) 고유 ID 새로 발급
        newItem.uid = Date.now() + Math.random(); 

        // (B) 상품 정보(product) 복구 시도
        let prodCode = newItem.product?.code || newItem.product?.key;
        
        // ★ [수정] import한 PRODUCT_DB를 직접 사용합니다.
        if (!prodCode && PRODUCT_DB) {
             for (const key in PRODUCT_DB) {
                 if (PRODUCT_DB[key].name === newItem.productName) {
                     prodCode = key;
                     break;
                 }
             }
        }

        // 최신 상품 정보 가져오기
        let freshProduct = null;
        if (PRODUCT_DB && prodCode && PRODUCT_DB[prodCode]) {
            freshProduct = PRODUCT_DB[prodCode];
        }

        // 상품 정보가 없으면 기존 정보라도 최대한 유지, 정 없으면 기본값
        if (!newItem.product) newItem.product = {};
        
        if (freshProduct) {
            // 최신 정보로 덮어씌우기 (이미지, 가격 복구)
            newItem.product = freshProduct;
            newItem.product.code = prodCode; // 코드 유지
        } else {
            // DB에서 못 찾았을 경우 최소한의 정보 채우기
            if (!newItem.product.name) newItem.product.name = newItem.productName || "상품정보 없음";
            if (!newItem.product.price) newItem.product.price = newItem.price || 0;
        }

        // (C) 썸네일 복구
        if (!newItem.thumb || newItem.thumb.includes('undefined') || newItem.thumb.includes('null')) {
            // 상품 이미지가 있으면 그것으로, 없으면 기본 이미지
            newItem.thumb = newItem.product.img || 'https://placehold.co/100?text=No+Image';
        }

        // (D) 옵션 정보 복구 (구조 호환성 유지)
        if (!newItem.selectedAddons) newItem.selectedAddons = newItem.options || {};
        if (!newItem.addonQuantities) newItem.addonQuantities = {};

        // 장바구니에 추가
        currentCart.push(newItem);
    });

    // 4. 저장 및 이동
    localStorage.setItem(cartKey, JSON.stringify(currentCart));
    localStorage.setItem('open_cart_on_load', 'true'); // 메인 페이지 로드 시 장바구니 열기
    
    alert("장바구니에 상품을 담았습니다.\n에디터 화면으로 이동합니다.");
    location.href = 'index.html';
}

// 4) 주문 취소하기
async function cancelOrder(orderId) {
    if (!confirm("정말 주문을 취소하시겠습니까?\n취소 후에는 복구가 불가능합니다.")) return;

    const { error } = await sb.from('orders')
        .update({ 
            status: '취소됨', 
            request_note: '고객(마이페이지) 요청에 의한 취소' 
        })
        .eq('id', orderId);

    if (error) {
        alert("취소 실패: " + error.message);
    } else {
        alert("주문이 정상적으로 취소되었습니다.");
        loadOrders(); // 목록 새로고침
        loadDashboardStats(); // 통계 새로고침
    }
}

// ============================================================
// [5] 수익 & 마일리지 관리 (계좌 및 에셋)
// ============================================================

// 5) 계좌 정보 로드
async function loadBankInfo() {
    const { data } = await sb.from('profiles').select('bank_name, bank_account, bank_holder').eq('id', currentUser.id).single();
    if(data) {
        document.getElementById('bankName').value = data.bank_name || "";
        document.getElementById('bankAccount').value = data.bank_account || "";
        document.getElementById('bankHolder').value = data.bank_holder || "";
    }
    // 마일리지 내역 테이블도 로드
    loadMileageLogs();
}

// 5) 계좌 정보 저장
async function saveBankInfo() {
    const bankName = document.getElementById('bankName').value;
    const bankAccount = document.getElementById('bankAccount').value;
    const bankHolder = document.getElementById('bankHolder').value;

    if(!bankName || !bankAccount || !bankHolder) return alert("은행명, 계좌번호, 예금주를 모두 입력해주세요.");

    const { error } = await sb.from('profiles').update({
        bank_name: bankName,
        bank_account: bankAccount,
        bank_holder: bankHolder
    }).eq('id', currentUser.id);

    if(error) alert("저장 실패: " + error.message);
    else alert("계좌 정보가 안전하게 저장되었습니다.\n누적 수익금 10만원 이상 시 매월 정산됩니다.");
}

// 5) 수익 창출 에셋 리스트 로드
async function loadRevenueAssets() {
    const listContainer = document.getElementById('assetList');
    if(!listContainer) return;
    
    listContainer.innerHTML = '<div style="padding:20px; text-align:center;">데이터 로딩 중...</div>';

    // 내가 업로드한 에셋 (Library 테이블) 조회
    const { data: assets, error } = await sb.from('library')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    listContainer.innerHTML = '';

    if(error || !assets || assets.length === 0) {
        listContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#999; border:1px dashed #cbd5e1; border-radius:8px;">등록된 수익 창출 이미지가 없습니다.<br>로고나 벡터 이미지를 공유하고 수익을 창출해보세요!</div>';
        return;
    }

    // 각 에셋 표시
    for (const asset of assets) {
        const typeLabel = asset.category === 'logo' ? '로고 (0.2%)' : '이미지/벡터 (0.1%)';
        
        listContainer.innerHTML += `
            <div class="asset-item">
                <img src="${asset.thumb_url}" class="asset-thumb">
                <div class="asset-info">
                    <div style="font-weight:bold; font-size:14px; color:#334155;">${asset.tags || '제목 없음'}</div>
                    <div style="font-size:12px; color:#888; margin-top:3px;">
                        유형: <span style="color:#6366f1; font-weight:bold;">${typeLabel}</span>
                        <span style="margin:0 5px; color:#e2e8f0;">|</span>
                        등록: ${new Date(asset.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="asset-revenue">
                    <span style="font-size:12px; color:#64748b; font-weight:normal;">누적 수익</span>
                    <br>
                    <span>집계 중...</span> 
                </div>
            </div>
        `;
    }
}

// 마일리지 상세 내역 로드 (테이블)
async function loadMileageLogs() {
    const tbody = document.getElementById('mileageListBody');
    if(!tbody) return;
    
    const { data: logs } = await sb.from('mileage_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50); // 최근 50개만

    tbody.innerHTML = '';
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">내역이 없습니다.</td></tr>';
        return;
    }

    logs.forEach(log => {
        let typeStr = '일반';
        let color = '#333';
        if(log.type === 'revenue_share' || log.type === 'earn_share') { typeStr = '수익'; color = '#6366f1'; }
        if(log.type === 'use_order') { typeStr = '사용'; color = '#ef4444'; }

        tbody.innerHTML += `
            <tr>
                <td>${new Date(log.created_at).toLocaleDateString()}</td>
                <td>${log.description}</td>
                <td><span style="font-weight:bold; color:${color};">${typeStr}</span></td>
                <td style="text-align:right; font-weight:bold; color:${log.amount > 0 ? '#16a34a' : '#ef4444'}">
                    ${log.amount > 0 ? '+' : ''}${log.amount.toLocaleString()} P
                </td>
            </tr>
        `;
    });
}

// 로그아웃
async function logout() {
    if(confirm("로그아웃 하시겠습니까?")) {
        await sb.auth.signOut();
        location.href = 'index.html';
    }
}