// video-maker.js — CapCut-Style Video Editor v4
// Dark theme, timeline, video+image clips, format selector, overlays, music, adjustments
const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const FORMATS = [
    { id:'landscape', label:'16:9', name:'가로 영상', w:1920, h:1080 },
    { id:'portrait',  label:'9:16', name:'세로/쇼츠', w:1080, h:1920 },
    { id:'square',    label:'1:1',  name:'정사각형',   w:1080, h:1080 }
];

const MUSIC = [
    { id:'none', name:'없음', icon:'fa-volume-xmark', desc:'음악 없음' }
];

const TRANSITIONS = [
    { id:'none', name:'없음', icon:'fa-xmark', color:'#6b7280' },
    { id:'fade', name:'페이드', icon:'fa-circle-half-stroke', color:'#818cf8' },
    { id:'slideL', name:'← 슬라이드', icon:'fa-arrow-left', color:'#fbbf24' },
    { id:'slideR', name:'→ 슬라이드', icon:'fa-arrow-right', color:'#fbbf24' },
    { id:'slideUp', name:'↑ 슬라이드', icon:'fa-arrow-up', color:'#fbbf24' },
    { id:'zoomIn', name:'줌 인', icon:'fa-magnifying-glass-plus', color:'#34d399' },
    { id:'zoomOut', name:'줌 아웃', icon:'fa-magnifying-glass-minus', color:'#34d399' },
    { id:'wipe', name:'와이프', icon:'fa-bars-staggered', color:'#f472b6' },
    { id:'slideDown', name:'↓ 슬라이드', icon:'fa-arrow-down', color:'#fbbf24' },
    { id:'flipH', name:'뒤집기', icon:'fa-right-left', color:'#f472b6' },
    { id:'spin', name:'회전', icon:'fa-rotate', color:'#38bdf8' },
    { id:'blur', name:'블러', icon:'fa-droplet', color:'#a78bfa' },
    { id:'crossZoom', name:'크로스줌', icon:'fa-expand', color:'#34d399' },
    { id:'split', name:'분할', icon:'fa-table-columns', color:'#fb923c' }
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
      mk:(w,h)=>[{type:'rect',x:w*.1,y:h*.35,w:w*.8,h:h*.3,fill:'#ef4444',stroke:'#fff',strokeW:4,radius:16},{type:'text',x:w/2,y:h*.48,text:'중요 공지',fontSize:Math.round(w*.05),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.57,text:'세부 내용',fontSize:Math.round(w*.022),color:'#fecaca',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}]},
    { id:'intro', name:'인트로', icon:'fa-play-circle',
      mk:(w,h)=>[{type:'rect',x:0,y:0,w,h,fill:'rgba(0,0,0,0.7)',stroke:'',strokeW:0,radius:0},{type:'rect',x:w*.15,y:h*.25,w:w*.7,h:h*.5,fill:'rgba(99,102,241,0.3)',stroke:'#818cf8',strokeW:3,radius:20},{type:'text',x:w/2,y:h*.42,text:'채널명',fontSize:Math.round(w*.07),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.56,text:'영상 제목을 입력하세요',fontSize:Math.round(w*.03),color:'#c7d2fe',bold:false,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'rect',x:w*.35,y:h*.65,w:w*.3,h:4,fill:'#818cf8',stroke:'',strokeW:0,radius:2}]},
    { id:'outro', name:'아웃트로', icon:'fa-flag-checkered',
      mk:(w,h)=>[{type:'rect',x:0,y:0,w,h,fill:'rgba(0,0,0,0.75)',stroke:'',strokeW:0,radius:0},{type:'text',x:w/2,y:h*.35,text:'시청해주셔서 감사합니다',fontSize:Math.round(w*.045),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'rect',x:w*.25,y:h*.5,w:w*.5,h:h*.08,fill:'#ef4444',stroke:'',strokeW:0,radius:12},{type:'text',x:w/2,y:h*.545,text:'👍 좋아요 & 구독',fontSize:Math.round(w*.025),color:'#fff',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.68,text:'다음 영상에서 만나요!',fontSize:Math.round(w*.022),color:'#94a3b8',bold:false,shadow:false,align:'center',fontFamily:'sans-serif'}]},
    { id:'countdown', name:'카운트다운', icon:'fa-hourglass-half',
      mk:(w,h)=>[{type:'circle',x:w/2,y:h*.45,r:Math.round(w*.12),fill:'rgba(239,68,68,0.8)',stroke:'#fff',strokeW:4},{type:'text',x:w/2,y:h*.45,text:'3',fontSize:Math.round(w*.15),color:'#fff',bold:true,shadow:true,align:'center',fontFamily:'sans-serif'},{type:'text',x:w/2,y:h*.7,text:'곧 시작합니다',fontSize:Math.round(w*.025),color:'#fff',bold:false,shadow:true,align:'center',fontFamily:'sans-serif'}]},
    { id:'subscribe', name:'구독 버튼', icon:'fa-bell',
      mk:(w,h)=>[{type:'rect',x:w*.3,y:h*.8,w:w*.4,h:h*.08,fill:'#ef4444',stroke:'',strokeW:0,radius:8},{type:'text',x:w/2,y:h*.845,text:'🔔 구독하기',fontSize:Math.round(w*.028),color:'#fff',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'}]},
    { id:'progress', name:'프로그레스', icon:'fa-battery-half',
      mk:(w,h)=>[{type:'rect',x:0,y:h*.92,w,h:h*.08,fill:'rgba(0,0,0,0.6)',stroke:'',strokeW:0,radius:0},{type:'rect',x:0,y:h*.92,w:w*.4,h:h*.08,fill:'#6366f1',stroke:'',strokeW:0,radius:0},{type:'text',x:w/2,y:h*.965,text:'40% 완료',fontSize:Math.round(w*.02),color:'#fff',bold:true,shadow:false,align:'center',fontFamily:'sans-serif'}]}
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
    addMode: null, addSticker: '⭐', drag: null,
    imgItems: null, imgPage: 0,
    clipboard: null, snapLines: null,
    audioItems: null, audioEl: null, audioUrl: null,
    audioPage: 0, audioHasMore: false,
    audioTab: 'sfx', // 'sfx' or 'bgm'
    canvasZoom: 1
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

// Supabase 업로드 오디오를 MediaStream으로 변환 (녹화용)
async function createAudioFileStream(audioUrl) {
    if(!audioUrl) return null;
    try {
        const ctx = await getAC();
        const resp = await fetch(audioUrl);
        const buf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(buf);
        const dest = ctx.createMediaStreamDestination();
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.loop = true;
        const gain = ctx.createGain(); gain.gain.value = 0.5;
        source.connect(gain).connect(dest);
        source.start(0);
        return { stream: dest.stream, source };
    } catch(e){
        console.warn('Audio stream creation failed:', e);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// CLIP MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function curClip() { return vm.clips[vm.ci]; }
function clipEffDur(c) { return c.duration / (c.speed || 1); }
function clipStart(i) { let t=0; for(let j=0;j<i;j++) t+=clipEffDur(vm.clips[j]); return t; }
function totalDur() { return vm.clips.reduce((s,c)=>s+clipEffDur(c),0); }

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
            duration:3, overlays:[], adj:{brightness:0,contrast:0,saturation:100,blur:0,hue:0}, transition:'fade', speed:1.0,
            locked:true, panX:0, panY:0, imgScale:1 });
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
                overlays:[], adj:{brightness:0,contrast:0,saturation:100,blur:0,hue:0}, transition:'fade', speed:1.0,
                locked:true, panX:0, panY:0, imgScale:1 });
            video.onseeked = null;
            selectClip(vm.clips.length-1);
        };
    };
}

function duplicateClip(i) {
    const c = vm.clips[i]; if (!c) return;
    const nc = {
        type: c.type, file: c.file, url: c.url, thumbUrl: c.thumbUrl,
        duration: c.duration, transition: c.transition, speed: c.speed || 1.0,
        overlays: JSON.parse(JSON.stringify(c.overlays)),
        adj: { ...c.adj },
        locked: c.locked !== false, panX: c.panX || 0, panY: c.panY || 0, imgScale: c.imgScale || 1
    };
    // 이미지 복제
    if (c.type === 'image' && c.img) {
        const ni = new Image(); ni.src = c.img.src; nc.img = ni;
    }
    // 비디오 복제
    if (c.type === 'video' && c.video) {
        const nv = document.createElement('video');
        nv.src = c.url; nv.muted = true; nv.preload = 'auto'; nv.playsInline = true;
        nc.video = nv;
    }
    // 오버레이 이미지 복원
    nc.overlays.forEach(o => {
        if (o.type === 'image' && o.url) {
            const img = new Image(); img.src = o.url; o.img = img;
        }
    });
    vm.clips.splice(i + 1, 0, nc);
    selectClip(i + 1);
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
        case 'text': o={type:'text',x,y,text:props?.text||'텍스트',fontSize:props?.fontSize||fs,color:props?.color||'#fff',bold:props?.bold??true,shadow:props?.shadow??true,align:'center',fontFamily:props?.fontFamily||'sans-serif',strokeColor:props?.strokeColor||'#000',strokeWidth:props?.strokeWidth||0,bgBox:props?.bgBox||false,bgColor:props?.bgColor||'rgba(0,0,0,0.5)',lineHeight:props?.lineHeight||1.2}; break;
        case 'rect': o={type:'rect',x,y,w:props?.w||vm.w*.3,h:props?.h||vm.h*.12,fill:props?.fill||'rgba(99,102,241,0.5)',stroke:props?.stroke||'#fff',strokeW:props?.strokeW||2,radius:props?.radius||10}; break;
        case 'circle': o={type:'circle',x,y,r:props?.r||vm.w*.06,fill:props?.fill||'rgba(99,102,241,0.5)',stroke:props?.stroke||'#fff',strokeW:props?.strokeW||2}; break;
        case 'sticker': o={type:'sticker',x,y,emoji:props?.emoji||'⭐',size:props?.size||Math.round(vm.w*.08)}; break;
        case 'image': {
            const img=new Image();
            const imgUrl=props?.url||'';
            img.onload=()=>{
                // auto-size: fit within target bounds keeping aspect ratio
                if(img.naturalWidth&&img.naturalHeight){
                    const ar=img.naturalWidth/img.naturalHeight;
                    const tw=props?.w||vm.w*.3, th=props?.h||vm.w*.3;
                    if(ar>tw/th){o.w=tw;o.h=tw/ar;}else{o.h=th;o.w=th*ar;}
                }
                render();
            };
            img.onerror=()=>{ console.warn('Image load failed:',imgUrl); };
            img.src=imgUrl;
            o={type:'image',x,y,w:props?.w||vm.w*.3,h:props?.h||vm.w*.3,url:imgUrl,img};
            break;
        }
    }
    if (o) { o.rotation=o.rotation||0; o.tStart=0; o.tEnd=c.duration; c.overlays.push(o); vm.oi = c.overlays.length-1; render(); refreshRightPanel(); updateTimeline(); }
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
    const hs=Math.max(22,vm.w*.014),pad=8;
    // rotation handle (circle above top-center)
    const rhx=b.bx+b.bw/2,rhy=b.by-36;
    if(Math.hypot(p.x-rhx,p.y-rhy)<=18) return {mode:'rotate'};
    // corner handles
    const corners=[
        {id:'tl',hx:b.bx-pad,hy:b.by-pad},{id:'tr',hx:b.bx+b.bw+pad-hs,hy:b.by-pad},
        {id:'bl',hx:b.bx-pad,hy:b.by+b.bh+pad-hs},{id:'br',hx:b.bx+b.bw+pad-hs,hy:b.by+b.bh+pad-hs}
    ];
    for(const c of corners){if(p.x>=c.hx-4&&p.x<=c.hx+hs+4&&p.y>=c.hy-4&&p.y<=c.hy+hs+4)return{mode:'resize',corner:c.id};}
    return null;
}

