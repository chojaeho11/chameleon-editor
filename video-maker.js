// video-maker.js — 영상 편집기 v3
// Professional: timeline, overlays, music, transitions, adjustments, templates

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MUSIC = [
    { id:'none', name:'없음', icon:'fa-volume-xmark', desc:'배경 음악 없음' },
    { id:'upbeat', name:'Upbeat Pop', icon:'fa-bolt', desc:'밝고 경쾌한 팝', bpm:120, melody:[60,64,67,72,67,64,60,67], bass:[48,48,55,55,52,52,48,48], wave:'square' },
    { id:'chill', name:'Lo-fi Chill', icon:'fa-mug-hot', desc:'편안한 로파이', bpm:75, melody:[57,60,64,62,60,57,55,57], bass:[45,45,48,48,43,43,45,45], wave:'triangle' },
    { id:'cinema', name:'Cinematic', icon:'fa-film', desc:'웅장한 시네마틱', bpm:60, melody:[48,55,60,63,60,55,48,51], bass:[36,36,43,43,48,48,36,36], wave:'sawtooth' },
    { id:'happy', name:'Happy Pop', icon:'fa-face-smile', desc:'신나는 팝', bpm:130, melody:[65,69,72,77,72,69,65,72], bass:[53,53,57,57,60,60,53,53], wave:'square' },
    { id:'ambient', name:'Ambient', icon:'fa-cloud', desc:'차분한 앰비언트', bpm:50, melody:[50,57,62,57,55,50,55,57], bass:[38,38,45,45,43,43,38,38], wave:'sine' }
];

const TRANSITIONS = [
    { id:'none', name:'없음', icon:'fa-xmark', color:'#94a3b8' },
    { id:'fade', name:'페이드', icon:'fa-circle-half-stroke', color:'#6366f1' },
    { id:'slideL', name:'← 슬라이드', icon:'fa-arrow-left', color:'#f59e0b' },
    { id:'slideR', name:'→ 슬라이드', icon:'fa-arrow-right', color:'#f59e0b' },
    { id:'slideUp', name:'↑ 슬라이드', icon:'fa-arrow-up', color:'#f59e0b' },
    { id:'zoomIn', name:'줌 인', icon:'fa-magnifying-glass-plus', color:'#10b981' },
    { id:'zoomOut', name:'줌 아웃', icon:'fa-magnifying-glass-minus', color:'#10b981' },
    { id:'wipe', name:'와이프', icon:'fa-bars-staggered', color:'#ec4899' }
];

const STICKERS = ['⭐','❤️','🔥','✨','💯','👍','🎉','💡','🎵','🎯','💪','🌟','😊','🎬','📌','🏆','💎','🌈','🎨','👏'];

