// video-maker.js — 이미지 슬라이드쇼 비디오 메이커 v2
// PC: 좌측 컨트롤 + 우측 프리뷰 | 이미지별 텍스트 | 음악 | 일시정지+편집

let vmImages = [];       // { file, url, img, text:'' }
let vmCanvas, vmCtx;
let vmMode = 'video';
let vmWidth = 1920, vmHeight = 1080;
let vmIsPlaying = false;
let vmIsPaused = false;
let vmCurrentIdx = 0;
let vmAnnotations = [];  // { x, y, text, fontSize, color } 캔버스 위 주석
let vmAudioCtx = null;
let vmCurrentMusic = null; // 현재 재생 중인 음악
let vmMusicChoice = 'none';
let vmCancelFlag = false;

// ─── 음악 생성 (Web Audio API) ───
const MUSIC_LIST = [
    { id:'none',    name:'없음',       icon:'fa-volume-xmark' },
    { id:'upbeat',  name:'Upbeat',     icon:'fa-bolt',       bpm:120, notes:[60,64,67,72,67,64], wave:'square' },
    { id:'chill',   name:'Lo-fi Chill', icon:'fa-mug-hot',   bpm:75,  notes:[57,60,64,62,60,57], wave:'triangle' },
    { id:'cinema',  name:'Cinematic',  icon:'fa-film',        bpm:60,  notes:[48,55,60,63,60,55], wave:'sawtooth' },
    { id:'happy',   name:'Happy Pop',  icon:'fa-face-smile',  bpm:130, notes:[65,69,72,77,72,69], wave:'square' },
    { id:'ambient', name:'Ambient',    icon:'fa-cloud',       bpm:50,  notes:[50,57,62,57,55,50], wave:'sine' }
];

function getAudioCtx() {
    if (!vmAudioCtx) vmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return vmAudioCtx;
}

function playMusicPreview(musicId) {
    stopMusic();
    if (musicId === 'none') return;
    const m = MUSIC_LIST.find(x => x.id === musicId);
    if (!m) return;
    const ctx = getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.connect(ctx.destination);
    const dur = 60 / m.bpm;
    let noteIdx = 0;
    function scheduleNote() {
        if (!vmCurrentMusic || vmCurrentMusic.id !== musicId) return;
        const osc = ctx.createOscillator();
        osc.type = m.wave;
        osc.frequency.value = 440 * Math.pow(2, (m.notes[noteIdx % m.notes.length] - 69) / 12);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.3, ctx.currentTime);
        env.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur * 0.9);
        osc.connect(env).connect(gain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
        noteIdx++;
        vmCurrentMusic.timer = setTimeout(scheduleNote, dur * 1000);
    }
    vmCurrentMusic = { id: musicId, gain, timer: null };
    scheduleNote();
}

function stopMusic() {
    if (vmCurrentMusic) {
        clearTimeout(vmCurrentMusic.timer);
        try { vmCurrentMusic.gain.disconnect(); } catch(e) {}
        vmCurrentMusic = null;
    }
}

// 녹화용 음악 스트림 생성
function createMusicStream(musicId, duration) {
    if (musicId === 'none') return null;
    const m = MUSIC_LIST.find(x => x.id === musicId);
    if (!m) return null;
    const ctx = getAudioCtx();
    const dest = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    gain.connect(dest);
    const dur = 60 / m.bpm;
    const totalNotes = Math.ceil(duration / 1000 / dur) + 2;
    for (let i = 0; i < totalNotes; i++) {
        const osc = ctx.createOscillator();
        osc.type = m.wave;
        osc.frequency.value = 440 * Math.pow(2, (m.notes[i % m.notes.length] - 69) / 12);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.3, ctx.currentTime + i * dur);
        env.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i + 1) * dur - 0.05);
        osc.connect(env).connect(gain);
        osc.start(ctx.currentTime + i * dur);
        osc.stop(ctx.currentTime + (i + 1) * dur);
    }
    return dest.stream;
}

// ─── 초기화 ───
export function initVideoMaker() {
    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;

    const dropZone = document.getElementById('vmDropZone');
    const fileInput = document.getElementById('vmFileInput');
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput && fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('vm-drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('vm-drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('vm-drag-over'); handleFiles(e.dataTransfer.files); });
    }
    if (fileInput) fileInput.addEventListener('change', e => handleFiles(e.target.files));

    // 캔버스 클릭 → 주석 추가 (일시정지 중에만)
    const cvs = document.getElementById('vmPreviewCanvas');
    if (cvs) {
        cvs.addEventListener('click', e => {
            if (!vmIsPaused) return;
            const rect = cvs.getBoundingClientRect();
            const scaleX = vmWidth / rect.width;
            const scaleY = vmHeight / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            const text = prompt('텍스트를 입력하세요:');
            if (!text) return;
            vmAnnotations.push({ x, y, text, fontSize: Math.round(vmWidth * 0.03), color: '#fff', idx: vmCurrentIdx });
            redrawCurrentFrame();
        });
    }

    console.log('🎬 비디오 메이커 v2 초기화 완료');
}

