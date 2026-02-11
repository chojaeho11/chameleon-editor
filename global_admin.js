import { sb, initConfig } from "./global_config.js";

// ✅ [추가] 이 두 줄을 꼭 넣어야 팝업창 오류가 해결됩니다!
window.sb = sb;
window._supabase = sb; 

import { checkAdminAccess } from "./global_common.js";

// 나머지 기능 파일들 불러오기
import "./global_orders.js";
import "./global_products.js";
import "./global_users.js";
import "./global_assets.js";
import "./global_stats.js";

window.addEventListener('DOMContentLoaded', async () => { 
    // 1. 화면 깜빡임 방지
    document.body.style.visibility = 'hidden';
    
    // 2. 설정 초기화
    await initConfig(); 
    
    // 3. 보안 체크
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return;

    console.log("관리자 페이지 로드 완료");

    // 4. 초기 탭 로드
    if(window.showSection) {
        window.showSection('sec-vip'); 
    }
});

// 탭 전환 기능
// [탭 전환 기능 수정]
window.showSection = (secId, navEl) => {
    // 1. 탭 스타일 활성화
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const targetSec = document.getElementById(secId);
    if(targetSec) targetSec.classList.add('active');

    // 2. 메뉴 스타일 활성화
    if (navEl) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        navEl.classList.add('active');

        // ★ [추가된 부분] 상단 페이지 제목 변경 로직
        // 클릭한 메뉴 안에 있는 텍스트를 가져와서 상단 제목(.page-title)에 넣습니다.
        const titleText = navEl.innerText.trim(); 
        const pageTitleEl = document.querySelector('.page-title');
        if(pageTitleEl) pageTitleEl.innerText = titleText;
    }

    // 3. 섹션별 데이터 로드 (Lazy Load)
    switch(secId) {
        case 'sec-orders': if(window.loadOrders) window.loadOrders(); break;
        case 'sec-vip': if(window.loadVipOrders) window.loadVipOrders(); break;
        case 'sec-bankda': if(window.loadBankdaList) window.loadBankdaList(); break;
        case 'sec-stats': if(window.loadStatsData) window.loadStatsData(); break;
        case 'sec-members': if(window.loadMembers) window.loadMembers(); break;
        case 'sec-templates': 
            // 템플릿 로드 함수가 있는지 확인 후 실행
            if(window.loadTemplates) window.loadTemplates(); 
            if(window.loadProductKeys) window.loadProductKeys();
            break;
        case 'sec-fonts': if(window.loadFonts) window.loadFonts(); break;
        case 'sec-products': 
            if(window.loadTopCategoriesList) window.loadTopCategoriesList(); 
            if(window.loadCategories) window.loadCategories(); 
            if(window.loadSystemDB) window.loadSystemDB();
            break;
        case 'sec-staff': if(window.loadStaffList) window.loadStaffList(); break;
        case 'sec-withdrawals': if(window.loadWithdrawals) window.loadWithdrawals(); break;
        case 'sec-partner-apps': if(window.loadPartnerApplications) window.loadPartnerApplications(); break;
        case 'sec-partner-products': if(window.loadPartnerProducts) window.loadPartnerProducts(); break;
        case 'sec-live-chat': if(window.lcLoadRooms) window.lcLoadRooms(); break;
        case 'sec-chatbot': if(window.cbShowTab) window.cbShowTab('knowledge'); break;
    }
};

// =========================================================
// [파트너 상품 심사] 관리
// =========================================================
let rejectingProductId = null;

