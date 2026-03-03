import { sb } from "./global_config.js";
import { showLoading } from "./global_common.js";

// [추천인] 무통장입금 확인 시 추천인 적립
async function creditReferralBonus(orderId) {
    try {
        const { data: order } = await sb.from('orders').select('request_note, total_amount, manager_name').eq('id', orderId).maybeSingle();
        if (!order || !order.request_note) return;
        const match = order.request_note.match(/##REF:([^:]+):([^#]+)##/);
        if (!match) return;
        const referrerId = match[1];

        // 중복 적립 방지
        const { data: existing } = await sb.from('wallet_logs')
            .select('id').eq('user_id', referrerId)
            .eq('type', 'referral_bonus').ilike('description', `%##${orderId}##%`).maybeSingle();
        if (existing) return;

        const bonusAmount = Math.floor(order.total_amount * 0.05);
        if (bonusAmount <= 0) return;

        const buyerName = order.manager_name || '고객';

        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', referrerId).single();
        const newDeposit = (parseInt(pf?.deposit || 0)) + bonusAmount;
        await sb.from('profiles').update({ deposit: newDeposit }).eq('id', referrerId);
        await sb.from('wallet_logs').insert({
            user_id: referrerId, type: 'referral_bonus',
            amount: bonusAmount, description: `##REFERRAL##${buyerName}##${orderId}##`
        });
        console.log(`[추천인] 적립 완료: ${referrerId} +${bonusAmount}KRW (주문: ${orderId})`);
    } catch (e) {
        console.error('[추천인] 적립 오류:', e);
    }
}

let currentOrderStatus = '전체';
let currentPage = 1;
const itemsPerPage = 10;

// window에 노출 (별도 페이지에서 사이드바 nav 접근용)
Object.defineProperty(window, 'currentOrderStatus', { get: () => currentOrderStatus, set: v => { currentOrderStatus = v; } });
Object.defineProperty(window, 'currentPage', { get: () => currentPage, set: v => { currentPage = v; } });
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
    if (checks.length === 0) { showToast("선택된 항목이 없습니다.", "warn"); return; }
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
            const { data } = await sb.from('admin_staff').select('id, name, role, color');
            staffList = data || [];
        }

        let query = sb.from('orders')
            .select('id, status, total_amount, items, created_at, payment_status, payment_method, toss_payment_key, discount_amount, manager_name, phone, address, request_note, delivery_target_date, site_code, staff_manager_id, staff_driver_id, files, user_id, depositor_name', { count: 'exact' })
            .order('created_at', { ascending: false });

        // [핵심 2] 임시작성 및 관리자차단 건 숨김
        query = query.neq('status', '임시작성').neq('status', '관리자차단');

        // 필터 적용 (고도몰 스타일 세부 탭)
        if (currentOrderStatus === '전체') {
            query = query.not('status', 'in', '("취소요청","취소됨")');
        } else if (currentOrderStatus === '입금대기') {
            query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
            query = query.not('payment_status', 'in', '("결제완료","입금확인")');
        } else if (currentOrderStatus === '접수됨') {
            query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
            query = query.in('payment_status', ['결제완료', '입금확인']);
        } else if (currentOrderStatus === '칼선작업') {
            query = query.in('status', ['칼선작업', '제작중']);
        } else if (currentOrderStatus === '완료됨') {
            query = query.in('status', ['완료됨', '완료', '구매확정']);
        } else if (currentOrderStatus === '배송') {
            query = query.in('status', ['발송완료', '배송완료']);
        } else if (currentOrderStatus === '취소요청') {
            query = query.eq('status', '취소요청');
        } else if (currentOrderStatus === '취소됨') {
            query = query.eq('status', '취소됨').eq('payment_status', '환불완료');
        } else if (currentOrderStatus === '환불대기') {
            query = query.eq('status', '취소됨').eq('payment_status', '환불대기');
        } else if (currentOrderStatus === '환불실패') {
            query = query.eq('status', '취소됨').eq('payment_status', '환불실패');
        }

        if (deliveryDateFilter) query = query.eq('delivery_target_date', deliveryDateFilter);
        if (orderDateFilter) query = query.gte('created_at', orderDateFilter + 'T00:00:00').lte('created_at', orderDateFilter + 'T23:59:59');
        if (searchKeyword) query = query.or(`manager_name.ilike.%${searchKeyword}%,phone.ilike.%${searchKeyword}%,id.eq.${searchKeyword}`);
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
        // 매출 합계 (현재 페이지 기준)
        const sumRevenue = document.getElementById('sumRevenue');
        if(sumRevenue && data) {
            const total = data.reduce((acc, o) => acc + (o.total_amount || 0), 0);
            sumRevenue.innerText = total.toLocaleString() + '원';
        }

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding:30px;">주문이 없습니다.</td></tr>';
            if(sumRevenue) sumRevenue.innerText = '0원';
            showLoading(false); return;
        }

        data.forEach(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
            const total = order.total_amount || 0;
            const site = order.site_code || 'KR';

            // 통화 변환 헬퍼 (DB는 KRW 기준 저장)
            const currRates = { KR: 1, JP: 0.1, US: 0.002, CN: 0.01, AR: 0.005, ES: 0.001, STORE: 1, GODO: 1 };
            const currSymbols = { KR: '', JP: '¥', US: '$', CN: '¥', AR: '﷼', ES: '€', STORE: '', GODO: '' };
            const rate = currRates[site] || 1;
            const sym = currSymbols[site] || '';
            const fmtAmt = (krw) => {
                const v = site === 'ES' ? (krw * rate).toFixed(2) : Math.round(krw * rate);
                if (site === 'KR' || site === 'STORE' || site === 'GODO') return Number(v).toLocaleString();
                if (site === 'AR') return `${Number(v).toLocaleString()} ﷼`;
                return `${sym}${Number(v).toLocaleString()}`;
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

            // ═══ [결제 칼럼] 결제수단 + 결제확인 상태만 표시 ═══
            const pmLower = (order.payment_method || '').toLowerCase();
            const isCard = pmLower.includes('카드') || pmLower.includes('card') || pmLower.includes('stripe') || pmLower.includes('간편결제');
            const isBank = pmLower.includes('무통장') || pmLower.includes('bank');
            const isDeposit = pmLower.includes('예치금');
            const depositor = order.depositor_name || order.depositor || '';
            const isPaid = order.payment_status === '결제완료' || order.payment_status === '입금확인';

            let payHtml = '';
            if (isCard) {
                const label = pmLower.includes('stripe') ? 'Stripe' : '카드';
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#2563eb;">💳 ${label}</div>`;
                payHtml += isPaid
                    ? `<div style="font-size:10px;color:#15803d;font-weight:bold;">승인완료</div>`
                    : `<div style="font-size:10px;color:#ef4444;">미결제</div>`;
            } else if (isDeposit) {
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#7c3aed;">💰 예치금</div>`;
                if (isPaid) payHtml += `<div style="font-size:10px;color:#15803d;">확인</div>`;
            } else if (isBank) {
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#d97706;">🏦 무통장</div>`;
                if (depositor) payHtml += `<div style="font-size:10px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55px;" title="${depositor}">${depositor}</div>`;
                if (!isPaid && order.status !== '취소됨' && order.status !== '취소요청') {
                    payHtml += `<button class="btn btn-success btn-sm" style="width:100%;margin-top:2px;font-size:10px;padding:1px 3px;" onclick="confirmDeposit('${order.id}')">입금확인</button>`;
                } else if (isPaid) {
                    payHtml += `<div style="font-size:10px;color:#15803d;font-weight:bold;">확인됨</div>`;
                }
            } else {
                payHtml = `<div style="font-size:10px;color:#94a3b8;">-</div>`;
            }

            // ═══ [상태 칼럼] 주문 진행상태만 깔끔하게 ═══
            let statusHtml = '';
            const st = order.status;
            if (st === '접수됨' || st === '파일처리중' || st === '접수대기' || st === '제작준비') {
                statusHtml = `<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-weight:bold;">접수됨</span>`;
            } else if (st === '칼선작업' || st === '제작중') {
                statusHtml = `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:bold;">🔨 제작중</span>`;
            } else if (st === '완료됨' || st === '완료' || st === '구매확정') {
                statusHtml = `<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:bold;">✅ 완료</span>`;
            } else if (st === '발송완료') {
                statusHtml = `<span class="badge" style="background:#d1fae5;color:#065f46;font-weight:bold;">🚚 발송</span>`;
            } else if (st === '배송완료') {
                statusHtml = `<span class="badge" style="background:#a7f3d0;color:#064e3b;font-weight:bold;">📦 배송완료</span>`;
            } else if (st === '취소요청') {
                statusHtml = `<span class="badge" style="background:#fff7ed;color:#ea580c;font-weight:bold;border:1px solid #fed7aa;">❌ 취소요청</span>`;
            } else if (st === '취소됨') {
                const refSt = order.payment_status;
                if (refSt === '환불완료') {
                    statusHtml = `<span class="badge" style="background:#f0fdf4;color:#15803d;font-weight:bold;border:1px solid #bbf7d0;">✅ 환불완료</span>`;
                } else if (refSt === '환불대기') {
                    statusHtml = `<span class="badge" style="background:#fffbeb;color:#d97706;font-weight:bold;border:1px solid #fde68a;">⏳ 환불대기</span>`;
                } else if (refSt === '환불실패') {
                    statusHtml = `<span class="badge" style="background:#fef2f2;color:#dc2626;font-weight:bold;border:1px solid #fecaca;">❌ 환불실패</span>`;
                } else {
                    statusHtml = `<span class="badge" style="background:#fee2e2;color:#dc2626;">취소됨</span>`;
                }
            } else {
                statusHtml = `<span class="badge">${st}</span>`;
            }

            // [파일 버튼] — 파일 없으면 경고 표시
            const fCount = order.files?.length || 0;
            const fileIcon = fCount === 0 ? '⚠️' : '📂';
            const fileBtnStyle = fCount === 0 ? 'width:100%; padding:2px 0; font-size:12px; height:24px; background:#fef2f2; border-color:#fca5a5; color:#dc2626;' : 'width:100%; padding:2px 0; font-size:12px; height:24px;';
            const fileBtn = `<button class="btn btn-outline" style="${fileBtnStyle}" onclick="openFileModal('${order.id}')" title="파일목록">${fileIcon} ${fCount}</button>`;
            const addBtn = `<label class="btn btn-sky" style="width:100%; padding:2px 0; font-size:12px; height:24px; margin-top:2px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" title="파일추가"><i class="fa-solid fa-plus"></i><input type="file" style="display:none;" onchange="uploadFileDirect('${order.id}', this)"></label>`;

            // [렌더링]
            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center;"><input type="checkbox" class="row-chk" value="${order.id}"></td>
                    <td style="text-align:center;"><span class="badge-site ${site.toLowerCase()}" style="cursor:pointer;" onclick="fixSiteCode('${order.id}')" title="클릭하여 변경">${site === 'STORE' ? '스토어' : site === 'GODO' ? '고도몰' : site}</span>${(pmLower.includes('stripe') && site === 'KR') ? '<div style="font-size:9px;color:#ef4444;">⚠️오류?</div>' : ''}</td>
                    <td style="text-align:center; line-height:1.2;">
                        <span style="color:#334155;">${orderDate}</span>
                        ${deliveryHtml}
                    </td>
                    <td><b>${order.manager_name}</b><br><span style="font-size:11px; color:#666;">${order.phone}</span></td>
                    
                    <td style="text-align:center; font-size:12px; color:#64748b; font-weight:bold;">${order.id}</td>
                    
                    <td style="font-size:11px;">${items.map(i => `<div>- ${i.productName || '상품'} (${i.qty})</div>`).join('')}</td>
                    
                    <td style="text-align:right;">${fmtAmt(total)}</td>
                    <td style="text-align:right; color:#ef4444;">${fmtAmt(order.discount_amount || 0)}</td>
                    <td style="text-align:right; color:#d97706;">${fmtAmt(order.used_deposit || 0)}</td>
                    <td style="text-align:right; font-weight:bold; color:#15803d;">${fmtAmt(order.actual_payment || total)}</td>
                    <td>${managerOpts} <div style="margin-top:2px;">${driverOpts}</div></td>
                    
                    <td style="padding:2px 4px;">${fileBtn}${addBtn}</td>

                    <td style="text-align:center; line-height:1.3; padding:2px;">${payHtml}</td>
                    <td style="text-align:center; padding:2px;">${statusHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; color:red;">${e.message}</td></tr>`;
    } finally {
        showLoading(false);
        updateCancelReqBadge();
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
    const newCode = prompt('사이트 코드 변경 (KR / JP / US / STORE / GODO):', '');
    if (!newCode) return;
    const code = newCode.trim().toUpperCase();
    if (!['KR', 'JP', 'US', 'CN', 'AR', 'ES', 'STORE', 'GODO'].includes(code)) { showToast('KR, JP, US, STORE, GODO 등 입력', "warn"); return; }
    const { error } = await sb.from('orders').update({ site_code: code }).eq('id', orderId);
    if (error) { showToast('변경 실패: ' + error.message, "error"); return; }
    showToast(`주문 #${orderId} → ${code} 변경 완료`, "success");
    loadOrders();
};

window.filterOrders = (status, btn) => {
    currentOrderStatus = status;
    // 모든 탭 버튼 비활성화 (2줄 모두)
    document.querySelectorAll('#sec-orders [id^="btnFilter"]').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
        b.style.fontWeight = '';
    });
    if(btn) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        btn.style.fontWeight = 'bold';
    }
    currentPage = 1;
    loadOrders();
};

