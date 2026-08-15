/* blog-recruit.js — SNS 체험단(블로그 모니터) 모집 팝업 (공용)  추출: 2026-08-15
 * index.html + cotton_print.html 공유. 리워드 허브(rewards.js)의 'SNS 체험단' 이 window.openBlogRecruitInfo 호출.
 * 의존: window.sb, window.__SITE_CODE, (선택)window.openAuthModal, (선택)window.openSnsRankingModal.  수정 시 ?v= bump.
 */
function _blogRecruitClose(){ var m=document.getElementById('blogRecruitModal'); if(m) m.remove(); }
function _blogRecruitHide(days, silent){ try{ localStorage.setItem('_blogRecruitHideUntil2', String(Date.now()+(days||1)*86400000)); }catch(e){} if(!silent) _blogRecruitClose(); }
function _blogRecruitDismiss(silent){ _blogRecruitHide(1, silent); }
function _blogRecruitLogin(){ _blogRecruitClose(); if(window.openAuthModal){ window.openAuthModal('login', function(){ openBlogRecruitInfo(); }); } else { location.href='mypage.html'; } }

async function openBlogRecruitInfo(){
    var jp = (window.__SITE_CODE === 'JP');
    var user = null, status = 'none';
    try { var u = await window.sb.auth.getUser(); user = u && u.data && u.data.user; } catch(e){}
    if (user) { try { var s = await window.sb.rpc('blog_monitor_sync'); if (s && s.data) status = s.data.status || 'none'; } catch(e){} }
    _blogRecruitBuild(jp, !!user, status);
}

