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
// [코어] AI 이미지 생성 공통 함수 (Flux.1 Edge Function)
// ==========================================================
async function generateImageCore(prompt) {
    if (!sb) throw new Error("Supabase 연결 실패");
    
    // Edge Function 호출
    const { data, error } = await sb.functions.invoke('generate-image-flux', {
        body: { prompt: prompt, ratio: "1:1" }
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error("데이터 응답이 없습니다.");

    let rawUrl = data.imageUrl || data;
    if (Array.isArray(rawUrl)) rawUrl = rawUrl[0];
    if (typeof rawUrl === 'object') {
        if (rawUrl.url) rawUrl = rawUrl.url;
        else throw new Error("이미지 주소를 찾을 수 없습니다.");
    }
    return rawUrl;
}

// ==========================================================
// [메인] AI 도구 초기화 (에디터 내부 + 시작 화면)
// ==========================================================
export function initAiTools() {
    
    // ------------------------------------------------------
    // 1. [Start Screen] 시작 화면 전용 AI 기능
    // ------------------------------------------------------
    
    // 1-1. 모달 열기 및 초기화 함수
    window.openAiStartModal = function() {
        const modal = document.getElementById('aiStartModal');
        const promptInput = document.getElementById('aiStartPrompt');
        const startResult = document.getElementById('aiStartResult');
        const btnStartGo = document.getElementById('btnAiStartGo');
        const btnStartGen = document.getElementById('btnAiStartGen');

        // 모달 상태 초기화
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

    // 1-2. 생성 버튼 클릭
    if (btnStartGen) {
        btnStartGen.onclick = async () => {
            const text = startPrompt.value.trim();
            if (!text) return alert("설명을 입력해주세요.");

            startResult.innerHTML = '<div class="loading-spin" style="width:40px; height:40px;"></div><p style="margin-top:10px; color:#666;">AI가 열심히 그리는 중...</p>';
            btnStartGen.disabled = true; // 생성 중 중복 클릭 방지
            btnStartGo.style.display = 'none';

            try {
                const imageUrl = await generateImageCore(text);
                window.pendingAiImage = imageUrl;

                // 마케팅 문구 및 이미지 표시
                const marketingHtml = `
                    <div style="width:100%; text-align:center;">
                        <img src="${imageUrl}" style="max-height:250px; object-fit:contain; border-radius:8px; border:1px solid #eee; margin-bottom:15px;">
                        
                        <div style="text-align:left; background:#f0fdf4; border:1px solid #bbf7d0; padding:15px; border-radius:12px;">
                            <p style="margin:0 0 5px 0; font-weight:bold; color:#166534; font-size:15px;">
                                🎉 이미지가 잘 만들어졌어요!
                            </p>
                            <p style="margin:0; color:#374151; font-size:13px; line-height:1.6;">
                                당신이 만든 멋진 이미지를 다른 유저와 공유해요.<br>
                                이 디자인으로 제품을 구매하면 현금처럼 쓸 수 있는 
                                <span style="color:#e11d48; font-weight:bold;">0.1%의 마일리지</span>가 
                                당신에게 적립됩니다.<br>
                                <span style="font-size:12px; color:#6b7280;">(10만원이 넘으면 현금으로 찾을 수 있어요)</span>
                            </p>
                        </div>
                    </div>
                `;
                
                startResult.innerHTML = marketingHtml;
                
                // ★ [수정] 버튼 텍스트를 "또 만들기"로 변경하고 표시
                btnStartGo.innerHTML = '<i class="fa-solid fa-rotate-right"></i> 또 만들기';
                btnStartGo.className = "btn-round primary"; 
                btnStartGo.style.display = 'flex'; 
                
            } catch (e) {
                console.error(e);
                alert("생성 실패: " + e.message);
                startResult.innerHTML = '<span style="color:red;">실패했습니다. 다시 시도해주세요.</span>';
                btnStartGen.disabled = false; // 실패 시에만 다시 활성화
            }
            // 성공 시에는 "또 만들기"를 눌러야 초기화되므로 finally에서 활성화하지 않음
        };
    }

    // ★ [수정] "또 만들기" 버튼 클릭 시 초기화 로직
    if (btnStartGo) {
        btnStartGo.onclick = () => {
            // 1. 결과 영역 초기화
            if(startResult) startResult.innerHTML = '<span style="color:#cbd5e1;">이미지가 여기에 표시됩니다</span>';
            
            // 2. "또 만들기" 버튼 숨기기
            btnStartGo.style.display = 'none';
            
            // 3. "생성하기" 버튼 다시 활성화
            if(btnStartGen) btnStartGen.disabled = false;
            
            // 4. 입력창 비우고 포커스
            if(startPrompt) {
                startPrompt.value = '';
                startPrompt.focus();
            }
            
            // 5. 임시 저장된 이미지 초기화
            window.pendingAiImage = null;
        };
    }

    // ------------------------------------------------------
    // 2. [Editor Internal] 에디터 내부 AI 패널 기능
    // ------------------------------------------------------
    const btnAIBox = document.getElementById("btnAIBox");
    const aiDrawer = document.getElementById("aiDrawer");
    if (btnAIBox && aiDrawer) {
        btnAIBox.onclick = () => aiDrawer.classList.add("open");
    }

    const btnGen = document.getElementById("aiGenerateBtn");
    const promptInput = document.getElementById("aiPrompt");
    const resultArea = document.getElementById("aiResultArea");
    const btnUse = document.getElementById("aiUseBtn");
    
    let internalGeneratedUrl = null; 

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

            resultArea.innerHTML = '<div class="loading-spin" style="width:30px; height:30px;"></div><p style="font-size:12px; margin-top:10px;">Flux.1 AI가 그리는 중...</p>';
            btnUse.style.display = "none";
            btnGen.disabled = true;

            try {
                const imageUrl = await generateImageCore(userText);
                internalGeneratedUrl = imageUrl;
                resultArea.innerHTML = `<img id="aiGeneratedImg" src="${internalGeneratedUrl}" crossorigin="anonymous" style="width:100%; height:100%; object-fit:contain; border-radius:8px;">`;
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

    if (btnUse) {
        btnUse.onclick = () => {
            if (!internalGeneratedUrl) return;
            fabric.Image.fromURL(internalGeneratedUrl, (img) => {
                if (!img) return alert("이미지 로드 실패");
                if (img.width > 800) img.scaleToWidth(800);
                const center = canvas.getCenter();
                img.set({ left: center.left, top: center.top, originX: 'center', originY: 'center' });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
                aiDrawer.classList.remove("open");
            }, { crossOrigin: 'anonymous' }); 
        };
    }
    
    // ------------------------------------------------------
    // 3. [Editor Internal] 배경 제거 (Remove.bg)
    // ------------------------------------------------------
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

                const base64 = active.toDataURL({ format: 'png', multiplier: restoreScale });
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
                    if (!newImg) return alert("결과 로드 실패");
                    const newScaleX = originalVisualWidth / newImg.width;
                    const newScaleY = originalVisualHeight / newImg.height;
                    newImg.set({
                        left: active.left, top: active.top, scaleX: newScaleX, scaleY: newScaleY,
                        angle: active.angle, originX: active.originX, originY: active.originY
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