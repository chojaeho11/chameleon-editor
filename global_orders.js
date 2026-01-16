import { sb } from "./global_config.js";
import { showLoading } from "./global_common.js";

let currentOrderStatus = '접수됨';
let currentPage = 1;
const itemsPerPage = 10;
let currentMgrOrderId = null;
let currentMgrFiles = [];
let staffList = [];

// [VIP 주문]
window.loadVipOrders = async () => {
    const tbody = document.getElementById('vipOrderListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><div class="spinner"></div></td></tr>';

    try {
        const { data, error } = await sb.from('vip_orders')
            .select('id, created_at, status, customer_name, customer_phone, memo, files, preferred_manager')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#999;">접수된 VIP 주문이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(item => {
            let statusBadge = item.status === '확인됨' ? `<span class="badge" style="background:#dcfce7; color:#15803d;">확인완료</span>` : `<span class="badge" style="background:#fee2e2; color:#ef4444;">대기중</span>`;
            let filesHtml = (item.files && item.files.length) ? item.files.map(f => `<a href="${f.url}" target="_blank" class="btn btn-outline btn-sm" style="margin:2px;">💾 ${f.name}</a>`).join('') : '<span style="color:#ccc;">파일 없음</span>';
            
            tbody.innerHTML += `
                <tr style="${item.status !== '확인됨' ? 'background:#fff7ed;' : ''}">
                    <td><input type="checkbox" class="vip-chk" value="${item.id}"></td>
                    <td>${new Date(item.created_at).toLocaleString()}</td>
                    <td><span class="badge">${item.preferred_manager || '미지정'}</span></td>
                    <td style="font-weight:bold;">${item.customer_name}</td>
                    <td>${item.customer_phone}</td>
                    <td style="font-size:13px; color:#475569;">${item.memo || '-'}</td>
                    <td>${filesHtml}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">
                        <button class="btn btn-primary btn-sm" onclick="toggleVipStatus(${item.id}, '${item.status}')">${item.status === '확인됨' ? '취소' : '확인'}</button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};

window.toggleVipStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === '확인됨' ? '대기중' : '확인됨';
    const { error } = await sb.from('vip_orders').update({ status: newStatus }).eq('id', id);
    if (!error) loadVipOrders();
};

window.deleteSelectedVipOrders = async () => {
    const checks = document.querySelectorAll('.vip-chk:checked');
    if (checks.length === 0) return alert("선택된 항목이 없습니다.");
    if (!confirm(`${checks.length}건을 삭제하시겠습니까?`)) return;
    const ids = Array.from(checks).map(c => c.value);
    const { error } = await sb.from('vip_orders').delete().in('id', ids);
    if (!error) loadVipOrders();
};

// [통합 주문 로드]
window.loadOrders = async () => {
    const tbody = document.getElementById('orderListBody');
    if (!tbody) return;

    showLoading(true);
    window.updateActionButtons();
    
    try {
        const searchKeyword = document.getElementById('orderSearchInput').value.trim();
        const siteFilter = document.getElementById('filterSite').value;
        const deliveryDateFilter = document.getElementById('filterDeliveryDate').value;
        const orderDateFilter = document.getElementById('filterOrderDate').value;

        // 스태프 목록 로드 (색상 표시용)
        if(staffList.length === 0) {
            const { data } = await sb.from('admin_staff').select('*');
            staffList = data || [];
        }

        // [핵심 1] 쿼리에 bids(id) 추가 (입찰 카운트용)
        let query = sb.from('orders')
            .select('*, bids(id)', { count: 'exact' }) 
            .order('created_at', { ascending: false });

        // [핵심 2] 결제하기 안 누른 '임시작성' 건은 숨김
        query = query.neq('status', '임시작성');

        // 필터 적용
        if (currentOrderStatus === '접수됨') query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
        else if (currentOrderStatus === '칼선작업') query = query.eq('status', '칼선작업');
        else if (currentOrderStatus === '완료됨') query = query.in('status', ['완료됨', '발송완료', '완료', '구매확정']);

        if (deliveryDateFilter) query = query.eq('delivery_target_date', deliveryDateFilter);
        if (orderDateFilter) query = query.gte('created_at', orderDateFilter + 'T00:00:00').lte('created_at', orderDateFilter + 'T23:59:59');
        if (searchKeyword) query = query.or(`manager_name.ilike.%${searchKeyword}%,phone.ilike.%${searchKeyword}%`);
        if (siteFilter !== 'all') query = query.eq('site_code', siteFilter);

        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) throw error;

        // 페이징 UI
        const pageLabel = document.getElementById('pageLabel');
        if(pageLabel) pageLabel.innerText = `Page ${currentPage} / ${Math.ceil((count||0)/itemsPerPage) || 1}`;
        const sumCount = document.getElementById('sumCount');
        if(sumCount) sumCount.innerText = (count || 0) + '건';

        tbody.innerHTML = '';
        if (!data || data.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:30px;">주문이 없습니다.</td></tr>'; 
            showLoading(false); return; 
        }

        data.forEach(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
            const total = order.total_amount || 0;
            const site = order.site_code || 'KR';
            
            // [스태프 선택] 배경색 꽉 차게 변경된 함수 사용
            const managerOpts = createStaffSelectHTML(order.id, 'manager', order.staff_manager_id);
            const driverOpts = createStaffSelectHTML(order.id, 'driver', order.staff_driver_id);

            // 날짜 (월.일 + 배송일)
            const d = new Date(order.created_at);
            const orderDate = `${d.getMonth() + 1}.${d.getDate()}.`;
            let deliveryHtml = '';
            if (order.delivery_target_date) {
                const dd = new Date(order.delivery_target_date);
                const delDate = `${dd.getMonth() + 1}.${dd.getDate()}`;
                deliveryHtml = `<div style="font-size:11px; color:#e11d48; font-weight:bold; margin-top:2px; letter-spacing:-0.5px;">(배)${delDate}</div>`;
            }

            // [입찰 표시] (팝업 버튼 연동)
            let bidHtml = '';
            const bidCount = (order.bids && Array.isArray(order.bids)) ? order.bids.length : 0;

            if (order.head_office_check === true) {
                bidHtml = `<div style="margin-bottom:2px;"><span class="badge" style="background:#333; color:#fff; font-size:11px;">⛔ 본사직권</span></div>`;
            } else {
                // 입찰 건수가 있으면 클릭 가능한 버튼으로 표시
                const btnClass = bidCount > 0 ? 'btn-primary' : 'btn-outline';
                const btnText = bidCount > 0 ? `${bidCount}건` : '0';
                const subText = bidCount > 0 ? '입찰확인' : '본사처리';
                const action = bidCount > 0 ? `openBidAdminModal('${order.id}')` : `setHeadOfficeOnly('${order.id}')`;

                bidHtml = `
                    <button class="btn ${btnClass} btn-sm" onclick="${action}" style="width:100%; padding:2px 0; font-size:11px;">
                        ${btnText}
                    </button>
                    <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${subText}</div>
                `;
            }

            // [상태 & 결제정보] (카드/무통장 디테일 표시)
            let statusHtml = `<span class="badge">${order.status}</span>`;
            const isCard = (order.payment_method && (order.payment_method.includes('카드') || order.payment_method.includes('card')));
            const isBank = (order.payment_method && (order.payment_method.includes('무통장') || order.payment_method.includes('bank')));
            const depositor = order.depositor_name || order.depositor || '입금자 미정';

            if (order.status === '완료됨' || order.status === '발송완료') {
                statusHtml = `<span class="badge" style="background:#dcfce7; color:#15803d;">완료됨</span>`;
            } else {
                if (isCard) {
                    statusHtml += `<div style="font-size:11px; color:#2563eb; font-weight:bold; margin-top:4px;">💳 카드결제</div>`;
                    if(order.payment_status === '결제완료') statusHtml += `<div style="font-size:10px; color:#15803d;">(승인완료)</div>`;
                } 
                else if (isBank) {
                    statusHtml += `<div style="font-size:11px; color:#d97706; font-weight:bold; margin-top:4px;">🏦 무통장</div>`;
                    statusHtml += `<div style="font-size:11px; color:#334155;">${depositor}</div>`;
                    
                    if (order.payment_status !== '입금확인' && order.payment_status !== '결제완료') {
                        statusHtml += `<button class="btn btn-success btn-sm" style="width:100%; margin-top:3px; font-size:11px; padding:2px;" onclick="confirmDeposit('${order.id}')">입금확인</button>`;
                    } else {
                        statusHtml += `<div style="font-size:10px; color:#15803d; font-weight:bold;">(확인됨)</div>`;
                    }
                }
            }

            // [파일 버튼] (너비 50px에 맞게 축소)
            const fCount = order.files?.length || 0;
            const fileBtn = `<button class="btn btn-outline" style="width:100%; padding:2px 0; font-size:12px; height:24px;" onclick="openFileModal('${order.id}')" title="파일목록">📂 ${fCount}</button>`;
            const addBtn = `<label class="btn btn-sky" style="width:100%; padding:2px 0; font-size:12px; height:24px; margin-top:2px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" title="파일추가"><i class="fa-solid fa-plus"></i><input type="file" style="display:none;" onchange="uploadFileDirect('${order.id}', this)"></label>`;

            // [렌더링]
            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center;"><input type="checkbox" class="row-chk" value="${order.id}"></td>
                    <td style="text-align:center;"><span class="badge-site ${site.toLowerCase()}">${site}</span></td>
                    <td style="text-align:center; line-height:1.2;">
                        <span style="color:#334155;">${orderDate}</span>
                        ${deliveryHtml}
                    </td>
                    <td><b>${order.manager_name}</b><br><span style="font-size:11px; color:#666;">${order.phone}</span></td>
                    <td style="font-size:11px;">${items.map(i => `<div>- ${i.productName || '상품'} (${i.qty})</div>`).join('')}</td>
                    
                    <td style="text-align:center;">${bidHtml}</td> <td style="text-align:right;">${total.toLocaleString()}</td>
                    <td style="text-align:right; color:#ef4444;">${(order.discount_amount || 0).toLocaleString()}</td>
                    <td style="text-align:right; color:#d97706;">${(order.used_deposit || 0).toLocaleString()}</td>
                    <td style="text-align:right; font-weight:bold; color:#15803d;">${(order.actual_payment || total).toLocaleString()}</td>
                    <td>${managerOpts} <div style="margin-top:2px;">${driverOpts}</div></td>
                    
                    <td style="padding:2px 4px;">${fileBtn}${addBtn}</td>
                    
                    <td style="text-align:center; line-height:1.2;">${statusHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:red;">${e.message}</td></tr>`;
    } finally {
        showLoading(false);
    }
};
function createStaffSelectHTML(orderId, role, selectedId) {
    let opts = `<option value="">미지정</option>`;
    
    // 기본 스타일 (미지정 상태)
    let style = `background-color: #ffffff; color: #334155; border: 1px solid #e2e8f0;`;

    const filteredStaff = staffList.filter(s => s.role === role);
    
    filteredStaff.forEach(s => {
        const isSelected = String(s.id) === String(selectedId);
        if (isSelected && s.color) {
            // 선택된 스태프가 있으면 배경색을 스태프 색상으로, 글자는 흰색으로 변경
            style = `background-color: ${s.color}; color: #ffffff; border: 1px solid ${s.color}; font-weight:bold;`;
        }
        opts += `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
    });

    // this를 넘겨서 요소 자체를 제어함
    return `<select class="staff-select" style="${style}" onchange="updateOrderStaff('${orderId}', '${role}', this)">
                ${opts}
            </select>`;
}
window.filterOrders = (status, btn) => {
    currentOrderStatus = status;
    document.querySelectorAll('#sec-orders .btn-primary').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline'); });
    if(btn) { btn.classList.remove('btn-outline'); btn.classList.add('btn-primary'); }
    currentPage = 1;
    loadOrders();
};

window.resetPage = () => { currentPage = 1; };
window.changePage = (step) => { if(currentPage + step > 0) { currentPage += step; loadOrders(); } };

window.updateActionButtons = () => {
    const div = document.getElementById('action-buttons');
    if(!div) return;
    if(currentOrderStatus === '접수됨') div.innerHTML = `<button class="btn btn-primary" onclick="changeStatusSelected('칼선작업')">작업시작</button><button class="btn btn-danger" onclick="deleteOrdersSelected(false)">삭제</button>`;
    else if(currentOrderStatus === '칼선작업') div.innerHTML = `<button class="btn btn-success" onclick="downloadBulkFiles()">다운로드</button><button class="btn btn-vip" onclick="changeStatusSelected('완료됨')">완료처리</button>`;
    else div.innerHTML = `<button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
};

window.changeStatusSelected = async (status) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) return alert("선택된 주문이 없습니다.");
    await sb.from('orders').update({ status }).in('id', ids);
    loadOrders();
};

window.deleteOrdersSelected = async (force) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) return alert("선택된 주문이 없습니다.");
    if(!confirm("삭제하시겠습니까?")) return;
    await sb.from('orders').delete().in('id', ids);
    loadOrders();
};

