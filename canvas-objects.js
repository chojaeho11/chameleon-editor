import { canvas } from "./canvas-core.js?v=123";
import { updateLockUI } from "./canvas-utils.js?v=123";
import { sb, currentUser } from "./config.js?v=123";

// ============================================================
// [설정] 현재 사이트 언어 및 폰트 변수
// ============================================================
const urlParams = new URLSearchParams(window.location.search);
let _detectedLang = urlParams.get('lang');
if (!_detectedLang) {
    const _h = window.location.hostname;
    if (_h.includes('cafe0101.com')) _detectedLang = 'JP';
    else if (_h.includes('cafe3355.com')) _detectedLang = 'US';
    else _detectedLang = 'KR';
}
// DB site_fonts.site_code = KR / JA / EN / ZH / AR / ES
const _langMap = { 'JA': 'JA', 'JP': 'JA', 'EN': 'EN', 'US': 'EN', 'KR': 'KR', 'ZH': 'ZH', 'CN': 'ZH', 'AR': 'AR', 'ES': 'ES', 'DE': 'DE', 'FR': 'FR' };
const CURRENT_LANG = _langMap[_detectedLang.toUpperCase()] || 'KR';

// DB에서 불러온 폰트 목록을 저장할 전역 변수
let DYNAMIC_FONTS = [];

