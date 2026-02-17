// video-maker.js — CapCut-Style Video Editor v4
// Dark theme, timeline, video+image clips, format selector, overlays, music, adjustments

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const FORMATS = [
    { id:'landscape', label:'16:9', name:'가로 영상', w:1920, h:1080 },
    { id:'portrait',  label:'9:16', name:'세로/쇼츠', w:1080, h:1920 },
    { id:'square',    label:'1:1',  name:'정사각형',   w:1080, h:1080 }
];

const MUSIC = [
    { id:'none', name:'없음', icon:'fa-volume-xmark', desc:'음악 없음' },
    { id:'upbeat', name:'Upbeat Pop', icon:'fa-bolt', desc:'밝고 경쾌한 팝', bpm:120, melody:[60,64,67,72,67,64,60,67], bass:[48,48,55,55,52,52,48,48], wave:'square' },
    { id:'chill', name:'Lo-fi Chill', icon:'fa-mug-hot', desc:'편안한 로파이', bpm:75, melody:[57,60,64,62,60,57,55,57], bass:[45,45,48,48,43,43,45,45], wave:'triangle' },
    { id:'cinema', name:'Cinematic', icon:'fa-film', desc:'웅장한 시네마틱', bpm:60, melody:[48,55,60,63,60,55,48,51], bass:[36,36,43,43,48,48,36,36], wave:'sawtooth' },
    { id:'happy', name:'Happy Pop', icon:'fa-face-smile', desc:'신나는 팝', bpm:130, melody:[65,69,72,77,72,69,65,72], bass:[53,53,57,57,60,60,53,53], wave:'square' },
    { id:'ambient', name:'Ambient', icon:'fa-cloud', desc:'차분한 앰비언트', bpm:50, melody:[50,57,62,57,55,50,55,57], bass:[38,38,45,45,43,43,38,38], wave:'sine' }
];

const TRANSITIONS = [
    { id:'none', name:'없음', icon:'fa-xmark', color:'#6b7280' },
    { id:'fade', name:'페이드', icon:'fa-circle-half-stroke', color:'#818cf8' },
    { id:'slideL', name:'← 슬라이드', icon:'fa-arrow-left', color:'#fbbf24' },
    { id:'slideR', name:'→ 슬라이드', icon:'fa-arrow-right', color:'#fbbf24' },
    { id:'slideUp', name:'↑ 슬라이드', icon:'fa-arrow-up', color:'#fbbf24' },
    { id:'zoomIn', name:'줌 인', icon:'fa-magnifying-glass-plus', color:'#34d399' },
    { id:'zoomOut', name:'줌 아웃', icon:'fa-magnifying-glass-minus', color:'#34d399' },
    { id:'wipe', name:'와이프', icon:'fa-bars-staggered', color:'#f472b6' }
];

const STICKERS = ['⭐','❤️','🔥','✨','💯','👍','🎉','💡','🎵','🎯','💪','🌟','😊','🎬','📌','🏆','💎','🌈','🎨','👏','🎁','🚀'];

