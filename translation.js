import { SITE_CONFIG } from "./site-config.js";

// 전역 변수로 번역 데이터 저장 (다른 스크립트에서도 쓰기 위해)
window.translations = {};

export async function loadTranslations() {
    const lang = SITE_CONFIG.lang; // 'kr', 'jp', 'en' 중 하나
    
    console.log(`🌍 언어 설정 로딩: ${lang}`);

    try {
        // 1. 해당 언어의 JSON 파일 불러오기
        const response = await fetch(`./${lang}.json`);
        if (!response.ok) throw new Error("번역 파일을 찾을 수 없습니다.");
        
        const data = await response.json();
        window.translations = data; // 전역 변수에 저장

        // 2. HTML 태그 내용 교체 (data-i18n 속성)
        // 예: <span data-i18n="hero_title">...</span>
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (data[key]) {
                // 줄바꿈(<br>)이 포함될 수 있으므로 innerHTML 사용
                el.innerHTML = data[key];
            }
        });

        // 3. placeholder 교체 (input 태그 등)
        // 예: <input data-i18n-placeholder="search_placeholder">
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (data[key]) {
                el.placeholder = data[key];
            }
        });

        // 4. 페이지 타이틀 교체
        if (data['page_title']) {
            document.title = data['page_title'];
        }
        
        // 5. 통화 기호 등 스타일 업데이트 (필요시)
        document.body.setAttribute('data-lang', lang);

        console.log("✅ 번역 적용 완료");

    } catch (error) {
        console.error("번역 로딩 실패:", error);
        // 실패 시 기본 한글이 그대로 보임
    }
}