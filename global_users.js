import { sb } from "./global_config.js?v=435";
import { showLoading } from "./global_common.js?v=435";

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

    // PRO 구독자 필터: subscriptions active 또는 profiles.role='subscriber' 모두 포함
    let proUserIds = null;
    if (roleVal === 'pro_active') {
        const { data: actSubs } = await sb.from('subscriptions')
            .select('user_id')
            .in('status', ['active', 'trialing']);
        const subIds = (actSubs || []).map(s => s.user_id);
        const { data: subRoleProfiles } = await sb.from('profiles')
            .select('id').eq('role', 'subscriber');
        const roleIds = (subRoleProfiles || []).map(p => p.id);
        proUserIds = Array.from(new Set([...subIds, ...roleIds]));
        if (proUserIds.length === 0) proUserIds = ['__none__'];
    }

    let query = sb.from('profiles').select('id, email, username, role, deposit, mileage, total_spend, logo_count, contributor_tier, penalty_reason, admin_memo, created_at, site', { count: 'exact' });
    if (roleVal !== 'all' && roleVal !== 'pro_active') query = query.eq('role', roleVal);
    if (proUserIds) query = query.in('id', proUserIds);
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
    if (roleVal !== 'all' && roleVal !== 'pro_active') countQuery.eq('role', roleVal);
    if (proUserIds) countQuery.in('id', proUserIds);
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

    // PRO 구독 정보 조회 (현재 페이지 회원들)
    let subMap = {}; // { userId: { plan_type, current_period_end, status, created_at } }
    try {
        const { data: subs } = await sb.from('subscriptions')
            .select('user_id, plan_type, status, current_period_end, created_at')
            .in('user_id', memberIds);
        if (subs) {
            subs.forEach(s => {
                // 한 유저에 복수 구독이 있으면 가장 긴 종료일 우선
                const prev = subMap[s.user_id];
                if (!prev || (s.plan_type === 'lifetime') || (s.current_period_end && (!prev.current_period_end || new Date(s.current_period_end) > new Date(prev.current_period_end)))) {
                    subMap[s.user_id] = s;
                }
            });
        }
    } catch(e) { console.warn('subscriptions 조회 실패:', e); }

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

        // PRO 구독 배지 (subscriptions 레코드 또는 role=subscriber 양쪽 모두 표시)
        const sub = subMap[m.id];
        let subBadge = '';
        if (sub || m.role === 'subscriber') {
            const planType = sub?.plan_type || 'subscriber';
            const planLabel = planType === 'lifetime' ? '평생' : planType === 'annual' ? '연간' : planType === 'monthly' ? '월간' : planType === 'signup_promo' ? '무료체험' : 'PRO';
            let remainText = '';
            let remainColor = '#10b981';
            let endDate = null;

            if (planType === 'lifetime') {
                remainText = '∞ 평생';
                remainColor = '#a855f7';
            } else if (sub?.current_period_end) {
                endDate = new Date(sub.current_period_end);
            } else if (sub?.created_at) {
                // current_period_end 누락 시 created_at 기반 추정
                const days = planType === 'annual' ? 365 : 30;
                endDate = new Date(new Date(sub.created_at).getTime() + days * 86400000);
            }

            if (endDate && planType !== 'lifetime') {
                const diffDays = Math.ceil((endDate - new Date()) / 86400000);
                remainText = diffDays >= 0 ? `${diffDays}일 남음` : `만료 ${Math.abs(diffDays)}일`;
                remainColor = diffDays >= 30 ? '#10b981' : diffDays >= 7 ? '#f59e0b' : '#ef4444';
            } else if (!sub && m.role === 'subscriber') {
                remainText = '기간정보 없음';
                remainColor = '#64748b';
            }

            const endDateStr = planType === 'lifetime' ? '평생 이용' : (endDate ? endDate.toLocaleDateString() + (sub?.current_period_end ? '' : ' (추정)') : '-');
            subBadge = `<div style="margin-top:4px; display:inline-flex; flex-direction:column; background:linear-gradient(135deg,#ede9fe,#fae8ff); border:1px solid #c4b5fd; border-radius:8px; padding:4px 8px; font-size:10px; line-height:1.4;" title="종료일: ${endDateStr}">
                <span style="font-weight:800; color:#6d28d9;">⭐PRO ${planLabel}</span>
                <span style="color:${remainColor}; font-weight:700;">${remainText}</span>
            </div>`;
        }

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
                <td style="text-align:center;"><span class="badge" style="background:${badgeColor}; font-size:11px;">${displayRole}</span>${subBadge}</td>
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

// ───────────────────────────────────────────────
// [디자이너 신청·승인 관리] — designer_profiles.is_active 기반
// ───────────────────────────────────────────────
// 2026-06-13: 숨김 마커 — UPDATE 로 추가해서 목록에서 자동 제외
const REJECTED_MARK = '[ADMIN_REJECTED]';

