// export.js

import { canvas } from "./canvas-core.js";
import { ADDON_DB, getUserLogoCount, currentUser } from "./config.js"; 
import { FONT_URLS } from "./fonts.js"; 

// ==========================================================
// [1] 내보내기 도구 초기화
// ==========================================================
export function initExport() {
    // 1. SVG 다운로드
    const btnSVG = document.getElementById("btnDownloadSVG");
    if (btnSVG) {
        btnSVG.onclick = () => {
            const w = canvas.width; const h = canvas.height;
            const svgData = canvas.toSVG({ viewBox: { x: 0, y: 0, width: w, height: h }, width: w, height: h });
            downloadFile(URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" })), "design.svg");
        };
    }

    // 2. PNG 다운로드
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
            btn.innerText = "Check...";
            const count = await getUserLogoCount();
            btn.innerText = originText;

            if (count < 5) {
                alert(`🔒 [멤버십 제한]\n로고를 5개 이상 공유해주시면 PNG 다운로드가 가능합니다.\n(현재 내 공유 로고: ${count}개)`);
                const uploadModal = document.getElementById('logoUploadModal');
                if(uploadModal) uploadModal.style.display='flex';
                return;
            }
            downloadImage();
        };
    }

    // 3. PDF 다운로드
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
            btn.innerText = "Converting...";

            const count = await getUserLogoCount();
            if (count < 10) {
                btn.innerText = originalText;
                alert(`🔒 [VIP 제한]\n로고를 10개 이상 공유해주시면 고화질 PDF(벡터) 다운로드가 가능합니다.\n(현재 내 공유 로고: ${count}개)`);
                const uploadModal = document.getElementById('logoUploadModal');
                if(uploadModal) uploadModal.style.display='flex';
                return;
            }

            btn.disabled = true;
            
            // 대지(Board) 좌표 계산
            const board = canvas.getObjects().find(o => o.isBoard);
            let x = 0; let y = 0; let w = canvas.width; let h = canvas.height;
            if (board) {
                x = board.left; y = board.top;
                w = board.width * board.scaleX; h = board.height * board.scaleY;
            }
            
            let blob = await generateProductVectorPDF(canvas.toJSON(), w, h, x, y);
            if (!blob) {
                console.warn("벡터 변환 실패, 이미지 방식으로 재시도합니다.");
                blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
            }

            if(blob) downloadFile(URL.createObjectURL(blob), "design.pdf");
            else alert("PDF 생성에 실패했습니다.");
            
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
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    const board = canvas.getObjects().find(o => o.isBoard);

    try {
        let dataURL = "";
        if (board) {
            dataURL = canvas.toDataURL({
                format: 'png', quality: 1, multiplier: 2,
                left: board.left, top: board.top,
                width: board.width * board.scaleX, height: board.height * board.scaleY
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
// [3] PDF 생성 유틸리티
// ==========================================================
const ALL_FONTS = {
    ...FONT_URLS,
    "NanumGothic": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
    "NotoSansJP": "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP-Regular.ttf"
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
    } catch (err) { return null; }
}

// 이미지 URL -> Base64
async function getSafeImageDataUrl(urlOrData) {
    if (!urlOrData) return null;
    if (urlOrData.startsWith('data:image')) return urlOrData;
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; 
        img.src = urlOrData;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try { resolve(canvas.toDataURL('image/png')); } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
    });
}

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
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) { return null; }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// [핵심] PDF용 폰트 로드
async function loadPdfFonts(doc) {
    const fontsToLoad = [
        { name: 'NanumGothic', url: ALL_FONTS['NanumGothic'] },
        { name: 'NotoSansJP', url: ALL_FONTS['NotoSansJP'] }
    ];

    const promises = fontsToLoad.map(async (font) => {
        if (doc.existsFileInVFS(font.name + ".ttf")) return; 
        
        try {
            const res = await fetch(font.url);
            if (!res.ok) throw new Error(`Failed to load ${font.name}`);
            const buffer = await res.arrayBuffer();
            const base64String = arrayBufferToBase64(buffer);
            
            doc.addFileToVFS(font.name + ".ttf", base64String);
            doc.addFont(font.name + ".ttf", font.name, "normal");
            doc.addFont(font.name + ".ttf", font.name, "bold"); 
        } catch (e) {
            console.error(`폰트 로드 실패 (${font.name}):`, e);
        }
    });
    await Promise.all(promises);
}

