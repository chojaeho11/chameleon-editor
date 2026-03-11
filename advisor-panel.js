// ============================================================
// advisor-panel.js — 카프 AI 쇼핑 안내 + 상담사 연결 통합 패널
// 검색바 아래 대형 채팅창. AI + 인간 상담 통합
// ============================================================

import { SITE_CONFIG } from './site-config.js?v=138';

const SUPA_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const API_URL = SUPA_URL + '/functions/v1/product-advisor';

function getLang() {
    const cc = (window.SITE_CONFIG && SITE_CONFIG.COUNTRY) || '';
    if (cc === 'JP') return 'ja';
    if (cc === 'US' || cc === 'EN' || cc === 'CN' || cc === 'ZH' || cc === 'AR' || cc === 'ES' || cc === 'DE' || cc === 'FR') return 'en';
    return 'kr';
}

const T = {
    kr: { title: '카프', subtitle: '쇼핑을 안내해 드립니다', studio: '작품만들기', placeholder: '메시지를 입력하세요...', send: '전송', close: '닫기', editor: '에디터에서 디자인', cart: '장바구니', upload: '이미지 첨부', tooBig: '파일이 너무 큽니다 (최대 10MB). 더 큰 파일은 주문 시 업로드하거나 korea900@hanmail.net으로 보내주세요.', error: '멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 전문 상담사가 꼼꼼하게 확인하고 상담해 드리는게 좋습니다. 위의 🎧 상담사 연결 버튼을 눌러주세요! 제품 제작은 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요 😊', reset: '대화 초기화', consultant: '상담사 연결', selectMgr: '상담 매니저를 선택해주세요', selectSub: '선택하시면 바로 연결됩니다', mgrSuffix: ' 매니저', enterName: '상담사 연결을 위해 정보를 입력해주세요', namePh: '이름', phonePh: '연락처 (010-0000-0000)', nameBtn: '다음', nameErr: '이름을 입력해주세요', phoneErr: '연락처를 입력해주세요', connecting: '연결 요청!', pleaseWait: '잠시만 기다려주세요 😊', tipFile: '아래 📎 버튼으로 사진/파일도 보낼 수 있어요!', consulting: '상담 중', hqConsultant: '본사 상담사', waiting: '님 연결 대기 중...', connectErr: '연결 중 오류! 잠시 후 다시 시도해주세요.', endChat: '상담 종료', backToAi: '카프 AI로 돌아가기' },
    ja: { title: 'カプ', subtitle: 'ショッピングをご案内します', studio: '作品作り', placeholder: 'メッセージを入力...', send: '送信', close: '閉じる', editor: 'エディターでデザイン', cart: 'カートに入れる', upload: '画像添付', tooBig: 'ファイルが大きすぎます（最大10MB）。より大きいファイルはsupport@cafe0101.comへお送りください。', error: '素敵な作品を構想中ですね！✨ このような製品の制作は、専門の担当者が丁寧に確認・ご案内するのがベストです。上の🎧担当者接続ボタンを押してください！製品制作は担当者へ、出荷・制作状況の確認は本社担当者をお選びください 😊', reset: 'チャットリセット', consultant: '担当者に接続', selectMgr: '相談マネージャーを選択してください', selectSub: '選択するとすぐに接続されます', mgrSuffix: '', enterName: '接続のため情報を入力してください', namePh: 'お名前', phonePh: '電話番号', nameBtn: '次へ', nameErr: '名前を入力', phoneErr: '電話番号を入力', connecting: 'に接続リクエスト！', pleaseWait: '少々お待ちください 😊', tipFile: '下の📎ボタンで写真/ファイルも送れます！', consulting: '相談中', hqConsultant: '本社担当者', waiting: '様 接続待機中...', connectErr: '接続エラー！しばらくしてからお試しください。', endChat: '相談終了', backToAi: 'カプAIに戻る' },
    en: { title: 'Kapu', subtitle: 'Your shopping guide', studio: 'Create Art', placeholder: 'Type a message...', send: 'Send', close: 'Close', editor: 'Design in Editor', cart: 'Add to Cart', upload: 'Attach image', tooBig: 'File too large (max 10MB). For larger files, please email support@cafe3355.com.', error: 'What an amazing project you have in mind! ✨ For this kind of product, our expert consultants can help you best. Please tap the 🎧 Connect Agent button above! For product inquiries, choose a consultant. For shipping/production status, choose HQ Consultant 😊', reset: 'Reset chat', consultant: 'Connect agent', selectMgr: 'Please select a consultant', selectSub: "You'll be connected right away", mgrSuffix: '', enterName: 'Please enter your info to connect', namePh: 'Name', phonePh: 'Phone number', nameBtn: 'Next', nameErr: 'Please enter your name', phoneErr: 'Please enter phone', connecting: ' - Connection requested!', pleaseWait: 'Please wait a moment 😊', tipFile: 'You can send photos/files using the 📎 button below!', consulting: 'In consultation', hqConsultant: 'HQ Consultant', waiting: ' connecting...', connectErr: 'Connection error! Please try again.', endChat: 'End chat', backToAi: 'Back to Kapu AI' },
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

// ─── localStorage 영속성 (로그인 상태 무관하게 단일 키 사용) ───
function chatKey() { return 'kapu_chat_current'; }
function liveKey() { return 'kapu_live_current'; }

function saveChat() {
    try {
        sessionStorage.setItem(chatKey(), JSON.stringify({
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
        const raw = sessionStorage.getItem(chatKey());
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (chatArea && data.html) {
            chatArea.innerHTML = data.html;
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
    try { sessionStorage.removeItem(chatKey()); } catch(e) {}
    // 이전 localStorage 데이터도 정리
    try { localStorage.removeItem(chatKey()); localStorage.removeItem('kapu_chat_guest'); } catch(e) {}
    showWelcomeMessage();
}

const WELCOME = {
    kr: `어떤걸 만들지 고민하셨다면 알려주세요 🎨\n참고할만한 사진이 있으시면 올려주셔도 좋아요.\n"친구 결혼식인데 10만원 정도로 할 수 있는 기분 좋을만한 이벤트를 준비해줘" 라고 얘기하셔도 좋습니다.\n예산에 맞는 멋진 아이템을 추천해드릴게요 😊`,
    ja: `何をお作りになりたいかお悩みでしたら、お聞かせください 🎨\n参考になる写真があればアップロードしていただいても構いません。\n「友人の結婚式で5万円くらいで素敵なイベントを準備したい」とお話しいただいてもOKです。\nご予算に合った素敵なアイテムをご提案します 😊`,
    en: `Tell us what you'd like to create 🎨\nFeel free to upload a reference photo if you have one.\nYou can even say "I want to prepare a nice surprise for my friend's wedding with a $100 budget" — we'll recommend the perfect items.\nLet us help you find something amazing within your budget 😊`,
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

    // 전역 함수: 어디서든 카프 패널 열기
    window.openAdvisorPanel = function() {
        openPanel();
        panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
            const inp = document.getElementById('advInput');
            if (inp) inp.focus();
        }, 400);
    };

    // 우측 하단 챗봇 숨기기 (카프로 통일)
    const chamTrigger = document.getElementById('cham-bot-trigger');
    const chamWindow = document.getElementById('cham-bot-window');
    if (chamTrigger) chamTrigger.style.display = 'none';
    if (chamWindow) chamWindow.style.display = 'none';

    ['btnAiAdvisor', 'btnAiAdvisor2', 'btnChatbotOpen'].forEach(id => {
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

    // 홈 진입 시 자동으로 채팅 패널 열기
    setTimeout(() => {
        const isHome = !document.getElementById('editorWrap') || document.getElementById('editorWrap').style.display === 'none' || document.getElementById('editorWrap').style.display === '';
        if (isHome && panelEl && panelEl.style.display !== 'block') {
            openPanel();
        }
    }, 800);

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
                <button class="adv-studio-btn" id="advStudioBtn">🎨 ${t('studio')}</button>
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

    // 포토스튜디오 버튼
    document.getElementById('advStudioBtn')?.addEventListener('click', () => enterStudioMode());
}

// ─── 헤더 업데이트 ───
function updateHeaderForAI() {
    const titleEl = panelEl?.querySelector('.adv-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')} <button class="adv-studio-btn" id="advStudioBtn">🎨 ${t('studio')}</button>`;
        document.getElementById('advStudioBtn')?.addEventListener('click', () => enterStudioMode());
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

    // ★ 사용자가 상담사 연결 키워드를 직접 입력하면 AI 호출 없이 바로 상담사 폼
    if (text && !imageData && !liveMode) {
        const _userLower = text.toLowerCase();
        const _directConsultKeys = ['상담사 연결','상담사연결','상담사 요청','상담사요청','매니저 연결','매니저연결','인간 상담','인간상담','사람 연결','사람연결','상담원 연결','상담원연결','상담사','매니저','상담원',
            '担当者','担当者接続','マネージャー','consultant','connect agent','human agent','talk to human','real person','manager'];
        if (_directConsultKeys.some(k => _userLower.includes(k))) {
            addBubble(text, 'user');
            startConsultantFlow();
            return;
        }
    }

    isProcessing = true;

    if (imageData) {
        addImageBubble(imageData.previewUrl, text);
    } else {
        addBubble(text, 'user');
    }

    conversationHistory.push({ role: 'user', content: text || '(image)' });

    const typingEl = addTyping();

    try {
        const sysHint = {
            role: 'system',
            content: `[제품 추천 가이드]
선물/이벤트 관련 질문 시 다음 제품을 우선 추천:
- 허니콤보드: 행사장/팝업스토어/포토존용. 등신대, 배너, 포토존 세트 등에 적합. 단, 가구/인테리어용으로는 비추천(습기에 약하고 무거우면 변형됨). 선물 추천 시에는 등신대/배너/포토존 용도로만 추천할 것.
- 캔버스액자: 의미있는 사진이나 그림을 캔버스에 인쇄. 인테리어 소품이자 특별한 선물. 집에 걸어두기 좋음.
- 패브릭포스터: 의미있는 그림이나 사진을 원단에 인쇄. 감성적인 분위기 연출. 가볍고 보관 쉬움.
- 포토북: 추억이 담긴 사진 모음집. 여행/커플/가족 선물로 인기.
- 머그컵/텀블러: 사진이나 메시지를 넣은 실용적인 선물.
- 폰케이스: 커플 사진이나 특별한 디자인의 실용적 선물.
예산별 추천: ~3만원(머그컵/폰케이스), ~5만원(캔버스액자/패브릭포스터), ~10만원(등신대/포토북세트), 10만원+(등신대+캔버스액자 세트)
결혼식 이벤트면 "허니콤보드 등신대를 포토존으로 세워두면 하객들이 재미있어하는 이벤트가 됩니다"라고 적극 추천. 집에 두는 선물이면 캔버스액자나 패브릭포스터를 추천.
[중요] 응답 시 항상 관련 제품 3개를 추천하라. 단순 인사나 잡담이 아닌 이상, 제품 카드 3개를 반드시 포함할 것. 사용자가 구체적 제품을 물어도 해당 제품 + 관련 제품 2개를 함께 추천.`
        };
        const payload = {
            message: text,
            lang: getLang(),
            conversation_history: [sysHint, ...conversationHistory.slice(-20)]
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

        // ★ 상담사 연결 키워드 감지 — 사용자 메시지에서만 (AI 응답은 무시)
        // AI가 "상담사 연결 버튼을 눌러주세요" 등 안내를 자주 하므로 AI 텍스트 포함 시 오작동
        const _userText = (text || '').toLowerCase();
        const _consultantKeywords = ['상담사 연결','상담사연결','상담사 요청','상담사요청','매니저 연결','매니저연결','인간 상담','인간상담','사람 연결','사람연결','상담원 연결','상담원연결',
            '担当者','担当者接続','マネージャー','consultant','connect consultant','human agent','talk to human','real person','manager'];
        const _wantsConsultant = _consultantKeywords.some(k => _userText.includes(k));
        if (_wantsConsultant && !liveMode) {
            setTimeout(() => startConsultantFlow(), 500);
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
    ja: [{ name: '担当者 1' }, { name: '担当者 2' }, { name: '担当者 3' }],
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
        const { addProductToCartDirectly } = await import('./order.js?v=138');
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

// ═══════════════════════════════════════
// 포토 스튜디오 모드 (채팅창 내부)
// ═══════════════════════════════════════
const PS_T = {
    kr: { title:'✨ Photo Studio', desc:'사진 한 장으로 멋진 작품을 만들 수 있어요.\n자동으로 보정하고 디자인합니다.', upload:'사진 올리기', drag:'또는 여기에 드래그', processing:'보정 중...', done:'작품이 완성되었습니다!', orderTitle:'이 작품으로 주문하기', fabric:'패브릭 인쇄', paper:'종이 인쇄물', honeycomb:'허니콤보드', canvas:'캔버스 액자', blind:'롤블라인드', sell:'내 작품 판매하기', size:'사이즈(mm)', price:'예상 금액', order:'주문하기', retry:'다른 사진으로', custom:'직접 입력', back:'← AI 상담으로', fromPrice:'~부터', sellMsg:'곧 카멜레온 마켓플레이스가 오픈합니다!\n내 작품을 상품으로 판매해보세요.', sellDone:'등록되었습니다!' },
    ja: { title:'✨ Photo Studio', desc:'写真1枚で素敵な作品が作れます。\n自動で補正してデザインします。', upload:'写真をアップ', drag:'またはここにドラッグ', processing:'補正中...', done:'作品が完成しました！', orderTitle:'この作品で注文する', fabric:'ファブリック', paper:'紙印刷', honeycomb:'ハニカムボード', canvas:'キャンバス額', blind:'ロールブラインド', sell:'作品を販売', size:'サイズ(mm)', price:'予想金額', order:'注文する', retry:'別の写真で', custom:'カスタム', back:'← AI相談へ', fromPrice:'〜から', sellMsg:'マーケットプレイスが間もなくオープン！', sellDone:'登録しました！' },
    en: { title:'✨ Photo Studio', desc:'Turn a single photo into stunning artwork.\nAuto-enhanced and beautifully designed.', upload:'Upload Photo', drag:'or drag & drop here', processing:'Enhancing...', done:'Your artwork is ready!', orderTitle:'Order this artwork', fabric:'Fabric Print', paper:'Paper Print', honeycomb:'Honeycomb Board', canvas:'Canvas Frame', blind:'Roller Blind', sell:'Sell My Art', size:'Size(mm)', price:'Est. Price', order:'Order Now', retry:'Try another', custom:'Custom', back:'← Back to AI', fromPrice:'from', sellMsg:'Chameleon Marketplace coming soon!\nSell your artwork as products.', sellDone:'Registered!' },
};
function ps(k) { return (PS_T[getLang()] && PS_T[getLang()][k]) || PS_T.en[k] || k; }

const PS_PRODUCTS = {
    fabric:    { icon:'🧵', sqm:50000,  min:25000 },
    paper:     { icon:'📄', sqm:15000,  min:5000 },
    honeycomb: { icon:'🍯', sqm:80000,  min:40000 },
    canvas:    { icon:'🖼️', sqm:120000, min:50000 },
    blind:     { icon:'🪟', sqm:90000,  min:40000 },
};

let _psImgRatio = 1, _psImgDataUrl = null, _psSelectedProduct = null;

function _psFmtPrice(krw) {
    const cc = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR';
    if (cc === 'JP') return '¥' + Math.floor(krw * 0.1).toLocaleString();
    if (cc === 'US' || cc === 'EN') return '$' + Math.round(krw * 0.001).toLocaleString();
    if (cc === 'CN') return '¥' + Math.round(krw * 0.005).toLocaleString();
    if (cc === 'ES' || cc === 'DE' || cc === 'FR') return '€' + (krw * 0.00065).toFixed(0);
    return krw.toLocaleString() + '원';
}

// ── 폰트 로드 ──
(function(){
    const fl = document.createElement('link');
    fl.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap';
    fl.rel = 'stylesheet'; document.head.appendChild(fl);
})();

function enterStudioMode() {
    if (!chatArea) return;
    // 헤더 업데이트
    const titleEl = panelEl?.querySelector('.adv-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<span style="font-size:15px;">${ps('title')}</span> <button class="adv-studio-btn" id="advBackBtn">${ps('back')}</button>`;
        document.getElementById('advBackBtn')?.addEventListener('click', exitStudioMode);
    }
    // 입력 영역 숨기기
    const inputArea = panelEl?.querySelector('.adv-input-area');
    const imgPreview = document.getElementById('advImgPreview');
    if (inputArea) inputArea.style.display = 'none';
    if (imgPreview) imgPreview.style.display = 'none';

    // 채팅 영역에 스튜디오 UI 표시
    chatArea.innerHTML = `
        <div style="padding:12px; text-align:center;">
            <div style="font-size:36px; margin-bottom:8px;">📸</div>
            <p style="color:#64748b; font-size:13px; line-height:1.6; white-space:pre-line; margin:0 0 16px;">${ps('desc')}</p>
            <div class="ps-upload-zone" id="psUpZone">
                <div style="font-size:28px; color:#7c3aed; margin-bottom:6px;">☁️</div>
                <div style="font-size:14px; font-weight:600; color:#7c3aed;">${ps('upload')}</div>
                <div style="font-size:11px; color:#a78bfa; margin-top:4px;">${ps('drag')}</div>
            </div>
            <input type="file" id="psFileIn" accept="image/*" style="display:none">
        </div>
    `;
    const zone = document.getElementById('psUpZone');
    const fin = document.getElementById('psFileIn');
    zone.onclick = () => fin.click();
    zone.ondragover = (e) => { e.preventDefault(); zone.style.borderColor = '#7c3aed'; };
    zone.ondragleave = () => { zone.style.borderColor = '#c4b5fd'; };
    zone.ondrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) _psProcess(e.dataTransfer.files[0]); };
    fin.onchange = (e) => { if (e.target.files[0]) _psProcess(e.target.files[0]); };
}

function exitStudioMode() {
    // 헤더 복원
    updateHeaderForAI();
    // 입력 영역 복원
    const inputArea = panelEl?.querySelector('.adv-input-area');
    if (inputArea) inputArea.style.display = '';
    // 대화 복원
    const restored = loadChat();
    if (!restored) {
        chatArea.innerHTML = '';
        showWelcomeMessage();
    }
    scrollChat();
}

async function _psProcess(file) {
    // 로딩
    chatArea.innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="width:40px;height:40px;border:4px solid #e9d5ff;border-top:4px solid #7c3aed;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div><p style="color:#7c3aed;font-weight:600;font-size:14px;">${ps('processing')}</p></div>`;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        const mx = 2000;
        if (w > mx || h > mx) { const s = mx / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        _psImgRatio = w / h;

        const cvs = document.createElement('canvas');
        cvs.width = w; cvs.height = h;
        const ctx = cvs.getContext('2d');
        ctx.filter = 'brightness(1.12) contrast(1.08) saturate(1.05)';
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';

        // 하단 그라데이션
        const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);

        // 폰트
        try { await document.fonts.load('48px "Dancing Script"'); } catch(e) {}
        await new Promise(r => setTimeout(r, 300));

        const fs = Math.round(w * 0.065);
        ctx.font = `${fs}px "Dancing Script", cursive`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.fillText('Love of my life', w / 2, h * 0.88);
        ctx.shadowColor = 'transparent';

        _psImgDataUrl = cvs.toDataURL('image/jpeg', 0.92);
        _psShowResult();
    };
    img.onerror = () => enterStudioMode();
    img.src = url;
}

function _psShowResult() {
    const prods = [
        { key:'fabric', icon:'🧵', name:ps('fabric') },
        { key:'paper', icon:'📄', name:ps('paper') },
        { key:'honeycomb', icon:'🍯', name:ps('honeycomb') },
        { key:'canvas', icon:'🖼️', name:ps('canvas') },
        { key:'blind', icon:'🪟', name:ps('blind') },
    ];
    const prodBtns = prods.map(p => `<div class="ps-prod-item" data-pk="${p.key}"><span class="ps-pi">${p.icon}</span>${p.name}<span class="ps-pp">${_psFmtPrice(PS_PRODUCTS[p.key].min)} ${ps('fromPrice')}</span></div>`).join('');

    chatArea.innerHTML = `
        <div style="padding:10px;">
            <div class="ps-preview-wrap">
                <img src="${_psImgDataUrl}" alt="artwork">
                <div class="ps-preview-badge">✨ ${ps('done')}</div>
            </div>
            <div style="font-size:13px; font-weight:700; color:#1e1b4b; margin:12px 0 6px;">🛒 ${ps('orderTitle')}</div>
            <div class="ps-prod-grid">
                ${prodBtns}
                <div class="ps-prod-item ps-sell-item" data-pk="sell"><span class="ps-pi">💰</span>${ps('sell')}</div>
            </div>
            <div id="psSizingArea"></div>
            <div style="text-align:center; margin-top:10px;">
                <a style="color:#94a3b8; font-size:12px; cursor:pointer; text-decoration:none;" id="psRetryBtn">🔄 ${ps('retry')}</a>
            </div>
        </div>
    `;
    document.getElementById('psRetryBtn')?.addEventListener('click', enterStudioMode);

    chatArea.querySelectorAll('.ps-prod-item').forEach(btn => {
        btn.addEventListener('click', () => {
            chatArea.querySelectorAll('.ps-prod-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const pk = btn.dataset.pk;
            if (pk === 'sell') _psShowSell();
            else _psShowSizing(pk);
        });
    });
    scrollChat();
}

function _psShowSizing(key) {
    _psSelectedProduct = key;
    const shorts = [300, 500, 700, 900, 1200];
    const sizes = shorts.map(s => {
        let w, h;
        if (_psImgRatio >= 1) { h = s; w = Math.round(s * _psImgRatio); } else { w = s; h = Math.round(s / _psImgRatio); }
        return { l: `${w}×${h}`, w, h };
    });
    const btns = sizes.map(s => `<button class="ps-sz" data-w="${s.w}" data-h="${s.h}">${s.l}</button>`).join('');

    document.getElementById('psSizingArea').innerHTML = `
        <div style="background:#f8fafc; border-radius:10px; padding:10px; margin-top:8px;">
            <div style="font-size:12px; font-weight:600; color:#475569; margin-bottom:6px;">📐 ${ps('size')}</div>
            <div class="ps-size-row">${btns}<button class="ps-sz" data-c="1">${ps('custom')}</button></div>
            <div id="psCustomArea" style="display:none;" class="ps-custom-inputs">
                <input type="number" id="psCW" placeholder="가로" min="100" max="5000">
                <span style="color:#94a3b8; font-weight:600;">×</span>
                <input type="number" id="psCH" placeholder="세로" min="100" max="5000">
                <button class="ps-sz" id="psCOk">OK</button>
            </div>
            <div id="psPriceOut"></div>
        </div>
    `;
    document.getElementById('psSizingArea').querySelectorAll('.ps-sz').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#psSizingArea .ps-sz').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            if (b.dataset.c) {
                document.getElementById('psCustomArea').style.display = 'flex';
            } else {
                document.getElementById('psCustomArea').style.display = 'none';
                _psCalcPrice(parseInt(b.dataset.w), parseInt(b.dataset.h));
            }
        });
    });
    document.getElementById('psCOk')?.addEventListener('click', () => {
        const w = parseInt(document.getElementById('psCW').value);
        const h = parseInt(document.getElementById('psCH').value);
        if (w >= 100 && h >= 100) _psCalcPrice(w, h);
    });
    scrollChat();
}

