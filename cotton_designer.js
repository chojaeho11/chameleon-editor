// ════════════════════════════════════════════════════════════
// Cotton Print Designer — 이미지 → 패턴 원단 미리보기
// ════════════════════════════════════════════════════════════
(function(){
'use strict';

// ════════════════════════════════════════════════════
// 회배 단가 (1회배 = 1 m² = 100×100cm)
// 130×100cm = 1.3회배, 100×50cm = 0.5회배 등 비례 계산
// 최소 1회배 (1m² 미만은 1로 처리)
// ════════════════════════════════════════════════════
// 2026-05-14: 원단 가격 인하 — 1마 15000→10000, 반마 8000→6000
const HOEBAE_UNIT_PRICE = 10000;
const HOEBAE_AREA_CM2 = 100 * 100; // 1 m² = 10,000 cm²
const ROLL_MAX_WIDTH_CM = 130;     // 대폭 한계 — 초과 시 이어박기
const SEAM_EXTRA_KRW = 10000;      // 이어박기 추가비 (130cm 초과 시, 1회 부과)
const HALF_HOEBAE_PRICE = 6000;    // 반마(0.5회배 이하) 특가

// 원단 8종 (가격 동일, 회배 단가 사용)
// 2026-05-11: name_ja/en + desc_ja/en 추가 — 일본/미국 사이트 번역
const FABRIC_TYPES = {
    cotton20: { name: '면20수 평직', name_ja:'コットン20番 平織', name_en:'Cotton 20s Plain', isCotton: true, desc: '얇고 일반적인 20수 평직. 의류·인테리어 소품 활용 좋음.', desc_ja:'薄く一般的な20番平織。衣類・インテリア小物に最適。', desc_en:'Thin standard 20s plain weave. Great for apparel and interior items.' },
    cotton30: { name: '면30수 평직', name_ja:'コットン30番 平織', name_en:'Cotton 30s Plain', isCotton: true, desc: '얇고 부드러운 30수 평직. 통기성 좋아 여름 의류 적합.', desc_ja:'薄く柔らかい30番平織。通気性が良く夏物衣類に最適。', desc_en:'Thin soft 30s plain weave. Breathable — ideal for summer apparel.' },
    cotton16: { name: '면16수 평직', name_ja:'コットン16番 平織', name_en:'Cotton 16s Plain', isCotton: true, desc: '두께감 있는 16수. 가방·파우치·러너 등 적합.', desc_ja:'厚みのある16番。バッグ・ポーチ・テーブルランナーに最適。', desc_en:'Medium-weight 16s. Bags, pouches, runners.' },
    cotton10: { name: '면10수 평직', name_ja:'コットン10番 平織', name_en:'Cotton 10s Plain', isCotton: true, desc: '두꺼운 10수. 백월·매장 디스플레이·인테리어용.', desc_ja:'厚手の10番。バックウォール・店舗ディスプレイ・インテリア向け。', desc_en:'Heavyweight 10s. Backdrops, retail displays, interiors.' },
    chiffon:  { name: '쉬폰', name_ja:'シフォン', name_en:'Chiffon', isCotton: false, desc: '얇고 비치는 원단. 커튼·드레스·드레이프 적합.', desc_ja:'薄く透ける生地。カーテン・ドレス・ドレープに最適。', desc_en:'Sheer thin fabric. Curtains, dresses, draping.' },
    oxford:   { name: '옥스포드', name_ja:'オックスフォード', name_en:'Oxford', isCotton: false, desc: '내구성 뛰어난 폴리. 가방·실외 디스플레이용.', desc_ja:'耐久性に優れたポリエステル。バッグ・屋外ディスプレイ向け。', desc_en:'Durable polyester. Bags and outdoor displays.' },
    rayon:    { name: '레이온/인견', name_ja:'レーヨン', name_en:'Rayon', isCotton: false, desc: '시원한 인견 원단. 여름 의류·블라우스 적합.', desc_ja:'涼しいレーヨン生地。夏物衣類・ブラウスに最適。', desc_en:'Cool rayon fabric. Summer wear and blouses.' },
    linen:    { name: '린넨', name_ja:'リネン', name_en:'Linen', isCotton: false, desc: '천연 린넨. 고급 인테리어·식탁보·앞치마.', desc_ja:'天然リネン。高級インテリア・テーブルクロス・エプロン。', desc_en:'Natural linen. Premium interiors, tablecloths, aprons.' }
};
// 현재 언어로 원단 이름/설명 꺼내기
function pickFabricName(f){ var L = window.__CD_LANG||'ko'; if (L==='ja' && f.name_ja) return f.name_ja; if (L==='en' && f.name_en) return f.name_en; return f.name; }
function pickFabricDesc(f){ var L = window.__CD_LANG||'ko'; if (L==='ja' && f.desc_ja) return f.desc_ja; if (L==='en' && f.desc_en) return f.desc_en; return f.desc; }
const COLOR_LABELS = { white: '화이트', natural: '네츄럴', ivory: '백아이보리' };

// 대량 할인 정책 (수량 기준)
// 2026-05-14: 사용자 요청 — 10+ 10% / 100+ 20% / 500+ 30%
function getVolumeDiscount(qty) {
    if (qty >= 500) return { pct: 30, label: '500+ 30%↓' };
    if (qty >= 100) return { pct: 20, label: '100+ 20%↓' };
    if (qty >= 10)  return { pct: 10, label: '10+ 10%↓' };
    return { pct: 0, label: '' };
}

// ════════════════════════════════════════════════════
// 통화 변환 (KRW → JPY/USD)
// JPY: 1,000원 = 100엔 (rate 0.1)
// USD: 1,000원 = $1 (rate 0.001)
// ════════════════════════════════════════════════════
function cdFmtPrice(krw) {
    var n = Math.round(krw || 0);
    var lang = window.__CD_LANG || 'ko';
    if (lang === 'ja') {
        var jpy = Math.round(n * 0.1);
        return '¥' + jpy.toLocaleString();
    }
    if (lang === 'en') {
        var usd = Math.round(n * 0.001 * 100) / 100;
        return '$' + usd.toFixed(2);
    }
    return n.toLocaleString() + '원';
}
window.cdFmtPrice = cdFmtPrice;

// admin_products / admin_categories 동기화 결과 — 런타임에 채워짐
let DB_FABRICS = [];     // 패브릭만
let DB_HOOKS = [];       // 고리 (선택)
let DB_ACCESSORIES = []; // 그 외 부자재 (집게링/봉 등)
let DB_GROUPS = {};      // group_label -> [products]

// 원단 키워드로 그룹 분류
// 반환: 패브릭 그룹명 / '__hook__' (고리) / '__accessory__' (그 외 부자재) / null (노출 안 함)
function classifyGroup(p) {
    const n = (p.name || '').toLowerCase();
    // 고리 부자재 (고리/아일릿/후크/걸이만)
    if (/^고리|\s고리|아일릿|후크|걸이|hook|eyelet/.test(n)) return '__hook__';
    // 그 외 부자재 (집게/봉/벨크로/행거/클립/받침/스탠드/배접/재단)
    if (/집게|링|봉|벨크로|행거|클립|받침|스탠드|배접|재단/.test(n)) return '__accessory__';
    if (/광목|면\b|cotton|cb/i.test(n) || (p.code||'').startsWith('cb')) return '면/광목';
    if (/쉬폰|chiffon|실크|silk/.test(n)) return '쉬폰/실크';
    if (/레이온|rayon|인견/.test(n)) return '레이온/인견';
    if (/폴리|polyester|oxford|옥스포드/.test(n)) return '폴리/옥스포드';
    if (/스티커|점착|sticker/.test(n)) return '점착/스티커';
    return null;
}

// 2026-05-14: ?mode=poster 진입 시 — 1장짜리 포스터 모드.
//   '내원단(자동패턴)' 과 같은 상세페이지를 공유. layout 만 centered 로 기본 선택해서
//   사용자가 입력한 사이즈로 1장 인쇄에 가장 가까운 상태로 시작하도록.
//   (자동 패턴 반복이 아닌 단일 이미지 출력 의도)
const _cdQsMode = (function(){ try { return new URLSearchParams(location.search).get('mode') || ''; } catch(_) { return ''; } })();
const _cdIsPosterMode = _cdQsMode === 'poster';

// 상태
const state = {
    fabricType: 'cotton20',           // 8종 중 1
    fabricColor: 'white',             // 면 종류일 때만 사용
    fabricCode: 'cotton20_white',     // 합성 코드 (orders.items 저장용)
    layout: _cdIsPosterMode ? 'centered' : 'basic',
    bgColor: '#ffffff',               // 캔버스 배경색 (투명 PNG 패턴용 — 2026-05-11)
    imgScale: 1.0,                    // 패턴 셀 내 이미지 비율 (1.0 = 셀 가득, 0.3 = 30%만; 2026-05-11)
    orderWcm: 130,
    orderHcm: 100,
    orderQty: 1,
    imgWcm: 10,
    imgHcm: 10,
    imgAspect: 1,
    img: null,
    imgDataUrl: null,
    imgFileName: '',
    // 2026-05-14: 무료 샘플북 신청 (체크 시 주문 정보에 플래그 저장)
    sampleBook: false,
    // 1) 원단 마감 (필수, 기본 롤인쇄, m²당 가격)
    // 2026-05-12: 기본 마감 = 오버록 (롤인쇄 옵션 제거)
    finishCode: 'overlock',
    finishName: '오버록',
    finishExtra: 5000,                // 단가/m² (회배 비례)
    // 2) 고리 (선택, 1회 가격)
    hookCode: '',
    hookName: '',
    hookExtra: 0,
    // 3) 부자재 (선택, 1회 가격)
    accCode: '',
    accName: '',
    accExtra: 0,
    // 4) 이어박기 (130cm 초과 시 자동 +10,000원)
    seamExtra: 0
};

// 언어별 원단/색상 이름 매핑 (i18n 사전과 동기화)
const FABRIC_NAMES_I18N = {
    cotton20: { ko:'면20수 평직', ja:'コットン20番 平織', en:'Cotton 20s Plain' },
    cotton30: { ko:'면30수 평직', ja:'コットン30番 平織', en:'Cotton 30s Plain' },
    cotton16: { ko:'면16수 평직', ja:'コットン16番 平織', en:'Cotton 16s Plain' },
    cotton10: { ko:'면10수 평직', ja:'コットン10番 平織', en:'Cotton 10s Plain' },
    chiffon:  { ko:'쉬폰', ja:'シフォン', en:'Chiffon' },
    oxford:   { ko:'옥스포드', ja:'オックスフォード', en:'Oxford' },
    rayon:    { ko:'레이온/인견', ja:'レーヨン', en:'Rayon' },
    linen:    { ko:'린넨', ja:'リネン', en:'Linen' }
};
const COLOR_NAMES_I18N = {
    white:   { ko:'화이트', ja:'ホワイト', en:'White' },
    natural: { ko:'네츄럴', ja:'ナチュラル', en:'Natural' },
    ivory:   { ko:'백아이보리', ja:'アイボリー', en:'Ivory' }
};
function getLangFabricName(type) {
    var lang = window.__CD_LANG || 'ko';
    var d = FABRIC_NAMES_I18N[type];
    return d ? (d[lang] || d.ko) : type;
}
function getLangColorName(color) {
    var lang = window.__CD_LANG || 'ko';
    var d = COLOR_NAMES_I18N[color];
    return d ? (d[lang] || d.ko) : color;
}

function getFabric() {
    const t = FABRIC_TYPES[state.fabricType] || FABRIC_TYPES.cotton20;
    const isCotton = t.isCotton;
    const localizedName = getLangFabricName(state.fabricType);
    const colorLabel = isCotton ? (' (' + getLangColorName(state.fabricColor) + ')') : '';
    // 2026-05-11: 설명도 현재 언어로 (pickFabricDesc는 FABRIC_TYPES 원본에서 꺼냄)
    const localizedDesc = pickFabricDesc(t);
    return {
        code: state.fabricCode,
        name: localizedName + colorLabel,
        desc: localizedDesc,
        isCotton: isCotton,
        type: state.fabricType,
        color: isCotton ? state.fabricColor : null
    };
}

window._cdSelectFabricType = function(type) {
    state.fabricType = type;
    const t = FABRIC_TYPES[type] || FABRIC_TYPES.cotton20;
    state.fabricCode = type + (t.isCotton ? '_' + state.fabricColor : '');
    document.querySelectorAll('.fabric-type').forEach(el => el.classList.toggle('active', el.dataset.fab === type));
    document.getElementById('fabricColorWrap').style.display = t.isCotton ? '' : 'none';
    updateFabricDetail();
    updatePrice();
};

window._cdSelectColor = function(color, btn) {
    state.fabricColor = color;
    const t = FABRIC_TYPES[state.fabricType] || FABRIC_TYPES.cotton20;
    if (t.isCotton) state.fabricCode = state.fabricType + '_' + color;
    document.querySelectorAll('.color-chip').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateFabricDetail();
    updatePrice();
};

function calcHoebae() {
    const w = state.orderWcm || 0;
    const h = state.orderHcm || 0;
    return (w * h) / HOEBAE_AREA_CM2;
}

// ────────────────────────────────────────────────
// 이미지 업로드 — PDF/AI(PDF 호환)/PSD 자동 변환 지원 (2026-05-11)
// ────────────────────────────────────────────────
window._cdUploadImage = async function(files) {
    if (!files || !files.length) return;
    const file = files[0];
    // 2026-05-12: 업로드 제한 — PDF/PNG/JPG 만
    // 2026-05-15: 10MB → 50MB (simple_order 와 동일 — Supabase Storage 안정 한계)
    const name = (file.name || '').toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isPng = name.endsWith('.png') || file.type === 'image/png';
    const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg') || file.type === 'image/jpeg';
    if (!(isPdf || isPng || isJpg)) {
        showToast(window.cdT ? window.cdT('upload_bad_type')
                  : 'PDF · PNG · JPG 파일만 업로드 가능합니다.');
        return;
    }
    if (file.size > 50 * 1024 * 1024) {
        showToast(window.cdT ? window.cdT('upload_too_big')
                  : '50MB를 초과합니다. 더 작은 파일로 업로드해주세요.');
        return;
    }
    state.imgFileName = file.name;

    // 변환이 필요한 포맷 → DataURL 직접 생성
    try {
        let dataUrl = null;

        if (isPdf) {
            showToast('PDF 변환 중...');
            dataUrl = await convertPdfToDataUrl(file);
        }
        else if (!file.type.startsWith('image/')) {
            showToast(window.cdT ? window.cdT('upload_bad_type')
                      : 'PDF · PNG · JPG 파일만 업로드 가능합니다.');
            return;
        }
        else {
            // 일반 이미지 — FileReader 직진
            dataUrl = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = e => resolve(e.target.result);
                r.onerror = reject;
                r.readAsDataURL(file);
            });
        }

        if (!dataUrl) { showToast('파일 변환에 실패했습니다.'); return; }

        // 공통: dataUrl → Image → state 반영
        state.imgDataUrl = dataUrl;
        const img = new Image();
        img.onload = function() {
            state.img = img;
            state.imgAspect = img.width / img.height;
            // 2026-05-14: layout=='centered' (패브릭포스터) 일 때 — 실제 파일 픽셀 사이즈를
            //   96 DPI 기준으로 cm 환산, 원단폭 130cm 초과하면 비율 유지하며 축소.
            //   그리고 출력 사이즈(orderWcm/Hcm) 도 이미지 사이즈와 동일하게 맞춰서 "꽉차게" 표시.
            if (state.layout === 'centered') {
                const PX_PER_CM = 96 / 2.54;   // 브라우저 표준 96 DPI
                let wCm = img.width / PX_PER_CM;
                let hCm = img.height / PX_PER_CM;
                if (wCm > 130) { hCm = hCm * (130 / wCm); wCm = 130; }
                state.imgWcm = Math.round(wCm * 10) / 10;
                state.imgHcm = Math.round(hCm * 10) / 10;
                state.orderWcm = state.imgWcm;
                state.orderHcm = state.imgHcm;
                const oW = document.getElementById('orderWcm'); if (oW) oW.value = state.orderWcm;
                const oH = document.getElementById('orderHcm'); if (oH) oH.value = state.orderHcm;
            } else {
                state.imgWcm = 10;
                state.imgHcm = Math.round(10 / state.imgAspect * 10) / 10;
            }
            document.getElementById('imgWcm').value = state.imgWcm;
            document.getElementById('imgHcm').value = state.imgHcm;
            document.getElementById('uploadZone').style.display = 'none';
            document.getElementById('previewArea').classList.add('active');
            document.getElementById('btnReset').style.display = '';
            document.getElementById('btnReplace').style.display = '';
            const bs = document.getElementById('btnShrink'); if (bs) bs.style.display = '';
            document.getElementById('orderBtn').disabled = false;
            const buyNowBtn = document.getElementById('buyNowBtn');
            if (buyNowBtn) buyNowBtn.disabled = false;
            // imgScale 초기화
            state.imgScale = 1.0;
            const pct = document.getElementById('shrinkPct'); if (pct) pct.textContent = '100%';
            window._cdRender();
            showToast('✅ 업로드 완료');
        };
        img.onerror = function() { showToast('변환된 이미지를 표시할 수 없습니다'); };
        img.src = dataUrl;

    } catch (err) {
        console.error('[upload] error:', err);
        showToast('파일 변환 실패: ' + (err && err.message || err));
    }
};