// ============================================================
// Google Fonts 무료 서체 (언어별 큐레이션)
// ============================================================
const GOOGLE_FONTS = {
    'KR': [
        { font_name: '노토 산스', font_family: 'Noto Sans KR', weights: '300;400;700' },
        { font_name: '나눔고딕', font_family: 'Nanum Gothic', weights: '400;700;800' },
        { font_name: '나눔명조', font_family: 'Nanum Myeongjo', weights: '400;700' },
        { font_name: '검은고딕', font_family: 'Black Han Sans', weights: '400' },
        { font_name: '나눔펜스크립트', font_family: 'Nanum Pen Script', weights: '400' },
        { font_name: '도현', font_family: 'Do Hyeon', weights: '400' },
        { font_name: '주아', font_family: 'Jua', weights: '400' },
        { font_name: '싱글데이', font_family: 'Single Day', weights: '400' },
        { font_name: '고틱 A1', font_family: 'Gothic A1', weights: '400;700;900' },
        { font_name: '하이멜로디', font_family: 'Hi Melody', weights: '400' },
        { font_name: '감자꽃', font_family: 'Gamja Flower', weights: '400' },
        { font_name: '귀여운글씨', font_family: 'Cute Font', weights: '400' },
        { font_name: '이스트 시 도쿄', font_family: 'East Sea Dokdo', weights: '400' },
        { font_name: '가비아 솔밋', font_family: 'Gaegu', weights: '300;400;700' },
        { font_name: '블랙앤화이트', font_family: 'Black And White Picture', weights: '400' },
        { font_name: '송명체', font_family: 'Song Myung', weights: '400' },
        { font_name: '스타일리쉬', font_family: 'Stylish', weights: '400' },
        { font_name: '풍겨', font_family: 'Poor Story', weights: '400' },
        { font_name: '요온체', font_family: 'Yeon Sung', weights: '400' },
        { font_name: '국민연금체', font_family: 'Gowun Dodum', weights: '400' },
        { font_name: '고운바탕', font_family: 'Gowun Batang', weights: '400;700' },
        { font_name: '나눔브러쉬', font_family: 'Nanum Brush Script', weights: '400' },
        { font_name: 'IBM 플렉스 산스', font_family: 'IBM Plex Sans KR', weights: '300;400;600;700' }
    ],
    'JA': [
        { font_name: 'Noto Sans JP', font_family: 'Noto Sans JP', weights: '300;400;500;700;900' },
        { font_name: 'Noto Serif JP', font_family: 'Noto Serif JP', weights: '400;700' },
        { font_name: 'M PLUS Rounded 1c', font_family: 'M PLUS Rounded 1c', weights: '300;400;700;900' },
        { font_name: 'Zen Maru Gothic', font_family: 'Zen Maru Gothic', weights: '400;500;700' },
        { font_name: 'Sawarabi Mincho', font_family: 'Sawarabi Mincho', weights: '400' },
        { font_name: 'Sawarabi Gothic', font_family: 'Sawarabi Gothic', weights: '400' },
        { font_name: 'Kosugi Maru', font_family: 'Kosugi Maru', weights: '400' },
        { font_name: 'Shippori Mincho', font_family: 'Shippori Mincho', weights: '400;600;700' },
        { font_name: 'Klee One', font_family: 'Klee One', weights: '400;600' },
        { font_name: 'Zen Kaku Gothic New', font_family: 'Zen Kaku Gothic New', weights: '400;500;700' },
        { font_name: 'Hachi Maru Pop', font_family: 'Hachi Maru Pop', weights: '400' },
        { font_name: 'Kaisei Opti', font_family: 'Kaisei Opti', weights: '400;700' },
        { font_name: 'Kaisei Decol', font_family: 'Kaisei Decol', weights: '400;700' },
        { font_name: 'Zen Antique', font_family: 'Zen Antique', weights: '400' },
        { font_name: 'Reggae One', font_family: 'Reggae One', weights: '400' },
        { font_name: 'RocknRoll One', font_family: 'RocknRoll One', weights: '400' },
        { font_name: 'Stick', font_family: 'Stick', weights: '400' },
        { font_name: 'Yomogi', font_family: 'Yomogi', weights: '400' },
        { font_name: 'Yusei Magic', font_family: 'Yusei Magic', weights: '400' },
        { font_name: 'DotGothic16', font_family: 'DotGothic16', weights: '400' },
        { font_name: 'Dela Gothic One', font_family: 'Dela Gothic One', weights: '400' },
        { font_name: 'Train One', font_family: 'Train One', weights: '400' },
        { font_name: 'Zen Kurenaido', font_family: 'Zen Kurenaido', weights: '400' },
        { font_name: 'M PLUS 1p', font_family: 'M PLUS 1p', weights: '300;400;700;900' },
        { font_name: 'Murecho', font_family: 'Murecho', weights: '300;400;700;900' }
    ],
    'EN': [
        { font_name: 'Inter', font_family: 'Inter', weights: '300;400;500;600;700;900' },
        { font_name: 'Poppins', font_family: 'Poppins', weights: '300;400;500;600;700;900' },
        { font_name: 'Roboto', font_family: 'Roboto', weights: '300;400;500;700;900' },
        { font_name: 'Montserrat', font_family: 'Montserrat', weights: '300;400;600;700;900' },
        { font_name: 'Open Sans', font_family: 'Open Sans', weights: '300;400;600;700' },
        { font_name: 'Lato', font_family: 'Lato', weights: '300;400;700;900' },
        { font_name: 'Oswald', font_family: 'Oswald', weights: '300;400;600;700' },
        { font_name: 'Raleway', font_family: 'Raleway', weights: '300;400;600;700;900' },
        { font_name: 'Playfair Display', font_family: 'Playfair Display', weights: '400;600;700;900' },
        { font_name: 'Merriweather', font_family: 'Merriweather', weights: '300;400;700;900' },
        { font_name: 'Nunito', font_family: 'Nunito', weights: '300;400;600;700;900' },
        { font_name: 'Quicksand', font_family: 'Quicksand', weights: '300;400;500;600;700' },
        { font_name: 'DM Sans', font_family: 'DM Sans', weights: '400;500;700' },
        { font_name: 'Bebas Neue', font_family: 'Bebas Neue', weights: '400' },
        { font_name: 'Lobster', font_family: 'Lobster', weights: '400' },
        { font_name: 'Pacifico', font_family: 'Pacifico', weights: '400' },
        { font_name: 'Dancing Script', font_family: 'Dancing Script', weights: '400;600;700' },
        { font_name: 'Caveat', font_family: 'Caveat', weights: '400;600;700' },
        { font_name: 'Great Vibes', font_family: 'Great Vibes', weights: '400' },
        { font_name: 'Satisfy', font_family: 'Satisfy', weights: '400' },
        { font_name: 'Abril Fatface', font_family: 'Abril Fatface', weights: '400' },
        { font_name: 'Permanent Marker', font_family: 'Permanent Marker', weights: '400' },
        { font_name: 'Josefin Sans', font_family: 'Josefin Sans', weights: '300;400;600;700' },
        { font_name: 'Archivo Black', font_family: 'Archivo Black', weights: '400' },
        { font_name: 'Righteous', font_family: 'Righteous', weights: '400' },
        { font_name: 'Russo One', font_family: 'Russo One', weights: '400' },
        { font_name: 'Cinzel', font_family: 'Cinzel', weights: '400;700;900' },
        { font_name: 'Fredoka One', font_family: 'Fredoka', weights: '400;600;700' },
        { font_name: 'Comfortaa', font_family: 'Comfortaa', weights: '300;400;700' },
        { font_name: 'Bitter', font_family: 'Bitter', weights: '300;400;700;900' }
    ],
    'ES': [
        { font_name: 'Inter', font_family: 'Inter', weights: '300;400;500;600;700;900' },
        { font_name: 'Poppins', font_family: 'Poppins', weights: '300;400;500;600;700;900' },
        { font_name: 'Roboto', font_family: 'Roboto', weights: '300;400;500;700;900' },
        { font_name: 'Montserrat', font_family: 'Montserrat', weights: '300;400;600;700;900' },
        { font_name: 'Open Sans', font_family: 'Open Sans', weights: '300;400;600;700' },
        { font_name: 'Lato', font_family: 'Lato', weights: '300;400;700;900' },
        { font_name: 'Oswald', font_family: 'Oswald', weights: '300;400;600;700' },
        { font_name: 'Raleway', font_family: 'Raleway', weights: '300;400;600;700;900' },
        { font_name: 'Playfair Display', font_family: 'Playfair Display', weights: '400;600;700;900' },
        { font_name: 'Merriweather', font_family: 'Merriweather', weights: '300;400;700;900' },
        { font_name: 'Nunito', font_family: 'Nunito', weights: '300;400;600;700;900' },
        { font_name: 'Quicksand', font_family: 'Quicksand', weights: '300;400;500;600;700' },
        { font_name: 'DM Sans', font_family: 'DM Sans', weights: '400;500;700' },
        { font_name: 'Bebas Neue', font_family: 'Bebas Neue', weights: '400' },
        { font_name: 'Lobster', font_family: 'Lobster', weights: '400' },
        { font_name: 'Pacifico', font_family: 'Pacifico', weights: '400' },
        { font_name: 'Dancing Script', font_family: 'Dancing Script', weights: '400;600;700' },
        { font_name: 'Caveat', font_family: 'Caveat', weights: '400;600;700' },
        { font_name: 'Great Vibes', font_family: 'Great Vibes', weights: '400' },
        { font_name: 'Satisfy', font_family: 'Satisfy', weights: '400' },
        { font_name: 'Abril Fatface', font_family: 'Abril Fatface', weights: '400' },
        { font_name: 'Permanent Marker', font_family: 'Permanent Marker', weights: '400' },
        { font_name: 'Josefin Sans', font_family: 'Josefin Sans', weights: '300;400;600;700' },
        { font_name: 'Archivo Black', font_family: 'Archivo Black', weights: '400' },
        { font_name: 'Righteous', font_family: 'Righteous', weights: '400' },
        { font_name: 'Russo One', font_family: 'Russo One', weights: '400' },
        { font_name: 'Cinzel', font_family: 'Cinzel', weights: '400;700;900' },
        { font_name: 'Fredoka One', font_family: 'Fredoka', weights: '400;600;700' },
        { font_name: 'Comfortaa', font_family: 'Comfortaa', weights: '300;400;700' },
        { font_name: 'Bitter', font_family: 'Bitter', weights: '300;400;700;900' }
    ],
    'ZH': [
        { font_name: '思源黑体', font_family: 'Noto Sans SC', weights: '300;400;500;700;900' },
        { font_name: '思源宋体', font_family: 'Noto Serif SC', weights: '400;600;700;900' },
        { font_name: 'ZCOOL 小薇', font_family: 'ZCOOL XiaoWei', weights: '400' },
        { font_name: 'ZCOOL 庆科黄油', font_family: 'ZCOOL QingKe HuangYou', weights: '400' },
        { font_name: 'ZCOOL 快乐体', font_family: 'ZCOOL KuaiLe', weights: '400' },
        { font_name: '马善政楷', font_family: 'Ma Shan Zheng', weights: '400' },
        { font_name: '龙藏体', font_family: 'Long Cang', weights: '400' },
        { font_name: '刘建毛草', font_family: 'Liu Jian Mao Cao', weights: '400' },
        { font_name: '志莽行书', font_family: 'Zhi Mang Xing', weights: '400' },
        { font_name: '黑体 (Heiti)', font_family: 'Noto Sans SC', weights: '900' },
        { font_name: '宋体 (Songti)', font_family: 'Noto Serif SC', weights: '400' }
    ],
    'AR': [
        { font_name: 'Noto Sans Arabic', font_family: 'Noto Sans Arabic', weights: '300;400;500;600;700;900' },
        { font_name: 'Noto Kufi Arabic', font_family: 'Noto Kufi Arabic', weights: '400;700' },
        { font_name: 'Noto Naskh Arabic', font_family: 'Noto Naskh Arabic', weights: '400;600;700' },
        { font_name: 'Amiri', font_family: 'Amiri', weights: '400;700' },
        { font_name: 'Cairo', font_family: 'Cairo', weights: '300;400;600;700;900' },
        { font_name: 'Tajawal', font_family: 'Tajawal', weights: '300;400;500;700;900' },
        { font_name: 'El Messiri', font_family: 'El Messiri', weights: '400;500;600;700' },
        { font_name: 'Lemonada', font_family: 'Lemonada', weights: '300;400;600;700' },
        { font_name: 'Scheherazade New', font_family: 'Scheherazade New', weights: '400;700' },
        { font_name: 'Readex Pro', font_family: 'Readex Pro', weights: '300;400;600;700' },
        { font_name: 'IBM Plex Sans Arabic', font_family: 'IBM Plex Sans Arabic', weights: '300;400;500;600;700' },
        { font_name: 'Almarai', font_family: 'Almarai', weights: '300;400;700;800' },
        { font_name: 'Changa', font_family: 'Changa', weights: '300;400;600;700' },
        { font_name: 'Harmattan', font_family: 'Harmattan', weights: '400;700' },
        { font_name: 'Reem Kufi', font_family: 'Reem Kufi', weights: '400;600;700' },
        { font_name: 'Mada', font_family: 'Mada', weights: '300;400;500;700;900' },
        { font_name: 'Markazi Text', font_family: 'Markazi Text', weights: '400;500;600;700' },
        { font_name: 'Aref Ruqaa', font_family: 'Aref Ruqaa', weights: '400;700' },
        { font_name: 'Lalezar', font_family: 'Lalezar', weights: '400' },
        { font_name: 'Baloo Bhaijaan 2', font_family: 'Baloo Bhaijaan 2', weights: '400;600;700;800' }
    ],
    'DE': [
        { font_name: 'Inter', font_family: 'Inter', weights: '300;400;500;600;700;900' },
        { font_name: 'Poppins', font_family: 'Poppins', weights: '300;400;500;600;700;900' },
        { font_name: 'Roboto', font_family: 'Roboto', weights: '300;400;500;700;900' },
        { font_name: 'Montserrat', font_family: 'Montserrat', weights: '300;400;600;700;900' },
        { font_name: 'Open Sans', font_family: 'Open Sans', weights: '300;400;600;700' },
        { font_name: 'Lato', font_family: 'Lato', weights: '300;400;700;900' },
        { font_name: 'Oswald', font_family: 'Oswald', weights: '300;400;600;700' },
        { font_name: 'Raleway', font_family: 'Raleway', weights: '300;400;600;700;900' },
        { font_name: 'Playfair Display', font_family: 'Playfair Display', weights: '400;600;700;900' },
        { font_name: 'Merriweather', font_family: 'Merriweather', weights: '300;400;700;900' },
        { font_name: 'Nunito', font_family: 'Nunito', weights: '300;400;600;700;900' },
        { font_name: 'Quicksand', font_family: 'Quicksand', weights: '300;400;500;600;700' },
        { font_name: 'DM Sans', font_family: 'DM Sans', weights: '400;500;700' },
        { font_name: 'Bebas Neue', font_family: 'Bebas Neue', weights: '400' },
        { font_name: 'Lobster', font_family: 'Lobster', weights: '400' },
        { font_name: 'Pacifico', font_family: 'Pacifico', weights: '400' },
        { font_name: 'Dancing Script', font_family: 'Dancing Script', weights: '400;600;700' },
        { font_name: 'Caveat', font_family: 'Caveat', weights: '400;600;700' },
        { font_name: 'Great Vibes', font_family: 'Great Vibes', weights: '400' },
        { font_name: 'Satisfy', font_family: 'Satisfy', weights: '400' },
        { font_name: 'Abril Fatface', font_family: 'Abril Fatface', weights: '400' },
        { font_name: 'Permanent Marker', font_family: 'Permanent Marker', weights: '400' },
        { font_name: 'Josefin Sans', font_family: 'Josefin Sans', weights: '300;400;600;700' },
        { font_name: 'Archivo Black', font_family: 'Archivo Black', weights: '400' },
        { font_name: 'Righteous', font_family: 'Righteous', weights: '400' },
        { font_name: 'Russo One', font_family: 'Russo One', weights: '400' },
        { font_name: 'Cinzel', font_family: 'Cinzel', weights: '400;700;900' },
        { font_name: 'Fredoka One', font_family: 'Fredoka', weights: '400;600;700' },
        { font_name: 'Comfortaa', font_family: 'Comfortaa', weights: '300;400;700' },
        { font_name: 'Bitter', font_family: 'Bitter', weights: '300;400;700;900' }
    ],
    'FR': [
        { font_name: 'Inter', font_family: 'Inter', weights: '300;400;500;600;700;900' },
        { font_name: 'Poppins', font_family: 'Poppins', weights: '300;400;500;600;700;900' },
        { font_name: 'Roboto', font_family: 'Roboto', weights: '300;400;500;700;900' },
        { font_name: 'Montserrat', font_family: 'Montserrat', weights: '300;400;600;700;900' },
        { font_name: 'Open Sans', font_family: 'Open Sans', weights: '300;400;600;700' },
        { font_name: 'Lato', font_family: 'Lato', weights: '300;400;700;900' },
        { font_name: 'Oswald', font_family: 'Oswald', weights: '300;400;600;700' },
        { font_name: 'Raleway', font_family: 'Raleway', weights: '300;400;600;700;900' },
        { font_name: 'Playfair Display', font_family: 'Playfair Display', weights: '400;600;700;900' },
        { font_name: 'Merriweather', font_family: 'Merriweather', weights: '300;400;700;900' },
        { font_name: 'Nunito', font_family: 'Nunito', weights: '300;400;600;700;900' },
        { font_name: 'Quicksand', font_family: 'Quicksand', weights: '300;400;500;600;700' },
        { font_name: 'DM Sans', font_family: 'DM Sans', weights: '400;500;700' },
        { font_name: 'Bebas Neue', font_family: 'Bebas Neue', weights: '400' },
        { font_name: 'Lobster', font_family: 'Lobster', weights: '400' },
        { font_name: 'Pacifico', font_family: 'Pacifico', weights: '400' },
        { font_name: 'Dancing Script', font_family: 'Dancing Script', weights: '400;600;700' },
        { font_name: 'Caveat', font_family: 'Caveat', weights: '400;600;700' },
        { font_name: 'Great Vibes', font_family: 'Great Vibes', weights: '400' },
        { font_name: 'Satisfy', font_family: 'Satisfy', weights: '400' },
        { font_name: 'Abril Fatface', font_family: 'Abril Fatface', weights: '400' },
        { font_name: 'Permanent Marker', font_family: 'Permanent Marker', weights: '400' },
        { font_name: 'Josefin Sans', font_family: 'Josefin Sans', weights: '300;400;600;700' },
        { font_name: 'Archivo Black', font_family: 'Archivo Black', weights: '400' },
        { font_name: 'Righteous', font_family: 'Righteous', weights: '400' },
        { font_name: 'Russo One', font_family: 'Russo One', weights: '400' },
        { font_name: 'Cinzel', font_family: 'Cinzel', weights: '400;700;900' },
        { font_name: 'Fredoka One', font_family: 'Fredoka', weights: '400;600;700' },
        { font_name: 'Comfortaa', font_family: 'Comfortaa', weights: '300;400;700' },
        { font_name: 'Bitter', font_family: 'Bitter', weights: '300;400;700;900' }
    ]
};