window.loadDesignerApplications = async () => {
    const grid = document.getElementById('designerAppListBody');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#94a3b8;">로딩 중...</div>';
    const filter = document.getElementById('dgnFilter')?.value || 'pending';
    try {
        let q = sb.from('designer_profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);
        if (filter === 'pending') q = q.eq('is_active', false);
        else if (filter === 'active') q = q.eq('is_active', true);
        // 숨김 마커 있는 행은 항상 제외 (전체 탭에서도)
        q = q.not('bio', 'ilike', '%' + REJECTED_MARK + '%');
        const { data: rows, error } = await q;
        if (error) throw error;
        if (!rows || rows.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#94a3b8;">'+(filter==='pending'?'승인 대기 중인 신청이 없습니다.':'조건에 맞는 디자이너가 없습니다.')+'</div>';
            return;
        }
        // 프로필 이메일 로드
        const ids = rows.map(r => r.id).filter(Boolean);
        const { data: profs } = await sb.from('profiles').select('id, email, username').in('id', ids);
        const profMap = {};
        (profs || []).forEach(p => profMap[p.id] = p);

        grid.innerHTML = '';
        rows.forEach(r => {
            const p = profMap[r.id] || {};
            const isActive = !!r.is_active;
            const bio = (r.bio || '').slice(0, 240);
            const portfolioUrl = (r.portfolio_urls && r.portfolio_urls[0]) || '';
            const created = r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-';
            const card = document.createElement('div');
            card.style.cssText = 'background:#fff;border:1px solid '+(isActive?'#a7f3d0':'#e9d5ff')+';border-radius:14px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04);';
            card.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    <div style="width:44px;height:44px;border-radius:50%;background:#ede9fe;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;">${(r.display_name||'?')[0]}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:14.5px;font-weight:700;color:#1e293b;">${r.display_name || '(이름 없음)'}</div>
                        <div style="font-size:11.5px;color:#64748b;word-break:break-all;">${p.email || ''}</div>
                    </div>
                    <span style="padding:3px 10px;border-radius:980px;font-size:11px;font-weight:700;${isActive?'background:#dcfce7;color:#166534;':'background:#fef3c7;color:#92400e;'}">${isActive?'✓ 승인됨':'⏳ 대기중'}</span>
                </div>
                <div style="font-size:12px;color:#475569;line-height:1.55;white-space:pre-wrap;max-height:7em;overflow:auto;padding:8px 10px;background:#f8fafc;border-radius:8px;margin-bottom:10px;">${(bio || '(자기소개 없음)')}</div>
                ${portfolioUrl ? '<div style="font-size:11.5px;margin-bottom:10px;"><a href="'+portfolioUrl+'" target="_blank" style="color:#7c3aed;font-weight:600;text-decoration:none;">🔗 포트폴리오 보기</a></div>' : ''}
                <div style="display:flex;gap:6px;justify-content:space-between;align-items:center;">
                    <span style="font-size:10.5px;color:#94a3b8;">신청: ${created}</span>
                    <div style="display:flex;gap:6px;">
                        ${isActive
                            ? `<button class="btn btn-outline btn-sm" onclick="rejectDesignerApplication('${r.id}')" style="padding:5px 10px;font-size:11.5px;color:#dc2626;border-color:#fecaca;">승인 취소</button>`
                            : `<button class="btn btn-outline btn-sm" onclick="rejectDesignerApplication('${r.id}')" style="padding:5px 10px;font-size:11.5px;color:#64748b;">거절·삭제</button>
                               <button class="btn btn-primary btn-sm" onclick="approveDesignerApplication('${r.id}','${(r.display_name||'').replace(/'/g,"\\'")}')" style="padding:5px 10px;font-size:11.5px;background:#16a34a;border-color:#15803d;color:#fff;">✓ 승인</button>`
                        }
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error('[loadDesignerApplications]', e);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#ef4444;">로드 실패: '+(e.message||e)+'</div>';
    }
};

window.approveDesignerApplication = async (designerId, name) => {
    if (!confirm('"'+ (name || '이 디자이너') +'"를 승인하시겠습니까?\n승인 후 의뢰 받기 권한이 부여됩니다.')) return;
    try {
        const { error } = await sb.from('designer_profiles').update({ is_active: true }).eq('id', designerId);
        if (error) throw error;
        // staff 테이블에도 자동 등록 (이미 있으면 스킵)
        try {
            const { data: prof } = await sb.from('profiles').select('email').eq('id', designerId).maybeSingle();
            const staffName = (name || (prof && prof.email && prof.email.split('@')[0]) || '디자이너');
            const { data: existing } = await sb.from('admin_staff').select('id').eq('name', staffName).eq('role', 'designer').maybeSingle();
            if (!existing) {
                await sb.from('admin_staff').insert({ name: staffName, role: 'designer', color: '#7c3aed' });
            }
        } catch (se) { console.warn('[staff sync]', se); }
        alert('승인 완료');
        loadDesignerApplications();
        if (window.loadStaffList) loadStaffList();
    } catch (e) {
        alert('실패: ' + (e.message || e));
    }
};

window.rejectDesignerApplication = async (designerId) => {
    if (!confirm('이 신청을 거절·숨김 처리하시겠습니까?\n(목록에서 사라지고 의뢰도 받을 수 없게 됩니다)')) return;
    try {
        // 1) is_active=false + bio 에 숨김 마커 추가 (UPDATE 는 admin policy 로 통과)
        const { data: cur } = await sb.from('designer_profiles').select('bio').eq('id', designerId).maybeSingle();
        const newBio = (cur && cur.bio ? cur.bio + '\n\n' : '') + REJECTED_MARK + ' ' + new Date().toISOString();
        const { error } = await sb.from('designer_profiles')
            .update({ is_active: false, bio: newBio })
            .eq('id', designerId);
        if (error) throw error;
        alert('숨김 처리 완료');
        loadDesignerApplications();
    } catch (e) {
        alert('실패: ' + (e.message || e));
    }
};

// 2026-06-13: 승인 대기 일괄 거절·숨김
window.bulkRejectPendingDesigners = async () => {
    if (!confirm('승인 대기 중인 디자이너 신청을 모두 거절·숨김 처리합니다.\n(목록에서 사라지고 의뢰도 받을 수 없게 됩니다)\n진행할까요?')) return;
    if (!confirm('정말 모두 일괄 거절합니다.')) return;

    try {
        // is_active=false 이면서 아직 숨김 마커 없는 행만 가져오기
        const { data: targets, error: qErr } = await sb.from('designer_profiles')
            .select('id, bio')
            .eq('is_active', false)
            .not('bio', 'ilike', '%' + REJECTED_MARK + '%')
            .limit(2000);
        if (qErr) throw qErr;
        if (!targets || targets.length === 0) { alert('대기 중인 신청이 없습니다.'); return; }

        const now = new Date().toISOString();
        let okCount = 0, failCount = 0;
        // 1건씩 UPDATE — bio 가 row 마다 다르므로 일괄 update 불가
        for (const t of targets) {
            try {
                const newBio = (t.bio ? t.bio + '\n\n' : '') + REJECTED_MARK + ' ' + now;
                const { error } = await sb.from('designer_profiles')
                    .update({ bio: newBio })
                    .eq('id', t.id);
                if (error) { failCount++; console.warn('[bulk reject]', t.id, error); }
                else okCount++;
            } catch (e) { failCount++; }
        }

        alert(`✓ ${okCount}건 거절·숨김 처리 완료${failCount > 0 ? '\n❌ ' + failCount + '건 실패 (콘솔 확인)' : ''}`);
        loadDesignerApplications();
    } catch (e) { alert('실패: ' + (e.message || e)); }
};

// 2026-06-13: 6명만 활성, 나머지는 모두 is_active=false 로 비활성 처리.
//   DELETE 는 Supabase RLS 로 막혀있는 경우가 많아 실패하지만 UPDATE 는 admin 권한으로 통과됨.
//   /designer-board 가 is_active=true 디자이너만 의뢰 받을 수 있도록 게이팅하고 있음 → 결과적으로 동일한 효과.
//   또 신규 신청자는 is_active=false 로 들어오니 admin 이 승인할 때까지 의뢰 받지 못함.
window.activateOnlySix = async () => {
    const defaultKeep = ['디자이너 J', '그래픽한', '연두', '디자이너 joy', '우디', '디자인바로'];
    const input = prompt(
        '의뢰 받을 권한을 줄 디자이너 이름을 콤마(,)로 구분해 입력하세요.\n' +
        '(대소문자/공백 무시, 부분일치)\n\n' +
        '입력한 이름과 매칭되는 디자이너만 is_active=true 로 유지되고,\n' +
        '나머지는 is_active=false 로 변경되어 /designer-board 에서 의뢰를 받을 수 없게 됩니다.\n' +
        '(데이터 자체는 보존됨 — DELETE 가 RLS 로 막혀 있어 활성/비활성 방식 사용)',
        defaultKeep.join(',')
    );
    if (input === null) return;
    const keepRaw = input.split(',').map(s => s.trim()).filter(Boolean);
    if (keepRaw.length === 0) { alert('이름을 한 명 이상 입력해 주세요.'); return; }
    const keepLower = keepRaw.map(s => s.toLowerCase().replace(/\s+/g, ''));

    let all = [];
    try {
        const { data, error } = await sb.from('designer_profiles').select('id, display_name, country, is_active').limit(2000);
        if (error) throw error;
        all = data || [];
    } catch (e) { alert('조회 실패: ' + (e.message || e)); return; }

    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
    const keepIds = [], deactivateIds = [], keepPreview = [], deactivatePreview = [];
    all.forEach(d => {
        const n = norm(d.display_name);
        const isKeep = keepLower.some(k => n.indexOf(k) >= 0 || k.indexOf(n) >= 0);
        if (isKeep) {
            keepIds.push(d.id);
            keepPreview.push((d.display_name || '(이름없음)') + ' [' + (d.country || 'NULL') + '] ' + (d.is_active ? '✓활성' : '✗비활성'));
        } else {
            deactivateIds.push(d.id);
            if (d.is_active) deactivatePreview.push((d.display_name || '(이름없음)') + ' [' + (d.country || 'NULL') + ']');
        }
    });

    if (deactivateIds.length === 0) { alert('이미 모두 정리되어 있습니다.'); return; }

    if (!confirm(
        '✅ 활성 유지: ' + keepIds.length + '명\n' +
        '🚫 비활성 처리: ' + deactivateIds.length + '명 (현재 활성: ' + deactivatePreview.length + ')\n\n' +
        '유지될 디자이너:\n' + keepPreview.slice(0, 10).join('\n') +
        '\n\n비활성될 활성 디자이너 미리보기 (최대 10명):\n' + deactivatePreview.slice(0, 10).join('\n') +
        '\n\n진행하시겠습니까?'
    )) return;

    // 1) 유지 대상은 is_active=true 강제 (혹시 false 였으면 활성화)
    let activatedKeep = 0;
    try {
        if (keepIds.length > 0) {
            function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i+n)); return r; }
            for (const c of chunk(keepIds, 100)) {
                const { error, count } = await sb.from('designer_profiles').update({ is_active: true }, { count: 'exact' }).in('id', c);
                if (error) throw error;
                if (count != null) activatedKeep += count;
            }
        }
    } catch (e) { alert('유지 대상 활성화 실패: ' + (e.message || e)); return; }

    // 2) 나머지는 is_active=false
    let deactivated = 0;
    let updateErr = null;
    try {
        function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i+n)); return r; }
        for (const c of chunk(deactivateIds, 100)) {
            const { error, count } = await sb.from('designer_profiles').update({ is_active: false }, { count: 'exact' }).in('id', c);
            if (error) { updateErr = error.message; break; }
            if (count != null) deactivated += count;
        }
    } catch (e) { updateErr = e.message || e; }

    // 3) 검증
    let afterActive = -1;
    try {
        const { count } = await sb.from('designer_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true);
        if (count != null) afterActive = count;
    } catch (e) {}

    const verify = (afterActive >= 0)
        ? '\n\n📊 검증:\n  • 활성으로 만든 수: ' + activatedKeep + '명\n  • 비활성으로 만든 수: ' + deactivated + '명' +
          '\n  • 현재 활성 디자이너: ' + afterActive + '명' +
          (afterActive === keepIds.length ? ' ✓ 정확히 일치!' : ' ⚠️ 예상(' + keepIds.length + ')과 다름')
        : '';

    alert(
        (updateErr ? '⚠️ 비활성 처리 중 오류: ' + updateErr + '\n\n' : '✓ 처리 완료\n\n') +
        verify +
        '\n\n앞으로:\n• /designer-board 에서는 활성 디자이너만 "의뢰 받기" 버튼 사용 가능\n• 신규 신청자는 admin 이 승인할 때까지 자동 비활성 상태'
    );
    console.log('[activateOnlySix]', { keepIds: keepIds.length, deactivated, afterActive });

    if (window.loadDesignerApplications) loadDesignerApplications();
};

// 2026-06-13: 화이트리스트 6명만 남기고 모두 삭제 (이름 부분일치 기준)
window.keepSixDesigners = async () => {
    // 기본 화이트리스트 (이름이 정확히 일치하지 않아도 부분일치)
    const defaultKeep = ['디자이너 J', '그래픽한', '연두', '디자이너 joy', '우디', '디자인바로'];
    const input = prompt(
        '남길 디자이너 이름을 콤마(,)로 구분해 입력하세요 (대소문자/공백 무시, 부분일치).\n예: 디자이너 J,그래픽한,연두,디자이너 joy,우디,디자인바로',
        defaultKeep.join(',')
    );
    if (input === null) return;
    const keepRaw = input.split(',').map(s => s.trim()).filter(Boolean);
    if (keepRaw.length === 0) { alert('남길 디자이너 이름을 한 명 이상 입력해 주세요.'); return; }
    const keepLower = keepRaw.map(s => s.toLowerCase().replace(/\s+/g, ''));

    // 1) 전체 디자이너 + 이름 가져오기 → 화이트리스트 매칭 분리
    let all = [];
    try {
        const { data, error } = await sb.from('designer_profiles').select('id, display_name, country').limit(2000);
        if (error) throw error;
        all = data || [];
    } catch (e) { alert('대상 조회 실패: ' + (e.message || e)); return; }

    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
    const keepIds = [];
    const removeIds = [];
    const removeNames = [];
    all.forEach(d => {
        const n = norm(d.display_name);
        const isKeep = keepLower.some(k => n.indexOf(k) >= 0 || k.indexOf(n) >= 0);
        if (isKeep) keepIds.push(d.id);
        else { removeIds.push(d.id); removeNames.push(d.display_name + ' [' + (d.country || 'NULL') + ']'); }
    });

    if (removeIds.length === 0) { alert('삭제할 디자이너가 없습니다.'); return; }

    if (!confirm(
        '✅ 유지 ' + keepIds.length + '명 / ❌ 삭제 ' + removeIds.length + '명\n\n' +
        '유지: ' + keepRaw.join(', ') + '\n\n' +
        '삭제 미리보기 (최대 10명):\n' + removeNames.slice(0, 10).join('\n') +
        '\n\n진행하시겠습니까?'
    )) return;
    if (!confirm('정말 ' + removeIds.length + '명을 삭제합니다. 복구 불가능합니다.')) return;

    // 2) FK 자식 → 부모 순서로 삭제
    function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i+n)); return r; }
    const idChunks = chunk(removeIds, 100);
    const results = [];
    const beforeCount = all.length;

    const childTables = [
        { tbl: 'design_reviews',              col: 'designer_id' },
        { tbl: 'design_bids',                 col: 'designer_id' },
        { tbl: 'designer_gigs',               col: 'designer_id' },
        { tbl: 'design_withdrawal_requests',  col: 'designer_id' },
        { tbl: 'designer_tax_profiles',       col: 'designer_id' },
        { tbl: 'pattern_royalties',           col: 'designer_id' }
    ];

    for (const step of childTables) {
        let total = 0;
        let err = null;
        for (const c of idChunks) {
            try {
                const { error, count } = await sb.from(step.tbl).delete({ count: 'exact' }).in(step.col, c);
                if (error) {
                    if (/42P01|relation .* does not exist|42703|column .* does not exist/i.test(error.message || '')) { err = '미존재 (스킵)'; break; }
                    err = error.message || error.code; break;
                }
                if (count != null) total += count;
            } catch (e) { err = e.message || e; break; }
        }
        results.push('• ' + step.tbl + ': ' + (err ? ('❌ ' + err) : ('✓ ' + total + '건')));
    }

    // 3) designer_profiles 삭제
    let dpTotal = 0; let dpErr = null;
    for (const c of idChunks) {
        try {
            const { error, count } = await sb.from('designer_profiles').delete({ count: 'exact' }).in('id', c);
            if (error) { dpErr = error.message || error.code; break; }
            if (count != null) dpTotal += count;
        } catch (e) { dpErr = e.message || e; break; }
    }
    results.push('• designer_profiles: ' + (dpErr ? ('❌ ' + dpErr) : ('✓ ' + dpTotal + '건')));

    // 4) admin_staff 정리
    try {
        const keepNamesSet = new Set(keepRaw.map(s => s));
        const { data: staffDes } = await sb.from('admin_staff').select('id, name').eq('role', 'designer');
        const sRemove = (staffDes || []).filter(s => !Array.from(keepNamesSet).some(k => norm(s.name).indexOf(norm(k)) >= 0)).map(s => s.id);
        if (sRemove.length > 0) {
            const { error: sErr, count: sCount } = await sb.from('admin_staff').delete({ count: 'exact' }).in('id', sRemove);
            if (sErr) results.push('• admin_staff: ❌ ' + sErr.message);
            else results.push('• admin_staff: ✓ ' + (sCount || sRemove.length) + '건');
        }
    } catch (e) { results.push('• admin_staff 실패: ' + (e.message || e)); }

    // 5) 검증 — 다시 조회해서 실제 남은 디자이너 수 확인
    let afterCount = -1;
    try {
        const { data: af, error: aErr } = await sb.from('designer_profiles').select('id', { count: 'exact', head: true });
        if (!aErr) afterCount = af === null ? -1 : 0;  // head:true → count 만 반환
        const { count } = await sb.from('designer_profiles').select('id', { count: 'exact', head: true });
        if (count != null) afterCount = count;
    } catch (e) {}

    const verify = (afterCount >= 0)
        ? '\n\n📊 검증:\n  • 시작: ' + beforeCount + '명\n  • 삭제 대상: ' + removeIds.length + '명\n  • 현재 남은 수: ' + afterCount + '명' +
          (afterCount === keepIds.length ? ' ✓ 일치!' : ' ⚠️ 예상(' + keepIds.length + ')과 다름 — RLS 권한 문제 가능')
        : '';

    alert('삭제 결과:\n\n' + results.join('\n') + verify);
    console.log('[keepSix]', { results, beforeCount, afterCount, expected: keepIds.length });

    if (window.loadDesignerApplications) loadDesignerApplications();
    if (window.loadStaffList) loadStaffList();
};

