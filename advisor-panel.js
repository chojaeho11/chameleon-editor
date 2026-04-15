// ============================================================
// advisor-panel.js — 카프 AI 쇼핑 안내 + 연락처 남기기 통합 패널
// 검색바 아래 대형 채팅창. AI 채팅 + 콜백 요청
// ============================================================

import { SITE_CONFIG } from './site-config.js?v=399';

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
    kr: { title: '카프', subtitle: '쇼핑을 안내해 드립니다', studio: '여기서 놀자!', placeholder: '메시지를 입력하세요...', send: '전송', close: '닫기', editor: '에디터에서 디자인', cart: '장바구니', upload: '이미지 첨부', tooBig: '파일이 너무 큽니다 (최대 10MB). 더 큰 파일은 주문 시 업로드하거나 design@chameleon.design으로 보내주세요.', error: '멋진 작품을 구상 중이시군요! ✨ 이런 제품의 제작은 전문 상담이 필요합니다. 위의 📞 연락처 남기기 버튼을 눌러 연락처를 남겨주시면 담당자가 빠르게 연락드릴게요 😊', reset: '대화 초기화', consultant: '연락처 남기기', namePh: '이름', callbackTitle: '연락처를 남겨주세요', callbackDesc: '담당자가 확인 후 연락드리겠습니다', callbackSuccess: '연락처가 전달되었습니다! 담당자가 빠른 시간 내에 연락드릴게요', callbackPhonePh: '연락처 입력', callbackSubmit: '연락 요청하기', callbackPhoneErr: '연락처를 입력해주세요', quoteTitle: '전시/부스 견적 요청', quoteDesc: '아래 정보를 입력해주시면 담당자가 맞춤 견적을 보내드립니다', quoteEmailPh: 'email@example.com', quoteDetailPh: '필요한 구조물, 사이즈, 수량 등을 알려주세요', quoteFilePh: '레퍼런스 이미지나 도면을 올려주세요', quoteSubmit: '견적 요청 보내기', quoteSuccess: '견적 요청이 전송되었습니다! 담당자가 빠른 시간 내에 연락드리겠습니다' },
    ja: { title: 'カプ', subtitle: 'ショッピングをご案内します', studio: 'ここで遊ぼう!', placeholder: 'メッセージを入力...', send: '送信', close: '閉じる', editor: 'エディターでデザイン', cart: 'カートに入れる', upload: '画像添付', tooBig: 'ファイルが大きすぎます（最大10MB）。より大きいファイルはdesign@chameleon.designへお送りください。', error: '素敵な作品を構想中ですね！✨ このような製品の制作は専門的なご案内が必要です。上の📞コールバックリクエストボタンを押して連絡先を残してください。担当者がすぐにご連絡いたします 😊', reset: 'チャットリセット', consultant: 'コールバックリクエスト', namePh: 'お名前', callbackTitle: '連絡先をお残しください', callbackDesc: '担当者が確認後、ご連絡いたします', callbackSuccess: '連絡先が送信されました！担当者がすぐにご連絡いたします', callbackPhonePh: '連絡先を入力', callbackSubmit: 'コールバックを依頼', callbackPhoneErr: '連絡先を入力してください', quoteTitle: '展示/ブース見積もり依頼', quoteDesc: '以下の情報をご入力いただければ、担当者がお見積もりをお送りします', quoteEmailPh: 'email@example.com', quoteDetailPh: '必要な構造物、サイズ、数量などをお知らせください', quoteFilePh: '参考画像や図面をアップロードしてください', quoteSubmit: '見積もり依頼を送信', quoteSuccess: '見積もり依頼が送信されました！担当者が早急にご連絡いたします' },
    en: { title: 'Kapu', subtitle: 'Your shopping guide', studio: 'Play Here!', placeholder: 'Type a message...', send: 'Send', close: 'Close', editor: 'Design in Editor', cart: 'Add to Cart', upload: 'Attach image', tooBig: 'File too large (max 10MB). For larger files, please email design@chameleon.design.', error: 'What an amazing project you have in mind! ✨ This kind of product needs expert guidance. Please tap the 📞 Request Callback button above and leave your number — our team will contact you shortly 😊', reset: 'Reset chat', consultant: 'Request callback', namePh: 'Name', callbackTitle: 'Please leave your number', callbackDesc: 'Our team will review and contact you', callbackSuccess: 'Your contact info has been submitted! Our team will reach out to you shortly', callbackPhonePh: 'Enter phone number', callbackSubmit: 'Request callback', callbackPhoneErr: 'Please enter your phone number', quoteTitle: 'Exhibition/Booth Quote Request', quoteDesc: 'Fill in the details below and our team will send you a custom quote', quoteEmailPh: 'email@example.com', quoteDetailPh: 'Describe the structures, sizes, quantities you need', quoteFilePh: 'Upload reference images or blueprints', quoteSubmit: 'Submit Quote Request', quoteSuccess: 'Your quote request has been submitted! Our team will contact you shortly' },
    zh: { title: '卡普', subtitle: '为您导购', studio: '在这里玩!', placeholder: '请输入消息...', send: '发送', close: '关闭', editor: '在编辑器中设计', cart: '加入购物车', upload: '上传图片', tooBig: '文件太大（最大10MB）。', error: '您构思了一个很棒的项目！✨ 这类产品需要专业指导。请点击上方📞回拨请求按钮并留下联系方式，我们的团队会尽快与您联系 😊', reset: '重置对话', consultant: '回拨请求', namePh: '姓名', callbackTitle: '请留下您的联系方式', callbackDesc: '我们的团队会确认后联系您', callbackSuccess: '联系方式已提交！我们的团队会尽快与您联系', callbackPhonePh: '输入电话号码', callbackSubmit: '请求回拨', callbackPhoneErr: '请输入电话号码' },
    es: { title: 'Kapu', subtitle: 'Tu guía de compras', studio: '¡Juega Aquí!', placeholder: 'Escribe un mensaje...', send: 'Enviar', close: 'Cerrar', editor: 'Diseñar en Editor', cart: 'Añadir al carrito', upload: 'Adjuntar imagen', tooBig: 'Archivo demasiado grande (máx. 10MB).', error: '¡Qué proyecto tan increíble! ✨ Este tipo de producto necesita orientación experta. Toca el botón 📞 Solicitar devolución de llamada arriba y deja tu número — nuestro equipo te contactará pronto 😊', reset: 'Reiniciar chat', consultant: 'Solicitar devolución', namePh: 'Nombre', callbackTitle: 'Deja tu número', callbackDesc: 'Nuestro equipo revisará y te contactará', callbackSuccess: '¡Tu información de contacto ha sido enviada! Nuestro equipo se pondrá en contacto contigo pronto', callbackPhonePh: 'Ingresa tu teléfono', callbackSubmit: 'Solicitar llamada', callbackPhoneErr: 'Ingresa tu teléfono' },
    de: { title: 'Kapu', subtitle: 'Ihr Einkaufsberater', studio: 'Hier spielen!', placeholder: 'Nachricht eingeben...', send: 'Senden', close: 'Schließen', editor: 'Im Editor gestalten', cart: 'In den Warenkorb', upload: 'Bild anhängen', tooBig: 'Datei zu groß (max. 10MB).', error: 'Was für ein tolles Projekt! ✨ Dieses Produkt braucht fachkundige Beratung. Bitte tippen Sie oben auf 📞 Rückruf anfordern und hinterlassen Sie Ihre Nummer — unser Team meldet sich bei Ihnen 😊', reset: 'Chat zurücksetzen', consultant: 'Rückruf anfordern', namePh: 'Name', callbackTitle: 'Hinterlassen Sie Ihre Nummer', callbackDesc: 'Unser Team wird Sie kontaktieren', callbackSuccess: 'Ihre Kontaktdaten wurden übermittelt! Unser Team wird sich bald bei Ihnen melden', callbackPhonePh: 'Telefonnummer eingeben', callbackSubmit: 'Rückruf anfordern', callbackPhoneErr: 'Bitte Telefonnummer eingeben' },
    fr: { title: 'Kapu', subtitle: 'Votre guide d\'achat', studio: 'Jouez ici!', placeholder: 'Tapez un message...', send: 'Envoyer', close: 'Fermer', editor: 'Designer dans l\'éditeur', cart: 'Ajouter au panier', upload: 'Joindre image', tooBig: 'Fichier trop volumineux (max 10MB).', error: 'Quel projet incroyable ! ✨ Ce type de produit nécessite des conseils d\'experts. Appuyez sur 📞 Demander un rappel ci-dessus et laissez votre numéro — notre équipe vous contactera rapidement 😊', reset: 'Réinitialiser', consultant: 'Demander un rappel', namePh: 'Nom', callbackTitle: 'Laissez votre numéro', callbackDesc: 'Notre équipe vous contactera après vérification', callbackSuccess: 'Vos coordonnées ont été envoyées ! Notre équipe vous contactera bientôt', callbackPhonePh: 'Entrez votre téléphone', callbackSubmit: 'Demander un rappel', callbackPhoneErr: 'Entrez votre téléphone' },
    ar: { title: 'كابو', subtitle: 'دليل التسوق', studio: '!العب هنا', placeholder: '...اكتب رسالة', send: 'إرسال', close: 'إغلاق', editor: 'التصميم في المحرر', cart: 'أضف للسلة', upload: 'إرفاق صورة', tooBig: 'الملف كبير جداً (الحد 10MB).', error: 'يا لها من فكرة رائعة! ✨ هذا النوع من المنتجات يحتاج إلى إرشاد متخصص. اضغط على زر 📞 طلب معاودة الاتصال أعلاه واترك رقمك — سيتواصل فريقنا معك قريباً 😊', reset: 'إعادة تعيين', consultant: 'طلب معاودة الاتصال', namePh: 'الاسم', callbackTitle: 'اترك رقمك', callbackDesc: 'سيتواصل فريقنا معك بعد المراجعة', callbackSuccess: 'تم إرسال معلومات الاتصال! سيتواصل فريقنا معك قريباً', callbackPhonePh: 'أدخل رقم الهاتف', callbackSubmit: 'طلب معاودة الاتصال', callbackPhoneErr: 'أدخل رقم هاتفك' },
};
function t(key) { const l = getLang(); return (T[l] && T[l][key]) || T['en'][key] || ''; }

let panelEl = null;
let chatArea = null;
let isProcessing = false;
let lastProducts = [];
let pendingImage = null;
let conversationHistory = [];
let _advRoomId = null; // product-advisor room_id 유지
let _custName = ''; // 고객 이름
let _custPhone = ''; // 고객 전화번호

// ─── Supabase 클라이언트 ───
// window.sb (config.js)를 재사용 — 새 클라이언트 생성 금지
function getSb() { return window.sb || null; }

// ─── localStorage 영속성 (로그인 상태 무관하게 단일 키 사용) ───
function chatKey() { return 'kapu_chat_' + getLang(); }

