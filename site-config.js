// site-config.js

// 1. 현재 접속한 도메인과 URL 파라미터를 가져옵니다.
const hostname = window.location.hostname;
const urlParams = new URLSearchParams(window.location.search);
const forceLang = urlParams.get('lang'); // ?lang=jp 또는 ?lang=en 감지

// [기본 설정] (한국 - cafe2626.com 또는 localhost)
let config = {
    code: 'KR',
    lang: 'kr',          // kr.json 사용
    currency: 'KRW',
    symbol: '원',
    pgProvider: 'toss',
    tossClientKey: 'live_ck_4yKeq5bgrpLgoDjOgjeBrGX0lzW6',
    bankInfo: '국민은행 647701-04-277763 (예금주: 카멜레온프린팅)',
    invoiceTitle: '견 적 서',
    companyName: '(주)카멜레온프린팅',
    csPhone: '031-366-1984'
};

// [2] 🇯🇵 일본 설정 (도메인이 cafe0101이거나 ?lang=jp 일 때)
if (hostname.includes('cafe0101.com') || forceLang === 'jp') {
    console.log("👉 일본어 모드로 강제 전환됨");
    config = {
        code: 'JP',
        lang: 'jp',          // jp.json 사용
        currency: 'JPY',
        symbol: '¥',
        pgProvider: 'stripe',
        stripePublicKey: 'pk_live_jp_key_placeholder', 
        bankInfo: 'Mizuho Bank 123-456789 (Account: Chameleon)',
        invoiceTitle: '御 見 積 書',
        companyName: 'Chameleon Printing JP',
        csPhone: '03-1234-5678'
    };
}
// [3] 🇺🇸 영어 설정 (도메인이 cafe3355이거나 ?lang=en 일 때)
else if (hostname.includes('cafe3355.com') || forceLang === 'en') {
    console.log("👉 영어 모드로 강제 전환됨");
    config = {
        code: 'US',
        lang: 'en',          // en.json 사용
        currency: 'USD',
        symbol: '$',
        pgProvider: 'stripe',
        stripePublicKey: 'pk_live_us_key_placeholder',
        bankInfo: 'Bank of America 987654321',
        invoiceTitle: 'INVOICE',
        companyName: 'Chameleon Global Inc.',
        csPhone: '+1-234-567-8900'
    };
}

// 설정 내보내기
export const SITE_CONFIG = config;

console.log(`🌍 현재 설정: ${config.code} / 언어파일: ${config.lang}.json`);