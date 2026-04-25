import { sb } from './config.js?v=292';

// ── 다국어 ──
function aiGetLang() {
    const cc = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || '';
    if (cc === 'JP') return 'ja';
    if (cc === 'CN' || cc === 'ZH') return 'zh';
    if (cc === 'ES') return 'es';
    if (cc === 'DE') return 'de';
    if (cc === 'FR') return 'fr';
    if (cc === 'AR') return 'ar';
    if (cc === 'US' || cc === 'EN') return 'en';
    return 'kr';
}
const AI_I18N = {
    kr: {
        title: '✨ AI 디자인 스튜디오', free:'무료 사용', hint:'GPT-5.5 · 영문 텍스트 · 에디터에서 한글 편집',
        lead: '<b>원하는 디자인을 마음껏 해보세요.</b> 수정할 부분이 있다면 에디터에서 수정하세요.',
        s1:'① 사이즈 선택', s2:'② 배경 색상', s3:'③ 제목', s4:'④ 스타일·추가 설명', optional:'(선택)',
        titlePh:'제목 (예: CHAMELEON PRINTING, 50% SALE)', promptPh:'내용 및 전화번호, 스타일 등을 적어주세요',
        uploadBtn:'첨부이미지 (4장까지)', genBtn:'🎨 AI 디자인 생성하기', genBtnLoading:'⏳ 생성중...', previewHint:'미리보기 · 곧 또렷해집니다', emptyMain:'예시 — 이런 디자인이 생성됩니다',
        emptySub:'왼쪽에서 사이즈 · 색상 · 제목을 선택한 뒤<br>🎨 생성 버튼을 누르세요 (약 30~60초)',
        loadMain:'AI가 디자인을 생성중입니다', loadSub:'약 2~3분 정도 소요됩니다. 잠시만 기다려 주세요.',
        editBtn:'✏️ 에디터로 추가편집', dlBtn:'💾 고화질 다운로드', customPick:'직접 선택',
        sizes:{auto:'자동',square:'정사각형',portrait:'세로',story:'스토리',land:'가로',wide:'와이드',autoDim:'AI 선택'}
    },
    ja: {
        title:'✨ AIデザインスタジオ', free:'無料', hint:'GPT-5.5 · 英文テキスト · エディターで日本語編集',
        lead:'<b>お好きなデザインを思いのまま作ってください。</b> 修正したい部分はエディターで編集できます。',
        s1:'① サイズ選択', s2:'② 背景色', s3:'③ タイトル', s4:'④ スタイル·追加説明', optional:'(任意)',
        titlePh:'タイトル (例: CHAMELEON PRINTING, 50% SALE)', promptPh:'内容·電話番号·スタイルなどを記入',
        uploadBtn:'画像添付 (最大4枚)', genBtn:'🎨 AIデザイン生成', genBtnLoading:'⏳ 生成中...', previewHint:'プレビュー · 間もなく鮮明になります', emptyMain:'例 — このようなデザインが生成されます',
        emptySub:'左でサイズ·色·タイトルを選び<br>🎨 生成ボタンを押してください (約30〜60秒)',
        loadMain:'AIがデザイン生成中です', loadSub:'約2〜3分かかります。しばらくお待ちください。',
        editBtn:'✏️ エディターで編集', dlBtn:'💾 高画質ダウンロード', customPick:'カスタム色',
        sizes:{auto:'自動',square:'正方形',portrait:'縦',story:'ストーリー',land:'横',wide:'ワイド',autoDim:'AI選択'}
    },
    en: {
        title:'✨ AI Design Studio', free:'Free use', hint:'GPT-5.5 · English text · Edit in editor',
        lead:'<b>Design freely as you wish.</b> If you want to make edits, fix them in the editor.',
        s1:'① Size', s2:'② Background Color', s3:'③ Title', s4:'④ Style / Extra details', optional:'(optional)',
        titlePh:'Title (e.g. CHAMELEON PRINTING, 50% SALE)', promptPh:'Content, phone number, style, etc.',
        uploadBtn:'Attach images (up to 4)', genBtn:'🎨 Generate AI Design', genBtnLoading:'⏳ Generating...', previewHint:'Preview · sharpening soon', emptyMain:'Example — designs like this will be generated',
        emptySub:'Pick size · color · title on the left,<br>then press 🎨 Generate (30–60 s)',
        loadMain:'AI is generating your design', loadSub:'This takes ~2–3 minutes. Please wait.',
        editBtn:'✏️ Open in Editor', dlBtn:'💾 HD Download', customPick:'Pick custom',
        sizes:{auto:'Auto',square:'Square',portrait:'Portrait',story:'Story',land:'Landscape',wide:'Widescreen',autoDim:'AI choose'}
    },
    zh: {
        title:'✨ AI 设计工作室', free:'免费使用', hint:'GPT-5.5 · 英文文本 · 编辑器中汉化',
        lead:'<b>尽情创作您想要的设计。</b> 需要修改的部分请在编辑器中修改。',
        s1:'① 尺寸选择', s2:'② 背景色', s3:'③ 标题', s4:'④ 风格·补充说明', optional:'(可选)',
        titlePh:'标题 (例: CHAMELEON PRINTING, 50% SALE)', promptPh:'内容·电话·风格等',
        uploadBtn:'附加图片 (最多4张)', genBtn:'🎨 生成AI设计', genBtnLoading:'⏳ 生成中...', previewHint:'预览 · 即将清晰', emptyMain:'示例 — 将生成此类设计',
        emptySub:'在左侧选择尺寸·颜色·标题后<br>点击 🎨 生成 (约30–60秒)',
        loadMain:'AI正在生成设计', loadSub:'大约需要2–3分钟，请稍候。',
        editBtn:'✏️ 在编辑器中继续编辑', dlBtn:'💾 高清下载', customPick:'自选',
        sizes:{auto:'自动',square:'正方形',portrait:'竖版',story:'故事',land:'横版',wide:'宽屏',autoDim:'AI选择'}
    },
    ar: {
        title:'✨ استوديو التصميم بالذكاء الاصطناعي', free:'استخدام مجاني', hint:'GPT-5.5 · نص إنجليزي · تحرير في المحرر',
        lead:'<b>صمم بحرية كما تشاء.</b> إذا كنت ترغب في تعديل أي جزء، فقم بتعديله في المحرر.',
        s1:'① المقاس', s2:'② لون الخلفية', s3:'③ العنوان', s4:'④ النمط / تفاصيل إضافية', optional:'(اختياري)',
        titlePh:'العنوان (مثال: CHAMELEON PRINTING, 50% SALE)', promptPh:'المحتوى والهاتف والنمط وغيرها',
        uploadBtn:'إرفاق صور (حتى 4)', genBtn:'🎨 إنشاء تصميم بالذكاء الاصطناعي', genBtnLoading:'⏳ جارٍ الإنشاء...', previewHint:'معاينة · ستصبح أكثر وضوحًا قريبًا', emptyMain:'مثال — سيتم إنشاء تصاميم مثل هذه',
        emptySub:'اختر المقاس واللون والعنوان على اليسار<br>ثم اضغط 🎨 إنشاء (30–60 ثانية)',
        loadMain:'يقوم الذكاء الاصطناعي بإنشاء التصميم', loadSub:'قد يستغرق هذا 2–3 دقائق. يرجى الانتظار.',
        editBtn:'✏️ فتح في المحرر', dlBtn:'💾 تحميل عالي الجودة', customPick:'اختيار مخصص',
        sizes:{auto:'تلقائي',square:'مربع',portrait:'عمودي',story:'قصة',land:'أفقي',wide:'شاشة عريضة',autoDim:'اختيار AI'}
    },
    es: {
        title:'✨ Estudio de Diseño con IA', free:'Uso gratis', hint:'GPT-5.5 · Texto en inglés · Edita en el editor',
        lead:'<b>Diseña libremente como quieras.</b> Si necesitas editar algo, hazlo en el editor.',
        s1:'① Tamaño', s2:'② Color de fondo', s3:'③ Título', s4:'④ Estilo / Detalles extra', optional:'(opcional)',
        titlePh:'Título (ej. CHAMELEON PRINTING, 50% SALE)', promptPh:'Contenido, teléfono, estilo, etc.',
        uploadBtn:'Adjuntar imágenes (hasta 4)', genBtn:'🎨 Generar Diseño IA', genBtnLoading:'⏳ Generando...', previewHint:'Vista previa · pronto se aclarará', emptyMain:'Ejemplo — se generarán diseños como este',
        emptySub:'Elige tamaño · color · título a la izquierda,<br>luego pulsa 🎨 Generar (30–60 s)',
        loadMain:'La IA está generando tu diseño', loadSub:'Esto tarda 2–3 minutos. Espere, por favor.',
        editBtn:'✏️ Abrir en Editor', dlBtn:'💾 Descarga HD', customPick:'Personalizado',
        sizes:{auto:'Auto',square:'Cuadrado',portrait:'Vertical',story:'Historia',land:'Horizontal',wide:'Panorámico',autoDim:'IA elige'}
    },
    de: {
        title:'✨ AI Design Studio', free:'Kostenlose Nutzung', hint:'GPT-5.5 · Englischer Text · Im Editor bearbeiten',
        lead:'<b>Gestalten Sie ganz nach Belieben.</b> Was Sie anpassen möchten, können Sie im Editor bearbeiten.',
        s1:'① Größe', s2:'② Hintergrundfarbe', s3:'③ Titel', s4:'④ Stil / Zusatzdetails', optional:'(optional)',
        titlePh:'Titel (z.B. CHAMELEON PRINTING, 50% SALE)', promptPh:'Inhalt, Telefon, Stil usw.',
        uploadBtn:'Bilder anhängen (bis 4)', genBtn:'🎨 KI-Design generieren', genBtnLoading:'⏳ Wird generiert...', previewHint:'Vorschau · wird gleich schärfer', emptyMain:'Beispiel — solche Designs werden generiert',
        emptySub:'Wählen Sie links Größe · Farbe · Titel<br>und drücken 🎨 Generieren (30–60 s)',
        loadMain:'KI erstellt Ihr Design', loadSub:'Das dauert ca. 2–3 Minuten. Bitte warten.',
        editBtn:'✏️ Im Editor öffnen', dlBtn:'💾 HD-Download', customPick:'Benutzerdefiniert',
        sizes:{auto:'Auto',square:'Quadrat',portrait:'Hoch',story:'Story',land:'Quer',wide:'Breitbild',autoDim:'KI wählt'}
    },
    fr: {
        title:'✨ Studio de Design IA', free:'Utilisation gratuite', hint:'GPT-5.5 · Texte anglais · Modifier dans l\'éditeur',
        lead:'<b>Créez librement le design que vous voulez.</b> Pour toute modification, utilisez l\'éditeur.',
        s1:'① Taille', s2:'② Couleur de fond', s3:'③ Titre', s4:'④ Style / Détails supplémentaires', optional:'(facultatif)',
        titlePh:'Titre (ex. CHAMELEON PRINTING, 50% SALE)', promptPh:'Contenu, téléphone, style, etc.',
        uploadBtn:'Joindre des images (max 4)', genBtn:'🎨 Générer le Design IA', genBtnLoading:'⏳ Génération...', previewHint:'Aperçu · bientôt plus net', emptyMain:'Exemple — des designs de ce type seront générés',
        emptySub:'Choisissez taille · couleur · titre à gauche,<br>puis appuyez sur 🎨 Générer (30–60 s)',
        loadMain:'L\'IA génère votre design', loadSub:'Cela prend 2–3 minutes. Veuillez patienter.',
        editBtn:'✏️ Ouvrir dans l\'Éditeur', dlBtn:'💾 Téléchargement HD', customPick:'Personnalisé',
        sizes:{auto:'Auto',square:'Carré',portrait:'Portrait',story:'Story',land:'Paysage',wide:'Panoramique',autoDim:'IA choisit'}
    }
};
function AI_T() { return AI_I18N[aiGetLang()] || AI_I18N.kr; }

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const FN_URL = SUPABASE_URL + '/functions/v1/ai-design-gen';

