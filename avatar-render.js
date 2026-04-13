// 공통 아바타 렌더링 유틸
// 사용법:
//   <div id="myAvatar"></div>
//   CMAvatar.render(document.getElementById('myAvatar'), profile, 40)
//   CMAvatar.html(profile, 40) -> "<img ...>" 혹은 fallback icon
//   CMAvatar.loadProfiles(sb, [userId1, ...]) -> { userId: profile } Map
(function(){
    function fallback(size){
        const s = size || 40;
        return `<div style="width:${s}px;height:${s*1.3}px;border-radius:${Math.max(8,s*0.22)}px;background:linear-gradient(135deg,#f5f3ff,#fce7f3);display:flex;align-items:center;justify-content:center;color:#a855f7;font-size:${s*0.5}px;"><i class="fa-solid fa-user"></i></div>`;
    }
    function html(profile, size){
        const s = size || 40;
        const h = Math.round(s * 1.3); // 1:1.3 세로형
        const url = typeof profile === 'string' ? profile : (profile && (profile.avatar_url || profile.avatar));
        if (!url) return fallback(s);
        const safeUrl = String(url).replace(/"/g, '&quot;');
        return `<img src="${safeUrl}" loading="lazy" style="width:${s}px;height:${h}px;border-radius:${Math.max(8,s*0.22)}px;object-fit:cover;background:#f5f3ff;" onerror="this.outerHTML=CMAvatar._fb(${s})">`;
    }
    async function loadProfiles(sb, userIds){
        const ids = Array.from(new Set((userIds || []).filter(Boolean)));
        if (ids.length === 0) return {};
        try {
            const { data } = await sb.from('profiles').select('id,username,avatar_url').in('id', ids);
            const map = {};
            (data || []).forEach(p => { map[p.id] = p; });
            return map;
        } catch(e) { return {}; }
    }
    window.CMAvatar = { render(el, profile, size){ if(el) el.innerHTML = html(profile, size); }, html, fallback, loadProfiles, _fb: fallback };
})();
