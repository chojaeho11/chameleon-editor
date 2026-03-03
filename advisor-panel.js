// ============================================================
// advisor-panel.js — 카푸 AI 쇼핑 안내 + 상담사 연결 통합 패널
// 검색바 아래 대형 채팅창. AI + 인간 상담 통합
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
    kr: { title: '카푸', subtitle: '쇼핑을 안내해 드립니다', placeholder: '메시지를 입력하세요...', send: '전송', close: '닫기', editor: '에디터에서 디자인', cart: '장바구니', upload: '이미지 첨부', tooBig: '파일이 너무 큽니다 (최대 10MB). 더 큰 파일은 주문 시 업로드하거나 korea900@hanmail.net으로 보내주세요.', error: '멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 전문 상담사가 꼼꼼하게 확인하고 상담해 드리는게 좋습니다. 위의 🎧 상담사 연결 버튼을 눌러주세요! 제품 제작은 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요 😊', reset: '대화 초기화', consultant: '상담사 연결', selectMgr: '상담 매니저를 선택해주세요', selectSub: '선택하시면 바로 연결됩니다', mgrSuffix: ' 매니저', enterName: '상담사 연결을 위해 정보를 입력해주세요', namePh: '이름', phonePh: '연락처 (010-0000-0000)', nameBtn: '다음', nameErr: '이름을 입력해주세요', phoneErr: '연락처를 입력해주세요', connecting: '연결 요청!', pleaseWait: '잠시만 기다려주세요 😊', tipFile: '아래 📎 버튼으로 사진/파일도 보낼 수 있어요!', consulting: '상담 중', hqConsultant: '본사 상담사', waiting: '님 연결 대기 중...', connectErr: '연결 중 오류! 잠시 후 다시 시도해주세요.', endChat: '상담 종료', backToAi: '카푸 AI로 돌아가기' },
    ja: { title: 'カプ', subtitle: 'ショッピングをご案内します', placeholder: 'メッセージを入力...', send: '送信', close: '閉じる', editor: 'エディターでデザイン', cart: 'カートに入れる', upload: '画像添付', tooBig: 'ファイルが大きすぎます（最大10MB）。より大きいファイルはsupport@cafe0101.comへお送りください。', error: '素敵な作品を構想中ですね！✨ このような製品の制作は、専門の相談員が丁寧に確認・ご案内するのがベストです。上の🎧相談員接続ボタンを押してください！製品制作は相談員へ、出荷・制作状況の確認は本社相談員をお選びください 😊', reset: 'チャットリセット', consultant: '相談員に接続', selectMgr: '相談マネージャーを選択してください', selectSub: '選択するとすぐに接続されます', mgrSuffix: '', enterName: '接続のため情報を入力してください', namePh: 'お名前', phonePh: '電話番号', nameBtn: '次へ', nameErr: '名前を入力', phoneErr: '電話番号を入力', connecting: 'に接続リクエスト！', pleaseWait: '少々お待ちください 😊', tipFile: '下の📎ボタンで写真/ファイルも送れます！', consulting: '相談中', hqConsultant: '本社相談員', waiting: '様 接続待機中...', connectErr: '接続エラー！しばらくしてからお試しください。', endChat: '相談終了', backToAi: 'カプAIに戻る' },
    en: { title: 'Kapu', subtitle: 'Your shopping guide', placeholder: 'Type a message...', send: 'Send', close: 'Close', editor: 'Design in Editor', cart: 'Add to Cart', upload: 'Attach image', tooBig: 'File too large (max 10MB). For larger files, please email korea900as@gmail.com.', error: 'What an amazing project you have in mind! ✨ For this kind of product, our expert consultants can help you best. Please tap the 🎧 Connect Agent button above! For product inquiries, choose a consultant. For shipping/production status, choose HQ Consultant 😊', reset: 'Reset chat', consultant: 'Connect agent', selectMgr: 'Please select a consultant', selectSub: "You'll be connected right away", mgrSuffix: '', enterName: 'Please enter your info to connect', namePh: 'Name', phonePh: 'Phone number', nameBtn: 'Next', nameErr: 'Please enter your name', phoneErr: 'Please enter phone', connecting: ' - Connection requested!', pleaseWait: 'Please wait a moment 😊', tipFile: 'You can send photos/files using the 📎 button below!', consulting: 'In consultation', hqConsultant: 'HQ Consultant', waiting: ' connecting...', connectErr: 'Connection error! Please try again.', endChat: 'End chat', backToAi: 'Back to Kapu AI' },
};
function t(key) { const l = getLang(); return (T[l] && T[l][key]) || T['en'][key] || ''; }

let panelEl = null;
let chatArea = null;
let isProcessing = false;
let lastProducts = [];
let pendingImage = null;
let conversationHistory = [];

