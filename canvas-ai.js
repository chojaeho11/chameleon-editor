// canvas-ai.js
import { canvas } from "./canvas-core.js";
import { sb, currentUser } from "./config.js"; 

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
    if (!sb) throw new Error("Supabase 연결 실패");
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

        if(startResult) startResult.innerHTML = '<span style="color:#cbd5e1;">이미지가 여기에 표시됩니다</span>';
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
            if (!text) return alert(t('msg_input_desc', "설명을 입력해주세요."));
            
            const loadingText = t('msg_generating', "AI가 그리는 중...");
            startResult.innerHTML = `<div class="loading-spin" style="width:40px; height:40px;"></div><p style="margin-top:10px; color:#666;">${loadingText}</p>`;
            
            btnStartGen.disabled = true;
            try {
                const imageUrl = await generateImageCore(text);
                window.pendingAiImage = imageUrl;
                startResult.innerHTML = `<img src="${imageUrl}" style="max-height:250px; object-fit:contain; border-radius:8px;">`;
                btnStartGo.style.display = 'flex';
                const retryText = t('btn_retry', "또 만들기");
                btnStartGo.innerHTML = `<i class="fa-solid fa-rotate-right"></i> ${retryText}`;
            } catch (e) {
                alert(t('msg_gen_fail', "생성 실패") + ": " + e.message);
                startResult.innerHTML = '<span style="color:red;">Failed</span>';
                btnStartGen.disabled = false;
            }
        };
    }
    if (btnStartGo) {
        btnStartGo.onclick = () => {
            if(startResult) startResult.innerHTML = '<span style="color:#cbd5e1;">이미지가 여기에 표시됩니다</span>';
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
            
            if(!confirm(window.t('confirm_bg_remove', "배경을 제거할까요?"))) return;
            
            const originalText = btnCutout.innerText;
            btnCutout.innerText = "✂️ " + window.t('msg_processing_file', "Processing...");
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
                        throw new Error("크레딧 부족으로 고해상도 변환 불가 (무료 계정 제한)");
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
            
            const confirmMsg = window.t('confirm_upscale', "해상도를 2배 높이시겠습니까?");
            if (!confirm(confirmMsg)) return;

            const originalText = btnUpscale.innerText;
            btnUpscale.innerText = "✨ " + window.t('msg_sending', "Sending...");
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
                if (!newUrl) throw new Error("결과 URL 없음");

                fabric.Image.fromURL(newUrl, (newImg) => {
                    if (!newImg) return alert("이미지 로드 실패");
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
}