// ── 사이즈 프리셋 (GPT가 제공하는 이미지 aspect ratio) ──
// w / h 는 에디터 캔버스용 mm 단위 (AI 이미지 aspect에 맞춰 정한 값)
// label 은 렌더 시점에 AI_T().sizes에서 가져옴
const SIZE_PRESETS = [
    { key:'auto',    dim:'',      w:1000, h:1000, model:'auto',      en:'auto aspect ratio, model picks best' },
    { key:'square',  dim:'1:1',   w:1000, h:1000, model:'1024x1024', en:'square 1:1 composition' },
    { key:'portrait',dim:'3:4',   w:1050, h:1400, model:'1024x1536', en:'portrait 3:4 composition' },
    { key:'story',   dim:'9:16',  w:900,  h:1600, model:'1024x1536', en:'vertical story 9:16 composition' },
    { key:'land',    dim:'4:3',   w:1400, h:1050, model:'1536x1024', en:'landscape 4:3 composition' },
    { key:'wide',    dim:'16:9',  w:1600, h:900,  model:'1536x1024', en:'widescreen 16:9 composition' },
];

// ── 배경 색상 팔레트 (19색 + 직접선택 1 = 총 20칸 = PC 2행) ──
const COLOR_PRESETS = [
    { key:'white',   hex:'#ffffff', en:'clean white' },
    // 2번째 칸은 직접 선택 picker (renderColorGrid에서 주입)
    { key:'navy',    hex:'#1e3a8a', en:'deep navy blue' },
    { key:'blue',    hex:'#2563eb', en:'vibrant blue' },
    { key:'sky',     hex:'#38bdf8', en:'sky blue' },
    { key:'green',   hex:'#16a34a', en:'fresh green' },
    { key:'mint',    hex:'#6ee7b7', en:'mint pastel' },
    { key:'yellow',  hex:'#facc15', en:'sunny yellow' },
    { key:'orange',  hex:'#f97316', en:'warm orange' },
    { key:'red',     hex:'#dc2626', en:'bold red' },
    { key:'pink',    hex:'#ec4899', en:'vivid pink' },
    { key:'purple',  hex:'#8b5cf6', en:'rich purple' },
    { key:'lavender',hex:'#e0d9ff', en:'soft lavender' },
    { key:'gray',    hex:'#64748b', en:'slate gray' },
    { key:'black',   hex:'#111827', en:'deep black' },
    { key:'beige',   hex:'#d6cfc0', en:'warm beige' },
    { key:'peach',   hex:'#fed7aa', en:'peach pastel' },
    { key:'teal',    hex:'#0d9488', en:'modern teal' },
    { key:'gold',    hex:'#ca8a04', en:'luxury gold' },
    { key:'gradient',hex:'linear-gradient(135deg,#8b5cf6,#ec4899)', en:'gradient purple-to-pink' },
];