function saveChat() {
    try {
        if (!chatArea) return;
        // 엔트리 폼/웰컴 메시지만 있는 경우 저장하지 않음
        const bubbles = chatArea.querySelectorAll('.adv-bubble-user, .adv-bubble-ai');
        if (bubbles.length === 0 && conversationHistory.length === 0) return;
        localStorage.setItem(chatKey(), JSON.stringify({
            html: chatArea.innerHTML,
            history: conversationHistory,
            lastProducts
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
            rebindCardEvents();
        }
        conversationHistory = data.history || [];
        lastProducts = data.lastProducts || [];
        return !!(data.html && data.html.length > 50);
    } catch(e) { return false; }
}

function clearChat() {
    conversationHistory = [];
    lastProducts = [];
    _advRoomId = null;
    _custName = '';
    _custPhone = '';
    if (chatArea) chatArea.innerHTML = '';
    try { localStorage.removeItem(chatKey()); } catch(e) {}
    try { localStorage.removeItem('kapu_customer'); sessionStorage.removeItem('kapu_customer'); } catch(e) {}
    try { localStorage.removeItem(chatKey()); localStorage.removeItem('kapu_chat_guest'); } catch(e) {}
    showEntryForm();
}

const WELCOME = {
    kr: `안녕하세요! 무엇을 도와드릴까요? 😊\n원하시는 제품에 대해 물어보시면 설명과 제품을 구매할 수 있는 링크를 드릴게요.`,
    ja: `こんにちは！何かお手伝いできることはありますか？😊\nご希望の商品についてお尋ねいただければ、説明と購入リンクをお送りいたします。`,
    en: `Hello! How can I help you? 😊\nAsk me about any product and I'll provide a description and a purchase link for you.`,
    zh: `您好！有什么可以帮您的吗？\n我可以为您完美整理产品说明、链接和报价。告诉我您想制作什么产品，我来轻松引导您。点击上传文件就搞定！`,
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
    const greeting = _custName ? (_custName + ({ja:'様、',en:', ',zh:', ',ar:'، ',es:', ',de:', ',fr:', ',kr:'님, '}[lang]||', ')) : '';
    chatArea.insertAdjacentHTML('beforeend', `
        <div class="adv-row adv-row-ai">
            <div class="adv-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="adv-bubble adv-bubble-ai">${greeting}${formatted}</div>
        </div>
    `);
    scrollChat();
}

// ─── 첫 인사 추천 상품 (제품 코드 직접 지정) ───
const WELCOME_PRODUCT_CODES = ['hb_dw_1', 'pd_b_1', 'ch20001', '345345353'];

async function _loadWelcomeProducts(lang) {
    const sb = getSb();
    if (!sb) return;
    try {
        const { data: rows } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, price, price_jp, price_us, img_url, width_mm, height_mm, category')
            .in('code', WELCOME_PRODUCT_CODES);
        if (!rows || rows.length === 0) return;

        // 코드 순서대로 정렬
        const codeOrder = {};
        WELCOME_PRODUCT_CODES.forEach((c, i) => { codeOrder[c] = i; });
        rows.sort((a, b) => (codeOrder[a.code] ?? 99) - (codeOrder[b.code] ?? 99));

        const country = (window.SITE_CONFIG && SITE_CONFIG.COUNTRY) || 'KR';
        const products = rows.map(r => {
            let displayName = r.name;
            if (lang === 'ja') displayName = r.name_jp || r.name;
            else if (lang !== 'kr') displayName = r.name_us || r.name;
            let price = r.price;
            let priceSuffix = '원';
            if (country === 'JP') { price = r.price_jp || Math.round(r.price * 0.1); priceSuffix = '円'; }
            else if (country !== 'KR') { price = r.price_us || Math.round(r.price * 0.001); priceSuffix = '$'; }
            return {
                code: r.code,
                name: displayName,
                img_url: r.img_url || '',
                reason: '',
                price_display: (country === 'US' || country === 'EN') ? '$' + price.toLocaleString() : price.toLocaleString() + priceSuffix,
                recommended_width_mm: r.width_mm || 0,
                recommended_height_mm: r.height_mm || 0,
            };
        });

        const recLabels = {
            kr: '🔥 인기 추천 상품', ja: '🔥 おすすめ商品', en: '🔥 Popular Products',
            zh: '🔥 热门推荐', es: '🔥 Productos Populares', de: '🔥 Beliebte Produkte',
            fr: '🔥 Produits Populaires', ar: '🔥 منتجات شائعة'
        };
        if (chatArea) {
            chatArea.insertAdjacentHTML('beforeend', `
                <div class="adv-row adv-row-ai">
                    <div class="adv-avatar"><i class="fa-solid fa-fire"></i></div>
                    <div class="adv-bubble adv-bubble-ai" style="font-weight:700;font-size:14px;">${recLabels[lang] || recLabels['en']}</div>
                </div>
            `);
        }
        addProductCards(products);
        scrollChat();
    } catch(e) {
        console.warn('Welcome products load failed:', e);
    }
}

// ─── 제품 검색 ───
async function _doProductSearch(query) {
    if (!query || query.length < 1) return;
    const sb = getSb();
    if (!sb || !chatArea) return;
    const lang = getLang();
    const searchField = lang === 'ja' ? 'name_jp' : (lang === 'kr' ? 'name' : 'name_us');
    try {
        const { data: rows } = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, price, price_jp, price_us, img_url, width_mm, height_mm, category')
            .ilike(searchField, '%' + query + '%')
            .limit(4);
        if (!rows || rows.length === 0) {
            // name 필드로 재시도 (해외에서 한국어 검색 시)
            if (searchField !== 'name') {
                const { data: rows2 } = await sb.from('admin_products')
                    .select('code, name, name_jp, name_us, price, price_jp, price_us, img_url, width_mm, height_mm, category')
                    .ilike('name', '%' + query + '%')
                    .limit(4);
                if (rows2 && rows2.length > 0) { _renderSearchResults(rows2, query, lang); return; }
            }
            const noResultMsg = {kr:'검색 결과가 없습니다.',ja:'検索結果がありません。',en:'No results found.',zh:'没有搜索结果。'}[lang]||'No results found.';
            addBubble(noResultMsg, 'ai');
            scrollChat();
            return;
        }
        _renderSearchResults(rows, query, lang);
    } catch(e) { console.warn('Product search failed:', e); }
}

function _renderSearchResults(rows, query, lang) {
    const country = (window.SITE_CONFIG && SITE_CONFIG.COUNTRY) || 'KR';
    const products = rows.map(r => {
        let displayName = r.name;
        if (lang === 'ja') displayName = r.name_jp || r.name;
        else if (lang !== 'kr') displayName = r.name_us || r.name;
        let price = r.price; let priceSuffix = '원';
        if (country === 'JP') { price = r.price_jp || Math.round(r.price * 0.1); priceSuffix = '円'; }
        else if (country !== 'KR') { price = r.price_us || Math.round(r.price * 0.001); priceSuffix = '$'; }
        return {
            code: r.code, name: displayName, img_url: r.img_url || '', reason: '',
            price_display: (country === 'US' || country === 'EN') ? '$' + price.toLocaleString() : price.toLocaleString() + priceSuffix,
            recommended_width_mm: r.width_mm || 0, recommended_height_mm: r.height_mm || 0,
        };
    });
    const searchLabel = {kr:`🔍 "${query}" 검색 결과`,ja:`🔍 "${query}" 検索結果`,en:`🔍 Results for "${query}"`,zh:`🔍 "${query}" 搜索结果`}[lang]||`🔍 "${query}"`;
    chatArea.insertAdjacentHTML('beforeend', `
        <div class="adv-row adv-row-ai">
            <div class="adv-avatar"><i class="fa-solid fa-magnifying-glass"></i></div>
            <div class="adv-bubble adv-bubble-ai" style="font-weight:700;font-size:14px;">${searchLabel}</div>
        </div>
    `);
    addProductCards(products);
    scrollChat();
    // 검색창 클리어
    const si = document.getElementById('advProductSearch');
    if (si) si.value = '';
}

function showEntryForm() {
    if (!chatArea) return;
    _custName = 'Guest';
    try { localStorage.setItem('kapu_customer', JSON.stringify({ name: 'Guest', phone: '' })); } catch(e) {}
    const lang = getLang();
    const msgs = {
        kr: '안녕하세요! 무엇을 도와드릴까요? 😊\n원하시는 제품에 대해 물어보시면 설명과 제품을 구매할 수 있는 링크를 드릴게요.',
        ja: 'こんにちは！何かお手伝いできることはありますか？😊\nご希望の商品についてお尋ねいただければ、説明と購入リンクをお送りいたします。',
        en: 'Hello! How can I help you? 😊\nAsk me about any product and I\'ll provide a description and a purchase link for you.'
    };
    addBubble(msgs[lang] || msgs['en'], 'ai');
}

// ─── 에디터로 디자인하기 (사이즈 입력 후 에디터 열기) ───
window._advOpenEditor = function() {
    const lang = getLang();
    const labels = {
        kr: { title: '에디터로 디자인하기', wPh: '가로 (mm)', hPh: '세로 (mm)', btn: '에디터 열기', cancel: '취소' },
        ja: { title: 'エディタでデザイン', wPh: '幅 (mm)', hPh: '高さ (mm)', btn: 'エディタを開く', cancel: 'キャンセル' },
        en: { title: 'Design with Editor', wPh: 'Width (mm)', hPh: 'Height (mm)', btn: 'Open Editor', cancel: 'Cancel' },
        zh: { title: '用编辑器设计', wPh: '宽 (mm)', hPh: '高 (mm)', btn: '打开编辑器', cancel: '取消' },
        ar: { title: 'التصميم بالمحرر', wPh: '(mm) العرض', hPh: '(mm) الارتفاع', btn: 'فتح المحرر', cancel: 'إلغاء' },
        es: { title: 'Diseñar con Editor', wPh: 'Ancho (mm)', hPh: 'Alto (mm)', btn: 'Abrir Editor', cancel: 'Cancelar' },
        de: { title: 'Mit Editor gestalten', wPh: 'Breite (mm)', hPh: 'Höhe (mm)', btn: 'Editor öffnen', cancel: 'Abbrechen' },
        fr: { title: 'Designer avec l\'éditeur', wPh: 'Largeur (mm)', hPh: 'Hauteur (mm)', btn: 'Ouvrir l\'éditeur', cancel: 'Annuler' }
    };
    const L = labels[lang] || labels['en'];
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:90%;text-align:center;box-sizing:border-box;">'
        + '<div style="font-size:16px;font-weight:800;margin-bottom:16px;">' + L.title + '</div>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px;">'
        + '<input id="_advEdW" type="number" placeholder="' + L.wPh + '" style="width:0;flex:1;min-width:0;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;box-sizing:border-box;">'
        + '<input id="_advEdH" type="number" placeholder="' + L.hPh + '" style="width:0;flex:1;min-width:0;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;text-align:center;box-sizing:border-box;">'
        + '</div>'
        + '<button id="_advEdOpen" style="width:100%;padding:12px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">' + L.btn + '</button>'
        + '<button onclick="this.closest(\'div[style*=inset]\').remove()" style="width:100%;padding:8px;background:none;border:none;color:#94a3b8;font-size:13px;cursor:pointer;">' + L.cancel + '</button>'
        + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.getElementById('_advEdW').focus();
    document.getElementById('_advEdOpen').addEventListener('click', function() {
        var w = parseInt(document.getElementById('_advEdW').value) || 0;
        var h = parseInt(document.getElementById('_advEdH').value) || 0;
        if (w < 10 || h < 10) { document.getElementById('_advEdW').style.borderColor = '#ef4444'; return; }
        ov.remove();
        if (window.startEditorDirect) window.startEditorDirect('custom', w, h);
    });
};

// ─── 견적서 → 장바구니 결제 ───
window._quoteToCart = async function(quoteId) {
    const qData = window['_pendingQuote_' + quoteId];
    if (!qData || !qData.items || qData.items.length === 0) {
        alert('견적 데이터를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
    }
    try {
        const { addProductToCartDirectly } = await import('./order.js?v=399');
        // ★ 할인 아이템 분리, 메인/addon 그룹핑
        const allItems = qData.items.filter(i => (i.total || 0) >= 0); // 할인 행 제외
        const discountItems = qData.items.filter(i => (i.total || 0) < 0);
        const totalDiscount = discountItems.reduce((s, i) => s + Math.abs(i.total), 0);
        let currentMain = null;
        const groups = [];
        for (const item of allItems) {
            if (!item.is_addon) {
                currentMain = { main: item, addons: [] };
                groups.push(currentMain);
            } else if (currentMain) {
                currentMain.addons.push(item);
            }
        }
        // ★ 할인 금액을 메인 제품에 비례 분배
        if (totalDiscount > 0 && groups.length > 0) {
            const mainTotal = groups.reduce((s, g) => s + (g.main.total || 0), 0);
            for (const g of groups) {
                if (mainTotal > 0 && g.main.total > 0) {
                    const ratio = g.main.total / mainTotal;
                    const disc = Math.round(totalDiscount * ratio);
                    g.main.total = g.main.total - disc;
                }
            }
        }
        for (const group of groups) {
            const item = group.main;
            const mainQty = item.qty || 1;
            const rec = (qData.products || []).find(p => p.code === item._code) || {};
            const addonCodes = group.addons.map(a => a._code).filter(Boolean);
            // ★ addon 수량 = 각 addon의 qty (견적서에서 이미 메인 수량과 맞춰짐)
            const addonQtyMap = {};
            group.addons.forEach(a => { if (a._code) addonQtyMap[a._code] = a.qty || mainQty; });
            // ★ 할인 적용된 실효 단가 (total/qty). AI 응답이 total/unit_price를 누락하는 경우 PRODUCT_DB로 폴백
            let effectivePrice = (item.total && mainQty > 0) ? Math.round(item.total / mainQty) : item.unit_price;
            if (!effectivePrice || isNaN(effectivePrice) || effectivePrice <= 0) {
                // 1) PRODUCT_DB에서 m² 단가 × 면적 계산 시도
                const _db = (window.PRODUCT_DB && window.PRODUCT_DB[item._code]) || rec;
                const _sqmPrice = _db && (_db._base_sqm_price || (_db.price_per_sqm) || 0);
                const _wm = (item._width_mm || 0) / 1000;
                const _hm = (item._height_mm || 0) / 1000;
                if (_sqmPrice > 0 && _wm > 0 && _hm > 0) {
                    effectivePrice = Math.round(_sqmPrice * _wm * _hm);
                } else if (_db && _db.price > 0) {
                    effectivePrice = Number(_db.price);
                }
                if (!effectivePrice || effectivePrice <= 0) {
                    console.warn('[quote→cart] price missing for', item._code, item.name, '— skipping item');
                    continue; // 가격 산정 불가 시 아예 담지 않음 (잘못된 0원 담기 방지)
                }
                console.log('[quote→cart] price fallback for', item._code, '→', effectivePrice);
            }
            addProductToCartDirectly({
                code: item._code || rec.code || '',
                name: item.name,
                price: effectivePrice,
                w_mm: item._width_mm || 0,
                h_mm: item._height_mm || 0,
                width_mm: item._width_mm || 0,
                height_mm: item._height_mm || 0,
                is_custom_size: true,
                _calculated_price: true,
                _quote_item: true,
                img: rec.img_url || null,
            }, mainQty, addonCodes, addonQtyMap);
        }
        // ★ 견적서 배송/시공비 + 주문 메모 저장
        const _quoteInfo = {
            fee: qData.shipping_fee || 0,
            label: (qData.shipping_fee || 0) >= 700000 ? '지방 배송+시공비' : (qData.shipping_fee || 0) >= 200000 ? '지방 용차배송비' : (qData.shipping_fee > 0 ? '지방 택배비' : ''),
            delivery_note: qData.delivery_note || '',
            shipping_region: qData.shipping_region || '',
            wants_install: qData.wants_install || false,
            ts: Date.now()
        };
        localStorage.setItem('chameleon_quote_shipping', JSON.stringify(_quoteInfo));
        window._nonMetroFeeApplied = _quoteInfo.fee || 0;
        if (window.updateCartBadge) window.updateCartBadge();
        // 장바구니 페이지 열기
        const cartPage = document.getElementById('cartPage');
        if (cartPage) {
            cartPage.style.display = 'block';
            if (window.renderCart) window.renderCart();
        }
    } catch (err) {
        console.error('견적 장바구니 추가 실패:', err);
        alert('장바구니 추가 중 오류가 발생했습니다.');
    }
};

// ─── 초기화 ───
// ─── 6개 바로가기 버튼을 외부 컨테이너에 렌더링 ───
export function renderShortcutButtons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const lang = getLang();

    // Localized labels
    const L = {
        kr: {
            self_design: '셀프디자인',
            quick_quote: '빠른견적서',
            product_search: '제품검색',
            // ── Design Market banner (left) ──
            hub_title: '세상에 모든 서비스를 밴드하다',
            hub_sub: '디자인 · 인력 · 모임 · 중고장터',
            hub_cta: '모든 서비스 보기',
            pitch_only: '단',
            pitch_num: '5%',
            pitch_label: '업계 최저 수수료',
            pitch_label_short: '최저 수수료',
            // ── Partner/Production network banner (right) ──
            partner_title: '출력·시공업체인가요?',
            partner_sub: '가까운 고객과 출력업체를 연결합니다.<br>제작 가능한 품목을 등록하세요.',
            partner_desc: '',
            partner_cta: '파트너 등록'
        },
        ja: {
            self_design: 'セルフデザイン',
            quick_quote: 'クイック見積',
            product_search: '商品検索',
            hub_title: '世界中のサービスをバンドする',
            hub_sub: 'デザイン · 人材 · コミュニティ · 中古マーケット',
            hub_cta: 'すべてのサービスを見る',
            pitch_only: 'ONLY',
            pitch_num: '5%',
            pitch_label: '業界最安手数料',
            pitch_label_short: '最安手数料',
            partner_title: '印刷·施工業者ですか？',
            partner_sub: '近くのお客様と印刷業者をつなぎます。<br>製作可能な品目を登録してください。',
            partner_desc: '',
            partner_cta: 'パートナー登録'
        },
        en: {
            self_design: 'Self Design',
            quick_quote: 'Quick Quote',
            product_search: 'Search',
            hub_title: 'Band every service in the world',
            hub_sub: 'Design · Talent · Community · Marketplace',
            hub_cta: 'View All Services',
            pitch_only: 'ONLY',
            pitch_num: '5%',
            pitch_label: 'INDUSTRY-LOWEST FEE',
            pitch_label_short: 'LOWEST FEE',
            partner_title: 'Print or Install Company?',
            partner_sub: 'We connect nearby clients with print companies.<br>Register the items you can produce.',
            partner_desc: '',
            partner_cta: 'Join as Partner'
        },
        zh: {
            self_design: '自助设计',
            quick_quote: '快速报价',
            product_search: '产品搜索',
            hub_title: '联结世界上所有的服务',
            hub_sub: '设计 · 人才 · 社群 · 二手市场',
            hub_cta: '查看所有服务',
            pitch_only: '仅',
            pitch_num: '5%',
            pitch_label: '业界最低手续费',
            pitch_label_short: '最低手续费',
            partner_title: '印刷·施工企业？',
            partner_sub: '为附近客户与印刷企业牵线搭桥。<br>请注册您可以制作的品类。',
            partner_desc: '',
            partner_cta: '成为合作伙伴'
        },
        ar: {
            self_design: 'تصميم ذاتي',
            quick_quote: 'عرض سريع',
            product_search: 'بحث المنتجات',
            hub_title: 'اجمع كل خدمات العالم معاً',
            hub_sub: 'التصميم · المواهب · المجتمع · السوق المستعمل',
            hub_cta: 'عرض جميع الخدمات',
            pitch_only: 'فقط',
            pitch_num: '5%',
            pitch_label: 'أدنى عمولة في الصناعة',
            pitch_label_short: 'أدنى عمولة',
            partner_title: 'شركة طباعة أو تركيب؟',
            partner_sub: 'نربط العملاء القريبين بشركات الطباعة.<br>سجّل المنتجات التي يمكنك إنتاجها.',
            partner_desc: '',
            partner_cta: 'انضم كشريك'
        },
        es: {
            self_design: 'Autodiseño',
            quick_quote: 'Cotización rápida',
            product_search: 'Buscar',
            hub_title: 'Conecta todos los servicios del mundo',
            hub_sub: 'Diseño · Talento · Comunidad · Mercado',
            hub_cta: 'Ver todos los servicios',
            pitch_only: 'SOLO',
            pitch_num: '5%',
            pitch_label: 'COMISIÓN MÁS BAJA',
            pitch_label_short: 'COMISIÓN BAJA',
            partner_title: '¿Empresa de impresión o montaje?',
            partner_sub: 'Conectamos clientes cercanos con imprentas.<br>Registra los artículos que puedes producir.',
            partner_desc: '',
            partner_cta: 'Ser Socio'
        },
        de: {
            self_design: 'Selbstdesign',
            quick_quote: 'Schnellangebot',
            product_search: 'Suche',
            hub_title: 'Alle Dienste der Welt verbinden',
            hub_sub: 'Design · Talente · Community · Secondhand',
            hub_cta: 'Alle Dienste ansehen',
            pitch_only: 'NUR',
            pitch_num: '5%',
            pitch_label: 'NIEDRIGSTE GEBÜHR DER BRANCHE',
            pitch_label_short: 'NIEDRIGSTE GEBÜHR',
            partner_title: 'Druck- oder Montagefirma?',
            partner_sub: 'Wir verbinden nahe Kunden mit Druckereien.<br>Registrieren Sie Ihre Produkte.',
            partner_desc: '',
            partner_cta: 'Partner werden'
        },
        fr: {
            self_design: 'Conception',
            quick_quote: 'Devis rapide',
            product_search: 'Recherche',
            hub_title: 'Relier tous les services du monde',
            hub_sub: 'Design · Talents · Communauté · Marché',
            hub_cta: 'Voir tous les services',
            pitch_only: 'SEULEMENT',
            pitch_num: '5%',
            pitch_label: 'COMMISSION LA PLUS BASSE',
            pitch_label_short: 'COMMISSION MINI',
            partner_title: 'Société d\'impression ou d\'installation ?',
            partner_sub: 'Nous connectons les clients proches aux imprimeurs.<br>Enregistrez ce que vous pouvez produire.',
            partner_desc: '',
            partner_cta: 'Devenir Partenaire'
        }
    };
    const t = L[lang] || L.en;

    container.innerHTML = `
        <style>
        .adv-ext-wrap{max-width:1100px;margin:0 auto;padding:0 4px;width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;}
        .adv-ext-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;box-sizing:border-box;}
        .adv-ext-btn{display:flex;align-items:center;justify-content:center;gap:6px;background:#6366f1;color:#fff;text-decoration:none;padding:14px 2px;border-radius:14px;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all 0.2s;width:100%;box-sizing:border-box;white-space:nowrap;min-width:0;}
        .adv-ext-btn i{flex-shrink:0;}
        .adv-ext-btn:hover{background:#eab308!important;color:#1e293b!important;transform:translateY(-1px);}

        /* Single services hub banner */
        @keyframes dmBandPulse { 0%,100%{text-shadow:0 0 16px rgba(186,230,253,0.55);} 50%{text-shadow:0 0 28px rgba(186,230,253,0.95),0 0 8px rgba(186,230,253,0.6);} }
        .dm-hub-banner{position:relative;display:flex;align-items:center;justify-content:flex-start;gap:22px;width:100%;border-radius:18px;padding:20px 26px;text-decoration:none;color:#fff;overflow:hidden;transition:transform 0.25s,box-shadow 0.25s;box-sizing:border-box;box-shadow:0 8px 28px rgba(0,0,0,0.28);border:1.5px solid rgba(255,255,255,0.12);background:linear-gradient(90deg,#2e1065 0%,#4c1d95 25%,#6d28d9 55%,#7c3aed 80%,#059669 100%);}
        .dm-hub-band{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#bae6fd;font-size:38px;font-weight:900;letter-spacing:-1px;font-family:'Arial Black','Helvetica',sans-serif;animation:dmBandPulse 2.4s ease-in-out infinite;position:relative;z-index:3;}
        .dm-hub-banner:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(0,0,0,0.4);}
        .dm-hub-banner::before{content:'';position:absolute;top:-50px;right:-50px;width:220px;height:220px;background:radial-gradient(circle,rgba(251,191,36,0.2) 0%,transparent 70%);pointer-events:none;}
        .dm-hub-banner::after{content:'';position:absolute;bottom:-60px;left:-40px;width:250px;height:250px;background:radial-gradient(circle,rgba(16,185,129,0.15) 0%,transparent 70%);pointer-events:none;}
        .dm-hub-text{flex:1;min-width:0;position:relative;z-index:2;}
        .dm-hub-title{font-size:18px;font-weight:900;letter-spacing:-0.5px;margin-bottom:6px;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1.25;}
        .dm-hub-sub{font-size:16px;font-weight:700;color:#bae6fd;line-height:1.5;letter-spacing:0.2px;}
        .dm-hub-cta{flex-shrink:0;background:#fff;color:#1e1b4b;padding:12px 22px;border-radius:999px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.18);transition:all 0.22s;position:relative;z-index:2;}
        .dm-hub-banner:hover .dm-hub-cta{background:#fbbf24;color:#1e1b4b;transform:scale(1.04);box-shadow:0 6px 20px rgba(251,191,36,0.5);}
        .dm-hub-banner:hover .dm-hub-cta i{transform:translateX(3px);}
        .dm-hub-cta i{transition:transform 0.22s;}
        @media(max-width:768px){
            .adv-ext-grid{grid-template-columns:repeat(3,1fr);gap:4px;}
            .adv-ext-btn{padding:11px 1px;font-size:11px;gap:3px;border-radius:12px;}
            .dm-hub-banner{padding:16px 18px;border-radius:16px;flex-direction:row;text-align:left;gap:12px;}
            .dm-hub-band{font-size:28px;letter-spacing:-1px;}
            .dm-hub-title{font-size:14px;}
            .dm-hub-sub{font-size:13px;}
            .dm-hub-cta{display:none;}
        }
        </style>
        <div class="adv-ext-wrap">
            <div class="adv-ext-grid">
                <a href="javascript:void(0)" onclick="window._advOpenEditor&&window._advOpenEditor()" class="adv-ext-btn">
                    <i class="fa-solid fa-pen-ruler"></i> ${t.self_design}
                </a>
                <a href="javascript:void(0)" onclick="(function(){if(window.openAdvisorPanel)window.openAdvisorPanel();setTimeout(function(){if(window.startQuoteFlow)window.startQuoteFlow();else if(window.startCallbackFlow)window.startCallbackFlow();},350);})()" class="adv-ext-btn">
                    <i class="fa-solid fa-file-invoice"></i> ${t.quick_quote}
                </a>
                <a href="javascript:void(0)" onclick="if(window.openProductPickerModal)window.openProductPickerModal()" class="adv-ext-btn">
                    <i class="fa-solid fa-magnifying-glass"></i> ${t.product_search}
                </a>
            </div>
            <a href="${location.origin}/services" class="dm-hub-banner" target="_blank">
                <div class="dm-hub-band">BAND</div>
                <div class="dm-hub-text">
                    <div class="dm-hub-title">${t.hub_title}</div>
                    <div class="dm-hub-sub">${t.hub_sub}</div>
                </div>
                <div class="dm-hub-cta">${t.hub_cta} <i class="fa-solid fa-arrow-right"></i></div>
            </a>
        </div>
    `;
}

export function initAdvisorPanel() {
    panelEl = document.getElementById('advisorPanel');
    if (!panelEl) return;

    // 바로가기 버튼을 메인 타이틀 아래에 렌더링
    renderShortcutButtons('advShortcutBtns');

    window._startAdvisor = startAdvisor;
    window.startQuoteFlow = startQuoteFlow;

    // 전역 함수: 어디서든 카프 패널 열기/닫기
    window.openAdvisorPanel = function() {
        openPanel();
        setTimeout(() => {
            const inp = document.getElementById('advInput');
            if (inp) inp.focus();
        }, 400);
    };
    window.toggleAdvisorPanel = function() {
        if (!panelEl) return;
        const fab = document.getElementById('floatingChatBtn');
        if (panelEl.style.display === 'flex') {
            panelEl.style.display = 'none';
            if (fab) fab.innerHTML = '<i class="fa-solid fa-comments"></i>';
        } else {
            openPanel();
            if (fab) fab.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            setTimeout(() => { const inp = document.getElementById('advInput'); if (inp) inp.focus(); }, 400);
        }
    };

    // 우측 하단 챗봇 숨기기 (카프로 통일)
    const chamTrigger = document.getElementById('cham-bot-trigger');
    const chamWindow = document.getElementById('cham-bot-window');
    if (chamTrigger) chamTrigger.style.display = 'none';
    if (chamWindow) chamWindow.style.display = 'none';

    ['btnAiAdvisor', 'btnAiAdvisor2', 'btnChatbotOpen', 'floatingChatBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn && id !== 'floatingChatBtn') {
            btn.addEventListener('click', () => { window.toggleAdvisorPanel(); });
        }
    });

    // 홈 진입 시 자동 열기 비활성화 (플로팅 버튼으로 열기)
    // (자동 열림 제거됨)

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

    console.log('✅ Advisor panel initialized (AI + callback)');
}