window.toggleAll = (el) => { document.querySelectorAll('.row-chk').forEach(c => c.checked = el.checked); };
window.resetPage = () => { currentPage = 1; };
window.changePage = (step) => { if(currentPage + step > 0) { currentPage += step; loadOrders(); } };

window.updateActionButtons = () => {
    const div = document.getElementById('action-buttons');
    if(!div) return;
    const s = currentOrderStatus;
    if (s === '입금대기') {
        div.innerHTML = `<button class="btn btn-success" onclick="confirmDepositSelected()">입금확인</button><button class="btn btn-danger" onclick="deleteOrdersSelected(false)">삭제</button>`;
    } else if (s === '접수됨') {
        div.innerHTML = `<button class="btn btn-primary" onclick="changeStatusSelected('칼선작업')">작업시작</button><button class="btn btn-danger" onclick="deleteOrdersSelected(false)">삭제</button>`;
    } else if (s === '칼선작업') {
        div.innerHTML = `<button class="btn btn-success" onclick="downloadBulkFiles()">다운로드</button><button class="btn btn-vip" onclick="changeStatusSelected('완료됨')">완료처리</button>`;
    } else if (s === '완료됨') {
        div.innerHTML = `<button class="btn btn-primary" onclick="changeStatusSelected('발송완료')">발송처리</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '배송') {
        div.innerHTML = `<button class="btn btn-outline" onclick="changeStatusSelected('배송완료')">배송완료</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '취소요청') {
        div.innerHTML = `<button class="btn btn-success" onclick="approveCancelSelected()" style="font-weight:bold;">💳 카드 취소승인</button><button class="btn" onclick="completeCashRefundSelected()" style="font-weight:bold;background:#d97706;color:white;">💰 현금 환불완료</button><button class="btn btn-outline" onclick="rejectCancelSelected()" style="font-weight:bold;">🔙 취소거절</button>`;
    } else if (s === '취소됨') {
        div.innerHTML = `<button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '환불대기') {
        div.innerHTML = `<button class="btn btn-warning" onclick="retryRefundSelected()" style="background:#d97706;color:white;">🔄 환불 재시도</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)" style="margin-left:4px;">삭제</button>`;
    } else if (s === '환불실패') {
        div.innerHTML = `<button class="btn btn-warning" onclick="retryRefundSelected()" style="background:#dc2626;color:white;">🔄 환불 재시도</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else {
        // 전체 탭
        div.innerHTML = `<button class="btn btn-danger" onclick="deleteOrdersSelected(true)">선택 삭제</button>`;
    }
};

window.changeStatusSelected = async (status) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    await sb.from('orders').update({ status }).in('id', ids);
    loadOrders();
};

// [환불 헬퍼] 단건 환불 처리 — 여러 함수에서 공유
async function refundSingleOrder(id, reason = '관리자 취소') {
    const { data: order } = await sb.from('orders')
        .select('payment_method, toss_payment_key, total_amount, discount_amount, user_id')
        .eq('id', id).single();
    if (!order) throw new Error('주문 조회 실패');

    const pm = (order.payment_method || '').toLowerCase();
    const isCard = pm.includes('카드') || pm.includes('card');
    const isStripe = pm.includes('stripe');
    const isDeposit = pm.includes('예치금');
    let newPaymentStatus = '환불완료';

    // PG 환불
    if ((isCard || isStripe) && order.toss_payment_key) {
        if (isStripe) {
            const { data, error } = await sb.functions.invoke('cancel-stripe-payment', {
                body: { session_id: order.toss_payment_key, cancelReason: reason }
            });
            if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
        } else {
            const { data, error } = await sb.functions.invoke('cancel-toss-payment', {
                body: { paymentKey: order.toss_payment_key, cancelReason: reason }
            });
            if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
        }
    } else if ((isCard || isStripe) && !order.toss_payment_key) {
        // 결제 시도 중 중단된 건 — PG 결제가 완료되지 않았으므로 환불 불필요
        newPaymentStatus = '환불완료';
    } else if (isDeposit && order.user_id) {
        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', order.user_id).single();
        if (pf) {
            await sb.from('profiles').update({ deposit: (pf.deposit || 0) + (order.total_amount || 0) }).eq('id', order.user_id);
            await sb.from('wallet_logs').insert({
                user_id: order.user_id, type: 'refund_cancel',
                amount: order.total_amount || 0,
                description: `${reason} 환불 (주문번호: ${id})`
            });
        }
    } else {
        newPaymentStatus = '환불대기';
    }

    // 마일리지 복원
    if (order.discount_amount > 0 && order.user_id) {
        const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
        if (pf) {
            await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
            await sb.from('wallet_logs').insert({
                user_id: order.user_id, type: 'refund_mileage',
                amount: order.discount_amount,
                description: `${reason} 마일리지 복원 (주문번호: ${id})`
            });
        }
    }

    return newPaymentStatus;
}

// [취소승인] 취소요청 탭에서 환불 처리
window.approveCancelSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 취소를 승인하고 환불을 진행하시겠습니까?`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const newPaymentStatus = await refundSingleOrder(id, '취소 승인');
            await sb.from('orders').update({ status: '취소됨', payment_status: newPaymentStatus }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} refund error:`, e);
            await sb.from('orders').update({ status: '취소됨', payment_status: '환불실패' }).eq('id', id);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`취소승인 완료: 성공 ${successCount}건${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [취소거절] 취소요청을 접수됨으로 복원
window.rejectCancelSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 취소 요청을 거절하시겠습니까?\n주문이 '접수됨' 상태로 복원됩니다.`)) return;

    await sb.from('orders').update({ status: '접수됨' }).in('id', ids);
    showToast(`${ids.length}건 취소 거절 처리 완료`, 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [현금 환불완료] 무통장/현금 주문 — 관리자가 직접 송금 후 완료 처리 (PG 호출 없음)
window.completeCashRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건을 현금 환불완료 처리하시겠습니까?\n(이미 고객에게 송금을 완료한 후 눌러주세요)`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            // 마일리지 복원만 처리 (PG 환불 없음)
            const { data: order } = await sb.from('orders').select('discount_amount, user_id').eq('id', id).single();
            if (order && order.discount_amount > 0 && order.user_id) {
                const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
                if (pf) {
                    await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
                    await sb.from('wallet_logs').insert({
                        user_id: order.user_id, type: 'refund_mileage',
                        amount: order.discount_amount,
                        description: `현금 환불완료 마일리지 복원 (주문번호: ${id})`
                    });
                }
            }
            await sb.from('orders').update({ status: '취소됨', payment_status: '환불완료' }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} cash refund error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`현금 환불완료: ${successCount}건 처리${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [환불 재시도] 환불실패 건 재처리
window.retryRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 환불을 재시도하시겠습니까?`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const newPaymentStatus = await refundSingleOrder(id, '환불 재시도');
            await sb.from('orders').update({ payment_status: newPaymentStatus }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} retry refund error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`환불 재시도: 성공 ${successCount}건${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    loadOrders();
};

// [뱃지 카운트 업데이트] — 취소요청 + 입금대기
async function updateCancelReqBadge() {
    try {
        // 취소요청 카운트
        const { count: cancelCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', '취소요청');
        const badge = document.getElementById('cancelReqCount');
        if (badge) {
            badge.textContent = cancelCount || 0;
            badge.style.display = (cancelCount > 0) ? 'inline' : 'none';
        }
        // 입금대기 카운트
        const { count: depositCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .in('status', ['접수됨', '파일처리중', '접수대기', '제작준비'])
            .not('payment_status', 'in', '("결제완료","입금확인")');
        const dBadge = document.getElementById('depositWaitCount');
        if (dBadge) {
            dBadge.textContent = depositCount || 0;
            dBadge.style.display = (depositCount > 0) ? 'inline' : 'none';
        }
    } catch (e) { /* ignore */ }
}
window.updateCancelReqBadge = updateCancelReqBadge;

// [일괄 입금확인] 입금대기 탭에서 사용
window.confirmDepositSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 입금을 확인 처리하시겠습니까?`)) return;
    for (const id of ids) {
        await sb.from('orders').update({ payment_status: '입금확인' }).eq('id', id);
        await creditReferralBonus(id);
    }
    showToast(`${ids.length}건 입금확인 완료`, 'success');
    loadOrders();
};