let selectedSize = SIZE_PRESETS[0]; // 기본: 자동
let selectedColor = COLOR_PRESETS[0]; // 기본: 흰색
const attachedImages = [];

function renderSizeGrid() {
    const grid = document.getElementById('aiSizeGrid');
    if (!grid) return;
    const T = AI_T();
    grid.innerHTML = SIZE_PRESETS.map(s => {
        const sel = selectedSize.key === s.key ? 'selected' : '';
        const label = (T.sizes && T.sizes[s.key]) || s.key;
        const dim = s.key === 'auto' ? (T.sizes && T.sizes.autoDim || 'AI') : s.dim;
        return `<div class="aid-size-card ${sel}" data-key="${s.key}" onclick="window.selectAiSize('${s.key}')">
            <span class="name">${label}</span>
            <span class="dim">${dim}</span>
        </div>`;
    }).join('');
}

function renderColorGrid() {
    const grid = document.getElementById('aiColorGrid');
    if (!grid) return;
    const customSel = selectedColor.key === 'custom' ? 'selected' : '';
    const customBg = selectedColor.key === 'custom' ? selectedColor.hex : '#ffffff';
    const customSwatch = `<div class="aid-color-swatch aid-color-custom ${customSel}" title="${AI_T().customPick||'직접 선택'}"
        style="background:conic-gradient(from 180deg, red, yellow, lime, cyan, blue, magenta, red); position:relative; overflow:hidden;"
        onclick="document.getElementById('aiColorPicker').click()">
        ${customSel
            ? `<span style="position:absolute; inset:0; background:${customBg}; border-radius:inherit;"></span>
               <span style="position:relative; z-index:2; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; text-shadow:0 1px 3px rgba(0,0,0,0.5);">✓</span>`
            : `<span style="position:relative; z-index:2; display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#fff; font-size:18px; font-weight:900; text-shadow:0 0 4px rgba(0,0,0,0.6);">+</span>`
        }
        <input id="aiColorPicker" type="color" value="${customSel ? customBg : '#8b5cf6'}" style="position:absolute; inset:0; opacity:0; cursor:pointer; z-index:3;" onchange="window.selectCustomAiColor(this.value)">
    </div>`;

    let html = '';
    COLOR_PRESETS.forEach((c, i) => {
        const sel = selectedColor.key === c.key ? 'selected' : '';
        const bg = c.hex.startsWith('linear') ? `background:${c.hex};` : `background:${c.hex};`;
        html += `<div class="aid-color-swatch ${sel}" title="${c.key}" style="${bg}" onclick="window.selectAiColor('${c.key}')"></div>`;
        // white(첫 번째) 바로 뒤에 custom picker 삽입
        if (i === 0) html += customSwatch;
    });
    grid.innerHTML = html;
}