// ─── 패널 열기 ───
function openPanel() {
    if (!panelEl) return;
    if (panelEl.style.display === 'flex') return;
    panelEl.style.display = 'flex';
    buildPanelUI();
}

// ─── 헤더 전화/이메일 링크 ───
function _getContactLinks() {
    // 순서: 이메일 → 전화 → 새로고침 → X (좌→우)
    let html = '';
    html += `<a href="mailto:design@chameleon.design" class="adv-header-btn" style="text-decoration:none;color:#fff;" title=""><i class="fa-solid fa-envelope" style="font-size:13px;"></i></a>`;
    html += `<button class="adv-header-btn" id="advPhoneBtn" title=""><i class="fa-solid fa-phone" style="font-size:13px;"></i></button>`;
    html += `<button class="adv-header-btn" id="advResetBtn" title="${t('reset')}"><i class="fa-solid fa-rotate-right" style="font-size:13px;"></i></button>`;
    html += `<button class="adv-header-btn" onclick="if(window.toggleAdvisorPanel)window.toggleAdvisorPanel()" title="닫기" style="margin-left:2px;"><i class="fa-solid fa-xmark" style="font-size:15px;"></i></button>`;
    return html;
}

function _attachTooltip(el, type) {
    const lang = getLang();
    let content = '';
    if (type === 'phone') {
        if (lang === 'kr') content = '<div style="font-weight:800;margin-bottom:6px;">📞 전화 문의</div><div>🏭 본사: 031-366-1984</div><div>👤 지숙: 010-3455-1946</div><div>👤 은미: 010-7793-5393</div><div>👤 성희: 010-3490-3328</div><div style="margin-top:4px;font-size:11px;color:#94a3b8;">⏰ 평일 09:00~18:00</div>';
        else if (lang === 'ja') content = '<div style="font-weight:800;margin-bottom:6px;">📞 お電話</div><div>🇯🇵 047-712-1148</div><div style="margin-top:4px;font-size:11px;color:#94a3b8;">⏰ 平日 09:00〜18:00</div>';
        else content = '<div style="font-weight:800;margin-bottom:6px;">📞 Contact</div><div>✉️ design@chameleon.design</div><div style="margin-top:4px;font-size:11px;color:#94a3b8;">⏰ Weekdays 09:00-18:00 KST</div>';
    } else {
        content = '<div style="font-weight:800;margin-bottom:4px;">✉️ Email</div><div style="color:#6366f1;font-weight:700;">design@chameleon.design</div>';
    }

    let tip = null;
    el.addEventListener('mouseenter', () => {
        if (tip) return;
        tip = document.createElement('div');
        tip.style.cssText = 'position:absolute;top:100%;right:0;margin-top:8px;background:#fff;color:#333;padding:14px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.18);font-size:13px;line-height:1.7;z-index:99999;white-space:nowrap;min-width:200px;';
        tip.innerHTML = content;
        el.style.position = 'relative';
        el.appendChild(tip);
    });
    el.addEventListener('mouseleave', () => {
        if (tip) { tip.remove(); tip = null; }
    });
}