function hitOverlay(cx, cy) {
    const c = curClip(); if(!c) return -1;
    const PAD = Math.max(20, vm.w * 0.015); // generous hit area padding
    const TPAD = Math.max(35, vm.w * 0.025); // extra large for text
    for (let i=c.overlays.length-1; i>=0; i--) {
        const o=c.overlays[i];
        const b=getOBounds(o); if(!b) continue;
        const p=unrotatePoint(cx,cy,o,b);
        if(o.type==='text'){const tw=o.fontSize*Math.max(o.text.length,1)*.55,th=o.fontSize*1.3,lx=o.align==='center'?o.x-tw/2:o.x;if(p.x>=lx-TPAD&&p.x<=lx+tw+TPAD&&p.y>=o.y-th-TPAD&&p.y<=o.y+TPAD)return i;}
        else if(o.type==='rect'){if(p.x>=o.x-PAD&&p.x<=o.x+o.w+PAD&&p.y>=o.y-PAD&&p.y<=o.y+o.h+PAD)return i;}
        else if(o.type==='circle'){if(Math.hypot(p.x-o.x,p.y-o.y)<=o.r+PAD)return i;}
        else if(o.type==='sticker'){const hs=o.size/2;if(p.x>=o.x-hs-PAD&&p.x<=o.x+hs+PAD&&p.y>=o.y-hs-PAD&&p.y<=o.y+hs+PAD)return i;}
        else if(o.type==='image'){if(p.x>=o.x-PAD&&p.x<=o.x+o.w+PAD&&p.y>=o.y-PAD&&p.y<=o.y+o.h+PAD)return i;}
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
        // upload icon circle
        const cx=vm.w/2,cy=vm.h/2-vm.w*.03,r=vm.w*.06;
        vm.ctx.beginPath();vm.ctx.arc(cx,cy,r,0,Math.PI*2);
        vm.ctx.strokeStyle='#4a5568';vm.ctx.lineWidth=Math.max(3,vm.w*.002);vm.ctx.setLineDash([10,8]);vm.ctx.stroke();vm.ctx.setLineDash([]);
        // plus icon
        vm.ctx.strokeStyle='#6b7280';vm.ctx.lineWidth=Math.max(4,vm.w*.003);
        const ps=r*.4;vm.ctx.beginPath();vm.ctx.moveTo(cx-ps,cy);vm.ctx.lineTo(cx+ps,cy);vm.ctx.moveTo(cx,cy-ps);vm.ctx.lineTo(cx,cy+ps);vm.ctx.stroke();
        // text
        vm.ctx.fillStyle='#6b7280'; vm.ctx.font=`${vm.w*.022}px sans-serif`; vm.ctx.textAlign='center';
        vm.ctx.fillText(_t('ve_click_upload','클릭하여 미디어를 추가하세요'),vm.w/2,vm.h/2+vm.w*.06);
        vm.ctx.fillStyle='#4a5568'; vm.ctx.font=`${vm.w*.014}px sans-serif`;
        vm.ctx.fillText(_t('ve_drag_hint','또는 파일을 드래그하세요'),vm.w/2,vm.h/2+vm.w*.09);
        if(vm.canvas) vm.canvas.style.cursor='pointer';
        return;
    }
    if(vm.canvas) vm.canvas.style.cursor=c&&c.locked===false?'grab':'default';
    renderClip(vm.ci, vm.ctx, true);
    // show unlock indicator when clip is unlocked
    if(c&&c.locked===false&&vm.oi<0){
        const ctx=vm.ctx,pad=8,iw=vm.w,ih=vm.h;
        ctx.save();
        ctx.strokeStyle='#22c55e';ctx.lineWidth=Math.max(4,iw*.003);ctx.setLineDash([14,8]);
        ctx.strokeRect(pad,pad,iw-pad*2,ih-pad*2);ctx.setLineDash([]);
        // lock-open badge top-left
        const bs=Math.max(28,iw*.025);
        ctx.fillStyle='rgba(34,197,94,0.85)';rRect(ctx,16,16,bs*2.2,bs*1.1,6);ctx.fill();
        ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(bs*.45)}px sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.fillText('\uD83D\uDD13 '+_t('ve_unlocked_short','잠금 해제'),22,16+bs*.55);
        ctx.restore();
    }
}

function renderClip(ci, ctx, showSel, clipTime) {
    const c = vm.clips[ci]; if(!c) return;
    const a = c.adj;
    ctx.filter=`brightness(${1+a.brightness/100}) contrast(${1+a.contrast/100}) saturate(${a.saturation}%) blur(${a.blur}px) hue-rotate(${a.hue}deg)`;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,vm.w,vm.h);
    const src = c.type==='video' ? c.video : c.img;
    if (src) drawCover(ctx, src, vm.w, vm.h, c.panX||0, c.panY||0, c.imgScale||1);
    ctx.filter='none';
    c.overlays.forEach((o,i) => {
        // check time range (during playback/export)
        if(clipTime!=null && o.tStart!=null && o.tEnd!=null){
            if(clipTime<o.tStart||clipTime>o.tEnd) return;
        }
        renderOverlay(ctx,o); if(showSel&&i===vm.oi) renderSelection(ctx,o);
    });
}

function renderOverlay(ctx, o) {
    ctx.save();
    if(o.rotation){const b=getOBounds(o);if(b){ctx.translate(b.cx,b.cy);ctx.rotate(o.rotation*Math.PI/180);ctx.translate(-b.cx,-b.cy);}}
    switch(o.type) {
        case 'text': {
            const lines=(o.text||'').split('\n'), lh=o.lineHeight||1.2, fs=o.fontSize;
            ctx.font=`${o.bold?'bold ':''} ${fs}px ${o.fontFamily||'sans-serif'}`;
            ctx.textAlign=o.align||'center'; ctx.textBaseline='middle';
            // 배경 박스
            if(o.bgBox){
                const maxW=Math.max(...lines.map(l=>ctx.measureText(l).width));
                const bh=lines.length*fs*lh+fs*0.5, bw=maxW+fs*0.8;
                const bx=o.align==='center'?o.x-bw/2:o.x-fs*0.4, by=o.y-fs*0.6;
                ctx.fillStyle=o.bgColor||'rgba(0,0,0,0.5)';
                rRect(ctx,bx,by,bw,bh,fs*0.2);ctx.fill();
            }
            if(o.shadow){ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=fs*.12;ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;}
            // 외곽선 (stroke)
            if(o.strokeWidth>0){
                ctx.strokeStyle=o.strokeColor||'#000';ctx.lineWidth=o.strokeWidth;ctx.lineJoin='round';
                lines.forEach((l,li)=>ctx.strokeText(l,o.x,o.y+li*fs*lh));
            }
            ctx.fillStyle=o.color||'#fff';
            lines.forEach((l,li)=>ctx.fillText(l,o.x,o.y+li*fs*lh));
            break;
        }
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
    // draw snap guide lines if active
    if(vm.snapLines){
        ctx.strokeStyle='#ff4488';ctx.lineWidth=2;ctx.setLineDash([6,4]);
        if(vm.snapLines.h){ctx.beginPath();ctx.moveTo(0,vm.h/2);ctx.lineTo(vm.w,vm.h/2);ctx.stroke();}
        if(vm.snapLines.v){ctx.beginPath();ctx.moveTo(vm.w/2,0);ctx.lineTo(vm.w/2,vm.h);ctx.stroke();}
        ctx.setLineDash([]);
    }
    ctx.strokeStyle='#00bfff'; ctx.lineWidth=Math.max(3,vm.w*.003); ctx.setLineDash([10,6]);
    ctx.strokeRect(b.bx-6,b.by-6,b.bw+12,b.bh+12);
    const hs=Math.max(16,vm.w*.01); ctx.setLineDash([]);
    // corner handles — white fill with blue border for visibility
    [[b.bx-6,b.by-6],[b.bx+b.bw+6-hs,b.by-6],[b.bx-6,b.by+b.bh+6-hs],[b.bx+b.bw+6-hs,b.by+b.bh+6-hs]].forEach(([hx,hy])=>{
        ctx.fillStyle='#fff'; ctx.fillRect(hx,hy,hs,hs);
        ctx.strokeStyle='#00bfff'; ctx.lineWidth=3; ctx.strokeRect(hx,hy,hs,hs);
    });
    // rotation handle (line + circle above top-center)
    const rhx=b.bx+b.bw/2,rhy=b.by-36;
    ctx.strokeStyle='#00bfff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rhx,b.by-6);ctx.lineTo(rhx,rhy+8);ctx.stroke();
    ctx.beginPath();ctx.arc(rhx,rhy,9,0,Math.PI*2);ctx.fillStyle='#00bfff';ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('↻',rhx,rhy);
    ctx.restore();
}

function drawCover(ctx,src,cw,ch,px,py,sc) {
    const iw=src.videoWidth||src.width, ih=src.videoHeight||src.height;
    if(!iw||!ih) return;
    const ir=iw/ih, cr=cw/ch;
    const s=sc||1;
    if(px||py||s!==1){
        // panned/scaled mode: draw full image scaled to cover, then shift by pan offset and scale
        let dw,dh;
        if(ir>cr){dh=ch;dw=dh*ir;}else{dw=cw;dh=dw/ir;}
        dw*=s; dh*=s;
        const dx=(cw-dw)/2+(px||0), dy=(ch-dh)/2+(py||0);
        ctx.drawImage(src,0,0,iw,ih,dx,dy,dw,dh);
    } else {
        let sw,sh,sx,sy;
        if(ir>cr){sh=ih;sw=sh*cr;sx=(iw-sw)/2;sy=0;}else{sw=iw;sh=sw/cr;sx=0;sy=(ih-sh)/2;}
        ctx.drawImage(src,sx,sy,sw,sh,0,0,cw,ch);
    }
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
        case 'image': renderImageTab(el);break;
        case 'transition': renderTransitionTab(el);break;
        case 'adjust': renderAdjustTab(el);break;
        case 'template': renderTemplateTab(el);break;
        case 'save': renderSaveTab(el);break;
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
            h += `<button class="ve-media-dup" onclick="event.stopPropagation();window._veDuplicateClip(${i})" title="복제" style="position:absolute;top:2px;right:22px;background:rgba(99,102,241,0.8);color:#fff;border:none;border-radius:4px;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-copy"></i></button>`;
            h += `<button class="ve-media-del" onclick="event.stopPropagation();window._veRemoveClip(${i})">×</button>`;
            h += `</div>`;
        });
        h += '</div>';
    } else {
        h += '<p class="ve-empty">이미지 또는 영상을 추가하세요</p>';
    }
    el.innerHTML = h;
}