function _blogRecruitBuild(jp, loggedIn, status){
    var ov=document.getElementById('blogRecruitModal'); if(ov) ov.remove();
    ov=document.createElement('div'); ov.id='blogRecruitModal';
    ov.style.cssText='position:fixed; inset:0; background:rgba(0,0,0,0.82); backdrop-filter:blur(3px); z-index:2147483030; display:flex; align-items:center; justify-content:center; padding:20px;';
    var title = jp ? 'ブログ体験モニター募集' : '블로그 체험단 모집';
    var intro = jp
        ? 'SNS体験団の皆さまに毎月5,000円分（送料込み）の無料ポイントを進呈します。お好きな商品を無料で購入し、SNS・ブログにPRレビューを投稿してください。'
        : 'SNS 체험단에게 매월 5만 포인트(배송비 포함)를 드립니다. 원하는 제품을 무료로 구매하고 SNS·블로그에 홍보 후기를 남겨주세요.';
    var threadsMsg = jp
        ? '🎉 SNS体験団 全員に毎月5,000円分！<br><br>ブログ・Threads・Instagram など、お好きなSNSで宣伝レビューを投稿してください。'
        : '🎉 SNS 체험단 누구나 매월 5만원!<br><br>블로그·스레드·인스타 등 원하는 SNS에 홍보 후기를 올려주세요.';
    var rankMsg = jp
        ? '🏆 SNS PRランキング 現金イベント <b>(〜10/15 16:00)</b><br>投稿1件1点・力作3点・バズり5点！ 上位 1位10万円…5位5千円 + バズり最多1件3万円！<br><span style="font-size:11px;color:#b91c1c;">※ カメレオン印刷と無関係、または雑な連投のみは対象外</span>'
        : '🏆 SNS 홍보 랭킹 현금 이벤트 <b>(~10/15 16:00)</b><br>게시글 1점·정성글 3점·조회수 터짐 5점! 상위 1위 100만…5위 5만원 + 조회수 최다 1건 30만원!<br><span style="font-size:11px;color:#b91c1c;">※ 카멜레온과 무관하거나 도배성 글만 있는 경우 지급 제외</span>';
    var firstMsg = jp
        ? '初めてですか？ 無料クーポンで気軽にご購入ください。会員登録イベント＋SNSマーケティングクーポンで<b>約15,000円分</b>を進呈します。仲良くなりましょう！'
        : '처음 오셨나요? 무료쿠폰으로 부담 없이 구매하세요. 회원가입 이벤트 + SNS 마케팅 쿠폰으로 <b>약 15만원</b>을 드립니다. 우리 친해져요!';
    var firstBox = '<div style="background:#fdf2f8; color:#9d174d; border:1px solid #fbcfe8; border-radius:10px; padding:12px 14px; font-size:13px; margin-bottom:12px; line-height:1.65;">'+firstMsg+'</div>';
    var btnStyle='width:100%; padding:12px; background:#7c3aed; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer;';
    var inner='';
    if (!loggedIn) {
        inner = firstBox
              + '<div style="font-size:13.5px; line-height:1.75; margin-bottom:14px;">'+intro+'</div>'
              + '<div style="background:#111; color:#fff; border-radius:10px; padding:12px 14px; font-size:13px; margin-bottom:12px; line-height:1.6;">'+threadsMsg+'</div>'
              + '<div style="background:#fff7ed; color:#7c2d12; border:1px solid #fdba74; border-radius:10px; padding:12px 14px; font-size:12.5px; margin-bottom:16px; line-height:1.6;">'+rankMsg+'</div>'
              + '<button onclick="_blogRecruitLogin()" style="'+btnStyle+'">'+(jp?'ログインして応募':'로그인하고 신청')+'</button>';
    } else if (status==='approved') {
        inner = '<div style="font-size:13.5px; line-height:1.75; margin-bottom:16px;">'+(jp?'🎉 体験モニターに承認されました！さっそくSNS・ブログに投稿してリンクを登録しましょう。':'🎉 체험단으로 승인되었습니다! 지금 바로 SNS·블로그에 글을 올리고 링크를 등록해 보세요.')+'</div>'
              + '<button onclick="location.href=\'mypage.html?tab=blog\'" style="'+btnStyle+'">'+(jp?'✍ 投稿しに行く':'✍ 글쓰러 가기')+'</button>';
    } else if (status==='pending') {
        inner = '<div style="font-size:13.5px; line-height:1.75; margin-bottom:16px;">'+(jp?'応募を受け付けました。承認までしばらくお待ちください。承認されるとマイページにクーポンが表示されます。':'신청이 접수되었습니다. 승인을 기다려 주세요. 승인되면 마이페이지에 쿠폰이 표시됩니다.')+'</div>'
              + '<button onclick="_blogRecruitClose()" style="'+btnStyle+'">'+(jp?'閉じる':'닫기')+'</button>';
    } else {
        inner = firstBox
              + '<div style="font-size:13.5px; line-height:1.75; margin-bottom:12px;">'+intro+'</div>'
              + '<div style="background:#111; color:#fff; border-radius:10px; padding:12px 14px; font-size:13px; margin-bottom:12px; line-height:1.6;">'+threadsMsg+'</div>'
              + '<div style="background:#fff7ed; color:#7c2d12; border:1px solid #fdba74; border-radius:10px; padding:12px 14px; font-size:12.5px; margin-bottom:16px; line-height:1.6;">'+rankMsg+'</div>'
              + '<div style="font-size:12.5px; color:#334155; margin-bottom:6px;">'+(jp?'あなたの宣伝チャンネルURL（ブログ / Threads / Instagram など）':'홍보채널 주소 (블로그 / 스레드 / 인스타 등)')+'</div>'
              + '<input id="blogApplyChannel" type="url" placeholder="https://..." style="width:100%; padding:11px 13px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; margin-bottom:14px; box-sizing:border-box;">'
              + '<button id="blogApplyBtn" onclick="_blogRecruitApply()" style="'+btnStyle+'">'+(jp?'応募する':'신청하기')+'</button>'
              + ''
              + '<div style="margin-top:14px; display:flex; gap:18px; justify-content:center;">'
              +   '<span onclick="_blogRecruitHide(1)" style="font-size:12px; color:#94a3b8; cursor:pointer;">'+(jp?'今日は表示しない':'오늘 그만 보기')+'</span>'
              +   '<span onclick="_blogRecruitHide(3)" style="font-size:12px; color:#94a3b8; cursor:pointer;">'+(jp?'3日間表示しない':'3일간 보지 않기')+'</span>'
              + '</div>';
    }
    var imgSrc = jp ? '/sns_recruit_jp.jpg?v=3' : '/sns_recruit_kr.jpg?v=3';
    ov.innerHTML = '<div style="position:relative; background:#fff; border-radius:16px; max-width:440px; width:100%; max-height:92vh; overflow-y:auto; color:#334155;">'
        + '<div onclick="_blogRecruitClose()" title="닫기" style="position:absolute; top:10px; right:12px; z-index:3; width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.5); color:#fff; font-size:20px; line-height:31px; text-align:center; cursor:pointer; user-select:none;">×</div>'
        + '<img src="'+imgSrc+'" alt="'+title+'" style="width:100%; height:auto; display:block; border-radius:16px 16px 0 0;">'
        + '<div style="padding:22px 26px 26px;">' + inner
        + '<button onclick="if(window.openSnsRankingModal)openSnsRankingModal()" style="width:100%; margin-top:10px; padding:11px; background:linear-gradient(135deg,#fce7f3,#f3e8ff); color:#a21caf; border:1px solid #f5d0fe; border-radius:12px; font-size:13.5px; font-weight:800; cursor:pointer;">🏆 '+(jp?'リアルタイムランキングを見る':'실시간 랭킹 보기')+'</button>'
        + '</div>'
        + '</div>';
    ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
}

