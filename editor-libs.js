// 미니에디터 외부 라이브러리 로더 (index.html + cotton_print.html 공용)
// 2026-06-29: index.html 인라인에서 추출 — fabric/jspdf/opentype/svg2pdf 등 lazy 로드.
window._editorLibsLoaded = false;
window._editorLibsPromise = null;
window.loadEditorLibraries = function() {
    if (window._editorLibsLoaded) return Promise.resolve();
    if (window._editorLibsPromise) return window._editorLibsPromise;
    // clipper shim
    if (typeof module === 'undefined') { window.module = { exports: {} }; window._clipperShim = true; }
    // svg2pdf는 module shim과 충돌하므로 별도 로드 (shim 정리 후)
    var libs = [
        'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js',
        'https://cdn.jsdelivr.net/gh/gitbrent/PptxGenJS@3.12.0/dist/pptxgen.bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/gh/kilobtye/potrace@master/potrace.js',
        'https://cdn.jsdelivr.net/npm/js-clipper@1.0.1/clipper.min.js',
        'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js',
        'https://cdn.jsdelivr.net/npm/opentype.js@latest/dist/opentype.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/paper.js/0.12.17/paper-full.min.js'
    ];
    var deferredLibs = [
        'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/plugins/svg.js'
    ];
    window._editorLibsPromise = new Promise(function(resolve) {
        var loaded = 0;
        var total = libs.length;
        function onDone() { loaded++; if (loaded >= total) {
            // ★ shim 정리 후 svg2pdf 로드 (module 변수 충돌 방지)
            if (window._clipperShim) { delete window.module; delete window._clipperShim; }
            var dLoaded = 0;
            deferredLibs.forEach(function(src) {
                var s = document.createElement('script');
                s.src = src;
                s.onload = s.onerror = function() { dLoaded++; if (dLoaded >= deferredLibs.length) { window._editorLibsLoaded = true; resolve(); } };
                document.head.appendChild(s);
            });
        }}
        libs.forEach(function(src) {
            var s = document.createElement('script');
            s.src = src; s.onload = onDone; s.onerror = onDone;
            document.head.appendChild(s);
        });
    });
    return window._editorLibsPromise;
};
