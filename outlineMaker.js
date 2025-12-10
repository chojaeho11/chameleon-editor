/**
 * outlineMaker.js
 * 1. 투명 배경 제거 및 확장 (기존 로직 유지)
 * 2. Potrace로 벡터 생성 (기존 로직 유지)
 * 3. [NEW] Paper.js를 이용해 키링/등신대 도형 합치기 추가
 */

// Paper.js 로드 확인 (없으면 경고)
if (typeof paper === 'undefined') console.warn("Paper.js가 로드되지 않았습니다.");
if (typeof window.Potrace === 'undefined') console.error("Potrace 라이브러리가 로드되지 않았습니다.");

// mm 단위를 픽셀로 변환 (300 DPI 기준)
const mmToPx = (mm) => {
    return mm * (300 / 25.4);
};

export function createVectorOutline(imageSrc, options = {}) {
    const {
        dilation = 15,        // 칼선 여백
        color = '#FF00FF',    // 선 색상
        strokeWidth = 2,      // 선 두께
        type = 'normal'       // 'normal', 'keyring', 'standee'
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            try {
                // ----------------------------------------------------------------
                // [1~3] 기존 완벽한 로직 (이미지 전처리 ~ 확장) - 건드리지 않음
                // ----------------------------------------------------------------
                
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
                const padding = dilation + 50; 
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width + (padding * 2);
                canvas.height = img.height + (padding * 2);

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const steps = 36;
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    const dx = Math.cos(angle) * dilation;
                    const dy = Math.sin(angle) * dilation;
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
                    // Potrace가 만든 원본 SVG 문자열
                    let svgString = window.Potrace.getSVG(1);

                    // ============================================================
                    // ★ [추가된 부분] Paper.js로 키링/등신대 모양 합치기
                    // ============================================================
                    if (type !== 'normal' && typeof paper !== 'undefined') {
                        // 1. Paper.js 셋업 (화면에 안 보이는 캔버스 사용)
                        let dummyCanvas = document.getElementById('paperSetupCanvas');
                        if (!dummyCanvas) {
                            dummyCanvas = document.createElement('canvas');
                            dummyCanvas.id = 'paperSetupCanvas';
                            dummyCanvas.width = 1000; dummyCanvas.height = 1000;
                            dummyCanvas.style.display = 'none';
                            document.body.appendChild(dummyCanvas);
                            paper.setup(dummyCanvas);
                        } else {
                            paper.project.clear(); // 기존 작업 초기화
                        }

                        // 2. Potrace SVG를 Paper.js Path로 변환
                        const mainPath = paper.project.importSVG(svgString, { expandShapes: true });
                        // importSVG는 Group을 반환하므로 내부 Path를 꺼냄
                        const outline = mainPath.children[0] || mainPath; 
                        outline.fillColor = 'black'; // 불리언 연산을 위해 색칠

                        const bounds = outline.bounds;
                        let finalPath = outline;

                        // 3. 타입별 도형 합치기
                        if (type === 'keyring') {
                            // --- 키링 로직 ---
                            const outerRadius = mmToPx(3.0); // 6mm 지름
                            const innerRadius = mmToPx(1.5); // 3mm 지름
                            
                            const centerX = bounds.topCenter.x;
                            // 머리 안쪽으로 2mm 파고들기
                            const centerY = bounds.topCenter.y + mmToPx(2.0); 

                            const outerCircle = new paper.Path.Circle({
                                center: [centerX, centerY],
                                radius: outerRadius,
                                fillColor: 'black'
                            });

                            // 합치기 (Unite)
                            const merged = outline.unite(outerCircle);
                            
                            // 구멍 뚫기 (Subtract)
                            const innerCircle = new paper.Path.Circle({
                                center: [centerX, centerY],
                                radius: innerRadius,
                                fillColor: 'black'
                            });
                            
                            finalPath = merged.subtract(innerCircle);

                        } else if (type === 'standee') {
                            // --- 등신대 로직 ---
                            const baseWidth = Math.max(bounds.width * 0.9, mmToPx(30));
                            const baseHeight = mmToPx(12);
                            
                            const centerX = bounds.bottomCenter.x;
                            const overlap = baseHeight * 0.4; // 40% 겹침
                            const startY = bounds.bottomCenter.y - overlap;

                            const standRect = new paper.Path.Rectangle({
                                point: [centerX - baseWidth / 2, startY],
                                size: [baseWidth, baseHeight],
                                fillColor: 'black'
                            });

                            // 합치기 (Unite)
                            finalPath = outline.unite(standRect);
                        }

                        // 4. 합쳐진 결과를 다시 SVG 문자열로 변환
                        svgString = finalPath.exportSVG({ asString: true });
                    }
                    // ============================================================

                    // SVG 파싱 후 데이터 추출 (기존 로직)
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svgString, "image/svg+xml");
                    const pathNode = doc.querySelector('path');

                    if (!pathNode) {
                        reject(new Error("외곽선을 찾을 수 없습니다."));
                        return;
                    }

                    resolve({
                        pathData: pathNode.getAttribute('d'),
                        width: canvas.width,   // Potrace 캔버스 크기 유지
                        height: canvas.height,
                        color: color,
                        strokeWidth: strokeWidth
                    });
                });

            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error("이미지 로드 실패"));
    });
}