// canvas-ai.js
import { canvas } from "./canvas-core.js?v=147";
import { sb as _importedSb, currentUser } from "./config.js?v=147";

// ★ 모듈 바인딩 불일치 방어: import된 sb 또는 window.sb 사용
function _getSb() { return _importedSb || window.sb; }

// ==========================================================
// [유틸] DB secrets 테이블에서 API 키 가져오기
// ==========================================================
async function getApiKey(keyName) {
    const __sb = _getSb();
    if (!__sb) {
        console.error("Supabase 클라이언트가 초기화되지 않았습니다.");
        return null;
    }
    const { data, error } = await __sb
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
// [코어] BiRefNet 배경 제거 (무료 - Hugging Face Inference API)
// ==========================================================

// HF Inference API로 BRIA RMBG-2.0 모델 호출
async function callBiRefNet(imageBlob, hfKey) {
    const HF_MODELS = [
        'https://router.huggingface.co/hf-inference/models/briaai/RMBG-2.0',
        'https://router.huggingface.co/hf-inference/models/ZhengPeng7/BiRefNet'
    ];

    let lastError;
    for (const modelUrl of HF_MODELS) {
        try {
            const res = await fetch(modelUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfKey}`,
                    'Content-Type': 'application/octet-stream'
                },
                body: imageBlob
            });

            if (res.ok) {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('image')) {
                    return await res.blob();
                }
            }

            // 모델 로딩 중 (cold start) - 최대 60초 대기 후 재시도
            if (res.status === 503) {
                const body = await res.json().catch(() => ({}));
                const wait = Math.min((body.estimated_time || 20) * 1000, 60000);
                await new Promise(r => setTimeout(r, wait));

                const retry = await fetch(modelUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfKey}`,
                        'Content-Type': 'application/octet-stream'
                    },
                    body: imageBlob
                });
                if (retry.ok) return await retry.blob();
                throw new Error(`Model loading timeout (${res.status})`);
            }

            const errText = await res.text().catch(() => '');
            lastError = new Error(`${modelUrl}: ${res.status} ${errText}`);
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error('BiRefNet API call failed');
}

// ==========================================================
// [코어] Alpha 후처리 (Alpha Matting + Threshold + Median Filter)
// ==========================================================

function postProcessAlpha(imageBlob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);

            const imageData = ctx.getImageData(0, 0, c.width, c.height);
            const d = imageData.data;
            const w = c.width, h = c.height;

            // ── 1단계: Alpha Matting 경계 처리 ──
            // foreground_threshold=240, background_threshold=10
            for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 10) {
                    d[i] = 0; d[i-3] = 0; d[i-2] = 0; d[i-1] = 0;
                } else if (d[i] > 240) {
                    d[i] = 255;
                }
                // 10~240 사이는 반투명 경계로 유지
            }

            // ── 2단계: 미세 투명도 정리 ──
            // alpha < 25 → 완전 투명, alpha > 230 → 완전 불투명
            for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 25) {
                    d[i] = 0; d[i-3] = 0; d[i-2] = 0; d[i-1] = 0;
                } else if (d[i] > 230) {
                    d[i] = 255;
                }
            }

            // ── 3단계: Median Filter 3x3 (알파 채널 노이즈 제거) ──
            const alphaOrig = new Uint8Array(w * h);
            for (let i = 0; i < alphaOrig.length; i++) {
                alphaOrig[i] = d[i * 4 + 3];
            }

            const neighbors = new Uint8Array(9);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    let ni = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            neighbors[ni++] = alphaOrig[(y + dy) * w + (x + dx)];
                        }
                    }
                    neighbors.sort();
                    const median = neighbors[4];
                    const idx = (y * w + x) * 4;
                    d[idx + 3] = median;
                    if (median === 0) {
                        d[idx] = 0; d[idx+1] = 0; d[idx+2] = 0;
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
            c.toBlob((blob) => resolve(blob), 'image/png');
        };
        img.onerror = () => reject(new Error('Alpha post-process: image load failed'));
        img.src = URL.createObjectURL(imageBlob);
    });
}

