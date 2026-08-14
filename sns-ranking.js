// 2026-08-10: 공개 SNS 조회수 랭킹 — 게임풍(다크/골드) 위젯. index.html(팝업)·mypage 공용.
(function () {
    function getSb() { return window.sb || (window.supabaseClient) || null; }
    var JP = (window.__SITE_CODE === 'JP');
    var T = {
        title: JP ? 'SNS PRランキング' : 'SNS 홍보 랭킹',
        rank: JP ? '順位' : '순위',
        name: JP ? '名前' : '이름',
        score: JP ? '点数' : '점수',
        prize: JP ? '賞金' : '보상',
        ends: JP ? '10/15(木) 16:00 終了' : '10/15(목) 16:00 종료',
        desc: JP ? '商品を購入し、SNSにレビュー・PRを投稿！ 投稿1件=1点・力作=3点・バズり=5点（管理者確認, リアルタイム反映）。8/10以降の投稿のみ有効。<b>カメレオン印刷と無関係、または雑な連投のみの場合は賞金対象外</b>。' : '제품을 구매하고 SNS에 후기·홍보 글을 올려주세요! 게시글 1개=1점 · 정성글=3점 · 조회수 터짐=5점 (관리자 확인, 실시간 반영). 8/10 이후 게시글만 인정. <b>카멜레온프린팅과 무관하거나 도배성 글만 있는 경우 지급 제외</b>.',
        empty: JP ? 'まだ登録がありません。最初のランカーになりましょう！' : '아직 등록 내역이 없습니다. 첫 랭커가 되어보세요!',
        note: JP ? '順位はリアルタイム反映 · 点数が高いほど上位 · 上位5名に現金進呈 + バズり最多1件に ¥30,000' : '순위는 실시간 반영 · 점수 높을수록 상위 · 상위 5명 현금 지급 + 조회수 최다 1건 30만원',
        loading: JP ? '読み込み中...' : '불러오는 중...',
        close: JP ? '閉じる' : '닫기',
        won: JP ? '円' : '원'
    };
    function money(n) {
        var v = Number(n) || 0;
        if (JP) return '¥' + Math.floor(v * 0.1).toLocaleString();
        return v.toLocaleString() + '원';
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }

    // 게임풍 랭킹 HTML 생성
    window.renderSnsRankingHTML = function (data) {
        data = data || {};
        var prizes = data.prizes || [1000000, 500000, 250000, 100000, 50000];
        var rank = data.ranking || [];
        var css = ''
            + '<style>'
            + '.snsrk{background:linear-gradient(180deg,#ffffff,#fdf4ff);border:2px solid #f5d0fe;border-radius:18px;padding:18px 15px;color:#6b4d7a;font-family:inherit;}'
            + '.snsrk-h{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;margin:0 6px 14px;}'
            + '.snsrk-h b{font-size:18px;color:#c026d3;letter-spacing:.3px;white-space:nowrap;}'
            + '.snsrk-h .mo{font-size:12px;color:#c084bc;margin-left:auto;background:#fce7f3;border-radius:980px;padding:2px 10px;white-space:nowrap;}'
            + '.snsrk table{width:100%;border-collapse:collapse;font-size:13px;}'
            + '.snsrk thead th{color:#b07cc0;font-weight:700;font-size:11.5px;text-align:left;padding:8px 6px;border-bottom:2px solid #fae8ff;letter-spacing:.3px;white-space:nowrap;}'
            + '.snsrk tbody td{padding:12px 6px;border-bottom:1px solid #faf0ff;}'
            + '.snsrk tbody tr.top{background:linear-gradient(90deg,#fdf2fb,transparent);}'
            + '.snsrk tbody tr.top td:first-child{border-left:3px solid #f0abfc;}'
            + '.snsrk .rk{font-weight:800;font-size:16px;width:38px;text-align:center;white-space:nowrap;}'
            + '.snsrk .nm{color:#5b3b6e;font-weight:700;word-break:break-all;}'
            + '.snsrk .vw{text-align:right;color:#c026d3;font-weight:800;font-size:16px;white-space:nowrap;}'
            + '.snsrk .pz{text-align:right;color:#ea580c;font-weight:800;white-space:nowrap;}'
            + '.snsrk .th{display:inline-block;background:#a21caf;color:#fff;border-radius:6px;padding:0 6px;font-size:9px;margin-left:5px;vertical-align:middle;}'
            + '.snsrk-note{margin:14px 6px 2px;font-size:11.5px;color:#c084bc;text-align:center;}'
            + '.snsrk-empty{padding:34px 10px;text-align:center;color:#c084bc;font-size:13.5px;}'
            + '.snsrk-desc{margin:0 6px 12px;font-size:11.5px;line-height:1.65;color:#8a6a97;background:#faf0ff;border:1px solid #f5d0fe;border-radius:12px;padding:10px 12px;}'
            + '.snsrk-h .mo{background:#fce7f3;color:#db2777 !important;font-weight:800;}'
            + '</style>';
        var head = '<div class="snsrk"><div class="snsrk-h"><b>🏆 ' + esc(T.title) + '</b><span class="mo">⏰ ' + esc(T.ends) + '</span></div>'
            // desc 는 우리가 만든 안전한 상수(HTML 강조 포함) → esc 하지 않고 그대로 렌더. hideDesc 면 생략.
            + (data._hideDesc ? '' : '<div class="snsrk-desc">' + T.desc + '</div>');
        if (!rank.length) {
            return css + head + '<div class="snsrk-empty">' + esc(T.empty) + '</div><div class="snsrk-note">' + esc(T.note) + '</div></div>';
        }
        var rows = rank.map(function (r, i) {
            var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            var prize = i < prizes.length ? prizes[i] : 0;
            var th = r.is_threads ? '<span class="th">Threads</span>' : '';
            return '<tr class="' + (i < 5 ? 'top' : '') + '">'
                 + '<td class="rk">' + medal + '</td>'
                 + '<td class="nm">' + esc(r.name || '-') + th + '</td>'
                 + '<td class="vw">' + (Number(r.total_score) || 0).toLocaleString() + (JP ? '点' : '점') + '</td>'
                 + '<td class="pz">' + (prize > 0 ? money(prize) : '-') + '</td>'
                 + '</tr>';
        }).join('');
        return css + head
            + '<table><thead><tr>'
            + '<th style="text-align:center;">' + esc(T.rank) + '</th><th>' + esc(T.name) + '</th>'
            + '<th style="text-align:right;">' + esc(T.score) + '</th>'
            + '<th style="text-align:right;">' + esc(T.prize) + '</th></tr></thead><tbody>'
            + rows + '</tbody></table>'
            + '<div class="snsrk-note">' + esc(T.note) + '</div></div>';
    };

    // 컨테이너에 랭킹 로드
    window.loadSnsRankingInto = async function (containerId, opts) {
        var box = document.getElementById(containerId);
        if (!box) return;
        var sb = getSb();
        box.innerHTML = '<div style="padding:24px;text-align:center;color:#9a8c6a;">' + esc(T.loading) + '</div>';
        try {
            var r = await sb.rpc('blog_view_ranking_public');
            var d = (r && r.data) || {};
            if (opts && opts.hideDesc) d._hideDesc = true;   // 마이페이지엔 위에 이벤트 안내가 이미 있어 desc 중복 숨김
            box.innerHTML = window.renderSnsRankingHTML(d);
        } catch (e) { box.innerHTML = '<div style="padding:20px;text-align:center;color:#c05;">' + esc(e.message || e) + '</div>'; }
    };

    // 모달로 랭킹 열기 (팝업·배너에서 호출)
    window.openSnsRankingModal = async function () {
        var ov = document.getElementById('snsRankModal');
        if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'snsRankModal';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,6,28,.85);backdrop-filter:blur(3px);z-index:2147483040;display:flex;align-items:center;justify-content:center;padding:18px;';
        ov.innerHTML = '<div style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto;position:relative;">'
            + '<div id="snsRankModalBody"><div style="padding:40px;text-align:center;color:#c084bc;background:#fff;border-radius:18px;">' + esc(T.loading) + '</div></div>'
            + '<button onclick="document.getElementById(\'snsRankModal\').remove()" style="margin-top:12px;width:100%;padding:12px;background:linear-gradient(135deg,#f9a8d4,#c084fc);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;">' + esc(T.close) + '</button>'
            + '</div>';
        ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        var sb = getSb();
        try {
            var r = await sb.rpc('blog_view_ranking_public');
            var b = document.getElementById('snsRankModalBody');
            if (b) b.innerHTML = window.renderSnsRankingHTML((r && r.data) || {});
        } catch (e) {
            var b2 = document.getElementById('snsRankModalBody');
            if (b2) b2.innerHTML = '<div style="padding:24px;text-align:center;color:#c05;">' + esc(e.message || e) + '</div>';
        }
    };
})();
