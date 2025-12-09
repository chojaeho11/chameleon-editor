import { canvas } from "./canvas-core.js";
import { ADDON_DB } from "./config.js";
import { FONT_URLS } from "./fonts.js"; 

// ==========================================================
// [1] 내보내기 도구 초기화
// ==========================================================
export function initExport() {
    const btnSVG = document.getElementById("btnDownloadSVG");
    if (btnSVG) {
        btnSVG.onclick = () => {
            const w = canvas.width; const h = canvas.height;
            const svgData = canvas.toSVG({ viewBox: { x: 0, y: 0, width: w, height: h }, width: w, height: h });
            downloadFile(URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" })), "design.svg");
        };
    }

    const btnPNG = document.getElementById("btnPNG");
    if (btnPNG) {
        btnPNG.onclick = () => downloadImage();
    }

    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            const originalText = btnPDF.innerText;
            btnPDF.disabled = true;
            btnPDF.innerText = "벡터 변환 중...";
            
            // 1. 벡터 PDF 생성 시도
            let blob = await generateProductVectorPDF(canvas.toJSON(), canvas.width, canvas.height);
            
            // 2. 실패 시 래스터(이미지) PDF로 재시도
            if (!blob) {
                console.warn("벡터 변환 실패, 이미지 방식으로 재시도합니다.");
                blob = await generateRasterPDF(canvas.toJSON(), canvas.width, canvas.height);
            }

            if(blob) {
                downloadFile(URL.createObjectURL(blob), "design.pdf");
            } else {
                alert("PDF 생성에 실패했습니다.");
            }
            
            btnPDF.disabled = false;
            btnPDF.innerText = originalText;
        };
    }
}

// ==========================================================
// [2] 이미지 다운로드
// ==========================================================
export function downloadImage(filename = "design-image") {
    if (!canvas) return;
    
    canvas.discardActiveObject();
    const originalVpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    const board = canvas.getObjects().find(o => o.isBoard);

    try {
        let dataURL = "";
        if (board) {
            dataURL = canvas.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 2,
                left: board.left,
                top: board.top,
                width: board.getScaledWidth(),
                height: board.getScaledHeight()
            });
        } else {
            dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        }
        downloadFile(dataURL, `${filename}.png`);

    } catch (e) {
        console.error(e);
        alert("이미지 저장 중 오류 발생");
    } finally {
        canvas.setViewportTransform(originalVpt);
        canvas.requestRenderAll();
    }
}

// ==========================================================
// [3] PDF 생성 로직 (폰트 매칭 및 인덱스 밀림 해결)
// ==========================================================

const ALL_FONTS = {
    ...FONT_URLS,
    "NanumGothic": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
};

// 폰트 버퍼 캐시
const fontBufferCache = {};