// ==========================================================
// [코어] Flux 이미지 생성
// ==========================================================
async function generateImageCore(prompt) {
    const _sb = sb || window.sb;
    if (!_sb) throw new Error("Supabase connection failed");
    const { data, error } = await _sb.functions.invoke('generate-image-flux', {
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
            if (!text) { showToast(t('msg_input_desc', "Please enter a description."), "info"); return; }
            
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
                showToast(t('msg_gen_fail', "Generation failed") + ": " + e.message, "error");
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
            if (!userText) { showToast(window.t('msg_input_desc', "Description required"), "info"); return; }
            resultArea.innerHTML = `<div class="loading-spin"></div><p>${window.t('msg_generating', 'Generating...')}</p>`;
            btnUse.style.display = "none";
            btnGen.disabled = true;
            try {
                const imageUrl = await generateImageCore(userText);
                internalGeneratedUrl = imageUrl;
                resultArea.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:contain;">`;
                btnUse.style.display = "block";
            } catch (e) {
                showToast(window.t('msg_failed', 'Failed: ') + e.message, "error");
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
    
    // --- 3. 배경 제거 (Edge Function + Alpha 후처리) ---
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') { showToast(window.t('msg_select_image', "Please select an image."), "info"); return; }

            if(!confirm(window.t('confirm_bg_remove', "Remove the background?"))) return;

            const originalText = btnCutout.innerText;
            btnCutout.innerText = window.t('msg_processing', "Processing...");
            try {
                // 1. 원본 해상도 추출 → base64
                const restoreScale = 1 / active.scaleX;
                const imgData = active.toDataURL({ format: 'png', multiplier: restoreScale });
                const base64 = imgData.split(',')[1];

                // 2. Edge Function 호출 (서버에서 HF API key 관리)
                const __sb = _getSb();
                if (!__sb) throw new Error('Supabase not ready');
                const { data, error } = await __sb.functions.invoke('bg-remove', {
                    body: { image_base64: base64 }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                if (!data?.image_base64) throw new Error('No result from bg-remove');

                // 3. base64 → blob
                const rawBlob = await (await fetch('data:image/png;base64,' + data.image_base64)).blob();

                // 4. Alpha 후처리 (Alpha Matting + Threshold + Median Filter)
                btnCutout.innerText = window.t('msg_alpha_processing', "Alpha processing...");
                const processedBlob = await postProcessAlpha(rawBlob);

                // 5. 캔버스에 적용
                const url = URL.createObjectURL(processedBlob);
                fabric.Image.fromURL(url, (newImg) => {
                    newImg.set({
                        left: active.left,
                        top: active.top,
                        angle: active.angle,
                        originX: active.originX,
                        originY: active.originY
                    });
                    const visualWidth = active.getScaledWidth();
                    const visualHeight = active.getScaledHeight();
                    newImg.scaleToWidth(visualWidth);
                    newImg.scaleToHeight(visualHeight);

                    canvas.remove(active);
                    canvas.add(newImg);
                    canvas.setActiveObject(newImg);
                    canvas.requestRenderAll();
                    URL.revokeObjectURL(url);
                    showToast(window.t('msg_upload_success', "Success!"), "success");
                });
            } catch(e) {
                console.error('[BiRefNet]', e);
                showToast(window.t('msg_failed', "Failed: ") + e.message, "error");
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
            if (!active || active.type !== 'image') { showToast(window.t('msg_select_image', "Please select an image!"), "info"); return; }
            
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
                
                const _sb = sb || window.sb;
                if (!_sb) throw new Error('DB not ready');
                const { data, error } = await _sb.functions.invoke('upscale-image', {
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
                    if (!newImg) { showToast(window.t('msg_image_load_failed', "Image load failed"), "error"); return; }
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
                    showToast(window.t('msg_upload_success', "Success!"), "success");
                }, { crossOrigin: 'anonymous' });

            } catch (e) {
                console.error("업스케일링 실패:", e);
                showToast(window.t('msg_failed', "Failed: ") + e.message, "error");
            } finally {
                btnUpscale.innerText = originalText;
                btnUpscale.disabled = false;
            }
        };
    }

    // ============================================================
    // [5] AI Design Wizard (디자인 마법사)
    // ============================================================
    window.closeDesignWizard = function() {
        const m = document.getElementById('designWizardModal');
        if (m) m.style.display = 'none';
    };

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
            if (!title) { showToast(window.t?.('msg_input_desc','제목을 입력해주세요') || '제목을 입력해주세요', "info"); return; }
            const bodyText = '';
            const styleBtn = document.querySelector('.wizard-style-btn.active');
            const style = styleBtn?.dataset.style || 'modern';
            btnWizGen.disabled = true;
            btnWizGen.innerHTML = '<div class="loading-spin" style="width:20px;height:20px;border-width:3px;"></div>';
            document.getElementById('wizardProgressArea').style.display = 'block';
            try {
                if (window.__pdMode) {
                    await runDesignWizardForPD(title, style, bodyText);
                } else if (window.__boxMode) {
                    await runDesignWizardForBox(title, style, bodyText);
                } else {
                    await runDesignWizard(title, style, bodyText);
                }
                window.closeDesignWizard();
            } catch(e) {
                console.error('Wizard error:', e);
                showToast(window.t?.('msg_failed','Failed: ') + e.message, "error");
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
    ocean:   { titleColor:'#ffffff', boxFill:'rgba(240,249,255,0.92)', boxStroke:'rgba(56,189,248,0.35)', boxTextColor:'#1e3a5f' },
    sunset:  { titleColor:'#ffffff', boxFill:'rgba(255,251,235,0.92)', boxStroke:'rgba(251,191,36,0.35)', boxTextColor:'#78350f' },
    rose:    { titleColor:'#ffffff', boxFill:'rgba(253,242,248,0.92)', boxStroke:'rgba(244,114,182,0.35)', boxTextColor:'#831843' },
    midnight:{ titleColor:'#f9a8d4', boxFill:'rgba(15,23,42,0.88)',   boxStroke:'rgba(255,0,170,0.3)',   boxTextColor:'#f9a8d4' },
    forest:  { titleColor:'#ffffff', boxFill:'rgba(236,253,245,0.92)', boxStroke:'rgba(52,211,153,0.35)', boxTextColor:'#064e3b' },
    lavender:{ titleColor:'#ffffff', boxFill:'rgba(245,243,255,0.92)', boxStroke:'rgba(167,139,250,0.35)', boxTextColor:'#4c1d95' },
    coral:   { titleColor:'#ffffff', boxFill:'rgba(255,241,242,0.92)', boxStroke:'rgba(251,113,133,0.35)', boxTextColor:'#881337' },
    arctic:  { titleColor:'#1e3a5f', boxFill:'rgba(240,249,255,0.92)', boxStroke:'rgba(96,165,250,0.35)', boxTextColor:'#1e40af' },
    neon:    { titleColor:'#ffffff', boxFill:'rgba(30,0,50,0.88)',    boxStroke:'rgba(168,85,247,0.4)',  boxTextColor:'#d8b4fe' },
    flame:   { titleColor:'#ffffff', boxFill:'rgba(50,10,0,0.88)',    boxStroke:'rgba(251,146,60,0.4)',  boxTextColor:'#fed7aa' },
    moody:   { titleColor:'#ffffff', boxFill:'rgba(20,20,30,0.88)',   boxStroke:'rgba(129,140,248,0.4)', boxTextColor:'#c7d2fe' },
    noir:    { titleColor:'#f0f0f0', boxFill:'rgba(10,10,10,0.88)',   boxStroke:'rgba(100,100,100,0.4)', boxTextColor:'#d4d4d4' }
};

// Extract meaningful keywords from title
// 짧은 제목 "초록 물고기" → ["물고기","초록"] (명사 우선)
// 긴 문장 "카페에 오신 여러분" → ["카페"] (첫 명사 우선)
// 복합어 "고기집 간판" → ["고기","간판","고기집"]
// 비구독자용 프리미엄 아이템 필터링
function _wzFilterPremium(items) {
    if (!items || !items.length) return items;
    if (window.isSubscriber || !window.isPremiumTemplate) return items;
    return items.filter(item => !window.isPremiumTemplate(item));
}

function _wzExtractKeywords(title) {
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';

    // ★ 일본어: 명사 추출 (한자블록 + 접미사 제거 + 단독한자)
    if (country === 'JP') {
        const jpStopKanji = new Set('中上下前後内外間的一二三四五六七八九十百千万個匹本枚台件人回目日月年時分秒'.split(''));
        const jpSuffixes = ['たち','さん','ちゃん','くん','さま','ども','など','たい','ない','ような','みたいな','のよう','みたい'];
        // 1) 2+ consecutive kanji
        const kanjiBlocks = title.match(/[\u4e00-\u9faf\u3400-\u4dbf]{2,}/g) || [];
        // 2) kanji+hiragana+kanji compound (飼い猫 etc.)
        const compounds = title.match(/[\u4e00-\u9faf]{1,}[\u3040-\u309f]{1,3}[\u4e00-\u9faf]{1,}/g) || [];
        // 3) katakana 2+
        const kataBlocks = title.match(/[\u30a0-\u30ff]{2,}/g) || [];
        // 4) particle split → suffix strip → extract meaningful kanji
        const meaningfulSingle = [];
        const extraKanji = [];
        const parts = title.split(/[のをがにはでともへや、。！？「」（）\s]+/);
        for (let p of parts) {
            if (!p) continue;
            // 접미사 제거 (魚たち→魚, 子供たち→子供)
            for (const suf of jpSuffixes) {
                if (p.endsWith(suf) && p.length > suf.length) { p = p.slice(0, -suf.length); break; }
            }
            // 선행 히라가나 제거 (そして水面→水面)
            p = p.replace(/^[\u3040-\u309f]+/, '');
            if (!p) continue;
            // 단독 한자
            if (/^[\u4e00-\u9faf]$/.test(p) && !jpStopKanji.has(p)) meaningfulSingle.push(p);
            // 2+ 한자 블록 (이미 잡히지 않은 것)
            const multi = p.match(/[\u4e00-\u9faf]{2,}/);
            if (multi) extraKanji.push(multi[0]);
            // 한자+히라가나에서 선행 한자 추출 (浮かぶ→浮 → skip verb, but 食べ物→食)
            const lead = p.match(/^([\u4e00-\u9faf])[\u3040-\u309f]/);
            if (lead && !jpStopKanji.has(lead[1])) meaningfulSingle.push(lead[1]);
        }
        const all = [...new Set([...kanjiBlocks, ...extraKanji, ...compounds, ...kataBlocks, ...meaningfulSingle])];
        console.log('[Wizard Keywords JP]', title, '→', all);
        return all.length > 0 ? all : [title.replace(/[。、！？\s]/g,'').substring(0,4)];
    }

    // ★ 영어: 불용어 제외하고 명사 추출
    if (country === 'US') {
        const enStopWords = ['the','a','an','is','are','was','were','be','been','being','in','on','at','to','for','of','with','by','from','as','into','like','through','after','over','between','out','against','during','without','before','under','around','among','and','or','but','not','no','so','if','that','this','it','its','my','your','his','her','our','their','who','which','what','where','when','how','all','each','every','both','few','more','most','other','some','such','only','same','than','too','very','can','will','just','should','now'];
        const enWords = title.replace(/[^a-zA-Z\s]/g,'').split(/\s+/).filter(w => w.length >= 3 && !enStopWords.includes(w.toLowerCase()));
        console.log('[Wizard Keywords EN]', title, '→', enWords);
        return enWords.length > 0 ? enWords : [title.substring(0,10)];
    }

    const words = title.replace(/[!@#$%^&*(),.?":{}|<>~`。、！？「」]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    if (!words.length) return [title];

    const suffixes = ['집','점','관','원','소','실','당','방','장','위','아래','속','밑','앞','뒤','옆','안'];
    const particles = ['을','를','이','가','은','는','에','의','로','와','과','도','만','까지','에서','부터','처럼','같이','보다','에게','한테','께','으로','이나','나','든지','라도','마저','조차'];
    // 한국어 형용사/관형어 (검색 의미 낮음)
    const adjectives = ['큰','작은','예쁜','멋진','새로운','특별한','푸른','빨간','파란','노란','초록','하얀','검은','보라','분홍','아름다운','화려한','심플한','모던한','귀여운','멋있는','진정한','좋은','나쁜','높은','낮은','넓은','깊은','밝은','어두운','따뜻한','차가운','시원한'];
    // 불용어 (검색에 무의미한 일반 단어)
    const stopWords = ['것','수','때','곳','등','중','안','밖','오신','여러분','위한','함께','통해','대한','모든','이런','저런','그런','우리','당신','너의','나의','영혼','마음','세계','세상','곳에','하는','있는','없는','되는','같은','산책','여행','사는','가는','오는','타는','먹는','놀러'];
    // 동사/형용사 어미 제거
    const verbEndings = ['하고','하는','하며','했던','에서','인','적','들'];

    const nouns = [];
    const adjs = [];

    for (const w of words) {
        let root = w;
        // 조사 제거
        for (const p of particles) {
            if (root.length > p.length + 1 && root.endsWith(p)) {
                root = root.slice(0, -p.length);
                break;
            }
        }
        // 동사 어미 제거 ("산책하고" → "산책")
        for (const ve of verbEndings) {
            if (root.length > ve.length + 1 && root.endsWith(ve)) {
                root = root.slice(0, -ve.length);
                break;
            }
        }

        // 불용어 스킵
        if (stopWords.includes(root)) continue;

        // 접미사 제거
        let stripped = root;
        for (const s of suffixes) {
            if (stripped.length > s.length + 1 && stripped.endsWith(s)) {
                stripped = stripped.slice(0, -s.length);
                break;
            }
        }

        // 형용사인지 판별
        const isAdj = adjectives.some(a => w.startsWith(a) || w === a || root === a);

        if (isAdj) {
            if (root.length >= 2) adjs.push(root);
        } else {
            if (stripped.length >= 2 && stripped !== root) nouns.push(stripped);
            if (root.length >= 2) nouns.push(root);
        }
    }

    // ★ 핵심: 짧은 제목(2단어 이하)은 뒤 명사 우선 (초록 물고기→물고기)
    //         긴 문장(3단어+)은 앞 명사 우선 (카페에 오신 여러분→카페)
    const ordered = words.length <= 2 ? [...nouns].reverse() : nouns;
    const all = [...new Set([...ordered, ...adjs])];
    console.log('[Wizard Keywords]', title, '→', all);
    return all.length > 0 ? all : [title];
}

// ★ JP → EN 변환 사전 (일본어 키워드를 영어로 번역)
const _WZ_JP_EN = {
    // 동물
    '鯨':'whale','魚':'fish','猫':'cat','犬':'dog','鳥':'bird','馬':'horse','虎':'tiger',
    '狐':'fox','狼':'wolf','龍':'dragon','竜':'dragon','蝶':'butterfly','兎':'rabbit','熊':'bear',
    '蛇':'snake','鹿':'deer','象':'elephant','獅子':'lion','鷲':'eagle','亀':'turtle',
    '蜂':'bee','豚':'pig','羊':'sheep','鶏':'chicken','恐竜':'dinosaur','足跡':'footprint',
    'ペンギン':'penguin','パンダ':'panda','イルカ':'dolphin','ライオン':'lion','ウサギ':'rabbit',
    'サメ':'shark','クマ':'bear','ネコ':'cat','イヌ':'dog','トリ':'bird','カメ':'turtle',
    'クジラ':'whale','タコ':'octopus','カニ':'crab','エビ':'shrimp',
    // 자연
    '海':'ocean','山':'mountain','川':'river','空':'sky','雲':'cloud','雨':'rain',
    '雪':'snow','風':'wind','花':'flower','木':'tree','森':'forest','月':'moon',
    '星':'star','太陽':'sun','火':'fire','水':'water','水面':'ocean','湖':'lake','島':'island',
    '滝':'waterfall','波':'wave','虹':'rainbow','砂漠':'desert',
    '桜':'cherry blossom','薔薇':'rose','向日葵':'sunflower','葉':'leaf','草':'grass',
    '石':'rock','砂':'sand','氷':'ice','霧':'fog','嵐':'storm',
    // 사물/개념
    '城':'castle','家':'house','船':'ship','車':'car','剣':'sword','王':'king','姫':'princess',
    '愛':'love','夢':'dream','光':'light','影':'shadow','音楽':'music','本':'book',
    '食':'food','酒':'wine','茶':'tea','天使':'angel','宇宙':'space','地球':'earth',
    '夜':'night','朝':'morning','街':'town','庭':'garden','飛行機':'airplane','電車':'train','雷':'lightning',
    '春':'spring','夏':'summer','秋':'autumn','冬':'winter',
    'コーヒー':'coffee','ケーキ':'cake','ワイン':'wine','ビール':'beer',
    // 컨셉/형용사
    '巨大':'giant','秘密':'secret','泳':'swimming','生物':'creature','足':'foot',
    '古代':'ancient','神秘':'mystery','深海':'deep sea','密林':'jungle',
};

// ★ KR 키워드 변환 사전 (한국어 사이트용)
const _WZ_KR_DICT = {
    // 동물 (EN→KR)
    'whale':'고래','fish':'물고기','cat':'고양이','dog':'개','bird':'새','horse':'말','tiger':'호랑이',
    'fox':'여우','wolf':'늑대','dragon':'용','butterfly':'나비','rabbit':'토끼','bear':'곰',
    'snake':'뱀','deer':'사슴','elephant':'코끼리','lion':'사자','eagle':'독수리','turtle':'거북이',
    'bee':'벌','pig':'돼지','sheep':'양','penguin':'펭귄','panda':'판다','dolphin':'돌고래',
    'shark':'상어','octopus':'문어','crab':'게','shrimp':'새우','dinosaur':'공룡',
    // 자연 (EN→KR)
    'ocean':'바다','sea':'바다','mountain':'산','river':'강','sky':'하늘','cloud':'구름','rain':'비',
    'snow':'눈','wind':'바람','flower':'꽃','tree':'나무','forest':'숲','moon':'달',
    'star':'별','sun':'태양','fire':'불','water':'바다','lake':'호수','island':'섬',
    'waterfall':'폭포','wave':'파도','rainbow':'무지개','cherry':'벚꽃','rose':'장미','sunflower':'해바라기',
    'leaf':'잎','grass':'풀','rock':'돌','sand':'모래','ice':'얼음','desert':'사막',
    // 사물/개념 (EN→KR)
    'castle':'성','house':'집','ship':'배','car':'자동차','sword':'검','king':'왕','princess':'공주',
    'love':'하트','heart':'하트','dream':'꿈','light':'빛','shadow':'그림자',
    'music':'음악','book':'책','food':'음식','coffee':'커피','cake':'케이크','wine':'와인',
    'angel':'천사','space':'우주','earth':'지구','night':'밤','morning':'아침',
    'spring':'봄','summer':'여름','autumn':'가을','winter':'겨울',
    'town':'마을','village':'마을','garden':'정원','airplane':'비행기','train':'기차',
    'lightning':'번개','thunder':'번개',
    // JP→KR
    '鯨':'고래','魚':'물고기','猫':'고양이','犬':'개','鳥':'새','馬':'말','虎':'호랑이',
    '狐':'여우','狼':'늑대','龍':'용','竜':'용','蝶':'나비','兎':'토끼','熊':'곰',
    '蛇':'뱀','鹿':'사슴','象':'코끼리','獅子':'사자','鷲':'독수리','亀':'거북이',
    '蜂':'벌','豚':'돼지','羊':'양','鶏':'닭','恐竜':'공룡',
    'ペンギン':'펭귄','パンダ':'판다','イルカ':'돌고래','ライオン':'사자','ウサギ':'토끼',
    '海':'바다','山':'산','川':'강','空':'하늘','雲':'구름','雨':'비',
    '雪':'눈','風':'바람','花':'꽃','木':'나무','森':'숲','月':'달',
    '星':'별','太陽':'태양','火':'불','水':'바다','水面':'수면','湖':'호수','島':'섬',
    '滝':'폭포','波':'파도','虹':'무지개',
    '桜':'벚꽃','薔薇':'장미','向日葵':'해바라기','葉':'잎','草':'풀','石':'돌','砂':'모래',
    '城':'성','家':'집','船':'배','車':'자동차','剣':'검','王':'왕','姫':'공주',
    '愛':'사랑','夢':'꿈','光':'빛','影':'그림자','音楽':'음악','本':'책',
    '食':'음식','天使':'천사','宇宙':'우주','地球':'지구','夜':'밤','朝':'아침',
    '春':'봄','夏':'여름','秋':'가을','冬':'겨울','街':'거리','庭':'정원',
    '飛行機':'비행기','電車':'기차','雷':'번개',
};

function _wzTranslateForSearch(keywords) {
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';

    // ★ US: 영어 키워드 그대로 사용 (뒤쪽 중요 단어 우선)
    if (country === 'US') {
        const reversed = [...keywords].reverse();
        console.log('[Wizard Translate US] EN as-is (reversed):', reversed);
        return [...new Set(reversed)];
    }

    // ★ JP: 일본어 → 영어 변환 (뒤쪽 중요 단어 우선)
    if (country === 'JP') {
        const reversed = [...keywords].reverse();
        const translated = [];
        const untranslated = [];
        for (const kw of reversed) {
            const en = _WZ_JP_EN[kw] || _WZ_JP_EN[kw.toLowerCase()];
            if (en) translated.push(en);
            else untranslated.push(kw);
        }
        const result = [...new Set([...translated, ...untranslated])];
        console.log('[Wizard Translate JP→EN]', keywords, '→', result);
        return result;
    }

    // ★ KR: 한국어 키워드 그대로 (JP/EN 원본이 섞여있으면 KR로 변환)
    const translated = [];
    const untranslated = [];
    for (const kw of keywords) {
        const kr = _WZ_KR_DICT[kw] || _WZ_KR_DICT[kw.toLowerCase()];
        if (kr) translated.push(kr);
        else untranslated.push(kw);
    }
    return [...new Set([...translated, ...untranslated])];
}

function _wzSteps() {
    const t = (k,d) => window.t?.(k,d) || d;
    return [
        t('wizard_step_bg',       '배경 검색 중...'),
        t('wizard_step_title',    '제목 배치 중...'),
        t('wizard_step_desc',     '설명 생성 중...'),
        t('wizard_step_elements', '디자인 요소 추가 중...')
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

export async function runDesignWizard(title, style, bodyText) {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) throw new Error('No canvas board');
    const fullBW = board.width * (board.scaleX||1), fullBH = board.height * (board.scaleY||1);
    const fullBL = board.left, fullBT = board.top;

    // ★ 프로모 모드: 선택된 패널 영역에만 마법사 적용
    const promoSel = window.__promoSelection;
    const promoPanel = window.__activePromoPanel;
    const isPromo = promoSel && typeof promoPanel === 'number';
    let bW, bH, bL, bT;
    if (isPromo) {
        const panels = promoSel.panelCount || 1;
        const pw = fullBW / panels;
        bL = fullBL + pw * promoPanel;
        bT = fullBT;
        bW = pw;
        bH = fullBH;
    } else {
        bW = fullBW; bH = fullBH; bL = fullBL; bT = fullBT;
    }

    const S = WIZARD_STYLES[style] || WIZARD_STYLES.blue;
    const steps = _wzSteps();

    // ★ 기존 오브젝트 삭제
    if (isPromo) {
        // 프로모 모드: 해당 패널 영역의 일반 오브젝트만 삭제 (패널배경, 가이드, 하이라이트 보존)
        canvas.getObjects().filter(o => {
            if (o.isBoard || o.id === 'product_fixed_overlay') return false;
            if (o._promoPanelBg || o.isGuide || o._promoHighlight) return false;
            // 해당 패널 영역 안에 있는 오브젝트만 삭제
            const oL = o.left || 0;
            return oL >= bL - 5 && oL < bL + bW + 5;
        }).forEach(o => canvas.remove(o));
    } else {
        canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // Resolve font by country
    // KR: 잘난고딕 (Supabase에 .otf → opentype.js가 PDF 아웃라인 변환 가능)
    // JP: Noto Sans JP 900 (굵은 기본), others: Impact (시스템 굵은 기본)
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const titleFontMap = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
    let titleFont = titleFontMap[country] || 'Impact, Arial Black, sans-serif';
    // JP: DB에 로드된 源暎ポプ Pw 폰트가 있으면 사용 (두꺼운 팝 서체)
    if (country === 'JP' && window.DYNAMIC_FONTS) {
        const popFont = window.DYNAMIC_FONTS.find(f => f.font_name?.includes('ポプ'));
        if (popFont) titleFont = popFont.font_family;
    }
    const descFont = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Noto Sans KR';

    // 잘난고딕 @font-face 로드 (jsdelivr CDN)
    if (titleFont === 'JalnanGothic' && !document.querySelector('style[data-jalnan]')) {
        const st = document.createElement('style');
        st.dataset.jalnan = '1';
        st.textContent = `@font-face { font-family:'JalnanGothic'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_231029@1.1/JalnanGothic.woff') format('woff'); font-weight:normal; font-display:swap; }`;
        document.head.appendChild(st);
    }

    // Google Fonts (desc + overseas title)
    [descFont, titleFont].forEach(f => {
        if (f.includes(',') || f === 'JalnanGothic') return; // skip system/supabase fonts
        const fUrl = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f) + ':wght@400;700;900&display=swap';
        if (!document.querySelector(`link[href="${fUrl}"]`)) {
            const lk = document.createElement('link'); lk.rel='stylesheet'; lk.href=fUrl; document.head.appendChild(lk);
        }
    });
    await new Promise(r => setTimeout(r, 600));

    const keywords = _wzExtractKeywords(title);
    window._wzCurrentStyle = style;

    // ─── Step 1: Background (벡터 그라데이션) ───
    _wzRender(steps, 0);
    await _wzBg(keywords, bW, bH, bL, bT);

    // ★ 하단 진한 그라데이션 오버레이 (배경 바로 위 레이어)
    const [bgC1, bgC2] = window._wzBgColors || ['#1a0033','#0d001a'];
    function _darkenHex(hex, factor) {
        const r = Math.round(parseInt(hex.slice(1,3),16) * factor);
        const g = Math.round(parseInt(hex.slice(3,5),16) * factor);
        const b = Math.round(parseInt(hex.slice(5,7),16) * factor);
        return '#' + [r,g,b].map(v => Math.min(255,v).toString(16).padStart(2,'0')).join('');
    }
    const darkC1 = _darkenHex(bgC2, 0.35);
    const darkC2 = _darkenHex(bgC2, 0.15);
    const bottomOverlay = new fabric.Rect({
        width: bW + 4, height: bH * 0.28 + 2,
        left: bL - 2, top: bT + bH * 0.72,
        originX:'left', originY:'top',
        fill: new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: bH * 0.28 },
            colorStops: [
                { offset: 0, color: darkC1 },
                { offset: 1, color: darkC2 }
            ]
        }),
        opacity: 1,
        rx: 0, ry: 0,
        isBottomOverlay: true
    });
    canvas.add(bottomOverlay);
    // 배경(templateBg) 또는 패널배경 바로 위로 보내기
    if (isPromo) {
        const panelBg = canvas.getObjects().find(o => o._promoPanelBg && o._promoPanel === promoPanel);
        if (panelBg) {
            const idx = canvas.getObjects().indexOf(panelBg);
            canvas.moveTo(bottomOverlay, idx + 1);
        }
    } else {
        const bgObj = canvas.getObjects().find(o => o.isTemplateBackground);
        if (bgObj) {
            const bgIdx = canvas.getObjects().indexOf(bgObj);
            canvas.moveTo(bottomOverlay, bgIdx + 1);
        }
    }

    // ─── Step 2: Title (중앙 상단) ───
    _wzRender(steps, 1);
    await _wzTitle(title, titleFont, S, bW, bH, bL, bT);

    // ─── Step 2.3: 장식 1개 (타이틀 아래 중앙) ───
    _wzDecoration(bW, bH, bL, bT);

    // ─── Step 2.5: Body Text (사용자 입력 본문) ───
    if (bodyText) {
        _wzBodyText(bodyText, descFont, bW, bH, bL, bT);
    }

    // ─── Step 3: Description (하단 배치) ───
    _wzRender(steps, 2);
    const descText = await _wzGetDescText(title);
    _wzBottomBox(descText, S, descFont, bW, bH, bL, bT);

    // ─── Step 4: Elements (좌측 상단 배치) ───
    _wzRender(steps, 3);
    await _wzElem(keywords, bW, bH, bL, bT);

    // ─── Step 5: 완성 ───
    _wzRender(steps, 4);
    canvas.discardActiveObject();

    // ★ 프로모 모드: 가이드/패널배경 레이어 순서 복구
    if (isPromo) {
        const objs = canvas.getObjects();
        const boardObj = objs.find(o => o.isBoard);
        const boardIdx = boardObj ? objs.indexOf(boardObj) : -1;
        objs.filter(o => o._promoPanelBg).forEach(bg => {
            if (boardIdx >= 0) canvas.moveTo(bg, boardIdx + 1);
        });
        objs.filter(o => o.isGuide || o._promoHighlight).forEach(g => canvas.bringToFront(g));
        if (window.savePageState) window.savePageState();
    }

    canvas.requestRenderAll();

    // ★ 클립아트 검색창에 첫 번째 키워드 자동 입력
    const searchKws = _wzTranslateForSearch(keywords);
    const firstKw = searchKws[0] || keywords[0] || '';
    if (firstKw) {
        const searchInput = document.getElementById('sideAssetSearch');
        if (searchInput) { searchInput.value = firstKw; }
        if (window.handleAssetSearch) window.handleAssetSearch(firstKw);
    }

    // 서체 리렌더 (폰트 로드 완료 후 캔버스 갱신)
    setTimeout(() => {
        canvas.getObjects().forEach(o => {
            if (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text') {
                o.set('dirty', true);
                o.initDimensions && o.initDimensions();
            }
            if (o._objects) o._objects.forEach(c => {
                if (c.type === 'textbox' || c.type === 'i-text' || c.type === 'text') {
                    c.set('dirty', true);
                    c.initDimensions && c.initDimensions();
                }
            });
        });
        canvas.requestRenderAll();
    }, 500);
}

// ============================================================
// ★ 이미지 템플릿 자동 디자인 (시작화면에서 이미지 선택 시)
// 배경은 이미 적용됨 → 검색어를 타이틀로 + AI 설명 하단 배치
// ============================================================
window.runImageTemplateDesign = async function(keyword) {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const bW = board.width * (board.scaleX||1), bH = board.height * (board.scaleY||1);
    const bL = board.left, bT = board.top;

    // 폰트 준비 (runDesignWizard와 동일)
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const titleFontMap = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
    let titleFont = titleFontMap[country] || 'Impact, Arial Black, sans-serif';
    if (country === 'JP' && window.DYNAMIC_FONTS) {
        const popFont = window.DYNAMIC_FONTS.find(f => f.font_name?.includes('ポプ'));
        if (popFont) titleFont = popFont.font_family;
    }
    const descFont = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Noto Sans KR';

    // 잘난고딕 로드
    if (titleFont === 'JalnanGothic' && !document.querySelector('style[data-jalnan]')) {
        const st = document.createElement('style');
        st.dataset.jalnan = '1';
        st.textContent = "@font-face { font-family:'JalnanGothic'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_231029@1.1/JalnanGothic.woff') format('woff'); font-weight:normal; font-display:swap; }";
        document.head.appendChild(st);
    }
    // Google Fonts 로드
    [descFont, titleFont].forEach(f => {
        if (f.includes(',') || f === 'JalnanGothic') return;
        const fUrl = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f) + ':wght@400;700;900&display=swap';
        if (!document.querySelector('link[href="' + fUrl + '"]')) {
            const lk = document.createElement('link'); lk.rel='stylesheet'; lk.href=fUrl; document.head.appendChild(lk);
        }
    });
    await new Promise(r => setTimeout(r, 600));

    // 배경 이미지는 이미 적용됨 → 글자색은 흰색(사진 위)
    window._wzBgColors = ['#222222', '#111111'];

    // ── 1. 하단 반투명 그라데이션 오버레이 (가독성) ──
    const bottomOverlay = new fabric.Rect({
        width: bW, height: bH * 0.45,
        left: bL, top: bT + bH * 0.55,
        originX:'left', originY:'top',
        fill: new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: bH * 0.45 },
            colorStops: [
                { offset: 0, color: 'rgba(0,0,0,0)' },
                { offset: 0.5, color: 'rgba(0,0,0,0.4)' },
                { offset: 1, color: 'rgba(0,0,0,0.75)' }
            ]
        }),
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        hasControls: false, hasBorders: false
    });
    canvas.add(bottomOverlay);
    // 배경 바로 위로
    const bgObj = canvas.getObjects().find(o => o.isTemplateBackground);
    if (bgObj) {
        const bgIdx = canvas.getObjects().indexOf(bgObj);
        canvas.moveTo(bottomOverlay, bgIdx + 1);
    }

    // ── 2. 타이틀 (검색어) ──
    await _wzTitle(keyword, titleFont, null, bW, bH, bL, bT);

    // ── 3. AI 설명 텍스트 생성 + 하단 배치 ──
    const descText = await _wzGetDescText(keyword);
    _wzBottomBox(descText, null, descFont, bW, bH, bL, bT);

    // ── 4. 완성 ──
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // 서체 리렌더 (폰트 로드 완료 후)
    setTimeout(() => {
        canvas.getObjects().forEach(o => {
            if (o.type === 'textbox' || o.type === 'i-text' || o.type === 'text') {
                o.set('dirty', true);
                if (o.initDimensions) o.initDimensions();
            }
        });
        canvas.requestRenderAll();
    }, 500);
};