// [파일 관리]
window.openFileModal = async (id) => {
    currentMgrOrderId = id;
    const { data } = await sb.from('orders').select('files').eq('id', id).single();
    currentMgrFiles = data?.files || [];
    renderFileList();
    document.getElementById('fileManagerModal').style.display = 'flex';
};
window.closeFileModal = () => document.getElementById('fileManagerModal').style.display = 'none';

function renderFileList() {
    const list = document.getElementById('fileMgrList');
    list.innerHTML = currentMgrFiles.map((f, i) => `
        <div class="file-item-row">
            <a href="${f.url}" target="_blank">${f.name}</a>
            <button class="btn btn-danger btn-sm" onclick="deleteFileFromOrder(${i})">삭제</button>
        </div>`).join('') || '<div style="padding:10px; text-align:center;">파일 없음</div>';
}

window.uploadFileToOrder = async () => {
    const input = document.getElementById('fileMgrInput');
    if(!input.files[0]) return;
    const file = input.files[0];
    const path = `orders/${currentMgrOrderId}/${Date.now()}_${file.name}`;
    await sb.storage.from('orders').upload(path, file);
    const { data } = sb.storage.from('orders').getPublicUrl(path);
    currentMgrFiles.push({ name: file.name, url: data.publicUrl, type: 'admin_added' });
    await sb.from('orders').update({ files: currentMgrFiles }).eq('id', currentMgrOrderId);
    renderFileList();
    input.value = '';
};