// ─── 상담사 연결 상태 ───
let liveMode = false;
let liveRoom = null;
let liveSub = null;
let customerName = '';
let customerPhone = '';

// ─── Supabase 클라이언트 ───
let _ownSb = null;
function getSb() {
    if (window.sb) return window.sb;
    if (!_ownSb && typeof window.supabase !== 'undefined') {
        try {
            _ownSb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
        } catch(e) {}
    }
    return _ownSb || null;
}

// ─── localStorage 영속성 ───
function chatKey() {
    const u = window.currentUser;
    return u ? 'kapu_chat_' + u.id : 'kapu_chat_guest';
}
function liveKey() {
    const u = window.currentUser;
    return u ? 'kapu_live_' + u.id : 'kapu_live_guest';
}

function saveChat() {
    try {
        localStorage.setItem(chatKey(), JSON.stringify({
            html: chatArea ? chatArea.innerHTML : '',
            history: conversationHistory,
            lastProducts
        }));
    } catch(e) {}
}

function saveLiveState() {
    if (!liveRoom) return;
    try {
        localStorage.setItem(liveKey(), JSON.stringify({
            room: { id: liveRoom.id, assigned_manager: liveRoom.assigned_manager, status: liveRoom.status },
            customerName, customerPhone
        }));
    } catch(e) {}
}

function loadChat() {
    try {
        const raw = localStorage.getItem(chatKey());
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (chatArea && data.html) {
            chatArea.innerHTML = data.html;
            // 제품 카드 이벤트 다시 바인딩
            rebindCardEvents();
        }
        conversationHistory = data.history || [];
        lastProducts = data.lastProducts || [];
        return true;
    } catch(e) { return false; }
}

function loadLiveState() {
    try {
        const raw = localStorage.getItem(liveKey());
        if (!raw) return null;
        return JSON.parse(raw);
    } catch(e) { return null; }
}

function clearChat() {
    conversationHistory = [];
    lastProducts = [];
    if (chatArea) chatArea.innerHTML = '';
    try { localStorage.removeItem(chatKey()); } catch(e) {}
    showWelcomeMessage();
}

const WELCOME = {
    kr: `어떤 제품을 찾으시나요? 🎨\n레퍼런스가 있으시면 이미지나 PDF로 올려주시면 견적을 내어드릴 수 있어요.\n아니면 끝말잇기 게임이나 오늘의 운세를 물어보셔도 좋아요 😄`,
    ja: `どんな商品をお探しですか？🎨\nリファレンスがあれば、画像やPDFをアップロードしていただければお見積りいたします。\nしりとりゲームや今日の占いもOKですよ 😄`,
    en: `What product are you looking for? 🎨\nIf you have a reference, upload an image or PDF and we can give you a quote.\nOr feel free to play a word game or ask about today's fortune 😄`,
};

function showWelcomeMessage() {
    if (!chatArea) return;
    const lang = getLang();
    const msg = WELCOME[lang] || WELCOME['en'];
    const formatted = msg.replace(/\n/g, '<br>');
    chatArea.insertAdjacentHTML('beforeend', `
        <div class="adv-row adv-row-ai">
            <div class="adv-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="adv-bubble adv-bubble-ai">${formatted}</div>
        </div>
    `);
    scrollChat();
}

function clearLiveState() {
    liveMode = false;
    liveRoom = null;
    customerName = '';
    customerPhone = '';
    if (liveSub) { liveSub.unsubscribe(); liveSub = null; }
    try { localStorage.removeItem(liveKey()); } catch(e) {}
    updateHeaderForAI();
}

// ─── 초기화 ───
export function initAdvisorPanel() {
    panelEl = document.getElementById('advisorPanel');
    if (!panelEl) return;

    window._startAdvisor = startAdvisor;

    // 전역 함수: 어디서든 카푸 패널 열기
    window.openAdvisorPanel = function() {
        openPanel();
        panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            const inp = document.getElementById('advInput');
            if (inp) inp.focus();
        }, 400);
    };

    // 우측 하단 챗봇 숨기기 (카푸로 통일)
    const chamTrigger = document.getElementById('cham-bot-trigger');
    const chamWindow = document.getElementById('cham-bot-window');
    if (chamTrigger) chamTrigger.style.display = 'none';
    if (chamWindow) chamWindow.style.display = 'none';

    ['btnAiAdvisor', 'btnAiAdvisor2', 'btnKapuGuide'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                openPanel();
                panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => {
                    const inp = document.getElementById('advInput');
                    if (inp) inp.focus();
                }, 400);
            });
        }
    });

    // 실시간 상담 복원 체크
    const liveData = loadLiveState();
    if (liveData && liveData.room) {
        restoreLiveSession(liveData);
    }

    console.log('✅ Advisor panel initialized (AI + consultant unified)');
}

