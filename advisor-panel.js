// ============================================================
// advisor-panel.js — 카프 AI 쇼핑 안내 + 상담사 연결 통합 패널
// 검색바 아래 대형 채팅창. AI + 인간 상담 통합
// ============================================================

import { SITE_CONFIG } from './site-config.js?v=165';

const SUPA_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const API_URL = SUPA_URL + '/functions/v1/product-advisor';

function getLang() {
    const cc = (window.SITE_CONFIG && SITE_CONFIG.COUNTRY) || '';
    if (cc === 'JP') return 'ja';
    if (cc === 'CN' || cc === 'ZH') return 'zh';
    if (cc === 'ES') return 'es';
    if (cc === 'DE') return 'de';
    if (cc === 'FR') return 'fr';
    if (cc === 'AR') return 'ar';
    if (cc === 'US' || cc === 'EN') return 'en';
    return 'kr';
}

const T = {
    kr: { title: '카프', subtitle: '쇼핑을 안내해 드립니다', studio: '여기서 놀자!', placeholder: '메시지를 입력하세요...', send: '전송', close: '닫기', editor: '에디터에서 디자인', cart: '장바구니', upload: '이미지 첨부', tooBig: '파일이 너무 큽니다 (최대 10MB). 더 큰 파일은 주문 시 업로드하거나 korea900@hanmail.net으로 보내주세요.', error: '멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 전문 상담사가 꼼꼼하게 확인하고 상담해 드리는게 좋습니다. 위의 🎧 상담사 연결 버튼을 눌러주세요! 제품 제작은 상담사에게, 출고/제작 상태 확인은 본사 상담사를 선택해 주세요 😊', reset: '대화 초기화', consultant: '상담사 연결', selectMgr: '상담 매니저를 선택해주세요', selectSub: '선택하시면 바로 연결됩니다', mgrSuffix: ' 매니저', enterName: '상담사 연결을 위해 정보를 입력해주세요', namePh: '이름', phonePh: '연락처 (010-0000-0000)', nameBtn: '다음', nameErr: '이름을 입력해주세요', phoneErr: '연락처를 입력해주세요', connecting: '연결 요청!', pleaseWait: '잠시만 기다려주세요 😊', tipFile: '아래 📎 버튼으로 사진/파일도 보낼 수 있어요!', consulting: '상담 중', hqConsultant: '본사 상담사', waiting: '님 연결 대기 중...', connectErr: '연결 중 오류! 잠시 후 다시 시도해주세요.', endChat: '상담 종료', backToAi: '카프 AI로 돌아가기' },
    ja: { title: 'カプ', subtitle: 'ショッピングをご案内します', studio: 'ここで遊ぼう!', placeholder: 'メッセージを入力...', send: '送信', close: '閉じる', editor: 'エディターでデザイン', cart: 'カートに入れる', upload: '画像添付', tooBig: 'ファイルが大きすぎます（最大10MB）。より大きいファイルはsupport@cafe0101.comへお送りください。', error: '素敵な作品を構想中ですね！✨ このような製品の制作は、専門の担当者が丁寧に確認・ご案内するのがベストです。上の🎧担当者接続ボタンを押してください！製品制作は担当者へ、出荷・制作状況の確認は本社担当者をお選びください 😊', reset: 'チャットリセット', consultant: '担当者に接続', selectMgr: '相談マネージャーを選択してください', selectSub: '選択するとすぐに接続されます', mgrSuffix: '', enterName: '接続のため情報を入力してください', namePh: 'お名前', phonePh: '電話番号', nameBtn: '次へ', nameErr: '名前を入力', phoneErr: '電話番号を入力', connecting: 'に接続リクエスト！', pleaseWait: '少々お待ちください 😊', tipFile: '下の📎ボタンで写真/ファイルも送れます！', consulting: '相談中', hqConsultant: '本社担当者', waiting: '様 接続待機中...', connectErr: '接続エラー！しばらくしてからお試しください。', endChat: '相談終了', backToAi: 'カプAIに戻る' },
    en: { title: 'Kapu', subtitle: 'Your shopping guide', studio: 'Play Here!', placeholder: 'Type a message...', send: 'Send', close: 'Close', editor: 'Design in Editor', cart: 'Add to Cart', upload: 'Attach image', tooBig: 'File too large (max 10MB). For larger files, please email support@cafe3355.com.', error: 'What an amazing project you have in mind! ✨ For this kind of product, our expert consultants can help you best. Please tap the 🎧 Connect Agent button above! For product inquiries, choose a consultant. For shipping/production status, choose HQ Consultant 😊', reset: 'Reset chat', consultant: 'Connect agent', selectMgr: 'Please select a consultant', selectSub: "You'll be connected right away", mgrSuffix: '', enterName: 'Please enter your info to connect', namePh: 'Name', phonePh: 'Phone number', nameBtn: 'Next', nameErr: 'Please enter your name', phoneErr: 'Please enter phone', connecting: ' - Connection requested!', pleaseWait: 'Please wait a moment 😊', tipFile: 'You can send photos/files using the 📎 button below!', consulting: 'In consultation', hqConsultant: 'HQ Consultant', waiting: ' connecting...', connectErr: 'Connection error! Please try again.', endChat: 'End chat', backToAi: 'Back to Kapu AI' },
    zh: { title: '卡普', subtitle: '为您导购', studio: '在这里玩!', placeholder: '请输入消息...', send: '发送', close: '关闭', editor: '在编辑器中设计', cart: '加入购物车', upload: '上传图片', tooBig: '文件太大（最大10MB）。', error: '您构思了一个很棒的项目！✨ 这类产品最好由专业顾问为您详细确认和咨询。请点击上方🎧连接顾问按钮！😊', reset: '重置对话', consultant: '连接顾问', selectMgr: '请选择咨询顾问', selectSub: '选择后立即连接', mgrSuffix: '', enterName: '请输入您的信息以连接', namePh: '姓名', phonePh: '电话号码', nameBtn: '下一步', nameErr: '请输入姓名', phoneErr: '请输入电话', connecting: ' - 连接请求已发送！', pleaseWait: '请稍候 😊', tipFile: '您可以使用下方📎按钮发送照片/文件！', consulting: '咨询中', hqConsultant: '总部顾问', waiting: ' 连接中...', connectErr: '连接错误！请稍后再试。', endChat: '结束咨询', backToAi: '返回卡普AI' },
    es: { title: 'Kapu', subtitle: 'Tu guía de compras', studio: '¡Juega Aquí!', placeholder: 'Escribe un mensaje...', send: 'Enviar', close: 'Cerrar', editor: 'Diseñar en Editor', cart: 'Añadir al carrito', upload: 'Adjuntar imagen', tooBig: 'Archivo demasiado grande (máx. 10MB).', error: '¡Qué proyecto tan increíble! ✨ Para este tipo de producto, nuestros consultores expertos pueden ayudarte mejor. Por favor, toca el botón 🎧 Conectar Agente arriba. 😊', reset: 'Reiniciar chat', consultant: 'Conectar agente', selectMgr: 'Selecciona un consultor', selectSub: 'Te conectaremos de inmediato', mgrSuffix: '', enterName: 'Ingresa tu información', namePh: 'Nombre', phonePh: 'Teléfono', nameBtn: 'Siguiente', nameErr: 'Ingresa tu nombre', phoneErr: 'Ingresa tu teléfono', connecting: ' - ¡Solicitud enviada!', pleaseWait: 'Un momento por favor 😊', tipFile: 'Puedes enviar fotos usando el botón 📎', consulting: 'En consulta', hqConsultant: 'Consultor HQ', waiting: ' conectando...', connectErr: 'Error de conexión. Intenta de nuevo.', endChat: 'Terminar chat', backToAi: 'Volver a Kapu AI' },
    de: { title: 'Kapu', subtitle: 'Ihr Einkaufsberater', studio: 'Hier spielen!', placeholder: 'Nachricht eingeben...', send: 'Senden', close: 'Schließen', editor: 'Im Editor gestalten', cart: 'In den Warenkorb', upload: 'Bild anhängen', tooBig: 'Datei zu groß (max. 10MB).', error: 'Was für ein tolles Projekt! ✨ Für dieses Produkt können unsere Experten am besten helfen. Bitte tippen Sie oben auf 🎧 Agent verbinden. 😊', reset: 'Chat zurücksetzen', consultant: 'Agent verbinden', selectMgr: 'Berater auswählen', selectSub: 'Sofortige Verbindung', mgrSuffix: '', enterName: 'Bitte Ihre Daten eingeben', namePh: 'Name', phonePh: 'Telefon', nameBtn: 'Weiter', nameErr: 'Bitte Name eingeben', phoneErr: 'Bitte Telefon eingeben', connecting: ' - Anfrage gesendet!', pleaseWait: 'Bitte warten 😊', tipFile: 'Fotos senden mit dem 📎 Button', consulting: 'In Beratung', hqConsultant: 'HQ-Berater', waiting: ' verbindet...', connectErr: 'Verbindungsfehler. Bitte erneut versuchen.', endChat: 'Chat beenden', backToAi: 'Zurück zu Kapu AI' },
    fr: { title: 'Kapu', subtitle: 'Votre guide d\'achat', studio: 'Jouez ici!', placeholder: 'Tapez un message...', send: 'Envoyer', close: 'Fermer', editor: 'Designer dans l\'éditeur', cart: 'Ajouter au panier', upload: 'Joindre image', tooBig: 'Fichier trop volumineux (max 10MB).', error: 'Quel projet incroyable ! ✨ Pour ce type de produit, nos consultants experts sont là pour vous. Appuyez sur 🎧 Connecter Agent ci-dessus. 😊', reset: 'Réinitialiser', consultant: 'Connecter agent', selectMgr: 'Choisir un conseiller', selectSub: 'Connexion immédiate', mgrSuffix: '', enterName: 'Entrez vos informations', namePh: 'Nom', phonePh: 'Téléphone', nameBtn: 'Suivant', nameErr: 'Entrez votre nom', phoneErr: 'Entrez votre téléphone', connecting: ' - Demande envoyée !', pleaseWait: 'Veuillez patienter 😊', tipFile: 'Envoyez des photos avec le bouton 📎', consulting: 'En consultation', hqConsultant: 'Conseiller HQ', waiting: ' connexion...', connectErr: 'Erreur de connexion. Réessayez.', endChat: 'Terminer', backToAi: 'Retour à Kapu AI' },
    ar: { title: 'كابو', subtitle: 'دليل التسوق', studio: '!العب هنا', placeholder: '...اكتب رسالة', send: 'إرسال', close: 'إغلاق', editor: 'التصميم في المحرر', cart: 'أضف للسلة', upload: 'إرفاق صورة', tooBig: 'الملف كبير جداً (الحد 10MB).', error: 'يا لها من فكرة رائعة! ✨ لهذا النوع من المنتجات، يمكن لمستشارينا مساعدتك بشكل أفضل. اضغط على زر 🎧 اتصل بالوكيل أعلاه. 😊', reset: 'إعادة تعيين', consultant: 'اتصل بوكيل', selectMgr: 'اختر مستشاراً', selectSub: 'اتصال فوري', mgrSuffix: '', enterName: 'أدخل معلوماتك', namePh: 'الاسم', phonePh: 'الهاتف', nameBtn: 'التالي', nameErr: 'أدخل اسمك', phoneErr: 'أدخل هاتفك', connecting: ' - تم إرسال الطلب!', pleaseWait: 'يرجى الانتظار 😊', tipFile: 'أرسل صوراً باستخدام زر 📎', consulting: 'في استشارة', hqConsultant: 'مستشار المقر', waiting: ' جاري الاتصال...', connectErr: 'خطأ في الاتصال. حاول مرة أخرى.', endChat: 'إنهاء', backToAi: 'العودة لكابو AI' },
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
    kr: `위의 <b>여기서 놀자!</b>를 누르면 내 사진으로 재미있는 변형과 빠른 주문이 가능해요.\n\n채팅창에 어떤 제품이 필요한지 말씀해 주시거나 참고할만한 사진을 올려주시면 쉽게 주문하실 수 있도록 친절하게 안내해 드릴게요.`,
    ja: `上の<b>ここで遊ぼう!</b>を押すと、自分の写真で面白い変形と簡単注文ができます。\n\nチャットでどんな商品が必要か教えていただくか、参考になる写真をアップロードしていただければ、簡単にご注文いただけるよう丁寧にご案内いたします。`,
    en: `Tap <b>Play Here!</b> above to have fun transforming your photos and place quick orders.\n\nTell us what product you need in the chat, or upload a reference photo — we'll guide you through an easy ordering experience.`,
    zh: `点击上方<b>在这里玩!</b>，可以用自己的照片进行有趣的变形和快速下单。\n\n在聊天中告诉我们您需要什么产品，或者上传参考图片，我们会贴心地引导您轻松完成订购。`,
    es: `Toca <b>¡Juega Aquí!</b> arriba para transformar tus fotos y hacer pedidos rápidos.\n\nDinos qué producto necesitas en el chat o sube una foto de referencia — te guiaremos para que tu pedido sea fácil.`,
    de: `Tippen Sie oben auf <b>Hier spielen!</b>, um Ihre Fotos kreativ zu verändern und schnell zu bestellen.\n\nSagen Sie uns im Chat, welches Produkt Sie brauchen, oder laden Sie ein Referenzfoto hoch — wir begleiten Sie durch den Bestellprozess.`,
    fr: `Appuyez sur <b>Jouez ici!</b> ci-dessus pour transformer vos photos et passer des commandes rapides.\n\nDites-nous quel produit vous cherchez dans le chat ou téléchargez une photo de référence — nous vous guiderons facilement.`,
    ar: `اضغط على <b>!العب هنا</b> أعلاه لتحويل صورك بشكل ممتع وتقديم طلبات سريعة.\n\nأخبرنا بما تحتاجه في الدردشة أو ارفع صورة مرجعية — سنرشدك بسهولة خلال عملية الطلب.`,
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

    // URL 파라미터 ?chat=1 → 챗봇 자동 오픈 + 스크롤
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('chat') === '1') {
            setTimeout(() => {
                openPanel();
                panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => { const inp = document.getElementById('advInput'); if (inp) inp.focus(); }, 400);
            }, 1000);
        }
    } catch(e) {}

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
                <button class="adv-studio-btn" id="advStudioBtn">✨ ${t('studio')}</button>
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
        const { addProductToCartDirectly } = await import('./order.js?v=165');
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
    kr: { title:'✨ 작품만들기', desc:'사진 한 장으로 멋진 작품을 만들 수 있어요.\n자동으로 보정하고 디자인합니다.', upload:'사진 올리기', drag:'또는 여기에 드래그', processing:'보정 중...', done:'작품이 완성되었습니다!', orderTitle:'이 작품으로 주문하기', fabric:'패브릭 인쇄', paper:'종이 인쇄물', honeycomb:'허니콤보드', canvas:'캔버스 액자', blind:'롤블라인드', banner:'현수막', keyring:'아크릴키링', tshirt:'티셔츠 인쇄', sell:'내 작품 판매하기', size:'사이즈', price:'예상 금액', order:'주문하기', retry:'다른 사진으로', custom:'직접 입력', back:'← 상담으로', fromPrice:'~부터', sellMsg:'판매금액의 10%가\n현금으로 찾을 수 있는\n적립금으로 적립됩니다!', sellDone:'등록되었습니다!', textLabel:'텍스트', textPh:'문구를 입력하세요', removeBg:'누끼따기', removeBgDesc:'배경 제거', colorLabel:'텍스트/배경', applyText:'적용', width:'가로', height:'세로(자동)', autoCalc:'자동계산', editorLink:'디테일한 수정이 필요하시면 에디터로 이동하세요', mypage:'마이페이지', sellExplain:'내 작품을 상품으로 등록하고 판매할 수 있습니다.', commission:'판매금액의 10%가 현금으로 찾을 수 있는 적립금으로 적립됩니다.', removingBg:'배경 제거 중...', retouch:'사진보정', cartConfirm:'장바구니로 이동하시겠어요?', bgColor:'배경색', registering:'작품 등록 중...', sellGuide:'작품이 3종(패브릭/종이/캔버스) 상품으로\n자동 등록됩니다.\n판매금액의 10%가 적립금으로 적립됩니다.', paperOpt:'용지', standOpt:'받침대', handleOpt:'손잡이 위치', handleL:'좌측', handleR:'우측' },
    ja: { title:'✨ 作品作り', desc:'写真1枚で素敵な作品が作れます。\n自動で補正してデザインします。', upload:'写真をアップ', drag:'またはここにドラッグ', processing:'補正中...', done:'作品が完成しました！', orderTitle:'この作品で注文する', fabric:'ファブリック', paper:'紙印刷', honeycomb:'ハニカムボード', canvas:'キャンバス額', blind:'ロールブラインド', banner:'横断幕', keyring:'アクリルキーリング', tshirt:'Tシャツ印刷', sell:'作品を販売', size:'サイズ', price:'予想金額', order:'注文する', retry:'別の写真で', custom:'カスタム', back:'← 相談へ', fromPrice:'〜から', sellMsg:'販売金額の10%が\nキャッシュバック可能な\nポイントとして積立されます！', sellDone:'登録しました！', textLabel:'テキスト', textPh:'テキストを入力', removeBg:'背景除去', removeBgDesc:'背景を削除', colorLabel:'テキスト/背景', applyText:'適用', width:'横', height:'縦(自動)', autoCalc:'自動計算', editorLink:'詳細な編集はエディターへ移動してください', mypage:'マイページ', sellExplain:'作品を商品として登録・販売できます。', commission:'販売金額の10%がキャッシュバック可能なポイントとして積立されます。', removingBg:'背景除去中...', retouch:'写真補正', cartConfirm:'カートに移動しますか？', bgColor:'背景色', registering:'作品登録中...', sellGuide:'作品が3種(ファブリック/紙/キャンバス)商品として\n自動登録されます。\n販売金額の10%がポイントとして積立されます。', paperOpt:'用紙', standOpt:'スタンド', handleOpt:'ハンドル位置', handleL:'左側', handleR:'右側' },
    en: { title:'✨ Create Art', desc:'Turn a single photo into stunning artwork.\nAuto-enhanced and beautifully designed.', upload:'Upload Photo', drag:'or drag & drop here', processing:'Enhancing...', done:'Your artwork is ready!', orderTitle:'Order this artwork', fabric:'Fabric Print', paper:'Paper Print', honeycomb:'Honeycomb Board', canvas:'Canvas Frame', blind:'Roller Blind', banner:'Banner', keyring:'Acrylic Keyring', tshirt:'T-shirt Print', sell:'Sell My Art', size:'Size', price:'Est. Price', order:'Order Now', retry:'Try another', custom:'Custom', back:'← Consult', fromPrice:'from', sellMsg:'Earn 10% of sales\nas cashback credits!', sellDone:'Registered!', textLabel:'Text', textPh:'Enter your text', removeBg:'Remove BG', removeBgDesc:'Remove background', colorLabel:'Text/BG', applyText:'Apply', width:'Width', height:'Height(auto)', autoCalc:'Auto', editorLink:'Need detailed editing? Move to the editor', mypage:'My Page', sellExplain:'Register and sell your artwork as products.', commission:'10% of sales are credited as cashback you can withdraw.', removingBg:'Removing background...', retouch:'Enhance', cartConfirm:'Go to cart?', bgColor:'BG Color', registering:'Registering...', sellGuide:'Your artwork will be auto-registered as 3 products\n(Fabric/Paper/Canvas).\n10% of sales credited as cashback.', paperOpt:'Paper', standOpt:'Stand', handleOpt:'Handle Side', handleL:'Left', handleR:'Right' },
};
function ps(k) { return (PS_T[getLang()] && PS_T[getLang()][k]) || PS_T.en[k] || k; }

