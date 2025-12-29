import { canvas } from "./canvas-core.js";
import { ADDON_DB, currentUser, sb } from "./config.js";

// ★ [핵심] 안전장치: 폰트 로드 실패 시 사용할 '나눔고딕' 주소
const SAFE_KOREAN_FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf";
const BASE_FONT_NAME = "NanumGothic"; 

// 직인 이미지
const STAMP_IMAGE_URL = "https://gdadmin.signmini.com/data/etc/stampImage"; 

// ==========================================================
// [1] 내보내기 버튼 초기화
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
        btnPNG.onclick = async () => {
            if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
            downloadImage();
        };
    }

    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
            const btn = btnPDF;
            const originalText = btn.innerText;
            btn.innerText = "PDF 생성 중...";
            btn.disabled = true;

            try {
                // 특수효과(그림자 등)가 있으면 이미지 방식이 더 안전함
                const hasComplexEffect = canvas.getObjects().some(o => 
                    (o.type === 'i-text' || o.type === 'text') && (o.shadow || o.strokeWidth > 0)
                );

                const board = canvas.getObjects().find(o => o.isBoard);
                let x = 0; let y = 0; let w = canvas.width; let h = canvas.height;
                
                if (board) {
                    x = board.left; 
                    y = board.top;
                    w = board.width * board.scaleX; 
                    h = board.height * board.scaleY;
                }

                if (hasComplexEffect) {
                    console.log("특수 효과 감지: 고해상도 이미지 PDF로 변환");
                    let blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_image.pdf");
                } else {
                    console.log("벡터(아웃라인) PDF로 변환 시작...");
                    let blob = await generateProductVectorPDF(
                        canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth','charSpacing','lineHeight','textAlign']), 
                        w, h, x, y
                    );
                    
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_outline.pdf");
                    else throw new Error("Vector generation failed");
                }
            } catch (err) {
                console.warn("벡터 변환 실패, 이미지 모드로 백업:", err);
                const board = canvas.getObjects().find(o => o.isBoard);
                let x = 0, y = 0, w = canvas.width, h = canvas.height;
                if(board) { x=board.left; y=board.top; w=board.width*board.scaleX; h=board.height*board.scaleY; }
                
                let blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
                if(blob) downloadFile(URL.createObjectURL(blob), "design_backup.pdf");
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    }
}