// ─── 패널 열기 ───
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
            <div style="display:flex; align-items:center; gap:6px;">
                <button class="adv-header-btn" id="advConsultantBtn" title="${t('consultant')}">
                    <i class="fa-solid fa-headset"></i>
                </button>
                <button class="adv-header-btn" id="advResetBtn" title="${t('reset')}">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
                <button class="adv-panel-close" id="advCloseBtn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
        <div class="adv-chat-area" id="advChatArea"></div>
        <div class="adv-img-preview" id="advImgPreview" style="display:none">
            <img id="advImgThumb" src="" alt="">
            <span id="advImgName"></span>
            <button id="advImgRemove" class="adv-img-remove"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="adv-input-area">
            <input type="file" id="advFileInput" style="display:none">
            <button class="adv-upload-btn" id="advUploadBtn" title="${t('upload')}">
                <i class="fa-solid fa-image"></i>
            </button>
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

    // 초기화
    document.getElementById('advResetBtn').addEventListener('click', () => {
        if (liveMode) {
            endLiveSession();
        }
        clearChat();
        clearLiveState();
    });

    // 상담사 연결
    document.getElementById('advConsultantBtn').addEventListener('click', () => {
        if (liveMode) return; // 이미 상담 중
        startConsultantFlow();
    });

    // 전송
    document.getElementById('advSendBtn').addEventListener('click', sendFromInput);
    document.getElementById('advInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            sendFromInput();
        }
    });
    document.getElementById('advInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendFromInput();
        }
    });

    // 파일 업로드
    document.getElementById('advUploadBtn').addEventListener('click', () => {
        document.getElementById('advFileInput').click();
    });
    document.getElementById('advFileInput').addEventListener('change', handleFileSelect);
    document.getElementById('advImgRemove').addEventListener('click', clearPendingImage);

    // 저장된 대화 복원
    const restored = loadChat();
    if (restored) {
        scrollChat();
    } else {
        // 첫 방문: 기본 안내 메시지 표시
        showWelcomeMessage();
    }

    // 실시간 상담 복원 상태 반영
    if (liveMode && liveRoom) {
        updateHeaderForLive(liveRoom.assigned_manager || '');
    }
}

// ─── 헤더 업데이트 ───
function updateHeaderForAI() {
    const titleEl = panelEl?.querySelector('.adv-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')} <span class="adv-panel-sub">${t('subtitle')}</span>`;
    }
}
function updateHeaderForLive(managerName) {
    const titleEl = panelEl?.querySelector('.adv-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-headset" style="color:#4ade80;"></i> ${managerName}${t('mgrSuffix')} <span class="adv-panel-sub" style="color:#4ade80;">${t('consulting')}</span>`;
    }
}

function sendFromInput() {
    const input = document.getElementById('advInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val && !pendingImage) return;
    if (isProcessing && !liveMode) return;
    input.value = '';

    // 실시간 상담 모드
    if (liveMode) {
        sendLiveMessage(val);
        return;
    }

    const img = pendingImage;
    clearPendingImage();
    sendMessage(val, img);
}

// ─── 파일 선택 처리 ───
function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';

    // 실시간 상담 모드: 파일 직접 업로드 (용량 제한 없음)
    if (liveMode && liveRoom) {
        uploadLiveFile(file);
        return;
    }

    // AI 채팅 모드: 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
        addBubble(t('tooBig'), 'ai');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        const type = file.type || 'image/jpeg';
        pendingImage = { base64, type, name: file.name, previewUrl: dataUrl };
        showImagePreview();
    };
    reader.readAsDataURL(file);
}

function showImagePreview() {
    const preview = document.getElementById('advImgPreview');
    const thumb = document.getElementById('advImgThumb');
    const nameEl = document.getElementById('advImgName');
    if (!preview || !pendingImage) return;
    thumb.src = pendingImage.previewUrl;
    nameEl.textContent = pendingImage.name;
    preview.style.display = 'flex';
}