// ============================================================
// ★ 종이매대(PD) 전용 멀티페이스 마법사
// Face 0: 간판 (풀 디자인) / Face 1: 옆면 (배경+요소) / Face 2: 선반 (배경+타이틀)
// ============================================================
async function runDesignWizardForPD(title, style, bodyText) {
    // ─── Face 0: 상단 간판 — 풀 마법사 실행 ───
    await runDesignWizard(title, style, bodyText);
    if (window.savePageState) window.savePageState();

    // 공통 데이터 캐시
    const keywords = _wzExtractKeywords(title);
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const titleFontMap = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
    let titleFont = titleFontMap[country] || 'Impact, Arial Black, sans-serif';
    if (country === 'JP' && window.DYNAMIC_FONTS) {
        const popFont = window.DYNAMIC_FONTS.find(f => f.font_name?.includes('ポプ'));
        if (popFont) titleFont = popFont.font_family;
    }

    // ─── Face 1: 옆면 — 배경 + 요소만 하단에 크게 ───
    window.switchPdFace(1);
    await new Promise(r => setTimeout(r, 500));
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    const board1 = canvas.getObjects().find(o => o.isBoard);
    if (board1) {
        const b1W = board1.width * (board1.scaleX || 1), b1H = board1.height * (board1.scaleY || 1);
        const b1L = board1.left, b1T = board1.top;
        await _wzBg(keywords, b1W, b1H, b1L, b1T);
        await _wzElem(keywords, b1W, b1H, b1L, b1T);
        // ★ 요소를 하단 중앙으로 재배치 (2배 크기)
        canvas.getObjects().forEach(o => {
            if (!o.isBoard && !o.isTemplateBackground && o.type === 'image') {
                const bigSize = b1W * 2.0;
                const scale = bigSize / Math.max(o.width || 1, o.height || 1);
                o.set({ scaleX: scale, scaleY: scale, left: b1L + b1W * 0.5, top: b1T + b1H * 0.90, originX: 'center', originY: 'center' });
            }
        });
        canvas.requestRenderAll();
    }
    if (window.savePageState) window.savePageState();

    // ─── Face 2: 선반 — 배경 + 타이틀만 ───
    window.switchPdFace(2);
    await new Promise(r => setTimeout(r, 500));
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    const board2 = canvas.getObjects().find(o => o.isBoard);
    if (board2) {
        const b2W = board2.width * (board2.scaleX || 1), b2H = board2.height * (board2.scaleY || 1);
        const b2L = board2.left, b2T = board2.top;
        await _wzBg(keywords, b2W, b2H, b2L, b2T);
        _wzShelfTitle(title, titleFont, b2W, b2H, b2L, b2T);
        canvas.requestRenderAll();
    }
    if (window.savePageState) window.savePageState();

    // ─── Face 3: 하단 — 배경만 (같은 테마색) ───
    window.switchPdFace(3);
    await new Promise(r => setTimeout(r, 500));
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    const board3 = canvas.getObjects().find(o => o.isBoard);
    if (board3) {
        const b3W = board3.width * (board3.scaleX || 1), b3H = board3.height * (board3.scaleY || 1);
        const b3L = board3.left, b3T = board3.top;
        await _wzBg(keywords, b3W, b3H, b3L, b3T);
        canvas.requestRenderAll();
    }
    if (window.savePageState) window.savePageState();

    // ─── Face 0으로 복귀 ───
    window.switchPdFace(0);
    await new Promise(r => setTimeout(r, 300));
}

