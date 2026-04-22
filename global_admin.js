import { sb, initConfig } from "./global_config.js?v=294";

// ✅ [추가] 이 두 줄을 꼭 넣어야 팝업창 오류가 해결됩니다!
window.sb = sb;
window._supabase = sb; 

import { checkAdminAccess } from "./global_common.js?v=294";

// 나머지 기능 파일들 불러오기
import "./global_orders.js?v=452";
import "./global_products.js?v=296";
import "./global_users.js?v=297";
import "./global_safetx.js?v=1";
import "./global_assets.js?v=296";
import "./global_stats.js?v=294";
import "./global_reviews.js?v=294";

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
            if(window.loadCustomMaterials) window.loadCustomMaterials();
            break;
        case 'sec-staff': if(window.loadStaffList) window.loadStaffList(); break;
        case 'sec-withdrawals': if(window.loadWithdrawals) window.loadWithdrawals(); break;
        case 'sec-design-withdrawals': if(window.loadDesignWithdrawals) window.loadDesignWithdrawals(); break;
        case 'sec-tasks': if(window.loadDailyTasks) window.loadDailyTasks(); break;
        case 'sec-live-chat': if(window.lcLoadRooms) window.lcLoadRooms(); if(window.lcLoadQuickReplies) window.lcLoadQuickReplies(); break;
        case 'sec-chatbot': if(window.cbShowTab) window.cbShowTab('knowledge'); break;
        case 'sec-comments': if(window.loadRecentComments) window.loadRecentComments(); break;
        case 'sec-callback': if(window.loadCallbackList) window.loadCallbackList('pending'); break;
        case 'sec-review-gen': if(window.initReviewGen) window.initReviewGen(); break;
        case 'sec-production-partners': if(window.loadProductionPartners) window.loadProductionPartners(); break;
        case 'sec-franchise-inquiries': if(window.loadFranchiseInquiries) window.loadFranchiseInquiries(); break;
        case 'sec-community-hub': if(window.loadCommunityHubStats) window.loadCommunityHubStats(); break;
    }
};

