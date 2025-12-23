import { canvas } from "./canvas-core.js";
import { ADDON_DB, currentUser } from "./config.js"; 
import { FONT_URLS, FONT_ALIASES } from "./fonts.js"; 

// ★ 폰트명 설정 (fonts.js와 일치해야 함)
const BASE_FONT_NAME = "HyundaiSansRegular";

// ★ 요청하신 도장 이미지 URL
const STAMP_IMAGE_URL = "https://gdadmin.signmini.com/data/etc/stampImage"; 

// ==========================================================
// [1] 내보내기 도구 초기화 및 이벤트 연결
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
                return;
            }
            const btn = btnPDF;
            const originalText = btn.innerText;
            btn.innerText = "PDF 생성 중...";
            btn.disabled = true;

            try {
                // 특수효과(그림자, 스트로크, 네온 등) 감지 시 이미지(Raster) 방식 사용
                // -> 벡터 방식은 특수효과가 깨지기 때문
                const hasComplexEffect = canvas.getObjects().some(o => 
                    (o.type === 'i-text' || o.type === 'text') && (o.shadow || o.strokeWidth > 0)
                );

                const board = canvas.getObjects().find(o => o.isBoard);
                let x = 0; let y = 0; let w = canvas.width; let h = canvas.height;
                if (board) {
                    x = board.left; y = board.top;
                    w = board.width * board.scaleX; h = board.height * board.scaleY;
                }

                if (hasComplexEffect) {
                    console.log("특수 효과 감지: 래스터 모드로 변환");
                    let blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_image.pdf");
                } else {
                    console.log("벡터 모드로 변환");
                    let blob = await generateProductVectorPDF(canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth','charSpacing','lineHeight','textBackgroundColor']), w, h, x, y);
                    if(blob) downloadFile(URL.createObjectURL(blob), "design.pdf");
                    else throw new Error("Vector generation returned null");
                }
            } catch (err) {
                console.warn("PDF 생성 전환 (벡터->래스터):", err);
                // 실패 시 래스터 재시도 (안전장치)
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
// [2] 이미지 다운로드 / 파일 유틸리티
// ==========================================================
export function downloadImage(filename = "design-image") {
    if (!canvas) return;
    canvas.discardActiveObject();
    const originalVpt = canvas.viewportTransform;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    
    try {
        const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        downloadFile(dataURL, `${filename}.png`);
    } catch (e) { console.error(e); } 
    finally { canvas.setViewportTransform(originalVpt); canvas.requestRenderAll(); }
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

// ==========================================================
// [3] PDF 폰트 및 이미지 로더 (콘솔 오류 해결 포함)
// ==========================================================
const fontBufferCache = {};
function arrayBufferToBase64(buffer) {
    let binary = ''; const bytes = new Uint8Array(buffer); const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

async function ensureDefaultFontLoaded() {
    if (!fontBufferCache[BASE_FONT_NAME]) {
        try {
            const res = await fetch(FONT_URLS[BASE_FONT_NAME]);
            if (res.ok) fontBufferCache[BASE_FONT_NAME] = await res.arrayBuffer();
        } catch (e) { console.error("기본 폰트 로드 실패:", e); }
    }
}

async function loadPdfFonts(doc) {
    await ensureDefaultFontLoaded();
    const fontPromises = Object.keys(FONT_URLS).map(async (key) => {
        if (doc.existsFileInVFS(key + ".ttf")) return;
        try {
            let buffer = fontBufferCache[key];
            if (!buffer) {
                const res = await fetch(FONT_URLS[key]);
                if (res.ok) buffer = await res.arrayBuffer();
            }
            if (buffer) {
                doc.addFileToVFS(key + ".ttf", arrayBufferToBase64(buffer));
                doc.addFont(key + ".ttf", key, "normal");
            }
        } catch (e) {}
    });
    await Promise.all(fontPromises);

    // 기본 폰트 강제 등록
    if (fontBufferCache[BASE_FONT_NAME] && !doc.existsFileInVFS(BASE_FONT_NAME + ".ttf")) {
        doc.addFileToVFS(BASE_FONT_NAME + ".ttf", arrayBufferToBase64(fontBufferCache[BASE_FONT_NAME]));
        doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "normal");
    }
}

// ★ 중요: 숫자가 들어와도 문자열로 변환하여 에러 방지 (콘솔 오류 해결)
function drawAutoText(doc, text, x, y, options = {}) {
    if (text === null || text === undefined) return;
    const safeText = String(text); 
    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }
    doc.text(safeText, x, y, options);
}

// 이미지 안전하게 가져오기 (CORS 이슈 대응)
async function getSafeImageDataUrl(url) {
    if (!url) return null;
    if (url.startsWith('data:image')) return url;
    return new Promise(resolve => {
        const img = new Image(); 
        img.crossOrigin = "Anonymous"; 
        img.src = url;
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            try { resolve(c.toDataURL('image/png')); } catch(e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
    });
}

// ==========================================================
// [4] 견적서 생성 (★ 핵심 수정: 표 레이아웃 + 항목 줄바꿈 분리)
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // 폰트 로드
    await loadPdfFonts(doc);
    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }

    // --- [1] 헤더 ---
    doc.setFontSize(24); doc.setTextColor(0);
    drawAutoText(doc, "견 적 서", 105, 20, { align: 'center' });

    // --- [2] 정보란 (표 형태) ---
    doc.setFontSize(10);
    const leftX = 15; const rightX = 110; const topY = 35; 
    const boxW = 85; const boxH = 40; 
    const rowH = 8; // 행 높이

    // (좌측) 주문자 정보
    drawAutoText(doc, `날짜: ${new Date().toLocaleDateString()}`, leftX, topY + 5);
    drawAutoText(doc, `수신: ${orderInfo.manager || '고객'} 귀하`, leftX, topY + 12);
    drawAutoText(doc, `전화: ${orderInfo.phone || '-'}`, leftX, topY + 19);
    drawAutoText(doc, `주소: ${orderInfo.address || '-'}`, leftX, topY + 26, { maxWidth: 80 });

    // (우측) 공급자 정보 (표 그리기)
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.rect(rightX, topY, boxW, boxH); // 전체 박스

    // 가로선 4개 (5개 행)
    for(let i=1; i<5; i++) {
        doc.line(rightX, topY + (rowH*i), rightX + boxW, topY + (rowH*i));
    }
    // 세로선 (라벨/값 구분)
    const labelW = 20;
    doc.line(rightX + labelW, topY, rightX + labelW, topY + boxH);

    // 텍스트 좌표
    const tx = rightX + (labelW / 2); // 라벨 중앙
    const vx = rightX + labelW + 2;   // 값 시작점

    // 1행: 등록번호
    drawAutoText(doc, "등록번호", tx, topY + 5.5, { align: 'center' });
    drawAutoText(doc, "470-81-02808", vx, topY + 5.5);

    // 2행: 상호 / 대표 (요청: 상호 -> 우측 대표)
    // 상호
    drawAutoText(doc, "상 호", tx, topY + rowH + 5.5, { align: 'center' });
    drawAutoText(doc, "(주)카멜레온프린팅", vx, topY + rowH + 5.5);
    
    // 도장 찍기 (상호명 오른쪽에 겹치게)
    if (STAMP_IMAGE_URL) {
        try {
            const stampData = await getSafeImageDataUrl(STAMP_IMAGE_URL);
            // 위치: 상호명 끝나는 지점 즈음 (x=165 정도), y 조절
            if (stampData) doc.addImage(stampData, 'PNG', 165, topY + rowH + 1, 14, 14);
        } catch(e) {}
    }

    // 3행: 대표자
    drawAutoText(doc, "대 표", tx, topY + rowH*2 + 5.5, { align: 'center' });
    drawAutoText(doc, "조재호", vx, topY + rowH*2 + 5.5);

    // 4행: 주소
    drawAutoText(doc, "주 소", tx, topY + rowH*3 + 5.5, { align: 'center' });
    doc.setFontSize(8); 
    drawAutoText(doc, "경기 화성시 우정읍 한말길 72-2", vx, topY + rowH*3 + 5.5);
    doc.setFontSize(10);

    // 5행: 업태/연락처
    drawAutoText(doc, "연락처", tx, topY + rowH*4 + 5.5, { align: 'center' });
    drawAutoText(doc, "031-366-1984", vx, topY + rowH*4 + 5.5);


    // --- [3] 품목 리스트 (상품/옵션 줄바꿈 분리) ---
    let y = 90;
    // 헤더 배경 및 테두리
    doc.setFillColor(240); doc.rect(15, y, 180, 8, 'F'); 
    doc.setDrawColor(0); doc.rect(15, y, 180, 8); 

    // 헤더 텍스트
    drawAutoText(doc, "No", 20, y+5.5);
    drawAutoText(doc, "품목명", 35, y+5.5);
    drawAutoText(doc, "규격/옵션", 80, y+5.5);
    drawAutoText(doc, "수량", 140, y+5.5, {align:'center'});
    drawAutoText(doc, "단가", 160, y+5.5, {align:'right'});
    drawAutoText(doc, "금액", 190, y+5.5, {align:'right'});

    y += 8; 
    let totalAmt = 0;
    let no = 1;

    // ★ 항목 반복 (본품과 옵션 분리 로직)
    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        
        // 1. [본품 행]
        const productTotal = (item.product.price || 0) * (item.qty || 1);
        totalAmt += productTotal;

        doc.rect(15, y, 180, 8); // 테두리
        drawAutoText(doc, String(no++), 20, y+5.5); 
        drawAutoText(doc, item.product.name, 35, y+5.5); 
        drawAutoText(doc, "기본 사양", 80, y+5.5);
        drawAutoText(doc, String(item.qty), 140, y+5.5, {align:'center'});
        drawAutoText(doc, (item.product.price||0).toLocaleString(), 160, y+5.5, {align:'right'});
        drawAutoText(doc, productTotal.toLocaleString(), 190, y+5.5, {align:'right'});
        
        y += 8;
        if(y > 270) { doc.addPage(); y = 20; }

        // 2. [옵션 행들] (선택된 옵션이 있을 경우 별도 행으로 출력)
        if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            const arr = Object.values(item.selectedAddons);
            for (const code of arr) {
                const add = ADDON_DB[code];
                if (!add) continue;

                // 옵션 수량 (장바구니에 별도 수량이 있으면 사용, 없으면 1)
                const unitQty = (item.addonQuantities && item.addonQuantities[code]) ? item.addonQuantities[code] : 1;
                // 계산: 옵션 단가 * 수량
                const addTotal = add.price * unitQty;
                totalAmt += addTotal;

                // 옵션 행 출력
                doc.rect(15, y, 180, 8);
                
                drawAutoText(doc, "", 20, y+5.5); // 번호 공란
                drawAutoText(doc, `└ ${add.name}`, 35, y+5.5); // 들여쓰기 표시
                drawAutoText(doc, "추가 상품", 80, y+5.5); 
                drawAutoText(doc, String(unitQty), 140, y+5.5, {align:'center'});
                drawAutoText(doc, add.price.toLocaleString(), 160, y+5.5, {align:'right'});
                drawAutoText(doc, addTotal.toLocaleString(), 190, y+5.5, {align:'right'});

                y += 8;
                if(y > 270) { doc.addPage(); y = 20; }
            }
        }
    }

    // --- [4] 합계 ---
    y += 5;
    doc.setFontSize(12); doc.setTextColor(220, 38, 38);
    drawAutoText(doc, `총 합계금액: ${totalAmt.toLocaleString()} 원 (VAT 포함)`, 195, y, { align: 'right' });

    // --- [5] 하단 ---
    y += 20;
    doc.setFontSize(10); doc.setTextColor(100);
    drawAutoText(doc, "위와 같이 견적합니다.", 105, y, { align: 'center' });

    return doc.output('blob');
}

