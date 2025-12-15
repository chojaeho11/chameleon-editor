// export.js

import { canvas } from "./canvas-core.js";
import { ADDON_DB, getUserLogoCount, currentUser } from "./config.js"; 
import { FONT_URLS } from "./fonts.js"; 

// ==========================================================
// [1] 내보내기 도구 초기화 (등급별 권한 체크 추가)
// ==========================================================
export function initExport() {
    // 1. SVG 다운로드 (제한 없음)
    const btnSVG = document.getElementById("btnDownloadSVG");
    if (btnSVG) {
        btnSVG.onclick = () => {
            const w = canvas.width; const h = canvas.height;
            const svgData = canvas.toSVG({ viewBox: { x: 0, y: 0, width: w, height: h }, width: w, height: h });
            downloadFile(URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" })), "design.svg");
        };
    }

    // 2. PNG 다운로드 (로고 5개 이상 필요)
    const btnPNG = document.getElementById("btnPNG");
    if (btnPNG) {
        btnPNG.onclick = async () => {
            if (!currentUser) {
                alert("로그인이 필요한 서비스입니다.");
                document.getElementById('loginModal').style.display='flex';
                return;
            }
            
            const btn = btnPNG;
            const originText = btn.innerText;
            btn.innerText = "권한 확인 중...";
            
            // 유저 기여도 체크
            const count = await getUserLogoCount();
            btn.innerText = originText;

            if (count < 5) {
                alert(`🔒 [멤버십 제한]\n로고를 5개 이상 공유해주시면 PNG 다운로드가 가능합니다.\n(현재 내 공유 로고: ${count}개)`);
                // 로고 업로드 모달 열기
                const uploadModal = document.getElementById('logoUploadModal');
                if(uploadModal) uploadModal.style.display='flex';
                return;
            }

            downloadImage();
        };
    }

    // 3. PDF 다운로드 (로고 10개 이상 필요)
    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            if (!currentUser) {
                alert("로그인이 필요한 서비스입니다.");
                document.getElementById('loginModal').style.display='flex';
                return;
            }

            const btn = btnPDF;
            const originalText = btn.innerText;
            btn.innerText = "변환 중...";

            const count = await getUserLogoCount();
            
            if (count < 10) {
                btn.innerText = originalText;
                alert(`🔒 [VIP 제한]\n로고를 10개 이상 공유해주시면 고화질 PDF(벡터) 다운로드가 가능합니다.\n(현재 내 공유 로고: ${count}개)`);
                const uploadModal = document.getElementById('logoUploadModal');
                if(uploadModal) uploadModal.style.display='flex';
                return;
            }

            // 권한 충족 시 실행
            btn.disabled = true;
            
            // ★ [핵심 수정] 대지(Board) 영역 찾기 및 좌표 계산
            const board = canvas.getObjects().find(o => o.isBoard);
            
            let x = 0; 
            let y = 0;
            let w = canvas.width;
            let h = canvas.height;

            if (board) {
                x = board.left;
                y = board.top;
                w = board.width * board.scaleX;
                h = board.height * board.scaleY;
            }
            
            // 좌표(x, y)와 크기(w, h)를 모두 전달
            let blob = await generateProductVectorPDF(canvas.toJSON(), w, h, x, y);
            
            if (!blob) {
                console.warn("벡터 변환 실패, 이미지 방식으로 재시도합니다.");
                blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
            }

            if(blob) {
                downloadFile(URL.createObjectURL(blob), "design.pdf");
            } else {
                alert("PDF 생성에 실패했습니다.");
            }
            
            btn.disabled = false;
            btn.innerText = originalText;
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
    // 뷰포트 초기화하여 정확한 좌표 계산
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    const board = canvas.getObjects().find(o => o.isBoard);

    try {
        let dataURL = "";
        if (board) {
            // ★ [수정] 대지 영역만 정확히 크롭
            dataURL = canvas.toDataURL({
                format: 'png', quality: 1, multiplier: 2,
                left: board.left, 
                top: board.top,
                width: board.width * board.scaleX, 
                height: board.height * board.scaleY
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
// [3] PDF 생성 유틸리티 (폰트, QR, 이미지변환)
// ==========================================================
const ALL_FONTS = {
    ...FONT_URLS,
    "NanumGothic": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
};

const fontBufferCache = {};

function getNormalizedKey(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/['"\s-]/g, ''); 
}

// QR코드 생성
async function generateQRCodeUrl(text) {
    if (typeof QRCode === 'undefined') return null;
    try {
        return await QRCode.toDataURL(text, { width: 150, margin: 1, errorCorrectionLevel: 'L' });
    } catch (err) {
        return null;
    }
}

// [핵심] 일반 이미지 URL -> Base64 변환 (CORS 해결)
async function getSafeImageDataUrl(urlOrData) {
    if (!urlOrData) return null;
    if (urlOrData.startsWith('data:image')) return urlOrData;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.src = urlOrData;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try { resolve(canvas.toDataURL('image/png')); } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
    });
}

// [핵심] PDF URL -> 이미지 Base64 변환
async function pdfUrlToImageData(url) {
    if (!window.pdfjsLib) return null;
    try {
        const loadingTask = window.pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); 
        
        const scale = 1.5; 
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
        console.error("PDF 렌더링 실패:", e);
        return null;
    }
}

// ----------------------------------------------------------
// 벡터 PDF 생성 로직 (디자인 파일용)
// ----------------------------------------------------------
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf || !window.opentype) return null;

    try {
        const MM_TO_PX = 3.7795;
        // w, h는 이제 대지의 크기입니다.
        const widthMM = w / MM_TO_PX;
        const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        
        // 캔버스 전체 크기는 넉넉하게 잡거나 기존과 동일하게 유지해도 되지만,
        // toSVG에서 viewBox로 잘라낼 것이므로 로드 자체는 전체 크기로 합니다.
        // 다만 json 내 좌표가 전체 캔버스 기준이므로 캔버스를 충분히 크게 잡습니다.
        tempCvs.setWidth(canvas ? canvas.width : w + x);
        tempCvs.setHeight(canvas ? canvas.height : h + y);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }

        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

        // 그룹 해제 및 텍스트 처리
        const rawObjects = tempCvs.getObjects();
        for (let i = rawObjects.length - 1; i >= 0; i--) {
            const obj = rawObjects[i];
            if (obj.type === 'group' || obj.isOutlineGroup) {
                const items = obj.getObjects();
                obj._restoreObjectsState(); 
                tempCvs.remove(obj);
                items.forEach(item => {
                    tempCvs.add(item);
                    item.set('dirty', true);
                });
            }
        }
        tempCvs.renderAll();

        // 폰트 로드 로직 (기존과 동일)
        const allObjects = [...tempCvs.getObjects()];
        const usedFonts = new Set();
        usedFonts.add('NanumGothic'); 

        allObjects.forEach(obj => {
            if (obj.type.includes('text') && obj.fontFamily) {
                usedFonts.add(obj.fontFamily);
            }
        });

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
                } catch (e) {}
            }
        });
        await Promise.all(fontPromises);
        await document.fonts.ready;

        // 텍스트 패스 변환
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
        const doc = new jsPDF({ 
            orientation: widthMM > heightMM ? 'l' : 'p', 
            unit: 'mm', 
            format: [widthMM, heightMM] 
        });
        
        // ★ [핵심] viewBox를 사용하여 대지 영역(x, y, w, h)만 SVG로 추출
        const svgStr = tempCvs.toSVG({ 
            viewBox: { x: x, y: y, width: w, height: h }, 
            width: w, 
            height: h, 
            suppressPreamble: true 
        });
        
        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;

        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
        
        return doc.output('blob');

    } catch (e) {
        console.error("벡터 PDF 생성 실패:", e);
        return null;
    }
}