const TEMPLATES = [
    { id:'title', name:'타이틀 카드', icon:'fa-heading', desc:'중앙 대형 텍스트',
      create:(w,h)=>[
        {type:'rect',x:0,y:h*0.3,w:w,h:h*0.4,fill:'rgba(0,0,0,0.6)',stroke:'',strokeW:0,radius:0},
        {type:'text',x:w/2,y:h*0.45,text:'제목을 입력하세요',fontSize:Math.round(w*0.06),color:'#ffffff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},
        {type:'text',x:w/2,y:h*0.58,text:'부제목',fontSize:Math.round(w*0.025),color:'#cccccc',bold:false,shadow:true,align:'center',fontFamily:'sans-serif'}
      ]},
    { id:'lower3rd', name:'하단 자막', icon:'fa-closed-captioning', desc:'하단 이름 바',
      create:(w,h)=>[
        {type:'rect',x:w*0.05,y:h*0.82,w:w*0.5,h:h*0.06,fill:'#6366f1',stroke:'',strokeW:0,radius:8},
        {type:'rect',x:w*0.05,y:h*0.88,w:w*0.35,h:h*0.04,fill:'rgba(255,255,255,0.9)',stroke:'',strokeW:0,radius:6},
        {type:'text',x:w*0.3,y:h*0.855,text:'이름',fontSize:Math.round(w*0.025),color:'#ffffff',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'},
        {type:'text',x:w*0.22,y:h*0.905,text:'직함 / 설명',fontSize:Math.round(w*0.016),color:'#333333',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}
      ]},
    { id:'caption', name:'자막 스타일', icon:'fa-align-center', desc:'하단 반투명 캡션',
      create:(w,h)=>[
        {type:'rect',x:0,y:h*0.85,w:w,h:h*0.15,fill:'rgba(0,0,0,0.65)',stroke:'',strokeW:0,radius:0},
        {type:'text',x:w/2,y:h*0.935,text:'자막 텍스트를 입력하세요',fontSize:Math.round(w*0.03),color:'#ffffff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'}
      ]},
    { id:'quote', name:'인용문', icon:'fa-quote-left', desc:'인용문 + 저자',
      create:(w,h)=>[
        {type:'rect',x:w*0.1,y:h*0.25,w:w*0.8,h:h*0.5,fill:'rgba(0,0,0,0.5)',stroke:'rgba(255,255,255,0.3)',strokeW:2,radius:20},
        {type:'text',x:w/2,y:h*0.45,text:'"여기에 인용문을 입력하세요"',fontSize:Math.round(w*0.035),color:'#ffffff',bold:false,shadow:true,align:'center',fontFamily:'serif'},
        {type:'text',x:w/2,y:h*0.6,text:'— 저자 이름',fontSize:Math.round(w*0.02),color:'#a5b4fc',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'}
      ]},
    { id:'announce', name:'공지/강조', icon:'fa-bullhorn', desc:'강조 헤드라인',
      create:(w,h)=>[
        {type:'rect',x:w*0.1,y:h*0.35,w:w*0.8,h:h*0.3,fill:'#ef4444',stroke:'#ffffff',strokeW:4,radius:16},
        {type:'text',x:w/2,y:h*0.48,text:'중요 공지',fontSize:Math.round(w*0.05),color:'#ffffff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},
        {type:'text',x:w/2,y:h*0.57,text:'세부 내용을 입력하세요',fontSize:Math.round(w*0.022),color:'#fecaca',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}
      ]}
];

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let vm = {
    scenes: [],     // [{file,url,img, overlays:[], adj:{brightness:0,contrast:0,saturation:100,blur:0,hue:0}, transition:'fade', duration:3}]
    si: 0,          // selected scene index
    oi: -1,         // selected overlay index
    canvas: null, ctx: null,
    w: 1920, h: 1080,
    mode: 'video',
    playing: false, paused: false, cancel: false,
    music: 'none',
    actx: null, mnode: null, mstop: null,
    tab: 'overlay',   // right panel active tab
    addMode: null,     // 'text','rect','circle','sticker' or null
    addSticker: '⭐',
    drag: null,        // {oi, ox, oy}
    musicPlaying: null // which music ID is being previewed
};

// ═══════════════════════════════════════════════════════════════
// AUDIO SYSTEM
// ═══════════════════════════════════════════════════════════════
async function getAC() {
    if (!vm.actx) vm.actx = new (window.AudioContext || window.webkitAudioContext)();
    if (vm.actx.state === 'suspended') await vm.actx.resume();
    return vm.actx;
}

async function playMusicPreview(id) {
    stopMusicPreview();
    if (id === 'none') { vm.musicPlaying = null; return; }
    const m = MUSIC.find(x => x.id === id);
    if (!m) return;
    const ctx = await getAC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.connect(master);
    master.connect(ctx.destination);
    const dur = 60 / m.bpm;
    let ni = 0, stopped = false, timer;
    function note() {
        if (stopped) return;
        const t = ctx.currentTime;
        const freq = 440 * Math.pow(2, (m.melody[ni % m.melody.length] - 69) / 12);
        const bassFreq = 440 * Math.pow(2, (m.bass[ni % m.bass.length] - 69) / 12);
        // melody
        const o1 = ctx.createOscillator(); o1.type = m.wave; o1.frequency.value = freq;
        const e1 = ctx.createGain(); e1.gain.setValueAtTime(0.3, t); e1.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.9);
        o1.connect(e1).connect(comp); o1.start(t); o1.stop(t + dur);
        // harmony (5th)
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.5;
        const e2 = ctx.createGain(); e2.gain.setValueAtTime(0.08, t); e2.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.85);
        o2.connect(e2).connect(comp); o2.start(t); o2.stop(t + dur);
        // bass
        const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = bassFreq;
        const e3 = ctx.createGain(); e3.gain.setValueAtTime(0.2, t); e3.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.8);
        o3.connect(e3).connect(comp); o3.start(t); o3.stop(t + dur);
        ni++;
        timer = setTimeout(note, dur * 1000);
    }
    vm.mstop = () => { stopped = true; clearTimeout(timer); try { master.disconnect(); } catch(e){} };
    vm.musicPlaying = id;
    note();
    updateMusicUI();
}

function stopMusicPreview() {
    if (vm.mstop) { vm.mstop(); vm.mstop = null; }
    vm.musicPlaying = null;
    updateMusicUI();
}

async function createMusicStream(musicId, totalMs) {
    if (musicId === 'none') return null;
    const m = MUSIC.find(x => x.id === musicId);
    if (!m) return null;
    const ctx = await getAC();
    const dest = ctx.createMediaStreamDestination();
    const master = ctx.createGain();
    master.gain.value = 0.35;
    const comp = ctx.createDynamicsCompressor();
    comp.connect(master); master.connect(dest);
    const dur = 60 / m.bpm;
    const total = Math.ceil(totalMs / 1000 / dur) + 4;
    for (let i = 0; i < total; i++) {
        const t = ctx.currentTime + i * dur;
        const freq = 440 * Math.pow(2, (m.melody[i % m.melody.length] - 69) / 12);
        const bf = 440 * Math.pow(2, (m.bass[i % m.bass.length] - 69) / 12);
        const o1 = ctx.createOscillator(); o1.type = m.wave; o1.frequency.value = freq;
        const e1 = ctx.createGain(); e1.gain.setValueAtTime(0.25, t); e1.gain.exponentialRampToValueAtTime(0.003, t + dur * 0.9);
        o1.connect(e1).connect(comp); o1.start(t); o1.stop(t + dur);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.5;
        const e2 = ctx.createGain(); e2.gain.setValueAtTime(0.06, t); e2.gain.exponentialRampToValueAtTime(0.003, t + dur * 0.85);
        o2.connect(e2).connect(comp); o2.start(t); o2.stop(t + dur);
        const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = bf;
        const e3 = ctx.createGain(); e3.gain.setValueAtTime(0.15, t); e3.gain.exponentialRampToValueAtTime(0.003, t + dur * 0.8);
        o3.connect(e3).connect(comp); o3.start(t); o3.stop(t + dur);
    }
    return dest.stream;
}

// ═══════════════════════════════════════════════════════════════
// SCENE MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function getScene(i) { return vm.scenes[i ?? vm.si]; }
function curScene() { return vm.scenes[vm.si]; }

function addFiles(fileList) {
    Array.from(fileList).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => {
            vm.scenes.push({
                file: f, url, img,
                overlays: [],
                adj: { brightness:0, contrast:0, saturation:100, blur:0, hue:0 },
                transition: 'fade',
                duration: 3
            });
            selectScene(vm.scenes.length - 1);
            updateAll();
        };
        img.src = url;
    });
}

function removeScene(i) {
    if (vm.scenes[i]) URL.revokeObjectURL(vm.scenes[i].url);
    vm.scenes.splice(i, 1);
    if (vm.si >= vm.scenes.length) vm.si = Math.max(0, vm.scenes.length - 1);
    vm.oi = -1;
    updateAll();
    render();
}