// ==========================================================
// [5] 작업지시서 생성 (기존 유지 + drawAutoText 적용)
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF Loading...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    await loadPdfFonts(doc);
    try { doc.setFont(BASE_FONT_NAME); } catch(e) { doc.setFont("Helvetica"); }

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (i > 0) doc.addPage();
        
        // 헤더
        doc.setFillColor(99, 102, 241); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(16); 
        drawAutoText(doc, "작업 지시서", 105, 13, { align: 'center' });
        
        const startY = 30; doc.setTextColor(0); doc.setFontSize(10); 
        doc.setDrawColor(200); doc.setFillColor(245, 247, 250); doc.rect(15, startY, 135, 40, 'F'); doc.rect(15, startY, 135, 40);      
        
        drawAutoText(doc, `주문일자: ${new Date().toLocaleDateString()}`, 20, startY + 8);
        drawAutoText(doc, `담당자명: ${orderInfo.manager || '-'}`, 80, startY + 8); 
        
        doc.setTextColor(220, 38, 38); doc.setFontSize(14);
        drawAutoText(doc, `도착희망일: ${orderInfo.date || '-'}`, 20, startY + 16);
        
        doc.setTextColor(0, 0, 0); doc.setFontSize(10); 
        drawAutoText(doc, `연락처: ${orderInfo.phone || '-'}`, 80, startY + 16);
        drawAutoText(doc, `배송주소: ${orderInfo.address || '-'}`, 20, startY + 24);
        drawAutoText(doc, `요청사항: ${orderInfo.note || '-'}`, 20, startY + 32, { maxWidth: 100 });

        // Staff
        const staffY = startY + 45;
        doc.setFillColor(255, 247, 237); doc.setDrawColor(249, 115, 22); doc.rect(15, staffY, 180, 20, 'F'); doc.rect(15, staffY, 180, 20);
        doc.setTextColor(194, 65, 12); doc.setFontSize(11);
        drawAutoText(doc, `배송책임자 : 서용규 (010-8272-3017) | 제작책임자 : 변지웅 (010-5512-5366)`, 105, staffY + 11, {align:'center'});

        // Product
        let y = staffY + 30;
        doc.setTextColor(0, 0, 0); doc.setFontSize(16);
        drawAutoText(doc, `[상품 ${i + 1}] ${item.product.name}`, 15, y);
        y += 10;
        doc.setFontSize(11); 
        
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
            drawAutoText(doc, "- 옵션 없음", 15, y + 5);
            y += 10;
        }
        
        y += 5; doc.setFontSize(14); doc.setTextColor(99, 102, 241); 
        drawAutoText(doc, `총 수량: ${item.qty}`, 160, y);

        // Image Placeholders
        y += 10; const boxSize = 130; const boxX = (210 - boxSize) / 2;
        doc.setDrawColor(200); doc.setLineWidth(0.5); doc.rect(boxX, y, boxSize, boxSize);

        let imgData = null; 
        let isPdf = (item.mimeType === 'application/pdf' || (item.fileName && item.fileName.toLowerCase().endsWith('.pdf')));
        
        if (item.thumb && item.thumb.startsWith('data:image')) imgData = item.thumb;
        else if (item.thumb) imgData = await getSafeImageDataUrl(item.thumb);
        else if (item.originalUrl && !isPdf) imgData = await getSafeImageDataUrl(item.originalUrl);

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
        
        doc.setFontSize(9); doc.setTextColor(150); 
        drawAutoText(doc, "Generated by Chameleon", 105, 285, { align: 'center' });
    }
    return doc.output('blob');
}