// 래스터(이미지) PDF 생성 (백업용)
export async function generateRasterPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX;
        const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        // 전체 로드
        tempCvs.setWidth(canvas ? canvas.width : w + x);
        tempCvs.setHeight(canvas ? canvas.height : h + y);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }

        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        
        if (!tempCvs.backgroundColor) {
            tempCvs.setBackgroundColor('#ffffff', tempCvs.renderAll.bind(tempCvs));
        }
        tempCvs.renderAll();

        // ★ [핵심] toDataURL에서 left, top 옵션을 사용해 크롭
        const imgData = tempCvs.toDataURL({ 
            format: 'jpeg', 
            quality: 0.9, 
            multiplier: 2,
            left: x,
            top: y,
            width: w,
            height: h
        });
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ 
            orientation: widthMM > heightMM ? 'l' : 'p', 
            unit: 'mm', 
            format: [widthMM, heightMM] 
        });

        doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);

        return doc.output('blob');

    } catch (e) {
        console.error("래스터 PDF 생성 실패:", e);
        return null;
    }
}

// 텍스트 패스 변환 헬퍼
async function createPathFromText(textObj) {
    const rawName = textObj.fontFamily;
    const normKey = getNormalizedKey(rawName);

    let buffer = fontBufferCache[rawName] || fontBufferCache[normKey] || fontBufferCache[rawName.replace(/\s/g, '')];

    if (!buffer) {
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
            strokeLineJoin: textObj.strokeLineJoin,
            strokeLineCap: textObj.strokeLineCap,
            opacity: textObj.opacity,
            objectCaching: false
        });

    } catch (e) { return null; }
}