window.deleteFileFromOrder = async (idx) => {
    if(!confirm('삭제하시겠습니까?')) return;
    currentMgrFiles.splice(idx, 1);
    await sb.from('orders').update({ files: currentMgrFiles }).eq('id', currentMgrOrderId);
    renderFileList();
};

window.uploadFileDirect = async (orderId, input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    const { data: order } = await sb.from('orders').select('files').eq('id', orderId).single();
    const files = order.files || [];
    
    const path = `orders/${orderId}/${Date.now()}_${file.name}`;
    await sb.storage.from('orders').upload(path, file);
    const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
    
    files.push({ name: file.name, url: urlData.publicUrl, type: 'admin_added' });
    await sb.from('orders').update({ files }).eq('id', orderId);
    alert('업로드 완료');
    loadOrders();
};

// [뱅크다]
window.loadBankdaList = async () => {
    const start = document.getElementById('bankStartDate').value || new Date().toISOString().split('T')[0];
    const end = document.getElementById('bankEndDate').value || new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('bankListBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">로딩 중...</td></tr>';

    const { data: txs } = await sb.from('bank_transactions')
        .select('*')
        .gte('transaction_date', start + 'T00:00:00')
        .lte('transaction_date', end + 'T23:59:59')
        .order('transaction_date', { ascending: false });

    tbody.innerHTML = '';
    if(!txs || txs.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">내역 없음</td></tr>'; return; }

    txs.forEach(tx => {
        let status = tx.match_status === 'matched' ? '<span style="color:blue">매칭됨</span>' : '미매칭';
        let btn = tx.match_status !== 'matched' ? `<button class="btn btn-sm btn-outline" onclick="matchOrderManual('${tx.id}', '${tx.depositor}')">연결</button>` : '-';
        tbody.innerHTML += `<tr><td>${tx.transaction_date}</td><td>${tx.depositor}</td><td>${tx.amount.toLocaleString()}</td><td>${tx.bank_name}</td><td>${status}</td><td>${btn}</td></tr>`;
    });
};

window.runBankdaScraping = async () => {
    if(!confirm("최신 내역을 가져오시겠습니까?")) return;
    showLoading(true);
    try {
        const { data, error } = await sb.functions.invoke('bank-scraper', { method: 'POST' });
        if(error) throw error;
        alert(`완료: ${data.message}`);
        loadBankdaList();
    } catch(e) { alert("실패: " + e.message); }
    finally { showLoading(false); }
};

window.matchOrderManual = async (txId, name) => {
    const orderId = prompt(`[${name}] 입금건과 연결할 주문번호를 입력하세요.`);
    if(!orderId) return;
    await sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', orderId);
    await sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: orderId }).eq('id', txId);
    alert("연결되었습니다.");
    loadBankdaList();
};