function filterTagsByCountry(tags) {
    if(!tags) return '';
    const country=(window.SITE_CONFIG&&window.SITE_CONFIG.COUNTRY)||'KR';
    const parts=tags.split(',').map(s=>s.trim()).filter(Boolean);
    const isKo=s=>/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(s);
    const isJa=s=>/[ぁ-んァ-ヶー]/.test(s);
    const isCJK=s=>/[\u4e00-\u9fff]/.test(s);
    const isArabic=s=>/[\u0600-\u06FF]/.test(s);
    let filtered;
    if(country==='KR') filtered=parts.filter(s=>isKo(s));
    else if(country==='JP') filtered=parts.filter(s=>isJa(s)||(!isKo(s)&&isCJK(s)));
    else filtered=parts.filter(s=>!isKo(s)&&!isJa(s)&&!isCJK(s)&&!isArabic(s));
    if(!filtered.length) filtered=parts.slice(0,3);
    return filtered.slice(0,3).join(', ');
}

function renderAudioTab(el) {
    // Audio tab with SFX/BGM sub-tabs
    const isSfx=vm.audioTab==='sfx';
    let h = `<div class="ve-sec"><b>${_t('ve_audio_label','Audio')}</b>`;
    // sub-tabs: SFX vs BGM
    h += `<div style="display:flex;gap:4px;margin:8px 0">`;
    h += `<button class="ve-audio-subtab${isSfx?' active':''}" onclick="window._veAudioTabSwitch('sfx')" style="flex:1;padding:6px 0;border-radius:6px;border:1px solid ${isSfx?'#818cf8':'#333'};background:${isSfx?'rgba(129,140,248,0.15)':'transparent'};color:${isSfx?'#a5b4fc':'#888'};font-size:11px;font-weight:600;cursor:pointer"><i class="fa-solid fa-bell"></i> ${_t('ve_audio_sfx','SFX')}</button>`;
    h += `<button class="ve-audio-subtab${!isSfx?' active':''}" onclick="window._veAudioTabSwitch('bgm')" style="flex:1;padding:6px 0;border-radius:6px;border:1px solid ${!isSfx?'#818cf8':'#333'};background:${!isSfx?'rgba(129,140,248,0.15)':'transparent'};color:${!isSfx?'#a5b4fc':'#888'};font-size:11px;font-weight:600;cursor:pointer"><i class="fa-solid fa-headphones"></i> ${_t('ve_audio_bgm','BGM')}</button>`;
    h += `</div>`;
    // 음원 없음 옵션
    const noSel=vm.music==='none'&&!vm.audioUrl;
    h += `<div class="ve-music-row${noSel?' selected':''}" onclick="window._veSelectMusic('none')">`;
    h += `<i class="fa-solid fa-volume-xmark" style="width:24px;text-align:center;font-size:16px;color:${noSel?'#818cf8':'#6b7280'}"></i>`;
    h += `<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e0e0e8">${_t('ve_audio_none','No audio')}</div></div></div>`;
    h += `<div id="veAudioList"><p class="ve-empty">${_t('ve_audio_loading','Loading...')}</p></div></div>`;
    el.innerHTML = h;
    loadAudioFromDB();
}
window._veAudioTabSwitch=function(tab){
    vm.audioTab=tab;vm.audioPage=0;vm.audioItems=null;
    if(vm.audioEl){vm.audioEl.pause();vm.audioEl=null;vm._previewIdx=-1;}
    refreshLeftPanel();
};

const AUDIO_PAGE_SIZE=20;
async function loadAudioFromDB(page) {
    if(page!==undefined) vm.audioPage=page;
    const pg=vm.audioPage;
    const list=document.getElementById('veAudioList'); if(!list) return;
    list.innerHTML=`<p class="ve-empty">${_t('ve_audio_loading','Loading...')}</p>`;
    const category=vm.audioTab==='bgm'?'bgm':'audio';
    try {
        const sb=window.sb; if(!sb){list.innerHTML=`<p class="ve-empty">${_t('ve_audio_no_conn','No DB connection')}</p>`;return;}
        const from=pg*AUDIO_PAGE_SIZE, to=from+AUDIO_PAGE_SIZE;
        const {data,error}=await sb.from('library').select('id,thumb_url,data_url,tags').eq('category',category).order('created_at',{ascending:false}).range(from,to);
        if(error) throw error;
        const items=data||[];
        vm.audioHasMore=items.length>AUDIO_PAGE_SIZE;
        vm.audioItems=items.slice(0,AUDIO_PAGE_SIZE);
        const emptyLabel=vm.audioTab==='bgm'?_t('ve_audio_no_bgm','No BGM found'):_t('ve_audio_no_result','No audio found');
        if(!vm.audioItems.length&&pg===0){list.innerHTML=`<p class="ve-empty">${emptyLabel}</p>`;return;}
        if(!vm.audioItems.length){vm.audioPage=Math.max(0,pg-1);loadAudioFromDB();return;}
        let h='';
        const icon=vm.audioTab==='bgm'?'fa-headphones':'fa-music';
        vm.audioItems.forEach((a,i)=>{
            const defaultName=vm.audioTab==='bgm'?`BGM ${pg*AUDIO_PAGE_SIZE+i+1}`:`SFX ${pg*AUDIO_PAGE_SIZE+i+1}`;
            const name=filterTagsByCountry(a.tags)||defaultName;
            const sel=vm.audioUrl===a.data_url;
            const playing=vm.audioEl&&!vm.audioEl.paused&&vm._previewIdx===i;
            h+=`<div class="ve-music-row${sel?' selected':''}" onclick="window._veSelectDBAudio(${i})">`;
            h+=`<i class="fa-solid ${icon}" style="width:24px;text-align:center;font-size:14px;color:${sel?'#818cf8':'#6b7280'}"></i>`;
            h+=`<div style="flex:1"><div style="font-size:12px;font-weight:600;color:#e0e0e8">${name}</div><div style="font-size:10px;color:#555">${sel?'✓ '+_t('ve_audio_selected','Selected'):''}</div></div>`;
            h+=`<button class="ve-music-play${playing?' playing':''}" onclick="event.stopPropagation();window._vePreviewDBAudio(${i})">${playing?'<i class="fa-solid fa-stop"></i>':'<i class="fa-solid fa-play"></i>'}</button>`;
            h+=`</div>`;
        });
        if(pg>0||vm.audioHasMore){
            h+=`<div style="display:flex;justify-content:center;gap:8px;margin-top:8px">`;
            if(pg>0) h+=`<button class="ve-page-btn" onclick="window._veAudioPage(${pg-1})"><i class="fa-solid fa-chevron-left"></i> ${_t('ve_audio_prev','Prev')}</button>`;
            h+=`<span style="font-size:11px;color:#888;line-height:28px">${pg+1}</span>`;
            if(vm.audioHasMore) h+=`<button class="ve-page-btn" onclick="window._veAudioPage(${pg+1})">${_t('ve_audio_next','Next')} <i class="fa-solid fa-chevron-right"></i></button>`;
            h+=`</div>`;
        }
        list.innerHTML=h;
    } catch(e){ list.innerHTML=`<p class="ve-empty">${_t('ve_audio_fail','Load failed')}</p>`; console.warn('Audio load error:',e); }
}
window._veAudioPage=function(pg){loadAudioFromDB(pg);};

function _isUrl(s){return s&&typeof s==='string'&&(s.startsWith('http')||s.startsWith('//')||s.startsWith('data:')||s.startsWith('blob:'));}
function getAudioUrl(item){
    if(!item) return '';
    // 1. data_url is a direct URL
    if(_isUrl(item.data_url)) return item.data_url;
    // 2. data_url is fabric.js JSON with embedded audio src (base64)
    if(item.data_url&&typeof item.data_url==='string'&&item.data_url.startsWith('{')){
        try{
            const p=JSON.parse(item.data_url);
            if(p&&p.objects){for(const o of p.objects){if(o.src&&(o.src.startsWith('data:audio')||_isUrl(o.src)))return o.src;}}
        }catch(e){}
    }
    // 3. data_url is parsed JSONB object
    if(item.data_url&&typeof item.data_url==='object'&&item.data_url.objects){
        for(const o of item.data_url.objects){if(o.src&&(o.src.startsWith('data:audio')||_isUrl(o.src)))return o.src;}
    }
    // 4. thumb_url fallback
    if(_isUrl(item.thumb_url)) return item.thumb_url;
    console.warn('No audio URL in item:',item.id);
    return '';
}
window._veSelectDBAudio = function(idx) {
    const a=vm.audioItems&&vm.audioItems[idx]; if(!a) return;
    const url=getAudioUrl(a); if(!url){alert('Invalid audio URL');return;}
    stopMusicPreview();
    if(vm.audioEl){vm.audioEl.pause();vm.audioEl=null;vm._previewIdx=-1;}
    vm.music='none'; vm.audioUrl=url;
    refreshLeftPanel(); updateTimeline();
};
window._vePreviewDBAudio = function(idx) {
    const a=vm.audioItems&&vm.audioItems[idx]; if(!a) return;
    const url=getAudioUrl(a); if(!url){alert('Invalid audio URL');return;}
    stopMusicPreview();
    if(vm.audioEl&&!vm.audioEl.paused&&vm._previewIdx===idx){
        vm.audioEl.pause();vm.audioEl=null;vm._previewIdx=-1;
        refreshLeftPanel(); return;
    }
    if(vm.audioEl){vm.audioEl.pause();vm.audioEl=null;}
    const audio=new Audio(url);
    audio.volume=0.5;
    audio.play().catch(e=>{alert('Audio playback failed: '+e.message);});
    audio.onended=()=>{vm.audioEl=null;vm._previewIdx=-1;refreshLeftPanel();};
    vm.audioEl=audio; vm._previewIdx=idx;
    refreshLeftPanel();
    setTimeout(()=>{if(vm.audioEl===audio){audio.pause();vm.audioEl=null;vm._previewIdx=-1;refreshLeftPanel();}},15000);
};
function stopDBAudio(){if(vm.audioEl){vm.audioEl.pause();vm.audioEl=null;vm._previewIdx=-1;}vm.audioUrl=null;}

