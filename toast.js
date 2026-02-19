// toast.js — Global toast notification system
// Usage: showToast("message") or showToast("message", "error") or showToast("message", "success", 5000)
(function() {
    // CSS injection
    const style = document.createElement('style');
    style.textContent = `
    #toastContainer {
        position: fixed; top: 20px; right: 20px; z-index: 999999;
        display: flex; flex-direction: column; gap: 8px;
        pointer-events: none; max-width: 400px;
    }
    .toast-item {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 16px; border-radius: 10px;
        color: #fff; font-size: 14px; line-height: 1.5;
        box-shadow: 0 4px 20px rgba(0,0,0,.15);
        pointer-events: auto; cursor: pointer;
        animation: toastIn .3s ease;
        word-break: break-word; max-width: 400px;
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    }
    .toast-item.removing { animation: toastOut .25s ease forwards; }
    .toast-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .toast-msg { flex: 1; }
    .toast-info    { background: rgba(37,99,235,.92); }
    .toast-success { background: rgba(22,163,74,.92); }
    .toast-error   { background: rgba(220,38,38,.92); }
    .toast-warn    { background: rgba(217,119,6,.92); }
    @keyframes toastIn  { from { opacity:0; transform:translateX(60px); } to { opacity:1; transform:translateX(0); } }
    @keyframes toastOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(60px); } }
    @media (max-width: 500px) {
        #toastContainer { top: 10px; right: 10px; left: 10px; max-width: none; }
        .toast-item { max-width: none; font-size: 13px; padding: 10px 14px; }
    }
    `;
    document.head.appendChild(style);

    // Container
    function getContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            document.body.appendChild(c);
        }
        return c;
    }

    const icons = {
        info:    '💬',
        success: '✅',
        error:   '❌',
        warn:    '⚠️'
    };

    /**
     * Show a toast notification
     * @param {string} msg - Message to display (supports \n for line breaks)
     * @param {'info'|'success'|'error'|'warn'} type - Toast type
     * @param {number} duration - Auto-dismiss ms (default: 3500, 0=manual only)
     */
    function showToast(msg, type, duration) {
        if (!msg) return;
        type = type || 'info';
        if (duration === undefined) duration = type === 'error' ? 5000 : 3500;

        const container = getContainer();
        const el = document.createElement('div');
        el.className = 'toast-item toast-' + type;

        // Clean emoji prefixes that were used with old alerts
        let cleanMsg = String(msg).replace(/^[✅❌⚠️🔥💼📝🎉🚫💬📋🚀♻️⚙️✨📥🎨🌍]+\s*/u, '');
        // Convert \n to <br>
        cleanMsg = cleanMsg.replace(/\n/g, '<br>');

        el.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-msg">' + cleanMsg + '</span>';

        // Click to dismiss
        el.onclick = function() { removeToast(el); };

        container.appendChild(el);

        // Auto dismiss
        if (duration > 0) {
            setTimeout(function() { removeToast(el); }, duration);
        }

        // Keep max 5 toasts visible
        while (container.children.length > 5) {
            removeToast(container.children[0]);
        }
    }

    function removeToast(el) {
        if (!el || !el.parentNode || el.classList.contains('removing')) return;
        el.classList.add('removing');
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }

    // Expose globally
    window.showToast = showToast;
})();