// ==========================================================
// [2] 유틸리티
// ==========================================================
export function downloadImage(filename = "design-image") {
    if (!canvas) return;
    canvas.discardActiveObject();
    const originalVpt = canvas.viewportTransform;
    
    const board = canvas.getObjects().find(o => o.isBoard);
    if(board) {
         canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
         try {
            const dataURL = canvas.toDataURL({ 
                format: 'png', quality: 1, multiplier: 2,
                left: board.left, top: board.top,
                width: board.width * board.scaleX, height: board.height * board.scaleY
            });
            downloadFile(dataURL, `${filename}.png`);
        } catch (e) { console.error(e); } 
        finally { canvas.setViewportTransform(originalVpt); canvas.requestRenderAll(); }
    } else {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        try {
            const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
            downloadFile(dataURL, `${filename}.png`);
        } catch (e) { console.error(e); } 
        finally { canvas.setViewportTransform(originalVpt); canvas.requestRenderAll(); }
    }
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

function arrayBufferToBase64(buffer) {
    let binary = ''; const bytes = new Uint8Array(buffer); const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

async function getSafeImageDataUrl(url) {
    if (!url) return null;
    if (url.startsWith('data:image')) return url;
    return new Promise(resolve => {
        const img = new Image(); 
        img.crossOrigin = "Anonymous"; img.src = url;
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            try { resolve(c.toDataURL('image/png')); } catch(e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
    });
}

// ==========================================================
// [3] 견적서/지시서용 폰트 로더
// ==========================================================
const fontBufferCache = {};

async function loadPdfFonts(doc) {
    if (!fontBufferCache[BASE_FONT_NAME]) {
        try {
            const res = await fetch(SAFE_KOREAN_FONT_URL);
            if (res.ok) fontBufferCache[BASE_FONT_NAME] = await res.arrayBuffer();
        } catch (e) { console.error("기본 폰트 로드 실패:", e); }
    }
    if (fontBufferCache[BASE_FONT_NAME] && !doc.existsFileInVFS(BASE_FONT_NAME + ".ttf")) {
        doc.addFileToVFS(BASE_FONT_NAME + ".ttf", arrayBufferToBase64(fontBufferCache[BASE_FONT_NAME]));
        doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "normal");
    }
}

function drawAutoText(doc, text, x, y, options = {}) {
    if (text === null || text === undefined) return;
    const safeText = String(text); 
    doc.setFont(BASE_FONT_NAME);
    doc.text(safeText, x, y, options);
}

// ==========================================================
// [4] 견적서 생성 함수 (할인 내역 포함)
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 

    doc.setFontSize(24); doc.setTextColor(0);
    drawAutoText(doc, "견 적 서", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    const leftX = 15; const rightX = 110; const topY = 35; const boxW = 85; const boxH = 40; const rowH = 8;
    drawAutoText(doc, `날짜: ${new Date().toLocaleDateString()}`, leftX, topY + 5);
    drawAutoText(doc, `수신: ${orderInfo.manager || '고객'} 귀하`, leftX, topY + 12);
    drawAutoText(doc, `전화: ${orderInfo.phone || '-'}`, leftX, topY + 19);
    drawAutoText(doc, `주소: ${orderInfo.address || '-'}`, leftX, topY + 26, { maxWidth: 80 });

    doc.setDrawColor(0); doc.setLineWidth(0.4); doc.rect(rightX, topY, boxW, boxH);
    for(let i=1; i<5; i++) doc.line(rightX, topY + (rowH*i), rightX + boxW, topY + (rowH*i));
    const labelW = 20; doc.line(rightX + labelW, topY, rightX + labelW, topY + boxH);
    const tx = rightX + (labelW / 2); const vx = rightX + labelW + 2;

    drawAutoText(doc, "등록번호", tx, topY + 5.5, { align: 'center' }); drawAutoText(doc, "470-81-02808", vx, topY + 5.5);
    drawAutoText(doc, "상 호", tx, topY + rowH + 5.5, { align: 'center' }); drawAutoText(doc, "(주)카멜레온프린팅", vx, topY + rowH + 5.5);
    if (STAMP_IMAGE_URL) { try { const stamp = await getSafeImageDataUrl(STAMP_IMAGE_URL); if (stamp) doc.addImage(stamp, 'PNG', 165, topY + rowH + 1, 14, 14); } catch(e) {} }
    drawAutoText(doc, "대 표", tx, topY + rowH*2 + 5.5, { align: 'center' }); drawAutoText(doc, "조재호", vx, topY + rowH*2 + 5.5);
    drawAutoText(doc, "주 소", tx, topY + rowH*3 + 5.5, { align: 'center' }); doc.setFontSize(8); drawAutoText(doc, "경기 화성시 우정읍 한말길 72-2", vx, topY + rowH*3 + 5.5); doc.setFontSize(10);
    drawAutoText(doc, "연락처", tx, topY + rowH*4 + 5.5, { align: 'center' }); drawAutoText(doc, "031-366-1984", vx, topY + rowH*4 + 5.5);

    let y = 90;
    doc.setFillColor(240); doc.rect(15, y, 180, 8, 'F'); doc.setDrawColor(0); doc.rect(15, y, 180, 8);
    drawAutoText(doc, "No", 20, y+5.5); drawAutoText(doc, "품목명", 35, y+5.5); drawAutoText(doc, "규격/옵션", 80, y+5.5);
    drawAutoText(doc, "수량", 140, y+5.5, {align:'center'}); drawAutoText(doc, "단가", 160, y+5.5, {align:'right'}); drawAutoText(doc, "금액", 190, y+5.5, {align:'right'});
    y += 8; let totalAmt = 0; let no = 1;

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (!item.product) continue; 

        const pTotal = (item.product.price || 0) * (item.qty || 1); totalAmt += pTotal;
        doc.rect(15, y, 180, 8);
        drawAutoText(doc, String(no++), 20, y+5.5); drawAutoText(doc, item.product.name, 35, y+5.5); drawAutoText(doc, "기본 사양", 80, y+5.5);
        drawAutoText(doc, String(item.qty), 140, y+5.5, {align:'center'}); drawAutoText(doc, (item.product.price||0).toLocaleString(), 160, y+5.5, {align:'right'}); drawAutoText(doc, pTotal.toLocaleString(), 190, y+5.5, {align:'right'});
        y += 8; if(y > 270) { doc.addPage(); y = 20; }

        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code]; if(!add) return;
                const uQty = (item.addonQuantities && item.addonQuantities[code]) ? item.addonQuantities[code] : 1;
                const aTotal = add.price * uQty; totalAmt += aTotal;
                doc.rect(15, y, 180, 8);
                drawAutoText(doc, "", 20, y+5.5); drawAutoText(doc, `└ ${add.name}`, 35, y+5.5); drawAutoText(doc, "추가 상품", 80, y+5.5);
                drawAutoText(doc, String(uQty), 140, y+5.5, {align:'center'}); drawAutoText(doc, add.price.toLocaleString(), 160, y+5.5, {align:'right'}); drawAutoText(doc, aTotal.toLocaleString(), 190, y+5.5, {align:'right'});
                y += 8; if(y > 270) { doc.addPage(); y = 20; }
            });
        }
    }

    // 등급 할인 조회 (할인율 계산)
    let discountRate = 0;
    if (currentUser) {
        try {
            const { data } = await sb.from('profiles').select('role').eq('id', currentUser.id).single();
            const role = data?.role;
            if (role === 'franchise') discountRate = 0.15;
            else if (role === 'platinum') discountRate = 0.10;
            else if (role === 'gold') discountRate = 0.05;
        } catch(e) { console.warn("등급 조회 실패"); }
    }

    const discountAmt = Math.floor(totalAmt * discountRate);
    const finalAmt = totalAmt - discountAmt;

    y += 5; 
    
    // 합계
    doc.setFontSize(10); doc.setTextColor(0);
    drawAutoText(doc, `합계 금액: ${totalAmt.toLocaleString()} 원`, 195, y, { align: 'right' });
    y += 6;

    // 할인 내역
    if (discountAmt > 0) {
        doc.setTextColor(220, 38, 38);
        drawAutoText(doc, `회원 등급 할인 (${(discountRate*100).toFixed(0)}%): -${discountAmt.toLocaleString()} 원`, 195, y, { align: 'right' });
        y += 6;
    }

    // 최종 금액
    doc.setFontSize(12); doc.setTextColor(0, 0, 0);
    drawAutoText(doc, `최종 결제금액: ${finalAmt.toLocaleString()} 원 (VAT 포함)`, 195, y, { align: 'right' });

    y += 20; doc.setFontSize(10); doc.setTextColor(100);
    drawAutoText(doc, "위와 같이 견적합니다.", 105, y, { align: 'center' });
    
    return doc.output('blob');
}