// ==========================================================
// [6] 디자인 PDF 생성 (벡터 / 래스터)
// ==========================================================
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf || !window.opentype) return null;
    try {
        await loadPdfFonts({ existsFileInVFS:()=>false, addFileToVFS:()=>{}, addFont:()=>{} }); // 캐시 로드만

        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX; const heightMM = h / MM_TO_PX;

        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(w + x); tempCvs.setHeight(h + y);

        if (json && json.objects) json.objects = json.objects.filter(o => !o.isBoard);
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));

        // SVG 변환 후 PDF 삽입
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        const svgStr = tempCvs.toSVG({ viewBox: { x: x, y: y, width: w, height: h }, width: w, height: h, suppressPreamble: true });
        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
        
        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
        return doc.output('blob');

    } catch (e) { return null; }
}

export async function generateRasterPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX; const heightMM = h / MM_TO_PX;
        const tempEl = document.createElement('canvas');
        const tempCvs = new fabric.StaticCanvas(tempEl);
        tempCvs.setWidth(w + x); tempCvs.setHeight(h + y);
        
        if (json && json.objects) json.objects = json.objects.filter(o => !o.isBoard);
        await new Promise(resolve => tempCvs.loadFromJSON(json, resolve));
        
        const imgData = tempCvs.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 2, left: x, top: y, width: w, height: h });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });
        doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
        return doc.output('blob');
    } catch (e) { return null; }
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}