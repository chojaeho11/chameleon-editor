// canvas-ai.js
import { canvas } from "./canvas-core.js?v=123";
import { sb, currentUser } from "./config.js?v=123";

// ==========================================================
// [유틸] DB secrets 테이블에서 API 키 가져오기
// ==========================================================
async function getApiKey(keyName) {
    if (!sb) {
        console.error("Supabase 클라이언트가 초기화되지 않았습니다.");
        return null;
    }
    const { data, error } = await sb
        .from('secrets') 
        .select('value')
        .eq('name', keyName)
        .single();

    if (error || !data) {
        console.error(`API Key(${keyName}) 로드 실패:`, error);
        return null;
    }
    return data.value;
}

// ==========================================================
// [코어] Flux 이미지 생성
// ==========================================================
async function generateImageCore(prompt) {
    if (!sb) throw new Error("Supabase connection failed");
    const { data, error } = await sb.functions.invoke('generate-image-flux', {
        body: { prompt: prompt, ratio: "1:1" }
    });
    if (error) throw new Error(error.message);
    let rawUrl = data.imageUrl || data;
    if (Array.isArray(rawUrl)) rawUrl = rawUrl[0];
    if (typeof rawUrl === 'object' && rawUrl.url) rawUrl = rawUrl.url;
    return rawUrl;
}

