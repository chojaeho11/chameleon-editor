// site-config.js

// 1. 도메인 및 URL 파라미터로 국가 확인
const urlParams = new URLSearchParams(window.location.search);
const hostname = window.location.hostname;

let country = 'KR'; // 기본값

// [1순위] 인라인 HTML 스크립트에서 설정된 값 (CDN 캐시 무관)
if (window.__SITE_CODE && window.__SITE_CODE !== 'KR') {
    country = window.__SITE_CODE;
}

// [2순위] 도메인에 따른 국가 설정
if (country === 'KR') {
    if (hostname.includes('cafe0101.com') || hostname.includes('cafe0101')) {
        country = 'JP';
    } else if (hostname.includes('cafe3355.com') || hostname.includes('cafe3355')) {
        country = 'US';
    }
}

// URL 파라미터가 있다면 도메인 설정보다 우선순위
const paramLang = urlParams.get('lang');
if (paramLang) {
    const code = paramLang.toUpperCase();

    // 언어 코드를 국가 코드로 변환
    if (code === 'JA' || code === 'JP') {
        country = 'JP';
    } else if (code === 'EN' || code === 'US') {
        country = 'US';
    } else if (code === 'ZH' || code === 'CN') {
        country = 'CN';
    } else if (code === 'AR') {
        country = 'AR';
    } else if (code === 'ES') {
        country = 'ES';
    } else if (code === 'DE') {
        country = 'DE';
    } else if (code === 'FR') {
        country = 'FR';
    } else {
        country = 'KR';
    }
}

export const SITE_CONFIG = {
    COUNTRY: country, // 'KR', 'JP', 'US', 'CN', 'AR', 'ES', 'DE', 'FR'

    // 국가별 화폐 단위
    CURRENCY_UNIT: {
        'KR': '원',
        'JP': '¥',
        'US': '$',
        'CN': '¥',
        'AR': '﷼',
        'ES': '€',
        'DE': '€',
        'FR': '€'
    },

    // 국가별 환산율 (DB는 KRW 기준 저장, 표시 시 환산)
    CURRENCY_RATE: { 'KR': 1, 'JP': 0.1, 'US': 0.002, 'CN': 0.01, 'AR': 0.005, 'ES': 0.001, 'DE': 0.001, 'FR': 0.001 },

    // 국가별 폰트 정의
    FONTS: {
        'KR': 'Pretendard',
        'JP': 'Noto Sans JP',
        'US': 'Inter',
        'CN': 'Noto Sans SC',
        'AR': 'Noto Sans Arabic',
        'ES': 'Inter',
        'DE': 'Inter',
        'FR': 'Inter'
    },

    // [중요] 국가별 PG사 설정 (토스 / 스트라이프)
    PG_CONFIG: {
        'KR': {
            provider: 'toss',
            clientKey: 'live_ck_4yKeq5bgrpLgoDjOgjeBrGX0lzW6',
            stripeKeyForSub: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'JP': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'US': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'CN': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'AR': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'ES': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'DE': {
            provider: 'stripe',
            publishableKey: 'pk_live_51SfcQ79Uc8Z1bGiuqdFz7CmDXn7Ga7HAkf7XUxsyyvsMWbXTNSS3AMRRoXFS8U1EhTFeBsqX4Axb79Nwig8Lohzs00PIMNcGtG'
        },
        'FR': {
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
    },
    'CN': {
        title: '变色龙印刷 - 环保展示·快闪店印刷 & 免费设计编辑器',
        description: '蜂窝板、布艺印刷、快闪店展示。免费在线编辑器，从等身大立牌到背景墙设计到印刷一站式解决。',
        keywords: '变色龙印刷,蜂窝板,布艺印刷,快闪店,等身大立牌,展示,环保印刷,背景墙,亚克力印刷,横幅架',
        lang: 'zh',
        domain: 'https://www.cafe3355.com',
        siteName: '变色龙印刷',
        boardTitle: '变色龙社区 - 博客 & 评价',
        boardDesc: '变色龙印刷全球社区。查看制作评价、设计信息和印刷技巧。'
    },
    'AR': {
        title: 'طباعة كاميليون - طباعة عروض صديقة للبيئة ومتاجر مؤقتة مع محرر تصميم مجاني',
        description: 'ألواح خلية النحل، طباعة القماش، عروض المتاجر المؤقتة. محرر تصميم مجاني عبر الإنترنت.',
        keywords: 'طباعة كاميليون,لوح خلية النحل,طباعة قماش,متجر مؤقت,طباعة عروض,طباعة صديقة للبيئة',
        lang: 'ar',
        domain: 'https://www.cafe3355.com',
        siteName: 'طباعة كاميليون',
        boardTitle: 'مجتمع كاميليون - مدونة ومراجعات',
        boardDesc: 'مجتمع طباعة كاميليون العالمي. اطلع على مراجعات الإنتاج ونصائح التصميم ومعلومات الطباعة.'
    },
    'ES': {
        title: 'Chameleon Printing - Impresion Eco Display & Pop-up Store con Editor de Diseno Gratis',
        description: 'Paneles honeycomb, impresion en tela, displays para pop-up stores. Editor de diseno online gratuito.',
        keywords: 'chameleon printing,panel honeycomb,impresion tela,pop-up store,impresion display,impresion ecologica,acrilico,banner',
        lang: 'es',
        domain: 'https://www.cafe3355.com',
        siteName: 'Chameleon Printing',
        boardTitle: 'Comunidad Chameleon - Blog & Resenas',
        boardDesc: 'Comunidad global de Chameleon Printing. Consulta resenas de produccion, consejos de diseno e informacion de impresion.'
    },
    'DE': {
        title: 'Chameleon Printing - Umweltfreundlicher Display- & Pop-up-Store-Druck mit kostenlosem Design-Editor',
        description: 'Wabenplatten, Stoffdruck, Pop-up-Store-Displays. Kostenloser Online-Editor fuer lebensgrosse Aufsteller und Druckloesungen.',
        keywords: 'chameleon printing,wabenplatte,stoffdruck,pop-up store,display druck,oeko druck,acryl druck,banner,aufsteller',
        lang: 'de',
        domain: 'https://www.cafe3355.com',
        siteName: 'Chameleon Printing',
        boardTitle: 'Chameleon Community - Blog & Bewertungen',
        boardDesc: 'Globale Chameleon Printing Community. Produktionsbewertungen, Designtipps und Druckinformationen.'
    },
    'FR': {
        title: 'Chameleon Printing - Impression Eco Display & Pop-up Store avec Editeur de Design Gratuit',
        description: 'Panneaux nid d\'abeille, impression textile, displays pop-up store. Editeur de design en ligne gratuit.',
        keywords: 'chameleon printing,panneau nid abeille,impression textile,pop-up store,impression display,impression ecologique,acrylique,banniere',
        lang: 'fr',
        domain: 'https://www.cafe3355.com',
        siteName: 'Chameleon Printing',
        boardTitle: 'Communaute Chameleon - Blog & Avis',
        boardDesc: 'Communaute mondiale Chameleon Printing. Decouvrez les avis, conseils design et informations impression.'
    }
};

// window 전역에 노출 (비모듈 스크립트에서 참조용)
window.SITE_CONFIG = SITE_CONFIG;

// 글로벌 환산 헬퍼: KRW → 현지 통화
export function convertCurrency(krwAmount) {
    const rate = SITE_CONFIG.CURRENCY_RATE[SITE_CONFIG.COUNTRY] || 1;
    return krwAmount * rate;
}