// ─── 열기 ───
window.openVideoMaker = function(label) {
    vmImages = []; vmAnnotations = []; vmCurrentIdx = 0;
    vmIsPaused = false; vmIsPlaying = false; vmCancelFlag = false;
    vmMode = (label === '쇼츠') ? 'shorts' : 'video';
    vmWidth = (vmMode === 'shorts') ? 1080 : 1920;
    vmHeight = (vmMode === 'shorts') ? 1920 : 1080;

    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const title = document.getElementById('vmTitle');
    if (title) title.textContent = (vmMode === 'shorts') ? '쇼츠 만들기 (1080×1920)' : '영상 만들기 (1920×1080)';

    vmCanvas = document.getElementById('vmPreviewCanvas');
    if (vmCanvas) {
        vmCanvas.width = vmWidth; vmCanvas.height = vmHeight;
        vmCtx = vmCanvas.getContext('2d');
        vmCtx.fillStyle = '#111'; vmCtx.fillRect(0, 0, vmWidth, vmHeight);
        vmCtx.fillStyle = '#555'; vmCtx.font = `${vmWidth*0.03}px sans-serif`; vmCtx.textAlign = 'center';
        vmCtx.fillText('이미지를 업로드하세요', vmWidth/2, vmHeight/2);
    }

    renderImageList();
    renderMusicList();
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (dlBtn) dlBtn.style.display = 'none';
    const prog = document.getElementById('vmProgress');
    if (prog) prog.style.display = 'none';
    const pauseUI = document.getElementById('vmPauseUI');
    if (pauseUI) pauseUI.style.display = 'none';
};

// ─── 파일 처리 ───
function handleFiles(fileList) {
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            vmImages.push({ file, url, img, text: '' });
            renderImageList();
            drawPreviewFrame(vmImages.length - 1);
        };
        img.src = url;
    });
}

// ─── 이미지 리스트 렌더 (썸네일 + 개별 텍스트) ───
function renderImageList() {
    const list = document.getElementById('vmImageList');
    if (!list) return;
    list.innerHTML = '';
    if (vmImages.length === 0) {
        list.innerHTML = '<p style="color:#94a3b8; font-size:13px; text-align:center; padding:10px;">업로드된 이미지가 없습니다</p>';
        return;
    }
    vmImages.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'vm-img-row';
        row.draggable = true;
        row.dataset.vmIdx = i;
        row.innerHTML = `
            <div class="vm-img-row-left" onclick="window.vmSelectImage(${i})">
                <span class="vm-img-num">${i+1}</span>
                <img src="${item.url}" class="vm-img-thumb">
            </div>
            <input type="text" class="vm-img-text" value="${item.text||''}" placeholder="장면 ${i+1} 텍스트..."
                oninput="window.vmSetText(${i}, this.value)">
            <button class="vm-img-del" onclick="window.vmRemoveImage(${i})">×</button>
        `;
        // 드래그 정렬
        row.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', i));
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.borderTop='2px solid #6366f1'; });
        row.addEventListener('dragleave', () => row.style.borderTop='');
        row.addEventListener('drop', e => {
            e.preventDefault(); row.style.borderTop='';
            const from = parseInt(e.dataTransfer.getData('text/plain'));
            const to = i;
            if (from !== to) { const [m] = vmImages.splice(from,1); vmImages.splice(to,0,m); renderImageList(); }
        });
        list.appendChild(row);
    });
}

window.vmSetText = function(idx, text) { if (vmImages[idx]) vmImages[idx].text = text; };
window.vmSelectImage = function(idx) { vmCurrentIdx = idx; drawPreviewFrame(idx); };
window.vmRemoveImage = function(idx) {
    if (vmImages[idx]) URL.revokeObjectURL(vmImages[idx].url);
    vmImages.splice(idx, 1);
    vmAnnotations = vmAnnotations.filter(a => a.idx !== idx).map(a => { if (a.idx > idx) a.idx--; return a; });
    renderImageList();
    if (vmImages.length > 0) drawPreviewFrame(0); else if (vmCtx) { vmCtx.fillStyle='#111'; vmCtx.fillRect(0,0,vmWidth,vmHeight); }
};

