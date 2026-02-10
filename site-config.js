// site-config.js

// 1. 도메인 및 URL 파라미터로 국가 확인
const urlParams = new URLSearchParams(window.location.search);
const hostname = window.location.hostname;

let country = 'KR'; // 기본값

// 도메인에 따른 국가 설정
if (hostname.includes('cafe0101.com')) {
    country = 'JP';
} else if (hostname.includes('cafe3355.com')) {
    country = 'US';
}

// URL 파라미터가 있다면 도메인 설정보다 우선순위
const paramLang = urlParams.get('lang');
if (paramLang) {
    const code = paramLang.toUpperCase();
    
    // 언어 코드(JA, EN)를 국가 코드(JP, US)로 변환
    if (code === 'JA' || code === 'JP') {
        country = 'JP';
    } else if (code === 'EN' || code === 'US') {
        country = 'US';
    } else {
        country = 'KR';
    }
}

export const SITE_CONFIG = {
    COUNTRY: country, // 'KR', 'JP', 'US'

    // 국가별 화폐 단위
    CURRENCY_UNIT: {
        'KR': '원',
        'JP': '¥',
        'US': '$'
    },

    // 국가별 환산율 (DB는 KRW 기준 저장, 표시 시 환산)
    CURRENCY_RATE: { 'KR': 1, 'JP': 0.2, 'US': 0.002 },
    
    // 국가별 폰트 정의
    FONTS: {
        'KR': 'Pretendard',
        'JP': 'Noto Sans JP',
        'US': 'Inter'
    },
    
    // [중요] 국가별 PG사 설정 (토스 / 스트라이프)
    PG_CONFIG: {
        'KR': {
            provider: 'toss',
            clientKey: 'live_ck_4yKeq5bgrpLgoDjOgjeBrGX0lzW6' 
        },
        'JP': {
            provider: 'stripe',
            publishableKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX' // Stripe 일본 키 입력 필요
        },
        'US': {
            provider: 'stripe',
            publishableKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX' // Stripe 미국 키 입력 필요
        }
    }
};

// window 전역에 노출 (비모듈 스크립트에서 참조용)
window.SITE_CONFIG = SITE_CONFIG;

// 글로벌 환산 헬퍼: KRW → 현지 통화
export function convertCurrency(krwAmount) {
    const rate = SITE_CONFIG.CURRENCY_RATE[SITE_CONFIG.COUNTRY] || 1;
    return krwAmount * rate;
}

console.log(`🌍 현재 접속 국가 모드: ${country} (Domain: ${hostname})`);