window.deleteOrdersSelected = async (force) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
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
    list.innerHTML = currentMgrFiles.map((f, i) => {
        const isCutline = f.type === 'cutline';
        const isImage = f.url && (f.url.match(/\.(png|jpg|jpeg|webp)(\?|$)/i) || isCutline);
        const icon = isCutline ? '✂️' : f.type === 'customer_file' ? '📎' : f.type === 'order_sheet' ? '📋' : f.type === 'quotation' ? '💰' : '📄';
        const badge = isCutline ? '<span style="background:#ef4444;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;">칼선</span>' : '';
        const preview = isImage ? `<div style="margin:4px 0;"><img src="${f.url}" style="max-width:120px;max-height:80px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;" onclick="window.open('${f.url}','_blank')"></div>` : '';
        return `<div class="file-item-row" style="flex-direction:column;align-items:flex-start;">
            <div style="display:flex;align-items:center;width:100%;justify-content:space-between;">
                <a href="${f.url}" target="_blank">${icon} ${f.name}${badge}</a>
                <button class="btn btn-danger btn-sm" onclick="deleteFileFromOrder(${i})">삭제</button>
            </div>
            ${preview}
        </div>`;
    }).join('') || '<div style="padding:10px; text-align:center;">파일 없음</div>';
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
    showToast('업로드 완료', "success");
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
        // 은행거래 + 미결제 주문을 병렬 조회
        const [txsRes, ordersRes] = await Promise.all([
            sb.from('bank_transactions')
                .select('*')
                .gte('transaction_date', start + 'T00:00:00')
                .lte('transaction_date', end + 'T23:59:59')
                .order('transaction_date', { ascending: false }),
            sb.from('orders')
                .select('id, manager_name, phone, total_amount, payment_status, created_at')
                .gte('created_at', start + 'T00:00:00')
                .neq('payment_status', '결제완료')
                .neq('payment_status', '입금확인')
        ]);

        const { data: txs, error } = txsRes;
        if (error) throw error;
        const { data: orders } = ordersRes;

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
        // 추천인 적립 처리
        for (const item of list) {
            await creditReferralBonus(item.orderId);
        }
        showToast("완료되었습니다.", "success");
        loadBankdaList();
    } catch(e) { showToast("오류: " + e.message, "error"); } finally { showLoading(false); }
};

