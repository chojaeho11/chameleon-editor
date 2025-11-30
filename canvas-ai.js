// canvas-ai.js
import { canvas } from "./canvas-core.js";
import { sb } from "./config.js"; 

// ★ 수정된 부분: secrets 테이블에서 name과 value를 조회합니다.
async function getApiKey(keyName) {
    if (!sb) {
        console.error("Supabase 클라이언트가 초기화되지 않았습니다.");
        return null;
    }

    // 'secrets' 테이블에서 'name'이 일치하는 'value'를 가져옵니다.
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
    
    // 1. AI 패널 열기
    const btnAIBox = document.getElementById("btnAIBox");
    const aiDrawer = document.getElementById("aiDrawer");
    if (btnAIBox && aiDrawer) {
        btnAIBox.onclick = () => aiDrawer.classList.add("open");
    }

    // 2. [DALL-E 3] 이미지 생성
    const btnGen = document.getElementById("aiGenerateBtn");
    const promptInput = document.getElementById("aiPrompt");
    const resultArea = document.getElementById("aiResultArea");
    const btnUse = document.getElementById("aiUseBtn");
    
    let generatedImageBase64 = null;

    // 입력창 이벤트 버블링 방지
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

            // ★ DB에서 OpenAI 키 가져오기
            const key = await getApiKey('OPENAI_API_KEY');
            if (!key) return alert("OpenAI 키를 DB(secrets)에서 찾을 수 없습니다.");

            const STYLE_PROMPT = `
Soft vector-style drawing, clean outlines, warm and friendly expression. Keep the main characters centered with generous white margins around them. 
No cropping, no cut-off edges — full-body characters visible. 
Soft pastel colors, simple shapes, kid-friendly design. 
Illustration style similar to modern Christmas greeting card artwork. 
High-resolution PNG with transparent background.
            `;

            const finalPrompt = `
${STYLE_PROMPT}
Generate: ${userText}
            `;

            resultArea.innerHTML = '<div class="loading-spin" style="width:30px; height:30px;"></div><p style="font-size:12px; margin-top:10px;">DALL-E 3가 그리는 중...</p>';
            btnUse.style.display = "none";
            btnGen.disabled = true;

            try {
                const response = await fetch("https://api.openai.com/v1/images/generations", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: "dall-e-3",
                        prompt: finalPrompt,
                        n: 1,
                        size: "1024x1024",
                        response_format: "b64_json"
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || "생성 실패");
                }

                generatedImageBase64 = `data:image/png;base64,${data.data[0].b64_json}`;
                resultArea.innerHTML = `<img id="aiGeneratedImg" src="${generatedImageBase64}" style="width:100%; height:100%; object-fit:contain; border-radius:8px;">`;
                btnUse.style.display = "block";

            } catch (e) {
                console.error(e);
                alert("오류 발생: " + e.message);
                resultArea.innerHTML = '<span style="color:red;">실패했습니다.</span>';
            } finally {
                btnGen.disabled = false;
            }
        };
    }

    // 3. 캔버스에 추가
    if (btnUse) {
        btnUse.onclick = () => {
            if (!generatedImageBase64) return;
            fabric.Image.fromURL(generatedImageBase64, (img) => {
                img.scaleToWidth(500);
                const center = canvas.getCenter();
                img.set({ left: center.left, top: center.top, originX: 'center', originY: 'center' });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                aiDrawer.classList.remove("open");
            });
        };
    }
    
    // 4. [Remove.bg] 배경 제거
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = async () => {
            const active = canvas.getActiveObject();
            if (!active || active.type !== 'image') return alert("배경을 제거할 이미지를 선택해주세요.");
            
            // ★ DB에서 Remove.bg 키 가져오기
            const key = await getApiKey('REMOVE_BG_API_KEY');
            if (!key) return alert("배경 제거 키를 DB(secrets)에서 찾을 수 없습니다.");
            
            if(!confirm("배경을 제거하시겠습니까?")) return;
            
            const originalText = btnCutout.innerText;
            btnCutout.innerText = "✂️ 처리중...";

            try {
                const base64 = active.toDataURL({ format: 'png' });
                const res = await fetch(base64);
                const blob = await res.blob();
                const formData = new FormData();
                formData.append('image_file', blob);
                formData.append('size', 'auto');

                const apiRes = await fetch('https://api.remove.bg/v1.0/removebg', {
                    method: 'POST', headers: { 'X-Api-Key': key }, body: formData
                });

                if (!apiRes.ok) throw new Error(await apiRes.text());
                const resultBlob = await apiRes.blob();
                const url = URL.createObjectURL(resultBlob);

                fabric.Image.fromURL(url, (newImg) => {
                    newImg.set({
                        left: active.left, top: active.top,
                        scaleX: active.scaleX, scaleY: active.scaleY,
                        angle: active.angle, originX: active.originX, originY: active.originY
                    });
                    canvas.remove(active);
                    canvas.add(newImg);
                    canvas.setActiveObject(newImg);
                    canvas.requestRenderAll();
                    alert("배경 제거 완료!");
                });
            } catch (e) {
                alert("실패: " + e.message);
            } finally {
                btnCutout.innerText = originalText;
            }
        };
    }
}