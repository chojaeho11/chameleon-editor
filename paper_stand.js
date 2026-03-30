// paper_stand.js — 종이매대 전용 페이지 로직

(function() {
    'use strict';

    const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    // 언어별 설정 (향후 언어별 페이지 확장용)
    const LANG = {
        code: 'kr',
        currency: ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'JP' || (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'CN') ? '¥' : ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'US') ? '$' : ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'ES' || (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'DE' || (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'FR') ? '€' : ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'AR') ? '$' : ((window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) === 'KR' || !(window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY)) ? '원' : '$',
        currencyRate: (window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE && window.SITE_CONFIG.CURRENCY_RATE[window.SITE_CONFIG.COUNTRY]) || 1,
        noProducts: '종이매대 상품을 준비 중입니다.',
        loading: '상품 불러오는 중...',
        sizeUnit: 'mm',
        customSize: '맞춤 사이즈',
        fromPrice: '~'
    };

    let sb = null;

    // Supabase 초기화
    function initSupabase() {
        if (typeof window.supabase === 'undefined') return null;
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // 가격 포맷
    function formatPrice(krwPrice) {
        const converted = (krwPrice || 0) * LANG.currencyRate;
        return Math.round(converted).toLocaleString() + LANG.currency;
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

    // 상품명 (한국어 우선)
    function getProductName(p) {
        return p.name_kr || p.name || '상품명 없음';
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
                '<div class="product-badge">종이매대</div>' +
                '<div class="product-name">' + name + '</div>' +
                '<div class="product-size"><i class="fa-solid fa-ruler" style="margin-right:4px;"></i>' + sizeText + '</div>' +
                '<div class="product-price">' + LANG.fromPrice + ' ' + price + '</div>' +
            '</div>';

        // 클릭 시 메인 에디터로 이동 (캐시 우회)
        card.onclick = function() {
            window.location.href = '/?product=' + encodeURIComponent(product.code) + '&_t=' + Date.now();
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
            grid.innerHTML = '<div class="empty-state"><p>연결 중 오류가 발생했습니다. 새로고침해주세요.</p></div>';
            return;
        }

        try {
            // pd_ 로 시작하는 모든 종이매대 상품 조회
            const { data: products, error } = await sb.from('admin_products')
                .select('*')
                .like('code', 'pd\\_%');

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
            console.error('[paper_stand] 상품 로딩 실패:', e);
            grid.innerHTML = '<div class="empty-state"><p>상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p></div>';
        }
    }

    // 초기화
    document.addEventListener('DOMContentLoaded', loadProducts);

})();