window.selectAiSize = function(key) {
    const found = SIZE_PRESETS.find(s => s.key === key);
    if (found) { selectedSize = found; renderSizeGrid(); }
};
window.selectAiColor = function(key) {
    const found = COLOR_PRESETS.find(c => c.key === key);
    if (found) { selectedColor = found; renderColorGrid(); }
};
// 수동 색상 선택
window.selectCustomAiColor = function(hex) {
    if (!hex) return;
    // 간단한 hex → 영어 묘사 (Lightness 기반)
    const rgb = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    let desc = 'custom color ' + hex;
    if (rgb) {
        const r = parseInt(rgb[1],16), g = parseInt(rgb[2],16), b = parseInt(rgb[3],16);
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        const l = (max+min) / 510;
        desc = `${l>0.85?'very light ':l<0.2?'deep dark ':l<0.45?'rich ':''}${hex} color`;
    }
    selectedColor = { key:'custom', hex, en: desc };
    renderColorGrid();
};

function relocateAiPanel() {
    const panel = document.getElementById('aiDesignHero');
    const hero = document.querySelector('#startScreen .hero-section') || document.querySelector('.hero-section');
    if (panel && hero && hero.parentNode && panel.previousElementSibling !== hero) {
        hero.parentNode.insertBefore(panel, hero.nextSibling);
    }
}
function applyAiI18n() {
    const T = AI_T();
    const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    const setAttr = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
    set('#aiDesignHero .aid-title', T.title);
    set('#aiDesignQuota', T.free);
    // Hint 요소는 dot span을 포함하므로 특별 처리
    const hintEl = document.querySelector('#aiDesignHero .aid-hint');
    if (hintEl) hintEl.innerHTML = `<span class="dot"></span> ${T.hint}`;
    set('#aiDesignHero .aid-lead', T.lead);
    // 섹션 타이틀 4개 (.aid-section-title 요소가 순서대로 4개)
    const secs = document.querySelectorAll('#aiDesignHero .aid-section-title');
    if (secs[0]) secs[0].innerHTML = T.s1;
    if (secs[1]) secs[1].innerHTML = T.s2;
    if (secs[2]) secs[2].innerHTML = T.s3;
    if (secs[3]) secs[3].innerHTML = `${T.s4} <span style="font-weight:400; color:#94a3b8; font-size:11px;">${T.optional}</span>`;
    setAttr('#aiDesignTitle', 'placeholder', T.titlePh);
    setAttr('#aiDesignPrompt', 'placeholder', T.promptPh);
    // 첨부이미지 버튼 — label 안 첫 텍스트노드만 교체
    const uploadLabel = document.querySelector('#aiDesignHero .aid-upload');
    if (uploadLabel) {
        const input = uploadLabel.querySelector('input');
        uploadLabel.innerHTML = T.uploadBtn;
        if (input) uploadLabel.appendChild(input);
    }
    set('#aiDesignBtn', T.genBtn);
    // empty state
    const emptyMain = document.querySelector('#aiDesignHero .aid-preview-empty .main');
    const emptySub = document.querySelector('#aiDesignHero .aid-preview-empty .sub');
    if (emptyMain) emptyMain.innerHTML = T.emptyMain;
    if (emptySub) emptySub.innerHTML = T.emptySub;
}

