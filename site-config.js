// site-config.js

// 1. 도메인이나 URL 파라미터로 국가 확인 (예: ?lang=jp)
const urlParams = new URLSearchParams(window.location.search);
// 기본값은 KR, URL에 lang=jp가 있으면 JP 모드로 전환
let country = urlParams.get('lang') ? urlParams.get('lang').toUpperCase() : 'KR';

export const SITE_CONFIG = {
    COUNTRY: country, // 'KR', 'JP', 'US'
    
    // 국가별 화폐 단위
    CURRENCY_UNIT: {
        'KR': '원',
        'JP': '¥',
        'US': '$'
    },
    
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
            clientKey: 'live_ck_4yKeq5bgrpLgoDjOgjeBrGX0lzW6' // 기존 토스 키
        },
        'JP': {
            provider: 'stripe',
            // ★ Stripe 대시보드에서 받은 'pk_live_...' 키를 아래에 넣으세요
            publishableKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX' 
        },
        'US': {
            provider: 'stripe',
            publishableKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX'
        }
    }
};

console.log(`🌍 현재 접속 국가 모드: ${country}`);