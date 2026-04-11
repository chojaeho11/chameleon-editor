import { sb } from "./global_config.js?v=288";

// [매출 통계 로드] - 검색 버튼 클릭 시 실행
window.loadStatsData = async () => {
    // 1. 대시보드 차트 로드 (자동 실행)
    loadDashboardCharts();

    // 2. 날짜 자동 설정 (이번 달 1일 ~ 오늘)
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
        // [검색 기간 데이터 조회]
        const { data: orders, error } = await sb.from('orders')
            .select('id, total_amount, items, staff_manager_id, staff_driver_id, status, created_at, payment_status')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .not('status', 'eq', '임시작성') 
            .not('status', 'eq', '취소됨');

        if (error) throw error;

        // 집계 변수
        let totalRevenue = 0;
        const managerStats = {};
        const driverStats = {};

        // 스태프 목록 가져오기
        const { data: staffList } = await sb.from('admin_staff').select('id, name, role, color');

        orders.forEach(o => {
            // 매출 인정 기준: 결제완료 계열 상태
            const validPayment = ['결제완료', '입금확인', '카드결제완료', '입금확인됨', 'paid'].includes(o.payment_status);
            if(!validPayment) return; // 미결제 건은 매출 통계에서 제외 (원하시면 주석 처리)

            let amt = o.total_amount || 0;
            totalRevenue += amt;

            if(o.staff_manager_id) managerStats[o.staff_manager_id] = (managerStats[o.staff_manager_id] || 0) + amt;
            if(o.staff_driver_id) driverStats[o.staff_driver_id] = (driverStats[o.staff_driver_id] || 0) + amt;
        });

        document.getElementById('totalRevenue').innerText = totalRevenue.toLocaleString() + '원';
        document.getElementById('totalCount').innerText = orders.length + '건';

        renderStaffStats('statManagerBody', managerStats, staffList || [], totalRevenue);
        renderStaffStats('statDriverBody', driverStats, staffList || [], totalRevenue);

    } catch (e) {
        console.error(e);
        const errHtml = `<tr><td colspan="2" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
        if(mgrBody) mgrBody.innerHTML = errHtml;
        if(drvBody) drvBody.innerHTML = errHtml;
    }
};

// [신규] 대시보드 차트 데이터 로드 및 렌더링
async function loadDashboardCharts() {
    const yearTotalEl = document.getElementById('yearTotalRevenue');
    if(!yearTotalEl) return;

    // 올해 1월 1일부터 조회
    const now = new Date();
    const currentYear = now.getFullYear();
    const statsYearEl = document.getElementById('statsYear');
    if(statsYearEl) statsYearEl.textContent = currentYear;
    const startOfYear = `${currentYear}-01-01T00:00:00`;
    
    try {
        // 올해 전체 주문 가져오기 (결제완료된 것만)
        const { data: orders, error } = await sb.from('orders')
            .select('created_at, total_amount, payment_status')
            .gte('created_at', startOfYear)
            .in('payment_status', ['결제완료', '입금확인', '카드결제완료', '입금확인됨', 'paid']);

        if(error) throw error;

        let yearSum = 0;
        const monthlySum = new Array(12).fill(0); // 0~11 (1월~12월)
        
        // 최근 7일 날짜 라벨 생성
        const dailyLabels = [];
        const dailyData = [];
        const today = new Date();
        
        for(let i=6; i>=0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyLabels.push(i === 0 ? "오늘" : (i === 1 ? "어제" : `${i}일전`));
            dailyData.push({ date: dateStr, sum: 0 });
        }

        // 데이터 집계
        orders.forEach(o => {
            const amt = o.total_amount || 0;
            const date = new Date(o.created_at);
            const dateStr = o.created_at.split('T')[0];
            const monthIdx = date.getMonth(); // 0(1월) ~ 11(12월)

            // 1. 올해 총 매출
            yearSum += amt;

            // 2. 월별 매출
            monthlySum[monthIdx] += amt;

            // 3. 최근 7일 매출
            const dayObj = dailyData.find(d => d.date === dateStr);
            if(dayObj) dayObj.sum += amt;
        });

        // UI 업데이트
        yearTotalEl.innerText = yearSum.toLocaleString() + "원";
        const pageTitleEl = document.querySelector('.page-title');
        if (pageTitleEl) pageTitleEl.innerText = `통계 대시보드 (${currentYear}년)`;

        // 차트 그리기
        renderChart('chartDaily', 'bar', dailyLabels, dailyData.map(d => d.sum), '#6366f1');
        renderChart('chartMonthly', 'line', ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], monthlySum, '#10b981');

    } catch(e) {
        console.error("차트 로드 실패:", e);
    }
}

let chartInstances = {}; // 차트 중복 생성 방지용

function renderChart(canvasId, type, labels, data, color) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    // 기존 차트 파괴 (메모리 누수 방지)
    if(chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: '매출액',
                data: data,
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1,
                tension: 0.3 // 곡선
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (val) => val.toLocaleString() } }
            }
        }
    });
}


function renderStaffStats(elemId, statsObj, staffList, totalRev) { 
    const tbody = document.getElementById(elemId); 
    if(!tbody) return;
    tbody.innerHTML = ''; 

    const sortedIds = Object.keys(statsObj).sort((a,b) => statsObj[b] - statsObj[a]); 

    if(sortedIds.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:15px; color:#999;">데이터 없음</td></tr>'; 
        return; 
    } 

    sortedIds.forEach(id => { 
        const s = staffList.find(st => st.id == id); 
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

// [경리과 통합 결산 관리] - 기존 코드 유지
// (이전에 작성된 loadAccountingData 등의 코드는 여기에 그대로 두거나, 필요한 경우 아래 코드로 덮어쓰세요)
// ==========================================
// [전역 변수] 엑셀 다운로드용 데이터 캐싱
let cachedAccOrders = [];
let cachedAccWithdrawals = [];
let cachedAccProfiles = [];

window.loadAccountingData = async () => {
    // (기존 코드와 동일)
    const startInput = document.getElementById('accStartDate');
    const endInput = document.getElementById('accEndDate');
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
        // --- (A) 예치금 총액 + (B) 매출 + 상품 원가를 병렬 조회 ---
        const [depositRes, ordersRes, prodsRes] = await Promise.all([
            sb.from('profiles').select('deposit'),
            sb.from('orders')
                .select('id, total_amount, discount_amount, items, payment_status')
                .gte('created_at', start + 'T00:00:00')
                .lte('created_at', end + 'T23:59:59')
                .in('payment_status', ['결제완료', '입금확인', '카드결제완료', '입금확인됨', 'paid']),
            sb.from('admin_products').select('name, price')
        ]);

        if (depositRes.error) throw depositRes.error;
        if (ordersRes.error) throw ordersRes.error;

        cachedAccProfiles = depositRes.data || [];
        const totalDeposit = cachedAccProfiles.reduce((acc, cur) => acc + (cur.deposit || 0), 0);
        document.getElementById('accTotalDeposit').innerText = totalDeposit.toLocaleString() + "원";

        cachedAccOrders = ordersRes.data || [];

        let totalSales = 0;
        let totalDiscount = 0;

        // 상품 원가표
        const { data: prods } = prodsRes;
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
            .select('id, user_id, amount, status, created_at, tax_invoice_url, processed_at')
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
            const { data: users } = await sb.from('profiles').select('id, full_name, role').in('id', uids);
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
        showToast("경리 데이터 조회 실패 (콘솔확인필요): " + e.message, "error");
    } finally {
        showLoading(false);
    }
};

// [엑셀 다운로드 함수들]
window.downloadAccSales = () => {
    if (!cachedAccOrders.length) { showToast("데이터가 없습니다. 먼저 조회해주세요.", "warn"); return; }
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
    if (!list.length) { showToast("미지급 내역이 없습니다.", "info"); return; }
    const data = list.map(w => ({ "요청일": new Date(w.created_at).toLocaleDateString(), "이름": w.userName, "금액": w.amount, "은행": w.bank_name, "계좌": w.account_number }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "미지급");
    XLSX.writeFile(wb, `미지급현황_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.downloadAccDeposit = () => {
    const list = cachedAccProfiles.filter(p => p.deposit > 0);
    if (!list.length) { showToast("예치금 보유 회원이 없습니다.", "info"); return; }
    const data = list.map(p => ({ "이름": p.full_name, "이메일": p.email, "잔액": p.deposit }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "예치금");
    XLSX.writeFile(wb, `예치금현황_${new Date().toISOString().slice(0,10)}.xlsx`);
};

window.downloadAccDiscount = () => {
    const list = cachedAccOrders.filter(o => o.discount_amount > 0);
    if (!list.length) { showToast("할인 내역이 없습니다.", "info"); return; }
    const data = list.map(o => ({ "주문일": new Date(o.created_at).toLocaleDateString(), "주문자": o.manager_name, "결제액": o.total_amount, "할인액": o.discount_amount }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "할인내역");
    XLSX.writeFile(wb, `할인내역_${new Date().toISOString().slice(0,10)}.xlsx`);
};