window.runBankdaScraping = async () => {
    if(!confirm("최신 내역을 가져오시겠습니까?")) return;
    showLoading(true);
    try {
        const { data, error } = await sb.functions.invoke('bank-scraper', { method: 'POST' });
        if(error) throw error;
        showToast(`업데이트 완료: ${data.message || '성공'}`, "success");
        loadBankdaList();
    } catch(e) { showToast("실패: " + e.message, "error"); } finally { showLoading(false); }
};

window.matchOrderManual = async (txId, name, suggestedId = '') => {
    const orderId = prompt(`[${name}] 입금건과 연결할 주문번호를 입력하세요.`, suggestedId);
    if(!orderId) return;
    try {
        await sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', orderId);
        await sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: orderId }).eq('id', txId);
        await creditReferralBonus(orderId); // 추천인 적립
        showToast("연결되었습니다.", "success");
        loadBankdaList();
    } catch(e) { showToast("오류: " + e.message, "error"); }
};

// [배송 스케줄 및 기사 배정]
// ── 관리자 달력 뷰 ──
let adminCalDate = null;
const ADMIN_SLOTS = ["08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
const ADMIN_MAX_TEAMS = 3;

window.loadDailyTasks = async () => {
    if (!adminCalDate) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        adminCalDate = new Date(krNow.getFullYear(), krNow.getMonth(), 1);
    }
    if (staffList.length === 0) {
        const { data } = await sb.from('admin_staff').select('id, name, role, color');
        staffList = data || [];
    }
    renderAdminCalendar();
};

