/**
 * outlineMaker.js v7
 * [blur+threshold 래스터 팽창 → Potrace 벡터 트레이싱]
 *
 * 알고리즘:
 * 1. 알파 채널 → 흰 실루엣 마스크
 * 2. ★ blur+threshold → 부드럽게 팽창된 마스크 (Clipper.js 대체)
 * 3. 팽창 마스크 → 흑백 반전 → Potrace → 매끄러운 벡터 윤곽
 * 4. Paper.js → 최종 곡선 다듬기
 *
 * v6 대비 변경: Clipper.js 폴리곤 오프셋 제거 → blur 래스터 팽창
 * 결과: 미니 에디터와 동일한 부드러운 곡선
 */

if (typeof paper === 'undefined') console.warn("Paper.js not loaded.");
if (typeof window.Potrace === 'undefined') console.error("Potrace library not loaded.");

var mmToPx = function(mm) {
    return mm * (300 / 25.4);
};

export function createVectorOutline(imageSrc, options) {
    options = options || {};
    var OFFSET_DISTANCE = options.offset || 20;
    var FORCED_STROKE = options.strokeWidth || 2;
    var FORCED_COLOR = options.color || '#FF0000';
    var FORCED_TYPE = options.type || 'normal';

    return new Promise(function(resolve, reject) {
        var img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = function() {
            try {
                var W = img.width;
                var H = img.height;

                // ─────────────────────────────────────────
                // STEP 1: 알파 채널 → 흰 실루엣 (blur 입력용)
                // ─────────────────────────────────────────
                var pad = OFFSET_DISTANCE + 10; // blur 여유 공간
                var padW = W + pad * 2;
                var padH = H + pad * 2;

                var silCanvas = document.createElement('canvas');
                silCanvas.width = padW;
                silCanvas.height = padH;
                var silCtx = silCanvas.getContext('2d');

                // 이미지를 패딩 안쪽에 그리기
                silCtx.drawImage(img, pad, pad);

                // 알파 → 흰색 실루엣
                silCtx.globalCompositeOperation = 'source-in';
                silCtx.fillStyle = '#ffffff';
                silCtx.fillRect(0, 0, padW, padH);
                silCtx.globalCompositeOperation = 'source-over';

                // ─────────────────────────────────────────
                // STEP 2: ★ blur+threshold 래스터 팽창
                //   미니 에디터와 동일한 부드러운 팽창 방식
                // ─────────────────────────────────────────
                var expandCanvas = document.createElement('canvas');
                expandCanvas.width = padW;
                expandCanvas.height = padH;
                var expCtx = expandCanvas.getContext('2d');

                // 다중 패스 blur로 팽창량 조절
                var blurPx = Math.max(4, Math.round(OFFSET_DISTANCE * 0.6));
                expCtx.filter = 'blur(' + blurPx + 'px)';
                expCtx.drawImage(silCanvas, 0, 0);
                expCtx.drawImage(expandCanvas, 0, 0); // 2nd pass
                expCtx.filter = 'none';

                // threshold: 알파값 기준으로 이진화
                var expData = expCtx.getImageData(0, 0, padW, padH);
                var ed = expData.data;
                for (var i = 3; i < ed.length; i += 4) {
                    ed[i] = ed[i] > 15 ? 255 : 0;
                }
                expCtx.putImageData(expData, 0, 0);

                // ─────────────────────────────────────────
                // STEP 3: 팽창 마스크 → Potrace 흑백 변환 → 벡터 트레이싱
                // ─────────────────────────────────────────
                // Potrace는 흰 배경 + 검은 오브젝트를 트레이싱
                var maskCanvas = document.createElement('canvas');
                maskCanvas.width = padW;
                maskCanvas.height = padH;
                var maskCtx = maskCanvas.getContext('2d');
                maskCtx.fillStyle = '#FFFFFF';
                maskCtx.fillRect(0, 0, padW, padH);

                // 팽창 마스크의 불투명 영역 → 검은색
                var maskData = maskCtx.getImageData(0, 0, padW, padH);
                var mdd = maskData.data;
                for (var j = 0; j < ed.length; j += 4) {
                    if (ed[j + 3] > 128) {
                        mdd[j] = 0;
                        mdd[j + 1] = 0;
                        mdd[j + 2] = 0;
                    }
                }
                maskCtx.putImageData(maskData, 0, 0);

                var maskSrc = maskCanvas.toDataURL('image/png');
                window.Potrace.loadImageFromUrl(maskSrc);
                window.Potrace.setParameter({
                    turnpolicy: "minority",
                    turdsize: 50,
                    optcurve: true,
                    alphamax: 1.0,
                    opttolerance: 0.2
                });

                window.Potrace.process(function() {
                    try {
                        var svgString = window.Potrace.getSVG(1);

                        var parser = new DOMParser();
                        var svgDoc = parser.parseFromString(svgString, "image/svg+xml");
                        var pathEl = svgDoc.querySelector('path');

                        if (!pathEl) {
                            reject(new Error("Potrace failed"));
                            return;
                        }

                        // ─────────────────────────────────────────
                        // STEP 4: Paper.js → path 파싱 + 스무딩 + 좌표 보정
                        // ─────────────────────────────────────────
                        var dummyCanvas = document.getElementById('paperSetupCanvas');
                        if (!dummyCanvas) {
                            dummyCanvas = document.createElement('canvas');
                            dummyCanvas.id = 'paperSetupCanvas';
                            dummyCanvas.width = 1;
                            dummyCanvas.height = 1;
                            dummyCanvas.style.display = 'none';
                            document.body.appendChild(dummyCanvas);
                            paper.setup(dummyCanvas);
                        } else {
                            paper.project.clear();
                        }

                        var mainItem = paper.project.importSVG(svgString, { expandShapes: true });

                        // 가장 큰 실루엣 path 찾기
                        var allPaths = [];
                        function collectPaths(item) {
                            if (item.className === 'Path' && item.segments && item.segments.length > 4) {
                                allPaths.push(item);
                            }
                            if (item.children) {
                                for (var ci = 0; ci < item.children.length; ci++) {
                                    collectPaths(item.children[ci]);
                                }
                            }
                        }
                        collectPaths(mainItem);
                        allPaths.sort(function(a, b) { return Math.abs(b.area) - Math.abs(a.area); });

                        var sourcePath = null;
                        if (allPaths.length > 0) {
                            var canvasArea = padW * padH;
                            if (Math.abs(allPaths[0].area) > canvasArea * 0.85 && allPaths.length > 1) {
                                sourcePath = allPaths[1];
                            } else {
                                sourcePath = allPaths[0];
                            }
                        }
                        mainItem.remove();

                        if (!sourcePath) {
                            reject(new Error("No outline path found"));
                            return;
                        }

                        // 패딩 좌표 보정: 패딩만큼 이동하여 원본 기준으로 맞추기
                        sourcePath.translate(new paper.Point(-pad, -pad));

                        // 부드럽게 다듬기
                        sourcePath.simplify(3);
                        sourcePath.smooth({ type: 'continuous' });
                        sourcePath.smooth({ type: 'catmull-rom', factor: 0.5 });

                        var bounds = sourcePath.bounds;

                        // 스타일
                        sourcePath.fillColor = null;
                        sourcePath.strokeColor = FORCED_COLOR;
                        sourcePath.strokeWidth = FORCED_STROKE;

                        var finalBounds = {
                            left: bounds.left,
                            top: bounds.top,
                            width: bounds.width,
                            height: bounds.height
                        };

                        var svgOut = sourcePath.exportSVG({ asString: true });
                        sourcePath.remove();

                        var parser2 = new DOMParser();
                        var doc2 = parser2.parseFromString(svgOut, "image/svg+xml");
                        var pathEl2 = doc2.querySelector('path');

                        if (!pathEl2) {
                            reject(new Error("SVG export failed"));
                            return;
                        }

                        resolve({
                            pathData: pathEl2.getAttribute('d'),
                            imgWidth: W,
                            imgHeight: H,
                            color: FORCED_COLOR,
                            strokeWidth: FORCED_STROKE,
                            offsetDistance: OFFSET_DISTANCE,
                            outlineBounds: finalBounds,
                            type: FORCED_TYPE
                        });

                    } catch(e) {
                        reject(e);
                    }
                });

            } catch (e) {
                reject(e);
            }
        };
        img.onerror = function() {
            reject(new Error("Image load failed"));
        };
    });
}