function _psCalcPrice(w, h) {
    const prod = PS_PRODUCTS[_psSelectedProduct];
    const area = (w / 1000) * (h / 1000);
    let price = Math.round((area * prod.sqm) / 100) * 100;
    if (price < prod.min) price = prod.min;

    document.getElementById('psPriceOut').innerHTML = `
        <div class="ps-price-bar">
            <span class="ps-pl">${ps('price')} (${w}×${h}mm)</span>
            <span class="ps-pv">${_psFmtPrice(price)}</span>
        </div>
        <button class="ps-order-btn" id="psOrderBtn">🛒 ${ps('order')}</button>
    `;
    document.getElementById('psOrderBtn')?.addEventListener('click', () => {
        _psOrder(w, h, _psSelectedProduct);
    });
    scrollChat();
}

function _psOrder(w, h, productKey) {
    // 이미지 저장
    try { sessionStorage.setItem('ps_artwork', _psImgDataUrl); } catch(e) {}
    window._photoStudioImage = _psImgDataUrl;

    // AI 상담 모드로 전환 + 주문 메시지 전달梦
    exitStudioMode();
    setTimeout(() => {
        const names = { fabric:ps('fabric'), paper:ps('paper'), honeycomb:ps('honeycomb'), canvas:ps('canvas'), blind:ps('blind') };
        const msg = `${names[productKey]} ${w}×${h}mm 주문하고 싶습니다`;
        const inp = document.getElementById('advInput');
        if (inp) { inp.value = msg; }
        sendFromInput();
    }, 300);
}

function _psShowSell() {
    document.getElementById('psSizingArea').innerHTML = `
        <div style="text-align:center; padding:8px 0;">
            <p style="font-size:13px; color:#64748b; white-space:pre-line; line-height:1.5; margin:0 0 8px;">${ps('sellMsg')}</p>
            <button class="ps-order-btn" style="background:#f59e0b;" id="psSellRegBtn">🎨 ${ps('sell')}</button>
        </div>
    `;
    document.getElementById('psSellRegBtn')?.addEventListener('click', function() {
        this.textContent = '✅ ' + ps('sellDone');
        this.style.background = '#10b981';
        this.disabled = true;
    });
    scrollChat();
}
