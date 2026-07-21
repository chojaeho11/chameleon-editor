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
// 2026-06-01: 사용자 요청 — 회배당 12000원 / 반마 8000원으로 인상
const HOEBAE_UNIT_PRICE = 12000;
const HOEBAE_AREA_CM2 = 100 * 100; // 1 m² = 10,000 cm²
const ROLL_MAX_WIDTH_CM = 130;     // 대폭 한계 — 초과 시 이어박기
const SEAM_EXTRA_KRW = 10000;      // 이어박기 추가비 (130cm 초과 시, 1회 부과)
const HALF_HOEBAE_PRICE = 8000;    // 반마(0.5회배 이하) 특가 — 2026-06-01: 6000→8000

// 2026-05-23: 화면 표시·입력은 mm, 내부 계산·저장은 cm 그대로 유지 (가격 100% 동일).
//   경계(입력 읽기 / 입력 쓰기 / 라벨)에서만 변환한다. cm↔mm.
function _cdMm(cm) { return Math.round((parseFloat(cm) || 0) * 10); }   // cm → mm (표시용 정수)
function _cdCm(mm) { return (parseFloat(mm) || 0) / 10; }               // mm → cm (내부 계산)

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
    linen:    { name: '린넨', name_ja:'リネン', name_en:'Linen', isCotton: false, desc: '천연 린넨. 고급 인테리어·식탁보·앞치마.', desc_ja:'天然リネン。高級インテリア・テーブルクロス・エプロン。', desc_en:'Natural linen. Premium interiors, tablecloths, aprons.' },
    // 2026-06-18 v588: 오간자 추가
    organza:  { name: '오간자', name_ja:'オーガンザ', name_en:'Organza', isCotton: false, desc: '얇고 빳빳한 오간자. 행사·디스플레이·웨딩 장식용.', desc_ja:'薄くハリのあるオーガンザ。イベント・ディスプレイ・ウェディング装飾向け。', desc_en:'Sheer crisp organza. Events, displays, wedding decor.' }
};
// 현재 언어로 원단 이름/설명 꺼내기
function pickFabricName(f){ var L = window.__CD_LANG||'ko'; if (L==='ja' && f.name_ja) return f.name_ja; if (L==='en' && f.name_en) return f.name_en; return f.name; }
function pickFabricDesc(f){ var L = window.__CD_LANG||'ko'; if (L==='ja' && f.desc_ja) return f.desc_ja; if (L==='en' && f.desc_en) return f.desc_en; return f.desc; }
const COLOR_LABELS = { white: '화이트', natural: '네츄럴', ivory: '백아이보리' };

