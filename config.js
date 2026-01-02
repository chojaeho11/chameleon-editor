// config.js - 무한 로딩 방지 및 강제 실행 안전장치 포함

import { SITE_CONFIG } from "./site-config.js";

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
// ★ 핵심 수정: 3초 타임아웃 안전장치 (무한 로딩 해결)
// =================================================================
export function initConfig() {
    if (initPromise) return initPromise;

    initPromise = new Promise(async (resolve) => {
        console.log(`⚙️ 설정 로딩 시작...`);
        
        // [안전장치] 3초가 지나면 무조건 로딩을 끝내버리는 타이머
        const safetyTimer = setTimeout(() => {
            console.warn("⏳ Supabase 응답 지연/차단됨 -> 오프라인 모드로 강제 진입");
            hideLoadingScreen();
            resolve(); // Promise 강제 완료
        }, 3000); 

        try {
            // 1. Supabase 라이브러리 로드 확인
            if (typeof window.supabase === 'undefined') {
                // 라이브러리가 로드될 때까지 잠시 대기 (최대 1초)
                let checkCount = 0;
                while(typeof window.supabase === 'undefined' && checkCount < 10) {
                    await new Promise(r => setTimeout(r, 100));
                    checkCount++;
                }
            }

            if (typeof window.supabase === 'undefined') {
                throw new Error("Supabase 라이브러리를 찾을 수 없음");
            }

            // 2. 클라이언트 생성
            const { createClient } = window.supabase;
            const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

            sb = createClient(SUPABASE_URL, SUPABASE_KEY, { 
                auth: { 
                    persistSession: true, // 로컬 스토리지 사용
                    autoRefreshToken: true,
                    detectSessionInUrl: false // URL 리다이렉트 감지 끔 (오류 방지)
                } 
            });
            
            // 3. 세션 가져오기 (여기서 브라우저가 차단하면 catch로 넘어감)
            const { data: { session }, error } = await sb.auth.getSession();
            if (error) throw error;
            
            updateUserSession(session);

            // 4. 상태 변경 리스너
            sb.auth.onAuthStateChange((event, session) => {
                updateUserSession(session);
            });

            // 5. DB 데이터 로드
            await loadSystemData();
            console.log("✅ 데이터 로딩 완료");

        } catch (e) {
            console.error("⚠️ 초기화 중 경고 (기능 제한됨):", e.message);
            // 에러가 나도 멈추지 않고 진행
        } finally {
            // 성공하든 실패하든 타이머 해제하고 로딩 끄기
            clearTimeout(safetyTimer);
            hideLoadingScreen();
            resolve();
        }
    });

    return initPromise;
}

// 로딩 화면 숨기기
function hideLoadingScreen() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
}

// DB 데이터 로드
async function loadSystemData() {
    if (!sb) return;
    try {
        const country = SITE_CONFIG.COUNTRY || 'KR';

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

        // 상품 로드 [최적화 수정됨: 필요한 데이터만 가져오기]
        const { data: products } = await sb.from('admin_products')
            .select('code, name, price, width_mm, height_mm, category, img_url, addons') // 전체(*) 대신 필수 컬럼만 지정
            .order('sort_order', { ascending: true });

        if (products) {
            PRODUCT_DB = {}; 
            products.forEach(item => {
                const scaleFactor = 3.7795;
                const pxW = Math.round((item.width_mm || 210) * scaleFactor);
                const pxH = Math.round((item.height_mm || 297) * scaleFactor);
                
                PRODUCT_DB[item.code] = {
                    name: item.name,
                    price: item.price,
                    img: item.img_url, // 필요하다면 이 줄도 주석처리하여 로딩 속도를 더 높일 수 있습니다.
                    w: pxW, h: pxH, 
                    w_mm: item.width_mm, h_mm: item.height_mm, 
                    addons: item.addons ? item.addons.split(',') : [],
                    category: item.category
                };
            });
        }
    } catch(e) { console.warn("데이터 로드 실패:", e); }
}

function updateUserSession(session) {
    if (session && session.user) {
        currentUser = session.user;
        isAdmin = ADMIN_EMAILS.includes(currentUser.email);
    } else {
        currentUser = null;
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
}

export async function getUserLogoCount() { return 0; }