// ==========================================================
// [메인] AI 도구 초기화
// ==========================================================
export function initAiTools() {
    
    // --- 1. 시작 화면 (AI 생성) ---
    window.openAiStartModal = function() {
        const modal = document.getElementById('aiStartModal');
        const promptInput = document.getElementById('aiStartPrompt');
        const startResult = document.getElementById('aiStartResult');
        const btnStartGo = document.getElementById('btnAiStartGo');
        const btnStartGen = document.getElementById('btnAiStartGen');

        if(startResult) startResult.innerHTML = `<span style="color:#cbd5e1;">${window.t('msg_image_placeholder', 'Image will appear here')}</span>`;
        if(btnStartGo) btnStartGo.style.display = 'none';
        if(btnStartGen) btnStartGen.disabled = false;
        if(promptInput) promptInput.value = '';
        window.pendingAiImage = null;
        if (modal) {
            modal.style.display = 'flex';
            if(promptInput) setTimeout(() => promptInput.focus(), 100);
        }
    };

    const btnStartGen = document.getElementById('btnAiStartGen');
    const startPrompt = document.getElementById('aiStartPrompt');
    const startResult = document.getElementById('aiStartResult');
    const btnStartGo = document.getElementById('btnAiStartGo');
    // 번역 헬퍼 (없을 경우 텍스트 그대로 반환)
    const t = (k, def) => (window.t ? window.t(k) : def);

    if (btnStartGen) {
        btnStartGen.onclick = async () => {
            const text = startPrompt.value.trim();
            if (!text) return alert(t('msg_input_desc', "Please enter a description."));
            
            const loadingText = t('msg_generating', "AI is generating...");
            startResult.innerHTML = `<div class="loading-spin" style="width:40px; height:40px;"></div><p style="margin-top:10px; color:#666;">${loadingText}</p>`;
            
            btnStartGen.disabled = true;
            try {
                const imageUrl = await generateImageCore(text);
                window.pendingAiImage = imageUrl;
                startResult.innerHTML = `<img src="${imageUrl}" style="max-height:250px; object-fit:contain; border-radius:8px;">`;
                btnStartGo.style.display = 'flex';
                const retryText = t('btn_retry', "Generate Again");
                btnStartGo.innerHTML = `<i class="fa-solid fa-rotate-right"></i> ${retryText}`;
            } catch (e) {
                alert(t('msg_gen_fail', "Generation failed") + ": " + e.message);
                startResult.innerHTML = '<span style="color:red;">Failed</span>';
                btnStartGen.disabled = false;
            }
        };
    }
    if (btnStartGo) {
        btnStartGo.onclick = () => {
            if(startResult) startResult.innerHTML = `<span style="color:#cbd5e1;">${window.t('msg_image_placeholder', 'Image will appear here')}</span>`;
            btnStartGo.style.display = 'none';
            if(btnStartGen) btnStartGen.disabled = false;
            if(startPrompt) { startPrompt.value = ''; startPrompt.focus(); }
        };
    }

    // --- 2. 에디터 내부 (AI 생성) ---
    const btnAIBox = document.getElementById("btnAIBox");
    const aiDrawer = document.getElementById("aiDrawer");
    if (btnAIBox && aiDrawer) btnAIBox.onclick = () => aiDrawer.classList.add("open");

    const btnGen = document.getElementById("aiGenerateBtn");
    const promptInput = document.getElementById("aiPrompt");
    const resultArea = document.getElementById("aiResultArea");
    const btnUse = document.getElementById("aiUseBtn");
    let internalGeneratedUrl = null; 

    if (btnGen) {
        btnGen.onclick = async () => {
            const userText = promptInput.value.trim();
            // [수정] 다국어 적용
            if (!userText) return alert(window.t('msg_input_desc', "Description required"));
            resultArea.innerHTML = `<div class="loading-spin"></div><p>${window.t('msg_generating', 'Generating...')}</p>`;
            btnUse.style.display = "none";
            btnGen.disabled = true;
            try {
                const imageUrl = await generateImageCore(userText);
                internalGeneratedUrl = imageUrl;
                resultArea.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;">`;
                btnUse.style.display = "block";
            } catch (e) {
                alert(window.t('msg_failed', 'Failed: ') + e.message);
            } finally {
                btnGen.disabled = false;
            }
        };
    }
    if (btnUse) {
        btnUse.onclick = () => {
            if (!internalGeneratedUrl) return;
            fabric.Image.fromURL(internalGeneratedUrl, (img) => {
                if(img) {
                    img.scaleToWidth(500);
                    img.set('isAiGenerated', true);
                    canvas.add(img);
                    canvas.centerObject(img);
                    canvas.setActiveObject(img);
                    aiDrawer.classList.remove("open");
                }
            }, { crossOrigin: 'anonymous' });
        };
    }
    
    // --- 3. 배경 제거 (수정됨: 고해상도 유지) ---
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = async () => {
            const active = canvas.getActiveObject();
            
            // [수정] 다국어 적용 (전역 window.t 사용)
            if (!active || active.type !== 'image') return alert(window.t('msg_select_image', "Please select an image."));
            const key = await getApiKey('REMOVE_BG_API_KEY');
            if (!key) return alert("API Key Error");
            
            if(!confirm(window.t('confirm_bg_remove', "Remove the background?"))) return;
            
            const originalText = btnCutout.innerText;
            btnCutout.innerText = window.t('msg_processing', "Processing...");
            try {
                // 1. 원본 해상도 추출 (multiplier 중요)
                // 화면에 보이는 크기가 아니라, 원본 파일의 크기를 계산해서 가져옵니다.
                const restoreScale = 1 / active.scaleX; 
                const imgData = active.toDataURL({ format: 'png', multiplier: restoreScale });
                
                const blob = await (await fetch(imgData)).blob();
                const form = new FormData();
                form.append('image_file', blob);
                
                // ★ [핵심 수정] size: 'auto' -> 'full' 로 변경
                // 'full' 옵션은 Remove.bg 유료 크레딧(1크레딧)을 소모하지만 원본 해상도를 유지합니다.
                // 무료 계정은 월 1회만 full 지원하며 이후엔 작은 크기로 올 수 있습니다.
                form.append('size', 'full'); 
                
                const res = await fetch('https://api.remove.bg/v1.0/removebg', {
                    method: 'POST', headers: { 'X-Api-Key': key }, body: form
                });

                if(!res.ok) {
                    const errTxt = await res.text();
                    // 무료 계정 제한 등으로 'full'이 안 될 경우 재시도 안내
                    if(res.status === 402 || errTxt.includes("credits")) {
                        throw new Error(window.t('msg_credits_insufficient', "Insufficient credits for high-res conversion (free account limit)"));
                    }
                    throw new Error(errTxt);
                }
                
                const url = URL.createObjectURL(await res.blob());
                fabric.Image.fromURL(url, (newImg) => {
                    // 위치는 그대로 유지
                    newImg.set({ 
                        left: active.left, 
                        top: active.top,
                        angle: active.angle,
                        originX: active.originX,
                        originY: active.originY
                    });

                    // ★ 크기 조정 로직 변경
                    // 배경 제거된 이미지가 원본 해상도로 돌아오면, 
                    // 화면상에서는 너무 커보일 수 있으므로 '이전 객체의 시각적 크기'에 맞춥니다.
                    const visualWidth = active.getScaledWidth();
                    const visualHeight = active.getScaledHeight();
                    
                    newImg.scaleToWidth(visualWidth);
                    newImg.scaleToHeight(visualHeight);

                    canvas.remove(active);
                    canvas.add(newImg);
                    canvas.setActiveObject(newImg);
                    canvas.requestRenderAll();
                    alert(window.t('msg_upload_success', "Success!"));
                });
            } catch(e) { 
                console.error(e);
                alert(window.t('msg_failed', "Failed: ") + e.message); 
            }
            finally { btnCutout.innerText = originalText; }
        };
    }

    // --- 4. A3 고해상도 업스케일링 ---
    const btnUpscale = document.getElementById("btnUpscale");
    if (btnUpscale) {
        btnUpscale.onclick = async () => {
            const active = canvas.getActiveObject();

            // [수정] 다국어 적용
            if (!active || active.type !== 'image') return alert(window.t('msg_select_image', "Please select an image!"));
            
            const confirmMsg = window.t('confirm_upscale', "Upscale resolution by 2x?");
            if (!confirm(confirmMsg)) return;

            const originalText = btnUpscale.innerText;
            btnUpscale.innerText = window.t('msg_sending', "Sending...");
            btnUpscale.disabled = true;

            try {
                // 이미지 크기 최적화 및 압축 전송
                const maxDim = 1200; 
                const curW = active.width * active.scaleX;
                const curH = active.height * active.scaleY;
                let mult = 1;
                
                if (curW > maxDim || curH > maxDim) {
                    mult = maxDim / Math.max(curW, curH);
                }

                const imageUrl = active.toDataURL({ 
                    format: 'jpeg', 
                    quality: 0.6, 
                    multiplier: mult 
                });
                
                const { data, error } = await sb.functions.invoke('upscale-image', {
                    body: { image: imageUrl, scale: 2 }
                });

                if (error) {
                    let msg = error.message;
                    try { msg = JSON.parse(error.message).error; } catch(e){}
                    throw new Error(msg);
                }
                
                const newUrl = data.url || data.imageUrl || data;
                if (!newUrl) throw new Error(window.t('msg_no_result_url', "No result URL"));

                fabric.Image.fromURL(newUrl, (newImg) => {
                    if (!newImg) return alert(window.t('msg_image_load_failed', "Image load failed"));
                    newImg.set({
                        left: active.left, top: active.top,
                        angle: active.angle,
                        originX: active.originX, originY: active.originY
                    });
                    newImg.scaleToWidth(curW);
                    newImg.scaleToHeight(curH);

                    canvas.remove(active);
                    canvas.add(newImg);
                    canvas.setActiveObject(newImg);
                    canvas.requestRenderAll();
                    alert("🎉 " + window.t('msg_upload_success', "Success!"));
                }, { crossOrigin: 'anonymous' });

            } catch (e) {
                console.error("업스케일링 실패:", e);
                alert(window.t('msg_failed', "Failed: ") + e.message);
            } finally {
                btnUpscale.innerText = originalText;
                btnUpscale.disabled = false;
            }
        };
    }

    // ============================================================
    // [5] AI Design Wizard (디자인 마법사)
    // ============================================================
    window.openDesignWizard = function() {
        const modal = document.getElementById('designWizardModal');
        const input = document.getElementById('wizardTitleInput');
        const prog  = document.getElementById('wizardProgressArea');
        const btn   = document.getElementById('btnWizardGenerate');
        if (input) input.value = '';
        if (prog)  prog.style.display = 'none';
        if (btn) { btn.disabled = false; btn.querySelector('span').textContent = window.t?.('wizard_generate','디자인 생성하기') || '디자인 생성하기'; }
        if (modal) { modal.style.display = 'flex'; setTimeout(() => input?.focus(), 150); }
    };

    // Style toggle
    document.querySelectorAll('.wizard-style-btn').forEach(b => {
        b.onclick = () => {
            document.querySelectorAll('.wizard-style-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
        };
    });

    // Generate button
    const btnWizGen = document.getElementById('btnWizardGenerate');
    if (btnWizGen) {
        btnWizGen.onclick = async () => {
            const title = document.getElementById('wizardTitleInput')?.value.trim();
            if (!title) return alert(window.t?.('msg_input_desc','제목을 입력해주세요') || '제목을 입력해주세요');
            const styleBtn = document.querySelector('.wizard-style-btn.active');
            const style = styleBtn?.dataset.style || 'modern';
            btnWizGen.disabled = true;
            btnWizGen.innerHTML = '<div class="loading-spin" style="width:20px;height:20px;border-width:3px;"></div>';
            document.getElementById('wizardProgressArea').style.display = 'block';
            try {
                await runDesignWizard(title, style);
                document.getElementById('designWizardModal').style.display = 'none';
            } catch(e) {
                console.error('Wizard error:', e);
                alert(window.t?.('msg_failed','Failed: ') + e.message);
            } finally {
                btnWizGen.disabled = false;
                btnWizGen.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>' + (window.t?.('wizard_generate','디자인 생성하기') || '디자인 생성하기') + '</span>';
            }
        };
    }

    // Enter key trigger
    const wizInput = document.getElementById('wizardTitleInput');
    if (wizInput) wizInput.onkeydown = (e) => { if (e.key === 'Enter') btnWizGen?.click(); };
}