// ★ 선반 전용 타이틀 (중앙 정렬, 선반 높이에 맞는 크기)
function _wzShelfTitle(title, font, bW, bH, bL, bT) {
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const isJP = country === 'JP';
    // 선반 높이에 맞게 폰트 크기 조정 (선반은 높이가 작으므로 50% 정도)
    const sz = Math.round(bH * 0.45);
    const displayTitle = title.length > 15 ? title.substring(0, 15) : title;
    const obj = new fabric.Textbox(displayTitle, {
        fontFamily: font, fontSize: sz, fontWeight: 'normal',
        fill: '#ffffff',
        originX: 'center', originY: 'center', textAlign: 'center',
        left: bL + bW * 0.5, top: bT + bH * 0.5,
        width: bW * 0.90,
        lineHeight: 1.0,
        charSpacing: isJP ? 40 : 60,
        splitByGrapheme: isJP ? true : false
    });
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ============================================================
// ★ 허니콤 박스 전용 멀티페이스 마법사 (6면 동일 디자인)
// ============================================================
async function runDesignWizardForBox(title, style, bodyText) {
    // ─── Face 0 (Front): 풀 마법사 실행 ───
    await runDesignWizard(title, style, bodyText);
    if (window.savePageState) window.savePageState();

    // Face 0의 캔버스 JSON 캡처 (보드 제외한 오브젝트들)
    const face0Json = canvas.toJSON(['id','isBoard','selectable','evented','locked','isGuide','isMockup','excludeFromExport','isEffectGroup','isMainText','isClone','paintFirst','isTemplateBackground','isBottomOverlay']);
    const keywords = _wzExtractKeywords(title);

    // ─── Face 1~5: 동일 디자인 복제 ───
    for (let fi = 1; fi <= 5; fi++) {
        window.switchBoxFace(fi);
        await new Promise(r => setTimeout(r, 500));
        // 기존 오브젝트 제거 (보드 제외)
        canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
        const board = canvas.getObjects().find(o => o.isBoard);
        if (!board) continue;
        const bW = board.width * (board.scaleX || 1), bH = board.height * (board.scaleY || 1);
        const bL = board.left, bT = board.top;

        // 배경 그라데이션 (같은 스타일)
        await _wzBg(keywords, bW, bH, bL, bT);

        // 하단 오버레이
        const [bgC1, bgC2] = window._wzBgColors || ['#1a0033','#0d001a'];
        function darken(hex, factor) {
            const r = Math.round(parseInt(hex.slice(1,3),16) * factor);
            const g = Math.round(parseInt(hex.slice(3,5),16) * factor);
            const b = Math.round(parseInt(hex.slice(5,7),16) * factor);
            return '#' + [r,g,b].map(v => Math.min(255,v).toString(16).padStart(2,'0')).join('');
        }
        const overlay = new fabric.Rect({
            width: bW, height: bH * 0.28,
            left: bL, top: bT + bH * 0.72,
            originX:'left', originY:'top',
            fill: new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: 0, y2: bH * 0.28 },
                colorStops: [
                    { offset: 0, color: darken(bgC2, 0.35) },
                    { offset: 1, color: darken(bgC2, 0.15) }
                ]
            }),
            opacity: 1, rx: 0, ry: 0, isBottomOverlay: true
        });
        canvas.add(overlay);
        const bgObj = canvas.getObjects().find(o => o.isTemplateBackground);
        if (bgObj) canvas.moveTo(overlay, canvas.getObjects().indexOf(bgObj) + 1);

        // 타이틀
        const country = window.SITE_CONFIG?.COUNTRY || 'KR';
        const titleFontMap = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
        let titleFont = titleFontMap[country] || 'Impact, Arial Black, sans-serif';
        if (country === 'JP' && window.DYNAMIC_FONTS) {
            const popFont = window.DYNAMIC_FONTS.find(f => f.font_name?.includes('ポプ'));
            if (popFont) titleFont = popFont.font_family;
        }
        const descFont = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Noto Sans KR';
        const S = WIZARD_STYLES[style] || WIZARD_STYLES.blue;
        await _wzTitle(title, titleFont, S, bW, bH, bL, bT);

        // 설명
        const descText = await _wzGetDescText(title);
        _wzBottomBox(descText, S, descFont, bW, bH, bL, bT);

        // 요소
        await _wzElem(keywords, bW, bH, bL, bT);

        canvas.requestRenderAll();
        if (window.savePageState) window.savePageState();
    }

    // ─── Face 0으로 복귀 ───
    window.switchBoxFace(0);
    await new Promise(r => setTimeout(r, 300));
}

