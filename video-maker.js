// video-maker.js — 이미지 슬라이드쇼 비디오 메이커
// Canvas API + MediaRecorder API로 클라이언트 사이드 영상 생성

let vmImages = [];       // { file, url, img } 배열
let vmCanvas, vmCtx;
let vmMode = 'video';    // 'video' (1920x1080) or 'shorts' (1080x1920)
let vmWidth = 1920, vmHeight = 1080;
let vmIsGenerating = false;

export function initVideoMaker() {
    // 드래그 정렬용 변수
    let dragIdx = null;

    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;

    // 이미지 업로드 핸들러
    const dropZone = document.getElementById('vmDropZone');
    const fileInput = document.getElementById('vmFileInput');

    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput && fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('vm-drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('vm-drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('vm-drag-over');
            handleFiles(e.dataTransfer.files);
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', e => handleFiles(e.target.files));
    }

    // 썸네일 리스트 드래그 정렬
    const thumbList = document.getElementById('vmThumbList');
    if (thumbList) {
        thumbList.addEventListener('dragstart', e => {
            const li = e.target.closest('[data-vm-idx]');
            if (li) dragIdx = parseInt(li.dataset.vmIdx);
        });
        thumbList.addEventListener('dragover', e => {
            e.preventDefault();
            const li = e.target.closest('[data-vm-idx]');
            if (li) li.style.opacity = '0.5';
        });
        thumbList.addEventListener('dragleave', e => {
            const li = e.target.closest('[data-vm-idx]');
            if (li) li.style.opacity = '1';
        });
        thumbList.addEventListener('drop', e => {
            e.preventDefault();
            const li = e.target.closest('[data-vm-idx]');
            if (li && dragIdx !== null) {
                const toIdx = parseInt(li.dataset.vmIdx);
                if (dragIdx !== toIdx) {
                    const [moved] = vmImages.splice(dragIdx, 1);
                    vmImages.splice(toIdx, 0, moved);
                    renderThumbs();
                }
            }
            dragIdx = null;
        });
    }

    console.log('🎬 비디오 메이커 초기화 완료');
}

// 외부에서 호출: 비디오 메이커 열기
window.openVideoMaker = function(label) {
    vmImages = [];
    vmMode = (label === '쇼츠') ? 'shorts' : 'video';
    vmWidth = (vmMode === 'shorts') ? 1080 : 1920;
    vmHeight = (vmMode === 'shorts') ? 1920 : 1080;

    const modal = document.getElementById('videoMakerModal');
    if (!modal) return;
    modal.style.display = 'flex';

    // 모달 타이틀 업데이트
    const title = document.getElementById('vmTitle');
    if (title) title.textContent = (vmMode === 'shorts') ? '쇼츠 만들기 (1080×1920)' : '영상 만들기 (1920×1080)';

    // 캔버스 초기화
    vmCanvas = document.getElementById('vmPreviewCanvas');
    if (vmCanvas) {
        vmCanvas.width = vmWidth;
        vmCanvas.height = vmHeight;
        vmCtx = vmCanvas.getContext('2d');
        vmCtx.fillStyle = '#000';
        vmCtx.fillRect(0, 0, vmWidth, vmHeight);
    }

    // UI 초기화
    renderThumbs();
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (dlBtn) dlBtn.style.display = 'none';
    const prog = document.getElementById('vmProgress');
    if (prog) prog.style.display = 'none';
    const promptInput = document.getElementById('vmPrompt');
    if (promptInput) promptInput.value = '';
};

function handleFiles(fileList) {
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            vmImages.push({ file, url, img });
            renderThumbs();
            drawPreviewFrame(vmImages.length - 1);
        };
        img.src = url;
    });
}

function renderThumbs() {
    const list = document.getElementById('vmThumbList');
    if (!list) return;
    list.innerHTML = '';

    vmImages.forEach((item, i) => {
        const li = document.createElement('div');
        li.className = 'vm-thumb-item';
        li.dataset.vmIdx = i;
        li.draggable = true;
        li.innerHTML = `
            <span class="vm-thumb-num">${i + 1}</span>
            <img src="${item.url}" class="vm-thumb-img">
            <button class="vm-thumb-del" onclick="event.stopPropagation(); window.vmRemoveImage(${i})">×</button>
        `;
        li.addEventListener('click', () => drawPreviewFrame(i));
        list.appendChild(li);
    });

    // 업로드 영역 표시/숨김
    const dropZone = document.getElementById('vmDropZone');
    const countEl = document.getElementById('vmImageCount');
    if (countEl) countEl.textContent = vmImages.length + '장';
}

