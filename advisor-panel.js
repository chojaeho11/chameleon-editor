// ============================================================
// advisor-panel.js — AI 제품 어드바이저 프론트엔드 모듈
// 메인 페이지 검색바와 연동, 자연어 → 제품 추천 → 에디터/장바구니
// ============================================================

import { SITE_CONFIG, convertCurrency } from './site-config.js?v=123';

const SUPABASE_FN_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/product-advisor';

const ADV_TEXTS = {
    kr: {
        title: 'AI 추천 결과',
        loading: '요청을 분석하고 최적의 제품을 찾고 있어요...',
        edit: '에디터에서 디자인 시작',
        cart: '바로 장바구니 담기',
        retry: '다시 추천받기',
        close: '닫기',
        error: '추천을 가져오지 못했습니다. 다시 시도해주세요.',
        size: '추천 사이즈',
        price: '예상 가격',
        loginNeeded: '에디터를 사용하려면 로그인이 필요합니다.',
    },
    ja: {
        title: 'AI推薦結果',
        loading: 'ご要望を分析し、最適な製品を探しています...',
        edit: 'エディターでデザイン開始',
        cart: 'カートに追加',
        retry: '再度推薦を受ける',
        close: '閉じる',
        error: '推薦を取得できませんでした。もう一度お試しください。',
        size: '推薦サイズ',
        price: '予想価格',
        loginNeeded: 'エディターを使用するにはログインが必要です。',
    },
    en: {
        title: 'AI Recommendations',
        loading: 'Analyzing your request and finding the best products...',
        edit: 'Start designing in editor',
        cart: 'Add to cart directly',
        retry: 'Get new recommendations',
        close: 'Close',
        error: 'Could not get recommendations. Please try again.',
        size: 'Recommended size',
        price: 'Estimated price',
        loginNeeded: 'Login is required to use the editor.',
    }
};

function t(key) {
    const lang = (SITE_CONFIG.COUNTRY === 'JP') ? 'ja' : (SITE_CONFIG.COUNTRY === 'US') ? 'en' : 'kr';
    return (ADV_TEXTS[lang] && ADV_TEXTS[lang][key]) || ADV_TEXTS['kr'][key] || key;
}

function getLang() {
    if (SITE_CONFIG.COUNTRY === 'JP') return 'ja';
    if (SITE_CONFIG.COUNTRY === 'US' || SITE_CONFIG.COUNTRY === 'EN') return 'en';
    return 'kr';
}

let panelEl = null;
let lastRecommendations = null;

// ─── 초기화 ───
export function initAdvisorPanel() {
    panelEl = document.getElementById('advisorPanel');
    if (!panelEl) return;

    // window 전역 함수 등록 (index.html Enter 핸들러에서 호출)
    window.__runAdvisor = runAdvisor;

    // AI 추천 버튼 이벤트
    const aiBtn = document.getElementById('btnAiAdvisor');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            const input = document.getElementById('startSearchInput');
            const query = input ? input.value.trim() : '';
            if (query.length >= 2) {
                runAdvisor(query);
            } else {
                input && input.focus();
            }
        });
    }
}

// ─── AI 추천 실행 ───
export async function runAdvisor(userMessage) {
    if (!panelEl) return;

    // 로딩 UI
    panelEl.style.display = 'block';
    panelEl.innerHTML = `
        <div class="advisor-header">
            <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')}</span>
            <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="advisor-loading">
            <div class="advisor-spinner"></div>
            <p>${t('loading')}</p>
        </div>
    `;

    try {
        const res = await fetch(SUPABASE_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage, lang: getLang() })
        });

        if (!res.ok) throw new Error('API ' + res.status);
        const data = await res.json();
        lastRecommendations = data;

        if (!data.products || data.products.length === 0) {
            panelEl.innerHTML = `
                <div class="advisor-header">
                    <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')}</span>
                    <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="advisor-empty">
                    <p>${data.summary || t('error')}</p>
                    <button class="advisor-retry-btn" onclick="document.getElementById('advisorPanel').style.display='none'">${t('close')}</button>
                </div>
            `;
            return;
        }

        renderRecommendations(data);

    } catch (err) {
        console.error('Advisor error:', err);
        panelEl.innerHTML = `
            <div class="advisor-header">
                <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')}</span>
                <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="advisor-empty">
                <p>${t('error')}</p>
                <button class="advisor-retry-btn" onclick="document.getElementById('advisorPanel').style.display='none'">${t('close')}</button>
            </div>
        `;
    }
}

