// 커뮤니티 페이지 공통 메뉴 바
// 모든 커뮤니티 페이지의 <nav class="nav"> 아래에 자동 삽입
(function(){
    const LANG = (window.__LANG || document.documentElement.lang || 'ko').toLowerCase();

    const MENU = [
        { path: '/services',       i: 'fa-house',            t: { ko:'서비스홈',     ja:'サービスホーム', en:'Service Home', zh:'服务首页', es:'Inicio',    de:'Start',     fr:'Accueil' } },
        { path: '/community',      i: 'fa-users',            t: { ko:'지역 커뮤니티', ja:'コミュニティ', en:'Community', zh:'社区',     es:'Comunidad', de:'Community', fr:'Communauté' } },
        { path: '/market',         i: 'fa-store',            t: { ko:'중고장터',   ja:'中古市場',     en:'Market',    zh:'二手',     es:'Mercado',   de:'Markt',     fr:'Marché' } },
        { path: '/jobs',           i: 'fa-briefcase',        t: { ko:'타임알바',   ja:'バイト',       en:'Jobs',      zh:'兼职',     es:'Empleos',   de:'Jobs',      fr:'Emplois' } },
        { path: '/experts',        i: 'fa-user-tie',         t: { ko:'전문가',     ja:'専門家',       en:'Experts',   zh:'专家',     es:'Expertos',  de:'Experten',  fr:'Experts' } },
        { path: '/design-market',  i: 'fa-palette',          t: { ko:'디자인',     ja:'デザイン',     en:'Design',    zh:'设计',     es:'Diseño',    de:'Design',    fr:'Design' } },
        { path: '/realty',         i: 'fa-building',         t: { ko:'부동산',     ja:'不動産',       en:'Realty',    zh:'房产',     es:'Inmobiliaria', de:'Immobilien', fr:'Immobilier' } },
        { path: '/dating',         i: 'fa-heart',            t: { ko:'소개팅',     ja:'出会い',       en:'Dating',    zh:'交友',     es:'Citas',     de:'Dating',    fr:'Rencontres' } }
    ];

    const curPath = (location.pathname || '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const q = location.search || '';

    const bar = document.createElement('nav');
    bar.className = 'cnav-bar';
    bar.innerHTML = MENU.map(m => {
        const label = m.t[LANG] || m.t.en;
        const active = curPath === m.path || curPath === m.path + '.html';
        return `<a href="${m.path}${q}" class="cnav-item${active ? ' active' : ''}">
            <i class="fa-solid ${m.i}"></i>
            <span>${label}</span>
        </a>`;
    }).join('');

    const style = document.createElement('style');
    style.textContent = `
        .cnav-bar{position:sticky;top:56px;z-index:99;background:#fff;border-bottom:1px solid #e2e8f0;padding:0 12px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;box-shadow:0 2px 6px rgba(15,23,42,0.04);}
        .cnav-bar::-webkit-scrollbar{display:none;}
        .cnav-item{display:inline-flex;align-items:center;gap:7px;padding:12px 14px;color:#64748b;text-decoration:none;font-size:13px;font-weight:600;border-bottom:2.5px solid transparent;transition:color 0.15s,border-color 0.15s;flex-shrink:0;}
        .cnav-item i{font-size:13px;opacity:0.85;}
        .cnav-item:hover{color:#1e293b;}
        .cnav-item.active{color:#7c3aed;border-bottom-color:#7c3aed;font-weight:800;}
        .cnav-item.active i{opacity:1;color:#7c3aed;}
        @media(max-width:640px){
            .cnav-bar{padding:0 6px;}
            .cnav-item{padding:11px 11px;font-size:12px;gap:5px;}
            .cnav-item i{font-size:12px;}
        }
    `;
    document.head.appendChild(style);

    function inject() {
        const existingNav = document.querySelector('nav.nav');
        if (existingNav && existingNav.parentNode) {
            existingNav.parentNode.insertBefore(bar, existingNav.nextSibling);
            // 로고 옆에 "서비스홈" 링크 추가 (첫 번째 항목 텍스트 재활용)
            const logo = existingNav.querySelector('.nav-logo');
            if (logo && !existingNav.querySelector('.cnav-logo-home')) {
                const homeLabel = MENU[0].t[LANG] || MENU[0].t.en;
                const badge = document.createElement('a');
                badge.href = '/services' + q;
                badge.className = 'cnav-logo-home';
                badge.innerHTML = `<i class="fa-solid fa-house"></i> ${homeLabel}`;
                badge.style.cssText = 'margin-left:10px;padding:5px 12px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-radius:999px;font-size:11px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:5px;box-shadow:0 3px 10px -2px rgba(124,58,237,0.4);';
                logo.parentNode.insertBefore(badge, logo.nextSibling);
            }
        } else {
            (document.body.firstChild ? document.body.insertBefore(bar, document.body.firstChild) : document.body.appendChild(bar));
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();
})();