// 2026-06-13: 해외 디자이너만 삭제 — country != 'KR' 인 designer_profiles + 관련 행 일괄 정리
window.purgeNonKrDesigners = async () => {
    // 1) 미리 대상 디자이너 카운트 + 미리보기
    let preview;
    try {
        const { data: kr,  error: e1 } = await sb.from('designer_profiles').select('id', { count: 'exact' }).eq('country', 'KR');
        const { data: all, error: e2 } = await sb.from('designer_profiles').select('id, display_name, country', { count: 'exact' }).neq('country', 'KR');
        if (e1 || e2) throw (e1 || e2);
        const targetCount = (all || []).length;
        const keepCount = (kr || []).length;
        if (targetCount === 0) { alert('삭제할 해외 디자이너가 없습니다. (모두 한국 디자이너)'); return; }
        const sample = (all || []).slice(0, 8).map(d => '• ' + (d.display_name || '(이름 없음)') + ' [' + (d.country || 'NULL') + ']').join('\n');
        preview = { ids: (all || []).map(d => d.id), targetCount, keepCount, sample };
    } catch (e) {
        alert('대상 조회 실패: ' + (e.message || e));
        return;
    }

    if (!confirm('해외 디자이너 ' + preview.targetCount + '명을 삭제합니다.\n한국(KR) 디자이너 ' + preview.keepCount + '명은 유지됩니다.\n\n삭제 미리보기 (최대 8명):\n' + preview.sample + '\n\n진행하시겠습니까?')) return;
    if (!confirm('정말 해외 디자이너 ' + preview.targetCount + '명을 삭제합니다.\n복구 불가능합니다.')) return;

    // FK 자식 → 부모 순서로 삭제 — designer_id 가 대상 IDs 인 행만
    const ids = preview.ids;
    const results = [];
    const childTables = [
        { tbl: 'design_reviews',              col: 'designer_id' },
        { tbl: 'design_bids',                 col: 'designer_id' },
        { tbl: 'designer_gigs',               col: 'designer_id' },
        { tbl: 'design_withdrawal_requests',  col: 'designer_id' },
        { tbl: 'designer_tax_profiles',       col: 'designer_id' },
        { tbl: 'pattern_royalties',           col: 'designer_id' }
    ];

    // .in() 은 한 번에 너무 많으면 URL 길이 초과 — 100개씩 청크
    function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i+n)); return r; }
    const idChunks = chunk(ids, 100);

    for (const step of childTables) {
        let total = 0;
        let err = null;
        for (const c of idChunks) {
            try {
                const { error, count } = await sb.from(step.tbl).delete({ count: 'exact' }).in(step.col, c);
                if (error) {
                    if (/42P01|relation .* does not exist|42703|column .* does not exist/i.test(error.message || '')) {
                        err = '미존재 (스킵)';
                        break;
                    }
                    err = error.message || error.code;
                    break;
                }
                if (count != null) total += count;
            } catch (e) { err = e.message || e; break; }
        }
        results.push('• ' + step.tbl + ': ' + (err ? ('❌ ' + err) : ('✓ ' + total + '건')));
    }

    // 마지막: designer_profiles 의 비-KR 행 삭제
    let dpTotal = 0;
    let dpErr = null;
    for (const c of idChunks) {
        try {
            const { error, count } = await sb.from('designer_profiles').delete({ count: 'exact' }).in('id', c);
            if (error) { dpErr = error.message || error.code; break; }
            if (count != null) dpTotal += count;
        } catch (e) { dpErr = e.message || e; break; }
    }
    results.push('• designer_profiles (비-KR): ' + (dpErr ? ('❌ ' + dpErr) : ('✓ ' + dpTotal + '건')));

    // admin_staff 디자이너 행도 정리 — 한국 designer_profiles 이름만 남기기
    try {
        const { data: krDp } = await sb.from('designer_profiles').select('display_name').eq('country', 'KR');
        const krNames = new Set((krDp || []).map(d => d.display_name).filter(Boolean));
        const { data: staffDes } = await sb.from('admin_staff').select('id, name').eq('role', 'designer');
        const removeIds = (staffDes || []).filter(s => !krNames.has(s.name)).map(s => s.id);
        if (removeIds.length > 0) {
            const { error: sErr, count: sCount } = await sb.from('admin_staff').delete({ count: 'exact' }).in('id', removeIds);
            if (sErr) results.push('• admin_staff (비-KR designer): ❌ ' + sErr.message);
            else results.push('• admin_staff (비-KR designer): ✓ ' + (sCount || removeIds.length) + '건');
        }
    } catch (e) { results.push('• admin_staff 정리 실패: ' + (e.message || e)); }

    alert('해외 디자이너 삭제 결과:\n\n' + results.join('\n'));
    console.log('[purge non-KR]', results);

    if (window.loadDesignerApplications) loadDesignerApplications();
    if (window.loadStaffList) loadStaffList();
    if (window.loadDesignWithdrawals) loadDesignWithdrawals();
};