// ============================================================
// ★ 글씨 스카시 전용 디자인 생성기 (타이틀 + 하단텍스트)
// ============================================================
export async function runDesignWizardForLetterSign(titleText, bottomText, style) {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) throw new Error('No canvas board');
    const bW = board.width * (board.scaleX||1), bH = board.height * (board.scaleY||1);
    const bL = board.left, bT = board.top;

    // 기존 오브젝트 제거
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    canvas.discardActiveObject();

    // 스카시 색상 — 테마색 = 하단박스 색
    const lsColors = {
        neon:    { box:'#1a237e', boxText:'#fff' },
        ocean:   { box:'#004d40', boxText:'#fff' },
        flame:   { box:'#bf360c', boxText:'#fff' },
        forest:  { box:'#1b5e20', boxText:'#fff' },
        minimal: { box:'#212121', boxText:'#fff' },
        luxury:  { box:'#3e2723', boxText:'#c9a84c' },
        pastel:  { box:'#6a1b9a', boxText:'#fff' },
        retro:   { box:'#4e342e', boxText:'#ffcc80' },
    };
    const C = lsColors[style] || lsColors.forest;

    // 배경 없음 (타이틀 영역 투명, 하단 박스만 색상)
    window._wzBgColors = ['transparent', 'transparent'];

    // 폰트
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    let titleFont = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Impact, Arial Black, sans-serif';
    if (country === 'JP' && window.DYNAMIC_FONTS) {
        const popFont = window.DYNAMIC_FONTS.find(f => f.font_name?.includes('ポプ'));
        if (popFont) titleFont = popFont.font_family;
    }
    const descFont = { JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' }[country] || 'Noto Sans KR';
    if (titleFont === 'JalnanGothic' && !document.querySelector('style[data-jalnan]')) {
        const st = document.createElement('style'); st.dataset.jalnan = '1';
        st.textContent = `@font-face { font-family:'JalnanGothic'; src:url('https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_231029@1.1/JalnanGothic.woff') format('woff'); font-weight:normal; font-display:swap; }`;
        document.head.appendChild(st);
    }
    [descFont, titleFont].forEach(f => {
        if (f.includes(',') || f === 'JalnanGothic') return;
        const fUrl = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f) + ':wght@400;700;900&display=swap';
        if (!document.querySelector(`link[href="${fUrl}"]`)) { const lk = document.createElement('link'); lk.rel='stylesheet'; lk.href=fUrl; document.head.appendChild(lk); }
    });
    await new Promise(r => setTimeout(r, 400));

    // ── 스카시 레이아웃: 위=타이틀(크게, 박스 바로 위), 아래=서브글씨 박스 ──

    // 하단 박스 (전체 높이의 하단 35%)
    const boxH = bH * 0.35;
    const boxTop = bT + bH - boxH;

    // 타이틀: 박스 바로 위에 밀착
    const titleSize = Math.max(Math.round(bH * 0.30), 30);
    const titleBottom = boxTop; // 타이틀 하단 = 박스 상단
    const titleTop = titleBottom - titleSize * 1.15; // 폰트 높이 + 여백

    // 타이틀 그림자
    canvas.add(new fabric.Textbox(titleText, {
        fontFamily: titleFont, fontSize: titleSize, fontWeight: 'bold',
        fill: '#000000', textAlign: 'center', opacity: 0.12,
        originX: 'center', originY: 'top',
        left: bL + bW / 2 + 3, top: titleTop + 4,
        width: bW * 0.90, lineHeight: 1.1, charSpacing: 50,
        selectable: false, evented: false,
    }));

    // 타이틀 메인 (테마색 = 박스색)
    const titleObj = new fabric.Textbox(titleText, {
        fontFamily: titleFont, fontSize: titleSize, fontWeight: 'bold',
        fill: C.box, textAlign: 'center',
        originX: 'center', originY: 'top',
        left: bL + bW / 2, top: titleTop,
        width: bW * 0.90, lineHeight: 1.1, charSpacing: 50,
    });
    canvas.add(titleObj);
    canvas.add(new fabric.Rect({
        width: bW, height: boxH, left: bL, top: boxTop,
        fill: C.box, originX:'left', originY:'top',
    }));

    // 하단 박스 서브 텍스트
    if (bottomText) {
        const btSize = Math.max(Math.round(boxH * 0.22), 14);
        canvas.add(new fabric.Textbox(bottomText, {
            fontFamily: descFont + ', sans-serif', fontSize: btSize, fontWeight: '700',
            fill: C.boxText, textAlign: 'center',
            originX: 'center', originY: 'center',
            left: bL + bW / 2, top: boxTop + boxH / 2,
            width: bW * 0.85, lineHeight: 1.3,
        }));
    }

    canvas.requestRenderAll();

    // 폰트 리렌더
    setTimeout(() => {
        canvas.getObjects().forEach(o => {
            if (o.type === 'textbox' || o.type === 'i-text') { o.set('dirty', true); o.initDimensions && o.initDimensions(); }
        });
        canvas.requestRenderAll();
    }, 800);
}

// ─── Step 1: Background (data_url 원본, 잠금 처리) ───
// ─── 벡터 그라데이션 배경 팔레트 (스타일별 랜덤) ───
const _WZ_GRADIENT_PALETTES = {
    ocean:    [['#667eea','#764ba2'],['#4facfe','#00f2fe'],['#89f7fe','#66a6ff'],['#a1c4fd','#c2e9fb']],
    sunset:   [['#f6d365','#fda085'],['#ffecd2','#fcb69f'],['#fddb92','#d1fdff'],['#fccb90','#d57eeb']],
    rose:     [['#ff9a9e','#fad0c4'],['#fbc2eb','#a6c1ee'],['#f78ca0','#f9748f'],['#c471f5','#fa71cd']],
    midnight: [['#0f0c29','#302b63'],['#1a002e','#2d004f'],['#1e1b4b','#312e81'],['#020024','#090979']],
    forest:   [['#11998e','#38ef7d'],['#56ab2f','#a8e063'],['#134e5e','#71b280'],['#2c7744','#a8e6a3']],
    lavender: [['#a18cd1','#fbc2eb'],['#667eea','#764ba2'],['#6a85b6','#bac8e0'],['#c471f5','#e8cbc0']],
    coral:    [['#ff6b6b','#feca57'],['#f093fb','#f5576c'],['#ff9a9e','#fecfef'],['#fc5c7d','#6a82fb']],
    arctic:   [['#e0eafc','#cfdef3'],['#dfe6e9','#b2bec3'],['#cfd9df','#e2ebf0'],['#f5f7fa','#c3cfe2']],
    neon:     [['#4a00e0','#8e2de2'],['#7b2ff7','#f107a3'],['#6a0dad','#c471ed'],['#3a0ca3','#7209b7']],
    flame:    [['#f12711','#f5af19'],['#eb3349','#f45c43'],['#e65c00','#f9d423'],['#d31027','#ea384d']],
    moody:    [['#0f2027','#203a43'],['#141e30','#243b55'],['#1a1a2e','#16213e'],['#232526','#414345']],
    noir:     [['#0f0f0f','#2c2c2c'],['#1a1a1a','#3d3d3d'],['#0d0d0d','#262626'],['#111111','#333333']]
};

async function _wzBg(keywords, bW, bH, bL, bT) {
    // ★ 프로모 모드: 기존 그라데이션 방식 유지
    const promoSel = window.__promoSelection;
    const promoPanel = window.__activePromoPanel;
    if (promoSel && typeof promoPanel === 'number') {
        const style = window._wzCurrentStyle || 'blue';
        const palettes = _WZ_GRADIENT_PALETTES[style] || _WZ_GRADIENT_PALETTES.blue;
        const [c1, c2] = palettes[Math.floor(Math.random() * palettes.length)];
        window._wzBgColors = [c1, c2];
        const gradFill = new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: bW, y2: bH },
            colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]
        });
        const panelBg = canvas.getObjects().find(o => o._promoPanelBg && o._promoPanel === promoPanel);
        if (panelBg) { panelBg.set('fill', gradFill); canvas.requestRenderAll(); return; }
    }

    // ★ 템플릿 이미지 검색 (photo-bg, user_image 카테고리 우선)
    let bgImageUrl = null;
    const _sb = sb || window.sb;
    if (_sb) {
        const searchKws = _wzTranslateForSearch(keywords);
        const allKws = [...new Set([...searchKws, ...keywords])];
        for (const kw of allKws.slice(0, 5)) {
            const { data } = await _sb.from('library')
                .select('id, thumb_url, data_url, category')
                .in('category', ['photo-bg', 'user_image'])
                .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
                .eq('status', 'approved')
                .order('is_featured', { ascending: false, nullsFirst: false })
                .limit(5);
            const filtered = _wzFilterPremium(data);
            if (filtered && filtered.length) {
                const item = filtered[Math.floor(Math.random() * Math.min(filtered.length, 3))];
                bgImageUrl = _wzExtractBgUrl(item);
                if (bgImageUrl) break;
            }
        }
        // 폴백: 아무 photo-bg 이미지
        if (!bgImageUrl) {
            const { data } = await _sb.from('library')
                .select('id, thumb_url, data_url, category')
                .in('category', ['photo-bg', 'user_image'])
                .eq('status', 'approved')
                .order('is_featured', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(10);
            const filtered = _wzFilterPremium(data);
            if (filtered && filtered.length) {
                const item = filtered[Math.floor(Math.random() * Math.min(filtered.length, 5))];
                bgImageUrl = _wzExtractBgUrl(item);
            }
        }
    }

    // 이미지 배경 적용
    if (bgImageUrl) {
        window._wzBgColors = ['#222222', '#111111']; // 사진 위 → 흰 글씨
        await new Promise((resolve) => {
            fabric.Image.fromURL(bgImageUrl, (img) => {
                if (!img) { resolve(); return; }
                const scale = Math.max((bW + 4) / img.width, (bH + 4) / img.height);
                img.set({
                    scaleX: scale, scaleY: scale,
                    left: bL + bW / 2, top: bT + bH / 2,
                    originX: 'center', originY: 'center',
                    selectable: false, evented: false,
                    lockMovementX: true, lockMovementY: true,
                    lockRotation: true, lockScalingX: true, lockScalingY: true,
                    hasControls: false, hasBorders: false,
                    isTemplateBackground: true
                });
                canvas.add(img);
                canvas.sendToBack(img);
                const board = canvas.getObjects().find(o => o.isBoard);
                if (board) { canvas.sendToBack(img); canvas.sendToBack(board); }
                canvas.requestRenderAll();
                resolve();
            }, { crossOrigin: 'anonymous' });
        });
        return;
    }

    // ★ 폴백: 그라데이션 배경
    const style = window._wzCurrentStyle || 'blue';
    const palettes = _WZ_GRADIENT_PALETTES[style] || _WZ_GRADIENT_PALETTES.blue;
    const [c1, c2] = palettes[Math.floor(Math.random() * palettes.length)];
    window._wzBgColors = [c1, c2];
    const gradFill = new fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: bW, y2: bH },
        colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }]
    });
    const bgRect = new fabric.Rect({
        width: bW + 4, height: bH + 4,
        left: bL - 2, top: bT - 2,
        originX:'left', originY:'top',
        fill: gradFill,
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockRotation: true, lockScalingX: true, lockScalingY: true,
        hasControls: false, hasBorders: false,
        isTemplateBackground: true
    });
    canvas.add(bgRect);
    canvas.sendToBack(bgRect);
    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) { canvas.sendToBack(bgRect); canvas.sendToBack(board); }
    canvas.requestRenderAll();
}

