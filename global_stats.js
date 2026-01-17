import { sb } from "./global_config.js";

// [매출 통계 로드]
window.loadStatsData = async () => {
    // 1. 날짜 자동 설정 (이번 달 1일 ~ 오늘)
    const startDateInput = document.getElementById('statStartDate');
    const endDateInput = document.getElementById('statEndDate');

    if (!startDateInput.value || !endDateInput.value) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000)); 
        const todayStr = krNow.toISOString().split('T')[0];
        const year = krNow.getFullYear();
        const month = String(krNow.getMonth() + 1).padStart(2, '0');
        const firstDayStr = `${year}-${month}-01`;

        startDateInput.value = firstDayStr;
        endDateInput.value = todayStr;
    }

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    // 로딩 UI 표시
    const mgrBody = document.getElementById('statManagerBody');
    const drvBody = document.getElementById('statDriverBody');
    if(mgrBody) mgrBody.innerHTML = '<tr><td colspan="2" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';
    if(drvBody) drvBody.innerHTML = '<tr><td colspan="2" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';

    try {
        // [백업 로직 복원 1] 상품 단가표 가져오기 (매출 0원일 때 역산용)
        const { data: allProds } = await sb.from('admin_products').select('price, name');
        const prodMap = {}; 
        if(allProds) allProds.forEach(p => prodMap[p.name] = p.price);

        // [백업 로직 복원 2] 스태프 목록 가져오기 (그래프 색상/이름 표시용)
        const { data: staffList } = await sb.from('admin_staff').select('*');

        // [오류 수정] DB에 없는 discount_amount 등을 빼고, 필요한 컬럼만 안전하게 조회
        const { data: orders, error } = await sb.from('orders')
            .select('id, total_amount, items, staff_manager_id, staff_driver_id, status, created_at')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .not('status', 'eq', '임시작성') 
            .not('status', 'eq', '취소됨');

        if (error) throw error;

        // 집계 변수
        let totalRevenue = 0;
        const managerStats = {};
        const driverStats = {};

        orders.forEach(o => {
            // [백업 로직 복원 3] 매출 계산 알고리즘
            let amt = o.total_amount || 0;
            
            // total_amount가 0원이면 아이템 단가로 역산 시도 (백업 파일 방식)
            if(amt === 0) {
                let items = o.items;
                // JSON 파싱 안전 처리
                if (typeof items === 'string') { 
                    try { items = JSON.parse(items); } catch(e) { items = []; } 
                }
                
                if(Array.isArray(items)) {
                    items.forEach(i => {
                        let p = 0;
                        // 1순위: 아이템 자체 가격, 2순위: 상품테이블 가격, 3순위: 백업 기본값
                        if(i.product && i.product.price) p = i.product.price;
                        else if(i.product && prodMap[i.product.name]) p = prodMap[i.product.name];
                        else if(i.productName && prodMap[i.productName]) p = prodMap[i.productName];
                        
                        if(!p) p = i.price || 0; 
                        
                        amt += p * (i.qty || 1);
                    });
                }
            }

            totalRevenue += amt;

            // 매니저별 집계 (ID 기준)
            if(o.staff_manager_id) {
                managerStats[o.staff_manager_id] = (managerStats[o.staff_manager_id] || 0) + amt;
            }
            // 기사별 집계 (ID 기준)
            if(o.staff_driver_id) {
                driverStats[o.staff_driver_id] = (driverStats[o.staff_driver_id] || 0) + amt;
            }
        });

        // 결과 표시
        document.getElementById('totalRevenue').innerText = totalRevenue.toLocaleString() + '원';
        document.getElementById('totalCount').innerText = orders.length + '건';

        // 테이블 렌더링 (그래프바 포함)
        renderStaffStats('statManagerBody', managerStats, staffList || [], totalRevenue);
        renderStaffStats('statDriverBody', driverStats, staffList || [], totalRevenue);

    } catch (e) {
        console.error(e);
        const errHtml = `<tr><td colspan="2" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
        if(mgrBody) mgrBody.innerHTML = errHtml;
        if(drvBody) drvBody.innerHTML = errHtml;
    }
};

// [백업 로직 복원 4] 그래프바가 포함된 렌더링 함수
function renderStaffStats(elemId, statsObj, staffList, totalRev) { 
    const tbody = document.getElementById(elemId); 
    if(!tbody) return;
    tbody.innerHTML = ''; 

    // 매출 높은 순 정렬
    const sortedIds = Object.keys(statsObj).sort((a,b) => statsObj[b] - statsObj[a]); 

    if(sortedIds.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:15px; color:#999;">데이터 없음</td></tr>'; 
        return; 
    } 

    sortedIds.forEach(id => { 
        const s = staffList.find(st => st.id == id); 
        // 스태프 정보가 삭제되었을 경우 대비
        const name = s ? s.name : `(삭제됨:${id})`;
        const color = s ? s.color : '#cbd5e1';
        
        const amt = statsObj[id]; 
        const percent = totalRev > 0 ? Math.round((amt / totalRev) * 100) : 0; 
        
        tbody.innerHTML += `
            <tr>
                <td style="padding:12px 0;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <div style="width:12px; height:12px; border-radius:50%; background:${color};"></div>
                        <span style="font-weight:bold; color:#334155;">${name}</span>
                    </div>
                    <div class="progress-bar-bg" style="background:#f1f5f9; height:6px; border-radius:3px; overflow:hidden;">
                        <div class="progress-bar-fill" style="width:${percent}%; background:${color}; height:100%;"></div>
                    </div>
                </td>
                <td style="text-align:right; vertical-align:middle;">
                    <div style="font-weight:bold; color:#0f172a;">${amt.toLocaleString()}원</div>
                    <div style="font-size:11px; color:#999;">${percent}%</div>
                </td>
            </tr>`; 
    }); 
}
// ==========================================
// [경리과 통합 결산 관리]
// ==========================================

// [전역 변수] 엑셀 다운로드용 데이터 캐싱
let cachedAccOrders = [];
let cachedAccWithdrawals = [];
let cachedAccProfiles = [];

window.loadAccountingData = async () => {
    const startInput = document.getElementById('accStartDate');
    const endInput = document.getElementById('accEndDate');

    // 1. 날짜가 비어있으면 자동 설정
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
    showLoading(true);

    try {
        // --- (A) 예치금 총액 조회 ---
        // [수정] select('*')로 변경하여 'deposit' 컬럼 이름이 달라도 에러 안 나게 함
        const { data: profiles, error: pError } = await sb.from('profiles').select('*');
        if (pError) throw pError;

        cachedAccProfiles = profiles || [];
        // DB에 deposit 컬럼이 없으면 0으로 처리
        const totalDeposit = cachedAccProfiles.reduce((acc, cur) => acc + (cur.deposit || 0), 0);
        document.getElementById('accTotalDeposit').innerText = totalDeposit.toLocaleString() + "원";

        // --- (B) 매출 조회 ---
        // [수정] select('*')로 변경
        const { data: orders, error: oError } = await sb.from('orders')
            .select('*') 
            .gte('created_at', start + 'T00:00:00')
            .lte('created_at', end + 'T23:59:59')
            .in('payment_status', ['결제완료', '입금확인', '카드결제완료', '입금확인됨', 'paid']);

        if (oError) throw oError;
        cachedAccOrders = orders || [];

        let totalSales = 0;
        let totalDiscount = 0;

        // 상품 원가표
        const { data: prods } = await sb.from('admin_products').select('name, price');
        const prodMap = {}; 
        if(prods) prods.forEach(p => prodMap[p.name] = p.price);

        cachedAccOrders.forEach(o => {
            totalSales += (o.total_amount || 0);

            let items = [];
            try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items; } catch(e){}
            
            let rawTotal = 0;
            if(items && Array.isArray(items)) {
                items.forEach(i => {
                    let price = i.price || (i.product ? i.product.price : 0) || 0;
                    if (price === 0 && prodMap[i.productName]) price = prodMap[i.productName] || 0;
                    rawTotal += price * (i.qty || 1);
                });
            }

            if (o.discount_amount && o.discount_amount > 0) {
                totalDiscount += o.discount_amount;
            } else if (rawTotal > o.total_amount) {
                o.discount_amount = rawTotal - o.total_amount; 
                totalDiscount += o.discount_amount;
            }
        });

        document.getElementById('accTotalSales').innerText = totalSales.toLocaleString() + "원";
        document.getElementById('accTotalDiscount').innerText = totalDiscount.toLocaleString() + "원";

        // --- (C) 정산(출금) 내역 조회 ---
        const { data: withdraws, error: wError } = await sb.from('withdrawal_requests')
            .select('*')
            .gte('created_at', start + 'T00:00:00')
            .lte('created_at', end + 'T23:59:59')
            .order('created_at', {ascending: false});

        if (wError) throw wError;
        cachedAccWithdrawals = withdraws || [];

        let partnerHtml = '';
        let freeHtml = '';
        let unpaidTotal = 0;

        const uids = [...new Set(cachedAccWithdrawals.map(w => w.user_id))];
        const userMap = {};
        if(uids.length > 0) {
            const { data: users } = await sb.from('profiles').select('*').in('id', uids);
            if(users) users.forEach(u => userMap[u.id] = u);
        }

        cachedAccWithdrawals.forEach(w => {
            const u = userMap[w.user_id] || { full_name: '미상', role: 'customer' };
            w.userName = u.full_name; 
            if (w.status === 'pending') unpaidTotal += w.amount;

            const statusBadge = w.status === 'pending' 
                ? `<span style="color:#d97706; font-weight:bold;">대기</span>` 
                : `<span style="color:#15803d;">완료</span>`;

            const row = `
                <tr>
                    <td>${new Date(w.created_at).toLocaleDateString()}</td>
                    <td>${u.full_name}</td>
                    <td style="text-align:right;">${w.amount.toLocaleString()}</td>
                    <td style="text-align:center;">${w.tax_invoice_url ? '<a href="'+w.tax_invoice_url+'" target="_blank">📄보기</a>' : '-'}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                </tr>`;

            if (u.role === 'franchise' || u.role === 'platinum') partnerHtml += row;
            else freeHtml += row;
        });
        
        document.getElementById('accPartnerBody').innerHTML = partnerHtml || '<tr><td colspan="5" style="text-align:center; padding:20px;">내역 없음</td></tr>';
        document.getElementById('accFreelancerBody').innerHTML = freeHtml || '<tr><td colspan="5" style="text-align:center; padding:20px;">내역 없음</td></tr>';
        document.getElementById('accUnpaidTotal').innerText = unpaidTotal.toLocaleString() + "원";

    } catch (e) {
        console.error(e);
        // 에러 내용을 구체적으로 띄워줌
        alert("경리 데이터 조회 실패 (콘솔확인필요): " + e.message);
    } finally {
        showLoading(false);
    }
};

// [엑셀 다운로드 함수들]
window.downloadAccSales = () => {
    if (!cachedAccOrders.length) return alert("데이터가 없습니다. 먼저 조회해주세요.");
    const data = cachedAccOrders.map(o => ({
        "주문일자": new Date(o.created_at).toLocaleDateString(),
        "주문자": o.manager_name,
        "결제금액": o.total_amount,
        "할인금액": o.discount_amount || 0
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "매출내역");
    XLSX.writeFile(wb, `매출결산_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.downloadAccUnpaid = () => {
    const list = cachedAccWithdrawals.filter(w => w.status === 'pending');
    if (!list.length) return alert("미지급 내역이 없습니다.");
    const data = list.map(w => ({ "요청일": new Date(w.created_at).toLocaleDateString(), "이름": w.userName, "금액": w.amount, "은행": w.bank_name, "계좌": w.account_number }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "미지급");
    XLSX.writeFile(wb, `미지급현황_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.downloadAccDeposit = () => {
    const list = cachedAccProfiles.filter(p => p.deposit > 0);
    if (!list.length) return alert("예치금 보유 회원이 없습니다.");
    const data = list.map(p => ({ "이름": p.full_name, "이메일": p.email, "잔액": p.deposit }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "예치금");
    XLSX.writeFile(wb, `예치금현황_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.downloadAccDiscount = () => {
    const list = cachedAccOrders.filter(o => o.discount_amount > 0);
    if (!list.length) return alert("할인 내역이 없습니다.");
    const data = list.map(o => ({ "주문일": new Date(o.created_at).toLocaleDateString(), "주문자": o.manager_name, "결제액": o.total_amount, "할인액": o.discount_amount }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "할인내역");
    XLSX.writeFile(wb, `할인내역_${new Date().toISOString().slice(0,10)}.xlsx`);
};