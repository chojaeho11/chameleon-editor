/**
 * outlineMaker.js
 * 1. 투명 배경을 확실히 날려버리고 캐릭터만 추출
 * 2. 흰색 배경 위에서 확장(Dilation)하여 사각형 테두리 방지
 * 3. Potrace로 부드러운 벡터 칼선 생성
 */

if (typeof window.Potrace === 'undefined') {
    console.error("Potrace 라이브러리가 로드되지 않았습니다.");
}

export function createVectorOutline(imageSrc, options = {}) {
    const {
        dilation = 15,        // 칼선 여백 (캐릭터와 선 사이 거리)
        color = '#FF00FF',    // 선 색상
        strokeWidth = 2       // 선 두께
    } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;

        img.onload = () => {
            try {
                // [1] 1차 청소: 알맹이는 검은색, 배경은 '완전 투명'으로 만들기
                const sCanvas = document.createElement('canvas');
                sCanvas.width = img.width;
                sCanvas.height = img.height;
                const sCtx = sCanvas.getContext('2d');
                
                sCtx.drawImage(img, 0, 0);
                
                const imgData = sCtx.getImageData(0, 0, sCanvas.width, sCanvas.height);
                const data = imgData.data;
                
                // 픽셀 전수 조사
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    
                    // 투명도가 20 이하면 아예 투명(0)으로 날림 -> 사각형 방지 핵심
                    if (alpha > 20) {
                        data[i] = 0;       // R (검정)
                        data[i + 1] = 0;   // G (검정)
                        data[i + 2] = 0;   // B (검정)
                        data[i + 3] = 255; // Alpha (완전 불투명)
                    } else {
                        data[i + 3] = 0;   // Alpha (완전 투명)
                    }
                }
                sCtx.putImageData(imgData, 0, 0);
                
                // [2] 확장(Dilation) 작업을 위한 큰 캔버스 생성
                const padding = dilation + 50; // 넉넉한 여유 공간
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width + (padding * 2);
                canvas.height = img.height + (padding * 2);

                // ★ 핵심: 배경을 미리 '완전한 흰색'으로 칠해둠
                // Potrace는 흰색 배경 위의 검은색만 인식하므로, 투명 공간이 없게 만듭니다.
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // [3] 검은 실루엣(sCanvas)을 사방으로 돌려가며 그리기 (살 찌우기)
                // 배경이 투명한 sCanvas를 흰색 배경 위에 덧그리므로 모양이 잡힘
                const steps = 36; // 360도 회전
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    const dx = Math.cos(angle) * dilation;
                    const dy = Math.sin(angle) * dilation;
                    
                    // padding 만큼 안쪽으로 들어와서 그림
                    ctx.drawImage(sCanvas, padding + dx, padding + dy);
                }
                // 구멍 메우기 (중앙)
                ctx.drawImage(sCanvas, padding, padding);

                // [4] Potrace 실행
                const processingSrc = canvas.toDataURL('image/png');

                window.Potrace.loadImageFromUrl(processingSrc);
                window.Potrace.setParameter({
                    turnpolicy: "black",
                    turdsize: 100,      // 작은 노이즈 제거
                    optcurve: true,     // 곡선 최적화
                    alphamax: 1.3,      // ★ 곡선을 더 부드럽게
                    blacklevel: 0.5
                });

                window.Potrace.process(function() {
                    const svg = window.Potrace.getSVG(1);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(svg, "image/svg+xml");
                    const pathNode = doc.querySelector('path');

                    if (!pathNode) {
                        reject(new Error("외곽선을 찾을 수 없습니다."));
                        return;
                    }

                    const pathData = pathNode.getAttribute('d');

                    resolve({
                        pathData: pathData,
                        width: canvas.width,   // 전체 캔버스 너비
                        height: canvas.height, // 전체 캔버스 높이
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