// 배경 이미지 URL 추출 헬퍼
function _wzExtractBgUrl(item) {
    if (!item) return null;
    const raw = item.data_url;
    if (!raw) return item.thumb_url;
    if (typeof raw === 'string' && (raw.startsWith('http') || raw.startsWith('data:'))) return raw;
    try {
        const json = typeof raw === 'object' ? raw : JSON.parse(raw);
        if (typeof json === 'string') return json;
        if (json.objects) {
            for (const obj of json.objects) {
                if (obj.src && (obj.src.startsWith('http') || obj.src.startsWith('data:'))) return obj.src;
            }
        }
    } catch(e) {}
    return item.thumb_url;
}

// ★ 배경 밝기 자동 감지 → 밝으면 검정 글씨, 어두우면 흰색 글씨
function _wzIsDarkBg() {
    const [c1, c2] = window._wzBgColors || ['#ffffff','#ffffff'];
    function lum(hex) {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return 0.299*r + 0.587*g + 0.114*b;
    }
    return (lum(c1) + lum(c2)) / 2 < 140;
}

// ─── Step 2: Title text (효과 없이 깔끔한 텍스트) ───
async function _wzTitle(title, font, S, bW, bH, bL, bT) {
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    // ★ 타이틀 크기 확대 (0.075 → 0.095)
    const sz = Math.round(bW * (country === 'JP' ? 0.07 : 0.095));

    // 줄바꿈: 윗줄에 많이, 아랫줄에 적게 (마지막 어절만 아래로)
    let displayTitle = title;
    const words = title.split(' ');
    if (words.length >= 3) {
        const lastWords = words.length >= 4 ? 2 : 1;
        const topLine = words.slice(0, words.length - lastWords).join(' ');
        const bottomLine = words.slice(words.length - lastWords).join(' ');
        displayTitle = topLine + '\n' + bottomLine;
    } else if (words.length === 2) {
        displayTitle = words[0] + '\n' + words[1];
    } else if (title.length > 6) {
        const cut = Math.ceil(title.length * 0.65);
        displayTitle = title.substring(0, cut) + '\n' + title.substring(cut);
    }

    const isJP = country === 'JP';
    const obj = new fabric.Textbox(displayTitle, {
        fontFamily: font, fontSize: sz, fontWeight: 'normal',
        fill: '#ffffff',
        originX:'center', originY:'center', textAlign:'center',
        left: bL + bW * 0.5, top: bT + bH * 0.30,
        width: bW * 0.80, lineHeight: isJP ? 1.1 : 0.95,
        charSpacing: isJP ? 40 : 80,
        splitByGrapheme: isJP ? true : false
    });
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
        const _sbFn = sb || window.sb;
        if (!_sbFn) throw new Error('DB not ready');
        const _aiCall = _sbFn.functions.invoke('generate-text', {
            body: { prompt: langPrompts[c] || langPrompts['US'], max_tokens: 200 }
        });
        const _timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
        const { data, error } = await Promise.race([_aiCall, _timeout]);
        if (!error && data) text = (typeof data === 'string' ? data : data.text || data.result || '').trim();
    } catch(e) { console.warn('[Wizard] 설명 생성 실패/타임아웃:', e.message); }

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