function initAi() {
    relocateAiPanel();
    applyAiI18n();
    renderSizeGrid();
    renderColorGrid();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAi);
} else {
    initAi();
}
setTimeout(initAi, 300);
setTimeout(initAi, 1500);

function renderThumbs() {
    const wrap = document.getElementById('aiDesignThumbs');
    if (!wrap) return;
    wrap.innerHTML = '';
    attachedImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'aid-thumb';
        div.innerHTML = `<img src="${img.dataUrl}" alt="첨부"><button type="button" title="제거" onclick="window.removeAiDesignImage(${idx})">×</button>`;
        wrap.appendChild(div);
    });
}

window.addAiDesignImages = function(files) {
    if (!files || files.length === 0) return;
    const remaining = 4 - attachedImages.length;
    if (remaining <= 0) { alert('최대 4장까지 첨부 가능합니다.'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 8 * 1024 * 1024) { alert(`"${file.name}"은 8MB를 초과합니다.`); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImages.push({ file, dataUrl: e.target.result });
            renderThumbs();
        };
        reader.readAsDataURL(file);
    });
};
window.removeAiDesignImage = function(idx) { attachedImages.splice(idx, 1); renderThumbs(); };

// ── 사이트 언어 → 디자인 텍스트 언어 매핑 ──
const AI_LANG_META = {
    kr: { name: 'Korean',   script: 'Hangul (한글)' },
    ja: { name: 'Japanese', script: 'Japanese (Kana + Kanji)' },
    en: { name: 'English',  script: 'Latin alphabet' },
    zh: { name: 'Chinese',  script: 'Simplified Chinese (汉字)' },
    ar: { name: 'Arabic',   script: 'Arabic script (RTL)' },
    es: { name: 'Spanish',  script: 'Latin alphabet' },
    de: { name: 'German',   script: 'Latin alphabet' },
    fr: { name: 'French',   script: 'Latin alphabet' },
};