// ==========================================================
// [5] 작업지시서 생성 함수 (★ QR코드 포함됨)
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF Loading...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 

    // ★ [추가] QR코드 생성 (orderInfo.id가 있을 때만)
    let qrDataUrl = null;
    if (orderInfo.id && window.QRCode) {
        try {
            // 주문 번호를 담은 QR코드 생성
            qrDataUrl = await window.QRCode.toDataURL(String(orderInfo.id), { width: 100, margin: 1 });
        } catch (e) {
            console.warn("QR 생성 실패:", e);
        }
    }

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (!item.product) continue;

        if (i > 0) doc.addPage();
        
        // 헤더 바
        doc.setFillColor(99, 102, 241); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(16); drawAutoText(doc, "작업 지시서", 105, 13, { align: 'center' });
        
        // ★ [배치] QR코드 삽입 (헤더 우측 하단)
        if (qrDataUrl) {
            doc.addImage(qrDataUrl, 'PNG', 165, 25, 25, 25);
        }

        const startY = 30; doc.setTextColor(0); doc.setFontSize(10); 
        doc.setDrawColor(200); doc.setFillColor(245, 247, 250); doc.rect(15, startY, 135, 40, 'F'); doc.rect(15, startY, 135, 40);      
        drawAutoText(doc, `주문번호: ${orderInfo.id || '-'}`, 20, startY + 8);
        drawAutoText(doc, `담당자명: ${orderInfo.manager || '-'}`, 80, startY + 8); 
        
        doc.setTextColor(220, 38, 38); doc.setFontSize(14);
        drawAutoText(doc, `도착희망일: ${orderInfo.date || '-'}`, 20, startY + 16);
        
        doc.setTextColor(0, 0, 0); doc.setFontSize(10); 
        drawAutoText(doc, `연락처: ${orderInfo.phone || '-'}`, 80, startY + 16);
        drawAutoText(doc, `배송주소: ${orderInfo.address || '-'}`, 20, startY + 24);
        drawAutoText(doc, `요청사항: ${orderInfo.note || '-'}`, 20, startY + 32, { maxWidth: 100 });

        const staffY = startY + 45;
        doc.setFillColor(255, 247, 237); doc.setDrawColor(249, 115, 22); doc.rect(15, staffY, 180, 20, 'F'); doc.rect(15, staffY, 180, 20);
        doc.setTextColor(194, 65, 12); doc.setFontSize(11);
        drawAutoText(doc, `배송책임자 : 서용규 (010-8272-3017) | 제작책임자 : 변지웅 (010-5512-5366)`, 105, staffY + 11, {align:'center'});

        let y = staffY + 30;
        doc.setTextColor(0, 0, 0); doc.setFontSize(16);
        drawAutoText(doc, `[상품 ${i + 1}] ${item.product.name}`, 15, y); y += 10; doc.setFontSize(11); 
        
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code]; if(!add) return;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(15, y, 5, 5); 
                doc.setFillColor(255, 255, 255); doc.rect(23, y, 120, 8, 'F'); doc.rect(23, y, 120, 8);
                drawAutoText(doc, ` ${add.name}`, 25, y + 5.5);
                doc.rect(145, y, 20, 8); doc.text(`${qty}`, 155, y + 5.5, { align: 'center' });
                y += 10;
            });
        } else { drawAutoText(doc, "- 옵션 없음", 15, y + 5); y += 10; }
        
        y += 5; doc.setFontSize(14); doc.setTextColor(99, 102, 241); drawAutoText(doc, `총 수량: ${item.qty}`, 160, y);

        y += 10; const boxSize = 130; const boxX = (210 - boxSize) / 2;
        doc.setDrawColor(200); doc.setLineWidth(0.5); doc.rect(boxX, y, boxSize, boxSize);

        let imgData = null; 
        if (item.thumb && item.thumb.startsWith('data:image')) imgData = item.thumb;
        else if (item.thumb) imgData = await getSafeImageDataUrl(item.thumb);
        else if (item.originalUrl && item.mimeType?.startsWith('image')) imgData = await getSafeImageDataUrl(item.originalUrl);

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
        doc.setFontSize(9); doc.setTextColor(150); drawAutoText(doc, "Generated by Chameleon", 105, 285, { align: 'center' });
    }
    return doc.output('blob');
}