window.vmRemoveImage = function(idx) {
    if (vmImages[idx]) URL.revokeObjectURL(vmImages[idx].url);
    vmImages.splice(idx, 1);
    renderThumbs();
    if (vmImages.length > 0) drawPreviewFrame(0);
    else if (vmCtx) { vmCtx.fillStyle = '#000'; vmCtx.fillRect(0, 0, vmWidth, vmHeight); }
};

// 프리뷰 캔버스에 특정 이미지 그리기
function drawPreviewFrame(idx) {
    if (!vmCtx || !vmImages[idx]) return;
    const img = vmImages[idx].img;
    vmCtx.fillStyle = '#000';
    vmCtx.fillRect(0, 0, vmWidth, vmHeight);
    drawImageCover(vmCtx, img, vmWidth, vmHeight);
    drawTextOverlay(vmCtx);
}

// 이미지를 캔버스에 cover 모드로 그리기
function drawImageCover(ctx, img, cw, ch) {
    const imgRatio = img.width / img.height;
    const canvasRatio = cw / ch;
    let sw, sh, sx, sy;
    if (imgRatio > canvasRatio) {
        sh = img.height; sw = sh * canvasRatio;
        sx = (img.width - sw) / 2; sy = 0;
    } else {
        sw = img.width; sh = sw / canvasRatio;
        sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

// 텍스트 오버레이
function drawTextOverlay(ctx) {
    const prompt = document.getElementById('vmPrompt');
    if (!prompt || !prompt.value.trim()) return;
    const text = prompt.value.trim();
    const fontSize = Math.round(vmWidth * 0.035);
    ctx.save();
    ctx.font = `bold ${fontSize}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const lines = wrapText(ctx, text, vmWidth * 0.85);
    const lineH = fontSize * 1.4;
    const totalH = lines.length * lineH + 40;
    const startY = vmHeight - totalH;

    // 반투명 배경
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, startY - 10, vmWidth, totalH + 20);

    // 텍스트
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => {
        ctx.fillText(line, vmWidth / 2, startY + (i + 1) * lineH);
    });
    ctx.restore();
}

function wrapText(ctx, text, maxW) {
    const words = text.split('');
    const lines = [];
    let line = '';
    for (const ch of words) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW && line) {
            lines.push(line);
            line = ch;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// 미리보기 재생
window.vmPreview = async function() {
    if (vmImages.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vmIsGenerating) return;

    const duration = parseFloat(document.getElementById('vmDuration')?.value || 3) * 1000;
    const transition = document.getElementById('vmTransition')?.value || 'fade';
    const transMs = 800;

    vmIsGenerating = true;
    const genBtn = document.getElementById('vmPreviewBtn');
    if (genBtn) genBtn.disabled = true;

    for (let i = 0; i < vmImages.length; i++) {
        // 전환 효과
        if (i > 0) {
            await animateTransition(vmImages[i - 1].img, vmImages[i].img, transition, transMs);
        } else {
            vmCtx.fillStyle = '#000';
            vmCtx.fillRect(0, 0, vmWidth, vmHeight);
            drawImageCover(vmCtx, vmImages[i].img, vmWidth, vmHeight);
            drawTextOverlay(vmCtx);
        }
        // 정지 표시
        await sleep(duration - (i > 0 ? transMs : 0));
    }

    vmIsGenerating = false;
    if (genBtn) genBtn.disabled = false;
};

// 전환 효과 애니메이션
function animateTransition(imgFrom, imgTo, type, ms) {
    return new Promise(resolve => {
        const start = performance.now();
        function frame(now) {
            const t = Math.min((now - start) / ms, 1);
            vmCtx.fillStyle = '#000';
            vmCtx.fillRect(0, 0, vmWidth, vmHeight);

            if (type === 'fade') {
                drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight);
                vmCtx.globalAlpha = t;
                drawImageCover(vmCtx, imgTo, vmWidth, vmHeight);
                vmCtx.globalAlpha = 1;
            } else if (type === 'slide') {
                const offset = vmWidth * (1 - t);
                vmCtx.save();
                vmCtx.translate(-offset * t, 0);
                drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight);
                vmCtx.restore();
                vmCtx.save();
                vmCtx.translate(vmWidth - offset * t - vmWidth * t, 0);
                // 새 이미지를 오른쪽에서 슬라이드
                vmCtx.translate(vmWidth * (1 - t), 0);
                drawImageCover(vmCtx, imgTo, vmWidth, vmHeight);
                vmCtx.restore();
            } else if (type === 'zoom') {
                const scale = 1 + t * 0.1;
                vmCtx.save();
                vmCtx.globalAlpha = 1 - t;
                vmCtx.translate(vmWidth / 2, vmHeight / 2);
                vmCtx.scale(scale, scale);
                vmCtx.translate(-vmWidth / 2, -vmHeight / 2);
                drawImageCover(vmCtx, imgFrom, vmWidth, vmHeight);
                vmCtx.restore();
                vmCtx.save();
                vmCtx.globalAlpha = t;
                drawImageCover(vmCtx, imgTo, vmWidth, vmHeight);
                vmCtx.restore();
            }

            drawTextOverlay(vmCtx);
            if (t < 1) requestAnimationFrame(frame);
            else resolve();
        }
        requestAnimationFrame(frame);
    });
}

// 영상 생성 + 다운로드
window.vmGenerate = async function() {
    if (vmImages.length === 0) return alert('이미지를 먼저 업로드해주세요.');
    if (vmIsGenerating) return;
    vmIsGenerating = true;

    const duration = parseFloat(document.getElementById('vmDuration')?.value || 3) * 1000;
    const transition = document.getElementById('vmTransition')?.value || 'fade';
    const transMs = 800;
    const fps = 30;

    const prog = document.getElementById('vmProgress');
    const progBar = document.getElementById('vmProgressBar');
    const progText = document.getElementById('vmProgressText');
    const genBtn = document.getElementById('vmGenerateBtn');
    const dlBtn = document.getElementById('vmDownloadBtn');
    if (prog) prog.style.display = 'block';
    if (dlBtn) dlBtn.style.display = 'none';
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = '생성 중...'; }

    // MediaRecorder 설정
    const stream = vmCanvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const totalTime = vmImages.length * duration;

    recorder.start();

    // 프레임 렌더링
    for (let i = 0; i < vmImages.length; i++) {
        const elapsed = i * duration;
        if (progBar) progBar.style.width = Math.round((elapsed / totalTime) * 100) + '%';
        if (progText) progText.textContent = `${i + 1}/${vmImages.length} 이미지 처리 중...`;

        if (i > 0) {
            await animateTransition(vmImages[i - 1].img, vmImages[i].img, transition, transMs);
            await sleep(duration - transMs);
        } else {
            vmCtx.fillStyle = '#000';
            vmCtx.fillRect(0, 0, vmWidth, vmHeight);
            drawImageCover(vmCtx, vmImages[i].img, vmWidth, vmHeight);
            drawTextOverlay(vmCtx);
            await sleep(duration);
        }
    }

    if (progBar) progBar.style.width = '100%';
    if (progText) progText.textContent = '영상 인코딩 중...';

    // 녹화 종료 대기
    await new Promise(resolve => {
        recorder.onstop = resolve;
        recorder.stop();
    });

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 다운로드 버튼 표시
    if (dlBtn) {
        dlBtn.style.display = 'inline-flex';
        dlBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `chameleon_${vmMode}_${Date.now()}.webm`;
            a.click();
        };
    }

    if (progText) progText.textContent = '완료! 다운로드 버튼을 클릭하세요.';
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '영상 생성'; }
    vmIsGenerating = false;
};

// 프롬프트 입력 시 프리뷰 갱신
window.vmUpdatePreview = function() {
    if (vmImages.length > 0) drawPreviewFrame(0);
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