window.adminCalChangeMonth = (delta) => {
    if (!adminCalDate) adminCalDate = new Date();
    adminCalDate.setMonth(adminCalDate.getMonth() + delta);
    renderAdminCalendar();
};

async function renderAdminCalendar() {
    const grid = document.getElementById('adminCalGrid');
    const titleEl = document.getElementById('adminCalTitle');
    if (!grid) return;

    const year = adminCalDate.getFullYear();
    const month = adminCalDate.getMonth();
    titleEl.textContent = `${year}년 ${month + 1}월`;

    // 월간 주문 데이터 조회
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`;
    const endYear = month + 2 > 12 ? year + 1 : year;

    showLoading(true);
    let orders = [];
    try {
        const { data, error } = await sb.from('orders')
            .select('id, delivery_target_date, installation_time, total_amount, manager_name, phone, status')
            .gte('delivery_target_date', startDate)
            .lt('delivery_target_date', `${endYear}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`);
        if (!error && data) orders = data;
    } catch (e) { console.error(e); }
    showLoading(false);

    // 날짜별 주문 그룹
    const ordersByDate = {};
    orders.forEach(o => {
        if (!ordersByDate[o.delivery_target_date]) ordersByDate[o.delivery_target_date] = [];
        ordersByDate[o.delivery_target_date].push(o);
    });

    grid.innerHTML = '';

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach(d => {
        grid.innerHTML += `<div style="background:#f1f5f9; padding:8px; text-align:center; font-weight:bold; font-size:13px; color:${d==='일'?'#ef4444':d==='토'?'#3b82f6':'#334155'};">${d}</div>`;
    });

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div style="background:#fafafa; min-height:100px;"></div>`;
    }

    // 날짜 칸
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOrders = ordersByDate[dateStr] || [];
        const installOrders = dayOrders.filter(o => o.installation_time);
        const deliveryOnly = dayOrders.filter(o => !o.installation_time);
        const isToday = dateStr === todayStr;
        const dow = new Date(year, month, d).getDay();

        // 슬롯별 팀 수 계산
        const slotTeams = {};
        ADMIN_SLOTS.forEach(s => slotTeams[s] = 0);
        installOrders.forEach(o => {
            const startIdx = ADMIN_SLOTS.indexOf(o.installation_time);
            if (startIdx === -1) return;
            const total = o.total_amount || 0;
            const slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
            const endIdx = slots === 7 ? ADMIN_SLOTS.length : Math.min(startIdx + slots, ADMIN_SLOTS.length);
            for (let i = (slots === 7 ? 0 : startIdx); i < endIdx; i++) slotTeams[ADMIN_SLOTS[i]]++;
        });
        const hasFullSlot = ADMIN_SLOTS.some(s => slotTeams[s] >= ADMIN_MAX_TEAMS);
        const allFull = ADMIN_SLOTS.every(s => slotTeams[s] >= ADMIN_MAX_TEAMS);

        let badges = '';
        if (installOrders.length > 0) badges += `<div style="font-size:10px; background:${allFull?'#fecaca':'#ede9fe'}; color:${allFull?'#dc2626':'#6d28d9'}; border-radius:4px; padding:1px 5px; margin-top:2px;">🔧 ${installOrders.length}건</div>`;
        if (deliveryOnly.length > 0) badges += `<div style="font-size:10px; background:#dbeafe; color:#2563eb; border-radius:4px; padding:1px 5px; margin-top:2px;">🚚 ${deliveryOnly.length}건</div>`;

        const cellBg = isToday ? '#fffbeb' : (allFull ? '#fef2f2' : '#fff');
        const borderStyle = isToday ? 'border:2px solid #f59e0b;' : '';

        grid.innerHTML += `<div onclick="openAdminSlotModal('${dateStr}')" style="background:${cellBg}; min-height:100px; padding:6px; cursor:pointer; position:relative; ${borderStyle} transition:0.15s;" onmouseenter="this.style.background='#f0f4ff'" onmouseleave="this.style.background='${cellBg}'">
            <div style="font-weight:bold; font-size:14px; color:${dow===0?'#ef4444':dow===6?'#3b82f6':'#334155'}; ${isToday?'background:#f59e0b; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;':''}">${d}</div>
            ${badges}
            ${hasFullSlot && !allFull ? '<div style="position:absolute; top:4px; right:4px; width:8px; height:8px; background:#f59e0b; border-radius:50;"></div>' : ''}
        </div>`;
    }
}

