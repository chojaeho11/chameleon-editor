// export.js (전체 덮어쓰기)

import { canvas } from "./canvas-core.js";
import { ADDON_DB, getUserLogoCount, currentUser } from "./config.js"; 
import { FONT_URLS, FONT_ALIASES } from "./fonts.js"; 

// ★ 수파베이스 스토리지에 업로드된 폰트명과 정확히 일치해야 합니다.
const BASE_FONT_NAME = "HyundaiSansRegular";

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
                const loginModal = document.getElementById('loginModal');
                if(loginModal) loginModal.style.display='flex';
                return;
            }
            downloadImage();
        };
    }

    // 3. PDF 다운로드 (고객용 버튼)
    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            if (!currentUser) {
                alert("로그인이 필요한 서비스입니다.");
                const loginModal = document.getElementById('loginModal');
                if(loginModal) loginModal.style.display='flex';
                return;
            }

            const btn = btnPDF;
            const originalText = btn.innerText;
            btn.innerText = "Processing...";
            btn.disabled = true;

            const board = canvas.getObjects().find(o => o.isBoard);
            let x = 0; let y = 0; let w = canvas.width; let h = canvas.height;
            if (board) {
                x = board.left; y = board.top;
                w = board.width * board.scaleX; h = board.height * board.scaleY;
            }
            
            try {
                // 1차 시도: 벡터 PDF (폰트 필요, 실패 가능성 있음)
                console.log("Attempting Vector PDF...");
                let blob = await generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth','charSpacing','lineHeight','textBackgroundColor']), w, h, x, y);
                
                if(blob) {
                    downloadFile(URL.createObjectURL(blob), "design.pdf");
                } else {
                    throw new Error("Vector generation returned null");
                }

            } catch (err) {
                console.warn("벡터 PDF 생성 실패, 이미지 PDF로 전환합니다:", err);
                
                // 2차 시도: 이미지 PDF (폰트 불필요, 안전함)
                try {
                    let blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_image.pdf");
                    else alert("PDF 생성에 실패했습니다. 관리자에게 문의해주세요.");
                } catch (e2) {
                    console.error("Raster PDF failed:", e2);
                    alert("PDF 변환 오류 발생");
                }
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
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
    } finally {
        canvas.setViewportTransform(originalVpt);
        canvas.requestRenderAll();
    }
}

// ==========================================================
// [3] PDF 유틸리티 & 폰트 매니저
// ==========================================================
const fontBufferCache = {};