// [핵심 해결책] 텍스트별 폰트 자동 적용 출력 함수
function drawAutoText(doc, text, x, y, options = {}) {
    if (!text) return;
    text = String(text);

    // 일본어 포함 시 NotoSansJP, 그 외 NanumGothic
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const fontName = hasJapanese ? "NotoSansJP" : "NanumGothic";
    
    // 현재 폰트 저장
    const originalFont = doc.getFont().fontName; 
    
    doc.setFont(fontName);
    doc.text(text, x, y, options);
    
    // 폰트 복구
    doc.setFont(originalFont);
}

// ----------------------------------------------------------
// 벡터 PDF 생성 (디자인)
// ----------------------------------------------------------
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf || !window.opentype) return null;
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX;
        const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(canvas ? canvas.width : w + x);
        tempCvs.setHeight(canvas ? canvas.height : h + y);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }

        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

        const rawObjects = tempCvs.getObjects();
        for (let i = rawObjects.length - 1; i >= 0; i--) {
            const obj = rawObjects[i];
            if (obj.type === 'group' || obj.isOutlineGroup) {
                const items = obj.getObjects();
                obj._restoreObjectsState(); 
                tempCvs.remove(obj);
                items.forEach(item => { tempCvs.add(item); item.set('dirty', true); });
            }
        }
        tempCvs.renderAll();

        const allObjects = [...tempCvs.getObjects()];
        const usedFonts = new Set();
        usedFonts.add('NanumGothic'); 
        allObjects.forEach(obj => {
            if (obj.type.includes('text') && obj.fontFamily) usedFonts.add(obj.fontFamily);
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

        for (const obj of allObjects) {
            if (obj.type.includes('text') && obj.text && obj.text.trim().length > 0) {
                const newPathObj = await createPathFromText(obj);
                if (newPathObj) {
                    newPathObj.set({
                        left: obj.left, top: obj.top, 
                        scaleX: obj.scaleX, scaleY: obj.scaleY,
                        angle: obj.angle, originX: obj.originX, originY: obj.originY,
                        opacity: obj.opacity, skewX: obj.skewX, skewY: obj.skewY
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
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        const svgStr = tempCvs.toSVG({ viewBox: { x: x, y: y, width: w, height: h }, width: w, height: h, suppressPreamble: true });
        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
        return doc.output('blob');
    } catch (e) {
        console.error("벡터 PDF 생성 실패:", e);
        return null;
    }
}

// 래스터 PDF 생성
export async function generateRasterPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX;
        const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(canvas ? canvas.width : w + x);
        tempCvs.setHeight(canvas ? canvas.height : h + y);

        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard);
        }
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        if (!tempCvs.backgroundColor) tempCvs.setBackgroundColor('#ffffff', tempCvs.renderAll.bind(tempCvs));
        tempCvs.renderAll();

        const imgData = tempCvs.toDataURL({ 
            format: 'jpeg', quality: 0.9, multiplier: 2,
            left: x, top: y, width: w, height: h
        });
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
        return doc.output('blob');
    } catch (e) { return null; }
}

async function createPathFromText(textObj) {
    const rawName = textObj.fontFamily;
    const normKey = getNormalizedKey(rawName);
    let buffer = fontBufferCache[rawName] || fontBufferCache[normKey] || fontBufferCache[rawName.replace(/\s/g, '')];
    if (!buffer) buffer = fontBufferCache['NanumGothic'] || fontBufferCache[getNormalizedKey('NanumGothic')];
    if (!buffer) return null; 

    try {
        const font = window.opentype.parse(buffer);
        const text = textObj.text;
        const fontSize = textObj.fontSize;
        const lines = text.split('\n');
        const lineHeight = (textObj.lineHeight || 1.16) * fontSize;
        const baselineOffset = fontSize * 0.8; 
        let pathData = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const path = font.getPath(line, 0, (i * lineHeight) + baselineOffset, fontSize);
            pathData += path.toPathData(2) + " ";
        }

        return new fabric.Path(pathData, {
            fill: textObj.fill, stroke: textObj.stroke, strokeWidth: textObj.strokeWidth,
            strokeLineJoin: textObj.strokeLineJoin, strokeLineCap: textObj.strokeLineCap,
            opacity: textObj.opacity, objectCaching: false
        });
    } catch (e) { return null; }
}

