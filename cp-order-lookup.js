// ============================================================
// cp-order-lookup.js — JP 페이지 공용 주문조회 모달 (cotton_print 패턴)
//   동작: 로그인 사용자 자동조회 + 비로그인 전화번호 뒷 4자리 조회
//   적용: index.html(JP), paper_stand.html, raw_board.html, cotton_print 등
//   호출: window._cpOpenOrderLookup()
// 2026-06-12
// ============================================================
(function(){
    'use strict';

    // 이미 cotton_print.html 등에 인라인으로 들어있으면 skip
    if (window._cpOpenOrderLookup || document.getElementById('cpOrderLookupModal')) return;

    var SB_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';

    function lang(){
        if (window.__PS_LANG) return window.__PS_LANG;
        var h = (location.hostname||'').toLowerCase();
        if (h.indexOf('cafe0101')>=0 || h.indexOf('cotton-printer')>=0) return 'ja';
        if (h.indexOf('cafe3355')>=0 || h.indexOf('chameleon.design')>=0) return 'en';
        return 'ko';
    }

    var T = {
        ko: { title:'🔍 주문 조회', desc:'전화번호 뒷 4자리를 입력하시면 최근 주문의 진행 상태와 예상 배송일을 확인하실 수 있습니다.',
              authLbl:'📦 내 주문 자동 조회', byMeLbl:'✨ 자동 조회 (내 주문)',
              btn:'조회하기', searching:'조회 중...',
              statusPaid:'접수완료', statusProd:'제작 진행중', statusPending:'결제 대기중',
              etaLabel:'예상 배송일', orderDate:'주문일', amount:'결제금액',
              notFound:'주문을 찾을 수 없습니다.', err:'조회 중 오류가 발생했습니다.',
              digitsErr:'전화번호 뒷 4자리를 입력해주세요.', back:'다시 조회' },
        ja: { title:'🔍 ご注文照会', desc:'お電話番号の下4桁を入力してください。最新のご注文状況と予想お届け日をお調べします。',
              authLbl:'📦 ご自身のご注文を照会', byMeLbl:'✨ 自動照会 (マイ注文)',
              btn:'照会する', searching:'照会中...',
              statusPaid:'受付完了', statusProd:'製作進行中', statusPending:'入金確認待ち',
              etaLabel:'お届け予定', orderDate:'ご注文日', amount:'お支払い金額',
              notFound:'ご注文が見つかりません。', err:'照会中にエラーが発生しました。',
              digitsErr:'電話番号の下4桁を入力してください。', back:'再照会' },
        en: { title:'🔍 Track Order', desc:'Enter the last 4 digits of your phone number to check your order status and estimated delivery date.',
              authLbl:'📦 Check My Orders', byMeLbl:'✨ Auto-check (My Orders)',
              btn:'Search', searching:'Searching...',
              statusPaid:'Order Received', statusProd:'In Production', statusPending:'Awaiting Payment',
              etaLabel:'Estimated Delivery', orderDate:'Order Date', amount:'Total Amount',
              notFound:'No orders found.', err:'An error occurred during search.',
              digitsErr:'Please enter the last 4 digits.', back:'Search Again' }
    };
    var t = T[lang()] || T.en || T.ko;   // 2026-07-23: 한/일 외 언어는 영어로

    function $(id){ return document.getElementById(id); }
    function fmtDate(iso){
        if (!iso) return '-';
        try {
            var d = new Date(iso);
            var y = d.getFullYear(); var m = (d.getMonth()+1); var dd = d.getDate();
            if (lang() === 'ja') return y + '年' + m + '月' + dd + '日';
            if (lang() === 'en') return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] + ' ' + dd + ', ' + y;
            return y + '. ' + m + '. ' + dd + '.';
        } catch(e){ return iso; }
    }
    function fmtAmt(n){
        if (n == null) return '-';
        try {
            if (lang() === 'ja') return '¥' + Math.round(n * 0.1).toLocaleString();
            if (lang() === 'en') return '$' + (n * 0.001).toFixed(2);
            return Number(n).toLocaleString() + '원';
        } catch(e){ return n; }
    }

    function injectModal(){
        if ($('cpOrderLookupModal')) return;
        var html = '<div id="cpOrderLookupModal" style="display:none; position:fixed; inset:0; z-index:1000050; background:rgba(0,0,0,0.7); align-items:center; justify-content:center; padding:16px;">'
          + '<div style="background:linear-gradient(165deg,#1f2937 0%,#0f172a 100%); border:1px solid rgba(255,255,255,0.12); border-radius:18px; padding:24px 22px; width:100%; max-width:440px; box-shadow:0 30px 60px -10px rgba(0,0,0,0.85); font-family:\'Pretendard Variable\',\'Pretendard\',\'Inter\',\'Noto Sans JP\',sans-serif;">'
            + '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">'
              + '<div style="font-size:16px; font-weight:900; color:#fde047;" id="cpLookupTitle">' + t.title + '</div>'
              + '<button type="button" id="cpLookupCloseBtn" aria-label="Close" style="width:32px; height:32px; border-radius:50%; border:none; background:rgba(255,255,255,0.1); color:#fff; font-size:18px; cursor:pointer; line-height:1;">✕</button>'
            + '</div>'
            + '<div id="cpLookupForm">'
              + '<div id="cpLookupLoggedIn" style="display:none; padding:12px 14px; margin-bottom:10px; background:rgba(99,102,241,0.15); border:1.5px solid rgba(99,102,241,0.45); border-radius:10px;">'
                + '<div style="font-size:11.5px; color:#a5b4fc; font-weight:700; letter-spacing:0.3px; margin-bottom:4px;" id="cpLookupAuthLbl">' + t.authLbl + '</div>'
                + '<div style="font-size:13.5px; color:#fff; font-weight:800; margin-bottom:10px;" id="cpLookupUserName">-</div>'
                + '<button type="button" id="cpLookupByMeBtn" style="width:100%; padding:12px; background:linear-gradient(135deg,#6366f1,#4338ca); color:#fff; border:none; border-radius:9px; font-size:13.5px; font-weight:900; cursor:pointer; box-shadow:0 4px 12px -2px rgba(99,102,241,0.5); font-family:inherit;">'
                  + '<span id="cpLookupByMeLbl">' + t.byMeLbl + '</span>'
                + '</button>'
              + '</div>'
              + '<div id="cpLookupOrSplit" style="display:none; text-align:center; font-size:11px; color:rgba(255,255,255,0.4); margin:10px 0; letter-spacing:0.3em;">ーーーー OR ーーーー</div>'
              + '<div style="font-size:12.5px; color:rgba(255,255,255,0.7); line-height:1.55; margin-bottom:12px;" id="cpLookupDesc">' + t.desc + '</div>'
              + '<div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.08); border:1.5px solid rgba(255,255,255,0.22); border-radius:10px; padding:6px 6px 6px 14px; margin-bottom:12px;">'
                + '<input id="cpLookupPhone" type="text" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="off" placeholder="1234" style="border:none; outline:none; font-size:22px; font-weight:800; color:#fff; flex:1; min-width:0; text-align:center; padding:10px 0; background:transparent; font-family:inherit; letter-spacing:0.6em;">'
              + '</div>'
              + '<button type="button" id="cpLookupBtn" style="width:100%; padding:14px; background:linear-gradient(135deg,#fde047,#eab308); color:#1f2937; border:none; border-radius:11px; font-size:15px; font-weight:900; cursor:pointer; box-shadow:0 6px 18px -4px rgba(234,179,8,0.6); font-family:inherit;">'
                + '<span id="cpLookupBtnLabel">' + t.btn + '</span>'
              + '</button>'
            + '</div>'
            + '<div id="cpLookupResult" style="display:none;"></div>'
          + '</div>'
        + '</div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div.firstChild);

        // 이벤트 바인딩
        var modal = $('cpOrderLookupModal');
        modal.addEventListener('click', function(e){ if(e.target===modal) window._cpCloseOrderLookup(); });
        $('cpLookupCloseBtn').addEventListener('click', function(){ window._cpCloseOrderLookup(); });
        $('cpLookupByMeBtn').addEventListener('click', function(){ window._cpDoLookupByMe(); });
        $('cpLookupBtn').addEventListener('click', function(){ window._cpDoLookup(); });
        $('cpLookupPhone').addEventListener('keydown', function(e){ if(e.key==='Enter') window._cpDoLookup(); });
    }

    // Supabase 클라이언트 lazy 로드
    async function getSb(){
        if (window.sb) return window.sb;
        if (typeof supabase === 'undefined') {
            // SDK 로드
            await new Promise(function(resolve, reject){
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            }).catch(function(e){ console.warn('[cp-lookup] sdk load fail:', e); });
        }
        try {
            window.sb = supabase.createClient(SB_URL, SB_KEY, {
                auth: { persistSession:true, storage:localStorage, storageKey:'sb-qinvtnhiidtmrzosyvys-auth-token' }
            });
            return window.sb;
        } catch(e){ return null; }
    }

    window._cpOpenOrderLookup = async function(){
        injectModal();
        var m = $('cpOrderLookupModal'); if (!m) return;
        if (m.parentNode !== document.body) { try { document.body.appendChild(m); } catch(e){} }
        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        if ($('cpLookupForm'))   $('cpLookupForm').style.display = 'block';
        if ($('cpLookupResult')) { $('cpLookupResult').style.display = 'none'; $('cpLookupResult').innerHTML = ''; }
        var inp = $('cpLookupPhone'); if (inp) inp.value = '';
        // 로그인 상태 감지
        var sb = await getSb();
        var loggedIn = false; var displayName = '-';
        if (sb && sb.auth) {
            try {
                var sess = await sb.auth.getSession();
                var user = sess && sess.data && sess.data.session && sess.data.session.user;
                if (user) {
                    loggedIn = true;
                    displayName = (user.email || '').split('@')[0];
                    try {
                        var prf = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
                        if (prf && prf.data && prf.data.username) displayName = prf.data.username;
                    } catch(e) {}
                }
            } catch(e){}
        }
        if (loggedIn) {
            if ($('cpLookupLoggedIn'))  $('cpLookupLoggedIn').style.display = 'block';
            if ($('cpLookupOrSplit'))   $('cpLookupOrSplit').style.display = 'block';
            if ($('cpLookupUserName'))  $('cpLookupUserName').textContent = displayName;
        } else {
            if ($('cpLookupLoggedIn'))  $('cpLookupLoggedIn').style.display = 'none';
            if ($('cpLookupOrSplit'))   $('cpLookupOrSplit').style.display = 'none';
            if (inp) setTimeout(function(){ inp.focus(); }, 100);
        }
    };

    window._cpCloseOrderLookup = function(){
        var m = $('cpOrderLookupModal'); if (!m) return;
        m.style.display = 'none';
        document.body.style.overflow = '';
    };

    window._cpDoLookupByMe = async function(){
        var btn = $('cpLookupByMeBtn'); var lbl = $('cpLookupByMeLbl');
        if (btn) btn.disabled = true;
        if (lbl) lbl.textContent = t.searching;
        try {
            var sb = await getSb();
            if (!sb) { renderError(t.err); return; }
            var sess = await sb.auth.getSession();
            var uid = sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id;
            if (!uid) { renderError(t.err); return; }
            var resp = await sb.from('orders')
                .select('id,created_at,payment_status,design_complete,total_amount,status,phone,manager_name')
                .eq('user_id', uid)
                .order('created_at', { ascending: false })
                .limit(5);
            if (resp.error) throw resp.error;
            renderResult(resp.data || []);
        } catch(e){
            console.warn('[byMe]', e);
            renderError(t.err);
        } finally {
            if (btn) btn.disabled = false;
            if (lbl) lbl.textContent = t.byMeLbl;
        }
    };

    window._cpDoLookup = async function(){
        var inp = $('cpLookupPhone');
        var v = (inp.value || '').replace(/\D/g, '');
        if (v.length !== 4) { alert(t.digitsErr); return; }
        var btn = $('cpLookupBtn');
        var lbl = $('cpLookupBtnLabel');
        if (btn) btn.disabled = true;
        if (lbl) lbl.textContent = t.searching;
        try {
            var url = SB_URL + '/rest/v1/orders'
                + '?select=id,created_at,payment_status,design_complete,total_amount,status,phone,manager_name'
                + '&phone=like.*' + v
                + '&payment_status=in.(%22%EA%B2%B0%EC%A0%9C%EC%99%84%EB%A3%8C%22,%22%EC%9E%85%EA%B8%88%ED%99%95%EC%9D%B8%22,%22paid%22)'
                + '&order=created_at.desc&limit=5';
            var resp = await fetch(url, { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            var rows = await resp.json();
            renderResult(rows || []);
        } catch(e){
            console.warn('[lookup]', e);
            renderError(t.err);
        } finally {
            if (btn) btn.disabled = false;
            if (lbl) lbl.textContent = t.btn;
        }
    };

    function renderResult(rows){
        var r = $('cpLookupResult'); var f = $('cpLookupForm');
        if (!r || !f) return;
        f.style.display = 'none'; r.style.display = 'block';
        if (!rows.length) { renderError(t.notFound); return; }
        var html = '';
        rows.forEach(function(o){
            var paidLike = (['결제완료','입금확인','paid'].indexOf(o.payment_status) >= 0);
            var isProd = !!o.design_complete;
            var statusTxt = isProd ? t.statusProd : (paidLike ? t.statusPaid : t.statusPending);
            var statusBg = isProd ? 'linear-gradient(135deg,#60a5fa,#2563eb)' : (paidLike ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#fbbf24,#b45309)');
            var cdate = o.created_at ? new Date(o.created_at) : null;
            var etaLow = '', etaHigh = '';
            if (cdate) {
                var d1 = new Date(cdate); d1.setDate(d1.getDate()+5);
                var d2 = new Date(cdate); d2.setDate(d2.getDate()+7);
                etaLow = fmtDate(d1); etaHigh = fmtDate(d2);
            }
            html += '<div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:16px; margin-bottom:10px;">'
                + '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">'
                    + '<div style="display:inline-block; padding:5px 12px; background:' + statusBg + '; color:#fff; font-size:11.5px; font-weight:900; border-radius:50px;">' + statusTxt + '</div>'
                    + '<div style="font-size:11px; color:rgba(255,255,255,0.55); font-weight:600;">#' + o.id + '</div>'
                + '</div>'
                + '<div style="display:grid; grid-template-columns:auto 1fr; gap:6px 14px; font-size:12.5px; color:rgba(255,255,255,0.85);">'
                    + '<div style="color:#86efac; font-weight:600;">' + t.orderDate + '</div><div>' + fmtDate(o.created_at) + '</div>'
                    + (o.total_amount ? '<div style="color:#86efac; font-weight:600;">' + t.amount + '</div><div style="font-weight:800;">' + fmtAmt(o.total_amount) + '</div>' : '')
                    + (cdate ? '<div style="color:#fde047; font-weight:700;">' + t.etaLabel + '</div><div style="font-weight:900; color:#fff;">' + etaLow + ' 〜 ' + etaHigh + '</div>' : '')
                + '</div>'
            + '</div>';
        });
        html += '<button type="button" id="cpLookupBackBtn" style="width:100%; margin-top:6px; padding:11px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); color:#fff; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;">' + t.back + '</button>';
        r.innerHTML = html;
        var bb = $('cpLookupBackBtn'); if (bb) bb.addEventListener('click', resetForm);
    }
    function renderError(msg){
        var r = $('cpLookupResult'); var f = $('cpLookupForm');
        if (!r || !f) return;
        f.style.display = 'none'; r.style.display = 'block';
        r.innerHTML = '<div style="padding:20px 16px; background:rgba(239,68,68,0.12); border:1.5px solid rgba(239,68,68,0.4); border-radius:12px; text-align:center; color:#fecaca; font-size:13px; font-weight:600; line-height:1.6;">' + msg + '</div>'
          + '<button type="button" id="cpLookupBackBtn2" style="width:100%; margin-top:12px; padding:11px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.22); color:#fff; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;">' + t.back + '</button>';
        var bb = $('cpLookupBackBtn2'); if (bb) bb.addEventListener('click', resetForm);
    }
    function resetForm(){
        var f = $('cpLookupForm'); var r = $('cpLookupResult');
        if (f) f.style.display = 'block';
        if (r) { r.style.display = 'none'; r.innerHTML = ''; }
        var i = $('cpLookupPhone'); if (i) { i.value = ''; i.focus(); }
    }

    // ESC 로 닫기
    document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') {
            var m = $('cpOrderLookupModal');
            if (m && m.style.display === 'flex') window._cpCloseOrderLookup();
        }
    });
})();