// Google Fonts CSS URL을 폰트 리스트에서 자동 생성
function buildGoogleFontsURL(lang) {
    const fonts = GOOGLE_FONTS[lang] || GOOGLE_FONTS['EN'];
    const families = fonts.map(f => {
        const name = f.font_family.replace(/ /g, '+');
        return `family=${name}:wght@${f.weights}`;
    });
    return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

// ============================================================
// [1] 초기화 함수 (Main Init)
// ============================================================
export async function initObjectTools() {
    // [수정] 폰트 로딩은 여기서 하지 않고, 에디터 진입 시 별도로 호출합니다.
    // loadGoogleWebFontsCSS();  <-- 주석 처리
    // await loadDynamicFonts(); <-- 주석 처리

    // 1. 전역 함수로 폰트 로딩 기능 등록 (index.html에서 호출함)
    window.initCanvasFonts = async function() {
        if (window.isFontsInitialized) return;
        console.log("🎨 [Editor] 폰트 동적 로딩 시작...");
        loadGoogleWebFontsCSS();
        await loadDynamicFonts();
        window.isFontsInitialized = true;
    };

    // 2. 각종 핸들러 초기화 (이건 미리 해도 상관없음)
    initTextHandlers();      // 텍스트 추가/수정
    initShapeHandlers();     // 도형 추가
    initEditHandlers();      // 편집(삭제, 중앙정렬 등)
    initSelectionEffects();  // 선택 시 UI 갱신
    initColorHandlers();     // 색상 변경
    initLayerHandlers();     // 레이어 순서
    initAlignHandlers();     // 정렬
    initRotationHandlers();  // 회전
    
    // 4. 캔바 스타일 실시간 편집(더블클릭) 활성화
    initAdvancedEditing();

    console.log(`✨ canvas-objects.js initialized (Site: ${CURRENT_LANG})`);
}

// ============================================================
// [2] 폰트 로딩 시스템 (Supabase 연동)
// ============================================================
function loadGoogleWebFontsCSS() {
    if (document.getElementById("google-fonts-link")) return;
    const link = document.createElement("link");
    link.id = "google-fonts-link";
    link.rel = "stylesheet";
    link.href = buildGoogleFontsURL(CURRENT_LANG);
    document.head.appendChild(link);
    console.log(`📥 [Font] Google Fonts CSS loaded for ${CURRENT_LANG} (${(GOOGLE_FONTS[CURRENT_LANG]||[]).length} fonts)`);
}

// ★ 핵심: Supabase에서 폰트 목록을 가져와 브라우저에 등록
async function loadDynamicFonts() {
    console.log(`📥 [Font] ${CURRENT_LANG} 폰트 로딩 중...`);
    let dbFonts = [];

    // 1단계: DB 폰트 로드 (실패해도 계속 진행)
    try {
        const codeAliases = { 'JA': ['JA','JP'], 'EN': ['EN','US'] };
        const codes = codeAliases[CURRENT_LANG] || [CURRENT_LANG];
        const { data, error } = await sb.from('site_fonts')
            .select('*')
            .in('site_code', codes)
            .order('created_at', { ascending: true });

        if (!error && data) {
            dbFonts = data;
            const fontPromises = dbFonts.map(font => {
                const fontFace = new FontFace(font.font_family, `url(${encodeURI(font.file_url)})`);
                return fontFace.load().then(loadedFace => {
                    document.fonts.add(loadedFace);
                    console.log(`✅ DB Font: ${font.font_name}`);
                }).catch(err => {
                    console.warn(`❌ Font Load Failed (${font.font_name}):`, err);
                });
            });
            await Promise.all(fontPromises);
        }
    } catch (e) {
        console.warn("DB 폰트 로딩 스킵:", e.message);
    }

    // 2단계: Google Fonts 병합 (항상 실행)
    const googleFonts = (GOOGLE_FONTS[CURRENT_LANG] || []).map(gf => ({
        font_name: gf.font_name,
        font_family: gf.font_family,
        file_url: null,
        is_google_font: true
    }));
    const dbFamilies = new Set(dbFonts.map(f => f.font_family));
    const uniqueGoogleFonts = googleFonts.filter(gf => !dbFamilies.has(gf.font_family));

    DYNAMIC_FONTS = [...dbFonts, ...uniqueGoogleFonts];
    window.DYNAMIC_FONTS = DYNAMIC_FONTS;
    console.log(`📋 [Font] Total: ${dbFonts.length} DB + ${uniqueGoogleFonts.length} Google = ${DYNAMIC_FONTS.length} fonts`);
}

// 폰트 전체보기 모달에 목록 렌더링
function renderFontList() {
    const listContainer = document.getElementById("fontList");
    if (!listContainer) return;
    
    listContainer.innerHTML = ""; // 초기화

    if (DYNAMIC_FONTS.length === 0) {
        // [수정] 다국어 메시지 적용
        const msg = window.t('msg_no_fonts', 'No fonts registered.<br>Please register fonts in the admin page.');
        listContainer.innerHTML = `<div style="padding:20px; text-align:center; color:#888;">${msg}</div>`;
        return;
    }

    DYNAMIC_FONTS.forEach(font => {
        const div = document.createElement("div");
        div.className = "font-item";
        div.innerText = font.font_name; // 화면에 보여줄 이름
        
        // 스타일 설정
        div.style.padding = "12px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.style.fontFamily = font.font_family; // 실제 폰트로 미리보기 적용
        div.style.fontSize = "18px";
        div.style.transition = "background 0.2s";

        div.onmouseover = () => div.style.background = "#f8fafc";
        div.onmouseout = () => div.style.background = "white";

        // 클릭 시 텍스트에 폰트 적용
        div.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active) return alert("Please select a text object to change the font.");

            const applyFont = (obj) => {
                if (obj.type && (obj.type.includes('text') || obj.type === 'i-text' || obj.type === 'textbox')) {
                    obj.set("fontFamily", font.font_family);
                }
            };

            // 그룹이거나 다중 선택일 경우 처리
            if (active.type === 'activeSelection' || active.type === 'group') {
                active.getObjects().forEach(o => applyFont(o));
            } else if (active.isEffectGroup || active.isOutlineGroup) {
                active.getObjects().forEach(o => applyFont(o));
                active.addWithUpdate(); // 그룹 갱신
            } else {
                applyFont(active);
            }
            
            canvas.requestRenderAll();
            document.getElementById("fontModal").style.display = "none";
        };
        
        listContainer.appendChild(div);
    });
}

