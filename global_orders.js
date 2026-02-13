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

            // 통화 변환 헬퍼 (DB는 KRW 기준 저장)
            const currRates = { KR: 1, JP: 0.2, US: 0.002 };
            const currSymbols = { KR: '', JP: '¥', US: '$' };
            const rate = currRates[site] || 1;
            const sym = currSymbols[site] || '';
            const fmtAmt = (krw) => {
                const v = Math.round(krw * rate);
                return site === 'KR' ? v.toLocaleString() : `${sym}${v.toLocaleString()}`;
            };
            
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
            // [상태 & 결제정보] (카드/무통장 디테일 표시)
            let statusHtml = '';

            // 1. 상태 뱃지 표시 (완료됨일 때만 녹색, 나머지는 기본)
            if (order.status === '완료됨' || order.status === '발송완료') {
                statusHtml = `<div style="margin-bottom:4px;"><span class="badge" style="background:#dcfce7; color:#15803d;">${order.status}</span></div>`;
            } else {
                statusHtml = `<div style="margin-bottom:4px;"><span class="badge">${order.status}</span></div>`;
            }

            const pmLower = (order.payment_method || '').toLowerCase();
            const isCard = pmLower.includes('카드') || pmLower.includes('card') || pmLower.includes('stripe') || pmLower.includes('간편결제');
            const isBank = pmLower.includes('무통장') || pmLower.includes('bank');
            const isDeposit = pmLower.includes('예치금');
            const depositor = order.depositor_name || order.depositor || '입금자 미정';

            // 2. 결제 정보 표시 (상태와 무관하게 무조건 표시)
            if (isCard) {
                const cardLabel = pmLower.includes('stripe') ? '💳 Stripe' : '💳 카드결제';
                statusHtml += `<div style="font-size:11px; color:#2563eb; font-weight:bold;">${cardLabel}</div>`;
                if(order.payment_status === '결제완료') {
                    statusHtml += `<div style="font-size:10px; color:#15803d;">(승인완료)</div>`;
                } else {
                    statusHtml += `<div style="font-size:10px; color:#ef4444;">(미결제)</div>`;
                }
            }
            else if (isDeposit) {
                statusHtml += `<div style="font-size:11px; color:#7c3aed; font-weight:bold;">💰 예치금</div>`;
                if(order.payment_status === '결제완료') {
                    statusHtml += `<div style="font-size:10px; color:#15803d;">(승인완료)</div>`;
                }
            }
            else if (isBank) {
                statusHtml += `<div style="font-size:11px; color:#d97706; font-weight:bold;">🏦 무통장</div>`;
                statusHtml += `<div style="font-size:11px; color:#334155;">${depositor}</div>`;
                
                // [핵심] 입금확인이 안 되었다면 '입금확인' 버튼을 계속 보여줌 (완료된 주문이라도 후불 처리를 위해)
                if (order.payment_status !== '입금확인' && order.payment_status !== '결제완료') {
                    statusHtml += `<button class="btn btn-success btn-sm" style="width:100%; margin-top:3px; font-size:11px; padding:2px;" onclick="confirmDeposit('${order.id}')">입금확인</button>`;
                } else {
                    statusHtml += `<div style="font-size:10px; color:#15803d; font-weight:bold;">(확인됨)</div>`;
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
                    <td style="text-align:center;"><span class="badge-site ${site.toLowerCase()}" style="cursor:pointer;" onclick="fixSiteCode('${order.id}')" title="클릭하여 변경">${site}</span>${(pmLower.includes('stripe') && site === 'KR') ? '<div style="font-size:9px;color:#ef4444;">⚠️오류?</div>' : ''}</td>
                    <td style="text-align:center; line-height:1.2;">
                        <span style="color:#334155;">${orderDate}</span>
                        ${deliveryHtml}
                    </td>
                    <td><b>${order.manager_name}</b><br><span style="font-size:11px; color:#666;">${order.phone}</span></td>
                    
                    <td style="text-align:center; font-size:12px; color:#64748b; font-weight:bold;">${order.id}</td>
                    
                    <td style="font-size:11px;">${items.map(i => `<div>- ${i.productName || '상품'} (${i.qty})</div>`).join('')}</td>
                    
                    <td style="text-align:center;">${bidHtml}</td> <td style="text-align:right;">${fmtAmt(total)}</td>
                    <td style="text-align:right; color:#ef4444;">${fmtAmt(order.discount_amount || 0)}</td>
                    <td style="text-align:right; color:#d97706;">${fmtAmt(order.used_deposit || 0)}</td>
                    <td style="text-align:right; font-weight:bold; color:#15803d;">${fmtAmt(order.actual_payment || total)}</td>
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
// [사이트 코드 수정] 관리자가 site_code를 직접 변경
window.fixSiteCode = async (orderId) => {
    const newCode = prompt('사이트 코드 변경 (KR / JP / US):', '');
    if (!newCode) return;
    const code = newCode.trim().toUpperCase();
    if (!['KR', 'JP', 'US'].includes(code)) return alert('KR, JP, US 중 선택');
    const { error } = await sb.from('orders').update({ site_code: code }).eq('id', orderId);
    if (error) return alert('변경 실패: ' + error.message);
    alert(`주문 #${orderId} → ${code} 변경 완료`);
    loadOrders();
};

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

window.loadBankdaList = async () => {
    const startInput = document.getElementById('bankStartDate');
    const endInput = document.getElementById('bankEndDate');
    
    // 1. 날짜가 비어있으면 '이번 달 1일 ~ 오늘'로 자동 설정
    if (!startInput.value || !endInput.value) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const todayStr = krNow.toISOString().split('T')[0];
        const year = krNow.getFullYear();
        const month = String(krNow.getMonth() + 1).padStart(2, '0');
        const firstDayStr = `${year}-${month}-01`;
        startInput.value = firstDayStr;
        endInput.value = todayStr;
    }

    const start = startInput.value;
    const end = endInput.value;
    const tbody = document.getElementById('bankListBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';

    try {
        // [수정] select('*') 로 변경하여 컬럼 오류 방지
        const { data: txs, error } = await sb.from('bank_transactions')
            .select('*')
            .gte('transaction_date', start + 'T00:00:00')
            .lte('transaction_date', end + 'T23:59:59')
            .order('transaction_date', { ascending: false });

        if (error) throw error;

        // 2. 미결제 주문 목록 조회
        const { data: orders } = await sb.from('orders')
            .select('*') // [수정] 전체 컬럼 가져오기
            .gte('created_at', start + 'T00:00:00')
            .neq('payment_status', '결제완료')
            .neq('payment_status', '입금확인');

        tbody.innerHTML = '';
        if (!txs || txs.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">기간 내 입금 내역이 없습니다.</td></tr>'; 
            return; 
        }

        let autoMatchList = [];

        txs.forEach(tx => {
            // [디버깅] 콘솔창(F12)을 확인해보세요. 실제 데이터에 이름이 어디 들어있는지 확인용입니다.
            console.log("Bank TX:", tx); 

            // [수정] 가능한 모든 이름 필드를 다 검사
            const displayName = tx.bk_jukyo || tx.input_name || tx.depositor || tx.sender || tx.content || tx.description || '이름미상';

            const matchOrder = orders ? orders.find(o => {
                const orderName = (o.manager_name || '').replace(/\s/g, ''); 
                const bankName = String(displayName).replace(/\s/g, '');
                return orderName === bankName && Math.abs((o.total_amount || 0) - tx.amount) < 100;
            }) : null;

            let statusBadge = '<span class="badge" style="background:#f1f5f9; color:#94a3b8;">미매칭</span>';
            let actionBtn = `<button class="btn btn-sm btn-outline" onclick="matchOrderManual('${tx.id}', '${displayName}')">수동 연결</button>`;

            if (tx.match_status === 'matched') {
                statusBadge = `<span class="badge" style="background:#e0e7ff; color:#3730a3;">연결됨</span>`;
                actionBtn = `<span style="font-size:11px; color:#aaa;">완료</span>`;
            } 
            else if (matchOrder) {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:bold;">✅ 매칭가능</span>`;
                actionBtn = `<button class="btn btn-success btn-sm" onclick="matchOrderManual('${tx.id}', '${displayName}', '${matchOrder.id}')">연결 (${matchOrder.manager_name})</button>`;
                autoMatchList.push({ txId: tx.id, orderId: matchOrder.id });
            }

            tbody.innerHTML += `
                <tr>
                    <td>${new Date(tx.transaction_date).toLocaleString()}</td>
                    <td style="font-weight:bold; color:#0f172a;">${displayName}</td>
                    <td style="text-align:right; font-weight:bold;">${tx.amount.toLocaleString()}원</td>
                    <td>${tx.bank_name || '-'}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">${actionBtn}</td>
                </tr>`;
        });

        const existingBtn = document.getElementById('btnAutoMatch');
        if(existingBtn) existingBtn.remove();
        
        if(autoMatchList.length > 0) {
            const table = document.querySelector('#sec-bankda table');
            const btnHtml = `
                <div id="btnAutoMatch" style="margin-bottom:10px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#166534; font-weight:bold;">✨ ${autoMatchList.length}건 자동 매칭됨</span>
                    <button class="btn btn-success" onclick='executeAutoMatching(${JSON.stringify(autoMatchList)})'>🚀 일괄 연결하기</button>
                </div>`;
            table.insertAdjacentHTML('beforebegin', btnHtml);
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};
// [일괄 자동매칭 실행]
window.executeAutoMatching = async (list) => {
    if(!confirm(`${list.length}건을 일괄 연결하시겠습니까?`)) return;
    showLoading(true);
    try {
        const updates = list.map(item => {
            const p1 = sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', item.orderId);
            const p2 = sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: item.orderId }).eq('id', item.txId);
            return Promise.all([p1, p2]);
        });
        await Promise.all(updates);
        alert("완료되었습니다.");
        loadBankdaList();
    } catch(e) { alert("오류: " + e.message); } finally { showLoading(false); }
};

window.runBankdaScraping = async () => {
    if(!confirm("최신 내역을 가져오시겠습니까?")) return;
    showLoading(true);
    try {
        const { data, error } = await sb.functions.invoke('bank-scraper', { method: 'POST' });
        if(error) throw error;
        alert(`업데이트 완료: ${data.message || '성공'}`);
        loadBankdaList();
    } catch(e) { alert("실패: " + e.message); } finally { showLoading(false); }
};

window.matchOrderManual = async (txId, name, suggestedId = '') => {
    const orderId = prompt(`[${name}] 입금건과 연결할 주문번호를 입력하세요.`, suggestedId);
    if(!orderId) return;
    try {
        await sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', orderId);
        await sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: orderId }).eq('id', txId);
        alert("연결되었습니다.");
        loadBankdaList();
    } catch(e) { alert("오류: " + e.message); }
};