// PDF/AI → PNG dataURL (PDF.js · 첫 페이지만)
async function convertPdfToDataUrl(file) {
    if (!window.pdfjsLib) throw new Error('PDF.js 라이브러리 로드 실패');
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    // 인쇄 품질을 위해 scale 2.5 (대형 출력 대비)
    const viewport = page.getViewport({ scale: 2.5 });
    const c = document.createElement('canvas');
    c.width = Math.min(viewport.width, 4000);   // 4000px 상한 (메모리 보호)
    c.height = Math.min(viewport.height, 4000);
    // viewport가 4000 넘으면 다시 scale 보정
    if (viewport.width > 4000 || viewport.height > 4000) {
        const k = 4000 / Math.max(viewport.width, viewport.height);
        const v2 = page.getViewport({ scale: 2.5 * k });
        c.width = v2.width; c.height = v2.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
    } else {
        await page.render({ canvasContext: c.getContext('2d'), viewport: viewport }).promise;
    }
    return c.toDataURL('image/png');
}

// PSD → PNG dataURL (ag-psd · composite 사용)
async function convertPsdToDataUrl(file) {
    if (!window.agPsd) throw new Error('ag-psd 라이브러리 로드 실패');
    const buf = await file.arrayBuffer();
    const psd = window.agPsd.readPsd(buf, { skipLayerImageData: true, skipThumbnail: true });
    if (!psd.canvas) throw new Error('PSD에 composite 이미지가 없습니다 (포토샵에서 "Maximize compatibility" 켜고 다시 저장해주세요)');
    return psd.canvas.toDataURL('image/png');
}

window._cdResetImage = function() {
    state.img = null; state.imgDataUrl = null; state.imgFileName = '';
    state.imgScale = 1.0;
    document.getElementById('uploadZone').style.display = '';
    document.getElementById('previewArea').classList.remove('active');
    document.getElementById('btnReset').style.display = 'none';
    document.getElementById('btnReplace').style.display = 'none';
    const bs = document.getElementById('btnShrink'); if (bs) bs.style.display = 'none';
    document.getElementById('orderBtn').disabled = true;
    document.getElementById('btnUpload').value = '';
    const pct = document.getElementById('shrinkPct'); if (pct) pct.textContent = '100%';
};

// 2026-05-11: 이미지 축소 — 셀(반복 단위) 좌표/크기는 그대로, 셀 내부 이미지만 축소.
//   클릭마다 -10%, 30%까지 가면 다음 클릭 시 100%로 사이클.
window._cdShrinkImage = function() {
    const steps = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
    const cur = state.imgScale || 1.0;
    // 현재값에 가장 가까운 step의 인덱스
    let idx = 0;
    for (let i = 0; i < steps.length; i++) {
        if (Math.abs(steps[i] - cur) < 0.05) { idx = i; break; }
    }
    idx = (idx + 1) % steps.length;
    state.imgScale = steps[idx];
    const pct = document.getElementById('shrinkPct');
    if (pct) pct.textContent = Math.round(state.imgScale * 100) + '%';
    window._cdRender();
};

// 드래그앤드롭
(function setupDragDrop(){
    const zone = document.getElementById('uploadZone');
    if (!zone) return;
    ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover');
    }));
    ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation();
        if (ev === 'dragleave' && zone.contains(e.relatedTarget)) return;
        zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', e => window._cdUploadImage(e.dataTransfer.files));
})();

// ════════════════════════════════════════════════════
// DB에서 부자재 옵션만 로드 (원단은 하드코딩 8종)
// ════════════════════════════════════════════════════
async function loadDbFabrics() {
    const sb = window.supabase ? window.supabase.createClient(
        'https://qinvtnhiidtmrzosyvys.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
    ) : null;
    if (!sb) return;
    try {
        const r1 = await sb.from('admin_categories').select('code').eq('top_category_code', '22222');
        if (r1.error) return; // 무해 — 하드코딩 부자재로 충분
        const subCats = r1.data || [];
        // 2026-05-12: 빈 코드 / 공백 / 콤마 포함 코드 필터링 — PostgREST IN 절 깨짐 방지
        const codes = subCats.map(c => (c.code || '').trim())
                              .filter(c => c && !c.includes(',') && !c.includes('(') && !c.includes(')'));
        if (codes.length === 0) return;
        const r2 = await sb.from('admin_products')
            .select('code, name, name_jp, name_us, name_en, name_kr, price, sort_order')
            .in('category', codes);
        if (r2.error) return;
        const products = r2.data || [];
        const classified = products
            .filter(p => !(p.code||'').startsWith('ua_'))
            .sort((a,b) => (a.sort_order||999) - (b.sort_order||999))
            .map(p => Object.assign(p, { group: classifyGroup(p) }));

        DB_ACCESSORIES = classified.filter(p => p.group === '__accessory__');
        renderAccessoryOptions();
    } catch(e) {
        // 부자재는 HTML에 하드코딩돼 있어 DB 실패해도 동작에 영향 없음
        if (e && e.message && !/aborted/i.test(e.message)) {
            console.warn('[loadDbFabrics] DB 부자재 로드 실패 (하드코딩 유지):', e.message);
        }
    }
}

// 고리 옵션 렌더 (DB_HOOKS) — DB 고리 추가 항목 (HTML 하드코딩 7개 외)
function renderHookOptions() {
    const list = document.getElementById('hookExtraList');
    if (!list) return;
    if (!DB_HOOKS.length) { list.innerHTML = ''; return; }
    list.innerHTML = DB_HOOKS.map(h => {
        const p = parseInt(h.price) || 0;
        const localName = pickProductName(h);
        return `<label class="fin-opt" data-hook="${h.code}" data-name="${(localName||'').replace(/"/g,'&quot;')}" data-extra="${p}">
            <input type="radio" name="hook" value="${h.code}" onchange="window._cdOnHookChange()">
            <span class="fin-opt-label"><b>${localName}</b></span>
            <span class="fin-opt-price">+${cdFmtPrice(p)}</span>
        </label>`;
    }).join('');
}

// 언어별 admin_products 이름 선택 (name_jp / name_us / name_kr / name)
function pickProductName(p) {
    var lang = window.__CD_LANG || 'ko';
    if (lang === 'ja') return p.name_jp || p.name_kr || p.name || '';
    if (lang === 'en') return p.name_us || p.name_en || p.name_kr || p.name || '';
    return p.name_kr || p.name || '';
}

// 부자재 옵션 렌더 (DB_ACCESSORIES)
function renderAccessoryOptions() {
    const list = document.getElementById('accessoryExtraList');
    if (!list) return;
    if (!DB_ACCESSORIES.length) {
        list.innerHTML = '<div style="padding:8px 12px; font-size:11px; color:var(--text-light);">' + (window.cdT?window.cdT('no_accessory'):'현재 등록된 부자재가 없습니다') + '</div>';
        return;
    }
    list.innerHTML = DB_ACCESSORIES.map(a => {
        const p = parseInt(a.price) || 0;
        const localName = pickProductName(a);
        return `<label class="fin-opt" data-acc="${a.code}" data-name="${(localName||'').replace(/"/g,'&quot;')}" data-extra="${p}">
            <input type="radio" name="accessory" value="${a.code}" onchange="window._cdOnAccessoryChange()">
            <span class="fin-opt-label"><b>${localName}</b></span>
            <span class="fin-opt-price">+${cdFmtPrice(p)}</span>
        </label>`;
    }).join('');
}

// 2026-05-11: 원단 종류·색상별 스왓치 (실사 이미지 대신 색 + 아이콘)
const FABRIC_SWATCH = {
    // cotton 4종은 선택 색상으로 결정되므로 여기선 fallback만 (실제 사용은 아래 colorBg)
    cotton20: { icon: 'fa-grip-lines',    accent: '#78350f' },
    cotton30: { icon: 'fa-grip-lines',    accent: '#78350f' },
    cotton16: { icon: 'fa-grip-lines',    accent: '#78350f' },
    cotton10: { icon: 'fa-grip-lines',    accent: '#78350f' },
    chiffon:  { bg: 'linear-gradient(135deg,#fef9e7 0%,#fef3c7 100%)', icon: 'fa-feather',       accent: '#a16207' },
    oxford:   { bg: 'linear-gradient(135deg,#d4d4aa 0%,#a3a380 100%)', icon: 'fa-shirt',         accent: '#3f3f1f' },
    rayon:    { bg: 'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%)', icon: 'fa-water',         accent: '#1e3a8a' },
    linen:    { bg: 'linear-gradient(135deg,#ede4d3 0%,#d4c5a0 100%)', icon: 'fa-leaf',          accent: '#5b3a1a' }
};
const COTTON_COLOR_BG = { white: '#ffffff', natural: '#e7d8b8', ivory: '#f5ecd3' };

function updateFabricDetail() {
    const f = getFabric();
    if (!f) return;
    // 2026-05-15: 색상 선택 영역 가시성 동기화 — 페이지 첫 로드 시 cotton 기본인데도 숨겨져 있던 버그 보강.
    //   기존엔 _cdSelectFabricType 안에서만 토글돼서 사용자가 한 번 클릭해야 보임.
    var _colorWrap = document.getElementById('fabricColorWrap');
    if (_colorWrap) _colorWrap.style.display = f.isCotton ? '' : 'none';
    const img = document.getElementById('fabricImg');
    if (img) {
        var sw = FABRIC_SWATCH[state.fabricType] || {};
        var bg;
        if (f.isCotton) bg = COTTON_COLOR_BG[state.fabricColor] || '#ffffff';
        else bg = sw.bg || '#f5f5f4';
        img.style.background = bg;
        img.style.border = '1px solid #d6d3d1';
        img.style.display = 'flex';
        img.style.alignItems = 'center';
        img.style.justifyContent = 'center';
        img.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.05)';
        img.innerHTML = '<i class="fa-solid ' + (sw.icon || 'fa-scroll') + '" style="font-size:28px; color:' + (sw.accent || '#78350f') + '; opacity:0.55;"></i>';
    }
    // 2026-05-11: 현재 언어로 원단 이름/설명 표시 + 최대폭 라벨도 i18n
    var nm = pickFabricName(f);
    var ds = pickFabricDesc(f);
    var maxLbl = window.cdT ? (window.cdT('side_output_max') || '대폭 130cm') : '대폭 130cm';
    document.getElementById('fabricDesc').innerHTML = `<b>${nm}</b><div style="font-size:11px; color:var(--text-light); margin-top:4px;">${ds} · ${maxLbl}</div>`;
}