// 회베 단가 (1m² 당 KRW) — 최소가격 없음, 순수 면적 계산
const PS_PRODUCTS = {
    fabric:    { icon:'🧵', sqm:15000 },
    paper:     { icon:'📄', sqm:10000 },
    honeycomb: { icon:'🍯', sqm:60000 },
    canvas:    { icon:'🖼️', sqm:100000 },
    blind:     { icon:'🪟', sqm:30000 },
    banner:    { icon:'🏳️', sqm:10000 },
    keyring:   { icon:'🔑', fixed:3000 },
    tshirt:    { icon:'👕', fixed:10000 },
};

let _psImgRatio = 1, _psImgDataUrl = null, _psSelectedProduct = null;
let _psRawDataUrl = null;   // enhanced but no text overlay
let _psOrigDataUrl = null;  // original unprocessed
let _psNoBgDataUrl = null;  // transparent PNG after bg-remove (for bg color re-composite)
let _psTshirtColor = '#ffffff'; // 티셔츠 목업 색상
let _psText = 'Love of my life';
let _psTextColor = '#ffffff';
let _psBgColor = '#ffffff';
let _psImgW = 0, _psImgH = 0; // pixel dimensions
let _psHistory = [];            // 되돌리기 히스토리

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
    fl.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Noto+Sans:wght@400;700&display=swap';
    fl.rel = 'stylesheet'; document.head.appendChild(fl);
})();

// 비라틴 문자 감지 (한글, 일본어, 중국어 등)
function _psHasNonLatin(text) {
    return /[^\u0000-\u024F\u1E00-\u1EFF]/.test(text);
}

// 텍스트에 맞는 폰트 결정
function _psGetFont(text) {
    return _psHasNonLatin(text) ? '"Noto Sans", sans-serif' : '"Dancing Script", cursive';
}

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
    chatArea.innerHTML = `<div style="text-align:center; padding:50px 20px;"><div style="width:40px;height:40px;border:4px solid #e9d5ff;border-top:4px solid #7c3aed;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px;"></div><p style="color:#7c3aed;font-weight:600;font-size:14px;">${ps('processing')}</p></div>`;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        const mx = 2000;
        if (w > mx || h > mx) { const s = mx / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        _psImgRatio = w / h;
        _psImgW = w; _psImgH = h;

        // 원본 저장 (리사이즈만)
        const origCvs = document.createElement('canvas');
        origCvs.width = w; origCvs.height = h;
        origCvs.getContext('2d').drawImage(img, 0, 0, w, h);
        _psOrigDataUrl = origCvs.toDataURL('image/jpeg', 0.92);

        // 보정 이미지 (텍스트 없이)
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

        _psRawDataUrl = cvs.toDataURL('image/jpeg', 0.92);

        // 텍스트 적용 버전
        _psText = 'Love of my life';
        _psTextColor = '#ffffff';
        await _psApplyText();
        _psShowResult();
    };
    img.onerror = () => enterStudioMode();
    img.src = url;
}

