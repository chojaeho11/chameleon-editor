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
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'US': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        }
    }
};

// SEO 메타데이터 (국가별)
SITE_CONFIG.SEO = {
    'KR': {
        title: '카멜레온프린팅 - 친환경 전시·팝업스토어 인쇄 & 무료 디자인 에디터',
        description: '허니콤보드, 패브릭인쇄, 팝업스토어 전문. 무료 에디터로 등신대/백월 디자인부터 인쇄까지 한번에 해결하세요.',
        keywords: '카멜레온프린팅,허니콤보드,종이매대,패브릭인쇄,팝업스토어,등신대제작,실사출력,연포장,친환경전시,백월디자인,전시부스,폼보드인쇄,아크릴인쇄,배너스탠드,현수막',
        lang: 'ko',
        domain: 'https://www.cafe2626.com',
        siteName: '카멜레온프린팅',
        boardTitle: '카멜레온 커뮤니티 - 블로그 & 후기',
        boardDesc: '카멜레온프린팅 글로벌 커뮤니티입니다. 제작 후기, 디자인 정보, 인쇄 팁을 확인하세요.'
    },
    'JP': {
        title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
        description: 'ハニカムボード、ファブリック印刷、ポップアップストア専門。無料エディターで等身大パネル・バックウォールのデザインから印刷まで一括対応。',
        keywords: 'カメレオンプリンティング,ハニカムボード,ファブリック印刷,ポップアップストア,等身大パネル,展示ブース,エコ印刷,バックウォール,アクリル印刷,バナースタンド,紙什器',
        lang: 'ja',
        domain: 'https://www.cafe0101.com',
        siteName: 'カメレオンプリンティング',
        boardTitle: 'カメレオン コミュニティ - ブログ & レビュー',
        boardDesc: 'カメレオンプリンティングのグローバルコミュニティ。制作レビュー、デザイン情報、印刷のヒントをご覧ください。'
    },
    'US': {
        title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
        description: 'Honeycomb boards, fabric printing, pop-up store displays. Free online editor for life-size cutouts, backwalls, and custom printing solutions.',
        keywords: 'chameleon printing,honeycomb board,fabric printing,pop-up store,display printing,life-size cutout,backwall design,eco printing,acrylic print,banner stand,foam board',
        lang: 'en',
        domain: 'https://www.cafe3355.com',
        siteName: 'Chameleon Printing',
        boardTitle: 'Chameleon Community - Blog & Reviews',
        boardDesc: 'Chameleon Printing global community. Check out production reviews, design tips, and printing information.'
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