function renderTextTab(el) {
    let h = '<div class="ve-sec"><b>텍스트</b>';
    h += `<button class="ve-add-btn" onclick="window._veAddTextCenter()"><i class="fa-solid fa-font"></i> 캔버스에 텍스트 추가</button>`;
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
        // 외곽선
        h += `<div style="display:flex;gap:6px;margin:6px 0;align-items:center"><label style="color:#aaa;font-size:11px;white-space:nowrap">외곽선</label>`;
        h += `<input type="color" value="${expandHex(o.strokeColor||'#000000')}" oninput="window._veUpOL('strokeColor',this.value)" style="width:28px;height:24px;border:none;border-radius:4px;cursor:pointer">`;
        h += `<input type="range" min="0" max="10" value="${o.strokeWidth||0}" oninput="window._veUpOL('strokeWidth',+this.value)" style="flex:1" title="외곽선 두께: ${o.strokeWidth||0}"></div>`;
        // 배경 박스
        h += `<div style="display:flex;gap:6px;margin:4px 0;align-items:center"><label style="flex:1;display:flex;align-items:center;gap:4px;color:#aaa;font-size:11px"><input type="checkbox" ${o.bgBox?'checked':''} onchange="window._veUpOL('bgBox',this.checked)"> 배경 박스</label>`;
        h += `<input type="color" value="${expandHex(o.bgColor||'#000000')}" oninput="window._veUpOL('bgColor',this.value)" style="width:28px;height:24px;border:none;border-radius:4px;cursor:pointer" ${o.bgBox?'':'disabled'}></div>`;
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
    h += '<input class="ve-search-inp" id="veLibSearch" placeholder="검색..." oninput="window._veSearchLib(this.value)">';
    h += '<div id="veLibGrid" class="ve-lib-grid2"><p class="ve-empty" style="grid-column:1/-1">로딩 중...</p></div>';
    h += '<button class="ve-lib-more" onclick="window._veLoadMoreLib()"><i class="fa-solid fa-angles-down"></i> 더 보기</button>';
    h += '</div>';
    el.innerHTML = h;
    loadLibElements();
}