async function _psApplyText() {
    const img = new Image();
    await new Promise((resolve) => { img.onload = resolve; img.src = _psRawDataUrl; });
    const cvs = document.createElement('canvas');
    cvs.width = img.width; cvs.height = img.height;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (_psText.trim()) {
        const fontStr = _psGetFont(_psText);
        const fontFamily = _psHasNonLatin(_psText) ? 'Noto Sans' : 'Dancing Script';
        try { await document.fonts.load(`48px "${fontFamily}"`); } catch(e) {}
        await new Promise(r => setTimeout(r, 200));
        const fs = Math.round(img.width * (_psHasNonLatin(_psText) ? 0.045 : 0.065));
        ctx.font = `700 ${fs}px ${fontStr}`;
        ctx.fillStyle = _psTextColor;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.fillText(_psText, img.width / 2, img.height * 0.88);
        ctx.shadowColor = 'transparent';
    }

    _psImgDataUrl = cvs.toDataURL('image/jpeg', 0.92);
}

function _psShowResult() {
    const prods = [
        { key:'fabric', icon:'🧵', name:ps('fabric') },
        { key:'paper', icon:'📄', name:ps('paper') },
        { key:'honeycomb', icon:'🍯', name:ps('honeycomb') },
        { key:'canvas', icon:'🖼️', name:ps('canvas') },
        { key:'blind', icon:'🪟', name:ps('blind') },
        { key:'banner', icon:'🏳️', name:ps('banner') },
        { key:'keyring', icon:'🔑', name:ps('keyring') },
        { key:'tshirt', icon:'👕', name:ps('tshirt') },
    ];
    const prodBtns = prods.map(p => {
        const prod = PS_PRODUCTS[p.key];
        const priceLabel = prod.fixed ? _psFmtPrice(prod.fixed) : `${_psFmtPrice(prod.sqm)}/㎡`;
        return `<div class="ps-prod-item" data-pk="${p.key}"><span class="ps-pi">${p.icon}</span>${p.name}<span class="ps-pp">${priceLabel}</span></div>`;
    }).join('');

    chatArea.innerHTML = `
        <div class="ps-studio-layout">
            <div class="ps-left">
                <div class="ps-preview-wrap">
                    <img src="${_psImgDataUrl}" alt="artwork" id="psPreviewImg">
                    <div class="ps-preview-badge">✨ ${ps('done')}</div>
                </div>
                <div style="text-align:center; margin-top:6px;">
                    <a style="color:#94a3b8; font-size:11px; cursor:pointer;" id="psRetryBtn">🔄 ${ps('retry')}</a>
                </div>
            </div>
            <div class="ps-right">
                <!-- 텍스트 편집 -->
                <div class="ps-tool-section">
                    <div class="ps-tool-label">✏️ ${ps('textLabel')}</div>
                    <div class="ps-text-row">
                        <input type="text" id="psTextInput" class="ps-text-input" value="${_psText}" placeholder="${ps('textPh')}">
                        <button class="ps-apply-btn" id="psApplyText">${ps('applyText')}</button>
                    </div>
                </div>
                <!-- 텍스트 색상 (흰/검) + 배경색 (알약 토글) -->
                <div class="ps-tool-section">
                    <div class="ps-tool-label">🎨 ${ps('colorLabel')}</div>
                    <div class="ps-color-row">
                        <div class="ps-color-swatch active" data-color="#ffffff" style="background:#fff;border:2px solid #ccc;" title="White"></div>
                        <div class="ps-color-swatch" data-color="#000000" style="background:#000;" title="Black"></div>
                        <span style="color:#cbd5e1; margin:0 4px;">|</span>
                        <span style="font-size:10px; color:#64748b; font-weight:600;">${ps('bgColor')}</span>
                        <div class="ps-bg-pill">
                            <input type="color" id="psBgColorPicker" value="${_psBgColor}" class="ps-bg-pill-input">
                            <span class="ps-bg-pill-label" id="psBgLabel" style="background:${_psBgColor}"></span>
                        </div>
                    </div>
                </div>
                <!-- 누끼따기 + 사진보정 + 되돌리기 -->
                <div class="ps-tool-section">
                    <div class="ps-btn-row">
                        <button class="ps-tool-btn" id="psRemoveBg">✂️ ${ps('removeBg')}</button>
                        <button class="ps-tool-btn" id="psRetouchBtn">✨ ${ps('retouch')}</button>
                        <button class="ps-tool-btn" id="psUndoBtn" style="background:#f1f5f9; color:#64748b;">↩️ ${getLang()==='ja'?'戻す':getLang()==='en'?'Undo':'되돌리기'}</button>
                    </div>
                </div>
                <!-- 제품 선택 -->
                <div class="ps-tool-section">
                    <div class="ps-tool-label">🛒 ${ps('orderTitle')}</div>
                    <div class="ps-prod-grid">
                        ${prodBtns}
                        <div class="ps-prod-item ps-sell-item" data-pk="sell"><span class="ps-pi">💰</span>${ps('sell')}</div>
                    </div>
                </div>
                <div id="psSizingArea"></div>
            </div>
        </div>
        <div class="ps-editor-link-wrap">
            <a id="psEditorLink" class="ps-editor-link">🖌️ ${ps('editorLink')}</a>
        </div>
    `;

    // 이벤트
    document.getElementById('psRetryBtn')?.addEventListener('click', enterStudioMode);

    // 텍스트 폰트 자동변경
    const psTextIn = document.getElementById('psTextInput');
    if (psTextIn) {
        psTextIn.style.fontFamily = _psGetFont(_psText);
        psTextIn.addEventListener('input', () => { psTextIn.style.fontFamily = _psGetFont(psTextIn.value); });
    }
    document.getElementById('psApplyText')?.addEventListener('click', async () => {
        _psText = document.getElementById('psTextInput').value;
        await _psApplyText();
        document.getElementById('psPreviewImg').src = _psImgDataUrl;
    });
    document.getElementById('psTextInput')?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') { _psText = e.target.value; await _psApplyText(); document.getElementById('psPreviewImg').src = _psImgDataUrl; }
    });

    // 텍스트 색상 (흰/검만)
    chatArea.querySelectorAll('.ps-color-swatch').forEach(sw => {
        sw.addEventListener('click', async () => {
            chatArea.querySelectorAll('.ps-color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            _psTextColor = sw.dataset.color;
            await _psApplyText();
            document.getElementById('psPreviewImg').src = _psImgDataUrl;
        });
    });

    // 배경색 선택 — 투명 PNG가 있으면 재합성
    document.getElementById('psBgColorPicker')?.addEventListener('input', async (e) => {
        _psBgColor = e.target.value;
        document.getElementById('psBgLabel').style.background = _psBgColor;
        if (_psNoBgDataUrl) {
            const img = new Image();
            await new Promise(r => { img.onload = r; img.src = _psNoBgDataUrl; });
            const cvs = document.createElement('canvas');
            cvs.width = img.width; cvs.height = img.height;
            const ctx = cvs.getContext('2d');
            ctx.fillStyle = _psBgColor;
            ctx.fillRect(0, 0, cvs.width, cvs.height);
            ctx.drawImage(img, 0, 0);
            _psRawDataUrl = cvs.toDataURL('image/jpeg', 0.92);
            await _psApplyText();
            document.getElementById('psPreviewImg').src = _psImgDataUrl;
        }
    });

    // 누끼
    document.getElementById('psRemoveBg')?.addEventListener('click', _psRemoveBg);

    // 사진보정 (에디터 AI retouch 기능)
    document.getElementById('psRetouchBtn')?.addEventListener('click', _psShowRetouchMenu);

    // 되돌리기
    document.getElementById('psUndoBtn')?.addEventListener('click', _psUndo);

    // 제품 선택
    chatArea.querySelectorAll('.ps-prod-item').forEach(btn => {
        btn.addEventListener('click', async () => {
            chatArea.querySelectorAll('.ps-prod-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const pk = btn.dataset.pk;
            if (pk === 'sell') { _psShowSell(); return; }
            // 키링: 자동 누끼 후 사이징
            if (pk === 'keyring' && !_psNoBgDataUrl) {
                await _psAutoRemoveBg();
            }
            _psShowSizing(pk);
        });
    });

    // 에디터로 이동
    document.getElementById('psEditorLink')?.addEventListener('click', _psGoToEditor);

    scrollChat();
}

// 사진보정 메뉴 (에디터의 AI 기능들) — 아래로 펼쳐지는 패널
function _psShowRetouchMenu() {
    const existing = document.getElementById('psRetouchPanel');
    if (existing) { existing.remove(); return; } // 토글

    const lang = getLang();

    // AI 뷰티 6종 (단일 실행, 옵션 없음)
    const beautyItems = [
        { action:'smart_beauty', icon:'✨', l:lang==='ja'?'ワンクリック':lang==='en'?'One-click':'원클릭 뷰티', g:['#fce4ec','#f48fb1'] },
        { action:'face_beauty_pro', icon:'🧴', l:lang==='ja'?'肌補正':lang==='en'?'Skin Fix':'피부 보정', g:['#fff3e0','#ffcc80'] },
        { action:'smart_skin', icon:'🫧', l:lang==='ja'?'シミ除去':lang==='en'?'Blemish':'잡티 제거', g:['#e8f5e9','#a5d6a7'] },
        { action:'face_enhancer', icon:'⚡', l:lang==='ja'?'顔鮮明化':lang==='en'?'Sharpen':'얼굴 선명화', g:['#e3f2fd','#90caf9'] },
        { action:'face_slimming', icon:'🪄', l:lang==='ja'?'顔スリム':lang==='en'?'Slim':'얼굴 슬리밍', g:['#f3e5f5','#ce93d8'] },
        { action:'skin_analysis', icon:'🔬', l:lang==='ja'?'肌分析':lang==='en'?'Analyze':'피부 분석', g:['#e0f7fa','#80deea'] },
    ];

    const _t3 = (kr,ja,en) => lang==='ja'?ja:lang==='en'?en:kr;
    const categories = [
        { action:'cartoon', icon:'🎨', label: _t3('만화 스타일','漫画スタイル','Cartoon'),
          options: [
            { v:'3d_cartoon', l:'3D', g:['#e3f2fd','#90caf9'] }, { v:'pixar', l:'Pixar', g:['#fce4ec','#f48fb1'] },
            { v:'anime', l:_t3('애니메','アニメ','Anime'), g:['#f3e5f5','#ce93d8'] }, { v:'sketch', l:_t3('스케치','スケッチ','Sketch'), g:['#eceff1','#b0bec5'] },
            { v:'comic', l:_t3('코믹','コミック','Comic'), g:['#fff3e0','#ffcc80'] }, { v:'handdrawn', l:_t3('손그림','手描き','Hand-drawn'), g:['#e8f5e9','#a5d6a7'] },
            { v:'3d_game', l:'3D Game', g:['#e1f5fe','#4fc3f7'] }, { v:'classic_cartoon', l:_t3('클래식','クラシック','Classic'), g:['#fbe9e7','#ffab91'] },
          ]},
        { action:'emotion', icon:'😊', label: _t3('표정 변환','表情変換','Expression'),
          options: [
            { v:'10', l:_t3('미소','微笑み','Smile'), g:['#fce4ec','#f48fb1'] }, { v:'12', l:_t3('활짝','笑顔','Grin'), g:['#fff9c4','#ffee58'] },
            { v:'13', l:_t3('함박','大笑い','Laugh'), g:['#fff3e0','#ffcc80'] }, { v:'14', l:_t3('쿨','クール','Cool'), g:['#e3f2fd','#90caf9'] },
            { v:'15', l:_t3('슬픔','悲しみ','Sad'), g:['#e8eaf6','#9fa8da'] }, { v:'100', l:_t3('눈뜨기','目を開ける','Open Eyes'), g:['#e0f2f1','#80cbc4'] },
          ]},
        { action:'age_gender', icon:'👤', label: _t3('나이/성별','年齢/性別','Age/Gender'),
          options: [
            { v:'TO_KID', l:_t3('어린이','子供','Kid'), g:['#fff9c4','#ffee58'] }, { v:'TO_OLD', l:_t3('노인','老人','Old'), g:['#efebe9','#bcaaa4'] },
            { v:'TO_FEMALE', l:_t3('여성','女性','Female'), g:['#fce4ec','#f48fb1'] }, { v:'TO_MALE', l:_t3('남성','男性','Male'), g:['#e3f2fd','#90caf9'] },
          ]},
        { action:'face_filter', icon:'✨', label: _t3('얼굴 필터','フィルター','Filter'),
          options: [
            { v:'10001', l:_t3('내추럴','ナチュラル','Natural'), g:['#e8f5e9','#a5d6a7'] }, { v:'10002', l:_t3('화이트닝','美白','Whiten'), g:['#fce4ec','#f8bbd0'] },
            { v:'10015', l:_t3('레트로','レトロ','Retro'), g:['#fff3e0','#ffcc80'] }, { v:'10020', l:_t3('시네마','シネマ','Cinema'), g:['#e8eaf6','#9fa8da'] },
            { v:'10025', l:_t3('빈티지','ビンテージ','Vintage'), g:['#efebe9','#bcaaa4'] }, { v:'10030', l:_t3('따뜻한 톤','暖色','Warm'), g:['#fff9c4','#ffcc80'] },
            { v:'10050', l:_t3('모노크롬','モノクロ','Mono'), g:['#eceff1','#90a4ae'] },
          ]},
    ];

    let html = '<div id="psRetouchPanel" class="ps-retouch-panel">';

    // AI 뷰티 6종 (맨 위)
    const beautyLabel = lang==='ja'?'AI ビューティー':lang==='en'?'AI Beauty':'AI 뷰티';
    html += `<div class="ps-rt-cat">
        <div class="ps-rt-cat-title">💎 ${beautyLabel}</div>
        <div class="ps-rt-grid">`;
    beautyItems.forEach(b => {
        html += `<button class="ps-rt-card" data-action="${b.action}" data-value="" data-label="${b.l}" data-icon="${b.icon}" data-thumbstyle="background:linear-gradient(135deg,${b.g[0]},${b.g[1]});font-size:22px;display:flex;align-items:center;justify-content:center;">
            <div class="ps-rt-thumb" style="background:linear-gradient(135deg,${b.g[0]},${b.g[1]});font-size:22px;display:flex;align-items:center;justify-content:center;">${b.icon}</div>
            <span>${b.l}</span>
        </button>`;
    });
    html += `</div></div>`;

    // 나머지 카테고리
    categories.forEach(cat => {
        html += `<div class="ps-rt-cat">
            <div class="ps-rt-cat-title">${cat.icon} ${cat.label}</div>
            <div class="ps-rt-grid">`;
        cat.options.forEach(opt => {
            const g = opt.g || ['#e2e8f0','#cbd5e1'];
            html += `<button class="ps-rt-card" data-action="${cat.action}" data-value="${opt.v}" data-label="${opt.l}" data-icon="" data-thumbstyle="background:linear-gradient(135deg,${g[0]},${g[1]})">
                <div class="ps-rt-thumb" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></div>
                <span>${opt.l}</span>
            </button>`;
        });
        html += `</div></div>`;
    });
    html += '</div>';

    const btnRow = document.getElementById('psRetouchBtn')?.closest('.ps-tool-section');
    if (btnRow) btnRow.insertAdjacentHTML('afterend', html);

    document.getElementById('psRetouchPanel')?.querySelectorAll('.ps-rt-card').forEach(b => {
        b.addEventListener('click', () => _psRunRetouch(b.dataset.action, b.dataset.value, b));
    });
}

async function _psRunRetouch(action, value, btnEl) {
    if (btnEl) { btnEl.disabled = true; const th = btnEl.querySelector('.ps-rt-thumb'); if(th) th.innerHTML = '⏳'; }

    // 되돌리기용 히스토리 저장
    _psHistory.push(_psRawDataUrl);
    if (_psHistory.length > 20) _psHistory.shift();

    try {
        const _sb = window.sb;
        if (!_sb) throw new Error('DB not ready');

        // 파라미터 구성
        const paramKeys = { cartoon:'type', emotion:'service_choice', age_gender:'action_type', face_filter:'resource_type', hairstyle:'hair_style' };
        const params = { [paramKeys[action] || 'type']: value };

        // 이미지를 base64로
        const res = await fetch(_psRawDataUrl);
        const blob = await res.blob();
        const base64 = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result.split(',')[1]); rd.readAsDataURL(blob); });

        const { data, error } = await _sb.functions.invoke('portrait-retouch', {
            body: { action, image_base64: base64, params }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data && data.image_base64) {
            _psRawDataUrl = 'data:image/png;base64,' + data.image_base64;
            await _psApplyText();
            document.getElementById('psPreviewImg').src = _psImgDataUrl;
            if (btnEl) { btnEl.classList.add('ps-rt-done'); const th = btnEl.querySelector('.ps-rt-thumb'); if(th) th.innerHTML = '✅'; }
        } else if (data && data.image_url) {
            // URL → fetch → dataUrl
            const imgRes = await fetch(data.image_url);
            const imgBlob = await imgRes.blob();
            _psRawDataUrl = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(imgBlob); });
            await _psApplyText();
            document.getElementById('psPreviewImg').src = _psImgDataUrl;
            if (btnEl) { btnEl.classList.add('ps-rt-done'); const th = btnEl.querySelector('.ps-rt-thumb'); if(th) th.innerHTML = '✅'; }
        } else throw new Error(data?.error || 'No result');
    } catch(e) {
        console.error('Retouch error:', e);
        _psHistory.pop(); // 실패 시 히스토리 롤백
        if (btnEl) { const th = btnEl.querySelector('.ps-rt-thumb'); if(th) th.innerHTML = '❌'; setTimeout(() => { btnEl.disabled = false; btnEl.classList.remove('ps-rt-done'); if(th) th.innerHTML = btnEl.dataset.icon || ''; }, 2000); }
    }
}