function _showPhonePopup() {
    const lang = getLang();
    const popups = {
        kr: `<div style="text-align:center;margin-bottom:16px;font-size:36px;">📞</div>
            <div style="font-size:16px;font-weight:800;color:#333;text-align:center;margin-bottom:18px;">전화 문의 안내</div>
            <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px;">🏭 본사(출고문의)</div>
                <a href="tel:031-366-1984" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#333;font-size:15px;font-weight:700;">
                    <i class="fa-solid fa-phone" style="color:#16a34a;"></i> 031-366-1984</a>
            </div>
            <div style="background:#ede9fe;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:8px;">👤 제품문의 담당 매니저</div>
                <a href="tel:010-3455-1946" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#333;font-size:14px;font-weight:600;margin-bottom:6px;">
                    <i class="fa-solid fa-user" style="color:#7c3aed;width:14px;text-align:center;"></i> 지숙 매니저 010-3455-1946</a>
                <a href="tel:010-7793-5393" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#333;font-size:14px;font-weight:600;margin-bottom:6px;">
                    <i class="fa-solid fa-user" style="color:#7c3aed;width:14px;text-align:center;"></i> 은미 매니저 010-7793-5393</a>
                <a href="tel:010-3490-3328" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#333;font-size:14px;font-weight:600;">
                    <i class="fa-solid fa-user" style="color:#7c3aed;width:14px;text-align:center;"></i> 성희 매니저 010-3490-3328</a>
            </div>
            <div style="background:#eff6ff;border-radius:12px;padding:12px 16px;margin-bottom:6px;">
                <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:4px;">✉️ 이메일</div>
                <a href="mailto:design@chameleon.design" style="color:#2563eb;font-size:14px;font-weight:700;text-decoration:none;">design@chameleon.design</a>
            </div>
            <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px;">⏰ 상담시간: 평일 09:00~18:00</div>`,
        ja: `<div style="text-align:center;margin-bottom:16px;font-size:36px;">📞</div>
            <div style="font-size:16px;font-weight:800;color:#333;text-align:center;margin-bottom:18px;">お問い合わせ</div>
            <div style="background:#f0fdf4;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#16a34a;margin-bottom:6px;">🇯🇵 日本オフィス</div>
                <a href="tel:047-712-1148" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:#333;font-size:18px;font-weight:700;">
                    <i class="fa-solid fa-phone" style="color:#16a34a;"></i> 047-712-1148</a>
            </div>
            <div style="background:#eff6ff;border-radius:12px;padding:12px 16px;margin-bottom:6px;">
                <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:4px;">✉️ メール</div>
                <a href="mailto:design@chameleon.design" style="color:#2563eb;font-size:14px;font-weight:700;text-decoration:none;">design@chameleon.design</a>
            </div>
            <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px;">⏰ 営業時間: 平日 09:00〜18:00</div>`,
        en: `<div style="text-align:center;margin-bottom:16px;font-size:36px;">📞</div>
            <div style="font-size:16px;font-weight:800;color:#333;text-align:center;margin-bottom:18px;">Contact Us</div>
            <div style="background:#eff6ff;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#2563eb;margin-bottom:4px;">✉️ Email</div>
                <a href="mailto:design@chameleon.design" style="color:#2563eb;font-size:16px;font-weight:700;text-decoration:none;">design@chameleon.design</a>
            </div>
            <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px;">⏰ Business hours: Weekdays 09:00-18:00 (KST)</div>`,
    };
    const content = popups[lang] || popups['en'];
    const closeLabel = lang === 'kr' ? '닫기' : lang === 'ja' ? '閉じる' : 'Close';
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 28px 20px;max-width:360px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2);">' +
        content +
        '<div onclick="this.closest(\'div[style*=inset]\').remove()" style="text-align:center;margin-top:14px;font-size:13px;color:#999;cursor:pointer;font-weight:600;">' + closeLabel + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if(e.target===ov) ov.remove(); });
}

// ─── 패널 UI 생성 ───
function buildPanelUI() {
    panelEl.innerHTML = `
        <div class="adv-panel-header">
            <div class="adv-panel-title" style="gap:4px;">
                <button class="adv-studio-btn" id="advStudioBtn"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                <div style="position:relative;flex:1;">
                    <input type="text" id="advProductSearch" placeholder="${{kr:'제품 검색',ja:'商品検索',en:'Search',zh:'搜索',es:'Buscar',de:'Suche',fr:'Recherche',ar:'بحث'}[getLang()]||'Search'}" style="width:100%;padding:6px 28px 6px 10px;border:none;border-radius:8px;font-size:12px;background:#fff;color:#333;outline:none;font-family:inherit;box-sizing:border-box;" autocomplete="off">
                    <i class="fa-solid fa-magnifying-glass" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;color:#94a3b8;pointer-events:none;"></i>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                ${_getContactLinks()}
            </div>
        </div>
        <div id="advQQBar" style="display:flex;gap:6px;padding:8px 10px;background:linear-gradient(90deg,#312e81,#1e1b4b);border-bottom:1px solid #4338ca;">
            <button type="button" class="adv-qq-btn" data-qqcat="허니콤" style="flex:1;padding:8px 6px;border:none;border-radius:10px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e293b;font-weight:800;font-size:12px;cursor:pointer;">🍯 허니콤</button>
            <button type="button" class="adv-qq-btn" data-qqcat="종이매대" style="flex:1;padding:8px 6px;border:none;border-radius:10px;background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff;font-weight:800;font-size:12px;cursor:pointer;">📦 종이매대</button>
            <button type="button" class="adv-qq-btn" data-qqcat="패브릭" style="flex:1;padding:8px 6px;border:none;border-radius:10px;background:linear-gradient(135deg,#f472b6,#db2777);color:#fff;font-weight:800;font-size:12px;cursor:pointer;">🧵 패브릭</button>
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

    // 제품 검색
    const searchInput = document.getElementById('advProductSearch');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); _doProductSearch(searchInput.value.trim()); }
        });
    }

    // 초기화
    document.getElementById('advResetBtn').addEventListener('click', () => {
        clearChat();
    });

    // 전화 버튼: 클릭 → 팝업, hover → 툴팁
    const phoneBtn = document.getElementById('advPhoneBtn');
    if (phoneBtn) {
        phoneBtn.addEventListener('click', _showPhonePopup);
        _attachTooltip(phoneBtn, 'phone');
    }
    // 이메일 버튼: hover → 툴팁
    const emailBtn = phoneBtn ? phoneBtn.nextElementSibling : null;
    if (emailBtn && emailBtn.tagName === 'A') {
        _attachTooltip(emailBtn, 'email');
    }

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

    // 저장된 고객 정보 복원
    try {
        const saved = localStorage.getItem('kapu_customer');
        if (saved) {
            const c = JSON.parse(saved);
            _custName = c.name || '';
            _custPhone = c.phone || '';
        }
    } catch(e) {}

    // 저장된 대화 복원
    const restored = loadChat();
    const _hasContent = restored && chatArea && chatArea.innerHTML.trim().length > 50;
    console.log('[카푸] 대화 복원:', _hasContent ? '성공' : '없음', 'history:' + conversationHistory.length, '고객:', _custName || '(없음)');
    if (_hasContent) {
        scrollChat();
    } else {
        // 이름 입력 없이 바로 인사문구 표시
        showEntryForm();
    }

    // 페이지 이동/새로고침 시 대화 저장
    window.addEventListener('beforeunload', () => { saveChat(); });

    // 포토스튜디오 버튼
    document.getElementById('advStudioBtn')?.addEventListener('click', () => enterStudioMode());

    // 빠른견적 카테고리 버튼 → 설문 모달 직접 생성/열기
    panelEl.querySelectorAll('.adv-qq-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const cat = btn.dataset.qqcat;
            openQQSurvey(cat);
        });
    });
}

function openQQSurvey(cat) {
    let modal = document.getElementById('qqSurveyModal');
    if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);
    if (!modal) {
        // 폴백: 모달 직접 생성
        modal = document.createElement('div');
        modal.id = 'qqSurveyModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:2147483647;display:none;align-items:center;justify-content:center;padding:12px;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;padding:24px;width:480px;max-width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
                    <h3 id="qqModalTitle" style="margin:0;font-size:18px;font-weight:800;color:#1e293b;">🚀 빠른견적서</h3>
                    <button type="button" onclick="document.getElementById('qqSurveyModal').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#94a3b8;">&times;</button>
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">아래 항목을 입력하시면 담당 매니저가 빠르게 견적을 보내드립니다.</div>
                <form id="qqSurveyForm" onsubmit="return window.submitQuickQuote(event)">
                    <input type="hidden" id="qqCategory" name="category" value="">
                    <div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:700;color:#334155;">성함 *</label><input type="text" name="name" required style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;margin-top:4px;"></div>
                    <div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:700;color:#334155;">연락처 *</label><input type="tel" name="phone" required placeholder="010-0000-0000" style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;margin-top:4px;"></div>
                    <div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:700;color:#334155;">예산금액</label>
                        <input type="hidden" name="budget" id="qqBudgetValue" value="">
                        <div id="qqBudgetBtns" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;">
                            <button type="button" class="qq-budget-btn" data-budget="10만원" style="padding:10px 4px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:700;font-size:13px;cursor:pointer;">10만원</button>
                            <button type="button" class="qq-budget-btn" data-budget="100만원" style="padding:10px 4px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:700;font-size:13px;cursor:pointer;">100만원</button>
                            <button type="button" class="qq-budget-btn" data-budget="500만원" style="padding:10px 4px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:700;font-size:13px;cursor:pointer;">500만원</button>
                            <button type="button" class="qq-budget-btn" data-budget="1000만원" style="padding:10px 4px;border:1.5px solid #fbbf24;border-radius:10px;background:#fef3c7;color:#78350f;font-weight:800;font-size:13px;cursor:pointer;">1000만원</button>
                        </div>
                    </div>
                    <div style="margin-bottom:10px;"><label style="font-size:12px;font-weight:700;color:#334155;">요청사항</label><textarea name="memo" rows="3" placeholder="수량/사이즈/납품일/용도 등 자세히" style="width:100%;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;margin-top:4px;resize:vertical;"></textarea></div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px;font-weight:700;color:#334155;">파일 업로드</label><input type="file" name="files" multiple style="width:100%;padding:8px;border:1.5px dashed #cbd5e1;border-radius:10px;margin-top:4px;background:#f8fafc;"></div>
                    <button type="submit" style="width:100%;padding:14px;background:linear-gradient(135deg,#312e81,#1e1b4b);color:#fff;font-weight:800;font-size:15px;border:none;border-radius:12px;cursor:pointer;">견적 요청 보내기</button>
                </form>
            </div>`;
        document.body.appendChild(modal);
    }
    // z-index 최상위 보장
    modal.style.zIndex = '2147483647';
    const form = modal.querySelector('#qqSurveyForm');
    const catInput = modal.querySelector('#qqCategory');
    const title = modal.querySelector('#qqModalTitle');
    if (form) form.reset();
    if (catInput) catInput.value = cat;
    if (title) title.textContent = '🚀 ' + cat + ' 빠른견적서';
    // 예산 버튼 이벤트 바인딩
    modal.querySelectorAll('#qqBudgetBtns .qq-budget-btn').forEach(b => {
        const is1000 = b.dataset.budget === '1000만원';
        b.style.background = is1000 ? '#fef3c7' : '#fff';
        b.style.color = is1000 ? '#78350f' : '';
        b.style.borderColor = is1000 ? '#fbbf24' : '#cbd5e1';
        b.onclick = () => {
            const bv = modal.querySelector('#qqBudgetValue');
            if (bv) bv.value = b.dataset.budget;
            modal.querySelectorAll('#qqBudgetBtns .qq-budget-btn').forEach(x => {
                const is1k = x.dataset.budget === '1000만원';
                x.style.background = is1k ? '#fef3c7' : '#fff';
                x.style.color = is1k ? '#78350f' : '';
                x.style.borderColor = is1k ? '#fbbf24' : '#cbd5e1';
            });
            b.style.background = '#312e81';
            b.style.color = '#fff';
            b.style.borderColor = '#312e81';
        };
    });
    modal.style.display = 'flex';

    // submitQuickQuote: 파일 업로드 포함 버전으로 항상 재정의
    window.submitQuickQuote = async function(ev) {
        ev.preventDefault();
        const form = ev.target;
        const btn = form.querySelector('button[type=submit]');
        const origLabel = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = '⏳ 전송 중...'; }
        const fd = new FormData(form);
        const c = fd.get('category');
        const name = (fd.get('name')||'').trim();
        const phone = (fd.get('phone')||'').trim();
        const budget = (fd.get('budget')||'').trim();
        const memo = (fd.get('memo')||'').trim();
        const fileInput = form.querySelector('input[name=files]');
        let autoManager = '', autoPw = '';
        if (c === '허니콤' && budget === '500만원') { autoManager = '지숙'; autoPw = '1946'; }
        else if (budget === '1000만원' || c === '종이매대' || c === '패브릭') { autoManager = '본사'; autoPw = '1234'; }
        const isVIP1000 = !!autoManager;
        const lockPrefix = isVIP1000 ? `[LOCK:${btoa(autoPw)}:${autoManager}]\n` : '';
        const body = lockPrefix + [`[QQ:${c}]`, budget && `예산금액: ${budget}`, memo && `요청사항:\n${memo}`].filter(Boolean).join('\n');
        try {
            const sb = window.sb || window.supabase;
            if (!sb) { alert('연결 오류. 새로고침 후 다시 시도해주세요.'); if(btn){btn.disabled=false;btn.textContent=origLabel;} return false; }
            const uploaded = [];
            if (fileInput && fileInput.files && fileInput.files.length) {
                const ts = Date.now(); const rnd = Math.random().toString(36).substring(2,8);
                for (let i=0; i<fileInput.files.length; i++) {
                    const f = fileInput.files[i];
                    const ext = (f.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g,'');
                    const path = `vip_uploads/QQ_${ts}_${rnd}_${i}.${ext}`;
                    const { error: upErr } = await sb.storage.from('orders').upload(path, f);
                    if (upErr) { alert('파일 업로드 실패: '+upErr.message); if(btn){btn.disabled=false;btn.textContent=origLabel;} return false; }
                    const { data: pub } = sb.storage.from('orders').getPublicUrl(path);
                    uploaded.push({ name: f.name, url: pub.publicUrl });
                }
            }
            const payload = { customer_name: name, customer_phone: phone, memo: body, files: uploaded, status: autoManager ? ('상담중: ' + autoManager) : '대기중' };
            if (autoManager) payload.preferred_manager = autoManager;
            const { error } = await sb.from('vip_orders').insert(payload);
            if (error) { alert('전송 실패: ' + error.message); if(btn){btn.disabled=false;btn.textContent=origLabel;} return false; }
            document.getElementById('qqSurveyModal').style.display = 'none';
            alert('✅ ' + c + ' 견적 요청이 접수되었습니다. 담당 매니저가 곧 연락드립니다.');
        } catch(e) { alert('오류: ' + e.message); }
        if(btn){btn.disabled=false;btn.textContent=origLabel;}
        return false;
    };
}

