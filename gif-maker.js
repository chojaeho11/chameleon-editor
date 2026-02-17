/* ═══ GIF Maker v1 ═══ */
(function(){
'use strict';

const GM = {
    frames: [],       // [{img:Image, canvas:null}]
    overlays: [],     // [{type:'text'|'image'|'sticker', ...props, fabricObj}]
    currentFrame: 0,
    fabricCanvas: null,
    w: 500, h: 500,
    playing: false,
    playTimer: null,
    maxFrames: 10
};
window._gm = GM;

/* ─── Open / Close ─── */
window.openGifMaker = function() {
    GM.frames = []; GM.overlays = []; GM.currentFrame = 0; GM.playing = false;
    const modal = document.getElementById('gifMakerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    history.pushState({gifOpen:true}, '', '');
    // hide site topbar
    const tb = document.querySelector('.topbar'); if(tb) tb.style.display='none';
    const dock = document.querySelector('.bottom-dock'); if(dock) dock.style.display='none';
    const mcd = document.getElementById('mobileControlDock'); if(mcd) mcd.style.display='none';
    // init canvas size from inputs
    GM.w = parseInt(document.getElementById('gifCanvasW').value) || 500;
    GM.h = parseInt(document.getElementById('gifCanvasH').value) || 500;
    initFabricCanvas();
    updateFrameUI();
    gifSwitchTab('frames');
    loadEmojis();
    loadFonts();
};

window.closeGifMaker = function() {
    const modal = document.getElementById('gifMakerModal');
    if (modal) modal.style.display = 'none';
    if (GM.playTimer) { clearInterval(GM.playTimer); GM.playTimer = null; }
    GM.playing = false;
    // dispose fabric
    if (GM.fabricCanvas) { try { GM.fabricCanvas.dispose(); } catch(e){} GM.fabricCanvas = null; }
    // restore UI
    const tb = document.querySelector('.topbar'); if(tb) tb.style.display='';
    const dock = document.querySelector('.bottom-dock'); if(dock) dock.style.display='';
    const mcd = document.getElementById('mobileControlDock'); if(mcd) mcd.style.display='';
    // go back if we pushed state
    if (history.state && history.state.gifOpen) history.back();
};

// back button
window.addEventListener('popstate', function(e) {
    if (document.getElementById('gifMakerModal').style.display === 'flex') {
        window.closeGifMaker();
    }
});

/* ─── Fabric Canvas ─── */
function initFabricCanvas() {
    if (GM.fabricCanvas) { try { GM.fabricCanvas.dispose(); } catch(e){} }
    const el = document.getElementById('gifFabricCanvas');
    el.width = GM.w; el.height = GM.h;
    GM.fabricCanvas = new fabric.Canvas('gifFabricCanvas', {
        width: GM.w, height: GM.h,
        backgroundColor: '#ffffff',
        selection: true
    });
    GM.fabricCanvas.on('object:modified', function(){ saveOverlayPositions(); });
}

window.gifResizeCanvas = function() {
    const w = parseInt(document.getElementById('gifCanvasW').value) || 500;
    const h = parseInt(document.getElementById('gifCanvasH').value) || 500;
    GM.w = Math.max(50, Math.min(2000, w));
    GM.h = Math.max(50, Math.min(2000, h));
    document.getElementById('gifCanvasW').value = GM.w;
    document.getElementById('gifCanvasH').value = GM.h;
    if (GM.fabricCanvas) {
        GM.fabricCanvas.setWidth(GM.w);
        GM.fabricCanvas.setHeight(GM.h);
        GM.fabricCanvas.renderAll();
    }
    renderCurrentFrame();
};

/* ─── Upload ─── */
window.gifUploadFiles = function(input) {
    const files = Array.from(input.files);
    if (!files.length) return;
    const remain = GM.maxFrames - GM.frames.length;
    if (remain <= 0) { alert('최대 10장까지 업로드할 수 있습니다.'); input.value=''; return; }
    const toLoad = files.slice(0, remain);
    if (files.length > remain) alert(`최대 10장까지! ${remain}장만 추가됩니다.`);
    let loaded = 0;
    toLoad.forEach(function(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                GM.frames.push({ img: img, src: e.target.result });
                loaded++;
                if (loaded === toLoad.length) {
                    if (GM.frames.length === toLoad.length) GM.currentFrame = 0;
                    updateFrameUI();
                    renderCurrentFrame();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
};

/* ─── Frame Selection & Rendering ─── */
function renderCurrentFrame() {
    if (!GM.fabricCanvas) return;
    const fc = GM.fabricCanvas;
    // remove old background image
    fc.setBackgroundImage(null, fc.renderAll.bind(fc));
    if (GM.frames.length === 0) {
        fc.setBackgroundColor('#ffffff', fc.renderAll.bind(fc));
        return;
    }
    const frame = GM.frames[GM.currentFrame];
    if (!frame) return;
    fabric.Image.fromURL(frame.src, function(fImg) {
        // scale to fit canvas
        const scaleX = GM.w / fImg.width;
        const scaleY = GM.h / fImg.height;
        const scale = Math.max(scaleX, scaleY); // cover
        fImg.set({ scaleX: scale, scaleY: scale, originX:'center', originY:'center', left: GM.w/2, top: GM.h/2 });
        fc.setBackgroundImage(fImg, fc.renderAll.bind(fc));
    }, { crossOrigin: 'anonymous' });
}

window.gifSelectFrame = function(idx) {
    if (idx < 0 || idx >= GM.frames.length) return;
    GM.currentFrame = idx;
    renderCurrentFrame();
    updateFrameUI();
};

window.gifDeleteFrame = function(idx, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    GM.frames.splice(idx, 1);
    if (GM.currentFrame >= GM.frames.length) GM.currentFrame = Math.max(0, GM.frames.length - 1);
    updateFrameUI();
    renderCurrentFrame();
};

window.gifMoveFrame = function(idx, dir, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= GM.frames.length) return;
    const tmp = GM.frames[idx];
    GM.frames[idx] = GM.frames[newIdx];
    GM.frames[newIdx] = tmp;
    if (GM.currentFrame === idx) GM.currentFrame = newIdx;
    else if (GM.currentFrame === newIdx) GM.currentFrame = idx;
    updateFrameUI();
    renderCurrentFrame();
};

/* ─── Frame UI ─── */
function updateFrameUI() {
    // Left panel frame list
    const list = document.getElementById('gifFrameList');
    if (list) {
        let html = '';
        GM.frames.forEach(function(fr, i) {
            const active = i === GM.currentFrame;
            html += '<div onclick="window.gifSelectFrame('+i+')" style="display:flex; align-items:center; gap:8px; padding:8px; border-radius:10px; cursor:pointer; border:2px solid '+(active?'#ec4899':'transparent')+'; background:'+(active?'rgba(236,72,153,0.1)':'rgba(255,255,255,0.03)')+'; transition:all 0.15s;">';
            html += '<img src="'+fr.src+'" style="width:50px; height:50px; object-fit:cover; border-radius:6px;">';
            html += '<div style="flex:1; min-width:0;">';
            html += '<div style="color:#e0e7ff; font-size:13px; font-weight:600;">프레임 '+(i+1)+'</div>';
            html += '<div style="color:#64748b; font-size:11px;">'+fr.img.naturalWidth+' × '+fr.img.naturalHeight+'</div>';
            html += '</div>';
            html += '<div style="display:flex; flex-direction:column; gap:2px;">';
            if(i>0) html += '<button onclick="window.gifMoveFrame('+i+',-1,event)" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px; font-size:11px;"><i class="fa-solid fa-chevron-up"></i></button>';
            if(i<GM.frames.length-1) html += '<button onclick="window.gifMoveFrame('+i+',1,event)" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px; font-size:11px;"><i class="fa-solid fa-chevron-down"></i></button>';
            html += '</div>';
            html += '<button onclick="window.gifDeleteFrame('+i+',event)" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px; font-size:14px;" title="삭제"><i class="fa-solid fa-trash-can"></i></button>';
            html += '</div>';
        });
        list.innerHTML = html;
    }
    // Bottom frame strip
    const strip = document.getElementById('gifFrameStrip');
    if (strip) {
        let html = '';
        GM.frames.forEach(function(fr, i) {
            const active = i === GM.currentFrame;
            html += '<div onclick="window.gifSelectFrame('+i+')" style="width:64px; height:64px; border-radius:10px; overflow:hidden; cursor:pointer; border:3px solid '+(active?'#ec4899':'#374151')+'; flex-shrink:0; transition:border-color 0.15s;">';
            html += '<img src="'+fr.src+'" style="width:100%; height:100%; object-fit:cover;">';
            html += '</div>';
        });
        strip.innerHTML = html;
    }
    // Right mini frames
    const mini = document.getElementById('gifMiniFrames');
    if (mini) {
        let html = '';
        GM.frames.forEach(function(fr, i) {
            const active = i === GM.currentFrame;
            html += '<div onclick="window.gifSelectFrame('+i+')" style="border-radius:6px; overflow:hidden; cursor:pointer; border:2px solid '+(active?'#ec4899':'transparent')+'; opacity:'+(active?'1':'0.6')+'; transition:all 0.15s;">';
            html += '<img src="'+fr.src+'" style="width:100%; aspect-ratio:1; object-fit:cover; display:block;">';
            html += '<div style="text-align:center; color:#94a3b8; font-size:10px; padding:2px 0;">'+(i+1)+'</div>';
            html += '</div>';
        });
        mini.innerHTML = html;
    }
}

/* ─── Tab Switch ─── */
window.gifSwitchTab = function(tab) {
    ['frames','text','sticker','image'].forEach(function(t) {
        const el = document.getElementById('gifTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.style.display = (t === tab) ? 'block' : 'none';
    });
    document.querySelectorAll('#gifLeftPanel .gif-tab').forEach(function(btn) {
        const isActive = btn.dataset.tab === tab;
        btn.style.color = isActive ? '#f0abfc' : '#94a3b8';
        btn.style.borderBottomColor = isActive ? '#ec4899' : 'transparent';
        if (isActive) btn.classList.add('active'); else btn.classList.remove('active');
    });
};

/* ─── Text Overlays ─── */
window.gifAddText = function() {
    if (!GM.fabricCanvas) return;
    const text = new fabric.IText('텍스트', {
        left: GM.w / 2 - 50,
        top: GM.h / 2 - 20,
        fontFamily: document.getElementById('gifFontSelect').value || 'Arial',
        fontSize: parseInt(document.getElementById('gifFontSize').value) || 32,
        fill: document.getElementById('gifFontColor').value || '#ffffff',
        stroke: document.getElementById('gifStrokeColor').value || '#000000',
        strokeWidth: parseInt(document.getElementById('gifStrokeWidth').value) || 2,
        fontWeight: 'bold',
        textAlign: 'center',
        editable: true
    });
    GM.fabricCanvas.add(text);
    GM.fabricCanvas.setActiveObject(text);
    GM.fabricCanvas.renderAll();
    updateTextList();
};

window.gifUpdateText = function() {
    if (!GM.fabricCanvas) return;
    const obj = GM.fabricCanvas.getActiveObject();
    if (!obj || obj.type !== 'i-text') return;
    obj.set({
        fontFamily: document.getElementById('gifFontSelect').value,
        fontSize: parseInt(document.getElementById('gifFontSize').value) || 32,
        fill: document.getElementById('gifFontColor').value,
        stroke: document.getElementById('gifStrokeColor').value,
        strokeWidth: parseInt(document.getElementById('gifStrokeWidth').value) || 0
    });
    GM.fabricCanvas.renderAll();
};

function updateTextList() {
    const list = document.getElementById('gifTextList');
    if (!list || !GM.fabricCanvas) return;
    const texts = GM.fabricCanvas.getObjects().filter(function(o){ return o.type === 'i-text'; });
    let html = '';
    texts.forEach(function(t, i) {
        html += '<div style="display:flex; align-items:center; gap:6px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:4px;">';
        html += '<span style="flex:1; color:#e0e7ff; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">"' + (t.text||'').substring(0,15) + '"</span>';
        html += '<button onclick="window.gifDeleteObject('+i+',\'text\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:13px;"><i class="fa-solid fa-trash-can"></i></button>';
        html += '</div>';
    });
    list.innerHTML = html;
}

window.gifDeleteObject = function(idx, type) {
    if (!GM.fabricCanvas) return;
    const filterType = type === 'text' ? 'i-text' : 'image';
    const objs = GM.fabricCanvas.getObjects().filter(function(o){ return o.type === filterType; });
    if (objs[idx]) {
        GM.fabricCanvas.remove(objs[idx]);
        GM.fabricCanvas.renderAll();
        if (type === 'text') updateTextList();
        else updateOverlayImageList();
    }
};

/* ─── Overlay Images ─── */
window.gifAddOverlayImage = function(input) {
    if (!input.files[0] || !GM.fabricCanvas) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        fabric.Image.fromURL(e.target.result, function(img) {
            const maxDim = Math.min(GM.w, GM.h) * 0.4;
            const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
            img.set({ left: GM.w/2, top: GM.h/2, originX:'center', originY:'center', scaleX: scale, scaleY: scale });
            GM.fabricCanvas.add(img);
            GM.fabricCanvas.setActiveObject(img);
            GM.fabricCanvas.renderAll();
            updateOverlayImageList();
        }, { crossOrigin: 'anonymous' });
    };
    reader.readAsDataURL(input.files[0]);
    input.value = '';
};

function updateOverlayImageList() {
    const list = document.getElementById('gifOverlayList');
    if (!list || !GM.fabricCanvas) return;
    const imgs = GM.fabricCanvas.getObjects().filter(function(o){ return o.type === 'image'; });
    let html = '';
    imgs.forEach(function(img, i) {
        html += '<div style="display:flex; align-items:center; gap:8px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px;">';
        html += '<div style="width:40px; height:40px; background:#1e1b4b; border-radius:6px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-image" style="color:#a78bfa;"></i></div>';
        html += '<span style="flex:1; color:#e0e7ff; font-size:12px;">이미지 '+(i+1)+'</span>';
        html += '<button onclick="window.gifDeleteObject('+i+',\'image\')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>';
        html += '</div>';
    });
    list.innerHTML = html;
}

/* ─── Emoji / Stickers ─── */
function loadEmojis() {
    const emojis = ['😀','😂','🤣','😍','🥰','😎','🤩','🥳','😱','🤔',
                    '👍','👎','👏','🙌','💪','🔥','❤️','💜','⭐','✨',
                    '🎉','🎊','🎈','🎁','🎯','💯','🏆','🌈','☀️','🌙',
                    '🌸','🍀','🦋','🐱','🐶','🐻','🦊','🐰','🎵','💎'];
    const grid = document.getElementById('gifEmojiGrid');
    if (!grid) return;
    let html = '';
    emojis.forEach(function(em) {
        html += '<button onclick="window.gifAddEmoji(\''+em+'\')" style="font-size:24px; padding:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; cursor:pointer; transition:background 0.15s;" onmouseenter="this.style.background=\'rgba(236,72,153,0.2)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.05)\'">' + em + '</button>';
    });
    grid.innerHTML = html;
}

window.gifAddEmoji = function(emoji) {
    if (!GM.fabricCanvas) return;
    const text = new fabric.Text(emoji, {
        left: GM.w/2, top: GM.h/2,
        originX:'center', originY:'center',
        fontSize: 64
    });
    GM.fabricCanvas.add(text);
    GM.fabricCanvas.setActiveObject(text);
    GM.fabricCanvas.renderAll();
};

/* ─── Fonts ─── */
function loadFonts() {
    const select = document.getElementById('gifFontSelect');
    if (!select) return;
    // add loaded fonts if available
    const defaultFonts = ['Arial','Impact','Georgia','Comic Sans MS','Verdana','Courier New','Times New Roman'];
    if (window.__fontList && window.__fontList.length > 0) {
        let html = '';
        window.__fontList.forEach(function(f) {
            html += '<option value="'+f.family+'" style="font-family:\''+f.family+'\'">'+f.family+'</option>';
        });
        defaultFonts.forEach(function(f) {
            html += '<option value="'+f+'">'+f+'</option>';
        });
        select.innerHTML = html;
    }
}

/* ─── Save overlay positions ─── */
function saveOverlayPositions() {
    // no-op for now; fabric manages state internally
}

/* ─── Play Preview ─── */
window.gifPlayPreview = function() {
    if (GM.frames.length < 2) { alert('프레임을 2장 이상 추가해주세요.'); return; }
    if (GM.playing) {
        // stop
        clearInterval(GM.playTimer); GM.playTimer = null; GM.playing = false;
        const btn = document.getElementById('gifPlayBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        return;
    }
    GM.playing = true;
    const btn = document.getElementById('gifPlayBtn');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    const speed = parseInt(document.getElementById('gifSpeed').value) || 500;
    GM.playTimer = setInterval(function() {
        GM.currentFrame = (GM.currentFrame + 1) % GM.frames.length;
        renderCurrentFrame();
        updateFrameUI();
    }, speed);
};

/* ─── GIF Export ─── */
window.exportGif = function() {
    if (GM.frames.length < 1) { alert('프레임을 추가해주세요.'); return; }
    // stop preview if playing
    if (GM.playing) window.gifPlayPreview();

    const progressBar = document.getElementById('gifProgressBar');
    const progressFill = document.getElementById('gifProgressFill');
    const progressText = document.getElementById('gifProgressText');
    if(progressBar) progressBar.style.display = 'block';
    if(progressFill) progressFill.style.width = '0%';
    if(progressText) progressText.textContent = 'GIF 생성 준비 중...';

    const delay = parseInt(document.getElementById('gifSpeed').value) || 500;
    const fc = GM.fabricCanvas;

    // collect overlay objects (everything except background)
    const overlayJSON = fc.toJSON(['left','top','scaleX','scaleY','angle','flipX','flipY','originX','originY']);

    // build each frame as a canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = GM.w;
    tempCanvas.height = GM.h;
    const tempCtx = tempCanvas.getContext('2d');

    const frameDataUrls = [];
    let processed = 0;

    function processFrame(idx) {
        if (idx >= GM.frames.length) {
            // all frames processed, create GIF
            buildGif(frameDataUrls, delay);
            return;
        }
        if(progressText) progressText.textContent = '프레임 ' + (idx+1) + '/' + GM.frames.length + ' 렌더링 중...';
        if(progressFill) progressFill.style.width = ((idx / GM.frames.length) * 50) + '%';

        const frame = GM.frames[idx];
        // draw background image
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, GM.w, GM.h);
        // scale image to cover
        const scaleX = GM.w / frame.img.naturalWidth;
        const scaleY = GM.h / frame.img.naturalHeight;
        const scale = Math.max(scaleX, scaleY);
        const dw = frame.img.naturalWidth * scale;
        const dh = frame.img.naturalHeight * scale;
        const dx = (GM.w - dw) / 2;
        const dy = (GM.h - dh) / 2;
        tempCtx.drawImage(frame.img, dx, dy, dw, dh);

        // draw overlays using a temp fabric static canvas
        const staticCanvas = new fabric.StaticCanvas(null, { width: GM.w, height: GM.h });
        // load only the objects (not background)
        const objsJSON = overlayJSON.objects || [];
        if (objsJSON.length === 0) {
            frameDataUrls.push(tempCanvas.toDataURL('image/png'));
            setTimeout(function(){ processFrame(idx + 1); }, 0);
            return;
        }
        fabric.util.enlivenObjects(objsJSON, function(objs) {
            objs.forEach(function(o){ staticCanvas.add(o); });
            staticCanvas.renderAll();
            // composite overlay onto temp canvas
            tempCtx.drawImage(staticCanvas.lowerCanvasEl || staticCanvas.getElement(), 0, 0);
            frameDataUrls.push(tempCanvas.toDataURL('image/png'));
            staticCanvas.dispose();
            setTimeout(function(){ processFrame(idx + 1); }, 0);
        });
    }

    processFrame(0);
};

function buildGif(frameDataUrls, delay) {
    const progressFill = document.getElementById('gifProgressFill');
    const progressText = document.getElementById('gifProgressText');
    if(progressText) progressText.textContent = 'GIF 인코딩 중...';
    if(progressFill) progressFill.style.width = '60%';

    // Use gif.js from CDN (loaded dynamically)
    if (typeof GIF === 'undefined') {
        // Load gif.js
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
        script.onload = function() { doEncode(frameDataUrls, delay); };
        script.onerror = function() {
            // fallback: manual GIF encoder
            encodeGifManual(frameDataUrls, delay);
        };
        document.head.appendChild(script);
    } else {
        doEncode(frameDataUrls, delay);
    }
}

function doEncode(frameDataUrls, delay) {
    const progressFill = document.getElementById('gifProgressFill');
    const progressText = document.getElementById('gifProgressText');

    const gif = new GIF({
        workers: 2,
        quality: 10,
        width: GM.w,
        height: GM.h,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js'
    });

    let loaded = 0;
    const imgs = [];

    frameDataUrls.forEach(function(url, i) {
        const img = new Image();
        img.onload = function() {
            imgs[i] = img;
            loaded++;
            if (loaded === frameDataUrls.length) {
                imgs.forEach(function(im) {
                    gif.addFrame(im, { delay: delay, copy: true });
                });
                gif.on('progress', function(p) {
                    if(progressFill) progressFill.style.width = (60 + p * 35) + '%';
                    if(progressText) progressText.textContent = 'GIF 인코딩 중... ' + Math.round(p*100) + '%';
                });
                gif.on('finished', function(blob) {
                    if(progressFill) progressFill.style.width = '100%';
                    if(progressText) progressText.textContent = '완료!';
                    setTimeout(function() {
                        const bar = document.getElementById('gifProgressBar');
                        if(bar) bar.style.display = 'none';
                    }, 1000);
                    // show preview
                    const url = URL.createObjectURL(blob);
                    window._gifBlobUrl = url;
                    const preview = document.getElementById('gifPreviewOverlay');
                    const previewImg = document.getElementById('gifPreviewImg');
                    if (preview && previewImg) {
                        previewImg.src = url;
                        preview.style.display = 'flex';
                    }
                });
                gif.render();
            }
        };
        img.src = url;
    });
}

/* ─── Manual GIF encoder fallback (simplified) ─── */
function encodeGifManual(frameDataUrls, delay) {
    const progressFill = document.getElementById('gifProgressFill');
    const progressText = document.getElementById('gifProgressText');
    if(progressText) progressText.textContent = '대체 인코더 사용 중...';

    // Create a simple animated GIF using canvas-to-blob approach
    // We'll use a simpler method: create individual frames as a downloadable zip
    // Actually let's try loading gif.js from alternative CDN
    const script2 = document.createElement('script');
    script2.src = 'https://unpkg.com/gif.js@0.2.0/dist/gif.js';
    script2.onload = function() { doEncode(frameDataUrls, delay); };
    script2.onerror = function() {
        if(progressText) progressText.textContent = 'GIF 라이브러리를 로드할 수 없습니다.';
        setTimeout(function() {
            const bar = document.getElementById('gifProgressBar');
            if(bar) bar.style.display = 'none';
        }, 3000);
        alert('GIF 인코딩 라이브러리를 불러올 수 없습니다. 네트워크를 확인해주세요.');
    };
    document.head.appendChild(script2);
}

/* ─── Download ─── */
window.gifDownload = function() {
    if (!window._gifBlobUrl) return;
    const a = document.createElement('a');
    a.href = window._gifBlobUrl;
    a.download = 'animation_' + Date.now() + '.gif';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

})();
