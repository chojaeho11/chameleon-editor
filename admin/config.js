// config.js
export let apiKeys = {}; 
export let sb = null;
export let currentUser = null; 
export let isAdmin = false; 
export let cartData = []; // ★ 초기값은 빈 배열로 시작

// ★ 관리자 이메일 목록
const ADMIN_EMAILS = [
    "korea900as@gmail.com",
    "ceo@test.com"
];

let initPromise = null;

export function initConfig() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        console.log("⚙️ 설정 로딩 시작...");
        
        if (typeof window.supabase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (typeof window.supabase === 'undefined') {
            console.error("🚨 Supabase 라이브러리 없음");
            return;
        }

        const { createClient } = window.supabase;
        
        const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

        try {
            sb = createClient(SUPABASE_URL, SUPABASE_KEY, { 
                auth: { persistSession: true, autoRefreshToken: true } 
            });
            
            const { data: { session } } = await sb.auth.getSession();
            updateUserSession(session);

            // config.js의 sb.auth.onAuthStateChange 부분 수정

sb.auth.onAuthStateChange((event, session) => {
    console.log("Auth Event:", event);
    updateUserSession(session);
    
    // UI 업데이트
    const btnLogin = document.getElementById("btnLoginBtn");
    if(btnLogin && btnLogin.updateState) btnLogin.updateState();

    const btnLib = document.getElementById("btnMyLibrary");
    if(btnLib) btnLib.style.display = session ? "flex" : "none";

    // ★ [추가됨] 장바구니 버튼 표시 로직 (로그인 시 무조건 보임)
    const btnCart = document.getElementById("btnViewCart");
    if(btnCart) {
        // 세션이 있거나(로그인) OR 장바구니에 물건이 있으면 -> 보이기
        if (session || cartData.length > 0) {
            btnCart.style.display = "inline-flex";
        } else {
            // 로그아웃 상태이고 장바구니도 비었으면 -> 숨기기
            btnCart.style.display = "none";
        }
    }
    
    // 로그아웃 시 페이지 새로고침 (데이터 정리)
    if (event === 'SIGNED_OUT') {
        location.reload();
    }
});

            console.log("✅ 설정 로딩 완료");

        } catch (e) {
            console.error("설정 오류:", e);
        }
    })();

    return initPromise;
}

// ★ [수정됨] 사용자 세션 및 장바구니 로드 로직
function updateUserSession(session) {
    if (session && session.user) {
        currentUser = session.user;
        if (ADMIN_EMAILS.includes(currentUser.email)) {
            isAdmin = true;
            const btnReg = document.getElementById("btnRegisterTemplate");
            if(btnReg) btnReg.style.display = "flex";
        } else {
            isAdmin = false;
        }
    } else {
        currentUser = null;
        isAdmin = false;
    }
    
    // ★ 사용자별 장바구니 로드
    loadUserCart();
}

// ★ [신규 함수] 사용자 ID에 맞는 장바구니 불러오기
function loadUserCart() {
    // 키 생성: 로그인했으면 'cart_유저ID', 아니면 'cart_guest'
    const storageKey = currentUser ? `chameleon_cart_${currentUser.id}` : 'chameleon_cart_guest';
    
    // 기존 배열 비우기
    cartData.length = 0;
    
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                // 배열 요소 하나씩 cartData에 넣기 (참조 유지 위해)
                parsed.forEach(item => cartData.push(item));
            }
        }
    } catch(e) {
        console.error("장바구니 로드 실패", e);
    }
    
    // UI 갱신 (order.js의 함수가 전역에 있다면 호출)
    const countEl = document.getElementById("cartCount");
    if(countEl) countEl.innerText = `(${cartData.length})`;
}