async function loadLibElements(search) {
    const grid=document.getElementById('veLibGrid'); if(!grid) return;
    try {
        const sb=window.sb; if(!sb){grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">DB 연결 없음</p>';return;}
        if(!vm.libItems||search!=null){
            let q=sb.from('library')
                .select('id, thumb_url, data_url, category')
                .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
                .order('created_at', { ascending: false })
                .range(0, 9);
            if(search) q=q.ilike('tags','%'+search+'%');
            const { data, error } = await q;
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
    vm.libItems.forEach((item,idx)=>{
        const url=bestImageUrl(item);
        h+=`<div class="ve-lib-item" onclick="window._veAddLibImage(${idx})"><img src="${url}" loading="lazy"></div>`;
    });
    grid.innerHTML=h;
}

window._veLoadMoreLib = async function() {
    if(!window.sb||!vm.libItems) return;
    const page=vm.libPage||1;
    try {
        const { data, error } = await window.sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
            .order('created_at', { ascending: false })
            .range(page*10, (page+1)*10-1);
        if(!error&&data&&data.length){
            vm.libItems=[...vm.libItems,...data];
            vm.libPage=page+1;
            const grid=document.getElementById('veLibGrid');
            if(grid) renderLibGrid(grid);
        } else { showToast('더 이상 이미지가 없습니다'); }
    } catch(e){ showToast('로드 실패'); }
};
window._veSearchLib = function(q){
    clearTimeout(vm._libSearchTimer);
    vm._libSearchTimer=setTimeout(()=>{vm.libItems=null;loadLibElements(q||null);},400);
};

window._veAddLibImage = function(idx) {
    const c=curClip();
    if(!c) return alert(_t('ve_clip_required','Please add a clip first'));
    const item=vm.libItems&&vm.libItems[idx];
    if(!item) return;
    const url=bestImageUrl(item);
    addOverlay('image', vm.w*.2, vm.h*.2, {url, w:vm.w*.4, h:vm.w*.4});
    showToast('이미지 요소 추가됨');
};

function renderImageTab(el) {
    let h = '<div class="ve-sec"><b>이미지 템플릿</b><p style="font-size:10px;color:#6b7280;margin:0 0 8px">에디터 이미지를 오버레이로 삽입</p>';
    h += '<input class="ve-search-inp" id="veImgSearch" placeholder="검색..." oninput="window._veSearchImg(this.value)">';
    h += '<div id="veImgGrid" class="ve-lib-grid2"><p class="ve-empty" style="grid-column:1/-1">로딩 중...</p></div>';
    h += '<button class="ve-lib-more" onclick="window._veLoadMoreImg()"><i class="fa-solid fa-angles-down"></i> 더 보기</button>';
    h += '</div>';
    el.innerHTML = h;
    loadImageTemplates();
}

async function loadImageTemplates(search) {
    const grid=document.getElementById('veImgGrid'); if(!grid) return;
    try {
        const sb=window.sb; if(!sb){grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">DB 연결 없음</p>';return;}
        if(!vm.imgItems||search!=null){
            let q=sb.from('library')
                .select('id, thumb_url, data_url, category')
                .in('category', ['user_image','photo-bg','text'])
                .order('created_at', { ascending: false })
                .range(0, 9);
            if(search) q=q.ilike('tags','%'+search+'%');
            const { data, error } = await q;
            if(error) throw error;
            vm.imgItems = data || [];
            vm.imgPage = 1;
        }
        renderImgGrid(grid);
    } catch(e) {
        console.warn('Image template load error:', e);
        grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">로드 실패</p>';
    }
}

function renderImgGrid(grid) {
    if(!vm.imgItems||!vm.imgItems.length){grid.innerHTML='<p class="ve-empty" style="grid-column:1/-1">이미지 없음</p>';return;}
    let h='';
    vm.imgItems.forEach((item,idx)=>{
        const url=bestImageUrl(item);
        h+=`<div class="ve-lib-item" onclick="window._veAddImgTemplate(${idx})"><img src="${url}" loading="lazy"></div>`;
    });
    grid.innerHTML=h;
}

window._veLoadMoreImg = async function() {
    if(!window.sb||!vm.imgItems) return;
    const page=vm.imgPage||1;
    try {
        const { data, error } = await window.sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['user_image','photo-bg','text'])
            .order('created_at', { ascending: false })
            .range(page*10, (page+1)*10-1);
        if(!error&&data&&data.length){
            vm.imgItems=[...vm.imgItems,...data];
            vm.imgPage=page+1;
            const grid=document.getElementById('veImgGrid');
            if(grid) renderImgGrid(grid);
        } else { showToast('더 이상 이미지가 없습니다'); }
    } catch(e){ showToast('로드 실패'); }
};
window._veSearchImg = function(q){
    clearTimeout(vm._imgSearchTimer);
    vm._imgSearchTimer=setTimeout(()=>{vm.imgItems=null;loadImageTemplates(q||null);},400);
};

window._veAddImgTemplate = function(idx) {
    const c=curClip();
    if(!c) return alert(_t('ve_clip_required','Please add a clip first'));
    const item=vm.imgItems&&vm.imgItems[idx];
    if(!item) return;
    const url=bestImageUrl(item);
    addOverlay('image', vm.w*.1, vm.h*.1, {url, w:vm.w*.5, h:vm.h*.5});
    showToast('이미지 템플릿 추가됨');
};

function renderTransitionTab(el) {
    const c=curClip(), cur=c?c.transition:'fade';
    let h='<div class="ve-sec"><b>전환 효과</b><div class="ve-trans-grid">';
    TRANSITIONS.forEach(t=>{ h+=`<button class="ve-trans-btn${cur===t.id?' active':''}" onclick="window._veSetTrans('${t.id}')"><div style="color:${t.color};font-size:18px"><i class="fa-solid ${t.icon}"></i></div><span>${t.name}</span></button>`; });
    h+='</div></div>';
    if(c){
        h+='<div class="ve-sec"><b>장면 시간</b>';
        h+=`<label>${c.duration}초</label><input type="range" min="0.5" max="15" step="0.5" value="${c.duration}" oninput="window._veSetDur(+this.value);this.previousElementSibling.textContent=this.value+'초'">`;
        h+='</div>';
        // 속도 제어
        const spd = c.speed || 1.0;
        const spdLabels = {0.25:'0.25x',0.5:'0.5x',0.75:'0.75x',1:'1x (보통)',1.5:'1.5x',2:'2x',3:'3x',4:'4x'};
        h+='<div class="ve-sec"><b>재생 속도</b>';
        h+=`<label>${spdLabels[spd]||spd+'x'}</label><input type="range" min="0.25" max="4" step="0.25" value="${spd}" oninput="window._veSetSpeed(+this.value);this.previousElementSibling.textContent=({0.25:'0.25x',0.5:'0.5x',0.75:'0.75x',1:'1x (보통)',1.5:'1.5x',2:'2x',3:'3x',4:'4x'})[this.value]||this.value+'x'">`;
        h+='</div>';
    }
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
// SAVE / LOAD PROJECT
// ═══════════════════════════════════════════════════════════════
const VE_SAVE_KEY='ve_projects';

function renderSaveTab(el){
    const saves=_veGetSaves();
    // 내보내기 프리셋
    const presets=[
        {fmt:'landscape',icon:'fa-brands fa-youtube',label:'YouTube',res:'1920×1080',color:'#ff0000',tip:'16:9 가로 영상'},
        {fmt:'portrait',icon:'fa-solid fa-mobile-screen',label:'Shorts / TikTok',res:'1080×1920',color:'#25f4ee',tip:'9:16 세로 영상'},
        {fmt:'square',icon:'fa-brands fa-instagram',label:'Instagram',res:'1080×1080',color:'#e1306c',tip:'1:1 정사각형'},
        {fmt:'landscape',icon:'fa-solid fa-display',label:'프레젠테이션',res:'1920×1080',color:'#4285f4',tip:'16:9 HD'},
    ];
    const curFmt=vm.format;
    let h='<div class="ve-sec"><b>내보내기 프리셋</b>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px">';
    presets.forEach(p=>{
        const active=p.fmt===curFmt;
        h+=`<button onclick="window._veApplyPreset('${p.fmt}')" style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:8px;border:2px solid ${active?p.color:'#333'};background:${active?p.color+'18':'#1a1a2e'};cursor:pointer;text-align:left;transition:.2s">`;
        h+=`<i class="${p.icon}" style="font-size:18px;color:${p.color}"></i>`;
        h+=`<div><div style="font-size:11px;font-weight:600;color:#e0e0e8">${p.label}</div>`;
        h+=`<div style="font-size:9px;color:#888">${p.res}</div></div>`;
        if(active) h+=`<i class="fa-solid fa-check" style="margin-left:auto;color:${p.color};font-size:12px"></i>`;
        h+=`</button>`;
    });
    h+='</div>';
    const curF=FORMATS.find(x=>x.id===curFmt)||FORMATS[0];
    h+=`<div style="margin-top:6px;padding:6px 8px;background:#111827;border-radius:6px;font-size:10px;color:#9ca3af"><i class="fa-solid fa-circle-info"></i> 현재: <b style="color:#e0e0e8">${curF.name} ${curF.w}×${curF.h}</b> · WebM VP9 · 5Mbps</div>`;
    h+='</div>';
    h+='<div class="ve-sec"><b>프로젝트 저장</b>';
    h+=`<input class="ve-inp" id="veSaveName" placeholder="프로젝트 이름" value="프로젝트 ${saves.length+1}">`;
    h+=`<button class="ve-add-btn" onclick="window._veSaveProject()"><i class="fa-solid fa-floppy-disk"></i> 저장</button>`;
    h+='</div>';
    h+='<div class="ve-sec"><b>저장된 프로젝트</b>';
    if(!saves.length){
        h+='<p class="ve-empty">저장된 프로젝트 없음</p>';
    } else {
        saves.forEach((s,i)=>{
            const date=new Date(s.savedAt).toLocaleString();
            const clipCount=s.clips?s.clips.length:0;
            h+=`<div class="ve-save-row">`;
            h+=`<div style="flex:1;min-width:0">`;
            h+=`<div style="font-size:12px;font-weight:600;color:#e0e0e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name||'Untitled'}</div>`;
            h+=`<div style="font-size:10px;color:#6b7280">${date} · ${clipCount} clips · ${s.format||'landscape'}</div>`;
            h+=`</div>`;
            h+=`<button class="ve-save-load" onclick="window._veLoadProject(${i})" title="불러오기"><i class="fa-solid fa-folder-open"></i></button>`;
            h+=`<button class="ve-save-del" onclick="window._veDeleteProject(${i})" title="삭제"><i class="fa-solid fa-trash"></i></button>`;
            h+=`</div>`;
        });
    }
    h+='</div>';
    el.innerHTML=h;
}

function _veGetSaves(){
    try{return JSON.parse(localStorage.getItem(VE_SAVE_KEY)||'[]');}catch(e){return [];}
}

function _clipToDataUrl(clip){
    return new Promise(resolve=>{
        if(clip.type==='image'){
            const c=document.createElement('canvas');
            c.width=clip.img.naturalWidth||clip.img.width;
            c.height=clip.img.naturalHeight||clip.img.height;
            c.getContext('2d').drawImage(clip.img,0,0);
            try{resolve(c.toDataURL('image/jpeg',0.85));}catch(e){resolve(clip.thumbUrl||'');}
        } else if(clip.type==='video'){
            // video: save thumbnail only, mark needs re-import
            resolve(clip.thumbUrl||'');
        } else resolve('');
    });
}

window._veSaveProject = async function(){
    const nameEl=document.getElementById('veSaveName');
    const name=(nameEl&&nameEl.value)||'Untitled';
    showToast('저장 중...');
    const clipData=[];
    for(const c of vm.clips){
        const dataUrl=await _clipToDataUrl(c);
        const overlays=c.overlays.map(o=>{
            const oc={...o};
            if(oc._imgEl) delete oc._imgEl;
            if(oc.imgSrc) oc.imgSrc=oc.imgSrc; // keep image overlay src
            return oc;
        });
        clipData.push({
            type:c.type,
            dataUrl,
            thumbUrl:c.thumbUrl||'',
            duration:c.duration,
            overlays,
            adj:c.adj,
            transition:c.transition,
            videoNeedsReimport:c.type==='video'
        });
    }
    const project={
        name,
        savedAt:Date.now(),
        format:vm.format,
        w:vm.w, h:vm.h,
        music:vm.music,
        audioUrl:vm.audioUrl,
        clips:clipData
    };
    const saves=_veGetSaves();
    saves.unshift(project);
    // keep max 10 projects
    if(saves.length>10) saves.length=10;
    try{
        localStorage.setItem(VE_SAVE_KEY,JSON.stringify(saves));
        showToast('저장 완료: '+name);
    }catch(e){
        if(e.name==='QuotaExceededError'){
            // try saving without full image data
            clipData.forEach(c=>{c.dataUrl=c.thumbUrl;});
            project.clips=clipData;
            saves[0]=project;
            try{localStorage.setItem(VE_SAVE_KEY,JSON.stringify(saves));showToast('저장 완료 (썸네일)');}
            catch(e2){alert('저장 실패: 용량 초과');}
        } else alert('저장 실패: '+e.message);
    }
    refreshLeftPanel();
};

window._veLoadProject = function(idx){
    const saves=_veGetSaves();
    const p=saves[idx]; if(!p) return;
    if(vm.clips.length&&!confirm('현재 프로젝트를 덮어쓸까요?')) return;
    // cleanup current
    vm.clips.forEach(c=>{try{URL.revokeObjectURL(c.url);}catch(e){}});
    vm.clips=[];vm.ci=0;vm.oi=-1;
    // restore format
    vm.format=p.format||'landscape';
    const f=FORMATS.find(x=>x.id===vm.format)||FORMATS[0];
    vm.w=p.w||f.w; vm.h=p.h||f.h;
    const cvs=document.getElementById('veCanvas');
    if(cvs){cvs.width=vm.w;cvs.height=vm.h;vm.ctx=cvs.getContext('2d');}
    // restore audio
    vm.music=p.music||'none';
    vm.audioUrl=p.audioUrl||null;
    // restore clips
    let loaded=0;
    const total=p.clips?p.clips.length:0;
    if(!total){updateAll();render();refreshLeftPanel();return;}
    p.clips.forEach((cd,ci)=>{
        if(cd.type==='video'&&cd.videoNeedsReimport){
            // video placeholder
            const img=new Image(); img.src=cd.thumbUrl||'';
            img.onload=img.onerror=()=>{
                vm.clips[ci]={type:'image',url:'',img,thumbUrl:cd.thumbUrl||'',
                    duration:cd.duration||3,overlays:cd.overlays||[],adj:cd.adj||{},transition:cd.transition||'fade',
                    _videoPlaceholder:true};
                _restoreOverlayImages(vm.clips[ci]);
                if(++loaded>=total){selectClip(0);updateAll();render();updateFormatBtns();}
            };
        } else {
            const img=new Image();
            img.onload=img.onerror=()=>{
                vm.clips[ci]={type:'image',url:cd.dataUrl||'',img,thumbUrl:cd.thumbUrl||'',
                    duration:cd.duration||3,overlays:cd.overlays||[],adj:cd.adj||{},transition:cd.transition||'fade'};
                _restoreOverlayImages(vm.clips[ci]);
                if(++loaded>=total){selectClip(0);updateAll();render();updateFormatBtns();}
            };
            img.src=cd.dataUrl||cd.thumbUrl||'';
        }
    });
    showToast('불러옴: '+p.name);
    vm.leftTab='media';
};

function _restoreOverlayImages(clip){
    clip.overlays.forEach(o=>{
        if(o.type==='image'&&o.imgSrc){
            const im=new Image();im.src=o.imgSrc;
            im.onload=()=>{o._imgEl=im;render();};
        }
    });
}

window._veDeleteProject = function(idx){
    if(!confirm('삭제할까요?')) return;
    const saves=_veGetSaves();
    saves.splice(idx,1);
    localStorage.setItem(VE_SAVE_KEY,JSON.stringify(saves));
    refreshLeftPanel();
};

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
        // time range
        const ts=o.tStart!=null?o.tStart:0, te=o.tEnd!=null?o.tEnd:c.duration;
        h+=`<label>시작 ${ts.toFixed(1)}초</label><input type="range" min="0" max="${c.duration}" step="0.1" value="${ts}" oninput="window._veUpOL('tStart',+this.value);this.previousElementSibling.textContent='시작 '+(+this.value).toFixed(1)+'초';window._veRefreshTL()">`;
        h+=`<label>끝 ${te.toFixed(1)}초</label><input type="range" min="0" max="${c.duration}" step="0.1" value="${te}" oninput="window._veUpOL('tEnd',+this.value);this.previousElementSibling.textContent='끝 '+(+this.value).toFixed(1)+'초';window._veRefreshTL()">`;
        h+=`<button class="ve-del-btn" onclick="window._veRemoveOL()"><i class="fa-solid fa-trash"></i> 삭제</button></div>`;
    } else {
        h+='<div class="ve-sec"><b>클립 속성</b>';
        h+=`<label>타입: ${c.type==='video'?'영상':'이미지'}</label>`;
        h+=`<label>시간: ${c.duration}초</label><input type="range" min="0.5" max="15" step="0.5" value="${c.duration}" oninput="window._veSetDur(+this.value);updateTimeline()">`;
        h+=`<label>전환: ${(TRANSITIONS.find(t=>t.id===c.transition)||{}).name||'없음'}</label>`;
        h+='</div>';
        // lock/unlock + position
        const isLocked=c.locked!==false;
        h+='<div class="ve-sec"><b>위치</b>';
        h+=`<button class="ve-lock-btn" onclick="window._veToggleLock()" style="width:100%;padding:8px;border-radius:8px;border:1px solid ${isLocked?'#ef4444':'#22c55e'};background:${isLocked?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)'};color:${isLocked?'#f87171':'#4ade80'};font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">`;
        h+=`<i class="fa-solid ${isLocked?'fa-lock':'fa-lock-open'}"></i> ${isLocked?_t('ve_locked','잠김 — 클릭하여 잠금 해제'):_t('ve_unlocked','잠금 해제됨 — 드래그로 이동 가능')}</button>`;
        if(!isLocked){
            const sc=c.imgScale||1;
            h+=`<label style="margin-top:8px">${_t('ve_scale','크기')} ${Math.round(sc*100)}%</label>`;
            h+=`<input type="range" min="30" max="300" value="${Math.round(sc*100)}" oninput="window._veSetScale(+this.value/100);this.previousElementSibling.textContent='${_t('ve_scale','크기')} '+this.value+'%'" style="width:100%">`;
            h+=`<div style="margin-top:6px;font-size:11px;color:#94a3b8">X: ${Math.round(c.panX||0)}px, Y: ${Math.round(c.panY||0)}px</div>`;
            h+=`<button class="ve-reset-btn" onclick="window._veResetPan()" style="margin-top:6px;width:100%;padding:6px;border-radius:6px;border:1px solid #475569;background:transparent;color:#94a3b8;font-size:11px;cursor:pointer"><i class="fa-solid fa-crosshairs"></i> ${_t('ve_reset_pos','위치/크기 초기화')}</button>`;
        }
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
    renderRuler(); renderVideoTrack(); renderTextTrack(); renderElementTrack(); renderAudioTrack(); updatePlayhead();
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
    const pps=TL_PPS*vm.tlZoom;
    vm.clips.forEach((c,i)=>{
        const d=document.createElement('div'); d.className='ve-tl-clip'+(i===vm.ci?' active':'');
        d.style.width=(c.duration*pps)+'px'; d.style.position='relative';
        d.innerHTML=`<img src="${c.thumbUrl}"><span class="ve-tl-clip-dur">${fmtTime(c.duration)}</span>`
            +`<span class="ve-tl-ol-grip right" data-ci="${i}"></span>`;
        d.onclick=(e)=>{if(e.target.classList.contains('ve-tl-ol-grip'))return;selectClip(i);};
        // smooth mousedown drag reorder
        d.addEventListener('mousedown',function(e){
            if(e.target.classList.contains('ve-tl-ol-grip')||e.button!==0) return;
            e.stopPropagation();
            const startX=e.clientX;let moved=false;
            const ghost=d.cloneNode(true);
            ghost.style.cssText='position:fixed;pointer-events:none;opacity:0.7;z-index:999999;height:34px;'+d.style.cssText;
            const rect=d.getBoundingClientRect();
            ghost.style.top=rect.top+'px';ghost.style.left=rect.left+'px';ghost.style.width=rect.width+'px';
            function mv(ev){
                const dx=Math.abs(ev.clientX-startX);
                if(!moved&&dx<5) return;
                if(!moved){moved=true;document.body.appendChild(ghost);d.style.opacity='0.3';}
                ghost.style.left=(ev.clientX-rect.width/2)+'px';
                // find drop target
                const scrollRect=el.getBoundingClientRect();
                const relX=ev.clientX-scrollRect.left+el.parentElement.parentElement.scrollLeft;
                let acc=0,target=vm.clips.length;
                for(let j=0;j<vm.clips.length;j++){
                    const mid=acc+vm.clips[j].duration*pps/2;
                    if(relX<mid){target=j;break;}
                    acc+=vm.clips[j].duration*pps;
                }
                // show insert indicator
                el.querySelectorAll('.ve-tl-insert').forEach(x=>x.remove());
                const ins=document.createElement('div');ins.className='ve-tl-insert';
                let insLeft=0;for(let j=0;j<target;j++)insLeft+=vm.clips[j].duration*pps;
                ins.style.cssText=`position:absolute;left:${insLeft-1}px;top:0;width:2px;height:100%;background:#818cf8;z-index:5;pointer-events:none;`;
                el.appendChild(ins);
                vm._dragTarget=target;
            }
            function up(){
                document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
                if(moved){
                    ghost.remove();d.style.opacity='';
                    el.querySelectorAll('.ve-tl-insert').forEach(x=>x.remove());
                    const to=vm._dragTarget; delete vm._dragTarget;
                    if(to!==undefined&&to!==i&&to!==i+1){
                        const[mv2]=vm.clips.splice(i,1);
                        const idx=to>i?to-1:to;
                        vm.clips.splice(idx,0,mv2);vm.ci=idx;
                        updateAll();render();
                    }
                }
            }
            document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
        });
        el.appendChild(d);
        // right grip: resize clip duration
        const grip=d.querySelector('.ve-tl-ol-grip.right');
        if(grip) grip.addEventListener('mousedown',function(e){
            e.stopPropagation();
            const startX=e.clientX, origDur=c.duration;
            function mv(ev){
                const dx=ev.clientX-startX;
                c.duration=Math.max(0.5,Math.round((origDur+dx/pps)*10)/10);
                c.overlays.forEach(o=>{if(o.tEnd!=null&&o.tEnd>c.duration)o.tEnd=c.duration;});
                renderVideoTrack(); renderRuler(); renderTextTrack(); renderElementTrack(); updatePlayhead(); refreshRightPanel();
            }
            function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);}
            document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
        });
    });
}

function renderAudioTrack() {
    const el=document.getElementById('veTlAudio'); if(!el) return;
    const td=totalDur()||10; el.style.width=(td*TL_PPS*vm.tlZoom)+'px';
    if(vm.audioUrl){
        const a=vm.audioItems&&vm.audioItems.find(x=>getAudioUrl(x)===vm.audioUrl);
        el.innerHTML=`<div class="ve-tl-audio-clip" style="width:100%"><i class="fa-solid fa-music"></i> ${a?filterTagsByCountry(a.tags):_t('ve_audio_label','Audio')}</div>`;
        return;
    }
    if(vm.music==='none'){el.innerHTML='<div class="ve-tl-audio-empty">오디오 탭에서 음악을 선택하세요</div>';return;}
    const m=MUSIC.find(x=>x.id===vm.music);
    el.innerHTML=`<div class="ve-tl-audio-clip" style="width:100%"><i class="fa-solid fa-music"></i> ${m?m.name:vm.music}</div>`;
}

// shared overlay item rendering for text and element tracks
function _renderOlItems(el, filterFn){
    const td=totalDur()||10; el.style.width=(td*TL_PPS*vm.tlZoom)+'px'; el.innerHTML='';
    let hasAny=false;
    const pps=TL_PPS*vm.tlZoom;
    vm.clips.forEach((c,ci)=>{
        const cStartPx=clipStart(ci)*pps;
        c.overlays.forEach((o,oi)=>{
            if(!filterFn(o)) return;
            hasAny=true;
            if(o.tStart==null) o.tStart=0;
            if(o.tEnd==null) o.tEnd=c.duration;
            const leftPx=cStartPx+o.tStart*pps;
            const widPx=Math.max(20,(o.tEnd-o.tStart)*pps);
            const d=document.createElement('div');
            d.className=`ve-tl-ol-item type-${o.type}${ci===vm.ci&&oi===vm.oi?' active':''}`;
            d.style.position='absolute';d.style.left=leftPx+'px';d.style.width=widPx+'px';
            const icon=o.type==='text'?'fa-font':o.type==='rect'?'fa-square':o.type==='circle'?'fa-circle':o.type==='image'?'fa-image':'fa-star';
            const nm=o.type==='text'?(o.text||'T').substring(0,8):o.type==='sticker'?o.emoji:o.type==='image'?'IMG':o.type;
            d.innerHTML=`<span class="ve-tl-ol-grip left"></span>`
                +`<i class="fa-solid ${icon}" style="font-size:8px"></i> ${nm}`
                +`<span class="ve-tl-ol-grip right"></span>`;
            d.onclick=(e)=>{if(e.target.classList.contains('ve-tl-ol-grip'))return;e.stopPropagation();vm.ci=ci;vm.oi=oi;render();updateAll();};
            // smooth drag move
            d.addEventListener('mousedown',function(e){
                if(e.target.classList.contains('ve-tl-ol-grip')||e.button!==0) return;
                e.stopPropagation();
                const startX=e.clientX, origTS=o.tStart, origTE=o.tEnd, dur=origTE-origTS;
                function mv(ev){
                    const dx=ev.clientX-startX, dt=dx/pps;
                    let ns=Math.max(0,origTS+dt);
                    if(ns+dur>c.duration) ns=c.duration-dur;
                    o.tStart=Math.round(ns*20)/20;
                    o.tEnd=Math.round((o.tStart+dur)*20)/20;
                    d.style.left=(cStartPx+o.tStart*pps)+'px';
                }
                function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);}
                document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
            });
            el.appendChild(d);
            // edge grips
            const grips=d.querySelectorAll('.ve-tl-ol-grip');
            grips[0]&&grips[0].addEventListener('mousedown',function(e){
                e.stopPropagation();const startX=e.clientX,origTS=o.tStart;
                function mv(ev){const dx=ev.clientX-startX;o.tStart=Math.max(0,Math.min(o.tEnd-0.1,Math.round((origTS+dx/pps)*20)/20));d.style.left=(cStartPx+o.tStart*pps)+'px';d.style.width=Math.max(20,(o.tEnd-o.tStart)*pps)+'px';}
                function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);updateAll();}
                document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
            });
            grips[1]&&grips[1].addEventListener('mousedown',function(e){
                e.stopPropagation();const startX=e.clientX,origTE=o.tEnd;
                function mv(ev){const dx=ev.clientX-startX;o.tEnd=Math.max(o.tStart+0.1,Math.min(c.duration,Math.round((origTE+dx/pps)*20)/20));d.style.width=Math.max(20,(o.tEnd-o.tStart)*pps)+'px';}
                function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);updateAll();}
                document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
            });
        });
    });
    return hasAny;
}

