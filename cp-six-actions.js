// ============================================================
// cp-six-actions.js — JP 페이지용 6-버튼 + 모달 주입 (자가 포함)
//   적용: paper_stand.html, raw_board.html 등 JP 랜딩
//   (cotton_print.html / index.html 은 이미 자체 6-버튼 보유 — skip)
// 동작: 6 버튼 (담당전화 / 주문조회 / 特商法 / 금액결제 / 디자인의뢰 / 쿠폰)
// 2026-06-12
// ============================================================
(function(){
    'use strict';

    // JP 도메인/언어만
    var h = (location.hostname||'').toLowerCase();
    var qLang = (new URLSearchParams(location.search).get('lang')||'').toLowerCase();
    var isJp = h.indexOf('cafe0101')>=0 || h.indexOf('cotton-printer')>=0 || qLang==='ja' || window.__PS_LANG==='ja' || window.__SITE_CODE==='JP';
    if (!isJp) return;

    // 이미 6 버튼이 있는 페이지면 스킵
    if (document.getElementById('cpSixBtnGrid') || document.getElementById('cp6abInjected')) return;

    function init() {
        if (document.getElementById('cp6abInjected')) return;
        var marker = document.createElement('div'); marker.id = 'cp6abInjected'; marker.style.display='none';
        document.body.appendChild(marker);

        // ========== CSS ==========
        var css = '\
            #cp6abBar { display:grid; grid-template-columns:repeat(6, 1fr); gap:8px; max-width:1100px; margin:28px auto; padding:0 14px; font-family:"Pretendard Variable","Pretendard","Inter","Noto Sans JP",sans-serif; }\
            #cp6abBar .cp6ab-btn { display:flex; flex-direction:column; align-items:center; gap:8px; padding:14px 6px; background:#fff; border:1.5px solid #f3ead4; border-radius:14px; box-shadow:0 4px 14px rgba(120,53,15,0.08); cursor:pointer; transition:all .2s; font-family:inherit; min-width:0; }\
            #cp6abBar .cp6ab-btn:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(120,53,15,0.18); }\
            #cp6abBar .cp6ab-btn:hover .cp6ab-icon { transform:scale(1.08); }\
            #cp6abBar .cp6ab-icon { width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:20px; transition:transform .2s; }\
            #cp6abBar .cp6ab-label { font-size:11.5px; font-weight:800; color:#1e293b; line-height:1.2; text-align:center; word-break:keep-all; overflow-wrap:anywhere; padding:0 1px; }\
            .cp6ab-phone  .cp6ab-icon { background:linear-gradient(135deg,#dbeafe,#60a5fa); color:#1e40af; }\
            .cp6ab-lookup .cp6ab-icon { background:linear-gradient(135deg,#e9d5ff,#a855f7); color:#5b21b6; }\
            .cp6ab-legal  .cp6ab-icon { background:linear-gradient(135deg,#fef3c7,#fbbf24); color:#92400e; }\
            .cp6ab-pay    .cp6ab-icon { background:linear-gradient(135deg,#d1fae5,#10b981); color:#065f46; }\
            .cp6ab-design .cp6ab-icon { background:linear-gradient(135deg,#ddd6fe,#7c3aed); color:#4c1d95; }\
            .cp6ab-cp     .cp6ab-icon { background:linear-gradient(135deg,#fce7f3,#f472b6); color:#831843; }\
            @media (max-width:600px) { #cp6abBar { gap:6px; padding:0 8px; margin:18px auto; } \
                #cp6abBar .cp6ab-btn { padding:9px 2px; gap:5px; } \
                #cp6abBar .cp6ab-icon { width:36px; height:36px; font-size:15px; border-radius:11px; } \
                #cp6abBar .cp6ab-label { font-size:9.5px; line-height:1.1; } }\
            /* 모달 공통 */\
            .cp6ab-modal { display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.65); align-items:center; justify-content:center; padding:16px; font-family:"Pretendard Variable","Pretendard","Inter","Noto Sans JP",sans-serif; }\
            .cp6ab-modal.is-open { display:flex; animation:cp6abFadeIn .25s ease; }\
            @keyframes cp6abFadeIn { from {opacity:0;} to {opacity:1;} }\
            .cp6ab-card { background:linear-gradient(165deg,#1f2937 0%,#0f172a 100%); border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:22px 20px; width:100%; max-width:460px; max-height:90vh; overflow-y:auto; box-shadow:0 30px 60px -10px rgba(0,0,0,0.8); }\
            .cp6ab-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }\
            .cp6ab-title { font-size:16px; font-weight:900; color:#fde047; }\
            .cp6ab-close { width:32px; height:32px; border-radius:50%; border:none; background:rgba(255,255,255,0.1); color:#fff; font-size:18px; cursor:pointer; line-height:1; }\
            .cp6ab-phonecard { display:flex; align-items:center; gap:14px; padding:14px 16px; background:rgba(6,199,85,0.14); border:1.5px solid rgba(6,199,85,0.5); border-radius:12px; text-decoration:none; color:#fff; margin-bottom:10px; }\
            .cp6ab-phonecard.hq { background:rgba(99,102,241,0.14); border-color:rgba(99,102,241,0.5); }\
            .cp6ab-phoneflag { width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }\
            .cp6ab-phoneinfo { flex:1; min-width:0; }\
            .cp6ab-phonelbl { font-size:10.5px; color:#86efac; font-weight:700; letter-spacing:0.5px; margin-bottom:3px; }\
            .cp6ab-phonecard.hq .cp6ab-phonelbl { color:#a5b4fc; }\
            .cp6ab-phonenum { font-size:16px; color:#fff; font-weight:900; letter-spacing:-0.02em; }\
            .cp6ab-phonehrs { font-size:10px; color:rgba(255,255,255,0.55); margin-top:2px; }\
            .cp6ab-qr { display:flex; flex-direction:row; align-items:center; gap:14px; padding:14px; background:linear-gradient(135deg,#fff 0%,#f0fdf4 100%); border:1.5px solid rgba(6,199,85,0.45); border-radius:12px; margin-top:6px; }\
            .cp6ab-qr img { width:110px; height:110px; flex-shrink:0; object-fit:contain; border-radius:6px; background:#fff; padding:5px; border:1px solid rgba(6,199,85,0.18); }\
            .cp6ab-qr .qrinfo { flex:1; min-width:0; }\
            .cp6ab-qr .qrtitle { font-size:13px; color:#0c4a2e; font-weight:900; margin-bottom:6px; display:flex; align-items:center; gap:6px; }\
            .cp6ab-qr .qrsub { font-size:11px; color:#475569; margin-bottom:8px; line-height:1.5; }\
            .cp6ab-qr .qrbtn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:linear-gradient(135deg,#06C755,#04a247); color:#fff; border-radius:30px; text-decoration:none; font-size:12px; font-weight:800; box-shadow:0 4px 12px rgba(6,199,85,0.4); }\
            /* 금액결제 모달 */\
            .cp6ab-payrow { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }\
            .cp6ab-paylbl { font-size:12px; color:rgba(255,255,255,0.7); font-weight:700; }\
            .cp6ab-payinp { display:flex; align-items:center; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); border-radius:10px; padding:0 14px; }\
            .cp6ab-payinp input { border:none; outline:none; background:transparent; color:#fff; font-size:15px; font-weight:700; padding:12px 0; width:100%; font-family:inherit; }\
            .cp6ab-payinp input::placeholder { color:rgba(255,255,255,0.4); }\
            .cp6ab-payinp .unit { font-size:13px; color:rgba(255,255,255,0.7); font-weight:700; padding-left:6px; }\
            .cp6ab-paysubmit { width:100%; padding:14px; background:linear-gradient(135deg,#fde047,#eab308); color:#1f2937; border:none; border-radius:11px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 6px 18px -4px rgba(234,179,8,0.6); font-family:inherit; }\
        ';
        var st = document.createElement('style'); st.id='cp6abStyle'; st.textContent=css; document.head.appendChild(st);

        // ========== 6 버튼 바 ==========
        var bar = document.createElement('div');
        bar.id = 'cp6abBar';
        bar.innerHTML = '\
            <button type="button" class="cp6ab-btn cp6ab-phone" onclick="window._cp6abOpenPhone()">\
                <span class="cp6ab-icon"><i class="fa-solid fa-phone-volume"></i></span>\
                <span class="cp6ab-label">担当へお電話</span>\
            </button>\
            <button type="button" class="cp6ab-btn cp6ab-lookup" onclick="if(window._cpOpenOrderLookup){window._cpOpenOrderLookup();}else{location.href=\'/jp-track\';}">\
                <span class="cp6ab-icon"><i class="fa-solid fa-magnifying-glass"></i></span>\
                <span class="cp6ab-label">ご注文照会</span>\
            </button>\
            <button type="button" class="cp6ab-btn cp6ab-legal" onclick="location.href=\'/tokushoho\'">\
                <span class="cp6ab-icon"><i class="fa-solid fa-scale-balanced"></i></span>\
                <span class="cp6ab-label">特定商取引法</span>\
            </button>\
            <button type="button" class="cp6ab-btn cp6ab-pay" onclick="window._cp6abOpenPay()">\
                <span class="cp6ab-icon"><i class="fa-solid fa-wallet"></i></span>\
                <span class="cp6ab-label">金額決済</span>\
            </button>\
            <button type="button" class="cp6ab-btn cp6ab-design" onclick="location.href=\'/design-market\'">\
                <span class="cp6ab-icon"><i class="fa-solid fa-palette"></i></span>\
                <span class="cp6ab-label">デザイン依頼</span>\
            </button>\
            <button type="button" class="cp6ab-btn cp6ab-cp" onclick="location.href=\'/?coupon=1\'">\
                <span class="cp6ab-icon"><i class="fa-solid fa-gift"></i></span>\
                <span class="cp6ab-label">クーポン</span>\
            </button>\
        ';

        // 마운트 위치 — data-cp-six-mount 우선, 없으면 body 맨 위에
        var mount = document.querySelector('[data-cp-six-mount]');
        if (mount) {
            mount.appendChild(bar);
        } else {
            // hero 또는 header 다음에 삽입 시도
            var hero = document.querySelector('.hero-section, header, .ps-hero, .rb-hero, .jpt-header');
            if (hero && hero.parentNode) {
                hero.parentNode.insertBefore(bar, hero.nextSibling);
            } else {
                // 그래도 못 찾으면 body 시작 부분에
                document.body.insertBefore(bar, document.body.firstChild);
            }
        }

        // ========== 전화 모달 ==========
        var phoneModal = document.createElement('div');
        phoneModal.id = 'cp6abPhoneModal';
        phoneModal.className = 'cp6ab-modal';
        phoneModal.innerHTML = '\
            <div class="cp6ab-card">\
                <div class="cp6ab-head">\
                    <div class="cp6ab-title">📞 担当者 直通</div>\
                    <button type="button" class="cp6ab-close" onclick="window._cp6abClosePhone()">✕</button>\
                </div>\
                <a class="cp6ab-phonecard" href="tel:09053970420">\
                    <div class="cp6ab-phoneflag">🇯🇵</div>\
                    <div class="cp6ab-phoneinfo">\
                        <div class="cp6ab-phonelbl">日本担当 · ナナミ</div>\
                        <div class="cp6ab-phonenum">090-5397-0420</div>\
                        <div class="cp6ab-phonehrs">平日 10:00 - 19:00 JST</div>\
                    </div>\
                </a>\
                <a class="cp6ab-phonecard hq" href="tel:+82313661984">\
                    <div class="cp6ab-phoneflag">🇰🇷</div>\
                    <div class="cp6ab-phoneinfo">\
                        <div class="cp6ab-phonelbl">本社 (韓国)</div>\
                        <div class="cp6ab-phonenum">+82-31-366-1984</div>\
                        <div class="cp6ab-phonehrs">平日 09:00 - 18:00 KST</div>\
                    </div>\
                </a>\
                <div class="cp6ab-qr">\
                    <img src="/line_qr_jp.jpg?v=1" alt="LINE QR" loading="lazy">\
                    <div class="qrinfo">\
                        <div class="qrtitle"><i class="fa-brands fa-line" style="color:#06C755;"></i> LINE で相談</div>\
                        <div class="qrsub">スマホでQRを<br>読み込んでください</div>\
                        <a class="qrbtn" href="https://line.me/ti/p/~astro.0420" target="_blank" rel="noopener">\
                            <i class="fa-brands fa-line"></i> LINE追加\
                        </a>\
                    </div>\
                </div>\
            </div>\
        ';
        phoneModal.addEventListener('click', function(e){ if(e.target===phoneModal) window._cp6abClosePhone(); });
        document.body.appendChild(phoneModal);

        // ========== 금액 결제 모달 ==========
        var payModal = document.createElement('div');
        payModal.id = 'cp6abPayModal';
        payModal.className = 'cp6ab-modal';
        payModal.innerHTML = '\
            <div class="cp6ab-card">\
                <div class="cp6ab-head">\
                    <div class="cp6ab-title">⚡ 相談後の金額決済</div>\
                    <button type="button" class="cp6ab-close" onclick="window._cp6abClosePay()">✕</button>\
                </div>\
                <div style="font-size:12px; color:rgba(255,255,255,0.7); line-height:1.55; margin-bottom:14px;">\
                    担当との通話・LINE 相談後、合意した金額を入力すると即座に決済画面が開きます。\
                </div>\
                <div class="cp6ab-payrow">\
                    <div class="cp6ab-paylbl">お支払い金額</div>\
                    <div class="cp6ab-payinp">\
                        <input id="cp6abAmt" type="text" inputmode="numeric" placeholder="5,000" autocomplete="off">\
                        <span class="unit">円</span>\
                    </div>\
                </div>\
                <div class="cp6ab-payrow">\
                    <div class="cp6ab-paylbl">ご注文内容</div>\
                    <div class="cp6ab-payinp">\
                        <input id="cp6abMemo" type="text" maxlength="80" placeholder="例: ファブリック10枚" autocomplete="off">\
                    </div>\
                </div>\
                <button type="button" class="cp6ab-paysubmit" onclick="window._cp6abOrderQuote()">⚡ 注文する</button>\
            </div>\
        ';
        payModal.addEventListener('click', function(e){ if(e.target===payModal) window._cp6abClosePay(); });
        document.body.appendChild(payModal);

        // ========== 동작 핸들러 ==========
        window._cp6abOpenPhone = function(){ phoneModal.classList.add('is-open'); document.body.style.overflow='hidden'; };
        window._cp6abClosePhone = function(){ phoneModal.classList.remove('is-open'); document.body.style.overflow=''; };
        window._cp6abOpenPay   = function(){ payModal.classList.add('is-open'); document.body.style.overflow='hidden'; setTimeout(function(){var i=document.getElementById('cp6abAmt'); if(i) i.focus();},100); };
        window._cp6abClosePay  = function(){ payModal.classList.remove('is-open'); document.body.style.overflow=''; };

        // 금액 입력 — 천 단위 콤마
        var amt = document.getElementById('cp6abAmt');
        if (amt) {
            amt.addEventListener('input', function(){
                var v = (amt.value||'').replace(/[^\d]/g,'');
                if (v) amt.value = Number(v).toLocaleString(); else amt.value='';
            });
        }

        window._cp6abOrderQuote = function(){
            var amtEl = document.getElementById('cp6abAmt');
            var memoEl = document.getElementById('cp6abMemo');
            var v = (amtEl.value||'').replace(/[^\d]/g,'');
            var memo = (memoEl.value||'').trim();
            if (!v || Number(v) < 100) { alert('お支払い金額を入力してください (100円以上)'); amtEl.focus(); return; }
            if (!memo) { alert('ご注文内容を入力してください'); memoEl.focus(); return; }
            // JP 사이트 — 금액은 엔(JPY) 으로 입력 → 백엔드 KRW 환산 위해 10배
            var krw = Number(v) * 10;
            var url = '/design-pay?amount=' + krw + '&memo=' + encodeURIComponent(memo) + '&src=cp6ab';
            location.href = url;
        };

        // ESC 닫기
        document.addEventListener('keydown', function(e){
            if (e.key !== 'Escape') return;
            if (phoneModal.classList.contains('is-open')) window._cp6abClosePhone();
            else if (payModal.classList.contains('is-open')) window._cp6abClosePay();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