// ── 사이트 언어 기반 다국어 프롬프트 빌더 (creative brief 우선 구조) ──
function buildEnglishPrompt() {
    const title = (document.getElementById('aiDesignTitle')?.value || '').trim();
    const extra = (document.getElementById('aiDesignPrompt')?.value || '').trim();
    const langKey = aiGetLang();
    const lang = AI_LANG_META[langKey] || AI_LANG_META.en;

    const lines = [];
    lines.push('=== USER CREATIVE BRIEF ===');
    if (extra) {
        lines.push(`Concept / style / extras: ${extra}`);
    }
    if (title) {
        lines.push(`Headline text (render in image EXACTLY as written, do not translate or paraphrase): "${title}"`);
    }
    lines.push(`Aspect ratio: ${selectedSize.en}`);
    lines.push(`Base background reference color: ${selectedColor.en} (use as accent or palette anchor — override if the cinematic concept calls for different scenery)`);
    lines.push(`On-image text language: ${lang.name} (${lang.script}). All text MUST be in ${lang.name} with accurate spelling and grammar — no gibberish, no fake characters.`);
    lines.push('');
    lines.push('=== DIRECTION ===');
    lines.push('Treat the brief above as creative direction. Build a rich, cinematic, fully-realized composition — characters, props, lighting, mood, palette, branding all integrated. Movie-poster / editorial / campaign-art quality.');
    lines.push(`Sharp commercial-print typography appropriate for ${lang.script}. Reproduce the headline text EXACTLY as given.`);
    lines.push('TEXT SIZE RULE — only render LARGE clearly-readable text (headline + at most 1-2 short tagline phrases). DO NOT render small text, body paragraphs, fine print, captions, lorem-ipsum, or dense text blocks. Replace body copy with icons, shape blocks, color bars, or empty negative space. The user adds small text in the editor afterwards.');
    return lines.join('\n');
}

function renderFinalDesign(resultEl, quotaEl, imageUrl) {
    if (quotaEl) {
        quotaEl.textContent = '✓ 생성 완료';
        quotaEl.style.background = '#ecfdf5';
        quotaEl.style.color = '#065f46';
        quotaEl.style.borderColor = '#a7f3d0';
    }
    const T = AI_T();
    resultEl.innerHTML = `
        <div class="aid-preview-img-wrap">
            <img src="${imageUrl}" alt="AI generated">
        </div>
        <div class="aid-preview-actions">
            <button type="button" class="aid-act-primary" onclick="window.sendAiDesignToEditor && window.sendAiDesignToEditor('${imageUrl}', '${selectedSize.key}', ${selectedSize.w}, ${selectedSize.h})">
                ${T.editBtn}
            </button>
            <a href="${imageUrl}" download="ai-design-${selectedSize.key}-${Date.now()}.png" target="_blank" class="aid-act-secondary">
                ${T.dlBtn}
            </a>
        </div>
    `;
}