// =========================================================
// [가맹 문의] 관리
// =========================================================
window.loadFranchiseInquiries = async () => {
    const sb = (typeof getSb === 'function') ? getSb() : window.sb;
    if (!sb) { console.error('[가맹문의] sb 없음'); return; }
    const body = document.getElementById('franchiseInquiryListBody');
    const cntLabel = document.getElementById('fiCountLabel');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#64748b;">로딩 중...</td></tr>';

    const statusFilter = document.getElementById('fiFilterStatus')?.value || '';
    const langFilter = document.getElementById('fiFilterLang')?.value || '';
    try {
        let q = sb.from('franchise_inquiries').select('*').order('created_at', { ascending: false }).limit(500);
        if (statusFilter) q = q.eq('status', statusFilter);
        if (langFilter) q = q.eq('lang_submitted', langFilter);
        const { data, error } = await q;
        if (error) throw error;

        if (!data || data.length === 0) {
            body.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:#94a3b8;">접수된 문의가 없습니다.</td></tr>';
            if (cntLabel) cntLabel.textContent = '0건';
            return;
        }
        if (cntLabel) cntLabel.textContent = data.length + '건';

        const esc = (s) => (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const langFlag = { ko:'🇰🇷', ja:'🇯🇵', en:'🇺🇸', zh:'🇨🇳', ar:'🇸🇦', es:'🇪🇸', de:'🇩🇪', fr:'🇫🇷' };
        const expLabel = { none:'경험없음', print:'디지털인쇄', sign:'사인업', retail:'유통', other:'기타' };
        const statusColors = { new:['#fef3c7','#92400e','신규'], contacted:['#dbeafe','#1e40af','연락완료'], qualified:['#d1fae5','#065f46','적격'], rejected:['#fee2e2','#991b1b','거절'], closed:['#f1f5f9','#475569','종결'] };

        body.innerHTML = data.map(row => {
            const sc = statusColors[row.status] || statusColors.new;
            const dt = row.created_at ? new Date(row.created_at).toLocaleString('ko-KR', { dateStyle:'short', timeStyle:'short' }) : '';
            const flag = langFlag[row.lang_submitted] || '🌐';
            const exp = row.experience ? (expLabel[row.experience] || row.experience) : '';
            return `
                <tr data-id="${row.id}">
                    <td style="font-size:11px;color:#64748b;white-space:nowrap;">${esc(dt)}</td>
                    <td><div style="font-weight:700;">${esc(row.name)}</div><div style="font-size:11px;color:#94a3b8;">${flag} ${esc(row.lang_submitted||'')}</div></td>
                    <td style="font-size:12px;">${esc(row.country||'')}</td>
                    <td style="font-size:12px;"><a href="mailto:${esc(row.email)}" style="color:#6366f1;">${esc(row.email)}</a></td>
                    <td style="font-size:12px;">${row.phone ? `<a href="tel:${esc(row.phone)}" style="color:#6366f1;">${esc(row.phone)}</a>` : '-'}</td>
                    <td style="font-size:12px;"><div>${esc(row.company||'-')}</div><div style="color:#94a3b8;font-size:11px;">${esc(exp)}</div></td>
                    <td style="font-size:12px;color:#334155;max-width:280px;word-break:break-word;white-space:pre-wrap;">${esc(row.message||'-')}</td>
                    <td><input id="fiMemo_${row.id}" value="${esc(row.admin_memo||'')}" placeholder="관리자 메모" style="width:100%;padding:5px;border:1px solid #e2e8f0;border-radius:4px;font-size:11px;" onblur="saveFranchiseMemo('${row.id}', this.value)"></td>
                    <td style="text-align:center;">
                        <select onchange="updateFranchiseStatus('${row.id}', this.value)" style="padding:4px 6px;background:${sc[0]};color:${sc[1]};border:none;border-radius:4px;font-size:11px;font-weight:700;">
                            <option value="new" ${row.status==='new'?'selected':''}>신규</option>
                            <option value="contacted" ${row.status==='contacted'?'selected':''}>연락완료</option>
                            <option value="qualified" ${row.status==='qualified'?'selected':''}>적격</option>
                            <option value="rejected" ${row.status==='rejected'?'selected':''}>거절</option>
                            <option value="closed" ${row.status==='closed'?'selected':''}>종결</option>
                        </select>
                    </td>
                    <td style="text-align:center;"><button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;border:none;padding:4px 10px;font-size:11px;" onclick="deleteFranchiseInquiry('${row.id}')">삭제</button></td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('[가맹문의] 로드 실패:', e);
        body.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:#ef4444;">로딩 실패: ${e.message}</td></tr>`;
    }
};

window.updateFranchiseStatus = async (id, status) => {
    const sb = (typeof getSb === 'function') ? getSb() : window.sb;
    if (!sb) return;
    const patch = { status };
    if (status === 'contacted') patch.contacted_at = new Date().toISOString();
    const { error } = await sb.from('franchise_inquiries').update(patch).eq('id', id);
    if (error) { if(window.showToast) showToast('상태 변경 실패: ' + error.message, 'error'); return; }
    if (window.showToast) showToast('상태가 변경되었습니다.', 'success');
    window.loadFranchiseInquiries();
};

window.saveFranchiseMemo = async (id, memo) => {
    const sb = (typeof getSb === 'function') ? getSb() : window.sb;
    if (!sb) return;
    const { error } = await sb.from('franchise_inquiries').update({ admin_memo: memo }).eq('id', id);
    if (error) { if(window.showToast) showToast('메모 저장 실패: ' + error.message, 'error'); return; }
    if (window.showToast) showToast('메모 저장됨', 'success');
};

window.deleteFranchiseInquiry = async (id) => {
    if (!confirm('이 가맹 문의를 삭제하시겠습니까?')) return;
    const sb = (typeof getSb === 'function') ? getSb() : window.sb;
    if (!sb) return;
    const { error } = await sb.from('franchise_inquiries').delete().eq('id', id);
    if (error) { if(window.showToast) showToast('삭제 실패: ' + error.message, 'error'); return; }
    if (window.showToast) showToast('삭제되었습니다.', 'success');
    window.loadFranchiseInquiries();
};

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
        showToast("카테고리와 기본 가격은 필수입니다.", "warn");
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
    const priceUS = Math.round(basePrice / 1000); 
    const priceJP = Math.round(basePrice / 10);    

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
                showToast(`DB 오류 발생!\n내용: ${err.message}\n(관리자에게 이 화면을 캡쳐해서 보내주세요)`, "error");
                failCount = selectedBulkFiles.length - i; 
                break;
            }
            failCount++;
        }
    }

    // 완료 처리
    setTimeout(() => {
        showToast(`작업 완료!\n성공: ${successCount}건\n실패: ${failCount}건`, "success");
        
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
