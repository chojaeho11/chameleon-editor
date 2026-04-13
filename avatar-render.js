// 공통 아바타 렌더링 유틸
// 사용법:
//   <div id="myAvatar"></div>
//   CMAvatar.render(document.getElementById('myAvatar'), profile, 40)
//   CMAvatar.html(profile, 40) -> "<img ...>" 혹은 fallback icon
//   CMAvatar.loadProfiles(sb, [userId1, ...]) -> { userId: profile } Map
(function(){
    const PRESETS = [
        '/avatar/101a2d9a69f59713891a80e23e61173c.jpg',
        '/avatar/2023d1ae2edba00099fd4ea53e744449.jpg',
        '/avatar/5ee40b298c2e2c75f17f65e47eb6a6d9.jpg',
        '/avatar/635751971ad3dd62bbabd006eab2ea49.jpg',
        '/avatar/6f2d04514b92c5159c14605d3bd29a9e.jpg',
        '/avatar/8617191b8f92cdd8b519a84ccccccdfa.jpg',
        '/avatar/883b16583c399ac242c5047e5401ee3c.jpg',
        '/avatar/8b8a7125e1f9cc9eab12a17a8187bd24.jpg',
        '/avatar/8cd60a33bb4bcc3db388dc8c9a5cb7e9.jpg',
        '/avatar/95f910960caee7e6b648764ea059c917.jpg',
        '/avatar/9a76bd948f5be2795127325a63f332f6.jpg',
        '/avatar/9dff1a69628fed4e402943f3991fe9a1.jpg',
        '/avatar/b239ebec83760ee3a6d82828a39f50d9.jpg',
        '/avatar/d4c96364c929488f96a6bc008fbdd7e3.jpg',
        '/avatar/d65994b43d4e223c5fa0495f084c7385.jpg',
        '/avatar/d9f7509e9d7ae342d05fc65adc57ac74.jpg',
        '/avatar/e1def68bb6012e5cd8842acc1bcc3614.jpg',
        '/avatar/e3c00131ff552529c6ba8cd2df24ae41.jpg'
    ];
    function hashSeed(s){
        s = String(s||'');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h<<5) - h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }
    function pickFor(seed){
        return PRESETS[hashSeed(seed) % PRESETS.length];
    }
    function fallback(size){
        const s = size || 40;
        return `<div style="width:${s}px;height:${s*1.3}px;border-radius:${Math.max(8,s*0.22)}px;background:linear-gradient(135deg,#f5f3ff,#fce7f3);display:flex;align-items:center;justify-content:center;color:#a855f7;font-size:${s*0.5}px;"><i class="fa-solid fa-user"></i></div>`;
    }
    function urlFor(profile, seed){
        if (typeof profile === 'string') return profile;
        if (profile) {
            if (profile.avatar_url) return profile.avatar_url;
            const sid = seed || profile.id || profile.user_id || profile.username;
            if (sid) return pickFor(sid);
        }
        return seed ? pickFor(seed) : null;
    }
    function html(profile, size, opts){
        const s = size || 40;
        const o = opts || {};
        const h = o.round ? s : Math.round(s * 1.3);
        const radius = o.round ? '50%' : Math.max(8, s*0.22) + 'px';
        const url = urlFor(profile, o.seed);
        if (!url) return fallback(s);
        const safeUrl = String(url).replace(/"/g, '&quot;');
        return `<img src="${safeUrl}" loading="lazy" style="width:${s}px;height:${h}px;border-radius:${radius};object-fit:cover;background:#f5f3ff;" onerror="this.outerHTML=CMAvatar._fb(${s})">`;
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
    window.CMAvatar = {
        render(el, profile, size, opts){ if(el) el.innerHTML = html(profile, size, opts); },
        html, fallback, loadProfiles, pickFor, urlFor, _fb: fallback, PRESETS
    };
})();