// 마감 옵션 가격 라벨 동적 갱신 (언어/통화)
function renderFinishOptions() {
    var unitLabel = window.cdT ? (window.cdT('unit_hoebae') || '회배') : '회배';
    document.querySelectorAll('#finishOptions .fin-opt').forEach(function(label){
        var extra = parseInt(label.dataset.extra || '0', 10);
        var priceEl = label.querySelector('.fin-opt-price');
        if (!priceEl) return;
        if (extra === 0) {
            priceEl.textContent = '+' + cdFmtPrice(0) + ' / ' + unitLabel;
            // 가격 표시: +0원/회배 → +0원/회배 (KR), +¥0/回杯 (JP), +$0/unit (EN)
        } else {
            priceEl.textContent = '+' + cdFmtPrice(extra) + ' / ' + unitLabel;
        }
    });
    // 고리 옵션 가격
    document.querySelectorAll('#hookCollapse .fin-opt').forEach(function(label){
        var extra = parseInt(label.dataset.extra || '0', 10);
        var priceEl = label.querySelector('.fin-opt-price');
        if (!priceEl) return;
        priceEl.textContent = '+' + cdFmtPrice(extra);
    });
    // 부자재 가격
    document.querySelectorAll('#accCollapse .fin-opt').forEach(function(label){
        var extra = parseInt(label.dataset.extra || '0', 10);
        var priceEl = label.querySelector('.fin-opt-price');
        if (!priceEl) return;
        priceEl.textContent = '+' + cdFmtPrice(extra);
    });
}
// 페이지 로드 시 한 번 + 언어 변경 시 자동 호출됨 (cdSwitchLang은 페이지 새로고침이라 아래 로직 불필요)

function updateSizeLabels() {
    // 2026-05-11: 상/좌 라벨 제거 — 캔버스 아래 "가로 × 세로 : W × H" 형식 (dimW/dimH spans)
    var w = state.orderWcm.toFixed(0);
    var h = state.orderHcm.toFixed(0);
    var dW = document.getElementById('dimW'); if (dW) dW.textContent = w;
    var dH = document.getElementById('dimH'); if (dH) dH.textContent = h;
    // 레거시 ID 참조 안전장치 (다른 코드에서 호출돼도 깨지지 않게)
    var top = document.getElementById('topSizeLabel'); if (top) top.textContent = w + 'cm';
    var side = document.getElementById('sideSizeLabel'); if (side) side.textContent = h + 'cm';
}

// ────────────────────────────────────────────────
// 레이아웃 선택
// ────────────────────────────────────────────────
window._cdSelectLayout = function(name) {
    const prev = state.layout;
    state.layout = name;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.toggle('active', el.dataset.layout === name));
    // 2026-05-14: 다른 레이아웃 → centered 전환 시 이미지 사이즈에 출력 사이즈를 맞춤 (꽉차게).
    //   이미 centered 였거나 이미지 미로드면 skip.
    if (name === 'centered' && prev !== 'centered' && state.img && state.imgAspect) {
        state.orderWcm = state.imgWcm;
        state.orderHcm = state.imgHcm;
        const oW = document.getElementById('orderWcm'); if (oW) oW.value = state.orderWcm;
        const oH = document.getElementById('orderHcm'); if (oH) oH.value = state.orderHcm;
        if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae();
    }
    window._cdRender();
};

// ────────────────────────────────────────────────
// 배경색 선택 (2026-05-11 — 투명 PNG 패턴용)
// ────────────────────────────────────────────────
window._cdSelectBgColor = function(hex, btnEl) {
    if (!hex) return;
    state.bgColor = hex;
    // 스와치 active 표시 동기화
    document.querySelectorAll('.bg-sw').forEach(el => {
        el.classList.toggle('active', el.dataset.color && el.dataset.color.toLowerCase() === hex.toLowerCase());
    });
    if (btnEl && btnEl.classList) btnEl.classList.add('active');
    // 컬러피커 input + hex 라벨 동기화
    const picker = document.getElementById('bgColorPicker');
    if (picker && picker.value !== hex) picker.value = hex;
    const hexLabel = document.getElementById('bgColorHex');
    if (hexLabel) hexLabel.textContent = hex;
    window._cdRender();
};

// ════════════════════════════════════════════════════
// 회배 계산기 + 수량
// ════════════════════════════════════════════════════
window._cdCalcHoebae = function() {
    const wEl = document.getElementById('orderWcm');
    const hEl = document.getElementById('orderHcm');
    const qEl = document.getElementById('orderQty');
    let w = parseFloat(wEl.value) || 130;
    let h = parseFloat(hEl.value) || 100;
    let q = parseInt(qEl.value) || 1;
    // 130cm 초과 허용 — 이어박기 처리 (상한 1000cm 안전장치)
    if (w > 1000) { w = 1000; wEl.value = 1000; }
    if (w < 10) w = 10;
    if (h < 10) h = 10;
    if (q < 1) q = 1;
    // 2026-05-14: centered 모드 (패브릭포스터) — 출력 사이즈 변경 시 이미지 사이즈도 동일하게 + 비율 유지.
    //   ★ 중요: 사용자가 image 인풋에 타이핑 중일 때 _cdCalcHoebae 가 호출되면, 이 함수가
    //     imgW/imgH 인풋 값을 clamp 결과로 덮어쓰지 않아야 함. 안 그러면 사용자가 '2' 타이핑 →
    //     w < 10 clamp → iW.value = 10 → 사용자가 '0' 이어 타이핑 → '100' 으로 바뀌는 버그 발생.
    //   따라서 aspect 재계산이 실제로 일어났을 때만 image 인풋 sync.
    let _ctSyncImg = false;
    if (state.layout === 'centered' && state.imgAspect) {
        const prevW = state.orderWcm, prevH = state.orderHcm;
        if (w !== prevW && h === prevH) {
            // 가로만 변경 → 세로 자동 (출력 가로 변경 케이스)
            const newH = Math.round((w / state.imgAspect) * 10) / 10;
            if (newH >= 10) {
                h = newH;
                hEl.value = h;
                _ctSyncImg = true;
            }
        } else if (h !== prevH && w === prevW) {
            // 세로만 변경 → 가로 자동
            const newW = Math.round((h * state.imgAspect) * 10) / 10;
            if (newW >= 10 && newW <= 1000) {
                w = newW;
                wEl.value = w;
                _ctSyncImg = true;
            }
        }
    }
    state.orderWcm = w; state.orderHcm = h; state.orderQty = q;
    // 이미지 인풋 sync — aspect 재계산이 일어났을 때만 (사용자가 image 인풋에 타이핑 중일 땐 X).
    if (_ctSyncImg) {
        state.imgWcm = w; state.imgHcm = h;
        const iW = document.getElementById('imgWcm'); if (iW && document.activeElement !== iW) iW.value = w;
        const iH = document.getElementById('imgHcm'); if (iH && document.activeElement !== iH) iH.value = h;
    }
    // 이어박기 자동 결정
    state.seamExtra = (w > ROLL_MAX_WIDTH_CM) ? SEAM_EXTRA_KRW : 0;
    const seamEl = document.getElementById('seamNotice');
    if (seamEl) seamEl.style.display = state.seamExtra > 0 ? '' : 'none';
    const rawHoebae = calcHoebae();
    const tier = getHoebaeTier();
    const itemPrice = calcItemPrice();
    var lang = window.__CD_LANG || 'ko';
    var tierLbl = '';
    if (tier === 'half') tierLbl = lang==='ja' ? ' (半マ特価)' : lang==='en' ? ' (half-meter)' : ' (반마 특가)';
    else if (tier === 'min') tierLbl = lang==='ja' ? ' (1回杯適用)' : lang==='en' ? ' (1-unit min)' : ' (1회배 적용)';
    document.getElementById('hoebaeAmount').textContent = rawHoebae.toFixed(2) + ' 회배' + tierLbl;
    document.getElementById('hoebaePrice').textContent = cdFmtPrice(itemPrice);
    // 단가 안내 노티스 표시/숨김
    const tierEl = document.getElementById('tierNotice');
    if (tierEl) {
        if (tier === 'half') {
            tierEl.style.display = '';
            tierEl.dataset.cdi18n = 'tier_half_notice';
            tierEl.textContent = window.cdT ? window.cdT('tier_half_notice') : '🎉 0.5회배(반마) 이하는 6,000원 특가';
        } else if (tier === 'min') {
            tierEl.style.display = '';
            tierEl.dataset.cdi18n = 'tier_min_notice';
            tierEl.textContent = window.cdT ? window.cdT('tier_min_notice') : 'ℹ️ 1회배 미만은 1회배(10,000원)로 청구됩니다';
        } else {
            tierEl.style.display = 'none';
        }
    }
    updateSizeLabels();
    updatePrice();
    window._cdRender();
};

window._cdQtyChg = function(d) {
    const qEl = document.getElementById('orderQty');
    let q = (parseInt(qEl.value) || 1) + d;
    if (q < 1) q = 1; if (q > 999) q = 999;
    qEl.value = q;
    window._cdCalcHoebae();
};

// 토글: 고리/부자재 collapse
window._cdToggleCollapse = function(id, head) {
    const body = document.getElementById(id);
    const card = head.closest('.collapse-card');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'flex';
    if (card) card.classList.toggle('open', !open);
};

// 회배 청구 단위 — 0.5 이하는 0.5(반마), 0.5< x <1 은 1, 그 이상은 실제 회배
function calcBillableHoebae() {
    var h = calcHoebae();
    if (h <= 0.5) return 0.5;
    if (h < 1) return 1;
    return h;
}

// 출력 단가 — 반마(≤0.5)는 8,000원 / 1배 미만은 15,000원 / 1배 이상은 회배×15,000
function calcItemPrice() {
    var h = calcHoebae();
    if (h <= 0.5) return HALF_HOEBAE_PRICE;          // 반마 특가
    if (h < 1) return HOEBAE_UNIT_PRICE;             // 1회배 미만은 1회배 가격
    return Math.round(h * HOEBAE_UNIT_PRICE);
}

// 현재 사이즈가 어느 단계인지 — 표시용 라벨
function getHoebaeTier() {
    var h = calcHoebae();
    if (h <= 0.5) return 'half';
    if (h < 1) return 'min';
    return 'full';
}

function updatePrice() {
    const rawHoebae = calcHoebae();           // 표시용 (실제 비율)
    const hoebae = calcBillableHoebae();      // 청구용 회배 (반마=0.5 / 미만=1 / 그외 실제)
    const itemPrice = calcItemPrice();        // 출력 단가 (반마 8,000 / 1배 미만 15,000 / 그외 회배×15,000)
    const finishPerItem = Math.round((state.finishExtra || 0) * hoebae); // 회배 비례
    const otherPerItem = (state.hookExtra || 0) + (state.accExtra || 0) + (state.seamExtra || 0);
    const perItem = itemPrice + finishPerItem + otherPerItem;
    const subtotal = perItem * state.orderQty;
    const disc = getVolumeDiscount(state.orderQty);
    const discountAmt = Math.round(subtotal * disc.pct / 100);
    const total = subtotal - discountAmt;

    document.getElementById('pUnit').textContent = cdFmtPrice(itemPrice) + ' (' + hoebae.toFixed(2) + 'x)';
    document.getElementById('pQty').textContent = state.orderQty;

    const extraParts = [];
    extraParts.push(state.finishName + (finishPerItem > 0 ? ' ×' + hoebae.toFixed(2) + ' = ' + cdFmtPrice(finishPerItem) : ''));
    if (state.hookCode) extraParts.push((window.cdT?window.cdT('hook'):'고리') + ': ' + state.hookName + ' (' + cdFmtPrice(state.hookExtra||0) + ')');
    if (state.accCode) extraParts.push((window.cdT?window.cdT('acc'):'부자재') + ': ' + state.accName + ' (' + cdFmtPrice(state.accExtra||0) + ')');
    if (state.seamExtra > 0) extraParts.push((window.cdT?window.cdT('seam_label'):'이어박기 (대폭 초과)') + ' (+' + cdFmtPrice(state.seamExtra) + ')');
    document.getElementById('pFinish').innerHTML = extraParts.join('<br>');

    const dRow = document.getElementById('pDiscountRow');
    if (disc.pct > 0) {
        dRow.style.display = '';
        var bd = document.getElementById('pDiscBadge'); if (bd) bd.textContent = disc.label;
        document.getElementById('pDiscount').textContent = '-' + cdFmtPrice(discountAmt);
    } else {
        dRow.style.display = 'none';
    }

    // 고리/부자재 헤더 요약 표시
    var noneText = window.cdT ? window.cdT('none_selected') : '선택 안 함';
    const hs = document.getElementById('hookSummary');
    if (hs) hs.textContent = state.hookCode ? state.hookName + ' (+' + cdFmtPrice(state.hookExtra||0) + ')' : noneText;
    const as = document.getElementById('accSummary');
    if (as) as.textContent = state.accCode ? state.accName + ' (+' + cdFmtPrice(state.accExtra||0) + ')' : noneText;

    document.getElementById('pTotal').textContent = cdFmtPrice(total);
}