function clearPendingImage() {
    pendingImage = null;
    const preview = document.getElementById('advImgPreview');
    if (preview) preview.style.display = 'none';
    const thumb = document.getElementById('advImgThumb');
    if (thumb) thumb.src = '';
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
    panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── AI 메시지 전송 ───
async function sendMessage(text, imageData) {
    if (isProcessing) return;
    isProcessing = true;

    if (imageData) {
        addImageBubble(imageData.previewUrl, text);
    } else {
        addBubble(text, 'user');
    }

    conversationHistory.push({ role: 'user', content: text || '(image)' });

    const typingEl = addTyping();

    try {
        const payload = {
            message: text,
            lang: getLang(),
            conversation_history: conversationHistory.slice(-20)
        };
        if (imageData) {
            payload.image = imageData.base64;
            payload.image_type = imageData.type;
        }
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SUPA_KEY,
                'apikey': SUPA_KEY
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('API ' + res.status);
        const data = await res.json();

        typingEl.remove();

        const chatMsg = data.chat_message || data.summary || '';
        if (chatMsg) addBubble(chatMsg, 'ai');

        const products = data.products || [];
        conversationHistory.push({
            role: 'assistant',
            content: chatMsg,
            products: products.length > 0 ? products.map(p => ({ code: p.code, name: p.name })) : undefined
        });

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
    saveChat();
    scrollChat();

    const inp = document.getElementById('advInput');
    if (inp) inp.focus();
}

// ═══════════════════════════════════════
// 상담사 연결 기능
// ═══════════════════════════════════════

const DEFAULT_MANAGERS = {
    kr: [
        { name: '지숙', phone: '010-3455-1946' },
        { name: '은미', phone: '010-7793-5393' },
        { name: '성희', phone: '010-3490-3328' }
    ],
    ja: [{ name: '相談員 1' }, { name: '相談員 2' }, { name: '相談員 3' }],
    en: [{ name: 'Consultant 1' }, { name: 'Consultant 2' }, { name: 'Consultant 3' }]
};

function startConsultantFlow() {
    if (!chatArea) return;

    // 이름/연락처 입력 카드
    const card = document.createElement('div');
    card.className = 'adv-row adv-row-ai';
    card.innerHTML = `
        <div class="adv-avatar"><i class="fa-solid fa-headset"></i></div>
        <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe); border:1px solid #7dd3fc; border-radius:16px; padding:16px; max-width:85%;">
            <div style="text-align:center; margin-bottom:10px;">
                <div style="font-size:24px;">✨</div>
                <div style="font-weight:700; color:#0369a1; font-size:14px;">${t('enterName')}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <input id="advCustName" type="text" placeholder="${t('namePh')}" style="width:100%; padding:10px 14px; border:1.5px solid #7dd3fc; border-radius:10px; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box;">
                <input id="advCustPhone" type="tel" placeholder="${t('phonePh')}" style="width:100%; padding:10px 14px; border:1.5px solid #7dd3fc; border-radius:10px; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box;">
                <button id="advCustSubmit" style="background:#0284c7; color:#fff; border:none; padding:10px 16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:13px; width:100%;">${t('nameBtn')}</button>
            </div>
        </div>
    `;
    chatArea.appendChild(card);
    scrollChat();

    const nameInput = document.getElementById('advCustName');
    const phoneInput = document.getElementById('advCustPhone');
    const submitBtn = document.getElementById('advCustSubmit');
    if (nameInput) nameInput.focus();

    function onSubmit() {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        if (!name) { nameInput.style.borderColor = '#ef4444'; nameInput.placeholder = t('nameErr'); return; }
        if (!phone) { phoneInput.style.borderColor = '#ef4444'; phoneInput.placeholder = t('phoneErr'); return; }
        customerName = name;
        customerPhone = phone;
        card.remove();
        showManagerPicker();
    }
    submitBtn.addEventListener('click', onSubmit);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') onSubmit(); });
    phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') onSubmit(); });
}

function showManagerPicker() {
    if (!chatArea) return;
    const lang = getLang();
    const managers = [...(DEFAULT_MANAGERS[lang] || DEFAULT_MANAGERS['en'])];
    managers.push({ name: t('hqConsultant') });

    const wrap = document.createElement('div');
    wrap.className = 'adv-row adv-row-ai';
    let h = `<div class="adv-avatar"><i class="fa-solid fa-headset"></i></div>
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); border-radius:16px; padding:16px; color:#fff; max-width:85%; box-shadow:0 4px 15px rgba(102,126,234,0.3);">
        <div style="text-align:center; margin-bottom:12px;">
            <div style="font-size:28px; margin-bottom:4px;">👋</div>
            <div style="font-weight:700; font-size:15px;">${t('selectMgr')}</div>
            <div style="font-size:11px; opacity:0.8; margin-top:2px;">${t('selectSub')}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">`;

    managers.forEach((mgr) => {
        h += `<button class="adv-mgr-pick" data-name="${esc(mgr.name)}" style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); color:#fff; border:1px solid rgba(255,255,255,0.3); padding:12px 16px; border-radius:12px; cursor:pointer; font-size:14px; font-weight:600; display:flex; align-items:center; gap:10px; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
            <span style="background:rgba(255,255,255,0.2); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px;">🧑‍💼</span>
            <span style="flex:1; text-align:left;">${esc(mgr.name)}${t('mgrSuffix')}</span>
            <span style="font-size:18px;">→</span>
        </button>`;
    });
    h += `</div></div>`;
    wrap.innerHTML = h;
    chatArea.appendChild(wrap);
    scrollChat();

    wrap.querySelectorAll('.adv-mgr-pick').forEach(btn => {
        btn.addEventListener('click', () => {
            const mgrName = btn.getAttribute('data-name');
            wrap.remove();
            connectToManager(mgrName);
        });
    });
}

async function connectToManager(managerName) {
    const sb = getSb();
    if (!sb) {
        addBubble(t('connectErr'), 'ai');
        return;
    }

    // AI 대화 요약
    let summary = '';
    try {
        summary = conversationHistory.slice(-4).map(h =>
            (h.role === 'user' ? customerName + ': ' : 'AI: ') + String(h.content).substring(0, 80)
        ).join('\n');
    } catch(e) {}

    const dispName = customerName + (customerPhone ? ' | ' + customerPhone : '');

    try {
        const { data, error } = await sb.from('chat_rooms').insert({
            customer_name: dispName,
            assigned_manager: managerName,
            status: 'waiting',
            source: 'chatbot',
            ai_summary: summary,
            site_lang: getLang()
        }).select().single();

        if (error || !data) {
            console.error('chat_rooms INSERT error:', error);
            addBubble(t('connectErr'), 'ai');
            return;
        }

        liveRoom = data;
        liveMode = true;
        saveLiveState();
        updateHeaderForLive(managerName);

        // 연결 안내
        const notice = document.createElement('div');
        notice.style.padding = '4px 0';
        notice.innerHTML = `
            <div style="background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%); border-radius:16px; padding:16px; border:1px solid #6ee7b7;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <span style="background:#10b981; color:#fff; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px;">🔗</span>
                    <div><div style="font-weight:700; color:#065f46; font-size:14px;">${esc(managerName)}${t('connecting')}</div>
                    <div style="font-size:12px; color:#047857;">${t('pleaseWait')}</div></div>
                </div>
                <div style="background:rgba(255,255,255,0.6); border-radius:10px; padding:10px; font-size:12px; color:#065f46;">
                    💡 <b>Tip:</b> ${t('tipFile')}
                </div>
            </div>`;
        chatArea.appendChild(notice);
        scrollChat();
        saveChat();

        // Realtime 구독
        subscribeLive(liveRoom.id);

    } catch(err) {
        console.error('Connect error:', err);
        addBubble(t('connectErr'), 'ai');
    }
}

function subscribeLive(roomId) {
    const sb = getSb();
    if (!sb) return;
    if (liveSub) { liveSub.unsubscribe(); liveSub = null; }

    liveSub = sb.channel('kapu-room-' + roomId)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'chat_messages',
            filter: 'room_id=eq.' + roomId
        }, (payload) => {
            const m = payload.new;
            if (!m || m.sender_type === 'internal' || m.sender_type === 'admin_memo') return;

            if (m.sender_type === 'manager') {
                const mn = m.sender_name || (getLang() === 'ja' ? 'マネージャー' : getLang() === 'en' ? 'Manager' : '매니저');
                let html = `<div class="adv-row adv-row-ai">
                    <div class="adv-avatar" style="background:#10b981;"><i class="fa-solid fa-headset" style="color:#fff;"></i></div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:11px; color:#6366f1; font-weight:600; margin-bottom:2px;">💬 ${esc(mn)}</span>`;
                if (m.file_url) {
                    if (m.file_type && m.file_type.startsWith('image/'))
                        html += `<img src="${m.file_url}" style="max-width:220px;border-radius:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:4px;" onclick="window.open(this.src)">`;
                    else
                        html += `<a href="${m.file_url}" target="_blank" style="background:#f0f9ff;border:1px solid #7dd3fc;padding:8px 14px;border-radius:10px;color:#0284c7;text-decoration:none;font-size:13px;display:inline-block;margin-bottom:4px;">📎 ${esc(m.file_name || 'File')}</a>`;
                }
                if (m.message) {
                    const msgText = m.message.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#2563eb; text-decoration:underline;">$1</a>');
                    html += `<div class="adv-bubble adv-bubble-ai">${msgText}</div>`;
                }
                html += `</div></div>`;
                if (chatArea) chatArea.insertAdjacentHTML('beforeend', html);
                scrollChat();
                saveChat();
            } else if (m.sender_type === 'system') {
                if (chatArea) chatArea.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding:6px 0;"><div style="display:inline-block; background:linear-gradient(135deg,#f0fdf4,#dcfce7); border:1px solid #86efac; border-radius:20px; padding:6px 16px; font-size:12px; color:#065f46;">${m.message}</div></div>`);
                if (m.message && (m.message.includes('종료') || m.message.includes('closed') || m.message.includes('終了'))) {
                    endLiveSession();
                }
                scrollChat();
                saveChat();
            }
        }).subscribe();
}

function sendLiveMessage(text) {
    if (!text || !liveRoom) return;
    const sb = getSb();
    if (!sb) return;

    // 유저 말풍선
    addBubble(text, 'user');
    saveChat();

    sb.from('chat_messages').insert({
        room_id: liveRoom.id,
        sender_type: 'customer',
        sender_name: customerName || 'Customer',
        message: text
    }).then(r => {
        if (r.error) console.error('Live send error:', r.error);
    });

    const inp = document.getElementById('advInput');
    if (inp) inp.focus();
}

async function uploadLiveFile(file) {
    if (!liveRoom) return;
    const sb = getSb();
    if (!sb) return;

    // 업로드 중 표시
    addBubble('📎 ' + file.name + ' 업로드 중...', 'user');
    const uploadingEl = chatArea ? chatArea.lastElementChild : null;

    try {
        const ext = file.name.split('.').pop().toLowerCase();
        const safeName = Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + ext;
        const path = 'room-' + liveRoom.id + '/' + safeName;

        const up = await sb.storage.from('chat-files').upload(path, file, { upsert: true });
        if (up.error) {
            console.error('File upload error:', up.error);
            if (uploadingEl) uploadingEl.remove();
            addBubble('⚠️ 파일 업로드 실패: ' + (up.error.message || ''), 'user');
            return;
        }

        const url = sb.storage.from('chat-files').getPublicUrl(path).data.publicUrl;
        const ins = await sb.from('chat_messages').insert({
            room_id: liveRoom.id,
            sender_type: 'customer',
            sender_name: customerName || 'Customer',
            file_url: url,
            file_name: file.name,
            file_type: file.type,
            message: ''
        });

        if (ins.error) {
            console.error('Message insert error:', ins.error);
            if (uploadingEl) uploadingEl.remove();
            addBubble('⚠️ 메시지 전송 실패', 'user');
            return;
        }

        // 업로드 중 메시지 제거 후 결과 표시
        if (uploadingEl) uploadingEl.remove();

        if (file.type && file.type.startsWith('image/')) {
            if (chatArea) chatArea.insertAdjacentHTML('beforeend', `<div class="adv-row adv-row-user"><div class="adv-bubble adv-bubble-user adv-bubble-img"><img src="${url}" class="adv-chat-img" alt="uploaded" onclick="window.open(this.src)"></div></div>`);
        } else {
            addBubble('📎 ' + file.name + ' ✅', 'user');
        }
        saveChat();
        scrollChat();
        saveChat();
    } catch(err) {
        console.error('Upload error:', err);
        if (uploadingEl) uploadingEl.remove();
        addBubble('⚠️ 파일 업로드 중 오류 발생', 'user');
    }
}

function endLiveSession() {
    liveMode = false;
    if (liveSub) { liveSub.unsubscribe(); liveSub = null; }
    liveRoom = null;
    try { localStorage.removeItem(liveKey()); } catch(e) {}
    updateHeaderForAI();

    // "AI로 돌아가기" 안내
    if (chatArea) {
        chatArea.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding:8px 0;"><div style="display:inline-block; background:#f1f5f9; border-radius:20px; padding:6px 16px; font-size:12px; color:#64748b;"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:4px;"></i>${t('backToAi')}</div></div>`);
    }
    saveChat();
    scrollChat();
}

async function restoreLiveSession(data) {
    const sb = getSb();
    if (!sb) {
        // Supabase 아직 로드 안됨 → 재시도
        setTimeout(() => restoreLiveSession(data), 2000);
        return;
    }

    try {
        const { data: room, error } = await sb.from('chat_rooms').select('*').eq('id', data.room.id).single();
        if (error || !room || room.status === 'closed') {
            clearLiveState();
            return;
        }

        liveRoom = room;
        liveMode = true;
        customerName = data.customerName || '';
        customerPhone = data.customerPhone || '';

        // Realtime 구독
        subscribeLive(liveRoom.id);

        // 메시지 복원 (패널이 열릴 때 DB에서 로드)
        window._kapuRestoreLiveMessages = async function() {
            const { data: msgs } = await sb.from('chat_messages').select('*').eq('room_id', liveRoom.id)
                .neq('sender_type', 'internal').neq('sender_type', 'admin_memo')
                .order('created_at', { ascending: true }).limit(200);
            if (msgs && msgs.length > 0 && chatArea) {
                msgs.forEach(m => renderRestoredMsg(m));
                scrollChat();
                saveChat();
            }
        };

        console.log('♻️ Live session restored:', liveRoom.id);
    } catch(err) {
        console.error('Restore error:', err);
        clearLiveState();
    }
}

function renderRestoredMsg(m) {
    if (!chatArea) return;
    if (m.sender_type === 'customer') {
        if (m.file_url) {
            if (m.file_type && m.file_type.startsWith('image/'))
                chatArea.insertAdjacentHTML('beforeend', `<div class="adv-row adv-row-user"><div class="adv-bubble adv-bubble-user adv-bubble-img"><img src="${m.file_url}" class="adv-chat-img" onclick="window.open(this.src)"></div></div>`);
            else
                chatArea.insertAdjacentHTML('beforeend', `<div class="adv-row adv-row-user"><div class="adv-bubble adv-bubble-user">📎 ${esc(m.file_name || 'File')}</div></div>`);
        }
        if (m.message) addBubble(m.message, 'user');
    } else if (m.sender_type === 'manager') {
        const mn = m.sender_name || 'Manager';
        let html = `<div class="adv-row adv-row-ai"><div class="adv-avatar" style="background:#10b981;"><i class="fa-solid fa-headset" style="color:#fff;"></i></div><div style="display:flex;flex-direction:column;">
            <span style="font-size:11px; color:#6366f1; font-weight:600; margin-bottom:2px;">💬 ${esc(mn)}</span>`;
        if (m.file_url) {
            if (m.file_type && m.file_type.startsWith('image/'))
                html += `<img src="${m.file_url}" style="max-width:220px;border-radius:12px;cursor:pointer;" onclick="window.open(this.src)">`;
            else
                html += `<a href="${m.file_url}" target="_blank" style="background:#f0f9ff;border:1px solid #7dd3fc;padding:8px 14px;border-radius:10px;color:#0284c7;text-decoration:none;font-size:13px;">📎 ${esc(m.file_name || 'File')}</a>`;
        }
        if (m.message) {
            const msgText = m.message.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#2563eb;">$1</a>');
            html += `<div class="adv-bubble adv-bubble-ai">${msgText}</div>`;
        }
        html += `</div></div>`;
        chatArea.insertAdjacentHTML('beforeend', html);
    } else if (m.sender_type === 'system') {
        chatArea.insertAdjacentHTML('beforeend', `<div style="text-align:center; padding:6px 0;"><div style="display:inline-block; background:linear-gradient(135deg,#f0fdf4,#dcfce7); border:1px solid #86efac; border-radius:20px; padding:6px 16px; font-size:12px; color:#065f46;">${m.message}</div></div>`);
    }
}

// ─── 이미지 말풍선 ───
function addImageBubble(previewUrl, text) {
    if (!chatArea) return;
    const row = document.createElement('div');
    row.className = 'adv-row adv-row-user';
    row.innerHTML = `
        <div class="adv-bubble adv-bubble-user adv-bubble-img">
            <img src="${previewUrl}" class="adv-chat-img" alt="uploaded">
            ${text ? `<p style="margin:6px 0 0">${esc(text)}</p>` : ''}
        </div>
    `;
    chatArea.appendChild(row);
    scrollChat();
    return row;
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
// 제품별 선택된 옵션 저장
const selectedAddons = {};

function buildAddonHtml(rec, i) {
    if (!rec.addons || rec.addons.length === 0) return '';
    // 카테고리별 그룹핑
    const groups = {};
    rec.addons.forEach(a => {
        const cat = a.category || (getLang() === 'ja' ? 'オプション' : getLang() === 'en' ? 'Options' : '옵션');
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(a);
    });

    const optLabel = getLang() === 'ja' ? 'オプション選択' : getLang() === 'en' ? 'Select Options' : '옵션 선택';
    let html = `<div class="adv-addon-area" data-product-i="${i}">
        <div style="font-size:11px;font-weight:700;color:#6366f1;margin:8px 0 4px;"><i class="fa-solid fa-sliders"></i> ${optLabel}</div>`;

    for (const [catName, addons] of Object.entries(groups)) {
        html += `<div style="margin-bottom:6px;">
            <span style="font-size:10px;color:#94a3b8;font-weight:600;">${esc(catName)}</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;">`;
        addons.forEach(a => {
            html += `<button class="adv-addon-chip" data-addon-code="${esc(a.code)}" data-product-i="${i}"
                style="font-size:11px;padding:4px 10px;border-radius:16px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;transition:all .15s;white-space:nowrap;"
                title="${esc(a.name)} ${esc(a.price)}">
                ${esc(a.name)} <span style="color:#94a3b8;font-size:10px;">${esc(a.price)}</span>
            </button>`;
        });
        html += `</div></div>`;
    }
    html += `</div>`;
    return html;
}

function addProductCards(products) {
    if (!chatArea) return;
    const wrap = document.createElement('div');
    wrap.className = 'adv-cards-wrap';

    // 사이트 URL 결정
    const lang = getLang();
    const siteHost = lang === 'ja' ? 'https://cafe0101.com' : lang === 'en' ? 'https://cafe3355.com' : 'https://cafe2626.com';
    const detailLabel = lang === 'ja' ? '購入する' : lang === 'en' ? 'Buy Now' : '구매하러가기';

    products.forEach((rec, i) => {
        const card = document.createElement('div');
        card.className = 'adv-card';
        const thumbUrl = rec.img_url || '';
        const thumbHtml = thumbUrl ? `<img src="${esc(thumbUrl)}" class="adv-card-thumb" alt="${esc(rec.name)}" onerror="this.style.display='none'">` : '';
        const w = rec.recommended_width_mm || 0;
        const h = rec.recommended_height_mm || 0;
        const sizeText = (w > 0 && h > 0)
            ? `${w}\u00d7${h}mm`
            : (lang === 'ja' ? 'サイズ自由' : lang === 'en' ? 'Custom size' : '사이즈 자유');
        const addonHtml = buildAddonHtml(rec, i);
        const detailUrl = siteHost + '/?product=' + encodeURIComponent(rec.code);
        card.innerHTML = `
            ${thumbHtml}
            <div class="adv-card-top">
                <span class="adv-card-badge">${i + 1}</span>
                <span class="adv-card-name">${esc(rec.name)}</span>
            </div>
            <p class="adv-card-reason">${esc(rec.reason)}</p>
            <div class="adv-card-meta">
                <span><i class="fa-solid fa-ruler-combined"></i> ${sizeText}</span>
                ${rec.price_display ? `<span><i class="fa-solid fa-tag"></i> ${esc(rec.price_display)}</span>` : ''}
            </div>
            ${addonHtml}
            <div class="adv-card-btns">
                <a href="${detailUrl}" class="adv-btn-editor" style="text-decoration:none; text-align:center; flex:1;">
                    <i class="fa-solid fa-bag-shopping"></i> ${detailLabel}
                </a>
            </div>
        `;
        wrap.appendChild(card);
    });

    chatArea.appendChild(wrap);
    bindCardEvents(wrap, products);
    bindAddonEvents(wrap, products);

    scrollChat();
}

function bindCardEvents(wrap, products) {
    wrap.querySelectorAll('.adv-btn-editor').forEach(btn => {
        btn.addEventListener('click', () => openEditor(products[+btn.dataset.i]));
    });
    wrap.querySelectorAll('.adv-btn-cart').forEach(btn => {
        btn.addEventListener('click', () => addToCart(products[+btn.dataset.i], btn));
    });
}

function bindAddonEvents(wrap, products) {
    wrap.querySelectorAll('.adv-addon-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const code = chip.dataset.addonCode;
            const pi = chip.dataset.productI;
            const pCode = products[+pi]?.code || pi;
            if (!selectedAddons[pCode]) selectedAddons[pCode] = new Set();
            if (selectedAddons[pCode].has(code)) {
                selectedAddons[pCode].delete(code);
                chip.style.background = '#fff';
                chip.style.borderColor = '#e2e8f0';
                chip.style.color = '#475569';
            } else {
                selectedAddons[pCode].add(code);
                chip.style.background = '#6366f1';
                chip.style.borderColor = '#6366f1';
                chip.style.color = '#fff';
            }
        });
    });
}

function rebindCardEvents() {
    // 복원된 카드의 이벤트 재바인딩 (lastProducts 사용)
    if (!chatArea || lastProducts.length === 0) return;
    const wraps = chatArea.querySelectorAll('.adv-cards-wrap');
    wraps.forEach(wrap => {
        bindCardEvents(wrap, lastProducts);
        bindAddonEvents(wrap, lastProducts);
    });
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

    // 선택된 옵션 전달
    const addons = selectedAddons[rec.code];
    if (addons && addons.size > 0) {
        window.__advisorSelectedAddons = Array.from(addons);
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
        const addons = selectedAddons[rec.code];
        const addonArr = addons ? Array.from(addons) : [];
        addProductToCartDirectly({
            code: rec.code, name: rec.name, price: priceKRW,
            w_mm: rec.recommended_width_mm, h_mm: rec.recommended_height_mm,
            width_mm: rec.recommended_width_mm, height_mm: rec.recommended_height_mm,
            is_custom_size: rec.is_custom_size || false, img: null,
        }, 1, addonArr, {});
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