export async function getDesignPDFBlob() {
    // 저장 시에도 대지 기준 좌표 계산 (필요시)
    const board = canvas.getObjects().find(o => o.isBoard);
    let x=0, y=0, w=canvas.width, h=canvas.height;
    if(board) {
        x = board.left; y = board.top;
        w = board.width * board.scaleX; h = board.height * board.scaleY;
    }
    return generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth']), w, h, x, y);
}

// ==========================================================
// [4] 작업지시서 생성
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF 라이브러리 로딩 중...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    if (window.loadKoreanFontForPDF) {
        await window.loadKoreanFontForPDF(doc);
    } 
    doc.setFont('NanumGothic');

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (i > 0) doc.addPage();
        
        // 1. 헤더
        doc.setFillColor(99, 102, 241); 
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("NanumGothic", "bold");
        doc.text("작업 지시서 (Work Order)", 105, 13, { align: 'center' });

        // 2. 주문 정보
        const startY = 30;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("NanumGothic", "normal");
        
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.rect(15, startY, 135, 40, 'F'); 
        doc.rect(15, startY, 135, 40);      

        doc.text(`주문일자: ${new Date().toLocaleDateString()}`, 20, startY + 8);
        doc.text(`담당자명: ${orderInfo.manager || '-'}`, 80, startY + 8);
        
        doc.setFont("NanumGothic", "bold");
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(14);
        doc.text(`도착희망일: ${orderInfo.date || '-'}`, 20, startY + 16);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("NanumGothic", "normal");
        
        doc.text(`연락처: ${orderInfo.phone || '-'}`, 80, startY + 16);
        doc.text(`배송주소: ${orderInfo.address || '-'}`, 20, startY + 24);
        doc.text(`요청사항: ${orderInfo.note || '-'}`, 20, startY + 32, { maxWidth: 125 });

        // QR
        let qrOptionText = "";
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code];
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                if(add) qrOptionText += `${add.name}(${aq}) `;
            });
        }
        const qrContent = `[주문] ${orderInfo.manager}\n${orderInfo.phone}\n${orderInfo.address}\n제품:${item.product.name}\n옵션:${qrOptionText}`;
        try {
            const qrData = await generateQRCodeUrl(qrContent);
            if (qrData) {
                doc.addImage(qrData, 'PNG', 155, startY, 40, 40);
                doc.setDrawColor(200);
                doc.rect(155, startY, 40, 40);
            }
        } catch(e) {}

        // 책임자
        const staffY = startY + 45;
        doc.setFillColor(255, 247, 237);
        doc.setDrawColor(249, 115, 22);
        doc.rect(15, staffY, 180, 20, 'F');
        doc.rect(15, staffY, 180, 20);

        const driverImgUrl = "https://cdn-icons-png.flaticon.com/512/6009/6009864.png"; 
        try {
            const driverData = await getSafeImageDataUrl(driverImgUrl);
            if(driverData) doc.addImage(driverData, 'PNG', 20, staffY + 2, 16, 16);
        } catch(e) {}

        doc.setTextColor(194, 65, 12);
        doc.setFont("NanumGothic", "bold");
        doc.setFontSize(11);
        doc.text("배송책임자 : 서용규 (010-8272-3017)", 42, staffY + 11);
        doc.text("|", 105, staffY + 11, {align:'center'});
        doc.text("제작책임자 : 변지웅 (010-5512-5366)", 115, staffY + 11);

        // 상품 정보
        let y = staffY + 30;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.text(`[상품 ${i + 1}] ${item.product.name}`, 15, y);
        
        y += 10;
        doc.setFontSize(11);
        doc.setFont("NanumGothic", "normal");
        
        if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            const arr = Object.values(item.selectedAddons);
            for (const code of arr) {
                const add = ADDON_DB[code];
                if (!add) continue;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                doc.setDrawColor(0); doc.setLineWidth(0.3);
                doc.rect(15, y, 5, 5); 
                doc.setFillColor(255, 255, 255);
                doc.rect(23, y, 120, 8, 'F'); doc.rect(23, y, 120, 8);
                doc.text(` ${add.name}`, 25, y + 5.5);
                doc.rect(145, y, 20, 8);
                doc.text(`${qty}개`, 155, y + 5.5, { align: 'center' });
                y += 10;
            }
        } else {
            doc.text("- 옵션 없음 (기본 사양)", 15, y + 5);
            y += 10;
        }
        
        y += 5;
        doc.setFontSize(14);
        doc.setFont("NanumGothic", "bold");
        doc.setTextColor(99, 102, 241); 
        doc.text(`총 본품 수량: ${item.qty}개`, 160, y);

        // 이미지
        y += 10;
        const boxSize = 130;
        const boxX = (210 - boxSize) / 2;
        doc.setDrawColor(200); doc.setLineWidth(0.5);
        doc.rect(boxX, y, boxSize, boxSize);

        let imgData = null;
        let isPdf = false;
        if (item.mimeType === 'application/pdf' || (item.fileName && item.fileName.toLowerCase().endsWith('.pdf'))) {
            isPdf = true;
        }

        if (item.thumb && item.thumb.startsWith('data:image')) {
            imgData = item.thumb;
        } else if (item.thumb) {
            imgData = await getSafeImageDataUrl(item.thumb);
        } else if (item.originalUrl) {
            if (isPdf) {
                imgData = await pdfUrlToImageData(item.originalUrl);
            } else {
                imgData = await getSafeImageDataUrl(item.originalUrl);
            }
        }

        if (imgData) {
            try {
                let format = 'PNG';
                if (imgData.startsWith('data:image/jpeg') || imgData.startsWith('data:image/jpg')) {
                    format = 'JPEG';
                }
                const imgProps = doc.getImageProperties(imgData);
                const maxW = boxSize - 2; const maxH = boxSize - 2;
                let w = maxW; let h = (imgProps.height * w) / imgProps.width;
                if (h > maxH) { h = maxH; w = (imgProps.width * h) / imgProps.height; }
                const x = boxX + (boxSize - w) / 2; const imgY = y + 1 + (boxSize - h) / 2;
                doc.addImage(imgData, format, x, imgY, w, h);
            } catch (err) {
                doc.setFontSize(10); doc.setTextColor(150); 
                doc.text("이미지 처리 실패", 105, y + 60, { align: 'center' });
            }
        } else {
            doc.setFontSize(10); doc.setTextColor(150); 
            doc.text(isPdf ? "PDF 변환 실패" : "이미지 없음", 105, y + 60, { align: 'center' });
        }
        
        doc.setFontSize(9); doc.setTextColor(150);
        doc.text("Generated by Chameleon Design Studio", 105, 285, { align: 'center' });
    }
    return doc.output('blob');
}

