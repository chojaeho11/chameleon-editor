// config.js

import { SITE_CONFIG } from "./site-config.js?v=123";

// 전역 변수
export let apiKeys = {}; 
export let sb = null;
export let currentUser = null; 
export let isAdmin = false; 
export let cartData = []; 
export let ADDON_DB = {};
export let ADDON_CAT_DB = {};
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
        // 1. 라이브러리 로드 대기
        if (typeof window.supabase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (typeof window.supabase === 'undefined') return;

        const { createClient } = window.supabase;
        const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co'; 
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

        try {
            // 중복 초기화 방지 로직 추가
            if (!sb) {
                sb = createClient(SUPABASE_URL, SUPABASE_KEY, { 
                    auth: { 
                        persistSession: true, 
                        autoRefreshToken: true,
                        detectSessionInUrl: true 
                    } 
                });
            } else {
            }
            
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

                // 비밀번호 재설정 링크로 돌아온 경우 → 새 비밀번호 입력 모달 표시
                if (event === 'PASSWORD_RECOVERY') {
                    window.__passwordRecoveryMode = true;
                    showPasswordResetModal();
                }
            });

            // 3-1. URL에 type=recovery 해시가 있으면 비밀번호 복구 모드
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            if (hashParams.get('type') === 'recovery') {
                window.__passwordRecoveryMode = true;
                // 이벤트가 늦게 올 수 있으므로 약간 대기 후 모달 표시
                setTimeout(() => showPasswordResetModal(), 500);
            }

            // 4. 데이터 로드 (이 부분만 최적화됨)
            await loadSystemData();

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

        // 옵션 카테고리 로드
        const { data: addonCats } = await sb.from('addon_categories').select('*').order('sort_order', {ascending: true});
        if (addonCats) {
            ADDON_CAT_DB = {};
            addonCats.forEach(cat => {
                let displayName = cat.name_kr || cat.name || cat.code;
                if (country === 'JP') displayName = cat.name_jp || displayName;
                else if (country === 'US') displayName = cat.name_us || displayName;
                else if (country === 'CN') displayName = cat.name_cn || cat.name_us || displayName;
                else if (country === 'AR') displayName = cat.name_ar || cat.name_us || displayName;
                else if (country === 'ES') displayName = cat.name_es || cat.name_us || displayName;
                else if (country === 'DE') displayName = cat.name_de || cat.name_us || displayName;
                else if (country === 'FR') displayName = cat.name_fr || cat.name_us || displayName;
                ADDON_CAT_DB[cat.code] = { ...cat, display_name: displayName };
            });
            window.ADDON_CAT_DB = ADDON_CAT_DB;
        }

        // 옵션 로드
        const { data: addons } = await sb.from('admin_addons').select('*');
        if (addons) {
            ADDON_DB = {};
            const rate = SITE_CONFIG.CURRENCY_RATE[country] || 1;
            addons.forEach(item => {
                let dName = item.name;
                let dbPrice = item.price; // KRW 기본
                if (country === 'JP') {
                    dName = item.name_jp || item.name;
                    if (item.price_jp) dbPrice = Math.round(item.price_jp / rate);
                } else if (country === 'US') {
                    dName = item.name_us || item.name;
                    if (item.price_us) dbPrice = Math.round(item.price_us / rate);
                } else if (country === 'CN') {
                    dName = item.name_cn || item.name_us || item.name;
                    if (item.price_us) dbPrice = Math.round(item.price_us / rate);
                } else if (country === 'AR') {
                    dName = item.name_ar || item.name_us || item.name;
                    if (item.price_us) dbPrice = Math.round(item.price_us / rate);
                } else if (country === 'ES') {
                    dName = item.name_es || item.name_us || item.name;
                    if (item.price_us) dbPrice = Math.round(item.price_us / rate);
                }
                ADDON_DB[item.code] = { ...item, display_name: dName, price: dbPrice };
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
// [신규] 통합 데이터 변환 헬퍼 (도메인 자동 감지 적용)
export function getLocalizedData(item) {
    // 1. 도메인 및 URL 파라미터로 국가 자동 감지
    let country = 'KR'; // 기본값
    
    // 현재 접속한 주소 확인
    const hostname = window.location.hostname; 
    const urlParams = new URLSearchParams(window.location.search);
    const paramLang = urlParams.get('lang');

    // 도메인 또는 ?lang= 파라미터로 국가 결정
    if (hostname.includes('cafe0101.com') || paramLang === 'ja' || paramLang === 'jp') {
        country = 'JP';
    } else if (paramLang === 'zh' || paramLang === 'cn') {
        country = 'CN';
    } else if (paramLang === 'ar') {
        country = 'AR';
    } else if (paramLang === 'es') {
        country = 'ES';
    } else if (paramLang === 'de') {
        country = 'DE';
    } else if (paramLang === 'fr') {
        country = 'FR';
    } else if (hostname.includes('cafe3355.com') || paramLang === 'en' || paramLang === 'us') {
        country = 'US';
    }

    if (!item) return { name: '', price: 0, formattedPrice: '0' };

    let name = item.name || '';
    let price = Number(item.price) || 0;
    let formattedPrice = '';

    if (country === 'JP') {
        name = item.name_jp || item.name;
        price = Number(item.price_jp) || price;
        formattedPrice = '¥' + Math.floor(price).toLocaleString();
    } else if (country === 'US') {
        name = item.name_us || item.name;
        price = Number(item.price_us) || price;
        formattedPrice = '$' + Math.round(price).toLocaleString();
    } else if (country === 'CN') {
        name = item.name_cn || item.name_us || item.name;
        const cnRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE.CN) || 0.01;
        const cnPrice = price * cnRate;
        formattedPrice = '¥' + Math.round(cnPrice).toLocaleString();
    } else if (country === 'AR') {
        name = item.name_ar || item.name_us || item.name;
        const arRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE.AR) || 0.005;
        const arPrice = price * arRate;
        formattedPrice = Math.round(arPrice).toLocaleString() + ' ﷼';
    } else if (country === 'ES') {
        name = item.name_es || item.name_us || item.name;
        const esRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE.ES) || 0.001;
        const esPrice = price * esRate;
        formattedPrice = '€' + esPrice.toFixed(2);
    } else if (country === 'DE') {
        name = item.name_de || item.name_us || item.name;
        const deRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE.DE) || 0.001;
        const dePrice = price * deRate;
        formattedPrice = '€' + dePrice.toFixed(2);
    } else if (country === 'FR') {
        name = item.name_fr || item.name_us || item.name;
        const frRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE.FR) || 0.001;
        const frPrice = price * frRate;
        formattedPrice = '€' + frPrice.toFixed(2);
    } else {
        formattedPrice = price.toLocaleString() + '원';
    }

    return {
        name,
        price: Number(price) || 0,
        formattedPrice,
        raw: item
    };
}

// ── 비밀번호 재설정 모달 표시 헬퍼 ──
function showPasswordResetModal() {
    // login.js의 openResetPwStep2가 window에 노출되어 있으면 바로 사용
    if (window.__openResetPwStep2) {
        window.__openResetPwStep2();
        return;
    }
    // 아직 login.js가 로드되지 않았을 수 있으므로 동적 import
    import('./login.js?v=123').then(m => {
        if (m.openResetPwStep2) m.openResetPwStep2();
    }).catch(() => {
        // 최후 수단: DOM 직접 조작
        const modal = document.getElementById('resetPwModal');
        const step1 = document.getElementById('resetPwStep1');
        const step2 = document.getElementById('resetPwStep2');
        if (modal) {
            if (step1) step1.style.display = 'none';
            if (step2) step2.style.display = 'block';
            modal.style.display = 'flex';
        }
    });
}