// [배송 스케줄]
window.loadDailyTasks = async () => {
    const date = document.getElementById('taskDate').value || new Date().toISOString().split('T')[0];
    const driverId = document.getElementById('filterTaskDriver').value;
    let query = sb.from('orders').select('*').eq('delivery_target_date', date);
    if(driverId !== 'all') query = query.eq('staff_driver_id', driverId);
    
    const { data } = await query;
    const tbody = document.getElementById('taskListBody');
    tbody.innerHTML = '';
    
    if(!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">일정 없음</td></tr>'; return; }
    
    data.forEach(o => {
        tbody.innerHTML += `<tr><td>${o.status}</td><td>${o.manager_name}</td><td>파일(${o.files?.length})</td><td>${o.staff_driver_id || '미배정'}</td><td>${o.delivery_time || '-'}</td></tr>`;
    });
};

window.updateOrderStaff = async (id, role, selectEl) => {
    const val = selectEl.value;
    const field = role === 'manager' ? 'staff_manager_id' : 'staff_driver_id';
    
    // 1. DB 업데이트 (비동기 처리하되 UI는 먼저 반응)
    sb.from('orders').update({ [field]: val || null }).eq('id', id).then(({ error }) => {
        if(error) alert("담당자 변경 실패: " + error.message);
    });

    // 2. 선택된 스태프 정보 찾기
    const staff = staffList.find(s => String(s.id) === String(val));
    
    // 3. UI 전체 색상 즉시 적용
    if (staff && staff.color) {
        selectEl.style.backgroundColor = staff.color;
        selectEl.style.color = '#ffffff'; // 배경이 진할 것으로 가정하고 글자는 흰색
        selectEl.style.borderColor = staff.color;
        selectEl.style.fontWeight = 'bold';
    } else {
        // 미지정 선택 시 기본 흰색 배경으로 복구
        selectEl.style.backgroundColor = '#ffffff';
        selectEl.style.color = '#334155';
        selectEl.style.borderColor = '#e2e8f0';
        selectEl.style.fontWeight = 'normal';
    }
};

window.confirmDeposit = async (id) => {
    if(confirm('입금확인 처리하시겠습니까?')) {
        await sb.from('orders').update({ payment_status: '입금확인' }).eq('id', id);
        loadOrders();
    }
};

window.downloadMonthlyExcel = () => alert("엑셀 다운로드 기능은 사용자 관리(users.js)에서 구현됨");
// [추가] 입찰 본사 직권 처리 (파트너 입찰 막기)
window.setHeadOfficeOnly = async (orderId) => {
    if(!confirm("본사 직권 처리하시겠습니까?\n(파트너사는 더 이상 입찰할 수 없습니다.)")) return;
    
    // DB에 head_office_check 컬럼을 true로 업데이트 (DB에 해당 컬럼이 있어야 함)
    const { error } = await sb.from('orders').update({ head_office_check: true }).eq('id', orderId);
    
    if(error) {
        alert("처리 실패: " + error.message);
    } else {
        alert("본사 처리로 설정되었습니다.");
        loadOrders();
    }
};
// [신규] 입찰 내역 관리 팝업 열기
window.openBidAdminModal = async (orderId) => {
    const modal = document.getElementById('bidAdminModal');
    const tbody = document.getElementById('bidAdminListBody');
    
    // 1. 모달 초기화 및 열기
    modal.style.display = 'flex';
    document.getElementById('bidModalOrderId').innerText = orderId;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;"><div class="spinner"></div> 데이터 조회 중...</td></tr>';

    try {
        // 2. 주문 정보 가져오기 (고객명, 현재상태)
        const { data: order } = await sb.from('orders').select('manager_name, status').eq('id', orderId).single();
        if(order) {
            document.getElementById('bidModalCustomer').innerText = order.manager_name || '비회원';
            document.getElementById('bidModalStatus').innerText = order.status;
        }

        // 3. 입찰 내역 조회
        const { data: bids, error } = await sb.from('bids')
            .select('*')
            .eq('order_id', orderId)
            .order('price', { ascending: true }); // 저렴한 순 정렬

        if (error) throw error;

        if (!bids || bids.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#999;">등록된 입찰이 없습니다.</td></tr>';
            return;
        }

        // 4. 파트너 정보(업체명) 조회를 위해 ID 수집
        const partnerIds = bids.map(b => b.partner_id);
        const { data: profiles } = await sb.from('profiles').select('id, company_name, email').in('id', partnerIds);
        
        const profileMap = {};
        if (profiles) profiles.forEach(p => profileMap[p.id] = p);

        // 5. 리스트 렌더링
        tbody.innerHTML = '';
        bids.forEach(bid => {
            const partner = profileMap[bid.partner_id] || {};
            const company = partner.company_name || '이름없음';
            const email = partner.email || '-';
            
            // 상태 뱃지
            let statusBadge = '<span class="badge" style="background:#f1f5f9; color:#64748b;">대기중</span>';
            let rowStyle = '';
            
            if (bid.status === 'selected') {
                statusBadge = '<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:bold;">✅ 매칭됨 (낙찰)</span>';
                rowStyle = 'background:#f0fdf4;'; // 선택된 행 강조
            } else if (bid.status === 'rejected') {
                statusBadge = '<span class="badge" style="background:#fee2e2; color:#ef4444;">탈락</span>';
            }

            tbody.innerHTML += `
                <tr style="border-bottom:1px solid #f1f5f9; ${rowStyle}">
                    <td style="padding:10px;">
                        <div style="font-weight:bold; color:#334155;">${company}</div>
                        <div style="font-size:11px; color:#94a3b8;">${email}</div>
                    </td>
                    <td style="padding:10px; text-align:right; font-weight:bold; color:#6366f1;">
                        ${bid.price.toLocaleString()}원
                    </td>
                    <td style="padding:10px; color:#475569; max-width:200px;">
                        ${bid.message || '-'}
                    </td>
                    <td style="padding:10px; text-align:center;">
                        ${bid.partner_phone || '-'}
                    </td>
                    <td style="padding:10px; text-align:center;">
                        ${statusBadge}
                    </td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">오류 발생: ${e.message}</td></tr>`;
    }
};