// ★ [헬퍼] 폰트 키 정규화 (소문자 + 공백/특수문자 제거)
function getNormalizedKey(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/['"\s-]/g, ''); 
}

// 1. 고품질 벡터 PDF 생성
export async function generateProductVectorPDF(json, w, h) {
    if (!window.jspdf || !window.opentype) return null;

    try {
        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(w);
        tempCvs.setHeight(h);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }

        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

        const allObjects = [...tempCvs.getObjects()];
        
        const usedFonts = new Set();
        usedFonts.add('NanumGothic'); // 기본 폰트

        // 1. 사용된 폰트 이름 수집
        allObjects.forEach(obj => {
            if (obj.type.includes('text') && obj.fontFamily) {
                usedFonts.add(obj.fontFamily);
            }
        });

        // 2. 폰트 다운로드 및 캐싱
        const fontPromises = Array.from(usedFonts).map(async (rawFontName) => {
            const normKey = getNormalizedKey(rawFontName);
            if (fontBufferCache[normKey]) return;

            let targetUrl = ALL_FONTS[rawFontName];
            if (!targetUrl) {
                const foundKey = Object.keys(ALL_FONTS).find(k => getNormalizedKey(k) === normKey);
                if (foundKey) targetUrl = ALL_FONTS[foundKey];
            }

            if (targetUrl) {
                try {
                    const res = await fetch(targetUrl);
                    if (res.ok) {
                        const buffer = await res.arrayBuffer();
                        fontBufferCache[rawFontName] = buffer;
                        fontBufferCache[normKey] = buffer;
                        fontBufferCache[rawFontName.replace(/\s/g, '')] = buffer;

                        try {
                            const fontFace = new FontFace(rawFontName, buffer);
                            await fontFace.load();
                            document.fonts.add(fontFace);
                        } catch(err) {}
                    }
                } catch (e) {
                    console.warn(`폰트 로드 실패: ${rawFontName}`, e);
                }
            }
        });

        await Promise.all(fontPromises);
        await document.fonts.ready;

        // 3. 텍스트 -> 패스 변환
        for (const obj of allObjects) {
            if (obj.type.includes('text') && obj.text && obj.text.trim().length > 0) {
                const newPathObj = await createPathFromText(obj);
                if (newPathObj) {
                    newPathObj.set({
                        left: obj.left, top: obj.top, 
                        scaleX: obj.scaleX, scaleY: obj.scaleY,
                        angle: obj.angle, 
                        originX: obj.originX, originY: obj.originY,
                        opacity: obj.opacity, 
                        skewX: obj.skewX, skewY: obj.skewY
                    });
                    
                    const currentObjects = tempCvs.getObjects();
                    const index = currentObjects.indexOf(obj);
                    
                    if (index !== -1) {
                        tempCvs.remove(obj);
                        tempCvs.insertAt(newPathObj, index);
                    }
                }
            }
        }
        
        tempCvs.renderAll();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'pt', format: [w, h] });
        
        const svgStr = tempCvs.toSVG({ 
            viewBox: { x: 0, y: 0, width: w, height: h }, 
            width: w, height: h, 
            suppressPreamble: true 
        });
        
        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;

        await doc.svg(svgElem, { x: 0, y: 0, width: w, height: h });
        return doc.output('blob');

    } catch (e) {
        console.error("벡터 PDF 생성 실패:", e);
        return null;
    }
}

// 2. 래스터(이미지) PDF 생성 (비상용)
export async function generateRasterPDF(json, w, h) {
    if (!window.jspdf) return null;
    try {
        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(w);
        tempCvs.setHeight(h);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }

        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        
        if (!tempCvs.backgroundColor) {
            tempCvs.setBackgroundColor('#ffffff', tempCvs.renderAll.bind(tempCvs));
        }
        tempCvs.renderAll();

        const imgData = tempCvs.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: 2 });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'pt', format: [w, h] });
        doc.addImage(imgData, 'JPEG', 0, 0, w, h);

        return doc.output('blob');

    } catch (e) {
        console.error("래스터 PDF 생성 실패:", e);
        return null;
    }
}

// 텍스트를 Path로 변환하는 함수
async function createPathFromText(textObj) {
    const rawName = textObj.fontFamily;
    const normKey = getNormalizedKey(rawName);

    let buffer = fontBufferCache[rawName] || 
                 fontBufferCache[normKey] || 
                 fontBufferCache[rawName.replace(/\s/g, '')];

    if (!buffer) {
        // console.warn(`PDF 변환 중 폰트 누락 대체: ${rawName} -> NanumGothic`);
        buffer = fontBufferCache['NanumGothic'] || fontBufferCache[getNormalizedKey('NanumGothic')];
    }
    
    if (!buffer) return null;

    try {
        const font = window.opentype.parse(buffer);
        const text = textObj.text;
        const fontSize = textObj.fontSize;
        const lines = text.split('\n');
        
        const lineHeightStr = textObj.lineHeight || 1.16;
        const lineHeight = lineHeightStr * fontSize;
        const baselineOffset = fontSize * 0.8; 

        let pathData = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const x = 0; 
            const y = (i * lineHeight) + baselineOffset; 
            
            const path = font.getPath(line, x, y, fontSize);
            pathData += path.toPathData(2) + " ";
        }

        return new fabric.Path(pathData, {
            fill: textObj.fill,
            stroke: textObj.stroke,
            strokeWidth: textObj.strokeWidth,
            opacity: textObj.opacity,
            objectCaching: false,
        });

    } catch (e) { 
        // console.error(`Opentype 변환 오류 (${rawName}):`, e);
        return null; 
    }
}

export async function getDesignPDFBlob() {
    return generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth']), canvas.width, canvas.height);
}