window.generateAiDesign = async function() {
    const btnEl = document.getElementById('aiDesignBtn');
    const resultEl = document.getElementById('aiDesignResult');
    const quotaEl = document.getElementById('aiDesignQuota');

    const prompt = buildEnglishPrompt();

    const T2 = AI_T();
    btnEl.disabled = true;
    const originalBtnHtml = btnEl.innerHTML;
    btnEl.innerHTML = T2.genBtnLoading || '⏳ ...';
    btnEl.style.cursor = 'not-allowed';
    btnEl.style.opacity = '0.7';
    const sLabel = (T2.sizes && T2.sizes[selectedSize.key]) || selectedSize.key;
    const sDim = selectedSize.key === 'auto' ? (T2.sizes && T2.sizes.autoDim || 'AI') : selectedSize.dim;
    resultEl.innerHTML = `<div class="aid-preview-loading">
        <div class="spinner"></div>
        <div style="font-size:15px; color:#6d28d9; font-weight:800; margin-bottom:6px;">${T2.loadMain}</div>
        <div style="font-size:12px; color:#64748b;">${T2.loadSub}</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:8px;">${sLabel} · ${sDim}</div>
    </div>`;

    try {
        let authToken = '';
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.access_token) authToken = session.access_token;
        } catch(e) {}

        const headers = {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + (authToken || SUPABASE_ANON),
        };

        let fetchBody;
        if (attachedImages.length > 0) {
            const fd = new FormData();
            fd.append('prompt', prompt);
            fd.append('size', selectedSize.model);
            if (authToken) fd.append('authToken', authToken);
            attachedImages.forEach((img, i) => {
                fd.append('image', img.file, img.file.name || `upload-${i}.png`);
            });
            fetchBody = fd;
        } else {
            headers['Content-Type'] = 'application/json';
            fetchBody = JSON.stringify({ prompt, size: selectedSize.model, authToken });
        }

        const res = await fetch(FN_URL, { method: 'POST', headers, body: fetchBody });

        // 에러는 JSON으로 옴
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const msg = errData?.error || `오류 (${res.status})`;
            const detail = errData?.detail ? `<div style="margin-top:6px; font-size:11px; color:#7f1d1d; opacity:0.8;">${escapeHtml(errData.detail)}</div>` : '';
            resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
                <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:14px; font-weight:700;">${escapeHtml(msg)}</div>${detail}
            </div>`;
            return;
        }

        // SSE 처리: partial → 점진적 미리보기, final → 최종 이미지
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/event-stream')) {
            // 호환: 옛 JSON 응답
            const data = await res.json().catch(() => ({}));
            const { imageUrl, model, imageModel } = data;
            if (model) console.log('[AI design] parent model:', model, '| image model:', imageModel || '(default)');
            renderFinalDesign(resultEl, quotaEl, imageUrl);
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let firstPartialShown = false;
        let finalData = null;
        let streamErr = null;
        const t0 = Date.now();

        const showPartial = (b64, idx) => {
            const dataUrl = `data:image/png;base64,${b64}`;
            const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
            const T = AI_T();
            resultEl.innerHTML = `
                <div class="aid-preview-img-wrap" style="position:relative;">
                    <img src="${dataUrl}" alt="AI generating" style="filter: blur(${idx === 0 ? 8 : 3}px); transition: filter 0.5s;">
                    <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(255,255,255,0.35);">
                        <div class="spinner" style="margin-bottom:10px;"></div>
                        <div style="font-size:13px; font-weight:800; color:#6d28d9; background:rgba(255,255,255,0.9); padding:6px 14px; border-radius:999px;">
                            ${T.loadMain || 'AI'} · ${elapsed}s
                        </div>
                        <div style="font-size:11px; color:#64748b; margin-top:6px; background:rgba(255,255,255,0.9); padding:4px 10px; border-radius:999px;">
                            ${idx + 1}/2 · ${T.previewHint || ''}
                        </div>
                    </div>
                </div>`;
            firstPartialShown = true;
        };

        outer: while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const blocks = buf.split('\n\n');
            buf = blocks.pop() || '';
            for (const block of blocks) {
                let event = 'message';
                let dataLine = '';
                for (const line of block.split('\n')) {
                    if (line.startsWith('event: ')) event = line.slice(7).trim();
                    else if (line.startsWith('data: ')) dataLine = line.slice(6);
                    else if (line.startsWith('data:')) dataLine = line.slice(5);
                }
                if (!dataLine) continue;
                let payload;
                try { payload = JSON.parse(dataLine); } catch { continue; }
                if (event === 'meta') {
                    console.log('[AI design] meta:', payload);
                } else if (event === 'partial') {
                    showPartial(payload.b64, payload.index);
                } else if (event === 'final') {
                    finalData = payload;
                    console.log('[AI design] parent model:', payload.model, '| image model:', payload.imageModel, '| total:', payload.totalMs + 'ms');
                } else if (event === 'error') {
                    streamErr = payload.error || '스트림 에러';
                } else if (event === 'done') {
                    break outer;
                }
            }
        }

        if (streamErr) {
            resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
                <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:14px; font-weight:700;">${escapeHtml(streamErr)}</div>
            </div>`;
            return;
        }
        if (!finalData?.imageUrl) {
            resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
                <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:14px; font-weight:700;">최종 이미지 누락</div>
            </div>`;
            return;
        }

        renderFinalDesign(resultEl, quotaEl, finalData.imageUrl);
    } catch (e) {
        console.error('AI design error:', e);
        resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
            <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
            <div style="font-size:14px; font-weight:700;">네트워크 오류</div>
            <div style="margin-top:6px; font-size:12px;">${escapeHtml(String(e.message || e))}</div>
        </div>`;
    } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = originalBtnHtml;
        btnEl.style.cursor = 'pointer';
        btnEl.style.opacity = '1';
    }
};