function getNormalizedKey(name) {
    if (!name) return "";
    return name.toLowerCase().replace(/['"\s-]/g, ''); 
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
    return window.btoa(binary);
}

// 기본 폰트 로드 (에러 방지용)
async function ensureDefaultFontLoaded() {
    if (!fontBufferCache[BASE_FONT_NAME]) {
        try {
            const url = FONT_URLS[BASE_FONT_NAME];
            if (!url) {
                console.warn(`Base font URL for ${BASE_FONT_NAME} not defined in fonts.js`);
                return;
            }
            const res = await fetch(url);
            if (res.ok) {
                fontBufferCache[BASE_FONT_NAME] = await res.arrayBuffer();
            }
        } catch (e) {
            console.error("Failed to load base font:", e);
        }
    }
}

async function loadPdfFonts(doc) {
    // 1. 모든 폰트 로드 시도
    const fontPromises = Object.keys(FONT_URLS).map(async (key) => {
        const fileName = key + ".ttf"; 
        if (doc.existsFileInVFS(fileName)) return;

        try {
            let buffer = fontBufferCache[key];
            if (!buffer) {
                const res = await fetch(FONT_URLS[key]);
                if (!res.ok) throw new Error(`Fetch failed`);
                buffer = await res.arrayBuffer();
                fontBufferCache[key] = buffer;
            }
            const base64String = arrayBufferToBase64(buffer);
            doc.addFileToVFS(fileName, base64String);
            doc.addFont(fileName, key, "normal");
        } catch (e) {}
    });

    // 2. 기본 폰트 확실히 로드
    fontPromises.push((async () => {
        await ensureDefaultFontLoaded();
        if (fontBufferCache[BASE_FONT_NAME] && !doc.existsFileInVFS(BASE_FONT_NAME + ".ttf")) {
            const b64 = arrayBufferToBase64(fontBufferCache[BASE_FONT_NAME]);
            doc.addFileToVFS(BASE_FONT_NAME + ".ttf", b64);
            doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "normal");
        }
    })());

    await Promise.all(fontPromises);
}

// ----------------------------------------------------------
// 텍스트 -> 패스 변환 (여기가 '아웃라인' 만드는 핵심 함수)
// ----------------------------------------------------------
async function createPathFromText(textObj) {
    if (!window.opentype) return null;

    const rawName = textObj.fontFamily; 
    let targetKey = rawName;

    if (FONT_ALIASES && FONT_ALIASES[rawName]) {
        targetKey = FONT_ALIASES[rawName];
    }

    const normKey = getNormalizedKey(targetKey);
    let buffer = null;
    
    // 폰트 매칭
    if (fontBufferCache[targetKey]) buffer = fontBufferCache[targetKey];
    else if (fontBufferCache[rawName]) buffer = fontBufferCache[rawName];
    else {
        const foundKey = Object.keys(FONT_URLS).find(k => getNormalizedKey(k) === normKey);
        if(foundKey) buffer = fontBufferCache[foundKey];
    }

    // [중요] 해당 폰트가 없으면 기본 폰트로 대체 (에러 방지)
    if (!buffer) {
        console.warn(`Font '${rawName}' not found. Using Base Font.`);
        buffer = fontBufferCache[BASE_FONT_NAME];
    }

    // 기본 폰트조차 로드 안 됐으면 null 반환 (여기서 멈추지 않음)
    if (!buffer) return null; 

    try {
        const font = window.opentype.parse(buffer); // 폰트 파일 파싱
        const text = textObj.text || "";
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

        const pathObj = new fabric.Path(pathData, {
            fill: textObj.fill, stroke: textObj.stroke, strokeWidth: textObj.strokeWidth,
            strokeLineJoin: textObj.strokeLineJoin, strokeLineCap: textObj.strokeLineCap,
            opacity: textObj.opacity, objectCaching: false,
            left: textObj.left, top: textObj.top,
            scaleX: textObj.scaleX, scaleY: textObj.scaleY,
            angle: textObj.angle, originX: textObj.originX, originY: textObj.originY
        });
        if (textObj.shadow) pathObj.shadow = textObj.shadow;
        return pathObj;
    } catch (e) { 
        console.error("Path conversion error:", e);
        return null; 
    }
}

// ----------------------------------------------------------
// ★ 벡터 PDF 생성 (실패 시 null 반환하여 이미지 방식으로 전환 유도)
// ----------------------------------------------------------
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf || !window.opentype) return null;
    
    try {
        await ensureDefaultFontLoaded();

        // 폰트 캐싱
        const fontPromises = Object.keys(FONT_URLS).map(async k => {
            if(!fontBufferCache[k]) {
                try {
                    const r = await fetch(FONT_URLS[k]);
                    if(r.ok) fontBufferCache[k] = await r.arrayBuffer();
                } catch(e){}
            }
        });
        await Promise.all(fontPromises);

        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX;
        const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(canvas ? canvas.width : w + x);
        tempCvs.setHeight(canvas ? canvas.height : h + y);

        if (json && json.objects) json.objects = json.objects.filter(o => !o.isBoard);
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

        // 그룹 해제 및 렌더링 준비
        const rawObjects = tempCvs.getObjects();
        for (let i = rawObjects.length - 1; i >= 0; i--) {
            const obj = rawObjects[i];
            if (obj.type === 'group' || obj.isOutlineGroup || obj.isEffectGroup) {
                const items = obj.getObjects();
                obj._restoreObjectsState(); 
                tempCvs.remove(obj);
                items.forEach(item => { tempCvs.add(item); item.set('dirty', true); item.setCoords(); });
            }
        }
        
        // 텍스트 -> 패스 변환 시도
        const allObjects = [...tempCvs.getObjects()];
        for (const obj of allObjects) {
            if ((obj.type === 'text' || obj.type === 'i-text') && obj.text && obj.text.trim().length > 0) {
                const newPathObj = await createPathFromText(obj);
                if (newPathObj) {
                    const idx = tempCvs.getObjects().indexOf(obj);
                    if (idx !== -1) { tempCvs.remove(obj); tempCvs.insertAt(newPathObj, idx); }
                } else {
                    // 변환 실패 시: 폰트가 없으면 jsPDF가 뻗을 수 있으므로 객체 제거
                    // (이미지 PDF 백업이 있으므로 과감하게 제거해도 안전)
                    console.warn("텍스트 변환 실패, 객체 제거:", obj.text);
                    tempCvs.remove(obj); 
                }
            }
        }
        
        tempCvs.renderAll();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        
        // ★ 여기서 에러가 많이 발생함 (폰트 없을 때)
        const svgStr = tempCvs.toSVG({ viewBox: { x: x, y: y, width: w, height: h }, width: w, height: h, suppressPreamble: true });
        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
        
        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
        
        return doc.output('blob');

    } catch (e) { 
        console.error("Vector PDF Generation Failed:", e);
        return null; // 실패 신호를 보냄 -> Raster로 전환
    }
}