function renderTextTrack(){
    const el=document.getElementById('veTlText'); if(!el) return;
    const has=_renderOlItems(el, o=>o.type==='text');
    if(!has) el.innerHTML=`<div class="ve-tl-overlay-empty"><i class="fa-solid fa-font" style="opacity:.3"></i></div>`;
}

function renderElementTrack(){
    const el=document.getElementById('veTlElement'); if(!el) return;
    const has=_renderOlItems(el, o=>o.type!=='text');
    if(!has) el.innerHTML=`<div class="ve-tl-overlay-empty"><i class="fa-solid fa-shapes" style="opacity:.3"></i></div>`;
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
window._veDuplicateClip = duplicateClip;
window._veSelectOL = selectOverlay;
window._veRemoveOL = () => removeOverlay(vm.oi);
window._veStartAdd = (mode) => { vm.addMode=mode; vm.canvas.style.cursor='crosshair'; showToast('캔버스를 클릭하여 배치'); };
window._veAddTextCenter = () => {
    const c=curClip(); if(!c) return alert(_t('ve_clip_required','Please add a clip first'));
    addOverlay('text', vm.w/2, vm.h/2); vm.leftTab='text'; refreshLeftPanel();
};
window._vePickSticker = (e) => { vm.addSticker=e; refreshLeftPanel(); };
window._veUpOL = (p,v) => { const c=curClip(); if(c&&vm.oi>=0&&c.overlays[vm.oi]){c.overlays[vm.oi][p]=v;render();} };
window._veSelectMusic = (id) => { stopDBAudio(); vm.audioUrl=null; vm.music=id; refreshLeftPanel(); updateTimeline(); };
window._vePreviewMusic = (id) => { vm.musicPlaying===id ? stopMusicPreview() : playMusicPreview(id); };
window._veSetTrans = (id) => { const c=curClip(); if(c){c.transition=id;refreshLeftPanel();updateTimeline();} };
window._veSetDur = (v) => { const c=curClip(); if(c){c.duration=v;updateTimeline();refreshRightPanel();} };
window._veSetSpeed = (v) => { const c=curClip(); if(c){c.speed=v;if(c.type==='video'&&c.video)c.video.playbackRate=v;refreshLeftPanel();} };
window._veAdj = (p,v) => { const c=curClip(); if(c){c.adj[p]=v;render();} };
window._veResetAdj = () => { const c=curClip(); if(c){c.adj={brightness:0,contrast:0,saturation:100,blur:0,hue:0};render();refreshLeftPanel();refreshRightPanel();} };
window._veToggleLock = () => { const c=curClip(); if(!c)return; c.locked=c.locked===false?true:false; render();refreshRightPanel(); };
window._veResetPan = () => { const c=curClip(); if(!c)return; c.panX=0;c.panY=0;c.imgScale=1; render();refreshRightPanel(); };
window._veSetScale = (v) => { const c=curClip(); if(!c)return; c.imgScale=Math.max(0.3,Math.min(3,v)); render();refreshRightPanel(); };
// ── Context Menu (z-order, copy, paste, delete) ──
window._veCtx = (action) => {
    const cm=document.getElementById('veContextMenu'); if(cm) cm.style.display='none';
    const c=curClip(); if(!c) return;
    const ols=c.overlays, i=vm.oi;
    if(action==='copy'){
        if(i>=0&&ols[i]) vm.clipboard=JSON.parse(JSON.stringify(ols[i]));
        showToast('복사됨'); return;
    }
    if(action==='paste'){
        if(!vm.clipboard) return showToast('복사된 요소 없음');
        const no=JSON.parse(JSON.stringify(vm.clipboard));
        no.x+=30;no.y+=30; // offset
        if(no.type==='image'){const img=new Image();img.src=no.url||'';no.img=img;img.onload=()=>render();}
        ols.push(no); vm.oi=ols.length-1; render();updateAll(); showToast('붙여넣기 완료'); return;
    }
    if(i<0) return;
    if(action==='delete'){ removeOverlay(i); showToast('삭제됨'); return; }
    if(action==='front'){ const [o]=ols.splice(i,1); ols.push(o); vm.oi=ols.length-1; }
    else if(action==='back'){ const [o]=ols.splice(i,1); ols.unshift(o); vm.oi=0; }
    else if(action==='forward'&&i<ols.length-1){ [ols[i],ols[i+1]]=[ols[i+1],ols[i]]; vm.oi=i+1; }
    else if(action==='backward'&&i>0){ [ols[i],ols[i-1]]=[ols[i-1],ols[i]]; vm.oi=i-1; }
    render();updateAll();
};

window._veApplyTpl = (id) => {
    const c=curClip(); if(!c)return alert(_t('ve_clip_required','Please add a clip first'));
    const t=TEMPLATES.find(x=>x.id===id); if(!t)return;
    t.mk(vm.w,vm.h).forEach(o=>c.overlays.push(o));
    vm.oi=c.overlays.length-1; render(); vm.leftTab='text'; refreshLeftPanel();
};
window._veSetTab = (tab) => { vm.leftTab=tab; refreshLeftPanel(); };
window._veRefreshTL = () => updateTimeline();
window._veChangeFormat = (fmtId) => {
    const f=FORMATS.find(x=>x.id===fmtId); if(!f) return;
    vm.format=f.id; vm.w=f.w; vm.h=f.h;
    if(vm.canvas){vm.canvas.width=vm.w;vm.canvas.height=vm.h;vm.ctx=vm.canvas.getContext('2d');}
    render(); updateAll();
};
window._veApplyPreset = (fmtId) => {
    window._veChangeFormat(fmtId);
    updateFormatBtns();
    refreshLeftPanel();
    showToast(`프리셋 적용: ${(FORMATS.find(x=>x.id===fmtId)||{}).name||fmtId}`);
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
function isImageUrl(s){if(!s||typeof s!=='string')return false;const t=s.trim();return t.startsWith('http')||t.startsWith('//')||t.startsWith('data:')||t.startsWith('blob:');}
// Extract best image URL from a library item (handles fabric.js JSON in data_url)
function bestImageUrl(item){
    if(!item) return '';
    // 1. data_url is a direct image URL → use it
    if(isImageUrl(item.data_url)) return item.data_url;
    // 2. data_url is fabric.js JSON → try to extract embedded image src
    if(item.data_url && typeof item.data_url==='string'){
        try {
            const parsed=JSON.parse(item.data_url);
            // fabric.js JSON with objects array
            if(parsed&&parsed.objects){
                for(const obj of parsed.objects){
                    if(obj.type==='image'&&obj.src&&isImageUrl(obj.src)) return obj.src;
                }
            }
            // might be a JSON-encoded URL string
            if(typeof parsed==='string'&&isImageUrl(parsed)) return parsed;
        } catch(e){}
    }
    // 3. data_url is a JS object (JSONB from Supabase)
    if(item.data_url && typeof item.data_url==='object'){
        const d=item.data_url;
        if(d.objects){
            for(const obj of d.objects){
                if(obj.type==='image'&&obj.src&&isImageUrl(obj.src)) return obj.src;
            }
        }
    }
    // 4. Fallback to thumb_url
    return item.thumb_url||'';
}

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
                case 'slideDown': drawCoverAt(ctx,fromSrc,0,vm.h*t,vm.w,vm.h);applyAdj(ctx,toAdj);drawCoverAt(ctx,toSrc,0,-vm.h*(1-t),vm.w,vm.h);ctx.filter='none';break;
                case 'flipH': ctx.save();ctx.globalAlpha=1-t;ctx.translate(vm.w/2,0);ctx.scale(1-t*2,1);ctx.translate(-vm.w/2,0);drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.globalAlpha=t;ctx.translate(vm.w/2,0);ctx.scale(t*2-1>0?t*2-1:0.01,1);ctx.translate(-vm.w/2,0);applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();ctx.globalAlpha=1;break;
                case 'spin': ctx.save();ctx.globalAlpha=1-t;ctx.translate(vm.w/2,vm.h/2);ctx.rotate(t*Math.PI);ctx.scale(1-t,1-t);ctx.translate(-vm.w/2,-vm.h/2);drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.globalAlpha=t;ctx.translate(vm.w/2,vm.h/2);ctx.rotate((1-t)*-Math.PI);ctx.scale(t,t);ctx.translate(-vm.w/2,-vm.h/2);applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();ctx.globalAlpha=1;break;
                case 'blur': ctx.save();ctx.filter='blur('+Math.round((1-t)*20)+'px)';ctx.globalAlpha=1-t;drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.filter='blur('+Math.round(t<0.5?(0.5-t)*20:0)+'px)';ctx.globalAlpha=t;applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();ctx.globalAlpha=1;break;
                case 'crossZoom': ctx.save();ctx.globalAlpha=1-t;var cz=1+t*0.5;ctx.translate(vm.w/2,vm.h/2);ctx.scale(cz,cz);ctx.translate(-vm.w/2,-vm.h/2);drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.globalAlpha=t;var cz2=1.5-t*0.5;ctx.translate(vm.w/2,vm.h/2);ctx.scale(cz2,cz2);ctx.translate(-vm.w/2,-vm.h/2);applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();ctx.globalAlpha=1;break;
                case 'split': var hw=vm.w/2;drawCover(ctx,fromSrc,vm.w,vm.h);ctx.save();ctx.beginPath();ctx.rect(0,0,hw*(1-t),vm.h);ctx.rect(hw+hw*t,0,hw*(1-t),vm.h);ctx.clip();drawCover(ctx,fromSrc,vm.w,vm.h);ctx.restore();ctx.save();ctx.beginPath();ctx.rect(hw*(1-t),0,vm.w*t,vm.h);ctx.clip();applyAdj(ctx,toAdj);drawCover(ctx,toSrc,vm.w,vm.h);ctx.filter='none';ctx.restore();break;
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
            drawCover(ctx,src,vm.w,vm.h,c.panX||0,c.panY||0,c.imgScale||1);ctx.filter='none';
            const ct=elapsed/1000;
            c.overlays.forEach(o=>{if(o.tStart!=null&&o.tEnd!=null&&(ct<o.tStart||ct>o.tEnd))return;renderOverlay(ctx,o);});
            if(elapsed>=durMs){if(c.type==='video')c.video.pause();resolve();}
            else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
}

window.vePlay = async function() {
    if(!vm.clips.length)return alert(_t('ve_clip_required','Please add a clip first'));
    if(vm.playing){vm.cancel=true;return;}
    vm.playing=true;vm.paused=false;vm.cancel=false;vm.playTime=0;
    const btn=document.getElementById('vePlayBtn');
    if(btn)btn.innerHTML='<i class="fa-solid fa-stop"></i>';
    if(vm.audioUrl){const a=new Audio(vm.audioUrl);a.volume=0.5;a.loop=true;a.play().catch(()=>{});vm.audioEl=a;}else{playMusicPreview(vm.music);}
    for(let i=0;i<vm.clips.length;i++){
        if(vm.cancel)break;
        vm.ci=i;vm.oi=-1;
        const c=vm.clips[i],dur=clipEffDur(c)*1000,transMs=800;
        if(c.type==='video'&&c.video) c.video.playbackRate=c.speed||1;
        if(i>0&&c.transition!=='none'){
            const prevSrc=vm.clips[i-1].type==='video'?vm.clips[i-1].video:vm.clips[i-1].img;
            await animateTransition(prevSrc,c,c.transition,transMs);
            c.overlays.forEach(o=>renderOverlay(vm.ctx,o));
            await playClipOnCanvas(i,dur-transMs);
        } else {
            await playClipOnCanvas(i,dur);
        }
    }
    stopMusicPreview();if(vm.audioEl){vm.audioEl.pause();vm.audioEl=null;}vm.playing=false;vm.paused=false;vm.cancel=false;
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
    if(!vm.clips.length)return alert(_t('ve_clip_required','Please add a clip first'));
    if(vm.playing)return;
    vm.playing=true;vm.cancel=false;vm.playTime=0;
    const prog=document.getElementById('veProgress'),progBar=document.getElementById('veProgressBar'),progText=document.getElementById('veProgressText');
    const expBtn=document.getElementById('veExportBtn'),dlBtn=document.getElementById('veDlBtn');
    if(prog)prog.style.display='block';if(dlBtn)dlBtn.style.display='none';
    if(expBtn){expBtn.disabled=true;expBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> 생성 중...';}
    const fps=30; let totalMs=0; vm.clips.forEach(c=>totalMs+=clipEffDur(c)*1000);
    const canvasStream=vm.canvas.captureStream(fps);
    // 오디오 스트림: Supabase 음원 또는 내장 음악
    let audioResult=null;
    if(vm.audioUrl){audioResult=await createAudioFileStream(vm.audioUrl);}
    else{const ms=await createMusicStream(vm.music,totalMs);if(ms)audioResult={stream:ms,source:null};}
    let combined=audioResult&&audioResult.stream?new MediaStream([...canvasStream.getVideoTracks(),...audioResult.stream.getAudioTracks()]):canvasStream;
    const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
    const rec=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:5000000});
    const chunks=[];rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    // render first frame BEFORE starting recorder to avoid blank start
    renderClip(0,vm.ctx,false);
    await sleep(100); // let canvas paint
    rec.start();
    await sleep(200); // warmup: let recorder capture the pre-rendered frame
    for(let i=0;i<vm.clips.length;i++){
        const pct=Math.round(i/vm.clips.length*100);if(progBar)progBar.style.width=pct+'%';if(progText)progText.textContent=`${i+1}/${vm.clips.length}`;
        const c=vm.clips[i],dur=clipEffDur(c)*1000;
        if(c.type==='video'&&c.video) c.video.playbackRate=c.speed||1;
        if(i>0&&c.transition!=='none'){const ps=vm.clips[i-1].type==='video'?vm.clips[i-1].video:vm.clips[i-1].img;await animateTransition(ps,c,c.transition,800);await playClipOnCanvas(i,dur-800);}
        else{await playClipOnCanvas(i,i===0?dur-200:dur);} // use rAF loop so video frames render continuously
    }
    if(progBar)progBar.style.width='100%';if(progText)progText.textContent='인코딩 중...';
    // stop audio source if playing
    if(audioResult&&audioResult.source){try{audioResult.source.stop();}catch(e){}}
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
        cvs.addEventListener('contextmenu',onRightClick);
        cvs.addEventListener('touchstart',e=>{e.preventDefault();onDown(e.touches[0]);},{passive:false});
        cvs.addEventListener('touchmove',e=>{e.preventDefault();onMove(e.touches[0]);},{passive:false});
        cvs.addEventListener('touchend',onUp);
        // mouse wheel zoom on canvas
        const centerEl=document.querySelector('.ve-center');
        if(centerEl){
            centerEl.addEventListener('wheel',e=>{
                e.preventDefault();
                const delta=e.deltaY>0?-0.1:0.1;
                vm.canvasZoom=Math.min(3,Math.max(0.3,vm.canvasZoom+delta));
                cvs.style.transform=`scale(${vm.canvasZoom})`;
                cvs.style.transformOrigin='center center';
                if(vm.canvasZoom!==1){centerEl.style.overflow='auto';}
                else{centerEl.style.overflow='hidden';}
            },{passive:false});
        }
    }
    // tabs
    document.querySelectorAll('.ve-ltab').forEach(b=>b.addEventListener('click',()=>{vm.leftTab=b.dataset.tab;refreshLeftPanel();}));
    document.querySelectorAll('.ve-fmt-btn').forEach(b=>b.addEventListener('click',()=>window._veChangeFormat(b.dataset.fmt)));
    // timeline click + drag-scroll
    const tlScroll=document.getElementById('veTlScroll');
    if(tlScroll){
        // click on ruler to seek
        const ruler=document.getElementById('veTlRuler');
        if(ruler) ruler.addEventListener('click',window._veTlClick);
        // drag-scroll: mousedown on empty area or middle-button
        let _tlDrag=null;
        tlScroll.addEventListener('mousedown',e=>{
            // only grab on empty track area or middle button
            if(e.button===1||(e.button===0&&(e.target===tlScroll||e.target.classList.contains('ve-tl-tracks')||e.target.classList.contains('ve-tl-audio-empty')||e.target.classList.contains('ve-tl-overlay-empty')))){
                e.preventDefault();
                _tlDrag={x:e.clientX,sl:tlScroll.scrollLeft};
                tlScroll.classList.add('grabbing');
            }
        });
        document.addEventListener('mousemove',e=>{
            if(!_tlDrag) return;
            tlScroll.scrollLeft=_tlDrag.sl-( e.clientX-_tlDrag.x);
        });
        document.addEventListener('mouseup',()=>{
            if(_tlDrag){_tlDrag=null;tlScroll.classList.remove('grabbing');}
        });
        // touch drag-scroll
        let _tlTouch=null;
        tlScroll.addEventListener('touchstart',e=>{
            if(e.touches.length===1){_tlTouch={x:e.touches[0].clientX,sl:tlScroll.scrollLeft};}
        },{passive:true});
        tlScroll.addEventListener('touchmove',e=>{
            if(_tlTouch&&e.touches.length===1){
                tlScroll.scrollLeft=_tlTouch.sl-(e.touches[0].clientX-_tlTouch.x);
            }
        },{passive:true});
        tlScroll.addEventListener('touchend',()=>{_tlTouch=null;});
    }
    // keyboard (delete overlay)
    document.addEventListener('keydown',onKeyDown);
    // back button: close video maker & restore topbar
    window.addEventListener('popstate', function(e){
        const modal=document.getElementById('videoMakerModal');
        if(modal&&modal.style.display!=='none'){
            window.veClose();
        }
    });
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
    // Click on empty canvas → trigger file upload
    if(!vm.clips.length){
        const fi=document.getElementById('veFileInput');
        if(fi) fi.click();
        return;
    }
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
    else{
        vm.oi=-1;
        // if clip is unlocked, start panning the background
        if(c && c.locked===false){
            vm.drag={mode:'pan',sx:x,sy:y,origPanX:c.panX||0,origPanY:c.panY||0};
            vm.canvas.style.cursor='grabbing';
        }
        render();refreshRightPanel();refreshLeftPanel();
    }
}