const TEMPLATES = [
    { id:'title', name:'타이틀 카드', icon:'fa-heading',
      mk:(w,h)=>[{type:'rect',x:0,y:h*.3,w,h:h*.4,fill:'rgba(0,0,0,0.6)',stroke:'',strokeW:0,radius:0},{type:'text',x:w/2,y:h*.45,text:'제목을 입력하세요',fontSize:Math.round(w*.06),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.58,text:'부제목',fontSize:Math.round(w*.025),color:'#ccc',bold:false,shadow:true,align:'center',fontFamily:'sans-serif'}]},
    { id:'lower3rd', name:'하단 자막', icon:'fa-closed-captioning',
      mk:(w,h)=>[{type:'rect',x:w*.05,y:h*.82,w:w*.5,h:h*.06,fill:'#6366f1',stroke:'',strokeW:0,radius:8},{type:'text',x:w*.3,y:h*.855,text:'이름',fontSize:Math.round(w*.025),color:'#fff',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'},{type:'rect',x:w*.05,y:h*.88,w:w*.35,h:h*.04,fill:'rgba(255,255,255,0.9)',stroke:'',strokeW:0,radius:6},{type:'text',x:w*.22,y:h*.905,text:'직함',fontSize:Math.round(w*.016),color:'#333',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}]},
    { id:'caption', name:'자막', icon:'fa-align-center',
      mk:(w,h)=>[{type:'rect',x:0,y:h*.85,w,h:h*.15,fill:'rgba(0,0,0,0.65)',stroke:'',strokeW:0,radius:0},{type:'text',x:w/2,y:h*.935,text:'자막 텍스트',fontSize:Math.round(w*.03),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'}]},
    { id:'quote', name:'인용문', icon:'fa-quote-left',
      mk:(w,h)=>[{type:'rect',x:w*.1,y:h*.25,w:w*.8,h:h*.5,fill:'rgba(0,0,0,0.5)',stroke:'rgba(255,255,255,0.3)',strokeW:2,radius:20},{type:'text',x:w/2,y:h*.45,text:'"인용문을 입력하세요"',fontSize:Math.round(w*.035),color:'#fff',bold:false,shadow:true,align:'center',fontFamily:'serif'},{type:'text',x:w/2,y:h*.6,text:'— 저자',fontSize:Math.round(w*.02),color:'#a5b4fc',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'}]},
    { id:'announce', name:'공지', icon:'fa-bullhorn',
      mk:(w,h)=>[{type:'rect',x:w*.1,y:h*.35,w:w*.8,h:h*.3,fill:'#ef4444',stroke:'#fff',strokeW:4,radius:16},{type:'text',x:w/2,y:h*.48,text:'중요 공지',fontSize:Math.round(w*.05),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.57,text:'세부 내용',fontSize:Math.round(w*.022),color:'#fecaca',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}]}
];

const TL_PPS = 60; // timeline pixels per second (base)

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let vm = {
    clips: [],      // [{type,file,url,img/video,thumbUrl,duration,overlays:[],adj:{},transition}]
    ci: 0, oi: -1,  // selected clip & overlay index
    canvas: null, ctx: null,
    w: 1920, h: 1080, format: 'landscape',
    playing: false, paused: false, cancel: false,
    music: 'none', actx: null, mstop: null, musicPlaying: null,
    leftTab: 'media',
    playTime: 0,    // current position in seconds
    tlZoom: 1,
    addMode: null, addSticker: '⭐', drag: null
};

// ═══════════════════════════════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════════════════════════════
async function getAC() {
    if (!vm.actx) vm.actx = new (window.AudioContext || window.webkitAudioContext)();
    if (vm.actx.state === 'suspended') await vm.actx.resume();
    return vm.actx;
}

async function playMusicPreview(id) {
    stopMusicPreview();
    if (id === 'none') { vm.musicPlaying = null; return; }
    const m = MUSIC.find(x => x.id === id); if (!m) return;
    const ctx = await getAC();
    const master = ctx.createGain(); master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20;
    comp.connect(master); master.connect(ctx.destination);
    const dur = 60 / m.bpm;
    let ni = 0, stopped = false, timer;
    function note() {
        if (stopped) return;
        const t = ctx.currentTime;
        const freq = 440 * Math.pow(2, (m.melody[ni % m.melody.length] - 69) / 12);
        const bf = 440 * Math.pow(2, (m.bass[ni % m.bass.length] - 69) / 12);
        const o1 = ctx.createOscillator(); o1.type = m.wave; o1.frequency.value = freq;
        const e1 = ctx.createGain(); e1.gain.setValueAtTime(0.3, t); e1.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.9);
        o1.connect(e1).connect(comp); o1.start(t); o1.stop(t + dur);
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.5;
        const e2 = ctx.createGain(); e2.gain.setValueAtTime(0.08, t); e2.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.85);
        o2.connect(e2).connect(comp); o2.start(t); o2.stop(t + dur);
        const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = bf;
        const e3 = ctx.createGain(); e3.gain.setValueAtTime(0.2, t); e3.gain.exponentialRampToValueAtTime(0.005, t + dur * 0.8);
        o3.connect(e3).connect(comp); o3.start(t); o3.stop(t + dur);
        ni++; timer = setTimeout(note, dur * 1000);
    }
    vm.mstop = () => { stopped = true; clearTimeout(timer); try { master.disconnect(); } catch(e){} };
    vm.musicPlaying = id; note(); refreshLeftPanel();
}
function stopMusicPreview() { if (vm.mstop) { vm.mstop(); vm.mstop = null; } vm.musicPlaying = null; }

async function createMusicStream(musicId, totalMs) {
    if (musicId === 'none') return null;
    const m = MUSIC.find(x => x.id === musicId); if (!m) return null;
    const ctx = await getAC();
    const dest = ctx.createMediaStreamDestination();
    const master = ctx.createGain(); master.gain.value = 0.35;
    const comp = ctx.createDynamicsCompressor(); comp.connect(master); master.connect(dest);
    const dur = 60 / m.bpm, total = Math.ceil(totalMs / 1000 / dur) + 4;
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
// CLIP MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function curClip() { return vm.clips[vm.ci]; }
function clipStart(i) { let t=0; for(let j=0;j<i;j++) t+=vm.clips[j].duration; return t; }
function totalDur() { return vm.clips.reduce((s,c)=>s+c.duration,0); }

function addFiles(fileList) {
    Array.from(fileList).forEach(f => {
        if (f.type.startsWith('image/')) addImageFile(f);
        else if (f.type.startsWith('video/')) addVideoFile(f);
    });
}

function addImageFile(f) {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
        // thumbnail
        const tc = document.createElement('canvas'); tc.width=160; tc.height=90;
        const tx = tc.getContext('2d'); tx.drawImage(img,0,0,160,90);
        vm.clips.push({ type:'image', file:f, url, img, thumbUrl:tc.toDataURL('image/jpeg',0.7),
            duration:3, overlays:[], adj:{brightness:0,contrast:0,saturation:100,blur:0,hue:0}, transition:'fade' });
        selectClip(vm.clips.length-1);
    };
    img.src = url;
}

function addVideoFile(f) {
    const url = URL.createObjectURL(f);
    const video = document.createElement('video');
    video.src = url; video.muted = true; video.preload = 'auto'; video.playsInline = true;
    video.onloadedmetadata = () => {
        video.currentTime = 0.5;
        video.onseeked = () => {
            const tc = document.createElement('canvas'); tc.width=160; tc.height=90;
            tc.getContext('2d').drawImage(video,0,0,160,90);
            vm.clips.push({ type:'video', file:f, url, video, thumbUrl:tc.toDataURL('image/jpeg',0.7),
                duration: Math.min(Math.round(video.duration*10)/10, 60),
                overlays:[], adj:{brightness:0,contrast:0,saturation:100,blur:0,hue:0}, transition:'fade' });
            video.onseeked = null;
            selectClip(vm.clips.length-1);
        };
    };
}

function removeClip(i) {
    const c = vm.clips[i];
    if (c) { URL.revokeObjectURL(c.url); if (c.type==='video') c.video.pause(); }
    vm.clips.splice(i,1);
    if (vm.ci >= vm.clips.length) vm.ci = Math.max(0, vm.clips.length-1);
    vm.oi = -1; updateAll(); render();
}

function selectClip(i) {
    if (i<0||i>=vm.clips.length) return;
    vm.ci = i; vm.oi = -1; render(); updateAll();
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function addOverlay(type, x, y, props) {
    const c = curClip(); if (!c) return;
    let o; const fs = Math.round(vm.w*0.04);
    switch(type) {
        case 'text': o={type:'text',x,y,text:props?.text||'텍스트',fontSize:props?.fontSize||fs,color:props?.color||'#fff',bold:props?.bold??true,shadow:props?.shadow??true,align:'center',fontFamily:props?.fontFamily||'sans-serif'}; break;
        case 'rect': o={type:'rect',x,y,w:props?.w||vm.w*.3,h:props?.h||vm.h*.12,fill:props?.fill||'rgba(99,102,241,0.5)',stroke:props?.stroke||'#fff',strokeW:props?.strokeW||2,radius:props?.radius||10}; break;
        case 'circle': o={type:'circle',x,y,r:props?.r||vm.w*.06,fill:props?.fill||'rgba(99,102,241,0.5)',stroke:props?.stroke||'#fff',strokeW:props?.strokeW||2}; break;
        case 'sticker': o={type:'sticker',x,y,emoji:props?.emoji||'⭐',size:props?.size||Math.round(vm.w*.08)}; break;
        case 'image': {
            const img=new Image(); img.crossOrigin='anonymous'; img.src=props?.url||'';
            o={type:'image',x,y,w:props?.w||vm.w*.3,h:props?.h||vm.w*.3,url:props?.url||'',img};
            img.onload=()=>{render();}; break;
        }
    }
    if (o) { o.rotation=o.rotation||0; c.overlays.push(o); vm.oi = c.overlays.length-1; render(); refreshRightPanel(); updateTimeline(); }
}
function removeOverlay(i) { const c=curClip(); if(!c||!c.overlays[i])return; c.overlays.splice(i,1); vm.oi=-1; render(); refreshRightPanel(); updateTimeline(); }
function selectOverlay(i) { vm.oi=i; render(); refreshRightPanel(); }

// ── Overlay Bounds & Handle Hit Testing ──
function getOBounds(o) {
    let bx,by,bw,bh;
    if(o.type==='text'){const tw=o.fontSize*Math.max((o.text||'T').length,1)*.55,th=o.fontSize*1.3;bx=o.align==='center'?o.x-tw/2:o.x;by=o.y-th/2-o.fontSize*.2;bw=tw;bh=th;}
    else if(o.type==='rect'){bx=o.x;by=o.y;bw=o.w;bh=o.h;}
    else if(o.type==='circle'){bx=o.x-o.r;by=o.y-o.r;bw=bh=o.r*2;}
    else if(o.type==='sticker'){bx=o.x-o.size/2;by=o.y-o.size/2;bw=bh=o.size;}
    else if(o.type==='image'){bx=o.x;by=o.y;bw=o.w;bh=o.h;}
    else return null;
    return {bx,by,bw,bh,cx:bx+bw/2,cy:by+bh/2};
}

function unrotatePoint(mx,my,o,b) {
    if(!o.rotation) return {x:mx,y:my};
    const rad=-o.rotation*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
    const dx=mx-b.cx,dy=my-b.cy;
    return {x:b.cx+dx*cos-dy*sin, y:b.cy+dx*sin+dy*cos};
}

function hitHandle(mx,my,o) {
    const b=getOBounds(o); if(!b) return null;
    const p=unrotatePoint(mx,my,o,b);
    const hs=Math.max(14,vm.w*.008),pad=6;
    // rotation handle (circle above top-center)
    const rhx=b.bx+b.bw/2,rhy=b.by-30;
    if(Math.hypot(p.x-rhx,p.y-rhy)<=14) return {mode:'rotate'};
    // corner handles
    const corners=[
        {id:'tl',hx:b.bx-pad,hy:b.by-pad},{id:'tr',hx:b.bx+b.bw+pad-hs,hy:b.by-pad},
        {id:'bl',hx:b.bx-pad,hy:b.by+b.bh+pad-hs},{id:'br',hx:b.bx+b.bw+pad-hs,hy:b.by+b.bh+pad-hs}
    ];
    for(const c of corners){if(p.x>=c.hx&&p.x<=c.hx+hs&&p.y>=c.hy&&p.y<=c.hy+hs)return{mode:'resize',corner:c.id};}
    return null;
}

function hitOverlay(cx, cy) {
    const c = curClip(); if(!c) return -1;
    for (let i=c.overlays.length-1; i>=0; i--) {
        const o=c.overlays[i];
        const b=getOBounds(o); if(!b) continue;
        const p=unrotatePoint(cx,cy,o,b);
        if(o.type==='text'){const tw=o.fontSize*Math.max(o.text.length,1)*.55,th=o.fontSize*1.3,lx=o.align==='center'?o.x-tw/2:o.x;if(p.x>=lx&&p.x<=lx+tw&&p.y>=o.y-th&&p.y<=o.y)return i;}
        else if(o.type==='rect'){if(p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h)return i;}
        else if(o.type==='circle'){if(Math.hypot(p.x-o.x,p.y-o.y)<=o.r)return i;}
        else if(o.type==='sticker'){const hs=o.size/2;if(p.x>=o.x-hs&&p.x<=o.x+hs&&p.y>=o.y-hs&&p.y<=o.y+hs)return i;}
        else if(o.type==='image'){if(p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h)return i;}
    }
    return -1;
}
function canvasXY(e) { const r=vm.canvas.getBoundingClientRect(); return{x:(e.clientX-r.left)/r.width*vm.w,y:(e.clientY-r.top)/r.height*vm.h}; }

// ═══════════════════════════════════════════════════════════════
// CANVAS RENDERING
// ═══════════════════════════════════════════════════════════════
function render() {
    if (!vm.ctx) return;
    const c = curClip();
    if (!c) {
        vm.ctx.fillStyle='#0d0d1a'; vm.ctx.fillRect(0,0,vm.w,vm.h);
        vm.ctx.fillStyle='#555'; vm.ctx.font=`${vm.w*.025}px sans-serif`; vm.ctx.textAlign='center';
        vm.ctx.fillText('미디어를 추가하세요',vm.w/2,vm.h/2); return;
    }
    renderClip(vm.ci, vm.ctx, true);
}

function renderClip(ci, ctx, showSel) {
    const c = vm.clips[ci]; if(!c) return;
    const a = c.adj;
    ctx.filter=`brightness(${1+a.brightness/100}) contrast(${1+a.contrast/100}) saturate(${a.saturation}%) blur(${a.blur}px) hue-rotate(${a.hue}deg)`;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,vm.w,vm.h);
    const src = c.type==='video' ? c.video : c.img;
    if (src) drawCover(ctx, src, vm.w, vm.h);
    ctx.filter='none';
    c.overlays.forEach((o,i) => { renderOverlay(ctx,o); if(showSel&&i===vm.oi) renderSelection(ctx,o); });
}

function renderOverlay(ctx, o) {
    ctx.save();
    if(o.rotation){const b=getOBounds(o);if(b){ctx.translate(b.cx,b.cy);ctx.rotate(o.rotation*Math.PI/180);ctx.translate(-b.cx,-b.cy);}}
    switch(o.type) {
        case 'text':
            ctx.font=`${o.bold?'bold ':''} ${o.fontSize}px ${o.fontFamily||'sans-serif'}`;
            ctx.fillStyle=o.color||'#fff'; ctx.textAlign=o.align||'center'; ctx.textBaseline='middle';
            if(o.shadow){ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=o.fontSize*.12;ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;}
            (o.text||'').split('\n').forEach((l,li)=>ctx.fillText(l,o.x,o.y+li*o.fontSize*1.25)); break;
        case 'rect':
            ctx.fillStyle=o.fill||'transparent';
            if(o.radius){rRect(ctx,o.x,o.y,o.w,o.h,o.radius);ctx.fill();}else ctx.fillRect(o.x,o.y,o.w,o.h);
            if(o.stroke&&o.strokeW){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeW;if(o.radius){rRect(ctx,o.x,o.y,o.w,o.h,o.radius);ctx.stroke();}else ctx.strokeRect(o.x,o.y,o.w,o.h);} break;
        case 'circle':
            ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);if(o.fill){ctx.fillStyle=o.fill;ctx.fill();}
            if(o.stroke&&o.strokeW){ctx.strokeStyle=o.stroke;ctx.lineWidth=o.strokeW;ctx.stroke();} break;
        case 'sticker':
            ctx.font=`${o.size}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.emoji,o.x,o.y); break;
        case 'image':
            if(o.img&&o.img.complete&&o.img.naturalWidth)ctx.drawImage(o.img,o.x,o.y,o.w,o.h); break;
    }
    ctx.restore();
}

function renderSelection(ctx, o) {
    const b=getOBounds(o); if(!b) return;
    ctx.save();
    if(o.rotation){ctx.translate(b.cx,b.cy);ctx.rotate(o.rotation*Math.PI/180);ctx.translate(-b.cx,-b.cy);}
    ctx.strokeStyle='#00bfff'; ctx.lineWidth=Math.max(3,vm.w*.002); ctx.setLineDash([10,6]);
    ctx.strokeRect(b.bx-4,b.by-4,b.bw+8,b.bh+8);
    const hs=Math.max(10,vm.w*.006); ctx.fillStyle='#00bfff'; ctx.setLineDash([]);
    // corner handles
    [[b.bx-4,b.by-4],[b.bx+b.bw+4-hs,b.by-4],[b.bx-4,b.by+b.bh+4-hs],[b.bx+b.bw+4-hs,b.by+b.bh+4-hs]].forEach(([hx,hy])=>{
        ctx.fillRect(hx,hy,hs,hs);
    });
    // rotation handle (line + circle above top-center)
    const rhx=b.bx+b.bw/2,rhy=b.by-28;
    ctx.beginPath();ctx.setLineDash([]);ctx.moveTo(rhx,b.by-4);ctx.lineTo(rhx,rhy+6);ctx.stroke();
    ctx.beginPath();ctx.arc(rhx,rhy,7,0,Math.PI*2);ctx.fillStyle='#00bfff';ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
    // rotation icon inside
    ctx.fillStyle='#fff';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('↻',rhx,rhy);
    ctx.restore();
}

function drawCover(ctx,src,cw,ch) {
    const iw=src.videoWidth||src.width, ih=src.videoHeight||src.height;
    if(!iw||!ih) return;
    const ir=iw/ih, cr=cw/ch; let sw,sh,sx,sy;
    if(ir>cr){sh=ih;sw=sh*cr;sx=(iw-sw)/2;sy=0;}else{sw=iw;sh=sw/cr;sx=0;sy=(ih-sh)/2;}
    ctx.drawImage(src,sx,sy,sw,sh,0,0,cw,ch);
}
function drawCoverAt(ctx,src,ox,oy,cw,ch){ctx.save();ctx.translate(ox,oy);drawCover(ctx,src,cw,ch);ctx.restore();}
function rRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function applyAdj(ctx,a){if(!a)return;ctx.filter=`brightness(${1+a.brightness/100}) contrast(${1+a.contrast/100}) saturate(${a.saturation}%) blur(${a.blur}px) hue-rotate(${a.hue}deg)`;}

// ═══════════════════════════════════════════════════════════════
// LEFT PANEL (Tabs)
// ═══════════════════════════════════════════════════════════════
function refreshLeftPanel() {
    document.querySelectorAll('.ve-ltab').forEach(b=>b.classList.toggle('active',b.dataset.tab===vm.leftTab));
    const el=document.getElementById('veLeftContent'); if(!el) return;
    switch(vm.leftTab){
        case 'media': renderMediaTab(el);break;
        case 'audio': renderAudioTab(el);break;
        case 'text': renderTextTab(el);break;
        case 'element': renderElementTab(el);break;
        case 'transition': renderTransitionTab(el);break;
        case 'adjust': renderAdjustTab(el);break;
        case 'template': renderTemplateTab(el);break;
    }
}

function renderMediaTab(el) {
    let h = `<div class="ve-sec"><button class="ve-import-btn" onclick="document.getElementById('veFileInput').click()"><i class="fa-solid fa-plus"></i> Import</button></div>`;
    if (vm.clips.length) {
        h += '<div class="ve-media-grid">';
        vm.clips.forEach((c,i) => {
            h += `<div class="ve-media-item${i===vm.ci?' active':''}" onclick="window._veSelectClip(${i})">`;
            h += `<img src="${c.thumbUrl}">`;
            if(c.type==='video') h += `<span class="ve-media-dur">${fmtTime(c.duration)}</span>`;
            h += `<span class="ve-media-type">${c.type==='video'?'🎬':'🖼️'}</span>`;
            h += `<button class="ve-media-del" onclick="event.stopPropagation();window._veRemoveClip(${i})">×</button>`;
            h += `</div>`;
        });
        h += '</div>';
    } else {
        h += '<p class="ve-empty">이미지 또는 영상을 추가하세요</p>';
    }
    el.innerHTML = h;
}

function renderAudioTab(el) {
    let h = '<div class="ve-sec">';
    MUSIC.forEach(m => {
        const sel = vm.music===m.id, playing = vm.musicPlaying===m.id;
        h += `<div class="ve-music-row${sel?' selected':''}" onclick="window._veSelectMusic('${m.id}')">`;
        h += `<i class="fa-solid ${m.icon}" style="width:24px;text-align:center;font-size:16px;color:${sel?'#818cf8':'#6b7280'}"></i>`;
        h += `<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e0e0e8">${m.name}</div><div style="font-size:10px;color:#6b7280">${m.desc}</div></div>`;
        if(m.id!=='none') h += `<button class="ve-music-play${playing?' playing':''}" onclick="event.stopPropagation();window._vePreviewMusic('${m.id}')">${playing?'<i class="fa-solid fa-stop"></i>':'<i class="fa-solid fa-play"></i>'}</button>`;
        h += '</div>';
    });
    h += '</div>';
    el.innerHTML = h;
}

function renderTextTab(el) {
    let h = '<div class="ve-sec"><b>텍스트</b>';
    h += `<button class="ve-add-btn" onclick="window._veStartAdd('text')"><i class="fa-solid fa-font"></i> 캔버스에 텍스트 추가</button>`;
    h += '</div>';
    const c = curClip();
    if (c && vm.oi>=0 && c.overlays[vm.oi] && c.overlays[vm.oi].type==='text') {
        const o = c.overlays[vm.oi];
        h += '<div class="ve-sec"><b>텍스트 편집</b>';
        h += `<label>내용</label><input class="ve-inp" value="${(o.text||'').replace(/"/g,'&quot;')}" oninput="window._veUpOL('text',this.value)">`;
        h += `<label>크기 ${o.fontSize}px</label><input type="range" min="16" max="${Math.round(vm.w*.15)}" value="${o.fontSize}" oninput="window._veUpOL('fontSize',+this.value);this.previousElementSibling.textContent='크기 '+this.value+'px'">`;
        h += `<label>색상</label><input type="color" value="${expandHex(o.color)}" oninput="window._veUpOL('color',this.value)" style="width:100%;height:28px">`;
        h += `<div style="display:flex;gap:8px;margin:6px 0"><label style="flex:1;display:flex;align-items:center;gap:4px;color:#aaa;font-size:11px"><input type="checkbox" ${o.bold?'checked':''} onchange="window._veUpOL('bold',this.checked)"> 굵게</label>`;
        h += `<label style="flex:1;display:flex;align-items:center;gap:4px;color:#aaa;font-size:11px"><input type="checkbox" ${o.shadow?'checked':''} onchange="window._veUpOL('shadow',this.checked)"> 그림자</label></div>`;
        h += `<label>폰트</label><select class="ve-inp" onchange="window._veUpOL('fontFamily',this.value)" style="max-height:200px">`;
        const dynFonts=window.DYNAMIC_FONTS||[];
        const fallbackFonts=[{font_name:'sans-serif',font_family:'sans-serif'},{font_name:'serif',font_family:'serif'},{font_name:'monospace',font_family:'monospace'},{font_name:'cursive',font_family:'cursive'}];
        const fontList=dynFonts.length?[...fallbackFonts,...dynFonts]:fallbackFonts;
        fontList.forEach(f=>h+=`<option value="${f.font_family}"${o.fontFamily===f.font_family?' selected':''}>${f.font_name}</option>`);
        h += '</select>';
        h += `<button class="ve-del-btn" onclick="window._veRemoveOL()"><i class="fa-solid fa-trash"></i> 삭제</button></div>`;
    }
    // layer list
    if (c && c.overlays.length) {
        h += '<div class="ve-sec"><b>레이어</b>';
        c.overlays.forEach((o,i)=>{
            const icon=o.type==='text'?'fa-font':o.type==='rect'?'fa-square':o.type==='circle'?'fa-circle':'fa-star';
            const nm=o.type==='text'?(o.text||'').substring(0,10):o.type==='sticker'?o.emoji:o.type;
            h+=`<div class="ve-layer${i===vm.oi?' active':''}" onclick="window._veSelectOL(${i})"><i class="fa-solid ${icon}"></i> ${nm}</div>`;
        });
        h += '</div>';
    }
    el.innerHTML = h;
}

function renderElementTab(el) {
    let h = '<div class="ve-sec"><b>도형</b><div class="ve-elem-grid">';
    h += `<button class="ve-elem-btn" onclick="window._veStartAdd('rect')"><i class="fa-regular fa-square"></i><span>사각형</span></button>`;
    h += `<button class="ve-elem-btn" onclick="window._veStartAdd('circle')"><i class="fa-regular fa-circle"></i><span>원</span></button>`;
    h += '</div></div>';
    h += '<div class="ve-sec"><b>스티커</b><div class="ve-sticker-grid">';
    STICKERS.forEach(s=>h+=`<button class="ve-sticker-btn${vm.addSticker===s?' active':''}" onclick="window._vePickSticker('${s}')">${s}</button>`);
    h += `</div><button class="ve-add-btn" onclick="window._veStartAdd('sticker')"><i class="fa-solid fa-hand-pointer"></i> 캔버스에 스티커 배치</button></div>`;
    // Supabase library images
    h += '<div class="ve-sec"><b>이미지 라이브러리</b>';
    h += '<div id="veLibGrid" class="ve-lib-grid"><p class="ve-empty" style="grid-column:1/-1">로딩 중...</p></div>';
    h += '<button class="ve-lib-more" onclick="window._veLoadMoreLib()"><i class="fa-solid fa-angles-down"></i> 더 보기</button>';
    h += '</div>';
    el.innerHTML = h;
    loadLibElements();
}

async function loadLibElements() {
    const grid=document.getElementById('veLibGrid'); if(!grid) return;
    try {
        const sb=window.sb; if(!sb){grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">DB 연결 없음</p>';return;}
        if(!vm.libItems){
            const { data, error } = await sb.from('library')
                .select('id, thumb_url, category')
                .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
                .order('created_at', { ascending: false })
                .range(0, 29);
            if(error) throw error;
            vm.libItems = data || [];
            vm.libPage = 1;
        }
        renderLibGrid(grid);
    } catch(e) {
        console.warn('Library load error:', e);
        grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">로드 실패</p>';
    }
}

function renderLibGrid(grid) {
    if(!vm.libItems||!vm.libItems.length){grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">이미지 없음</p>';return;}
    let h='';
    vm.libItems.forEach(item=>{
        const url=item.thumb_url||'';
        h+=`<div class="ve-lib-item" onclick="window._veAddLibImage('${url.replace(/'/g,"\\'")}')"><img src="${url}" loading="lazy"></div>`;
    });
    grid.innerHTML=h;
}

window._veLoadMoreLib = async function() {
    if(!window.sb||!vm.libItems) return;
    const page=vm.libPage||1;
    try {
        const { data, error } = await window.sb.from('library')
            .select('id, thumb_url, category')
            .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
            .order('created_at', { ascending: false })
            .range(page*30, (page+1)*30-1);
        if(!error&&data&&data.length){
            vm.libItems=[...vm.libItems,...data];
            vm.libPage=page+1;
            const grid=document.getElementById('veLibGrid');
            if(grid) renderLibGrid(grid);
        } else { showToast('더 이상 이미지가 없습니다'); }
    } catch(e){ showToast('로드 실패'); }
};

window._veAddLibImage = function(url) {
    const c=curClip();
    if(!c) return alert('클립을 먼저 추가하세요');
    addOverlay('image', vm.w*.2, vm.h*.2, {url, w:vm.w*.4, h:vm.w*.4});
    showToast('이미지 요소 추가됨');
};

function renderTransitionTab(el) {
    const c=curClip(), cur=c?c.transition:'fade';
    let h='<div class="ve-sec"><b>전환 효과</b><div class="ve-trans-grid">';
    TRANSITIONS.forEach(t=>{ h+=`<button class="ve-trans-btn${cur===t.id?' active':''}" onclick="window._veSetTrans('${t.id}')"><div style="color:${t.color};font-size:18px"><i class="fa-solid ${t.icon}"></i></div><span>${t.name}</span></button>`; });
    h+='</div></div>';
    if(c){ h+='<div class="ve-sec"><b>장면 시간</b>'; h+=`<label>${c.duration}초</label><input type="range" min="0.5" max="15" step="0.5" value="${c.duration}" oninput="window._veSetDur(+this.value);this.previousElementSibling.textContent=this.value+'초'">`; h+='</div>'; }
    el.innerHTML = h;
}

function renderAdjustTab(el) {
    const c=curClip();
    if(!c){el.innerHTML='<p class="ve-empty">클립을 선택하세요</p>';return;}
    const a=c.adj;
    let h='<div class="ve-sec"><b>이미지 보정</b>';
    h+=`<label>밝기 ${a.brightness}</label><input type="range" min="-100" max="100" value="${a.brightness}" oninput="window._veAdj('brightness',+this.value);this.previousElementSibling.textContent='밝기 '+this.value">`;
    h+=`<label>대비 ${a.contrast}</label><input type="range" min="-100" max="100" value="${a.contrast}" oninput="window._veAdj('contrast',+this.value);this.previousElementSibling.textContent='대비 '+this.value">`;
    h+=`<label>채도 ${a.saturation}%</label><input type="range" min="0" max="300" value="${a.saturation}" oninput="window._veAdj('saturation',+this.value);this.previousElementSibling.textContent='채도 '+this.value+'%'">`;
    h+=`<label>블러 ${a.blur}px</label><input type="range" min="0" max="20" step="0.5" value="${a.blur}" oninput="window._veAdj('blur',+this.value);this.previousElementSibling.textContent='블러 '+this.value+'px'">`;
    h+=`<label>색조 ${a.hue}°</label><input type="range" min="0" max="360" value="${a.hue}" oninput="window._veAdj('hue',+this.value);this.previousElementSibling.textContent='색조 '+this.value+'°'">`;
    h+=`<button class="ve-reset-btn" onclick="window._veResetAdj()"><i class="fa-solid fa-rotate-left"></i> 초기화</button></div>`;
    el.innerHTML = h;
}

function renderTemplateTab(el) {
    let h='<div class="ve-sec"><b>템플릿</b><p style="font-size:10px;color:#6b7280;margin:0 0 8px">현재 장면에 적용</p>';
    TEMPLATES.forEach(t=>{h+=`<button class="ve-tpl-btn" onclick="window._veApplyTpl('${t.id}')"><i class="fa-solid ${t.icon}"></i> ${t.name}</button>`;});
    h+='</div>';
    el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// RIGHT PANEL (Properties)
// ═══════════════════════════════════════════════════════════════
function refreshRightPanel() {
    const el=document.getElementById('veRightContent'); if(!el) return;
    const c=curClip();
    if(!c){el.innerHTML='<p class="ve-empty">클립을 선택하세요</p>';return;}
    let h='';
    if(vm.oi>=0 && c.overlays[vm.oi]) {
        const o=c.overlays[vm.oi];
        h+='<div class="ve-sec"><b>선택된 요소</b>';
        h+=`<label>타입: ${o.type}</label>`;
        if(o.type==='text'){
            h+=`<label>내용</label><input class="ve-inp" value="${(o.text||'').replace(/"/g,'&quot;')}" oninput="window._veUpOL('text',this.value)">`;
            h+=`<label>크기 ${o.fontSize}px</label><input type="range" min="16" max="${Math.round(vm.w*.15)}" value="${o.fontSize}" oninput="window._veUpOL('fontSize',+this.value)">`;
            h+=`<label>색상</label><input type="color" value="${expandHex(o.color)}" oninput="window._veUpOL('color',this.value)" style="width:100%;height:24px">`;
            h+=`<label>폰트</label><select class="ve-inp" onchange="window._veUpOL('fontFamily',this.value)">`;
            const rFonts=window.DYNAMIC_FONTS||[];const rFB=[{font_name:'sans-serif',font_family:'sans-serif'},{font_name:'serif',font_family:'serif'}];
            (rFonts.length?[...rFB,...rFonts]:rFB).forEach(f=>h+=`<option value="${f.font_family}"${o.fontFamily===f.font_family?' selected':''}>${f.font_name}</option>`);
            h+='</select>';
        } else if(o.type==='image'){
            h+=`<label>너비 ${Math.round(o.w)}</label><input type="range" min="50" max="${vm.w}" value="${o.w}" oninput="window._veUpOL('w',+this.value)">`;
            h+=`<label>높이 ${Math.round(o.h)}</label><input type="range" min="30" max="${vm.h}" value="${o.h}" oninput="window._veUpOL('h',+this.value)">`;
        } else if(o.type==='rect'){
            h+=`<label>채우기</label><input type="color" value="${rgbaHex(o.fill)}" oninput="window._veUpOL('fill',this.value)" style="width:100%;height:24px">`;
            h+=`<label>너비 ${Math.round(o.w)}</label><input type="range" min="50" max="${vm.w}" value="${o.w}" oninput="window._veUpOL('w',+this.value)">`;
            h+=`<label>높이 ${Math.round(o.h)}</label><input type="range" min="30" max="${vm.h}" value="${o.h}" oninput="window._veUpOL('h',+this.value)">`;
        } else if(o.type==='circle'){
            h+=`<label>채우기</label><input type="color" value="${rgbaHex(o.fill)}" oninput="window._veUpOL('fill',this.value)" style="width:100%;height:24px">`;
            h+=`<label>반지름 ${Math.round(o.r)}</label><input type="range" min="10" max="${vm.w/2}" value="${o.r}" oninput="window._veUpOL('r',+this.value)">`;
        } else if(o.type==='sticker'){
            h+=`<label>크기 ${o.size}</label><input type="range" min="20" max="${Math.round(vm.w*.2)}" value="${o.size}" oninput="window._veUpOL('size',+this.value)">`;
        }
        // rotation control (all overlay types)
        const rot=Math.round(o.rotation||0);
        h+=`<label>회전 ${rot}°</label><input type="range" min="-180" max="180" value="${rot}" oninput="window._veUpOL('rotation',+this.value);this.previousElementSibling.textContent='회전 '+this.value+'°'">`;
        h+=`<button class="ve-del-btn" onclick="window._veRemoveOL()"><i class="fa-solid fa-trash"></i> 삭제</button></div>`;
    } else {
        h+='<div class="ve-sec"><b>클립 속성</b>';
        h+=`<label>타입: ${c.type==='video'?'영상':'이미지'}</label>`;
        h+=`<label>시간: ${c.duration}초</label><input type="range" min="0.5" max="15" step="0.5" value="${c.duration}" oninput="window._veSetDur(+this.value);updateTimeline()">`;
        h+=`<label>전환: ${(TRANSITIONS.find(t=>t.id===c.transition)||{}).name||'없음'}</label>`;
        h+='</div>';
        // adjustments
        const a=c.adj;
        h+='<div class="ve-sec"><b>보정</b>';
        h+=`<label>밝기 ${a.brightness}</label><input type="range" min="-100" max="100" value="${a.brightness}" oninput="window._veAdj('brightness',+this.value)">`;
        h+=`<label>대비 ${a.contrast}</label><input type="range" min="-100" max="100" value="${a.contrast}" oninput="window._veAdj('contrast',+this.value)">`;
        h+=`<label>채도 ${a.saturation}%</label><input type="range" min="0" max="300" value="${a.saturation}" oninput="window._veAdj('saturation',+this.value)">`;
        h+='</div>';
    }
    el.innerHTML = h;
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════
function updateTimeline() {
    renderRuler(); renderVideoTrack(); renderAudioTrack(); renderOverlayTrack(); updatePlayhead();
}

function renderRuler() {
    const el=document.getElementById('veTlRuler'); if(!el) return;
    const td=totalDur()||10, tw=td*TL_PPS*vm.tlZoom;
    el.style.width=tw+'px'; el.innerHTML='';
    const interval = vm.tlZoom>1.5?0.5:vm.tlZoom>0.5?1:2;
    for(let t=0;t<=td;t+=interval){
        const mk=document.createElement('span'); mk.className='ve-ruler-mark';
        mk.style.left=(t*TL_PPS*vm.tlZoom)+'px'; mk.textContent=fmtTime(t);
        el.appendChild(mk);
    }
}

function renderVideoTrack() {
    const el=document.getElementById('veTlVideo'); if(!el) return;
    const td=totalDur()||10; el.style.width=(td*TL_PPS*vm.tlZoom)+'px'; el.innerHTML='';
    vm.clips.forEach((c,i)=>{
        const d=document.createElement('div'); d.className='ve-tl-clip'+(i===vm.ci?' active':'');
        d.style.width=(c.duration*TL_PPS*vm.tlZoom)+'px';
        d.innerHTML=`<img src="${c.thumbUrl}"><span class="ve-tl-clip-dur">${fmtTime(c.duration)}</span>`;
        d.onclick=()=>selectClip(i);
        // drag reorder
        d.draggable=true;
        d.addEventListener('dragstart',e=>e.dataTransfer.setData('text',i));
        d.addEventListener('dragover',e=>{e.preventDefault();d.style.borderColor='#818cf8';});
        d.addEventListener('dragleave',()=>d.style.borderColor='');
        d.addEventListener('drop',e=>{e.preventDefault();d.style.borderColor='';const from=parseInt(e.dataTransfer.getData('text'));if(from!==i&&!isNaN(from)){const[mv]=vm.clips.splice(from,1);vm.clips.splice(i,0,mv);vm.ci=i;updateAll();render();}});
        el.appendChild(d);
    });
}

function renderAudioTrack() {
    const el=document.getElementById('veTlAudio'); if(!el) return;
    const td=totalDur()||10; el.style.width=(td*TL_PPS*vm.tlZoom)+'px';
    if(vm.music==='none'){el.innerHTML='<div class="ve-tl-audio-empty">오디오 탭에서 음악을 선택하세요</div>';return;}
    const m=MUSIC.find(x=>x.id===vm.music);
    el.innerHTML=`<div class="ve-tl-audio-clip" style="width:100%"><i class="fa-solid fa-music"></i> ${m?m.name:vm.music}</div>`;
}

function renderOverlayTrack() {
    const el=document.getElementById('veTlOverlay'); if(!el) return;
    const td=totalDur()||10; el.style.width=(td*TL_PPS*vm.tlZoom)+'px'; el.innerHTML='';
    let hasAny=false;
    vm.clips.forEach((c,ci)=>{
        if(!c.overlays.length) return;
        hasAny=true;
        const startPx=clipStart(ci)*TL_PPS*vm.tlZoom;
        const clipPx=c.duration*TL_PPS*vm.tlZoom;
        c.overlays.forEach((o,oi)=>{
            const d=document.createElement('div');
            d.className=`ve-tl-ol-item type-${o.type}${ci===vm.ci&&oi===vm.oi?' active':''}`;
            d.style.position='absolute';d.style.left=startPx+'px';d.style.maxWidth=clipPx+'px';
            const icon=o.type==='text'?'fa-font':o.type==='rect'?'fa-square':o.type==='circle'?'fa-circle':o.type==='image'?'fa-image':'fa-star';
            const nm=o.type==='text'?(o.text||'T').substring(0,8):o.type==='sticker'?o.emoji:o.type==='image'?'IMG':o.type;
            d.innerHTML=`<i class="fa-solid ${icon}" style="font-size:8px"></i> ${nm}`;
            d.onclick=(e)=>{e.stopPropagation();vm.ci=ci;vm.oi=oi;render();updateAll();};
            el.appendChild(d);
        });
    });
    if(!hasAny) el.innerHTML='<div class="ve-tl-overlay-empty">텍스트/요소 레이어</div>';
}

function updatePlayhead() {
    const ph=document.getElementById('vePlayhead'); if(!ph) return;
    ph.style.left=(vm.playTime*TL_PPS*vm.tlZoom)+'px';
    const cur=document.getElementById('veTimeNow'); if(cur) cur.textContent=fmtTime(vm.playTime);
    const tot=document.getElementById('veTimeTotal'); if(tot) tot.textContent=fmtTime(totalDur());
}

// ═══════════════════════════════════════════════════════════════
// UPDATE ALL
// ═══════════════════════════════════════════════════════════════
function updateAll() { refreshLeftPanel(); refreshRightPanel(); updateTimeline(); updateFormatBtns(); }
function updateFormatBtns() { document.querySelectorAll('.ve-fmt-btn').forEach(b=>b.classList.toggle('active',b.dataset.fmt===vm.format)); }

// ═══════════════════════════════════════════════════════════════
// WINDOW HANDLERS
// ═══════════════════════════════════════════════════════════════
window._veSelectClip = selectClip;
window._veRemoveClip = removeClip;
window._veSelectOL = selectOverlay;
window._veRemoveOL = () => removeOverlay(vm.oi);
window._veStartAdd = (mode) => { vm.addMode=mode; vm.canvas.style.cursor='crosshair'; showToast('캔버스를 클릭하여 배치'); };
window._vePickSticker = (e) => { vm.addSticker=e; refreshLeftPanel(); };
window._veUpOL = (p,v) => { const c=curClip(); if(c&&vm.oi>=0&&c.overlays[vm.oi]){c.overlays[vm.oi][p]=v;render();} };
window._veSelectMusic = (id) => { vm.music=id; refreshLeftPanel(); updateTimeline(); };
window._vePreviewMusic = (id) => { vm.musicPlaying===id ? stopMusicPreview() : playMusicPreview(id); };
window._veSetTrans = (id) => { const c=curClip(); if(c){c.transition=id;refreshLeftPanel();updateTimeline();} };
window._veSetDur = (v) => { const c=curClip(); if(c){c.duration=v;updateTimeline();refreshRightPanel();} };
window._veAdj = (p,v) => { const c=curClip(); if(c){c.adj[p]=v;render();} };
window._veResetAdj = () => { const c=curClip(); if(c){c.adj={brightness:0,contrast:0,saturation:100,blur:0,hue:0};render();refreshLeftPanel();refreshRightPanel();} };
window._veApplyTpl = (id) => {
    const c=curClip(); if(!c)return alert('클립을 먼저 추가하세요');
    const t=TEMPLATES.find(x=>x.id===id); if(!t)return;
    t.mk(vm.w,vm.h).forEach(o=>c.overlays.push(o));
    vm.oi=c.overlays.length-1; render(); vm.leftTab='text'; refreshLeftPanel();
};
window._veSetTab = (tab) => { vm.leftTab=tab; refreshLeftPanel(); };
window._veChangeFormat = (fmtId) => {
    const f=FORMATS.find(x=>x.id===fmtId); if(!f) return;
    vm.format=f.id; vm.w=f.w; vm.h=f.h;
    if(vm.canvas){vm.canvas.width=vm.w;vm.canvas.height=vm.h;vm.ctx=vm.canvas.getContext('2d');}
    render(); updateAll();
};
window._veTlClick = (e) => {
    const rect=document.getElementById('veTlScroll').getBoundingClientRect();
    const x=e.clientX-rect.left+document.getElementById('veTlScroll').scrollLeft;
    vm.playTime=Math.max(0,Math.min(x/(TL_PPS*vm.tlZoom),totalDur()));
    updatePlayhead();
    // select clip at this time
    let elapsed=0;
    for(let i=0;i<vm.clips.length;i++){if(vm.playTime>=elapsed&&vm.playTime<elapsed+vm.clips[i].duration){selectClip(i);break;}elapsed+=vm.clips[i].duration;}
};
window._veZoomTl = (dir) => { vm.tlZoom=Math.max(0.2,Math.min(5,vm.tlZoom+(dir>0?0.3:-0.3))); updateTimeline(); };

function showToast(msg){const t=document.getElementById('veToast');if(!t)return;t.textContent=msg;t.style.display='block';t.style.opacity='1';setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.style.display='none',300);},2000);}
function fmtTime(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');}
function rgbaHex(c){if(!c)return'#ffffff';if(c.startsWith('#')){if(c.length===4)return'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];return c.length>7?c.substring(0,7):c;}const m=c.match(/\d+/g);if(!m)return'#ffffff';return'#'+[m[0],m[1],m[2]].map(x=>(+x).toString(16).padStart(2,'0')).join('');}
function expandHex(c){if(!c)return'#ffffff';if(c.length===4&&c.startsWith('#'))return'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3];return c;}

// ═══════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════
function animateTransition(fromSrc, toClip, type, ms) {
    return new Promise(resolve => {
        const toSrc=toClip.type==='video'?toClip.video:toClip.img, toAdj=toClip.adj;
        const start=performance.now();
        function frame(now){
            if(vm.cancel)return resolve();
            const t=Math.min((now-start)/ms,1), ctx=vm.ctx;
            ctx.fillStyle='#000';ctx.fillRect(0,0,vm.w,vm.h);
            switch(type){
                case 'fade': ctx.globalAlpha=1-t;drawCover(ctx,fromSrc,vm.w,vm.h);ctx.globalAlpha=t;applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.globalAlpha=1;break;
                case 'slideL': drawCoverAt(ctx,fromSrc,-vm.w*t,0,vm.w,vm.h);applyAdj(ctx,toAdj);drawCoverAt(ctx,toSrc,vm.w*(1-t),0,vm.w,vm.h);ctx.filter='none';break;
                case 'slideR': drawCoverAt(ctx,fromSrc,vm.w*t,0,vm.w,vm.h);applyAdj(ctx,toAdj);drawCoverAt(ctx,toSrc,-vm.w*(1-t),0,vm.w,vm.h);ctx.filter='none';break;
                case 'slideUp': drawCoverAt(ctx,fromSrc,0,-vm.h*t,vm.w,vm.h);applyAdj(ctx,toAdj);drawCoverAt(ctx,toSrc,0,vm.h*(1-t),vm.w,vm.h);ctx.filter='none';break;
                case 'zoomIn': ctx.save();ctx.globalAlpha=1-t;ctx.translate(vm.w/2,vm.h/2);ctx.scale(1+t*.3,1+t*.3);ctx.translate(-vm.w/2,-vm.h/2);drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.globalAlpha=t;applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.globalAlpha=1;break;
                case 'zoomOut': ctx.save();ctx.globalAlpha=1-t;drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.globalAlpha=t;ctx.translate(vm.w/2,vm.h/2);ctx.scale(2-t,2-t);ctx.translate(-vm.w/2,-vm.h/2);applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();ctx.globalAlpha=1;break;
                case 'wipe': drawCover(ctx,fromSrc,vm.w,vm.h);ctx.save();ctx.beginPath();ctx.rect(0,0,vm.w*t,vm.h);ctx.clip();applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();break;
                default: applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';break;
            }
            if(t<1)requestAnimationFrame(frame);else resolve();
        }
        requestAnimationFrame(frame);
    });
}

// ═══════════════════════════════════════════════════════════════
// PLAYBACK
// ═══════════════════════════════════════════════════════════════
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

async function playClipOnCanvas(ci, durMs) {
    const c=vm.clips[ci]; if(!c) return;
    const src=c.type==='video'?c.video:c.img;
    if(c.type==='video'){c.video.currentTime=0;try{await c.video.play();}catch(e){}}
    const startT=performance.now(), startPlayT=clipStart(ci);
    return new Promise(resolve=>{
        function frame(){
            if(vm.cancel){if(c.type==='video')c.video.pause();resolve();return;}
            if(vm.paused){if(c.type==='video'&&!c.video.paused)c.video.pause();setTimeout(frame,50);return;}
            if(c.type==='video'&&c.video.paused)try{c.video.play();}catch(e){}
            const elapsed=performance.now()-startT;
            vm.playTime=startPlayT+elapsed/1000; updatePlayhead();
            const ctx=vm.ctx; applyAdj(ctx,c.adj);
            ctx.fillStyle='#000';ctx.fillRect(0,0,vm.w,vm.h);
            drawCover(ctx,src,vm.w,vm.h);ctx.filter='none';
            c.overlays.forEach(o=>renderOverlay(ctx,o));
            if(elapsed>=durMs){if(c.type==='video')c.video.pause();resolve();}
            else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
}

window.vePlay = async function() {
    if(!vm.clips.length)return alert('클립을 먼저 추가하세요.');
    if(vm.playing){vm.cancel=true;return;}
    vm.playing=true;vm.paused=false;vm.cancel=false;vm.playTime=0;
    const btn=document.getElementById('vePlayBtn');
    if(btn)btn.innerHTML='<i class="fa-solid fa-stop"></i>';
    playMusicPreview(vm.music);
    for(let i=0;i<vm.clips.length;i++){
        if(vm.cancel)break;
        vm.ci=i;vm.oi=-1;
        const c=vm.clips[i],dur=c.duration*1000,transMs=800;
        if(i>0&&c.transition!=='none'){
            const prevSrc=vm.clips[i-1].type==='video'?vm.clips[i-1].video:vm.clips[i-1].img;
            await animateTransition(prevSrc,c,c.transition,transMs);
            c.overlays.forEach(o=>renderOverlay(vm.ctx,o));
            await playClipOnCanvas(i,dur-transMs);
        } else {
            await playClipOnCanvas(i,dur);
        }
    }
    stopMusicPreview();vm.playing=false;vm.paused=false;vm.cancel=false;
    if(btn)btn.innerHTML='<i class="fa-solid fa-play"></i>';
    updateAll();
};

window.vePause = function(){
    if(!vm.playing)return;
    vm.paused=!vm.paused;
    const btn=document.getElementById('vePauseBtn');
    if(vm.paused){if(btn)btn.innerHTML='<i class="fa-solid fa-play"></i>';stopMusicPreview();showToast('일시정지 — 캔버스에서 편집 가능');}
    else{if(btn)btn.innerHTML='<i class="fa-solid fa-pause"></i>';playMusicPreview(vm.music);}
};

// ═══════════════════════════════════════════════════════════════
// RECORDING
// ═══════════════════════════════════════════════════════════════
window.veExport = async function() {
    if(!vm.clips.length)return alert('클립을 먼저 추가하세요.');
    if(vm.playing)return;
    vm.playing=true;vm.cancel=false;vm.playTime=0;
    const prog=document.getElementById('veProgress'),progBar=document.getElementById('veProgressBar'),progText=document.getElementById('veProgressText');
    const expBtn=document.getElementById('veExportBtn'),dlBtn=document.getElementById('veDlBtn');
    if(prog)prog.style.display='block';if(dlBtn)dlBtn.style.display='none';
    if(expBtn){expBtn.disabled=true;expBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';}
    const fps=30; let totalMs=0; vm.clips.forEach(c=>totalMs+=c.duration*1000);
    const canvasStream=vm.canvas.captureStream(fps);
    const musicStream=await createMusicStream(vm.music,totalMs);
    let combined=musicStream?new MediaStream([...canvasStream.getVideoTracks(),...musicStream.getAudioTracks()]):canvasStream;
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const rec=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:5000000});
    const chunks=[];rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};rec.start();
    for(let i=0;i<vm.clips.length;i++){
        const pct=Math.round(i/vm.clips.length*100);if(progBar)progBar.style.width=pct+'%';if(progText)progText.textContent=`${i+1}/${vm.clips.length}`;
        const c=vm.clips[i],dur=c.duration*1000;
        if(i>0&&c.transition!=='none'){const ps=vm.clips[i-1].type==='video'?vm.clips[i-1].video:vm.clips[i-1].img;await animateTransition(ps,c,c.transition,800);c.overlays.forEach(o=>renderOverlay(vm.ctx,o));await sleep(dur-800);}
        else{renderClip(i,vm.ctx,false);await sleep(dur);}
    }
    if(progBar)progBar.style.width='100%';if(progText)progText.textContent='인코딩 중...';
    await new Promise(r=>{rec.onstop=r;rec.stop();});
    const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob);
    if(dlBtn){dlBtn.style.display='inline-flex';dlBtn.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=`chameleon_${vm.format}_${Date.now()}.webm`;a.click();};}
    if(progText)progText.textContent='완료!';
    if(expBtn){expBtn.disabled=false;expBtn.innerHTML='<i class="fa-solid fa-download"></i> Export';}
    vm.playing=false;
};

// ═══════════════════════════════════════════════════════════════
// INIT & EVENTS
// ═══════════════════════════════════════════════════════════════
export function initVideoMaker() {
    const modal=document.getElementById('videoMakerModal'); if(!modal) return;
    const fi=document.getElementById('veFileInput');
    const dz=document.getElementById('veDropOverlay');
    if(fi) fi.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
    // drag & drop on canvas area
    const center=document.querySelector('.ve-center');
    if(center){
        center.addEventListener('dragover',e=>{e.preventDefault();if(dz)dz.style.display='flex';});
        center.addEventListener('dragleave',e=>{if(dz&&!center.contains(e.relatedTarget))dz.style.display='none';});
        center.addEventListener('drop',e=>{e.preventDefault();if(dz)dz.style.display='none';addFiles(e.dataTransfer.files);});
    }
    // canvas
    const cvs=document.getElementById('veCanvas');
    if(cvs){
        cvs.addEventListener('mousedown',onDown);cvs.addEventListener('mousemove',onMove);cvs.addEventListener('mouseup',onUp);
        cvs.addEventListener('dblclick',onDblClick);
        cvs.addEventListener('touchstart',e=>{e.preventDefault();onDown(e.touches[0]);},{passive:false});
        cvs.addEventListener('touchmove',e=>{e.preventDefault();onMove(e.touches[0]);},{passive:false});
        cvs.addEventListener('touchend',onUp);
    }
    // tabs
    document.querySelectorAll('.ve-ltab').forEach(b=>b.addEventListener('click',()=>{vm.leftTab=b.dataset.tab;refreshLeftPanel();}));
    document.querySelectorAll('.ve-fmt-btn').forEach(b=>b.addEventListener('click',()=>window._veChangeFormat(b.dataset.fmt)));
    // timeline click
    const tlScroll=document.getElementById('veTlScroll');
    if(tlScroll) tlScroll.addEventListener('click',window._veTlClick);
    // keyboard (delete overlay)
    document.addEventListener('keydown',onKeyDown);
    console.log('🎬 CapCut-Style Editor v4 초기화');
}

function onKeyDown(e){
    const modal=document.getElementById('videoMakerModal');
    if(!modal||modal.style.display==='none')return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
    if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();
        if(vm.oi>=0){removeOverlay(vm.oi);showToast('요소 삭제됨');}
    }
}

function onDown(e){
    if(vm.playing&&!vm.paused)return;
    const{x,y}=canvasXY(e);
    if(vm.addMode){if(vm.addMode==='sticker')addOverlay('sticker',x,y,{emoji:vm.addSticker});else addOverlay(vm.addMode,x,y);vm.addMode=null;vm.canvas.style.cursor='default';return;}
    // check handles on currently selected overlay
    const c=curClip();
    if(c&&vm.oi>=0&&c.overlays[vm.oi]){
        const handle=hitHandle(x,y,c.overlays[vm.oi]);
        if(handle){
            const o=c.overlays[vm.oi];
            vm.drag={oi:vm.oi,mode:handle.mode,corner:handle.corner,sx:x,sy:y,
                orig:{x:o.x,y:o.y,w:o.w,h:o.h,r:o.r,size:o.size,fontSize:o.fontSize,rotation:o.rotation||0}};
            vm.canvas.style.cursor=handle.mode==='rotate'?'grab':'nwse-resize';
            return;
        }
    }
    const hit=hitOverlay(x,y);
    if(hit>=0){vm.oi=hit;const o=c.overlays[hit];vm.drag={oi:hit,mode:'move',ox:x-o.x,oy:y-o.y};render();refreshRightPanel();refreshLeftPanel();}
    else{vm.oi=-1;render();refreshRightPanel();refreshLeftPanel();}
}

function onMove(e){
    if(!vm.drag)return;
    const{x,y}=canvasXY(e);
    const c=curClip();if(!c||!c.overlays[vm.drag.oi])return;
    const o=c.overlays[vm.drag.oi];
    if(vm.drag.mode==='rotate'){
        const b=getOBounds(o);if(b){
            o.rotation=Math.atan2(x-b.cx,b.cy-y)*180/Math.PI;
        }
    } else if(vm.drag.mode==='resize'){
        const dx=x-vm.drag.sx,dy=y-vm.drag.sy,orig=vm.drag.orig,corner=vm.drag.corner;
        if(o.type==='text'){
            const scale=corner.includes('b')?1+dy/(orig.fontSize*4):1-dy/(orig.fontSize*4);
            o.fontSize=Math.max(16,Math.round(orig.fontSize*Math.max(0.2,scale)));
        } else if(o.type==='rect'||o.type==='image'){
            if(corner==='br'){o.w=Math.max(30,orig.w+dx);o.h=Math.max(30,orig.h+dy);}
            else if(corner==='bl'){o.x=orig.x+dx;o.w=Math.max(30,orig.w-dx);o.h=Math.max(30,orig.h+dy);}
            else if(corner==='tr'){o.w=Math.max(30,orig.w+dx);o.y=orig.y+dy;o.h=Math.max(30,orig.h-dy);}
            else if(corner==='tl'){o.x=orig.x+dx;o.y=orig.y+dy;o.w=Math.max(30,orig.w-dx);o.h=Math.max(30,orig.h-dy);}
        } else if(o.type==='circle'){
            const dist=(dx+dy)/2;o.r=Math.max(10,orig.r+dist);
        } else if(o.type==='sticker'){
            const dist=(dx+dy)/2;o.size=Math.max(20,Math.round(orig.size+dist));
        }
    } else {
        o.x=x-vm.drag.ox;o.y=y-vm.drag.oy;
    }
    render();refreshRightPanel();
}

function onUp(){
    if(vm.drag&&(vm.drag.mode==='resize'||vm.drag.mode==='rotate'))vm.canvas.style.cursor='default';
    vm.drag=null;
}

// ── Double-click text editing ──
function onDblClick(e){
    if(vm.playing&&!vm.paused)return;
    const{x,y}=canvasXY(e);
    const hit=hitOverlay(x,y);
    if(hit<0)return;
    const c=curClip();if(!c)return;
    const o=c.overlays[hit];
    if(o.type!=='text')return;
    vm.oi=hit;
    // create floating input over canvas
    const rect=vm.canvas.getBoundingClientRect();
    const scaleX=rect.width/vm.w,scaleY=rect.height/vm.h;
    const b=getOBounds(o);if(!b)return;
    const inp=document.createElement('input');
    inp.type='text';inp.value=o.text||'';
    inp.style.cssText=`position:fixed;left:${rect.left+b.bx*scaleX}px;top:${rect.top+b.by*scaleY}px;`
        +`width:${Math.max(100,b.bw*scaleX+20)}px;height:${b.bh*scaleY+8}px;`
        +`font-size:${o.fontSize*scaleY}px;font-family:${o.fontFamily||'sans-serif'};`
        +`color:${o.color||'#fff'};background:rgba(0,0,0,0.7);border:2px solid #00bfff;`
        +`border-radius:4px;padding:2px 6px;outline:none;z-index:99999999;`
        +`font-weight:${o.bold?'bold':'normal'};text-align:${o.align||'center'};box-sizing:border-box;`;
    if(o.rotation){inp.style.transform=`rotate(${o.rotation}deg)`;inp.style.transformOrigin='top left';}
    document.body.appendChild(inp);
    inp.focus();inp.select();
    function finish(){
        o.text=inp.value||'텍스트';
        inp.remove();render();refreshLeftPanel();refreshRightPanel();
    }
    inp.addEventListener('blur',finish);
    inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();finish();}});
}

window.openVideoMaker = function(label) {
    vm.clips=[];vm.ci=0;vm.oi=-1;vm.playing=false;vm.paused=false;vm.cancel=false;
    vm.addMode=null;vm.music='none';vm.musicPlaying=null;vm.playTime=0;vm.leftTab='media';
    vm.libItems=null;vm.libPage=0;
    // format from label
    if(label==='쇼츠') vm.format='portrait';
    else vm.format='landscape';
    const f=FORMATS.find(x=>x.id===vm.format);
    vm.w=f.w;vm.h=f.h;
    const modal=document.getElementById('videoMakerModal');if(!modal)return;
    modal.style.display='flex';
    // hide site UI that has high z-index
    const topbar=document.querySelector('.topbar');if(topbar)topbar.style.display='none';
    const dock=document.querySelector('.bottom-dock');if(dock)dock.style.display='none';
    const mcd=document.getElementById('mobileControlDock');if(mcd)mcd.style.display='none';
    const title=document.getElementById('veTitle');
    if(title)title.textContent='영상 편집기';
    vm.canvas=document.getElementById('veCanvas');
    if(vm.canvas){vm.canvas.width=vm.w;vm.canvas.height=vm.h;vm.ctx=vm.canvas.getContext('2d');}
    render();updateAll();
    const dlBtn=document.getElementById('veDlBtn');if(dlBtn)dlBtn.style.display='none';
    const prog=document.getElementById('veProgress');if(prog)prog.style.display='none';
};

window.veClose = function(){
    stopMusicPreview();vm.cancel=true;vm.playing=false;
    document.getElementById('videoMakerModal').style.display='none';
    // restore site UI
    const topbar=document.querySelector('.topbar');if(topbar)topbar.style.display='';
    const dock=document.querySelector('.bottom-dock');if(dock)dock.style.display='';
    const mcd=document.getElementById('mobileControlDock');if(mcd)mcd.style.display='';
};