// ============================================================
// [3] 텍스트 핸들러 (Text Tools)
// ============================================================

// ============================================================
// [3] 텍스트 핸들러 (Text Tools)
// ============================================================
function initTextHandlers() {
    const btnBasic = document.getElementById("btnAddBasicText");
    
    if (btnBasic) {
        btnBasic.onclick = () => {
            // 1. 폰트 설정 (1번째 등록된 폰트 우선 사용)
            const targetFontObj = DYNAMIC_FONTS[0] || { font_family: 'sans-serif' };
            const family = targetFontObj.font_family;
            
            // 2. 대지(Board) 너비 계산
            // 보드가 없으면 캔버스 전체 너비를 기준으로 함
            const board = canvas.getObjects().find(o => o.isBoard);
            const baseW = board ? (board.width * board.scaleX) : canvas.width;

            // 3. 텍스트 객체 생성 (일단 임의의 크기로 생성)
            const textString = "“The Story”";
            const t = new fabric.IText(textString, {
                fontFamily: family,
                fontSize: 30, // 초기값 (계산 후 변경됨)
                fill: "#1f1f1fff", 
                left: 0, top: 0,
                originX: 'center', originY: 'center'
            });

            // 4. ★ 핵심: 대지 너비의 2/3(66%)에 맞게 폰트 크기 자동 조절
            if (t.width > 0) {
                const targetWidth = baseW * 0.66; // 목표 너비 (2/3)
                const scaleFactor = targetWidth / t.width; // 비율 계산
                
                // 폰트 사이즈에 비율을 곱해서 적용
                t.set('fontSize', t.fontSize * scaleFactor);
                // (선택사항) 만약 너무 커지는게 싫다면 최대값 제한 가능: Math.min(t.fontSize * scaleFactor, 200)
            }

            addToCenter(t);
        };
    }

    // 폰트 전체보기 버튼 이벤트 연결
    const btnFontSelect = document.getElementById("btnFontSelect");
    if (btnFontSelect) {
        btnFontSelect.onclick = () => {
            // [수정] 다국어 적용
            if (!canvas.getActiveObject()) return alert(window.t('msg_select_text_font', "Please select a text object to change the font."));
            
            const modal = document.getElementById("fontModal");
            if (modal) {
                modal.style.display = "flex";
                renderFontList(); 
            }
        };
    }
    
    setupStyleHandlers();
}