// ────────────────────────────────────────────────
// 비율 유지 (가로 입력 → 세로 자동, 세로 입력 → 가로 자동)
// 2026-05-14: layout=='centered' (패브릭포스터) 일 때 — 이미지 사이즈 변경이 출력 사이즈에도
//             동일하게 반영 (imgWcm == orderWcm, imgHcm == orderHcm). 4개 필드 모두 한 비율로 묶임.
// ────────────────────────────────────────────────
window._cdOnSizeInput = function(which) {
    const wInput = document.getElementById('imgWcm');
    const hInput = document.getElementById('imgHcm');
    const lockEl = document.getElementById('aspectLock');
    const locked = lockEl ? lockEl.checked : true;
    if (locked && state.imgAspect) {
        if (which === 'w') {
            const w = parseFloat(wInput.value) || 1;
            const h = Math.round((w / state.imgAspect) * 10) / 10;
            hInput.value = h;
        } else {
            const h = parseFloat(hInput.value) || 1;
            const w = Math.round((h * state.imgAspect) * 10) / 10;
            wInput.value = w;
        }
    }
    // 패턴 한 타일 폭 경고 (이미지 타일 사이즈)
    const w = parseFloat(wInput.value) || 0;
    if (w > 130) {
        var lang = window.__CD_LANG || 'ko';
        var msg = lang === 'ja' ? 'パターンタイルの最大幅は130cmです'
                : lang === 'en' ? 'Max tile width is 130cm'
                : '패턴 타일의 최대 폭은 130cm입니다';
        showToast(msg);
    }
    // 2026-05-14: centered 레이아웃 = 패브릭포스터 모드 → 출력 사이즈 동기화
    if (state.layout === 'centered') {
        const newW = parseFloat(wInput.value) || 0;
        const newH = parseFloat(hInput.value) || 0;
        const oW = document.getElementById('orderWcm');
        const oH = document.getElementById('orderHcm');
        if (oW && newW > 0) oW.value = newW;
        if (oH && newH > 0) oH.value = newH;
        state.orderWcm = newW; state.orderHcm = newH;
        if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae();
    }
    window._cdRender();
};

// ────────────────────────────────────────────────
// 1) 원단 마감 변경
// ────────────────────────────────────────────────
window._cdOnFinishChange = function() {
    const checked = document.querySelector('input[name="finish"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.finishCode = checked.value;
    // 2026-05-11: i18n 적용된 <b> 텍스트 우선 (한국어 dataset.name 폴백)
    var b = label.querySelector('b');
    state.finishName = (b && b.textContent.trim()) || label.dataset.name || '';
    state.finishExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};
// 2) 고리 변경
window._cdOnHookChange = function() {
    const checked = document.querySelector('input[name="hook"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.hookCode = checked.value || '';
    // 2026-05-11: 번역된 <b> 우선
    var b = label.querySelector('b');
    state.hookName = state.hookCode ? ((b && b.textContent.trim()) || label.dataset.name || '') : '';
    state.hookExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};
// 3) 부자재 변경
window._cdOnAccessoryChange = function() {
    const checked = document.querySelector('input[name="accessory"]:checked');
    if (!checked) return;
    const label = checked.closest('.fin-opt');
    state.accCode = checked.value || '';
    // 2026-05-13: 번역된 <b> 우선 (i18n 적용 후 텍스트), dataset.name 은 KR 폴백
    var b = label.querySelector('b');
    state.accName = state.accCode ? ((b && b.textContent.trim()) || label.dataset.name || '') : '';
    state.accExtra = parseInt(label.dataset.extra || '0', 10);
    updatePrice();
};

// ────────────────────────────────────────────────
// 캔버스 렌더링
// ────────────────────────────────────────────────
window._cdRender = function() {
    if (!state.img) return;

    state.imgWcm = parseFloat(document.getElementById('imgWcm').value) || 10;
    state.imgHcm = parseFloat(document.getElementById('imgHcm').value) || 10;

    // 출력 사이즈 (cm) — 가용 폭 자동 감지
    const fabricW = state.orderWcm || 130;
    const fabricH = state.orderHcm || 100;
    const previewArea = document.getElementById('previewArea');
    const containerW = previewArea ? previewArea.clientWidth : window.innerWidth;
    const isMobile = window.innerWidth <= 768;
    // 좌·우 ruler(22 each) + gap(2 each) + frame padding(12) + 여유 ≈ 64px
    const maxW = Math.max(260, Math.min(containerW - 64, isMobile ? 900 : 1100));
    const maxH = isMobile ? 540 : 760;
    const scaleByW = maxW / fabricW;
    const scaleByH = maxH / fabricH;
    const pxPerCm = Math.min(scaleByW, scaleByH);
    const cw = Math.max(120, Math.floor(fabricW * pxPerCm));
    const ch = Math.max(120, Math.floor(fabricH * pxPerCm));

    // 2026-05-11: DPR 적용 — 캔버스 내부 픽셀을 디바이스 픽셀에 맞춰 크게, CSS는 cw/ch
    //   결과: 레티나/HiDPI 화면에서 또렷, 일반 화면에서도 1:1 매칭으로 흐림 제거
    const canvas = document.getElementById('fabricCanvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = state.bgColor || '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // 줄자 그리기 (캔버스 dimensions 결정 후)
    drawRulers(cw, ch, pxPerCm, fabricW, fabricH);

    const tileW = state.imgWcm * pxPerCm;
    const tileH = state.imgHcm * pxPerCm;
    if (tileW < 2 || tileH < 2) return;

    // 2026-05-11: imgScale — 셀 좌표/크기는 그대로, 셀 내부 이미지만 비례 축소.
    //   결과: 객체 사이 여백이 생기는 듬성듬성한 패턴.
    const sc = state.imgScale || 1.0;
    const drawW = tileW * sc, drawH = tileH * sc;
    const padX = (tileW - drawW) / 2, padY = (tileH - drawH) / 2;

    const layout = state.layout;

    if (layout === 'centered') {
        const x = (cw - tileW) / 2, y = (ch - tileH) / 2;
        ctx.drawImage(state.img, x + padX, y + padY, drawW, drawH);
    }
    else if (layout === 'basic') {
        for (let y = 0; y < ch; y += tileH) {
            for (let x = 0; x < cw; x += tileW) {
                ctx.drawImage(state.img, x + padX, y + padY, drawW, drawH);
            }
        }
    }
    else if (layout === 'halfdrop') {
        // 매 두 번째 컬럼은 세로로 절반 내림
        const cols = Math.ceil(cw / tileW) + 1;
        for (let c = 0; c < cols; c++) {
            const x = c * tileW;
            const offsetY = (c % 2) * (tileH / 2);
            for (let y = -tileH; y < ch; y += tileH) {
                ctx.drawImage(state.img, x + padX, y + offsetY + padY, drawW, drawH);
            }
        }
    }
    else if (layout === 'halfbrick') {
        // 매 두 번째 행은 가로로 절반 밂
        const rows = Math.ceil(ch / tileH) + 1;
        for (let r = 0; r < rows; r++) {
            const y = r * tileH;
            const offsetX = (r % 2) * (tileW / 2);
            for (let x = -tileW; x < cw; x += tileW) {
                ctx.drawImage(state.img, x + offsetX + padX, y + padY, drawW, drawH);
            }
        }
    }
    else if (layout === 'mirror') {
        const cols = Math.ceil(cw / tileW), rows = Math.ceil(ch / tileH);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const flipX = c % 2 === 1, flipY = r % 2 === 1;
                ctx.save();
                // 셀 중심으로 이동 후 flip
                ctx.translate(c * tileW + tileW/2, r * tileH + tileH/2);
                ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                ctx.drawImage(state.img, -drawW/2, -drawH/2, drawW, drawH);
                ctx.restore();
            }
        }
    }

    // 가장자리 살짝 페이드 (실제 인쇄 영역 표현)
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cw - 1, ch - 1);
};

// 2026-05-11: 줄자 (눈금자) — 캔버스 상단 가로, 좌측 세로
//  - 1cm 간격 minor tick (짧음)
//  - 5cm 간격 medium tick (중간)
//  - 10cm 간격 major tick (길음 + 숫자 라벨)
function drawRulers(cw, ch, pxPerCm, fabricW, fabricH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    // ---- 상단 줄자 ----
    const rT = document.getElementById('rulerTop');
    if (rT) {
        const rh = 18;
        rT.width = Math.round(cw * dpr);
        rT.height = Math.round(rh * dpr);
        rT.style.width = cw + 'px';
        rT.style.height = rh + 'px';
        const rc = rT.getContext('2d');
        rc.setTransform(dpr, 0, 0, dpr, 0, 0);
        rc.clearRect(0, 0, cw, rh);
        rc.fillStyle = '#faf6ed'; rc.fillRect(0, 0, cw, rh);
        rc.strokeStyle = '#78350f'; rc.fillStyle = '#451a03';
        rc.font = '9px -apple-system,system-ui,sans-serif';
        rc.textAlign = 'center'; rc.textBaseline = 'bottom';
        for (let cm = 0; cm <= fabricW; cm++) {
            const x = Math.round(cm * pxPerCm) + 0.5;
            let tickH = 3;
            if (cm % 10 === 0) tickH = 9;
            else if (cm % 5 === 0) tickH = 6;
            rc.beginPath();
            rc.moveTo(x, rh);
            rc.lineTo(x, rh - tickH);
            rc.stroke();
            if (cm % 10 === 0 && cm > 0) {
                rc.fillText(cm.toString(), x, rh - 10);
            }
        }
    }

    // ---- 좌측 줄자 ----
    const rL = document.getElementById('rulerLeft');
    if (rL) {
        const rw = 22;
        rL.width = Math.round(rw * dpr);
        rL.height = Math.round(ch * dpr);
        rL.style.width = rw + 'px';
        rL.style.height = ch + 'px';
        const lc = rL.getContext('2d');
        lc.setTransform(dpr, 0, 0, dpr, 0, 0);
        lc.clearRect(0, 0, rw, ch);
        lc.fillStyle = '#faf6ed'; lc.fillRect(0, 0, rw, ch);
        lc.strokeStyle = '#78350f'; lc.fillStyle = '#451a03';
        lc.font = '9px -apple-system,system-ui,sans-serif';
        lc.textAlign = 'right'; lc.textBaseline = 'middle';
        for (let cm = 0; cm <= fabricH; cm++) {
            const y = Math.round(cm * pxPerCm) + 0.5;
            let tickW = 3;
            if (cm % 10 === 0) tickW = 9;
            else if (cm % 5 === 0) tickW = 6;
            lc.beginPath();
            lc.moveTo(rw, y);
            lc.lineTo(rw - tickW, y);
            lc.stroke();
            if (cm % 10 === 0 && cm > 0) {
                lc.save();
                lc.translate(rw - 11, y);
                lc.rotate(-Math.PI / 2);
                lc.textAlign = 'center';
                lc.fillText(cm.toString(), 0, 0);
                lc.restore();
            }
        }
    }
}

// ════════════════════════════════════════════════
// 🛒 패브릭 장바구니 (localStorage)
// 2026-05-12: 도메인 통합 — cafe2626/0101/3355 같은 origin 에 있을 때는 메인 카트(chameleon_cart_current)
// 와 같은 키 사용 → 로그인·카트 자연스럽게 공유. cotton-print.com (구 도메인) 에서는 legacy 키 유지.
// ════════════════════════════════════════════════
const CART_KEY = (function () {
    var h = (location.hostname || '').toLowerCase();
    if (h.indexOf('cotton-print') >= 0) return 'cp_cart_v1';  // legacy
    return 'chameleon_cart_current';                            // 통합
})();
function getCart() {
    try {
        var arr = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || [];
        // 빈/손상 항목 (undefined 같은) 방어 필터
        arr = arr.filter(function (it) {
            if (!it || typeof it !== 'object') return false;
            // 패브릭 항목 최소 식별: title/fabricName/fabricCode/orderWcm 중 하나
            if (it.fabricCode || it.fabricName || it.title || it.orderWcm != null) return true;
            // 일반 상품: product 또는 productCode
            if (it.product && (it.product.code || it.product.name)) return true;
            if (it.productCode || it.productName) return true;
            return false;
        });
        // 통합 카트일 경우 패브릭 아이템만 필터 (다른 일반상품 items 분리 렌더)
        if (CART_KEY === 'chameleon_cart_current') {
            return arr.filter(function (it) {
                return it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null);
            });
        }
        return arr;
    } catch (e) { return []; }
}
function saveCart(c) {
    try {
        if (CART_KEY === 'chameleon_cart_current') {
            // 통합 카트: 기존 일반상품 보존하고 패브릭 항목만 교체
            var existing = [];
            try { existing = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []; } catch (e) {}
            var others = existing.filter(function (it) {
                return !(it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null));
            });
            var tagged = (c || []).map(function (it) {
                if (it && !it.__source) it.__source = 'cotton-print';
                return it;
            });
            localStorage.setItem(CART_KEY, JSON.stringify(others.concat(tagged)));
        } else {
            localStorage.setItem(CART_KEY, JSON.stringify(c));
        }
    } catch (e) {
        // 2026-05-15: localStorage quota 초과 (큰 이미지 dataUrl 누적) — 조용히 실패 대신 사용자 알림.
        //   add-to-cart 시점에 storage 업로드 보강했지만 fallback 으로 dataUrl 가 남아있는 경우 대비.
        var isQuota = e && (e.name === 'QuotaExceededError' || /quota|storage/i.test(e.message || ''));
        if (isQuota) {
            console.error('[saveCart] localStorage quota 초과 — 큰 이미지로 카트 저장 실패', e);
            if (typeof showToast === 'function') {
                showToast(window.cdT ? (window.cdT('alert_cart_full') || '카트가 가득 찼습니다. 일부 항목을 삭제 후 다시 시도해주세요.') : '카트가 가득 찼습니다. 일부 항목을 삭제 후 다시 시도해주세요.', 'error');
            }
        } else {
            console.warn('[saveCart] failed', e);
        }
    }
}