export async function getDesignPDFBlob() {
    const board = canvas.getObjects().find(o => o.isBoard);
    let x=0, y=0, w=canvas.width, h=canvas.height;
    if(board) {
        x = board.left; y = board.top;
        w = board.width * board.scaleX; h = board.height * board.scaleY;
    }
    return generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth']), w, h, x, y);
}

// ==========================================================
// [4] 작업지시서 생성 (완벽한 다국어 처리)
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF Loading...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // 1. 번역 데이터 가져오기
    const t = window.translations || {};

    // 2. 폰트 로드
    await loadPdfFonts(doc);

    // 기본 폰트 설정 (언어별 분기)
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || 'kr';
    const baseFont = (lang === 'jp') ? "NotoSansJP" : "NanumGothic"; 
    doc.setFont(baseFont);

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (i > 0) doc.addPage();
        
        // 헤더
        doc.setFillColor(99, 102, 241); 
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont(baseFont, "bold");
        
        // "작업지시서" 타이틀 번역
        drawAutoText(doc, t['pdf_order_sheet_title'] || "작업 지시서", 105, 13, { align: 'center' });

        // 주문 정보
        const startY = 30;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(baseFont, "normal");
        
        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.rect(15, startY, 135, 40, 'F'); doc.rect(15, startY, 135, 40);      

        const lblDate = t['pdf_date'] || "주문일자";
        const lblManager = t['pdf_manager'] || "담당자명";
        const lblDelDate = t['pdf_delivery_date'] || "도착희망일";
        const lblContact = t['pdf_contact'] || "연락처";
        const lblAddr = t['pdf_shipping_addr'] || "배송주소";
        const lblNote = t['pdf_request_memo'] || "요청사항";

        doc.text(`${lblDate}: ${new Date().toLocaleDateString()}`, 20, startY + 8);
        
        doc.text(`${lblManager}: `, 80, startY + 8);
        drawAutoText(doc, orderInfo.manager || '-', 95, startY + 8); // 담당자명 (일본어/영어 가능)
        
        doc.setFont(baseFont, "bold");
        doc.setTextColor(220, 38, 38);
        doc.setFontSize(14);
        doc.text(`${lblDelDate}: ${orderInfo.date || '-'}`, 20, startY + 16);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(baseFont, "normal");
        
        doc.text(`${lblContact}: ${orderInfo.phone || '-'}`, 80, startY + 16);
        
        doc.text(`${lblAddr}: `, 20, startY + 24);
        drawAutoText(doc, orderInfo.address || '-', 38, startY + 24); // 주소 (다국어)

        doc.text(`${lblNote}: `, 20, startY + 32);
        drawAutoText(doc, orderInfo.note || '-', 38, startY + 32, { maxWidth: 100 }); // 요청사항 (다국어)

        // QR
        let qrOptionText = "";
        if(item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code];
                const aq = (item.addonQuantities && item.addonQuantities[code]) || 1;
                if(add) qrOptionText += `${add.name}(${aq}) `;
            });
        }
        const qrContent = `[ORDER] ${orderInfo.manager}\n${orderInfo.phone}\n${orderInfo.address}\nITEM:${item.product.name}\nOPT:${qrOptionText}`;
        try {
            const qrData = await generateQRCodeUrl(qrContent);
            if (qrData) {
                doc.addImage(qrData, 'PNG', 155, startY, 40, 40);
                doc.setDrawColor(200);
                doc.rect(155, startY, 40, 40);
            }
        } catch(e) {}

        // 책임자 박스
        const staffY = startY + 45;
        doc.setFillColor(255, 247, 237);
        doc.setDrawColor(249, 115, 22);
        doc.rect(15, staffY, 180, 20, 'F'); doc.rect(15, staffY, 180, 20);

        doc.setTextColor(194, 65, 12);
        doc.setFont(baseFont, "bold");
        doc.setFontSize(11);
        
        const lblDelMgr = t['pdf_delivery_manager'] || "배송책임자";
        const lblProdMgr = t['pdf_production_manager'] || "제작책임자";

        // 책임자 이름은 고정 (한국인 스태프)
        drawAutoText(doc, `${lblDelMgr} : 서용규 (010-8272-3017)`, 42, staffY + 11);
        doc.text("|", 105, staffY + 11, {align:'center'});
        drawAutoText(doc, `${lblProdMgr} : 변지웅 (010-5512-5366)`, 115, staffY + 11);

        // 상품 정보
        let y = staffY + 30;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        
        const lblProd = t['pdf_product_label'] || "[상품";
        doc.text(`${lblProd} ${i + 1}] `, 15, y);
        drawAutoText(doc, item.product.name, 40, y); // 상품명 (다국어)
        
        y += 10;
        doc.setFontSize(11);
        doc.setFont(baseFont, "normal");
        
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
                
                // 옵션명 (다국어)
                drawAutoText(doc, ` ${add.name}`, 25, y + 5.5);
                
                doc.rect(145, y, 20, 8);
                doc.text(`${qty}`, 155, y + 5.5, { align: 'center' });
                y += 10;
            }
        } else {
            const lblNone = t['pdf_option_none'] || "- 옵션 없음";
            doc.text(lblNone, 15, y + 5);
            y += 10;
        }
        
        y += 5;
        doc.setFontSize(14);
        doc.setFont(baseFont, "bold");
        doc.setTextColor(99, 102, 241); 
        
        const lblTotalQty = t['pdf_total_qty'] || "총 수량";
        doc.text(`${lblTotalQty}: ${item.qty}`, 160, y);

        // 이미지
        y += 10;
        const boxSize = 130;
        const boxX = (210 - boxSize) / 2;
        doc.setDrawColor(200); doc.setLineWidth(0.5);
        doc.rect(boxX, y, boxSize, boxSize);

        let imgData = null;
        let isPdf = false;
        if (item.mimeType === 'application/pdf' || (item.fileName && item.fileName.toLowerCase().endsWith('.pdf'))) isPdf = true;

        if (item.thumb && item.thumb.startsWith('data:image')) imgData = item.thumb;
        else if (item.thumb) imgData = await getSafeImageDataUrl(item.thumb);
        else if (item.originalUrl) {
            if (isPdf) imgData = await pdfUrlToImageData(item.originalUrl);
            else imgData = await getSafeImageDataUrl(item.originalUrl);
        }

        if (imgData) {
            try {
                let format = 'PNG';
                if (imgData.startsWith('data:image/jpeg') || imgData.startsWith('data:image/jpg')) format = 'JPEG';
                const imgProps = doc.getImageProperties(imgData);
                const maxW = boxSize - 2; const maxH = boxSize - 2;
                let w = maxW; let h = (imgProps.height * w) / imgProps.width;
                if (h > maxH) { h = maxH; w = (imgProps.width * h) / imgProps.height; }
                const x = boxX + (boxSize - w) / 2; const imgY = y + 1 + (boxSize - h) / 2;
                doc.addImage(imgData, format, x, imgY, w, h);
            } catch (err) {
                doc.setFontSize(10); doc.setTextColor(150); 
                doc.text("Image Error", 105, y + 60, { align: 'center' });
            }
        } else {
            doc.setFontSize(10); doc.setTextColor(150); 
            doc.text("No Image", 105, y + 60, { align: 'center' });
        }
        
        doc.setFontSize(9); doc.setTextColor(150);
        doc.text(t['pdf_generated_by'] || "Generated by Chameleon", 105, 285, { align: 'center' });
    }
    return doc.output('blob');
}