// ============================================================
// ★★★ [리뉴얼 V2] 텍스트 마법사 (여백 확보 및 사이즈 최적화) ★★★
// ============================================================
window.applyTextWizard = function(type) {
    if (!canvas) return;

    // 1. 폰트 매핑
    const titleFont = (DYNAMIC_FONTS[0] || { font_family: 'sans-serif' }).font_family;
    const bodyFont = ((DYNAMIC_FONTS.length > 5) ? DYNAMIC_FONTS[5] : (DYNAMIC_FONTS[0] || { font_family: 'sans-serif' })).font_family;

    // 2. 작업 영역(Board) 계산
    const board = canvas.getObjects().find(o => o.isBoard);
    const baseX = board ? board.left : 0;
    const baseY = board ? board.top : 0;
    const baseW = board ? (board.width * board.scaleX) : canvas.width;
    const baseH = board ? (board.height * board.scaleY) : canvas.height;
    
    // 중앙점
    const centerX = baseX + baseW / 2;
    const centerY = baseY + baseH / 2;

    const objects = [];

    // 텍스트 생성 헬퍼
    const addText = (text, font, sizeRatio, weight, left, top, align, color='#111', spacing=0) => {
        return new fabric.IText(text, {
            fontFamily: font,
            fontSize: baseH * sizeRatio, // 높이 비례 사이즈
            fontWeight: weight,
            fill: color,
            left: left,
            top: top,
            originX: align, 
            originY: 'top',
            textAlign: align,
            charSpacing: spacing
        });
    };

    // ----------------------------------------------------------------
// [A] Business Card - Reduce element sizes and keep comfortable spacing
// ----------------------------------------------------------------
if (type === 'card') {
    // Layout zones (keep ~4:6 ratio but add padding)
    const leftZoneCenter = baseX + (baseW * 0.22); // logo center
    const dividerX = baseX + (baseW * 0.45);       // divider position (slightly more to the right)
    const infoStartX = baseX + (baseW * 0.50);     // info start (keep gap from divider)

    // 1. Logo area (scale down 0.18 -> 0.15)
    const icon = addText("✂", 'sans-serif', 0.15, 'normal', leftZoneCenter, baseY + baseH * 0.28, 'center', '#222');
    icon.set({ angle: -90 });

    // Brand name (scale down 0.07 -> 0.06)
    const logoMain = addText("SOON HAIR", titleFont, 0.06, 'bold', leftZoneCenter, baseY + baseH * 0.50, 'center', '#111', 20);
    const logoSub  = addText("SOON HAIR", bodyFont, 0.03, 'normal', leftZoneCenter, baseY + baseH * 0.60, 'center', '#555', 50);

    // 2. Divider line
    const line = new fabric.Rect({
        left: dividerX, top: baseY + (baseH * 0.2),
        width: Math.max(1, baseW * 0.002), height: baseH * 0.6,
        fill: '#ccc', originX: 'center', originY: 'top'
    });

    // 3. Right-side info (smaller font to prevent overlap)
    // Name + Title
    const name = addText("Jihyun Soon", titleFont, 0.07, 'bold', infoStartX, baseY + baseH * 0.22, 'left', '#111', 10);
    const job  = addText("Owner | Hair Designer", bodyFont, 0.028, 'normal', infoStartX, baseY + baseH * 0.32, 'left', '#666');

    // Contact (scale down 0.08 -> 0.065)
    const phoneLabel = addText("Reservation", bodyFont, 0.022, 'normal', infoStartX, baseY + baseH * 0.46, 'left', '#888');
    const phone      = addText("+82 2-1234-5678", titleFont, 0.065, 'bold', infoStartX, baseY + baseH * 0.50, 'left', '#111');

    // Address (scale down 0.032 -> 0.025)
    const addr = addText("5F, Soon Bldg, 5 Myeongdong 3-gil, Jung-gu, Seoul", bodyFont, 0.025, 'normal', infoStartX, baseY + baseH * 0.68, 'left', '#444');
    const sns  = addText("Kakao: soonhair   Insta: soon_official", bodyFont, 0.025, 'normal', infoStartX, baseY + baseH * 0.73, 'left', '#444');

    objects.push(icon, logoMain, logoSub, line, name, job, phoneLabel, phone, addr, sns);
}

// ----------------------------------------------------------------
// [B] Menu - Keep side padding and auto-adjust dotted line width
// ----------------------------------------------------------------
else if (type === 'menu') {
    // Top title (scale down 0.08 -> 0.06)
    const mainTitle = addText("PREMIUM COFFEE", titleFont, 0.06, 'bold', centerX, baseY + baseH * 0.10, 'center', '#2C3E50', 50);
    const subTitle  = addText("Fresh Roasted Beans", bodyFont, 0.025, 'normal', centerX, baseY + baseH * 0.17, 'center', '#7F8C8D', 100);

    // Divider line
    const topDescLine = new fabric.Rect({
        left: centerX, top: baseY + baseH * 0.21,
        width: baseW * 0.1, height: 2, fill: '#D35400', originX: 'center'
    });
    objects.push(mainTitle, subTitle, topDescLine);

    // Menu list (8 items)
    const items = [
        { n: "Espresso",          p: "4.0" },
        { n: "Americano",         p: "4.5" },
        { n: "Café Latte",        p: "5.0" },
        { n: "Vanilla Bean Latte",p: "5.5" },
        { n: "Caramel Macchiato", p: "5.5" },
        { n: "Cold Brew",         p: "5.0" },
        { n: "Jeju Matcha Latte", p: "6.0" },
        { n: "Real Chocolate Latte", p: "5.5" }
    ];

    const startY = baseY + baseH * 0.30;
    const gapY = baseH * 0.075;          // vertical spacing
    const paddingSide = baseW * 0.15;    // 15% padding each side (30% total)
    const menuLeftX = baseX + paddingSide;
    const menuRightX = baseX + baseW - paddingSide;

    // Dotted-line width calculation (total width - side padding - estimated text area)
    const dotLineWidth = (baseW - (paddingSide * 2)) * 0.4;

    items.forEach((item, i) => {
        const yPos = startY + (i * gapY);

        // Item name (scale down 0.04 -> 0.032)
        const mName = addText(item.n, bodyFont, 0.032, 'bold', menuLeftX, yPos, 'left', '#333');

        // Dotted line (position adjusted)
        const dotLine = new fabric.Rect({
            left: menuLeftX + (baseW * 0.30), // start after item name
            top: yPos + (baseH * 0.025),      // mid-height of text
            width: dotLineWidth,
            height: 1,
            fill: '#ddd',
            originX: 'left'
        });

        // Price
        const mPrice = addText(item.p, titleFont, 0.032, 'bold', menuRightX, yPos, 'right', '#D35400');

        objects.push(mName, dotLine, mPrice);
    });
}

// ----------------------------------------------------------------
// [C] Poster (Flyer) - Reduce huge title size + change title color to BLUE
// ----------------------------------------------------------------
else if (type === 'flyer') {
    // Huge title (scale down 0.18 -> 0.15, add left padding)
    const bigTitle = addText("GRAND\nOPENING", titleFont, 0.15, 'bold', baseX + baseW * 0.08, baseY + baseH * 0.08, 'left', '#141f42ff');
    bigTitle.set({ lineHeight: 0.9, charSpacing: -10 });

    // Date box (narrower width)
    const dateBox = new fabric.Rect({
        left: baseX + baseW * 0.08, top: baseY + baseH * 0.45,
        width: baseW * 0.35, height: baseH * 0.07, fill: '#110c4bff', originX: 'left'
    });

    // Date text
    const dateText = addText("Dec 25, 2025", bodyFont, 0.04, 'bold', baseX + baseW * 0.255, baseY + baseH * 0.465, 'center', '#fff');

    // Bottom details (secure right margin 0.95 -> 0.92, scaled down)
    const detailText = addText(
        "Venue: COEX Hall A, Seoul\nTime: 10:00 AM - 06:00 PM\nHost: Chameleon Design",
        bodyFont, 0.03, 'normal',
        baseX + baseW * 0.92, baseY + baseH * 0.78, 'right', '#1d1d1dff'
    );
    detailText.set({ lineHeight: 1.6 });

    objects.push(bigTitle, dateBox, dateText, detailText);
}

// ----------------------------------------------------------------
// [D] Basic - Change title color to SKY BLUE
// ----------------------------------------------------------------
else {
    const title = addText("2025 EXHIBITION", titleFont, 0.07, 'bold', centerX, baseY + baseH * 0.35, 'center', '#da0959ff');
    const sub   = addText("Future of Design & Art", bodyFont, 0.035, 'normal', centerX, baseY + baseH * 0.50, 'center', '#da0959ff');
    const info  = addText("Date: Aug 15, 2025 | Venue: DDP Art Hall", bodyFont, 0.022, 'normal', centerX, baseY + baseH * 0.85, 'center', '#181818ff');
    objects.push(title, sub, info);
}

// Add to canvas
if (objects.length > 0) {
    canvas.discardActiveObject();
    const addedObjs = [];
    objects.forEach(obj => {
        canvas.add(obj);
        addedObjs.push(obj);
    });
    const sel = new fabric.ActiveSelection(addedObjs, { canvas: canvas });
    canvas.setActiveObject(sel);
    canvas.requestRenderAll();
}
};



function setupStyleHandlers() {
    const alignLeft = document.getElementById("btnAlignLeftText");
    const alignCenter = document.getElementById("btnAlignCenterText");
    const alignRight = document.getElementById("btnAlignRightText");
    if(alignLeft) alignLeft.onclick = () => applyToSelection("textAlign", "left");
    if(alignCenter) alignCenter.onclick = () => applyToSelection("textAlign", "center");
    if(alignRight) alignRight.onclick = () => applyToSelection("textAlign", "right");

    const textSize = document.getElementById("textSize");
    const charSpacing = document.getElementById("textCharSpacing");
    const lineHeight = document.getElementById("textLineHeight");

    if (textSize) textSize.oninput = () => applyToSelection("fontSize", parseInt(textSize.value));
    if (charSpacing) charSpacing.oninput = () => applyToSelection("charSpacing", parseInt(charSpacing.value));
    if (lineHeight) lineHeight.oninput = () => applyToSelection("lineHeight", parseFloat(lineHeight.value));
}

// 공통 속성 적용 함수
function applyToSelection(prop, val) {
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.isEffectGroup) {
        // 효과 그룹인 경우 메인 텍스트만 변경하거나 전체 변경
        const mainText = active.getObjects().find(o => o.isMainText);
        if (prop === 'fill' && mainText) mainText.set('fill', val);
        else if ((prop === 'stroke' || prop === 'strokeWidth') && mainText) {
            mainText.set(prop, val);
        } else {
            active.getObjects().forEach(o => o.set(prop, val));
        }
        active.addWithUpdate();
    } else if (active.type === "activeSelection" || active.type === "group") {
        active.getObjects().forEach(obj => obj.set(prop, val));
    } else {
        active.set(prop, val);
    }
    canvas.requestRenderAll();
}