// ==========================================================
// [4] 작업지시서 생성 (★ 한글 폰트 깨짐 해결 적용)
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF 라이브러리 로딩 중...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // ★ [핵심] 폰트 로더를 반드시 기다림 (이제 캐시된 데이터를 사용)
    if (window.loadKoreanFontForPDF) {
        await window.loadKoreanFontForPDF(doc);
    } 
    // 기본 폰트 설정
    doc.setFont('NanumGothic');

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (i > 0) doc.addPage();
        const margin = 15; let y = margin;
        
        doc.setFontSize(22); 
        doc.setTextColor(99, 102, 241); 
        // ★ 'bold'를 호출해도 위에서 같은 폰트로 매핑했으므로 깨지지 않음
        doc.setFont("NanumGothic", "bold"); 
        doc.text("Chameleon Design Studio", margin, y + 5);
        
        try {
            const qrData = `DATE:${orderInfo.date}|MGR:${orderInfo.manager}|ITEM:${item.product.name}`;
            if(window.QRCode) {
                const qrDataUrl = await window.QRCode.toDataURL(qrData, { width: 100, margin: 1 });
                doc.addImage(qrDataUrl, 'PNG', 210 - margin - 25, y - 5, 25, 25);
            }
        } catch (e) {}

        y += 25; 
        doc.setFontSize(18); doc.setTextColor(0); 
        doc.text("작업 지시서 (Order Sheet)", margin, y); 
        
        y += 10; 
        doc.setDrawColor(99, 102, 241); doc.setLineWidth(0.5); doc.line(margin, y, 210 - margin, y); y += 10;
        doc.setFillColor(248, 250, 252); doc.rect(margin, y, 180, 45, 'F');
        doc.setFontSize(11); doc.setTextColor(50); 
        doc.setFont("NanumGothic", "normal"); 
        
        let rowY = y + 8;
        doc.text(`배송일:  ${orderInfo.date}`, margin + 10, rowY);
        doc.text(`담당자:  ${orderInfo.manager} (${orderInfo.phone})`, margin + 90, rowY);
        rowY += 10;
        doc.text(`주소:    ${orderInfo.address}`, margin + 10, rowY);
        rowY += 10;
        doc.text(`요청:    ${orderInfo.note || "-"}`, margin + 10, rowY, { maxWidth: 150 });
        
        y += 55; doc.setFontSize(14); doc.setFont("NanumGothic", "bold"); doc.setTextColor(0);
        doc.text(`📌 상품 상세 (${i + 1})`, margin, y); y += 10;
        
        let addonList = [];
        // [수정] 코드로 저장된 옵션을 이름으로 변환하여 출력
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                if (addon) addonList.push(`${addon.name} (+${addon.price})`);
            });
        }
        
        doc.setFontSize(12); doc.setFont("NanumGothic", "normal");
        doc.text(`• 상품명: ${item.product.name}`, margin + 5, y); y += 7;
        doc.text(`• 옵션: ${addonList.join(", ") || "기본 사양"}`, margin + 5, y); y += 15;

        if (item.thumb && typeof item.thumb === 'string' && item.thumb.startsWith('data:image')) {
            try {
                doc.setFont("NanumGothic", "bold");
                doc.text("🎨 디자인 시안", margin, y); y += 8;
                const imgProps = doc.getImageProperties(item.thumb);
                const contentW = 180;
                let imgH = (imgProps.height * contentW) / imgProps.width;
                if (imgH > 200) { 
                    const scale = 200 / imgH; imgH = 200; 
                    const scaledW = contentW * scale;
                    doc.addImage(item.thumb, 'PNG', margin + (contentW - scaledW)/2, y, scaledW, imgH); 
                } else {
                    doc.addImage(item.thumb, 'PNG', margin, y, contentW, imgH);
                }
            } catch (imgErr) {}
        }
    }
    return doc.output('blob');
}