// Alpha 후처리 (Alpha Matting + Threshold + Median Filter 3x3)
function _psPostProcessAlpha(imageBlob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);

            const imageData = ctx.getImageData(0, 0, c.width, c.height);
            const d = imageData.data;
            const w = c.width, h = c.height;

            // 1단계: Alpha Matting 경계 처리 (fg=240, bg=10)
            for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 10) { d[i] = 0; d[i-3] = 0; d[i-2] = 0; d[i-1] = 0; }
                else if (d[i] > 240) { d[i] = 255; }
            }
            // 2단계: 미세 투명도 정리 (<25→투명, >230→불투명)
            for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 25) { d[i] = 0; d[i-3] = 0; d[i-2] = 0; d[i-1] = 0; }
                else if (d[i] > 230) { d[i] = 255; }
            }
            // 3단계: Median Filter 3x3 (알파 채널 노이즈 제거)
            const alphaOrig = new Uint8Array(w * h);
            for (let i = 0; i < alphaOrig.length; i++) alphaOrig[i] = d[i * 4 + 3];
            const nb = new Uint8Array(9);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    let ni = 0;
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++)
                            nb[ni++] = alphaOrig[(y + dy) * w + (x + dx)];
                    nb.sort();
                    const idx = (y * w + x) * 4;
                    d[idx + 3] = nb[4];
                    if (nb[4] === 0) { d[idx] = 0; d[idx+1] = 0; d[idx+2] = 0; }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            c.toBlob((blob) => resolve(blob), 'image/png');
        };
        img.onerror = () => reject(new Error('Alpha post-process failed'));
        img.src = URL.createObjectURL(imageBlob);
    });
}

async function _psUndo() {
    if (_psHistory.length === 0) {
        // 히스토리 없으면 원본으로 복원
        _psRawDataUrl = _psOrigDataUrl;
    } else {
        _psRawDataUrl = _psHistory.pop();
    }
    await _psApplyText();
    const preview = document.getElementById('psPreviewImg');
    if (preview) preview.src = _psImgDataUrl;

    // 보정 버튼 체크 상태 리셋 (다시 클릭 가능하게)
    document.querySelectorAll('#psRetouchPanel .ps-rt-card').forEach(b => {
        b.disabled = false;
        b.classList.remove('ps-rt-done');
        const th = b.querySelector('.ps-rt-thumb');
        if (th) {
            // 아이콘 복원
            th.innerHTML = b.dataset.icon || '';
            if (b.dataset.thumbstyle) th.setAttribute('style', b.dataset.thumbstyle);
        }
    });
}

