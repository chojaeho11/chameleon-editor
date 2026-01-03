// site-config.js

// 1. 현재 접속한 도메인 주소를 가져옵니다 (예: cafe2626.com, cafe0101.com)
const hostname = window.location.hostname;

// [1] 기본 설정 (한국 - cafe2626.com 또는 그 외 주소)
let config = {
    code: 'KR',
    lang: 'kr',          // 불러올 json 파일명 (long/kr.json)
    currency: 'KRW',     // 통화 코드
    symbol: '원',        // 통화 기호
    
    // PG 결제 설정 (한국)
    pgProvider: 'toss',
    // ▼ 기존에 쓰시던 토스 라이브 키를 여기에 넣었습니다 ▼
    tossClientKey: 'live_ck_4yKeq5bgrpLgoDjOgjeBrGX0lzW6', 
    
    // 견적서/입금 계좌 정보
    bankInfo: '국민은행 647701-04-277763 (예금주: 카멜레온프린팅)',
    invoiceTitle: '견 적 서',
    companyName: '(주)카멜레온프린팅',
    csPhone: '031-366-1984'
};

// [2] 🇯🇵 일본 도메인 감지 (cafe0101.com)
if (hostname.includes('cafe0101.com')) {
    config = {
        code: 'JP',
        lang: 'jp',          // long/jp.json
        currency: 'JPY',
        symbol: '¥',
        
        // PG 결제 설정 (일본 - 스트라이프)
        pgProvider: 'stripe',
        // ▼ 나중에 발급받은 일본용 Stripe 키를 넣으세요
        stripePublicKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX', 
        
        bankInfo: 'Mizuho Bank 123-456789 (Account: Chameleon)', // 일본 계좌 예시
        invoiceTitle: '御 見 積 書',
        companyName: 'Chameleon Printing JP',
        csPhone: '03-1234-5678'
    };
}
// [3] 🇺🇸 영어/글로벌 도메인 감지 (cafe3355.com)
else if (hostname.includes('cafe3355.com')) {
    config = {
        code: 'US',
        lang: 'en',          // long/en.json
        currency: 'USD',
        symbol: '$',
        
        // PG 결제 설정 (글로벌 - 스트라이프)
        pgProvider: 'stripe',
        // ▼ 나중에 발급받은 미국용 Stripe 키를 넣으세요
        stripePublicKey: 'pk_live_XXXXXXXXXXXXXXXXXXXXXXXX', 
        
        bankInfo: 'Bank of America 987654321', // 미국 계좌 예시
        invoiceTitle: 'INVOICE',
        companyName: 'Chameleon Global Inc.',
        csPhone: '+1-234-567-8900'
    };
}

// 설정 내보내기
export const SITE_CONFIG = config;

// 디버깅용 (브라우저 콘솔에서 확인 가능)
console.log(`🌍 접속 도메인: ${hostname} / 설정된 국가: ${config.code}`);