function selectScene(i) {
    if (i < 0 || i >= vm.scenes.length) return;
    vm.si = i;
    vm.oi = -1;
    render();
    updateAll();
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function addOverlay(type, x, y, props) {
    const s = curScene();
    if (!s) return;
    let o;
    const defFont = Math.round(vm.w * 0.04);
    switch(type) {
        case 'text':
            o = { type:'text', x, y, text: props?.text || '텍스트', fontSize: props?.fontSize || defFont,
                  color: props?.color || '#ffffff', bold: props?.bold ?? true, shadow: props?.shadow ?? true,
                  align:'center', fontFamily: props?.fontFamily || 'sans-serif' };
            break;
        case 'rect':
            o = { type:'rect', x, y, w: props?.w || vm.w*0.3, h: props?.h || vm.h*0.12,
                  fill: props?.fill || 'rgba(99,102,241,0.5)', stroke: props?.stroke || '#ffffff', strokeW: props?.strokeW || 2, radius: props?.radius || 10 };
            break;
        case 'circle':
            o = { type:'circle', x, y, r: props?.r || vm.w*0.06,
                  fill: props?.fill || 'rgba(99,102,241,0.5)', stroke: props?.stroke || '#ffffff', strokeW: props?.strokeW || 2 };
            break;
        case 'sticker':
            o = { type:'sticker', x, y, emoji: props?.emoji || '⭐', size: props?.size || Math.round(vm.w*0.08) };
            break;
    }
    if (o) {
        s.overlays.push(o);
        vm.oi = s.overlays.length - 1;
        render();
        updateToolsPanel();
    }
}

function removeOverlay(i) {
    const s = curScene();
    if (!s || !s.overlays[i]) return;
    s.overlays.splice(i, 1);
    vm.oi = -1;
    render();
    updateToolsPanel();
}

function selectOverlay(i) {
    vm.oi = i;
    render();
    updateToolsPanel();
}

// hit test: returns overlay index or -1
function hitOverlay(cx, cy) {
    const s = curScene();
    if (!s) return -1;
    for (let i = s.overlays.length - 1; i >= 0; i--) {
        const o = s.overlays[i];
        switch(o.type) {
            case 'text': {
                const tw = o.fontSize * Math.max(o.text.length, 1) * 0.55;
                const th = o.fontSize * 1.3;
                const lx = o.align === 'center' ? o.x - tw/2 : o.x;
                if (cx >= lx && cx <= lx + tw && cy >= o.y - th && cy <= o.y) return i;
                break;
            }
            case 'rect':
                if (cx >= o.x && cx <= o.x + o.w && cy >= o.y && cy <= o.y + o.h) return i;
                break;
            case 'circle':
                if (Math.hypot(cx - o.x, cy - o.y) <= o.r) return i;
                break;
            case 'sticker': {
                const hs = o.size / 2;
                if (cx >= o.x - hs && cx <= o.x + hs && cy >= o.y - hs && cy <= o.y + hs) return i;
                break;
            }
        }
    }
    return -1;
}

function canvasXY(e) {
    const r = vm.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * vm.w, y: (e.clientY - r.top) / r.height * vm.h };
}

// ═══════════════════════════════════════════════════════════════
// CANVAS RENDERING
// ═══════════════════════════════════════════════════════════════
function render() {
    if (!vm.ctx) return;
    const s = curScene();
    if (!s) {
        vm.ctx.fillStyle = '#1a1a2e'; vm.ctx.fillRect(0, 0, vm.w, vm.h);
        vm.ctx.fillStyle = '#666'; vm.ctx.font = `${vm.w*0.025}px sans-serif`; vm.ctx.textAlign = 'center';
        vm.ctx.fillText('이미지를 업로드하세요', vm.w/2, vm.h/2);
        return;
    }
    renderScene(vm.si, vm.ctx, vm.w, vm.h, true);
}

function renderScene(si, ctx, w, h, showSelection) {
    const s = vm.scenes[si];
    if (!s) return;
    // adjustments via CSS filter
    const a = s.adj;
    ctx.filter = `brightness(${1 + a.brightness/100}) contrast(${1 + a.contrast/100}) saturate(${a.saturation}%) blur(${a.blur}px) hue-rotate(${a.hue}deg)`;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    drawCover(ctx, s.img, w, h);
    ctx.filter = 'none';
    // overlays
    s.overlays.forEach((o, i) => {
        renderOverlay(ctx, o, w, h);
        if (showSelection && i === vm.oi) renderSelection(ctx, o, w, h);
    });
}