// ==========================================================
// [5] 견적서 생성
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    if (window.loadKoreanFontForPDF) {
        await window.loadKoreanFontForPDF(doc);
    }
    doc.setFont('NanumGothic');

    const margin = 15;
    doc.setFontSize(26); doc.setFont("NanumGothic", "bold");
    doc.text("견  적  서", 105, 25, { align: 'center' });
    doc.setLineWidth(0.5); doc.line(margin, 32, 210 - margin, 32);

    const y = 40;
    doc.setFontSize(11); doc.setFont("NanumGothic", "normal");
    doc.text(`수신: ${orderInfo.manager} 귀하`, margin, y);
    doc.text(`날짜: ${new Date().toLocaleDateString()}`, margin, y + 8);
    const totalEl = document.getElementById("summaryTotal");
    const totalStr = totalEl ? totalEl.innerText : "0원";
    doc.text(`합계금액: ${totalStr} (VAT포함)`, margin, y + 20);

    const bx = 105; const by = 35;
    doc.setDrawColor(100); doc.rect(bx, by, 90, 45); 
    doc.setFontSize(10);
    doc.text("등록번호: 470-81-02808", bx + 5, by + 8);
    doc.text("상호: 카멜레온 디자인", bx + 5, by + 16);
    doc.text("대표: 조재호", bx + 50, by + 16);
    doc.text("주소: 경기도 화성시 우정읍 한말길 72-2", bx + 5, by + 24);
    doc.text("담당: 변지웅 부사장 (010-5512-5366)", bx + 5, by + 32);

    const STAMP_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/design/dojang.png';
    try { 
        const stampData = await getSafeImageDataUrl(STAMP_URL); 
        if (stampData) doc.addImage(stampData, 'PNG', bx + 68, by + 11, 15, 15); 
    } catch (e) { 
        doc.setTextColor(255,0,0); doc.setDrawColor(255,0,0); 
        doc.circle(bx + 75, by + 15, 4); doc.setFontSize(8); doc.text("인", bx + 73.5, by + 16.5); 
    }
    doc.setTextColor(0); doc.setDrawColor(0); 

    let tableY = 90;
    doc.setFillColor(230, 230, 230); doc.rect(margin, tableY, 180, 10, 'F');
    doc.setFont("NanumGothic", "bold"); doc.setFontSize(10); 
    doc.text("품목 및 내역", margin + 5, tableY + 7);
    doc.text("수량", 130, tableY + 7);
    doc.text("단가", 150, tableY + 7);
    doc.text("금액", 190, tableY + 7, { align: 'right' });

    tableY += 10;
    let total = 0;
    doc.setFont("NanumGothic", "normal");
    
    cartItems.forEach((item) => {
        let itemPrice = item.product.price;
        let optionPrice = 0;
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const addon = ADDON_DB[code];
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                if (addon) optionPrice += addon.price * qty;
            });
        }
        const unitPrice = itemPrice + optionPrice;
        const lineTotal = unitPrice * item.qty;
        total += lineTotal;

        doc.setFont("NanumGothic", "bold");
        doc.text(item.product.name, margin + 5, tableY + 6);
        doc.setFont("NanumGothic", "normal");
        doc.setFontSize(9);
        doc.text(`(기본: ${itemPrice.toLocaleString()} + 옵션: ${optionPrice.toLocaleString()})`, margin + 5, tableY + 11);
        doc.setFontSize(10);
        doc.text(`${item.qty}`, 130, tableY + 6);
        doc.text(unitPrice.toLocaleString(), 150, tableY + 6);
        doc.text(lineTotal.toLocaleString(), 190, tableY + 6, { align: 'right' });
        doc.setDrawColor(220);
        doc.line(margin, tableY + 14, 210 - margin, tableY + 14);
        tableY += 15; 
    });

    tableY += 5;
    doc.setFontSize(12); doc.setFont("NanumGothic", "bold");
    doc.text(`총 합계: ${total.toLocaleString()} 원 (VAT 포함)`, 190, tableY, { align: 'right' });
    return doc.output('blob');
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}