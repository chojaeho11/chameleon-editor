// config.js

export let apiKeys = {}; 
export let sb = null;
export let currentUser = null; 
export let isAdmin = false; 
export let cartData = []; 

// 관리자 이메일 목록 (여기에 본인 이메일이 있어야 관리자 기능 사용 가능)
const ADMIN_EMAILS = [
    "korea900as@gmail.com",
    "ceo@test.com"
];

// ★ DB에서 불러와서 채울 빈 객체들
export let ADDON_DB = {};
export let PRODUCT_DB = {};

let initPromise = null;

export function initConfig() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        console.log("⚙️ 설정 로딩 시작...");
        
        // 1. Supabase 라이브러리 로드 대기
        if (typeof window.supabase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (typeof window.supabase === 'undefined') {
            console.error("🚨 Supabase 라이브러리 없음");
            return;
        }

        const { createClient } = window.supabase;
        
        // Supabase 키 설정 (기존 키 유지)
        const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

        try {
            sb = createClient(SUPABASE_URL, SUPABASE_KEY, { 
                auth: { persistSession: true, autoRefreshToken: true } 
            });
            
            // 2. 세션 상태 확인
            const { data: { session } } = await sb.auth.getSession();
            updateUserSession(session);

            sb.auth.onAuthStateChange((event, session) => {
                updateUserSession(session);
                // 로그인/로그아웃 UI 업데이트
                const btnLogin = document.getElementById("btnLoginBtn");
                if(btnLogin && btnLogin.updateState) btnLogin.updateState();
                
                const btnLib = document.getElementById("btnMyLibrary");
                if(btnLib) btnLib.style.display = session ? "inline-flex" : "none";

                if (event === 'SIGNED_OUT') location.reload();
            });

            // ★★★ [중요] DB에서 상품/옵션 정보 불러오기 ★★★
            await loadSystemData();

            console.log("✅ 설정 및 데이터 로딩 완료");

        } catch (e) {
            console.error("설정 오류:", e);
        }
    })();

    return initPromise;
}

// ★ DB 데이터 로드 및 사이즈 변환 함수
async function loadSystemData() {
    try {
        // 1. 옵션(Addon) 불러오기
        const { data: addons } = await sb.from('admin_addons').select('*');
        if (addons) {
            ADDON_DB = {}; // 초기화
            addons.forEach(item => {
                // 구조: { 코드: { 이름, 가격 } }
                ADDON_DB[item.code] = { name: item.name, price: item.price };
            });
        }

        // 2. 상품(Product) 불러오기 & 사이즈 변환
        const { data: products } = await sb.from('admin_products')
    .select('*')
    .order('sort_order', { ascending: true }) // 순서 적용
    .order('id', { ascending: true });        // 같은 순서일 경우 등록순
        if (products) {
            PRODUCT_DB = {}; // 초기화
            products.forEach(item => {
                // mm -> px 변환 (1mm = 약 3.7795px)
                // 캔버스 해상도를 위해 약 3.78배로 설정합니다.
                const scaleFactor = 3.7795;
                
                // DB에 값이 없으면 기본 A4 사이즈(210x297) 적용
                const mmW = item.width_mm || 210;
                const mmH = item.height_mm || 297;

                const pxW = Math.round(mmW * scaleFactor);
                const pxH = Math.round(mmH * scaleFactor);

                // 연결된 옵션 목록 (문자열 -> 배열)
                const addonList = item.addons ? item.addons.split(',').map(s=>s.trim()).filter(s=>s) : [];
                
                PRODUCT_DB[item.code] = {
                    name: item.name,
                    price: item.price,
                    img: item.img_url || 'https://placehold.co/400?text=No+Image',
                    w: pxW, // 변환된 픽셀 너비
                    h: pxH, // 변환된 픽셀 높이
                    addons: addonList // 연결된 옵션 코드들
                };
            });
        }
    } catch(e) {
        console.error("DB 데이터 로드 실패:", e);
    }
}

// 사용자 세션 처리
function updateUserSession(session) {
    if (session && session.user) {
        currentUser = session.user;
        // 관리자 여부 확인
        if (ADMIN_EMAILS.includes(currentUser.email)) {
            isAdmin = true;
            // 관리자 전용 버튼 표시 (템플릿 등록 등)
            const btnReg = document.getElementById("btnRegisterTemplate");
            if(btnReg) btnReg.style.display = "flex";
        } else {
            isAdmin = false;
        }
    } else {
        currentUser = null;
        isAdmin = false;
    }
    
    // 장바구니 로드
    loadUserCart();
}

// 장바구니 로드
function loadUserCart() {
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
    cartData.length = 0; // 배열 초기화
    
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                parsed.forEach(item => cartData.push(item));
            }
        }
    } catch(e) {
        console.error("장바구니 로드 실패", e);
    }
    
    // UI 갱신
    const countEl = document.getElementById("cartCount");
    if(countEl) countEl.innerText = `(${cartData.length})`;
    
    const btnCart = document.getElementById("btnViewCart");
    if(btnCart) {
        // 로그인했거나 장바구니에 담긴 게 있으면 버튼 표시
        btnCart.style.display = (currentUser || cartData.length > 0) ? "inline-flex" : "none";
    }
}