// ==========================================================
// [5] 견적서 생성 (★ 한글 폰트 깨짐 해결 적용)
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    // ★ [핵심] 폰트 로드
    if (window.loadKoreanFontForPDF) {
        await window.loadKoreanFontForPDF(doc);
    }
    doc.setFont('NanumGothic');

    const margin = 15; let y = margin;
    doc.setFontSize(24); 
    doc.setFont("NanumGothic", "bold"); 
    doc.text("견  적  서", 105, y + 10, { align: 'center' });
    
    doc.setFontSize(10); 
    doc.setFont("NanumGothic", "normal"); 
    doc.text(`견적일: ${new Date().toLocaleDateString()}`, 105, y + 20, { align: 'center' }); y += 30;
    
    const rX = margin + 90; doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(rX, y, 90, 40);
    let infoY = y + 7; 
    doc.text("등록번호: 470-81-02808", rX + 5, infoY); infoY += 6;
    doc.text("상호: 카멜레온 디자인", rX + 5, infoY); doc.text("대표: 조재호", rX + 50, infoY);
    
    const STAMP_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/design/dojang.png';
    try { 
        const stampData = await loadImageToBase64(STAMP_URL); 
        if (stampData) doc.addImage(stampData, 'PNG', rX + 65, infoY - 5, 15, 15); 
        else throw new Error("No Stamp"); 
    } catch (e) { 
        doc.setTextColor(255,0,0); doc.setDrawColor(255,0,0); 
        doc.circle(rX + 82, infoY - 2, 4); doc.text("인", rX + 80.5, infoY - 0.5); 
    }
    doc.setTextColor(0); doc.setDrawColor(0); 

    infoY += 6; doc.text("주소: 경기도 화성시 우정읍 한말길 72-2", rX + 5, infoY);
    infoY += 6; doc.text("업태: 서비스 / 종목: 디자인", rX + 5, infoY);
    infoY += 6; doc.text("담당: 변지웅 부사장 (010-5512-5366)", rX + 5, infoY);
    
    doc.rect(margin, y, 85, 40); doc.text("귀하", margin + 5, y + 5); 
    doc.setFontSize(14); doc.setFont("NanumGothic", "bold"); 
    doc.text(orderInfo.manager + " 님", 52, y + 20, { align: 'center' }); 
    doc.setFontSize(10); doc.setFont("NanumGothic", "normal"); 
    doc.text(`(Tel: ${orderInfo.phone})`, 52, y + 28, { align: 'center' }); y += 50;

    doc.setFillColor(240, 240, 240); doc.rect(margin, y, 180, 8, 'F'); 
    doc.setFontSize(10); doc.setFont("NanumGothic", "bold"); 
    doc.text("품명", margin + 5, y + 5); doc.text("금액", 190, y + 5, { align: 'right' }); y += 12; // 줄 간격 조정

    let total = 0; doc.setFont("NanumGothic", "normal");
    
    cartItems.forEach((item) => {
        let itemBasePrice = item.product.price;
        let lineTotal = itemBasePrice;

        // 1. 기본 상품명 출력
        doc.setFont("NanumGothic", "bold");
        doc.text(item.product.name, margin + 5, y);
        doc.setFont("NanumGothic", "normal");
        doc.text(itemBasePrice.toLocaleString(), 190, y, { align: 'right' });
        y += 6;

        // 2. 옵션 내역 출력 (★ 수정된 부분: 코드로 이름 조회)
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                if (addon) {
                    doc.text(`└ ${addon.name}`, margin + 10, y);
                    doc.text(`+${addon.price.toLocaleString()}`, 190, y, { align: 'right' });
                    lineTotal += addon.price;
                    y += 6;
                }
            });
        }
        
        // 수량 적용 합계
        total += lineTotal * item.qty;
        
        // 구분선
        y += 2; 
        doc.setDrawColor(220); 
        doc.line(margin, y, 195, y);
        y += 6;
    });

    y += 5; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(margin, y, 195, y); y += 10;
    doc.setFontSize(14); doc.setFont("NanumGothic", "bold");
    doc.text(`총 합계: ${total.toLocaleString()} 원 (VAT 포함)`, 190, y, { align: 'right' });
    
    return doc.output('blob');
}

async function loadImageToBase64(url) { 
    try { 
        const response = await fetch(url); 
        if (!response.ok) return null; 
        const blob = await response.blob(); 
        return new Promise((resolve) => { 
            const reader = new FileReader(); 
            reader.onload = () => resolve(reader.result); 
            reader.readAsDataURL(blob); 
        }); 
    } catch (e) { return null; } 
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}