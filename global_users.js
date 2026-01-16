import { sb } from "./global_config.js";
import { showLoading } from "./global_common.js";

// [회원 목록 로드]
// [회원 목록 로드 - 필터/정렬/검색 기능 강화]
// [회원 목록 로드]
// ==========================================
// [회원 관리 통합] 페이지네이션 & 검색 & 메모
// ==========================================

// [전역 변수] 회원 페이지네이션용
let currentMemberPage = 1;
const memberItemsPerPage = 30; // 한 페이지당 30명

// [회원 목록 로드]
window.loadMembers = async (isNewSearch = false) => { 
    // 검색이나 필터 변경 시 1페이지로 초기화
    if(isNewSearch) currentMemberPage = 1;

    const keyword = document.getElementById('memberSearchInput') ? document.getElementById('memberSearchInput').value.trim() : '';
    const sortVal = document.getElementById('memberSort').value;
    const roleVal = document.getElementById('memberFilterRole').value;
    
    const tbody = document.getElementById('memberListBody'); 
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';
    
    // 1. 쿼리 구성 (전체 개수 파악을 위해 count 옵션 사용)
    let query = sb.from('profiles').select('*', { count: 'exact' });
    
    // 필터 조건
    if (roleVal !== 'all') query = query.eq('role', roleVal);
    if (keyword) query = query.or(`email.ilike.%${keyword}%,full_name.ilike.%${keyword}%`);

    // 2. 정렬 조건
    if (sortVal === 'deposit_desc') query = query.order('deposit', { ascending: false });
    else if (sortVal === 'deposit_asc') query = query.order('deposit', { ascending: true });
    else if (sortVal === 'mileage_desc') query = query.order('mileage', { ascending: false });
    else if (sortVal === 'spend_desc') query = query.order('total_spend', { ascending: false });
    else query = query.order('created_at', { ascending: false }); // 기본값

    // 3. 페이지네이션 범위 설정 (0부터 시작)
    const from = (currentMemberPage - 1) * memberItemsPerPage;
    const to = from + memberItemsPerPage - 1;
    
    const { data: members, error, count } = await query.range(from, to);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">로드 실패: ${error.message}</td></tr>`;
        return;
    }

    // 4. 상단 정보 업데이트 (전체 인원수 & 페이지 번호)
    const totalCount = count || 0;
    document.getElementById('totalMemberCount').innerText = `${totalCount.toLocaleString()}명`;
    
    const totalPages = Math.ceil(totalCount / memberItemsPerPage) || 1;
    document.getElementById('memberPageLabel').innerText = `Page ${currentMemberPage} / ${totalPages}`;

    // 5. 테이블 렌더링
    tbody.innerHTML = '';
    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">회원이 없습니다.</td></tr>';
        return;
    }

    members.forEach(m => {
        const r = m.role || 'customer';
        const deposit = m.deposit || 0; 
        const mileage = m.mileage || 0;
        const name = m.full_name || '이름 없음';
        const memo = m.admin_memo || ''; 

        // 등급 선택 박스
        const roleSelect = `
            <select onchange="updateMemberRole('${m.id}', this.value)" style="padding:2px; border:1px solid #cbd5e1; border-radius:4px; width:100%; font-size:11px;">
                <option value="customer" ${r==='customer'?'selected':''}>일반</option>
                <option value="gold" ${r==='gold'?'selected':''}>🥇 골드</option>
                <option value="platinum" ${r==='platinum'?'selected':''}>💎 플래티넘</option>
                <option value="franchise" ${r==='franchise'?'selected':''}>🏢 가맹점</option>
                <option value="admin" ${r==='admin'?'selected':''}>🛠 관리자</option>
            </select>
        `;

        // 기여자 등급 선택 박스
        const tier = m.contributor_tier || 'regular';
        const tierSelect = `
            <div style="margin-top:2px; display:flex; align-items:center; gap:2px;">
                <span style="font-size:10px; color:#6366f1; font-weight:bold;">기여:</span>
                <select onchange="updateContributorTier('${m.id}', this.value)" style="padding:1px; border:1px solid #6366f1; color:#6366f1; border-radius:4px; font-weight:bold; font-size:10px; flex:1;">
                    <option value="regular" ${tier==='regular'?'selected':''}>😐 일반</option>
                    <option value="excellent" ${tier==='excellent'?'selected':''}>🏆 우수</option>
                    <option value="hero" ${tier==='hero'?'selected':''}>👑 영웅</option>
                </select>
            </div>
        `;

        // 자산 관리 버튼
        const walletBtn = `
            <button class="btn btn-outline btn-sm" onclick="openWalletModal('${m.id}', '${m.email}', ${deposit})" style="width:100%; margin-bottom:2px; padding:2px;">
                <i class="fa-solid fa-coins" style="color:#eab308;"></i> 예치금
            </button>
            <button class="btn btn-outline btn-sm" onclick="editMileageManual('${m.id}', '${m.email}', ${mileage})" style="width:100%; padding:2px;">
                <i class="fa-solid fa-star" style="color:#059669;"></i> 마일리지
            </button>
        `;

        // 등급 뱃지 스타일
        let badgeColor = '#f1f5f9'; let badgeText = '#64748b';
        if (r === 'gold') { badgeColor = '#fef9c3'; badgeText = '#ca8a04'; }
        if (r === 'platinum') { badgeColor = '#e0f2fe'; badgeText = '#0369a1'; }
        if (r === 'franchise') { badgeColor = '#f3e8ff'; badgeText = '#7e22ce'; }
        if (r === 'admin') { badgeColor = '#fee2e2'; badgeText = '#dc2626'; }

        // 메모 입력창 (너비는 CSS colgroup으로 200px 제한됨)
        const memoHtml = `
            <div style="display:flex; flex-direction:column; gap:2px;">
                <textarea id="memo_${m.id}" style="width:100%; height:34px; font-size:11px; padding:4px; border:1px solid #e2e8f0; border-radius:4px; resize:vertical; box-sizing:border-box;">${memo}</textarea>
                <button class="btn btn-sky btn-sm" style="align-self:flex-end; padding:1px 6px; font-size:10px;" onclick="updateMemberMemo('${m.id}')">저장</button>
            </div>
        `;

        // (loadMembers 함수 내부의 반복문 안쪽)
        tbody.innerHTML += `
            <tr style="border-bottom:1px solid #f1f5f9; height:50px;">
                <td style="color:#64748b; font-size:12px; text-align:center;">${new Date(m.created_at).toLocaleDateString()}</td>
                
                <td style="padding:10px 15px;">
                    <div style="font-weight:bold; font-size:14px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                    <div style="font-size:12px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.email}">${m.email}</div>
                </td>
                
                <td style="text-align:right; padding:10px 15px;">
                   <div style="font-size:13px; margin-bottom:2px;">💰 <b style="color:#334155;">${deposit.toLocaleString()}</b></div>
                   <div style="font-size:13px;">Ⓜ️ <b style="color:#059669;">${mileage.toLocaleString()}</b></div>
                   <div style="font-size:10px; color:#94a3b8; margin-top:3px;">(총구매: ${(m.total_spend || 0).toLocaleString()})</div>
                </td>
                
                <td style="padding:5px; text-align:center;">
                    ${walletBtn}
                </td> 
                
                <td style="padding:5px 15px;">
                    ${memoHtml}
                </td>
                
                <td style="text-align:center;">
                    <span class="badge" style="background:${badgeColor}; color:${badgeText}; border:1px solid ${badgeColor}; font-size:11px; padding:4px 8px;">${r.toUpperCase()}</span>
                </td>
                
                <td style="padding:5px 15px;">
                    ${roleSelect}
                    ${tierSelect}
                </td>
            </tr>
        `;
    });
};