// ==========================================================
// [5] 견적서 생성 (완벽한 다국어 처리)
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    const t = window.translations || {};

    await loadPdfFonts(doc);

    // 기본 폰트 설정
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || 'kr';
    const baseFont = (lang === 'jp') ? "NotoSansJP" : "NanumGothic"; 
    doc.setFont(baseFont);

    const margin = 15;
    doc.setFontSize(26); doc.setFont(baseFont, "bold");
    
    // "견적서" 타이틀 번역
    drawAutoText(doc, t['pdf_quote_title'] || "견 적 서", 105, 25, { align: 'center' });
    
    doc.setLineWidth(0.5); doc.line(margin, 32, 210 - margin, 32);

    const y = 40;
    doc.setFontSize(11); doc.setFont(baseFont, "normal");
    
    const lblTo = t['pdf_receiver'] || "수신";
    doc.text(`${lblTo}: `, margin, y);
    drawAutoText(doc, `${orderInfo.manager}`, margin + 15, y); // 수신자명
    
    const lblDate = t['pdf_date'] || "날짜";
    doc.text(`${lblDate}: ${new Date().toLocaleDateString()}`, margin, y + 8);

    const totalEl = document.getElementById("summaryTotal");
    const totalStr = totalEl ? totalEl.innerText : "0";
    const lblTotalAmt = t['pdf_total_amount'] || "합계금액";
    const lblVat = t['pdf_vat_include'] || "(VAT포함)";
    
    doc.text(`${lblTotalAmt}: ${totalStr} ${lblVat}`, margin, y + 20);

    // 공급자 정보 박스
    const bx = 105; const by = 35;
    doc.setDrawColor(100); doc.rect(bx, by, 90, 45); 
    doc.setFontSize(10);
    
    const lblBizNum = t['pdf_biz_num'] || "등록번호";
    const lblComp = t['pdf_company_name'] || "상호";
    const lblCeo = t['pdf_ceo'] || "대표";
    const lblAddr = t['pdf_addr'] || "주소";
    const lblContact = t['pdf_contact'] || "담당";

    // 공급자 정보는 고정값 (회사 정보는 항상 한국어/영어 병기 혹은 고정)
    // 필요하다면 t['footer_company_value'] 등을 사용해도 됨
    doc.text(`${lblBizNum}: 470-81-02808`, bx + 5, by + 8);
    drawAutoText(doc, `${lblComp}: ${t['footer_company_value'] || '(주)카멜레온프린팅'}`, bx + 5, by + 16);
    drawAutoText(doc, `${lblCeo}: ${t['footer_ceo_value'] || '조재호'}`, bx + 50, by + 16);
    drawAutoText(doc, `${lblAddr}: ${t['footer_addr_value'] || '화성시 우정읍...'}`, bx + 5, by + 24, { maxWidth: 80 });
    doc.text(`${lblContact}: 010-5512-5366`, bx + 5, by + 32);

    const STAMP_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/design/dojang.png';
    try { 
        const stampData = await getSafeImageDataUrl(STAMP_URL); 
        if (stampData) doc.addImage(stampData, 'PNG', bx + 68, by + 11, 15, 15); 
    } catch (e) {}
    doc.setTextColor(0); doc.setDrawColor(0); 

    let tableY = 90;
    doc.setFillColor(230, 230, 230); doc.rect(margin, tableY, 180, 10, 'F');
    doc.setFont(baseFont, "bold"); doc.setFontSize(10); 
    
    // 테이블 헤더 번역
    const thItem = t['pdf_table_item'] || "품목";
    const thQty = t['pdf_table_qty'] || "수량";
    const thPrice = t['pdf_table_price'] || "단가";
    const thAmt = t['pdf_table_amount'] || "금액";

    doc.text(thItem, margin + 5, tableY + 7);
    doc.text(thQty, 130, tableY + 7);
    doc.text(thPrice, 150, tableY + 7);
    doc.text(thAmt, 190, tableY + 7, { align: 'right' });

    tableY += 10;
    let total = 0;
    doc.setFont(baseFont, "normal");
    
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

        doc.setFont(baseFont, "bold");
        // 상품명 자동 폰트 (다국어)
        drawAutoText(doc, item.product.name, margin + 5, tableY + 6);
        
        doc.setFont(baseFont, "normal");
        doc.setFontSize(9);
        doc.text(`(Base: ${itemPrice.toLocaleString()} + Opt: ${optionPrice.toLocaleString()})`, margin + 5, tableY + 11);
        doc.setFontSize(10);
        doc.text(`${item.qty}`, 130, tableY + 6);
        doc.text(unitPrice.toLocaleString(), 150, tableY + 6);
        doc.text(lineTotal.toLocaleString(), 190, tableY + 6, { align: 'right' });
        doc.setDrawColor(220);
        doc.line(margin, tableY + 14, 210 - margin, tableY + 14);
        tableY += 15; 
    });

    tableY += 5;
    doc.setFontSize(12); doc.setFont(baseFont, "bold");
    
    const lblGrandTotal = t['pdf_total_sum'] || "총 합계";
    doc.text(`${lblGrandTotal}: ${total.toLocaleString()} ${lblVat}`, 190, tableY, { align: 'right' });
    
    return doc.output('blob');
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}