// ----------------------------------------------------------
// 래스터 PDF (이미지 방식 - 가장 안전한 백업 수단)
// ----------------------------------------------------------
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
        if (json && json.objects) json.objects = json.objects.filter(o => !o.isBoard);
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        
        // 배경 투명하면 흰색으로
        if (!tempCvs.backgroundColor) tempCvs.setBackgroundColor('#ffffff', tempCvs.renderAll.bind(tempCvs));
        tempCvs.renderAll();

        // 고해상도 이미지 생성
        const imgData = tempCvs.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 2, left: x, top: y, width: w, height: h });
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
        
        return doc.output('blob');
    } catch (e) { 
        console.error("Raster PDF Failed:", e);
        return null; 
    }
}

// ----------------------------------------------------------
// 유틸리티 및 주문서 생성 (기존 유지 + 안전장치)
// ----------------------------------------------------------
function drawAutoText(doc, text, x, y, options = {}) {
    if (!text) return;
    text = String(text);
    const originalFont = doc.getFont().fontName; 
    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }
    doc.text(text, x, y, options);
    try { doc.setFont(originalFont); } catch(e) {}
}

async function generateQRCodeUrl(text) {
    if (typeof QRCode === 'undefined') return null;
    try { return await QRCode.toDataURL(text, { width: 150, margin: 1, errorCorrectionLevel: 'L' }); } catch (err) { return null; }
}

async function getSafeImageDataUrl(urlOrData) {
    if (!urlOrData) return null;
    if (urlOrData.startsWith('data:image')) return urlOrData;
    return new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = "Anonymous"; img.src = urlOrData;
        img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            try { resolve(canvas.toDataURL('image/png')); } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
    });
}

async function pdfUrlToImageData(url) {
    if (!window.pdfjsLib) return null;
    try {
        const loadingTask = window.pdfjsLib.getDocument(url); const pdf = await loadingTask.promise; const page = await pdf.getPage(1); 
        const viewport = page.getViewport({ scale: 1.5 }); const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise; return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) { return null; }
}