function renderOverlay(ctx, o) {
    ctx.save();
    switch(o.type) {
        case 'text':
            ctx.font = `${o.bold?'bold ':''} ${o.fontSize}px ${o.fontFamily || 'sans-serif'}`;
            ctx.fillStyle = o.color || '#fff';
            ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
            if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = o.fontSize*0.12; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
            // multiline
            const lines = (o.text||'').split('\n');
            lines.forEach((l, li) => ctx.fillText(l, o.x, o.y + li * o.fontSize * 1.25));
            break;
        case 'rect':
            ctx.fillStyle = o.fill || 'transparent';
            if (o.radius) { roundRect(ctx, o.x, o.y, o.w, o.h, o.radius); ctx.fill(); }
            else ctx.fillRect(o.x, o.y, o.w, o.h);
            if (o.stroke && o.strokeW) {
                ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW;
                if (o.radius) { roundRect(ctx, o.x, o.y, o.w, o.h, o.radius); ctx.stroke(); }
                else ctx.strokeRect(o.x, o.y, o.w, o.h);
            }
            break;
        case 'circle':
            ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2);
            if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
            if (o.stroke && o.strokeW) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeW; ctx.stroke(); }
            break;
        case 'sticker':
            ctx.font = `${o.size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(o.emoji, o.x, o.y);
            break;
    }
    ctx.restore();
}

function renderSelection(ctx, o) {
    ctx.save();
    ctx.strokeStyle = '#00bfff'; ctx.lineWidth = Math.max(3, vm.w * 0.002); ctx.setLineDash([10, 6]);
    let bx, by, bw, bh;
    switch(o.type) {
        case 'text': {
            const tw = o.fontSize * Math.max((o.text||'T').length, 1) * 0.55;
            const th = o.fontSize * 1.3;
            bx = (o.align === 'center') ? o.x - tw/2 : o.x; by = o.y - th/2 - o.fontSize*0.2; bw = tw; bh = th;
            break;
        }
        case 'rect': bx = o.x; by = o.y; bw = o.w; bh = o.h; break;
        case 'circle': bx = o.x - o.r; by = o.y - o.r; bw = bh = o.r*2; break;
        case 'sticker': bx = o.x - o.size/2; by = o.y - o.size/2; bw = bh = o.size; break;
        default: ctx.restore(); return;
    }
    ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);
    // corner handles
    const hs = Math.max(8, vm.w * 0.005);
    ctx.fillStyle = '#00bfff'; ctx.setLineDash([]);
    [[bx-4,by-4],[bx+bw+4-hs,by-4],[bx-4,by+bh+4-hs],[bx+bw+4-hs,by+bh+4-hs]].forEach(([hx,hy]) => ctx.fillRect(hx,hy,hs,hs));
    ctx.restore();
}

function drawCover(ctx, img, cw, ch) {
    const ir = img.width / img.height, cr = cw / ch;
    let sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

function drawCoverAt(ctx, img, ox, oy, cw, ch) {
    ctx.save(); ctx.translate(ox, oy);
    drawCover(ctx, img, cw, ch);
    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════
// UI RENDERING
// ═══════════════════════════════════════════════════════════════
function updateAll() {
    updateSceneStrip();
    updateTimeline();
    updateToolsPanel();
    updateMusicUI();
}

// --- Left: Scene Strip ---
function updateSceneStrip() {
    const el = document.getElementById('vmSceneStrip');
    if (!el) return;
    el.innerHTML = '';
    vm.scenes.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'vm-sc-thumb' + (i === vm.si ? ' active' : '');
        d.innerHTML = `<span class="vm-sc-num">${i+1}</span><img src="${s.url}" draggable="false">
            <button class="vm-sc-del" onclick="event.stopPropagation();window._vmRemoveScene(${i})">×</button>`;
        d.onclick = () => selectScene(i);
        // drag reorder
        d.draggable = true;
        d.addEventListener('dragstart', e => e.dataTransfer.setData('text', i));
        d.addEventListener('dragover', e => { e.preventDefault(); d.style.outline='2px solid #6366f1'; });
        d.addEventListener('dragleave', () => d.style.outline='');
        d.addEventListener('drop', e => {
            e.preventDefault(); d.style.outline='';
            const from = parseInt(e.dataTransfer.getData('text'));
            if (from !== i && !isNaN(from)) { const [moved] = vm.scenes.splice(from,1); vm.scenes.splice(i,0,moved); vm.si = i; updateAll(); render(); }
        });
        el.appendChild(d);
    });
}

// --- Bottom: Timeline ---
function updateTimeline() {
    const el = document.getElementById('vmTimeline');
    if (!el) return;
    el.innerHTML = '';
    vm.scenes.forEach((s, i) => {
        if (i > 0) {
            // transition indicator
            const tr = document.createElement('div');
            tr.className = 'vm-tl-trans';
            const t = TRANSITIONS.find(x => x.id === s.transition) || TRANSITIONS[1];
            tr.innerHTML = `<i class="fa-solid ${t.icon}" style="color:${t.color}"></i>`;
            tr.title = t.name;
            el.appendChild(tr);
        }
        const d = document.createElement('div');
        d.className = 'vm-tl-item' + (i === vm.si ? ' active' : '');
        d.innerHTML = `<img src="${s.url}"><span>${s.duration}s</span>`;
        d.onclick = () => selectScene(i);
        el.appendChild(d);
    });
}

// --- Right: Tools Panel ---
function updateToolsPanel() {
    // Update tab buttons
    document.querySelectorAll('.vm-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === vm.tab);
    });
    const content = document.getElementById('vmToolContent');
    if (!content) return;
    switch(vm.tab) {
        case 'overlay': renderOverlayTab(content); break;
        case 'element': renderElementTab(content); break;
        case 'music': renderMusicTab(content); break;
        case 'transition': renderTransitionTab(content); break;
        case 'adjust': renderAdjustTab(content); break;
        case 'template': renderTemplateTab(content); break;
        default: content.innerHTML = '';
    }
}

function renderOverlayTab(el) {
    const s = curScene();
    let html = '<div class="vm-tool-section"><b>텍스트 추가</b>';
    html += `<button class="vm-add-btn" onclick="window._vmStartAdd('text')"><i class="fa-solid fa-font"></i> 캔버스 클릭하여 배치</button>`;
    html += '</div>';
    if (s && vm.oi >= 0 && s.overlays[vm.oi]) {
        const o = s.overlays[vm.oi];
        html += '<div class="vm-tool-section"><b>선택된 요소 편집</b>';
        if (o.type === 'text') {
            html += `<label>텍스트</label><input class="vm-input" value="${(o.text||'').replace(/"/g,'&quot;')}" oninput="window._vmUpdateOL('text',this.value)">`;
            html += `<label>크기: ${o.fontSize}px</label><input type="range" min="16" max="${Math.round(vm.w*0.15)}" value="${o.fontSize}" oninput="window._vmUpdateOL('fontSize',+this.value);this.previousElementSibling.textContent='크기: '+this.value+'px'">`;
            html += `<label>색상</label><input type="color" value="${o.color}" oninput="window._vmUpdateOL('color',this.value)">`;
            html += `<div style="display:flex;gap:6px;margin:4px 0">`;
            html += `<label style="flex:1;display:flex;align-items:center;gap:4px"><input type="checkbox" ${o.bold?'checked':''} onchange="window._vmUpdateOL('bold',this.checked)"> 굵게</label>`;
            html += `<label style="flex:1;display:flex;align-items:center;gap:4px"><input type="checkbox" ${o.shadow?'checked':''} onchange="window._vmUpdateOL('shadow',this.checked)"> 그림자</label>`;
            html += `</div>`;
            html += `<label>폰트</label><select class="vm-input" onchange="window._vmUpdateOL('fontFamily',this.value)">`;
            ['sans-serif','serif','monospace','cursive'].forEach(f => html += `<option value="${f}" ${o.fontFamily===f?'selected':''}>${f}</option>`);
            html += `</select>`;
        } else if (o.type === 'rect') {
            html += `<label>채우기</label><input type="color" value="${rgbaToHex(o.fill)}" oninput="window._vmUpdateOL('fill',this.value)">`;
            html += `<label>테두리</label><input type="color" value="${rgbaToHex(o.stroke)}" oninput="window._vmUpdateOL('stroke',this.value)">`;
            html += `<label>너비: ${Math.round(o.w)}</label><input type="range" min="50" max="${vm.w}" value="${o.w}" oninput="window._vmUpdateOL('w',+this.value)">`;
            html += `<label>높이: ${Math.round(o.h)}</label><input type="range" min="30" max="${vm.h}" value="${o.h}" oninput="window._vmUpdateOL('h',+this.value)">`;
            html += `<label>둥글기: ${o.radius}</label><input type="range" min="0" max="100" value="${o.radius}" oninput="window._vmUpdateOL('radius',+this.value)">`;
        } else if (o.type === 'circle') {
            html += `<label>채우기</label><input type="color" value="${rgbaToHex(o.fill)}" oninput="window._vmUpdateOL('fill',this.value)">`;
            html += `<label>반지름: ${Math.round(o.r)}</label><input type="range" min="10" max="${vm.w/2}" value="${o.r}" oninput="window._vmUpdateOL('r',+this.value)">`;
        } else if (o.type === 'sticker') {
            html += `<label>크기: ${o.size}</label><input type="range" min="20" max="${Math.round(vm.w*0.2)}" value="${o.size}" oninput="window._vmUpdateOL('size',+this.value)">`;
        }
        html += `<button class="vm-del-btn" onclick="window._vmRemoveOL()"><i class="fa-solid fa-trash"></i> 삭제</button>`;
        html += '</div>';
    }
    // overlay list
    if (s && s.overlays.length > 0) {
        html += '<div class="vm-tool-section"><b>레이어 목록</b>';
        s.overlays.forEach((o, i) => {
            const icon = o.type === 'text' ? 'fa-font' : o.type === 'rect' ? 'fa-square' : o.type === 'circle' ? 'fa-circle' : 'fa-star';
            const name = o.type === 'text' ? (o.text||'').substring(0,12) : o.type === 'sticker' ? o.emoji : o.type;
            html += `<div class="vm-layer-row${i===vm.oi?' active':''}" onclick="window._vmSelectOL(${i})"><i class="fa-solid ${icon}"></i> ${name}</div>`;
        });
        html += '</div>';
    }
    el.innerHTML = html;
}