// 키링용 자동 누끼 (버튼 없이 자동 실행)
async function _psAutoRemoveBg() {
    if (_psNoBgDataUrl) return; // 이미 누끼 완료
    const preview = document.getElementById('psPreviewImg');
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'psAutoRemoveLoading';
    loadingMsg.style.cssText = 'text-align:center;padding:12px;font-size:12px;color:#6366f1;';
    loadingMsg.innerHTML = '⏳ ' + (getLang()==='ja'?'背景除去中...':getLang()==='en'?'Removing background...':'배경 제거 중...');
    document.getElementById('psSizingArea')?.before(loadingMsg);
    try {
        const img = new Image();
        await new Promise(r => { img.onload = r; img.src = _psRawDataUrl; });
        const srcCvs = document.createElement('canvas');
        srcCvs.width = img.width; srcCvs.height = img.height;
        srcCvs.getContext('2d').drawImage(img, 0, 0);
        const base64 = srcCvs.toDataURL('image/png').split(',')[1];
        const _sb = window.sb;
        if (!_sb) throw new Error('DB not ready');
        const { data, error } = await _sb.functions.invoke('bg-remove', { body: { image_base64: base64 } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data?.image_base64) throw new Error('No result');
        const rawBlob = await (await fetch('data:image/png;base64,' + data.image_base64)).blob();
        const processedBlob = await _psPostProcessAlpha(rawBlob);
        const rImg = new Image();
        const pUrl = URL.createObjectURL(processedBlob);
        await new Promise(r => { rImg.onload = r; rImg.src = pUrl; });
        URL.revokeObjectURL(pUrl);
        const pngCvs = document.createElement('canvas');
        pngCvs.width = rImg.width; pngCvs.height = rImg.height;
        pngCvs.getContext('2d').drawImage(rImg, 0, 0);
        _psNoBgDataUrl = pngCvs.toDataURL('image/png');
        // 히스토리에 이전 상태 저장
        _psHistory.push(_psRawDataUrl);
        // 투명 PNG를 현재 이미지로 (배경 없이)
        _psRawDataUrl = _psNoBgDataUrl;
        await _psApplyText();
        if (preview) preview.src = _psImgDataUrl;
        // 누끼 버튼도 완료 상태로
        const btn = document.getElementById('psRemoveBg');
        if (btn) { btn.textContent = '✅ ' + ps('removeBg'); btn.style.background = '#10b981'; btn.style.color = '#fff'; btn.disabled = true; }
    } catch(e) {
        console.warn('[PS] Auto bg-remove failed:', e);
    }
    loadingMsg.remove();
}

async function _psRemoveBg() {
    const btn = document.getElementById('psRemoveBg');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '⏳ ' + ps('removingBg');

    // 되돌리기용 히스토리 저장
    _psHistory.push(_psRawDataUrl);
    if (_psHistory.length > 20) _psHistory.shift();

    try {
        // 이미지를 base64로 변환
        const img = new Image();
        await new Promise((resolve) => { img.onload = resolve; img.src = _psRawDataUrl; });
        const srcCvs = document.createElement('canvas');
        srcCvs.width = img.width; srcCvs.height = img.height;
        srcCvs.getContext('2d').drawImage(img, 0, 0);
        const base64 = srcCvs.toDataURL('image/png').split(',')[1];

        // Edge Function 호출 (서버에서 HF API key 관리)
        const _sb = window.sb;
        if (!_sb) throw new Error('Supabase not ready');
        const { data, error } = await _sb.functions.invoke('bg-remove', {
            body: { image_base64: base64 }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!data || !data.image_base64) throw new Error('No result');

        // Alpha 후처리 (Alpha Matting + Threshold + Median Filter)
        btn.textContent = '⏳ Alpha 처리중...';
        const rawBlob = await (await fetch('data:image/png;base64,' + data.image_base64)).blob();
        const processedBlob = await _psPostProcessAlpha(rawBlob);

        // 투명 PNG를 저장 (배경색 변경시 재합성용)
        const rImg = new Image();
        const processedUrl = URL.createObjectURL(processedBlob);
        await new Promise((resolve) => {
            rImg.onload = resolve;
            rImg.src = processedUrl;
        });
        URL.revokeObjectURL(processedUrl);

        // 투명 PNG 저장
        const pngCvs = document.createElement('canvas');
        pngCvs.width = rImg.width; pngCvs.height = rImg.height;
        pngCvs.getContext('2d').drawImage(rImg, 0, 0);
        _psNoBgDataUrl = pngCvs.toDataURL('image/png');

        // 배경색 위에 합성
        const cvs = document.createElement('canvas');
        cvs.width = rImg.width; cvs.height = rImg.height;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = _psBgColor || '#ffffff';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(rImg, 0, 0);

        _psRawDataUrl = cvs.toDataURL('image/jpeg', 0.92);
        await _psApplyText();
        document.getElementById('psPreviewImg').src = _psImgDataUrl;
        btn.textContent = '✅ ' + ps('removeBg');
        btn.style.background = '#10b981';
        btn.style.color = '#fff';
    } catch (e) {
        console.error('BG remove error:', e);
        btn.textContent = '❌ ' + ps('removeBg');
        btn.style.background = '#ef4444';
        btn.style.color = '#fff';
        setTimeout(() => { btn.textContent = '✂️ ' + ps('removeBg'); btn.style.background = ''; btn.style.color = ''; btn.disabled = false; }, 3000);
    }
}

function _psGoToEditor() {
    // 에디터로 이동: 사진 + 선택된 사이즈를 가지고
    const selBtn = document.querySelector('#psSizingArea .ps-sz.active');
    let wMM = 300, hMM = Math.round(300 / _psImgRatio);
    if (selBtn && selBtn.dataset.w) {
        wMM = parseInt(selBtn.dataset.w);
        hMM = parseInt(selBtn.dataset.h);
    }
    // 이미지를 전역에 저장 (에디터가 읽을 수 있게)
    try { sessionStorage.setItem('ps_artwork', _psImgDataUrl); } catch(e) {}
    window._photoStudioImage = _psImgDataUrl;
    window._photoStudioSize = { w: wMM, h: hMM };

    // 스튜디오 종료 + 에디터 시작
    exitStudioMode();
    setTimeout(async () => {
        if (window.startEditorDirect) {
            await window.startEditorDirect('custom', wMM, hMM);
            // 에디터 캔버스 준비 대기
            _psWaitForCanvasAndInsert();
        }
    }, 300);
}

function _psWaitForCanvasAndInsert(retries = 0) {
    if (retries > 20) return; // 최대 10초
    const cvs = window.canvas;
    const imgData = window._photoStudioImage;
    if (!cvs || !imgData) {
        setTimeout(() => _psWaitForCanvasAndInsert(retries + 1), 500);
        return;
    }
    // board가 준비될 때까지 대기
    const board = cvs.getObjects().find(o => o.isBoardBackground);
    if (!board) {
        setTimeout(() => _psWaitForCanvasAndInsert(retries + 1), 500);
        return;
    }
    // 이미지 삽입
    fabric.Image.fromURL(imgData, (fImg) => {
        if (!fImg) return;
        const scale = Math.min(board.width / fImg.width, board.height / fImg.height);
        fImg.set({
            left: board.left + (board.width - fImg.width * scale) / 2,
            top: board.top + (board.height - fImg.height * scale) / 2,
            scaleX: scale,
            scaleY: scale
        });
        cvs.add(fImg);
        cvs.setActiveObject(fImg);
        cvs.renderAll();
        window._photoStudioImage = null; // 한번만 삽입
    }, { crossOrigin: 'anonymous' });
}

function _psShowSizing(key) {
    _psSelectedProduct = key;
    const isFabric = (key === 'fabric');
    const isPaper = (key === 'paper');
    const isHoneycomb = (key === 'honeycomb');
    const isBlind = (key === 'blind');
    const isKeyring = (key === 'keyring');
    const isTshirt = (key === 'tshirt');
    const defaultW = isKeyring ? 50 : 300;
    const defaultH = isKeyring ? 50 : Math.round(defaultW / _psImgRatio);

    // 상품별 옵션 HTML
    let optionsHtml = '';
    if (isFabric) {
        optionsHtml = `<div id="psFabricSewArea" class="ps-sewing-section" style="margin-top:8px;"></div>`;
    } else if (isPaper) {
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">📋 ${ps('paperOpt')}</div>
            <div class="ps-opt-row">
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="matte" checked> ${getLang()==='ja'?'マット紙':getLang()==='en'?'Matte':'무광지'}</label>
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="glossy"> ${getLang()==='ja'?'光沢紙':getLang()==='en'?'Glossy':'유광지'}</label>
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="semi"> ${getLang()==='ja'?'半光沢':getLang()==='en'?'Semi-Glossy':'반광지'}</label>
            </div>
        </div>`;
    } else if (isHoneycomb) {
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🧱 ${ps('standOpt')}</div>
            <div class="ps-opt-row">
                <label class="ps-opt-item"><input type="radio" name="psStandOpt" value="none" checked> ${getLang()==='ja'?'なし':getLang()==='en'?'None':'없음'}</label>
                <label class="ps-opt-item"><input type="radio" name="psStandOpt" value="stand"> ${getLang()==='ja'?'スタンド付き':getLang()==='en'?'With Stand':'받침대 포함'}</label>
            </div>
        </div>`;
    } else if (isBlind) {
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🔧 ${ps('handleOpt')}</div>
            <div class="ps-opt-row">
                <label class="ps-opt-item"><input type="radio" name="psHandleOpt" value="left" checked> ${ps('handleL')}</label>
                <label class="ps-opt-item"><input type="radio" name="psHandleOpt" value="right"> ${ps('handleR')}</label>
            </div>
        </div>`;
    } else if (isKeyring) {
        const lang = getLang();
        const holeLabels = {
            top: lang==='ja'?'上':lang==='en'?'Top':'상',
            left: lang==='ja'?'左':lang==='en'?'Left':'좌',
            right: lang==='ja'?'右':lang==='en'?'Right':'우',
            bottom: lang==='ja'?'下':lang==='en'?'Bottom':'하',
        };
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🔑 ${lang==='ja'?'3mmアクリルキーリング':lang==='en'?'3mm Acrylic Keyring':'3mm 아크릴키링'}</div>
            <div id="psKeyringPreview" style="margin:8px auto;text-align:center;background:#f1f5f9;border-radius:10px;padding:8px;"></div>
            <div class="ps-tool-label" style="margin-top:8px;">📍 ${lang==='ja'?'穴の位置':lang==='en'?'Hole Position':'고리 위치'}</div>
            <div style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;">
                ${['top','left','right','bottom'].map((pos,i) => `<label class="ps-opt-item" style="min-width:40px;text-align:center;"><input type="radio" name="psHolePos" value="${pos}"${i===0?' checked':''}> ${holeLabels[pos]}</label>`).join('')}
            </div>
            <div class="ps-tool-label" style="margin-top:8px;">🪝 ${lang==='ja'?'リング選択':lang==='en'?'Ring Type':'고리 선택'}</div>
            <div id="psKeyringRings" style="margin:6px 0;"><span style="font-size:10px;color:#94a3b8;">Loading...</span></div>
        </div>`;
    } else if (isTshirt) {
        const lang = getLang();
        const tColors = [
            {hex:'#ffffff',name:'White'},{hex:'#000000',name:'Black'},{hex:'#1e3a5f',name:'Navy'},
            {hex:'#cccccc',name:'Gray'},{hex:'#c0392b',name:'Red'},{hex:'#f39c12',name:'Yellow'},
            {hex:'#27ae60',name:'Green'},{hex:'#e8d5b7',name:'Beige'},{hex:'#8e44ad',name:'Purple'},
            {hex:'#2980b9',name:'Blue'},{hex:'#ff69b4',name:'Pink'},{hex:'#d35400',name:'Orange'},
        ];
        const sizes = ['S','M','L','XL','2XL'];
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🎨 ${lang==='ja'?'カラー':lang==='en'?'Color':'컬러'}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
                ${tColors.map((c,i) => `<div class="ps-tshirt-color${i===0?' active':''}" data-color="${c.hex}" style="width:28px;height:28px;border-radius:50%;background:${c.hex};border:2px solid ${i===0?'#7c3aed':'#e2e8f0'};cursor:pointer;" title="${c.name}"></div>`).join('')}
            </div>
            <div class="ps-tool-label" style="margin-top:6px;">📏 ${lang==='ja'?'サイズ':lang==='en'?'Size':'사이즈'}</div>
            <div style="display:flex;gap:6px;margin:6px 0;">
                ${sizes.map((s,i) => `<label class="ps-opt-item" style="min-width:36px;text-align:center;"><input type="radio" name="psTshirtSize" value="${s}"${i===2?' checked':''}> ${s}</label>`).join('')}
            </div>
            <div id="psTshirtMockup" style="margin:10px auto;text-align:center;"></div>
        </div>`;
    }

    // 키링/티셔츠는 사이즈 입력 불필요 (고정 가격)
    const showSizeInput = !isKeyring && !isTshirt;

    const sizeInputHtml = showSizeInput ? `
        <div class="ps-tool-label">📐 ${ps('size')}</div>
        <div class="ps-size-input-row">
            <div class="ps-size-field">
                <label>${ps('width')}</label>
                <div class="ps-size-input-wrap">
                    <input type="number" id="psCW" class="ps-size-in" min="50" max="5000" value="${defaultW}">
                    <span class="ps-size-unit">mm</span>
                </div>
            </div>
            <span class="ps-size-x">×</span>
            <div class="ps-size-field">
                <label>${ps('height')}</label>
                <div class="ps-size-input-wrap">
                    <input type="number" id="psCH" class="ps-size-in" min="50" max="5000" value="${defaultH}">
                    <span class="ps-size-unit">mm</span>
                </div>
            </div>
        </div>` : `
        <input type="hidden" id="psCW" value="${defaultW}">
        <input type="hidden" id="psCH" value="${defaultH}">`;

    document.getElementById('psSizingArea').innerHTML = `
        <div class="ps-tool-section" style="margin-top:6px;">
            ${sizeInputHtml}
            ${optionsHtml}
            <div id="psPriceOut"></div>
        </div>
    `;

    const cwEl = document.getElementById('psCW');
    const chEl = document.getElementById('psCH');

    if (showSizeInput) {
        // 가로 입력 → 세로 자동
        cwEl?.addEventListener('input', () => {
            const w = parseInt(cwEl.value);
            if (w >= 50 && !chEl.dataset.manual) {
                chEl.value = Math.round(w / _psImgRatio);
                _psUpdatePrice();
            } else if (w >= 50) _psUpdatePrice();
            if (isFabric) _psCheckFabricWidth();
        });
        // 세로 입력 → 가로 자동
        chEl?.addEventListener('input', () => {
            const h = parseInt(chEl.value);
            if (h >= 50) {
                chEl.dataset.manual = '1';
                if (!cwEl.value) cwEl.value = Math.round(h * _psImgRatio);
                _psUpdatePrice();
            }
            if (isFabric) _psCheckFabricWidth();
        });
        // 세로 필드 비우면 자동모드 복원
        chEl?.addEventListener('change', () => {
            if (!chEl.value) { delete chEl.dataset.manual; }
        });
    }

    // 패브릭이면 미싱 옵션 로드
    if (isFabric) _psLoadFabricSewing();

    // 티셔츠 목업 렌더링 + 컬러 선택 이벤트
    if (isTshirt) {
        _psTshirtColor = '#ffffff';
        _psRenderTshirtMockup();
        document.querySelectorAll('.ps-tshirt-color').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.ps-tshirt-color').forEach(e => e.style.border = '2px solid #e2e8f0');
                el.style.border = '2px solid #7c3aed';
                el.classList.add('active');
                _psTshirtColor = el.dataset.color;
                _psRenderTshirtMockup();
            });
        });
    }

    // 키링이면 칼선 미리보기 + 고리 옵션 로드
    if (isKeyring) {
        _psKeyringHolePos = 'top';
        _psRenderKeyringPreview();
        document.querySelectorAll('input[name="psHolePos"]').forEach(r => {
            r.addEventListener('change', () => { _psKeyringHolePos = r.value; _psRenderKeyringPreview(); });
        });
        _psLoadKeyringRings();
    }

    // 가격 즉시 계산
    _psUpdatePrice();
    scrollChat();
}

// ─── 키링 칼선 미리보기 + 고리 옵션 ───
let _psKeyringHolePos = 'top';
let _psSelectedRing = null;

function _psRenderKeyringPreview() {
    const container = document.getElementById('psKeyringPreview');
    if (!container || !_psImgDataUrl) return;

    const W = 220, H = 220;
    let cvs = container.querySelector('canvas');
    if (!cvs) {
        cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.maxWidth = '100%';
        cvs.style.borderRadius = '8px';
        container.innerHTML = '';
        container.appendChild(cvs);
    }
    const ctx = cvs.getContext('2d');

    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, W, H);
        // 체크보드 배경
        for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
            ctx.fillStyle = ((Math.floor(x/8)+Math.floor(y/8))%2===0) ? '#f8f8f8':'#e8e8e8';
            ctx.fillRect(x, y, 8, 8);
        }

        // 이미지 영역 (고리 공간 확보)
        const holePad = 30;
        let availX = 15, availY = 15, availW = W - 30, availH = H - 30;
        const pos = _psKeyringHolePos;
        if (pos === 'top') { availY += holePad; availH -= holePad; }
        else if (pos === 'bottom') { availH -= holePad; }
        else if (pos === 'left') { availX += holePad; availW -= holePad; }
        else if (pos === 'right') { availW -= holePad; }

        const scale = Math.min(availW / img.width, availH / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        const dx = availX + (availW - dw) / 2;
        const dy = availY + (availH - dh) / 2;

        // 아크릴 외곽 (blur+threshold)
        _psDrawAcrylicOutline(ctx, img, dx, dy, dw, dh);

        // 이미지
        ctx.drawImage(img, dx, dy, dw, dh);

        // 고리 구멍
        let hx, hy;
        if (pos === 'top') { hx = dx + dw/2; hy = dy - 18; }
        else if (pos === 'bottom') { hx = dx + dw/2; hy = dy + dh + 18; }
        else if (pos === 'left') { hx = dx - 18; hy = dy + dh/2; }
        else { hx = dx + dw + 18; hy = dy + dh/2; }

        // 연결 바
        const cx = dx + dw/2, cy = dy + dh/2;
        // 이미지 가장자리의 연결점
        let connX = hx, connY = hy;
        if (pos === 'top') connY = dy;
        else if (pos === 'bottom') connY = dy + dh;
        else if (pos === 'left') connX = dx;
        else connX = dx + dw;

        ctx.beginPath();
        ctx.moveTo(connX, connY);
        ctx.lineTo(hx, hy);
        ctx.strokeStyle = 'rgba(200,200,200,0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // 고리 구멍 (외곽원 + 내부원)
        const outerR = 12, innerR = 7;
        ctx.beginPath();
        ctx.arc(hx, hy, outerR, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(200,200,200,0.3)';
        ctx.fill();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3,2]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(hx, hy, innerR, 0, Math.PI*2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 칼선 (빨간 점선 외곽)
        _psDrawCutline(ctx, img, dx, dy, dw, dh);
    };
    img.src = _psNoBgDataUrl || _psRawDataUrl;
}

function _psDrawAcrylicOutline(ctx, img, dx, dy, dw, dh) {
    const tmpW = Math.round(dw + 16), tmpH = Math.round(dh + 16);
    const tc = document.createElement('canvas');
    tc.width = tmpW; tc.height = tmpH;
    const tctx = tc.getContext('2d');
    tctx.drawImage(img, 8, 8, dw, dh);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, tmpW, tmpH);

    const ec = document.createElement('canvas');
    ec.width = tmpW; ec.height = tmpH;
    const ectx = ec.getContext('2d');
    ectx.filter = 'blur(5px)';
    ectx.drawImage(tc, 0, 0);
    ectx.drawImage(ec, 0, 0);
    ectx.filter = 'none';

    const id = ectx.getImageData(0, 0, tmpW, tmpH);
    for (let i = 3; i < id.data.length; i += 4) id.data[i] = id.data[i] > 15 ? 255 : 0;
    ectx.putImageData(id, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(ec, dx - 8, dy - 8);
    ctx.globalAlpha = 1;
    ctx.restore();
}

function _psDrawCutline(ctx, img, dx, dy, dw, dh) {
    const tmpW = Math.round(dw + 16), tmpH = Math.round(dh + 16);
    const tc = document.createElement('canvas');
    tc.width = tmpW; tc.height = tmpH;
    const tctx = tc.getContext('2d');
    tctx.drawImage(img, 8, 8, dw, dh);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, tmpW, tmpH);

    const ec = document.createElement('canvas');
    ec.width = tmpW; ec.height = tmpH;
    const ectx = ec.getContext('2d');
    ectx.filter = 'blur(5px)';
    ectx.drawImage(tc, 0, 0);
    ectx.drawImage(ec, 0, 0);
    ectx.filter = 'none';

    const id = ectx.getImageData(0, 0, tmpW, tmpH);
    const d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 15 ? 255 : 0;
    ectx.putImageData(id, 0, 0);

    // edge 추출 (외곽 - erode)
    const imgData2 = ectx.getImageData(0, 0, tmpW, tmpH);
    const copy = new Uint8ClampedArray(imgData2.data);
    // erode 1px
    for (let y = 1; y < tmpH-1; y++) for (let x = 1; x < tmpW-1; x++) {
        const idx = (y * tmpW + x) * 4 + 3;
        if (copy[idx] === 0) continue;
        let edge = false;
        for (let dy = -1; dy <= 1 && !edge; dy++)
            for (let ddx = -1; ddx <= 1 && !edge; ddx++)
                if (copy[((y+dy)*tmpW+(x+ddx))*4+3] === 0) edge = true;
        if (!edge) imgData2.data[idx] = 0;
    }
    // 빨간색으로
    for (let i = 0; i < imgData2.data.length; i += 4) {
        if (imgData2.data[i+3] > 0) {
            imgData2.data[i] = 255; imgData2.data[i+1] = 0; imgData2.data[i+2] = 0; imgData2.data[i+3] = 180;
        }
    }
    ectx.putImageData(imgData2, 0, 0);

    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.drawImage(ec, dx - 8, dy - 8);
    ctx.setLineDash([]);
    ctx.restore();
}

async function _psLoadKeyringRings() {
    const container = document.getElementById('psKeyringRings');
    if (!container) return;
    const lang = getLang();

    try {
        const _sb = window.sb;
        if (!_sb) throw new Error('DB not ready');

        // opt_8796 카테고리에서 고리 옵션 조회
        const { data: addons, error } = await _sb.from('admin_addons')
            .select('code, name, display_name, price, image_url, is_swatch')
            .eq('category_code', 'opt_8796')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        if (!addons || addons.length === 0) {
            container.innerHTML = `<span style="font-size:10px;color:#94a3b8;">${lang==='ja'?'リングオプションなし':lang==='en'?'No ring options':'고리 옵션 없음'}</span>`;
            return;
        }

        let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        addons.forEach((ring, i) => {
            const name = ring.display_name || ring.name;
            const priceStr = ring.price > 0 ? ` +${ring.price.toLocaleString()}` : '';
            const imgStyle = ring.image_url ? `background-image:url(${ring.image_url});background-size:cover;background-position:center;` : 'background:#e2e8f0;';
            html += `<div class="ps-ring-opt${i===0?' active':''}" data-code="${ring.code}" data-price="${ring.price||0}" data-name="${name}" style="cursor:pointer;text-align:center;border:2px solid ${i===0?'#7c3aed':'#e2e8f0'};border-radius:8px;padding:4px;width:60px;transition:all .2s;">
                <div style="width:48px;height:48px;border-radius:6px;margin:0 auto 3px;${imgStyle}"></div>
                <div style="font-size:9px;font-weight:600;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                <div style="font-size:8px;color:#94a3b8;">${priceStr || 'Free'}</div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;

        // 첫 번째 자동 선택
        _psSelectedRing = addons[0];

        // 클릭 이벤트
        container.querySelectorAll('.ps-ring-opt').forEach(el => {
            el.addEventListener('click', () => {
                container.querySelectorAll('.ps-ring-opt').forEach(e => e.style.border = '2px solid #e2e8f0');
                el.style.border = '2px solid #7c3aed';
                el.classList.add('active');
                _psSelectedRing = addons.find(a => a.code === el.dataset.code) || null;
            });
        });
    } catch (e) {
        console.warn('[PS] Ring load failed:', e);
        container.innerHTML = `<span style="font-size:10px;color:#94a3b8;">${lang==='ja'?'基本キーリングで出荷されます':lang==='en'?'Ships with default keyring hook':'기본 키링고리로 출고됩니다'}</span>`;
    }
}

// ─── 티셔츠 목업 렌더링 (드래그/리사이즈) ───
let _tsMockupImg = null;    // 캐시된 사용자 이미지
let _tsImgX = 0, _tsImgY = 0, _tsImgScale = 1; // 이미지 위치/크기

function _psTshirtPath(ctx, W, H) {
    // 각진 소매 티셔츠 실루엣
    const cx = W / 2;
    ctx.beginPath();
    // 왼쪽 소매 끝 (각진 꼭짓점)
    ctx.moveTo(8, 110);
    // 왼쪽 소매 아래 → 겨드랑이 (직선)
    ctx.lineTo(65, 130);
    // 왼쪽 겨드랑이
    ctx.lineTo(68, 115);
    // 왼쪽 몸통
    ctx.lineTo(68, H - 15);
    // 밑단
    ctx.quadraticCurveTo(cx, H - 5, W - 68, H - 15);
    // 오른쪽 몸통
    ctx.lineTo(W - 68, 115);
    // 오른쪽 겨드랑이 → 소매 아래 (직선)
    ctx.lineTo(W - 65, 130);
    // 오른쪽 소매 끝 (각진 꼭짓점)
    ctx.lineTo(W - 8, 110);
    // 오른쪽 소매 위 → 어깨 (직선)
    ctx.lineTo(W - 68, 42);
    // 오른쪽 어깨
    ctx.lineTo(cx + 28, 25);
    // 목 라인 (U자)
    ctx.quadraticCurveTo(cx + 15, 50, cx, 55);
    ctx.quadraticCurveTo(cx - 15, 50, cx - 28, 25);
    // 왼쪽 어깨
    ctx.lineTo(68, 42);
    // 왼쪽 소매 위 (직선)
    ctx.lineTo(8, 110);
    ctx.closePath();
}

function _psRenderTshirtMockup() {
    const container = document.getElementById('psTshirtMockup');
    if (!container) return;

    const W = 280, H = 320;

    // 첫 렌더링: 캔버스 생성 + 이벤트 바인딩
    let cvs = container.querySelector('canvas');
    if (!cvs) {
        cvs = document.createElement('canvas');
        cvs.width = W; cvs.height = H;
        cvs.style.borderRadius = '12px';
        cvs.style.maxWidth = '100%';
        cvs.style.cursor = 'move';
        cvs.style.touchAction = 'none';
        container.innerHTML = '';
        container.appendChild(cvs);

        // 초기 이미지 위치/크기
        _tsImgX = W / 2; _tsImgY = 155; _tsImgScale = 1;

        // 드래그 이벤트
        let dragging = false, lastX = 0, lastY = 0;
        const getPos = (e) => {
            const r = cvs.getBoundingClientRect();
            const t = e.touches ? e.touches[0] : e;
            return { x: t.clientX - r.left, y: t.clientY - r.top };
        };
        const onDown = (e) => { e.preventDefault(); dragging = true; const p = getPos(e); lastX = p.x; lastY = p.y; };
        const onMove = (e) => {
            if (!dragging) return;
            e.preventDefault();
            const p = getPos(e);
            _tsImgX += (p.x - lastX); _tsImgY += (p.y - lastY);
            lastX = p.x; lastY = p.y;
            _psDrawTshirt(cvs);
        };
        const onUp = () => { dragging = false; };
        cvs.addEventListener('mousedown', onDown);
        cvs.addEventListener('mousemove', onMove);
        cvs.addEventListener('mouseup', onUp);
        cvs.addEventListener('mouseleave', onUp);
        cvs.addEventListener('touchstart', onDown, { passive: false });
        cvs.addEventListener('touchmove', onMove, { passive: false });
        cvs.addEventListener('touchend', onUp);

        // 휠 = 크기 조절
        cvs.addEventListener('wheel', (e) => {
            e.preventDefault();
            _tsImgScale *= e.deltaY < 0 ? 1.08 : 0.92;
            _tsImgScale = Math.max(0.2, Math.min(3, _tsImgScale));
            _psDrawTshirt(cvs);
        }, { passive: false });

        // 사용자 이미지 로드
        const artSrc = _psNoBgDataUrl || _psRawDataUrl || _psImgDataUrl;
        if (artSrc) {
            const img = new Image();
            img.onload = () => { _tsMockupImg = img; _psDrawTshirt(cvs); };
            img.src = artSrc;
        }

        // 크기 조절 슬라이더 추가
        const lang = getLang();
        const ctrl = document.createElement('div');
        ctrl.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;justify-content:center;';
        ctrl.innerHTML = `<span style="font-size:10px;color:#64748b;">🔍</span>
            <input type="range" id="psTsScale" min="20" max="200" value="100" style="width:140px;accent-color:#7c3aed;">
            <span style="font-size:9px;color:#94a3b8;">${lang==='ja'?'ドラッグで移動':lang==='en'?'Drag to move':'드래그로 이동'}</span>`;
        container.appendChild(ctrl);
        document.getElementById('psTsScale')?.addEventListener('input', (e) => {
            _tsImgScale = parseInt(e.target.value) / 100;
            _psDrawTshirt(cvs);
        });
    }

    _psDrawTshirt(cvs);
}

function _psDrawTshirt(cvs) {
    const ctx = cvs.getContext('2d');
    const W = cvs.width, H = cvs.height;
    const color = _psTshirtColor || '#ffffff';

    // 배경 (체크무늬 — 투명 표시)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // 티셔츠 그림자
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    _psTshirtPath(ctx, W, H);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // 티셔츠 채우기 (그림자 없이)
    _psTshirtPath(ctx, W, H);
    ctx.fillStyle = color;
    ctx.fill();

    // 주름/음영 (미묘한 그라데이션 오버레이)
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.03)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.06)');
    _psTshirtPath(ctx, W, H);
    ctx.fillStyle = grad;
    ctx.fill();

    // 클리핑: 사용자 이미지를 티셔츠 안에만 표시
    if (_tsMockupImg) {
        ctx.save();
        _psTshirtPath(ctx, W, H);
        ctx.clip();

        const imgW = _tsMockupImg.width;
        const imgH = _tsMockupImg.height;
        const ratio = imgW / imgH;
        const baseSize = 120;
        let dw = baseSize * _tsImgScale;
        let dh = dw / ratio;
        ctx.drawImage(_tsMockupImg, _tsImgX - dw / 2, _tsImgY - dh / 2, dw, dh);
        ctx.restore();
    }

    // 테두리
    _psTshirtPath(ctx, W, H);
    ctx.strokeStyle = _psLightenDarken(color, -25);
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 색상 밝기 조절 유틸
function _psLightenDarken(hex, amt) {
    if (!hex || !hex.startsWith('#')) return hex;
    let r = parseInt(hex.slice(1,3),16) + amt;
    let g = parseInt(hex.slice(3,5),16) + amt;
    let b = parseInt(hex.slice(5,7),16) + amt;
    r = Math.max(0,Math.min(255,r));
    g = Math.max(0,Math.min(255,g));
    b = Math.max(0,Math.min(255,b));
    return `rgb(${r},${g},${b})`;
}

// 패브릭 미싱 옵션 로드 (DB에서)
async function _psLoadFabricSewing() {
    const area = document.getElementById('psFabricSewArea');
    if (!area) return;
    try {
        const _sb = window.sb;
        if (!_sb) throw new Error('no sb');
        const { data, error } = await _sb.from('admin_addons')
            .select('*')
            .eq('category_code', '2342434')
            .order('sort_order', { ascending: true });
        if (error || !data || data.length === 0) {
            area.innerHTML = '';
            return;
        }

        const lang = getLang();
        const reqMsg = lang === 'ja' ? 'ミシンオプションを1つ選択してください (必須)' :
                       lang === 'en' ? 'Select at least one sewing option (required)' :
                       '미싱옵션을 1개 선택해주세요 (필수)';

        let html = `<div class="ps-tool-label">🧵 ${lang === 'ja' ? 'ミシンオプション' : lang === 'en' ? 'Sewing Option' : '패브릭 미싱'} <span style="color:#ef4444; font-size:10px;">(*)</span></div>`;
        html += `<div style="background:#fef3c7; border-radius:6px; padding:4px 8px; font-size:10px; color:#92400e; margin-bottom:6px;">${reqMsg}</div>`;
        html += `<div class="ps-sewing-options">`;
        data.forEach(addon => {
            const name = lang === 'ja' ? (addon.name_jp || addon.name) :
                         lang === 'en' ? (addon.name_us || addon.name) : addon.name;
            const price = addon.price_kr || addon.price || 0; // always KRW for _psFmtPrice conversion
            const priceStr = _psFmtPrice(price);
            html += `<label class="ps-sew-opt"><input type="radio" name="psSewing" value="${addon.code}" data-price="${addon.price}"> ${name} <span style="color:#7c3aed; font-size:10px;">${priceStr}</span></label>`;
        });
        html += `</div>`;
        area.innerHTML = html;

        // 미싱 선택 시 가격 업데이트
        area.querySelectorAll('input[name="psSewing"]').forEach(r => {
            r.addEventListener('change', () => _psUpdatePrice());
        });

        // 미싱 데이터 저장
        window._psFabricSewAddons = data;
        // 이미 입력된 사이즈가 1300 초과면 이어박기 자동 선택
        _psCheckFabricWidth();
    } catch(e) {
        area.innerHTML = '';
    }
}

// 패브릭 최대폭 1300mm 체크 → 초과 시 이어박기 강제 선택
function _psCheckFabricWidth() {
    const w = parseInt(document.getElementById('psCW')?.value) || 0;
    const h = parseInt(document.getElementById('psCH')?.value) || 0;
    const minDim = Math.min(w, h);  // 짧은 쪽이 폭
    const exceeds = minDim > 1300;

    // 경고 메시지
    let warn = document.getElementById('psFabricWidthWarn');
    if (exceeds && !warn) {
        const lang = getLang();
        const msg = lang==='ja' ? '⚠️ パブリックの最大幅は1300mmです。これを超える場合は「つなぎ縫い」オプションが必要です。' :
                    lang==='en' ? '⚠️ Max fabric width is 1300mm. Seam-joining option is required for wider prints.' :
                    '⚠️ 패브릭 최대폭은 1300mm입니다. 초과 시 이어박기 옵션이 필요합니다.';
        warn = document.createElement('div');
        warn.id = 'psFabricWidthWarn';
        warn.style.cssText = 'background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px 8px;font-size:10px;color:#92400e;margin-top:6px;';
        warn.textContent = msg;
        document.getElementById('psFabricSewArea')?.after(warn);
    } else if (!exceeds && warn) {
        warn.remove();
    }

    // 이어박기 옵션 자동 선택 (이어박기/つなぎ/seam 포함하는 라디오)
    if (exceeds) {
        const radios = document.querySelectorAll('input[name="psSewing"]');
        radios.forEach(r => {
            const label = r.closest('label')?.textContent || '';
            if (label.includes('이어') || label.includes('つなぎ') || label.toLowerCase().includes('seam') || label.toLowerCase().includes('join')) {
                r.checked = true;
                r.dispatchEvent(new Event('change'));
            }
        });
    }
}

function _psUpdatePrice() {
    const w = parseInt(document.getElementById('psCW')?.value);
    const h = parseInt(document.getElementById('psCH')?.value);
    if (w >= 50 && h >= 50) {
        _psCalcPrice(w, h);
    }
}

function _psCalcPrice(w, h) {
    const prod = PS_PRODUCTS[_psSelectedProduct];
    let price;
    if (prod.fixed) {
        // 고정 가격 상품 (키링, 티셔츠)
        price = prod.fixed;
    } else {
        // 회베(면적) 기반 가격
        const area = (w / 1000) * (h / 1000); // m² 면적
        price = Math.round((area * prod.sqm) / 10) * 10;
    }
    if (price < 100) price = 100; // 최소 100원

    // 미싱 옵션 가격 추가
    let sewingPrice = 0;
    const sewingRadio = document.querySelector('input[name="psSewing"]:checked');
    if (sewingRadio) {
        sewingPrice = parseInt(sewingRadio.dataset.price) || 0;
    }
    const totalPrice = price + sewingPrice;

    const isFabric = (_psSelectedProduct === 'fabric');
    const cartLabel = getLang() === 'ja' ? 'カートに入れる' : getLang() === 'en' ? 'Add to Cart' : '장바구니 담기';

    const isFixed = PS_PRODUCTS[_psSelectedProduct]?.fixed;
    const sizeLabel = isFixed ? PS_PRODUCTS[_psSelectedProduct].icon : `${w}×${h}mm`;
    document.getElementById('psPriceOut').innerHTML = `
        <div class="ps-price-bar" style="margin-top:8px;">
            <span class="ps-pl">${sizeLabel}</span>
            <span class="ps-pv">${_psFmtPrice(totalPrice)}</span>
        </div>
        <button class="ps-order-btn" id="psOrderBtn">🛒 ${cartLabel}</button>
    `;
    document.getElementById('psOrderBtn')?.addEventListener('click', () => {
        // 패브릭이면 미싱 필수 확인
        if (isFabric) {
            const checked = document.querySelector('input[name="psSewing"]:checked');
            if (!checked) {
                const msg = getLang() === 'ja' ? 'ミシンオプションを選択してください' :
                            getLang() === 'en' ? 'Please select a sewing option' :
                            '미싱옵션을 선택해주세요';
                alert(msg);
                return;
            }
        }
        // 장바구니 이동 확인
        if (!confirm(ps('cartConfirm'))) return;
        _psGoToCart(w, h, _psSelectedProduct, price);
    });
    scrollChat();
}

async function _psGoToCart(w, h, productKey, basePrice) {
    const prod = PS_PRODUCTS[productKey];
    const names = {
        fabric: { kr:'패브릭 인쇄', ja:'ファブリック印刷', en:'Fabric Print' },
        paper: { kr:'종이 인쇄물', ja:'紙印刷', en:'Paper Print' },
        honeycomb: { kr:'허니콤보드', ja:'ハニカムボード', en:'Honeycomb Board' },
        canvas: { kr:'캔버스 액자', ja:'キャンバス額', en:'Canvas Frame' },
        blind: { kr:'롤블라인드', ja:'ロールブラインド', en:'Roller Blind' },
        banner: { kr:'현수막', ja:'横断幕', en:'Banner' },
        keyring: { kr:'아크릴키링', ja:'アクリルキーリング', en:'Acrylic Keyring' },
        tshirt: { kr:'티셔츠 인쇄', ja:'Tシャツ印刷', en:'T-shirt Print' },
    };
    const lang = getLang();
    const nameObj = names[productKey] || names.fabric;
    const displayName = nameObj[lang] || nameObj.en;
    const _sb = window.sb;

    // ─── 썸네일: Supabase Storage 업로드 ───
    let thumbUrl = null;
    try {
        if (_sb && _psImgDataUrl) {
            // data URL → blob 변환
            const res = await fetch(_psImgDataUrl);
            const origBlob = await res.blob();
            // 리사이즈
            const thumbCvs = document.createElement('canvas');
            const thumbImg = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = _psImgDataUrl;
            });
            thumbCvs.width = 300;
            thumbCvs.height = Math.round(300 / _psImgRatio);
            thumbCvs.getContext('2d').drawImage(thumbImg, 0, 0, thumbCvs.width, thumbCvs.height);
            const blob = await new Promise(r => thumbCvs.toBlob(r, 'image/jpeg', 0.8));
            if (blob) {
                const ts = Date.now();
                const rnd = Math.random().toString(36).substring(2, 8);
                const path = `thumbs/ps_${ts}_${rnd}.jpg`;
                const { error: upErr } = await _sb.storage.from('orders').upload(path, blob);
                if (!upErr) {
                    const { data: pubData } = _sb.storage.from('orders').getPublicUrl(path);
                    thumbUrl = pubData?.publicUrl || null;
                }
            }
        }
    } catch(e) { console.warn('[PS] thumb upload failed:', e); }

    // ─── 실제 상품의 addon 코드를 DB에서 조회 ───
    // 카테고리로 대표 상품을 찾아 addon 코드를 가져옴
    const catSearchMap = {
        fabric: ['ua_fabric', 'fabric'],
        paper: ['ua_paper', 'paper'],
        canvas: ['ua_canvas', 'canvas'],
        honeycomb: ['hb_printing', 'pp_hc_', 'honeycomb'],
        blind: ['pp_bl_', 'blind'],
        banner: ['ua_banner', 'banner'],
        keyring: ['kr_acrylic', 'keyring'],
        tshirt: ['ua_tshirt', 'tshirt'],
    };
    let realAddonStr = '';
    try {
        if (_sb) {
            const cats = catSearchMap[productKey] || [];
            for (const cat of cats) {
                const { data: prodRows } = await _sb.from('admin_products')
                    .select('code, addons, category')
                    .eq('category', cat)
                    .not('addons', 'is', null)
                    .limit(1);
                if (prodRows && prodRows.length > 0 && prodRows[0].addons) {
                    realAddonStr = prodRows[0].addons;
                    console.log(`[PS] Found addons from ${prodRows[0].code} (cat=${cat}): ${realAddonStr}`);
                    break;
                }
            }
        }
    } catch(e) { console.warn('[PS] addon lookup failed:', e); }

    // Photo Studio에서 선택한 옵션 (미리 선택됨)
    const preSelectedCodes = [];
    const preSelectedQtys = {};
    const sewingRadio = document.querySelector('input[name="psSewing"]:checked');
    if (sewingRadio) {
        preSelectedCodes.push(sewingRadio.value);
        preSelectedQtys[sewingRadio.value] = 1;
    }
    // 키링 고리 옵션 (스와치: 수량 = 제품 수량)
    if (productKey === 'keyring' && _psSelectedRing) {
        preSelectedCodes.push(_psSelectedRing.code);
        preSelectedQtys[_psSelectedRing.code] = 1;
    }

    // 원본 이미지 저장 (주문시 사용)
    try { sessionStorage.setItem('ps_artwork', _psImgDataUrl); } catch(e) {}
    window._photoStudioImage = _psImgDataUrl;

    // 카테고리 매핑
    const catMap = { fabric: 'ua_fabric', paper: 'ua_paper', canvas: 'ua_canvas', honeycomb: 'pp_hc_', blind: 'pp_bl_', banner: 'ua_banner', keyring: 'kr_acrylic', tshirt: 'ua_tshirt' };

    const productInfo = {
        name: displayName,
        name_jp: nameObj.ja,
        name_us: nameObj.en,
        code: `ps_${productKey}_${Date.now()}`,
        price: basePrice,
        price_jp: Math.round(basePrice * 0.1),
        price_us: Math.round(basePrice * 0.001),
        img: thumbUrl,
        w: w, h: h,
        w_mm: w, h_mm: h,
        width_mm: w, height_mm: h,
        category: catMap[productKey] || productKey,
        // 실제 상품의 addon 코드를 그대로 전달 → 장바구니에서 옵션 표시/선택 가능
        addons: realAddonStr,
        is_custom_size: true,
        is_custom: true,
        _calculated_price: true,
        _base_sqm_price: prod.sqm
    };

    // 스튜디오 종료 + 어드바이저 패널 닫기
    exitStudioMode();

    // 장바구니에 추가 후 장바구니 페이지로 이동
    setTimeout(() => {
        if (window.addProductToCartDirectly) {
            const extra = { thumb: thumbUrl };
            window.addProductToCartDirectly(productInfo, 1, preSelectedCodes, preSelectedQtys, extra);
        } else {
            console.error('[PhotoStudio] addProductToCartDirectly not found on window');
        }

        // 어드바이저 패널 닫고 장바구니 표시
        const advPanel = document.getElementById('advisorPanel');
        if (advPanel) advPanel.style.display = 'none';
        document.body.classList.remove('advisor-open');

        const cartPage = document.getElementById('cartPage');
        if (cartPage) cartPage.style.display = 'block';
        if (window.renderCart) window.renderCart();
    }, 200);
}