// ─── Step 2.5b: 사용자 본문 텍스트 (제목 아래, 중간 크기 고딕) ───
function _wzBodyText(bodyText, descFont, bW, bH, bL, bT) {
    const fSize = Math.round(bW * 0.028);
    const obj = new fabric.Textbox(bodyText, {
        fontFamily: descFont + ', sans-serif', fontSize: fSize,
        fontWeight: '500', fill: 'rgba(255,255,255,0.95)',
        originX:'center', originY:'top', textAlign:'center',
        left: bL + bW * 0.5, top: bT + bH * 0.43,
        width: bW * 0.55,
        lineHeight: 1.5,
        splitByGrapheme: true,
        isWizardBody: true
    });
    if (obj.height > bH * 0.15) {
        obj.set('fontSize', Math.round(fSize * 0.8));
    }
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 3b: 하단 불투명 박스 + 설명 텍스트 (박스 안에 삽입) ───
function _wzBottomBox(descText, S, descFont, bW, bH, bL, bT) {
    // ★ 설명글 하단 배치 (대지 하단 안쪽에 정렬)
    const maxW = bW * 0.55;
    const fSize = Math.round(bW * 0.014);

    const obj = new fabric.Textbox(descText, {
        fontFamily: descFont + ', sans-serif', fontSize: fSize,
        fontWeight:'400', fill: 'rgba(255,255,255,0.9)',
        originX:'center', originY:'bottom', textAlign:'center',
        left: bL + bW * 0.5, top: bT + bH * 0.96,
        width: maxW,
        lineHeight: 1.6,
        splitByGrapheme: true
    });
    if (obj.height > bH * 0.20) {
        obj.set('fontSize', Math.round(fSize * 0.8));
    }
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 4: Related elements (keyword search, 2 items — 하단 박스 좌우) ───
async function _wzElem(keywords, bW, bH, bL, bT) {
    const _sb = sb || window.sb;
    if (!_sb) return;

    // ★ JP/EN → KR 번역 후 검색 (라이브러리가 KR 태그 기반)
    const searchKws = _wzTranslateForSearch(keywords);
    console.log('[Wizard Search]', keywords, '→', searchKws);

    let allItems = [];
    const usedIds = new Set();
    // ★ 마법사는 transparent-graphic (관리자 고화질) 카테고리만 사용, 우선표시 우선
    async function _searchKw(kw) {
        const res = await _sb.from('library')
            .select('id, thumb_url, data_url, category, is_featured')
            .eq('category', 'transparent-graphic')
            .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
            .eq('status','approved')
            .order('is_featured', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(6);
        const filtered = _wzFilterPremium(res.data);
        if (filtered && filtered.length) {
            for (const item of filtered) {
                if (!usedIds.has(item.id)) { usedIds.add(item.id); allItems.push(item); }
            }
        }
    }
    // 번역된 키워드로 검색
    for (const kw of searchKws.slice(0, 6)) await _searchKw(kw);
    // 결과 부족 시 원본 키워드로 재시도
    if (allItems.length < 3) {
        for (const kw of keywords.slice(0, 3)) await _searchKw(kw);
    }
    // ★ 결과 부족 시 키워드 첫 글자 부분 매칭으로 확장 검색
    if (allItems.length < 2) {
        const partialKws = [...new Set([...searchKws, ...keywords])];
        for (const kw of partialKws.slice(0, 4)) {
            if (kw.length >= 2) {
                const short = kw.substring(0, Math.ceil(kw.length / 2));
                await _searchKw(short);
                if (allItems.length >= 3) break;
            }
        }
    }
    // ★ 검색 결과 없으면 우선표시(is_featured)된 요소로 폴백
    if (!allItems.length) {
        const res = await _sb.from('library')
            .select('id, thumb_url, data_url, category, is_featured')
            .eq('category', 'transparent-graphic')
            .eq('status','approved')
            .eq('is_featured', true)
            .order('featured_at', { ascending: false, nullsFirst: true })
            .limit(6);
        const filtered = _wzFilterPremium(res.data);
        if (filtered && filtered.length) {
            for (const item of filtered) {
                if (!usedIds.has(item.id)) { usedIds.add(item.id); allItems.push(item); }
            }
        }
    }
    // ★ 우선표시도 없으면 최종 폴백: 최근 등록순
    if (!allItems.length) {
        const res = await _sb.from('library')
            .select('id, thumb_url, data_url, category, is_featured')
            .eq('category', 'transparent-graphic')
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(6);
        const filtered = _wzFilterPremium(res.data);
        if (filtered && filtered.length) {
            for (const item of filtered) {
                if (!usedIds.has(item.id)) { usedIds.add(item.id); allItems.push(item); }
            }
        }
    }
    if (!allItems.length) return;
    // ★ 요소 2개 배치: 좌측 상단 + 우측 상단
    const data = allItems.length >= 2 ? [allItems[0], allItems[1]] : [allItems[0]];
    const bigSize = bW * 0.32;
    const smallSize = bW * 0.25;
    const positions = [
        { left: bL + bW * 0.18, top: bT + bH * 0.20, size: bigSize },
        { left: bL + bW * 0.85, top: bT + bH * 0.15, size: smallSize }
    ];

    // data_url에서 실제 이미지 URL 추출 (Fabric JSON → objects[].src)
    function _extractImageUrl(item) {
        const raw = item.data_url;
        if (!raw) return item.thumb_url;
        if (typeof raw === 'string' && (raw.startsWith('http') || raw.startsWith('data:image/png'))) return raw;
        try {
            const json = typeof raw === 'object' ? raw : JSON.parse(raw);
            if (json.objects && json.objects.length) {
                for (const obj of json.objects) {
                    if (obj.src && obj.src.startsWith('http')) return obj.src;
                    if (obj.src && obj.src.startsWith('data:image/png')) return obj.src;
                }
            }
        } catch(e) {}
        return item.thumb_url;
    }

    const count = Math.min(data.length, positions.length);
    const promises = data.slice(0, count).map((item, i) => new Promise(resolve => {
        const url = _extractImageUrl(item);
        if (!url) { resolve(); return; }
        const pos = positions[i];
        fabric.Image.fromURL(url, img => {
            if (!img) { resolve(); return; }
            const scale = pos.size / Math.max(img.width, img.height);
            img.set({
                scaleX: scale, scaleY: scale,
                left: pos.left, top: pos.top,
                originX:'center', originY:'center',
                opacity: 1
            });
            canvas.add(img);
            canvas.bringToFront(img);
            resolve();
        }, { crossOrigin:'anonymous' });
    }));
    await Promise.all(promises);

    // ★ 레이어 순서: 배경 → 검정도형 → 요소(이미지) → 텍스트
    // 텍스트만 맨 앞으로 (검정 도형은 요소 뒤에 유지)
    canvas.getObjects().forEach(o => {
        if ((o.type === 'textbox' || o.type === 'i-text') && !o._objects) canvas.bringToFront(o);
    });
    canvas.getObjects().forEach(o => {
        if (o._objects && o._objects.some(c => c.isMainText)) canvas.bringToFront(o);
    });
    canvas.requestRenderAll();
}

// ─── Step 4.5: 장식 1개 (타이틀 아래 중앙) ───
function _wzDecoration(bW, bH, bL, bT) {
    // ORNAMENTS에서 divider 또는 flourish 랜덤 1개 선택
    let ornaments;
    try { ornaments = window._ORNAMENTS_LIST; } catch(e) {}
    if (!ornaments || !ornaments.length) {
        // 인라인 장식 SVG (flourish 스타일)
        const defaultSvgs = [
            '<svg viewBox="0 0 200 60"><path d="M100 50 C100 30, 60 20, 30 25 C20 27, 15 35, 25 38 C35 41, 50 30, 60 25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M100 50 C100 30, 140 20, 170 25 C180 27, 185 35, 175 38 C165 41, 150 30, 140 25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="50" r="3" fill="currentColor"/></svg>',
            '<svg viewBox="0 0 200 60"><path d="M30 30 C50 10, 80 10, 100 30 C120 10, 150 10, 170 30" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 30 C65 45, 85 45, 100 30 C115 45, 135 45, 150 30" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="100" cy="30" r="3" fill="currentColor"/></svg>',
            '<svg viewBox="0 0 200 30"><path d="M10 15 Q50 0 100 15 Q150 30 190 15" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="3" fill="currentColor"/></svg>',
            '<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="85" y2="15" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="2" fill="currentColor"/><line x1="115" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="1"/></svg>'
        ];
        ornaments = defaultSvgs;
    }

    const svgRaw = ornaments[Math.floor(Math.random() * ornaments.length)];
    const svgStr = typeof svgRaw === 'object' ? svgRaw.svg : svgRaw;
    // currentColor → 흰색으로 변환
    const coloredSvg = svgStr.replace(/currentColor/g, 'rgba(255,255,255,0.8)');
    const decoW = bW * 0.30;
    const decoH = decoW * 0.2;

    fabric.loadSVGFromString(coloredSvg, (objects, options) => {
        if (!objects || !objects.length) return;
        const group = fabric.util.groupSVGElements(objects, options);
        const scale = decoW / (group.width || 200);
        group.set({
            scaleX: scale, scaleY: scale,
            left: bL + bW * 0.5,
            top: bT + bH * 0.72,
            originX: 'center', originY: 'center'
        });
        canvas.add(group);
        canvas.bringToFront(group);
        // 텍스트는 항상 장식보다 앞에
        canvas.getObjects().forEach(o => {
            if (o.type === 'textbox' || o.type === 'i-text') canvas.bringToFront(o);
        });
        canvas.requestRenderAll();
    });
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
    const _sb2 = sb || window.sb;
    if (_sb2) {
        for (const kw of keywords) {
            const { data } = await _sb2.from('library')
                .select('id, thumb_url')
                .in('category', ['vector','graphic','transparent-graphic'])
                .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
                .eq('status','approved')
                .order('created_at', { ascending: false })
                .limit(10);
            const filtered = _wzFilterPremium(data);
            if (filtered && filtered.length >= 2) {
                stickerUrls = filtered.slice(0, 3).map(d => d.thumb_url).filter(Boolean);
                break;
            }
        }
        // If not enough results from keyword search, get random approved ones
        if (stickerUrls.length < 3) {
            const { data } = await _sb2.from('library')
                .select('id, thumb_url')
                .in('category', ['vector','graphic','transparent-graphic'])
                .eq('status','approved')
                .order('created_at', { ascending: false })
                .limit(10);
            const filtered2 = _wzFilterPremium(data);
            if (filtered2) stickerUrls = filtered2.slice(0, 3).map(d => d.thumb_url).filter(Boolean);
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

// ==========================================================
// [명함 기본폼] 6종 템플릿 적용
// ==========================================================
export function applyBizCardTemplate(tplId) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) { console.warn('[BizCard] board not found'); return; }

    const bL = board.left, bT = board.top, bW = board.width * board.scaleX, bH = board.height * board.scaleY;
    const F_TITLE = 'Noto Sans KR', F_SUB = 'Noto Sans KR';
    const ACCENT = '#6366f1';
    const T = (k, fb) => (window.t ? window.t(k, fb) : fb);

    // 언어별 placeholder 텍스트
    const d = {
        company: T('biz_ph_company', '카멜레온 프린팅'),
        slogan: T('biz_ph_slogan', 'Creative Design Solution'),
        name: T('biz_ph_name', '홍길동'),
        title: T('biz_ph_title', '대리 / Design Team'),
        titleShort: T('biz_ph_title_short', '대리'),
        phone: T('biz_ph_phone', '010-1234-5678'),
        email: T('biz_ph_email', 'hello@example.com'),
        address: T('biz_ph_address', '서울시 강남구 역삼동 123-45'),
    };

    const txt = (str, opts) => {
        const t = new fabric.IText(str, {
            fontFamily: F_SUB, fontSize: 14, fill: '#1e293b', fontWeight: '400',
            originX: 'left', originY: 'top', ...opts
        });
        canvas.add(t); canvas.bringToFront(t);
        return t;
    };

    const rect = (opts) => {
        const r = new fabric.Rect({ fill: ACCENT, ...opts });
        canvas.add(r); canvas.bringToFront(r);
        return r;
    };

    // ── 가로형 h1: 클래식 (좌: 회사+슬로건, 구분선, 우: 이름+연락처) ──
    if (tplId === 'h1') {
        txt(d.company, { left: bL + bW*0.08, top: bT + bH*0.28, fontSize: Math.round(bH*0.12), fontWeight: '700', fill: '#1e293b' });
        txt(d.slogan, { left: bL + bW*0.08, top: bT + bH*0.46, fontSize: Math.round(bH*0.055), fill: '#94a3b8' });
        rect({ left: bL + bW*0.50, top: bT + bH*0.20, width: 1, height: bH*0.6, fill: '#e2e8f0' });
        txt(d.name, { left: bL + bW*0.56, top: bT + bH*0.22, fontSize: Math.round(bH*0.11), fontWeight: '700' });
        txt(d.title, { left: bL + bW*0.56, top: bT + bH*0.38, fontSize: Math.round(bH*0.055), fill: '#94a3b8' });
        txt(d.phone, { left: bL + bW*0.56, top: bT + bH*0.58, fontSize: Math.round(bH*0.05), fill: '#64748b' });
        txt(d.email, { left: bL + bW*0.56, top: bT + bH*0.70, fontSize: Math.round(bH*0.05), fill: '#64748b' });
        txt(d.address, { left: bL + bW*0.56, top: bT + bH*0.82, fontSize: Math.round(bH*0.05), fill: '#64748b' });
    }

    // ── 가로형 h2: 모던 (상단 회사 중앙, 하단 이름+연락처 좌정렬, 컬러바) ──
    else if (tplId === 'h2') {
        txt(d.company, { left: bL + bW*0.5, top: bT + bH*0.15, fontSize: Math.round(bH*0.11), fontWeight: '700', originX: 'center', textAlign: 'center' });
        txt(d.name, { left: bL + bW*0.10, top: bT + bH*0.45, fontSize: Math.round(bH*0.10), fontWeight: '700' });
        txt(d.title, { left: bL + bW*0.10, top: bT + bH*0.60, fontSize: Math.round(bH*0.055), fill: '#64748b' });
        txt(`${d.phone}  |  ${d.email}`, { left: bL + bW*0.10, top: bT + bH*0.73, fontSize: Math.round(bH*0.05), fill: '#64748b' });
        rect({ left: bL, top: bT + bH*0.90, width: bW, height: bH*0.10, fill: ACCENT });
    }

    // ── 가로형 h3: 미니멀 (이름 크게 중앙, 하단 연락처 한줄) ──
    else if (tplId === 'h3') {
        txt(d.name, { left: bL + bW*0.5, top: bT + bH*0.30, fontSize: Math.round(bH*0.18), fontWeight: '700', originX: 'center', textAlign: 'center', letterSpacing: 200 });
        txt(d.title, { left: bL + bW*0.5, top: bT + bH*0.55, fontSize: Math.round(bH*0.06), fill: '#94a3b8', originX: 'center', textAlign: 'center' });
        txt(`${d.phone}  ·  ${d.email}  ·  ${d.address}`, { left: bL + bW*0.5, top: bT + bH*0.78, fontSize: Math.round(bH*0.045), fill: '#64748b', originX: 'center', textAlign: 'center' });
    }

    // ── 가로형 h4: 컬러블록 (좌 40% 컬러배경+이름, 우 60% 연락처) ──
    else if (tplId === 'h4') {
        rect({ left: bL, top: bT, width: bW*0.40, height: bH, fill: '#1e293b' });
        txt(d.name, { left: bL + bW*0.20, top: bT + bH*0.35, fontSize: Math.round(bH*0.13), fontWeight: '700', fill: '#ffffff', originX: 'center', textAlign: 'center' });
        txt(d.titleShort, { left: bL + bW*0.20, top: bT + bH*0.55, fontSize: Math.round(bH*0.06), fill: '#94a3b8', originX: 'center', textAlign: 'center' });
        txt(d.company, { left: bL + bW*0.48, top: bT + bH*0.20, fontSize: Math.round(bH*0.07), fontWeight: '700', fill: '#1e293b' });
        txt(d.phone, { left: bL + bW*0.48, top: bT + bH*0.42, fontSize: Math.round(bH*0.055), fill: '#64748b' });
        txt(d.email, { left: bL + bW*0.48, top: bT + bH*0.55, fontSize: Math.round(bH*0.055), fill: '#64748b' });
        txt(d.address, { left: bL + bW*0.48, top: bT + bH*0.68, fontSize: Math.round(bH*0.055), fill: '#64748b' });
    }

    // ── 세로형 v1: 세로 클래식 (상단 회사명, 중간 이름, 하단 연락처) ──
    else if (tplId === 'v1') {
        txt(d.company, { left: bL + bW*0.5, top: bT + bH*0.12, fontSize: Math.round(bW*0.11), fontWeight: '700', originX: 'center', textAlign: 'center' });
        txt(d.slogan, { left: bL + bW*0.5, top: bT + bH*0.22, fontSize: Math.round(bW*0.05), fill: '#94a3b8', originX: 'center', textAlign: 'center' });
        rect({ left: bL + bW*0.25, top: bT + bH*0.30, width: bW*0.5, height: 1, fill: '#e2e8f0' });
        txt(d.name, { left: bL + bW*0.5, top: bT + bH*0.38, fontSize: Math.round(bW*0.14), fontWeight: '700', originX: 'center', textAlign: 'center' });
        txt(d.title, { left: bL + bW*0.5, top: bT + bH*0.50, fontSize: Math.round(bW*0.055), fill: '#94a3b8', originX: 'center', textAlign: 'center' });
        txt(d.phone, { left: bL + bW*0.5, top: bT + bH*0.68, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
        txt(d.email, { left: bL + bW*0.5, top: bT + bH*0.75, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
        txt(d.address, { left: bL + bW*0.5, top: bT + bH*0.82, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
    }

    // ── 세로형 v2: 세로 컬러 (상단 40% 컬러+이름, 하단 60% 연락처) ──
    else if (tplId === 'v2') {
        rect({ left: bL, top: bT, width: bW, height: bH*0.40, fill: '#1e293b' });
        txt(d.name, { left: bL + bW*0.5, top: bT + bH*0.13, fontSize: Math.round(bW*0.14), fontWeight: '700', fill: '#ffffff', originX: 'center', textAlign: 'center' });
        txt(d.title, { left: bL + bW*0.5, top: bT + bH*0.27, fontSize: Math.round(bW*0.055), fill: '#94a3b8', originX: 'center', textAlign: 'center' });
        txt(d.company, { left: bL + bW*0.5, top: bT + bH*0.48, fontSize: Math.round(bW*0.08), fontWeight: '700', fill: '#1e293b', originX: 'center', textAlign: 'center' });
        txt(d.phone, { left: bL + bW*0.5, top: bT + bH*0.62, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
        txt(d.email, { left: bL + bW*0.5, top: bT + bH*0.70, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
        txt(d.address, { left: bL + bW*0.5, top: bT + bH*0.78, fontSize: Math.round(bW*0.05), fill: '#64748b', originX: 'center', textAlign: 'center' });
    }

    canvas.renderAll();
}

// ★ 홍보물: 2페이지(앞/뒤) 전체 펼침 캔버스 + 접지선 + 패널 네비게이션
export function applyPromoPages(selection) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) { console.warn('[Promo] board not found'); return; }

    window.__promoSelection = selection;
    const panels = selection.panelCount || 1;
    const _t = (k, fb) => (window.t ? window.t(k, fb) : fb);

    // 패널 라벨 (앞면 기준)
    const frontLabels = _getPromoPanelLabels(selection, 'front');
    const backLabels = _getPromoPanelLabels(selection, 'back');

    // 1페이지 (앞면): 패널 배경 + 재단선 + 접지선
    _drawPromoPage(selection, frontLabels);
    if (window.savePageState) window.savePageState();

    // 2페이지 (뒷면) 생성
    if (selection.pageCount > 1 && window.addPage) {
        setTimeout(() => {
            window.addPage();
            setTimeout(() => {
                _drawPromoPage(selection, backLabels);
                if (window.savePageState) window.savePageState();
                // 1페이지로 돌아가기
                setTimeout(() => {
                    if (window.goToPage) window.goToPage(0);
                    // 네비게이션 바 구축
                    _buildPromoNav(selection, frontLabels, backLabels);
                    // 첫 패널 활성화
                    window.__activePromoPanel = 0;
                }, 300);
            }, 300);
        }, 400);
    } else {
        // 단면
        _buildPromoNav(selection, frontLabels, []);
        window.__activePromoPanel = 0;
    }

    console.log('[Promo] Setup:', panels, 'panels per face,', selection.pageCount, 'pages');
}

// 앞면/뒷면 패널 라벨 배열
function _getPromoPanelLabels(sel, face) {
    const _t = (k, fb) => (window.t ? window.t(k, fb) : fb);
    const faceLabel = face === 'front' ? _t('promo_face_front','앞면') : _t('promo_face_back','뒷면');
    if (sel.foldType === 'tri') {
        return [
            { face: faceLabel, pos: _t('promo_pos_left','좌측') },
            { face: faceLabel, pos: _t('promo_pos_center','중앙') },
            { face: faceLabel, pos: _t('promo_pos_right','우측') }
        ];
    } else if (sel.foldType === 'half') {
        return [
            { face: faceLabel, pos: _t('promo_pos_left','좌측') },
            { face: faceLabel, pos: _t('promo_pos_right','우측') }
        ];
    }
    return [{ face: faceLabel, pos: '' }];
}

// 한 페이지에 패널 배경 + 재단선 + 접지선 그리기
function _drawPromoPage(selection, panelLabels) {
    if (!canvas) return;
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;

    const bL = board.left, bT = board.top;
    const bW = board.width * (board.scaleX || 1);
    const bH = board.height * (board.scaleY || 1);
    const BP = Math.round(3 * 3.7795); // 3mm bleed in px
    const panels = selection.panelCount || 1;

    const guideOpts = {
        selectable: false, evented: false, excludeFromExport: true,
        isGuide: true, hoverCursor: 'default'
    };

    // 패널별 배경색 (보드 전체를 나눠서 채움)
    const bgColors = ['#f5f3ff','#ffffff','#fefce8','#eff6ff','#fef2f2','#f0fdf4'];
    for (let i = 0; i < panels; i++) {
        const pw = bW / panels;
        const bg = new fabric.Rect({
            left: bL + pw * i, top: bT, width: pw, height: bH,
            fill: bgColors[i % bgColors.length],
            selectable: false, evented: false, locked: true,
            _promoPanel: i, _promoPanelBg: true
        });
        canvas.add(bg);
        const boardIdx = canvas.getObjects().indexOf(board);
        canvas.moveTo(bg, boardIdx + 1);
    }

    // 재단선 (외곽 3mm 안쪽)
    const trimRect = new fabric.Rect({
        left: bL + BP, top: bT + BP,
        width: bW - BP * 2, height: bH - BP * 2,
        fill: 'transparent', stroke: '#dc2626', strokeWidth: 1.5,
        strokeDashArray: [8, 4], ...guideOpts
    });
    canvas.add(trimRect);

    const bleedLabel = new fabric.Text('3mm BLEED', {
        left: bL + 2, top: bT + 2,
        fontSize: 9, fill: '#dc2626', fontFamily: 'Arial',
        fontWeight: 'bold', opacity: 0.9, ...guideOpts
    });
    canvas.add(bleedLabel);

    // 접지선 (패널 경계)
    if (panels > 1) {
        for (let i = 1; i < panels; i++) {
            const x = bL + (bW / panels) * i;
            const foldLine = new fabric.Line([x, bT + BP, x, bT + bH - BP], {
                stroke: '#1d4ed8', strokeWidth: 2, strokeDashArray: [10, 5], ...guideOpts
            });
            canvas.add(foldLine);
            const foldLabel = new fabric.Text('FOLD', {
                left: x + 4, top: bT + bH / 2 - 6,
                fontSize: 11, fill: '#1d4ed8', fontFamily: 'Arial',
                fontWeight: 'bold', opacity: 1, ...guideOpts
            });
            canvas.add(foldLabel);
        }
    }

    // 패널 라벨 (각 패널 좌상단에 작게)
    panelLabels.forEach((label, i) => {
        const pw = (bW - BP * 2) / panels;
        const labelText = label.pos ? `${label.pos}` : label.face;
        const panelLabel = new fabric.Text(labelText, {
            left: bL + BP + pw * i + 6, top: bT + BP + 4,
            fontSize: 10, fill: '#6366f1', fontFamily: 'Arial',
            fontWeight: 'bold', opacity: 0.6, ...guideOpts
        });
        canvas.add(panelLabel);
    });

    canvas.renderAll();
}

// 패널 네비게이션 바 (앞면/뒷면 + 각 패널 선택)
function _buildPromoNav(selection, frontLabels, backLabels) {
    const nav = document.getElementById('promoPanelNav');
    if (!nav) return;

    nav.innerHTML = '';
    nav.style.display = 'flex';

    const panels = selection.panelCount || 1;
    const hasBack = selection.pageCount > 1;
    const allLabels = [...frontLabels, ...backLabels];

    // 스타일 주입 (한 번만)
    if (!document.getElementById('promoNavStyle')) {
        const style = document.createElement('style');
        style.id = 'promoNavStyle';
        style.textContent = `
            .promo-nav-btn {
                border: none; background: transparent; cursor: pointer; padding: 6px 10px;
                border-radius: 8px; text-align: center; min-width: 48px; transition: all 0.2s;
                color: #64748b; position: relative;
            }
            .promo-nav-btn:hover { background: #f1f5f9; }
            .promo-nav-btn.active {
                background: #6366f1; color: #fff !important;
                box-shadow: 0 2px 8px rgba(99,102,241,0.3);
            }
            .promo-nav-btn.active span { color: #fff !important; }
            .promo-nav-sep { width:1px; height:28px; background:#e2e8f0; margin:0 4px; align-self:center; }
            .promo-nav-face { font-size:9px; color:#94a3b8; display:block; line-height:1; margin-bottom:2px; }
            .promo-nav-pos { font-size:12px; font-weight:700; display:block; line-height:1.2; }
        `;
        document.head.appendChild(style);
    }

    function addBtn(label, globalIdx, pageIdx, panelIdx) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';

        const btn = document.createElement('button');
        btn.className = 'promo-nav-btn' + (globalIdx === 0 ? ' active' : '');
        btn.dataset.globalIdx = globalIdx;
        btn.dataset.pageIdx = pageIdx;
        btn.dataset.panelIdx = panelIdx;

        const faceSpan = document.createElement('span');
        faceSpan.className = 'promo-nav-face';
        faceSpan.textContent = label.face;

        const posSpan = document.createElement('span');
        posSpan.className = 'promo-nav-pos';
        posSpan.textContent = label.pos || (globalIdx + 1) + '면';

        btn.appendChild(faceSpan);
        btn.appendChild(posSpan);

        btn.onclick = () => {
            // 페이지 전환 (앞면=0, 뒷면=1)
            if (window.goToPage) window.goToPage(pageIdx);
            // 활성 패널 설정
            window.__activePromoPanel = panelIdx;
            nav.querySelectorAll('.promo-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // 패널 영역 하이라이트
            _highlightPromoPanel(selection, panelIdx);
        };

        // 하단 액션 (배경색 + 마법사)
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:4px;align-items:center;';

        // 배경색 피커
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = _getBgColors()[globalIdx % _getBgColors().length];
        colorInput.title = label.pos ? label.face + ' ' + label.pos + ' BG' : 'BG';
        colorInput.style.cssText = 'width:18px;height:18px;border:2px solid #e2e8f0;border-radius:50%;cursor:pointer;padding:0;overflow:hidden;-webkit-appearance:none;';
        colorInput.onclick = (e) => e.stopPropagation();
        colorInput.oninput = (e) => {
            e.stopPropagation();
            // 해당 페이지로 이동 후 패널 배경 변경
            if (window.goToPage) window.goToPage(pageIdx);
            setTimeout(() => {
                _changePromoPanelBg(panelIdx, e.target.value);
            }, 100);
        };

        // 마법사 버튼
        const wizBtn = document.createElement('button');
        wizBtn.title = 'Design Wizard';
        wizBtn.style.cssText = 'width:18px;height:18px;border:none;background:#f1f5f9;border-radius:50%;cursor:pointer;font-size:10px;color:#6366f1;display:flex;align-items:center;justify-content:center;padding:0;';
        wizBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="font-size:9px;"></i>';
        wizBtn.onclick = (e) => {
            e.stopPropagation();
            // 해당 패널 선택 후 마법사 오픈
            if (window.goToPage) window.goToPage(pageIdx);
            window.__activePromoPanel = panelIdx;
            nav.querySelectorAll('.promo-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _highlightPromoPanel(selection, panelIdx);
        };

        actions.appendChild(colorInput);
        actions.appendChild(wizBtn);

        wrap.appendChild(btn);
        wrap.appendChild(actions);
        nav.appendChild(wrap);
    }

    function _getBgColors() {
        return ['#f5f3ff','#ffffff','#fefce8','#eff6ff','#fef2f2','#f0fdf4'];
    }

    // 앞면 패널 버튼
    frontLabels.forEach((label, i) => addBtn(label, i, 0, i));

    // 구분선
    if (hasBack) {
        const sep = document.createElement('div');
        sep.className = 'promo-nav-sep';
        nav.appendChild(sep);
        // 뒷면 패널 버튼
        backLabels.forEach((label, i) => addBtn(label, panels + i, 1, i));
    }

    // 페이지 전환 시 네비 동기화
    window.__promoNavSync = (pageIdx) => {
        // 해당 페이지의 첫 패널을 활성화
        const firstBtn = nav.querySelector(`[data-page-idx="${pageIdx}"]`);
        if (firstBtn) {
            nav.querySelectorAll('.promo-nav-btn').forEach(b => b.classList.remove('active'));
            firstBtn.classList.add('active');
            window.__activePromoPanel = parseInt(firstBtn.dataset.panelIdx);
        }
    };
}

// 선택된 패널 영역 하이라이트 (점선 사각형)
function _highlightPromoPanel(selection, panelIdx) {
    if (!canvas) return;
    // 기존 하이라이트 제거
    canvas.getObjects().filter(o => o._promoHighlight).forEach(o => canvas.remove(o));

    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) return;
    const bL = board.left, bT = board.top;
    const bW = board.width * (board.scaleX || 1);
    const bH = board.height * (board.scaleY || 1);
    const BP = Math.round(3 * 3.7795);
    const panels = selection.panelCount || 1;
    if (panels <= 1) return;

    const pw = bW / panels;
    const highlight = new fabric.Rect({
        left: bL + pw * panelIdx, top: bT,
        width: pw, height: bH,
        fill: 'rgba(99,102,241,0.06)',
        stroke: '#6366f1', strokeWidth: 2, strokeDashArray: [6, 3],
        selectable: false, evented: false,
        _promoHighlight: true, excludeFromExport: true
    });
    canvas.add(highlight);
    canvas.renderAll();
}

// 패널 배경색 변경
function _changePromoPanelBg(panelIdx, color) {
    if (!canvas) return;
    const bg = canvas.getObjects().find(o => o._promoPanelBg && o._promoPanel === panelIdx);
    if (bg) {
        bg.set('fill', color);
        canvas.renderAll();
        if (window.savePageState) window.savePageState();
    }
}