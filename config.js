// config.js

import { SITE_CONFIG } from "./site-config.js?v=119";

// 전역 변수
export let apiKeys = {}; 
export let sb = null;
export let currentUser = null; 
export let isAdmin = false; 
export let cartData = []; 
export let ADDON_DB = {};
export let PRODUCT_DB = {};

const ADMIN_EMAILS = ["korea900as@gmail.com", "ceo@test.com"];
let initPromise = null;

// =================================================================
// [1] 초기화 함수 (백업 버전 구조 복원)
// =================================================================
export function initConfig() {
    if (initPromise) return initPromise;

    // 백업 파일과 동일한 IIFE 구조 사용 (가장 안정적)
    initPromise = (async () => {
        console.log(`⚙️ 설정 로딩 시작...`);
        
        // 1. 라이브러리 로드 대기
        if (typeof window.supabase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (typeof window.supabase === 'undefined') return;

        const { createClient } = window.supabase;
        const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

        try {
            sb = createClient(SUPABASE_URL, SUPABASE_KEY, { 
                auth: { persistSession: true, autoRefreshToken: true } 
            });
            
            // 2. 세션 상태 확인
            const { data: { session } } = await sb.auth.getSession();
            updateUserSession(session);

            // 3. 리스너 등록
            sb.auth.onAuthStateChange((event, session) => {
                updateUserSession(session);
                // UI 갱신
                const btnLogin = document.getElementById("btnLoginBtn");
                if(btnLogin && btnLogin.updateState) btnLogin.updateState();
                
                const btnLib = document.getElementById("btnMyLibrary");
                if(btnLib) btnLib.style.display = session ? "inline-flex" : "none";

                if (event === 'SIGNED_OUT') location.reload();
            });

            // 4. 데이터 로드 (이 부분만 최적화됨)
            await loadSystemData();

            console.log("✅ 설정 및 데이터 로딩 완료");

        } catch (e) {
            console.error("설정 오류:", e);
        }
    })();

    return initPromise;
}

// [최적화된 데이터 로드] - 서버 부하 방지의 핵심
async function loadSystemData() {
    try {
        const country = SITE_CONFIG.COUNTRY; 

        // 옵션 로드
        const { data: addons } = await sb.from('admin_addons').select('*');
        if (addons) {
            ADDON_DB = {}; 
            addons.forEach(item => {
                let dName = item.name;
                let dPrice = item.price;
                if (country === 'JP') { dName = item.name_jp || item.name; dPrice = item.price_jp || 0; } 
                else if (country === 'US') { dName = item.name_us || item.name; dPrice = item.price_us || 0; }
                ADDON_DB[item.code] = { name: dName, price: dPrice };
            });
        }
        PRODUCT_DB = {};
    } catch(e) {
        console.error("데이터 로드 실패:", e);
    }
}

function updateUserSession(session) {
    if (session && session.user) {
        currentUser = session.user;
        // ★ [핵심] window 객체에도 심어서 index.html이 바로 쓰게 함
        window.currentUser = session.user; 
        
        isAdmin = ADMIN_EMAILS.includes(currentUser.email);
        
        if(isAdmin) {
            const btnReg = document.getElementById("btnRegisterTemplate");
            if(btnReg) btnReg.style.display = "flex";
        }
    } else {
        currentUser = null;
        window.currentUser = null; // ★ 로그아웃 시 확실히 비움
        isAdmin = false;
    }
    loadUserCart();
}
function loadUserCart() {
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
    cartData.length = 0; 
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) JSON.parse(saved).forEach(item => cartData.push(item));
    } catch(e) {}
    
    const countEl = document.getElementById("cartCount");
    if(countEl) countEl.innerText = `(${cartData.length})`;
    
    const btnCart = document.getElementById("btnViewCart");
    if(btnCart) btnCart.style.display = (currentUser || cartData.length > 0) ? "inline-flex" : "none";
}

export async function getUserLogoCount() { return 0; }
// [신규] 통합 데이터 변환 헬퍼 (언어별 이름, 가격, 포맷팅 자동 처리)
export function getLocalizedData(item) {
    const country = SITE_CONFIG.COUNTRY; 
    
    if (!item) return { name: '', price: 0, formattedPrice: '0' };

    let name = item.name || '';
    let price = Number(item.price) || 0;
    let formattedPrice = '';

    if (country === 'JP') {
        name = item.name_jp || item.name;
        price = Number(item.price_jp) || price;
        // 일본: 기호 ¥를 앞에 붙이고 소수점 제거
        formattedPrice = '¥' + Math.floor(price).toLocaleString();
    } else if (country === 'US') {
        name = item.name_us || item.name;
        price = Number(item.price_us) || price;
        // 미국: 기호 $를 앞에 붙이고 소수점 2자리 허용
        formattedPrice = '$' + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    } else {
        // 한국: 금액 뒤에 '원' 표기
        formattedPrice = price.toLocaleString() + '원';
    }

    return { 
        name, 
        price: Number(price) || 0, 
        formattedPrice,
        raw: item 
    };
}