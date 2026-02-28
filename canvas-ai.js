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
    
    // --- 3. 배경 제거 (수정됨: 고해상도 유지) ---
    const btnCutout = document.getElementById("btnCutout");
    if (btnCutout) {
        btnCutout.onclick = async () => {
            const active = canvas.getActiveObject();
            
            // [수정] 다국어 적용 (전역 window.t 사용)
            if (!active || active.type !== 'image') { showToast(window.t('msg_select_image', "Please select an image."), "info"); return; }
            const key = await getApiKey('REMOVE_BG_API_KEY');
            if (!key) { showToast("API Key Error", "error"); return; }
            
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
                    showToast(window.t('msg_upload_success', "Success!"), "success");
                });
            } catch(e) {
                console.error(e);
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

// ★ JP/EN 키워드 → KR 검색어 변환 사전 (라이브러리가 KR 태그 기반)
const _WZ_DICT = {
    // 동물
    '鯨':'고래','whale':'고래','魚':'물고기','fish':'물고기','猫':'고양이','cat':'고양이',
    '犬':'개','dog':'개','鳥':'새','bird':'새','馬':'말','horse':'말','虎':'호랑이','tiger':'호랑이',
    '狐':'여우','fox':'여우','狼':'늑대','wolf':'늑대','龍':'용','竜':'용','dragon':'용',
    '蝶':'나비','butterfly':'나비','兎':'토끼','rabbit':'토끼','熊':'곰','bear':'곰',
    '蛇':'뱀','snake':'뱀','鹿':'사슴','deer':'사슴','象':'코끼리','elephant':'코끼리',
    '獅子':'사자','lion':'사자','鷲':'독수리','eagle':'독수리','亀':'거북이','turtle':'거북이',
    '蜂':'벌','bee':'벌','豚':'돼지','pig':'돼지','羊':'양','sheep':'양','鶏':'닭',
    'ペンギン':'펭귄','penguin':'펭귄','パンダ':'판다','panda':'판다',
    'イルカ':'돌고래','dolphin':'돌고래','ライオン':'사자','ウサギ':'토끼',
    // 자연
    '海':'바다','sea':'바다','ocean':'바다','山':'산','mountain':'산','川':'강','river':'강',
    '空':'하늘','sky':'하늘','雲':'구름','cloud':'구름','雨':'비','rain':'비',
    '雪':'눈','snow':'눈','風':'바람','wind':'바람','花':'꽃','flower':'꽃',
    '木':'나무','tree':'나무','森':'숲','forest':'숲','月':'달','moon':'달',
    '星':'별','star':'별','太陽':'태양','sun':'태양','火':'불','fire':'불',
    '水':'바다','water':'바다','水面':'수면','湖':'호수','lake':'호수','島':'섬','island':'섬',
    '滝':'폭포','waterfall':'폭포','波':'파도','wave':'파도','虹':'무지개','rainbow':'무지개',
    '桜':'벚꽃','cherry':'벚꽃','薔薇':'장미','rose':'장미','向日葵':'해바라기','sunflower':'해바라기',
    '葉':'잎','leaf':'잎','草':'풀','grass':'풀','石':'돌','rock':'돌','砂':'모래','sand':'모래',
    // 사물/개념
    '城':'성','castle':'성','家':'집','house':'집','船':'배','ship':'배','車':'자동차','car':'자동차',
    '剣':'검','sword':'검','王':'왕','king':'왕','姫':'공주','princess':'공주',
    '愛':'사랑','love':'하트','heart':'하트','夢':'꿈','dream':'꿈',
    '光':'빛','light':'빛','影':'그림자','shadow':'그림자',
    '音楽':'음악','music':'음악','本':'책','book':'책',
    '食':'음식','food':'음식','酒':'술','茶':'차','coffee':'커피','cake':'케이크',
    'コーヒー':'커피','ケーキ':'케이크','ワイン':'와인','wine':'와인',
    '天使':'천사','angel':'천사','宇宙':'우주','space':'우주','地球':'지구','earth':'지구',
    '夜':'밤','night':'밤','朝':'아침','morning':'아침',
    '春':'봄','spring':'봄','夏':'여름','summer':'여름','秋':'가을','autumn':'가을','冬':'겨울','winter':'겨울',
    '街':'거리','town':'마을','village':'마을','garden':'정원','庭':'정원',
    '飛行機':'비행기','airplane':'비행기','電車':'기차','train':'기차',
    '雷':'번개','lightning':'번개','thunder':'번개',
};
function _wzTranslateForSearch(keywords) {
    const country = window.SITE_CONFIG?.COUNTRY || 'KR';
    if (country === 'KR') return keywords;
    // ★ KR 번역어 우선, 번역 안 된 원본은 뒤로 (JP/EN 원본은 KR 태그에 안 맞음)
    const translated = [];
    const untranslated = [];
    for (const kw of keywords) {
        const kr = _WZ_DICT[kw] || _WZ_DICT[kw.toLowerCase()];
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
    window._wzCurrentStyle = style;

    // ─── Step 1: Background (벡터 그라데이션) ───
    _wzRender(steps, 0);
    await _wzBg(keywords, bW, bH, bL, bT);

    // ─── Step 2: Title ───
    _wzRender(steps, 1);
    await _wzTitle(title, titleFont, S, bW, bH, bL, bT);

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
    const style = window._wzCurrentStyle || 'blue';
    const palettes = _WZ_GRADIENT_PALETTES[style] || _WZ_GRADIENT_PALETTES.blue;
    const [c1, c2] = palettes[Math.floor(Math.random() * palettes.length)];
    window._wzBgColors = [c1, c2]; // 글자색 자동 판별용

    // 랜덤 각도 (대각선 변형)
    const angles = [
        { x1:0, y1:0, x2:1, y2:1 },
        { x1:0, y1:1, x2:1, y2:0 },
        { x1:0, y1:0.5, x2:1, y2:0.5 },
        { x1:0.5, y1:0, x2:0.5, y2:1 },
        { x1:0, y1:0, x2:0.7, y2:1 },
    ];
    const angle = angles[Math.floor(Math.random() * angles.length)];

    const bgRect = new fabric.Rect({
        width: bW, height: bH,
        left: bL, top: bT,
        originX:'left', originY:'top',
        fill: new fabric.Gradient({
            type: 'linear',
            coords: { x1: angle.x1 * bW, y1: angle.y1 * bH, x2: angle.x2 * bW, y2: angle.y2 * bH },
            colorStops: [
                { offset: 0, color: c1 },
                { offset: 1, color: c2 }
            ]
        }),
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockRotation: true, lockScalingX: true, lockScalingY: true,
        hasControls: false, hasBorders: false,
        isTemplateBackground: true
    });
    canvas.add(bgRect);
    canvas.sendToBack(bgRect);
    // 보드가 있으면 보드 바로 위로
    const board = canvas.getObjects().find(o => o.isBoard);
    if (board) { canvas.sendToBack(bgRect); canvas.sendToBack(board); }
    canvas.requestRenderAll();
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
    const sz = Math.round(bW * 0.075);

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

    const dark = _wzIsDarkBg();
    const obj = new fabric.Textbox(displayTitle, {
        fontFamily: font, fontSize: sz, fontWeight: '900',
        fill: dark ? '#ffffff' : '#1a1a1a',
        originX:'center', originY:'center', textAlign:'center',
        left: bL + bW/2, top: bT + bH * 0.30,
        width: bW * 0.90, lineHeight: 1.2, charSpacing: 30
    });
    if (obj.width > bW * 0.90) obj.set('fontSize', Math.round(sz * (bW*0.90) / obj.width));
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
    // 박스 없이 설명 텍스트만 중간에 배치 (확실한 줄바꿈)
    const maxW = bW * 0.55;
    const fSize = Math.round(bW * 0.016);
    const dark = _wzIsDarkBg();
    const obj = new fabric.Textbox(descText, {
        fontFamily: descFont + ', sans-serif', fontSize: fSize,
        fontWeight:'400', fill: dark ? 'rgba(255,255,255,0.8)' : '#334155',
        originX:'center', originY:'top', textAlign:'center',
        left: bL + bW/2, top: bT + bH * 0.44,
        width: maxW,
        lineHeight: 1.5,
        splitByGrapheme: true
    });
    // 텍스트가 대지 하단 60%를 넘으면 폰트 축소
    if (obj.height > bH * 0.15) {
        obj.set('fontSize', Math.round(fSize * 0.8));
    }
    canvas.add(obj);
    canvas.bringToFront(obj);
}

// ─── Step 4: Related elements (keyword search, 2 items — 하단 박스 좌우) ───
async function _wzElem(keywords, bW, bH, bL, bT) {
    if (!sb) return;

    // ★ JP/EN → KR 번역 후 검색 (라이브러리가 KR 태그 기반)
    const searchKws = _wzTranslateForSearch(keywords);
    console.log('[Wizard Search]', keywords, '→', searchKws);

    let allItems = [];
    const usedIds = new Set();
    async function _searchKw(kw) {
        const res = await sb.from('library')
            .select('id, thumb_url, data_url, category')
            .in('category', ['vector','graphic','transparent-graphic'])
            .or(`tags.ilike.%${kw}%,title.ilike.%${kw}%`)
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
    // 번역된 키워드로 검색
    for (const kw of searchKws.slice(0, 6)) await _searchKw(kw);
    // 결과 부족 시 원본 키워드로 재시도
    if (allItems.length < 3) {
        for (const kw of keywords.slice(0, 3)) await _searchKw(kw);
    }
    // 그래도 없으면 일반 폴백 (꽃, 별, 자연 등)
    if (!allItems.length) {
        for (const fb of ['꽃','별','나무','자연']) {
            await _searchKw(fb);
            if (allItems.length >= 4) break;
        }
    }
    if (!allItems.length) return;
    // 셔플하여 다양하게
    for (let i = allItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }
    const data = allItems.slice(0, 8); // 최대 8개 요소

    // ★ 하단 좌우: 매우 크게 + 나머지 요소 2배 + 위치 랜덤
    const bigSize = bW * 1.20;    // 하단 큰 요소 (2x)
    const smallSize = bW * 0.27;  // 작은 요소 (2/3)
    const rnd = (min, max) => min + Math.random() * (max - min);
    const positions = [
        // 하단 좌측: 매우 크게
        { left: bL + bigSize * 0.12,            top: bT + bH * rnd(0.85,0.92), size: bigSize },
        // 하단 우측: 매우 크게
        { left: bL + bW - bigSize * 0.12,       top: bT + bH * rnd(0.82,0.90), size: bigSize },
        // 상단: 랜덤 위치
        { left: bL + bW * rnd(0.10,0.25),       top: bT + bH * rnd(0.03,0.12), size: smallSize * rnd(0.7,1.2) },
        { left: bL + bW * rnd(0.75,0.92),       top: bT + bH * rnd(0.03,0.12), size: smallSize * rnd(0.7,1.2) },
        { left: bL + bW * rnd(0.30,0.50),       top: bT + bH * rnd(0.02,0.10), size: smallSize * rnd(0.6,1.0) },
        { left: bL + bW * rnd(0.55,0.72),       top: bT + bH * rnd(0.02,0.10), size: smallSize * rnd(0.6,1.0) },
        // 좌우 중간: 랜덤
        { left: bL + bW * rnd(0.02,0.08),       top: bT + bH * rnd(0.45,0.60), size: smallSize * rnd(0.8,1.1) },
        { left: bL + bW * rnd(0.92,0.98),       top: bT + bH * rnd(0.42,0.58), size: smallSize * rnd(0.8,1.1) }
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

    // 설명 박스와 텍스트를 맨 앞으로
    canvas.getObjects().forEach(o => {
        if (o.type === 'rect' && !o.isBoard && !o.isTemplateBackground) canvas.bringToFront(o);
    });
    canvas.getObjects().forEach(o => {
        if ((o.type === 'textbox' || o.type === 'i-text') && !o._objects) canvas.bringToFront(o);
    });
    // 타이틀 효과 그룹도 앞으로
    canvas.getObjects().forEach(o => {
        if (o._objects && o._objects.some(c => c.isMainText)) canvas.bringToFront(o);
    });
    canvas.requestRenderAll();
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
                .limit(10);
            const filtered = _wzFilterPremium(data);
            if (filtered && filtered.length >= 2) {
                stickerUrls = filtered.slice(0, 3).map(d => d.thumb_url).filter(Boolean);
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