// 2026-05-22: 패브릭 주문 site_code — 언어/호스트 기준 (이전엔 'KR' 하드코딩 → JP/US 패브릭 주문이 한국으로 잡힘)
function _cpSiteCode(){
    var l = (window.__CD_LANG || '').toLowerCase();
    if (l === 'ja' || l === 'jp') return 'JP';
    if (l === 'en' || l === 'us') return 'US';
    var h = (location.hostname || '').toLowerCase();
    if (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer') >= 0) return 'JP';
    if (h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return 'US';
    return 'KR';
}

// 대량 할인 정책 (수량 기준).
// 2026-05-31: 사용자 요청 — 패브릭포스터 100장+ / 패턴 원단 100마+ → 모두 50%.
// 두 layout 모두 state.orderQty 가 동일 단위(장/마)로 쓰여서 단일 조건으로 처리 가능.
function getVolumeDiscount(qty) {
    if (qty >= 100) return { pct: 50, label: '100+ 50%↓' };
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
// 2026-06-18 v597: __accessory__ 는 admin 에서 mate 접두사로 등록된 패브릭 전용 부자재만 인정.
//   이전엔 name 의 단순 키워드(봉/링/재단)로 분류해서 '봉투', '키링', '봉투 씰' 같은 무관한 상품까지 부자재로 끌려와 카드에 노출됨.
function classifyGroup(p) {
    const n = (p.name || '').toLowerCase();
    const c = (p.code || '');
    // 패브릭 부자재 — admin 등록 mate 접두사 코드 (mate10001 ~ mate30001 등)
    if (/^mate\d/i.test(c)) return '__accessory__';
    // 고리 부자재 (고리/아일릿/후크/걸이만)
    if (/^고리|\s고리|아일릿|후크|걸이|hook|eyelet/.test(n)) return '__hook__';
    if (/광목|면\b|cotton|cb/i.test(n) || c.startsWith('cb')) return '면/광목';
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
    layout: 'centered',               // 2026-05-22: 기본 레이아웃 Centered (이미지 없이 주문 후 추후 전달 케이스 多)
    bgColor: '#ffffff',               // 캔버스 배경색 (투명 PNG 패턴용 — 2026-05-11)
    imgScale: 1.0,                    // 패턴 셀 내 이미지 비율 (1.0 = 셀 가득, 0.3 = 30%만; 2026-05-11)
    orderWcm: 130,
    orderHcm: 100,
    orderQty: 1,
    imgWcm: 10,
    imgHcm: 10,
    imgAspect: null,                  // 2026-05-22: 이미지 없을 땐 null → 출력 사이즈 1:1 잠금 해제 (자유 입력)
    img: null,
    imgDataUrl: null,
    imgFileName: '',
    // 2026-05-14: 무료 샘플북 신청 (체크 시 주문 정보에 플래그 저장)
    sampleBook: false,
    // 1) 원단 마감 (필수, 기본 롤인쇄, m²당 가격)
    // 2026-06-18 v602: 기본 마감 = 가재단 (사용자 요청 — 카드는 오버록/인터록/말아박기 3종만 노출, 미선택 시 가재단)
    finishCode: 'raw',
    finishName: '가재단',
    finishExtra: 1000,                // 단가/m² (회배 비례)
    // 2) 고리 (선택, 1회 가격)
    hookCode: '',
    hookName: '',
    hookExtra: 0,
    // 3) 부자재 (선택, 1회 가격)
    accCode: '',
    accName: '',
    accExtra: 0,
    // 4) 이어박기 (130cm 초과 시 자동 +10,000원)
    seamExtra: 0,
    // 2026-05-31: 패턴 원단 인쇄 — 롤폭/야드. 패턴 모드에서만 사용.
    rollWidth: 'wide',   // 'wide' (130cm 13000원/마) | 'narrow' (100cm 10000원/마) | 'supplied' (3000원/마)
    rollYards: 1
};
const ROLL_PRICE_PER_YARD = { wide: 13000, narrow: 10000, supplied: 3000 };
// 2026-07-16: '원단 제공'(고객이 원단을 직접 보내는 임가공, 3,000원/마) 규칙.
//   - 우리 원단(옥스포드 등) 선택 불가 → '고객 공급 원단' 고정. (기존엔 옥스포드를 고르고도 3,000원에 나감 — 주문 4740)
//   - 로스 포함 최소 10마 (샘플이라도).
const SUPPLIED_MIN_YARDS = 10;
const SUPPLIED_FABRIC_NAME = { ko: '고객 공급 원단', ja: 'お客様持込生地', en: 'Customer Supplied Fabric' };
function _cdIsSuppliedRoll() { return state.layout !== 'centered' && state.rollWidth === 'supplied'; }
function _cdRollYardsMin() { return _cdIsSuppliedRoll() ? SUPPLIED_MIN_YARDS : 1; }
// 2026-06-15: 롤폭별 출력 가로 사이즈 (cm). 패턴 모드에서 자동 적용.
//   wide(대폭)=130cm, narrow(소폭)=100cm. supplied(고객 공급)은 기존 값 유지.
const ROLL_OUTPUT_WIDTH_CM = { wide: 130, narrow: 100 };
window._cdPickRollWidth = function(w) {
    if (!ROLL_PRICE_PER_YARD[w]) return;
    state.rollWidth = w;
    document.querySelectorAll('.roll-w-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.roll === w); });
    // 2026-06-15: 패턴 모드면 출력 가로를 롤 폭에 맞춰 자동 갱신 + 캔버스 재렌더.
    //   세로는 사용자 입력값 유지 (rollYards × 100cm 로 별도 계산되므로 here 에서는 건드리지 않음).
    var isPosterMode = (state.layout === 'centered');
    if (!isPosterMode && ROLL_OUTPUT_WIDTH_CM[w]) {
        state.orderWcm = ROLL_OUTPUT_WIDTH_CM[w];
        var oW = document.getElementById('orderWcm'); if (oW) oW.value = _cdMm(state.orderWcm);
        if (typeof window._cdCalcHoebae === 'function') {
            try { window._cdCalcHoebae(); } catch (e) {}
        }
        if (typeof window._cdRender === 'function') {
            try { window._cdRender(); } catch (e) {}
        }
    }
    // 2026-07-16: 원단 제공 ↔ 우리 원단 전환 시 원단선택 잠금/해제 + 최소 마수 보정
    _cdSyncSuppliedUi();
    if (typeof updatePrice === 'function') updatePrice();
};

// 2026-07-16: '원단 제공' 이면 원단 선택을 잠그고(고객이 보내는 원단이라 우리 원단 고를 이유 없음)
//   최소 10마로 올린다. 다른 롤 폭으로 바꾸면 원상복구.
function _cdSyncSuppliedUi() {
    var sup = _cdIsSuppliedRoll();
    // 최소 마수 — 원단 제공이면 10마 미만 불가
    var _min = _cdRollYardsMin();
    if ((state.rollYards || 1) < _min) {
        state.rollYards = _min;
        var _ry = document.getElementById('rollYards'); if (_ry) _ry.value = _min;
    }
    var _ryEl = document.getElementById('rollYards'); if (_ryEl) _ryEl.min = _min;
    // 원단 선택 카드 잠금 (클릭 차단 + 흐리게)
    var _fw = document.getElementById('fabricSelectCard');
    if (_fw) {
        _fw.style.opacity = sup ? '0.45' : '';
        _fw.style.pointerEvents = sup ? 'none' : '';
    }
    var _cw = document.getElementById('fabricColorWrap');
    if (_cw && sup) _cw.style.display = 'none';
    // 안내문 표시
    var _n = document.getElementById('suppliedNotice');
    if (_n) {
        _n.style.display = sup ? '' : 'none';
        if (sup) _n.textContent = (window.cdT && window.cdT('supplied_notice')) || '고객님이 보내주신 원단에 인쇄만 진행합니다 (원단 선택 불가). 로스를 포함해 최소 10마부터 주문 가능합니다.';
    }
    if (typeof updateFabricDetail === 'function') { try { updateFabricDetail(); } catch (e) {} }
}
window._cdSyncSuppliedUi = _cdSyncSuppliedUi;

window._cdOnRollYardsInput = function() {
    var el = document.getElementById('rollYards');
    var _min = _cdRollYardsMin();
    var v = Math.max(_min, Math.min(9999, parseInt(el.value || String(_min), 10) || _min));
    state.rollYards = v;
    el.value = v;
    if (typeof updatePrice === 'function') updatePrice();
};
window._cdRollYardsChg = function(d) {
    var _min = _cdRollYardsMin();
    state.rollYards = Math.max(_min, Math.min(9999, (state.rollYards || _min) + d));
    var el = document.getElementById('rollYards'); if (el) el.value = state.rollYards;
    if (typeof updatePrice === 'function') updatePrice();
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
    // 2026-07-16: 원단 제공(임가공) — 우리 원단이 아니라 고객이 보내는 원단. 이름/코드 고정.
    //   (기존엔 옥스포드 선택 상태로 3,000원 결제 → 작업지시서에 '옥스포드'로 떠서 구분 불가)
    if (_cdIsSuppliedRoll()) {
        var _sl = window.__CD_LANG || 'ko';
        return {
            code: 'supplied',
            name: SUPPLIED_FABRIC_NAME[_sl] || SUPPLIED_FABRIC_NAME.ko,
            desc: '',
            isCotton: false,
            type: 'supplied',
            color: null
        };
    }
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
    // 2026-05-30: 상세/리뷰 섹션도 새 fabricType 기준으로 갱신
    if (typeof window._cdRefreshDetailAndReviews === 'function') window._cdRefreshDetailAndReviews();
};

window._cdSelectColor = function(color, btn) {
    state.fabricColor = color;
    const t = FABRIC_TYPES[state.fabricType] || FABRIC_TYPES.cotton20;
    if (t.isCotton) state.fabricCode = state.fabricType + '_' + color;
    document.querySelectorAll('.color-chip').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateFabricDetail();
    updatePrice();
    // 2026-05-30: 색상 변경 시 리뷰만 갱신 (대분류 상세는 색상 무관 — common_info 호출 절감)
    if (t.isCotton && typeof window._cdRefreshDetailAndReviews === 'function') {
        // 상세는 동일 — write form / flag bar 도 동일. 리뷰만 새 코드로 다시 로드.
        const code = _cdMapFabricToCode(state.fabricType, color);
        if (code && code !== window._cdRvState.productCode) {
            window._cdRvState.productCode = code;
            window._cdRvState.page = 0;
            // 2026-06-04: 색상 변경 시에도 사이트 언어 기준으로 필터 유지
            window._cdRvState.filterLang = (typeof _cdDefaultRvLang === 'function') ? _cdDefaultRvLang() : 'all';
            loadFabricReviews(code, 0);
        }
    }
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
    // 2026-06-01: 사이드바 인라인 업로드 카드의 파일 정보 표시 (좌측 미리보기와 함께)
    try {
        var _sui = document.getElementById('sideUploadInfo');
        if (_sui) {
            var _mb = (file.size / 1024 / 1024).toFixed(1);
            _sui.style.display = 'block';
            _sui.textContent = file.name + ' (' + _mb + 'MB) ✓';
        }
    } catch(e) {}

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
            // 2026-06-15: 업로드 직전, 시각적 active 상태를 신뢰 — posterBtn 이 active 면 무조건 centered 로 보정.
            //   사용자가 패턴 토글을 누른 적이 있더라도, 현재 화면이 패브릭포스터로 보이면 그것이 의도.
            try {
                var _pbA = document.getElementById('posterBtn');
                if (_pbA && _pbA.classList && _pbA.classList.contains('active')) state.layout = 'centered';
            } catch(e) {}
            // 2026-05-14: layout=='centered' (패브릭포스터) 일 때 — 실제 파일 픽셀 사이즈를
            //   96 DPI 기준으로 cm 환산, 원단폭 130cm 초과하면 비율 유지하며 축소.
            //   그리고 출력 사이즈(orderWcm/Hcm) 도 이미지 사이즈와 동일하게 맞춰서 "꽉차게" 표시.
            if (state.layout === 'centered') {
                // 2026-06-15: 포스터 모드 — 이미지의 px 자연 사이즈를 mm 로 1:1 매핑 (1 px = 1 mm).
                //   사용자 의도: 1000×2000 px 이미지 → 1000×2000 mm 대지 (자연 크기). 이후 가로/세로 input 으로
                //   사용자가 변경하면 비율 유지로 다른 값 자동 계산 (기존 _cdCalcHoebae 가 처리).
                const wCmP = img.width / 10;   // px → mm → cm (1 px = 0.1 cm)
                const hCmP = img.height / 10;
                state.imgWcm = Math.round(wCmP * 10) / 10;
                state.imgHcm = Math.round(hCmP * 10) / 10;
                state.orderWcm = state.imgWcm;
                state.orderHcm = state.imgHcm;
                const oW = document.getElementById('orderWcm'); if (oW) oW.value = _cdMm(state.orderWcm);
                const oH = document.getElementById('orderHcm'); if (oH) oH.value = _cdMm(state.orderHcm);
                // 2026-06-12: 이미지 업로드 후 회배/가격 즉시 재계산 (안 하면 기본 1.30 표시되던 버그)
                try { if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae(); } catch(e) {}
            } else {
                state.imgWcm = 10;
                state.imgHcm = Math.round(10 / state.imgAspect * 10) / 10;
                // 2026-06-15: 패턴 모드 — 출력 사이즈를 현재 롤 폭 (대폭 130 / 소폭 100) 으로 자동 스냅 + 세로 100cm.
                //   사용자 피드백: 패턴 원단 크기가 1300 또는 1000 으로 안 맞춰지던 문제.
                if (ROLL_OUTPUT_WIDTH_CM && ROLL_OUTPUT_WIDTH_CM[state.rollWidth]) {
                    state.orderWcm = ROLL_OUTPUT_WIDTH_CM[state.rollWidth];
                    state.orderHcm = 100;
                    var _oW = document.getElementById('orderWcm'); if (_oW) _oW.value = _cdMm(state.orderWcm);
                    var _oH = document.getElementById('orderHcm'); if (_oH) _oH.value = _cdMm(state.orderHcm);
                    try { if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae(); } catch(e) {}
                }
            }
            document.getElementById('imgWcm').value = _cdMm(state.imgWcm);
            document.getElementById('imgHcm').value = _cdMm(state.imgHcm);
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
            // 2026-05-31: 사용자 요청 — 업로드 직후 출력 사이즈 입력으로 자동 스크롤.
            // 이미지 픽셀 사이즈가 그대로 적용되니 사용자가 바로 조정할 수 있게 해당 input 위치로 이동 + focus + select.
            setTimeout(function() {
                const sizeInput = document.getElementById('orderWcm');
                if (sizeInput) {
                    sizeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // mobile 키보드 자동 팝업 방지 — focus 만 주고 select 는 약간 지연
                    sizeInput.focus({ preventScroll: true });
                    try { sizeInput.select(); } catch(e) {}
                }
            }, 150);
            showToast('업로드 완료. 사이즈를 확인하세요.');
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
        // 2026-06-18 v601: 두 번에 나눠 쿼리 — 일반 SELECT * 가 mate10001~10007 을 누락하는 케이스 회피.
        //   admin_products 에 RLS 또는 페이지네이션 이슈가 있을 수 있어 mate% 코드는 별도로 명시 쿼리.
        let r2 = await sb.from('admin_products').select('*').limit(5000);
        if (r2.error) {
            console.warn('[loadDbFabrics] select * failed:', r2.error.message);
            r2 = await sb.from('admin_products').select('code, name, price, sort_order, thumb_url').limit(5000);
        }
        // mate 접두사 상품 별도 보강 — 중복은 code 로 dedupe
        try {
            var mateOnly = await sb.from('admin_products').select('*').like('code', 'mate%').limit(1000);
            if (!mateOnly.error && mateOnly.data) {
                console.log('[loadDbFabrics] mate-only query:', mateOnly.data.length);
                var existing = new Set((r2.data || []).map(function(p){ return p.code; }));
                mateOnly.data.forEach(function(p){
                    if (!existing.has(p.code)) {
                        r2.data = r2.data || [];
                        r2.data.push(p);
                        existing.add(p.code);
                    }
                });
            } else if (mateOnly.error) {
                console.warn('[loadDbFabrics] mate query failed:', mateOnly.error.message);
            }
        } catch(e){ console.warn('[loadDbFabrics] mate query:', e); }
        if (r2.error) return;
        let products = r2.data || [];
        console.log('[loadDbFabrics] admin_products:', products.length);

        // 2026-06-18 v600: admin_addons 에서도 옵션 항목 가져와 합치기 (가재단/오버록 등은 admin_addons 에 등록됨)
        try {
            var r3 = await sb.from('admin_addons').select('*').limit(5000);
            if (!r3.error && r3.data) {
                console.log('[loadDbFabrics] admin_addons:', r3.data.length);
                // admin_addons 항목을 products 풀에 추가 (이름 기준 매칭용)
                products = products.concat(r3.data);
            } else if (r3.error) {
                console.warn('[loadDbFabrics] admin_addons fetch failed:', r3.error.message);
            }
        } catch(e){ console.warn('[loadDbFabrics] admin_addons:', e); }

        // 2026-06-18 v600: mate 코드 진단 — 9개 다 잡히는지 확인
        var mateItems = products.filter(function(p){ return /^mate/i.test(p.code||''); });
        console.log('[loadDbFabrics] mate items found:', mateItems.length);
        mateItems.forEach(function(p){ console.log('[loadDbFabrics] mate:', p.code, p.name, 'thumb:', !!_cdGetThumb(p)); });

        if (products.length) {
            console.log('[loadDbFabrics] sample keys:', Object.keys(products[0]).join(','));
        }
        // 2026-06-18 v603: 사용자 요청 — 압축봉 60-110cm (mate10006) 노출 제외
        var EXCLUDE_CODES = new Set(['mate10006']);
        const classified = products
            .filter(p => !(p.code||'').startsWith('ua_'))
            .filter(p => !EXCLUDE_CODES.has(p.code))
            .sort((a,b) => (a.sort_order||999) - (b.sort_order||999))
            .map(p => Object.assign(p, { group: classifyGroup(p) }));

        DB_ACCESSORIES = classified.filter(p => p.group === '__accessory__');
        console.log('[loadDbFabrics] DB_ACCESSORIES:', DB_ACCESSORIES.length, 'codes:', DB_ACCESSORIES.map(p=>p.code).join(','));
        renderAccessoryOptions();
        try { _cdApplyFinOptImages(classified); } catch(e){ console.warn('[fin-opt img]', e); }
        try { _cdApplyFabricChipFromAdmin(classified); } catch(e){ console.warn('[fabric chip admin]', e); }
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

// 언어별 admin_products 이름 선택 — admin_products 스키마는 name 하나만 (name_kr/name_en 미존재).
//   name_jp/name_us 가 있으면 그것 우선 사용.
function pickProductName(p) {
    var lang = window.__CD_LANG || 'ko';
    if (lang === 'ja') return p.name_jp || p.name || '';
    if (lang === 'en') return p.name_us || p.name || '';
    return p.name || '';
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
    linen:    { bg: 'linear-gradient(135deg,#ede4d3 0%,#d4c5a0 100%)', icon: 'fa-leaf',          accent: '#5b3a1a' },
    organza:  { bg: 'linear-gradient(135deg,#fdf4ff 0%,#fae8ff 100%)', icon: 'fa-snowflake',     accent: '#86198f' }
};
const COTTON_COLOR_BG = { white: '#ffffff', natural: '#e7d8b8', ivory: '#f5ecd3' };

// 2026-05-22: 원단 실사진 (있으면 스왓치 대신 사진 표시). /fabric/ 폴더에 업로드하면 자동 노출.
//   파일이 없거나 로드 실패하면 기존 색+아이콘 스왓치로 자동 폴백.
const FABRIC_PHOTO = {
    cotton20: '/fabric/cotton20.jpg',
    cotton30: '/fabric/cotton30.jpg',
    cotton16: '/fabric/cotton16.jpg',
    cotton10: '/fabric/cotton10.jpg',
    chiffon:  '/fabric/chiffon.jpg',
    oxford:   '/fabric/oxford.jpg',
    rayon:    '/fabric/rayon.jpg',
    linen:    '/fabric/linen.jpg',
    organza:  '/fabric/organza.jpg'
};
// 상세 카드 스왓치(색+아이콘) 렌더 — 사진이 없거나 로드 실패 시 폴백
function _cdSwatchFallback() {
    var img = document.getElementById('fabricImg');
    if (!img) return;
    var f = getFabric(); if (!f) return;
    var sw = FABRIC_SWATCH[state.fabricType] || {};
    var bg = f.isCotton ? (COTTON_COLOR_BG[state.fabricColor] || '#ffffff') : (sw.bg || '#f5f5f4');
    img.style.background = bg;
    img.style.border = '1px solid #d6d3d1';
    img.style.display = 'flex';
    img.style.alignItems = 'center';
    img.style.justifyContent = 'center';
    img.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.05)';
    img.style.overflow = 'hidden';
    img.innerHTML = '<i class="fa-solid ' + (sw.icon || 'fa-scroll') + '" style="font-size:28px; color:' + (sw.accent || '#78350f') + '; opacity:0.55;"></i>';
}
window._cdSwatchFallback = _cdSwatchFallback;
// 원단 칩(둥근 버튼)에 실사진 썸네일 — 사진이 로드되면 아이콘 대신 표시, 실패하면 아이콘 유지
function _cdApplyFabricChipPhotos() {
    document.querySelectorAll('.fabric-type[data-fab]').forEach(function (chip) {
        var photo = FABRIC_PHOTO[chip.dataset.fab];
        if (!photo) return;
        var iconWrap = chip.querySelector('.fabric-type-icon');
        if (!iconWrap) return;
        var im = new Image();
        im.onload = function () {
            // 2026-06-12: 네모난 카드 — 칩 내부를 가득 채우는 큰 사각 이미지
            iconWrap.innerHTML = '<img src="' + photo + '" alt="" style="width:100%; height:100%; border-radius:6px; object-fit:cover; display:block;">';
        };
        im.src = photo;
    });
}
window._cdApplyFabricChipPhotos = _cdApplyFabricChipPhotos;

// 2026-06-18 v595: 원단 칩 폴백 — admin_products 의 name 으로 매칭해 fabric-type 아이콘 박스에 썸네일 삽입.
//   /fabric/*.jpg 파일이 없는 원단(예: 오간자) 도 admin 에 등록만 하면 자동 노출.
function _cdApplyFabricChipFromAdmin(adminItems) {
    if (!adminItems || !adminItems.length) return;
    // data-fab 별 매칭 키워드 (Korean substring)
    var KEYWORDS = {
        cotton20: ['면20수', '20수', 'cotton20', '면 20'],
        cotton30: ['면30수', '30수', 'cotton30'],
        cotton16: ['면16수', '16수', 'cotton16'],
        cotton10: ['면10수', '10수', 'cotton10'],
        chiffon:  ['쉬폰', 'chiffon'],
        oxford:   ['옥스포드', 'oxford'],
        rayon:    ['레이온', '인견', 'rayon'],
        linen:    ['린넨', '리넨', 'linen'],
        organza:  ['오간자', 'オーガンザ', 'organza']
    };
    // 2026-06-18 v601: pool 에서 thumb 사전 필터 제거 — name 으로만 매칭하고 매칭 후 thumb 체크.
    var pool = adminItems.filter(function(a){ return (a.name||'').trim(); });
    document.querySelectorAll('.fabric-type[data-fab]').forEach(function(chip){
        var fab = chip.dataset.fab;
        var iconWrap = chip.querySelector('.fabric-type-icon');
        if (!iconWrap) return;
        if (iconWrap.querySelector('img')) return;
        var kws = KEYWORDS[fab] || [];
        if (!kws.length) return;
        var match = null;
        for (var i = 0; i < pool.length; i++) {
            var n = (pool[i].name || '').toLowerCase();
            for (var j = 0; j < kws.length; j++) {
                if (n.indexOf(kws[j].toLowerCase()) >= 0) { match = pool[i]; break; }
            }
            if (match) break;
        }
        if (!match) { console.log('[fabric chip admin]', fab, 'no match'); return; }
        var thumb = _cdGetThumb(match);
        if (!thumb) { console.log('[fabric chip admin]', fab, '←', match.name, '(matched but no thumb)'); return; }
        iconWrap.innerHTML = '<img src="' + thumb + '" alt="" style="width:100%; height:100%; border-radius:6px; object-fit:cover; display:block;">';
        console.log('[fabric chip admin]', fab, '←', match.name);
    });
}
window._cdApplyFabricChipFromAdmin = _cdApplyFabricChipFromAdmin;

// 2026-06-18 v590: 하드코딩 옵션 카드(.fin-opt) 에 admin_products 의 썸네일을 매칭해 삽입.
//   매칭 규칙: 첫 2 한글자 일치 (예: "실색상 변경" ↔ "실색변경" 모두 "실색" 으로 매칭).
//   이미지 필드: thumb_url / image_url / img_url 순서로 폴백.
function _cdGetThumb(p) {
    if (!p) return '';
    // 2026-06-18 v598: 모든 가능한 이미지 필드 + 첫 mockup/images 배열 폴백
    var direct = p.thumb_url || p.image_url || p.img_url || p.image || p.image_kr || p.photo || p.photo_url || p.thumbnail_url || p.main_image || p.cover_image || '';
    if (direct) return direct;
    // mockups / images 배열 첫 번째
    if (Array.isArray(p.mockups) && p.mockups.length) return p.mockups[0].url || p.mockups[0] || '';
    if (Array.isArray(p.images) && p.images.length) return p.images[0].url || p.images[0] || '';
    return '';
}
// 2026-06-18 v594: 매칭 — 공통 한글 bigram 비율(점수)으로 best-match. 50% 이상만 채택.
//   "오버록" vs "오버록" admin → 2/2 = 100% ✓
//   "노랜연결마감" vs "목봉마감" → 1/3 = 33% ✗ 거부 (이전 v592 는 1개만 있으면 통과해서 잘못 매칭됐음)
//   "실색상 변경" vs "실색변경" → 정규화 후 [실색,색상,상변,변경] vs [실색,색변,변경] → 공통 3/3 = 100% ✓
function _normKr(s) {
    return (s||'').replace(/[\s·\-()（）/_,\.\d]/g, '');
}
function _krBigrams(s) {
    var n = _normKr(s);
    var out = [];
    for (var i = 0; i <= n.length - 2; i++) {
        var sub = n.substring(i, i + 2);
        if (/^[가-힣]{2}$/.test(sub)) out.push(sub);
    }
    return out;
}
function _bigramScore(a, b) {
    var ba = _krBigrams(a), bb = _krBigrams(b);
    if (!ba.length || !bb.length) return 0;
    var common = 0;
    ba.forEach(function(x){ if (bb.indexOf(x) >= 0) common++; });
    return common / Math.min(ba.length, bb.length);  // 0~1
}
function _cdApplyFinOptImages(adminItems) {
    if (!adminItems || !adminItems.length) return;
    var cards = document.querySelectorAll('.fin-opt[data-name]');
    // 2026-06-18 v599: pool = name 만 있는 모든 admin (thumb 필터 제거).
    //   thumb_url 가 빈 문자열이라 pool 에서 잘려서 가재단/오버록/인터록/말아박기 모두 NONE 처리되던 회귀 수정.
    //   매칭 자체는 name 으로 하고, 매칭 성공 후에만 thumb 체크.
    var pool = adminItems.filter(function(a){ return (a.name||'').trim(); });
    console.log('[fin-opt img] === START === cards:', cards.length, 'pool:', pool.length);
    console.log('[fin-opt img] pool names:', pool.map(function(p){ return p.name; }).join(' | '));
    var applied = 0, skipExisting = 0, low = 0, none = 0, noThumb = 0;
    cards.forEach(function(card){
        var optName = card.getAttribute('data-name') || '';
        if (!optName) return;
        var bestItem = null, bestScore = 0;
        for (var i = 0; i < pool.length; i++) {
            var s = _bigramScore(optName, pool[i].name);
            if (s > bestScore) { bestScore = s; bestItem = pool[i]; }
        }
        if (card.querySelector('.fin-opt-img')) { skipExisting++; return; }
        if (!bestItem || bestScore < 0.5) {
            if (bestItem) { low++; console.log('[fin-opt img] LOW', optName, '→', bestItem.name, '(' + Math.round(bestScore*100) + '%)'); }
            else { none++; console.log('[fin-opt img] NONE', optName); }
            return;
        }
        var thumb = _cdGetThumb(bestItem);
        if (!thumb) {
            noThumb++;
            console.log('[fin-opt img] NOTHUMB', optName, '→', bestItem.name, '(매칭됐지만 admin 에 이미지 없음 — 업로드 필요)');
            return;
        }
        var img = document.createElement('img');
        img.className = 'fin-opt-img';
        img.src = thumb;
        img.alt = optName;
        img.loading = 'lazy';
        img.onerror = function(){ this.style.display = 'none'; };
        card.insertBefore(img, card.firstChild);
        applied++;
        console.log('[fin-opt img] OK', optName, '→', bestItem.name, '(' + Math.round(bestScore*100) + '%)');
    });
    console.log('[fin-opt img] === END === applied:', applied, 'skip:', skipExisting, 'low:', low, 'none:', none, 'noThumb:', noThumb, 'total:', cards.length);
}
window._cdApplyFinOptImages = _cdApplyFinOptImages;

// 2026-05-22: 원단 칩에 마우스 호버 / 터치 시 특징 툴팁 (KR·JP·EN — FABRIC_TYPES 다국어 설명 사용)
function _cdInitFabricTooltips() {
    var tip = document.getElementById('cdFabricTip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'cdFabricTip';
        tip.style.cssText = 'position:fixed; z-index:100000; max-width:240px; background:#1f2937; color:#fff; padding:10px 12px; border-radius:10px; font-size:12px; line-height:1.55; box-shadow:0 8px 24px rgba(0,0,0,0.3); pointer-events:none; opacity:0; transition:opacity .15s; display:none;';
        document.body.appendChild(tip);
    }
    function showTip(chip) {
        var f = FABRIC_TYPES[chip.dataset.fab];
        if (!f) return;
        tip.innerHTML = '<div style="font-weight:800; margin-bottom:3px;">' + pickFabricName(f) + '</div><div style="opacity:0.92;">' + pickFabricDesc(f) + '</div>';
        tip.style.display = 'block';
        var r = chip.getBoundingClientRect();
        var tw = tip.offsetWidth, th = tip.offsetHeight;
        var left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
        var top = r.top - th - 10;
        if (top < 8) top = r.bottom + 10; // 위 공간 없으면 아래로
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        requestAnimationFrame(function () { tip.style.opacity = '1'; });
    }
    function hideTip() {
        tip.style.opacity = '0';
        setTimeout(function () { if (tip.style.opacity === '0') tip.style.display = 'none'; }, 160);
    }
    document.querySelectorAll('.fabric-type[data-fab]').forEach(function (chip) {
        if (chip.__cdTipBound) return;
        chip.__cdTipBound = true;
        chip.addEventListener('mouseenter', function () { showTip(chip); });
        chip.addEventListener('mouseleave', hideTip);
        chip.addEventListener('touchstart', function () { showTip(chip); }, { passive: true });
    });
    if (!document.__cdTipDocBound) {
        document.__cdTipDocBound = true;
        document.addEventListener('touchstart', function (e) {
            if (!(e.target.closest && e.target.closest('.fabric-type[data-fab]'))) hideTip();
        }, { passive: true });
    }
}
window._cdInitFabricTooltips = _cdInitFabricTooltips;

function updateFabricDetail() {
    const f = getFabric();
    if (!f) return;
    // 2026-05-15: 색상 선택 영역 가시성 동기화 — 페이지 첫 로드 시 cotton 기본인데도 숨겨져 있던 버그 보강.
    //   기존엔 _cdSelectFabricType 안에서만 토글돼서 사용자가 한 번 클릭해야 보임.
    var _colorWrap = document.getElementById('fabricColorWrap');
    if (_colorWrap) _colorWrap.style.display = f.isCotton ? '' : 'none';
    const img = document.getElementById('fabricImg');
    if (img) {
        // 2026-05-22: 실사진 우선 — 있으면 사진, 없거나 로드 실패하면 색+아이콘 스왓치
        var photo = FABRIC_PHOTO[state.fabricType];
        if (photo) {
            img.style.background = '#f5f5f4';
            img.style.border = '1px solid #d6d3d1';
            img.style.display = 'block';
            img.style.boxShadow = 'none';
            img.style.overflow = 'hidden';
            img.innerHTML = '<img src="' + photo + '" alt="" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="window._cdSwatchFallback && window._cdSwatchFallback()">';
        } else {
            _cdSwatchFallback();
        }
    }
    // 2026-05-11: 현재 언어로 원단 이름/설명 표시 + 최대폭 라벨도 i18n
    var nm = pickFabricName(f);
    var ds = pickFabricDesc(f);
    var maxLbl = window.cdT ? (window.cdT('side_output_max') || '대폭 1300mm') : '대폭 1300mm';
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
            // 가격 표시: +0원/회배 → +0원/회배 (KR), +¥0/m² (JP), +$0/unit (EN)
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
    var w = _cdMm(state.orderWcm);   // 2026-05-23: 화면 표시는 mm
    var h = _cdMm(state.orderHcm);
    var dW = document.getElementById('dimW'); if (dW) dW.textContent = w;
    var dH = document.getElementById('dimH'); if (dH) dH.textContent = h;
    // 레거시 ID 참조 안전장치 (다른 코드에서 호출돼도 깨지지 않게)
    var top = document.getElementById('topSizeLabel'); if (top) top.textContent = w + 'mm';
    var side = document.getElementById('sideSizeLabel'); if (side) side.textContent = h + 'mm';
}

// ────────────────────────────────────────────────
// 레이아웃 선택
// ────────────────────────────────────────────────
window._cdSelectLayout = function(name) {
    const prev = state.layout;
    state.layout = name;
    document.querySelectorAll('.layout-btn').forEach(el => el.classList.toggle('active', el.dataset.layout === name));
    // 2026-05-23: 패브릭포스터(centered) = 기본 / 그 외 = 패턴 모드.
    //   패턴 모드일 때만 4개 패턴 + 배경색 + 패턴사이즈 패널 노출.
    var isPoster = (name === 'centered');
    var _pl = document.getElementById('patternLayouts'); if (_pl) _pl.style.display = isPoster ? 'none' : '';
    var _bg = document.getElementById('bgColorCard');    if (_bg) _bg.style.display = isPoster ? 'none' : '';
    var _ic = document.getElementById('imgSizeCard');    if (_ic) _ic.style.display = isPoster ? 'none' : '';
    var _pb = document.getElementById('posterBtn');      if (_pb) _pb.classList.toggle('active', isPoster);
    var _pt = document.getElementById('patternToggle');  if (_pt) _pt.classList.toggle('active', !isPoster);
    // 2026-05-31: 패턴 모드 전용 카드 = 롤폭+야드. 패턴 모드일 때만 노출.
    //   패브릭포스터에만 의미 있는 카드 (출력사이즈/마감/고리/부자재) 는 패턴 모드에서 숨김.
    var _rc = document.getElementById('rollCard');       if (_rc) _rc.style.display = isPoster ? 'none' : '';
    var _os = document.getElementById('outputSizeCard'); if (_os) _os.style.display = isPoster ? '' : 'none';
    var _fc = document.getElementById('finishCard');     if (_fc) _fc.style.display = isPoster ? '' : 'none';
    var _hc = document.getElementById('hookCard');       if (_hc) _hc.style.display = isPoster ? '' : 'none';
    var _ac = document.getElementById('accCard');        if (_ac) _ac.style.display = isPoster ? '' : 'none';
    // 2026-06-01: 패턴 모드는 rollCard 의 야드 입력을 쓰니 일반 주문수량 카드 숨김 (사용자 요청 — '주문수량 2번 나오지 않게').
    var _qc = document.getElementById('qtyCard');        if (_qc) _qc.style.display = isPoster ? '' : 'none';
    // 2026-05-14: 다른 레이아웃 → centered 전환 시 이미지 사이즈에 출력 사이즈를 맞춤 (꽉차게).
    //   이미 centered 였거나 이미지 미로드면 skip.
    if (name === 'centered' && prev !== 'centered' && state.img && state.imgAspect) {
        state.orderWcm = state.imgWcm;
        state.orderHcm = state.imgHcm;
        const oW = document.getElementById('orderWcm'); if (oW) oW.value = _cdMm(state.orderWcm);
        const oH = document.getElementById('orderHcm'); if (oH) oH.value = _cdMm(state.orderHcm);
        if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae();
    }
    // 2026-06-15: centered → 패턴 모드 전환 시 출력 사이즈를 롤 폭 (130 또는 100cm) × 100cm 로 자동 스냅.
    if (name !== 'centered' && prev === 'centered' && ROLL_OUTPUT_WIDTH_CM && ROLL_OUTPUT_WIDTH_CM[state.rollWidth]) {
        state.orderWcm = ROLL_OUTPUT_WIDTH_CM[state.rollWidth];
        state.orderHcm = 100;
        const oWp = document.getElementById('orderWcm'); if (oWp) oWp.value = _cdMm(state.orderWcm);
        const oHp = document.getElementById('orderHcm'); if (oHp) oHp.value = _cdMm(state.orderHcm);
        if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae();
    }
    // 2026-07-16: 포스터(centered) ↔ 패턴 전환 시 '원단 제공' 잠금 상태 재적용
    //   (원단 제공은 패턴 모드에서만 유효 — 포스터로 가면 원단 선택이 다시 풀려야 함)
    if (typeof _cdSyncSuppliedUi === 'function') { try { _cdSyncSuppliedUi(); } catch (e) {} }
    window._cdRender();
};

// 2026-05-23: "패턴 원단 인쇄" 클릭 → 4개 패턴 노출 + 패턴 모드 진입 (기본 패턴=basic).
//   이미 패턴 모드면 현재 패턴 유지.
window._cdEnterPatternMode = function() {
    var pl = document.getElementById('patternLayouts'); if (pl) pl.style.display = '';
    if (state.layout === 'centered') window._cdSelectLayout('basic');
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
// 2026-06-01: 출력 사이즈 input — 가로/세로 한 곳만 입력해도 다른 값은 업로드 이미지 비율(state.imgAspect)에 따라 자동 계산.
//   _cdCalcHoebae 가 centered 레이아웃 + state.imgAspect 있을 때 이미 자동 계산 로직 보유 → 그대로 위임.
window._cdOnOrderSizeInput = function(which) {
    if (typeof window._cdCalcHoebae === 'function') window._cdCalcHoebae();
};

window._cdCalcHoebae = function() {
    const wEl = document.getElementById('orderWcm');
    const hEl = document.getElementById('orderHcm');
    const qEl = document.getElementById('orderQty');
    let w = _cdCm(wEl.value) || 130;   // 2026-05-23: 입력값은 mm → 내부는 cm 로 변환
    let h = _cdCm(hEl.value) || 100;
    let q = parseInt(qEl.value) || 1;
    // 130cm 초과 허용 — 이어박기 처리 (상한 1000cm 안전장치)
    if (w > 1000) { w = 1000; wEl.value = _cdMm(1000); }
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
                hEl.value = _cdMm(h);
                _ctSyncImg = true;
            }
        } else if (h !== prevH && w === prevW) {
            // 세로만 변경 → 가로 자동
            const newW = Math.round((h * state.imgAspect) * 10) / 10;
            if (newW >= 10 && newW <= 1000) {
                w = newW;
                wEl.value = _cdMm(w);
                _ctSyncImg = true;
            }
        }
    }
    state.orderWcm = w; state.orderHcm = h; state.orderQty = q;
    // 이미지 인풋 sync — aspect 재계산이 일어났을 때만 (사용자가 image 인풋에 타이핑 중일 땐 X).
    if (_ctSyncImg) {
        state.imgWcm = w; state.imgHcm = h;
        const iW = document.getElementById('imgWcm'); if (iW && document.activeElement !== iW) iW.value = _cdMm(w);
        const iH = document.getElementById('imgHcm'); if (iH && document.activeElement !== iH) iH.value = _cdMm(h);
    }
    // 이어박기 자동 결정 — 2026-05-22: 가로·세로 둘 다 130cm 초과일 때만 (한 변이 130 이하면 돌려서 출력 가능)
    state.seamExtra = (w > ROLL_MAX_WIDTH_CM && h > ROLL_MAX_WIDTH_CM) ? SEAM_EXTRA_KRW : 0;
    const seamEl = document.getElementById('seamNotice');
    if (seamEl) seamEl.style.display = state.seamExtra > 0 ? '' : 'none';
    const rawHoebae = calcHoebae();
    const tier = getHoebaeTier();
    const itemPrice = calcItemPrice();
    var lang = window.__CD_LANG || 'ko';
    var tierLbl = '';
    if (tier === 'half') tierLbl = lang==='ja' ? ' (半マ特価)' : lang==='en' ? ' (half-meter)' : ' (반마 특가)';
    else if (tier === 'min') tierLbl = lang==='ja' ? ' (1m²適用)' : lang==='en' ? ' (1-unit min)' : ' (1회배 적용)';
    var hoebaeUnit = window.cdT ? (window.cdT('unit_hoebae') || '회배') : '회배';
    document.getElementById('hoebaeAmount').textContent = rawHoebae.toFixed(2) + ' ' + hoebaeUnit + tierLbl;
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

// 2026-06-12: 반마 기준 변경 — 가로+세로 ≤ 1500mm 이면 반마 (면적 기준 X).
//   사용자 요구: "가로 세로 합 1500mm 이하면 반마여야 하고".
function _cdIsHalfTier() {
    // state.orderWcm/Hcm 는 cm. 합산은 mm 기준이라 ×10.
    var wMm = (state.orderWcm || 0) * 10;
    var hMm = (state.orderHcm || 0) * 10;
    return (wMm + hMm) <= 1500;
}

// 회배 청구 단위 — 반마=0.5 / 0.5< x <1 은 1 / 그 이상은 실제 회배
function calcBillableHoebae() {
    if (_cdIsHalfTier()) return 0.5;
    var h = calcHoebae();
    if (h < 1) return 1;
    return h;
}

// 출력 단가 — 반마(W+H≤1500)는 8,000원 / 1배 미만은 12,000원 / 1배 이상은 회배×12,000
function calcItemPrice() {
    if (_cdIsHalfTier()) return HALF_HOEBAE_PRICE;   // 반마 특가
    var h = calcHoebae();
    if (h < 1) return HOEBAE_UNIT_PRICE;             // 1회배 미만은 1회배 가격
    return Math.round(h * HOEBAE_UNIT_PRICE);
}

// 현재 사이즈가 어느 단계인지 — 표시용 라벨
function getHoebaeTier() {
    if (_cdIsHalfTier()) return 'half';
    var h = calcHoebae();
    if (h < 1) return 'min';
    return 'full';
}

function updatePrice() {
    // 2026-05-31: 패턴 원단 인쇄 모드 — 롤 폭(단가) × 마 수, 마감/고리/부자재/회배 무시.
    if (state.layout !== 'centered') {
        const perYard = ROLL_PRICE_PER_YARD[state.rollWidth] || ROLL_PRICE_PER_YARD.wide;
        const yards = Math.max(1, state.rollYards || 1);
        const subtotal = perYard * yards;
        const disc = getVolumeDiscount(yards);
        const discountAmt = Math.round(subtotal * disc.pct / 100);
        const total = subtotal - discountAmt;

        document.getElementById('pUnit').textContent = cdFmtPrice(perYard) + ' / 1마';
        document.getElementById('pQty').textContent = yards + '마';
        const pf = document.getElementById('pFinish'); if (pf) pf.innerHTML = '';
        const dRow = document.getElementById('pDiscountRow');
        if (disc.pct > 0) {
            dRow.style.display = '';
            var bd = document.getElementById('pDiscBadge'); if (bd) bd.textContent = disc.label;
            document.getElementById('pDiscount').textContent = '-' + cdFmtPrice(discountAmt);
        } else {
            dRow.style.display = 'none';
        }
        document.getElementById('pTotal').textContent = cdFmtPrice(total);
        return;
    }

    const rawHoebae = calcHoebae();           // 표시용 (실제 비율)
    const hoebae = calcBillableHoebae();      // 청구용 회배 (반마=0.5 / 미만=1 / 그외 실제)
    const itemPrice = calcItemPrice();        // 출력 단가 (반마 8,000 / 1배 미만 12,000 / 그외 회배×12,000)
    // 2026-06-11: 마감(오버록 등)·고리·부자재 — ceil(회배) 단위로 청구 (1마 이하 1개, 1.5마 2개, 2마 2개...)
    //   기존: hoebae(billable) 곱 → ≤0.5 인 경우 4000×0.5=2000 으로 절반만 청구되던 버그.
    const finishCount = Math.max(1, Math.ceil(rawHoebae));
    const finishPerItem = (state.finishExtra || 0) * finishCount;
    const otherPerItem = (state.hookExtra || 0) + (state.accExtra || 0) + (state.seamExtra || 0);
    const perItem = itemPrice + finishPerItem + otherPerItem;
    const subtotal = perItem * state.orderQty;
    const disc = getVolumeDiscount(state.orderQty);
    const discountAmt = Math.round(subtotal * disc.pct / 100);
    const total = subtotal - discountAmt;

    document.getElementById('pUnit').textContent = cdFmtPrice(itemPrice) + ' (' + hoebae.toFixed(2) + 'x)';
    document.getElementById('pQty').textContent = state.orderQty;

    const extraParts = [];
    // 2026-06-11: 마감 표시 — ceil(회배) 개수로 표시 ("오버록 ×1 = 4,000원" / "×2 = 8,000원")
    // 2026-07-15: 기본 마감(가재단)이 한국어로 남던 문제 — raw 는 현재 언어로 번역. (선택 마감은 카드 텍스트라 이미 번역됨)
    var _finLang = (typeof _cdLangCode === 'function') ? _cdLangCode() : 'ko';
    var _finNm = (state.finishCode === 'raw')
        ? (_finLang === 'ja' ? '仮裁断' : _finLang === 'en' ? 'Pre-cut' : '가재단')
        : state.finishName;
    extraParts.push(_finNm + (finishPerItem > 0 ? ' ×' + finishCount + ' = ' + cdFmtPrice(finishPerItem) : ''));
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
    // 2026-05-23: 입력값은 mm. 비율(aspect)은 무차원이라 mm 끼리 그대로 계산.
    if (locked && state.imgAspect) {
        if (which === 'w') {
            const w = parseFloat(wInput.value) || 1;          // mm
            const h = Math.round(w / state.imgAspect);        // mm
            hInput.value = h;
        } else {
            const h = parseFloat(hInput.value) || 1;          // mm
            const w = Math.round(h * state.imgAspect);        // mm
            wInput.value = w;
        }
    }
    // 패턴 한 타일 폭 경고 (이미지 타일 사이즈) — mm 기준
    const w = parseFloat(wInput.value) || 0;                  // mm
    if (w > 1300) {
        var lang = window.__CD_LANG || 'ko';
        var msg = lang === 'ja' ? 'パターンタイルの最大幅は1300mmです'
                : lang === 'en' ? 'Max tile width is 1300mm'
                : '패턴 타일의 최대 폭은 1300mm입니다';
        showToast(msg);
    }
    // 2026-05-14: centered 레이아웃 = 패브릭포스터 모드 → 출력 사이즈 동기화 (입력 mm → 내부 cm)
    if (state.layout === 'centered') {
        const newWmm = parseFloat(wInput.value) || 0;
        const newHmm = parseFloat(hInput.value) || 0;
        const oW = document.getElementById('orderWcm');
        const oH = document.getElementById('orderHcm');
        if (oW && newWmm > 0) oW.value = newWmm;
        if (oH && newHmm > 0) oH.value = newHmm;
        state.orderWcm = _cdCm(newWmm); state.orderHcm = _cdCm(newHmm);
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

    state.imgWcm = _cdCm(document.getElementById('imgWcm').value) || 10;   // 2026-05-23: 입력 mm → cm
    state.imgHcm = _cdCm(document.getElementById('imgHcm').value) || 10;

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
        // 2026-06-15: 패브릭포스터 = 이미지가 대지에 꽉차게. imgWcm/Hcm 무시하고 캔버스 자체를 사용.
        //   (imgWcm input 의 max=1300 제약 때문에 1702mm 같은 큰 세로값이 기본값으로 리셋되어
        //    tileW/H 가 10cm 로 잡혀 이미지가 100×100 box 로 작게 그려지던 버그.)
        //   imgScale (축소 %) 은 그대로 적용 — 사용자가 80% 등으로 줄이면 그만큼 작게.
        const drawW2 = cw * sc;
        const drawH2 = ch * sc;
        const x = (cw - drawW2) / 2;
        const y = (ch - drawH2) / 2;
        ctx.drawImage(state.img, x, y, drawW2, drawH2);
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
                rc.fillText((cm * 10).toString(), x, rh - 10);   // 2026-05-23: mm 라벨 (10cm마다 = 100mm)
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
                lc.fillText((cm * 10).toString(), 0, 0);   // 2026-05-23: mm 라벨
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
// 2026-06-06: 무료배송 carryover — 일반 상품 중 0원(무료) 또는 "가벽" 이 있으면 패브릭도 묶음.
//   가벽은 자체 시공/배송비 (수도권 10만 / 지방 20만 / 지방 설치 70만 등) 가 이미 들어가므로,
//   같이 묶이는 패브릭/아크릴/기타에 별도 배송비 추가하지 않음. 가벽 트럭에 같이 실어 보냄.
function _cdHasFreeShipItem() {
    try {
        var gens = (typeof getGeneralItems === 'function') ? getGeneralItems() : [];
        if (!Array.isArray(gens) || gens.length === 0) return false;
        for (var i = 0; i < gens.length; i++) {
            var it = gens[i];
            if (!it) continue;
            // 자체 ship 정보 — fee === 0 이면 무료
            var f = (it.shipping && typeof it.shipping.fee === 'number') ? it.shipping.fee : null;
            if (f === 0) return true;
            var code = (it.product && it.product.code || '').toLowerCase();
            var nm   = ((it.product && it.product.name) || '').toLowerCase();
            var isHb = code.indexOf('hb_') === 0 || /허니콤|honeycomb/.test(nm);
            var isWall = /^hb_dw/.test(code) || /가벽|wall\s*panel|honeycomb\s*wall/.test(nm);
            // 허니콤 가벽 외 모든 허니콤 — 무료 배송 (등신대/박스/원판/포토존 등)
            if (isHb && !isWall) return true;
            // 가벽 — 자체 시공/배송 (유료/무료 무관) 이 카트에 있으면 나머지는 묶음 무료 (사용자 요청)
            if (isWall) return true;
        }
    } catch (e) {}
    return false;
}
function getShippingFeeKrw() {
    try {
        if (_cdHasFreeShipItem()) return 0;   // 무료배송 항목 있음 → 패브릭도 무료
        var cc = (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || '';
        var lang = (window.__CD_LANG || '').toLowerCase();
        if (cc === 'JP' || lang === 'ja') return 10000;   // ¥1,000
        if (cc === 'US' || lang === 'en') return 10000;   // $10
        return 5000;                                      // 기본 KR — ₩5,000
    } catch (_) { return 5000; }
}

// 2026-06-06: 일반 상품 라인 가격 계산 — 저장된 customSize.unit / boxSize.unit / cutPrint 등 우선.
//   기존 (it.product.price * qty) 는 아크릴(per-m²) 등 면적기반 상품을 잘못 표시하던 버그.
function _cdGenItemPrice(it) {
    if (!it) return 0;
    var qty = it.qty || 1;
    var unit = (it.product && it.product.price) || 0;
    // 배너 (hb_bn_*) — 2026-06-15: 코드 × 단/양 매핑 (simple_order.js 의 _BANNER_PRICES 미러).
    //   hb_bn_1: 단/양 = 45K/80K, hb_bn_2(연결형): 33K/70K, hb_bn_3: 80K/80K.
    if (it._isBanner || (it.product && it.product.code && /^hb_bn/i.test(it.product.code))) {
        var _BPF = { 'hb_bn_1': { single: 45000, double: 80000 }, 'hb_bn_2': { single: 33000, double: 70000 }, 'hb_bn_3': { single: 80000, double: 80000 } };
        var _bnPm = _BPF[(it.product && (it.product.code || '').toLowerCase()) || ''];
        if (_bnPm) {
            unit = (it.wallSide === 'double') ? _bnPm.double : _bnPm.single;
        } else {
            var _bnDb2 = (it.product && Number(it.product.price)) || 0;
            unit = _bnDb2 > 0 ? _bnDb2 : ((it.wallSide === 'double') ? 80000 : 45000);
        }
    }
    // 자유인쇄커팅
    if (it.cutPrint) unit = (it.cutPrint.size === 'half') ? 55000 : 99000;
    // 게이트
    if (it.isGate && it.gate) {
        var _GW = { 2:500000, 3:700000, 4:1000000, 5:1300000, 6:1800000 };
        var _gw = parseInt(it.gate.width_m, 10) || 3;
        var _gh = parseInt(it.gate.height_m, 10) || 3;
        unit = Math.round((_GW[_gw] || _GW[3]) * (_gh === 4 ? 1.5 : 1));
    }
    if (it.boxSize && typeof it.boxSize.unit === 'number') unit = it.boxSize.unit;
    if (it.customSize && typeof it.customSize.unit === 'number') unit = it.customSize.unit;
    // 아크릴 안전망 — per-m² 로 잘못 저장된 unit 을 area_m2 로 환산 + 기본 인쇄/가공비 1,000원
    try {
        var _code = (it.product && it.product.code) || '';
        var _nm = ((it.product && it.product.name) || '').toLowerCase();
        var _isAcr = /^acrl[23]/i.test(_code) || /반투명|스카시|글씨\s*커팅/.test(_nm);
        if (_isAcr && it.customSize && it.customSize.area_m2 != null) {
            var _am = parseFloat(it.customSize.area_m2);
            if (_am > 0 && _am < 1 && unit > 1500) {
                var _cu = Math.round(unit * _am / 10) * 10 + 1000;
                if (_cu < unit) unit = _cu;
            }
        }
    } catch (e) {}
    var sub = unit * qty;
    if (it.wallSide === 'double' && !it._isBanner) sub *= 2;
    if (it.wallSize && parseFloat(it.wallSize.h_m) === 3) {
        var _hExt = 50000 * qty;
        if (it.wallSide === 'double') _hExt *= 2;
        sub += _hExt;
    }
    if (it.wallShapeFee) sub += it.wallShapeFee;
    return sub;
}

// 2026-06-06: 일반 상품의 자체 shipping max — 가벽 우선 룰 (가벽 있으면 가벽 자체비만, 나머지 묶음 무료).
function _cdGenShipMax() {
    try {
        var gens = (typeof getGeneralItems === 'function') ? getGeneralItems() : [];
        if (!Array.isArray(gens) || gens.length === 0) return 0;
        var _isWall = function(it){
            if (!it || !it.product) return false;
            var c = (it.product.code || '').toLowerCase();
            var n = ((it.product.name) || '').toLowerCase();
            return /^hb_dw/.test(c) || /가벽|wall\s*panel|honeycomb\s*wall/.test(n);
        };
        var walls = gens.filter(_isWall);
        if (walls.length > 0) {
            // 가벽 있음 → 가벽 자체 시공/철거비 max 만 부과 (나머지는 묶음 무료)
            return walls.reduce(function(mx, w){
                var f = (w.shipping && typeof w.shipping.fee === 'number') ? w.shipping.fee : 0;
                return f > mx ? f : mx;
            }, 0);
        }
        // 가벽 없음 — 무료(0) 항목 있으면 carryover (전체 0)
        var fees = gens.map(function(it){
            return (it.shipping && typeof it.shipping.fee === 'number') ? it.shipping.fee : 0;
        });
        if (fees.some(function(f){ return f === 0; })) return 0;
        return Math.max.apply(Math, fees.concat([0]));
    } catch (e) { return 0; }
}
function calcCartTotal() {
    var fabricTotal = getCart().reduce(function(s, it) { return s + (it.price || 0); }, 0);
    var genTotal = getGeneralItems().reduce(function(s, it) {
        return s + _cdGenItemPrice(it);
    }, 0);
    var subtotal = fabricTotal + genTotal;
    // 카트 비어있으면 택배비 X
    if (subtotal <= 0) return 0;
    // 일반 항목 자체 배송비 (가벽 시공/철거 등) max + 패브릭 택배비 (carryover 시 0)
    return subtotal + _cdGenShipMax() + getShippingFeeKrw();
}

// 2026-05-22: 패브릭 체크아웃 전용 합계 — 패브릭 항목만 + 택배비.
//   calcCartTotal 은 통합 카트(드로어)용이라 일반상품까지 합산 → 패브릭 체크아웃 요약엔
//   패브릭 항목만 보이는데 합계엔 일반상품이 더해져 과다청구되던 버그(예: 16,900 항목인데 합계 122만).
//   _cpOpenCheckout/_cpSubmitOrder/_cpCreateMgrQuote 는 패브릭만 처리하므로 이 합계를 사용.
function calcFabricCartTotal() {
    var fabricTotal = getCart().reduce(function (s, it) { return s + (it.price || 0); }, 0);
    if (fabricTotal <= 0) return 0;
    return fabricTotal + getShippingFeeKrw();
}

window._cpUpdateCartUI = function() {
    // 2026-06-10: 패브릭 드로어 격리 (쿠팡/스마트스토어 패턴) —
    //   기존엔 일반상품(허니콤보드 등)이 일본 패브릭 사이트에서도 드로어에 같이 보여
    //   "내가 주문하지 않은 이상한 상품" 으로 인식 → 결제 직전 이탈. JP 신뢰도 ↓ 직격.
    //   여기서는 일반상품을 드로어/뱃지/합계에서 완전히 격리. 카트 데이터 자체는 유지 (메인몰에서 접근 가능).
    const cart = getCart();
    const gen = [];                       // ← 패브릭 드로어에서는 일반상품 무시
    const totalCount = cart.length;       // ← 패브릭 개수만 카운트
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
    if (totalAmt) totalAmt.textContent = cdFmtPrice(calcFabricCartTotal()); // 패브릭만
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
                    const sz = it.orderSize || ((it.width_mm || Math.round((it.orderWcm||0)*10)) + '×' + (it.height_mm || Math.round((it.orderHcm||0)*10)) + 'mm');
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
                    // 2026-05-15: 일반상품 카트 이름 — 현재 언어 우선 사용 (JP 사이트에서 한국어 이름 잔존 방지)
                    var _cnLang = window.__CD_LANG || 'ko';
                    var _p = it.product || {};
                    var name = '';
                    if (_cnLang === 'ja') name = _p.name_jp || _p.name_ja || _p.name || _p.name_us || it.productName || '商品';
                    else if (_cnLang === 'en') name = _p.name_us || _p.name_en || _p.name || it.productName || 'Product';
                    else name = _p.name || _p.name_kr || it.productName || '상품';
                    var qty = it.qty || 1;
                    // 2026-06-06: 저장된 customSize.unit / cutPrint / boxSize / 게이트 등 모두 반영 (DB price만 쓰던 버그 fix)
                    var price = (typeof _cdGenItemPrice === 'function') ? _cdGenItemPrice(it) : (((it.product && it.product.price) || 0) * qty);
                    var thumb = it.thumb || (it.product && it.product.img) || 'https://placehold.co/80?text=Item';
                    return '<div class="cart-item">' +
                        '<img class="cart-item-thumb" src="' + thumb + '" alt="">' +
                        '<div class="cart-item-info">' +
                            '<div class="cart-item-name">' + name + '</div>' +
                            '<div class="cart-item-opts">' + qty + (window.cdT ? (window.cdT('qty_unit') || '개') : '개') + '</div>' +
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
                if (label) label.textContent = 'Login';   // 2026-07-22: 전 페이지 영문 통일
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
            // 2026-05-22: 모바일 — 가로 스크롤 제스처가 카테고리 버튼 클릭(→/paper-stand 등)을
            //   발동시켜 엉뚱한 페이지로 가던 문제 방지. 스크롤 중이면 다음 클릭 1회 무시.
            var _tcmScrolled = false;
            track.addEventListener('touchstart', function(){ _tcmScrolled = false; }, { passive: true });
            track.addEventListener('touchmove', function(){ _tcmScrolled = true; }, { passive: true });
            window.__tcmScrolled = function(){ return _tcmScrolled; };
            // 메뉴가 그려진 직후 600ms 동안은 클릭 무시 — 이전 페이지(내원단 만들기) 탭의
            // '고스트 클릭'이 새 페이지의 같은 좌표(종이매대 버튼)에 발동하는 것을 방지.
            var _tcmReadyAt = Date.now() + 600;
            window.__tcmReady = function(){ return Date.now() >= _tcmReadyAt; };
            topCats.forEach(function (top) {
                // 메인 페이지 nav 와 동일: user_artwork, default 는 제외
                if (top.code === 'user_artwork' || top.code === 'default') return;
                // 2026-05-30: 굿즈 판촉물 (구) 상단 탭 숨김 — 아래에서 /goods (신규) 카탈로그 버튼으로 통합 (index.html L11063-11065 mirror).
                var _tnRaw = ((top.name || '') + ' ' + (top.name_us || '')).replace(/\s+/g, '').toLowerCase();
                if (/굿즈판촉물|goodspromotional|promotionalgoods|판촉물굿즈/.test(_tnRaw)) return;
                var name = top.name;
                if (lang === 'ja' && top.name_jp) name = top.name_jp;
                else if (lang === 'en' && top.name_us) name = top.name_us;
                var btn = document.createElement('button');
                btn.className = 'tcm-btn';
                if (top.code === '22222') btn.classList.add('active'); // 패브릭 현재 페이지
                btn.textContent = name || '';
                btn.dataset.topCode = top.code;
                btn.onclick = function () {
                    // 가로 스크롤 제스처 또는 로드 직후 고스트 클릭이면 무시 (모바일 오작동 방지)
                    if (window.__tcmScrolled && window.__tcmScrolled()) return;
                    if (window.__tcmReady && !window.__tcmReady()) return;
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
            // 2026-05-30: /goods (신규) 카탈로그 버튼 — 모든 도메인에서 메인사이트의 /goods 로 이동 (cafe2626/0101 도메인 동일 경로).
            //   기존 '굿즈판촉물' 탭이 메인 (cafe0101.com) 으로 갔던 문제 대체.
            (function _addGoodsLink(){
                var goodsBtn = document.createElement('button');
                goodsBtn.className = 'tcm-btn';
                var labMap = { ko:'🎁 굿즈', ja:'🎁 グッズ', en:'🎁 Goods' };
                goodsBtn.textContent = labMap[lang] || labMap.ko;
                goodsBtn.onclick = function(){
                    if (window.__tcmScrolled && window.__tcmScrolled()) return;
                    if (window.__tcmReady && !window.__tcmReady()) return;
                    var langMap2 = { ja:'ja', en:'en' };
                    var gLang = langMap2[lang];
                    location.href = '/goods' + (gLang ? '?lang=' + gLang : '');
                };
                track.appendChild(goodsBtn);
            })();
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
// 2026-06-10: 전체 비우기 — 패브릭 드로어 격리 후, 여기서는 fabric 만 제거 (일반상품은 메인몰에서 관리).
//   기존 cartSync.clearAll() 은 모든 도메인의 모든 항목을 wipe 하던 cross-domain 파괴 동작 →
//   사용자가 일본 패브릭 드로어에서 "全て削除" 만 눌렀는데 메인몰 카트까지 날아가는 부작용 fix.
window._cpCartClearAll = function() {
    var msg = (window.cdT && window.cdT('cart_clear_confirm')) || '장바구니의 모든 항목을 삭제할까요?';
    if (!window.confirm(msg)) return;
    try {
        // 1) 로컬 패브릭 카트 비우기 (CART_KEY 는 patterns_v3 등 패브릭 전용 키)
        saveCart([]);
        // 2) cart_sync 에도 반영 — 일반상품은 보존, 패브릭(cotton-print source) 만 제거
        if (window.cartSync && typeof window.cartSync.forceSync === 'function') {
            window.cartSync.forceSync();
        }
    } catch (e) { console.warn('[clearFabric]', e); }
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
    // 2026-07-16: 원단 제공(임가공) — 로스 포함 최소 10마. 담기/바로구매 공통 관문에서 차단.
    if (_cdIsSuppliedRoll() && (state.rollYards || 1) < SUPPLIED_MIN_YARDS) {
        var _sL = window.__CD_LANG || 'ko';
        showToast(_sL === 'ja' ? '生地持込のご注文は、ロスを含め最低10ヤードからとなります。'
                : _sL === 'en' ? 'Customer-supplied fabric orders require a minimum of 10 yards (including loss).'
                : '원단 제공 주문은 로스를 포함해 최소 10마부터 가능합니다.');
        state.rollYards = SUPPLIED_MIN_YARDS;
        var _syEl = document.getElementById('rollYards'); if (_syEl) _syEl.value = SUPPLIED_MIN_YARDS;
        if (typeof updatePrice === 'function') updatePrice();
        return null;
    }
    // 2026-05-31: 패턴 모드는 회배/마감/고리/부자재 무시, 롤폭×야드로 계산.
    const isPatternMode = (state.layout !== 'centered');
    let rawHoebae, hoebae, itemPrice, finishPerItem, otherPerItem, subtotal, disc, discountAmt, price;
    if (isPatternMode) {
        const perYard = ROLL_PRICE_PER_YARD[state.rollWidth] || ROLL_PRICE_PER_YARD.wide;
        const yards = Math.max(1, state.rollYards || 1);
        rawHoebae = 0; hoebae = 0; itemPrice = perYard; finishPerItem = 0; otherPerItem = 0;
        subtotal = perYard * yards;
        disc = getVolumeDiscount(yards);
        discountAmt = Math.round(subtotal * disc.pct / 100);
        price = subtotal - discountAmt;
    } else {
        rawHoebae = calcHoebae();
        hoebae = calcBillableHoebae();
        itemPrice = calcItemPrice();
        // 2026-06-11: 마감 — ceil(회배) 개수 단위 청구 (1마 이하 1개, 1.5마 2개, 2마 2개)
        const _finishCount = Math.max(1, Math.ceil(rawHoebae));
        finishPerItem = (state.finishExtra||0) * _finishCount;
        otherPerItem = (state.hookExtra||0) + (state.accExtra||0) + (state.seamExtra||0);
        subtotal = (itemPrice + finishPerItem + otherPerItem) * state.orderQty;
        disc = getVolumeDiscount(state.orderQty);
        discountAmt = Math.round(subtotal * disc.pct / 100);
        price = subtotal - discountAmt;
    }

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
        orderSize: _cdMm(state.orderWcm) + '×' + _cdMm(state.orderHcm) + 'mm',
        width_mm: Math.round(state.orderWcm * 10),
        height_mm: Math.round(state.orderHcm * 10),
        hoebae: hoebae,
        rawHoebae: rawHoebae,
        unitPrice: itemPrice,
        imageSize: _cdMm(state.imgWcm) + '×' + _cdMm(state.imgHcm) + 'mm',
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
        qtyValue: isPatternMode ? state.rollYards : state.orderQty,
        qtyLabel: isPatternMode
            ? state.rollYards + (window.cdT ? (window.cdT('roll_yard_unit') || '마') : '마')
            : state.orderQty + (window.cdT ? (window.cdT('qty_unit') || '개') : '개'),
        finishCode: isPatternMode ? '' : state.finishCode,
        finishName: isPatternMode ? '' : state.finishName,
        finishUnit: isPatternMode ? 0 : (state.finishExtra || 0),
        finishTotal: finishPerItem,
        hookCode: isPatternMode ? '' : state.hookCode,
        hookName: isPatternMode ? '' : state.hookName,
        hookExtra: isPatternMode ? 0 : (state.hookExtra || 0),
        accCode: isPatternMode ? '' : state.accCode,
        accName: isPatternMode ? '' : state.accName,
        accExtra: isPatternMode ? 0 : (state.accExtra || 0),
        seamExtra: isPatternMode ? 0 : (state.seamExtra || 0),
        oversize: !isPatternMode && (state.orderWcm > ROLL_MAX_WIDTH_CM && state.orderHcm > ROLL_MAX_WIDTH_CM),
        // 2026-05-31: 패턴 모드 — 롤 폭/야드 보존 (주문서·관리자 화면용)
        rollWidth: isPatternMode ? state.rollWidth : null,
        rollWidthLabel: isPatternMode
            ? ({ wide: '대폭 (130cm)', narrow: '소폭 (100cm)', supplied: '원단 제공' })[state.rollWidth]
            : null,
        rollYards: isPatternMode ? state.rollYards : null,
        rollPerYard: isPatternMode ? (ROLL_PRICE_PER_YARD[state.rollWidth] || 0) : null,
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
    if (item.cartImageUrl) return item; // 이미 업로드됨
    if (!item.imgDataUrl || typeof item.imgDataUrl !== 'string') return item;
    // 2026-05-22: 크기 무관 항상 Storage 업로드.
    //   이전엔 200KB 미만은 localStorage 에 base64 로만 뒀는데, 카트 용량이 차면
    //   cart_sync 가 imgDataUrl 을 떼어내 주문에 디자인 이미지가 누락되던 버그.
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
    // 2026-05-22: 이미지 없이도 주문 허용 (디자인은 추후 이메일 등으로 전달). 확인 후 추가.
    if (!state.img || !state.imgDataUrl) {
        var _L1 = window.__CD_LANG || 'ko';
        var _ask1 = _L1==='ja' ? '画像なしで注文しますか？\nデザインは後ほどメール等でお送りいただけます。'
                  : _L1==='en' ? 'Order without an image?\nYou can send the design later by email.'
                  : '이미지 없이 주문할까요?\n디자인은 나중에 이메일 등으로 보내실 수 있습니다.';
        if (!window.confirm(_ask1)) { if (window._cpCartOpen) window._cpCartOpen(); return; }
        var _it1 = buildCartItem();
        if (!_it1) return;
        _it1.artworkLater = true;
        var _later = _L1==='ja' ? '画像は後送' : _L1==='en' ? 'image to follow' : '이미지 추후 전달';
        _it1.title = (_it1.fabricName || _it1.title || '원단') + ' — ' + _later;
        var _c1 = getCart(); _c1.push(_it1); saveCart(_c1);
        try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(_it1.price); } catch(e){}
        window._cpUpdateCartUI();
        showToast((window.cdT && window.cdT('cart_added_toast') ? window.cdT('cart_added_toast').replace('{n}', _c1.length) : '장바구니에 담았습니다 (' + _c1.length + '개)'));
        setTimeout(window._cpCartOpen, 400);
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
    try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(item.price); } catch(e){}
    window._cpUpdateCartUI();
    showToast((window.cdT && window.cdT('cart_added_toast')
        ? window.cdT('cart_added_toast').replace('{n}', cart.length)
        : '장바구니에 담았습니다 (' + cart.length + '개)'));
    setTimeout(window._cpCartOpen, 400);
};

// 2026-06-06: 바로주문 대신 장바구니 보기 — 다른 상품과 묶음 (무료배송 carryover 활용)
window._cdViewCart = function() {
    try {
        if (typeof window._cpCartOpen === 'function') return window._cpCartOpen();
        if (typeof window._soToggleCart === 'function') return window._soToggleCart(true);
    } catch (e) { console.warn('[cd] viewCart', e); }
};

window._cdBuyNow = async function() {
    // 2026-05-22: 이미지 없이도 바로 주문 허용 (디자인 추후 전달)
    if (!state.img || !state.imgDataUrl) {
        var _L2 = window.__CD_LANG || 'ko';
        var _ask2 = _L2==='ja' ? '画像なしで注文しますか？\nデザインは後ほどメール等でお送りいただけます。'
                  : _L2==='en' ? 'Order without an image?\nYou can send the design later by email.'
                  : '이미지 없이 주문할까요?\n디자인은 나중에 이메일 등으로 보내실 수 있습니다.';
        if (!window.confirm(_ask2)) { if (window._cpCartOpen) window._cpCartOpen(); return; }
        var _it2 = buildCartItem();
        if (!_it2) return;
        _it2.artworkLater = true;
        var _later2 = _L2==='ja' ? '画像は後送' : _L2==='en' ? 'image to follow' : '이미지 추후 전달';
        _it2.title = (_it2.fabricName || _it2.title || '원단') + ' — ' + _later2;
        var _c2 = getCart(); _c2.push(_it2); saveCart(_c2);
        try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(_it2.price); } catch(e){}
        window._cpUpdateCartUI();
        window._cpGoCheckout();
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
    try { if (window.gtagTrackAddToCart) window.gtagTrackAddToCart(item.price); } catch(e){}
    window._cpUpdateCartUI();
    window._cpGoCheckout();
};

// 2026-05-22: 결제창 라우터 — cafe2626 에선 통합 결제창(_soOpenCheckout: 패브릭+일반+마일리지 한 번에),
//   단독 패브릭 도메인(cotton-print/printer.com)에선 simple_order 미로드 → 패브릭 전용(_cpOpenCheckout).
window._cpGoCheckout = function () {
    try { if (window._cpCartClose) window._cpCartClose(); } catch (e) {}
    if (typeof window._soOpenCheckout === 'function' && document.getElementById('soCheckoutOverlay')) {
        try { window._soOpenCheckout(); return; } catch (e) { console.warn('[cpGoCheckout] _soOpenCheckout 실패, 패브릭 전용으로', e); }
    }
    window._cpOpenCheckout();
};

// 2026-05-13: 최소주문금액 제도 폐지 — 사용자 결정 (KR/JP/EN 모두 제한 없음)
function checkMinOrderAmount(_total_krw) {
    return true;
}

window._cpOpenCheckout = function() {
    const cart = getCart();
    if (cart.length === 0) return;
    // 2026-05-12: 최소주문금액 검증 (패브릭 합계 기준)
    if (!checkMinOrderAmount(calcFabricCartTotal())) return;
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
    // 2026-05-22: 배송비 라인 — 합계엔 포함되는데 요약에 안 보여 금액이 안 맞아 보이던 문제.
    var _shipFee = cart.length > 0 ? getShippingFeeKrw() : 0;
    if (_shipFee > 0) {
        var _shipLabel = ({ ko: '배송비', ja: '送料', en: 'Shipping' })[_cdL] || '배송비';
        list.innerHTML += '<div class="co-summary-item"><div class="co-summary-item-name">' + _shipLabel + '</div><div class="co-summary-item-opts"></div><div class="co-summary-item-price">' + cdFmtPrice(_shipFee) + '</div></div>';
    }
    document.getElementById('coTotalAmt').textContent = cdFmtPrice(calcFabricCartTotal());
    document.getElementById('checkoutOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // 2026-06-18 v579: 할인 4종 (이벤트 쿠폰 / 마일리지 / 예치금 / PRO) UI 활성화 + 잔액 로드
    try { if (typeof window._cpLoadDiscounts === 'function') window._cpLoadDiscounts(); } catch(_de){ console.warn('[cp discounts]', _de); }
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
        var total = calcFabricCartTotal();
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
            site_code: _cpSiteCode(),
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

// 2026-05-22: 패브릭 견적서 다운로드 — 현재 패브릭 카트 + 입력 폼 기반 PDF 생성.
//   export.js generateQuotationPDF 가 fabricCode 항목을 합성 product 로 처리(라인총액 = it.price).
//   언어/통화: window.__CD_LANG 로 export.js CURRENT_LANG_CODE 결정, CURRENCY_RATE 폴백 주입.
window._cpDownloadQuote = async function (btnEl) {
    var origLabel = btnEl ? btnEl.innerHTML : '';
    try {
        var cart = getCart();
        if (!cart || cart.length === 0) {
            alert(window.cdT ? window.cdT('cart_empty') : '장바구니가 비어있습니다.');
            return;
        }
        if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ' + (window.cdT ? window.cdT('processing') : '생성중'); }

        // cotton_designer.html 은 site-config.js 를 안 불러와 SITE_CONFIG 가 없을 수 있음.
        // export.js 가 _cr.JP/_cr.US 로 KRW→현지통화 환산하므로 환율표만 보장.
        if (!window.SITE_CONFIG) window.SITE_CONFIG = {};
        if (!window.SITE_CONFIG.CURRENCY_RATE) window.SITE_CONFIG.CURRENCY_RATE = { KR: 1, JP: 0.1, US: 0.001 };

        // 이 페이지엔 window.loadEditorLibraries 가 없어 export.js 내부 jsPDF 로더가 동작 안 함 →
        // generateQuotationPDF 가 undefined 반환. jsPDF UMD 를 직접 보장 로드.
        if (!window.jspdf) {
            await new Promise(function (resolve, reject) {
                var s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                s.onload = resolve;
                s.onerror = function () { reject(new Error('jsPDF 라이브러리 로드 실패')); };
                document.head.appendChild(s);
            });
        }

        var mod = await import('./export.js?v=443');
        if (!mod || !mod.generateQuotationPDF) { alert('견적서 생성 모듈을 로드할 수 없습니다.'); return; }

        var gv = function (id) { var el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
        var name = gv('coName') || '-';
        var phone = gv('coPhone');
        var zip = gv('coZip'), addr1 = gv('coAddr1'), addr2 = gv('coAddr2');
        var memo = gv('coMemo');
        var fullAddr = [zip ? '(' + zip + ')' : '', addr1, addr2].filter(Boolean).join(' ');

        var orderInfo = {
            id: '미리보기',
            manager: name, phone: phone, address: fullAddr,
            note: memo, date: '',
            shippingFee: getShippingFeeKrw()
        };

        // 패브릭 항목은 it.price 가 KRW 라인총액(수량 포함). export.js 가 합성 product 로 처리.
        var blob = await mod.generateQuotationPDF(orderInfo, cart, 0, 0);
        if (!blob) { alert('견적서 생성 실패. 콘솔을 확인하세요.'); return; }

        var url = URL.createObjectURL(blob);
        var _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        if (_isMobile) {
            var w = window.open(url, '_blank');
            if (!w) {
                var a0 = document.createElement('a'); a0.href = url; a0.download = 'quote_' + Date.now() + '.pdf';
                document.body.appendChild(a0); a0.click(); document.body.removeChild(a0);
            }
        } else {
            var a = document.createElement('a');
            a.href = url; a.download = 'quote_' + Date.now() + '.pdf';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } catch (e) {
        console.error('[_cpDownloadQuote]', e);
        alert('견적서 생성 오류: ' + (e.message || e));
    } finally {
        if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = origLabel; }
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

// 2026-06-18 v579: 할인 적용 — 로그인 사용자만, profiles 에서 잔액 로드
window._cpDiscState = { coupon:0, mileage:0, deposit:0, isPro:false, selected:null, discountAmount:0 };

// 2026-06-18 v581: 통합 SSO 클라이언트 헬퍼 — window.sb 우선, 없으면 명시적 storageKey 로 생성.
//   storageKey 가 같으면 cafe2626.com 도메인 안에서 localStorage 세션 공유 → SSO.
function _cpGetAuthSb() {
    if (window.sb) return window.sb;
    if (!window.supabase || !window.supabase.createClient) return null;
    var client = window.supabase.createClient(
        'https://qinvtnhiidtmrzosyvys.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y',
        { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storage:localStorage, storageKey:'sb-qinvtnhiidtmrzosyvys-auth-token' } }
    );
    window.sb = client;
    return client;
}

// 2026-06-18 v585: 할인 라벨 i18n 헬퍼 — cdT 키 + {bal} 치환
function _cpT(key, fallback) {
    try { var v = window.cdT && window.cdT(key); if (v) return v; } catch(_){}
    return fallback;
}
// 잔액(P)을 현지 통화로 표시 — cdFmtPrice 의 결과 그대로 사용 (P 접미 없음)
function _cpFmtBal(krw) { return cdFmtPrice(krw); }

window._cpLoadDiscounts = async function() {
    var box = document.getElementById('cpDiscountBox');
    if (!box) { console.warn('[cp discount] cpDiscountBox element not found in DOM'); return; }
    var sb = _cpGetAuthSb();
    if (!sb) { console.warn('[cp discount] no supabase'); return; }
    try {
        var sess = await sb.auth.getSession();
        var uid = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
        console.log('[cp discount] uid =', uid);
        if (!uid) {
            // 비로그인 사용자에게도 안내 — '로그인하면 할인 적용 가능'
            box.style.display = '';
            box.innerHTML = '<span class="co-label">' + _cpT('co_discount','할인 적용 (1개 선택)') + '</span><div style="padding:14px; background:#fef3c7; border:1px solid #fbbf24; border-radius:10px; font-size:12.5px; color:#92400e; line-height:1.6;">' + _cpT('co_login_to_use','🔐 로그인하시면 이벤트 쿠폰 / 마일리지 / 예치금 / PRO 구독할인을 적용할 수 있습니다.') + '</div>';
            return;
        }
        // profiles 에서 잔액
        var prof = null;
        var profErr = null;
        try {
            var r = await sb.from('profiles').select('mileage, deposit, event_coupon, is_pro').eq('id', uid).maybeSingle();
            prof = r.data; profErr = r.error;
        } catch(e) { profErr = e; }
        // is_pro 컬럼 없을 경우 폴백
        if (!prof && profErr) {
            console.warn('[cp discount] first profile query error:', profErr.message || profErr);
            try {
                var r2 = await sb.from('profiles').select('mileage, deposit, event_coupon').eq('id', uid).maybeSingle();
                prof = r2.data;
            } catch(e2) {
                try { var r3 = await sb.from('profiles').select('mileage, deposit').eq('id', uid).maybeSingle(); prof = r3.data; } catch(e3){}
            }
        }
        console.log('[cp discount] profile loaded:', prof);
        if (!prof) {
            box.style.display = '';
            box.innerHTML = '<span class="co-label">' + _cpT('co_discount','할인 적용 (1개 선택)') + '</span><div style="padding:14px; background:#fee2e2; border:1px solid #fca5a5; border-radius:10px; font-size:12.5px; color:#991b1b;">' + _cpT('co_profile_err','⚠️ 프로필 정보를 불러올 수 없습니다.') + '</div>';
            return;
        }
        var coupon  = Number(prof.event_coupon || 0);
        var mileage = Number(prof.mileage || 0);
        var deposit = Number(prof.deposit || 0);
        var isPro   = !!prof.is_pro;
        window._cpDiscState.coupon  = coupon;
        window._cpDiscState.mileage = mileage;
        window._cpDiscState.deposit = deposit;
        window._cpDiscState.isPro   = isPro;
        var total = calcFabricCartTotal();
        // 1) 이벤트 쿠폰: 보유액 vs 주문×20% vs 30,000원 중 최소 (2026-06-18 v585: 20% cap 추가)
        var couponUsable  = Math.min(coupon,  Math.floor(total * 0.20), 30000, total);
        // 2) 마일리지: 주문의 5%
        var mileageUsable = Math.min(mileage, Math.floor(total * 0.05));
        // 3) 예치금: 전액 사용 (단 total 까지)
        var depositUsable = Math.min(deposit, total);
        // 4) PRO: 주문 10%
        var proUsable     = isPro ? Math.floor(total * 0.10) : 0;
        // 표시는 모두 현지 통화 (KRW/JPY/USD). 라벨도 lang 별 i18n.
        document.getElementById('cpDiscEventAmount').textContent   = _cpFmtBal(couponUsable);
        document.getElementById('cpDiscEventHint').textContent     = _cpT('co_disc_event_hint','보유 {bal} · 최대 20%').replace('{bal}', _cpFmtBal(coupon));
        document.getElementById('cpDiscMileageAmount').textContent = _cpFmtBal(mileageUsable);
        document.getElementById('cpDiscMileageHint').textContent   = _cpT('co_disc_mileage_hint','보유 {bal} · 5%').replace('{bal}', _cpFmtBal(mileage));
        document.getElementById('cpDiscDepositAmount').textContent = _cpFmtBal(depositUsable);
        document.getElementById('cpDiscDepositHint').textContent   = _cpT('co_disc_deposit_hint','보유 {bal} · 전액 사용').replace('{bal}', _cpFmtBal(deposit));
        document.getElementById('cpDiscProAmount').textContent     = isPro ? ('-' + _cpFmtBal(proUsable)) : _cpT('co_disc_pro_none','미구독');
        document.getElementById('cpDiscProHint').textContent       = isPro ? _cpT('co_disc_pro_hint','주문의 10%') : _cpT('co_disc_pro_none','미구독');
        // 미구독은 PRO 비활성
        if (!isPro) {
            var proRadio = document.querySelector('input[name="cpDiscChoice"][value="pro"]');
            if (proRadio) { proRadio.disabled = true; proRadio.parentElement.parentElement.style.opacity = '0.5'; }
        }
        box.style.display = '';
    } catch(e) {
        console.warn('[cp loadDiscounts]', e);
        box.style.display = 'none';
    }
};

window._cpOnDiscountSelect = function() {
    var chosen = (document.querySelector('input[name="cpDiscChoice"]:checked') || {}).value;
    var s = window._cpDiscState;
    var total = calcFabricCartTotal();
    var disc = 0;
    // 2026-06-18 v585: event_coupon 20% cap 추가 (이전엔 30,000원 cap 만 적용되어 소액주문에서 over-discount 발생)
    if (chosen === 'event_coupon') disc = Math.min(s.coupon, Math.floor(total * 0.20), 30000, total);
    else if (chosen === 'mileage') disc = Math.min(s.mileage, Math.floor(total * 0.05));
    else if (chosen === 'deposit') disc = Math.min(s.deposit, total);
    else if (chosen === 'pro' && s.isPro) disc = Math.floor(total * 0.10);
    s.selected = chosen || null;
    s.discountAmount = disc;
    // 합계 라벨 업데이트 — 통화 변환된 값으로 표시 (JP=¥, US=$)
    var totalEl = document.getElementById('coTotalAmt');
    if (totalEl) totalEl.innerHTML = cdFmtPrice(Math.max(0, total - disc)) + (disc > 0 ? ' <span style="font-size:11px; color:#16a34a; font-weight:600;">(-' + cdFmtPrice(disc) + ')</span>' : '');
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

        const total = calcFabricCartTotal();
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
                    if (it.seamExtra && it.seamExtra > 0) arr.push({ type:'seam', code:'seam_join', name:'이어박기 (대폭 1300mm 초과)', price:it.seamExtra });
                    return arr;
                })(),
                unit_price: it.unitPrice,
                price: it.price,
                // 2026-07-16: 롤 폭 — 여태 주문서에 안 실려서 작업지시서가 '원단 제공'(고객 지참) 주문을
                //   우리 원단 주문과 구분 못 했다 (주문 4740: 옥스포드 3,000원). 이제 저장.
                roll_width: it.rollWidth || null,               // wide | narrow | supplied
                roll_width_label: it.rollWidthLabel || null,
                roll_per_yard: it.rollPerYard || null,
                roll_yards: it.rollYards || null,
                source: 'cotton-print',
                artwork_url: artworkUrl,                                  // 최상위에도 — 작업지시서/관리자 조회 편의
                artwork_later: !!it.artworkLater,                         // 2026-05-22: 이미지 추후 전달(이메일 등) 주문 표시
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

        // 2026-05-22: 안전망 — 디자인 이미지가 '있어야 하는데' 누락된 항목만 주문 차단.
        //   (업로드 실패로 디자인이 비던 문제 방지). 단, '이미지 추후 전달(artwork_later)' 의도 주문은 통과.
        const _missingArt = items.filter(function(it){ return !it.artwork_url && !it.artwork_later; });
        if (_missingArt.length > 0) {
            // 한 번 더 base64 재업로드 시도 후에도 비어있으면 차단
            var _stillMissing = [];
            for (var _mi = 0; _mi < cart.length; _mi++) {
                if (items[_mi] && !items[_mi].artwork_url && !items[_mi].artwork_later) {
                    var _it2 = cart[_mi];
                    try { await _cdPersistItemImage(_it2); } catch(e){}
                    if (_it2.cartImageUrl) items[_mi].artwork_url = _it2.cartImageUrl;
                    else _stillMissing.push(_mi + 1);
                }
            }
            if (_stillMissing.length > 0) {
                var _L = (window.__CD_LANG || 'ko');
                var _msg = _L === 'ja' ? ('デザイン画像が確認できない項目があります（' + _stillMissing.join(', ') + '番目）。\nお手数ですが画像を再アップロードしてから注文してください。')
                         : _L === 'en' ? ('Some items are missing their design image (#' + _stillMissing.join(', ') + ').\nPlease re-upload the image before ordering.')
                         : ('디자인 이미지가 누락된 항목이 있습니다 (' + _stillMissing.join(', ') + '번째).\n이미지를 다시 올린 후 주문해주세요.');
                alert(_msg);
                return; // finally 블록이 버튼 상태 복구
            }
        }

        const fullAddr = '[' + zip + '] ' + addr1 + ' ' + addr2;
        const adminNote = '[COTTON-PRINT] 출처: cotton-print.com\n결제방법: ' + (payMethod==='bank'?'무통장입금':'카드결제(Toss)') + '\n이메일: ' + (email||'없음');

        // 2026-06-18 v579: 할인 적용된 금액 계산
        // 2026-06-18 v583 HOTFIX: discount_type 컬럼이 orders 테이블에 없음 → admin_note 에 prefix 로 기록.
        var _ds = (window._cpDiscState || { discountAmount:0, selected:null });
        var _discAmt = Math.max(0, Math.min(_ds.discountAmount || 0, total));
        var _payable = Math.max(0, total - _discAmt);
        // admin_note 에 할인 정보 prefix 추가 (별도 컬럼 추가 마이그레이션 없이 운영 가능)
        var _discNotePrefix = _ds.selected ? ('[DISCOUNT:' + _ds.selected + ':' + _discAmt + '] ') : '';
        var _finalAdminNote = _discNotePrefix + (adminNote || '');

        // 2026-07-13: 로그인 회원 주문이면 orders.user_id 연결 — 이게 없어서 패브릭 주문이 전부 '비회원'으로
        //   들어가 고객 마이페이지 주문내역(user_id 매칭)에 안 뜨던 버그. window.sb(공용 세션) 우선 사용.
        var _cpUid = null;
        try {
            var _authSb = (typeof _cpGetAuthSb === 'function') ? _cpGetAuthSb() : (window.sb || sb);
            if (_authSb && _authSb.auth && _authSb.auth.getSession) {
                var _sess = await _authSb.auth.getSession();
                _cpUid = (_sess && _sess.data && _sess.data.session && _sess.data.session.user) ? _sess.data.session.user.id : null;
            }
            if (!_cpUid && (window.currentUser || window._cpCurrentUser)) _cpUid = (window.currentUser || window._cpCurrentUser).id || null;
        } catch (_cpe) { console.warn('[cotton order] user_id lookup', _cpe); }
        console.log('[cotton order] user_id =', _cpUid || '(guest)');

        // 2) orders 테이블에 등록 → 통합주문관리에 즉시 표시
        const orderInsertPayload = {
            order_date: new Date().toISOString(),
            user_id: _cpUid,            // 2026-07-13: 회원 연결 (null 이면 비회원)
            manager_name: name,         // 통합주문관리에서 "고객 정보" 컬럼에 표시됨
            phone: phone,
            address: fullAddr,
            request_note: memo || '',
            status: payMethod === 'bank' ? '접수됨' : '임시작성',
            payment_status: payMethod === 'bank' ? '입금대기' : '미결제',
            payment_method: payMethod === 'bank' ? '무통장입금' : '카드',
            total_amount: _payable,
            discount_amount: _discAmt,
            items: items,
            site_code: _cpSiteCode(),
            files: uploadedFiles.length ? uploadedFiles : null,
            admin_note: _finalAdminNote
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
            try { window.cartSync && window.cartSync.forceSync && window.cartSync.forceSync(); } catch (e) {} // 서버 즉시 동기화 (리다이렉트 전 비움 반영)
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
        try { window.cartSync && window.cartSync.forceSync && window.cartSync.forceSync(); } catch (e) {} // 서버 즉시 동기화
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
                // 2026-05-28: 기본 패턴 크기를 캔버스 가로폭(orderWcm)에 맞춤
                // + aspect 비율 저장 → 사용자가 출력 사이즈 변경하면 _cdCalcHoebae 가 이미지도 비례 조정
                state.imgAspect = ratio;
                state.layout = 'centered'; // 이미지가 캔버스를 꽉 채우는 모드 — 출력 사이즈와 동기화
                state.imgWcm = state.orderWcm || 130;            // 캔버스 가로폭 (기본 130cm = 1300mm)
                state.imgHcm = Math.round(state.imgWcm / ratio * 10) / 10;
                // 출력 세로도 이미지 비율에 맞춰 조정 (가로 폭은 그대로)
                state.orderHcm = state.imgHcm;
                document.getElementById('imgWcm').value = _cdMm(state.imgWcm);
                document.getElementById('imgHcm').value = _cdMm(state.imgHcm);
                const oW = document.getElementById('orderWcm'); if (oW) oW.value = _cdMm(state.orderWcm);
                const oH = document.getElementById('orderHcm'); if (oH) oH.value = _cdMm(state.orderHcm);
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
                showToast(window.cdT ? window.cdT('pattern_loaded_toast') : '✅ 패턴 로드 완료! 원단을 선택하고 사이즈를 조정해보세요.');
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
    if (window._cdApplyFabricChipPhotos) _cdApplyFabricChipPhotos(); // 칩 썸네일 (사진 있으면)
    if (window._cdInitFabricTooltips) _cdInitFabricTooltips(); // 호버/터치 시 원단 특징 툴팁
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

// ════════════════════════════════════════════════════
// 2026-05-30: 패브릭 상세 + 리뷰 시스템
//   상세: common_info 테이블 — 대분류='22222' (패브릭인쇄) section='top' 의 내용
//   리뷰: product_reviews 테이블 — (fabricType, fabricColor) → 광목 코드 (FG20N/FG30N/FSP 등) 매핑
//          seed-reviews.js 가 admin_products 의 실제 code 별로 시드한 가짜 리뷰가 자동으로 노출됨
// ════════════════════════════════════════════════════
const _CD_RV_PAGE = 5;
// 2026-06-04: 기본 리뷰 필터 = 현재 사이트 언어 (JP 사이트는 JP 리뷰만 우선 노출). 비면 다국어 fallback.
function _cdDefaultRvLang() {
    try {
        var qp = new URLSearchParams(location.search).get('lang') || '';
        if (qp) return qp === 'ko' ? 'kr' : qp;
        var h = (location.hostname || '').toLowerCase();
        if (h.indexOf('cafe0101') >= 0) return 'ja';
        if (h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) return 'en';
    } catch(e) {}
    return 'kr';
}
window._cdRvState = { page:0, productCode:'', filterLang:_cdDefaultRvLang(), rating:5, photoFile:null };

// (fabricType, fabricColor) → admin_products code 매핑
// global_admin.html L2095-2107 의 코드와 일치
const _CD_FAB_TO_CODE = {
    // 면 종류 — 색상별 분기 (없는 색은 가까운 코드로 fallback)
    'cotton20:white':   'FG20W',
    'cotton20:natural': 'FG20N',
    'cotton20:ivory':   'FG20B',
    'cotton30:white':   'FG30B',  // 30수 white 미등록 → 백아이로 fallback
    'cotton30:natural': 'FG30N',
    'cotton30:ivory':   'FG30B',
    'cotton16:white':   'FG16N',  // 16수 white/ivory 미등록 → 네츄럴로 fallback
    'cotton16:natural': 'FG16N',
    'cotton16:ivory':   'FG16N',
    'cotton10:white':   'FG10N',  // 10수 white/ivory 미등록 → 네츄럴로 fallback
    'cotton10:natural': 'FG10N',
    'cotton10:ivory':   'FG10N',
    // 비-면 — 색상 무관
    'chiffon':  'FSP',
    'oxford':   'FO20B',
    'rayon':    'FB20R',
    'linen':    'FRN'
};
function _cdMapFabricToCode(type, color) {
    const f = FABRIC_TYPES[type];
    if (!f) return null;
    if (f.isCotton) return _CD_FAB_TO_CODE[type + ':' + (color || 'natural')] || null;
    return _CD_FAB_TO_CODE[type] || null;
}

// 패브릭인쇄 대분류 코드 (cotton_print.js L216 참조: top_category_code='22222')
const _CD_FABRIC_TOP_CAT = '22222';

function _cdLangCode() {
    var L = (window.__CD_LANG || 'ko').toLowerCase();
    if (L === 'ko') return 'kr';
    return L;
}

function _cdT(k, fallback) {
    return (window.cdT && window.cdT(k)) || fallback || '';
}

function _cdEscape(s) {
    return String(s || '').replace(/[<>&"]/g, function(c){ return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]; });
}

// 상세 정보 카드 — DB common_info 에서 대분류(패브릭인쇄, code='22222') 공통 컨텐츠 로드
//   global_admin.html 의 "상세페이지 통합 편집기" 에서 대분류=패브릭인쇄 / section=top 으로 저장한 내용을 그대로 표시.
//   다국어 컬럼: content (KR) / content_jp / content_us / content_cn / content_ar / content_es / content_de / content_fr
function _cdPickCommonInfoLang(row) {
    if (!row) return '';
    const L = (window.__CD_LANG || 'ko').toLowerCase();
    if (L === 'ja' && row.content_jp) return row.content_jp;
    if (L === 'en' && row.content_us) return row.content_us;
    if (L === 'zh' && row.content_cn) return row.content_cn;
    if (L === 'ar' && row.content_ar) return row.content_ar;
    if (L === 'es' && row.content_es) return row.content_es;
    if (L === 'de' && row.content_de) return row.content_de;
    if (L === 'fr' && row.content_fr) return row.content_fr;
    if (L !== 'ko' && L !== 'kr' && row.content_us) return row.content_us;
    return row.content || '';
}
async function renderFabricFullDetail() {
    const sec = document.getElementById('cdFabricDetailSec');
    const body = document.getElementById('cdDetailBody');
    const titleEl = document.getElementById('cdDetailTitle');
    if (!sec || !body) return;
    if (titleEl) titleEl.textContent = _cdT('cd_detail_title', '상품 상세정보');
    const sb = window.sb || window.__unified_sb;
    if (!sb) { sec.style.display = 'none'; return; }
    try {
        // 대분류 공통 + 전체 공통 (all) 동시 조회 — 대분류 우선, 없으면 all
        const { data } = await sb.from('common_info')
            .select('*')
            .in('category_code', [_CD_FABRIC_TOP_CAT, 'all'])
            .eq('section', 'top');
        const list = data || [];
        const catRow = list.find(function(r){ return r.category_code === _CD_FABRIC_TOP_CAT; });
        const allRow = list.find(function(r){ return r.category_code === 'all'; });
        const catHtml = _cdPickCommonInfoLang(catRow);
        const allHtml = _cdPickCommonInfoLang(allRow);
        // 2026-06-01: 대분류 우선, 없을 때만 'all' fallback.
        // 이전엔 concat 해서 — JP 의 'all' content_jp 에 골판지가벽 내용이 있으면
        // 패브릭 페이지 하단에 골판지가벽 상세가 붙어 나오던 버그.
        let combined = (catHtml && catHtml.trim()) ? catHtml : (allHtml || '');
        if (!combined.trim()) { sec.style.display = 'none'; return; }
        // 보안: <script> 제거. 내부 id 충돌 방지로 id 속성 제거.
        combined = combined.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\sid="[^"]*"/gi, '');
        body.innerHTML = combined;
        // 이미지 lazy + width 100%
        body.querySelectorAll('img').forEach(function(img){ img.loading = 'lazy'; img.style.maxWidth = '100%'; img.style.height = 'auto'; });
        sec.style.display = '';
    } catch (e) {
        console.warn('[cd] common_info detail load failed:', e);
        sec.style.display = 'none';
    }
}

async function loadFabricReviews(productCode, page) {
    const sb = window.sb || window.__unified_sb;
    if (!sb) return;
    window._cdRvState.productCode = productCode;
    window._cdRvState.page = page;
    const fl = window._cdRvState.filterLang || 'all';
    const from = page * _CD_RV_PAGE, to = from + _CD_RV_PAGE - 1;
    try {
        // 2026-06-04: 패브릭 메인 페이지처럼 cotton_showcase 도 같이 조회 — 사이트 언어 우선
        const _codes = [productCode, 'cotton_showcase'];
        let q = sb.from('product_reviews').select('*', { count:'exact' }).in('product_code', _codes);
        if (fl !== 'all') q = q.eq('lang', fl);
        let { data, count, error } = await q.order('created_at', { ascending:false }).range(from, to);
        if (error) { console.warn('[cd rv] load:', error.message); renderFabricReviews([], 0, page, 0); return; }
        // 그래도 0건이면 다국어 폴백 (페이지 0 때만)
        if (page === 0 && (!data || data.length === 0) && fl !== 'all') {
            let q2 = sb.from('product_reviews').select('*', { count:'exact' }).in('product_code', _codes);
            const r2 = await q2.order('created_at', { ascending:false }).range(from, to);
            if (r2.data && r2.data.length) {
                data = r2.data;
                count = r2.count;
                window._cdRvState.filterLang = 'all'; // 폴백 → 다국어로 잠금
            }
        }
        let avg = 0;
        const effLang = window._cdRvState.filterLang || 'all';
        if (page === 0 && (count || 0) > 0) {
            let aq = sb.from('product_reviews').select('rating').in('product_code', _codes);
            if (effLang !== 'all') aq = aq.eq('lang', effLang);
            const ar = await aq;
            if (ar.data && ar.data.length) avg = ar.data.reduce((s, x) => s + (x.rating || 0), 0) / ar.data.length;
        }
        renderFabricReviews(data || [], count || 0, page, avg);
    } catch (e) {
        console.warn('[cd rv] ex:', e);
        renderFabricReviews([], 0, 0, 0);
    }
}

// 2026-06-04: 현재 사용자 인증 정보 (관리자 또는 작성자 권한 체크용). 한 번만 fetch 후 캐시.
let _cdAuthCache = null;
async function _cdGetCurrentAuthInfo(force) {
    if (_cdAuthCache && !force) return _cdAuthCache;
    const sb = window.sb || window.__unified_sb;
    if (!sb) return { isAdmin: false, currentUserId: null };
    try {
        const { data: sess } = await sb.auth.getUser();
        const user = sess && sess.user;
        if (!user) { _cdAuthCache = { isAdmin: false, currentUserId: null }; return _cdAuthCache; }
        const ADMIN_EMAILS = ['korea900as@gmail.com', 'ceo@test.com', 'scr3257@naver.com'];
        let isAdmin = !!window.isAdmin || ADMIN_EMAILS.indexOf(user.email) >= 0;
        if (!isAdmin) {
            try {
                const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
                if (prof && (prof.role === 'admin' || prof.role === 'manager')) isAdmin = true;
            } catch(e) {}
        }
        if (isAdmin) window.isAdmin = true;
        _cdAuthCache = { isAdmin, currentUserId: user.id };
        return _cdAuthCache;
    } catch (e) {
        _cdAuthCache = { isAdmin: false, currentUserId: null };
        return _cdAuthCache;
    }
}

// 2026-06-04: 리뷰 삭제 (관리자 또는 작성자)
window._cdDeleteReview = async function(reviewId) {
    if (!reviewId) return;
    if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
    const sb = window.sb || window.__unified_sb;
    if (!sb) { alert('Supabase 연결 실패'); return; }
    try {
        const { error } = await sb.from('product_reviews').delete().eq('id', reviewId);
        if (error) throw error;
        const card = document.querySelector('[data-rv-id="' + reviewId + '"]');
        if (card && card.parentNode) card.parentNode.removeChild(card);
    } catch (e) {
        alert('삭제 실패: ' + (e.message || e));
    }
};

// 2026-06-04: 리뷰 인라인 편집 (관리자 또는 작성자)
window._cdEditReview = function(reviewId, btnEl) {
    if (!reviewId || !btnEl) return;
    const card = btnEl.closest('[data-rv-id]');
    if (!card) return;
    const commentEl = card.querySelector('[data-rv-comment]');
    if (!commentEl) return;
    const oldText = commentEl.textContent;
    const ta = document.createElement('textarea');
    ta.value = oldText;
    ta.rows = 3;
    ta.style.cssText = 'width:100%; padding:8px; border:1.5px solid #6366f1; border-radius:6px; font-size:13px; font-family:inherit; resize:vertical; box-sizing:border-box;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 저장';
    saveBtn.style.cssText = 'padding:6px 14px; border:none; background:#0f172a; color:#fff; border-radius:5px; font-size:11.5px; font-weight:800; cursor:pointer; font-family:inherit;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.style.cssText = 'padding:6px 14px; border:1.5px solid #cbd5e1; background:#fff; color:#475569; border-radius:5px; font-size:11.5px; font-weight:800; cursor:pointer; font-family:inherit; margin-left:6px;';
    const editBox = document.createElement('div');
    editBox.setAttribute('data-rv-edit-box', '');
    editBox.style.marginTop = '8px';
    editBox.appendChild(ta);
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'margin-top:8px; display:flex; justify-content:flex-end; align-items:center;';
    btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
    editBox.appendChild(btnRow);
    commentEl.style.display = 'none';
    commentEl.parentNode.insertBefore(editBox, commentEl.nextSibling);
    ta.focus();
    saveBtn.onclick = async function() {
        const sb = window.sb || window.__unified_sb;
        if (!sb) { alert('Supabase 연결 실패'); return; }
        const newText = ta.value.trim();
        if (!newText) { alert('내용을 입력해주세요'); return; }
        saveBtn.disabled = true; saveBtn.textContent = '저장 중…';
        try {
            const { error } = await sb.from('product_reviews').update({ comment: newText }).eq('id', reviewId);
            if (error) throw error;
            commentEl.textContent = newText;
            commentEl.style.display = '';
            editBox.parentNode.removeChild(editBox);
        } catch(e) {
            alert('저장 실패: ' + (e.message || e));
            saveBtn.disabled = false; saveBtn.textContent = '💾 저장';
        }
    };
    cancelBtn.onclick = function() {
        commentEl.style.display = '';
        editBox.parentNode.removeChild(editBox);
    };
};

async function renderFabricReviews(reviews, total, page, avg) {
    const listEl = document.getElementById('cdReviewList');
    const sumEl = document.getElementById('cdReviewSummary');
    const moreBtn = document.getElementById('cdBtnLoadMore');
    const countEl = document.getElementById('cdReviewCount');
    if (!listEl) return;
    if (page === 0) {
        if (total > 0 && sumEl) {
            const a = (avg || 0).toFixed(1);
            const fs = Math.round(avg || 0);
            const stars = '★'.repeat(Math.min(fs, 5)) + '☆'.repeat(Math.max(5 - fs, 0));
            sumEl.innerHTML = '<div style="font-size:32px; font-weight:900; color:#f59e0b; line-height:1;">' + a + '</div>'
                           + '<div><div style="font-size:18px; color:#f59e0b; letter-spacing:2px;">' + stars + '</div>'
                           + '<div style="font-size:12px; color:#64748b; margin-top:4px;">' + total + ' ' + _cdT('cd_review_count', '개의 리뷰') + '</div></div>';
            sumEl.style.display = 'flex';
        } else if (sumEl) {
            sumEl.style.display = 'none';
        }
        if (countEl) countEl.textContent = total > 0 ? (total + ' ' + _cdT('cd_review_count', '리뷰')) : '';
        listEl.innerHTML = '';
    }
    if (total === 0 && page === 0) {
        listEl.innerHTML = '<div style="padding:30px; text-align:center; color:#94a3b8; font-size:14px; border:1px dashed #e5e7eb; border-radius:10px;">' + _cdT('cd_review_none', '아직 리뷰가 없습니다') + '</div>';
        if (moreBtn) moreBtn.style.display = 'none';
        return;
    }
    // 2026-06-04: 권한 정보 (관리자 또는 작성자에게만 수정/삭제 노출)
    const _auth = await _cdGetCurrentAuthInfo();
    reviews.forEach(function(r){
        const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
        const photoHtml = r.photo_url ? '<img src="' + r.photo_url + '" class="rv-photo" onclick="window._cdOpenRvPhoto(\'' + r.photo_url + '\')">' : '';
        const _isOwner = !!(_auth.currentUserId && r.user_id && String(r.user_id) === String(_auth.currentUserId));
        const _canEdit = !!(_auth.isAdmin || _isOwner);
        const actionsHtml = _canEdit ? (
            '<div class="rv-actions" style="display:flex; gap:6px; margin-top:8px; justify-content:flex-end;">' +
                '<button type="button" onclick="window._cdEditReview(\'' + r.id + '\', this)" style="padding:5px 10px; border:1px solid #cbd5e1; background:#fff; color:#475569; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit;">✏️ 수정</button>' +
                '<button type="button" onclick="window._cdDeleteReview(\'' + r.id + '\')" style="padding:5px 10px; border:1px solid #fca5a5; background:#fff; color:#dc2626; border-radius:5px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit;">🗑️ 삭제</button>' +
            '</div>'
        ) : '';
        const div = document.createElement('div');
        div.className = 'rv-item';
        div.setAttribute('data-rv-id', r.id);
        div.innerHTML = '<div class="rv-head"><span class="rv-name">' + _cdEscape(r.user_name || 'Anonymous') + '</span><span class="rv-date">' + date + '</span></div>'
                      + '<div class="rv-stars">' + stars + '</div>'
                      + '<div class="rv-comment" data-rv-comment>' + _cdEscape(r.comment || '') + '</div>' + photoHtml + actionsHtml;
        listEl.appendChild(div);
    });
    const loaded = (page + 1) * _CD_RV_PAGE;
    if (moreBtn) moreBtn.style.display = loaded < total ? 'block' : 'none';
}

window._cdLoadMoreReviews = function() {
    const s = window._cdRvState;
    loadFabricReviews(s.productCode, (s.page || 0) + 1);
};

window._cdFilterReviews = function(lang) {
    window._cdRvState.filterLang = lang;
    document.querySelectorAll('#cdRvFlagBar .cd-flag-btn').forEach(function(b){
        b.classList.toggle('active', b.dataset.lang === lang);
    });
    loadFabricReviews(window._cdRvState.productCode, 0);
};

window._cdOpenRvPhoto = function(url) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; cursor:zoom-out;';
    ov.innerHTML = '<img src="' + url + '" style="max-width:92vw; max-height:92vh; border-radius:8px; box-shadow:0 20px 60px rgba(0,0,0,0.5);">';
    ov.onclick = function(){ ov.remove(); };
    document.body.appendChild(ov);
};

window._cdSetRvRating = function(n) {
    window._cdRvState.rating = n;
    for (let i = 1; i <= 5; i++) {
        const st = document.getElementById('cdStar' + i);
        if (st) st.className = 'fa-' + (i <= n ? 'solid' : 'regular') + ' fa-star';
    }
};

window._cdRvPhotoChange = function(input) {
    const file = input.files[0];
    const prev = document.getElementById('cdRvPhotoPrev');
    if (!file) { window._cdRvState.photoFile = null; if (prev) prev.innerHTML = ''; return; }
    // 2026-05-30: File 객체 그대로 보관 — Storage RLS 통과 위해 원본 file (filename/type 메타데이터 포함) 사용.
    //             FileReader 는 미리보기 표시용으로만 사용.
    window._cdRvState.photoFile = file;
    const reader = new FileReader();
    reader.onload = function(e){
        if (prev) prev.innerHTML = '<img src="' + e.target.result + '" style="max-width:120px; max-height:120px; border-radius:8px; margin-top:8px; object-fit:cover;">';
    };
    reader.readAsDataURL(file);
};

window._cdSubmitReview = async function() {
    const sb = window.sb || window.__unified_sb;
    if (!sb) { showToast('DB error'); return; }
    // 세션 사용자 (cotton_designer 는 window.currentUser 를 채우지 않으므로 직접 조회)
    let user = null;
    try {
        if (sb.auth && sb.auth.getSession) {
            const sess = await sb.auth.getSession();
            user = sess && sess.data && sess.data.session && sess.data.session.user || null;
        }
    } catch (e) {}
    if (!user) user = window.currentUser || window._cpCurrentUser || null;

    let name, userId;
    if (user) {
        const meta = user.user_metadata || {};
        name = meta.full_name || meta.name || (user.email || '').split('@')[0] || 'User';
        userId = user.id || null;
    } else {
        const ne = document.getElementById('cdReviewNick');
        name = ne ? ne.value.trim() : '';
        if (!name) { alert(_cdT('cd_review_login_or_nick', '닉네임을 입력해주세요')); return; }
        // 2026-05-30 fix: product_reviews.user_id 는 UUID 타입 → 게스트는 null 사용 (seed-reviews.js 와 동일).
        //   ('guest_<ts>' 는 'invalid input syntax for type uuid' 로 22P02 에러 발생.)
        userId = null;
    }
    const ce = document.getElementById('cdReviewComment');
    const comment = ce ? ce.value.trim() : '';
    if (!comment) { alert(_cdT('cd_review_comment_min', '내용을 입력해주세요')); return; }

    // 2026-05-30 fix: 제출 lang 은 (1) 국가 필터가 'all' 이 아니면 그 필터 lang, (2) 아니면 UI lang.
    // 사용자가 JP 깃발 클릭 후 일본어 입력 → lang='ja' 저장 → JP 필터에 즉시 노출됨.
    const filterL = window._cdRvState.filterLang || 'all';
    const submitLang = (filterL && filterL !== 'all') ? filterL : _cdLangCode();

    let photoUrl = null;
    const photoFile = window._cdRvState.photoFile;
    if (photoFile) {
        try {
            // 2026-05-30 fix: 'review-photos' 버킷은 RLS 가 익명 업로드 차단 ("new row violates RLS").
            //   cotton_print.html L2688-2691 의 showcase 가 이미 검증한 익명-OK 패턴 따라감 → 'design' 버킷 + 'reviews/' 경로 prefix.
            const safeName = (photoFile.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = 'reviews/' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '_' + safeName;
            const up = await sb.storage.from('design').upload(path, photoFile, {
                cacheControl: '3600',
                upsert: false
            });
            if (up.error) {
                console.error('[cd rv] photo upload error:', up.error.message || up.error);
            } else if (up.data) {
                const u = sb.storage.from('design').getPublicUrl(up.data.path);
                photoUrl = u && u.data && u.data.publicUrl || null;
            }
        } catch (e) { console.warn('[cd rv] photo upload exception:', e); }
    }
    const code = window._cdRvState.productCode || _cdMapFabricToCode(state.fabricType, state.fabricColor) || ('fab_' + state.fabricType);
    // 2026-05-30 fix: index.html submit schema 와 일치 (user_id + is_fake:false) — RLS 정책 통과 보장.
    const { error } = await sb.from('product_reviews').insert({
        product_code: code,
        user_id: userId,
        user_name: name,
        rating: window._cdRvState.rating || 5,
        comment: comment,
        photo_url: photoUrl,
        lang: submitLang,
        is_fake: false
    });
    if (error) {
        console.error('[cd rv] insert error:', error);
        alert('Submit failed: ' + (error.message || 'unknown'));
        return;
    }
    showToast(_cdT('cd_review_submitted', '리뷰가 등록되었습니다 ✨'));
    if (ce) ce.value = '';
    const ne = document.getElementById('cdReviewNick'); if (ne) ne.value = '';
    window._cdRvState.photoFile = null;
    const pp = document.getElementById('cdRvPhotoPrev'); if (pp) pp.innerHTML = '';
    window._cdSetRvRating(5);
    // 제출 lang 으로 필터 자동 전환 (현재 필터와 다르면) → 방금 쓴 리뷰가 바로 보임
    if (filterL !== 'all' && filterL !== submitLang) {
        window._cdFilterReviews(submitLang);
    } else if (filterL === 'all') {
        loadFabricReviews(code, 0);
    } else {
        loadFabricReviews(code, 0);
    }
};

async function renderRvWriteForm() {
    const area = document.getElementById('cdReviewWriteArea');
    if (!area) return;
    // 세션 직접 조회 (cotton_designer 는 window.currentUser 안 채움)
    let user = window.currentUser || window._cpCurrentUser || null;
    if (!user) {
        try {
            const sb = window.sb || window.__unified_sb;
            if (sb && sb.auth && sb.auth.getSession) {
                const s = await sb.auth.getSession();
                user = s && s.data && s.data.session && s.data.session.user || null;
            }
        } catch (e) {}
    }
    let nickRow;
    if (user) {
        const meta = user.user_metadata || {};
        const dn = meta.full_name || meta.name || (user.email || '').split('@')[0];
        // 2026-05-30: 메인 상품 페이지 리뷰 폼과 동일 — 아이콘+이름을 인디고 박스 안에 표시
        nickRow = '<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; margin-bottom:10px;">'
                + '<i class="fa-solid fa-user-circle" style="color:#6366f1; font-size:18px;"></i>'
                + '<span style="font-weight:600; color:#4338ca;">' + _cdEscape(dn) + '</span>'
                + '</div>';
    } else {
        nickRow = '<input type="text" id="cdReviewNick" class="cd-input" placeholder="' + _cdT('cd_review_nick_ph', '닉네임') + '" maxlength="20" style="margin-bottom:10px;">';
    }
    area.innerHTML = '<div class="cd-write-box">'
        + '<div style="font-weight:700; font-size:14px; margin-bottom:10px; color:#0f172a;">' + _cdT('cd_review_write', '리뷰 작성') + '</div>'
        + nickRow
        + '<div class="cd-star-row">'
        + [1,2,3,4,5].map(function(n){ return '<i id="cdStar' + n + '" class="fa-solid fa-star" onclick="window._cdSetRvRating(' + n + ')"></i>'; }).join('')
        + '</div>'
        + '<textarea id="cdReviewComment" class="cd-textarea" placeholder="' + _cdT('cd_review_comment_ph', '리뷰를 남겨주세요') + '"></textarea>'
        + '<div id="cdRvPhotoPrev"></div>'
        + '<div style="display:flex; gap:10px; margin-top:12px;">'
        + '<label class="cd-photo-btn" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">'
        + '<i class="fa-solid fa-camera"></i> ' + _cdT('cd_review_photo', '사진 첨부')
        + '<input type="file" accept="image/*" style="display:none;" onchange="window._cdRvPhotoChange(this)">'
        + '</label>'
        + '<button class="cd-submit-btn" style="flex:1;" onclick="window._cdSubmitReview()">' + _cdT('cd_review_submit', '리뷰 등록') + '</button>'
        + '</div>'
        + '</div>';
}

function renderRvFlagBar() {
    const bar = document.getElementById('cdRvFlagBar');
    if (!bar) return;
    const cur = window._cdRvState.filterLang || 'all';
    // 2026-05-30: 9개 국가 깃발 (메인 상품 페이지 리뷰 시스템과 동일)
    // flagcdn 의 국가 코드 매핑 — ja→jp, en→us, zh→cn, ar→sa
    const _flagImgMap = { kr:'kr', ja:'jp', en:'us', zh:'cn', ar:'sa', es:'es', de:'de', fr:'fr' };
    const flags = [
        { code:'all' }, { code:'kr' }, { code:'ja' }, { code:'en' },
        { code:'zh' }, { code:'ar' }, { code:'es' }, { code:'de' }, { code:'fr' }
    ];
    bar.innerHTML = flags.map(function(f){
        const isAct = f.code === cur;
        const inner = f.code === 'all'
            ? '<i class="fa-solid fa-globe" style="font-size:18px; color:#6366f1;"></i>'
            : '<img src="https://flagcdn.com/w40/' + _flagImgMap[f.code] + '.png" alt="' + f.code + '" loading="lazy" style="width:26px; height:26px; object-fit:cover; border-radius:50%;">';
        return '<button class="cd-flag-btn ' + (isAct ? 'active' : '') + '" data-lang="' + f.code + '" onclick="window._cdFilterReviews(\'' + f.code + '\')">' + inner + '</button>';
    }).join('');
}

// 통합 진입점 — 페이지 로드 + fabricType/Color 변경 시 호출
window._cdRefreshDetailAndReviews = function() {
    try {
        renderFabricFullDetail();  // async, but fire-and-forget OK
        renderRvWriteForm();
        renderRvFlagBar();
        // 리뷰 코드 — admin_products 의 실제 코드 (FG20N 등) 와 동일하게 매핑
        const code = _cdMapFabricToCode(state.fabricType, state.fabricColor);
        if (!code) {
            // 매핑 없으면 fallback 으로 fab_<type>
            window._cdRvState.productCode = 'fab_' + state.fabricType;
        } else {
            window._cdRvState.productCode = code;
        }
        window._cdRvState.filterLang = 'all';
        window._cdRvState.page = 0;
        window._cdRvState.rating = 5;
        loadFabricReviews(window._cdRvState.productCode, 0);
    } catch (e) {
        console.warn('[cd] detail+reviews refresh failed:', e);
    }
};

// 페이지 로드 + sb 준비 후 첫 호출 (sb 가 cart_sync 등 외부에서 늦게 set 될 수 있어 polling)
(function _cdInitDetailReviews() {
    let tries = 0;
    function tryInit() {
        if (window.sb || window.__unified_sb) {
            window._cdRefreshDetailAndReviews();
        } else if (tries++ < 40) {
            setTimeout(tryInit, 200);
        } else {
            // sb 못 잡으면 상세만 (FABRIC_TYPES 기반) 렌더, 리뷰는 빈 상태
            renderFabricFullDetail();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
})();

// 2026-05-13: 스크립트 로드 전에 사용자가 누른 버튼/업로드 이벤트 (cotton_designer.html 의
// 인라인 스텁이 대기열에 쌓아둔 것) 을 비움 → 첫 클릭이 무시되지 않도록
try { if (typeof window.__cdFlushPending === 'function') window.__cdFlushPending(); } catch (e) {}

})();