// ==========================================================
// [6] ★ 디자인 PDF 생성 (텍스트 줄바꿈 및 엑박 해결)
// ==========================================================
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf || !window.opentype) return null;
    
    const tempEl = document.createElement('canvas');
    const tempCvs = new fabric.StaticCanvas(tempEl);
    tempCvs.setWidth(w); 
    tempCvs.setHeight(h);

    if (json && json.objects) {
        json.objects = json.objects.filter(o => !o.isBoard).map(o => {
            o.left -= x;
            o.top -= y;
            return o;
        });
    }

    await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

    // 2. 텍스트를 Path(벡터)로 변환 (줄바꿈 로직 적용됨)
    await convertCanvasTextToPaths(tempCvs);

    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX; 
        const heightMM = h / MM_TO_PX;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ 
            orientation: widthMM > heightMM ? 'l' : 'p', 
            unit: 'mm', 
            format: [widthMM, heightMM] 
        });
        
        const svgStr = tempCvs.toSVG({ 
            viewBox: { x: 0, y: 0, width: w, height: h }, 
            width: w, 
            height: h, 
            suppressPreamble: true 
        });

        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
        
        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
        return doc.output('blob');
    } catch (e) { 
        console.error("Vector Outline Error:", e);
        return null; 
    }
}

// ★ [핵심] 줄바꿈(Enter) 문자를 인식해서 한 줄씩 나눠서 그리는 함수
async function convertCanvasTextToPaths(fabricCanvas) {
    if (!window.opentype) return;

    // 1. 폰트 매핑 정보 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const CURRENT_LANG = (urlParams.get('lang') || 'kr').toUpperCase();
    const fontUrlMap = {};
    
    try {
        const { data } = await sb.from('site_fonts').select('font_family, file_url').eq('site_code', CURRENT_LANG);
        if (data) data.forEach(f => fontUrlMap[f.font_family] = f.file_url);
    } catch(e) {}

    const loadedFonts = {}; 

    // 재귀적으로 객체 처리 (그룹 내부까지)
    const processObjects = async (objects) => {
        // 뒤에서부터 처리해야 인덱스 꼬임 방지
        for (let i = objects.length - 1; i >= 0; i--) {
            let obj = objects[i];

            if (obj.type === 'group') {
                await processObjects(obj.getObjects());
            } 
            else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                try {
                    const family = obj.fontFamily;
                    let url = fontUrlMap[family];
                    if (!url) url = SAFE_KOREAN_FONT_URL; 

                    if (!loadedFonts[url]) {
                        const buffer = await (await fetch(url)).arrayBuffer();
                        loadedFonts[url] = window.opentype.parse(buffer);
                    }
                    const font = loadedFonts[url];

                    // ----------------------------------------------------
                    // ★ [핵심 수정] 텍스트 위치 및 줄바꿈 정밀 계산
                    // ----------------------------------------------------
                    const fontSize = obj.fontSize;
                    // Fabric.js의 lineHeight는 배수(예: 1.2)이므로 픽셀로 변환
                    const lineHeightPx = obj.lineHeight * fontSize;
                    
                    // 텍스트 전체 높이 계산 (중심점 보정을 위해)
                    const textLines = obj.text.split(/\r\n|\r|\n/);
                    const totalHeight = textLines.length * lineHeightPx;
                    
                    // 텍스트 박스의 정중앙 좌표 (변환 기준점)
                    // Fabric.js는 텍스트를 그릴 때 baseline이 아닌 중심점 기준으로 배치함
                    // 따라서 Path를 그릴 때도 시작점(y)을 잘 잡아야 함
                    let startY = -(totalHeight / 2) + (fontSize * 0.8); // 0.8은 대략적인 baseline 보정값

                    let fullPathData = "";

                    textLines.forEach((line, index) => {
                        if(line.trim() !== '') {
                            // 각 줄의 x좌표 정렬 (왼쪽/중앙/오른쪽)
                            let lineX = 0;
                            const lineWidth = font.getAdvanceWidth(line, fontSize);
                            
                            if (obj.textAlign === 'center') lineX = -lineWidth / 2;
                            else if (obj.textAlign === 'right') lineX = (obj.width / 2) - lineWidth;
                            else lineX = -obj.width / 2; // left

                            // Path 생성
                            const path = font.getPath(line, lineX, startY + (index * lineHeightPx), fontSize);
                            fullPathData += path.toPathData(2);
                        }
                    });

                    // ----------------------------------------------------
                    // [2] Path 객체로 변환 (스타일 유지)
                    // ----------------------------------------------------
                    const isBold = obj.fontWeight === 'bold' || parseInt(obj.fontWeight) >= 600;
                    let finalStroke = obj.stroke;
                    let finalStrokeWidth = obj.strokeWidth;

                    // 볼드 처리 (외곽선 추가)
                    if (isBold && !finalStroke && typeof obj.fill === 'string') {
                        finalStroke = obj.fill; 
                        finalStrokeWidth = fontSize * 0.025; // 두께 약간 얇게 조정
                    }

                    const fabricPath = new fabric.Path(fullPathData, {
                        fill: obj.fill,
                        stroke: finalStroke,
                        strokeWidth: finalStrokeWidth,
                        strokeLineCap: 'round',
                        strokeLineJoin: 'round',
                        // 기존 객체의 변형 속성 그대로 복사
                        scaleX: obj.scaleX,
                        scaleY: obj.scaleY,
                        angle: obj.angle,
                        left: obj.left,
                        top: obj.top,
                        originX: obj.originX,
                        originY: obj.originY,
                        opacity: obj.opacity,
                        shadow: obj.shadow
                    });

                    // 기존 텍스트 삭제 후 벡터 패스로 교체
                    if (obj.group) {
                        obj.group.removeWithUpdate(obj);
                        obj.group.addWithUpdate(fabricPath);
                    } else {
                        fabricCanvas.remove(obj);
                        fabricCanvas.add(fabricPath);
                    }

                } catch (err) {
                    console.warn("Text outline failed:", err);
                }
            }
        }
    };

    await processObjects(fabricCanvas.getObjects());
}

export async function generateRasterPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX; const heightMM = h / MM_TO_PX;
        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(w); tempCvs.setHeight(h);
        
        if (json && json.objects) {
            json.objects = json.objects.filter(o => !o.isBoard).map(o => {
                o.left -= x; o.top -= y; return o;
            });
        }
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        
        const imgData = tempCvs.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 2 });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
        return doc.output('blob');
    } catch (e) { return null; }
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}