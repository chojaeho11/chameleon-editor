import { sb } from './config.js?v=292';

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const FN_URL = SUPABASE_URL + '/functions/v1/ai-design-gen';

window.generateAiDesign = async function() {
    const promptEl = document.getElementById('aiDesignPrompt');
    const sizeEl = document.getElementById('aiDesignSize');
    const btnEl = document.getElementById('aiDesignBtn');
    const resultEl = document.getElementById('aiDesignResult');
    const quotaEl = document.getElementById('aiDesignQuota');
    if (!promptEl || !btnEl) return;

    const prompt = (promptEl.value || '').trim();
    if (!prompt || prompt.length < 3) {
        alert('프롬프트를 3자 이상 입력해주세요.');
        promptEl.focus();
        return;
    }

    btnEl.disabled = true;
    const originalBtnHtml = btnEl.innerHTML;
    btnEl.innerHTML = '⏳ 생성중...';
    btnEl.style.cursor = 'not-allowed';
    btnEl.style.opacity = '0.7';

    resultEl.style.display = 'block';
    resultEl.innerHTML = `<div style="padding:30px 20px; text-align:center; background:#fff; border:1.5px dashed #c7d2fe; border-radius:12px;">
        <div style="font-size:14px; color:#6366f1; font-weight:700;">🎨 AI가 디자인을 생성중입니다... (약 15~30초)</div>
        <div style="margin-top:8px; font-size:12px; color:#64748b;">페이지를 닫지 말고 잠시만 기다려주세요</div>
    </div>`;

    try {
        // 인증 토큰 (로그인 상태면 포함)
        let authHeader = '';
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.access_token) authHeader = 'Bearer ' + session.access_token;
        } catch(e) {}

        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch(FN_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt, size: sizeEl ? sizeEl.value : '1024x1024' }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const msg = data?.error || `오류 (${res.status})`;
            resultEl.innerHTML = `<div style="padding:20px; text-align:center; background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; color:#991b1b; font-size:13px; font-weight:600;">
                ⚠️ ${escapeHtml(msg)}
            </div>`;
            if (res.status === 429) {
                quotaEl.textContent = `오늘 한도 소진 (${data.used}/${data.limit})`;
                quotaEl.style.background = '#fef2f2';
                quotaEl.style.color = '#dc2626';
                quotaEl.style.borderColor = '#fecaca';
            }
            return;
        }

        const { imageUrl, used, limit, isPro, remaining } = data;

        if (quotaEl) {
            quotaEl.textContent = `${isPro ? 'PRO' : '무료'} · ${used}/${limit} 사용 (남음 ${remaining})`;
            quotaEl.style.background = '#ecfdf5';
            quotaEl.style.color = '#065f46';
            quotaEl.style.borderColor = '#a7f3d0';
        }

        resultEl.innerHTML = `<div style="padding:14px; background:#fff; border:1.5px solid #c7d2fe; border-radius:12px;">
            <img src="${imageUrl}" alt="AI 생성 이미지" style="width:100%; max-width:640px; display:block; margin:0 auto; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
            <div style="display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
                <a href="${imageUrl}" download="ai-design-${Date.now()}.png" style="padding:10px 18px; background:#6366f1; color:#fff; border-radius:10px; font-size:13px; font-weight:800; text-decoration:none; cursor:pointer;">💾 다운로드</a>
                <button onclick="window.sendAiDesignToEditor && window.sendAiDesignToEditor('${imageUrl}')" style="padding:10px 18px; background:#10b981; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">✏️ 에디터에서 편집</button>
                <button onclick="document.getElementById('aiDesignResult').style.display='none';document.getElementById('aiDesignPrompt').value='';document.getElementById('aiDesignPrompt').focus()" style="padding:10px 18px; background:#fff; color:#6366f1; border:1.5px solid #c7d2fe; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">🔄 새로 만들기</button>
            </div>
        </div>`;
    } catch (e) {
        console.error('AI design error:', e);
        resultEl.innerHTML = `<div style="padding:20px; text-align:center; background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; color:#991b1b; font-size:13px;">
            ⚠️ 네트워크 오류: ${escapeHtml(String(e.message || e))}
        </div>`;
    } finally {
        btnEl.disabled = false;
        btnEl.innerHTML = originalBtnHtml;
        btnEl.style.cursor = 'pointer';
        btnEl.style.opacity = '1';
    }
};

window.sendAiDesignToEditor = function(imageUrl) {
    try {
        sessionStorage.setItem('ai_design_bg_image', imageUrl);
    } catch(e) {}
    const selfDesignBtn = document.querySelector('[data-i18n="self_design"], .adv-ext-btn');
    if (selfDesignBtn) { selfDesignBtn.click(); return; }
    alert('셀프디자인 버튼을 눌러 에디터로 이동해주세요. 배경 이미지가 자동으로 적용됩니다.');
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Enter로 제출 (Shift+Enter는 줄바꿈)
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('aiDesignPrompt');
    if (el) {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.generateAiDesign();
            }
        });
    }
});