// ─── 헤더 업데이트 ───
function updateHeaderForAI() {
    const titleEl = panelEl?.querySelector('.adv-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('title')} <button class="adv-studio-btn" id="advStudioBtn">🎨 ${t('studio')}</button>`;
        document.getElementById('advStudioBtn')?.addEventListener('click', () => enterStudioMode());
    }
}
function sendFromInput() {
    const input = document.getElementById('advInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val && !pendingImage) return;
    if (isProcessing) return;
    input.value = '';

    const img = pendingImage;
    clearPendingImage();
    sendMessage(val, img);
}

// ─── 파일 선택 처리 ───
function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    e.target.value = '';

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
    panelEl.style.display = 'flex';
    if (!chatArea) buildPanelUI();
    sendMessage(query.trim());
    panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── AI 메시지 전송 ───
async function sendMessage(text, imageData) {
    if (isProcessing) return;

    // ★ 사용자가 상담사/연락처 키워드를 직접 입력하면 AI 호출 없이 바로 콜백 폼
    if (text && !imageData) {
        const _userLower = text.toLowerCase();
        const _directConsultKeys = ['상담사 연결','상담사연결','상담사 요청','상담사요청','매니저 연결','매니저연결','인간 상담','인간상담','사람 연결','사람연결','상담원 연결','상담원연결','상담사','매니저','상담원','연락처 남기기','연락처남기기','콜백','전화 요청',
            '担当者','担当者接続','マネージャー','コールバック','consultant','connect agent','human agent','talk to human','real person','manager','callback','call me'];
        if (_directConsultKeys.some(k => _userLower.includes(k))) {
            addBubble(text, 'user');
            startCallbackFlow();
            return;
        }
        // ★ 견적 요청 키워드 감지 → 견적 폼 바로 표시
        const _quoteKeys = ['견적요청','부스견적','전시견적','대량견적','quote request','booth quote','見積もり依頼','ブース見積もり'];
        if (_quoteKeys.some(k => _userLower.includes(k))) {
            addBubble(text, 'user');
            startQuoteFlow();
            return;
        }
        // ★ 셀프디자인/에디터 키워드 감지 → 설명 버블 표시
        // (실제 에디터 열기는 메인화면 상단의 '셀프디자인' 버튼으로 유도)
        const _editorKeys = [
            '셀프디자인','셀프 디자인','셀프디자','에디터','에디터로','에디터 열기','에디터 링크','에디터에서','직접 디자인','내가 디자인','내가디자인','디자인 직접',
            'editor','self design','self-design','design myself','open editor',
            'セルフデザイン','エディター','エディタ','エディターで','自分でデザイン','エディタを開く',
            '自助设计','编辑器','自己设计',
            'auto-diseño','editor yo','propio diseño',
            'selbstgestaltung','editor öffnen','selbst entwerfen',
            'auto-design','concevoir moi-même','ouvrir éditeur',
            'تصميم ذاتي','المحرر'
        ];
        if (_editorKeys.some(k => _userLower.includes(k))) {
            addBubble(text, 'user');
            const _lang = getLang();
            const _selfDesignMsg = {
                kr: '에디터를 통해 셀프로 디자인 할 수 있어요. 다 작업하신 후에는 파일 다운받기를 통해 다운받거나 고객님 개인 서버에 보관도 가능합니다.\n\n메인화면 상단의 🎨 **셀프디자인** 버튼을 이용해 주세요!',
                ja: 'エディターでセルフデザインが可能です。作業後はファイルをダウンロードしたり、お客様専用サーバーに保存することもできます。\n\nメイン画面上部の 🎨 **セルフデザイン** ボタンをご利用ください！',
                en: 'You can design your own artwork with our editor. When finished, download the file or save it to your personal server.\n\nUse the 🎨 **Self-Design** button at the top of the main screen!',
                zh: '您可以通过编辑器进行自助设计。完成后可以下载文件或保存到个人服务器。\n\n请使用主页顶部的 🎨 **自助设计** 按钮！',
                es: 'Puede diseñar su propio arte con nuestro editor. Al terminar, descargue el archivo o guárdelo en su servidor personal.\n\n¡Use el botón 🎨 **Auto-Diseño** en la parte superior de la pantalla principal!',
                de: 'Sie können Ihre eigenen Designs mit unserem Editor gestalten. Nach Fertigstellung können Sie die Datei herunterladen oder auf Ihrem persönlichen Server speichern.\n\nVerwenden Sie die 🎨 **Selbstgestaltung**-Schaltfläche oben auf dem Hauptbildschirm!',
                fr: 'Vous pouvez concevoir votre propre design avec notre éditeur. Une fois terminé, téléchargez le fichier ou enregistrez-le sur votre serveur personnel.\n\nUtilisez le bouton 🎨 **Auto-Design** en haut de l\'écran principal !',
                ar: 'يمكنك تصميم أعمالك الخاصة باستخدام المحرر. عند الانتهاء، قم بتنزيل الملف أو حفظه على خادمك الشخصي.\n\nاستخدم زر 🎨 **التصميم الذاتي** في أعلى الشاشة الرئيسية!'
            };
            const _msg = _selfDesignMsg[_lang] || _selfDesignMsg.en;
            setTimeout(() => addBubble(_msg, 'ai'), 200);
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
            content: `[챗봇 핵심 역할]
너는 카멜레온프린팅의 안내봇이다. 견적은 주지 않는다. 가격 계산도 하지 않는다. 고객 요구사항을 상세히 묻지 않는다. 단순히 제품을 간단히 소개하고 해당 상품 페이지 링크를 주는 역할이다. 고객이 페이지에 들어가서 직접 옵션을 선택하고 주문하면 된다.

★★★★★ [절대 규칙 — 제품명이 보이면 무조건 링크]
고객이 아래 키워드 중 하나라도 언급하면 즉시 1~2문장 설명 + 해당 카테고리 링크를 제공한다. 추가 질문 금지. 사이즈/수량/옵션/색상/디자인/납기 묻지 마라. 자세한 건 고객이 링크 페이지에서 선택하면 된다.

[카테고리 링크 맵 — 모든 언어]
각 카테고리마다 한국어/일본어/영어/중국어/기타 언어 키워드가 모두 포함된다. 어떤 언어로 말해도 매칭해라.

🍯 → /honeycomb
  - 한: 허니콤보드, 허니콤, 종이보드, 가벽, 파티션, 등신대, 종이 디스플레이, 팝업스토어
  - 日: ハニカムボード, 紙ボード, 仕切り壁, パーティション, 等身大, 紙ディスプレイ, ポップアップ
  - EN: honeycomb board, paper display, partition wall, standee, pop-up display
  - 中: 蜂窝板, 纸板展示, 隔断墙

🧵 → /fabric-print
  - 한: 패브릭, 원단, 천 인쇄, 천인쇄, 광목, 면천, 면포, 코튼, 綿布, 綿, 옥스포드, 쉬폰, 린넨, 백월, 포토존 배경, 배경막, 현수막 천
  - 日: ファブリック, 布印刷, 生地印刷, 綿布, 綿, コットン, 光木, オックスフォード, シフォン, リネン, バックウォール, フォトゾーン背景, 背景幕, 横断幕 布
  - EN: fabric print, cloth print, cotton, canvas, linen, oxford, chiffon, back wall, photo zone backdrop, fabric banner
  - 中: 布料印刷, 织物印刷, 棉布, 横幅布, 背景布

🪵 → /foamex-print
  - 한: 포맥스, PVC, PVC폼보드, 포맥스 간판, 폼 보드
  - 日: フォメックス, PVCフォームボード, PVC印刷, 看板 PVC
  - EN: foamex, PVC foam board, PVC signage
  - 中: PVC发泡板, PVC板

🪟 → /foamboard-print
  - 한: 우드락, 폼보드(얇은 종류)
  - 日: スチロール, 薄いフォームボード, ウッドラック
  - EN: foam board (thin), styrofoam board
  - 中: 泡沫板, 薄泡沫板

🏪 → /foamex-stand
  - 한: 포맥스 매대, PVC 진열대, PVC 매대
  - 日: PVC陳列台, PVC什器
  - EN: PVC display stand, PVC shelf
  - 中: PVC展示架, PVC货架

💎 → /acrylic-print
  - 한: 아크릴, UV 아크릴, 아크릴 간판, 아크릴 안내판, 아크릴 네임플레이트
  - 日: アクリル, UVアクリル, アクリル看板, アクリル案内板, アクリルネームプレート
  - EN: acrylic print, UV acrylic, acrylic sign, acrylic nameplate
  - 中: 亚克力, 亚克力印刷, 亚克力招牌

🎁 → /goods
  - 한: 아크릴 키링, 포토카드, 아크릴 스탠드, 아크릴 뱃지, 굿즈, 아크릴 굿즈
  - 日: アクリルキーホルダー, フォトカード, アクリルスタンド, アクリルバッジ, グッズ, アクリルグッズ
  - EN: acrylic keyring, photo card, acrylic stand, acrylic badge, merch, fan goods
  - 中: 亚克力钥匙扣, 照片卡, 亚克力立牌, 周边商品

📦 → /paper-stand
  - 한: 종이매대, POP 진열대, 매장 진열대, 카드보드 디스플레이
  - 日: 紙什器, 紙陳列台, POPスタンド, カードボードディスプレイ
  - EN: paper display stand, POP display, cardboard display
  - 中: 纸货架, 纸质展示架, POP展台

🪑 → /paper-furniture
  - 한: 종이가구, 골판지 가구, 종이 테이블, 종이 의자
  - 日: 紙家具, 段ボール家具, 紙テーブル, 紙椅子
  - EN: paper furniture, cardboard furniture, paper table, paper chair
  - 中: 纸家具, 瓦楞纸家具

📄 → /biz-print
  - 한: 명함, 전단지, 브로셔, 리플렛, 리플렛팅, 책자
  - 日: 名刺, チラシ, ブローシャ, リーフレット, 小冊子
  - EN: business card, flyer, brochure, leaflet, booklet
  - 中: 名片, 传单, 宣传册, 小册子

🎁 → /promo-items
  - 한: 판촉물, 기념품, 홍보물, 머그컵, 텀블러, 볼펜, 에코백, 부채
  - 日: 販促品, 記念品, ノベルティ, マグカップ, タンブラー, ボールペン, エコバッグ, うちわ
  - EN: promo items, souvenirs, giveaways, mug, tumbler, pen, eco bag, fan
  - 中: 宣传品, 纪念品, 马克杯, 保温杯, 圆珠笔, 环保袋

👕 → /tshirt-print
  - 한: 티셔츠, 단체복, 유니폼, 커플티, 팀복
  - 日: Tシャツ, 団体服, ユニフォーム, カップルT, チームウェア
  - EN: t-shirt, uniform, team wear, couple shirt
  - 中: T恤, 团体服, 制服, 队服

🎯 → /banner-stand
  - 한: 배너, X배너, 롤업배너, 배너 스탠드
  - 日: バナー, Xバナー, ロールアップバナー, バナースタンド
  - EN: banner, X-banner, roll-up banner, banner stand
  - 中: 展架, X展架, 易拉宝, 横幅

🪩 → /standee
  - 한: 등신대, 실물크기 패널, 포토존 등신대
  - 日: 等身大, 実物大パネル, フォトスポット等身大
  - EN: standee, life-size panel, photo op standee
  - 中: 等身立牌, 真人大小展板

📮 소량 인쇄 / 청첩장 / 초대장 / 포스터(소량) / 엽서 → /biz-print
  - 한: 소량 인쇄, 청첩장, 초대장, 포스터(소량), 엽서, 인쇄물
  - 日: 少量印刷, 結婚式招待状, 招待状, ポスター(少量), ポストカード, 印刷物
  - EN: small quantity print, wedding invitation, invitation card, postcard, printed material
  - 中: 小量印刷, 请柬, 邀请函, 明信片, 印刷品

[★★★★★ 링크 화이트리스트 — 이 URL만 사용할 것 ★★★★★]
아래 15개 URL이 유일하게 허용된 링크다. 이 외 어떤 URL도 절대 만들어내지 마라. 특히:
  - ❌ /?product=xxxxx 형식 절대 금지 (존재하지 않는 상품 코드 링크 금지)
  - ❌ /products/xxx, /item/xxx, /shop/xxx 같은 없는 경로 금지
  - ❌ 당신이 모르는 제품 코드 금지
허용 URL (이것만 사용):
  /honeycomb, /fabric-print, /foamex-print, /foamboard-print, /foamex-stand,
  /acrylic-print, /goods, /paper-stand, /paper-furniture, /biz-print,
  /promo-items, /tshirt-print, /banner-stand, /standee
확실한 카테고리를 모르겠으면 가장 가까운 카테고리 링크를 주고, 없다면 "담당자 연락처 남기기" 버튼을 안내해라. 절대로 링크를 지어내지 마라.

[응답 형식 — 절대 규칙, 고객 언어 무관]
★ 총 2~4문장으로 제한. 첫 문장에 "네/はい/Yes/是的"로 간단 확인, 1문장 핵심 특징, 마지막에 마크다운 링크. 그게 끝이다.
★ 고객이 일본어로 물으면 일본어로 답하되 동일한 2~4문장 + 링크 형식. 영어면 영어로 답하되 동일 형식. 다른 언어도 마찬가지.
★ 절대 "ご注文の流れ" "ファイルについて" "1. 2. 3. 단계" 같은 긴 안내문 금지. 고객은 사이트에 들어가서 직접 결제 흐름을 따라가면 된다.
★ 질문으로 응답을 끝내지 마라 (예: "サイズを教えてください" "수량은 얼마나 되세요?" 같은 꼬리질문 전부 금지).
★ 반드시 위 15개 URL 중 하나만 사용. 제품 코드 형식(/?product=xxx)은 절대 사용 금지.

[한국어 예시]
Q: "포맥스 3mm 간판 제작 가능한가요?"
A: "네, 포맥스(PVC 폼보드) 인쇄 가능합니다. 두께·사이즈·후가공 옵션은 상품 페이지에서 직접 선택하실 수 있어요.
👉 [포맥스 인쇄 상품 보기](/foamex-print)"

[일본어 예시]
Q: "綿布（コットン）にオリジナルデザインをプリントできますか？"
A: "はい、コットン・綿布・ファブリック原単へのプリント可能です。バックウォール、フォトゾーン背景、横断幕用として人気です。
👉 [ファブリック印刷商品を見る](/fabric-print)"

Q: "ハニカムボードで仕切り壁は作れますか？"
A: "はい、ハニカムボードで仕切り壁（パーティション）を製作できます。軽量で環境に優しく、展示会やポップアップストアで人気です。
👉 [ハニカムボード商品を見る](/honeycomb)"

Q: "フォメックス3mm看板できますか？"
A: "はい、フォメックス（PVCフォームボード）印刷可能です。厚さ・サイズ・加工オプションは商品ページで直接選択できます。
👉 [フォメックス印刷商品を見る](/foamex-print)"

[English examples]
Q: "Can you print on cotton fabric?"
A: "Yes, we print on cotton, canvas, and various fabric types. Popular for back walls, photo zone backdrops, and fabric banners.
👉 [View fabric print products](/fabric-print)"

Q: "Is acrylic signage available?"
A: "Yes, UV acrylic sign printing is available. Choose thickness and size directly on the product page.
👉 [View acrylic print products](/acrylic-print)"

[中文示例]
Q: "可以在棉布上印刷吗？"
A: "是的，可以在棉布、帆布、各种织物上印刷。常用于背景墙、照片区背景、横幅等。
👉 [查看布料印刷产品](/fabric-print)"

[절대 금지 — 모든 언어 동일 적용]
- 견적 계산 금지 (수량×단가, 사이즈×가격 등 계산 출력 금지)
- 상세 옵션 질문 금지 (사이즈, 수량, 용지, 후가공, 색상, 디자인, 납기 등 묻지 말 것)
- "어떤 용도로 사용하시나요?" / "サイズを教えてください" / "What size?" 같은 꼬리 질문 금지
- 브랜드 컬러/폰트/로고 같은 디자인 상담 질문 금지
- 고객이 답하기 전에 여러 개의 질문을 쏟아내는 것 금지
- "ご注文の流れ" "ファイルについて" "1️⃣ 2️⃣ 3️⃣" 같은 단계별 긴 설명서 금지 — 사이트에 들어가면 결제 흐름이 자동으로 안내된다
- "まずは…" "最初に…" "先に…" 같이 고객에게 선행 작업을 요구하지 마라
- 일본어/영어/중국어 응답이라고 한국어보다 더 길어져서는 안 된다. 모든 언어 동일하게 2~4문장 + 링크

[링크 금지 예외 — 제품이 아닌 질문에는 링크 주지 말고 간단히 안내만]
- 배송 시간 / 당일출고 / 언제 도착 → "평일 오후 3시 이전 결제 시 당일출고됩니다." 정도로 짧게
- 상담 전화번호 → 전화번호만 안내
- 결제 수단 / 카드 / 무통장 → 짧게 안내
- 사업자등록 / 세금계산서 → 짧게 안내
- 환불 / 교환 / A/S → 정책 짧게 안내
- 단순 인사 / 잡담 → 짧게 인사만 ("안녕하세요! 무엇을 도와드릴까요?")

[셀프디자인 요청] 고객이 "직접 디자인", "에디터 열어줘", "셀프로 만들고 싶다" 등 말하면 한 문장만: "✏️ 직접 디자인하시려면 '셀프디자인'이라고 입력해주세요. 사이즈 입력 후 에디터가 바로 열립니다!"

[상담 연결] 고객이 복잡한 맞춤 견적·특수 프로젝트·대규모 전시 등을 문의하면 링크 대신: "담당자가 직접 도와드리는 게 빠를 것 같아요. 📞 상단의 '연락처 남기기' 버튼을 눌러주시면 빠르게 연락드립니다."`
        };
        const payload = {
            message: text,
            lang: getLang(),
            conversation_history: [sysHint, ...conversationHistory.slice(-40)]
        };
        if (_advRoomId) payload.room_id = _advRoomId;
        if (_custName) payload.customer_name = _custName;
        if (_custPhone) payload.customer_phone = _custPhone;
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

        // room_id 저장 (다음 메시지에서 재사용)
        if (data.room_id && data.room_id !== _advRoomId) {
            _advRoomId = data.room_id;
            subscribeAdminMessages(_advRoomId);
        } else if (data.room_id) {
            _advRoomId = data.room_id;
        }

        typingEl.remove();

        let chatMsg = data.chat_message || data.summary || '';
        // ★ [QUOTE_FORM] 태그 감지 → 태그 제거 후 견적 폼 표시
        const _hasQuoteForm = chatMsg.includes('[QUOTE_FORM]');
        if (_hasQuoteForm) chatMsg = chatMsg.replace(/\[QUOTE_FORM\]/g, '').trim();
        if (chatMsg) addBubble(chatMsg, 'ai');
        if (_hasQuoteForm) setTimeout(() => startQuoteFlow(), 300);

        // ★ 견적서 PDF 생성 처리
        console.log('[견적서] data.type:', data.type, 'quote_data:', data.quote_data);
        if (data.type === 'quote' && data.quote_data && data.quote_data.items && data.quote_data.items.length > 0) {
            console.log('[견적서] PDF 생성 요청 시작...', JSON.stringify(data.quote_data));
            try {
                const _qRes = await fetch(SUPA_URL + '/functions/v1/generate-quote-pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPA_KEY },
                    body: JSON.stringify(data.quote_data)
                });
                console.log('[견적서] PDF API 응답 status:', _qRes.status);
                const _qText = await _qRes.text();
                console.log('[견적서] PDF API 응답 body:', _qText.substring(0, 500));
                let _qData;
                try { _qData = JSON.parse(_qText); } catch(pe) { console.error('[견적서] JSON 파싱 실패:', pe); _qData = {}; }
                if (_qData.url) {
                    const _total = (_qData.total || 0).toLocaleString();
                    const _quoteItems = data.quote_data.items;
                    const _quoteId = 'quote_' + Date.now();
                    // 견적 아이템을 전역에 저장 (결제 버튼에서 사용)
                    window['_pendingQuote_' + _quoteId] = { items: _quoteItems, products: data.products || [], shipping_fee: data.quote_data.shipping_fee || 0 };

                    // ★ 챗봇 견적서 PDF URL 저장 (장바구니에서 재사용)
                    localStorage.setItem('chameleon_quote_pdf_url', _qData.url);

                    // ★ 견적서 전달 내역을 chat_messages에 저장 (관리자 페이지에서 확인용)
                    try {
                        const _qItemsSummary = data.quote_data.items.map(i => `${i.name} ${i.spec||''} x${i.qty} = ${(i.total||0).toLocaleString()}원${i.is_addon?' (옵션)':''}`).join('\n');
                        const _qTotal = data.quote_data.items.reduce((s,i) => s + (i.total||0), 0);
                        const _qShipping = data.quote_data.shipping_fee || 0;
                        const _quoteMsgText = '[QUOTE_PDF:' + _qData.url + ']\n[견적내역]\n' + _qItemsSummary + '\n합계: ' + _qTotal.toLocaleString() + '원' + (_qShipping ? ' + 배송비 ' + _qShipping.toLocaleString() + '원' : '');
                        const _sbQ = getSb();
                        if (_sbQ && _advRoomId) {
                            _sbQ.from('chat_messages').insert({
                                room_id: _advRoomId,
                                sender_type: 'system',
                                message: _quoteMsgText,
                                created_at: new Date().toISOString()
                            }).then(r => { if (r.error) console.error('[견적서] DB 저장 실패:', r.error); else console.log('[견적서] DB 저장 완료'); });
                        }
                    } catch(_qe) { console.error('[견적서] DB 저장 오류:', _qe); }

                    const _pdfCard = document.createElement('div');
                    _pdfCard.style.cssText = 'background:linear-gradient(135deg,#4338ca,#6366f1);border-radius:12px;padding:16px;margin:8px 0;color:#fff;';
                    _pdfCard.innerHTML = '<div style="font-size:14px;font-weight:800;margin-bottom:8px;">📄 견적서가 준비되었습니다</div>'
                        + '<div style="font-size:12px;opacity:0.9;margin-bottom:12px;">합계: ' + _total + '원 (VAT포함)</div>'
                        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">'
                        + '<a href="' + _qData.url + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#fff;color:#4338ca;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">📥 견적서 다운로드</a>'
                        + '<button onclick="window._quoteToCart(\'' + _quoteId + '\')" style="display:inline-flex;align-items:center;gap:6px;background:#22c55e;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;border:none;cursor:pointer;">🛒 견적금액 결제하기</button>'
                        + '</div>'
                        + '<div style="font-size:11px;opacity:0.85;line-height:1.6;margin-bottom:10px;">견적 확인하시고 결제하기를 누르시면 장바구니에 제품이 담겨있어요. 파일은 장바구니에서 올리실 수 있습니다.</div>';
                    if (chatArea) { chatArea.appendChild(_pdfCard); scrollChat(); }
                    // 견적서 아래에 제품 카드도 표시 (수동 주문용)
                } else {
                    console.error('[견적서] PDF URL 없음:', _qData);
                }
            } catch (e) { console.error('견적서 PDF 생성 실패:', e); }
        }

        const products = data.products || [];
        // ★ 견적 데이터도 대화 기록에 포함 (재견적 시 이전 내용 참조용)
        let historyContent = chatMsg;
        if (data.type === 'quote' && data.quote_data && data.quote_data.items) {
            const qItems = data.quote_data.items;
            const qSummary = qItems.map(i => `${i.name} ${i.spec||''} x${i.qty} = ${i.total?.toLocaleString()}원${i.is_addon?' (옵션)':''}`).join('\n');
            historyContent += '\n[견적내역]\n' + qSummary + '\n합계: ' + (data.quote_data.items.reduce((s,i) => s + (i.total||0), 0)).toLocaleString() + '원';
            if (data.quote_data.shipping_fee) historyContent += ' + 배송비 ' + data.quote_data.shipping_fee.toLocaleString() + '원';
        }
        conversationHistory.push({
            role: 'assistant',
            content: historyContent,
            products: products.length > 0 ? products.map(p => ({ code: p.code, name: p.name })) : undefined
        });

        // 제품 카드: AI가 보낸 모든 제품을 항상 표시 (가격 안내 금지 → 링크로 유도)
        if (products.length > 0) {
            lastProducts = products;
            addProductCards(products);
        }

        // ★ 연락처 남기기 키워드 감지 — 사용자 메시지에서만 (AI 응답은 무시)
        const _userText = (text || '').toLowerCase();
        const _consultantKeywords = ['상담사 연결','상담사연결','상담사 요청','상담사요청','매니저 연결','매니저연결','인간 상담','인간상담','사람 연결','사람연결','상담원 연결','상담원연결','연락처 남기기','콜백',
            '担当者','担当者接続','マネージャー','コールバック','consultant','connect consultant','human agent','talk to human','real person','manager','callback','call me'];
        const _wantsConsultant = _consultantKeywords.some(k => _userText.includes(k));
        if (_wantsConsultant) {
            setTimeout(() => startCallbackFlow(), 500);
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
// 관리자 메시지 실시간 수신
// ═══════════════════════════════════════
let _adminSub = null;
function subscribeAdminMessages(roomId) {
    const sb = getSb();
    if (!sb || !roomId) return;
    if (_adminSub) { try { _adminSub.unsubscribe(); } catch(e) {} _adminSub = null; }

    _adminSub = sb.channel('adv-admin-' + roomId)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'chat_messages',
            filter: 'room_id=eq.' + roomId
        }, (payload) => {
            const m = payload.new;
            if (!m) return;
            // 관리자가 보낸 메시지만 표시 (sender_name에 '관리자' 포함)
            if (m.sender_type === 'chatbot' && m.sender_name && m.sender_name.includes('관리자')) {
                addBubble(m.message, 'ai');
                scrollChat();
                saveChat();
            }
        })
        .subscribe();
}

// ═══════════════════════════════════════
// 연락처 남기기 (콜백 요청) 기능
// ═══════════════════════════════════════

function startCallbackFlow() {
    if (!chatArea) return;
    const card = document.createElement('div');
    card.className = 'adv-row adv-row-ai';
    card.innerHTML = `
        <div class="adv-avatar"><i class="fa-solid fa-phone"></i></div>
        <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe); border:1px solid #7dd3fc; border-radius:16px; padding:16px; max-width:85%;">
            <div style="text-align:center; margin-bottom:10px;">
                <div style="font-size:24px;">📞</div>
                <div style="font-weight:700; color:#0369a1; font-size:14px;">${t('callbackTitle')}</div>
                <div style="font-size:12px; color:#0369a1; opacity:0.8; margin-top:4px;">${t('callbackDesc')}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <input id="advCallbackPhone" type="tel" placeholder="${t('callbackPhonePh')}" style="width:100%; padding:12px 14px; border:1.5px solid #7dd3fc; border-radius:10px; font-size:14px; outline:none; font-family:inherit; box-sizing:border-box; text-align:center;">
                <input id="advCallbackName" type="text" placeholder="${t('namePh')}" style="width:100%; padding:10px 14px; border:1.5px solid #7dd3fc; border-radius:10px; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; text-align:center;">
                <button id="advCallbackSubmit" style="background:#0284c7; color:#fff; border:none; padding:12px 16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:14px; width:100%;">${t('callbackSubmit')}</button>
            </div>
        </div>
    `;
    chatArea.appendChild(card);
    scrollChat();
    const phoneInput = document.getElementById('advCallbackPhone');
    if (phoneInput) phoneInput.focus();

    document.getElementById('advCallbackSubmit').addEventListener('click', async () => {
        const phone = document.getElementById('advCallbackPhone').value.trim();
        const name = document.getElementById('advCallbackName').value.trim();
        if (!phone) {
            document.getElementById('advCallbackPhone').style.borderColor = '#ef4444';
            document.getElementById('advCallbackPhone').placeholder = t('callbackPhoneErr');
            return;
        }
        card.remove();

        // Save callback request to DB
        const sb = getSb();
        if (sb) {
            // AI conversation summary
            let summary = '';
            try {
                summary = conversationHistory.slice(-4).map(h =>
                    (h.role === 'user' ? '고객: ' : 'AI: ') + String(h.content).substring(0, 80)
                ).join('\n');
            } catch(e) {}

            try {
                await sb.from('callback_requests').insert({
                    phone: phone,
                    name: name || '',
                    summary: summary,
                    site_lang: getLang(),
                    status: 'pending',
                    source: 'chatbot',
                    session_id: _advRoomId || null
                });
            } catch(e) {
                console.error('callback_requests insert error:', e);
            }
        }

        addBubble(t('callbackSuccess'), 'ai');
        scrollChat();
        saveChat();
    });
}

// ═══════════════════════════════════════
// 견적 요청 (Quote Request) 기능
// ═══════════════════════════════════════

function startQuoteFlow() {
    if (!chatArea) return;
    const lang = getLang();
    const quoteNotice = lang === 'ja'
        ? '大型注文は専任マネージャーがお客様にお電話でご案内いたします。ファイルとお名前・電話番号をご入力ください。30分以内にご連絡いたします。'
        : lang === 'en'
        ? 'For bulk orders, a dedicated manager will call you directly. Please enter your file, name, and phone number. We will contact you within 30 minutes.'
        : '대량 주문건은 전담 매니저가 고객님께 전화를 해서 안내해 드립니다. 파일과 성함, 전화번호를 적어주시면 30분 이내에 연락을 드립니다.';

    const memoPh = {kr:'요청사항 (사이즈, 수량, 용도 등)',ja:'ご要望（サイズ、数量、用途など）',en:'Request details (size, qty, purpose)',zh:'需求详情（尺寸、数量、用途）',ar:'تفاصيل الطلب (الحجم، الكمية، الغرض)',es:'Detalles (tamaño, cantidad, uso)',de:'Details (Größe, Menge, Zweck)',fr:'Détails (taille, quantité, usage)'}[lang] || 'Request details';

    const card = document.createElement('div');
    card.className = 'adv-row adv-row-ai';
    card.style.cssText = 'display:block; width:100%; margin-bottom:12px;';
    card.innerHTML = `
        <div style="width:100%; box-sizing:border-box; background:linear-gradient(180deg,#ffffff,#f8fafc); border:1px solid #e2e8f0; border-radius:16px; padding:18px 16px; box-shadow:0 2px 12px rgba(15,23,42,0.06); word-break:keep-all; overflow-wrap:break-word;">
            <div style="text-align:center; margin-bottom:14px;">
                <div style="display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; font-size:20px; margin-bottom:8px; box-shadow:0 4px 12px rgba(14,165,233,0.3);">📋</div>
                <div style="font-weight:800; color:#0f172a; font-size:15px; letter-spacing:-0.3px;">${t('quoteTitle')}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                <input id="advQuoteName" type="text" placeholder="${t('namePh')}" style="width:100%; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; background:#fff; transition:border-color 0.15s;">
                <input id="advQuotePhone" type="tel" placeholder="${t('callbackPhonePh')}" style="width:100%; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:14px; outline:none; font-family:inherit; box-sizing:border-box; background:#fff; transition:border-color 0.15s;">
                <textarea id="advQuoteMemo" placeholder="${memoPh}" rows="3" style="width:100%; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; background:#fff; resize:vertical; min-height:72px;"></textarea>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:#475569; background:#fff; border:1.5px dashed #cbd5e1; border-radius:10px; padding:12px 14px; box-sizing:border-box; width:100%;">
                    <i class="fa-solid fa-paperclip" style="color:#0ea5e9;"></i>
                    <input id="advQuoteFiles" type="file" multiple accept="image/*,.pdf" style="font-size:12px; flex:1; min-width:0;">
                </label>
                <div style="font-size:11px; color:#64748b; line-height:1.55; margin-top:2px; padding:10px 12px; background:#f1f5f9; border-radius:8px; word-break:keep-all; overflow-wrap:break-word; white-space:normal;">${quoteNotice}</div>
                <div id="advQuoteErr" style="color:#ef4444; font-size:12px; text-align:center; display:none;"></div>
                <button id="advQuoteSubmit" style="background:linear-gradient(135deg,#0ea5e9,#0369a1); color:#fff; border:none; padding:13px 16px; border-radius:10px; font-weight:800; cursor:pointer; font-size:14px; width:100%; box-sizing:border-box; margin-top:4px; box-shadow:0 2px 8px rgba(14,165,233,0.25);">${t('quoteSubmit')}</button>
            </div>
        </div>
    `;
    chatArea.appendChild(card);
    scrollChat();
    document.getElementById('advQuoteName').focus();

    document.getElementById('advQuoteSubmit').addEventListener('click', async () => {
        const name = (document.getElementById('advQuoteName').value || '').trim();
        const phone = (document.getElementById('advQuotePhone').value || '').trim();
        const memo = (document.getElementById('advQuoteMemo').value || '').trim();
        const fileInput = document.getElementById('advQuoteFiles');
        const files = fileInput ? fileInput.files : [];

        const errEl = document.getElementById('advQuoteErr');
        if (!phone) {
            if (errEl) { errEl.textContent = t('callbackPhoneErr'); errEl.style.display = 'block'; }
            document.getElementById('advQuotePhone').style.borderColor = '#ef4444';
            return;
        }

        // Disable button
        const btn = document.getElementById('advQuoteSubmit');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }

        const sb = getSb();
        let uploadedFiles = [];

        // Upload files to Supabase storage
        if (sb && files.length > 0) {
            const ts = Date.now();
            const rand = Math.random().toString(36).substring(2, 8);
            for (let i = 0; i < files.length; i++) {
                try {
                    const file = files[i];
                    const ext = file.name.split('.').pop() || 'bin';
                    const path = `vip_uploads/QUOTE_${ts}_${rand}_${i}.${ext}`;
                    const { data: upData, error: upErr } = await sb.storage.from('orders').upload(path, file);
                    if (upErr) { console.error('Quote file upload error:', upErr); continue; }
                    const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                    uploadedFiles.push({ name: file.name, url: urlData?.publicUrl || path });
                } catch(e) {
                    console.error('Quote file upload exception:', e);
                }
            }
        }

        // Insert into vip_orders
        if (sb) {
            try {
                const langCode = getLang();
                const countryTag = langCode === 'ja' ? 'JP' : langCode === 'en' ? 'US' : 'KR';
                // AI 대화 요약
                let chatSummary = '';
                try { chatSummary = conversationHistory.slice(-6).map(h => (h.role === 'user' ? '고객: ' : 'AI: ') + String(h.content).substring(0, 100)).join('\n'); } catch(e) {}
                await sb.from('vip_orders').insert({
                    customer_name: name || 'Chat Quote',
                    customer_phone: phone,
                    preferred_manager: 'Quote-' + countryTag,
                    memo: `[CHATBOT QUOTE REQUEST from ${window.location.hostname}]\n고객: ${name}\nPhone: ${phone}\n\n${memo ? '요청사항: ' + memo + '\n\n' : ''}${chatSummary}`,
                    files: uploadedFiles,
                    status: 'quote'
                });
            } catch(e) {
                console.error('vip_orders insert error:', e);
            }
        }

        card.remove();
        addBubble(t('quoteSuccess'), 'ai');
        scrollChat();
        saveChat();
    });
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
    const siteHostMap = { ja: 'https://cafe0101.com', en: 'https://chameleon.design', kr: 'https://cafe2626.com' };
    const siteHost = siteHostMap[lang] || 'https://chameleon.design';
    const langSuffix = siteHostMap[lang] ? '' : '&lang=' + lang;
    const detailLabels = { kr: '구매하러가기', ja: '購入する', en: 'Buy Now', zh: '立即购买', ar: 'اشتري الآن', es: 'Comprar', de: 'Kaufen', fr: 'Acheter' };
    const detailLabel = detailLabels[lang] || 'Buy Now';

    products.forEach((rec, i) => {
        const card = document.createElement('div');
        card.className = 'adv-card';
        const thumbUrl = rec.img_url || '';
        const thumbHtml = thumbUrl ? `<img src="${esc(thumbUrl)}" class="adv-card-thumb" alt="${esc(rec.name)}" onerror="this.style.display='none'">` : '';
        const w = rec.recommended_width_mm || 0;
        const h = rec.recommended_height_mm || 0;
        const sizeText = (w > 0 && h > 0)
            ? `${w}\u00d7${h}mm`
            : ({ kr: '사이즈 자유', ja: 'サイズ自由', en: 'Custom size', zh: '自由尺寸', ar: 'حجم مخصص', es: 'Tamaño libre', de: 'Freie Größe', fr: 'Taille libre' }[lang] || 'Custom size');
        const detailUrl = siteHost + '/?product=' + encodeURIComponent(rec.code) + langSuffix;
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
                <a href="#" onclick="(window.top||window).open('${detailUrl}','_blank');return false;" class="adv-btn-editor" style="text-decoration:none; text-align:center; flex:1; cursor:pointer;">
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
        btn.addEventListener('click', () => { saveChat(); openEditor(products[+btn.dataset.i]); });
    });
    wrap.querySelectorAll('.adv-btn-cart').forEach(btn => {
        btn.addEventListener('click', () => { saveChat(); addToCart(products[+btn.dataset.i], btn); });
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
        const { addProductToCartDirectly } = await import('./order.js?v=399');
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
    return esc(msg)
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(https?:\/\/[^\s<&]+)/g, '<a href="#" onclick="(window.top||window).open(\'$1\',\'_blank\');return false;" style="color:#93c5fd;text-decoration:underline;word-break:break-all;cursor:pointer;">$1</a>');
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
    if (cc === 'CN') return '¥' + Math.round(krw * 0.05).toLocaleString();
    if (cc === 'ES' || cc === 'DE' || cc === 'FR') return '€' + (krw * 0.001).toFixed(0);
    if (cc === 'AR') return '$' + Math.round(krw * 0.001).toLocaleString();
    if (cc !== 'KR') return '$' + Math.round(krw * 0.001).toLocaleString();
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
    const beautyLabel = {ja:'AI ビューティー',en:'AI Beauty',zh:'AI美颜',ar:'تجميل AI',es:'AI Belleza',de:'AI Beauty',fr:'AI Beauté',kr:'AI 뷰티'}[lang]||'AI Beauty';
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
    loadingMsg.innerHTML = '⏳ ' + ({ja:'背景除去中...',en:'Removing background...',zh:'正在去除背景...',ar:'جارٍ إزالة الخلفية...',es:'Eliminando fondo...',de:'Hintergrund wird entfernt...',fr:'Suppression du fond...',kr:'배경 제거 중...'}[getLang()]||'Removing background...');
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
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="matte" checked> ${{ja:'マット紙',en:'Matte',zh:'哑光纸',ar:'ورق مطفي',es:'Mate',de:'Matt',fr:'Mat',kr:'무광지'}[getLang()]||'Matte'}</label>
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="glossy"> ${{ja:'光沢紙',en:'Glossy',zh:'光面纸',ar:'ورق لامع',es:'Brillante',de:'Glanz',fr:'Brillant',kr:'유광지'}[getLang()]||'Glossy'}</label>
                <label class="ps-opt-item"><input type="radio" name="psPaperOpt" value="semi"> ${{ja:'半光沢',en:'Semi-Glossy',zh:'半光泽',ar:'شبه لامع',es:'Semi-Brillo',de:'Seidenmatt',fr:'Semi-Brillant',kr:'반광지'}[getLang()]||'Semi-Glossy'}</label>
            </div>
        </div>`;
    } else if (isHoneycomb) {
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🧱 ${ps('standOpt')}</div>
            <div class="ps-opt-row">
                <label class="ps-opt-item"><input type="radio" name="psStandOpt" value="none" checked> ${{ja:'なし',en:'None',zh:'无',ar:'بدون',es:'Ninguno',de:'Ohne',fr:'Aucun',kr:'없음'}[getLang()]||'None'}</label>
                <label class="ps-opt-item"><input type="radio" name="psStandOpt" value="stand"> ${{ja:'スタンド付き',en:'With Stand',zh:'含底座',ar:'مع حامل',es:'Con soporte',de:'Mit Ständer',fr:'Avec support',kr:'받침대 포함'}[getLang()]||'With Stand'}</label>
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
            top: {ja:'上',en:'Top',zh:'上',ar:'أعلى',es:'Arriba',de:'Oben',fr:'Haut',kr:'상'}[lang]||'Top',
            left: {ja:'左',en:'Left',zh:'左',ar:'يسار',es:'Izquierda',de:'Links',fr:'Gauche',kr:'좌'}[lang]||'Left',
            right: {ja:'右',en:'Right',zh:'右',ar:'يمين',es:'Derecha',de:'Rechts',fr:'Droite',kr:'우'}[lang]||'Right',
            bottom: {ja:'下',en:'Bottom',zh:'下',ar:'أسفل',es:'Abajo',de:'Unten',fr:'Bas',kr:'하'}[lang]||'Bottom',
        };
        optionsHtml = `<div class="ps-option-section" style="margin-top:8px;">
            <div class="ps-tool-label">🔑 ${{ja:'3mmアクリルキーリング',en:'3mm Acrylic Keyring',zh:'3mm亚克力钥匙扣',ar:'ميدالية أكريليك 3مم',es:'Llavero acrílico 3mm',de:'3mm Acryl-Schlüsselanhänger',fr:'Porte-clés acrylique 3mm',kr:'3mm 아크릴키링'}[lang]||'3mm Acrylic Keyring'}</div>
            <div id="psKeyringPreview" style="margin:8px auto;text-align:center;background:#f1f5f9;border-radius:10px;padding:8px;"></div>
            <div class="ps-tool-label" style="margin-top:8px;">📍 ${{ja:'穴の位置',en:'Hole Position',zh:'孔位置',ar:'موقع الثقب',es:'Posición del agujero',de:'Lochposition',fr:'Position du trou',kr:'고리 위치'}[lang]||'Hole Position'}</div>
            <div style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;">
                ${['top','left','right','bottom'].map((pos,i) => `<label class="ps-opt-item" style="min-width:40px;text-align:center;"><input type="radio" name="psHolePos" value="${pos}"${i===0?' checked':''}> ${holeLabels[pos]}</label>`).join('')}
            </div>
            <div class="ps-tool-label" style="margin-top:8px;">🪝 ${{ja:'リング選択',en:'Ring Type',zh:'选择挂环',ar:'اختيار الحلقة',es:'Tipo de anilla',de:'Ringauswahl',fr:'Type d\'anneau',kr:'고리 선택'}[lang]||'Ring Type'}</div>
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
            <div class="ps-tool-label">🎨 ${{ja:'カラー',en:'Color',zh:'颜色',ar:'اللون',es:'Color',de:'Farbe',fr:'Couleur',kr:'컬러'}[lang]||'Color'}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
                ${tColors.map((c,i) => `<div class="ps-tshirt-color${i===0?' active':''}" data-color="${c.hex}" style="width:28px;height:28px;border-radius:50%;background:${c.hex};border:2px solid ${i===0?'#7c3aed':'#e2e8f0'};cursor:pointer;" title="${c.name}"></div>`).join('')}
            </div>
            <div class="ps-tool-label" style="margin-top:6px;">📏 ${{ja:'サイズ',en:'Size',zh:'尺寸',ar:'المقاس',es:'Talla',de:'Größe',fr:'Taille',kr:'사이즈'}[lang]||'Size'}</div>
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
            container.innerHTML = `<span style="font-size:10px;color:#94a3b8;">${{ja:'リングオプションなし',en:'No ring options',zh:'无挂环选项',ar:'لا توجد خيارات حلقة',es:'Sin opciones de anilla',de:'Keine Ringoptionen',fr:'Pas d\'options d\'anneau',kr:'고리 옵션 없음'}[lang]||'No ring options'}</span>`;
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
        container.innerHTML = `<span style="font-size:10px;color:#94a3b8;">${{ja:'基本キーリングで出荷されます',en:'Ships with default keyring hook',zh:'使用默认钥匙扣挂钩发货',ar:'يتم الشحن بحلقة مفاتيح افتراضية',es:'Se envía con gancho predeterminado',de:'Wird mit Standard-Schlüsselring geliefert',fr:'Expédié avec anneau par défaut',kr:'기본 키링고리로 출고됩니다'}[lang]||'Ships with default keyring hook'}</span>`;
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
            <span style="font-size:9px;color:#94a3b8;">${{ja:'ドラッグで移動',en:'Drag to move',zh:'拖动移动',ar:'اسحب للتحريك',es:'Arrastra para mover',de:'Ziehen zum Verschieben',fr:'Glisser pour déplacer',kr:'드래그로 이동'}[lang]||'Drag to move'}</span>`;
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
        const reqMsg = {ja:'ミシンオプションを1つ選択してください (必須)',en:'Select at least one sewing option (required)',zh:'请选择一个缝纫选项（必选）',ar:'يرجى اختيار خيار خياطة واحد (مطلوب)',es:'Seleccione una opción de costura (obligatorio)',de:'Bitte wählen Sie eine Nähoption (Pflicht)',fr:'Veuillez sélectionner une option de couture (obligatoire)',kr:'미싱옵션을 1개 선택해주세요 (필수)'}[lang]||'Select at least one sewing option (required)';

        let html = `<div class="ps-tool-label">🧵 ${{ja:'ミシンオプション',en:'Sewing Option',zh:'缝纫选项',ar:'خيار الخياطة',es:'Opción de costura',de:'Nähoption',fr:'Option de couture',kr:'패브릭 미싱'}[lang]||'Sewing Option'} <span style="color:#ef4444; font-size:10px;">(*)</span></div>`;
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
        const msg = {ja:'⚠️ パブリックの最大幅は1300mmです。これを超える場合は「つなぎ縫い」オプションが必要です。',en:'⚠️ Max fabric width is 1300mm. Seam-joining option is required for wider prints.',zh:'⚠️ 面料最大宽度为1300mm。超出时需要拼接缝纫选项。',ar:'⚠️ أقصى عرض للقماش 1300مم. خيار الخياطة المتصلة مطلوب للطباعة الأعرض.',es:'⚠️ Ancho máximo de tela: 1300mm. Se requiere opción de costura para impresiones más anchas.',de:'⚠️ Maximale Stoffbreite: 1300mm. Nahtoption erforderlich für breitere Drucke.',fr:'⚠️ Largeur max du tissu : 1300mm. Option de couture requise pour les impressions plus larges.',kr:'⚠️ 패브릭 최대폭은 1300mm입니다. 초과 시 이어박기 옵션이 필요합니다.'}[lang]||'⚠️ Max fabric width is 1300mm. Seam-joining option is required for wider prints.';
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
            if (label.includes('이어') || label.includes('つなぎ') || label.includes('接続') || label.toLowerCase().includes('seam') || label.toLowerCase().includes('join') || label.toLowerCase().includes('connect')) {
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
    const cartLabel = {ja:'カートに入れる',en:'Add to Cart',zh:'加入购物车',ar:'أضف إلى السلة',es:'Añadir al carrito',de:'In den Warenkorb',fr:'Ajouter au panier',kr:'장바구니 담기'}[getLang()]||'Add to Cart';

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
                const msg = {ja:'ミシンオプションを選択してください',en:'Please select a sewing option',zh:'请选择缝纫选项',ar:'يرجى اختيار خيار الخياطة',es:'Seleccione una opción de costura',de:'Bitte wählen Sie eine Nähoption',fr:'Veuillez sélectionner une option de couture',kr:'미싱옵션을 선택해주세요'}[getLang()]||'Please select a sewing option';
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
            const errMsg = !window.currentUser ? ({ja:'ログインが必要です',en:'Login required',zh:'需要登录',ar:'يجب تسجيل الدخول',es:'Inicio de sesión requerido',de:'Anmeldung erforderlich',fr:'Connexion requise',kr:'로그인이 필요합니다'}[getLang()]||'Login required') : e.message;
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
