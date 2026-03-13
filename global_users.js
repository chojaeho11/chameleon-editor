import { sb } from "./global_config.js?v=175";
import { showLoading } from "./global_common.js?v=175";

// ==========================================
// [회원 관리 통합] 페이지네이션 & 검색 & 메모
// ==========================================

// [전역 변수] 회원 페이지네이션용
let currentMemberPage = 1;
const memberItemsPerPage = 30; // 한 페이지당 30명

// [회원 목록 로드] - 원상복구
window.loadMembers = async (isNewSearch = false) => {
    if(isNewSearch) currentMemberPage = 1;

    const keyword = document.getElementById('memberSearchInput') ? document.getElementById('memberSearchInput').value.trim() : '';
    const sortVal = document.getElementById('memberSort').value;
    const roleVal = document.getElementById('memberFilterRole').value;
    const siteVal = document.getElementById('memberFilterSite') ? document.getElementById('memberFilterSite').value : 'all';
    const tbody = document.getElementById('memberListBody');

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';

    try {

    let query = sb.from('profiles').select('id, email, username, role, deposit, mileage, total_spend, logo_count, contributor_tier, penalty_reason, admin_memo, created_at, site', { count: 'exact' });
    if (roleVal !== 'all') query = query.eq('role', roleVal);
    if (siteVal !== 'all') query = query.eq('site', siteVal);
    if (keyword) {
        // UUID 형식이면 ID 직접 검색, 아니면 이메일/이름 검색
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyword);
        if (isUUID) {
            query = query.eq('id', keyword);
        } else {
            query = query.or(`email.ilike.%${keyword}%,username.ilike.%${keyword}%`);
        }
    }

    if (sortVal === 'deposit_desc') query = query.order('deposit', { ascending: false });
    else if (sortVal === 'deposit_asc') query = query.order('deposit', { ascending: true });
    else if (sortVal === 'mileage_desc') query = query.order('mileage', { ascending: false });
    else if (sortVal === 'spend_desc') query = query.order('total_spend', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    // 먼저 count만 가져와서 페이지 범위 보정
    const countQuery = sb.from('profiles').select('id', { count: 'exact', head: true });
    if (roleVal !== 'all') countQuery.eq('role', roleVal);
    if (siteVal !== 'all') countQuery.eq('site', siteVal);
    if (keyword) {
        const isUUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyword);
        if (isUUID2) countQuery.eq('id', keyword);
        else countQuery.or(`email.ilike.%${keyword}%,username.ilike.%${keyword}%`);
    }
    const { count: totalCount } = await countQuery;
    const maxPage = Math.ceil((totalCount || 0) / memberItemsPerPage) || 1;
    if (currentMemberPage > maxPage) currentMemberPage = maxPage;

    const from = (currentMemberPage - 1) * memberItemsPerPage;
    const to = Math.min(from + memberItemsPerPage - 1, (totalCount || 1) - 1);
    const { data: members, count, error } = await query.range(from, to);

    if (error) {
        console.error('회원 목록 로드 오류:', error);
        // 416 에러 시 첫 페이지로 리셋 후 재시도
        if (currentMemberPage > 1) {
            currentMemberPage = 1;
            return window.loadMembers();
        }
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;">로딩 오류: ' + (error.message || '알 수 없는 오류') + '<br><button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="loadMembers()">다시 시도</button></td></tr>';
        return;
    }

    document.getElementById('totalMemberCount').innerText = `${(count||0).toLocaleString()}명`;
    const totalPages = Math.ceil((count||0) / memberItemsPerPage) || 1;
    document.getElementById('memberPageLabel').innerText = `Page ${currentMemberPage} / ${totalPages}`;

    tbody.innerHTML = '';
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">회원이 없습니다.</td></tr>';
        return;
    }

    // 추천인 적립 내역 조회 (현재 페이지 회원들)
    const memberIds = members.map(m => m.id);
    let refMap = {}; // { userId: { total, count } }
    try {
        const { data: refLogs } = await sb.from('wallet_logs')
            .select('user_id, amount')
            .in('user_id', memberIds)
            .eq('type', 'referral_bonus');
        if (refLogs) {
            refLogs.forEach(r => {
                if (!refMap[r.user_id]) refMap[r.user_id] = { total: 0, count: 0 };
                refMap[r.user_id].total += (r.amount || 0);
                refMap[r.user_id].count += 1;
            });
        }
    } catch(e) {}

    members.forEach(m => {
        let name = m.username || m.email?.split('@')[0] || '미등록';
        let badgeColor = '#f1f5f9'; let displayRole = '일반';
        if (m.role === 'gold') { badgeColor = '#fef9c3'; displayRole = '골드'; }
        if (m.role === 'platinum') { badgeColor = '#e0f2fe'; displayRole = '플레티넘'; }
        if (m.role === 'franchise') { badgeColor = '#f3e8ff'; displayRole = '가맹점'; }
        if (m.role === 'subscriber') { badgeColor = '#ede9fe'; displayRole = '⭐구독자'; }
        if (m.role === 'admin') { badgeColor = '#fee2e2'; displayRole = '관리자'; }

        // 추천인 적립 배지
        const ref = refMap[m.id];
        const refBadge = ref
            ? `<span style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:4px;" title="추천인 적립 ${ref.count}건 / 총 ${ref.total.toLocaleString()}원">🤝 추천 ${ref.total.toLocaleString()}원</span>`
            : '';

        // 등급 선택 박스
        const roleSelect = `
            <select onchange="updateMemberRole('${m.id}', this.value)" style="border:1px solid #ddd; font-size:11px;">
                <option value="customer" ${m.role==='customer'?'selected':''}>일반</option>
                <option value="gold" ${m.role==='gold'?'selected':''}>골드</option>
                <option value="platinum" ${m.role==='platinum'?'selected':''}>플레티넘</option>
                <option value="subscriber" ${m.role==='subscriber'?'selected':''}>⭐구독자</option>
                <option value="franchise" ${m.role==='franchise'?'selected':''}>가맹점</option>
                <option value="admin" ${m.role==='admin'?'selected':''}>관리자</option>
            </select>
        `;

        const memoHtml = `
            <div style="display:flex; gap:2px;">
                <input id="memo_${m.id}" value="${(m.admin_memo||'').replace(/"/g, '&quot;')}" style="width:100%; border:1px solid #eee; font-size:11px;">
                <button class="btn btn-sky btn-sm" onclick="updateMemberMemo('${m.id}')">저장</button>
            </div>
        `;

        const siteFlag = m.site === 'JP' ? '🇯🇵' : m.site === 'US' ? '🇺🇸' : m.site === 'KR' ? '🇰🇷' : '🌐';

        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #f1f5f9; height:50px;${ref ? ' background:#fffbeb;' : ''}">
                <td style="color:#64748b; font-size:12px; text-align:center;">${new Date(m.created_at).toLocaleDateString()}</td>
                <td style="padding:10px 15px;">
                    <div style="font-weight:bold; font-size:14px; color:#1e293b;">${siteFlag} ${name}${refBadge}</div>
                    <div style="font-size:12px; color:#64748b;">${m.email}</div>
                </td>
                <td style="text-align:right; padding:10px 15px;">
                   <div style="font-size:13px;">💰 ${(m.deposit||0).toLocaleString()} / Ⓜ️ ${(m.mileage||0).toLocaleString()}</div>
                </td>
                <td style="padding:5px; text-align:center;">
    <button class="btn btn-outline btn-sm" onclick="openWalletModal('${m.id}', '${m.email}', ${m.deposit||0})">예치금</button>
    <button class="btn btn-outline btn-sm" style="margin-left:4px; color:#d97706; border-color:#d97706;" onclick="editMileageManual('${m.id}', '${m.email}', ${m.mileage||0})">마일리지</button>
    <button class="btn btn-outline btn-sm" style="margin-left:4px; color:#6366f1; border-color:#6366f1;" onclick="openPwResetModal('${m.id}', '${m.email}')">🔑비번</button>
    <button class="btn btn-outline btn-sm" style="margin-left:4px; color:#0891b2; border-color:#0891b2;" onclick="viewMemberOrders('${m.id}', '${name.replace(/'/g, "\\'")}')">📦주문</button>
</td>
                <td style="padding:5px 15px;">${memoHtml}</td>
                <td style="text-align:center;"><span class="badge" style="background:${badgeColor}; font-size:11px;">${displayRole}</span></td>
                <td style="padding:5px 15px;">${roleSelect}</td>
            </tr>
        `;
    });

    } catch(e) {
        console.error('회원 목록 로드 예외:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#ef4444;">로딩 오류: ' + (e.message||e) + '<br><button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="loadMembers()">다시 시도</button></td></tr>';
    }
};

// [페이지 변경 함수]
window.changeMemberPage = (step) => {
    const next = currentMemberPage + step;
    if(next < 1) { showToast("첫 페이지입니다.", "info"); return; }
    currentMemberPage = next;
    loadMembers(false); 
};

// [회원 메모 저장]
window.updateMemberMemo = async (userId) => {
    const memoVal = document.getElementById(`memo_${userId}`).value;
    const { error } = await sb.from('profiles').update({ admin_memo: memoVal }).eq('id', userId);
    if(error) showToast("저장 실패: " + error.message, "error");
    else showToast("메모가 저장되었습니다.", "success");
};

// [회원 등급 변경]
window.updateMemberRole = async (id, newRole) => { 
    if(!confirm(`등급을 '${newRole}'(으)로 변경하시겠습니까?`)) { 
        loadMembers(false); return; 
    } 
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', id); 
    if(error) showToast("실패: " + error.message, "error");
    else showToast("변경되었습니다.", "success");
};

// [기여자 등급 변경] - 패널티 사유 입력 기능 추가
window.updateContributorTier = async (id, newTier) => {
    let reason = null;

    if (newTier === 'penalty') {
        reason = prompt("🚫 패널티 부여 사유를 입력해주세요.\n(이 내용은 사용자 마이페이지에 표시됩니다.)", "저작권 위반 / 부적절한 이미지");
        if (reason === null) { // 취소 시 복구
            loadMembers(false); 
            return;
        }
    } else {
        if(!confirm("기여자 등급을 변경하시겠습니까?")) {
            loadMembers(false); return;
        }
    }

    const updateData = { contributor_tier: newTier, penalty_reason: reason };
    const { error } = await sb.from('profiles').update(updateData).eq('id', id);
    
    if(error) showToast("실패: " + error.message, "error");
    else { showToast("변경되었습니다.", "success"); loadMembers(false); }
};

// =======================================================
// [새로 추가된 기능] 예치금(Wallet) 모달 제어 함수들
// =======================================================

// 1. 모달 열기
window.openWalletModal = (id, email, currentAmount) => {
    const modal = document.getElementById('walletModal');
    if(!modal) return;

    // hidden input에 값 설정
    document.getElementById('walletTargetId').value = id;
    
    // UI 텍스트 설정
    document.getElementById('walletTargetName').innerText = email;
    document.getElementById('walletTargetBalance').innerText = (currentAmount || 0).toLocaleString() + '원';
    
    // 입력창 초기화
    document.getElementById('walletAmount').value = '';
    document.getElementById('walletDesc').value = '';

    // 기본 모드를 '충전(add)'으로 설정
    setWalletMode('add');
    
    modal.style.display = 'flex';
};

// 2. 충전/차감 모드 전환
window.setWalletMode = (mode) => {
    const btnAdd = document.getElementById('btnWalletAdd');
    const btnSub = document.getElementById('btnWalletSub');
    const submitBtn = document.getElementById('btnWalletSubmit');
    
    document.getElementById('walletMode').value = mode;

    if(mode === 'add') {
        // 충전 모드 스타일
        btnAdd.classList.add('btn-primary');
        btnAdd.classList.remove('btn-outline');
        btnSub.classList.add('btn-outline');
        btnSub.classList.remove('btn-danger'); // 기존 CSS에 없으면 무시됨
        
        submitBtn.innerText = "충전하기";
        submitBtn.className = "btn btn-primary"; // 파란 버튼
    } else {
        // 차감 모드 스타일
        btnAdd.classList.add('btn-outline');
        btnAdd.classList.remove('btn-primary');
        btnSub.classList.remove('btn-outline');
        // btn-danger 클래스가 있다면 사용, 없으면 inline style
        btnSub.style.background = '#fee2e2';
        btnSub.style.color = '#ef4444';
        
        submitBtn.innerText = "차감하기";
        submitBtn.className = "btn btn-danger"; // 빨간 버튼
    }
    submitBtn.style.width = '100%';
    submitBtn.style.marginTop = '10px';
};

// 3. 예치금 변경 실행 (DB 업데이트)
window.submitWalletChange = async () => {
    const id = document.getElementById('walletTargetId').value;
    const mode = document.getElementById('walletMode').value;
    const amountVal = document.getElementById('walletAmount').value;
    
    if(!amountVal || parseInt(amountVal) <= 0) { showToast("금액을 정확히 입력해주세요.", "warn"); return; }
    
    const amount = parseInt(amountVal);
    
    showLoading(true);

    try {
        // 1. 현재 잔액 다시 확인 (안전장치)
        const { data: profile, error: fetchErr } = await sb.from('profiles').select('deposit').eq('id', id).single();
        if(fetchErr) throw fetchErr;

        const currentDeposit = profile.deposit || 0;
        let newDeposit = 0;

        if(mode === 'add') {
            newDeposit = currentDeposit + amount;
        } else {
            newDeposit = currentDeposit - amount;
            if(newDeposit < 0) {
                if(!confirm(`잔액이 부족합니다. (현재: ${currentDeposit}원)\n그래도 차감하여 마이너스로 만드시겠습니까?`)) {
                    showLoading(false);
                    return;
                }
            }
        }

        // 2. DB 업데이트
        const { error: updateErr } = await sb.from('profiles').update({ deposit: newDeposit }).eq('id', id);
        if(updateErr) throw updateErr;

        // 3. 성공 처리
        showToast("처리가 완료되었습니다.", "success");
        document.getElementById('walletModal').style.display = 'none';
        loadMembers(); // 목록 새로고침

    } catch(e) {
        showToast("오류 발생: " + e.message, "error");
    } finally {
        showLoading(false);
    }
};

// =======================================================
// 기존 함수들 계속...
// =======================================================

// [마일리지 엑셀 업로드]
window.importMileageExcel = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (!confirm(`'${file.name}' 파일에서 이메일과 마일리지를 읽어 업데이트하시겠습니까?`)) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) throw new Error("데이터가 없습니다.");

            showLoading(true);
            let successCount = 0;
            let failCount = 0;

            // 배치 처리: 10개씩 병렬 실행
            const batch = [];
            for (const row of jsonData) {
                const email = row['이메일'] || row['email'] || row['Email'];
                const mileageVal = row['마일리지'] || row['mileage'] || row['적립금'];
                if (email && mileageVal !== undefined) {
                    const amount = parseInt(mileageVal);
                    if (!isNaN(amount)) batch.push({ email, amount });
                }
            }
            for (let i = 0; i < batch.length; i += 10) {
                const chunk = batch.slice(i, i + 10);
                const results = await Promise.all(
                    chunk.map(({ email, amount }) => sb.from('profiles').update({ mileage: amount }).eq('email', email))
                );
                results.forEach(r => r.error ? failCount++ : successCount++);
            }
            showToast(`완료: 성공 ${successCount}명, 실패 ${failCount}명`, "success");
            loadMembers();
        } catch (err) {
            showToast("엑셀 오류: " + err.message, "error");
        } finally {
            showLoading(false);
            input.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
};

// [마일리지 수동 관리]
window.editMileageManual = async (userId, email, currentMileage) => {
    const newAmountStr = prompt(`[${email}] 현재 마일리지: ${currentMileage}P\n최종 마일리지를 입력하세요:`, currentMileage);
    if (newAmountStr === null) return;
    const newAmount = parseInt(newAmountStr);
    if (isNaN(newAmount)) { showToast("숫자만 입력해주세요.", "warn"); return; }

    const { error } = await sb.from('profiles').update({ mileage: newAmount }).eq('id', userId);
    if (error) showToast("수정 실패: " + error.message, "error");
    else { showToast("수정되었습니다.", "success"); loadMembers(); }
};


// [비밀번호 리셋]
window.openPwResetModal = (userId, email) => {
    const modal = document.getElementById('pwResetModal');
    if (!modal) return;
    document.getElementById('pwResetTargetId').value = userId;
    document.getElementById('pwResetTargetName').innerText = email;
    document.getElementById('pwResetNewPw').value = '';
    modal.style.display = 'flex';
};

window.submitPwReset = async () => {
    const userId = document.getElementById('pwResetTargetId').value;
    const newPw = document.getElementById('pwResetNewPw').value.trim();
    if (!newPw) { showToast("새 비밀번호를 입력해주세요.", "warn"); return; }
    if (!confirm("이 회원의 비밀번호를 변경하시겠습니까?")) return;

    showLoading(true);
    try {
        const { data, error } = await sb.functions.invoke('admin-reset-pw', {
            body: { user_id: userId, new_password: newPw },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        showToast("비밀번호가 변경되었습니다.", "success");
        document.getElementById('pwResetModal').style.display = 'none';
    } catch (e) {
        showToast("오류: " + e.message, "error");
    } finally {
        showLoading(false);
    }
};

// [회원 주문이력 조회]
window.viewMemberOrders = async (userId, name) => {
    const modal = document.getElementById('memberOrderModal');
    if (!modal) return;
    document.getElementById('memberOrderName').innerText = name;
    const tbody = document.getElementById('memberOrderBody');
    const statsDiv = document.getElementById('memberOrderStats');
    const emptyDiv = document.getElementById('memberOrderEmpty');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;"><div class="spinner"></div></td></tr>';
    statsDiv.innerHTML = '';
    emptyDiv.style.display = 'none';
    modal.style.display = 'flex';

    const { data: orders } = await sb.from('orders')
        .select('id, created_at, items, total_amount, payment_method, payment_status, status, site_code')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (!orders || orders.length === 0) {
        tbody.innerHTML = '';
        emptyDiv.style.display = 'block';
        return;
    }

    // 통계
    const totalSpend = orders.filter(o => o.status !== '취소됨').reduce((s, o) => s + (o.total_amount || 0), 0);
    const cancelCount = orders.filter(o => o.status === '취소됨').length;
    statsDiv.innerHTML = `
        <div style="flex:1;background:#f0fdf4;padding:8px 12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:#64748b;">총 주문</div>
            <div style="font-size:18px;font-weight:bold;color:#15803d;">${orders.length}건</div>
        </div>
        <div style="flex:1;background:#eff6ff;padding:8px 12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:#64748b;">총 결제</div>
            <div style="font-size:18px;font-weight:bold;color:#2563eb;">${totalSpend.toLocaleString()}원</div>
        </div>
        <div style="flex:1;background:#fef2f2;padding:8px 12px;border-radius:8px;text-align:center;">
            <div style="font-size:11px;color:#64748b;">취소</div>
            <div style="font-size:18px;font-weight:bold;color:#dc2626;">${cancelCount}건</div>
        </div>`;

    tbody.innerHTML = '';
    orders.forEach(o => {
        const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
        const itemStr = items.map(i => i.productName || '상품').join(', ');
        const d = new Date(o.created_at);
        const dateStr = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
        const statusColor = o.status === '취소됨' ? '#dc2626' : o.status === '완료됨' ? '#15803d' : '#334155';
        const pmLabel = (o.payment_method || '').includes('카드') ? '💳카드' : (o.payment_method || '').includes('예치금') ? '💰예치금' : '🏦무통장';
        tbody.innerHTML += `<tr style="border-bottom:1px solid #f1f5f9;height:38px;">
            <td style="padding:0 8px;color:#64748b;">${dateStr}</td>
            <td style="padding:0 8px;font-size:10px;color:#94a3b8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${o.id}">${o.id.substring(0,8)}...</td>
            <td style="padding:0 8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemStr}">${itemStr || '-'}</td>
            <td style="padding:0 8px;text-align:right;font-weight:bold;">${(o.total_amount||0).toLocaleString()}</td>
            <td style="padding:0 8px;text-align:center;font-size:11px;">${pmLabel}</td>
            <td style="padding:0 8px;text-align:center;"><span style="color:${statusColor};font-weight:bold;font-size:11px;">${o.status}</span></td>
        </tr>`;
    });
};

// [스태프 관리]
window.loadStaffList = async () => {
    const tbody = document.getElementById('staffListBody');
    const { data } = await sb.from('admin_staff').select('*').order('created_at',{ascending:false});
    tbody.innerHTML = '';
    data?.forEach(s => {
        tbody.innerHTML += `<tr><td><div class="color-dot" style="background:${s.color}"></div></td><td>${s.name}</td><td>${s.role}</td><td><button class="btn btn-danger btn-sm" onclick="deleteStaffDB(${s.id})">삭제</button></td></tr>`;
    });
};
window.addStaffDB = async () => {
    const name = document.getElementById('staffName').value;
    const role = document.getElementById('staffRole').value;
    const color = document.getElementById('staffColor').value;
    if(!name) return;
    await sb.from('admin_staff').insert([{ name, role, color }]);
    loadStaffList();
};
window.deleteStaffDB = async (id) => {
    if(confirm('삭제하시겠습니까?')) {
        await sb.from('admin_staff').delete().eq('id', id);
        loadStaffList();
    }
};

// [가맹점 신청 관리]
window.loadPartnerApplications = async () => {
    const tbody = document.getElementById('partnerAppListBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div></td></tr>';

    // [수정] 필터링 값 가져오기
    const filterStatus = document.getElementById('filterPartnerStatus') ? document.getElementById('filterPartnerStatus').value : 'all';

    try {
        // 기본 쿼리 생성
        let query = sb.from('partner_applications').select('id, user_id, company_name, business_number, representative, phone, region, status, created_at').order('created_at', { ascending: false }).limit(100);

        // '전체 보기'가 아닐 때만 상태 필터링 적용
        if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
        }

        const { data: apps, error } = await query;

        if (error) throw error;
        // 뱃지 업데이트
        const badge = document.getElementById('partnerPendingCount');
        if(badge) {
            if(apps && apps.length > 0) {
                badge.style.display = 'inline-block';
                badge.innerText = apps.length;
            } else {
                badge.style.display = 'none';
            }
        }

        if (!apps || apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#999;">대기 중인 가맹점 신청이 없습니다.</td></tr>';
            return;
        }

        const userIds = apps.map(a => a.user_id);
        const { data: profiles } = await sb.from('profiles').select('id, email').in('id', userIds);
        const emailMap = {};
        if (profiles) profiles.forEach(p => emailMap[p.id] = p.email);

        tbody.innerHTML = '';
        apps.forEach(app => {
            const email = emailMap[app.user_id] || '이메일 없음';
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(app.created_at).toLocaleDateString()}</td>
                    <td>
                        <div style="font-weight:bold;">${email}</div>
                        <div style="font-size:11px; color:#94a3b8;">UID: ${app.user_id.substring(0,8)}...</div>
                    </td>
                    <td style="font-weight:bold;">${app.company_name}</td>
                    <td>${app.contact_phone}</td>
                    <td><span class="badge" style="background:#e0e7ff; color:#4338ca;">${app.region}</span></td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="approvePartnerApp('${app.id}', '${app.user_id}', '${app.region}', '${app.company_name}')">
                            ✅ 승인
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};

window.approvePartnerApp = async (appId, userId, region, companyName) => {
    // [수정] 안내 메시지 변경 (가맹점 -> 플레티넘)
    if (!confirm(`[승인 확인]\n업체명: ${companyName}\n지역: ${region}\n\n이 회원을 '플레티넘(Platinum)' 등급으로 승격시키겠습니까?`)) return;

    try {
        // [수정] 승인 시 role을 'franchise'가 아닌 'platinum'으로 업데이트
        const { error: profileErr } = await sb.from('profiles').update({ role: 'platinum', region: region }).eq('id', userId);
        if (profileErr) throw profileErr;

        const { error: appErr } = await sb.from('partner_applications').update({ status: 'approved' }).eq('id', appId);
        if (appErr) throw appErr;

        showToast(`승인 완료! '${companyName}'님은 이제 파트너스 기능을 사용할 수 있습니다.`, "success");
        loadPartnerApplications();
    } catch (e) {
        showToast("승인 오류: " + e.message, "error");
    }
};

// [출금 요청 관리] - 이미지 확인, 기여자 등급, 사유 메모 기능 통합
window.loadWithdrawals = async () => {
    const tbody = document.getElementById('withdrawalListBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">로딩 중...</td></tr>';

    try {
        // 1. 출금 요청 목록 조회
        const { data: requests, error } = await sb.from('withdrawal_requests')
            .select('id, user_id, amount, bank_name, account_holder, status, created_at, processed_at, tax_invoice_url')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!requests || requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">출금 신청이 없습니다.</td></tr>';
            return;
        }

        const userIds = [...new Set(requests.map(r => r.user_id))];

        // 2. 유저 정보 조회
        const { data: users, error: userError } = await sb.from('profiles')
            .select('id, email, full_name, role, contributor_tier, penalty_reason, deposit')
            .in('id', userIds);
            
        if(userError) console.error("프로필 조회 에러:", userError);

        const userMap = {};
        if (users) users.forEach(u => userMap[u.id] = u);

        // 3. 최근 이미지 조회 (한도 1000개로 증가)
        const { data: images } = await sb.from('library')
            .select('user_id, data_url')
            .in('user_id', userIds)
            .order('created_at', { ascending: false })
            .limit(1000); 
            
        const imageList = images || [];

        tbody.innerHTML = '';
        requests.forEach(r => {
            const user = userMap[r.user_id];
            
            // 이름 필드 찾기
            let userName = '이름미상';
            let userEmail = '이메일 없음';
            
            if (user) {
                userName = user.full_name || user.user_name || user.name || '이름미상';
                userEmail = user.email || '';
            }

            // 유저 정보 표시 HTML
            const displayUser = user ? 
                `<div><b>${userName}</b></div><div style="font-size:11px; color:#888;">${userEmail}</div>` 
                : `<div style="color:#ef4444; font-weight:bold;">정보 없음</div><div style="font-size:10px; color:#999;">ID: ${r.user_id}</div>`;

            // 이미지 3개 표시
            const myImgs = imageList.filter(img => img.user_id === r.user_id).slice(0, 3);
            let imgHtml = '<div style="display:flex; gap:4px;">';
            if(myImgs.length === 0) imgHtml += '<span style="font-size:11px; color:#ccc;">없음</span>';
            else {
                myImgs.forEach(img => {
                    let src = img.data_url;
                    try { if (src.startsWith('{')) src = JSON.parse(src).thumbnail || ''; } catch(e){}
                    if(src) imgHtml += `<img src="${src}" onclick="window.open('${src}')" style="width:36px; height:36px; border-radius:4px; border:1px solid #ddd; cursor:pointer; object-fit:cover;">`;
                });
            }
            imgHtml += '</div>';

            // 등급 & 메모 컨트롤
            let tierControl = '-';
            if (user) {
                const tier = user.contributor_tier || 'regular';
                const memo = user.penalty_reason || '';
                const isPenalty = tier === 'penalty';
                const style = isPenalty ? 'border:1px solid #ef4444; color:#ef4444; background:#fef2f2;' : 'border:1px solid #cbd5e1;';
                
                tierControl = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <select onchange="updateContributorTier('${user.id}', this.value)" style="padding:3px; border-radius:4px; font-size:11px; width:100%; font-weight:bold; ${style}">
                            <option value="regular" ${tier==='regular'?'selected':''}>😐 일반</option>
                            <option value="excellent" ${tier==='excellent'?'selected':''}>🏆 우수</option>
                            <option value="hero" ${tier==='hero'?'selected':''}>👑 영웅</option>
                            <option value="penalty" ${tier==='penalty'?'selected':''}>🚫 패널티(50원)</option>
                        </select>
                        <button class="btn btn-outline btn-sm" onclick="editPenaltyMemo('${user.id}', '${memo}')" style="width:100%; padding:2px; font-size:10px; display:flex; align-items:center; justify-content:center; gap:3px;">
                            <i class="fa-regular fa-comment-dots"></i> ${memo ? '메모수정' : '메모작성'}
                        </button>
                    </div>
                `;
            } else {
                 tierControl = `<span style="font-size:11px; color:#ccc;">회원정보 로드불가</span>`;
            }

            // 상태 뱃지 및 버튼
            let statusHtml = r.status === 'pending' 
                ? `<span class="badge" style="background:#fee2e2; color:#ef4444;">승인대기</span>` 
                : `<span class="badge" style="background:#dcfce7; color:#15803d;">지급완료</span>`;
            
            let actionBtn = r.status === 'pending'
                ? `<button class="btn btn-success btn-sm" onclick="approveWithdrawal('${r.id}')">승인(지급)</button>`
                : `<span style="font-size:11px; color:#aaa;">완료됨</span>`;

            tbody.innerHTML += `
                <tr style="height:60px;">
                    <td style="font-size:12px;">${new Date(r.created_at).toLocaleDateString()}</td>
                    <td>${displayUser}</td>
                    <td>${imgHtml}</td>
                    <td style="text-align:right; font-weight:bold; color:#d97706;">${(r.amount||0).toLocaleString()}원</td>
                    <td style="padding:5px 10px;">${tierControl}</td>
                    <td style="font-size:12px;">
                        <div><b>${r.bank_name}</b> (${r.account_holder})</div>
                        <div style="color:#666;">${r.account_number}</div>
                    </td>
                    <td style="text-align:center;">${statusHtml}</td>
                    <td style="text-align:center;">${actionBtn}</td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">${e.message}</td></tr>`;
    }
};