// 2026-05-12: 통합 카트 — 같은 localStorage 안의 일반상품 항목도 함께 노출
function _isValidCartItem(it) {
    if (!it || typeof it !== 'object') return false;
    if (it.fabricCode || it.fabricName || it.title || it.orderWcm != null) return true;
    if (it.product && (it.product.code || it.product.name)) return true;
    if (it.productCode || it.productName) return true;
    return false;
}
function getAllCartItems() {
    try {
        var arr = JSON.parse(localStorage.getItem(CART_KEY) || '[]') || [];
        return arr.filter(_isValidCartItem); // 빈/손상 항목 방어
    }
    catch (e) { return []; }
}
function _isFabricItem(it) {
    return it && (it.__source === 'cotton-print' || it.fabricCode || it.orderWcm != null);
}
function getGeneralItems() {
    if (CART_KEY !== 'chameleon_cart_current') return [];
    return getAllCartItems().filter(function (it) { return !_isFabricItem(it); });
}

// 2026-05-14: 택배비 — 사이트별 KRW 고정 (KR 5000, JP 10000 = ¥1000, US 10000 = $10).
//   카트에 아이템이 1개 이상일 때만 부과. 매니저 견적 등 일부 흐름에서는 별도 처리될 수 있음.
function getShippingFeeKrw() {
    try {
        var cc = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || '';
        var lang = (window.__CD_LANG || '').toLowerCase();
        if (cc === 'JP' || lang === 'ja') return 10000;   // ¥1,000
        if (cc === 'US' || lang === 'en') return 10000;   // $10
        return 5000;                                      // 기본 KR — ₩5,000
    } catch (_) { return 5000; }
}

function calcCartTotal() {
    var fabricTotal = getCart().reduce(function(s, it) { return s + (it.price || 0); }, 0);
    var genTotal = getGeneralItems().reduce(function(s, it) {
        var base = (it.product && it.product.price || 0) * (it.qty || 1);
        return s + base;
    }, 0);
    var subtotal = fabricTotal + genTotal;
    // 카트 비어있으면 택배비 X
    if (subtotal <= 0) return 0;
    return subtotal + getShippingFeeKrw();
}