// [페이지 변경 함수]
window.changeMemberPage = (step) => {
    const next = currentMemberPage + step;
    if(next < 1) return alert("첫 페이지입니다.");
    
    // 다음 페이지 데이터 존재 여부는 loadMembers 내부에서 빈 배열일 때 처리됨
    // (또는 현재 페이지가 totalPages와 같으면 막을 수도 있음)
    currentMemberPage = next;
    loadMembers(false); 
};

// [회원 메모 저장]
window.updateMemberMemo = async (userId) => {
    const memoVal = document.getElementById(`memo_${userId}`).value;
    const { error } = await sb.from('profiles').update({ admin_memo: memoVal }).eq('id', userId);
    if(error) alert("저장 실패: " + error.message);
    else alert("메모가 저장되었습니다.");
};

// [회원 등급 변경]
window.updateMemberRole = async (id, newRole) => { 
    if(!confirm(`등급을 '${newRole}'(으)로 변경하시겠습니까?`)) { 
        loadMembers(false); return; 
    } 
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', id); 
    if(error) alert("실패: " + error.message); 
    else alert("변경되었습니다."); 
};

// [기여자 등급 변경]
window.updateContributorTier = async (id, newTier) => {
    if(!confirm("기여자 등급을 변경하시겠습니까?")) {
        loadMembers(false); return;
    }
    const { error } = await sb.from('profiles').update({ contributor_tier: newTier }).eq('id', id);
    if(error) alert("실패: " + error.message);
    else alert("변경되었습니다.");
};

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

            for (const row of jsonData) {
                const email = row['이메일'] || row['email'] || row['Email'];
                const mileageVal = row['마일리지'] || row['mileage'] || row['적립금'];

                if (email && mileageVal !== undefined) {
                    const amount = parseInt(mileageVal);
                    if (!isNaN(amount)) {
                        const { error } = await sb.from('profiles').update({ mileage: amount }).eq('email', email);
                        if (!error) successCount++; else failCount++;
                    }
                }
            }
            alert(`✅ 완료: 성공 ${successCount}명, 실패 ${failCount}명`);
            loadMembers();
        } catch (err) {
            alert("엑셀 오류: " + err.message);
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
    if (isNaN(newAmount)) return alert("숫자만 입력해주세요.");

    const { error } = await sb.from('profiles').update({ mileage: newAmount }).eq('id', userId);
    if (error) alert("수정 실패: " + error.message);
    else { alert("수정되었습니다."); loadMembers(); }
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

    try {
        const { data: apps, error } = await sb.from('partner_applications')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

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
    if (!confirm(`[승인 확인]\n업체명: ${companyName}\n지역: ${region}\n\n이 회원을 '가맹점' 등급으로 승격시키겠습니까?`)) return;

    try {
        const { error: profileErr } = await sb.from('profiles').update({ role: 'franchise', region: region }).eq('id', userId);
        if (profileErr) throw profileErr;

        const { error: appErr } = await sb.from('partner_applications').update({ status: 'approved' }).eq('id', appId);
        if (appErr) throw appErr;

        alert(`🎉 승인 완료! '${companyName}'님은 이제 파트너스 기능을 사용할 수 있습니다.`);
        loadPartnerApplications();
    } catch (e) {
        alert("승인 오류: " + e.message);
    }
};

// [출금 요청 목록 로드]
window.loadWithdrawals = async () => {
    const tbody = document.getElementById('withdrawalListBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">로딩 중...</td></tr>';

    try {
        // [수정] .limit(50) 추가: 데이터가 많으면 프로필 조회(in 쿼리)가 실패하여 모두 '삭제된 회원'으로 뜰 수 있음
        const { data: requests, error } = await sb.from('withdrawal_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50); 

        if (error) throw error;

        if (!requests || requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">출금 신청 내역이 없습니다.</td></tr>';
            return;
        }

        // 사용자 프로필 정보 가져오기
        const userIds = [...new Set(requests.map(r => r.user_id))];
        
        const { data: users, error: userError } = await sb.from('profiles')
            .select('id, email, full_name')
            .in('id', userIds);

        if(userError) {
            console.error("프로필 조회 실패:", userError);
            // 에러가 나도 목록은 보여주되 유저 정보만 비게 됨
        }

        const userMap = {};
        if (users) users.forEach(u => userMap[u.id] = u);

        tbody.innerHTML = '';
        requests.forEach(r => {
            const amount = (r.amount || 0).toLocaleString() + '원';
            const date = new Date(r.created_at).toLocaleDateString();
            
            // 은행 정보
            const bankName = r.bank_name || '은행미상';
            const accHolder = r.account_holder || '예금주미상';
            const accNum = r.account_number || '-';
            
            const bankInfoHtml = `
                <div>
                    <span style="font-weight:bold; color:#334155;">${bankName}</span> 
                    <span style="font-size:11px; color:#64748b;">(${accHolder})</span>
                </div>
                <div style="font-size:12px; color:#475569; letter-spacing:0.5px;">${accNum}</div>
            `;

            // 주민번호
            const residentNum = r.resident_number || r.rrn || '-';

            // 유저 정보 매핑
            const user = userMap[r.user_id];
            const displayUser = user ? 
                `<div><span style="font-weight:bold;">${user.full_name || '이름미상'}</span></div><div style="font-size:11px; color:#888;">${user.email}</div>` 
                : `<span style="font-size:11px; color:#999;">삭제된 회원<br>(${r.user_id ? r.user_id.substring(0,8) : 'unknown'}...)</span>`;

            // 상태 뱃지 및 버튼
            let statusBadge = `<span class="badge" style="background:#f1f5f9; color:#64748b;">${r.status}</span>`;
            let actionBtn = '-';

            if (r.status === 'pending') {
                statusBadge = `<span class="badge" style="background:#fee2e2; color:#ef4444;">승인대기</span>`;
                actionBtn = `
                    <div style="display:flex; gap:4px; justify-content:center;">
                        <button class="btn btn-success btn-sm" onclick="processWithdrawal('${r.id}', 'approved')">승인</button>
                        <button class="btn btn-danger btn-sm" onclick="processWithdrawal('${r.id}', 'rejected')">반려</button>
                    </div>
                `;
            } else if (r.status === 'approved') {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#15803d;">지급완료</span>`;
                actionBtn = `<span style="font-size:11px; color:#aaa;">처리됨</span>`;
            } else if (r.status === 'rejected') {
                statusBadge = `<span class="badge" style="background:#94a3b8; color:#fff;">반려됨</span>`;
            }

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${displayUser}</td>
                    <td style="text-align:right; font-weight:bold; color:#d97706;">${amount}</td>
                    <td style="letter-spacing:1px;">${residentNum}</td>
                    <td>${bankInfoHtml}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">${actionBtn}</td>
                </tr>`;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};
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
        alert("처리되었습니다.");
        loadWithdrawals(); 
    } catch(e) {
        alert("처리 실패: " + e.message);
    }
};

// [결산]
window.loadAccountingData = async () => {
    alert("결산 조회 기능 (global_admin.js 또는 별도 구현 필요)");
};