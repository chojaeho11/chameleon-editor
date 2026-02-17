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
    blue: {
        effect:'3d',
        titleFill:'#38bdf8', titleStroke:'#1e3a8a', titleShadowColor:'#1e3a8a',
        boxFill:'rgba(240,249,255,0.92)', boxStroke:'rgba(56,189,248,0.35)', boxTextColor:'#1e3a5f'
    },
    yellow: {
        effect:'3d',
        titleFill:'#fbbf24', titleStroke:'#92400e', titleShadowColor:'#78350f',
        boxFill:'rgba(255,251,235,0.92)', boxStroke:'rgba(251,191,36,0.35)', boxTextColor:'#78350f'
    },
    candy: {
        effect:'candy',
        titleFill:'#ef4444', titleStroke:'#ffffff', titleShadowColor:'#000000',
        candyColor1:'#ef4444', candyColor2:'#15803d',
        boxFill:'rgba(253,242,248,0.92)', boxStroke:'rgba(244,114,182,0.35)', boxTextColor:'#831843'
    },
    dark: {
        effect:'neon',
        titleFill:'transparent', titleStroke:'#ff00aa', titleShadowColor:'#ff00aa',
        neonColor:'#ff00aa',
        boxFill:'rgba(15,23,42,0.88)', boxStroke:'rgba(255,0,170,0.3)', boxTextColor:'#f9a8d4'
    }
};

