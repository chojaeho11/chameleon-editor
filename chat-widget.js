/**
 * Chameleon Chat Widget - Embeddable live chat for external sites
 *
 * Usage (one line):
 *   <script src="https://cafe2626.com/chat-widget.js"></script>
 *
 * Custom config (optional):
 *   <script>
 *     window.CHAMELEON_CHAT = {
 *       position: 'right',       // 'left' or 'right'
 *       color: '#6366f1',        // button color
 *       size: 60,                // button size in px
 *       bottom: 24,              // bottom offset in px
 *       side: 24,                // side offset in px
 *       url: 'https://cafe2626.com/live-chat.html', // chat page URL
 *       zIndex: 99990
 *     };
 *   </script>
 *   <script src="https://cafe2626.com/chat-widget.js"></script>
 */
(function() {
    'use strict';

    // Prevent double-init
    if (window.__chameleonChatLoaded) return;
    window.__chameleonChatLoaded = true;

    var cfg = window.CHAMELEON_CHAT || {};
    var position = cfg.position || 'right';
    var color = cfg.color || '#6366f1';
    var size = cfg.size || 60;
    var bottom = cfg.bottom || 24;
    var side = cfg.side || 24;
    var zIndex = cfg.zIndex || 99990;

    // Auto-detect chat URL from script src domain, or use config
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

    // Chat icon SVG (inline, no external dependency)
    var chatSvg = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M21 11.5C21 16.75 16.75 21 11.5 21C10.12 21 8.81 20.72 7.62 20.21L3 21L3.79 16.38C3.29 15.19 3 13.88 3 12.5C3 7.25 7.25 3 12.5 3C17.75 3 21 7.25 21 11.5Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="8.5" cy="12" r="1" fill="white"/>' +
        '<circle cx="12" cy="12" r="1" fill="white"/>' +
        '<circle cx="15.5" cy="12" r="1" fill="white"/>' +
        '</svg>';

    var closeSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>' +
        '</svg>';

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = '#ccw-btn{position:fixed;bottom:' + bottom + 'px;' + position + ':' + side + 'px;' +
        'width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';' +
        'border:none;cursor:pointer;z-index:' + zIndex + ';display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:transform .2s,box-shadow .2s;animation:ccwPulse 2.5s infinite}' +
        '#ccw-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,0.3)}' +
        '#ccw-btn.open svg:first-child{display:none}#ccw-btn:not(.open) svg:last-child{display:none}' +
        '@keyframes ccwPulse{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,0.25)}50%{box-shadow:0 4px 20px rgba(0,0,0,0.25),0 0 0 8px ' + color + '22}}' +
        '#ccw-frame{position:fixed;bottom:' + (bottom + size + 16) + 'px;' + position + ':' + side + 'px;' +
        'width:400px;height:620px;max-width:calc(100vw - 32px);max-height:calc(100vh - ' + (bottom + size + 32) + 'px);' +
        'border-radius:16px;overflow:hidden;z-index:' + (zIndex + 1) + ';' +
        'box-shadow:0 20px 60px rgba(0,0,0,0.2);display:none;border:1px solid #e2e8f0}' +
        '#ccw-frame iframe{width:100%;height:100%;border:none}' +
        '#ccw-badge{position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;' +
        'background:#ef4444;display:none;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700;border:2px solid white}' +
        '@media(max-width:480px){#ccw-frame{top:0!important;left:0!important;right:0!important;bottom:0!important;' +
        'width:100vw!important;height:100vh!important;max-width:100vw!important;max-height:100vh!important;border-radius:0!important;border:none!important}}';
    document.head.appendChild(style);

    // Create button
    var btn = document.createElement('button');
    btn.id = 'ccw-btn';
    btn.setAttribute('aria-label', 'Chat');
    btn.innerHTML = chatSvg + closeSvg + '<span id="ccw-badge"></span>';
    document.body.appendChild(btn);

    // Create iframe container
    var frame = document.createElement('div');
    frame.id = 'ccw-frame';
    var iframe = document.createElement('iframe');
    iframe.src = chatUrl;
    iframe.setAttribute('allow', 'microphone; camera');
    iframe.setAttribute('loading', 'lazy');
    frame.appendChild(iframe);
    document.body.appendChild(frame);

    // Toggle
    var isOpen = false;
    btn.addEventListener('click', function() {
        isOpen = !isOpen;
        frame.style.display = isOpen ? 'block' : 'none';
        btn.classList.toggle('open', isOpen);

        // Stop pulse animation when opened
        if (isOpen) btn.style.animation = 'none';

        // Mobile: hide button when open
        if (isOpen && window.innerWidth <= 480) {
            btn.style.display = 'none';
        }
    });

    // Listen for close from iframe
    window.addEventListener('message', function(e) {
        if (e.data === 'chameleon-chat-close') {
            isOpen = false;
            frame.style.display = 'none';
            btn.classList.remove('open');
            btn.style.display = 'flex';
        }
    });

})();
