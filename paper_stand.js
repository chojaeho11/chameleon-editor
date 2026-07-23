// paper_stand.js — 종이매대 전용 페이지 로직

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
            ko:'종이매대 상품을 준비 중입니다.',
            ja:'紙什器商品を準備中です。',
            en:'Paper display products are coming soon.',
            zh:'纸展架产品正在准备中。',
            ar:'منتجات الحوامل الورقية قادمة قريبا.',
            es:'Los productos expositores estaran disponibles pronto.',
            de:'Papieraufsteller-Produkte kommen bald.',
            fr:'Les produits presentoirs arrivent bientot.'
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
            ko:'종이매대', ja:'紙什器', en:'Cardboard Display',
            zh:'纸展架', ar:'حامل ورقي', es:'Expositor',
            de:'Papierstand', fr:'Presentoir'
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
        // 2026-07-18: 상세(주문 에디터) 페이지가 무거워 수 초 걸림 → 이동 중임을 즉시 표시
        opening: {
            ko:'상품 페이지 여는 중...', ja:'商品ページを開いています...', en:'Opening product page...',
            zh:'正在打开产品页面...', ar:'جاري فتح صفحة المنتج...', es:'Abriendo la pagina del producto...',
            de:'Produktseite wird geoffnet...', fr:'Ouverture de la page produit...'
        }
    };

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

    // 이미지 최적화 (Supabase transform)
    function getThumb(url, size) {
        if (!url || typeof url !== 'string') return 'https://placehold.co/400?text=No+Image';
        if (url.includes('supabase.co') && url.includes('/storage/')) {
            const sep = url.includes('?') ? '&' : '?';
            return url + sep + 'width=' + size + '&resize=contain';
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

    // 2026-07-18: 상품 상세로 이동할 URL (언어별 도메인)
    function productHref(product) {
        var lang = window.__PS_LANG || 'ko';
        var base;
        if (lang === 'ko') base = 'https://www.cafe2626.com';
        else if (lang === 'ja') base = 'https://www.cafe0101.com';
        else base = 'https://chameleon.design';
        var params = '?product=' + encodeURIComponent(product.code);
        if (lang !== 'ko' && lang !== 'ja' && lang !== 'en') params += '&lang=' + lang;
        return base + '/' + params;
    }

    // 2026-07-18: 이동 중 오버레이 — 상세 페이지(메인 에디터)가 무거워 로드에 수 초 걸린다.
    //   그동안 아무 반응이 없어 고객이 계속 다시 클릭 → 진행 중이던 이동이 매번 취소돼
    //   "여러 번 눌러야 겨우 들어가는" 증상이 났음. 즉시 피드백 + 중복 클릭 차단으로 해결.
    var _psNavigating = false;
    function showNavOverlay() {
        if (document.getElementById('psNavOverlay')) return;
        var ov = document.createElement('div');
        ov.id = 'psNavOverlay';
        ov.style.cssText = 'position:fixed; inset:0; z-index:1000100; background:rgba(255,255,255,0.82);'
            + ' display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px;'
            + ' font-family:inherit; color:#4338ca; font-size:15px; cursor:progress;';
        ov.innerHTML = '<div class="loading-spinner"></div><div>' + ls('opening') + '</div>';
        document.body.appendChild(ov);
    }

    // 상품 카드 생성
    function createProductCard(product) {
        // 2026-07-18: div → a 로 변경. 진짜 링크라 새 탭 열기·주소 미리보기가 되고,
        //   JS 핸들러가 늦게 붙거나 실패해도 이동은 브라우저가 보장한다.
        const card = document.createElement('a');
        card.className = 'product-card';
        card.href = productHref(product);

        const name = getProductName(product);
        const imgSrc = getThumb(product.img_url, 400);
        const sizeText = getSizeText(product);
        // 2026-07-15: 카드 표기 = 실제 주문 단가(정가)와 일치. 이전엔 ×0.5(50% 할인가)만 크게 보여줘
        //   상세/주문 결제금액(정가)과 표기가 어긋났음(사장님 지적). 정가 그대로 표시.
        var price = formatPrice(product.price);

        card.innerHTML =
            '<img class="product-img" src="' + imgSrc + '" alt="' + name + '" loading="lazy" ' +
                'onerror="this.src=\'https://placehold.co/400?text=No+Image\'">' +
            '<div class="product-info">' +
                '<div class="product-badge">' + ls('badge') + '</div>' +
                '<div class="product-name">' + name + '</div>' +
                '<div class="product-size"><i class="fa-solid fa-ruler" style="margin-right:4px;"></i>' + sizeText + '</div>' +
                '<div class="product-price">' + price + '</div>' +
            '</div>';

        // 클릭 = 기본 링크 이동. 두 번째부터의 클릭은 막아 진행 중인 이동이 취소되지 않게 한다.
        card.addEventListener('click', function(e) {
            // 새 탭/새 창(Ctrl·Cmd·가운데버튼)은 그대로 브라우저에 맡김
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
            if (_psNavigating) { e.preventDefault(); return; }
            _psNavigating = true;
            showNavOverlay();
        });

        return card;
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
            // pd_ 로 시작하는 모든 종이매대 상품 조회
            const { data: products, error } = await sb.from('admin_products')
                .select('*')
                .or('code.like.pd\\_%,is_paper_display.eq.true');

            if (error) throw error;

            // 2026-06-12: 종이 칸막이 (paper partition) 노출 제외 — 사용자 요청
            const _EXCLUDE_KEYWORDS = ['칸막이', '간막이', 'partition', 'パーティション', '隔板'];
            function _isExcluded(p) {
                var names = [p.name_kr, p.name_jp, p.name_us, p.name_en, p.name_cn, p.name].filter(Boolean);
                return names.some(function(n){
                    var s = String(n || '').toLowerCase();
                    return _EXCLUDE_KEYWORDS.some(function(k){ return s.indexOf(String(k).toLowerCase()) >= 0; });
                });
            }
            const visible = (products || [])
                .filter(function(p){ return !_isExcluded(p); })
                .sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });

            grid.innerHTML = '';

            if (visible.length === 0) {
                grid.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            visible.forEach(function(product) {
                grid.appendChild(createProductCard(product));
            });

        } catch (e) {
            console.error('[paper_stand] 상품 로딩 실패:', e);
            grid.innerHTML = '<div class="empty-state"><p>' + ls('errorLoad') + '</p></div>';
        }
    }

    // 초기화
    document.addEventListener('DOMContentLoaded', loadProducts);

    // 2026-07-18: 뒤로가기(bfcache 복귀) 시 이동중 잠금·오버레이 해제 — 안 풀면 카드가 안 눌림
    window.addEventListener('pageshow', function() {
        _psNavigating = false;
        var ov = document.getElementById('psNavOverlay');
        if (ov) ov.remove();
    });

})();
