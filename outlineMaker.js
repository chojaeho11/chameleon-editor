/**
 * outlineMaker.js v6
 * [Clipper.js 폴리곤 오프셋 - 스냅스급 정확도]
 *
 * 알고리즘:
 * 1. 알파 채널 → 흑백 마스크
 * 2. Potrace → 벡터 윤곽점 추출
 * 3. ★ Clipper.js → 정확한 폴리곤 오프셋 (blur+threshold 완전 대체)
 * 4. Paper.js → 부드러운 곡선 다듬기
 *
 * Clipper.js는 산업용 폴리곤 오프셋 라이브러리로
 * 스냅스/카멜레온 같은 키링 업체가 사용하는 것과 동일한 방식
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
                // STEP 1: 알파 채널 → 흑백 마스크 (Potrace용)
                // ─────────────────────────────────────────
                var alphaCanvas = document.createElement('canvas');
                alphaCanvas.width = W;
                alphaCanvas.height = H;
                var alphaCtx = alphaCanvas.getContext('2d');
                alphaCtx.drawImage(img, 0, 0);
                var alphaData = alphaCtx.getImageData(0, 0, W, H).data;

                // Potrace용 마스크 (여백 없이 원본 크기)
                var maskCanvas = document.createElement('canvas');
                maskCanvas.width = W;
                maskCanvas.height = H;
                var maskCtx = maskCanvas.getContext('2d');
                maskCtx.fillStyle = '#FFFFFF';
                maskCtx.fillRect(0, 0, W, H);

                var maskImgData = maskCtx.getImageData(0, 0, W, H);
                var md = maskImgData.data;

                for (var y = 0; y < H; y++) {
                    for (var x = 0; x < W; x++) {
                        var srcAlpha = alphaData[(y * W + x) * 4 + 3];
                        if (srcAlpha > 30) {
                            var idx = (y * W + x) * 4;
                            md[idx] = 0;
                            md[idx + 1] = 0;
                            md[idx + 2] = 0;
                        }
                    }
                }
                maskCtx.putImageData(maskImgData, 0, 0);

                // ─────────────────────────────────────────
                // STEP 2: Potrace → 원본 크기의 정확한 벡터 윤곽
                // ─────────────────────────────────────────
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

                        // SVG에서 path d 추출
                        var parser = new DOMParser();
                        var svgDoc = parser.parseFromString(svgString, "image/svg+xml");
                        var pathEl = svgDoc.querySelector('path');

                        if (!pathEl) {
                            reject(new Error("Potrace failed"));
                            return;
                        }

                        // ─────────────────────────────────────────
                        // STEP 3: Paper.js로 path 파싱 → Clipper.js 입력용 좌표 추출
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
                            var canvasArea = W * H;
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

                        // path를 flatten하여 좌표점 배열 추출
                        var flatPath = sourcePath.clone();
                        flatPath.flatten(2); // 2px 간격으로 직선화
                        var points = [];
                        for (var si = 0; si < flatPath.segments.length; si++) {
                            points.push({
                                X: Math.round(flatPath.segments[si].point.x),
                                Y: Math.round(flatPath.segments[si].point.y)
                            });
                        }
                        flatPath.remove();
                        sourcePath.remove();

                        // ─────────────────────────────────────────
                        // STEP 4: ★★★ Clipper.js 폴리곤 오프셋 ★★★
                        // 이것이 스냅스급 정확도의 핵심
                        // ─────────────────────────────────────────
                        var useClipper = (typeof ClipperLib !== 'undefined');
                        var offsetPaths;

                        if (useClipper) {
                            var scale = 100; // Clipper 정밀도 스케일
                            var scaledPoints = [];
                            for (var pi = 0; pi < points.length; pi++) {
                                scaledPoints.push({
                                    X: points[pi].X * scale,
                                    Y: points[pi].Y * scale
                                });
                            }

                            var smoothR = Math.round(OFFSET_DISTANCE * 0.4) * scale;
                            var co1 = new ClipperLib.ClipperOffset();
                            co1.ArcTolerance = 2.5 * scale;
                            co1.AddPath(scaledPoints, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
                            var expanded = new ClipperLib.Paths();
                            co1.Execute(expanded, (OFFSET_DISTANCE * scale) + smoothR);

                            var solution = new ClipperLib.Paths();
                            if (expanded.length > 0) {
                                var co2 = new ClipperLib.ClipperOffset();
                                co2.ArcTolerance = 2.5 * scale;
                                co2.AddPaths(expanded, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
                                co2.Execute(solution, -smoothR);
                            }
                            if (!solution || solution.length === 0) {
                                var coFb = new ClipperLib.ClipperOffset();
                                coFb.ArcTolerance = 2.5 * scale;
                                coFb.AddPath(scaledPoints, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
                                solution = new ClipperLib.Paths();
                                coFb.Execute(solution, OFFSET_DISTANCE * scale);
                            }

                            // 결과 역스케일
                            if (solution.length > 0) {
                                // 가장 큰 결과 path 사용
                                var biggest = solution[0];
                                for (var si2 = 1; si2 < solution.length; si2++) {
                                    if (Math.abs(ClipperLib.Clipper.Area(solution[si2])) > Math.abs(ClipperLib.Clipper.Area(biggest))) {
                                        biggest = solution[si2];
                                    }
                                }
                                offsetPaths = [];
                                for (var pi2 = 0; pi2 < biggest.length; pi2++) {
                                    offsetPaths.push(new paper.Point(biggest[pi2].X / scale, biggest[pi2].Y / scale));
                                }
                            }
                        }

                        if (!offsetPaths || offsetPaths.length < 3) {
                            // Clipper 실패 시 폴백: 원본 path 사용
                            console.warn("Clipper offset failed, using original path");
                            offsetPaths = [];
                            for (var pi3 = 0; pi3 < points.length; pi3++) {
                                offsetPaths.push(new paper.Point(points[pi3].X, points[pi3].Y));
                            }
                        }

                        // ─────────────────────────────────────────
                        // STEP 5: Paper.js로 부드럽게 다듬기
                        // ─────────────────────────────────────────
                        var finalPath = new paper.Path({
                            segments: offsetPaths,
                            closed: true,
                            insert: true
                        });

                        // 부드럽게
                        finalPath.simplify(3);
                        finalPath.smooth({ type: 'continuous' });
                        finalPath.smooth({ type: 'catmull-rom', factor: 0.5 });

                        var bounds = finalPath.bounds;

                        // 등신대 받침
                        if (FORCED_TYPE === 'standee') {
                            // standee base is handled in main.js as draggable object
                        }

                        // 스타일
                        finalPath.fillColor = null;
                        finalPath.strokeColor = FORCED_COLOR;
                        finalPath.strokeWidth = FORCED_STROKE;

                        var finalBounds = {
                            left: bounds.left,
                            top: bounds.top,
                            width: bounds.width,
                            height: bounds.height
                        };

                        var svgOut = finalPath.exportSVG({ asString: true });
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