// ============================================================
// [Design Wizard] Core logic
// ============================================================
const WIZARD_STYLES = {
    modern:  { titleFont:'Gothic A1', titleWeight:'900', titleColor:'#1e293b', subColor:'#64748b', accent:'#6366f1', rectFill:'rgba(99,102,241,0.07)', rectStroke:'rgba(99,102,241,0.3)' },
    elegant: { titleFont:'Noto Serif KR', titleWeight:'900', titleColor:'#1a1a2e', subColor:'#4a4a6a', accent:'#d4af37', rectFill:'rgba(212,175,55,0.06)', rectStroke:'rgba(212,175,55,0.3)' },
    playful: { titleFont:'Jua', titleWeight:'400', titleColor:'#e11d48', subColor:'#64748b', accent:'#f43f5e', rectFill:'rgba(244,63,94,0.07)', rectStroke:'rgba(244,63,94,0.3)' },
    minimal: { titleFont:'Noto Sans KR', titleWeight:'700', titleColor:'#111827', subColor:'#9ca3af', accent:'#374151', rectFill:'rgba(55,65,81,0.04)', rectStroke:'rgba(55,65,81,0.2)' }
};

// Extract meaningful keywords from title
// 한국어 복합어 처리: "고기집" → ["고기"], "카페오픈" → ["카페"]
function _wzExtractKeywords(title) {
    const words = title.replace(/[!@#$%^&*(),.?":{}|<>~`]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    if (!words.length) return [title];

    // 한국어 접미사 제거 (집, 점, 관, 원, 소, 실, 당, 방, 장)
    const suffixes = ['집','점','관','원','소','실','당','방','장'];
    // 한국어 조사/어미 제거
    const particles = ['을','를','이','가','은','는','에','의','로','와','과','도','만','까지','에서','부터','처럼','같이','보다'];
    // 일반 동사/형용사 어미
    const verbEndings = ['하기','만들기','오픈','세일','이벤트','행사','축하','파티','홍보','안내','소개'];

    const results = [];
    for (const w of words) {
        let root = w;
        // 조사 제거
        for (const p of particles) {
            if (root.length > p.length + 1 && root.endsWith(p)) {
                root = root.slice(0, -p.length);
                break;
            }
        }
        // 접미사 제거 (2글자 이상 남을 때만)
        for (const s of suffixes) {
            if (root.length > s.length + 1 && root.endsWith(s)) {
                root = root.slice(0, -s.length);
                break;
            }
        }
        if (root.length >= 2) results.push(root);
        // 원본도 추가 (root와 다르면)
        if (w !== root && w.length >= 2) results.push(w);
    }
    // 동사/명사 키워드는 검색 우선순위 높게
    // 중복 제거
    return [...new Set(results.length > 0 ? results : [title])];
}

function _wzSteps() {
    const t = (k,d) => window.t?.(k,d) || d;
    return [
        t('wizard_step_bg',       '배경 검색 중...'),
        t('wizard_step_title',    '제목 배치 중...'),
        t('wizard_step_desc',     '설명 생성 중...'),
        t('wizard_step_elements', '디자인 요소 추가 중...'),
        t('wizard_step_shapes',   '장식 완성 중...')
    ];
}

function _wzRender(steps, idx) {
    const el = document.getElementById('wizardStepList'); if (!el) return;
    el.innerHTML = steps.map((s,i) => {
        const cls = i < idx ? 'done' : i === idx ? 'active' : '';
        const ico = i < idx ? '<i class="fa-solid fa-check"></i>' : i === idx ? '<div class="loading-spin" style="width:14px;height:14px;border-width:2px;"></div>' : (i+1);
        return `<div class="wizard-step ${cls}"><span class="step-icon">${ico}</span>${s}</div>`;
    }).join('');
    const bar = document.getElementById('wizardProgressBar');
    if (bar) bar.style.width = Math.min(100, ((idx+1)/steps.length)*100) + '%';
}

async function runDesignWizard(title, style) {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) throw new Error('No canvas board');
    const bW = board.width * (board.scaleX||1), bH = board.height * (board.scaleY||1);
    const bL = board.left, bT = board.top;
    const S = WIZARD_STYLES[style] || WIZARD_STYLES.modern;
    const steps = _wzSteps();

    // ★ 기존 오브젝트 모두 삭제 (보드, 고정 오버레이 제외)
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // Resolve font by country
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const fontMap = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
    const titleFont = fontMap[country] || S.titleFont;
    const descFont = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Noto Sans KR';

    // Preload Google Fonts
    [titleFont, descFont].forEach(f => {
        const fUrl = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f) + ':wght@400;700;900&display=swap';
        if (!document.querySelector(`link[href="${fUrl}"]`)) {
            const lk = document.createElement('link'); lk.rel='stylesheet'; lk.href=fUrl; document.head.appendChild(lk);
        }
    });
    await new Promise(r => setTimeout(r, 500));

    const keywords = _wzExtractKeywords(title);

    // ─── Step 1: Background (template 방식) ───
    _wzRender(steps, 0);
    await _wzBg(keywords, bW, bH, bL, bT);

    // ─── Step 2: Title ───
    _wzRender(steps, 1);
    _wzTitle(title, titleFont, S, bW, bH, bL, bT);

    // ─── Step 3: Description (하단 박스 안에 삽입) ───
    _wzRender(steps, 2);
    const descText = await _wzGetDescText(title);
    _wzBottomBox(descText, S, descFont, bW, bH, bL, bT);

    // ─── Step 4: Elements (제목 위에 배치) ───
    _wzRender(steps, 3);
    await _wzElem(keywords, bW, bH, bL, bT);

    // ─── Step 5: Shapes (악센트 라인) ───
    _wzRender(steps, 4);
    _wzShapes(S, bW, bH, bL, bT);

    _wzRender(steps, 5);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
}