function renderElementTab(el) {
    let html = '<div class="vm-tool-section"><b>도형</b><div class="vm-elem-grid">';
    html += `<button class="vm-elem-btn" onclick="window._vmStartAdd('rect')"><i class="fa-regular fa-square"></i><span>사각형</span></button>`;
    html += `<button class="vm-elem-btn" onclick="window._vmStartAdd('circle')"><i class="fa-regular fa-circle"></i><span>원</span></button>`;
    html += '</div></div>';
    html += '<div class="vm-tool-section"><b>스티커</b><div class="vm-sticker-grid">';
    STICKERS.forEach(s => {
        html += `<button class="vm-sticker-btn${vm.addSticker===s?' active':''}" onclick="window._vmPickSticker('${s}')">${s}</button>`;
    });
    html += `</div><button class="vm-add-btn" onclick="window._vmStartAdd('sticker')"><i class="fa-solid fa-hand-pointer"></i> 캔버스 클릭하여 배치</button>`;
    html += '</div>';
    el.innerHTML = html;
}

function renderMusicTab(el) {
    let html = '<div class="vm-tool-section"><b>배경 음악</b>';
    MUSIC.forEach(m => {
        const sel = vm.music === m.id;
        const playing = vm.musicPlaying === m.id;
        html += `<div class="vm-music-row${sel?' selected':''}">`;
        html += `<div class="vm-music-info" onclick="window._vmSelectMusic('${m.id}')">`;
        html += `<i class="fa-solid ${m.icon}" style="font-size:18px;width:24px;text-align:center;color:${sel?'#6366f1':'#64748b'}"></i>`;
        html += `<div><div style="font-weight:600;font-size:13px">${m.name}</div><div style="font-size:11px;color:#94a3b8">${m.desc}</div></div>`;
        html += `</div>`;
        if (m.id !== 'none') {
            html += `<button class="vm-music-play${playing?' playing':''}" onclick="window._vmPreviewMusic('${m.id}')">`;
            html += playing ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-play"></i>';
            html += `</button>`;
        }
        html += `</div>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderTransitionTab(el) {
    const s = curScene();
    const cur = s ? s.transition : 'fade';
    let html = '<div class="vm-tool-section"><b>전환 효과</b><div class="vm-trans-grid">';
    TRANSITIONS.forEach(t => {
        html += `<button class="vm-trans-btn${cur===t.id?' active':''}" onclick="window._vmSetTransition('${t.id}')">`;
        html += `<div class="vm-trans-icon" style="color:${t.color}"><i class="fa-solid ${t.icon}"></i></div>`;
        html += `<span>${t.name}</span></button>`;
    });
    html += '</div></div>';
    // per-scene duration
    if (s) {
        html += '<div class="vm-tool-section"><b>장면 시간</b>';
        html += `<label>${s.duration}초</label><input type="range" min="1" max="15" step="0.5" value="${s.duration}" oninput="window._vmSetDuration(+this.value);this.previousElementSibling.textContent=this.value+'초'">`;
        html += '</div>';
    }
    el.innerHTML = html;
}

function renderAdjustTab(el) {
    const s = curScene();
    if (!s) { el.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px">장면을 선택하세요</p>'; return; }
    const a = s.adj;
    let html = '<div class="vm-tool-section"><b>이미지 보정</b>';
    html += `<label>밝기: ${a.brightness}</label><input type="range" min="-100" max="100" value="${a.brightness}" oninput="window._vmAdj('brightness',+this.value);this.previousElementSibling.textContent='밝기: '+this.value">`;
    html += `<label>대비: ${a.contrast}</label><input type="range" min="-100" max="100" value="${a.contrast}" oninput="window._vmAdj('contrast',+this.value);this.previousElementSibling.textContent='대비: '+this.value">`;
    html += `<label>채도: ${a.saturation}%</label><input type="range" min="0" max="300" value="${a.saturation}" oninput="window._vmAdj('saturation',+this.value);this.previousElementSibling.textContent='채도: '+this.value+'%'">`;
    html += `<label>블러: ${a.blur}px</label><input type="range" min="0" max="20" step="0.5" value="${a.blur}" oninput="window._vmAdj('blur',+this.value);this.previousElementSibling.textContent='블러: '+this.value+'px'">`;
    html += `<label>색조: ${a.hue}°</label><input type="range" min="0" max="360" value="${a.hue}" oninput="window._vmAdj('hue',+this.value);this.previousElementSibling.textContent='색조: '+this.value+'°'">`;
    html += `<button class="vm-reset-btn" onclick="window._vmResetAdj()"><i class="fa-solid fa-rotate-left"></i> 초기화</button>`;
    html += '</div>';
    el.innerHTML = html;
}

function renderTemplateTab(el) {
    let html = '<div class="vm-tool-section"><b>템플릿</b><p style="font-size:11px;color:#94a3b8;margin:0 0 8px">현재 장면에 오버레이를 추가합니다</p>';
    TEMPLATES.forEach(t => {
        html += `<button class="vm-tpl-btn" onclick="window._vmApplyTemplate('${t.id}')">`;
        html += `<i class="fa-solid ${t.icon}"></i><div><div style="font-weight:600">${t.name}</div><div style="font-size:11px;color:#94a3b8">${t.desc}</div></div></button>`;
    });
    html += '</div>';
    el.innerHTML = html;
}

function updateMusicUI() {
    // update music tab if visible
    if (vm.tab === 'music') {
        const content = document.getElementById('vmToolContent');
        if (content) renderMusicTab(content);
    }
}

function rgbaToHex(rgba) {
    if (!rgba) return '#ffffff';
    if (rgba.startsWith('#')) return rgba.length > 7 ? rgba.substring(0,7) : rgba;
    const m = rgba.match(/\d+/g);
    if (!m) return '#ffffff';
    return '#' + [m[0],m[1],m[2]].map(x => (+x).toString(16).padStart(2,'0')).join('');
}

// ═══════════════════════════════════════════════════════════════
// WINDOW HANDLERS (called from HTML)
// ═══════════════════════════════════════════════════════════════
window._vmRemoveScene = removeScene;
window._vmSelectOL = selectOverlay;
window._vmRemoveOL = () => removeOverlay(vm.oi);

window._vmStartAdd = function(mode) {
    vm.addMode = mode;
    vm.canvas.style.cursor = 'crosshair';
    // toast
    showToast(mode === 'text' ? '캔버스를 클릭하여 텍스트 배치' : mode === 'sticker' ? '캔버스를 클릭하여 스티커 배치' : '캔버스를 클릭하여 도형 배치');
};

window._vmPickSticker = function(emoji) {
    vm.addSticker = emoji;
    updateToolsPanel();
};

window._vmUpdateOL = function(prop, val) {
    const s = curScene();
    if (!s || vm.oi < 0 || !s.overlays[vm.oi]) return;
    s.overlays[vm.oi][prop] = val;
    render();
};

window._vmSelectMusic = function(id) {
    vm.music = id;
    updateToolsPanel();
};

window._vmPreviewMusic = function(id) {
    if (vm.musicPlaying === id) { stopMusicPreview(); }
    else { playMusicPreview(id); }
};

window._vmSetTransition = function(id) {
    const s = curScene();
    if (s) { s.transition = id; updateToolsPanel(); updateTimeline(); }
};

window._vmSetDuration = function(v) {
    const s = curScene();
    if (s) { s.duration = v; updateTimeline(); }
};

window._vmAdj = function(prop, val) {
    const s = curScene();
    if (!s) return;
    s.adj[prop] = val;
    render();
};

window._vmResetAdj = function() {
    const s = curScene();
    if (!s) return;
    s.adj = { brightness:0, contrast:0, saturation:100, blur:0, hue:0 };
    render();
    updateToolsPanel();
};

window._vmApplyTemplate = function(id) {
    const s = curScene();
    if (!s) return alert('장면을 먼저 추가하세요');
    const tpl = TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    const newOverlays = tpl.create(vm.w, vm.h);
    newOverlays.forEach(o => s.overlays.push(o));
    vm.oi = s.overlays.length - 1;
    render();
    vm.tab = 'overlay';
    updateToolsPanel();
};

window._vmSetTab = function(tab) {
    vm.tab = tab;
    updateToolsPanel();
};

function showToast(msg) {
    let t = document.getElementById('vmToast');
    if (!t) return;
    t.textContent = msg; t.style.display = 'block'; t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 2000);
}

// ═══════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════
function animateTransition(fromImg, toScene, type, ms) {
    return new Promise(resolve => {
        const toImg = toScene.img;
        const toAdj = toScene.adj;
        const start = performance.now();
        function frame(now) {
            if (vm.cancel) return resolve();
            const t = Math.min((now - start) / ms, 1);
            const ctx = vm.ctx;
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vm.w, vm.h);
            switch(type) {
                case 'fade':
                    ctx.globalAlpha = 1 - t; drawCover(ctx, fromImg, vm.w, vm.h);
                    ctx.globalAlpha = t; applyAdj(ctx, toAdj); drawCover(ctx, toImg, vm.w, vm.h); ctx.filter = 'none';
                    ctx.globalAlpha = 1; break;
                case 'slideL':
                    drawCoverAt(ctx, fromImg, -vm.w*t, 0, vm.w, vm.h);
                    applyAdj(ctx, toAdj); drawCoverAt(ctx, toImg, vm.w*(1-t), 0, vm.w, vm.h); ctx.filter = 'none'; break;
                case 'slideR':
                    drawCoverAt(ctx, fromImg, vm.w*t, 0, vm.w, vm.h);
                    applyAdj(ctx, toAdj); drawCoverAt(ctx, toImg, -vm.w*(1-t), 0, vm.w, vm.h); ctx.filter = 'none'; break;
                case 'slideUp':
                    drawCoverAt(ctx, fromImg, 0, -vm.h*t, vm.w, vm.h);
                    applyAdj(ctx, toAdj); drawCoverAt(ctx, toImg, 0, vm.h*(1-t), vm.w, vm.h); ctx.filter = 'none'; break;
                case 'zoomIn':
                    ctx.save(); ctx.globalAlpha = 1-t; ctx.translate(vm.w/2,vm.h/2); ctx.scale(1+t*0.3,1+t*0.3); ctx.translate(-vm.w/2,-vm.h/2); drawCover(ctx, fromImg, vm.w, vm.h); ctx.restore();
                    ctx.globalAlpha = t; applyAdj(ctx, toAdj); drawCover(ctx, toImg, vm.w, vm.h); ctx.filter = 'none'; ctx.globalAlpha = 1; break;
                case 'zoomOut':
                    ctx.save(); ctx.globalAlpha = 1-t; drawCover(ctx, fromImg, vm.w, vm.h); ctx.restore();
                    ctx.save(); ctx.globalAlpha = t; ctx.translate(vm.w/2,vm.h/2); ctx.scale(2-t,2-t); ctx.translate(-vm.w/2,-vm.h/2); applyAdj(ctx, toAdj); drawCover(ctx, toImg, vm.w, vm.h); ctx.filter = 'none'; ctx.restore(); ctx.globalAlpha = 1; break;
                case 'wipe':
                    drawCover(ctx, fromImg, vm.w, vm.h);
                    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, vm.w * t, vm.h); ctx.clip();
                    applyAdj(ctx, toAdj); drawCover(ctx, toImg, vm.w, vm.h); ctx.filter = 'none'; ctx.restore(); break;
                default: // 'none'
                    applyAdj(ctx, toAdj); drawCover(ctx, toImg, vm.w, vm.h); ctx.filter = 'none'; break;
            }
            if (t < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
    });
}

function applyAdj(ctx, a) {
    if (!a) return;
    ctx.filter = `brightness(${1 + a.brightness/100}) contrast(${1 + a.contrast/100}) saturate(${a.saturation}%) blur(${a.blur}px) hue-rotate(${a.hue}deg)`;
}

// ═══════════════════════════════════════════════════════════════
// PLAYBACK
// ═══════════════════════════════════════════════════════════════
function pausableSleep(ms) {
    return new Promise(resolve => {
        let elapsed = 0; const interval = 50;
        const tick = () => {
            if (vm.cancel) return resolve();
            if (vm.paused) { setTimeout(tick, interval); return; }
            elapsed += interval;
            if (elapsed >= ms) resolve(); else setTimeout(tick, interval);
        };
        setTimeout(tick, interval);
    });
}

window.vmPlay = async function() {
    if (vm.scenes.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vm.playing) { vm.cancel = true; return; }
    vm.playing = true; vm.paused = false; vm.cancel = false;
    const playBtn = document.getElementById('vmPlayBtn');
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-stop"></i> 정지';
    playMusicPreview(vm.music);
    for (let i = 0; i < vm.scenes.length; i++) {
        if (vm.cancel) break;
        vm.si = i; vm.oi = -1;
        const s = vm.scenes[i];
        const dur = s.duration * 1000;
        const transMs = 800;
        if (i > 0 && s.transition !== 'none') {
            await animateTransition(vm.scenes[i-1].img, s, s.transition, transMs);
            // draw overlays for this scene
            s.overlays.forEach(o => renderOverlay(vm.ctx, o));
            await pausableSleep(dur - transMs);
        } else {
            renderScene(i, vm.ctx, vm.w, vm.h, false);
            await pausableSleep(dur);
        }
    }
    stopMusicPreview();
    vm.playing = false; vm.paused = false; vm.cancel = false;
    if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i> 재생';
    updateAll();
};

window.vmPause = function() {
    if (!vm.playing) return;
    vm.paused = !vm.paused;
    const btn = document.getElementById('vmPauseBtn');
    if (vm.paused) {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> 재개';
        stopMusicPreview();
        showToast('일시정지 — 캔버스에서 요소를 편집하세요');
    } else {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시정지';
        playMusicPreview(vm.music);
    }
};

// ═══════════════════════════════════════════════════════════════
// RECORDING & EXPORT
// ═══════════════════════════════════════════════════════════════
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.vmRecord = async function() {
    if (vm.scenes.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vm.playing) return;
    vm.playing = true; vm.cancel = false;
    const prog = document.getElementById('vmProgress');
    const progBar = document.getElementById('vmProgressBar');
    const progText = document.getElementById('vmProgressText');
    const recBtn = document.getElementById('vmRecordBtn');
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (prog) prog.style.display = 'block';
    if (dlBtn) dlBtn.style.display = 'none';
    if (recBtn) { recBtn.disabled = true; recBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...'; }
    const fps = 30;
    let totalMs = 0;
    vm.scenes.forEach(s => totalMs += s.duration * 1000);
    const canvasStream = vm.canvas.captureStream(fps);
    const musicStream = await createMusicStream(vm.music, totalMs);
    let combined;
    if (musicStream) combined = new MediaStream([...canvasStream.getVideoTracks(), ...musicStream.getAudioTracks()]);
    else combined = canvasStream;
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 5000000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();
    for (let i = 0; i < vm.scenes.length; i++) {
        const pct = Math.round((i / vm.scenes.length) * 100);
        if (progBar) progBar.style.width = pct + '%';
        if (progText) progText.textContent = `${i+1}/${vm.scenes.length} 처리 중...`;
        const s = vm.scenes[i];
        const dur = s.duration * 1000;
        if (i > 0 && s.transition !== 'none') {
            await animateTransition(vm.scenes[i-1].img, s, s.transition, 800);
            s.overlays.forEach(o => renderOverlay(vm.ctx, o));
            await sleep(dur - 800);
        } else {
            renderScene(i, vm.ctx, vm.w, vm.h, false);
            await sleep(dur);
        }
    }
    if (progBar) progBar.style.width = '100%';
    if (progText) progText.textContent = '인코딩 중...';
    await new Promise(r => { recorder.onstop = r; recorder.stop(); });
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    if (dlBtn) {
        dlBtn.style.display = 'inline-flex';
        dlBtn.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = `chameleon_${vm.mode}_${Date.now()}.webm`; a.click(); };
    }
    if (progText) progText.textContent = '완료! 다운로드 버튼을 클릭하세요';
    if (recBtn) { recBtn.disabled = false; recBtn.innerHTML = '<i class="fa-solid fa-circle" style="color:#ef4444"></i> 녹화'; }
    vm.playing = false;
};

// ═══════════════════════════════════════════════════════════════
// INIT & EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════
export function initVideoMaker() {
    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;
    // Drop zone
    const dz = document.getElementById('vmDropZone');
    const fi = document.getElementById('vmFileInput');
    if (dz) {
        dz.addEventListener('click', () => fi && fi.click());
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('vm-drag-over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('vm-drag-over'));
        dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('vm-drag-over'); addFiles(e.dataTransfer.files); });
    }
    if (fi) fi.addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    // Canvas interactions
    const cvs = document.getElementById('vmCanvas');
    if (cvs) {
        cvs.addEventListener('mousedown', onCanvasDown);
        cvs.addEventListener('mousemove', onCanvasMove);
        cvs.addEventListener('mouseup', onCanvasUp);
        cvs.addEventListener('touchstart', e => { e.preventDefault(); onCanvasDown(e.touches[0]); }, { passive: false });
        cvs.addEventListener('touchmove', e => { e.preventDefault(); onCanvasMove(e.touches[0]); }, { passive: false });
        cvs.addEventListener('touchend', onCanvasUp);
    }
    // Tab buttons
    document.querySelectorAll('.vm-tab-btn').forEach(b => {
        b.addEventListener('click', () => { vm.tab = b.dataset.tab; updateToolsPanel(); });
    });
    console.log('🎬 영상 편집기 v3 초기화 완료');
}

function onCanvasDown(e) {
    if (vm.playing && !vm.paused) return;
    const { x, y } = canvasXY(e);
    if (vm.addMode) {
        // place new element
        if (vm.addMode === 'sticker') addOverlay('sticker', x, y, { emoji: vm.addSticker });
        else addOverlay(vm.addMode, x, y);
        vm.addMode = null;
        vm.canvas.style.cursor = 'default';
        return;
    }
    const hit = hitOverlay(x, y);
    if (hit >= 0) {
        vm.oi = hit;
        const o = curScene().overlays[hit];
        vm.drag = { oi: hit, ox: x - o.x, oy: y - o.y };
        render(); updateToolsPanel();
    } else {
        vm.oi = -1;
        render(); updateToolsPanel();
    }
}

function onCanvasMove(e) {
    if (!vm.drag) return;
    const { x, y } = canvasXY(e);
    const s = curScene();
    if (!s || !s.overlays[vm.drag.oi]) return;
    const o = s.overlays[vm.drag.oi];
    o.x = x - vm.drag.ox;
    o.y = y - vm.drag.oy;
    render();
}

function onCanvasUp() { vm.drag = null; }

// Open
window.openVideoMaker = function(label) {
    vm.scenes = []; vm.si = 0; vm.oi = -1;
    vm.playing = false; vm.paused = false; vm.cancel = false;
    vm.addMode = null; vm.music = 'none'; vm.musicPlaying = null;
    vm.mode = (label === '쇼츠') ? 'shorts' : 'video';
    vm.w = (vm.mode === 'shorts') ? 1080 : 1920;
    vm.h = (vm.mode === 'shorts') ? 1920 : 1080;
    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    const title = document.getElementById('vmTitle');
    if (title) title.textContent = (vm.mode === 'shorts') ? '쇼츠 편집기 (1080×1920)' : '영상 편집기 (1920×1080)';
    vm.canvas = document.getElementById('vmCanvas');
    if (vm.canvas) {
        vm.canvas.width = vm.w; vm.canvas.height = vm.h;
        vm.ctx = vm.canvas.getContext('2d');
    }
    render();
    vm.tab = 'overlay';
    updateAll();
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (dlBtn) dlBtn.style.display = 'none';
    const prog = document.getElementById('vmProgress');
    if (prog) prog.style.display = 'none';
};

window.vmCloseEditor = function() {
    stopMusicPreview();
    vm.cancel = true; vm.playing = false;
    document.getElementById('videoMakerModal').style.display = 'none';
};
