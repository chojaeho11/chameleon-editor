/**
 * outlineMaker.js
 * [최종 수정]
 * 1. 등신대 너비: 전체의 60%로 축소 및 중앙 정렬
 * 2. 등신대 내부 정리: 합친 후 생기는 내부 구멍(Artifacts) 제거 로직 추가
 * 3. 기존 설정 유지: 간격 20, 빨강, 두께 15
 */

if (typeof paper === 'undefined') console.warn("Paper.js not loaded.");
if (typeof window.Potrace === 'undefined') console.error("Potrace library not loaded.");

const mmToPx = (mm) => {
    return mm * (300 / 25.4);
};

export function createVectorOutline(imageSrc, options = {}) {
    // ============================================================
    // [강제 설정 구역]
    // ============================================================
    const FORCED_DILATION = 120;     // 간격 유지
    const FORCED_STROKE = 10;       // 두께 유지
    const FORCED_COLOR = '#FF0000'; // 빨강 유지
    const FORCED_TYPE = options.type || 'normal'; 
    // ============================================================

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            try {
                // 1. 투명도 처리
                const sCanvas = document.createElement('canvas');
                sCanvas.width = img.width;
                sCanvas.height = img.height;
                const sCtx = sCanvas.getContext('2d');
                sCtx.drawImage(img, 0, 0);
                
                const imgData = sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 20) {
                        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
                    } else {
                        data[i + 3] = 0;
                    }
                }
                sCtx.putImageData(imgData, 0, 0);

                // 2. 확장 (Dilation)
                const padding = FORCED_DILATION + 50; 
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width + (padding * 2);
                canvas.height = img.height + (padding * 2);

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const steps = 36;
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    const dx = Math.cos(angle) * FORCED_DILATION;
                    const dy = Math.sin(angle) * FORCED_DILATION;
                    ctx.drawImage(sCanvas, padding + dx, padding + dy);
                }
                ctx.drawImage(sCanvas, padding, padding);

                // 3. Potrace 실행
                const processingSrc = canvas.toDataURL('image/png');
                window.Potrace.loadImageFromUrl(processingSrc);
                window.Potrace.setParameter({
                    turnpolicy: "black",
                    turdsize: 100,      
                    optcurve: true,     
                    alphamax: 1.3,      
                    blacklevel: 0.5
                });

                window.Potrace.process(function() {
                    let svgString = window.Potrace.getSVG(1);

                    // ============================================================
                    // ★ Paper.js 후처리
                    // ============================================================
                    if (typeof paper !== 'undefined') {
                        let dummyCanvas = document.getElementById('paperSetupCanvas');
                        if (!dummyCanvas) {
                            dummyCanvas = document.createElement('canvas');
                            dummyCanvas.id = 'paperSetupCanvas';
                            dummyCanvas.width = 1000; dummyCanvas.height = 1000;
                            dummyCanvas.style.display = 'none';
                            document.body.appendChild(dummyCanvas);
                            paper.setup(dummyCanvas);
                        } else {
                            paper.project.clear(); 
                        }

                        const mainItem = paper.project.importSVG(svgString, { expandShapes: true });
                        
                        // [1차 정리] Potrace 결과물 중 가장 큰 덩어리만 추출 (이미지 노이즈 제거)
                        let outlinePath = null;
                        let maxArea = 0;

                        const findLargestPath = (item) => {
                            if (item.className === 'Path') {
                                const area = Math.abs(item.area);
                                if (area > maxArea) {
                                    maxArea = area;
                                    outlinePath = item;
                                }
                            } else if (item.children) {
                                item.children.forEach(child => findLargestPath(child));
                            }
                        };
                        findLargestPath(mainItem);

                        if (!outlinePath) outlinePath = mainItem.children[0] || mainItem;

                        outlinePath = outlinePath.clone(); 
                        mainItem.remove(); 
                        
                        // 스타일 초기화
                        outlinePath.fillColor = 'black'; 
                        outlinePath.strokeWidth = 0;

                        let finalPath = outlinePath;
                        let bounds = finalPath.bounds;

                        if (FORCED_TYPE === 'keyring') {
                            const outerRadius = mmToPx(16.0); 
                            const innerRadius = mmToPx(8.0); 
                            const centerX = bounds.topCenter.x;
                            const centerY = bounds.topCenter.y + mmToPx(3.0); 

                            const outerCircle = new paper.Path.Circle({
                                center: [centerX, centerY], radius: outerRadius, insert: false
                            });
                            const innerCircle = new paper.Path.Circle({
                                center: [centerX, centerY], radius: innerRadius, insert: false
                            });
                            finalPath = finalPath.unite(outerCircle).subtract(innerCircle);

                        } else if (FORCED_TYPE === 'standee') {
                            // -------------------------------------------------------
                            // [등신대 로직: 너비 60% 중앙 정렬]
                            // -------------------------------------------------------
                            
                            // 1. 박스 높이: 안정감을 위해 15% 유지
                            const baseHeight = Math.max(bounds.height * 0.15, 30);
                            
                            // 2. [수정] 박스 너비: 전체 너비의 60%
                            const baseWidth = bounds.width * 0.6;

                            // 3. [수정] 위치: 전체 중심(center.x)에서 절반만큼 왼쪽으로 이동
                            const startX = bounds.center.x - (baseWidth / 2);

                            // 4. 사각형 생성 (바닥은 캐릭터 바닥과 일치)
                            const baseRect = new paper.Path.Rectangle({
                                point: [startX, bounds.bottom - baseHeight],
                                size: [baseWidth, baseHeight],
                                insert: false
                            });

                            // 5. 합치기
                            let united = finalPath.unite(baseRect);

                            // -------------------------------------------------------
                            // [2차 정리] 합친 후 내부 조각(쓸모없는 구멍) 삭제
                            // unite 과정에서 다리 사이 등에 원치 않는 구멍이 생길 수 있음
                            // -------------------------------------------------------
                            if (united instanceof paper.CompoundPath) {
                                // 구멍이 뚫려있다는 뜻이므로, 다시 가장 큰 덩어리(외곽)만 추출합니다.
                                let maxChildArea = 0;
                                let mainChild = null;
                                
                                united.children.forEach(child => {
                                    const area = Math.abs(child.area);
                                    if (area > maxChildArea) {
                                        maxChildArea = area;
                                        mainChild = child;
                                    }
                                });
                                
                                if (mainChild) {
                                    finalPath = mainChild.clone();
                                    // 기존 CompoundPath는 메모리에서 제거하지 않아도 가비지 컬렉팅 되지만 명시적 분리
                                } else {
                                    finalPath = united; // 실패 시 원본 유지
                                }
                            } else {
                                finalPath = united;
                            }
                        }

                        // [위치 보정]
                        finalPath.translate(new paper.Point(-padding, -padding));

                        // 최종 스타일 적용
                        finalPath.fillColor = null; 
                        finalPath.strokeColor = FORCED_COLOR; 
                        finalPath.strokeWidth = FORCED_STROKE; 

                        svgString = finalPath.exportSVG({ asString: true });
                    }

                    // ============================================================

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgString, "image/svg+xml");
                    const pathNode = doc.querySelector('path');

                    if (!pathNode) {
                        // [수정] 다국어 적용 (실패 메시지)
                        reject(new Error(window.t ? window.t('msg_outline_failed') : "Outline generation failed."));
                        return;
                    }

                    resolve({
                        pathData: pathNode.getAttribute('d'),
                        width: img.width,
                        height: img.height,
                        color: FORCED_COLOR, 
                        strokeWidth: FORCED_STROKE 
                    });
                });

            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error(window.t ? window.t('msg_image_load_failed') : "Failed to load image."));
    });
}