// ─── Step 1: Background (data_url 우선 → thumb_url 폴백) ───
async function _wzBg(keywords, bW, bH, bL, bT) {
    if (!sb) return;

    // 1. 키워드로 템플릿 검색 (ID + thumb_url)
    let found = null;
    for (const kw of keywords) {
        const res = await sb.from('library')
            .select('id, thumb_url')
            .in('category', ['user_image','photo-bg'])
            .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(1);
        if (res.data && res.data.length) { found = res.data[0]; break; }
    }
    if (!found) {
        const r2 = await sb.from('library')
            .select('id, thumb_url')
            .in('category', ['user_image','photo-bg','pattern'])
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(1);
        if (r2.data && r2.data.length) found = r2.data[0];
    }
    if (!found) return;

    // 2. data_url 별도 조회 → 이미지 URL 추출
    let cleanUrl = '';
    try {
        const { data: fullData } = await sb.from('library')
            .select('data_url')
            .eq('id', found.id)
            .single();
        if (fullData && fullData.data_url) {
            const raw = fullData.data_url;
            if (typeof raw === 'string') {
                try {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed === 'string' && parsed.startsWith('http')) cleanUrl = parsed;
                } catch(e) {
                    if (raw.startsWith('http')) cleanUrl = raw;
                }
            }
        }
    } catch(e) { /* fallback to thumb */ }

    // 3. data_url에서 이미지 URL을 못 얻으면 → thumb_url 사용
    if (!cleanUrl) cleanUrl = found.thumb_url;
    if (!cleanUrl) return;
    cleanUrl = String(cleanUrl).trim().replace(/^"|"$/g, '');

    return new Promise(resolve => {
        fabric.Image.fromURL(cleanUrl, img => {
            if (!img) { resolve(); return; }
            const scale = Math.max(bW / img.width, bH / img.height);
            img.set({
                scaleX: scale, scaleY: scale,
                left: bL + bW/2, top: bT + bH/2,
                originX:'center', originY:'center',
                selectable: true, evented: true,
                opacity: 1.0
            });
            canvas.add(img);
            canvas.sendToBack(img);
            const board = canvas.getObjects().find(o => o.isBoard);
            if (board) canvas.sendToBack(board);
            resolve();
        }, { crossOrigin:'anonymous' });
    });
}

