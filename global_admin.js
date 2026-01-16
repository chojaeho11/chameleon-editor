import { sb, initConfig } from "./global_config.js";
import { checkAdminAccess } from "./global_common.js";

// 나머지 기능 파일들 불러오기
import "./global_orders.js";
import "./global_products.js";
import "./global_users.js";
import "./global_assets.js";

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
    }
};