// 작업지시서 생성 (기존 로직 유지)
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF Loading...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const t = window.translations || {};

    await ensureDefaultFontLoaded();
    await loadPdfFonts(doc);

    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (i > 0) doc.addPage();
        
        doc.setFillColor(99, 102, 241); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(16); 
        try { doc.setFont(BASE_FONT_NAME, "bold"); } catch(e){}
        drawAutoText(doc, t['pdf_order_sheet_title'] || "작업 지시서", 105, 13, { align: 'center' });
        
        const startY = 30; doc.setTextColor(0); doc.setFontSize(10); 
        try { doc.setFont(BASE_FONT_NAME, "normal"); } catch(e){}
        doc.setDrawColor(200); doc.setFillColor(245, 247, 250); doc.rect(15, startY, 135, 40, 'F'); doc.rect(15, startY, 135, 40);      
        
        const lblDate = t['pdf_date'] || "주문일자"; const lblManager = t['pdf_manager'] || "담당자명"; const lblDelDate = t['pdf_delivery_date'] || "도착희망일";
        const lblContact = t['pdf_contact'] || "연락처"; const lblAddr = t['pdf_shipping_addr'] || "배송주소"; const lblNote = t['pdf_request_memo'] || "요청사항";

        doc.text(`${lblDate}: ${new Date().toLocaleDateString()}`, 20, startY + 8);
        doc.text(`${lblManager}: `, 80, startY + 8); drawAutoText(doc, orderInfo.manager || '-', 95, startY + 8); 
        
        try{ doc.setFont(BASE_FONT_NAME, "bold"); }catch(e){} 
        doc.setTextColor(220, 38, 38); doc.setFontSize(14);
        doc.text(`${lblDelDate}: ${orderInfo.date || '-'}`, 20, startY + 16);
        
        doc.setTextColor(0, 0, 0); doc.setFontSize(10); 
        try{ doc.setFont(BASE_FONT_NAME, "normal"); }catch(e){}
        doc.text(`${lblContact}: ${orderInfo.phone || '-'}`, 80, startY + 16);
        doc.text(`${lblAddr}: `, 20, startY + 24); drawAutoText(doc, orderInfo.address || '-', 38, startY + 24);
        doc.text(`${lblNote}: `, 20, startY + 32); drawAutoText(doc, orderInfo.note || '-', 38, startY + 32, { maxWidth: 100 });

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
            if (qrData) { doc.addImage(qrData, 'PNG', 155, startY, 40, 40); doc.setDrawColor(200); doc.rect(155, startY, 40, 40); }
        } catch(e) {}

        // Staff
        const staffY = startY + 45;
        doc.setFillColor(255, 247, 237); doc.setDrawColor(249, 115, 22); doc.rect(15, staffY, 180, 20, 'F'); doc.rect(15, staffY, 180, 20);
        doc.setTextColor(194, 65, 12); 
        try{ doc.setFont(BASE_FONT_NAME, "bold"); }catch(e){} 
        doc.setFontSize(11);
        const lblDelMgr = t['pdf_delivery_manager'] || "배송책임자"; const lblProdMgr = t['pdf_production_manager'] || "제작책임자";
        drawAutoText(doc, `${lblDelMgr} : 서용규 (010-8272-3017)`, 42, staffY + 11);
        doc.text("|", 105, staffY + 11, {align:'center'});
        drawAutoText(doc, `${lblProdMgr} : 변지웅 (010-5512-5366)`, 115, staffY + 11);

        // Product
        let y = staffY + 30;
        doc.setTextColor(0, 0, 0); doc.setFontSize(16);
        const lblProd = t['pdf_product_label'] || "[상품";
        doc.text(`${lblProd} ${i + 1}] `, 15, y);
        drawAutoText(doc, item.product.name, 40, y); 
        y += 10;
        doc.setFontSize(11); 
        try{ doc.setFont(BASE_FONT_NAME, "normal"); }catch(e){}
        
        if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            const arr = Object.values(item.selectedAddons);
            for (const code of arr) {
                const add = ADDON_DB[code];
                if (!add) continue;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, y, 5, 5); 
                doc.setFillColor(255, 255, 255); doc.rect(23, y, 120, 8, 'F'); doc.rect(23, y, 120, 8);
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
        
        y += 5; doc.setFontSize(14); 
        try{ doc.setFont(BASE_FONT_NAME, "bold"); }catch(e){}
        doc.setTextColor(99, 102, 241); 
        const lblTotalQty = t['pdf_total_qty'] || "총 수량";
        doc.text(`${lblTotalQty}: ${item.qty}`, 160, y);

        // Image
        y += 10; const boxSize = 130; const boxX = (210 - boxSize) / 2;
        doc.setDrawColor(200); doc.setLineWidth(0.5); doc.rect(boxX, y, boxSize, boxSize);

        let imgData = null; let isPdf = (item.mimeType === 'application/pdf' || (item.fileName && item.fileName.toLowerCase().endsWith('.pdf')));
        if (item.thumb && item.thumb.startsWith('data:image')) imgData = item.thumb;
        else if (item.thumb) imgData = await getSafeImageDataUrl(item.thumb);
        else if (item.originalUrl) {
            if (isPdf) imgData = await pdfUrlToImageData(item.originalUrl);
            else imgData = await getSafeImageDataUrl(item.originalUrl);
        }
        if (imgData) {
            try {
                let format = 'PNG'; if (imgData.startsWith('data:image/jpeg')) format = 'JPEG';
                const imgProps = doc.getImageProperties(imgData);
                const maxW = boxSize - 2; const maxH = boxSize - 2;
                let w = maxW; let h = (imgProps.height * w) / imgProps.width;
                if (h > maxH) { h = maxH; w = (imgProps.width * h) / imgProps.height; }
                const imgX = boxX + (boxSize - w) / 2; const imgY = y + 1 + (boxSize - h) / 2;
                doc.addImage(imgData, format, imgX, imgY, w, h);
            } catch (err) {}
        }
        
        doc.setFontSize(9); doc.setTextColor(150); doc.text(t['pdf_generated_by'] || "Generated by Chameleon", 105, 285, { align: 'center' });
    }
    return doc.output('blob');
}

export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    
    await ensureDefaultFontLoaded();
    await loadPdfFonts(doc);
    
    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }
    doc.setFontSize(26); doc.text("견적서", 105, 20, {align:'center'});
    
    // (견적서 나머지 부분 생략 - 이미 상단에 정의된 함수 사용)
    return doc.output('blob');
}

export async function getDesignPDFBlob() {
    const board = canvas.getObjects().find(o => o.isBoard);
    let x=0, y=0, w=canvas.width, h=canvas.height;
    if(board) { x = board.left; y = board.top; w = board.width * board.scaleX; h = board.height * board.scaleY; }
    
    // [중요] 여기서도 에러 발생 시 Raster로 전환
    try {
        let blob = await generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth']), w, h, x, y);
        if(!blob) throw new Error("Vector generation failed");
        return blob;
    } catch(e) {
        return await generateRasterPDF(canvas.toJSON(), w, h, x, y);
    }
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}