/* ═══ GIF Maker v1 ═══ */
(function(){
'use strict';
const _t=(k,fb)=>(window.t?window.t(k,fb):fb||k);

const GM = {
    frames: [],       // [{img:Image, canvas:null}]
    overlays: [],     // [{type:'text'|'image'|'sticker', ...props, fabricObj}]
    currentFrame: 0,
    fabricCanvas: null,
    w: 500, h: 500,
    playing: false,
    playTimer: null,
    maxFrames: 30,
    videoFrameCount: 10
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
    // Load Supabase fonts
    if (window.initCanvasFonts && !window.isFontsInitialized) {
        window.initCanvasFonts().then(function(){ loadFonts(); });
    } else {
        loadFonts();
    }
};

window.closeGifMaker = function() {
    const modal = document.getElementById('gifMakerModal');
    if (modal) modal.style.display = 'none';
    if (GM.playTimer) { clearInterval(GM.playTimer); GM.playTimer = null; }
    GM.playing = false;
    // remove key handler
    document.removeEventListener('keydown', gifKeyHandler);
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

/* ─── Mobile bottom sheet drag ─── */
(function() {
    var panel, startY, startTransform, panelH;
    function isMobile() { return window.innerWidth <= 768; }

    document.addEventListener('touchstart', function(e) {
        if (!isMobile()) return;
        panel = document.getElementById('gifLeftPanel');
        if (!panel) return;
        var modal = document.getElementById('gifMakerModal');
        if (!modal || modal.style.display !== 'flex') return;
        // only handle touches on the handle area (top 30px of panel)
        var rect = panel.getBoundingClientRect();
        var touch = e.touches[0];
        if (touch.clientY < rect.top || touch.clientY > rect.top + 30) return;
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

    document.addEventListener('touchend', function(e) {
        if (!panel || startY === undefined || !isMobile()) return;
        panel.style.transition = 'transform 0.3s ease';
        var transform = panel.style.transform;
        var currentY = transform ? parseInt(transform.replace(/[^-\d]/g, '')) || 0 : 0;
        // if dragged more than 40% down, collapse; else snap back
        if (currentY > panelH * 0.4) {
            panel.style.transform = 'translateY(' + (panelH - 40) + 'px)';
        } else {
            panel.style.transform = 'translateY(0)';
        }
        startY = undefined;
        panel = null;
    }, { passive: true });
})();

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
    // Delete key support
    document.addEventListener('keydown', gifKeyHandler);
}

function gifKeyHandler(e) {
    if (!GM.fabricCanvas) return;
    var modal = document.getElementById('gifMakerModal');
    if (!modal || modal.style.display !== 'flex') return;
    // Don't delete while editing text
    var active = GM.fabricCanvas.getActiveObject();
    if (active && active.isEditing) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!active) return;
        e.preventDefault();
        GM.fabricCanvas.remove(active);
        GM.fabricCanvas.discardActiveObject();
        GM.fabricCanvas.renderAll();
        updateTextList();
        updateOverlayImageList();
    }
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
    if (remain <= 0) { alert(_t('gm_max_frames','최대 30장까지 업로드할 수 있습니다.')); input.value=''; return; }
    const toLoad = files.slice(0, remain);
    if (files.length > remain) alert(_t('gm_max_frames_partial','최대 30장까지!')+` ${remain}`+_t('gm_frames_added','장만 추가됩니다.'));
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

/* ─── Video Frame Count Selection ─── */
window.gifSetVideoFrames = function(n) {
    GM.videoFrameCount = n;
    var btns = document.querySelectorAll('#gifVideoFrameOpts .vf-btn');
    btns.forEach(function(btn) {
        var isActive = parseInt(btn.dataset.n) === n;
        btn.style.border = isActive ? '2px solid #f59e0b' : '1px solid #f59e0b';
        btn.style.background = isActive ? 'rgba(245,158,11,0.2)' : '#1e1b4b';
        btn.style.fontWeight = isActive ? '700' : '600';
    });
};

/* ─── Video Upload & Frame Extraction ─── */
window.gifUploadVideo = function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    // Show frame count options
    var opts = document.getElementById('gifVideoFrameOpts');
    if (opts) opts.style.display = 'block';

    var status = document.getElementById('gifVideoStatus');
    if (status) { status.style.display = 'block'; status.textContent = _t('gm_video_loading', '영상 로딩 중...'); }

    var video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    var url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = function() {
        var duration = video.duration;
        if (!duration || !isFinite(duration) || duration < 0.1) {
            if (status) status.textContent = _t('gm_video_error', '영상을 읽을 수 없습니다.');
            URL.revokeObjectURL(url);
            return;
        }

        var frameCount = GM.videoFrameCount || 10;
        var remain = GM.maxFrames - GM.frames.length;
        if (remain <= 0) {
            if (status) status.textContent = _t('gm_max_frames', '최대 프레임 초과');
            URL.revokeObjectURL(url);
            return;
        }
        frameCount = Math.min(frameCount, remain);

        if (status) status.textContent = _t('gm_video_extracting', '프레임 추출 중...') + ' 0/' + frameCount;

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var vw = video.videoWidth || 500;
        var vh = video.videoHeight || 500;
        canvas.width = vw;
        canvas.height = vh;

        // Calculate evenly-spaced time points (avoid last frame = duration)
        var times = [];
        var step = duration / (frameCount + 1);
        for (var i = 1; i <= frameCount; i++) {
            times.push(step * i);
        }

        var extracted = 0;
        var startLen = GM.frames.length;

        function extractNext() {
            if (extracted >= times.length) {
                // done
                URL.revokeObjectURL(url);
                if (status) status.textContent = _t('gm_video_done', '완료!') + ' ' + extracted + _t('gm_video_frames_added', '장 추출됨');
                setTimeout(function() {
                    if (status) status.style.display = 'none';
                }, 2000);
                if (GM.frames.length > 0 && startLen === 0) GM.currentFrame = 0;
                updateFrameUI();
                renderCurrentFrame();
                return;
            }

            video.currentTime = times[extracted];
        }

        video.onseeked = function() {
            try {
                ctx.drawImage(video, 0, 0, vw, vh);
                var dataUrl = canvas.toDataURL('image/png');
                var img = new Image();
                img.onload = function() {
                    GM.frames.push({ img: img, src: dataUrl });
                    extracted++;
                    if (status) status.textContent = _t('gm_video_extracting', '프레임 추출 중...') + ' ' + extracted + '/' + times.length;
                    // Update UI periodically
                    if (extracted % 5 === 0 || extracted === times.length) {
                        updateFrameUI();
                    }
                    extractNext();
                };
                img.src = dataUrl;
            } catch(e) {
                console.warn('Video frame extract error:', e);
                extracted++;
                extractNext();
            }
        };

        extractNext();
    };

    video.onerror = function() {
        if (status) status.textContent = _t('gm_video_error', '영상을 읽을 수 없습니다.');
        URL.revokeObjectURL(url);
    };
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
            html += '<div style="color:#e0e7ff; font-size:13px; font-weight:600;">'+_t('gm_frame','프레임')+' '+(i+1)+'</div>';
            html += '<div style="color:#64748b; font-size:11px;">'+fr.img.naturalWidth+' × '+fr.img.naturalHeight+'</div>';
            html += '</div>';
            html += '<div style="display:flex; flex-direction:column; gap:2px;">';
            if(i>0) html += '<button onclick="window.gifMoveFrame('+i+',-1,event)" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px; font-size:11px;"><i class="fa-solid fa-chevron-up"></i></button>';
            if(i<GM.frames.length-1) html += '<button onclick="window.gifMoveFrame('+i+',1,event)" style="background:none; border:none; color:#94a3b8; cursor:pointer; padding:2px; font-size:11px;"><i class="fa-solid fa-chevron-down"></i></button>';
            html += '</div>';
            html += '<button onclick="window.gifDeleteFrame('+i+',event)" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px; font-size:14px;" title="'+_t('gm_delete','삭제')+'"><i class="fa-solid fa-trash-can"></i></button>';
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
    // Load Supabase data on tab switch
    if (tab === 'sticker') {
        gifRenderStickerGrid();
        if (!GM.elemItems) window.gifInitElementTab();
    }
    if (tab === 'image' && !GM.imgItems) window.gifInitImageTab();
};

/* ─── Emoji Stickers ─── */
const GIF_STICKERS = ['⭐','❤️','🔥','✨','💯','👍','🎉','💡','🎵','🎯','💪','🌟','😊','🎬','📌','🏆','💎','🌈','🎨','👏','🎁','🚀'];
GM.selectedSticker = '⭐';

function gifRenderStickerGrid() {
    var grid = document.getElementById('gifStickerGrid');
    if (!grid) return;
    var html = '';
    GIF_STICKERS.forEach(function(s) {
        var active = GM.selectedSticker === s;
        html += '<button onclick="window.gifPickSticker(\'' + s + '\')" style="padding:6px; border:1px solid ' + (active ? '#a855f7' : '#374151') + '; border-radius:6px; background:' + (active ? '#1e1b4b' : '#111827') + '; font-size:18px; cursor:pointer; text-align:center; transition:all 0.15s;">' + s + '</button>';
    });
    grid.innerHTML = html;
}

window.gifPickSticker = function(emoji) {
    GM.selectedSticker = emoji;
    gifRenderStickerGrid();
};

window.gifPlaceSticker = function() {
    if (!GM.fabricCanvas) return;
    var emoji = GM.selectedSticker || '⭐';
    var text = new fabric.IText(emoji, {
        left: GM.w / 2 - 20,
        top: GM.h / 2 - 20,
        fontSize: Math.round(GM.w * 0.1),
        fontFamily: 'sans-serif',
        fill: '#ffffff',
        stroke: null,
        strokeWidth: 0,
        editable: false,
        selectable: true
    });
    GM.fabricCanvas.add(text);
    GM.fabricCanvas.setActiveObject(text);
    GM.fabricCanvas.renderAll();
};

/* ─── Text Overlays ─── */
window.gifAddText = function() {
    if (!GM.fabricCanvas) return;
    const text = new fabric.IText(_t('gm_text','텍스트'), {
        left: GM.w / 2 - 50,
        top: GM.h / 2 - 20,
        fontFamily: document.getElementById('gifFontSelect').value || 'Arial',
        fontSize: parseInt(document.getElementById('gifFontSize').value) || 32,
        fill: document.getElementById('gifFontColor').value || '#ffffff',
        stroke: null,
        strokeWidth: 0,
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
    var sw = parseInt(document.getElementById('gifStrokeWidth').value) || 0;
    obj.set({
        fontFamily: document.getElementById('gifFontSelect').value,
        fontSize: parseInt(document.getElementById('gifFontSize').value) || 32,
        fill: document.getElementById('gifFontColor').value,
        stroke: sw > 0 ? document.getElementById('gifStrokeColor').value : null,
        strokeWidth: sw
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

/* ─── Helper: best image URL from library item ─── */
function gifBestUrl(item) {
    if (!item) return '';
    if (item.thumb_url) return item.thumb_url;
    if (item.data_url && /^https?:\/\//.test(item.data_url)) return item.data_url;
    if (item.data_url && typeof item.data_url === 'string') {
        try {
            var parsed = JSON.parse(item.data_url);
            if (parsed.objects) {
                for (var i = 0; i < parsed.objects.length; i++) {
                    if (parsed.objects[i].src) return parsed.objects[i].src;
                }
            }
        } catch(e){}
    }
    return item.data_url || '';
}

/* ─── Image Templates (from Supabase library) ─── */
GM.imgItems = null; GM.imgPage = 0;

function loadEmojis() { /* placeholder - now using Supabase elements */ }

window.gifInitImageTab = function() {
    GM.imgItems = null; GM.imgPage = 0;
    gifLoadImages(null);
};

async function gifLoadImages(search) {
    var grid = document.getElementById('gifImgGrid'); if (!grid) return;
    var sb = window.sb;
    if (!sb) { grid.innerHTML = '<p style="color:#64748b; text-align:center;">'+_t('gm_no_db','DB 연결 없음')+'</p>'; return; }
    try {
        var q = sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['user_image','photo-bg','text'])
            .order('created_at', { ascending: false })
            .range(0, 11);
        if (search) q = q.ilike('tags', '%' + search + '%');
        var res = await q;
        if (res.error) throw res.error;
        GM.imgItems = res.data || [];
        GM.imgPage = 1;
        gifRenderImgGrid(grid);
    } catch(e) {
        console.warn('GIF image load error:', e);
        grid.innerHTML = '<p style="color:#ef4444; text-align:center;">'+_t('gm_load_fail','로드 실패')+'</p>';
    }
}

function gifRenderImgGrid(grid) {
    if (!GM.imgItems || !GM.imgItems.length) { grid.innerHTML = '<p style="color:#64748b; text-align:center;">'+_t('gm_no_images','이미지 없음')+'</p>'; return; }
    var html = '';
    GM.imgItems.forEach(function(item, idx) {
        var url = gifBestUrl(item);
        html += '<div onclick="window.gifAddLibImage('+idx+')" style="border-radius:10px; overflow:hidden; cursor:pointer; border:2px solid transparent; transition:border-color 0.15s; background:#111827;" onmouseenter="this.style.borderColor=\'#ec4899\'" onmouseleave="this.style.borderColor=\'transparent\'">';
        html += '<img src="'+url+'" loading="lazy" style="width:100%; aspect-ratio:1; object-fit:cover; display:block;">';
        html += '</div>';
    });
    grid.innerHTML = html;
}

window.gifLoadMoreImages = async function() {
    if (!window.sb || !GM.imgItems) return;
    var page = GM.imgPage || 1;
    try {
        var res = await window.sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['user_image','photo-bg','text'])
            .order('created_at', { ascending: false })
            .range(page * 12, (page + 1) * 12 - 1);
        if (!res.error && res.data && res.data.length) {
            GM.imgItems = GM.imgItems.concat(res.data);
            GM.imgPage = page + 1;
            var grid = document.getElementById('gifImgGrid');
            if (grid) gifRenderImgGrid(grid);
        }
    } catch(e){}
};

window.gifSearchImages = function(q) {
    clearTimeout(GM._imgSearchTimer);
    GM._imgSearchTimer = setTimeout(function(){ GM.imgItems = null; gifLoadImages(q || null); }, 400);
};

window.gifAddLibImage = function(idx) {
    if (!GM.fabricCanvas) return;
    var item = GM.imgItems && GM.imgItems[idx];
    if (!item) return;
    var url = gifBestUrl(item);
    fabric.Image.fromURL(url, function(img) {
        var maxDim = Math.min(GM.w, GM.h) * 0.5;
        var scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        img.set({ left: GM.w/2, top: GM.h/2, originX:'center', originY:'center', scaleX: scale, scaleY: scale });
        GM.fabricCanvas.add(img);
        GM.fabricCanvas.setActiveObject(img);
        GM.fabricCanvas.renderAll();
    }, { crossOrigin: 'anonymous' });
};

/* ─── Elements / Stickers (from Supabase library) ─── */
GM.elemItems = null; GM.elemPage = 0;

window.gifInitElementTab = function() {
    GM.elemItems = null; GM.elemPage = 0;
    gifLoadElements(null);
};

async function gifLoadElements(search) {
    var grid = document.getElementById('gifElemGrid'); if (!grid) return;
    var sb = window.sb;
    if (!sb) { grid.innerHTML = '<p style="color:#64748b; text-align:center;">'+_t('gm_no_db','DB 연결 없음')+'</p>'; return; }
    try {
        var q = sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
            .order('created_at', { ascending: false })
            .range(0, 11);
        if (search) q = q.ilike('tags', '%' + search + '%');
        var res = await q;
        if (res.error) throw res.error;
        GM.elemItems = res.data || [];
        GM.elemPage = 1;
        gifRenderElemGrid(grid);
    } catch(e) {
        console.warn('GIF element load error:', e);
        grid.innerHTML = '<p style="color:#ef4444; text-align:center;">'+_t('gm_load_fail','로드 실패')+'</p>';
    }
}

function gifRenderElemGrid(grid) {
    if (!GM.elemItems || !GM.elemItems.length) { grid.innerHTML = '<p style="color:#64748b; text-align:center;">'+_t('gm_no_elements','요소 없음')+'</p>'; return; }
    var html = '';
    GM.elemItems.forEach(function(item, idx) {
        var url = gifBestUrl(item);
        html += '<div onclick="window.gifAddLibElement('+idx+')" style="border-radius:10px; overflow:hidden; cursor:pointer; border:2px solid transparent; transition:border-color 0.15s; background:#111827;" onmouseenter="this.style.borderColor=\'#a855f7\'" onmouseleave="this.style.borderColor=\'transparent\'">';
        html += '<img src="'+url+'" loading="lazy" style="width:100%; aspect-ratio:1; object-fit:contain; display:block; padding:4px;">';
        html += '</div>';
    });
    grid.innerHTML = html;
}

window.gifLoadMoreElements = async function() {
    if (!window.sb || !GM.elemItems) return;
    var page = GM.elemPage || 1;
    try {
        var res = await window.sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['vector','user_vector','graphic','transparent-graphic','pattern','logo'])
            .order('created_at', { ascending: false })
            .range(page * 12, (page + 1) * 12 - 1);
        if (!res.error && res.data && res.data.length) {
            GM.elemItems = GM.elemItems.concat(res.data);
            GM.elemPage = page + 1;
            var grid = document.getElementById('gifElemGrid');
            if (grid) gifRenderElemGrid(grid);
        }
    } catch(e){}
};

window.gifSearchElements = function(q) {
    clearTimeout(GM._elemSearchTimer);
    GM._elemSearchTimer = setTimeout(function(){ GM.elemItems = null; gifLoadElements(q || null); }, 400);
};

window.gifAddLibElement = function(idx) {
    if (!GM.fabricCanvas) return;
    var item = GM.elemItems && GM.elemItems[idx];
    if (!item) return;
    var url = gifBestUrl(item);
    fabric.Image.fromURL(url, function(img) {
        var maxDim = Math.min(GM.w, GM.h) * 0.35;
        var scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        img.set({ left: GM.w/2, top: GM.h/2, originX:'center', originY:'center', scaleX: scale, scaleY: scale });
        GM.fabricCanvas.add(img);
        GM.fabricCanvas.setActiveObject(img);
        GM.fabricCanvas.renderAll();
    }, { crossOrigin: 'anonymous' });
};

function updateOverlayImageList() { /* no-op, using Supabase grid */ }

/* ─── Fonts (Supabase DYNAMIC_FONTS) ─── */
function loadFonts() {
    const select = document.getElementById('gifFontSelect');
    if (!select) return;
    const defaultFonts = ['Arial','Impact','Georgia','Comic Sans MS','Verdana','Courier New','Times New Roman'];
    let html = '';
    // Supabase + Google fonts
    if (window.DYNAMIC_FONTS && window.DYNAMIC_FONTS.length > 0) {
        window.DYNAMIC_FONTS.forEach(function(f) {
            html += '<option value="'+f.font_family+'" style="font-family:\''+f.font_family+'\'">'+f.font_name+'</option>';
        });
    }
    // fallback defaults
    defaultFonts.forEach(function(f) {
        html += '<option value="'+f+'">'+f+'</option>';
    });
    select.innerHTML = html;
}

/* ─── Save overlay positions ─── */
function saveOverlayPositions() {
    // no-op for now; fabric manages state internally
}

/* ─── Play Preview ─── */
window.gifPlayPreview = function() {
    if (GM.frames.length < 2) { alert(_t('gm_need_2_frames','프레임을 2장 이상 추가해주세요.')); return; }
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
    if (GM.frames.length < 1) { alert(_t('gm_need_frames','프레임을 추가해주세요.')); return; }
    // stop preview if playing
    if (GM.playing) window.gifPlayPreview();

    const progressBar = document.getElementById('gifProgressBar');
    const progressFill = document.getElementById('gifProgressFill');
    const progressText = document.getElementById('gifProgressText');
    if(progressBar) progressBar.style.display = 'block';
    if(progressFill) progressFill.style.width = '0%';
    if(progressText) progressText.textContent = _t('gm_preparing','GIF 생성 준비 중...');

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
        if(progressText) progressText.textContent = _t('gm_frame','프레임')+' ' + (idx+1) + '/' + GM.frames.length + ' '+_t('gm_rendering','렌더링 중...');
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
    if(progressText) progressText.textContent = _t('gm_encoding','GIF 인코딩 중...');
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
        workerScript: './gif.worker.js'
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
                    if(progressText) progressText.textContent = _t('gm_encoding','GIF 인코딩 중...')+' ' + Math.round(p*100) + '%';
                });
                gif.on('finished', function(blob) {
                    if(progressFill) progressFill.style.width = '100%';
                    if(progressText) progressText.textContent = _t('gm_done','완료!');
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
    if(progressText) progressText.textContent = _t('gm_fallback_encoder','대체 인코더 사용 중...');

    // Create a simple animated GIF using canvas-to-blob approach
    // We'll use a simpler method: create individual frames as a downloadable zip
    // Actually let's try loading gif.js from alternative CDN
    const script2 = document.createElement('script');
    script2.src = 'https://unpkg.com/gif.js@0.2.0/dist/gif.js';
    script2.onload = function() { doEncode(frameDataUrls, delay); };
    script2.onerror = function() {
        if(progressText) progressText.textContent = _t('gm_lib_load_fail','GIF 라이브러리를 로드할 수 없습니다.');
        setTimeout(function() {
            const bar = document.getElementById('gifProgressBar');
            if(bar) bar.style.display = 'none';
        }, 3000);
        alert(_t('gm_lib_load_fail_alert','GIF 인코딩 라이브러리를 불러올 수 없습니다. 네트워크를 확인해주세요.'));
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