// ============================================================
// [4] 파워 텍스트 효과 (Text Effects)
// ============================================================
window.applyTextEffect = function(type) {
    const active = canvas.getActiveObject();
    // [수정] 다국어 적용
    if (!active) return alert(window.t('msg_select_text_font', "Please select a text object."));

    // 기존 효과 그룹 해제 후 원본 추출
    let originalText = active;
    if (active.type === 'group' && active.isEffectGroup) {
        const items = active.getObjects();
        const found = items.find(o => o.isMainText) || items[items.length - 1];
        
        found.clone((cloned) => {
            cloned.set({
                left: active.left, top: active.top, angle: active.angle, scaleX: active.scaleX, scaleY: active.scaleY,
                shadow: null, stroke: null, strokeWidth: 0, fill: found.fill || '#000000',
                selectable: true, evented: true, isClone: false, isMainText: true
            });
            canvas.remove(active);
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            window.applyTextEffect(type); // 재귀 호출
        });
        return;
    }

    if (!originalText.type.includes('text')) return alert(window.t('msg_text_only', "Text objects only."));

    const fontSize = originalText.fontSize * originalText.scaleY; 
    const strokeW = Math.max(2, fontSize * 0.05);
    const depth3D = Math.max(5, fontSize * 0.15);
    const originalColor = originalText.fill || '#000000';

    switch (type) {
        // Shadow
        case 'shadow-drop':
            originalText.set({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.4)', blur: fontSize * 0.15, offsetX: fontSize * 0.08, offsetY: fontSize * 0.08 }) });
            canvas.requestRenderAll(); break;
        case 'shadow-hard':
            originalText.set({ shadow: new fabric.Shadow({ color: '#000000', blur: 0, offsetX: fontSize * 0.06, offsetY: fontSize * 0.06 }) });
            canvas.requestRenderAll(); break;
        case 'long-shadow': createLongShadow(originalText, originalColor, '#000000', 500); break;
        case 'shadow-multi': createMultiShadowEffect(originalText); break;
        case 'shadow-lift':
            originalText.set({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: fontSize * 0.3, offsetX: 0, offsetY: fontSize * 0.2 }) });
            canvas.requestRenderAll(); break;

        // Outline
        case 'outline-thick':
            originalText.set({ stroke: '#000000', strokeWidth: Math.max(3, fontSize * 0.12), paintFirst: 'stroke', strokeLineJoin: 'round' });
            canvas.requestRenderAll(); break;
        case 'outline-white':
            originalText.set({ stroke: '#ffffff', strokeWidth: Math.max(2, fontSize * 0.1), paintFirst: 'stroke', strokeLineJoin: 'round', shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 8, offsetX: 0, offsetY: 2 }) });
            canvas.requestRenderAll(); break;
        case 'outline-double': createDoubleOutlineEffect(originalText, strokeW); break;
        case 'outline-color':
            originalText.set({ stroke: '#6366f1', strokeWidth: Math.max(2, fontSize * 0.08), paintFirst: 'stroke', strokeLineJoin: 'round' });
            canvas.requestRenderAll(); break;

        // 3D
        case 'block-3d': create3DEffect(originalText, '#4fffa5', '#000000', depth3D); break;
        case 'block-3d-blue': create3DEffect(originalText, '#38bdf8', '#1e3a8a', depth3D); break;
        case 'block-3d-red': create3DEffect(originalText, '#f87171', '#7f1d1d', depth3D); break;
        case 'block-3d-gold': create3DEffect(originalText, '#fbbf24', '#78350f', depth3D); break;

        // Neon
        case 'neon-strong': createNeonEffect(originalText, strokeW, '#7800ff', '#d300c5'); break;
        case 'neon-blue': createNeonEffect(originalText, strokeW, '#00d4ff', '#0066ff'); break;
        case 'neon-green': createNeonEffect(originalText, strokeW, '#00ff88', '#00cc44'); break;
        case 'neon-pink': createNeonEffect(originalText, strokeW, '#ff00aa', '#ff66cc'); break;

        // Pattern
        case 'retro-candy': createCandyEffect(originalText, '#ef4444', '#15803d'); break;
        case 'blue-candy': createCandyEffect(originalText, '#38bdf8', '#1e3a8a'); break;
        case 'candy-pink': createCandyEffect(originalText, '#ec4899', '#9d174d'); break;
        case 'candy-orange': createCandyEffect(originalText, '#f97316', '#7c2d12'); break;

        // Special
        case 'glitch-strong': createGlitchEffect(originalText); break;
        case 'vintage':
            originalText.set({ fill: '#8B4513', stroke: '#D2691E', strokeWidth: Math.max(1, fontSize * 0.03), paintFirst: 'stroke', shadow: new fabric.Shadow({ color: 'rgba(139,69,19,0.4)', blur: fontSize * 0.1, offsetX: 2, offsetY: 2 }) });
            canvas.requestRenderAll(); break;
        case 'comic':
            originalText.set({ fill: '#ffdd00', stroke: '#000000', strokeWidth: Math.max(3, fontSize * 0.1), paintFirst: 'stroke', strokeLineJoin: 'round', shadow: new fabric.Shadow({ color: '#000000', blur: 0, offsetX: fontSize * 0.08, offsetY: fontSize * 0.08 }) });
            canvas.requestRenderAll(); break;
        case 'emboss': createEmbossEffect(originalText); break;
        case 'gradient-purple': createGradientEffect(originalText, '#6366f1', '#ec4899'); break;
        case 'gradient-sunset': createGradientEffect(originalText, '#f97316', '#ef4444', '#ec4899'); break;
        case 'gradient-ocean': createGradientEffect(originalText, '#06b6d4', '#3b82f6', '#6366f1'); break;
        case 'gradient-gold': createGradientEffect(originalText, '#fbbf24', '#f59e0b', '#d97706'); break;

        case 'reset':
            originalText.set({ fill: '#000000', stroke: null, strokeWidth: 0, shadow: null, paintFirst: 'fill' });
            canvas.requestRenderAll();
            break;
    }
};

