// ============================================================
// jp-nanami-fab.js — JP 사이트 전용 우측 하단 ナナミ 연락처 FAB
//   적용 조건: cafe0101.com / cotton-printer.com / lang=ja
//   기능: 우측 하단 그린 LINE 원형 버튼 → 클릭 시 ナナミ 전화/QR/LINE 모달
//   주입 방식: 어떤 페이지에 include 해도 안전 (이미 있으면 중복 생성 안 함)
// 2026-06-11
// ============================================================
(function(){
    'use strict';

    // 로케일 감지 — JP 아니면 즉시 종료
    function isJp() {
        try {
            var h = (location.hostname || '').toLowerCase();
            if (h.indexOf('cafe0101') >= 0) return true;
            if (h.indexOf('cotton-printer') >= 0) return true;
            // lang=ja 명시
            var u = new URLSearchParams(location.search);
            if ((u.get('lang') || '').toLowerCase() === 'ja') return true;
            // 미리 설정된 SITE_CODE
            if (window.__SITE_CODE === 'JP') return true;
            if (window.__PS_LANG === 'ja') return true;
            return false;
        } catch(e) { return false; }
    }

    if (!isJp()) return;

    function init() {
        if (document.getElementById('jpNanamiFab')) return; // 이미 주입됨

        var css = '\
            #jpNanamiFab {\
                position:fixed; bottom:24px; right:24px; width:62px; height:62px;\
                border-radius:50%; background:linear-gradient(135deg,#06C755,#04a247);\
                border:none; cursor:pointer; z-index:99998;\
                box-shadow:0 8px 28px rgba(6,199,85,0.45);\
                display:flex; align-items:center; justify-content:center;\
                transition:transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s;\
                animation:jpNanamiPulse 2.5s infinite;\
            }\
            #jpNanamiFab:hover { transform:scale(1.08); box-shadow:0 12px 36px rgba(6,199,85,0.6); }\
            #jpNanamiFab i { font-size:28px; color:#fff; }\
            #jpNanamiFab .jp-nan-badge {\
                position:absolute; top:-2px; right:-2px; min-width:18px; height:18px; padding:0 5px;\
                background:#ef4444; color:#fff; font-size:10px; font-weight:800;\
                border-radius:9px; display:flex; align-items:center; justify-content:center;\
                border:2px solid #fff; box-sizing:content-box;\
            }\
            @keyframes jpNanamiPulse {\
                0%, 100% { box-shadow:0 8px 28px rgba(6,199,85,0.45), 0 0 0 0 rgba(6,199,85,0.5); }\
                50% { box-shadow:0 10px 32px rgba(6,199,85,0.6), 0 0 0 14px rgba(6,199,85,0); }\
            }\
            #jpNanamiModal {\
                display:none; position:fixed; inset:0; z-index:99999;\
                background:rgba(0,0,0,0.65); align-items:center; justify-content:center; padding:16px;\
                font-family:"Pretendard Variable","Pretendard","Inter","Noto Sans JP",sans-serif;\
            }\
            #jpNanamiModal.is-open { display:flex; animation:jpNanamiFadeIn .25s ease; }\
            @keyframes jpNanamiFadeIn { from { opacity:0; } to { opacity:1; } }\
            #jpNanamiModal .jpn-card {\
                background:linear-gradient(165deg,#1f2937 0%,#0f172a 100%);\
                border:1px solid rgba(6,199,85,0.3); border-radius:18px;\
                padding:22px; width:100%; max-width:380px;\
                box-shadow:0 30px 60px -10px rgba(0,0,0,0.8);\
                position:relative;\
            }\
            #jpNanamiModal .jpn-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }\
            #jpNanamiModal .jpn-title { font-size:15px; font-weight:900; color:#86efac; letter-spacing:0.3px; }\
            #jpNanamiModal .jpn-close {\
                width:32px; height:32px; border-radius:50%; border:none;\
                background:rgba(255,255,255,0.1); color:#fff; font-size:18px; cursor:pointer; line-height:1;\
            }\
            #jpNanamiModal .jpn-phone {\
                display:flex; align-items:center; gap:14px; padding:14px 16px;\
                background:rgba(6,199,85,0.14); border:1.5px solid rgba(6,199,85,0.5);\
                border-radius:12px; text-decoration:none; color:#fff; margin-bottom:12px;\
            }\
            #jpNanamiModal .jpn-phone-flag {\
                width:46px; height:46px; border-radius:50%; background:rgba(6,199,85,0.25);\
                display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0;\
            }\
            #jpNanamiModal .jpn-phone-info { flex:1; min-width:0; }\
            #jpNanamiModal .jpn-phone-label { font-size:10.5px; color:#86efac; font-weight:700; letter-spacing:0.5px; margin-bottom:3px; }\
            #jpNanamiModal .jpn-phone-num { font-size:17px; color:#fff; font-weight:900; letter-spacing:-0.02em; }\
            #jpNanamiModal .jpn-phone-hours { font-size:10px; color:rgba(255,255,255,0.55); margin-top:3px; }\
            #jpNanamiModal .jpn-qr {\
                display:flex; flex-direction:column; align-items:center; gap:8px;\
                padding:14px; background:#fff; border-radius:12px;\
                box-shadow:0 4px 14px rgba(6,199,85,0.25); margin-bottom:10px;\
            }\
            #jpNanamiModal .jpn-qr img { width:150px; height:150px; object-fit:contain; display:block; border-radius:6px; }\
            #jpNanamiModal .jpn-qr-label { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:800; color:#06C755; }\
            #jpNanamiModal .jpn-line-btn {\
                display:inline-flex; align-items:center; gap:6px;\
                padding:9px 18px; background:linear-gradient(135deg,#06C755,#04a247);\
                color:#fff; border-radius:30px; text-decoration:none;\
                font-size:12.5px; font-weight:700; box-shadow:0 4px 12px rgba(6,199,85,0.35);\
            }\
            @media (max-width:480px) {\
                #jpNanamiFab { bottom:16px; right:16px; width:54px; height:54px; }\
                #jpNanamiFab i { font-size:24px; }\
                #jpNanamiModal { padding:12px; }\
                #jpNanamiModal .jpn-card { padding:18px; max-width:340px; }\
                #jpNanamiModal .jpn-qr img { width:130px; height:130px; }\
            }\
        ';
        var styleEl = document.createElement('style');
        styleEl.id = 'jpNanamiFabStyle';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        // FAB 버튼
        var fab = document.createElement('button');
        fab.id = 'jpNanamiFab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'ナナミ担当に連絡');
        fab.innerHTML = '<i class="fa-brands fa-line"></i><span class="jp-nan-badge">1</span>';
        document.body.appendChild(fab);

        // Modal
        var modal = document.createElement('div');
        modal.id = 'jpNanamiModal';
        modal.innerHTML = '\
            <div class="jpn-card">\
                <div class="jpn-head">\
                    <div class="jpn-title">📞 日本担当 · ナナミ</div>\
                    <button type="button" class="jpn-close" aria-label="Close">✕</button>\
                </div>\
                <a class="jpn-phone" href="tel:09053970420">\
                    <div class="jpn-phone-flag">🇯🇵</div>\
                    <div class="jpn-phone-info">\
                        <div class="jpn-phone-label">JAPAN DIRECT · ナナミ</div>\
                        <div class="jpn-phone-num">090-5397-0420</div>\
                        <div class="jpn-phone-hours">平日 10:00 - 19:00 JST</div>\
                    </div>\
                </a>\
                <div class="jpn-qr">\
                    <img src="/line_qr_jp.jpg?v=1" alt="LINE QR" loading="lazy">\
                    <div class="jpn-qr-label"><i class="fa-brands fa-line"></i> QRコードでLINE追加</div>\
                    <a class="jpn-line-btn" href="https://line.me/ti/p/~astro.0420" target="_blank" rel="noopener">\
                        <span>LINEで相談</span>\
                    </a>\
                </div>\
            </div>\
        ';
        document.body.appendChild(modal);

        // 이벤트 바인딩
        function openModal() {
            modal.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            var badge = fab.querySelector('.jp-nan-badge');
            if (badge) badge.style.display = 'none';
        }
        function closeModal() {
            modal.classList.remove('is-open');
            document.body.style.overflow = '';
        }
        // 전역 노출 — 다른 곳 (6 버튼 챗봇 등) 에서 호출 가능
        window.__jpNanamiOpen = openModal;
        window.__jpNanamiClose = closeModal;

        fab.addEventListener('click', openModal);
        modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });
        var closeBtn = modal.querySelector('.jpn-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', function(e){
            if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
