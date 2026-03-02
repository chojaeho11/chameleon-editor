// ============================================================
// advisor-panel.js — AI 어드바이저 (대화형 + 제품 추천)
// 검색바 Enter → AI 응답 (대화 or 추천 카드)
// ============================================================

import { SITE_CONFIG } from './site-config.js?v=123';

const SUPABASE_FN_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/functions/v1/product-advisor';

function getLang() {
    if (SITE_CONFIG.COUNTRY === 'JP') return 'ja';
    if (SITE_CONFIG.COUNTRY === 'US' || SITE_CONFIG.COUNTRY === 'EN') return 'en';
    return 'kr';
}

let panelEl = null;

// ─── 초기화 ───
export function initAdvisorPanel() {
    panelEl = document.getElementById('advisorPanel');
    if (!panelEl) return;
    window.__runAdvisor = runAdvisor;

    const aiBtn = document.getElementById('btnAiAdvisor');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            const input = document.getElementById('startSearchInput');
            const query = input ? input.value.trim() : '';
            if (query.length >= 1) {
                runAdvisor(query);
            } else {
                input && input.focus();
            }
        });
    }
}

// ─── AI 실행 ───
export async function runAdvisor(userMessage) {
    if (!panelEl) {
        panelEl = document.getElementById('advisorPanel');
        if (!panelEl) return;
    }

    // 로딩 UI
    panelEl.style.display = 'block';
    panelEl.innerHTML = `
        <div class="advisor-header">
            <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 카멜</span>
            <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="adv-chat">
            <div class="adv-bubble adv-user">${esc(userMessage)}</div>
            <div class="adv-bubble adv-ai adv-typing">
                <div class="adv-dots"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    panelEl.scrollTop = panelEl.scrollHeight;

    try {
        const res = await fetch(SUPABASE_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage, lang: getLang() })
        });

        if (!res.ok) throw new Error('API ' + res.status);
        const data = await res.json();

        renderResponse(userMessage, data);

    } catch (err) {
        console.error('Advisor error:', err);
        renderResponse(userMessage, {
            type: 'chat',
            chat_message: '앗, 연결이 불안정해요 😅 잠시 후 다시 시도해주세요!',
            products: []
        });
    }
}

// ─── 응답 렌더링 (대화 + 추천 카드) ───
function renderResponse(userMsg, data) {
    const chatMsg = data.chat_message || data.summary || '';
    const products = data.products || [];
    const hasProducts = products.length > 0;

    // 카드 HTML
    let cardsHtml = '';
    if (hasProducts) {
        cardsHtml = '<div class="advisor-cards">' + products.map((rec, i) => `
            <div class="advisor-card" data-idx="${i}">
                <div class="advisor-card-badge">${i + 1}</div>
                <h3 class="advisor-card-name">${esc(rec.name)}</h3>
                <p class="advisor-card-reason">${esc(rec.reason)}</p>
                <div class="advisor-card-info">
                    <span><i class="fa-solid fa-ruler-combined"></i> ${rec.recommended_width_mm}×${rec.recommended_height_mm}mm</span>
                    <span><i class="fa-solid fa-tag"></i> ${esc(rec.price_display || '')}</span>
                </div>
                <div class="advisor-card-actions">
                    <button class="advisor-btn-edit" data-idx="${i}">
                        <i class="fa-solid fa-palette"></i> 에디터에서 디자인
                    </button>
                    <button class="advisor-btn-cart" data-idx="${i}">
                        <i class="fa-solid fa-cart-plus"></i> 장바구니
                    </button>
                </div>
            </div>
        `).join('') + '</div>';
    }

    panelEl.innerHTML = `
        <div class="advisor-header">
            <span class="advisor-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 카멜</span>
            <button class="advisor-close" onclick="document.getElementById('advisorPanel').style.display='none'">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="adv-chat">
            <div class="adv-bubble adv-user">${esc(userMsg)}</div>
            <div class="adv-bubble adv-ai">${formatMsg(chatMsg)}</div>
        </div>
        ${cardsHtml}
    `;

    // 이벤트 바인딩
    if (hasProducts) {
        panelEl.querySelectorAll('.advisor-btn-edit').forEach(btn => {
            btn.addEventListener('click', () => openEditorWithDesign(products[parseInt(btn.dataset.idx)]));
        });
        panelEl.querySelectorAll('.advisor-btn-cart').forEach(btn => {
            btn.addEventListener('click', () => addToCartDirect(products[parseInt(btn.dataset.idx)], btn));
        });
    }

    panelEl.scrollTop = panelEl.scrollHeight;
}

// ─── 에디터 열기 ───
async function openEditorWithDesign(rec) {
    if (!window.startEditorDirect) return;

    if (rec.code && rec.code.startsWith('hcl_')) {
        window.__letterSignMode = true;
        window.__letterSignData = { titleText: rec.design_title || '', bottomText: '', style: 'forest' };
    } else {
        window.__advisorDesignPending = { title: rec.design_title || '', keywords: rec.design_keywords || [], style: 'forest' };
    }

    if (panelEl) panelEl.style.display = 'none';
    await window.startEditorDirect(rec.code, rec.recommended_width_mm, rec.recommended_height_mm);
}

// ─── 장바구니 ───
async function addToCartDirect(rec, btnEl) {
    try {
        const { addProductToCartDirectly } = await import('./order.js?v=123');
        let priceKRW = rec._raw_price_krw || 50000;
        if (rec.is_custom_size && rec._raw_per_sqm_krw) {
            const area = (rec.recommended_width_mm / 1000) * (rec.recommended_height_mm / 1000);
            priceKRW = Math.round((area * rec._raw_per_sqm_krw) / 100) * 100;
        }
        addProductToCartDirectly({
            code: rec.code, name: rec.name, price: priceKRW,
            w_mm: rec.recommended_width_mm, h_mm: rec.recommended_height_mm,
            width_mm: rec.recommended_width_mm, height_mm: rec.recommended_height_mm,
            is_custom_size: rec.is_custom_size || false, img: null,
        }, 1, [], {});
        if (btnEl) { btnEl.innerHTML = '<i class="fa-solid fa-check"></i> OK'; btnEl.disabled = true; }
        if (window.updateCartBadge) window.updateCartBadge();
    } catch (err) {
        console.error('Cart error:', err);
    }
}

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMsg(msg) {
    if (!msg) return '';
    // 마크다운 링크 → HTML, 줄바꿈 → <br>
    return esc(msg)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
