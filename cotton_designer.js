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
const HOEBAE_UNIT_PRICE = 15000;
const HOEBAE_AREA_CM2 = 100 * 100; // 1 m² = 10,000 cm²
const ROLL_MAX_WIDTH_CM = 130;     // 대폭 한계 — 초과 시 이어박기
const SEAM_EXTRA_KRW = 10000;      // 이어박기 추가비 (130cm 초과 시, 1회 부과)
const HALF_HOEBAE_PRICE = 8000;    // 반마(0.5회배 이하) 특가

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
function getVolumeDiscount(qty) {
    if (qty >= 100) return { pct: 30, label: '100+ 30%↓' };
    if (qty >= 50)  return { pct: 20, label: '50+ 20%↓' };
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

// 상태
const state = {
    fabricType: 'cotton20',           // 8종 중 1
    fabricColor: 'white',             // 면 종류일 때만 사용
    fabricCode: 'cotton20_white',     // 합성 코드 (orders.items 저장용)
    layout: 'basic',
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
    // 2026-05-12: 업로드 제한 — PDF/PNG/JPG 만, 10MB 이하
    const name = (file.name || '').toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    const isPng = name.endsWith('.png') || file.type === 'image/png';
    const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg') || file.type === 'image/jpeg';
    if (!(isPdf || isPng || isJpg)) {
        showToast(window.cdT ? window.cdT('upload_bad_type')
                  : 'PDF · PNG · JPG 파일만 업로드 가능합니다.');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast(window.cdT ? window.cdT('upload_too_big')
                  : '10MB를 초과합니다. 더 작은 파일로 업로드해주세요.');
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
            state.imgWcm = 10;
            state.imgHcm = Math.round(10 / state.imgAspect * 10) / 10;
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
    state.layout = name;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.toggle('active', el.dataset.layout === name));
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
    state.orderWcm = w; state.orderHcm = h; state.orderQty = q;
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
            tierEl.textContent = window.cdT ? window.cdT('tier_half_notice') : '🎉 0.5회배(반마) 이하는 8,000원 특가';
        } else if (tier === 'min') {
            tierEl.style.display = '';
            tierEl.dataset.cdi18n = 'tier_min_notice';
            tierEl.textContent = window.cdT ? window.cdT('tier_min_notice') : 'ℹ️ 1회배 미만은 1회배(15,000원)로 청구됩니다';
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
    state.accName = label.dataset.name || (state.accCode ? label.querySelector('b').textContent : '');
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
// 🛒 cotton-print 자체 장바구니 (localStorage)
// ════════════════════════════════════════════════
const CART_KEY = 'cp_cart_v1';
function getCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e) { return []; } }
function saveCart(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch(e){} }

function calcCartTotal() {
    return getCart().reduce(function(s, it) { return s + (it.price || 0); }, 0);
}

window._cpUpdateCartUI = function() {
    const cart = getCart();
    const badge = document.getElementById('cartBadge');
    const inline = document.getElementById('cartCountInline');
    const body = document.getElementById('cartBody');
    const totalAmt = document.getElementById('cartTotalAmt');
    const checkoutBtn = document.getElementById('cartCheckoutBtn');

    if (badge) {
        if (cart.length > 0) { badge.style.display = 'flex'; badge.textContent = cart.length; }
        else { badge.style.display = 'none'; }
    }
    if (inline) inline.textContent = cart.length ? '(' + cart.length + ')' : '';
    if (totalAmt) totalAmt.textContent = cdFmtPrice(calcCartTotal());
    if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;

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
        if (cart.length === 0) {
            body.innerHTML = '<div class="cart-empty"><i class="fa-regular fa-folder-open"></i><div style="font-weight:700; color:var(--brown-dark); margin-bottom:4px;">' + L.empty + '</div><div style="font-size:12px;">' + L.empty_sub + '</div></div>';
        } else {
            body.innerHTML = cart.map(function(it, i) {
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
    }
};

window._cpCartOpen = function() {
    document.getElementById('cartOverlay').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
    window._cpUpdateCartUI();
};
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
        addedAt: new Date().toISOString()
    };
}

window._cdAddToCart = function() {
    // 2026-05-12: UX 개선 — 파일 없이 클릭 시 그냥 카트 드로어 열기 (기존 카트 확인용)
    if (!state.img || !state.imgDataUrl) {
        if (window._cpCartOpen) window._cpCartOpen();
        return;
    }
    const item = buildCartItem();
    if (!item) return;
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    showToast('장바구니에 담았습니다 (' + cart.length + '개)');
    setTimeout(window._cpCartOpen, 400);
};

window._cdBuyNow = function() {
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
    // 통과 — cart에 추가 후 즉시 체크아웃
    cart.push(item);
    saveCart(cart);
    window._cpUpdateCartUI();
    window._cpOpenCheckout();
};

// 2026-05-12: 최소주문금액 검증 — 패브릭 주문 100,000원 이상 (KR), JP 사이트는 면제(홍보)
const MIN_ORDER_KRW = 100000;
function checkMinOrderAmount(total_krw) {
    var lang = window.__CD_LANG || 'ko';
    if (lang === 'ja') return true;   // JP 홍보 기간 — 제한 없음
    if (total_krw < MIN_ORDER_KRW) {
        var msg = (window.cdT && window.cdT('min_order_block')) ||
                  '패브릭 주문은 최소 10만원부터 가능합니다.';
        if (typeof window.alert === 'function') window.alert(msg);
        return false;
    }
    return true;
}

window._cpOpenCheckout = function() {
    const cart = getCart();
    if (cart.length === 0) return;
    // 2026-05-12: 최소주문금액 검증 (장바구니 합계 기준)
    if (!checkMinOrderAmount(calcCartTotal())) return;
    // 요약 렌더
    const list = document.getElementById('coItemList');
    list.innerHTML = cart.map(function(it){
        const parts = [it.fabricName, '출력 ' + (it.orderSize||''), it.qtyLabel, '마감: '+(it.finishName||'가재단')];
        if (it.hookCode) parts.push('고리: '+it.hookName);
        if (it.accCode) parts.push('부자재: '+it.accName);
        const opts = parts.filter(Boolean).join(' · ');
        return '<div class="co-summary-item"><div class="co-summary-item-name">' + it.title + '</div><div class="co-summary-item-opts">' + opts + '</div><div class="co-summary-item-price">' + cdFmtPrice(it.price) + '</div></div>';
    }).join('');
    document.getElementById('coTotalAmt').textContent = cdFmtPrice(calcCartTotal());
    document.getElementById('checkoutOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
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
        const uploadedFiles = [];
        for (let i = 0; i < cart.length; i++) {
            const it = cart[i];
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
            var artworkUrl = null, artworkName = null;
            if (it.imgDataUrl && uploadedFiles[idx]) {
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

})();