// Extract meaningful keywords from title
// 짧은 제목 "초록 물고기" → ["물고기","초록"] (명사 우선)
// 긴 문장 "카페에 오신 여러분" → ["카페"] (첫 명사 우선)
// 복합어 "고기집 간판" → ["고기","간판","고기집"]
function _wzExtractKeywords(title) {
    const words = title.replace(/[!@#$%^&*(),.?":{}|<>~`]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
    if (!words.length) return [title];

    const suffixes = ['집','점','관','원','소','실','당','방','장','위','아래','속','밑','앞','뒤','옆'];
    const particles = ['을','를','이','가','은','는','에','의','로','와','과','도','만','까지','에서','부터','처럼','같이','보다'];
    // 한국어 형용사/관형어 (검색 의미 낮음)
    const adjectives = ['큰','작은','예쁜','멋진','새로운','특별한','푸른','빨간','파란','노란','초록','하얀','검은','보라','분홍','아름다운','화려한','심플한','모던한','귀여운','멋있는','진정한','좋은','나쁜','높은','낮은','넓은','깊은','밝은','어두운','따뜻한','차가운','시원한'];
    // 불용어 (검색에 무의미한 일반 단어)
    const stopWords = ['것','수','때','곳','등','중','안','밖','오신','여러분','위한','함께','통해','대한','모든','이런','저런','그런','우리','당신','너의','나의','영혼','마음','세계','세상','곳에','하는','있는','없는','되는','같은'];

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

async function runDesignWizard(title, style) {
    const board = canvas.getObjects().find(o => o.isBoard);
    if (!board) throw new Error('No canvas board');
    const bW = board.width * (board.scaleX||1), bH = board.height * (board.scaleY||1);
    const bL = board.left, bT = board.top;
    const S = WIZARD_STYLES[style] || WIZARD_STYLES.blue;
    const steps = _wzSteps();

    // ★ 기존 오브젝트 모두 삭제 (보드, 고정 오버레이 제외)
    canvas.getObjects().filter(o => !o.isBoard && o.id !== 'product_fixed_overlay').forEach(o => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    // Resolve font by country
    // KR: 잘난고딕 (Supabase에 .otf → opentype.js가 PDF 아웃라인 변환 가능)
    // JP: Noto Sans JP 900 (굵은 기본), others: Impact (시스템 굵은 기본)
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    const titleFontMap = { KR:'JalnanGothic', JP:'Noto Sans JP', CN:'Noto Sans SC', AR:'Noto Sans Arabic' };
    const titleFont = titleFontMap[country] || 'Impact, Arial Black, sans-serif';
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

    // ─── Step 5: 완성 ───
    _wzRender(steps, 4);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
}

// ─── Step 1: Background (data_url 원본, 잠금 처리) ───
async function _wzBg(keywords, bW, bH, bL, bT) {
    if (!sb) return;

    // 1. 키워드로 템플릿 검색 (사이드바와 동일한 카테고리)
    let found = null;
    let matchedKw = '';
    for (const kw of keywords) {
        const res = await sb.from('library')
            .select('id, thumb_url, category, product_key, tags, title')
            .in('category', ['user_vector','user_image','photo-bg'])
            .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(1);
        if (res.data && res.data.length) { found = res.data[0]; matchedKw = kw; break; }
    }
    if (!found) {
        const r2 = await sb.from('library')
            .select('id, thumb_url, category, product_key, tags, title')
            .in('category', ['user_vector','user_image','photo-bg','pattern'])
            .eq('status','approved')
            .order('created_at', { ascending: false })
            .limit(1);
        if (r2.data && r2.data.length) found = r2.data[0];
    }
    if (!found) return;

    console.log('[Wizard BG] Found template:', found.id, found.category, found.title || found.tags);

    // ★ 사이드바 템플릿 검색창에 매칭 키워드 표시
    if (matchedKw) {
        const sideInput = document.getElementById('sideTemplateSearch');
        if (sideInput) sideInput.value = matchedKw;
        if (window.loadSideBarTemplates) {
            const pk = window.currentProductKey || 'custom';
            window.loadSideBarTemplates(pk, matchedKw, 0);
        }
        // 템플릿 패널 열기 (toggle이 아닌 강제 open)
        const subPanel = document.getElementById('subPanel');
        const tplPanel = document.getElementById('sub-template');
        if (subPanel && tplPanel) {
            subPanel.querySelectorAll('.sub-content').forEach(c => c.style.display = 'none');
            document.querySelectorAll('.icon-item').forEach(i => i.classList.remove('active'));
            tplPanel.style.display = 'flex';
            subPanel.style.display = 'block';
            const ico = document.querySelector('.icon-item[data-panel="sub-template"]');
            if (ico) ico.classList.add('active');
        }
    }

    // 2. processLoad 방식으로 적용 (사이드바 클릭과 동일)
    window.selectedTpl = found;

    return new Promise(resolve => {
        let resolved = false;
        const done = () => {
            if (resolved) return;
            resolved = true;
            canvas.off('object:added', onAdd);
            // 배경 잠금 처리
            canvas.getObjects().filter(o => o.isTemplateBackground).forEach(bg => {
                bg.set({
                    selectable: false, evented: false,
                    lockMovementX: true, lockMovementY: true,
                    lockRotation: true, lockScalingX: true, lockScalingY: true,
                    hasControls: false, hasBorders: false
                });
            });
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            const ld = document.getElementById('loading');
            if (ld) ld.style.display = 'none';
            resolve();
        };
        const onAdd = () => setTimeout(done, 500);
        canvas.on('object:added', onAdd);

        // processLoad 실행 (사이드바에서 클릭하는 것과 동일)
        window.processLoad('replace');

        // 안전 타임아웃 (10초)
        setTimeout(done, 10000);
    });
}

// ─── Step 2: Title text (효과별: 3d/candy/neon, 가로 2/3 초과시 줄바꿈) ───
function _wzTitle(title, font, S, bW, bH, bL, bT) {
    const sz = Math.round(bW * 0.10);
    const maxW = bW * (2/3);

    // 임시 텍스트로 실제 너비 측정
    const temp = new fabric.Textbox(title, {
        fontFamily: font, fontSize: sz, fontWeight: '900', charSpacing: -10
    });
    const textW = temp.calcTextWidth ? temp.calcTextWidth() : temp.width;

    // 가로 2/3 초과 → 줄바꿈
    let displayTitle = title;
    if (textW > maxW) {
        const spaceIdx = title.indexOf(' ', Math.floor(title.length * 0.3));
        if (spaceIdx > 0 && spaceIdx < title.length * 0.75) {
            displayTitle = title.substring(0, spaceIdx) + '\n' + title.substring(spaceIdx + 1);
        } else if (title.length > 6) {
            const mid = Math.ceil(title.length / 2);
            displayTitle = title.substring(0, mid) + '\n' + title.substring(mid);
        }
    }

    const depth = Math.max(3, Math.round(sz * 0.07));
    const effect = S.effect || '3d';

    // 기본 속성
    const props = {
        fontFamily: font, fontSize: sz, fontWeight: '900',
        originX:'center', originY:'center', textAlign:'center',
        left: bL + bW/2, top: bT + bH * 0.42,
        width: bW * 0.85, lineHeight: 1.15, charSpacing: -10
    };

    // ★ 효과별 스타일 분기
    if (effect === 'candy') {
        // 레드캔디: 빨강+초록 줄무늬 패턴 + 흰 아웃라인
        const pSize = 60;
        const pc = document.createElement('canvas'); pc.width = pSize; pc.height = pSize;
        const cx = pc.getContext('2d');
        cx.fillStyle = S.candyColor1 || '#ef4444'; cx.fillRect(0,0,pSize,pSize);
        cx.beginPath(); cx.strokeStyle = S.candyColor2 || '#15803d'; cx.lineWidth = pSize/2.2; cx.lineCap='butt';
        cx.moveTo(0,pSize); cx.lineTo(pSize,0); cx.stroke();
        cx.beginPath(); cx.moveTo(-pSize/2,pSize/2); cx.lineTo(pSize/2,-pSize/2); cx.stroke();
        cx.beginPath(); cx.moveTo(pSize/2,pSize+pSize/2); cx.lineTo(pSize+pSize/2,pSize/2); cx.stroke();
        const candyPat = new fabric.Pattern({ source: pc, repeat: 'repeat' });
        Object.assign(props, {
            fill: candyPat,
            stroke: '#ffffff', strokeWidth: Math.max(3, Math.round(sz * 0.04)),
            paintFirst: 'stroke', strokeLineJoin: 'round',
            shadow: new fabric.Shadow({ color:'rgba(0,0,0,0.35)', blur:0, offsetX:depth, offsetY:depth })
        });
    } else if (effect === 'neon') {
        // 네온핑크: 검정 fill + 핑크 스트로크 + 핑크 글로우
        const nCol = S.neonColor || '#ff00aa';
        Object.assign(props, {
            fill: '#0a0a0a',
            stroke: nCol, strokeWidth: Math.max(2, Math.round(sz * 0.035)),
            paintFirst: 'fill', strokeLineJoin: 'round',
            shadow: new fabric.Shadow({ color: nCol, blur: Math.round(sz * 0.3), offsetX:0, offsetY:0 })
        });
    } else {
        // 3D: 기존 방식 (블루/옐로우)
        Object.assign(props, {
            fill: S.titleFill, stroke: S.titleStroke,
            strokeWidth: Math.max(1, Math.round(sz * 0.02)),
            paintFirst: 'stroke', strokeLineJoin: 'round',
            shadow: new fabric.Shadow({ color: S.titleShadowColor, blur:0, offsetX:depth, offsetY:depth })
        });
    }

    const obj = new fabric.Textbox(displayTitle, props);
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
    const margin = bW * 0.06; // 좌우하단 여백 동일
    const boxW = bW - margin * 2;
    const boxH = bH * 0.20;
    const boxY = bT + bH - margin - boxH / 2; // 하단 여백 맞춤

    // 불투명 박스 (스타일별 색상)
    const rect = new fabric.Rect({
        width: boxW, height: boxH,
        rx: 10, ry: 10,
        fill: S.boxFill || 'rgba(255,255,255,0.92)',
        stroke: S.boxStroke || 'rgba(99,102,241,0.3)', strokeWidth: 1.5,
        left: bL + bW/2, top: boxY,
        originX:'center', originY:'center'
    });
    canvas.add(rect);
    canvas.bringToFront(rect);

    // 박스 안 설명 텍스트 (스타일별 색상)
    const obj = new fabric.Textbox(descText, {
        fontFamily: descFont + ', sans-serif', fontSize: Math.round(bW * 0.018),
        fontWeight:'400', fill: S.boxTextColor || '#334155',
        originX:'center', originY:'center', textAlign:'center',
        left: bL + bW/2, top: boxY,
        width: boxW * 0.88,
        lineHeight: 1.5
    });
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 4: Related elements (keyword search, 2 items — 하단 박스 좌우) ───
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
            .limit(2);
        if (res.data && res.data.length) { data = res.data; break; }
    }
    if (!data || !data.length) return;

    // 하단 박스 좌우 위치 (박스: margin=6%, boxH=20%, boxY=하단)
    const margin = bW * 0.06;
    const boxH = bH * 0.20;
    const boxY = bT + bH - margin - boxH / 2;
    const elemSize = bW / 7;
    const positions = [
        { left: bL + margin + elemSize * 0.35,       top: boxY, size: elemSize },  // 박스 왼쪽 안쪽
        { left: bL + bW - margin - elemSize * 0.35,  top: boxY, size: elemSize }   // 박스 오른쪽 안쪽
    ];

    const promises = data.slice(0, 2).map((item, i) => new Promise(resolve => {
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