// [기여자 등급 변경 함수 - 필수]
window.updateContributorTier = async (id, newTier) => {
    let reason = null;
    if (newTier === 'penalty') {
        reason = prompt("🚫 패널티 사유를 입력해주세요 (유저에게 표시됨):", "저작권 위반 / 퀄리티 미달");
        if (reason === null) { loadWithdrawals(); return; }
    } else {
        if(!confirm(`등급을 변경하시겠습니까?`)) { loadWithdrawals(); return; }
    }

    const updateData = { contributor_tier: newTier };
    if (reason !== null) updateData.penalty_reason = reason;

    const { error } = await sb.from('profiles').update(updateData).eq('id', id);
    if(error) showToast("오류: " + error.message, "error");
    else { showToast("반영되었습니다.", "success"); loadWithdrawals(); }
};

// [메모(사유)만 수정하는 함수]
window.editPenaltyMemo = async (id, currentMemo) => {
    const newMemo = prompt("고객에게 전달할 메모(사유)를 입력하세요:", currentMemo);
    if (newMemo === null) return;

    const { error } = await sb.from('profiles').update({ penalty_reason: newMemo }).eq('id', id);
    if(error) showToast("오류: " + error.message, "error");
    else { showToast("메모가 저장되었습니다.", "success"); loadWithdrawals(); }
};

// [승인(지급) 처리 함수 - 이게 없어서 에러가 났습니다]
window.approveWithdrawal = async (requestId) => {
    if(!confirm("해당 건을 '입금완료' 처리하시겠습니까?")) return;

    try {
        const { error } = await sb.from('withdrawal_requests')
            .update({ 
                status: 'approved',
                processed_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if(error) throw error;
        showToast("처리되었습니다.", "success");
        loadWithdrawals();
    } catch(e) {
        showToast("처리 실패: " + e.message, "error");
    }
};

// [결산]
window.loadAccountingData = async () => {
    showToast("결산 조회 기능 준비중...", "info");
};