// ─── 음악 리스트 렌더 ───
function renderMusicList() {
    const wrap = document.getElementById('vmMusicList');
    if (!wrap) return;
    wrap.innerHTML = '';
    MUSIC_LIST.forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'vm-music-btn' + (vmMusicChoice === m.id ? ' active' : '');
        btn.innerHTML = `<i class="fa-solid ${m.icon}"></i> ${m.name}`;
        btn.onclick = () => {
            vmMusicChoice = m.id;
            renderMusicList();
            playMusicPreview(m.id);
            // 3초 후 자동 정지
            if (m.id !== 'none') setTimeout(() => { if (vmMusicChoice === m.id && vmCurrentMusic) stopMusic(); }, 3000);
        };
        wrap.appendChild(btn);
    });
}

// ─── 프리뷰 그리기 ───
function drawPreviewFrame(idx) {
    vmCurrentIdx = idx;
    if (!vmCtx || !vmImages[idx]) return;
    vmCtx.fillStyle = '#000'; vmCtx.fillRect(0, 0, vmWidth, vmHeight);
    drawImageCover(vmCtx, vmImages[idx].img, vmWidth, vmHeight);
    drawTextForImage(vmCtx, idx);
    drawAnnotationsForImage(vmCtx, idx);
}

function redrawCurrentFrame() { drawPreviewFrame(vmCurrentIdx); }