// [배송 스케줄 및 기사 배정]
window.loadDailyTasks = async () => {
    // 1. 날짜가 없으면 오늘 날짜로 강제 설정 (한국 시간 기준)
    const dateInput = document.getElementById('taskDate');
    if (!dateInput.value) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        dateInput.value = krNow.toISOString().split('T')[0];
    }
    const targetDate = dateInput.value;
    const driverFilterId = document.getElementById('filterTaskDriver').value;

    showLoading(true);
    const tbody = document.getElementById('taskListBody');
    tbody.innerHTML = '';

    try {
        // 2. 스태프 목록이 로드되지 않았다면 가져오기
        if (staffList.length === 0) {
            const { data } = await sb.from('admin_staff').select('*');
            staffList = data || [];
        }

        // 3. 필터 드롭다운에 기사님 목록 채우기 (옵션이 '전체' 하나뿐일 때)
        const filterSelect = document.getElementById('filterTaskDriver');
        if (filterSelect && filterSelect.options.length === 1) {
            staffList.filter(s => s.role === 'driver').forEach(s => {
                filterSelect.innerHTML += `<option value="${s.id}">${s.name} 기사님</option>`;
            });
        }

        // 4. 해당 날짜의 배송 건 조회
        let query = sb.from('orders').select('*').eq('delivery_target_date', targetDate);
        if (driverFilterId !== 'all') {
            query = query.eq('staff_driver_id', driverFilterId);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#999;">${targetDate} 배송 일정이 없습니다.</td></tr>`;
            showLoading(false);
            return;
        }

        // 5. 정렬 (기사님 이름순 -> 배송 시간순)
        orders.sort((a, b) => {
            const driverA = staffList.find(s => s.id == a.staff_driver_id)?.name || 'zzz'; // 미배정은 뒤로
            const driverB = staffList.find(s => s.id == b.staff_driver_id)?.name || 'zzz';
            if (driverA !== driverB) return driverA.localeCompare(driverB);
            
            const timeA = a.delivery_time || "99:99";
            const timeB = b.delivery_time || "99:99";
            return timeA.localeCompare(timeB);
        });

        // 6. 테이블 렌더링
        orders.forEach(o => {
            const isDone = (o.status === '배송완료' || o.status === '완료됨');
            const dotColor = isDone ? '#22c55e' : '#cbd5e1';
            const statusBadge = isDone 
                ? `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;">배송완료</span>` 
                : `<span class="badge" style="background:#f1f5f9; color:#64748b;">${o.status}</span>`;
            const rowStyle = isDone ? 'background-color: #f0fdf4;' : '';
            const textStyle = isDone ? 'opacity: 0.6;' : '';

            // 파일 링크 생성
            let fileLinks = '';
            if (o.files && Array.isArray(o.files)) {
                o.files.forEach(f => {
                    fileLinks += `<a href="${f.url}" target="_blank" class="badge" style="text-decoration:none; background:#fff; border:1px solid #ddd; color:#334155; margin-right:4px;">📄 ${f.name}</a>`;
                });
            } else {
                fileLinks = '<span style="font-size:11px; color:#ccc;">파일 없음</span>';
            }

            // 기사 선택 옵션
            let driverOpts = `<option value="">미지정 (택배/퀵)</option>`;
            staffList.filter(s => s.role === 'driver').forEach(s => {
                const selected = o.staff_driver_id == s.id ? 'selected' : '';
                driverOpts += `<option value="${s.id}" ${selected}>${s.name}</option>`;
            });

            // 시간 선택 옵션
            const timeOpts = getDeliveryTimeOptions(o.delivery_time);

            tbody.innerHTML += `
                <tr style="${rowStyle}">
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="${textStyle}">
                        <div style="font-weight:bold; font-size:14px;">${o.manager_name}</div>
                        <div style="font-size:12px; color:#6366f1;">${o.phone}</div>
                        <div style="font-size:12px; color:#666; margin-top:2px;">${o.address || '주소 미입력'}</div>
                    </td>
                    <td style="${textStyle}">
                        <div style="display:flex; flex-wrap:wrap; gap:2px;">${fileLinks}</div>
                    </td>
                    <td>
                        <select class="input-text" onchange="updateTaskDB('${o.id}', 'staff_driver_id', this.value)" style="width:100%; ${isDone ? 'background:transparent; border:none; font-weight:bold;' : ''}" ${isDone?'disabled':''}>
                            ${driverOpts}
                        </select>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <select class="input-text" onchange="updateTaskDB('${o.id}', 'delivery_time', this.value)" style="flex:1; ${isDone ? 'background:transparent; border:none; font-weight:bold;' : ''}" ${isDone?'disabled':''}>
                                ${timeOpts}
                            </select>
                            <button class="btn btn-sm ${isDone ? 'btn-outline' : 'btn-success'}" onclick="updateTaskDB('${o.id}', 'status', '${isDone ? '제작준비' : '배송완료'}')" title="완료/취소 토글">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    } finally {
        showLoading(false);
    }
};

// [헬퍼] 배송 데이터 업데이트 (기사 배정, 시간, 완료체크)
window.updateTaskDB = async (orderId, field, value) => {
    const valToSave = value === "" ? null : value;
    
    // 상태 변경일 경우 UI 즉시 반응을 위해 리로드
    const shouldReload = (field === 'status');
    
    try {
        const { error } = await sb.from('orders').update({ [field]: valToSave }).eq('id', orderId);
        if (error) throw error;
        
        if (shouldReload) loadDailyTasks(); // 완료 체크 시 새로고침
    } catch (e) {
        alert("업데이트 실패: " + e.message);
    }
};

// [헬퍼] 시간 옵션 생성기
function getDeliveryTimeOptions(selectedTime) {
    let html = '<option value="">시간 미정</option>';
    for (let i = 9; i <= 20; i++) { // 9시부터 20시까지
        const timeStr = (i < 10 ? '0' + i : i) + ":00";
        const isSelected = selectedTime === timeStr ? 'selected' : '';
        html += `<option value="${timeStr}" ${isSelected}>${timeStr}</option>`;
    }
    return html;
}

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

// [수정됨] 월별 매출 정산 엑셀 다운로드 (결제일, 담당매니저 추가)
window.downloadMonthlyExcel = async () => {
    // 1. HTML에 있는 월 선택 박스(id="excelMonth") 값 가져오기
    const monthInput = document.getElementById('excelMonth');
    const siteFilter = document.getElementById('filterSite') ? document.getElementById('filterSite').value : 'all';

    // 월 선택이 안 되어있으면 오늘 날짜 기준으로 설정
    let targetYear, targetMonth;
    
    if (monthInput && monthInput.value) {
        [targetYear, targetMonth] = monthInput.value.split('-');
    } else {
        const now = new Date();
        targetYear = now.getFullYear();
        targetMonth = String(now.getMonth() + 1).padStart(2, '0');
    }

    // 2. 해당 월의 시작일(1일)과 마지막 날 계산
    const startDate = `${targetYear}-${targetMonth}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate(); 
    const endDate = `${targetYear}-${targetMonth}-${lastDay}`;

    if(!confirm(`${targetYear}년 ${targetMonth}월 (${startDate} ~ ${endDate})\n전체 주문 데이터를 다운로드하시겠습니까?`)) return;
    showLoading(true);

    try {
        // [중요] 매니저 이름을 찾기 위해 스태프 목록이 비어있다면 먼저 로드
        if (staffList.length === 0) {
            const { data: sData } = await sb.from('admin_staff').select('*');
            staffList = sData || [];
        }

        // 3. 쿼리 구성
        let query = sb.from('orders')
            .select('*')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .order('created_at', { ascending: false });

        query = query.neq('status', '임시작성');

        if (siteFilter !== 'all') {
            query = query.eq('site_code', siteFilter);
        }

        const { data, error } = await query;
        if(error) throw error;

        if(!data || data.length === 0) {
            alert("해당 기간에 조회된 주문 내역이 없습니다.");
            showLoading(false);
            return;
        }

        // 4. 엑셀 데이터 매핑
        const excelData = data.map(o => {
            // 상품 목록 텍스트 변환
            let itemText = '';
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
                itemText = items.map(i => `${i.productName || '상품'}(${i.qty})`).join(', ');
            } catch(e) {}

            // [추가] 담당 매니저 이름 찾기
            const managerObj = staffList.find(s => s.id == o.staff_manager_id);
            const managerName = managerObj ? managerObj.name : '미지정';

            // [추가] 결제일 포맷팅 (payment_date 컬럼이 없으면 payment_updated_at 등을 사용하거나, 없으면 - 처리)
            // DB에 payment_date 컬럼이 있다면 그것을 쓰고, 없다면 상태 변경일을 쓰거나 빈칸 처리
            let payDate = '-';
            if (o.payment_date) {
                payDate = new Date(o.payment_date).toLocaleDateString();
            } else if (o.payment_status === '결제완료' || o.payment_status === '입금확인') {
                // 결제일 컬럼이 따로 없고 결제가 완료된 상태라면, 수정일(updated_at)을 임시로 사용하거나 빈칸
                // 여기서는 데이터가 있으면 표시하고 없으면 - 로 둡니다.
                payDate = o.updated_at ? new Date(o.updated_at).toLocaleDateString() : '-'; 
            }

            return {
                "주문번호": o.id,
                "사이트": o.site_code || 'KR',
                "주문일자": new Date(o.created_at).toLocaleDateString(),
                "결제일": payDate,           // [NEW] 결제일
                "담당매니저": managerName,   // [NEW] 담당 매니저
                "고객명": o.manager_name,
                "연락처": o.phone,
                "주문내역": itemText,
                "총금액": o.total_amount || 0,
                "할인액": o.discount_amount || 0,
                "실결제액": o.actual_payment || o.total_amount || 0,
                "결제상태": o.payment_status || '-',
                "현재상태": o.status,
                "배송요청일": o.delivery_target_date || '-'
            };
        });

        // 5. 엑셀 파일 생성 (SheetJS)
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // 컬럼 너비 설정 (순서에 맞춰 조정)
        ws['!cols'] = [
            { wch: 8 },  // 주문번호
            { wch: 6 },  // 사이트
            { wch: 12 }, // 주문일자
            { wch: 12 }, // [NEW] 결제일
            { wch: 10 }, // [NEW] 담당매니저
            { wch: 10 }, // 고객명
            { wch: 15 }, // 연락처
            { wch: 40 }, // 주문내역
            { wch: 12 }, // 총금액
            { wch: 10 }, // 할인액
            { wch: 12 }, // 실결제액
            { wch: 10 }, // 결제상태
            { wch: 10 }, // 현재상태
            { wch: 12 }  // 배송요청일
        ];

        XLSX.utils.book_append_sheet(wb, ws, `${targetMonth}월_매출정산`);
        XLSX.writeFile(wb, `매출정산_${targetYear}_${targetMonth}.xlsx`);

    } catch (e) {
        console.error(e);
        alert("다운로드 실패: " + e.message);
    } finally {
        showLoading(false);
    }
};
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
