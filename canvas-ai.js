// canvas-ai.js
import { canvas } from "./canvas-core.js";
import { sb } from "./config.js"; 

// DB secrets 테이블에서 API 키 가져오기
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

export function initAiTools() {
    
    // 1. AI 패널 열기/닫기
    const btnAIBox = document.getElementById("btnAIBox");
    const aiDrawer = document.getElementById("aiDrawer");
    if (btnAIBox && aiDrawer) {
        btnAIBox.onclick = () => aiDrawer.classList.add("open");
    }

    // ==========================================================
    // 2. [Flux.1] 이미지 생성 (Supabase Edge Function 호출)
    // ==========================================================
    const btnGen = document.getElementById("aiGenerateBtn");
    const promptInput = document.getElementById("aiPrompt");
    const resultArea = document.getElementById("aiResultArea");
    const btnUse = document.getElementById("aiUseBtn");
    
    let generatedImageUrl = null; 

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => e.stopPropagation());
        promptInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            promptInput.focus();
        });
    }

    if (btnGen) {
        btnGen.onclick = async () => {
            const userText = promptInput.value.trim();
            if (!userText) return alert("어떤 그림을 그릴지 설명해주세요.");

            // ★ [수정 1] 스타일 강제 적용 제거 (사용자가 입력한 대로 그리기 위함)
            // const STYLE_PROMPT = `flat vector illustration, simple shapes...`; 
            // const finalPrompt = `${STYLE_PROMPT}, ${userText}`;
            const finalPrompt = userText; // 사용자가 입력한 텍스트 그대로 전송

            resultArea.innerHTML = '<div class="loading-spin" style="width:30px; height:30px;"></div><p style="font-size:12px; margin-top:10px;">Flux.1 AI가 그리는 중...</p>';
            btnUse.style.display = "none";
            btnGen.disabled = true;

            try {
                if (!sb) throw new Error("Supabase 연결 실패");

                const { data, error } = await sb.functions.invoke('generate-image-flux', {
                    body: { 
                        prompt: finalPrompt,
                        ratio: "1:1" 
                    }
                });

                if (error) throw new Error(error.message);
                if (!data) throw new Error("데이터 응답이 없습니다.");

                // ★ [수정 2] [object Object] 오류 방지 (데이터 파싱 강화)
                // 서버가 { imageUrl: "..." } 형태로 주는지, 그냥 텍스트인지, 배열인지 확인
                let rawUrl = data.imageUrl || data;
                
                // 만약 배열이면 첫 번째 꺼내기
                if (Array.isArray(rawUrl)) rawUrl = rawUrl[0];
                
                // 만약 객체라면 toString으로 확인해보고, 이상하면 에러 처리
                if (typeof rawUrl === 'object') {
                    console.error("받은 데이터가 객체입니다:", rawUrl);
                    // 혹시라도 { url: "..." } 형태일 수 있으니 한번 더 체크
                    if (rawUrl.url) rawUrl = rawUrl.url;
                    else throw new Error("이미지 주소를 찾을 수 없습니다.");
                }

                generatedImageUrl = rawUrl;
                console.log("최종 이미지 주소:", generatedImageUrl);

                resultArea.innerHTML = `<img id="aiGeneratedImg" src="${generatedImageUrl}" crossorigin="anonymous" style="width:100%; height:100%; object-fit:contain; border-radius:8px;">`;
                btnUse.style.display = "block";

            } catch (e) {
                console.error(e);
                alert("생성 실패: " + e.message);
                resultArea.innerHTML = '<span style="color:red;">실패했습니다. 다시 시도해주세요.</span>';
            } finally {
                btnGen.disabled = false;
            }
        };
    }

    // 3. 캔버스에 추가
    if (btnUse) {
        btnUse.onclick = () => {
            if (!generatedImageUrl) return;
            
            fabric.Image.fromURL(generatedImageUrl, (img) => {
                if (!img) return alert("이미지 로드 실패");

                if (img.width > 800) img.scaleToWidth(800);

                const center = canvas.getCenter();
                img.set({ 
                    left: center.left, 
                    top: center.top, 
                    originX: 'center', 
                    originY: 'center' 
                });
                
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                aiDrawer.classList.remove("open");
            }, { crossOrigin: 'anonymous' }); 
        };
    }
    
    // ==========================================================
    // 4. [Remove.bg] 배경 제거 (고해상도 유지)
    // ==========================================================
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') return alert("배경을 제거할 이미지를 선택해주세요.");
            
            const key = await getApiKey('REMOVE_BG_API_KEY');
            if (!key) return alert("배경 제거 키를 DB(secrets)에서 찾을 수 없습니다.");
            
            if(!confirm("배경을 제거하시겠습니까?")) return;
            
            const originalText = btnCutout.innerText;
            btnCutout.innerText = "✂️ 고해상도 처리중...";

            try {
                const originalVisualWidth = active.width * active.scaleX;
                const originalVisualHeight = active.height * active.scaleY;
                const restoreScale = 1 / active.scaleX;

                const base64 = active.toDataURL({ 
                    format: 'png', 
                    multiplier: restoreScale 
                });
                
                const res = await fetch(base64);
                const blob = await res.blob();
                
                const formData = new FormData();
                formData.append('image_file', blob);
                formData.append('size', 'auto'); 

                const apiRes = await fetch('https://api.remove.bg/v1.0/removebg', {
                    method: 'POST', 
                    headers: { 'X-Api-Key': key }, 
                    body: formData
                });

                if (!apiRes.ok) throw new Error(await apiRes.text());
                
                const resultBlob = await apiRes.blob();
                const url = URL.createObjectURL(resultBlob);

                fabric.Image.fromURL(url, (newImg) => {
                    if (!newImg) {
                        alert("결과 로드 실패");
                        return;
                    }

                    const newScaleX = originalVisualWidth / newImg.width;
                    const newScaleY = originalVisualHeight / newImg.height;

                    newImg.set({
                        left: active.left, 
                        top: active.top,
                        scaleX: newScaleX, 
                        scaleY: newScaleY,
                        angle: active.angle, 
                        originX: active.originX, 
                        originY: active.originY
                    });

                    canvas.remove(active);
                    canvas.add(newImg);
                    canvas.setActiveObject(newImg);
                    canvas.requestRenderAll();
                    
                    alert("배경 제거 완료!");
                    URL.revokeObjectURL(url);
                });
            } catch (e) {
                console.error(e);
                alert("실패: " + e.message);
            } finally {
                btnCutout.innerText = originalText;
            }
        };
    }
}