// 2026-06-13: 전체 초기화 — FK 의존성 역순으로 삭제
window.purgeAllDesignerData = async () => {
    if (!confirm('⚠️ 정말 전체 초기화 하시겠습니까?\n\n모든 디자인 의뢰 · 디자이너 프로필 · 입찰 · 리뷰 · 출금 신청이 영구 삭제됩니다.\n\n복구 불가능합니다.')) return;
    if (!confirm('정말로 모든 디자이너 데이터를 삭제합니다.\n취소하시려면 [취소], 정말 실행하시려면 [확인].')) return;
    const txt = prompt('확인을 위해 "초기화" 라고 입력하세요:');
    if (txt !== '초기화') { alert('취소되었습니다.'); return; }

    // FK 의존성 역순 — 자식 테이블 먼저, 부모 테이블 나중에
    // (예: designer_profiles.id 가 design_bids.designer_id 의 FK target 이므로 design_bids 먼저 삭제)
    const order = [
        { tbl: 'design_reviews',              filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'design_bids',                 filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'designer_gigs',               filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'design_withdrawal_requests',  filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'designer_tax_profiles',       filterCol: 'designer_id',  filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'pattern_royalties',           filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'design_requests',             filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'designer_profiles',           filterCol: 'id',           filterVal: '00000000-0000-0000-0000-000000000000', op: 'neq' },
        { tbl: 'admin_staff',                 filterCol: 'role',         filterVal: 'designer',                              op: 'eq' }
    ];

    const results = [];
    for (const step of order) {
        try {
            let q = sb.from(step.tbl).delete({ count: 'exact' });
            if (step.op === 'eq')  q = q.eq(step.filterCol, step.filterVal);
            else                   q = q.neq(step.filterCol, step.filterVal);
            const { error, count } = await q;
            if (error) {
                // 테이블 미존재(42P01) 또는 컬럼 미존재(42703) 는 정상 — 스킵
                if (/42P01|relation .* does not exist|42703|column .* does not exist/i.test(error.message || '')) {
                    results.push('• ' + step.tbl + ': 미존재 (스킵)');
                } else {
                    results.push('• ' + step.tbl + ': ❌ ' + (error.message || error.code));
                }
            } else {
                results.push('• ' + step.tbl + ': ✓ ' + (count != null ? count + '건' : '완료'));
            }
        } catch (e) {
            results.push('• ' + step.tbl + ': ❌ ' + (e.message || e));
        }
    }

    alert('전체 초기화 결과:\n\n' + results.join('\n') + '\n\n실패가 있다면 콘솔 로그도 확인해 주세요.');
    console.log('[purge result]', results);

    if (window.loadDesignerApplications) loadDesignerApplications();
    if (window.loadStaffList) loadStaffList();
    if (window.loadDesignWithdrawals) loadDesignWithdrawals();
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

// [매니저 휴가 관리] — 휴가 시 OFF로 토글하면 챗봇/장바구니에서 회색 처리되어 선택 불가
// 데이터: chatbot_knowledge.category='_managers' 의 is_active 컬럼
const FIELD_MGR_NAMES = ['은미', '성희', '지숙', '연두']; // 현장 매니저 last-name fragments

window.loadMgrVacation = async () => {
    const grid = document.getElementById('mgrVacationGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8;">로딩 중...</div>';
    const { data, error } = await sb.from('chatbot_knowledge')
        .select('id, question, answer, is_active')
        .eq('category', '_managers');
    if (error) { grid.innerHTML = `<div style="color:#ef4444;">로드 실패: ${error.message}</div>`; return; }

    // 현장 매니저만 필터링 (이름에 fragment 포함된 row)
    const rows = (data || []).filter(r => FIELD_MGR_NAMES.some(n => (r.question || '').includes(n)));
    // 이름 정렬: 은미 → 성희 → 지숙 → 연두 순서
    rows.sort((a, b) => {
        const ai = FIELD_MGR_NAMES.findIndex(n => (a.question || '').includes(n));
        const bi = FIELD_MGR_NAMES.findIndex(n => (b.question || '').includes(n));
        return ai - bi;
    });

    if (!rows.length) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#94a3b8;">등록된 매니저가 없습니다.</div>';
        return;
    }

    grid.innerHTML = rows.map(r => {
        let phone = '';
        try { phone = JSON.parse(r.answer || '{}').phone || ''; } catch(e) {}
        const phoneFmt = phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        const onColor = r.is_active ? '#10b981' : '#94a3b8';
        const bgColor = r.is_active ? '#ecfdf5' : '#f1f5f9';
        const statusText = r.is_active ? '✅ 근무중' : '🌴 휴가중';
        const statusBg = r.is_active ? '#d1fae5' : '#fed7aa';
        const statusColor = r.is_active ? '#065f46' : '#9a3412';
        const btnLabel = r.is_active ? '휴가 ON' : '근무 복귀';
        const btnBg = r.is_active ? '#f59e0b' : '#10b981';
        return `
            <div style="border:2px solid ${onColor}; background:${bgColor}; border-radius:12px; padding:14px; transition:all 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:16px; font-weight:800; color:#1e293b;">👩 ${r.question}</div>
                    <span style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:10px; background:${statusBg}; color:${statusColor};">${statusText}</span>
                </div>
                ${phoneFmt ? `<div style="font-size:12px; color:#64748b; margin-bottom:10px;">📞 ${phoneFmt}</div>` : ''}
                <button onclick="toggleMgrVacation(${r.id}, ${!r.is_active})"
                    style="width:100%; padding:9px; background:${btnBg}; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.15s;">
                    ${btnLabel}
                </button>
            </div>
        `;
    }).join('');
};

window.toggleMgrVacation = async (id, newActive) => {
    const { error } = await sb.from('chatbot_knowledge')
        .update({ is_active: newActive })
        .eq('id', id);
    if (error) {
        if (window.showToast) showToast('변경 실패: ' + error.message, 'error');
        else alert('변경 실패: ' + error.message);
        return;
    }
    if (window.showToast) showToast(newActive ? '✅ 근무 복귀 처리됨' : '🌴 휴가 처리됨', 'success');
    loadMgrVacation();
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
            .select('id, user_id, amount, bank_name, account_number, account_holder, contact_phone, rrn, status, created_at, processed_at, tax_invoice_url')
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
            .select('id, email, username, role, contributor_tier, penalty_reason, deposit')
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
                userName = user.username || user.full_name || user.name || '이름미상';
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
                        <div style="color:#666;">${r.account_number || '-'}</div>
                        ${r.rrn ? `<div style="color:#e65100; font-size:10px;">주민: ${r.rrn}</div>` : ''}
                        ${r.contact_phone ? `<div style="color:#888; font-size:10px;">연락처: ${r.contact_phone}</div>` : ''}
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

// =========================================================
// [디자인마켓 출금 관리] - design_withdrawal_requests 테이블 기반
// =========================================================
const _DW_COUNTRY_FLAG = {
    KR:'🇰🇷', JP:'🇯🇵', US:'🇺🇸', CN:'🇨🇳', GB:'🇬🇧',
    DE:'🇩🇪', FR:'🇫🇷', IT:'🇮🇹', ES:'🇪🇸',
    SA:'🇸🇦', MA:'🇲🇦', SG:'🇸🇬', VN:'🇻🇳', TH:'🇹🇭'
};

// ═══ 디자인마켓 주문·결제 관리 ═══
function _doEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function _doMoney(n){ return (Number(n)||0).toLocaleString() + '원'; }
var _doView = 'all';  // 'all' | 'unsettled'
var _DO_SETTLED_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/logos/design/settled.json';

// 정산완료 처리된 입찰 ID 집합 — 스토리지 JSON (design_bids 컬럼 추가 없이 관리)
async function _doLoadSettledSet(){
    try {
        const r = await fetch(_DO_SETTLED_URL + '?_t=' + Date.now());
        if (r.ok){ const a = await r.json(); return new Set(Array.isArray(a) ? a.map(String) : []); }
    } catch(e){}
    return new Set();
}

window.setDesignOrderView = (v) => {
    _doView = v;
    const bAll = document.getElementById('doViewAll'), bUn = document.getElementById('doViewUnsettled');
    const filt = document.getElementById('doFilterStatus');
    if (bAll && bUn){
        bAll.style.background = v==='all' ? '#7c3aed' : '#fff';
        bAll.style.color = v==='all' ? '#fff' : '#64748b';
        bUn.style.background = v==='unsettled' ? '#dc2626' : '#fff';
        bUn.style.color = v==='unsettled' ? '#fff' : '#64748b';
    }
    if (filt) filt.style.display = v==='all' ? '' : 'none';
    loadDesignOrders();
};

window.loadDesignOrders = async () => {
    const area = document.getElementById('designOrderArea');
    if (!area) return;
    area.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">로딩 중...</div>';
    const statusFilter = (_doView === 'all') ? (document.getElementById('doFilterStatus')?.value || '') : '';
    try {
        // 미정산 뷰는 작업완료(released) 건만 대상
        let q = sb.from('design_bids')
            .select('id, request_id, designer_id, price, payment_status, status, client_completed_at, final_design_urls, created_at')
            .not('payment_status', 'is', null)
            .order('created_at', { ascending: false })
            .limit(300);
        if (_doView === 'unsettled') q = q.eq('payment_status', 'released');
        else if (statusFilter) q = q.eq('payment_status', statusFilter);
        const { data: bids, error } = await q;
        if (error) throw error;
        if (!bids || !bids.length) {
            area.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">조건에 맞는 주문이 없습니다.</div>';
            return;
        }
        const reqIds = [...new Set(bids.map(b => b.request_id).filter(Boolean))];
        const desIds = [...new Set(bids.map(b => b.designer_id).filter(Boolean))];
        // 2026-06-16: 경리 요청 — description / category / files 도 load 해서 상세를 표 상단에 노출.
        //   category 가 '본사-' 로 시작하면 후불(관공서) 의뢰, 아니면 카드결제 건.
        const { data: reqs } = await sb.from('design_requests').select('id, title, customer_id, phone, description, category, files').in('id', reqIds);
        const reqMap = {}; (reqs || []).forEach(r => reqMap[r.id] = r);
        const custIds = [...new Set((reqs || []).map(r => r.customer_id).filter(Boolean))];
        const { data: dps } = await sb.from('designer_profiles').select('id, display_name').in('id', desIds);
        const dpMap = {}; (dps || []).forEach(d => dpMap[d.id] = d);
        const { data: profs } = await sb.from('profiles').select('id, username, email').in('id', [...custIds, ...desIds]);
        const profMap = {}; (profs || []).forEach(p => profMap[p.id] = p);
        const settled = await _doLoadSettledSet();

        // 각 입찰에 표시용 필드 부착
        bids.forEach(b => {
            const req = reqMap[b.request_id] || {};
            const cust = profMap[req.customer_id] || {};
            const des = dpMap[b.designer_id] || profMap[b.designer_id] || {};
            b._title = req.title || '-';
            b._custName = cust.username || cust.email || '-';
            b._custPhone = req.phone || '-';
            b._desName = des.display_name || des.username || '-';
            b._settled = settled.has(String(b.id));
            // 2026-06-16: 상세 + 결제유형
            b._desc = (req.description || '').trim();
            b._category = req.category || '';
            b._files = Array.isArray(req.files) ? req.files : [];
            b._isHq = /^본사-/.test(b._category);   // 본사·관공서 후불 의뢰
        });

        if (_doView === 'unsettled') _doRenderUnsettled(area, bids);
        else _doRenderAll(area, bids);
    } catch (e) {
        area.innerHTML = `<div style="text-align:center;padding:30px;color:#dc2626;">오류: ${_doEsc(e.message || e)}</div>`;
    }
};

function _doPill(bg, fg, txt){ return `<span style="background:${bg};color:${fg};padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;">${txt}</span>`; }

// ── 전체 주문 테이블 ──
function _doRenderAll(area, bids){
    let rows = '';
    bids.forEach(b => {
        const hasFiles = Array.isArray(b.final_design_urls) && b.final_design_urls.length > 0;
        const ps = b.payment_status;
        let badge;
        if (ps === 'bank_pending') badge = _doPill('#fef3c7', '#92400e', '🟡 입금확인 대기');
        else if (ps === 'pending') badge = _doPill('#e0e7ff', '#3730a3', '⏳ 결제 대기');
        else if (ps === 'paid') badge = b.client_completed_at
            ? _doPill('#dbeafe', '#1e40af', '✅ 고객 완료확인 · 시안대기')
            : _doPill('#dcfce7', '#166534', '💰 결제완료 · 디자인 진행중');
        else if (ps === 'completed_pending_files') badge = _doPill('#dbeafe', '#1e40af', '✅ 고객 완료확인 · 시안대기');
        else if (ps === 'released') badge = b._settled
            ? _doPill('#ede9fe', '#5b21b6', '✅ 작업완료 · 정산완료')
            : _doPill('#fee2e2', '#b91c1c', '🔴 작업완료 · 미정산');
        else badge = _doPill('#f1f5f9', '#475569', _doEsc(ps));
        const sub = hasFiles ? `<div style="font-size:10px;color:#7c3aed;margin-top:3px;">📎 디자이너 시안 ${b.final_design_urls.length}개 업로드됨</div>` : '';
        // 2026-06-16: 결제유형 (카드결제 vs 본사-후불)
        let payTypePill;
        if (b._isHq) {
            const _paid = (ps === 'paid' || ps === 'completed_pending_files' || ps === 'released');
            payTypePill = _paid
                ? _doPill('#dcfce7', '#15803d', '🏢 본사후불 · 결제완료')
                : _doPill('#fef3c7', '#92400e', '🏢 본사후불 · 미결제');
        } else {
            const _paidCard = (ps === 'paid' || ps === 'completed_pending_files' || ps === 'released');
            payTypePill = _paidCard
                ? _doPill('#dbeafe', '#1e40af', '💳 카드 · 결제완료')
                : ps === 'bank_pending'
                ? _doPill('#fef3c7', '#92400e', '🏦 무통장 · 미결제')
                : _doPill('#fee2e2', '#b91c1c', '💳 카드 · 미결제');
        }
        // 2026-06-16: 상세 (description) 를 상단에 노출 — 줄바꿈 보존, 긴 글은 클램프.
        const fileLinks = (b._files || []).map((u, i) =>
            `<a href="${u}" target="_blank" style="display:inline-block;margin-right:6px;font-size:11px;color:#7c3aed;">📎 첨부${i+1}</a>`
        ).join('');
        const descBlock = (b._desc || fileLinks) ? `
            <div style="margin-top:6px;padding:8px 10px;background:#f8fafc;border-left:3px solid #c4b5fd;border-radius:6px;font-size:11.5px;color:#334155;white-space:pre-wrap;line-height:1.45;max-height:120px;overflow:auto;">
                ${_doEsc(b._desc || '(설명 없음)')}
                ${fileLinks ? `<div style="margin-top:6px;">${fileLinks}</div>` : ''}
            </div>` : '';
        let action = '<span style="color:#cbd5e1;">-</span>';
        if (ps === 'bank_pending') action = `<button class="btn btn-sm" style="background:#16a34a;color:#fff;border:none;" onclick="confirmDesignBankPayment('${b.id}', this)"><i class="fa-solid fa-check"></i> 입금확인</button>`;
        else if (ps === 'released' && !b._settled) action = `<button class="btn btn-sm" style="background:#7c3aed;color:#fff;border:none;" onclick="markDesignSettled('${b.id}', this)"><i class="fa-solid fa-coins"></i> 정산완료</button>`;
        else if (ps === 'released' && b._settled) action = `<button class="btn btn-sm" style="background:#fff;color:#7c3aed;border:1px solid #c4b5fd;" onclick="unmarkDesignSettled('${b.id}', this)">정산취소</button>`;
        const dt = b.created_at ? new Date(b.created_at).toLocaleDateString('ko-KR') : '-';
        rows += `<tr>
            <td style="font-size:11px;vertical-align:top;">${dt}</td>
            <td style="font-size:12px;vertical-align:top;">
                <div style="font-weight:700;">${_doEsc(b._title)}</div>
                ${descBlock}
            </td>
            <td style="font-size:12px;vertical-align:top;">${_doEsc(b._custName)}</td>
            <td style="font-size:12px;font-family:monospace;vertical-align:top;">${_doEsc(b._custPhone)}</td>
            <td style="font-size:12px;vertical-align:top;">${_doEsc(b._desName)}</td>
            <td style="text-align:right;font-size:12px;font-weight:800;vertical-align:top;">${_doMoney(b.price)}</td>
            <td style="vertical-align:top;">${payTypePill}</td>
            <td style="vertical-align:top;">${badge}${sub}</td>
            <td style="text-align:center;vertical-align:top;">${action}</td>
        </tr>`;
    });
    area.innerHTML = `<div style="overflow-x:auto;"><table style="min-width:1400px;">
        <thead><tr style="background:#faf5ff;">
            <th width="80">일자</th><th>의뢰명 · 상세</th><th width="110">고객</th><th width="120">연락처</th>
            <th width="120">디자이너</th><th width="90" style="text-align:right;">금액</th>
            <th width="170">결제유형</th>
            <th width="200">진행 상태</th><th width="120" style="text-align:center;">처리</th>
        </tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ── 디자이너별 미정산 모음 ──
function _doRenderUnsettled(area, bids){
    const unsettled = bids.filter(b => !b._settled);  // released && 미정산
    if (!unsettled.length){
        area.innerHTML = '<div style="text-align:center;padding:30px;color:#16a34a;font-weight:700;">🎉 미정산 건이 없습니다. 모든 작업완료 건이 정산되었습니다.</div>';
        return;
    }
    // 디자이너별 그룹핑
    const groups = {};
    unsettled.forEach(b => { (groups[b.designer_id] = groups[b.designer_id] || []).push(b); });
    const grandTotal = unsettled.reduce((s, b) => s + (Number(b.price) || 0), 0);
    const grandCount = unsettled.length;

    let html = `<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="font-weight:900;color:#b91c1c;font-size:15px;">🔴 전체 미정산 ${grandCount}건</div>
        <div style="font-weight:900;color:#b91c1c;font-size:18px;">${_doMoney(grandTotal)}</div>
    </div>`;

    Object.keys(groups).sort((a, b) => {
        const sa = groups[a].reduce((s, x) => s + (Number(x.price) || 0), 0);
        const sb2 = groups[b].reduce((s, x) => s + (Number(x.price) || 0), 0);
        return sb2 - sa;
    }).forEach(did => {
        const list = groups[did];
        const subtotal = list.reduce((s, x) => s + (Number(x.price) || 0), 0);
        const desName = list[0]._desName;
        let rows = '';
        list.forEach(b => {
            const dt = b.created_at ? new Date(b.created_at).toLocaleDateString('ko-KR') : '-';
            rows += `<tr>
                <td style="font-size:11px;">${dt}</td>
                <td style="font-size:12px;">${_doEsc(b._title)}</td>
                <td style="font-size:12px;">${_doEsc(b._custName)}</td>
                <td style="font-size:12px;font-family:monospace;">${_doEsc(b._custPhone)}</td>
                <td style="text-align:right;font-size:12px;font-weight:800;">${_doMoney(b.price)}</td>
                <td style="text-align:center;"><button class="btn btn-sm" style="background:#7c3aed;color:#fff;border:none;" onclick="markDesignSettled('${b.id}', this)"><i class="fa-solid fa-coins"></i> 정산완료</button></td>
            </tr>`;
        });
        html += `<div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#7c3aed,#a855f7);color:#fff;padding:10px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                <div style="font-weight:900;font-size:14px;">🎨 ${_doEsc(desName)} <span style="opacity:.85;font-weight:600;font-size:12px;">· 미정산 ${list.length}건</span></div>
                <div style="font-weight:900;font-size:15px;">${_doMoney(subtotal)}</div>
            </div>
            <div style="overflow-x:auto;"><table style="min-width:760px;margin:0;">
                <thead><tr style="background:#faf5ff;">
                    <th width="90">일자</th><th>의뢰명</th><th width="120">고객</th><th width="140">연락처</th>
                    <th width="110" style="text-align:right;">금액</th><th width="120" style="text-align:center;">처리</th>
                </tr></thead><tbody>${rows}</tbody></table></div>
        </div>`;
    });
    area.innerHTML = html;
}

window.confirmDesignBankPayment = async (bidId, btn) => {
    if (!confirm('이 건의 무통장 입금을 확인하고 결제완료 처리할까요?\n결제완료 시 디자이너에게 작업 시작 신호가 전달됩니다.')) return;
    if (btn) btn.disabled = true;
    try {
        const { error } = await sb.from('design_bids').update({ payment_status: 'paid' }).eq('id', bidId);
        if (error) throw error;
        alert('입금 확인 완료 — 결제완료 처리되었습니다.');
        loadDesignOrders();
    } catch (e) {
        alert('처리 실패: ' + (e.message || e));
        if (btn) btn.disabled = false;
    }
};

// 정산완료/취소 — 스토리지 JSON 으로 입찰 ID 관리
async function _doSaveSettled(set){
    const blob = new Blob([JSON.stringify([...set])], { type: 'application/json' });
    const up = await sb.storage.from('logos').upload('design/settled.json', blob, { upsert: true, contentType: 'application/json' });
    if (up.error) throw up.error;
}
window.markDesignSettled = async (bidId, btn) => {
    if (!confirm('이 건을 디자이너에게 정산완료 처리할까요?')) return;
    if (btn) btn.disabled = true;
    try {
        const set = await _doLoadSettledSet();
        set.add(String(bidId));
        await _doSaveSettled(set);
        alert('정산완료 처리되었습니다.');
        loadDesignOrders();
    } catch (e) { alert('처리 실패: ' + (e.message || e)); if (btn) btn.disabled = false; }
};
window.unmarkDesignSettled = async (bidId, btn) => {
    if (!confirm('정산완료를 취소할까요? (다시 미정산 상태가 됩니다)')) return;
    if (btn) btn.disabled = true;
    try {
        const set = await _doLoadSettledSet();
        set.delete(String(bidId));
        await _doSaveSettled(set);
        loadDesignOrders();
    } catch (e) { alert('처리 실패: ' + (e.message || e)); if (btn) btn.disabled = false; }
};

// 디자이너 dropdown 채우기 (한 번만 실행)
async function _populateDwDesignerDropdown(currentVal) {
    const sel = document.getElementById('dwFilterDesigner');
    if (!sel) return;
    try {
        // 2026-06-13: is_active=true 디자이너만 노출 (승인된 활성 디자이너만)
        const { data: dps } = await sb.from('designer_profiles')
            .select('id, display_name, is_active')
            .eq('is_active', true)
            .order('display_name', { ascending: true })
            .limit(500);
        const ids = (dps || []).map(d => d.id).filter(Boolean);
        const { data: profs } = await sb.from('profiles').select('id, email').in('id', ids);
        const eMap = {};
        (profs || []).forEach(p => eMap[p.id] = p.email);
        const prev = currentVal != null ? currentVal : sel.value;
        sel.innerHTML = '<option value="">🎨 활성 디자이너 전체</option>';
        (dps || []).forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            const em = eMap[d.id] ? ' · ' + eMap[d.id] : '';
            opt.textContent = (d.display_name || '(이름 없음)') + em;
            sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
    } catch (e) { console.warn('[populate designer dropdown]', e); }
}

// 2026-06-13: 디자이너별 미지급 합산 + 일괄정산 패널
window.loadDesignerSettlementPanel = async () => {
    const panel = document.getElementById('dwSettlementPanel');
    if (!panel) return;
    const designerId = document.getElementById('dwFilterDesigner')?.value || '';
    if (!designerId) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    panel.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">불러오는 중...</div>';

    try {
        // 미지급 (pending + approved) 만 합산
        const { data: pending, error } = await sb.from('design_withdrawal_requests')
            .select('*')
            .eq('designer_id', designerId)
            .in('status', ['pending', 'approved'])
            .order('requested_at', { ascending: false });
        if (error) throw error;

        // 누적 지급 합계 (paid)
        const { data: paidRows } = await sb.from('design_withdrawal_requests')
            .select('net_amount, gross_amount')
            .eq('designer_id', designerId)
            .eq('status', 'paid');
        const paidTotal = (paidRows || []).reduce((s, r) => s + (r.net_amount || r.gross_amount || 0), 0);

        // 디자이너 프로필
        const { data: dp } = await sb.from('designer_profiles').select('display_name, country').eq('id', designerId).maybeSingle();
        const { data: prof } = await sb.from('profiles').select('email').eq('id', designerId).maybeSingle();
        const dName = (dp && dp.display_name) || '디자이너';
        const dEmail = (prof && prof.email) || '';

        if (!pending || pending.length === 0) {
            panel.innerHTML = `
                <div style="padding:18px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="font-size:28px;">✓</div>
                        <div>
                            <div style="font-size:15px;font-weight:700;color:#166534;">${esc(dName)} — 미지급 의뢰 없음</div>
                            <div style="font-size:12px;color:#15803d;margin-top:3px;">${esc(dEmail)} · 누적 지급 ${paidTotal.toLocaleString()}원</div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const totalGross = pending.reduce((s, r) => s + (r.gross_amount || 0), 0);
        const totalNet   = pending.reduce((s, r) => s + (r.net_amount || r.gross_amount || 0), 0);
        const ids        = pending.map(r => r.id);

        // 은행 정보 (최신 row 기준)
        const latest = pending[0];
        const bankInfo = [
            latest.bank_name ? `<b>${esc(latest.bank_name)}</b>` : '',
            latest.bank_holder ? `(${esc(latest.bank_holder)})` : '',
            latest.bank_account ? `<span style="font-family:monospace;">${esc(latest.bank_account)}</span>` : ''
        ].filter(Boolean).join(' · ') || '<span style="color:#dc2626;">⚠ 은행 정보 미입력</span>';

        panel.innerHTML = `
            <div style="padding:18px 20px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #fbbf24;border-radius:14px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:12px;">
                    <div>
                        <div style="font-size:11px;color:#92400e;font-weight:700;margin-bottom:2px;">📊 미지급 합산</div>
                        <div style="font-size:18px;font-weight:800;color:#1e293b;">${esc(dName)} <span style="font-size:12px;color:#64748b;font-weight:500;">${esc(dEmail)}</span></div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px;color:#92400e;font-weight:600;">미지급 ${pending.length}건 · 누적 지급 ${paidTotal.toLocaleString()}원</div>
                        <div style="font-size:24px;font-weight:900;color:#dc2626;margin-top:2px;">${totalNet.toLocaleString()}원</div>
                        ${totalNet !== totalGross ? `<div style="font-size:10px;color:#94a3b8;">총액 ${totalGross.toLocaleString()}원 − 수수료 ${(totalGross-totalNet).toLocaleString()}원</div>` : ''}
                    </div>
                </div>
                <div style="padding:10px 14px;background:#fff;border:1px solid #fde68a;border-radius:10px;margin-bottom:12px;font-size:13px;color:#1e293b;">
                    🏦 ${bankInfo}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm" onclick='window.downloadSettlementCsv("${designerId}")' style="background:#0284c7;color:#fff;border:none;font-weight:700;padding:8px 16px;">
                        📥 정산서 다운로드 (CSV)
                    </button>
                    <button class="btn btn-sm" onclick='window.bulkSettleDesigner("${designerId}", ${totalNet}, ${pending.length})' style="background:#16a34a;color:#fff;border:none;font-weight:700;padding:8px 16px;">
                        ✓ 일괄 지급 처리 (${pending.length}건 / ${totalNet.toLocaleString()}원)
                    </button>
                </div>
            </div>
        `;
        // window 에 ids 보존 (일괄 지급에서 사용)
        window._dwSettlePendingIds = ids;
    } catch (e) {
        panel.innerHTML = `<div style="padding:14px;color:#ef4444;">패널 로드 실패: ${(e.message || e)}</div>`;
    }
};

window.downloadSettlementCsv = async (designerId) => {
    try {
        const { data: pending } = await sb.from('design_withdrawal_requests')
            .select('*')
            .eq('designer_id', designerId)
            .in('status', ['pending', 'approved'])
            .order('requested_at', { ascending: false });
        if (!pending || pending.length === 0) { alert('미지급 의뢰가 없습니다.'); return; }

        const { data: dp } = await sb.from('designer_profiles').select('display_name, country').eq('id', designerId).maybeSingle();
        const { data: prof } = await sb.from('profiles').select('email').eq('id', designerId).maybeSingle();

        const totalNet = pending.reduce((s, r) => s + (r.net_amount || r.gross_amount || 0), 0);

        // CSV — Excel 한글 호환 위해 UTF-8 BOM 추가
        const headers = ['신청일', '디자이너', '이메일', '국가', '요청액', '실수령', '은행', '예금주', '계좌번호', 'SWIFT/IBAN', '메모', '상태', '신청ID'];
        const rows = pending.map(r => [
            new Date(r.requested_at).toLocaleString('ko-KR'),
            (dp && dp.display_name) || '',
            (prof && prof.email) || '',
            r.country || 'KR',
            r.gross_amount || 0,
            r.net_amount || r.gross_amount || 0,
            r.bank_name || '',
            r.bank_holder || '',
            r.bank_account || '',
            [r.swift_bic, r.iban, r.routing_number].filter(Boolean).join(' / '),
            (r.memo || '').replace(/\n/g, ' '),
            r.status,
            r.id
        ]);
        // 요약 행 추가
        rows.push([]);
        rows.push(['합계', '', '', '', pending.reduce((s,r)=>s+(r.gross_amount||0),0), totalNet]);

        const esc = v => {
            const s = String(v == null ? '' : v);
            if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dName = ((dp && dp.display_name) || 'designer').replace(/[^\wㄱ-ㆎ가-힣]/g, '_');
        a.href = url;
        a.download = `정산서_${dName}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) { alert('다운로드 실패: ' + (e.message || e)); }
};

window.bulkSettleDesigner = async (designerId, totalAmount, count) => {
    if (!confirm(`총 ${count}건 · ${totalAmount.toLocaleString()}원을 일괄 지급 완료로 처리합니다.\n실제로 계좌이체를 완료하셨나요?`)) return;
    if (!confirm('정말 일괄 지급 처리합니다. 되돌릴 수 없습니다.')) return;

    const ids = window._dwSettlePendingIds || [];
    if (ids.length === 0) { alert('처리할 ID 가 없습니다. 패널을 다시 열어주세요.'); return; }

    try {
        // 100개씩 청크 처리
        function chunk(arr, n) { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i+n)); return r; }
        const now = new Date().toISOString();
        let total = 0;
        for (const c of chunk(ids, 100)) {
            const { error, count: cnt } = await sb.from('design_withdrawal_requests')
                .update({ status: 'paid', processed_at: now }, { count: 'exact' })
                .in('id', c)
                .in('status', ['pending', 'approved']);
            if (error) {
                // processed_at 컬럼 없을 가능성 — fallback
                if (/processed_at/i.test(error.message || '')) {
                    const fb = await sb.from('design_withdrawal_requests').update({ status: 'paid' }, { count: 'exact' }).in('id', c).in('status', ['pending', 'approved']);
                    if (fb.error) throw fb.error;
                    if (fb.count != null) total += fb.count;
                } else throw error;
            } else {
                if (cnt != null) total += cnt;
            }
        }

        if (total === 0) {
            alert('0건이 업데이트되었습니다 — RLS 권한 또는 정책 확인 필요\n(Supabase: CREATE POLICY ... ON design_withdrawal_requests)');
        } else {
            alert(`✓ ${total}건 지급 완료 처리됨`);
        }
        if (window.loadDesignerSettlementPanel) loadDesignerSettlementPanel();
        if (window.loadDesignWithdrawals) loadDesignWithdrawals();
    } catch (e) { alert('실패: ' + (e.message || e)); }
};

function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.loadDesignWithdrawals = async () => {
    const tbody = document.getElementById('designWithdrawalListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;">로딩 중...</td></tr>';

    // 최초 진입 시 dropdown 채우기
    const ddSel = document.getElementById('dwFilterDesigner');
    if (ddSel && ddSel.options.length <= 1) {
        await _populateDwDesignerDropdown();
    }

    const statusFilter   = document.getElementById('dwFilterStatus')?.value || '';
    const countryFilter  = document.getElementById('dwFilterCountry')?.value || '';
    const designerFilter = document.getElementById('dwFilterDesigner')?.value || '';

    try {
        let q = sb.from('design_withdrawal_requests')
            .select('*')
            .order('requested_at', { ascending: false })
            .limit(200);
        if (statusFilter)   q = q.eq('status', statusFilter);
        if (countryFilter)  q = q.eq('country', countryFilter);
        if (designerFilter) q = q.eq('designer_id', designerFilter);

        const { data: rows, error } = await q;
        if (error) throw error;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#94a3b8;">조건에 맞는 출금 요청이 없습니다.</td></tr>';
            return;
        }

        // Fetch designer profiles (display_name + email)
        const designerIds = [...new Set(rows.map(r => r.designer_id).filter(Boolean))];
        const { data: dps } = await sb.from('designer_profiles')
            .select('id, display_name, photo_url, country, is_demo')
            .in('id', designerIds);
        const dpMap = {};
        (dps || []).forEach(d => dpMap[d.id] = d);

        // Fetch tax profiles (verified state + full info — used as fallback when withdrawal row 의 필드가 비어 있을 때)
        // 2026-06-17: 디자이너가 출금 요청을 보내면 design_withdrawal_requests 의 tax/bank 필드가 비어서 저장되는 케이스가 있음.
        //   (designer-board.html 의 의뢰 정산 흐름이 legal_name 만 채우고 나머지를 빈 문자열로 INSERT)
        //   → 표시 시에는 designer_tax_profiles 의 값을 fallback 으로 사용.
        const { data: tps } = await sb.from('designer_tax_profiles')
            .select('*')
            .in('designer_id', designerIds);
        const tpMap = {};
        (tps || []).forEach(t => tpMap[t.designer_id] = t);

        // Fetch auth users email via profiles table
        const { data: profs } = await sb.from('profiles')
            .select('id, email, username')
            .in('id', designerIds);
        const profMap = {};
        (profs || []).forEach(p => profMap[p.id] = p);

        // 2026-06-19 v646: 디자이너별 작업 내역 한꺼번에 fetch — 경리과가 출처 확인 가능
        const ASSET_REWARD = { template:3000, vector:1000, image:500, logo:200 };
        const workMap = {};  // designerId → { templates, vectors, images, logos, orderClaimed, orderCompleted, orderSettled, totalAsset, totalOrder }
        try {
            // admin_templates approved by these designers
            const { data: assetRows } = await sb.from('admin_templates')
                .select('submitted_by, asset_type, payment_amount, slots, status')
                .in('submitted_by', designerIds)
                .eq('status', 'approved');
            (assetRows || []).forEach(r => {
                if (!workMap[r.submitted_by]) workMap[r.submitted_by] = { templates:0, vectors:0, images:0, logos:0, orderClaimed:0, orderCompleted:0, orderSettled:0, totalAsset:0, totalOrder:0 };
                const w = workMap[r.submitted_by];
                let t = r.asset_type;
                if (!t) t = (r.slots && r.slots.length) ? 'template' : 'vector';
                const amt = r.payment_amount || ASSET_REWARD[t] || 0;
                w.totalAsset += amt;
                if (t === 'template') w.templates++;
                else if (t === 'vector') w.vectors++;
                else if (t === 'image') w.images++;
                else if (t === 'logo') w.logos++;
            });
            // design_requests 의뢰 - description LIKE '%[DESIGNER:uid%' (designer-board 식 메타)
            // 한 번에 fetch — designer_id 가 description 안에 들어있어 필터링 어려우니 status in 으로 추리고 클라이언트 분류
            const { data: orderRows } = await sb.from('design_requests')
                .select('id, description, status, amount')
                .in('status', ['claimed','completed','settlement_requested','settled']);
            (orderRows || []).forEach(r => {
                const m = String(r.description || '').match(/\[DESIGNER:([^\]\s]+)/);
                if (!m) return;
                const did = m[1];
                if (!designerIds.includes(did)) return;
                if (!workMap[did]) workMap[did] = { templates:0, vectors:0, images:0, logos:0, orderClaimed:0, orderCompleted:0, orderSettled:0, totalAsset:0, totalOrder:0 };
                const w = workMap[did];
                const amt = r.amount || 0;
                if (r.status === 'claimed') w.orderClaimed++;
                else if (r.status === 'completed') { w.orderCompleted++; w.totalOrder += amt; }
                else if (r.status === 'settlement_requested') w.orderCompleted++;
                else if (r.status === 'settled') { w.orderSettled++; w.totalOrder += amt; }
            });
        } catch(workErr) { console.warn('[work breakdown]', workErr); }

        tbody.innerHTML = '';
        rows.forEach(r => {
            const dp = dpMap[r.designer_id] || {};
            const tp = tpMap[r.designer_id] || {};
            const profile = profMap[r.designer_id] || {};
            const flag = _DW_COUNTRY_FLAG[r.country] || '🌐';
            const email = profile.email || '';
            const displayName = dp.display_name || profile.username || '(이름없음)';
            const avatar = dp.photo_url
                ? `<img src="${dp.photo_url}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid #e2e8f0;">`
                : `<div style="width:32px;height:32px;border-radius:50%;background:#f5f3ff;color:#7c3aed;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">${displayName[0] || 'D'}</div>`;

            // 2026-06-17: 출금 요청 row 의 빈 필드를 디자이너의 designer_tax_profiles 로 보강.
            const _legal_name  = r.legal_name        || tp.legal_name        || '';
            const _tax_id_type = r.tax_id_type       || tp.tax_id_type       || '';
            const _tax_id      = r.tax_id            || tp.tax_id            || '';
            const _addr        = r.residence_address || tp.residence_address || '';
            const _bank_name   = r.bank_name         || tp.bank_name         || '';
            const _bank_holder = r.bank_holder       || tp.bank_holder       || '';
            const _bank_acct   = r.bank_account      || tp.bank_account      || '';
            const _swift       = r.swift_bic         || tp.swift_bic         || '';
            const _iban        = r.iban              || tp.iban              || '';
            const _routing     = r.routing_number    || tp.routing_number    || '';
            const _bank_addr   = r.bank_address      || tp.bank_address      || '';
            const _payout_cur  = r.payout_currency   || tp.payout_currency   || '';
            const _treaty      = (r.claim_tax_treaty != null ? r.claim_tax_treaty : tp.claim_tax_treaty) || false;
            const _source      = (!r.legal_name && !r.tax_id && tp.legal_name) ? '<span style="font-size:9px;color:#7c3aed;font-weight:700;">📋 프로필 사용</span>' : '';

            const legalInfo = `
                <div style="font-size:11px;line-height:1.5;">
                    <div><b>${_legal_name || '-'}</b> <span style="color:#64748b;">(${_tax_id_type || '-'})</span> ${_source}</div>
                    <div style="color:#64748b;font-family:monospace;word-break:break-all;">${_tax_id || '-'}</div>
                    <div style="color:#94a3b8;font-size:10px;">${_addr || '-'}</div>
                </div>`;

            let bankInfo = `
                <div style="font-size:11px;line-height:1.5;">
                    <div><b>${_bank_name || '-'}</b> / ${_bank_holder || '-'}</div>
                    <div style="color:#64748b;font-family:monospace;">${_bank_acct || '-'}</div>`;
            if (r.country && r.country !== 'KR') {
                bankInfo += `
                    <div style="margin-top:4px;padding:4px 6px;background:#eff6ff;border-radius:4px;">
                        ${_swift ? `<div style="color:#1e40af;"><b>SWIFT:</b> ${_swift}</div>` : ''}
                        ${_iban ? `<div style="color:#1e40af;word-break:break-all;"><b>IBAN:</b> ${_iban}</div>` : ''}
                        ${_routing ? `<div style="color:#1e40af;"><b>Routing:</b> ${_routing}</div>` : ''}
                        ${_bank_addr ? `<div style="color:#64748b;font-size:10px;">${_bank_addr}</div>` : ''}
                        ${_payout_cur ? `<div style="color:#7c3aed;font-weight:700;">${_payout_cur}${_treaty ? ' · Treaty claimed' : ''}</div>` : ''}
                    </div>`;
            }
            bankInfo += '</div>';

            let verifyBadge = '';
            if (tp.verified) {
                verifyBadge = `<span style="background:#dcfce7;color:#166534;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;">✓ 검증됨</span>`;
            } else {
                verifyBadge = `<button onclick="verifyDesignerTaxProfile('${r.designer_id}')" style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">⧖ 검증하기</button>`;
            }

            const stMap = {
                pending:  { lbl: '대기중',    style: 'background:#fef3c7;color:#92400e;' },
                approved: { lbl: '승인됨',    style: 'background:#dbeafe;color:#1e40af;' },
                rejected: { lbl: '거절됨',    style: 'background:#fee2e2;color:#991b1b;' },
                paid:     { lbl: '지급완료',  style: 'background:#fee2e2;color:#dc2626;border:1px solid #fecaca;' }
            };
            const st = stMap[r.status] || stMap.pending;

            let actionHtml = '';
            if (r.status === 'pending') {
                actionHtml = `
                    <div style="display:flex;flex-direction:column;gap:3px;align-items:stretch;">
                        <button class="btn btn-primary btn-sm" onclick="markDesignWithdrawalPaid('${r.id}')" style="padding:5px 8px;font-size:11px;font-weight:700;background:#16a34a;border-color:#15803d;color:#fff;">💰 지급전</button>
                        <div style="display:flex;gap:3px;">
                            <button class="btn btn-outline btn-sm" onclick="approveDesignWithdrawal('${r.id}')" style="padding:3px 6px;font-size:10px;flex:1;">승인만</button>
                            <button class="btn btn-outline btn-sm" onclick="rejectDesignWithdrawal('${r.id}')" style="padding:3px 6px;font-size:10px;flex:1;color:#dc2626;border-color:#fecaca;">거절</button>
                        </div>
                    </div>`;
            } else if (r.status === 'approved') {
                actionHtml = `<button class="btn btn-primary btn-sm" onclick="markDesignWithdrawalPaid('${r.id}')" style="padding:5px 10px;font-size:11px;background:#16a34a;border-color:#15803d;color:#fff;">💰 지급전</button>`;
            } else {
                actionHtml = `<span style="font-size:10px;color:#94a3b8;">${r.processed_at ? new Date(r.processed_at).toLocaleDateString() : '-'}</span>`;
            }

            // v646: 작업 내역 — 디자이너의 자산 + 의뢰 합산
            const w = workMap[r.designer_id] || { templates:0, vectors:0, images:0, logos:0, orderClaimed:0, orderCompleted:0, orderSettled:0, totalAsset:0, totalOrder:0 };
            const assetTotal = w.totalAsset;
            const orderTotal = w.totalOrder;
            const workCell = `
                <div style="font-size:11px; line-height:1.55;">
                    <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:6px; padding:4px 6px; margin-bottom:4px;">
                        <b style="color:#5b21b6; font-size:10px;">자산 ${assetTotal.toLocaleString()}원</b>
                        <div style="color:#475569; font-size:10px;">T ${w.templates} · V ${w.vectors} · I ${w.images} · L ${w.logos}</div>
                    </div>
                    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:6px; padding:4px 6px;">
                        <b style="color:#065f46; font-size:10px;">의뢰 ${orderTotal.toLocaleString()}원</b>
                        <div style="color:#475569; font-size:10px;">진행 ${w.orderClaimed} · 완료 ${w.orderCompleted} · 지급 ${w.orderSettled}</div>
                    </div>
                </div>`;
            tbody.innerHTML += `
                <tr style="vertical-align:top;">
                    <td style="font-size:11px;">${new Date(r.requested_at).toLocaleDateString()}<br><span style="color:#94a3b8;">${new Date(r.requested_at).toLocaleTimeString()}</span></td>
                    <td>
                        <div style="display:flex;gap:8px;align-items:center;">
                            ${avatar}
                            <div style="min-width:0;">
                                <div style="font-size:12px;font-weight:700;${dp.is_demo?'color:#f59e0b;':''}">${displayName}${dp.is_demo?' <span style="font-size:9px;">(DEMO)</span>':''}</div>
                                <div style="font-size:10px;color:#64748b;word-break:break-all;">${email}</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;font-size:14px;">${flag}<br><span style="font-size:10px;color:#64748b;">${r.country || '-'}</span></td>
                    <td style="text-align:right;font-weight:700;color:#7c3aed;">${(r.gross_amount||0).toLocaleString()}원</td>
                    <td style="text-align:right;font-weight:700;color:#16a34a;">${(r.net_amount||0).toLocaleString()}원<br><span style="font-size:9px;color:#94a3b8;font-weight:400;">(-${((r.vat_amount||0)+(r.card_fee_amount||0)+(r.platform_fee_amount||0)).toLocaleString()} fee)</span></td>
                    <td>${workCell}</td>
                    <td>${legalInfo}</td>
                    <td>${bankInfo}</td>
                    <td style="text-align:center;">${verifyBadge}</td>
                    <td style="text-align:center;"><span class="badge" style="${st.style}padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;">${st.lbl}</span></td>
                    <td style="text-align:center;">${actionHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error('[loadDesignWithdrawals] error:', e);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#ef4444;padding:20px;">${e.message}</td></tr>`;
    }
};

// These four handlers call SECURITY DEFINER RPCs defined in
// phase5b_admin_withdrawal_rpcs.sql — the RPC itself checks that
// profiles.role='admin' and then bypasses RLS to update the rows.
// Direct table UPDATEs from the client fail silently under RLS
// because admin users are not the row owner.
window.verifyDesignerTaxProfile = async (designerId) => {
    if (!confirm("이 디자이너의 세금·은행 정보를 검증 완료로 표시하시겠습니까?\n\n검증 전에 세금 ID, 은행 정보, 주소가 모두 정확한지 확인하세요.")) return;
    try {
        const { error } = await sb.rpc('admin_verify_designer_tax_profile', { _designer_id: designerId });
        if (error) throw error;
        showToast("프로필 검증 완료", "success");
        loadDesignWithdrawals();
    } catch (e) {
        showToast("검증 실패: " + e.message, "error");
    }
};

window.approveDesignWithdrawal = async (reqId) => {
    if (!confirm("이 출금 요청을 승인하시겠습니까?\n\n승인 후 송금을 진행하고, 송금이 완료되면 '지급완료 처리' 버튼을 눌러주세요.")) return;
    try {
        const { error } = await sb.rpc('admin_approve_design_withdrawal', { _req_id: reqId });
        if (error) throw error;
        showToast("출금 요청이 승인되었습니다. 송금 후 지급완료 처리를 해주세요.", "success");
        loadDesignWithdrawals();
    } catch (e) {
        showToast("승인 실패: " + e.message, "error");
    }
};

window.rejectDesignWithdrawal = async (reqId) => {
    const reason = prompt("거절 사유를 입력하세요 (디자이너에게 전달됩니다):");
    if (reason === null) return;
    try {
        const { error } = await sb.rpc('admin_reject_design_withdrawal', { _req_id: reqId, _reason: reason || null });
        if (error) throw error;
        showToast("거절 처리 및 잔액 복원 완료", "success");
        loadDesignWithdrawals();
    } catch (e) {
        showToast("거절 실패: " + e.message, "error");
    }
};

window.markDesignWithdrawalPaid = async (reqId) => {
    if (!confirm("송금이 완료되었습니까? 지급완료 상태로 변경합니다.")) return;
    try {
        const { error } = await sb.rpc('admin_mark_design_withdrawal_paid', { _req_id: reqId });
        if (error) throw error;
        showToast("지급완료 처리되었습니다", "success");
        loadDesignWithdrawals();
    } catch (e) {
        showToast("처리 실패: " + e.message, "error");
    }
};

// =========================================================
// [출력 파트너 관리]
// =========================================================
window.loadProductionPartners = async () => {
    const tbody = document.getElementById('productionPartnerListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">로딩 중...</td></tr>';

    const statusFilter = document.getElementById('ppFilterStatus')?.value || '';
    const countryFilter = document.getElementById('ppFilterCountry')?.value || '';

    try {
        let q = sb.from('production_partners')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        if (statusFilter) q = q.eq('status', statusFilter);
        if (countryFilter) q = q.eq('country', countryFilter);

        const { data: rows, error } = await q;
        if (error) throw error;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">등록된 파트너가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        rows.forEach(r => {
            // Parse capabilities
            const caps = Array.isArray(r.capabilities) ? r.capabilities : [];
            const capHtml = caps.map(c => {
                const items = (c.items || []).join(', ');
                return `<span style="display:inline-block;background:#f5f3ff;color:#7c3aed;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin:1px;">${c.category}${items ? ': '+items : ''}</span>`;
            }).join(' ');

            // Bank info
            let bankHtml = `<div style="font-size:11px;line-height:1.4;">
                <div><b>${r.bank_name || '-'}</b> / ${r.bank_holder || '-'}</div>
                <div style="color:#64748b;font-family:monospace;">${r.bank_account || '-'}</div>`;
            if (r.country && r.country !== 'KR' && r.swift_bic) {
                bankHtml += `<div style="color:#1e40af;font-size:10px;">SWIFT: ${r.swift_bic}${r.iban ? ' | IBAN: '+r.iban : ''}</div>`;
            }
            bankHtml += '</div>';

            // Status badge
            const stMap = {
                pending:   { lbl: '대기중',  style: 'background:#fef3c7;color:#92400e;' },
                active:    { lbl: '활성',    style: 'background:#dcfce7;color:#166534;' },
                verified:  { lbl: '검증됨',  style: 'background:#dbeafe;color:#1e40af;' },
                suspended: { lbl: '정지',    style: 'background:#fee2e2;color:#991b1b;' }
            };
            const st = stMap[r.status] || stMap.pending;

            // Actions
            let actionHtml = '';
            if (r.status === 'pending') {
                actionHtml = `
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <button class="btn btn-success btn-sm" onclick="approveProductionPartner('${r.id}')" style="padding:4px 8px;font-size:11px;">승인</button>
                        <button class="btn btn-outline btn-sm" onclick="suspendProductionPartner('${r.id}')" style="padding:3px 6px;font-size:10px;color:#dc2626;border-color:#fecaca;">거절</button>
                    </div>`;
            } else if (r.status === 'active' || r.status === 'verified') {
                actionHtml = `<button class="btn btn-outline btn-sm" onclick="suspendProductionPartner('${r.id}')" style="padding:3px 6px;font-size:10px;color:#dc2626;border-color:#fecaca;">정지</button>`;
            } else if (r.status === 'suspended') {
                actionHtml = `<button class="btn btn-success btn-sm" onclick="approveProductionPartner('${r.id}')" style="padding:4px 8px;font-size:11px;">재활성</button>`;
            }

            // Country flag
            const flags = {KR:'🇰🇷',JP:'🇯🇵',US:'🇺🇸',CN:'🇨🇳',GB:'🇬🇧',DE:'🇩🇪',FR:'🇫🇷',ES:'🇪🇸',SA:'🇸🇦',MA:'🇲🇦',SG:'🇸🇬',IT:'🇮🇹',VN:'🇻🇳',TH:'🇹🇭'};
            const flag = flags[r.country] || '🌐';

            tbody.innerHTML += `
                <tr style="vertical-align:top;">
                    <td style="font-size:11px;">${new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                        <div style="font-size:12px;font-weight:700;">${r.company_name || '-'}</div>
                        <div style="font-size:10px;color:#64748b;">${r.contact_name} · ${r.phone}</div>
                        <div style="font-size:10px;color:#94a3b8;">${r.email}</div>
                    </td>
                    <td style="text-align:center;">${flag}<br><span style="font-size:10px;color:#64748b;">${r.country}</span></td>
                    <td>
                        <div style="font-size:10px;color:#64748b;">${r.contact_name}</div>
                        <div style="font-size:11px;font-weight:600;">${r.phone}</div>
                        <div style="font-size:10px;color:#94a3b8;">${r.email}</div>
                    </td>
                    <td style="max-width:300px;"><div style="display:flex;flex-wrap:wrap;gap:2px;">${capHtml || '<span style="color:#94a3b8;font-size:11px;">없음</span>'}</div>${r.capabilities_note ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">${r.capabilities_note}</div>` : ''}</td>
                    <td>${bankHtml}</td>
                    <td style="text-align:center;"><span style="${st.style}padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;">${st.lbl}</span></td>
                    <td style="text-align:center;">${actionHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error('[loadProductionPartners] error:', e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:20px;">${e.message}</td></tr>`;
    }
};

window.approveProductionPartner = async (partnerId) => {
    if (!confirm("이 파트너를 승인하시겠습니까?")) return;
    try {
        const { error } = await sb.rpc('admin_approve_production_partner', { _partner_id: partnerId });
        if (error) throw error;
        showToast("파트너 승인 완료", "success");
        loadProductionPartners();
    } catch (e) {
        showToast("승인 실패: " + e.message, "error");
    }
};

window.suspendProductionPartner = async (partnerId) => {
    const reason = prompt("정지 사유를 입력하세요:");
    if (reason === null) return;
    try {
        const { error } = await sb.from('production_partners')
            .update({ status: 'suspended', admin_note: reason || null })
            .eq('id', partnerId);
        if (error) throw error;
        showToast("파트너 정지됨", "success");
        loadProductionPartners();
    } catch (e) {
        showToast("정지 실패: " + e.message, "error");
    }
};
// =========================================================
// [서비스 종합관리 대시보드] — 실시간 통계 로드
// =========================================================
window.loadCommunityHubStats = async () => {
    try {
        // Design market stats
        const [{ count: designerCount }, { count: gigCount }, { count: requestCount }, { count: withdrawCount }] = await Promise.all([
            sb.from('designer_profiles').select('*', { count: 'exact', head: true }),
            sb.from('designer_gigs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
            sb.from('design_requests').select('*', { count: 'exact', head: true }),
            sb.from('design_withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
        ]);
        const ds = document.getElementById('hubDesignStats');
        if (ds) ds.innerHTML = `디자이너 <b>${designerCount||0}</b> · Gig <b>${gigCount||0}</b> · 의뢰 <b>${requestCount||0}</b> · 대기출금 <b>${withdrawCount||0}</b>`;

        // Partner stats
        const [{ count: partnerTotal }, { count: partnerPending }, { count: partnerActive }] = await Promise.all([
            sb.from('production_partners').select('*', { count: 'exact', head: true }),
            sb.from('production_partners').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            sb.from('production_partners').select('*', { count: 'exact', head: true }).eq('status', 'active')
        ]);
        const ps = document.getElementById('hubPartnerStats');
        if (ps) ps.innerHTML = `전체 <b>${partnerTotal||0}</b> · 대기 <b style="color:#d97706;">${partnerPending||0}</b> · 활성 <b style="color:#16a34a;">${partnerActive||0}</b>`;
    } catch (e) {
        console.warn('[communityHub] stats load failed:', e);
    }
};
