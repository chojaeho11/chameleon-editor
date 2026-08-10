// 2026-08-10: 공개 SNS 조회수 랭킹 — 게임풍(다크/골드) 위젯. index.html(팝업)·mypage 공용.
(function () {
    function getSb() { return window.sb || (window.supabaseClient) || null; }
    var JP = (window.__SITE_CODE === 'JP');
    var T = {
        title: JP ? 'SNS PRランキング' : 'SNS 홍보 랭킹',
        rank: JP ? '順位' : '순위',
        name: JP ? '名前' : '이름',
        posts: JP ? '投稿数' : '게시글 수',
        prize: JP ? '賞金' : '보상',
        empty: JP ? '今月の登録がまだありません。最初のランカーになりましょう！' : '이번 달 등록 내역이 없습니다. 첫 랭커가 되어보세요!',
        note: JP ? '順位はリアルタイム反映 · 投稿数が多いほど上位 · 上位5名に現金進呈（管理者確認分）' : '순위는 실시간 반영 · 게시글이 많을수록 상위 · 상위 5명 현금 지급(관리자 확인분)',
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
            + '.snsrk{background:linear-gradient(180deg,#1c1712,#0f0c09);border:1px solid #3a2f1e;border-radius:14px;padding:16px 14px;color:#e8dcc0;font-family:inherit;}'
            + '.snsrk-h{display:flex;align-items:center;gap:8px;margin:0 6px 12px;}'
            + '.snsrk-h b{font-size:17px;color:#e6c766;letter-spacing:.5px;}'
            + '.snsrk-h .mo{font-size:12px;color:#9a8c6a;margin-left:auto;}'
            + '.snsrk table{width:100%;border-collapse:collapse;font-size:13px;}'
            + '.snsrk thead th{color:#9a8c6a;font-weight:600;font-size:11.5px;text-align:left;padding:8px 10px;border-bottom:1px solid #3a2f1e;letter-spacing:.4px;}'
            + '.snsrk tbody td{padding:11px 10px;border-bottom:1px solid #241d14;}'
            + '.snsrk tbody tr.top{background:linear-gradient(90deg,rgba(230,199,102,.10),transparent);}'
            + '.snsrk .rk{font-weight:800;font-size:15px;width:44px;text-align:center;}'
            + '.snsrk .nm{color:#f0e7d0;font-weight:600;}'
            + '.snsrk .vw{text-align:right;color:#e6c766;font-weight:800;font-size:15px;}'
            + '.snsrk .ct{text-align:center;color:#bcae8c;}'
            + '.snsrk .pz{text-align:right;color:#ffd97a;font-weight:700;}'
            + '.snsrk .th{display:inline-block;background:#000;color:#fff;border-radius:4px;padding:0 5px;font-size:9px;margin-left:5px;vertical-align:middle;}'
            + '.snsrk-note{margin:12px 6px 2px;font-size:11px;color:#8a7c5c;text-align:center;}'
            + '.snsrk-empty{padding:34px 10px;text-align:center;color:#9a8c6a;font-size:13px;}'
            + '</style>';
        var head = '<div class="snsrk"><div class="snsrk-h"><b>🏆 ' + esc(T.title) + '</b><span class="mo">' + esc(data.month || '') + '</span></div>';
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
                 + '<td class="vw">' + (Number(r.total_posts) || 0).toLocaleString() + '</td>'
                 + '<td class="pz">' + (prize > 0 ? money(prize) : '-') + '</td>'
                 + '</tr>';
        }).join('');
        return css + head
            + '<table><thead><tr>'
            + '<th style="text-align:center;">' + esc(T.rank) + '</th><th>' + esc(T.name) + '</th>'
            + '<th style="text-align:right;">' + esc(T.posts) + '</th>'
            + '<th style="text-align:right;">' + esc(T.prize) + '</th></tr></thead><tbody>'
            + rows + '</tbody></table>'
            + '<div class="snsrk-note">' + esc(T.note) + '</div></div>';
    };

    // 컨테이너에 랭킹 로드
    window.loadSnsRankingInto = async function (containerId) {
        var box = document.getElementById(containerId);
        if (!box) return;
        var sb = getSb();
        box.innerHTML = '<div style="padding:24px;text-align:center;color:#9a8c6a;">' + esc(T.loading) + '</div>';
        try {
            var r = await sb.rpc('blog_view_ranking_public');
            box.innerHTML = window.renderSnsRankingHTML((r && r.data) || {});
        } catch (e) { box.innerHTML = '<div style="padding:20px;text-align:center;color:#c05;">' + esc(e.message || e) + '</div>'; }
    };

    // 모달로 랭킹 열기 (팝업·배너에서 호출)
    window.openSnsRankingModal = async function () {
        var ov = document.getElementById('snsRankModal');
        if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'snsRankModal';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:100001;display:flex;align-items:center;justify-content:center;padding:18px;';
        ov.innerHTML = '<div style="max-width:520px;width:100%;max-height:90vh;overflow-y:auto;position:relative;">'
            + '<div id="snsRankModalBody"><div style="padding:40px;text-align:center;color:#9a8c6a;">' + esc(T.loading) + '</div></div>'
            + '<button onclick="document.getElementById(\'snsRankModal\').remove()" style="margin-top:12px;width:100%;padding:12px;background:#2a2118;color:#e6c766;border:1px solid #3a2f1e;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">' + esc(T.close) + '</button>'
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