window.sendAiDesignToEditor = function(imageUrl, sizeKey, widthMm, heightMm) {
    // 'auto' 사이즈는 실제 이미지 비율에 맞춰 캔버스 크기 결정
    if (sizeKey === 'auto') {
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => {
            const maxSide = 1200;
            let w, h;
            if (probe.naturalWidth >= probe.naturalHeight) {
                w = maxSide;
                h = Math.max(200, Math.round(maxSide * probe.naturalHeight / probe.naturalWidth));
            } else {
                h = maxSide;
                w = Math.max(200, Math.round(maxSide * probe.naturalWidth / probe.naturalHeight));
            }
            openEditorWithAiImage(imageUrl, sizeKey, w, h);
        };
        probe.onerror = () => openEditorWithAiImage(imageUrl, sizeKey, 1000, 1000);
        probe.src = imageUrl;
        return;
    }
    openEditorWithAiImage(imageUrl, sizeKey, widthMm, heightMm);
};

function openEditorWithAiImage(imageUrl, sizeKey, widthMm, heightMm) {
    try {
        sessionStorage.setItem('ai_design_bg_image', imageUrl);
        sessionStorage.setItem('ai_design_canvas_size', JSON.stringify({
            sizeKey: sizeKey || '',
            widthMm: widthMm || 0,
            heightMm: heightMm || 0,
        }));
    } catch(e) {}

    if (typeof window.startEditorDirect === 'function' && widthMm && heightMm) {
        Promise.resolve(window.startEditorDirect('custom', widthMm, heightMm)).then(() => {
            injectAiImageToCanvas();
        }).catch(e => { console.warn('editor open failed:', e); });
        return;
    }
    const selfDesignBtn = document.querySelector('[data-i18n="self_design"], .adv-ext-btn');
    if (selfDesignBtn) { selfDesignBtn.click(); setTimeout(injectAiImageToCanvas, 800); return; }
    alert('에디터를 열 수 없습니다.');
}

// 에디터 캔버스가 준비되면 AI 생성 이미지를 추가
function injectAiImageToCanvas() {
    let retries = 0;
    const attempt = () => {
        const canvas = window.canvas;
        if (canvas && typeof fabric !== 'undefined' && fabric.Image) {
            const imgUrl = sessionStorage.getItem('ai_design_bg_image');
            if (!imgUrl) return;
            fabric.Image.fromURL(imgUrl, (img) => {
                if (!img) { console.warn('AI image load failed'); return; }
                const cw = canvas.width || 1000, ch = canvas.height || 1000;
                const iw = img.width || 1024, ih = img.height || 1024;
                const scale = Math.min(cw / iw, ch / ih);
                img.set({
                    left: (cw - iw * scale) / 2,
                    top: (ch - ih * scale) / 2,
                    scaleX: scale, scaleY: scale,
                    selectable: true, hasControls: true,
                });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                try { sessionStorage.removeItem('ai_design_bg_image'); } catch(e) {}
            }, { crossOrigin: 'anonymous' });
        } else if (retries++ < 40) {
            setTimeout(attempt, 250);
        }
    };
    setTimeout(attempt, 600);
}
window._injectAiImageToCanvas = injectAiImageToCanvas;

// 로그인 리디렉션 등으로 페이지가 재로딩된 뒤에도 AI 이미지가 보존돼 있으면 자동 주입
(function watchPendingAiImage(){
    try {
        if (!sessionStorage.getItem('ai_design_bg_image')) return;
    } catch(e) { return; }
    const editorOpen = () => {
        const me = document.getElementById('mainEditor');
        if (me && me.style.display === 'flex') return true;
        if (document.body && document.body.classList.contains('editor-active')) return true;
        return false;
    };
    const iv = setInterval(() => {
        if (editorOpen() && window.canvas) { clearInterval(iv); injectAiImageToCanvas(); }
    }, 400);
    setTimeout(() => clearInterval(iv), 45000);
})();

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('aiDesignTitle');
    if (titleEl) {
        titleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); window.generateAiDesign(); }
        });
    }
});
