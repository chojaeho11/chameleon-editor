/**
 * Chameleon AI Chat Widget - Embeddable live chat
 *
 * Usage (one line):
 *   <script src="https://cafe2626.com/chat-widget.js"></script>
 *
 * Custom config (optional):
 *   <script>
 *     window.CHAMELEON_CHAT = {
 *       position: 'right',       // 'left' or 'right'
 *       color: '#6366f1',        // button color
 *       bottom: 100,             // bottom offset in px
 *       side: 24,                // side offset in px
 *       url: 'https://cafe2626.com/live-chat.html',
 *       zIndex: 99990,
 *       autoOpen: false,         // auto-open on first visit (default: true for JP)
 *       autoOpenDelay: 5000      // ms before auto-open
 *     };
 *   </script>
 *   <script src="https://cafe2626.com/chat-widget.js"></script>
 */
(function() {
    'use strict';

    if (window.__chameleonChatLoaded) return;
    window.__chameleonChatLoaded = true;

    var cfg = window.CHAMELEON_CHAT || {};
    var position = cfg.position || 'right';
    var color = cfg.color || '#6366f1';
    var bottom = cfg.bottom || 100;
    var side = cfg.side || 24;
    var zIndex = cfg.zIndex || 99990;

    // Detect language from hostname or config
    var h = location.hostname;
    var lang = cfg.lang || (h.indexOf('cafe0101') >= 0 ? 'ja' : h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0 ? 'en' : 'kr');
    var labels = {
        kr: { btn: 'AI 상담', autoMsg: '무엇이든 물어보세요!' },
        ja: { btn: 'AI相談', autoMsg: '何でもお聞きください！' },
        en: { btn: 'AI Chat', autoMsg: 'Ask me anything!' }
    };
    var L = labels[lang] || labels.kr;

    // Auto-detect chat URL from script src domain
    var chatUrl = cfg.url || (function() {
        var scripts = document.querySelectorAll('script[src*="chat-widget"]');
        if (scripts.length) {
            var src = scripts[scripts.length - 1].src;
            var base = src.substring(0, src.lastIndexOf('/') + 1);
            return base + 'live-chat.html';
        }
        return 'https://cafe2626.com/live-chat.html';
    })();
    chatUrl += (chatUrl.indexOf('?') >= 0 ? '&' : '?') + 'embed=true';

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = '' +
        '#ccw-btn{' +
            'position:fixed;bottom:' + bottom + 'px;' + position + ':' + side + 'px;' +
            'height:44px;border-radius:22px;background:' + color + ';' +
            'border:none;cursor:pointer;z-index:' + zIndex + ';' +
            'display:flex;align-items:center;gap:7px;padding:0 16px 0 12px;' +
            'box-shadow:0 4px 20px rgba(99,102,241,0.35);' +
            'transition:transform .2s,box-shadow .2s;animation:ccwPulse 3s infinite;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        '}' +
        '#ccw-btn:hover{transform:scale(1.05);box-shadow:0 6px 28px rgba(99,102,241,0.5)}' +
        '#ccw-btn svg{flex-shrink:0}' +
        '#ccw-btn .ccw-label{color:#fff;font-size:13px;font-weight:700;white-space:nowrap;line-height:1}' +
        '#ccw-btn.open .ccw-label{display:none}' +
        '#ccw-btn.open .ccw-icon-chat{display:none}' +
        '#ccw-btn:not(.open) .ccw-icon-close{display:none}' +
        '@keyframes ccwPulse{0%,100%{box-shadow:0 4px 20px rgba(99,102,241,0.35)}50%{box-shadow:0 4px 20px rgba(99,102,241,0.35),0 0 0 8px rgba(99,102,241,0.1)}}' +
        // Auto-open tooltip bubble
        '#ccw-tooltip{' +
            'position:fixed;bottom:' + (bottom + 52) + 'px;' + position + ':' + side + 'px;' +
            'background:#fff;color:#333;font-size:13px;font-weight:600;padding:10px 16px;' +
            'border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:' + zIndex + ';' +
            'display:none;max-width:200px;line-height:1.4;cursor:pointer;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
            'animation:ccwTooltipIn .3s ease;' +
        '}' +
        '#ccw-tooltip::after{content:"";position:absolute;bottom:-6px;' + position + ':20px;' +
            'width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px 2px 4px rgba(0,0,0,0.05);}' +
        '@keyframes ccwTooltipIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
        '#ccw-frame{' +
            'position:fixed;bottom:' + (bottom + 56) + 'px;' + position + ':' + side + 'px;' +
            'width:400px;height:620px;max-width:calc(100vw - 32px);max-height:calc(100vh - ' + (bottom + 72) + 'px);' +
            'border-radius:16px;overflow:hidden;z-index:' + (zIndex + 1) + ';' +
            'box-shadow:0 20px 60px rgba(0,0,0,0.2);display:none;border:1px solid #e2e8f0;' +
        '}' +
        '#ccw-frame iframe{width:100%;height:100%;border:none}' +
        '@media(max-width:480px){' +
            '#ccw-frame{top:0!important;left:0!important;right:0!important;bottom:0!important;' +
            'width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;' +
            'border-radius:0!important;border:none!important}' +
        '}';
    document.head.appendChild(style);

    // Chat icon SVG
    var chatSvg = '<svg class="ccw-icon-chat" width="20" height="20" viewBox="0 0 24 24" fill="none">' +
        '<path d="M12 3C7.03 3 3 6.58 3 11c0 2.42 1.26 4.58 3.23 6.04L5 21l4.13-1.85C10.05 19.38 11 19.5 12 19.5c4.97 0 9-3.08 9-6.5S16.97 3 12 3z" fill="white"/>' +
        '<circle cx="8.5" cy="11" r="1.2" fill="' + color + '"/>' +
        '<circle cx="12" cy="11" r="1.2" fill="' + color + '"/>' +
        '<circle cx="15.5" cy="11" r="1.2" fill="' + color + '"/>' +
        '</svg>';

    var closeSvg = '<svg class="ccw-icon-close" width="18" height="18" viewBox="0 0 24 24" fill="none">' +
        '<path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>' +
        '</svg>';

    // Create button (pill shape with text)
    var btn = document.createElement('button');
    btn.id = 'ccw-btn';
    btn.setAttribute('aria-label', 'Chat');
    btn.innerHTML = chatSvg + closeSvg + '<span class="ccw-label">' + L.btn + '</span>';
    document.body.appendChild(btn);

    // Create tooltip bubble
    var tooltip = document.createElement('div');
    tooltip.id = 'ccw-tooltip';
    tooltip.textContent = L.autoMsg;
    document.body.appendChild(tooltip);

    // Create iframe container (lazy load — iframe src set on first open)
    var frame = document.createElement('div');
    frame.id = 'ccw-frame';
    var iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'microphone; camera');
    frame.appendChild(iframe);
    document.body.appendChild(frame);

    var isOpen = false;
    var iframeLoaded = false;

    function openChat() {
        if (!iframeLoaded) { iframe.src = chatUrl; iframeLoaded = true; }
        isOpen = true;
        frame.style.display = 'block';
        btn.classList.add('open');
        btn.style.animation = 'none';
        tooltip.style.display = 'none';
        if (window.innerWidth <= 480) btn.style.display = 'none';
        try { sessionStorage.setItem('ccw_opened', '1'); } catch(e) {}
    }

    function closeChat() {
        isOpen = false;
        frame.style.display = 'none';
        btn.classList.remove('open');
        btn.style.display = 'flex';
    }

    // Toggle
    btn.addEventListener('click', function() {
        if (isOpen) closeChat(); else openChat();
    });

    // Tooltip click opens chat
    tooltip.addEventListener('click', openChat);

    // Listen for close from iframe
    window.addEventListener('message', function(e) {
        if (e.data === 'chameleon-chat-close') closeChat();
    });

    // Auto-open tooltip for first-time visitors (after delay)
    var autoOpen = cfg.autoOpen !== undefined ? cfg.autoOpen : true;
    var autoDelay = cfg.autoOpenDelay || 5000;

    if (autoOpen) {
        setTimeout(function() {
            if (isOpen) return;
            try { if (sessionStorage.getItem('ccw_opened')) return; } catch(e) {}
            // Show tooltip bubble (not full chat — less intrusive)
            tooltip.style.display = 'block';
            // Auto-hide tooltip after 8 seconds if not clicked
            setTimeout(function() {
                if (!isOpen) tooltip.style.display = 'none';
            }, 8000);
        }, autoDelay);
    }

})();