async function _blogRecruitApply(){
    var jp=(window.__SITE_CODE==='JP');
    var el=document.getElementById('blogApplyChannel'); var url=(el&&el.value||'').trim();
    if(!url){ alert(jp?'URLを入力してください':'주소를 입력해 주세요'); return; }
    if(!/^https?:\/\//i.test(url)){ alert(jp?'http(s):// から始まるURLを入力してください':'http(s):// 로 시작하는 주소를 입력해 주세요'); return; }
    var btn=document.getElementById('blogApplyBtn'); if(btn){ btn.disabled=true; btn.textContent='...'; }
    try {
        var r = await window.sb.rpc('blog_monitor_apply', { _channel_url: url, _country: window.__SITE_CODE });
        if (r.error) throw r.error;
        if (!r.data || !r.data.ok) throw new Error((r.data&&r.data.error)||'error');
        _blogRecruitHide(30, true);
        _blogRecruitBuild(jp, true, r.data.status || 'pending');   // KR/JP 는 즉시 approved
    } catch(e){ alert((jp?'応募失敗: ':'신청 실패: ')+(e.message||e)); if(btn){ btn.disabled=false; btn.textContent=(jp?'応募する':'신청하기'); } }
}

// 자동 노출: KR/JP + 로그인 + 비회원(none) + 오늘 안 봤으면 1회
(function(){
    function _initRecruit(){
        if (window.__SITE_CODE !== 'KR' && window.__SITE_CODE !== 'JP') return;
        try { var _hu = parseInt(localStorage.getItem('_blogRecruitHideUntil2')||'0',10); if (_hu && Date.now() < _hu) return; } catch(e){}
        if (!window.sb || !window.sb.auth) { setTimeout(_initRecruit, 1500); return; }
        window.sb.auth.getUser().then(function(u){
            var user = u && u.data && u.data.user; if(!user) return;
            window.sb.rpc('blog_monitor_sync').then(function(s){
                var st = (s && s.data && s.data.status) || 'none';
                if (st === 'none') _blogRecruitBuild((window.__SITE_CODE==='JP'), true, 'none');
            }).catch(function(){});
        }).catch(function(){});
    }
    setTimeout(_initRecruit, 3500);
})();
// 전역 노출 (외부/rewards.js 에서 호출)
window.openBlogRecruitInfo = openBlogRecruitInfo;
window._blogRecruitBuild = _blogRecruitBuild;
window._blogRecruitClose = _blogRecruitClose;
window._blogRecruitHide = _blogRecruitHide;
window._blogRecruitDismiss = _blogRecruitDismiss;
window._blogRecruitLogin = _blogRecruitLogin;
window._blogRecruitApply = _blogRecruitApply;