window._cpUpdateCartUI = function() {
    const cart = getCart();
    const gen = getGeneralItems();
    const totalCount = cart.length + gen.length;
    const badge = document.getElementById('cartBadge');
    const inline = document.getElementById('cartCountInline');
    const body = document.getElementById('cartBody');
    const totalAmt = document.getElementById('cartTotalAmt');
    const checkoutBtn = document.getElementById('cartCheckoutBtn');

    if (badge) {
        if (totalCount > 0) { badge.style.display = 'flex'; badge.textContent = totalCount; }
        else { badge.style.display = 'none'; }
    }
    if (inline) inline.textContent = totalCount ? '(' + totalCount + ')' : '';
    if (totalAmt) totalAmt.textContent = cdFmtPrice(calcCartTotal());
    if (checkoutBtn) checkoutBtn.disabled = totalCount === 0;
    // 2026-05-15: 전체 비우기 버튼 — 아이템이 1개 이상일 때만 표시
    var clearBtn = document.getElementById('cartClearAllBtn');
    if (clearBtn) clearBtn.style.display = totalCount > 0 ? '' : 'none';

    if (body) {
        // 2026-05-11: 모든 라벨 i18n 적용 — 카트 드로어 안의 한국어 문구 제거
        var T = function(k, fb){ return (window.cdT && window.cdT(k)) || fb; };
        var L = {
            empty:      T('cart_empty', '장바구니가 비어있습니다'),
            empty_sub:  T('cart_empty_sub', '디자인을 완성하고 장바구니에 담아보세요'),
            output:     T('cart_output', '출력'),
            unit:       T('unit_hoebae', '회배'),
            finish:     T('cart_finish', '마감'),
            hook:       T('cart_hook', '고리'),
            acc:        T('cart_acc', '부자재'),
            remove:     T('cart_remove', '삭제'),
            raw:        T('finish_raw', '가재단'),
            seam:       T('seam_label', '이어박기 (대폭 초과)')
        };
        if (cart.length === 0 && gen.length === 0) {
            body.innerHTML = '<div class="cart-empty"><i class="fa-regular fa-folder-open"></i><div style="font-weight:700; color:var(--brown-dark); margin-bottom:4px;">' + L.empty + '</div><div style="font-size:12px;">' + L.empty_sub + '</div></div>';
        } else {
            // 패브릭 섹션
            var fabricHtml = '';
            if (cart.length > 0) {
                fabricHtml = '<div style="font-size:12px; font-weight:800; color:#64748b; margin:4px 0 8px;"><i class="fa-solid fa-scissors" style="margin-right:6px;"></i>' + T('cart_section_fabric', '패브릭') + '</div>' +
                cart.map(function(it, i) {
                    const sz = it.orderSize || ((it.orderWcm||(it.orderWmm/10)) + '×' + (it.orderHcm||(it.orderHmm/10)) + 'cm');
                    const opts = [
                        it.fabricName,
                        L.output + ' ' + sz,
                        it.hoebae ? it.hoebae.toFixed(2) + L.unit : null,
                        it.qtyLabel,
                        (it.finishCode && it.finishCode !== 'raw' && it.finishCode !== 'none') ? L.finish + ': ' + (it.finishName || '') : (it.finishCode === 'raw' ? L.raw : null),
                        it.hookCode ? L.hook + ': ' + (it.hookName||'') : null,
                        it.accCode ? L.acc + ': ' + (it.accName||'') : null,
                        (it.seamExtra && it.seamExtra > 0) ? L.seam + ' (+' + cdFmtPrice(it.seamExtra) + ')' : null
                    ].filter(Boolean).join(' · ');
                    return '<div class="cart-item">' +
                        '<img class="cart-item-thumb" src="' + (it.thumbDataUrl || '') + '" alt="">' +
                        '<div class="cart-item-info">' +
                            '<div class="cart-item-name">' + it.title + '</div>' +
                            '<div class="cart-item-opts">' + opts + '</div>' +
                            '<div class="cart-item-bottom">' +
                                '<span class="cart-item-price">' + cdFmtPrice(it.price||0) + '</span>' +
                                '<button class="cart-item-remove" onclick="window._cpCartRemove(' + i + ')"><i class="fa-solid fa-trash"></i> ' + L.remove + '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }
            // 일반상품 섹션 (2026-05-12: 통합 카트)
            var genHtml = '';
            if (gen.length > 0) {
                genHtml = '<div style="font-size:12px; font-weight:800; color:#64748b; margin:12px 0 8px;"><i class="fa-solid fa-box" style="margin-right:6px;"></i>' + T('cart_section_general', '일반상품') + '</div>' +
                gen.map(function(it, gi) {
                    var name = (it.product && (it.product.name || it.product.name_jp || it.product.name_us)) || (it.productName || '상품');
                    var qty = it.qty || 1;
                    var price = ((it.product && it.product.price) || 0) * qty;
                    var thumb = it.thumb || (it.product && it.product.img) || 'https://placehold.co/80?text=Item';
                    return '<div class="cart-item">' +
                        '<img class="cart-item-thumb" src="' + thumb + '" alt="">' +
                        '<div class="cart-item-info">' +
                            '<div class="cart-item-name">' + name + '</div>' +
                            '<div class="cart-item-opts">' + qty + '개</div>' +
                            '<div class="cart-item-bottom">' +
                                '<span class="cart-item-price">' + cdFmtPrice(price) + '</span>' +
                                '<button class="cart-item-remove" onclick="window._cpRemoveGeneralCartItem(' + gi + ')"><i class="fa-solid fa-trash"></i> ' + L.remove + '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }
            // 2026-05-14: 카트 안에 택배비 라인 — total 에 합산되므로 사용자가 명확히 인지하도록 표시
            var ship = (cart.length > 0 || gen.length > 0) ? getShippingFeeKrw() : 0;
            var shipHtml = ship > 0
                ? '<div style="display:flex; justify-content:space-between; align-items:center; padding:14px 0; margin-top:8px; border-top:1px dashed #d6d3d1; font-size:13px;">' +
                    '<span style="color:#15803d; font-weight:800;"><i class="fa-solid fa-truck-fast" style="margin-right:6px;"></i>' + T('ship_label','택배 배송') + '</span>' +
                    '<span style="color:#166534; font-weight:900;">+' + cdFmtPrice(ship) + '</span>' +
                  '</div>'
                : '';
            body.innerHTML = fabricHtml + genHtml + shipHtml;
        }
    }
};

// 2026-05-12: 통합 카트 — cotton_designer 드로어에서 일반상품 삭제
window._cpRemoveGeneralCartItem = function (genIdx) {
    var all = getAllCartItems();
    var generalItems = all.filter(function (it) { return !_isFabricItem(it); });
    if (!generalItems[genIdx]) return;
    var targetCartId = generalItems[genIdx].__cart_id;
    var filtered = all.filter(function (it) {
        if (_isFabricItem(it)) return true;
        // 같은 __cart_id 면 제거; 없으면 첫 매칭
        return targetCartId ? (it.__cart_id !== targetCartId) : (it !== generalItems[genIdx]);
    });
    try { localStorage.setItem(CART_KEY, JSON.stringify(filtered)); } catch (e) {}
    window._cpUpdateCartUI();
};

window._cpCartOpen = function() {
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    window._cpUpdateCartUI();
    // 2026-05-12: 크로스도메인 배너 렌더 (cart_sync.js)
    try { if (window.cartSync && window.cartSync.renderBanner) window.cartSync.renderBanner(); } catch (e) {}
};

// ════════════════════════════════════════════════════
// 2026-05-12: 도메인 통합 — 메인 사이트 로그인 상태를 헤더에 비치기 (별도 OAuth 없음)
// cafe2626/0101/3355 같은 origin 에 있을 때는 메인의 supabase 세션을 그대로 사용.
// 로그인 안 되어 있으면 메인 사이트 로그인 페이지로 안내.
// ════════════════════════════════════════════════════
(function syncCpLoginUI() {
    function getSb() {
        if (window.sb && typeof window.sb.from === 'function') return window.sb;
        if (window.__unified_sb) return window.__unified_sb;
        return null; // cart_sync.js 가 세팅한 client 재사용. 따로 만들지 않음.
    }
    async function refresh() {
        var sb = getSb();
        var loginLink = document.getElementById('cpLoginLink');
        if (!loginLink) return;
        if (!sb) { setTimeout(refresh, 300); return; }
        try {
            var r = await sb.auth.getSession();
            var session = r && r.data && r.data.session;
            var label = document.getElementById('cpLoginLabel');
            if (session && session.user) {
                // 로그인됨 — 버튼 숨김 (메인 사이트와 마찬가지로 헤더는 카트만 표시)
                loginLink.style.display = 'none';
            } else {
                // 로그인 필요 — 메인 사이트 로그인 페이지로
                loginLink.style.display = '';
                if (label) label.textContent = '로그인';
                loginLink.href = '/login?return=' + encodeURIComponent(location.pathname + location.search);
            }
        } catch (e) {}
    }
    function init() {
        refresh();
        var sb = getSb();
        if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
            try { sb.auth.onAuthStateChange(refresh); } catch (e) {}
        } else {
            // sb 가 아직 준비 안 됨 — 잠시 후 재시도
            setTimeout(init, 500);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();

// ════════════════════════════════════════════════════
// 2026-05-13: 상단 카테고리 메뉴 바 (#topCatMenu) — 메인 페이지와 동일한 보라색 nav
// admin_top_categories 에서 동적 로드 + tcm-btn 클래스 (메인 CSS 적용)
// 클릭 → 메인페이지(/) navigate + sessionStorage 에 코드 저장
// ════════════════════════════════════════════════════
(function populateCdTopCatMenu() {
    var _populated = false;
    async function populate() {
        var track = document.getElementById('topCatMenuTrack');
        if (!track || _populated) return;
        var sb = window.sb || window.__unified_sb;
        if (!sb && window.supabase && window.supabase.createClient) {
            try {
                sb = window.supabase.createClient(
                    'https://qinvtnhiidtmrzosyvys.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
                );
                window.__unified_sb = sb;
            } catch (e) {}
        }
        if (!sb) { setTimeout(populate, 300); return; }
        try {
            var res = await sb.from('admin_top_categories').select('*').order('sort_order', { ascending: true });
            var topCats = res && res.data;
            if (!topCats || !topCats.length) return;
            var lang = window.__CD_LANG || 'ko';
            track.innerHTML = '';
            topCats.forEach(function (top) {
                // 메인 페이지 nav 와 동일: user_artwork, default 는 제외
                if (top.code === 'user_artwork' || top.code === 'default') return;
                var name = top.name;
                if (lang === 'ja' && top.name_jp) name = top.name_jp;
                else if (lang === 'en' && top.name_us) name = top.name_us;
                var btn = document.createElement('button');
                btn.className = 'tcm-btn';
                if (top.code === '22222') btn.classList.add('active'); // 패브릭 현재 페이지
                btn.textContent = name || '';
                btn.dataset.topCode = top.code;
                btn.onclick = function () {
                    // 패브릭 (현재 페이지)
                    if (top.code === '22222') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        return;
                    }
                    // 특수 케이스 (메인 분기와 동일)
                    var langMap = { ja:'ja', en:'en', zh:'zh', ar:'ar', es:'es', de:'de', fr:'fr', kr:'ko' };
                    var psLang = langMap[lang] || '';
                    if (top.code === 'paper_display') {
                        location.href = '/paper-stand' + (psLang && psLang !== 'ko' ? '?lang=' + psLang : '');
                        return;
                    }
                    if (top.code === 'Wholesale Board Prices') {
                        location.href = '/raw-board' + (psLang && psLang !== 'ko' ? '?lang=' + psLang : '');
                        return;
                    }
                    if (top.code === 'user_artwork') {
                        location.href = '/#artworkMarketBanner';
                        return;
                    }
                    // 일반 카테고리: 메인 페이지 navigate + pendingTopCat (main.js 가 productPickerModal 자동 열음)
                    try { sessionStorage.setItem('pendingTopCat', top.code); } catch (e) {}
                    location.href = '/';
                };
                track.appendChild(btn);
            });
            _populated = true;
        } catch (e) { console.warn('[cd-topcat]', e); }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', populate);
    } else { populate(); }
})();
window._cpCartClose = function() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.body.style.overflow = '';
};
window._cpCartRemove = function(i) {
    const cart = getCart();
    cart.splice(i, 1);
    saveCart(cart);
    window._cpUpdateCartUI();
};
// 2026-05-15: 전체 비우기 — fabric + 일반상품 모두 제거 + 서버 동기화 (cart_sync.clearAll)
window._cpCartClearAll = function() {
    var msg = (window.cdT && window.cdT('cart_clear_confirm')) || '장바구니의 모든 항목을 삭제할까요?';
    if (!window.confirm(msg)) return;
    try {
        if (window.cartSync && typeof window.cartSync.clearAll === 'function') {
            window.cartSync.clearAll();
        } else {
            // fallback — 직접 localStorage 처리
            try { localStorage.setItem(CART_KEY, '[]'); } catch (e) {}
            try { localStorage.setItem('chameleon_cart_updated_at', new Date().toISOString()); } catch (e) {}
        }
    } catch (e) { console.warn('[clearAll]', e); }
    window._cpUpdateCartUI();
};

// 캔버스의 현재 미리보기를 썸네일로 (리사이즈된 데이터URL)
function captureThumbDataUrl() {
    const canvas = document.getElementById('fabricCanvas');
    if (!canvas) return null;
    try {
        const tmp = document.createElement('canvas');
        const targetW = 240;
        const ratio = canvas.width ? (canvas.height / canvas.width) : 1;
        tmp.width = targetW;
        tmp.height = Math.round(targetW * ratio);
        const ctx = tmp.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,tmp.width,tmp.height);
        ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
        return tmp.toDataURL('image/jpeg', 0.7);
    } catch (e) { return null; }
}

function buildCartItem() {
    const f = getFabric();
    if (!f) { showToast(window.cdT?window.cdT("alert_no_fabric"):"원단을 선택해주세요"); return null; }
    const rawHoebae = calcHoebae();
    const hoebae = calcBillableHoebae();      // 반마=0.5 / 미만=1 / 그외 실제
    const itemPrice = calcItemPrice();        // 반마 8,000 / 1배 미만 15,000 / 그외 회배×15,000
    const finishPerItem = Math.round((state.finishExtra||0) * hoebae);
    const otherPerItem = (state.hookExtra||0) + (state.accExtra||0) + (state.seamExtra||0);
    const subtotal = (itemPrice + finishPerItem + otherPerItem) * state.orderQty;
    const disc = getVolumeDiscount(state.orderQty);
    const discountAmt = Math.round(subtotal * disc.pct / 100);
    const price = subtotal - discountAmt;

    const cleanFile = state.imgFileName
        ? state.imgFileName.replace(/\.[^.]+$/, '').replace(/^[a-f0-9-]{20,}$/i, '').slice(0, 20)
        : '';
    const title = (f.name || '내 패턴 원단') + (cleanFile ? ' — ' + cleanFile : '');
    return {
        id: 't' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
        title: title,
        thumbDataUrl: captureThumbDataUrl(),
        imgDataUrl: state.imgDataUrl,
        imgFileName: state.imgFileName,
        fabricCode: f.code,
        fabricName: f.name,
        fabricType: state.fabricType,
        fabricColor: f.isCotton ? state.fabricColor : null,
        orderWcm: state.orderWcm,
        orderHcm: state.orderHcm,
        orderSize: state.orderWcm + '×' + state.orderHcm + 'cm',
        width_mm: Math.round(state.orderWcm * 10),
        height_mm: Math.round(state.orderHcm * 10),
        hoebae: hoebae,
        rawHoebae: rawHoebae,
        unitPrice: itemPrice,
        imageSize: state.imgWcm + '×' + state.imgHcm + 'cm',
        // 2026-05-11: 패턴 셀 크기 — pattern_spec.cell_cm 으로 정확히 흘러가도록 명시.
        // 이전엔 imageSize 문자열만 있어서 작업지시서에 'undefined×undefined' 표시되던 버그 fix.
        imgWcm: state.imgWcm,
        imgHcm: state.imgHcm,
        layout: state.layout,
        bgColor: state.bgColor || '#ffffff',  // 2026-05-11: 배경색 (투명 PNG 패턴 인쇄용)
        imgScale: state.imgScale != null ? state.imgScale : 1.0,  // 2026-05-11: 셀 내 이미지 비율
        // 2026-05-11: 마켓플레이스 자동로드 케이스 — 작가 원본 URL이 이미 storage에 있음.
        // localStorage 직렬화 시 큰 dataURL이 잘려나가더라도 이 URL은 짧아서 안전.
        designerPatternId:  state.designerPatternId || null,
        designerName:       state.designerName || null,
        designerOriginalUrl: state.designerOriginalUrl || null,
        qtyValue: state.orderQty,
        qtyLabel: state.orderQty + (window.cdT ? (window.cdT('qty_unit') || '개') : '개'),
        finishCode: state.finishCode, finishName: state.finishName, finishUnit: state.finishExtra || 0, finishTotal: finishPerItem,
        hookCode: state.hookCode, hookName: state.hookName, hookExtra: state.hookExtra || 0,
        accCode: state.accCode, accName: state.accName, accExtra: state.accExtra || 0,
        seamExtra: state.seamExtra || 0,
        oversize: state.orderWcm > ROLL_MAX_WIDTH_CM,
        subtotal: subtotal,
        discountPct: disc.pct,
        discountAmt: discountAmt,
        price: price,
        // 2026-05-14: 무료 샘플북 신청 플래그 — 주문 정보 텍스트에 포함되어 다크팩토리로 동기화됨.
        sampleBook: !!state.sampleBook,
        addedAt: new Date().toISOString()
    };
}

// 2026-05-14: 샘플북 체크박스 핸들러 — state 동기화만 (가격 영향 X, 주문 시 메모로 들어감)
window._cdOnSampleBookChange = function () {
    const el = document.getElementById('sampleBookCheck');
    state.sampleBook = !!(el && el.checked);
};

// 2026-05-15: localStorage 5MB 한계 회피 — 큰 imgDataUrl 은 Storage 에 미리 업로드 후 URL 만 보관.
//   기존엔 1MB 넘는 패턴이 base64 로 ~1.3MB 차지 → 여러 개 담으면 quota 초과로 saveCart 가
//   silently 실패하던 버그. 이제 add-to-cart 시점에 업로드해서 localStorage 사용량을 작게 유지.
async function _cdPersistItemImage(item) {
    if (!item) return item;
    // 마켓플레이스 패턴 — 이미 storage 에 있는 URL 사용, base64 는 버림
    if (item.designerOriginalUrl) {
        item.cartImageUrl = item.designerOriginalUrl;
        item.imgDataUrl = '';
        return item;
    }
    if (!item.imgDataUrl || typeof item.imgDataUrl !== 'string') return item;
    // 200KB 이하면 localStorage 에 그대로 둠 (네트워크 라운드트립 회피)
    if (item.imgDataUrl.length < 200 * 1024) return item;
    var sb = (window.sb && typeof window.sb.from === 'function') ? window.sb : null;
    if (!sb && window.supabase && window.supabase.createClient) {
        try {
            sb = window.supabase.createClient(
                'https://qinvtnhiidtmrzosyvys.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
            );
        } catch (e) {}
    }
    if (!sb) return item; // 업로드 불가 — 그대로 진행 (saveCart 실패 가능)
    try {
        var m = item.imgDataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (!m) return item;
        var mime = m[1], b64 = m[2];
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var blob = new Blob([arr], { type: mime });
        var ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
        var path = 'cotton-print/cart/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        var up = await sb.storage.from('orders').upload(path, blob);
        if (up && !up.error) {
            var pub = sb.storage.from('orders').getPublicUrl(path);
            item.cartImageUrl = pub && pub.data && pub.data.publicUrl || '';
            item.imgDataUrl = ''; // localStorage 부담 제거
        } else if (up && up.error) {
            console.warn('[cd cart upload]', up.error);
        }
    } catch (e) { console.warn('[cd cart upload exc]', e); }
    return item;
}

window._cdAddToCart = async function() {
    // 2026-05-12: UX 개선 — 파일 없이 클릭 시 그냥 카트 드로어 열기 (기존 카트 확인용)
    if (!state.img || !state.imgDataUrl) {
        if (window._cpCartOpen) window._cpCartOpen();
        return;
    }
    const item = buildCartItem();
    if (!item) return;
    // 2026-05-15: 큰 이미지는 미리 Storage 에 올려 localStorage quota 초과 방지
    showToast(window.cdT ? (window.cdT('saving') || '저장 중...') : '저장 중...');
    await _cdPersistItemImage(item);
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    showToast('장바구니에 담았습니다 (' + cart.length + '개)');
    setTimeout(window._cpCartOpen, 400);
};

window._cdBuyNow = async function() {
    // 2026-05-12: 파일 없이 클릭 시 → 카트 드로어 열기 (기존 카트 → 결제하기)
    if (!state.img || !state.imgDataUrl) {
        if (window._cpCartOpen) window._cpCartOpen();
        return;
    }
    const item = buildCartItem();
    if (!item) return;
    // 2026-05-12: 최소주문금액 사전 검증 (장바구니 + 이번 아이템)
    const cart = getCart();
    const projectedTotal = cart.reduce(function(s, it){ return s + (it.price||0); }, 0) + (item.price||0);
    if (!checkMinOrderAmount(projectedTotal)) return;
    showToast(window.cdT ? (window.cdT('saving') || '저장 중...') : '저장 중...');
    await _cdPersistItemImage(item);
    // 통과 — cart에 추가 후 즉시 체크아웃
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    window._cpOpenCheckout();
};

// 2026-05-13: 최소주문금액 제도 폐지 — 사용자 결정 (KR/JP/EN 모두 제한 없음)
function checkMinOrderAmount(_total_krw) {
    return true;
}

window._cpOpenCheckout = function() {
    const cart = getCart();
    if (cart.length === 0) return;
    // 2026-05-12: 최소주문금액 검증 (장바구니 합계 기준)
    if (!checkMinOrderAmount(calcCartTotal())) return;
    // 요약 렌더
    const list = document.getElementById('coItemList');
    // 2026-05-13: 체크아웃 요약 라벨 다국어 (마감/고리/부자재/출력) + 옵션명 코드 기반 i18n 폴백
    var _cdL = (window.__CD_LANG || 'ko');
    var _LT = {
        ko: { out:'출력', fin:'마감', hook:'고리', acc:'부자재', raw:'가재단' },
        ja: { out:'出力', fin:'仕上げ', hook:'ストラップ', acc:'付属品', raw:'仮裁断' },
        en: { out:'Print', fin:'Finish', hook:'Strap', acc:'Accessory', raw:'Pre-cut' }
    };
    var L = _LT[_cdL] || _LT.ko;
    // 코드 → i18n key 로 번역 시도 (저장된 name 이 한국어인 경우 보정)
    function _trByCode(prefix, code, fallback) {
        if (!code) return fallback || '';
        var key = prefix + '_' + code;
        if (window.cdT) {
            var t = window.cdT(key);
            if (t) return t;
        }
        return fallback || '';
    }
    list.innerHTML = cart.map(function(it){
        var finTxt = _trByCode('finish', it.finishCode, it.finishName || L.raw);
        var hookTxt = _trByCode('hook', it.hookCode, it.hookName);
        var accTxt = _trByCode('acc', it.accCode, it.accName);
        const parts = [it.fabricName, L.out + ' ' + (it.orderSize||''), it.qtyLabel, L.fin + ': ' + finTxt];
        if (it.hookCode) parts.push(L.hook + ': ' + hookTxt);
        if (it.accCode) parts.push(L.acc + ': ' + accTxt);
        const opts = parts.filter(Boolean).join(' · ');
        return '<div class="co-summary-item"><div class="co-summary-item-name">' + it.title + '</div><div class="co-summary-item-opts">' + opts + '</div><div class="co-summary-item-price">' + cdFmtPrice(it.price) + '</div></div>';
    }).join('');
    document.getElementById('coTotalAmt').textContent = cdFmtPrice(calcCartTotal());
    document.getElementById('checkoutOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // 2026-05-14: 관리자/매니저 로그인 시 '고객 결제창 만들어주기' 버튼 노출 (패브릭)
    // window.isAdmin 폴백 — sb.auth.getUser() + ADMIN_EMAILS 검사 (cross-domain 대비)
    (async function () {
        var btn = document.getElementById('coMgrQuoteBtn');
        var hint = document.getElementById('coMgrQuoteHint');
        var res = document.getElementById('coMgrQuoteResult');
        if (res) res.style.display = 'none';
        var isAdm = !!window.isAdmin;
        if (!isAdm && window.supabase) {
            try {
                var ADMIN_EMAILS = ['korea900as@gmail.com', 'ceo@test.com', 'scr3257@naver.com'];
                var sb2 = window.supabase.createClient(
                    'https://qinvtnhiidtmrzosyvys.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
                );
                var { data: sess } = await sb2.auth.getUser();
                var em = sess?.user?.email || '';
                if (em && ADMIN_EMAILS.indexOf(em) >= 0) { isAdm = true; window.isAdmin = true; }
                // profiles.role 'admin' 또는 'manager' 도 허용 (스태프 목록 매니저 자동 매칭)
                if (!isAdm && sess?.user?.id) {
                    var { data: prof } = await sb2.from('profiles').select('role').eq('id', sess.user.id).single();
                    if (prof && (prof.role === 'admin' || prof.role === 'manager')) { isAdm = true; window.isAdmin = true; }
                }
            } catch (e) {}
        }
        if (btn) btn.style.display = isAdm ? '' : 'none';
        if (hint) hint.style.display = isAdm ? '' : 'none';
    })();
};

// 2026-05-14: 패브릭 카트 기반 매니저 견적 (고객 결제창) 생성
window._cpCreateMgrQuote = async function (btnEl) {
    var name = (document.getElementById('coName').value || '').trim();
    var phone = (document.getElementById('coPhone').value || '').trim();
    var zip = (document.getElementById('coZip').value || '').trim();
    var addr1 = (document.getElementById('coAddr1').value || '').trim();
    var addr2 = (document.getElementById('coAddr2').value || '').trim();
    var memo = (document.getElementById('coMemo').value || '').trim();
    if (!name) { alert('고객명(받으시는 분)을 입력해주세요.'); return; }
    if (!phone) { alert('고객 연락처를 입력해주세요.'); return; }
    var cart = getCart();
    if (cart.length === 0) { alert('패브릭 카트가 비어있습니다.'); return; }
    var origLabel = btnEl ? btnEl.innerHTML : '';
    try {
        if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '⏳ 생성 중...'; }
        var sb = window.supabase ? window.supabase.createClient(
            'https://qinvtnhiidtmrzosyvys.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
        ) : null;
        if (!sb) throw new Error('Supabase 연결 실패');
        // 디자인 이미지 업로드
        // 2026-05-15: cartImageUrl 있으면 재업로드 스킵 (add-to-cart 시점에 이미 올림)
        var uploadedFiles = [];
        for (var i = 0; i < cart.length; i++) {
            var it = cart[i];
            if (it.cartImageUrl) {
                uploadedFiles.push({ name: it.imgFileName || ('fabric' + (i + 1)), url: it.cartImageUrl, type: 'image/png' });
                continue;
            }
            if (!it.imgDataUrl) continue;
            var m = it.imgDataUrl.match(/^data:(.+?);base64,(.+)$/);
            if (!m) continue;
            var mime = m[1], b64 = m[2];
            var bin = atob(b64);
            var arr = new Uint8Array(bin.length);
            for (var j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
            var blob = new Blob([arr], { type: mime });
            var ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
            var path = 'cotton-print/manager_quotes/' + Date.now() + '_' + i + '.' + ext;
            var { error: upErr } = await sb.storage.from('orders').upload(path, blob);
            if (!upErr) {
                var u = sb.storage.from('orders').getPublicUrl(path).data.publicUrl;
                uploadedFiles.push({ name: it.imgFileName || ('fabric' + (i + 1)), url: u, type: mime });
            }
        }
        var total = calcCartTotal();
        var items = cart.map(function (it, idx) {
            // 2026-05-15: cartImageUrl → uploadedFiles → designerOriginalUrl 우선순위
            var artworkUrl = null, artworkName = null;
            if (it.cartImageUrl) {
                artworkUrl = it.cartImageUrl;
                artworkName = it.imgFileName || ('fabric' + (idx + 1));
            } else if (it.imgDataUrl && uploadedFiles[idx]) {
                artworkUrl = uploadedFiles[idx].url;
                artworkName = uploadedFiles[idx].name;
            } else if (it.designerOriginalUrl) {
                artworkUrl = it.designerOriginalUrl;
                artworkName = it.imgFileName || 'designer_pattern.png';
            }
            return {
                product_code: it.fabricCode,
                product_name: it.title,
                fabric: it.fabricName,
                width_mm: it.width_mm || Math.round((it.orderWcm || 130) * 10),
                height_mm: it.height_mm || Math.round((it.orderHcm || 100) * 10),
                width_cm: it.orderWcm, height_cm: it.orderHcm,
                qty: it.qtyValue, price: it.price || 0,
                source: 'cotton-print',
                artwork_url: artworkUrl, artwork_filename: artworkName,
                addons: [
                    it.finishCode ? { type: 'finish', code: it.finishCode, name: it.finishName, price: it.finishExtra || 0 } : null,
                    it.hookCode ? { type: 'hook', code: it.hookCode, name: it.hookName, price: it.hookExtra || 0 } : null,
                    it.accCode ? { type: 'accessory', code: it.accCode, name: it.accName, price: it.accExtra || 0 } : null
                ].filter(Boolean)
            };
        });
        var fullAddr = [zip ? '(' + zip + ')' : '', addr1, addr2].filter(Boolean).join(' ');
        var mgrEmail = '';
        try { var { data: sess } = await sb.auth.getUser(); mgrEmail = sess?.user?.email || ''; } catch (e) {}
        var orderRow = {
            order_date: new Date().toISOString(),
            manager_name: name,
            phone: phone,
            address: fullAddr,
            request_note: memo || '',
            status: '접수됨',
            payment_status: '상담대기',
            payment_method: null,
            total_amount: total,
            discount_amount: 0,
            items: items,
            site_code: 'KR',
            files: uploadedFiles.length ? uploadedFiles : null,
            admin_note: '[MANAGER_QUOTE] [Cotton Print] manager=' + (mgrEmail || 'unknown') + '\n패브릭 매니저 카트 기반 결제창 생성 — 고객 결제 대기'
        };
        var { data: inserted, error: insErr } = await sb.from('orders').insert([orderRow]).select().single();
        if (insErr) { console.error('[cpCreateMgrQuote]', insErr); alert('결제창 생성 실패: ' + (insErr.message || insErr)); return; }
        var newId = inserted.id;
        try { sb.functions.invoke('sync-order-to-drive', { body: { order_id: newId } }).catch(function(){}); } catch (e) {}
        var quoteUrl = 'https://www.cafe2626.com/?quote=' + encodeURIComponent(newId);
        var urlInp = document.getElementById('coMgrQuoteUrl');
        var resBox = document.getElementById('coMgrQuoteResult');
        if (urlInp) urlInp.value = quoteUrl;
        if (resBox) resBox.style.display = '';
        // 결제대기 목록에 누적
        try {
            var raw = localStorage.getItem('cm_pending_quotes') || '[]';
            var pendingArr = JSON.parse(raw); if (!Array.isArray(pendingArr)) pendingArr = [];
            if (pendingArr.indexOf(String(newId)) < 0) pendingArr.push(String(newId));
            localStorage.setItem('cm_pending_quotes', JSON.stringify(pendingArr));
        } catch (e) {}
        // 패브릭 카트 비우기 (cotton-print 도메인 기준)
        try { saveCart([]); window._cpUpdateCartUI && window._cpUpdateCartUI(); } catch (e) {}
        if (btnEl) { btnEl.innerHTML = '✅ 생성 완료 — URL 복사하여 고객에게 전송'; }
    } catch (e) {
        console.error('[cpCreateMgrQuote]', e);
        alert('오류: ' + (e.message || e));
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origLabel; }
    }
};

window._cpCopyMgrQuoteUrl = async function (btn) {
    var inp = document.getElementById('coMgrQuoteUrl');
    if (!inp) return;
    try {
        await navigator.clipboard.writeText(inp.value);
        var orig = btn.innerHTML; btn.innerHTML = '✓';
        setTimeout(function () { btn.innerHTML = orig; }, 1500);
    } catch (e) {
        inp.select(); document.execCommand('copy');
        alert('URL 이 복사되었습니다.');
    }
};

window._cpCloseCheckout = function() {
    document.getElementById('checkoutOverlay').classList.remove('open');
    document.body.style.overflow = '';
};

// 무통장 입금 안내 모달
window._cpCloseBankInfo = function() {
    const o = document.getElementById('bankInfoOverlay');
    if (o) o.style.display = 'none';
    document.body.style.overflow = '';
};
window._cpCopyAccount = function() {
    const acc = '64770104277763'; // 하이픈 없는 숫자만
    const btn = document.getElementById('biCopyBtn');
    const orig = btn.innerHTML;
    function done(ok) {
        btn.innerHTML = ok ? '<i class="fa-solid fa-check"></i> 복사됨' : '<i class="fa-solid fa-xmark"></i> 실패';
        btn.style.background = ok ? '#16a34a' : '#dc2626';
        btn.style.color = '#fff';
        setTimeout(function(){
            btn.innerHTML = orig;
            btn.style.background = '#451a03';
            btn.style.color = '#fde047';
        }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(acc).then(function(){ done(true); }).catch(function(){
            // fallback
            const ta = document.createElement('textarea');
            ta.value = acc; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done(true); } catch(e){ done(false); }
            document.body.removeChild(ta);
        });
    } else {
        const ta = document.createElement('textarea');
        ta.value = acc; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(true); } catch(e){ done(false); }
        document.body.removeChild(ta);
    }
};

// 체크아웃 → orders 테이블 등록 + Toss/무통장 처리
// Toss Payments 클라이언트 키 (cafe2626 메인몰과 동일 — 운영용)
const TOSS_CLIENT_KEY = 'live_ck_KNbdOvk5rkkQE9aLdzlV3n07xlzm';

window._cpSubmitOrder = async function() {
    const name = (document.getElementById('coName').value||'').trim();
    const phone = (document.getElementById('coPhone').value||'').trim();
    const email = (document.getElementById('coEmail').value||'').trim();
    const zip = (document.getElementById('coZip').value||'').trim();
    const addr1 = (document.getElementById('coAddr1').value||'').trim();
    const addr2 = (document.getElementById('coAddr2').value||'').trim();
    const memo = (document.getElementById('coMemo').value||'').trim();
    const payMethod = (document.querySelector('input[name="payMethod"]:checked')||{}).value || 'bank';

    if (!name) { alert(window.cdT?window.cdT("alert_name_required"):"받으시는 분 성함을 입력해주세요."); return; }
    if (!phone) { alert(window.cdT?window.cdT("alert_phone_required"):"연락처를 입력해주세요."); return; }
    if (!addr1) { alert(window.cdT?window.cdT("alert_address_required"):"배송지를 입력해주세요."); return; }

    const cart = getCart();
    if (cart.length === 0) return;

    const btn = document.getElementById('coSubmitBtn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (window.cdT?window.cdT("processing"):"처리 중...") + '';

    try {
        const sb = window.supabase ? window.supabase.createClient(
            'https://qinvtnhiidtmrzosyvys.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
        ) : null;
        if (!sb) throw new Error('연결 실패');

        // 1) 디자인 이미지 업로드 (각 카트 아이템)
        // 2026-05-15: add-to-cart 시점에 이미 storage 에 올린 cartImageUrl 이 있으면 그대로 사용 → 재업로드 스킵.
        const uploadedFiles = [];
        for (let i = 0; i < cart.length; i++) {
            const it = cart[i];
            // 이미 storage 에 업로드돼서 URL 보관 중이면 그대로 사용
            if (it.cartImageUrl) {
                uploadedFiles.push({ name: it.imgFileName || ('item' + (i+1)), url: it.cartImageUrl, type: 'image/png' });
                continue;
            }
            if (!it.imgDataUrl) continue;
            const m = it.imgDataUrl.match(/^data:(.+?);base64,(.+)$/);
            if (!m) continue;
            const mime = m[1], b64 = m[2];
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let j=0; j<bin.length; j++) arr[j] = bin.charCodeAt(j);
            const blob = new Blob([arr], { type: mime });
            const ext = (mime.split('/')[1]||'png').replace(/[^a-z0-9]/gi,'');
            const path = 'cotton-print/orders/' + Date.now() + '_' + i + '.' + ext;
            const { error: upErr } = await sb.storage.from('orders').upload(path, blob);
            if (!upErr) {
                const u = sb.storage.from('orders').getPublicUrl(path).data.publicUrl;
                uploadedFiles.push({ name: it.imgFileName || ('item' + (i+1)), url: u, type: mime });
            }
        }

        const total = calcCartTotal();
        // orders.items: 통합주문관리에서 인식할 수 있는 형식으로
        const items = cart.map(function(it, idx){
            // 2026-05-11: 한 아이템에 매핑된 작가 원본 이미지.
            //   1순위: 새로 업로드된 storage URL (직접 업로드 케이스)
            //   2순위: 마켓플레이스 자동로드 시 이미 storage에 있는 원본 URL (designerOriginalUrl)
            //   둘 다 없으면 null — 작업지시서에 '-' 로 표시
            // 2026-05-15: cartImageUrl (add-to-cart 시 업로드한 URL) → imgDataUrl 신규 업로드 → designerOriginalUrl
            var artworkUrl = null, artworkName = null;
            if (it.cartImageUrl) {
                artworkUrl  = it.cartImageUrl;
                artworkName = it.imgFileName || ('item' + (idx + 1));
            } else if (it.imgDataUrl && uploadedFiles[idx]) {
                artworkUrl  = uploadedFiles[idx].url;
                artworkName = uploadedFiles[idx].name;
            } else if (it.designerOriginalUrl) {
                // 마켓 자동로드 — 원본은 user_patterns storage 에 이미 있음
                artworkUrl  = it.designerOriginalUrl;
                artworkName = it.imgFileName || (it.designerName ? it.designerName + '_pattern.png' : 'designer_pattern.png');
            }
            return {
                product_code: it.fabricCode,
                product_name: it.title,
                fabric: it.fabricName,
                width_mm: it.width_mm || Math.round((it.orderWcm||130)*10),
                height_mm: it.height_mm || Math.round((it.orderHcm||100)*10),
                width_cm: it.orderWcm,
                height_cm: it.orderHcm,
                hoebae: it.hoebae,
                layout: it.layout,
                bg_color: it.bgColor || '#ffffff',  // 2026-05-11: 배경색 (투명 PNG 패턴 인쇄용)
                qty: it.qtyValue,
                addons: (function(){
                    const arr = [];
                    if (it.finishCode) arr.push({ type:'finish', code:it.finishCode, name:it.finishName, price:it.finishExtra||0 });
                    if (it.hookCode) arr.push({ type:'hook', code:it.hookCode, name:it.hookName, price:it.hookExtra||0 });
                    if (it.accCode) arr.push({ type:'accessory', code:it.accCode, name:it.accName, price:it.accExtra||0 });
                    if (it.seamExtra && it.seamExtra > 0) arr.push({ type:'seam', code:'seam_join', name:'이어박기 (대폭 130cm 초과)', price:it.seamExtra });
                    return arr;
                })(),
                unit_price: it.unitPrice,
                price: it.price,
                source: 'cotton-print',
                // 2026-05-11: 패턴 재조합 메타 — 다크팩토리 정보.txt 와 Python 스크립트에서 사용.
                //   원본 1장 + 이 spec만 있으면 어떤 해상도로든 패턴 재현 가능.
                pattern_spec: {
                    version: 1,
                    fabric_cm:   { w: it.orderWcm, h: it.orderHcm },     // 출력 원단 (130x100 등)
                    cell_cm:     { w: it.imgWcm,   h: it.imgHcm   },     // 한 패턴 단위 크기
                    layout:      it.layout,                              // centered / basic / halfdrop / halfbrick / mirror
                    bg_color:    it.bgColor || '#ffffff',                // 캔버스 배경 — 투명 PNG일 때 보임
                    image_scale: it.imgScale != null ? it.imgScale : 1.0, // 셀 내 이미지 비율 (1.0~0.3)
                    finish_code: it.finishCode || 'roll',                // 2026-05-11: 마감 종류 — cutline 시스템이 칼선 모양 결정
                    finish_name: it.finishName || '',                    // 마감 표시명 (작업지시서용)
                    hook_code:   it.hookCode || '',                      // 고리 옵션 (있을 때만)
                    artwork_filename: artworkName,                       // 원본 파일명 (정보 폴더의 _01.png 등)
                    artwork_url:      artworkUrl,                        // 원본 직접 다운로드 URL (Supabase Storage)
                    notes: 'See fabric_pattern.py — output: {material}/{code}_N_print.pdf (with dombo+barcode) + _cutline.ai (vector). Use --dpi 60.'
                }
            };
        });

        const fullAddr = '[' + zip + '] ' + addr1 + ' ' + addr2;
        const adminNote = '[COTTON-PRINT] 출처: cotton-print.com\n결제방법: ' + (payMethod==='bank'?'무통장입금':'카드결제(Toss)') + '\n이메일: ' + (email||'없음');

        // 2) orders 테이블에 등록 → 통합주문관리에 즉시 표시
        const orderInsertPayload = {
            order_date: new Date().toISOString(),
            manager_name: name,         // 통합주문관리에서 "고객 정보" 컬럼에 표시됨
            phone: phone,
            address: fullAddr,
            request_note: memo || '',
            status: payMethod === 'bank' ? '접수됨' : '임시작성',
            payment_status: payMethod === 'bank' ? '입금대기' : '미결제',
            payment_method: payMethod === 'bank' ? '무통장입금' : '카드',
            total_amount: total,
            discount_amount: 0,
            items: items,
            site_code: 'KR',
            files: uploadedFiles.length ? uploadedFiles : null,
            admin_note: adminNote
        };
        const { data: orderData, error: orderErr } = await sb.from('orders').insert([orderInsertPayload]).select();
        if (orderErr) throw orderErr;
        const newOrderId = orderData[0].id;

        // ★★ 2026-05-11: Google Drive 자동 동기화 — cotton-print 주문 흐름에서 누락되어 있던 트리거.
        //   무통장(status=접수됨) → 폴더 즉시 생성. 카드(status=임시작성) → Edge Function이 알아서 스킵하고
        //   결제 완료 시 confirm-payment / success.html 트리거가 재호출하므로 멱등성 보장됨.
        try {
            sb.functions.invoke('sync-order-to-drive', { body: { order_id: newOrderId } })
                .then(function(r){
                    if (r && r.error) console.warn('[drive sync] failed:', r.error.message || r.error);
                    else console.log('[drive sync]', r && r.data && (r.data.customer_folder_url || r.data.skipped) || r);
                })
                .catch(function(e){ console.warn('[drive sync] enqueue failed:', e && e.message || e); });
        } catch(e) { console.warn('[drive sync] try failed:', e && e.message || e); }

        // 3) 결제 분기 — 언어별 PG 자동 분기
        if (payMethod === 'card') {
            saveCart([]);
            window._cpUpdateCartUI();
            var lang = window.__CD_LANG || 'ko';
            if (lang === 'ko') {
                // 한국: Toss (cafe2626.com 등록 도메인)
                location.href = 'https://www.cafe2626.com/cotton_checkout.html?order_id=' + newOrderId;
            } else {
                // 해외 (JP/EN): Stripe Checkout
                location.href = '/cotton_stripe_checkout.html?order_id=' + newOrderId + '&lang=' + lang;
            }
            return;
        }

        // 4) 무통장입금: 예쁜 모달로 안내
        saveCart([]);
        window._cpUpdateCartUI();
        window._cpCloseCheckout();
        window._cpCartClose();
        // 폼 초기화
        ['coName','coPhone','coEmail','coZip','coAddr1','coAddr2','coMemo'].forEach(function(id){ const e=document.getElementById(id); if(e) e.value=''; });
        // 입금 안내 모달 표시
        document.getElementById('biOrderId').textContent = '#' + newOrderId;
        document.getElementById('biAmount').textContent = cdFmtPrice(total);
        document.getElementById('bankInfoOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } catch(e) {
        alert('주문 처리 실패: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
};

// ────────────────────────────────────────────────
// (구) 주문 → 메인몰 리다이렉트 (디자이너 패턴 자동로드 시 사용 가능)
// ────────────────────────────────────────────────
window._cdSubmitOrder = async function() {
    if (!state.img || !state.imgDataUrl) { showToast(window.cdT?window.cdT("alert_no_image"):"먼저 이미지를 업로드해주세요"); return; }

    const f = getFabric();
    if (!f) { showToast(window.cdT?window.cdT("alert_no_fabric"):"원단을 선택해주세요"); return; }

    const orderBtn = document.getElementById('orderBtn');
    const originalText = orderBtn.innerHTML;
    orderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> &nbsp;업로드 중...';
    orderBtn.disabled = true;

    try {
        // Supabase 클라이언트
        const sb = window.supabase ? window.supabase.createClient(
            'https://qinvtnhiidtmrzosyvys.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
        ) : null;
        if (!sb) throw new Error('서버 연결 실패');

        // base64 → blob
        const b64 = state.imgDataUrl.split(',')[1];
        const byteChars = atob(b64);
        const byteArrays = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArrays[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArrays], { type: 'image/png' });

        // 업로드 (Supabase Storage: orders 버킷의 cotton-print 폴더)
        const ts = Date.now(); const rnd = Math.random().toString(36).substring(2, 8);
        const ext = (state.imgFileName.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '');
        const path = `cotton-print/${ts}_${rnd}.${ext}`;
        const { error: upErr } = await sb.storage.from('orders').upload(path, blob);
        if (upErr) throw upErr;
        const { data: pubData } = sb.storage.from('orders').getPublicUrl(path);
        const fileUrl = pubData.publicUrl;

        // 디자이너 패턴인 경우 — 판매시 10% 적립을 위해 royalty 레코드 prepare
        if (state.designerPatternId) {
            try {
                // pattern_royalties 테이블에 pending 레코드 생성 (주문 확정 시 어드민이 paid 처리)
                await sb.from('pattern_royalties').insert({
                    pattern_id: state.designerPatternId,
                    designer_name: state.designerName || null,
                    fabric_code: f.code,
                    qty: state.qty === 'custom' ? state.customQty : state.qty,
                    img_w_cm: state.imgWcm,
                    img_h_cm: state.imgHcm,
                    royalty_rate: 0.10,  // 10% 적립
                    status: 'pending',
                    source: 'cotton-print.com'
                });
            } catch(rErr) { console.warn('royalty record failed:', rErr); }
        }

        // 카멜레온 메인몰 장바구니로 이동 — URL 파라미터로 전달
        const params = new URLSearchParams({
            product: f.code,
            cotton_design: fileUrl,
            cotton_pattern: state.layout,
            cotton_img_w: state.imgWcm,
            cotton_img_h: state.imgHcm,
            cotton_qty: state.qty === 'custom' ? state.customQty : state.qty
        });
        if (state.designerPatternId) {
            params.set('designer_pattern_id', state.designerPatternId);
            if (state.designerName) params.set('designer_name', state.designerName);
        }
        const url = 'https://www.cafe2626.com/?' + params.toString();
        showToast('업로드 완료! 장바구니로 이동합니다...');
        setTimeout(() => { location.href = url; }, 800);
    } catch (e) {
        console.error('[cd-order] error', e);
        showToast('업로드 실패: ' + (e.message || '알 수 없는 오류'));
        orderBtn.innerHTML = originalText;
        orderBtn.disabled = false;
    }
};

// ────────────────────────────────────────────────
// 토스트
// ────────────────────────────────────────────────
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(window._cdToastT);
    window._cdToastT = setTimeout(() => t.style.display = 'none', 3000);
}

// ────────────────────────────────────────────────
// URL ?pattern=ID 자동 로드 (디자이너 마켓플레이스에서 진입)
// ────────────────────────────────────────────────
async function autoLoadPatternFromUrl() {
    const params = new URLSearchParams(location.search);
    const patternId = params.get('pattern');
    if (!patternId) return;

    if (typeof window.supabase === 'undefined') {
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (typeof window.supabase !== 'undefined') break;
        }
    }
    if (typeof window.supabase === 'undefined') return;

    const sb = window.supabase.createClient(
        'https://qinvtnhiidtmrzosyvys.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y'
    );

    try {
        const { data, error } = await sb.from('user_patterns').select('*').eq('id', patternId).single();
        if (error || !data) return;

        // 2026-05-11: 미리보기 선명도 — 원본 URL 우선 (썸네일은 폴백)
        //   썸네일은 Supabase image transform으로 작게 리사이즈된 저해상도라 큰 캔버스에서 깨져 보임.
        const url = data.original_url || data.thumb_url;
        if (!url) return;

        showToast('🎨 디자이너 패턴 "' + (data.name || '') + '" 로드 중...');

        // CORS 우회: fetch → blob → DataURL
        const resp = await fetch(url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = function(e) {
            state.imgDataUrl = e.target.result;
            state.imgFileName = (data.name || 'pattern') + '.jpg';
            const img = new Image();
            img.onload = function() {
                state.img = img;
                state.designerPatternId = patternId;
                state.designerName = data.author || null;
                state.designerOriginalUrl = data.original_url || null;
                const ratio = img.width / img.height;
                state.imgWcm = 10;
                state.imgHcm = Math.round(10 / ratio * 10) / 10;
                document.getElementById('imgWcm').value = state.imgWcm;
                document.getElementById('imgHcm').value = state.imgHcm;
                document.getElementById('uploadZone').style.display = 'none';
                document.getElementById('previewArea').classList.add('active');
                document.getElementById('btnReset').style.display = '';
                document.getElementById('btnReplace').style.display = '';
                // 2026-05-11: 마켓 자동로드 시에도 이미지 축소 버튼 표시 (직접 업로드와 동일)
                const _bs = document.getElementById('btnShrink'); if (_bs) _bs.style.display = '';
                document.getElementById('orderBtn').disabled = false;
                const _bn = document.getElementById('buyNowBtn'); if (_bn) _bn.disabled = false;

                // 2026-05-11: 디자이너 패턴 배지 제거 (사용자 요청 — 캔버스 위에 떠있는 둥근 라벨이 거슬림)
                // 패턴 이름은 캔버스 헤더 영역에 자연스럽게 노출되도록 별도 처리하거나 그냥 토스트로만 안내.

                window._cdRender();
                showToast('✅ 패턴 로드 완료! 원단을 선택하고 사이즈를 조정해보세요.');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.error('[autoLoadPattern] error:', e);
    }
}

// ────────────────────────────────────────────────
// 초기화
// ────────────────────────────────────────────────
// DB에서 원단/마감 옵션 로드 후 첫 그룹 자동 선택
loadDbFabrics().then(() => {
    updateSizeLabels();
    updatePrice();
    renderFinishOptions(); // 마감/고리/부자재 가격 라벨 동적 갱신 (언어/통화)
    updateFabricDetail(); // 원단 상세 텍스트도 새로 적용
    if (window._cdCalcHoebae) window._cdCalcHoebae();
});
// i18n 적용 후 한 번 더 (ui i18n 적용된 후 가격 라벨 다시)
// 2026-05-11: _cdOnFinishChange도 호출 — state.finishName을 번역된 텍스트로 동기화
setTimeout(function(){
    renderFinishOptions();
    updateFabricDetail();
    if (window._cdOnFinishChange) window._cdOnFinishChange();
    updatePrice();
}, 200);
autoLoadPatternFromUrl();
if (window._cpUpdateCartUI) window._cpUpdateCartUI();

// 2026-05-11: 창 크기 변경 시 캔버스/줄자 재렌더 (모바일 회전 대응)
let _cdResizeT = null;
window.addEventListener('resize', function(){
    if (!state.img) return;
    clearTimeout(_cdResizeT);
    _cdResizeT = setTimeout(function(){ window._cdRender(); }, 120);
});

// 2026-05-13: 스크립트 로드 전에 사용자가 누른 버튼/업로드 이벤트 (cotton_designer.html 의
// 인라인 스텁이 대기열에 쌓아둔 것) 을 비움 → 첫 클릭이 무시되지 않도록
try { if (typeof window.__cdFlushPending === 'function') window.__cdFlushPending(); } catch (e) {}

})();