// 효과 구현 함수들
function create3DEffect(original, topColor, sideColor, depth) {
    const layers = [];
    const step = 1; 
    for (let i = 0; i < depth; i+=step) {
        original.clone((cloned) => {
            cloned.set({
                left: original.left + i, top: original.top + i,
                fill: sideColor, selectable: false, evented: false, isClone: true,
                stroke: null, strokeWidth: 0
            });
            layers.push(cloned);
            if (i >= depth - step) {
                original.set({ fill: topColor, isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            }
        });
    }
}

function createNeonEffect(original, strokeW, color1, color2) {
    color1 = color1 || '#7800ff';
    color2 = color2 || '#d300c5';
    const layers = [];
    original.clone((glow1) => {
        glow1.set({
            stroke: color1, strokeWidth: strokeW * 1.5, fill: 'transparent',
            shadow: new fabric.Shadow({ color: color1, blur: strokeW * 4, offsetX:0, offsetY:0 }),
            selectable: false, isClone: true
        });
        layers.push(glow1);
        original.clone((glow2) => {
            glow2.set({
                stroke: color2, strokeWidth: strokeW * 0.5, fill: 'transparent',
                shadow: new fabric.Shadow({ color: color2, blur: strokeW * 0.8, offsetX:0, offsetY:0 }),
                selectable: false, isClone: true
            });
            layers.push(glow2);
            original.set({ stroke: '#ffffff', strokeWidth: Math.max(1, strokeW * 0.1), fill: 'transparent', isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

function createGlitchEffect(original) {
    const layers = [];
    const offset = Math.max(3, original.fontSize * 0.03); 
    original.clone((red) => {
        red.set({ left: original.left - offset, top: original.top - offset, fill: 'red', opacity: 0.8, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
        layers.push(red);
        original.clone((cyan) => {
            cyan.set({ left: original.left + offset, top: original.top + offset, fill: 'cyan', opacity: 0.8, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
            layers.push(cyan);
            original.set({ fill: '#ffffff', stroke: null, strokeWidth: 0, isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

function createLongShadow(original, textColor, shadowColor, length) {
    const layers = [];
    const step = 2; 
    const count = Math.floor(length / step); 
    for(let i=1; i<=count; i++) {
        original.clone((s) => {
            s.set({ left: original.left + (i * step), top: original.top + (i * step), fill: shadowColor, stroke: null, strokeWidth: 0, shadow: null, selectable: false, evented: false, isClone: true });
            layers.push(s);
            if(i === count) {
                original.set({ fill: textColor, isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            }
        });
    }
}

function createCandyEffect(original, color1, color2) {
    const size = 60; 
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = size; patternCanvas.height = size;
    const ctx = patternCanvas.getContext('2d');
    ctx.fillStyle = color1; ctx.fillRect(0, 0, size, size);
    ctx.beginPath(); ctx.strokeStyle = color2; ctx.lineWidth = size / 2.2; ctx.lineCap = 'butt';
    ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size/2, size/2); ctx.lineTo(size/2, -size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2, size + size/2); ctx.lineTo(size + size/2, size/2); ctx.stroke();
    
    const candyPattern = new fabric.Pattern({ source: patternCanvas, repeat: 'repeat' });
    original.set({ fill: candyPattern, stroke: '#ffffff', strokeWidth: Math.max(3, original.fontSize * 0.04), paintFirst: 'stroke', isMainText: true });
    original.clone((shadow) => {
        shadow.set({ fill: '#000000', stroke: null, strokeWidth: 0, left: original.left + 5, top: original.top + 5, opacity: 0.25, isClone: true, selectable: false });
        groupAndRender([shadow, original]);
    });
}

function groupAndRender(items) {
    items.forEach(obj => canvas.remove(obj));
    const group = new fabric.Group(items, { canvas: canvas, isEffectGroup: true });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
}

// 다중 그림자 효과
function createMultiShadowEffect(original) {
    const layers = [];
    const offset = Math.max(3, original.fontSize * 0.05);
    original.clone((red) => {
        red.set({ left: original.left - offset * 1.5, top: original.top - offset, fill: '#ef4444', opacity: 0.7, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
        layers.push(red);
        original.clone((blue) => {
            blue.set({ left: original.left + offset * 1.5, top: original.top + offset, fill: '#3b82f6', opacity: 0.7, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
            layers.push(blue);
            original.clone((green) => {
                green.set({ left: original.left, top: original.top + offset * 2.5, fill: '#22c55e', opacity: 0.7, stroke: null, strokeWidth: 0, selectable: false, isClone: true });
                layers.push(green);
                original.set({ fill: '#ffffff', isMainText: true });
                layers.push(original);
                groupAndRender(layers);
            });
        });
    });
}

// 이중 외곽선 효과
function createDoubleOutlineEffect(original, strokeW) {
    const layers = [];
    original.clone((outer) => {
        outer.set({
            stroke: '#000000', strokeWidth: strokeW * 3, fill: 'transparent',
            paintFirst: 'stroke', strokeLineJoin: 'round',
            selectable: false, isClone: true
        });
        layers.push(outer);
        original.clone((inner) => {
            inner.set({
                stroke: '#6366f1', strokeWidth: strokeW * 1.5, fill: 'transparent',
                paintFirst: 'stroke', strokeLineJoin: 'round',
                selectable: false, isClone: true
            });
            layers.push(inner);
            original.set({ fill: '#ffffff', stroke: null, strokeWidth: 0, isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

// 엠보스 효과
function createEmbossEffect(original) {
    const layers = [];
    const offset = Math.max(1, original.fontSize * 0.02);
    original.clone((dark) => {
        dark.set({ left: original.left + offset, top: original.top + offset, fill: 'rgba(0,0,0,0.4)', stroke: null, strokeWidth: 0, selectable: false, isClone: true });
        layers.push(dark);
        original.clone((light) => {
            light.set({ left: original.left - offset, top: original.top - offset, fill: 'rgba(255,255,255,0.8)', stroke: null, strokeWidth: 0, selectable: false, isClone: true });
            layers.push(light);
            original.set({ fill: '#94a3b8', isMainText: true });
            layers.push(original);
            groupAndRender(layers);
        });
    });
}

// 그라데이션 효과
function createGradientEffect(original, color1, color2, color3) {
    const stops = [{ offset: 0, color: color1 }, { offset: 1, color: color2 }];
    if (color3) {
        stops[1].offset = 0.5;
        stops.push({ offset: 1, color: color3 });
    }
    const grad = new fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: original.width, y2: original.height },
        colorStops: stops
    });
    original.set({ fill: grad, stroke: null, strokeWidth: 0 });
    canvas.requestRenderAll();
}

// ============================================================
// [5] 캔바 스타일: 실시간 편집 (Advanced Editing)
// ============================================================
function initAdvancedEditing() {
    if (!canvas) return;
    canvas.on('mouse:dblclick', (e) => {
        const target = e.target;
        if (target && target.type === 'group' && target.isEffectGroup) {
            enableEffectEditing(target);
        }
    });
}

function enableEffectEditing(group) {
    const items = group.toActiveSelection(); 
    const objects = items.getObjects();
    const mainText = objects.find(o => o.isMainText);
    const clones = objects.filter(o => o !== mainText);

    if (!mainText) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
    }

    // 클론들은 잠시 숨기거나 투명하게
    clones.forEach(clone => {
        clone.set({ selectable: false, evented: false, opacity: clone.opacity * 0.5 });
    });

    canvas.discardActiveObject(); 
    canvas.setActiveObject(mainText); 
    mainText.enterEditing(); 
    mainText.selectAll(); 

    // 입력 동기화
    const syncHandler = () => {
        const content = mainText.text;
        clones.forEach(clone => clone.set('text', content));
        canvas.requestRenderAll();
    };
    mainText.on('changed', syncHandler);

    // 편집 종료 시 그룹 재구성
    mainText.on('editing:exited', () => {
        mainText.off('changed', syncHandler);
        clones.forEach(clone => clone.set({ opacity: clone.opacity / 0.5 })); 
        const allItems = [...clones, mainText];
        const newGroup = new fabric.Group(allItems, {
            isEffectGroup: true,
            selectionBackgroundColor: 'rgba(255,255,255,0)',
            originX: 'center', originY: 'center'
        });
        canvas.remove(mainText);
        clones.forEach(c => canvas.remove(c));
        canvas.add(newGroup);
        canvas.setActiveObject(newGroup);
        canvas.requestRenderAll();
    });
}


export function addToCenter(obj) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    
    // 1. 위치 설정 (대지 중앙)
    if (board) {
        obj.set({
            left: board.left + (board.width * board.scaleX) / 2,
            top: board.top + (board.height * board.scaleY) / 2,
            originX: "center", originY: "center",
        });
    } else {
        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        obj.set({
            left: (canvas.width / zoom) / 2 - (vpt[4] / zoom),
            top: (canvas.height / zoom) / 2 - (vpt[5] / zoom),
            originX: "center", originY: "center"
        });
    }
    
    // 2. 캔버스에 추가
    canvas.add(obj);

    // 3. ★ [핵심] 새로 추가된 객체(로고/텍스트)를 무조건 맨 위로 올림
    canvas.bringToFront(obj);

    // (주의: 가이드를 맨 위로 올리는 코드는 절대 넣지 마세요!)

    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
}

function initSelectionEffects() {
    canvas.on("selection:created", syncSelectionUI);
    canvas.on("selection:updated", syncSelectionUI);
    canvas.on("selection:cleared", () => {
        updateLockUI();
        const strokeInput = document.getElementById("globalStroke");
        if(strokeInput) strokeInput.value = 0;
    });
}

function syncSelectionUI() {
    updateLockUI();
    const active = canvas.getActiveObject();
    if (!active) return;
    
    let target = active;
    if (active.isOutlineGroup || active.isEffectGroup) {
        target = active.getObjects().find(o => o.isMainText) || active.getObjects()[0] || active;
    }
    
    const strokeInput = document.getElementById("globalStroke");
    if(strokeInput) strokeInput.value = target.strokeWidth || 0;
}

function initColorHandlers() {
    const fillColor = document.getElementById("fillColor");
    const strokeColor = document.getElementById("strokeColor");
    const strokeWidth = document.getElementById("globalStroke");
    const strokeMiter = document.getElementById("btnStrokeMiter");
    const strokeRound = document.getElementById("btnStrokeRound");

    const btnOutline = document.getElementById("btnOutline");
    if (btnOutline) {
        btnOutline.onclick = () => {
            const active = canvas.getActiveObject();
            // [수정] 다국어 적용
            if (!active) return alert(window.t('msg_select_obj_outline', "Please select an object to apply the outline."));

            const defaultColor = "#ff6060ff"; // 갈색 (SaddleBrown)
            const defaultWidth = 5;         // 중간 두께

            // 1. 객체에 속성 적용 (함수 재사용)
            applyToSelection("stroke", defaultColor);
            applyToSelection("strokeWidth", defaultWidth);
            
            // 텍스트의 경우 외곽선이 글자를 덮지 않도록 설정 (선택사항)
            applyToSelection("paintFirst", "stroke"); 

            // 2. UI(입력창) 상태 동기화
            if (strokeColor) strokeColor.value = defaultColor;
            if (strokeWidth) strokeWidth.value = defaultWidth;

            canvas.requestRenderAll();
        };
    }

    if (fillColor) fillColor.oninput = () => applyToSelection("fill", fillColor.value);
    if (strokeColor) strokeColor.oninput = () => applyToSelection("stroke", strokeColor.value);
    if (strokeWidth) strokeWidth.oninput = () => applyToSelection("strokeWidth", parseInt(strokeWidth.value, 10));
    
    if(strokeMiter) strokeMiter.onclick = () => applyToSelection("strokeLineJoin", "miter");
    if(strokeRound) strokeRound.onclick = () => applyToSelection("strokeLineJoin", "round");
}

function initLayerHandlers() {
    const actions = {
        'btnFront': 'bringToFront', 'btnBack': 'sendToBack',
        'btnForward': 'bringForward', 'btnBackward': 'sendBackwards'
    };
    Object.keys(actions).forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.onclick = () => {
            const o = canvas.getActiveObject();
            if(!o) return;
            canvas[actions[id]](o);
            if(actions[id] === 'sendToBack') {
                 const board = canvas.getObjects().find(o => o.isBoard);
                 if(board) canvas.sendToBack(board);
            }
            canvas.requestRenderAll();
        };
    });
}

function initShapeHandlers() {
    document.querySelectorAll(".shape-btn").forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.shape;
            const color = document.getElementById("fillColor")?.value || "#000000";
            let obj;
            const opt = { fill: color, strokeWidth: 0, originX: 'center', originY: 'center' };
            
            if(type === 'rect') obj = new fabric.Rect({...opt, width:100, height:100});
            else if(type === 'circle') obj = new fabric.Circle({...opt, radius:50});
            else if(type === 'triangle') obj = new fabric.Triangle({...opt, width:100, height:100});
            else if(type === 'star') obj = new fabric.Path('M 100 0 L 125 75 L 200 75 L 140 125 L 160 200 L 100 150 L 40 200 L 60 125 L 0 75 L 75 75 z', {...opt, scaleX:1, scaleY:1});
            else if(type === 'heart') obj = new fabric.Path('M 272 64 c -100 -100 -200 -50 -200 50 c 0 100 200 300 200 300 s 200 -200 200 -300 c 0 -100 -100 -150 -200 -50 z', {...opt, scaleX:0.3, scaleY:0.3});
            else if(type === 'arrow') obj = new fabric.Path('M 0 50 L 50 0 L 100 50 L 70 50 L 70 100 L 30 100 L 30 50 Z', {...opt, angle:90});
            else if(type === 'round') obj = new fabric.Rect({...opt, width:100, height:100, rx:20, ry:20});
            else if(type === 'line') obj = new fabric.Rect({...opt, width:200, height:5});
            
            if(obj) addToCenter(obj);
        };
    });
}

function initEditHandlers() {
    const btnCenterObject = document.getElementById("btnCenterObject");
    if (btnCenterObject) {
        btnCenterObject.onclick = () => {
            const active = canvas.getActiveObject();
            if (!active) return;
            const board = canvas.getObjects().find(o => o.isBoard);
            if (board) {
                const boardCenterX = board.left + (board.getScaledWidth() / 2);
                const boardCenterY = board.top + (board.getScaledHeight() / 2);
                active.set({ originX: 'center', originY: 'center', left: boardCenterX, top: boardCenterY });
                active.setCoords();
            } else {
                canvas.centerObject(active);
            }
            canvas.requestRenderAll();
        };
    }

    const opacityInput = document.getElementById("opacitySlider");
    if (opacityInput) {
        opacityInput.oninput = () => applyToSelection("opacity", parseInt(opacityInput.value, 10) / 100);
    }

    const btnDel = document.getElementById("btnDel");
    if (btnDel) {
        btnDel.onclick = () => {
            const o = canvas.getActiveObject();
            if (!o) return;
            if (o.type === "activeSelection") {
                o.getObjects().forEach(obj => canvas.remove(obj));
                canvas.discardActiveObject();
            } else {
                canvas.remove(o);
            }
            canvas.requestRenderAll();
        };
    }
}

function initRotationHandlers() {
    const btnLeft = document.getElementById("btnRotateLeft15");
    const btnRight = document.getElementById("btnRotateRight15");

    if (btnLeft) btnLeft.onclick = () => rotateActive(-15);
    if (btnRight) btnRight.onclick = () => rotateActive(15);
}

function rotateActive(angle) {
    const active = canvas.getActiveObject();
    if (!active) return;
    active.rotate((active.angle || 0) + angle);
    active.setCoords();
    canvas.requestRenderAll();
}

function initAlignHandlers() {
    const actions = {
        'btnAlignLeft': 'left', 'btnAlignCenterH': 'centerH', 'btnAlignRight': 'right',
        'btnAlignTop': 'top', 'btnAlignMiddle': 'centerV', 'btnAlignBottom': 'bottom'
    };
    Object.keys(actions).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.onclick = () => alignObjects(actions[btnId]);
    });
}

function alignObjects(direction) {
    const active = canvas.getActiveObject();
    // [수정] 다국어 적용
    if (!active) return alert(window.t('msg_select_obj_align', "Please select an object to align."));

    const processObj = (obj, bound) => {
        const w = obj.getScaledWidth();
        const h = obj.getScaledHeight();
        const halfW = w / 2;
        const halfH = h / 2;

        switch (direction) {
            case 'left': obj.set('left', obj.originX === 'center' ? bound.left + halfW : bound.left); break;
            case 'centerH': obj.set('left', obj.originX === 'center' ? bound.left + bound.width/2 : bound.left + bound.width/2 - halfW); break;
            case 'right': obj.set('left', obj.originX === 'center' ? bound.left + bound.width - halfW : bound.left + bound.width - w); break;
            case 'top': obj.set('top', obj.originY === 'center' ? bound.top + halfH : bound.top); break;
            case 'centerV': obj.set('top', obj.originY === 'center' ? bound.top + bound.height/2 : bound.top + bound.height/2 - halfH); break;
            case 'bottom': obj.set('top', obj.originY === 'center' ? bound.top + bound.height - halfH : bound.top + bound.height - h); break;
        }
        obj.setCoords();
    };

    if (active.type === 'activeSelection') {
        const bound = active.getBoundingRect();
        canvas.discardActiveObject();
        active.getObjects().forEach(o => processObj(o, bound));
        const sel = new fabric.ActiveSelection(active.getObjects(), { canvas: canvas });
        canvas.setActiveObject(sel);
    } else {
        const board = canvas.getObjects().find(o => o.isBoard);
        const bound = board ? board.getBoundingRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
        processObj(active, bound);
    }
    canvas.requestRenderAll();
}

// 모바일용 텍스트 에디터 관련 (유틸)
window.deleteMobileObject = function() {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
        canvas.remove(activeObj);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        window.closeMobileTextEditor();
    }
};

window.toggleMobilePanel = function(side) {
    const subPanel = document.getElementById('subPanel');
    const rightPanel = document.getElementById('rightStackPanel');
    if (side === 'left') {
        if (subPanel) subPanel.classList.toggle('open');
        if (rightPanel) rightPanel.classList.remove('open');
    } else if (side === 'right') {
        if (rightPanel) rightPanel.classList.toggle('open');
        if (subPanel) subPanel.classList.remove('open');
    }
};

// ============================================================
// [7] 로고 업로드 및 파일 핸들러
// ============================================================
window.uploadUserLogo = async () => {
    // 상단 import { currentUser } 사용
    if (!currentUser) return alert("Login is required for this feature.");
    
    const fileInput = document.getElementById('logoFileInput');
    const tagInput = document.getElementById('logoKeywordInput');
    const file = fileInput.files[0];
    const tags = tagInput.value;
    
    if (!file) return alert("Please select a file.");
    
    const btn = document.querySelector('#logoUploadModal .btn-round.primary');
    const oldText = btn.innerText;
    btn.innerText = "Uploading...";
    btn.disabled = true;
    
    try {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop(); 
        const safeFileName = `${timestamp}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
        const filePath = `user_uploads/${currentUser.id}/${safeFileName}`;
        
        const { error: uploadError } = await sb.storage.from('design').upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = sb.storage.from('design').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;
        
        const payload = {
            category: 'logo', tags: tags || 'User Upload', thumb_url: publicUrl, data_url: publicUrl,
            width: 1000, height: 1000, user_id: currentUser.id 
        };
        
        const { error: dbError } = await sb.from('library').insert(payload);
        if (dbError) throw dbError;
        
        alert(`✅ Upload Successful!`);
        window.resetUpload(); 
        document.getElementById('logoUploadModal').style.display = 'none';
    } catch (e) {
        console.error(e);
        alert(window.t('msg_upload_failed', "Upload failed: ") + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};

window.handleFileSelect = (input) => {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileNameNoExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const tagInput = document.getElementById('logoKeywordInput');
        if (tagInput && !tagInput.value) {
            tagInput.value = fileNameNoExt + " logo";
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('previewImage');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            const icon = document.querySelector('.upload-icon');
            const text = document.querySelector('.upload-text');
            const sub = document.querySelector('.upload-sub');
            const delBtn = document.getElementById('removeFileBtn');
            if(icon) icon.style.display = 'none';
            if(text) text.style.display = 'none';
            if(sub) sub.style.display = 'none';
            if(delBtn) delBtn.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
};

window.resetUpload = (e) => {
    if(e) e.stopPropagation();
    const input = document.getElementById('logoFileInput');
    if(input) input.value = '';
    const tagInput = document.getElementById('logoKeywordInput');
    if(tagInput) tagInput.value = '';
    const preview = document.getElementById('previewImage');
    if(preview) preview.style.display = 'none';
    const icon = document.querySelector('.upload-icon');
    const text = document.querySelector('.upload-text');
    const sub = document.querySelector('.upload-sub');
    const delBtn = document.getElementById('removeFileBtn');
    if(icon) icon.style.display = 'block';
    if(text) text.style.display = 'block';
    if(sub) sub.style.display = 'block';
    if(delBtn) delBtn.style.display = 'none';
};