// ─── Step 2: Title text (자간 축소, 10자 이상은 2줄) ───
function _wzTitle(title, font, S, bW, bH, bL, bT) {
    // 10글자 이상이면 자연스러운 위치에서 줄바꿈
    let displayTitle = title;
    if (title.length > 10) {
        // 공백이 있으면 중간 공백에서 줄바꿈
        const spaceIdx = title.indexOf(' ', Math.floor(title.length * 0.35));
        if (spaceIdx > 0 && spaceIdx < title.length * 0.75) {
            displayTitle = title.substring(0, spaceIdx) + '\n' + title.substring(spaceIdx + 1);
        } else {
            // 공백 없으면 중간에서 강제 줄바꿈
            const mid = Math.ceil(title.length / 2);
            displayTitle = title.substring(0, mid) + '\n' + title.substring(mid);
        }
    }

    const sz = Math.round(bW * 0.09);
    const obj = new fabric.Textbox(displayTitle, {
        fontFamily: font, fontSize: sz, fontWeight: S.titleWeight || '900',
        fill: S.titleColor, originX:'center', originY:'center',
        textAlign:'center',
        left: bL + bW/2, top: bT + bH * 0.42,
        width: bW * 0.85,
        lineHeight: 1.15,
        shadow: new fabric.Shadow({ color:'rgba(0,0,0,0.15)', blur:8, offsetX:2, offsetY:2 }),
        charSpacing: -10
    });
    // auto-shrink if too wide
    if (obj.width > bW * 0.85) obj.set('fontSize', Math.round(sz * (bW*0.85) / obj.width));
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 3a: AI 설명 텍스트 생성 (텍스트만 반환) ───
async function _wzGetDescText(title) {
    let text = '';
    const c = window.SITE_CONFIG?.COUNTRY || 'KR';
    try {
        const langPrompts = {
            KR: `"${title}" 관련 홍보/소개 문구를 3~4줄(200자 이내)로 작성해주세요. 감성적이고 전문적인 느낌으로. 텍스트만 반환.`,
            JP: `「${title}」に関するプロモーション文を3〜4行（200文字以内）で書いてください。感性的でプロフェッショナルに。テキストのみ返してください。`,
            US: `Write a 3-4 line promotional text about "${title}" (under 200 chars). Make it emotional and professional. Return text only.`
        };
        const { data, error } = await sb.functions.invoke('generate-text', {
            body: { prompt: langPrompts[c] || langPrompts['US'], max_tokens: 200 }
        });
        if (!error && data) text = (typeof data === 'string' ? data : data.text || data.result || '').trim();
    } catch(e) { /* fallback */ }

    if (!text || text.length < 10) {
        const fb = {
            KR: [
                `특별한 순간을 위한 최고의 선택.\n감각적인 디자인과 프리미엄 퀄리티로\n당신의 소중한 순간을 더욱 빛나게 만들어 드립니다.\n지금 바로 경험해 보세요.`,
                `당신만을 위한 특별한 공간.\n세심한 서비스와 따뜻한 감성이 어우러진\n잊을 수 없는 경험을 선사합니다.\n새로운 시작을 함께하세요.`
            ],
            JP: [
                `特別な瞬間のための最高の選択。\n感性的なデザインとプレミアムクオリティで\nあなたの大切な瞬間をより輝かせます。\n今すぐ体験してください。`,
                `あなただけの特別な空間。\n細やかなサービスと温かい感性が調和した\n忘れられない体験をお届けします。\n新しい始まりを一緒に。`
            ],
            US: [
                `The perfect choice for your special moment.\nElevated design meets premium quality\nto make your precious occasions truly shine.\nExperience it today.`,
                `A space crafted just for you.\nWhere meticulous service meets warm ambiance\nfor an unforgettable experience.\nStart your new journey with us.`
            ]
        };
        const list = fb[c] || fb['US'];
        text = list[Math.floor(Math.random() * list.length)];
    }
    return text;
}

// ─── Step 3b: 하단 불투명 박스 + 설명 텍스트 (박스 안에 삽입) ───
function _wzBottomBox(descText, S, descFont, bW, bH, bL, bT) {
    const boxH = bH * 0.22;
    const boxY = bT + bH * 0.88;

    // 불투명 박스 (라운드값 줄임)
    const rect = new fabric.Rect({
        width: bW * 0.88, height: boxH,
        rx: 10, ry: 10,
        fill: '#ffffff', stroke: S.rectStroke, strokeWidth: 1.5,
        opacity: 0.92,
        left: bL + bW/2, top: boxY,
        originX:'center', originY:'center'
    });
    canvas.add(rect);
    canvas.bringToFront(rect);

    // 박스 안 설명 텍스트
    const obj = new fabric.Textbox(descText, {
        fontFamily: descFont + ', sans-serif', fontSize: Math.round(bW * 0.022),
        fontWeight:'400', fill: '#334155',
        originX:'center', originY:'center', textAlign:'center',
        left: bL + bW/2, top: boxY,
        width: bW * 0.80,
        lineHeight: 1.5
    });
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 4: Related elements (keyword search, 3 items) ───
async function _wzElem(keywords, bW, bH, bL, bT) {
    if (!sb) return;

    let data = null;
    for (const kw of keywords) {
        const res = await sb.from('library')
            .select('id, thumb_url, data_url')
            .in('category', ['vector','graphic','transparent-graphic'])
            .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(3);
        if (res.data && res.data.length) { data = res.data; break; }
    }
    if (!data || !data.length) return;

    // 3 positions: 제목 위쪽 영역 (상단 15~30%)
    const positions = [
        { left: bL + bW * 0.20, top: bT + bH * 0.15, size: bW / 5.5 },
        { left: bL + bW * 0.50, top: bT + bH * 0.12, size: bW / 5 },
        { left: bL + bW * 0.80, top: bT + bH * 0.16, size: bW / 5.5 }
    ];

    const promises = data.slice(0, 3).map((item, i) => new Promise(resolve => {
        const url = item.thumb_url;
        if (!url) { resolve(); return; }
        const pos = positions[i] || positions[0];
        fabric.Image.fromURL(url, img => {
            if (!img) { resolve(); return; }
            const scale = pos.size / Math.max(img.width, img.height);
            img.set({
                scaleX: scale, scaleY: scale,
                left: pos.left, top: pos.top,
                originX:'center', originY:'center'
            });
            canvas.add(img);
            canvas.bringToFront(img);
            resolve();
        }, { crossOrigin:'anonymous' });
    }));
    await Promise.all(promises);
}

// ─── Step 5: Decorative shapes (악센트 라인) ───
function _wzShapes(S, bW, bH, bL, bT) {
    // 제목 위 악센트 라인
    const line = new fabric.Rect({
        width: bW * 0.10, height: 4, rx:2, ry:2,
        fill: S.accent,
        left: bL + bW/2, top: bT + bH * 0.34,
        originX:'center', originY:'center'
    });
    canvas.add(line);
    canvas.bringToFront(line);

    // 제목 아래 서브 라인
    const line2 = new fabric.Rect({
        width: bW * 0.06, height: 3, rx:2, ry:2,
        fill: S.accent, opacity: 0.5,
        left: bL + bW/2, top: bT + bH * 0.55,
        originX:'center', originY:'center'
    });
    canvas.add(line2);
    canvas.bringToFront(line2);
}

// ─── Step 6: Stickers (keyword search → emoji fallback) ───
async function _wzSticker(keywords, bW, bH, bL, bT) {
    const positions = [
        { left: bL + bW * 0.08, top: bT + bH * 0.38 },
        { left: bL + bW * 0.92, top: bT + bH * 0.45 },
        { left: bL + bW * 0.10, top: bT + bH * 0.62 }
    ];

    // Try searching library for stickers matching keywords
    let stickerUrls = [];
    if (sb) {
        for (const kw of keywords) {
            const { data } = await sb.from('library')
                .select('id, thumb_url')
                .in('category', ['vector','graphic','transparent-graphic'])
                .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
                .eq('status','approved')
                .order('created_at', { ascending: false })
                .limit(3);
            if (data && data.length >= 2) {
                stickerUrls = data.map(d => d.thumb_url).filter(Boolean);
                break;
            }
        }
        // If not enough results from keyword search, get random approved ones
        if (stickerUrls.length < 3) {
            const { data } = await sb.from('library')
                .select('id, thumb_url')
                .in('category', ['vector','graphic','transparent-graphic'])
                .eq('status','approved')
                .order('created_at', { ascending: false })
                .limit(3);
            if (data) stickerUrls = data.map(d => d.thumb_url).filter(Boolean);
        }
    }

    if (stickerUrls.length >= 3) {
        const promises = stickerUrls.slice(0,3).map((url, i) => new Promise(resolve => {
            fabric.Image.fromURL(url, img => {
                if (!img) { resolve(); return; }
                const sz = bW * 0.10;
                const scale = sz / Math.max(img.width, img.height);
                img.set({ scaleX:scale, scaleY:scale, ...positions[i], originX:'center', originY:'center' });
                canvas.add(img); canvas.bringToFront(img);
                resolve();
            }, { crossOrigin:'anonymous' });
        }));
        await Promise.all(promises);
    } else {
        const emojis = ['✨','🎨','⭐','🌟','💫','🎯','🔥','💎','🌈','🎉','🎁','🏆'];
        const picked = [...emojis].sort(() => Math.random() - 0.5).slice(0,3);
        picked.forEach((em, i) => {
            const obj = new fabric.IText(em, {
                fontSize: Math.round(bW * 0.06), fontFamily:'sans-serif',
                ...positions[i], originX:'center', originY:'center'
            });
            canvas.add(obj); canvas.bringToFront(obj);
        });
    }
}