// ── 지역 판별 헬퍼 ──
function isMetroArea(address) {
    if (!address) return true;
    const metro = ['서울','경기','인천','성남','분당','수원','고양','용인','부천','안산','안양','화성','평택','시흥','파주','김포','광명','군포','하남','오산','이천','양주','구리','남양주','의정부','동두천','과천','양평','여주','가평','연천','포천','일산','판교','광교','동탄','위례','세종'];
    return metro.some(m => address.includes(m));
}
function isHoneycombOrder(order) {
    if (!order.items) return false;
    const items = Array.isArray(order.items) ? order.items : [];
    return items.some(item => {
        const cat = (item.category || item.product?.category || '').toLowerCase();
        const name = (item.productName || item.product?.name || '').toLowerCase();
        return cat.includes('honeycomb') || cat.includes('hc_') || name.includes('허니콤') || name.includes('honeycomb') || name.includes('ハニカム');
    });
}

// ── 관리자 날짜 클릭 팝업 ──
window.openAdminSlotModal = async (dateStr) => {
    const modal = document.getElementById('adminSlotModal');
    const titleEl = document.getElementById('adminSlotTitle');
    const content = document.getElementById('adminSlotContent');
    if (!modal) return;

    titleEl.textContent = `📅 ${dateStr} 설치/배송 스케줄`;
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩중...</div>';

    const timeSelect = document.getElementById('adminSlotTime');
    if (timeSelect) timeSelect.innerHTML = ADMIN_SLOTS.map(s => `<option value="${s}">${s}</option>`).join('');
    window._adminSlotDate = dateStr;

    try {
        const { data: orders } = await sb.from('orders')
            .select('id, installation_time, total_amount, manager_name, phone, address, status, staff_driver_id, items')
            .eq('delivery_target_date', dateStr);
        const dayOrders = orders || [];

        // 슬롯별 팀 수 + 주문 매핑
        const slotTeams = {};
        const slotOrders = {};
        ADMIN_SLOTS.forEach(s => { slotTeams[s] = 0; slotOrders[s] = []; });

        const installOrders = dayOrders.filter(o => o.installation_time);
        installOrders.forEach(o => {
            const startIdx = ADMIN_SLOTS.indexOf(o.installation_time);
            if (startIdx === -1) return;
            const total = o.total_amount || 0;
            const slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
            const endIdx = slots === 7 ? ADMIN_SLOTS.length : Math.min(startIdx + slots, ADMIN_SLOTS.length);
            for (let i = (slots === 7 ? 0 : startIdx); i < endIdx; i++) {
                slotTeams[ADMIN_SLOTS[i]]++;
                slotOrders[ADMIN_SLOTS[i]].push(o);
            }
        });

        // 일반 배송 분류
        const deliveryOnly = dayOrders.filter(o => !o.installation_time);
        const dlvHcMetro = deliveryOnly.filter(o => isHoneycombOrder(o) && isMetroArea(o.address));
        const dlvHcLocal = deliveryOnly.filter(o => isHoneycombOrder(o) && !isMetroArea(o.address));
        const dlvOtherMetro = deliveryOnly.filter(o => !isHoneycombOrder(o) && isMetroArea(o.address));
        const dlvOtherLocal = deliveryOnly.filter(o => !isHoneycombOrder(o) && !isMetroArea(o.address));

        // ── 2열 레이아웃 생성 ──
        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">';

        // ===== 좌측: 설치 시간 슬롯 =====
        html += '<div>';
        html += '<h4 style="margin:0 0 12px 0; font-size:17px; color:#6d28d9;"><i class="fa-solid fa-wrench"></i> 설치 예약 시간표</h4>';
        html += '<table style="width:100%; border-collapse:collapse; font-size:14px;">';
        html += '<thead><tr style="background:#f8fafc;"><th style="padding:10px; text-align:left;">시간</th><th style="padding:10px; text-align:center; width:70px;">팀</th><th style="padding:10px; text-align:left;">고객</th><th style="padding:10px; width:40px;"></th></tr></thead><tbody>';

        ADMIN_SLOTS.forEach((slot, idx) => {
            const endSlot = idx + 1 < ADMIN_SLOTS.length ? ADMIN_SLOTS[idx + 1] : '22:00';
            const used = slotTeams[slot] || 0;
            const isFull = used >= ADMIN_MAX_TEAMS;
            const barColor = isFull ? '#ef4444' : (used > 0 ? '#f59e0b' : '#22c55e');
            const bgColor = isFull ? '#fef2f2' : (used > 0 ? '#fffbeb' : '#fff');

            const uniqueOrders = [...new Map(slotOrders[slot].map(o => [o.id, o])).values()];
            let custHtml = uniqueOrders.map(o => {
                const info = getInstallationDisplayInfo(o);
                const isBlock = o.manager_name?.startsWith('[차단]');
                return `<div style="padding:2px 0; ${isBlock?'color:#94a3b8; font-style:italic;':''}">
                    <span style="font-weight:600;">${o.manager_name}</span>
                    ${!isBlock && o.phone ? `<span style="color:#6366f1; margin-left:4px;">${o.phone}</span>` : ''}
                    ${info ? `<span style="color:#6d28d9; font-size:12px;">(${info.duration})</span>` : ''}
                </div>`;
            }).join('') || '<span style="color:#cbd5e1;">-</span>';

            let removeHtml = uniqueOrders.map(o => `<button style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:14px; padding:2px 4px;" onclick="adminRemoveInstallation('${o.id}','${dateStr}')" title="제거">✕</button>`).join('');

            html += `<tr style="border-bottom:1px solid #f1f5f9; background:${bgColor};">
                <td style="padding:10px; font-weight:bold; white-space:nowrap; font-size:15px;">${slot}~${endSlot}</td>
                <td style="padding:10px; text-align:center;">
                    <div style="display:flex; gap:3px; justify-content:center;">${[0,1,2].map(i=>`<div style="width:14px; height:14px; border-radius:50%; background:${i<used?barColor:'#e2e8f0'};"></div>`).join('')}</div>
                </td>
                <td style="padding:10px;">${custHtml}</td>
                <td style="padding:10px; text-align:center;">${removeHtml}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';

        // ===== 우측: 배송 목록 (분류별) =====
        html += '<div>';
        html += '<h4 style="margin:0 0 12px 0; font-size:17px; color:#2563eb;"><i class="fa-solid fa-truck-fast"></i> 배송 목록</h4>';

        // 시간지정 배송 (설치 시간 있는 건)
        const timedDelivery = installOrders.filter(o => !o.manager_name?.startsWith('[차단]'));
        if (timedDelivery.length > 0) {
            html += renderDeliveryGroup('⏰ 시간지정 설치', timedDelivery, '#6d28d9', '#ede9fe', true);
        }

        // 허니콤 수도권
        if (dlvHcMetro.length > 0) html += renderDeliveryGroup('🔧 허니콤보드 · 수도권', dlvHcMetro, '#7c3aed', '#f5f3ff');
        // 허니콤 지방
        if (dlvHcLocal.length > 0) html += renderDeliveryGroup('🔧 허니콤보드 · 지방', dlvHcLocal, '#9333ea', '#faf5ff');
        // 기타 수도권
        if (dlvOtherMetro.length > 0) html += renderDeliveryGroup('📦 기타제품 · 수도권', dlvOtherMetro, '#2563eb', '#eff6ff');
        // 기타 지방
        if (dlvOtherLocal.length > 0) html += renderDeliveryGroup('📦 기타제품 · 지방', dlvOtherLocal, '#0284c7', '#f0f9ff');

        if (deliveryOnly.length === 0 && timedDelivery.length === 0) {
            html += '<div style="text-align:center; padding:30px; color:#cbd5e1;">배송 건 없음</div>';
        }

        html += '</div></div>'; // grid 닫기

        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<div style="color:red; padding:20px;">오류: ${e.message}</div>`;
    }
};

function renderDeliveryGroup(title, orders, color, bg, showTime) {
    let html = `<div style="margin-bottom:14px;">
        <div style="font-size:15px; font-weight:bold; color:${color}; padding:8px 12px; background:${bg}; border-radius:6px 6px 0 0; border-left:3px solid ${color};">${title} (${orders.length}건)</div>
        <div style="border:1px solid #e2e8f0; border-top:none; border-radius:0 0 6px 6px;">`;
    orders.forEach(o => {
        const driver = staffList.find(s => s.id == o.staff_driver_id);
        const isDone = o.status === '배송완료' || o.status === '완료됨';
        const installInfo = showTime ? getInstallationDisplayInfo(o) : null;
        const region = isMetroArea(o.address) ? '수도권' : '지방';
        html += `<div style="padding:8px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; ${isDone?'opacity:0.5;':''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-weight:600;">${o.manager_name}</span>
                    <span style="color:#6366f1; margin-left:6px;">${o.phone || ''}</span>
                    ${installInfo ? `<span style="background:#ede9fe; color:#6d28d9; padding:2px 6px; border-radius:3px; margin-left:6px; font-size:12px;">${installInfo.start}~${installInfo.end}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    ${driver ? `<span style="color:#059669; font-size:13px;">🚛${driver.name}</span>` : ''}
                    ${isDone ? '<span style="color:#22c55e;">✅</span>' : `<span style="color:#94a3b8; font-size:12px;">${o.status}</span>`}
                </div>
            </div>
            ${o.address ? `<div style="color:#64748b; font-size:12px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.address}</div>` : ''}
        </div>`;
    });
    html += '</div></div>';
    return html;
}

// ── 관리자 설치 예약 제거 ──
window.adminRemoveInstallation = async (orderId, dateStr) => {
    if (!confirm('이 주문의 설치 시간 예약을 제거하시겠습니까?')) return;
    try {
        await sb.from('orders').update({ installation_time: null }).eq('id', orderId);
        showToast('설치 예약 제거 완료', 'success');
        openAdminSlotModal(dateStr);
        renderAdminCalendar();
    } catch (e) {
        showToast('제거 실패: ' + e.message, 'error');
    }
};

// ── 관리자 스케줄 차단 추가 ──
window.adminAddSlotBlock = async () => {
    const dateStr = window._adminSlotDate;
    const time = document.getElementById('adminSlotTime').value;
    const type = document.getElementById('adminSlotType').value;
    const memo = document.getElementById('adminSlotMemo').value || '관리자 차단';
    if (!dateStr || !time) return;

    try {
        const blocksToAdd = type === 'block_all' ? ADMIN_MAX_TEAMS : 1;
        for (let i = 0; i < blocksToAdd; i++) {
            await sb.from('orders').insert({
                delivery_target_date: dateStr,
                installation_time: time,
                total_amount: 1000000,
                manager_name: `[차단] ${memo}`,
                phone: '-',
                status: '관리자차단',
                payment_status: '-',
                items: [],
                site_code: 'KR'
            });
        }
        showToast(`${time} 슬롯 차단 완료 (${blocksToAdd}팀)`, 'success');
        document.getElementById('adminSlotMemo').value = '';
        openAdminSlotModal(dateStr);
        renderAdminCalendar();
    } catch (e) {
        showToast('차단 추가 실패: ' + e.message, 'error');
    }
};

// [헬퍼] 배송 데이터 업데이트
window.updateTaskDB = async (orderId, field, value) => {
    const valToSave = value === "" ? null : value;
    try {
        const { error } = await sb.from('orders').update({ [field]: valToSave }).eq('id', orderId);
        if (error) throw error;
    } catch (e) {
        showToast("업데이트 실패: " + e.message, "error");
    }
};

// 설치 예약 정보 표시 헬퍼
function getInstallationDisplayInfo(order) {
    if (!order.installation_time) return null;
    const SLOTS = ["08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
    const startIdx = SLOTS.indexOf(order.installation_time);
    if (startIdx === -1) return null;
    const total = order.total_amount || 0;
    let slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
    const endIdx = Math.min(startIdx + slots, SLOTS.length);
    const endTime = endIdx < SLOTS.length ? SLOTS[endIdx] : '22:00';
    return {
        start: order.installation_time,
        end: endTime,
        duration: slots === 7 ? '종일' : `${slots * 2}시간`,
        slots: slots
    };
}

window.updateOrderStaff = async (id, role, selectEl) => {
    const val = selectEl.value;
    const field = role === 'manager' ? 'staff_manager_id' : 'staff_driver_id';
    
    // 1. DB 업데이트 (비동기 처리하되 UI는 먼저 반응)
    sb.from('orders').update({ [field]: val || null }).eq('id', id).then(({ error }) => {
        if(error) showToast("담당자 변경 실패: " + error.message, "error");
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
        await creditReferralBonus(id); // 추천인 적립
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
            const { data: sData } = await sb.from('admin_staff').select('id, name, role, color');
            staffList = sData || [];
        }

        // 3. 쿼리 구성
        let query = sb.from('orders')
            .select('id, status, total_amount, items, created_at, payment_status, payment_method, manager_name, phone, address, site_code, staff_manager_id, staff_driver_id, delivery_target_date')
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
            showToast("해당 기간에 조회된 주문 내역이 없습니다.", "info");
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
        showToast("다운로드 실패: " + e.message, "error");
    } finally {
        showLoading(false);
    }
};
// [추가] 입찰 본사 직권 처리 (파트너 입찰 막기)
// ============================================================
// [수동주문] 모달 열기/닫기 + 등록
// ============================================================
window.openManualOrderModal = () => {
    // order_management.html에서는 showSection으로 오버라이드됨
    // global_admin.html에서는 모달을 사용
    const modal = document.getElementById('manualOrderModal');
    if (modal && modal.querySelector('.modal-box')) {
        document.getElementById('moSource').value = 'STORE';
        document.getElementById('moName').value = '';
        document.getElementById('moPhone').value = '';
        document.getElementById('moAddress').value = '';
        document.getElementById('moItems').value = '';
        document.getElementById('moAmount').value = '';
        document.getElementById('moDelivery').value = '';
        document.getElementById('moNote').value = '';
        document.getElementById('moFiles').value = '';
        modal.style.display = 'flex';
    }
};

window.submitManualOrder = async () => {
    const source = document.getElementById('moSource').value;
    const name = document.getElementById('moName').value.trim();
    const phone = document.getElementById('moPhone').value.trim();
    const address = document.getElementById('moAddress').value.trim();
    const itemsText = document.getElementById('moItems').value.trim();
    const amount = parseInt(document.getElementById('moAmount').value) || 0;
    const delivery = document.getElementById('moDelivery').value;
    const note = document.getElementById('moNote').value.trim();
    const fileInput = document.getElementById('moFiles');

    if (!name) { alert('고객명을 입력하세요.'); return; }
    if (!itemsText) { alert('주문내역을 입력하세요.'); return; }
    if (amount <= 0) { alert('주문총액을 입력하세요.'); return; }

    showLoading(true);
    try {
        const sourceName = source === 'STORE' ? '스마트스토어' : '고도몰';
        const payMethod = source === 'STORE' ? '스토어결제' : '고도몰결제';

        // items를 JSON 배열로 변환 (줄 단위로 분리)
        const lines = itemsText.split('\n').filter(l => l.trim());
        const items = lines.map(line => ({ productName: line.trim(), qty: 1 }));

        // DB 주문 생성
        const { data: orderData, error } = await sb.from('orders').insert([{
            manager_name: name,
            phone: phone,
            address: address,
            request_note: note ? `[${sourceName}] ${note}` : `[${sourceName}]`,
            total_amount: amount,
            discount_amount: 0,
            items: items,
            status: '접수됨',
            payment_status: '결제완료',
            payment_method: payMethod,
            site_code: source,
            delivery_target_date: delivery || null,
            created_at: new Date().toISOString()
        }]).select();

        if (error) throw error;
        const orderId = orderData[0].id;

        // 파일 업로드
        if (fileInput.files.length > 0) {
            const files = [];
            for (const f of fileInput.files) {
                const ext = f.name.split('.').pop().toLowerCase();
                const safe = Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + ext;
                const path = `orders/${orderId}/${safe}`;
                const { error: upErr } = await sb.storage.from('orders').upload(path, f);
                if (!upErr) {
                    const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                    files.push({ name: f.name, url: urlData.publicUrl, type: 'admin_added' });
                }
            }
            if (files.length > 0) {
                await sb.from('orders').update({ files }).eq('id', orderId);
            }
        }

        document.getElementById('manualOrderModal').style.display = 'none';
        alert(`✅ ${sourceName} 수동주문이 등록되었습니다. (주문번호: ${orderId})`);
        loadOrders();
    } catch (e) {
        console.error('[수동주문] 오류:', e);
        alert('주문 등록 실패: ' + e.message);
    } finally {
        showLoading(false);
    }
};
