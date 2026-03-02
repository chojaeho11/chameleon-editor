// ============================================================
// advisor-panel.js — AI 카멜 인라인 채팅 패널
// 검색바 아래 대형 채팅창. 순수 AI 전용 (상담사 없음)
// ============================================================

import { SITE_CONFIG } from './site-config.js?v=123';

const SUPA_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const API_URL = SUPA_URL + '/functions/v1/product-advisor';

function getLang() {
    if (SITE_CONFIG.COUNTRY === 'JP') return 'ja';
    if (SITE_CONFIG.COUNTRY === 'US' || SITE_CONFIG.COUNTRY === 'EN') return 'en';
    return 'kr';
}

const T = {
    kr: { title: 'AI 카멜', subtitle: '무엇이든 물어보세요', placeholder: '메시지를 입력하세요...', send: '전송', close: '닫기', editor: '에디터에서 디자인', cart: '장바구니', error: '앗, 연결이 불안정해요 😅 잠시 후 다시 시도해주세요!' },
    ja: { title: 'AI カメル', subtitle: '何でもお聞きください', placeholder: 'メッセージを入力...', send: '送信', close: '閉じる', editor: 'エディターでデザイン', cart: 'カートに入れる', error: '接続が不安定です 😅 しばらくしてからお試しください！' },
    en: { title: 'AI Chamel', subtitle: 'Ask me anything', placeholder: 'Type a message...', send: 'Send', close: 'Close', editor: 'Design in Editor', cart: 'Add to Cart', error: 'Connection unstable 😅 Please try again!' },
};
function t(key) { const l = getLang(); return (T[l] && T[l][key]) || T['en'][key] || ''; }

let panelEl = null;
let chatArea = null;
let isProcessing = false;
let lastProducts = [];

// ─── 초기화 ───
export function initAdvisorPanel() {
    panelEl = document.getElementById('advisorPanel');
    if (!panelEl) return;

    // 전역 함수 등록 (index.html의 onkeydown에서 호출)
    window._startAdvisor = startAdvisor;

    // AI 추천 버튼
    const aiBtn = document.getElementById('btnAiAdvisor');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            const input = document.getElementById('startSearchInput');
            const val = input ? input.value.trim() : '';
            if (val) {
                input.value = '';
                startAdvisor(val);
            } else {
                openPanel();
                if (input) input.focus();
            }
        });
    }

    console.log('✅ Advisor panel initialized, window._startAdvisor ready');
}

// ─── 패널 열기 (빈 상태) ───
function openPanel() {
    if (!panelEl) return;
    if (panelEl.style.display === 'block') return;
    panelEl.style.display = 'block';
    buildPanelUI();
}

// ─── 패널 UI 생성 ───
function buildPanelUI() {
    panelEl.innerHTML = `
        <div class="adv-panel-header">
            <div class="adv-panel-title">
                <i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')}
                <span class="adv-panel-sub">${t('subtitle')}</span>
            </div>
            <button class="adv-panel-close" id="advCloseBtn">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div class="adv-chat-area" id="advChatArea"></div>
        <div class="adv-input-area">
            <input type="text" id="advInput" class="adv-input" placeholder="${t('placeholder')}" autocomplete="off">
            <button class="adv-send-btn" id="advSendBtn">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
        </div>
    `;
    chatArea = document.getElementById('advChatArea');

    // 닫기
    document.getElementById('advCloseBtn').addEventListener('click', () => {
        panelEl.style.display = 'none';
    });

    // 전송
    document.getElementById('advSendBtn').addEventListener('click', sendFromInput);
    document.getElementById('advInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            sendFromInput();
        }
    });
    // 한글 IME 완료 후 Enter 처리
    document.getElementById('advInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendFromInput();
        }
    });
}

function sendFromInput() {
    const input = document.getElementById('advInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val || isProcessing) return;
    input.value = '';
    sendMessage(val);
}

// ─── 외부 호출 (검색바 Enter) ───
function startAdvisor(query) {
    if (!query || !query.trim()) return;
    if (!panelEl) {
        panelEl = document.getElementById('advisorPanel');
        if (!panelEl) return;
    }
    panelEl.style.display = 'block';
    if (!chatArea) buildPanelUI();
    sendMessage(query.trim());

    // 패널로 스크롤
    panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── 메시지 전송 ───
async function sendMessage(text) {
    if (isProcessing) return;
    isProcessing = true;

    // 유저 메시지
    addBubble(text, 'user');

    // 타이핑 표시
    const typingEl = addTyping();

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPA_KEY,
                'apikey': SUPA_KEY
            },
            body: JSON.stringify({ message: text, lang: getLang() })
        });

        if (!res.ok) throw new Error('API ' + res.status);
        const data = await res.json();

        // 타이핑 제거
        typingEl.remove();

        // AI 응답
        const chatMsg = data.chat_message || data.summary || '';
        if (chatMsg) addBubble(chatMsg, 'ai');

        // 제품 카드
        const products = data.products || [];
        if (products.length > 0) {
            lastProducts = products;
            addProductCards(products);
        }

    } catch (err) {
        console.error('Advisor error:', err);
        typingEl.remove();
        addBubble(t('error'), 'ai');
    }

    isProcessing = false;
    scrollChat();

    // 입력창 포커스
    const inp = document.getElementById('advInput');
    if (inp) inp.focus();
}

