// raw_board.js — 허니콤보드 원판 전용 페이지 로직

(function() {
    'use strict';

    const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    // 언어 감지 (URL param > hostname > default)
    var psLang = window.__PS_LANG || 'ko';

    // 언어별 통화 설정
    var CURRENCY_MAP = {
        ko: { symbol: '원', rate: 1 },
        ja: { symbol: '¥', rate: 0.1 },
        en: { symbol: '$', rate: 0.001 },
        zh: { symbol: '¥', rate: 0.1 },
        ar: { symbol: '$', rate: 0.001 },
        es: { symbol: '€', rate: 0.001 },
        de: { symbol: '€', rate: 0.001 },
        fr: { symbol: '€', rate: 0.001 }
    };

    var langCurrency = CURRENCY_MAP[psLang] || CURRENCY_MAP['ko'];

    // SITE_CONFIG이 있으면 그쪽 우선
    var siteRate = (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE[window.SITE_CONFIG.COUNTRY]);

    // 언어별 설정
    var LANG_STRINGS = {
        noProducts: {
            ko:'허니콤보드 원판 상품을 준비 중입니다.',
            ja:'ハニカムボード原板を準備中です。',
            en:'Raw honeycomb board products are coming soon.',
            zh:'蜂窝原板产品正在准备中。',
            ar:'منتجات الألواح الخام قادمة قريبا.',
            es:'Los tableros en bruto estaran disponibles pronto.',
            de:'Wabenplatten-Rohware kommt bald.',
            fr:'Les panneaux bruts arrivent bientot.'
        },
        loading: {
            ko:'상품 불러오는 중...', ja:'商品読み込み中...', en:'Loading products...',
            zh:'加载产品中...', ar:'جاري تحميل المنتجات...', es:'Cargando productos...',
            de:'Produkte laden...', fr:'Chargement des produits...'
        },
        customSize: {
            ko:'맞춤 사이즈', ja:'カスタムサイズ', en:'Custom Size',
            zh:'定制尺寸', ar:'مقاس مخصص', es:'Tamano Personalizado',
            de:'Individuelle Grosse', fr:'Taille Sur Mesure'
        },
        badge: {
            ko:'원판', ja:'原板', en:'Raw Board',
            zh:'原板', ar:'لوح خام', es:'Tablero Bruto',
            de:'Rohware', fr:'Brut'
        },
        errorConnect: {
            ko:'연결 중 오류가 발생했습니다. 새로고침해주세요.',
            ja:'接続エラーが発生しました。ページを更新してください。',
            en:'Connection error. Please refresh the page.',
            zh:'连接错误，请刷新页面。',
            ar:'خطا في الاتصال. يرجى تحديث الصفحة.',
            es:'Error de conexion. Por favor, recarga la pagina.',
            de:'Verbindungsfehler. Bitte aktualisieren Sie die Seite.',
            fr:'Erreur de connexion. Veuillez rafraichir la page.'
        },
        errorLoad: {
            ko:'상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
            ja:'商品を読み込めませんでした。しばらくしてからもう一度お試しください。',
            en:'Failed to load products. Please try again later.',
            zh:'无法加载产品，请稍后重试。',
            ar:'فشل تحميل المنتجات. يرجى المحاولة لاحقا.',
            es:'No se pudieron cargar los productos. Intentelo de nuevo mas tarde.',
            de:'Produkte konnten nicht geladen werden. Bitte versuchen Sie es spater erneut.',
            fr:'Impossible de charger les produits. Veuillez reessayer plus tard.'
        },
        noName: {
            ko:'상품명 없음', ja:'商品名なし', en:'No Name',
            zh:'无名称', ar:'بدون اسم', es:'Sin Nombre',
            de:'Kein Name', fr:'Sans Nom'
        },
        soldOut: {
            ko:'품절', ja:'品切れ', en:'Sold Out',
            zh:'售罄', ar:'نفد', es:'Agotado',
            de:'Ausverkauft', fr:'Épuisé'
        },
        inquiry: {
            ko:'비규격 문의', ja:'規格外はお問い合わせ', en:'Custom — Inquire',
            zh:'非标准 请咨询', ar:'استفسار للمقاسات الخاصة', es:'Consultar medida',
            de:'Sondermaß anfragen', fr:'Sur mesure — nous consulter'
        }
    };

    // 2026-09-16(사장님): 품절 표시 — 내지 컬러(그린/옐로우/레드/오렌지/블랙) + 방염보드 2종 + 특수소재 보드.
    var SOLD_OUT_CODES = ['456464566','34545354535','4566566','345345345','234343434','534534545','345453545','43535343545'];
    // 2026-09-15(사장님): 팔렛트 카테고리는 가격 대신 '비규격 문의' 표시.
    var INQUIRY_CATS = ['3454354534'];

    function ls(key) {
        var entry = LANG_STRINGS[key];
        if (!entry) return '';
        return entry[psLang] || entry['en'] || entry['ko'] || '';   // 2026-07-23: 영어 폴백
    }

    const LANG = {
        code: psLang,
        currency: langCurrency.symbol,
        currencyRate: siteRate || langCurrency.rate,
        noProducts: ls('noProducts'),
        loading: ls('loading'),
        sizeUnit: 'mm',
        customSize: ls('customSize'),
        fromPrice: '~'
    };

    let sb = null;

    // Supabase 초기화
    function initSupabase() {
        if (typeof window.supabase === 'undefined') return null;
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // 가격 포맷 (언어별 통화 위치)
    function formatPrice(krwPrice) {
        var converted = (krwPrice || 0) * LANG.currencyRate;
        var amount = Math.round(converted).toLocaleString();
        // 원화는 숫자 뒤, 나머지는 숫자 앞
        if (psLang === 'ko') return amount + LANG.currency;
        return LANG.currency + amount;
    }

    // 이미지 최적화 (Supabase Storage Image Transform)
    function getThumb(url, size) {
        if (!url || typeof url !== 'string') return 'https://placehold.co/400?text=No+Image';
        if (url.includes('supabase.co') && url.includes('/storage/v1/object/public/')) {
            return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=' + size + '&height=' + size + '&resize=contain&quality=80';
        }
        return url;
    }

    // 상품명 (언어별)
    function getProductName(p) {
        var nameMap = {
            ko: p.name_kr || p.name,
            ja: p.name_jp || p.name_kr || p.name,
            en: p.name_us || p.name_en || p.name_kr || p.name,
            zh: p.name_cn || p.name_kr || p.name,
            ar: p.name_us || p.name_en || p.name_kr || p.name,
            es: p.name_us || p.name_en || p.name_kr || p.name,
            de: p.name_us || p.name_en || p.name_kr || p.name,
            fr: p.name_us || p.name_en || p.name_kr || p.name
        };
        return nameMap[psLang] || p.name_kr || p.name || ls('noName');
    }

    // 사이즈 텍스트
    function getSizeText(p) {
        if (p.width_mm && p.height_mm) {
            return p.width_mm + ' x ' + p.height_mm + LANG.sizeUnit;
        }
        return LANG.customSize;
    }

    // 상품 카드 생성
    function createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';

        const name = getProductName(product);
        const imgSrc = getThumb(product.img_url, 400);
        const sizeText = getSizeText(product);
        const isSold = SOLD_OUT_CODES.indexOf(product.code) >= 0;
        const isInquiry = INQUIRY_CATS.indexOf(product.category) >= 0;
        // 비규격문의: 가격 대신 문구. 품절: 가격 위 품절 라벨.
        const priceHtml = isInquiry
            ? '<div class="product-price" style="color:#0f766e;">' + ls('inquiry') + '</div>'
            : '<div class="product-price">' + LANG.fromPrice + ' ' + formatPrice(product.price) + '</div>';
        if (isSold) card.classList.add('rb-soldout');

        card.innerHTML =
            '<div style="position:relative;">' +
            '<img class="product-img" src="' + imgSrc + '" alt="' + name + '" loading="lazy" ' +
                'onerror="this.src=\'https://placehold.co/400?text=No+Image\'">' +
            (isSold ? '<div class="rb-soldout-badge">' + ls('soldOut') + '</div>' : '') +
            '</div>' +
            '<div class="product-info">' +
                '<div class="product-badge">' + ls('badge') + '</div>' +
                '<div class="product-name">' + name + '</div>' +
                '<div class="product-size"><i class="fa-solid fa-ruler" style="margin-right:4px;"></i>' + sizeText + '</div>' +
                priceHtml +
            '</div>';

        // 클릭 시 hexa-board.com 도메인에서 상세/주문 (화이트라벨 — 카멜레온 노출 안 함)
        // 2026-05-30: 클릭 즉시 화면 어둠 처리 + 스피너 → 사용자가 "멈춰있다" 느끼지 않게 navigate 전 시각 피드백.
        card.onclick = function() {
            try { _rbShowNavLoading(); } catch (e) {}
            var lang = window.__PS_LANG || 'ko';
            var params = '?product=' + encodeURIComponent(product.code);
            if (lang && lang !== 'ko') params += '&lang=' + lang;
            // 약간의 지연 (브라우저가 prefetch 한 리소스를 활용해 새 페이지 진입을 더 빠르게 할 시간)
            setTimeout(function(){ window.location.href = 'https://www.hexa-board.com/' + params; }, 30);
        };

        return card;
    }

    // 2026-05-30: 카드 클릭 시 즉시 표시하는 풀스크린 로딩 오버레이 (멈춰있는 느낌 제거).
    //   navigate 직전 사용자에게 "처리 중" 시각 피드백.
    function _rbShowNavLoading() {
        if (document.getElementById('_rbNavLoading')) return;
        var ov = document.createElement('div');
        ov.id = '_rbNavLoading';
        ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);';
        ov.innerHTML = '<div style="background:#fff; padding:24px 32px; border-radius:16px; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:0 20px 60px rgba(0,0,0,0.3);">'
            + '<div style="width:38px; height:38px; border:4px solid #f1f5f9; border-top-color:#b45309; border-radius:50%; animation:_rbSp 0.7s linear infinite;"></div>'
            + '<div style="font-size:13px; font-weight:700; color:#451a03;">' + (window.__PS_LANG === 'ja' ? '読み込み中...' : window.__PS_LANG === 'en' ? 'Loading...' : '상품을 불러오는 중...') + '</div>'
            + '</div>'
            + '<style>@keyframes _rbSp{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
        document.body.appendChild(ov);
    }

    // 상품 로드
    async function loadProducts() {
        const grid = document.getElementById('productGrid');
        const emptyState = document.getElementById('emptyState');
        if (!grid) return;

        sb = initSupabase();
        if (!sb) {
            // Supabase 로딩 대기 (최대 3초)
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 100));
                sb = initSupabase();
                if (sb) break;
            }
        }

        if (!sb) {
            grid.innerHTML = '<div class="empty-state"><p>' + ls('errorConnect') + '</p></div>';
            return;
        }

        try {
            // 1단계: 소분류 목록 (정렬순서 포함)
            const { data: subCats } = await sb.from('admin_categories')
                .select('code, name, name_jp, name_us, name_cn, name_ar, name_es, name_de, name_fr, sort_order')
                .eq('top_category_code', 'Wholesale Board Prices')
                .order('sort_order', { ascending: true });
            if (!subCats || subCats.length === 0) {
                grid.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }
            const catCodes = subCats.map(function(c) { return c.code; });

            // 2단계: 모든 상품 조회
            const { data: products, error } = await sb.from('admin_products')
                .select('*')
                .in('category', catCodes);
            if (error) throw error;

            // 3단계: 렌더링 — 2026-09-15(사장님): 베스트상품(화이트 4종) 맨 위, 허니콤보드 16·10 통합(올크라프트 먼저), 그 외 카테고리 아래.
            grid.innerHTML = '';
            grid.style.display = 'block';
            grid.className = '';

            var _bg = { bg:'linear-gradient(135deg,#fef3c7,#fde68a)', bar:'#b45309', txt:'#92400e' };
            function _renderSection(title, prods, style){
                if (!prods || !prods.length) return;
                var st = style || _bg;
                var header = document.createElement('div');
                header.style.cssText = 'margin:32px 0 12px; padding:10px 16px; background:'+st.bg+'; border-radius:10px; border-left:4px solid '+st.bar+';';
                header.innerHTML = '<span style="font-size:16px; font-weight:800; color:'+st.txt+';">' + title + '</span>' +
                    '<span style="font-size:12px; color:'+st.bar+'; margin-left:8px;">(' + prods.length + ')</span>';
                grid.appendChild(header);
                var subGrid = document.createElement('div');
                subGrid.className = 'product-grid';
                prods.forEach(function(p){ subGrid.appendChild(createProductCard(p)); });
                grid.appendChild(subGrid);
            }
            function _catName(cat){
                var n = cat.name;
                if (psLang === 'ja' && cat.name_jp) n = cat.name_jp;
                else if (psLang === 'en' && cat.name_us) n = cat.name_us;
                else if (psLang === 'zh' && cat.name_cn) n = cat.name_cn;
                else if (psLang === 'ar' && cat.name_ar) n = cat.name_ar;
                else if (psLang === 'es' && cat.name_es) n = cat.name_es;
                else if (psLang === 'de' && cat.name_de) n = cat.name_de;
                else if (psLang === 'fr' && cat.name_fr) n = cat.name_fr;
                return n;
            }

            var BEST_CODES = ['53453455435','675756756765','345535456','34553545'];   // 16올화이트·16표면화이트/크라프트·10표면화이트/크라프트·10화이트 (1300×2500)
            // 2026-09-16(사장님): 위 4종과 동일하되 1300×3200 / 40,000원 (베스트 바로 아래 2번째 줄)
            var BEST2_CODES = ['hb16white3200','hb16kraft3200','hb10kraft3200','hb10white3200'];
            var CRAFT_FIRST = ['w23443243','3454353676'];                              // 16 올크라프트·10 올크라프트
            var HC_BOARD_CATS = ['Honeycomb Board','10mm34244'];                       // 16mm + 10mm 허니콤보드
            // 2026-09-16(사장님): 허니콤보드 섹션 순서 — 1행: 크라프트16·크라프트10·옐로우·코어 / 2행: 그린·레드·오렌지·블랙(내지컬러 4종 한 줄).
            var HC_ORDER = ['w23443243','3454353676','34545354535','34534534535','456464566','4566566','345345345','234343434'];
            var byCode = {}; (products || []).forEach(function(p){ byCode[p.code] = p; });
            var _sortSo = function(a,b){ return (a.sort_order||999)-(b.sort_order||999); };

            var hasAny = false;

            // (1) 베스트상품 — 화이트 4종(1300×2500) + 동일 4종(1300×3200) 을 한 섹션에 2줄로.
            var _allBestCodes = BEST_CODES.concat(BEST2_CODES);
            var best = _allBestCodes.map(function(c){ return byCode[c]; }).filter(Boolean);
            var _bestT = (psLang==='ja')?'⭐ ベスト商品':(psLang==='en')?'⭐ Best Sellers':(psLang==='zh')?'⭐ 热销商品':'⭐ 베스트 상품';
            if (best.length){ hasAny = true; _renderSection(_bestT, best, { bg:'linear-gradient(135deg,#ede9fe,#ddd6fe)', bar:'#7c3aed', txt:'#5b21b6' }); }

            // (2) 허니콤보드 (16·10mm 통합) — 베스트(2500·3200) 제외, HC_ORDER 명시 순서(모르는 코드는 sort_order 로 뒤에 append)
            var hcRest = (products || []).filter(function(p){ return HC_BOARD_CATS.indexOf(p.category) >= 0 && _allBestCodes.indexOf(p.code) < 0; });
            var _hcRank = function(p){ var i = HC_ORDER.indexOf(p.code); return i < 0 ? 900 + (p.sort_order||99) : i; };
            var hcMerged = hcRest.slice().sort(function(a,b){ return _hcRank(a) - _hcRank(b); });
            var _hcT = (psLang==='ja')?'ハニカムボード (16·10mm)':(psLang==='en')?'Honeycomb Board (16·10mm)':(psLang==='zh')?'蜂窝板 (16·10mm)':'허니콤보드 (16·10mm)';
            if (hcMerged.length){ hasAny = true; _renderSection(_hcT, hcMerged); }

            // (3) 그 외 카테고리 (방염보드·종이파렛트·특수소재 등) — 기존 소분류별
            subCats.forEach(function(cat){
                if (HC_BOARD_CATS.indexOf(cat.code) >= 0) return;   // 허니콤보드는 위에서 통합 렌더
                var catProducts = (products || []).filter(function(p){ return p.category === cat.code; }).sort(_sortSo);
                if (!catProducts.length) return;
                hasAny = true;
                _renderSection(_catName(cat), catProducts);
            });

            if (!hasAny) {
                grid.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
            }

        } catch (e) {
            console.error('[raw_board] 상품 로딩 실패:', e);
            grid.innerHTML = '<div class="empty-state"><p>' + ls('errorLoad') + '</p></div>';
        }
    }

    // 초기화
    document.addEventListener('DOMContentLoaded', loadProducts);

})();