function drawImageCover(ctx, img, cw, ch) {
    const ir = img.width / img.height, cr = cw / ch;
    let sw,sh,sx,sy;
    if (ir > cr) { sh=img.height; sw=sh*cr; sx=(img.width-sw)/2; sy=0; }
    else { sw=img.width; sh=sw/cr; sx=0; sy=(img.height-sh)/2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

function drawTextForImage(ctx, idx) {
    const text = vmImages[idx]?.text;
    if (!text || !text.trim()) return;
    const fontSize = Math.round(vmWidth * 0.035);
    ctx.save();
    ctx.font = `bold ${fontSize}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const lines = wrapText(ctx, text.trim(), vmWidth * 0.85);
    const lineH = fontSize * 1.4, totalH = lines.length * lineH + 30;
    const startY = vmHeight - totalH;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, startY - 10, vmWidth, totalH + 20);
    ctx.fillStyle = '#fff';
    lines.forEach((l,i) => ctx.fillText(l, vmWidth/2, startY + (i+1)*lineH));
    ctx.restore();
}

function drawAnnotationsForImage(ctx, idx) {
    vmAnnotations.filter(a => a.idx === idx).forEach(a => {
        ctx.save();
        ctx.font = `bold ${a.fontSize}px "Noto Sans KR", sans-serif`;
        ctx.fillStyle = a.color;
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
        ctx.fillText(a.text, a.x, a.y);
        ctx.restore();
    });
}

function wrapText(ctx, text, maxW) {
    const lines = []; let line = '';
    for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
        else line += ch;
    }
    if (line) lines.push(line);
    return lines;
}

// ─── 전환 효과 ───
function animateTransition(imgFrom, imgTo, idxTo, type, ms) {
    return new Promise(resolve => {
        const start = performance.now();
        function frame(now) {
            if (vmCancelFlag) return resolve();
            const t = Math.min((now - start) / ms, 1);
            vmCtx.fillStyle = '#000'; vmCtx.fillRect(0,0,vmWidth,vmHeight);
            if (type === 'fade') {
                drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight);
                vmCtx.globalAlpha = t; drawImageCover(vmCtx, imgTo, vmWidth, vmHeight); vmCtx.globalAlpha = 1;
            } else if (type === 'slide') {
                vmCtx.save(); vmCtx.translate(-vmWidth*t, 0); drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight); vmCtx.restore();
                vmCtx.save(); vmCtx.translate(vmWidth*(1-t), 0); drawImageCover(vmCtx, imgTo, vmWidth, vmHeight); vmCtx.restore();
            } else if (type === 'zoom') {
                vmCtx.save(); vmCtx.globalAlpha=1-t; vmCtx.translate(vmWidth/2,vmHeight/2); vmCtx.scale(1+t*0.15,1+t*0.15); vmCtx.translate(-vmWidth/2,-vmHeight/2); drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight); vmCtx.restore();
                vmCtx.save(); vmCtx.globalAlpha=t; drawImageCover(vmCtx, imgTo, vmWidth, vmHeight); vmCtx.restore();
            }
            drawTextForImage(vmCtx, idxTo);
            drawAnnotationsForImage(vmCtx, idxTo);
            if (t < 1) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
    });
}

// ─── 일시정지 가능한 sleep ───
function pausableSleep(ms) {
    return new Promise(resolve => {
        let elapsed = 0;
        const interval = 50;
        const tick = () => {
            if (vmCancelFlag) return resolve();
            if (vmIsPaused) { setTimeout(tick, interval); return; }
            elapsed += interval;
            if (elapsed >= ms) resolve();
            else setTimeout(tick, interval);
        };
        setTimeout(tick, interval);
    });
}

// ─── 미리보기 ───
window.vmPreview = async function() {
    if (vmImages.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vmIsPlaying) { vmCancelFlag = true; return; }
    vmIsPlaying = true; vmIsPaused = false; vmCancelFlag = false;

    const duration = parseFloat(document.getElementById('vmDuration')?.value || 3) * 1000;
    const transition = document.getElementById('vmTransition')?.value || 'fade';
    const btn = document.getElementById('vmPreviewBtn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-stop"></i> 정지';
    const pauseUI = document.getElementById('vmPauseUI');

    playMusicPreview(vmMusicChoice);

    for (let i = 0; i < vmImages.length; i++) {
        if (vmCancelFlag) break;
        vmCurrentIdx = i;
        if (i > 0) await animateTransition(vmImages[i-1].img, vmImages[i].img, i, transition, 800);
        else { drawPreviewFrame(i); }
        // 이미지 표시 시간 (일시정지 가능)
        await pausableSleep(i > 0 ? duration - 800 : duration);
    }

    stopMusic();
    vmIsPlaying = false; vmIsPaused = false; vmCancelFlag = false;
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> 미리보기';
    if (pauseUI) pauseUI.style.display = 'none';
};

// 일시정지/재개
window.vmTogglePause = function() {
    if (!vmIsPlaying) return;
    vmIsPaused = !vmIsPaused;
    const pauseBtn = document.getElementById('vmPauseBtn');
    const pauseUI = document.getElementById('vmPauseUI');
    if (vmIsPaused) {
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> 재개';
        if (pauseUI) pauseUI.style.display = 'block';
        stopMusic();
    } else {
        if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> 일시정지';
        if (pauseUI) pauseUI.style.display = 'none';
        playMusicPreview(vmMusicChoice);
    }
};

// ─── 영상 생성 ───
window.vmGenerate = async function() {
    if (vmImages.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vmIsPlaying) return;
    vmIsPlaying = true; vmCancelFlag = false;

    const duration = parseFloat(document.getElementById('vmDuration')?.value || 3) * 1000;
    const transition = document.getElementById('vmTransition')?.value || 'fade';
    const fps = 30;

    const prog = document.getElementById('vmProgress');
    const progBar = document.getElementById('vmProgressBar');
    const progText = document.getElementById('vmProgressText');
    const genBtn = document.getElementById('vmGenerateBtn');
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (prog) prog.style.display = 'block';
    if (dlBtn) dlBtn.style.display = 'none';
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = '생성 중...'; }

    const totalTime = vmImages.length * duration;
    const canvasStream = vmCanvas.captureStream(fps);
    const musicStream = createMusicStream(vmMusicChoice, totalTime);

    let combinedStream;
    if (musicStream) {
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...musicStream.getAudioTracks()]);
    } else {
        combinedStream = canvasStream;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 5000000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    for (let i = 0; i < vmImages.length; i++) {
        const pct = Math.round((i / vmImages.length) * 100);
        if (progBar) progBar.style.width = pct + '%';
        if (progText) progText.textContent = `${i+1}/${vmImages.length} 처리 중...`;
        if (i > 0) { await animateTransition(vmImages[i-1].img, vmImages[i].img, i, transition, 800); await sleep(duration-800); }
        else { drawPreviewFrame(i); await sleep(duration); }
    }

    if (progBar) progBar.style.width = '100%';
    if (progText) progText.textContent = '인코딩 중...';
    await new Promise(r => { recorder.onstop = r; recorder.stop(); });

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    if (dlBtn) {
        dlBtn.style.display = 'inline-flex';
        dlBtn.onclick = () => { const a = document.createElement('a'); a.href = url; a.download = `chameleon_${vmMode}_${Date.now()}.webm`; a.click(); };
    }
    if (progText) progText.textContent = '완료!';
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '영상 생성'; }
    vmIsPlaying = false;
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