function onMove(e){
    if(!vm.drag)return;
    const{x,y}=canvasXY(e);
    const c=curClip();if(!c)return;
    // pan mode: move background image/video
    if(vm.drag.mode==='pan'){
        c.panX=vm.drag.origPanX+(x-vm.drag.sx);
        c.panY=vm.drag.origPanY+(y-vm.drag.sy);
        render();return;
    }
    if(!c.overlays[vm.drag.oi])return;
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
        // snap-to-center
        const SNAP=Math.max(15,vm.w*.012);
        const b=getOBounds(o);
        vm.snapLines=null;
        if(b){
            let snH=false,snV=false;
            if(Math.abs(b.cx-vm.w/2)<SNAP){
                // snap horizontal center
                const diff=vm.w/2-b.cx; o.x+=diff; snV=true;
            }
            if(Math.abs(b.cy-vm.h/2)<SNAP){
                const diff=vm.h/2-b.cy; o.y+=diff; snH=true;
            }
            if(snH||snV) vm.snapLines={h:snH,v:snV};
        }
    }
    render();refreshRightPanel();
}

function onUp(){
    if(vm.drag&&(vm.drag.mode==='resize'||vm.drag.mode==='rotate'||vm.drag.mode==='pan'))vm.canvas.style.cursor='default';
    vm.drag=null; vm.snapLines=null; render();
}

