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
        }
    };

    function ls(key) {
        var entry = LANG_STRINGS[key];
        if (!entry) return '';
        return entry[psLang] || entry['ko'] || '';
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

    // 상품 카드 생성
    function createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';

        const name = getProductName(product);
        const imgSrc = getThumb(product.img_url, 400);
        const sizeText = getSizeText(product);
        const price = formatPrice(product.price);

        card.innerHTML =
            '<img class="product-img" src="' + imgSrc + '" alt="' + name + '" loading="lazy" ' +
                'onerror="this.src=\'https://placehold.co/400?text=No+Image\'">' +
            '<div class="product-info">' +
                '<div class="product-badge">' + ls('badge') + '</div>' +
                '<div class="product-name">' + name + '</div>' +
                '<div class="product-size"><i class="fa-solid fa-ruler" style="margin-right:4px;"></i>' + sizeText + '</div>' +
                '<div class="product-price">' + LANG.fromPrice + ' ' + price + '</div>' +
            '</div>';

        // 클릭 시 메인 에디터로 이동 (언어별 도메인)
        card.onclick = function() {
            var lang = window.__PS_LANG || 'ko';
            var base;
            if (lang === 'ko') base = 'https://www.cafe2626.com';
            else if (lang === 'ja') base = 'https://www.cafe0101.com';
            else if (lang === 'en') base = 'https://chameleon.design';
            else base = 'https://chameleon.design';
            var params = '?product=' + encodeURIComponent(product.code);
            if (lang !== 'ko' && lang !== 'ja' && lang !== 'en') params += '&lang=' + lang;
            window.location.href = base + '/' + params;
        };

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
            // 1단계: Wholesale Board Prices 대분류의 모든 소분류 코드 조회
            const { data: subCats } = await sb.from('admin_categories')
                .select('code')
                .eq('top_category_code', 'Wholesale Board Prices');
            const catCodes = (subCats || []).map(function(c) { return c.code; });
            if (catCodes.length === 0) catCodes.push('Honeycomb Board');

            // 2단계: 모든 소분류의 상품 조회
            const { data: products, error } = await sb.from('admin_products')
                .select('*')
                .in('category', catCodes);

            if (error) throw error;

            const visible = (products || []).sort(function(a, b) { return (a.sort_order || 999) - (b.sort_order || 999); });

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
            console.error('[raw_board] 상품 로딩 실패:', e);
            grid.innerHTML = '<div class="empty-state"><p>' + ls('errorLoad') + '</p></div>';
        }
    }

    // 초기화
    document.addEventListener('DOMContentLoaded', loadProducts);

})();