// ─── 추천 카드 렌더링 ───
function renderRecommendations(data) {
    const cards = data.products.map((rec, i) => `
        <div class="advisor-card" data-idx="${i}">
            <div class="advisor-card-badge">${i + 1}</div>
            <h3 class="advisor-card-name">${escHtml(rec.name)}</h3>
            <p class="advisor-card-reason">${escHtml(rec.reason)}</p>
            <div class="advisor-card-info">
                <span><i class="fa-solid fa-ruler-combined"></i> ${t('size')}: ${rec.recommended_width_mm}×${rec.recommended_height_mm}mm</span>
                <span><i class="fa-solid fa-tag"></i> ${t('price')}: ${escHtml(rec.price_display || '—')}</span>
            </div>
            <div class="advisor-card-actions">
                <button class="advisor-btn-edit" data-idx="${i}">
                    <i class="fa-solid fa-palette"></i> ${t('edit')}
                </button>
                <button class="advisor-btn-cart" data-idx="${i}">
                    <i class="fa-solid fa-cart-plus"></i> ${t('cart')}
                </button>
            </div>
        </div>
    `).join('');

    panelEl.innerHTML = `
        <div class="advisor-header">
            <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')}</span>
            <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <p class="advisor-summary">${escHtml(data.summary || '')}</p>
        <div class="advisor-cards">${cards}</div>
    `;

    // 이벤트 바인딩
    panelEl.querySelectorAll('.advisor-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            openEditorWithDesign(data.products[idx]);
        });
    });
    panelEl.querySelectorAll('.advisor-btn-cart').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            addToCartDirect(data.products[idx]);
        });
    });
}

// ─── 에디터 열기 + 자동 디자인 ───
async function openEditorWithDesign(rec) {
    if (!window.startEditorDirect) return;

    // 글씨 스카시 제품 분기
    if (rec.code && rec.code.startsWith('hcl_')) {
        window.__letterSignMode = true;
        window.__letterSignData = {
            titleText: rec.design_title || '',
            bottomText: '',
            style: 'forest'
        };
    } else {
        // 일반 제품: advisor 디자인 플래그 설정
        window.__advisorDesignPending = {
            title: rec.design_title || '',
            keywords: rec.design_keywords || [],
            style: 'forest'
        };
    }

    // 패널 닫기
    if (panelEl) panelEl.style.display = 'none';

    // 에디터 오픈
    await window.startEditorDirect(
        rec.code,
        rec.recommended_width_mm,
        rec.recommended_height_mm
    );
}

// ─── 장바구니 직접 담기 ───
async function addToCartDirect(rec) {
    try {
        const { addProductToCartDirectly } = await import('./order.js?v=123');

        // 가격 계산 (KRW 기준)
        let priceKRW = rec._raw_price_krw || 50000;
        if (rec.is_custom_size && rec._raw_per_sqm_krw) {
            const area = (rec.recommended_width_mm / 1000) * (rec.recommended_height_mm / 1000);
            priceKRW = Math.round((area * rec._raw_per_sqm_krw) / 100) * 100;
        }

        const productInfo = {
            code: rec.code,
            name: rec.name,
            price: priceKRW,
            w_mm: rec.recommended_width_mm,
            h_mm: rec.recommended_height_mm,
            width_mm: rec.recommended_width_mm,
            height_mm: rec.recommended_height_mm,
            is_custom_size: rec.is_custom_size || false,
            img: null,
        };

        addProductToCartDirectly(productInfo, 1, [], {});

        // 시각적 피드백
        const btn = panelEl.querySelector(`.advisor-btn-cart[data-idx]`);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> OK';
            btn.disabled = true;
        }

        // 카트 아이콘 업데이트
        if (window.updateCartBadge) window.updateCartBadge();

    } catch (err) {
        console.error('Add to cart error:', err);
        alert(t('error'));
    }
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