// ── Right-click context menu ──
function onRightClick(e){
    e.preventDefault();
    if(vm.playing&&!vm.paused)return;
    const{x,y}=canvasXY(e);
    const hit=hitOverlay(x,y);
    if(hit>=0){ vm.oi=hit; render();refreshRightPanel();refreshLeftPanel(); }
    const cm=document.getElementById('veContextMenu'); if(!cm)return;
    if(hit<0&&!vm.clipboard){cm.style.display='none';return;}
    // position near mouse
    const rect=vm.canvas.getBoundingClientRect();
    cm.style.left=(e.clientX-rect.left)+'px';
    cm.style.top=(e.clientY-rect.top)+'px';
    cm.style.display='block';
}

// close context menu on click elsewhere
document.addEventListener('mousedown',function(e){
    const cm=document.getElementById('veContextMenu');
    if(cm&&cm.style.display!=='none'&&!cm.contains(e.target)){cm.style.display='none';}
});

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
    let finished=false;
    function finish(){
        if(finished) return;
        finished=true;
        o.text=inp.value||'텍스트';
        inp.removeEventListener('blur',finish);
        if(inp.parentNode) inp.remove();
        render();refreshLeftPanel();refreshRightPanel();
    }
    inp.addEventListener('blur',finish);
    inp.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();finish();}});
}

window.openVideoMaker = function(label) {
    vm.clips=[];vm.ci=0;vm.oi=-1;vm.playing=false;vm.paused=false;vm.cancel=false;
    vm.addMode=null;vm.music='none';vm.musicPlaying=null;vm.playTime=0;vm.leftTab='media';
    vm.libItems=null;vm.libPage=0;vm.imgItems=null;vm.imgPage=0;
    vm.audioItems=null;vm.audioUrl=null;vm.audioTab='sfx';vm.canvasZoom=1;
    if(vm.audioEl){try{vm.audioEl.pause();}catch(e){}vm.audioEl=null;}
    // Load country-specific fonts from Supabase if not already loaded
    if(window.initCanvasFonts && !window.isFontsInitialized){
        window.initCanvasFonts().then(()=>{ console.log('📥 [VideoMaker] Fonts loaded'); refreshLeftPanel&&refreshLeftPanel(); });
    }
    // format from label
    if(label==='쇼츠') vm.format='portrait';
    else vm.format='landscape';
    const f=FORMATS.find(x=>x.id===vm.format);
    vm.w=f.w;vm.h=f.h;
    const modal=document.getElementById('videoMakerModal');if(!modal)return;
    modal.style.display='flex';
    // push history state for back button handling
    history.pushState({veOpen:true},'','');
    // hide site UI that has high z-index
    const topbar=document.querySelector('.topbar');if(topbar)topbar.style.display='none';
    const dock=document.querySelector('.bottom-dock');if(dock)dock.style.display='none';
    const mcd=document.getElementById('mobileControlDock');if(mcd)mcd.style.display='none';
    const title=document.getElementById('veTitle');
    if(title)title.textContent='영상 편집기';
    vm.canvas=document.getElementById('veCanvas');
    if(vm.canvas){vm.canvas.width=vm.w;vm.canvas.height=vm.h;vm.ctx=vm.canvas.getContext('2d');vm.canvas.style.transform='';vm.canvas.style.cursor='default';}
    const centerEl=document.querySelector('.ve-center');if(centerEl)centerEl.style.overflow='hidden';
    render();updateAll();
    const dlBtn=document.getElementById('veDlBtn');if(dlBtn)dlBtn.style.display='none';
    const prog=document.getElementById('veProgress');if(prog)prog.style.display='none';
};

window.veClose = function(){
    const modal=document.getElementById('videoMakerModal');
    if(!modal||modal.style.display==='none') return; // already closed
    stopMusicPreview();vm.cancel=true;vm.playing=false;
    if(vm.audioEl){try{vm.audioEl.pause();}catch(e){}vm.audioEl=null;}
    modal.style.display='none';
    // hide context menu
    const cm=document.getElementById('veContextMenu'); if(cm) cm.style.display='none';
    // restore site UI — force remove inline display:none
    document.querySelectorAll('.topbar, .bottom-dock, #mobileControlDock').forEach(el=>{
        if(el) el.style.removeProperty('display');
    });
    // schedule a second check to ensure topbar is visible (in case of race condition)
    setTimeout(()=>{
        document.querySelectorAll('.topbar, .bottom-dock, #mobileControlDock').forEach(el=>{
            if(el&&getComputedStyle(el).display==='none') el.style.display='block';
        });
    },100);
};

/* ─── Mobile bottom sheet drag for ve-left ─── */
(function() {
    var panel, startY, startTransform, panelH;
    function isMobile() { return window.innerWidth <= 900; }

    document.addEventListener('touchstart', function(e) {
        if (!isMobile()) return;
        var modal = document.getElementById('videoMakerModal');
        if (!modal || modal.style.display === 'none') return;
        panel = modal.querySelector('.ve-left');
        if (!panel) return;
        var rect = panel.getBoundingClientRect();
        var touch = e.touches[0];
        if (touch.clientY < rect.top || touch.clientY > rect.top + 30) { panel = null; return; }
        startY = touch.clientY;
        panelH = rect.height;
        var transform = panel.style.transform;
        startTransform = transform ? parseInt(transform.replace(/[^-\d]/g, '')) || 0 : 0;
        panel.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!panel || startY === undefined || !isMobile()) return;
        var dy = e.touches[0].clientY - startY;
        var newY = Math.max(0, startTransform + dy);
        panel.style.transform = 'translateY(' + newY + 'px)';
    }, { passive: true });

    document.addEventListener('touchend', function() {
        if (!panel || startY === undefined || !isMobile()) return;
        panel.style.transition = 'transform 0.3s ease';
        var transform = panel.style.transform;
        var currentY = transform ? parseInt(transform.replace(/[^-\d]/g, '')) || 0 : 0;
        if (currentY > panelH * 0.4) {
            panel.style.transform = 'translateY(' + (panelH - 40) + 'px)';
        } else {
            panel.style.transform = 'translateY(0)';
        }
        startY = undefined;
        panel = null;
    }, { passive: true });
})();
