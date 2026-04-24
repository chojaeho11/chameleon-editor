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

    const etaLabel = attachedImages.length > 0 ? '약 30~60초 (이미지 편집)' : '약 15~40초';
    resultEl.innerHTML = `<div class="aid-preview-loading">
        <div class="spinner"></div>
        <div style="font-size:15px; color:#6d28d9; font-weight:800; margin-bottom:6px;">AI가 디자인을 생성중입니다</div>
        <div style="font-size:12px; color:#64748b;">${etaLabel}</div>
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
            resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
                <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
                <div style="font-size:14px; font-weight:700;">${escapeHtml(msg)}</div>${detail}
            </div>`;
            return;
        }

        const { imageUrl, used, limit, isPro, remaining } = data;

        if (quotaEl) {
            quotaEl.textContent = '✓ 생성 완료';
            quotaEl.style.background = '#ecfdf5';
            quotaEl.style.color = '#065f46';
            quotaEl.style.borderColor = '#a7f3d0';
        }

        resultEl.innerHTML = `
            <div class="aid-preview-img-wrap">
                <img src="${imageUrl}" alt="AI 생성 이미지">
            </div>
            <div class="aid-preview-actions">
                <button type="button" class="aid-act-primary" onclick="window.sendAiDesignToEditor && window.sendAiDesignToEditor('${imageUrl}')">
                    ✏️ 에디터로 추가편집
                </button>
                <a href="${imageUrl}" download="ai-design-${Date.now()}.png" target="_blank" class="aid-act-secondary">
                    💾 고화질 다운로드
                </a>
            </div>
        `;
    } catch (e) {
        console.error('AI design error:', e);
        resultEl.innerHTML = `<div style="padding:40px 24px; text-align:center; color:#991b1b;">
            <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
            <div style="font-size:14px; font-weight:700;">네트워크 오류</div>
            <div style="margin-top:6px; font-size:12px;">${escapeHtml(String(e.message || e))}</div>
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