export const ADDON_DB = {
    'mat_foamex': { name: '포맥스3T (Foamex)', price: 0 },
    'mat_foamboard': { name: '폼보드5T (Foamboard)', price: 0 },
    'mat_acrylic': { name: '아크릴3T (Acrylic)', price: 50000 },
    'mat_fabric': { name: '광목20수 오버록 상단고리', price: 0 },
    'mat_honeycomb': { name: '허니콤보드16T (Honeycomb)', price: 0 },
    'opt_stand': { name: '외부 보조 받침대', price: 80000 },
    'opt_column': { name: '꺾이는 가벽 기둥', price: 100000 },
    'opt_light': { name: '상단 조명 콘센트형 (1칸당 1개 구매)', price: 50000 },
    'svc_install_time': { name: '지정시간 설치(선택 안하면 무료설치)', price: 300000 },
    'svc_remove': { name: '철거 서비스 지방불가', price: 150000 },
    'svc_delivery_local': { name: '지방 용차배송(설치불가)', price: 200000 }
};

export const PRODUCT_DB = {
    'A4': { name: 'A4 기본 판형', price: 10000, img: 'https://placehold.co/400?text=A4', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },
    'A3': { name: 'A3 기본 판형', price: 15000, img: 'https://placehold.co/400?text=A3', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },    
    'A2': { name: 'A2 기본 판형', price: 20000, img: 'https://placehold.co/400?text=A2', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },
    'A1': { name: 'A1 기본 판형', price: 40000, img: 'https://placehold.co/400?text=A1', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },
    'Std_1200_600': { name: '판형 1200x600', price: 50000, img: 'https://placehold.co/400?text=1200x600', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },
    'Std_2400_1200': { name: '판형 2400x1200', price: 150000, img: 'https://placehold.co/400?text=2400x1200', addons: ['mat_foamex', 'mat_foamboard', 'mat_acrylic', 'mat_honeycomb', 'mat_fabric'] },
    'Wall_1': { name: '전시 가벽 1칸 (1.2m)', price: 110000, img: 'https://placehold.co/400?text=Wall+1', addons: ['opt_stand', 'opt_column', 'opt_light', 'svc_install_time', 'svc_remove', 'svc_delivery_local'] },
    'Wall_2': { name: '전시 가벽 2칸 (2.2m)', price: 220000, img: 'https://placehold.co/400?text=Wall+2', addons: ['opt_stand', 'opt_column', 'opt_light', 'svc_install_time', 'svc_remove', 'svc_delivery_local'] },
    'Wall_3': { name: '전시 가벽 3칸 (3.2m)', price: 330000, img: 'https://placehold.co/400?text=Wall+3', addons: ['opt_stand', 'opt_column', 'opt_light', 'svc_install_time', 'svc_remove', 'svc_delivery_local'] },
    'Wall_4': { name: '전시 가벽 4칸 (4.2m)', price: 440000, img: 'https://placehold.co/400?text=Wall+4', addons: ['opt_stand', 'opt_column', 'opt_light', 'svc_install_time', 'svc_remove', 'svc_delivery_local'] },
    'Wall_5': { name: '전시 가벽 5칸 (5.2m)', price: 550000, img: 'https://placehold.co/400?text=Wall+5', addons: ['opt_stand', 'opt_column', 'opt_light', 'svc_install_time', 'svc_remove', 'svc_delivery_local'] },
    'Banner_X': { name: 'X배너 (600x1800)', price: 10000, img: 'https://placehold.co/400?text=X-Banner', addons: [] },
    'Award_Board': { name: '시상 보드 (800x570)', price: 10000, img: 'https://placehold.co/400?text=Award+Board', addons: [] },
    'PhotoZone_Text': { name: '글씨 포토존 (2.4m)', price: 10000, img: 'https://placehold.co/400?text=Photo+Zone', addons: ['svc_install_time', 'svc_remove'] },
    'Fabric_Wide': { name: '대폭 원단 (1350x900)', price: 10000, img: 'https://placehold.co/400?text=Fabric', addons: [] },
    'Paper_Disp_4': { name: '종이 디스플레이 (4칸)', price: 10000, img: 'https://placehold.co/400?text=Paper+Display', addons: [] }
};

initConfig();