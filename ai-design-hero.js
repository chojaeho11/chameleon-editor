import { sb } from './config.js?v=292';

const SUPABASE_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
const FN_URL = SUPABASE_URL + '/functions/v1/ai-design-gen';

// 첨부된 이미지 버퍼 (최대 4장)
const attachedImages = [];

function relocateAiPanel() {
    const panel = document.getElementById('aiDesignHero');
    const hero = document.querySelector('#startScreen .hero-section') || document.querySelector('.hero-section');
    if (panel && hero && hero.parentNode && panel.previousElementSibling !== hero) {
        hero.parentNode.insertBefore(panel, hero.nextSibling);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', relocateAiPanel);
} else {
    relocateAiPanel();
}
setTimeout(relocateAiPanel, 300);
setTimeout(relocateAiPanel, 1500);

function renderThumbs() {
    const wrap = document.getElementById('aiDesignThumbs');
    if (!wrap) return;
    wrap.innerHTML = '';
    attachedImages.forEach((img, idx) => {
        const div = document.createElement('div');
        div.className = 'aid-thumb';
        div.innerHTML = `<img src="${img.dataUrl}" alt="첨부"><button type="button" title="제거" onclick="window.removeAiDesignImage(${idx})">×</button>`;
        wrap.appendChild(div);
    });
}

window.addAiDesignImages = function(files) {
    if (!files || files.length === 0) return;
    const remaining = 4 - attachedImages.length;
    if (remaining <= 0) { alert('최대 4장까지 첨부 가능합니다.'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    toAdd.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 8 * 1024 * 1024) { alert(`"${file.name}"은 8MB를 초과합니다.`); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImages.push({ file, dataUrl: e.target.result });
            renderThumbs();
        };
        reader.readAsDataURL(file);
    });
};

window.removeAiDesignImage = function(idx) {
    attachedImages.splice(idx, 1);
    renderThumbs();
};

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
    const etaLabel = attachedImages.length > 0 ? '약 30~60초 (이미지 편집)' : '약 15~40초';
    resultEl.innerHTML = `<div style="padding:30px 20px; text-align:center; background:#fff; border:1.5px dashed #c7d2fe; border-radius:12px;">
        <div style="font-size:14px; color:#6366f1; font-weight:700;">🎨 AI가 고품질(high) 디자인을 생성중입니다... (${etaLabel})</div>
        <div style="margin-top:8px; font-size:12px; color:#64748b;">한글 텍스트 포함 디자인은 시간이 조금 더 걸립니다</div>
    </div>`;

    try {
        let authToken = '';
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (session?.access_token) authToken = session.access_token;
        } catch(e) {}

        const headers = {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + (authToken || SUPABASE_ANON),
        };

        let fetchBody;
        if (attachedImages.length > 0) {
            const fd = new FormData();
            fd.append('prompt', prompt);
            fd.append('size', sizeEl ? sizeEl.value : '1024x1024');
            if (authToken) fd.append('authToken', authToken);
            attachedImages.forEach((img, i) => {
                fd.append('image', img.file, img.file.name || `upload-${i}.png`);
            });
            fetchBody = fd;
        } else {
            headers['Content-Type'] = 'application/json';
            fetchBody = JSON.stringify({ prompt, size: sizeEl ? sizeEl.value : '1024x1024', authToken });
        }

        const res = await fetch(FN_URL, {
            method: 'POST',
            headers,
            body: fetchBody,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const msg = data?.error || `오류 (${res.status})`;
            const detail = data?.detail ? `<div style="margin-top:6px; font-size:11px; color:#7f1d1d; opacity:0.8;">${escapeHtml(data.detail)}</div>` : '';
            resultEl.innerHTML = `<div style="padding:20px; text-align:center; background:#fef2f2; border:1.5px solid #fecaca; border-radius:12px; color:#991b1b; font-size:13px; font-weight:600;">
                ⚠️ ${escapeHtml(msg)}${detail}
            </div>`;
            if (res.status === 429 && quotaEl) {
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
            <img src="${imageUrl}" alt="AI 생성 이미지" style="width:100%; max-width:720px; display:block; margin:0 auto; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
            <div style="display:flex; gap:8px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
                <a href="${imageUrl}" download="ai-design-${Date.now()}.png" target="_blank" style="padding:10px 18px; background:#6366f1; color:#fff; border-radius:10px; font-size:13px; font-weight:800; text-decoration:none; cursor:pointer;">💾 다운로드</a>
                <button type="button" onclick="window.useAsAiDesignInput && window.useAsAiDesignInput('${imageUrl}')" style="padding:10px 18px; background:#8b5cf6; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">🎨 이 이미지로 재편집</button>
                <button type="button" onclick="window.sendAiDesignToEditor && window.sendAiDesignToEditor('${imageUrl}')" style="padding:10px 18px; background:#10b981; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">✏️ 에디터로 보내기</button>
                <button type="button" onclick="document.getElementById('aiDesignResult').style.display='none';document.getElementById('aiDesignPrompt').focus()" style="padding:10px 18px; background:#fff; color:#6366f1; border:1.5px solid #c7d2fe; border-radius:10px; font-size:13px; font-weight:800; cursor:pointer;">🔄 닫기</button>
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

// 생성된 이미지를 다시 입력으로 (재편집)
window.useAsAiDesignInput = async function(imageUrl) {
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `prev-${Date.now()}.png`, { type: blob.type || 'image/png' });
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImages.length = 0;
            attachedImages.push({ file, dataUrl: e.target.result });
            renderThumbs();
            document.getElementById('aiDesignPrompt').focus();
            document.getElementById('aiDesignResult').style.display = 'none';
            alert('이 이미지를 재편집 대상으로 설정했습니다. 수정 지시사항을 입력 후 🎨 생성을 눌러주세요.');
        };
        reader.readAsDataURL(blob);
    } catch(e) {
        alert('이미지를 불러오지 못했습니다: ' + e.message);
    }
};

window.sendAiDesignToEditor = function(imageUrl) {
    try { sessionStorage.setItem('ai_design_bg_image', imageUrl); } catch(e) {}
    const selfDesignBtn = document.querySelector('[data-i18n="self_design"], .adv-ext-btn');
    if (selfDesignBtn) { selfDesignBtn.click(); return; }
    alert('셀프디자인 버튼을 눌러 에디터로 이동해주세요. 배경 이미지가 자동으로 적용됩니다.');
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

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