// ─── 말풍선 추가 ───
function addBubble(text, who) {
    if (!chatArea) return;
    const row = document.createElement('div');
    row.className = 'adv-row adv-row-' + who;

    if (who === 'ai') {
        row.innerHTML = `
            <div class="adv-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="adv-bubble adv-bubble-ai">${formatMsg(text)}</div>
        `;
    } else {
        row.innerHTML = `<div class="adv-bubble adv-bubble-user">${esc(text)}</div>`;
    }
    chatArea.appendChild(row);
    scrollChat();
    return row;
}

// ─── 타이핑 표시 ───
function addTyping() {
    if (!chatArea) return document.createElement('div');
    const row = document.createElement('div');
    row.className = 'adv-row adv-row-ai';
    row.innerHTML = `
        <div class="adv-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="adv-bubble adv-bubble-ai adv-typing-bubble">
            <div class="adv-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    chatArea.appendChild(row);
    scrollChat();
    return row;
}

// ─── 제품 카드 ───
function addProductCards(products) {
    if (!chatArea) return;
    const wrap = document.createElement('div');
    wrap.className = 'adv-cards-wrap';

    products.forEach((rec, i) => {
        const card = document.createElement('div');
        card.className = 'adv-card';
        card.innerHTML = `
            <div class="adv-card-top">
                <span class="adv-card-badge">${i + 1}</span>
                <span class="adv-card-name">${esc(rec.name)}</span>
            </div>
            <p class="adv-card-reason">${esc(rec.reason)}</p>
            <div class="adv-card-meta">
                <span><i class="fa-solid fa-ruler-combined"></i> ${esc(String(rec.recommended_width_mm))}\u00d7${esc(String(rec.recommended_height_mm))}mm</span>
                ${rec.price_display ? `<span><i class="fa-solid fa-tag"></i> ${esc(rec.price_display)}</span>` : ''}
            </div>
            <div class="adv-card-btns">
                <button class="adv-btn-editor" data-i="${i}">
                    <i class="fa-solid fa-palette"></i> ${t('editor')}
                </button>
                <button class="adv-btn-cart" data-i="${i}">
                    <i class="fa-solid fa-cart-plus"></i> ${t('cart')}
                </button>
            </div>
        `;
        wrap.appendChild(card);
    });

    chatArea.appendChild(wrap);

    // 이벤트
    wrap.querySelectorAll('.adv-btn-editor').forEach(btn => {
        btn.addEventListener('click', () => openEditor(products[+btn.dataset.i]));
    });
    wrap.querySelectorAll('.adv-btn-cart').forEach(btn => {
        btn.addEventListener('click', () => addToCart(products[+btn.dataset.i], btn));
    });

    scrollChat();
}

// ─── 에디터 열기 ───
async function openEditor(rec) {
    if (!window.startEditorDirect) return;

    if (rec.code && String(rec.code).startsWith('hcl_')) {
        window.__letterSignMode = true;
        window.__letterSignData = { titleText: rec.design_title || '', bottomText: '', style: 'forest' };
    } else {
        window.__advisorDesignPending = { title: rec.design_title || '', keywords: rec.design_keywords || [], style: 'forest' };
    }

    if (panelEl) panelEl.style.display = 'none';
    await window.startEditorDirect(rec.code, rec.recommended_width_mm, rec.recommended_height_mm);
}

// ─── 장바구니 ───
async function addToCart(rec, btnEl) {
    try {
        const { addProductToCartDirectly } = await import('./order.js?v=123');
        let priceKRW = rec._raw_price_krw || 50000;
        if (rec.is_custom_size && rec._raw_per_sqm_krw && rec.recommended_width_mm > 0 && rec.recommended_height_mm > 0) {
            const area = (rec.recommended_width_mm / 1000) * (rec.recommended_height_mm / 1000);
            priceKRW = Math.round((area * rec._raw_per_sqm_krw) / 100) * 100;
            if (priceKRW <= 0) priceKRW = rec._raw_price_krw || 50000;
        }
        addProductToCartDirectly({
            code: rec.code, name: rec.name, price: priceKRW,
            w_mm: rec.recommended_width_mm, h_mm: rec.recommended_height_mm,
            width_mm: rec.recommended_width_mm, height_mm: rec.recommended_height_mm,
            is_custom_size: rec.is_custom_size || false, img: null,
        }, 1, [], {});
        if (btnEl) {
            btnEl.innerHTML = '<i class="fa-solid fa-check"></i> OK';
            btnEl.disabled = true;
            btnEl.style.background = '#ecfdf5';
            btnEl.style.color = '#059669';
            btnEl.style.borderColor = '#059669';
        }
        if (window.updateCartBadge) window.updateCartBadge();
    } catch (err) {
        console.error('Cart error:', err);
    }
}

// ─── 유틸 ───
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatMsg(msg) {
    if (!msg) return '';
    return esc(msg).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}
function scrollChat() {
    if (chatArea) {
        setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 50);
    }
}