window.loadPartnerProducts = async function() {
    const container = document.getElementById('partnerProductList');
    if (!container) return;
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';

    const filter = document.getElementById('filterPartnerProdStatus')?.value || 'pending';
    let query = sb.from('admin_products').select('*')
        .not('partner_id', 'is', null)
        .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('partner_status', filter);

    const { data, error } = await query;
    if (error) { container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444;">오류: ${error.message}</div>`; return; }
    if (!data || data.length === 0) { container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8;"><i class="fa-solid fa-inbox fa-3x" style="margin-bottom:12px;display:block;"></i>해당 상태의 상품이 없습니다.</div>'; return; }

    // 파트너 프로필 별도 조회
    const partnerIds = [...new Set(data.map(p => p.partner_id).filter(Boolean))];
    let profileMap = {};
    if (partnerIds.length > 0) {
        const { data: profiles } = await sb.from('profiles').select('id, company_name, full_name, email').in('id', partnerIds);
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
    }

    // 배지 카운트 업데이트
    const pendingCount = filter === 'pending' ? data.length : null;
    if (pendingCount !== null) {
        const badge = document.getElementById('partnerProductPendingCount');
        if (badge) { badge.textContent = pendingCount; badge.style.display = pendingCount > 0 ? 'inline' : 'none'; }
    }

    container.innerHTML = '';
    data.forEach(p => {
        const prof = profileMap[p.partner_id] || {};
        const sellerName = prof.company_name || prof.full_name || prof.email || '알 수 없음';
        const statusMap = { pending: { label:'심사 대기', cls:'background:#fef3c7;color:#92400e;' }, approved: { label:'승인됨', cls:'background:#dcfce7;color:#166534;' }, rejected: { label:'반려됨', cls:'background:#fee2e2;color:#b91c1c;' } };
        const st = statusMap[p.partner_status] || statusMap.pending;
        const price = p.price ? p.price.toLocaleString() + '원' : '-';

        const card = document.createElement('div');
        card.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;';
        card.innerHTML = `
            <div style="display:flex;gap:16px;padding:16px;">
                <img src="${p.img_url || ''}" style="width:100px;height:100px;object-fit:cover;border-radius:10px;background:#f1f5f9;flex-shrink:0;" onerror="this.style.background='#f1f5f9'">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:15px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name || ''}</div>
                    <div style="font-size:13px;color:#64748b;margin-bottom:4px;">판매자: <b>${sellerName}</b></div>
                    <div style="font-size:16px;font-weight:800;color:#6366f1;margin-bottom:6px;">${price}</div>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                        <span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;${st.cls}">${st.label}</span>
                        <span style="font-size:11px;color:#94a3b8;">${p.code}</span>
                        <span style="font-size:11px;color:#94a3b8;">재고:${p.stock_quantity||0}</span>
                    </div>
                    ${p.reject_reason ? `<div style="margin-top:6px;padding:6px 10px;background:#fef2f2;border-radius:6px;font-size:12px;color:#b91c1c;"><b>반려사유:</b> ${p.reject_reason}</div>` : ''}
                </div>
            </div>
            ${p.description ? `<div style="padding:0 16px 12px;font-size:12px;color:#64748b;max-height:60px;overflow:hidden;border-top:1px solid #f1f5f9;padding-top:10px;">${p.description.replace(/<[^>]+>/g,'').substring(0,100)}...</div>` : ''}
            <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid #f1f5f9;background:#fafbfc;">
                ${p.partner_status === 'pending' ? `
                    <button onclick="approvePartnerProduct(${p.id})" style="flex:1;padding:8px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;"><i class="fa-solid fa-check"></i> 승인</button>
                    <button onclick="openRejectModal(${p.id}, '${(p.name||'').replace(/'/g,"\\'")}')" style="flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;"><i class="fa-solid fa-xmark"></i> 반려</button>
                ` : p.partner_status === 'approved' ? `
                    <button onclick="openRejectModal(${p.id}, '${(p.name||'').replace(/'/g,"\\'")}')" style="flex:1;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;"><i class="fa-solid fa-xmark"></i> 판매 중지(반려)</button>
                ` : `
                    <button onclick="approvePartnerProduct(${p.id})" style="flex:1;padding:8px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;"><i class="fa-solid fa-check"></i> 재승인</button>
                `}
                <button onclick="deletePartnerProduct(${p.id})" style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;color:#94a3b8;" title="삭제"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        container.appendChild(card);
    });
};

window.approvePartnerProduct = async function(id) {
    if (!confirm('이 상품을 승인하시겠습니까?\n승인 후 즉시 쇼핑몰에 노출됩니다.')) return;
    const { error } = await sb.from('admin_products').update({ partner_status: 'approved', reject_reason: null }).eq('id', id);
    if (error) return alert('오류: ' + error.message);
    alert('승인 완료! 상품이 쇼핑몰에 노출됩니다.');
    loadPartnerProducts();
};

window.openRejectModal = function(id, name) {
    rejectingProductId = id;
    document.getElementById('rejectProductName').textContent = `상품: ${name}`;
    document.getElementById('rejectReasonText').value = '';
    document.getElementById('rejectReasonModal').style.display = 'flex';
};

window.confirmRejectProduct = async function() {
    const reason = document.getElementById('rejectReasonText').value.trim();
    if (!reason) return alert('반려 사유를 입력해 주세요.');
    const { error } = await sb.from('admin_products').update({ partner_status: 'rejected', reject_reason: reason }).eq('id', rejectingProductId);
    if (error) return alert('오류: ' + error.message);
    document.getElementById('rejectReasonModal').style.display = 'none';
    alert('반려 처리되었습니다. 파트너에게 사유가 전달됩니다.');
    loadPartnerProducts();
};

window.deletePartnerProduct = async function(id) {
    if (!confirm('이 상품을 완전히 삭제하시겠습니까?\n(복구 불가)')) return;
    const { error } = await sb.from('admin_products').delete().eq('id', id);
    if (error) return alert('오류: ' + error.message);
    loadPartnerProducts();
};

// 페이지 로드 시 파트너 상품 대기 건수 배지 업데이트
(async function updatePartnerProductBadge() {
    try {
        const { count } = await sb.from('admin_products').select('id', { count: 'exact', head: true }).eq('partner_status', 'pending').not('partner_id', 'is', null);
        const badge = document.getElementById('partnerProductPendingCount');
        if (badge && count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
    } catch(e) {}
})();

// =========================================================
// [대량 등록] 전용 로직
// =========================================================

// 1. 카테고리 불러오기 (대량 등록용)
window.loadCategoriesForBulk = async function() {
    const select = document.getElementById('bulkCategory');
    // 기존에 로드된 카테고리 데이터가 있다면 활용 (없으면 DB호출)
    const { data, error } = await sb.from('admin_categories').select('code, name').order('name');
    if (data) {
        select.innerHTML = '<option value="">선택하세요</option>';
        data.forEach(cat => {
            select.innerHTML += `<option value="${cat.code}">${cat.name}</option>`;
        });
    }
}

let selectedBulkFiles = [];

// 2. 파일 선택 시 미리보기 및 준비
window.previewBulkFiles = function(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    selectedBulkFiles = files;
    
    // UI 업데이트
    document.getElementById('bulkStatusText').innerText = `${files.length}개의 파일이 선택되었습니다.`;
    document.getElementById('btnBulkExecute').style.display = 'block';
    
    // 미리보기 생성
    const grid = document.getElementById('bulkPreviewList');
    grid.innerHTML = '';
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.style.cssText = "font-size:11px; text-align:center; overflow:hidden;";
            
            // 파일명에서 확장자 제거하여 상품명으로 표시
            const prodName = file.name.substring(0, file.name.lastIndexOf('.'));
            
            div.innerHTML = `
                <img src="${e.target.result}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; border:1px solid #ddd;">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${prodName}</div>
            `;
            grid.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// 3. 대량 등록 실행 (핵심 로직)
// [최종 수정] 대량 등록 실행 함수 (addons 빈값 처리 + site_code 수정)
window.executeBulkUpload = async function() {
    // 1. 필수값 체크
    const category = document.getElementById('bulkCategory').value;
    const priceVal = document.getElementById('bulkPrice').value;
    const site = document.getElementById('bulkSite').value;
    
    if (!category || !priceVal) {
        alert("카테고리와 기본 가격은 필수입니다.");
        return;
    }
    
    if (selectedBulkFiles.length === 0) return;
    if (!confirm(`총 ${selectedBulkFiles.length}개의 상품을 등록하시겠습니까?\n파일명이 상품명으로 사용됩니다.`)) return;

    // UI 잠금 및 로딩바 표시
    document.getElementById('btnBulkExecute').disabled = true;
    document.getElementById('bulkProgressArea').style.display = 'block';
    
    const w = document.getElementById('bulkW').value || 0;
    const h = document.getElementById('bulkH').value || 0;
    const isCustom = document.getElementById('bulkIsCustom').checked;
    const basePrice = parseInt(priceVal);

    // 환율 자동 계산 (근사치)
    const priceUS = Math.round(basePrice / 1350); 
    const priceJP = Math.round(basePrice / 9);    

    let successCount = 0;
    let failCount = 0;

    // 순차 처리
    for (let i = 0; i < selectedBulkFiles.length; i++) {
        const file = selectedBulkFiles[i];
        
        // 프로그레스바 업데이트
        const percent = Math.round(((i + 1) / selectedBulkFiles.length) * 100);
        document.getElementById('bulkProgressBar').style.width = `${percent}%`;
        document.getElementById('bulkPercent').innerText = `${percent}%`;
        document.getElementById('bulkProgressLabel').innerText = `처리 중... (${i + 1}/${selectedBulkFiles.length})`;

        try {
            const fileExt = file.name.split('.').pop();
            // 파일명 안전하게 변경
            const safeFileName = `bulk_${Date.now()}_${i}.${fileExt}`;
            
            // ★ 버킷 이름: products
            const BUCKET_NAME = 'products'; 
            const filePath = `${safeFileName}`; 

            const { data: uploadData, error: uploadError } = await sb.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 공개 URL 가져오기
            const { data: { publicUrl } } = sb.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            // 상품명 추출
            let prodNameKR = file.name.substring(0, file.name.lastIndexOf('.'));
            
            // 고유 코드 생성
            const uniqueCode = `${category}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            // DB Insert 데이터 구성
            const insertData = {
                code: uniqueCode,
                category: category,
                
                name: prodNameKR,
                price: basePrice,
                
                name_us: prodNameKR, 
                price_us: priceUS,

                name_jp: prodNameKR,
                price_jp: priceJP,

                img_url: publicUrl,
                width_mm: parseInt(w),
                height_mm: parseInt(h),
                is_custom_size: isCustom,
                
                // ★★★ [수정 1] 컬럼명 site -> site_code 로 변경 ★★★
                site_code: site,

                // ★★★ [수정 2] addons 필수값 처리 (빈 문자열) ★★★
                // DB가 Not Null이라서 이걸 안 보내면 에러가 납니다.
                addons: '' 
            };

            const { error: dbError } = await sb.from('admin_products').insert(insertData);
            
            if (dbError) throw dbError;
            successCount++;

        } catch (err) {
            console.error(`[업로드 실패] ${file.name}:`, err);
            // 에러 상세 알림
            if (err.message && (err.message.includes('Column') || err.message.includes('constraint'))) {
                alert(`DB 오류 발생!\n내용: ${err.message}\n(관리자에게 이 화면을 캡쳐해서 보내주세요)`);
                failCount = selectedBulkFiles.length - i; 
                break;
            }
            failCount++;
        }
    }

    // 완료 처리
    setTimeout(() => {
        alert(`작업 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
        
        // 초기화
        document.getElementById('bulkFiles').value = '';
        document.getElementById('bulkPreviewList').innerHTML = '';
        document.getElementById('btnBulkExecute').style.display = 'none';
        document.getElementById('btnBulkExecute').disabled = false;
        document.getElementById('bulkProgressArea').style.display = 'none';
        
        // 목록 새로고침
        if (window.filterProductList) window.filterProductList();
    }, 500);
};
// ============================================================
// [파트너스 관리] 신청 목록 불러오기
// ============================================================
window.loadPartnerApplications = async function() {
    const tbody = document.getElementById('partnerAppListBody');
    const filter = document.getElementById('filterPartnerStatus').value; // all, pending, approved, rejected
    
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px;">로딩 중...</td></tr>';

    let query = sb.from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });

    if (filter !== 'all') {
        query = query.eq('status', filter);
    }

    const { data, error } = await query;

    if (error) {
        alert("로드 실패: " + error.message);
        return;
    }

    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#999;">신청 내역이 없습니다.</td></tr>';
        return;
    }

    // 뱃지 표시용
    const updateCount = data.filter(d => d.status === 'pending').length;
    const badge = document.getElementById('partnerPendingCount');
    if(badge) {
        badge.innerText = updateCount;
        badge.style.display = updateCount > 0 ? 'inline-block' : 'none';
    }

    data.forEach(item => {
        let statusBadge = '';
        let actionBtn = '';

        if (item.status === 'pending') {
            statusBadge = `<span class="badge" style="background:#fef3c7; color:#d97706;">⏳ 대기중</span>`;
            // 승인 버튼 클릭 시 approvePartner 함수 실행
            actionBtn = `
                <button onclick="approvePartner('${item.id}', '${item.user_id}')" class="btn btn-primary btn-sm">승인 (등급UP)</button>
                <button onclick="rejectPartner('${item.id}')" class="btn btn-outline btn-sm" style="color:#ef4444; border-color:#ef4444;">거절</button>
            `;
        } else if (item.status === 'approved') {
            statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534;">✅ 승인됨</span>`;
            actionBtn = `<span style="font-size:12px; color:#aaa;">처리완료</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:#fee2e2; color:#ef4444;">❌ 거절됨</span>`;
            actionBtn = `<span style="font-size:12px; color:#aaa;">처리완료</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(item.created_at).toLocaleDateString()}</td>
            <td>${item.email || '-'}</td>
            <td style="font-weight:bold;">${item.company_name}</td>
            <td>${item.contact_phone}</td>
            <td>${item.region}</td>
            <td>${item.main_items}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;">${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
};

// ============================================================
// [파트너스 관리] 승인 및 등급 업그레이드 (핵심 기능)
// ============================================================
window.approvePartner = async function(appId, userId) {
    if (!confirm("이 업체를 파트너(가맹점)로 승인하시겠습니까?\n해당 회원의 등급이 'franchise'로 즉시 변경됩니다.")) return;

    try {
        // 1. 신청 상태를 'approved'로 변경
        const { error: appErr } = await sb.from('partner_applications')
            .update({ status: 'approved', approved_at: new Date() })
            .eq('id', appId);

        if (appErr) throw appErr;

        // 2. 해당 유저의 프로필 등급을 'franchise'로 변경
        const { error: profileErr } = await sb.from('profiles')
            .update({ role: 'franchise' })
            .eq('id', userId);

        if (profileErr) throw profileErr;

        alert("✅ 승인 완료! 회원이 가맹점 등급으로 변경되었습니다.");
        loadPartnerApplications(); // 목록 새로고침

    } catch (e) {
        console.error(e);
        alert("처리 중 오류 발생: " + e.message);
    }
};

// [파트너스 관리] 거절 처리
window.rejectPartner = async function(appId) {
    if (!confirm("정말 거절하시겠습니까?")) return;

    const { error } = await sb.from('partner_applications')
        .update({ status: 'rejected' })
        .eq('id', appId);

    if (error) alert("오류: " + error.message);
    else {
        alert("거절 처리되었습니다.");
        loadPartnerApplications();
    }
};