function _psShowSell() {
    document.getElementById('psSizingArea').innerHTML = `
        <div class="ps-sell-panel">
            <div class="ps-sell-info">
                <p style="font-size:12px; color:#475569; line-height:1.6; margin:0 0 8px; white-space:pre-line;">${ps('sellGuide')}</p>
                <p style="font-size:12px; color:#7c3aed; line-height:1.5; margin:0 0 10px; background:#f5f3ff; padding:8px; border-radius:8px;">
                    ${ps('commission')}
                </p>
            </div>
            <button class="ps-order-btn" style="background:linear-gradient(135deg,#f59e0b,#d97706);" id="psSellRegBtn">🎨 ${ps('sell')}</button>
            <a class="ps-mypage-link" id="psMypageBtn">📋 ${ps('mypage')}</a>
        </div>
    `;
    document.getElementById('psSellRegBtn')?.addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ ' + ps('registering');
        try {
            const _sb = window.sb;
            if (!_sb || !window.currentUser) throw new Error('Login required');

            // 1. 이미지를 blob으로 변환 후 업로드
            const res = await fetch(_psImgDataUrl);
            const blob = await res.blob();
            const ext = 'jpg';
            const ts = Date.now();
            const safeName = `${ts}_${Math.random().toString(36).substring(2,10)}.${ext}`;
            const path = `user_artwork/${window.currentUser.id}_${safeName}`;
            const { error: upErr } = await _sb.storage.from('design').upload(path, blob);
            if (upErr) throw upErr;
            const { data: pubData } = _sb.storage.from('design').getPublicUrl(path);
            const imgUrl = pubData.publicUrl;

            // 2. 패브릭 옵션 코드 조회
            let fabricAddons = '';
            try {
                const { data: addonRows } = await _sb.from('admin_addons').select('code').in('category_code', ['2342434', '23442423']);
                if (addonRows && addonRows.length > 0) fabricAddons = addonRows.map(r => r.code).join(',');
            } catch(e) {}

            // 3. 3종 상품 등록
            const title = _psText || 'My Artwork';
            const CATS = ['ua_paper', 'ua_fabric', 'ua_canvas'];
            const catNames = {
                ua_paper: { name:'종이포스터', name_us:'Paper Poster', name_jp:'紙ポスター' },
                ua_fabric: { name:'패브릭포스터', name_us:'Fabric Poster', name_jp:'ファブリックポスター' },
                ua_canvas: { name:'캔버스액자', name_us:'Canvas Frame', name_jp:'キャンバスフレーム' }
            };
            const basePrices = { ua_paper: 10000, ua_fabric: 20000, ua_canvas: 40000 };

            for (const cat of CATS) {
                const cn = catNames[cat];
                const price = basePrices[cat];
                const productCode = `${cat}_${window.currentUser.id.substring(0,8)}_${ts}`;
                const { error: insErr } = await _sb.from('admin_products').insert({
                    code: productCode,
                    name: `${title} - ${cn.name}`,
                    name_us: `${title} - ${cn.name_us}`,
                    name_jp: `${title} - ${cn.name_jp}`,
                    category: cat,
                    price: price,
                    price_us: Math.round(price * 0.001),
                    img_url: imgUrl,
                    addons: cat === 'ua_fabric' ? fabricAddons : '',
                    partner_id: window.currentUser.id,
                    partner_status: 'approved',
                    is_custom_size: true,
                    sort_order: 999
                });
                if (insErr) throw insErr;
            }

            btn.textContent = '✅ ' + ps('sellDone');
            btn.style.background = '#10b981';
        } catch(e) {
            console.error('Sell register error:', e);
            const errMsg = !window.currentUser ? (getLang()==='ja'?'ログインが必要です':getLang()==='en'?'Login required':'로그인이 필요합니다') : e.message;
            btn.textContent = '❌ ' + errMsg;
            btn.style.background = '#ef4444';
            setTimeout(() => { btn.textContent = '🎨 ' + ps('sell'); btn.style.background = ''; btn.disabled = false; }, 3000);
        }
    });
    document.getElementById('psMypageBtn')?.addEventListener('click', () => {
        window.location.href = window.location.pathname + '?page=mypage';
    });
    scrollChat();
}
