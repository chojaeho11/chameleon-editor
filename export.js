import { canvas } from "./canvas-core.js";
import { ADDON_DB, currentUser, sb } from "./config.js";

// [안전장치] 기본 폰트 로드 실패 시 사용할 폰트
const SAFE_KOREAN_FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf";
const BASE_FONT_NAME = "NanumGothic"; 

// 직인 이미지
const STAMP_IMAGE_URL = "https://gdadmin.signmini.com/data/etc/stampImage"; 

// QR코드 생성 API
const QR_API_BASE = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=";

// ==========================================================
// [1] 내보내기 버튼 초기화
// ==========================================================
export function initExport() {
    // SVG 다운로드
    const btnSVG = document.getElementById("btnDownloadSVG");
    if (btnSVG) {
        btnSVG.onclick = () => {
            const w = canvas.width; const h = canvas.height;
            const svgData = canvas.toSVG({ viewBox: { x: 0, y: 0, width: w, height: h }, width: w, height: h });
            downloadFile(URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml" })), "design.svg");
        };
    }

    // PNG 다운로드
    const btnPNG = document.getElementById("btnPNG");
    if (btnPNG) {
        btnPNG.onclick = async () => {
            if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
            downloadImage();
        };
    }

    // PDF 다운로드
    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            if (!currentUser) return alert("로그인이 필요한 서비스입니다.");
            
            const btn = btnPDF;
            const originalText = btn.innerText;
            btn.innerText = "인쇄용 PDF 생성 중...";
            btn.disabled = true;

            try {
                // 특수효과(그림자 등) 확인 -> 래스터(이미지) 방식 권장
                const hasComplexEffect = canvas.getObjects().some(o => 
                    (o.type === 'i-text' || o.type === 'text') && (o.shadow)
                );

                const board = canvas.getObjects().find(o => o.isBoard);
                let x = 0, y = 0, w = canvas.width, h = canvas.height;
                
                if (board) {
                    x = board.left; 
                    y = board.top;
                    w = board.width * board.scaleX; 
                    h = board.height * board.scaleY;
                }

                if (hasComplexEffect) {
                    console.log("특수 효과 감지: 고해상도 이미지 PDF로 변환");
                    let blob = await generateRasterPDF(canvas.toJSON(), w, h, x, y);
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_print_raster.pdf");
                } else {
                    console.log("벡터(아웃라인) PDF로 변환 시작...");
                    let blob = await generateProductVectorPDF(
                        // paintFirst 포함하여 내보내기
                        canvas.toJSON(['id','isBoard','fontFamily','fontSize','text','fill','stroke','strokeWidth','charSpacing','lineHeight','textAlign','fontWeight','fontStyle','paintFirst']), 
                        w, h, x, y
                    );
                    
                    if(blob) downloadFile(URL.createObjectURL(blob), "design_print_vector.pdf");
                    else throw new Error("Vector generation failed");
                }

            } catch (err) {
                console.warn("벡터 변환 실패, 백업 모드 실행:", err);
                // 실패 시 백업: 래스터 방식
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
// [2] 유틸리티 및 CMYK 변환 헬퍼
// ==========================================================
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

// CMYK 색상 변환 (인쇄 적합성 향상)
function hexToCMYK(hex) {
    let c = 0, m = 0, y = 0, k = 0;
    hex = (hex.charAt(0) == "#") ? hex.substring(1, 7) : hex;
    
    if (hex.length != 6) return [0, 0, 0, 1]; 

    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // K100 블랙 처리
    if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 1];
    if (r === 255 && g === 255 && b === 255) return [0, 0, 0, 0];

    c = 1 - (r / 255);
    m = 1 - (g / 255);
    y = 1 - (b / 255);
    let minCMY = Math.min(c, Math.min(m, y));
    
    c = (c - minCMY) / (1 - minCMY);
    m = (m - minCMY) / (1 - minCMY);
    y = (y - minCMY) / (1 - minCMY);
    k = minCMY;

    return [c, m, y, k];
}

// ==========================================================
// [3] PDF 폰트 로더
// ==========================================================
const fontBufferCache = {};

async function loadPdfFonts(doc) {
    if (!fontBufferCache[BASE_FONT_NAME]) {
        try {
            const res = await fetch(SAFE_KOREAN_FONT_URL);
            if (res.ok) fontBufferCache[BASE_FONT_NAME] = await res.arrayBuffer();
        } catch (e) { console.error("기본 폰트 로드 실패:", e); }
    }
    
    if (fontBufferCache[BASE_FONT_NAME]) {
        const fontData = arrayBufferToBase64(fontBufferCache[BASE_FONT_NAME]);
        if (!doc.existsFileInVFS(BASE_FONT_NAME + ".ttf")) {
            doc.addFileToVFS(BASE_FONT_NAME + ".ttf", fontData);
            doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "normal");
            doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "bold");
        }
    }
}

function drawAutoText(doc, text, x, y, options = {}) {
    if (text === null || text === undefined) return;
    const safeText = String(text); 
    doc.setFont(BASE_FONT_NAME);
    doc.text(safeText, x, y, options);
}

// ==========================================================
// [4] 벡터(아웃라인) PDF 생성 함수
// ==========================================================
export async function generateProductVectorPDF(json, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;

    try {
        const tempElement = document.createElement('canvas');
        const tempCanvas = new fabric.StaticCanvas(tempElement);
        tempCanvas.setWidth(w);
        tempCanvas.setHeight(h);

        await new Promise((resolve) => {
            tempCanvas.loadFromJSON(json, () => {
                if (json.objects) {
                    tempCanvas.setViewportTransform([1, 0, 0, 1, -x, -y]);
                }
                resolve();
            });
        });

        await convertCanvasTextToPaths(tempCanvas);

        const MM_TO_PX = 3.7795; 
        const widthMM = w / MM_TO_PX; 
        const heightMM = h / MM_TO_PX;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ 
            orientation: widthMM > heightMM ? 'l' : 'p', 
            unit: 'mm', 
            format: [widthMM, heightMM],
            compress: true 
        });

        const svgStr = tempCanvas.toSVG({ 
            viewBox: { x: x, y: y, width: w, height: h }, 
            width: w, height: h, suppressPreamble: true 
        });

        const parser = new DOMParser();
        const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
        
        await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });

        tempCanvas.dispose();
        return doc.output('blob');

    } catch (e) { 
        console.error("Vector Gen Error:", e);
        return null; 
    }
}

// [텍스트 -> 패스 변환 (테두리 침범 방지 & 두께 보정 완벽 해결 버전)]
async function convertCanvasTextToPaths(fabricCanvas) {
    if (!window.opentype) return;

    // 1. 폰트 목록 준비
    const fontList = []; 
    try {
        const { data } = await sb.from('site_fonts').select('font_family, file_url');
        if (data) {
            data.forEach(f => {
                fontList.push({
                    original: f.font_family,
                    normalized: f.font_family.toLowerCase().replace(/[\s\-_]/g, ''),
                    url: f.file_url
                });
            });
        }
    } catch(e) {}

    const loadedFonts = {}; 

    // 서체 찾기 함수
    const findFontUrl = (familyName) => {
        if (!familyName) return SAFE_KOREAN_FONT_URL;
        const target = familyName.toLowerCase().replace(/[\s\-_]/g, '');
        
        const exactMatch = fontList.find(f => f.normalized === target);
        if (exactMatch) return exactMatch.url;
        
        const candidates = fontList.filter(f => target.includes(f.normalized) || f.normalized.includes(target));
        if (candidates.length > 0) {
            candidates.sort((a, b) => Math.abs(a.normalized.length - target.length) - Math.abs(b.normalized.length - target.length));
            return candidates[0].url; 
        }
        return SAFE_KOREAN_FONT_URL;
    };

    // 객체 처리 함수 (재귀)
    const processObjects = async (objects) => {
        // 뒤에서부터 처리해야 인덱스가 꼬이지 않음
        for (let i = objects.length - 1; i >= 0; i--) {
            let obj = objects[i];
            
            if (obj.type === 'group') {
                await processObjects(obj.getObjects());
            } 
            else if (['i-text', 'text', 'textbox'].includes(obj.type)) {
                try {
                    const fontUrl = findFontUrl(obj.fontFamily);
                    if (!loadedFonts[fontUrl]) {
                        const buffer = await (await fetch(fontUrl)).arrayBuffer();
                        loadedFonts[fontUrl] = window.opentype.parse(buffer);
                    }
                    const font = loadedFonts[fontUrl];
                    const fontSize = obj.fontSize;
                    
                    // opentype.js 좌표 계산
                    const lineHeightPx = obj.lineHeight * fontSize;
                    const textLines = obj.text.split(/\r\n|\r|\n/);
                    
                    // 텍스트 수직 정렬 보정
                    let startY = -(textLines.length * lineHeightPx / 2) + (fontSize * 0.8);
                    
                    // 전체 텍스트의 패스 데이터 생성
                    let fullPathData = "";
                    textLines.forEach((line, index) => {
                        if(line.trim() !== '') {
                            const lineWidth = font.getAdvanceWidth(line, fontSize);
                            let lineX = -obj.width / 2; 
                            
                            // 정렬에 따른 X좌표 보정
                            if (obj.textAlign === 'center') lineX = -lineWidth / 2;
                            else if (obj.textAlign === 'right') lineX = (obj.width / 2) - lineWidth;
                            
                            const path = font.getPath(line, lineX, startY + (index * lineHeightPx), fontSize);
                            fullPathData += path.toPathData(2);
                        }
                    });

                    // ★ [핵심 1] 테두리(Stroke) 객체 생성 (글자 뒤에 배치될 녀석)
                    let strokePathObj = null;
                    if (obj.stroke && obj.strokeWidth > 0) {
                        // 글자가 커질수록 테두리가 얇아 보이는 문제 보정
                        // (화면과 PDF의 렌더링 스케일 차이를 보정하기 위해 약간의 가중치 부여 가능)
                        strokePathObj = new fabric.Path(fullPathData, {
                            fill: null, // 채우기 없음
                            stroke: obj.stroke,
                            strokeWidth: obj.strokeWidth * 2, // ★ 중요: 중앙 기준이므로 두께를 2배로 해야 바깥쪽으로 원하는 만큼 나옴
                            strokeLineCap: 'round',
                            strokeLineJoin: 'round',
                            scaleX: obj.scaleX, scaleY: obj.scaleY, 
                            angle: obj.angle,
                            left: obj.left, top: obj.top, 
                            originX: obj.originX, originY: obj.originY,
                            opacity: obj.opacity,
                            shadow: null // 그림자는 분리하지 않음
                        });
                    }

                    // ★ [핵심 2] 채우기(Fill) 객체 생성 (글자 앞에 배치될 녀석)
                    const fillPathObj = new fabric.Path(fullPathData, {
                        fill: obj.fill,
                        stroke: null, // 테두리 없음
                        strokeWidth: 0,
                        scaleX: obj.scaleX, scaleY: obj.scaleY, 
                        angle: obj.angle,
                        left: obj.left, top: obj.top, 
                        originX: obj.originX, originY: obj.originY,
                        opacity: obj.opacity,
                        shadow: obj.shadow
                    });

                    // ★ [핵심 3] 교체 작업
                    if (obj.group) {
                        // 그룹 내부에 있다면
                        const group = obj.group;
                        group.removeWithUpdate(obj);
                        
                        // 테두리가 있으면 먼저 추가 (뒤쪽)
                        if (strokePathObj) group.addWithUpdate(strokePathObj);
                        // 채우기는 나중에 추가 (앞쪽)
                        group.addWithUpdate(fillPathObj);
                    } else {
                        // 캔버스 바로 위에 있다면
                        const index = fabricCanvas.getObjects().indexOf(obj);
                        fabricCanvas.remove(obj);
                        
                        if (strokePathObj) {
                            fabricCanvas.insertAt(strokePathObj, index); // 원래 위치
                            fabricCanvas.insertAt(fillPathObj, index + 1); // 그 바로 위
                        } else {
                            fabricCanvas.insertAt(fillPathObj, index);
                        }
                    }

                } catch (err) {
                    console.warn("Text convert error:", err);
                }
            }
        }
    };

    await processObjects(fabricCanvas.getObjects());
}

// [래스터 PDF 생성]
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

// ==========================================================
// [7] 견적서/주문서 공통 로직 (CMYK Helper & Draw)
// ==========================================================
function drawText(doc, text, x, y, options = {}, colorHex = "#000000") {
    if (!text) return;
    const [c, m, yk, k] = hexToCMYK(colorHex);
    doc.setTextColor(c, m, yk, k); 
    doc.setFont(BASE_FONT_NAME, options.weight || "normal");
    doc.text(String(text), x, y, options);
}

function drawLine(doc, x1, y1, x2, y2, colorHex = "#000000", width = 0.1) {
    const [c, m, yk, k] = hexToCMYK(colorHex);
    doc.setDrawColor(c, m, yk, k);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
}

function drawCell(doc, x, y, w, h, text, align='center', fontSize=9, isHeader=false) {
    doc.setFontSize(fontSize);
    if (isHeader) { doc.setFillColor(240, 240, 240); doc.rect(x, y, w, h, 'F'); }
    doc.setDrawColor(0); doc.setLineWidth(0.1); doc.rect(x, y, w, h);
    doc.setTextColor(0, 0, 0, 1);
    doc.setFont(BASE_FONT_NAME, isHeader ? 'bold' : 'normal');
    const textX = align === 'left' ? x + 2 : (align === 'right' ? x + w - 2 : x + w/2);
    doc.text(String(text), textX, y + (h/2) + (fontSize/3.5), { align: align, maxWidth: w-4 });
}

// ==========================================================
// [8] 고품질 견적서 생성 (Quotation)
// ==========================================================
export async function generateQuotationPDF(orderInfo, cartItems, discountRate = 0) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 

    doc.setFontSize(26); 
    drawText(doc, "견   적   서", 105, 22, { align: 'center', weight: 'bold' });
    drawLine(doc, 15, 28, 195, 28, "#000000", 0.5); 

    const topY = 35; const leftX = 15;
    doc.setFontSize(10);
    drawText(doc, "[ 공급받는자 ]", leftX, topY);
    drawText(doc, `성   명 :  ${orderInfo.manager || '귀하'}`, leftX, topY+8);
    drawText(doc, `연락처 :  ${orderInfo.phone || '-'}`, leftX, topY+14);
    drawText(doc, `이메일 :  ${orderInfo.email || currentUser?.email || '-'}`, leftX, topY+20);
    drawText(doc, `주   소 :  ${orderInfo.address || '-'}`, leftX, topY+26, { maxWidth: 85 });

    const boxX = 105; const boxY = 32; const cellH = 7; const labelW = 20; const valW = 70;
    const providerInfo = [ ["등록번호", "470-81-02808"], ["상      호", "(주)카멜레온프린팅"], ["대      표", "조재호"], ["주      소", "경기 화성시 우정읍 한말길 72-2"], ["업      태", "제조업 / 서비스업"], ["연 락 처", "031-366-1984"] ];
    providerInfo.forEach((row, i) => {
        const curY = boxY + (i * cellH);
        drawCell(doc, boxX, curY, labelW, cellH, row[0], 'center', 9, true);
        drawCell(doc, boxX+labelW, curY, valW, cellH, row[1], 'left', 9, false);
    });

    if (STAMP_IMAGE_URL) {
        try {
            const stamp = await getSafeImageDataUrl(STAMP_IMAGE_URL);
            if (stamp) doc.addImage(stamp, 'PNG', boxX+labelW+45, boxY+cellH+1, 14, 14);
        } catch(e) {}
    }

    let y = 85;
    const cols = [10, 50, 40, 20, 30, 30]; 
    const headers = ["No", "품목명", "규격/옵션", "수량", "단가", "금액"];
    let curX = 15;
    headers.forEach((h, i) => { drawCell(doc, curX, y, cols[i], 8, h, 'center', 10, true); curX += cols[i]; });
    y += 8;

    let totalAmt = 0; let no = 1;
    cartItems.forEach(item => {
        if (!item.product) return;
        const pTotal = (item.product.price || 0) * (item.qty || 1); totalAmt += pTotal;
        curX = 15;
        drawCell(doc, curX, y, cols[0], 8, no++, 'center'); curX += cols[0];
        drawCell(doc, curX, y, cols[1], 8, item.product.name, 'left'); curX += cols[1];
        drawCell(doc, curX, y, cols[2], 8, "기본 사양", 'left'); curX += cols[2];
        drawCell(doc, curX, y, cols[3], 8, String(item.qty), 'center'); curX += cols[3];
        drawCell(doc, curX, y, cols[4], 8, item.product.price.toLocaleString(), 'right'); curX += cols[4];
        drawCell(doc, curX, y, cols[5], 8, pTotal.toLocaleString(), 'right');
        y += 8;
        if(y > 260) { doc.addPage(); y = 20; }
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code]; if(!add) return;
                const uQty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                const aTotal = add.price * uQty; totalAmt += aTotal;
                curX = 15;
                drawCell(doc, curX, y, cols[0], 8, "", 'center'); curX += cols[0];
                drawCell(doc, curX, y, cols[1], 8, "└ " + add.name, 'left', 8); curX += cols[1];
                drawCell(doc, curX, y, cols[2], 8, "추가 옵션", 'left', 8); curX += cols[2];
                drawCell(doc, curX, y, cols[3], 8, String(uQty), 'center'); curX += cols[3];
                drawCell(doc, curX, y, cols[4], 8, add.price.toLocaleString(), 'right'); curX += cols[4];
                drawCell(doc, curX, y, cols[5], 8, aTotal.toLocaleString(), 'right');
                y += 8; if(y > 260) { doc.addPage(); y = 20; }
            });
        }
    });

    y += 5;
    const finalAmt = Math.floor(totalAmt * (1 - discountRate));
    const discountAmt = totalAmt - finalAmt;
    const vat = Math.floor(finalAmt / 11);
    const supply = finalAmt - vat;
    const summaryX = 105; 
    
    drawText(doc, "공급가액 :", summaryX, y+5, {align:'right'});
    drawText(doc, supply.toLocaleString() + " 원", 195, y+5, {align:'right'}); y+=6;
    drawText(doc, "부 가 세 :", summaryX, y+5, {align:'right'});
    drawText(doc, vat.toLocaleString() + " 원", 195, y+5, {align:'right'}); y+=6;

    if (discountAmt > 0) {
        doc.setTextColor(255, 0, 0); 
        drawText(doc, `할인금액 (${(discountRate*100).toFixed(0)}%) :`, summaryX, y+5, {align:'right'}, "#ff0000");
        drawText(doc, "-" + discountAmt.toLocaleString() + " 원", 195, y+5, {align:'right'}, "#ff0000"); y+=6;
    }
    y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(summaryX-20, y, 195, y); y += 8;
    drawText(doc, "합계금액 (VAT포함)", summaryX, y, {align:'right', weight:'bold'});
    doc.setFontSize(14);
    drawText(doc, finalAmt.toLocaleString() + " 원", 195, y, {align:'right', weight:'bold'}, "#1a237e"); 

    doc.setFontSize(10);
    drawText(doc, "위와 같이 견적합니다.", 105, 250, {align:'center'});
    drawText(doc, new Date().toLocaleDateString(), 105, 256, {align:'center'});
    return doc.output('blob');
}

// ==========================================================
// [9] 작업지시서 생성 (Order Sheet) - ★ 완벽 수정됨
// ==========================================================
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    if (!window.jspdf) return alert("PDF Loading...");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (!item.product) continue;

        if (i > 0) doc.addPage();
        
        // 헤더
        const NAVY_CMYK = "#1a237e"; 
        const [c,m,yk,k] = hexToCMYK(NAVY_CMYK);
        doc.setFillColor(c,m,yk,k); doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(0,0,0,0); doc.setFontSize(18); 
        drawText(doc, "작 업 지 시 서", 105, 13, { align: 'center', weight: 'bold' }, "#ffffff");
        
        const startY = 30; 
        doc.setTextColor(0,0,0,1); doc.setFontSize(11); 
        doc.setDrawColor(0.8, 0, 0, 0.1); 
        // [수정] 박스 높이 늘림 (배송일 추가 공간 확보)
        doc.rect(15, startY, 180, 50); 

        drawText(doc, `주 문 번 호 :  ${orderInfo.id || 'PREVIEW'}`, 20, startY + 8, {weight:'bold'});
        drawText(doc, `주 문 일 자 :  ${new Date().toLocaleString()}`, 110, startY + 8);
        drawLine(doc, 15, startY+12, 195, startY+12, "#cccccc"); 

        // ★ [추가] 배송 희망일 (강조)
        doc.setTextColor(0, 1, 1, 0); // Red
        doc.setFontSize(12);
        drawText(doc, `배 송 희 망 일 :  ${orderInfo.date || '미지정'}`, 20, startY + 18, {weight:'bold'}, "#ff0000");
        
        // 다시 기본색
        doc.setTextColor(0,0,0,1); 
        doc.setFontSize(11);

        drawText(doc, `주   문   자 :  ${orderInfo.manager || '-'}`, 20, startY + 26);
        drawText(doc, `연   락   처 :  ${orderInfo.phone || '-'}`, 110, startY + 26);
        
        drawText(doc, `배 송 주 소 :`, 20, startY + 34);
        doc.setFontSize(10);
        drawText(doc, `${orderInfo.address || '-'}`, 45, startY + 34, {maxWidth: 140});
        
        doc.setFontSize(11);
        drawText(doc, `요 청 사 항 :`, 20, startY + 44);
        doc.setTextColor(0, 1, 1, 0); 
        drawText(doc, `${orderInfo.note || '없음'}`, 45, startY + 44, {maxWidth: 140, weight:'bold'}, "#ff0000");

        // ★ [복구] 담당자 실명 정보
        const staffY = startY + 55; // 위치 조정
        doc.setFillColor(255, 247, 237); // 연한 주황
        doc.setDrawColor(249, 115, 22); 
        doc.rect(15, staffY, 180, 15, 'F'); 
        doc.rect(15, staffY, 180, 15);
        
        doc.setTextColor(194, 65, 12); 
        doc.setFontSize(10);
        drawText(doc, `배송책임자 : 서용규 (010-8272-3017)  |  제작책임자 : 변지웅 (010-5512-5366)`, 105, staffY + 8.5, {align:'center'}, "#c2410c");

        const prodY = staffY + 25;
        doc.setTextColor(0, 0, 0, 1);
        doc.setFillColor(0.1, 0, 0, 0.05); doc.rect(15, prodY, 180, 10, 'F'); doc.rect(15, prodY, 180, 10); 
        drawText(doc, "제 작 사양", 20, prodY + 7, {weight:'bold'}, "#000000");
        drawText(doc, `수량: ${item.qty}개`, 185, prodY + 7, {align:'right', weight:'bold'}, "#000000");

        const infoY = prodY + 15;
        doc.setFontSize(14);
        drawText(doc, `품명: ${item.product.name}`, 20, infoY, {weight:'bold'});
        doc.setFontSize(11);
        let optY = infoY + 8;
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code]; if(!add) return;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                drawText(doc, `• ${add.name} (x${qty})`, 25, optY);
                optY += 6;
            });
        } else {
            drawText(doc, "• 기본 사양", 25, optY);
            optY += 6;
        }

        const imgBoxY = optY + 5;
        const imgBoxH = 100;
        doc.setDrawColor(0); doc.rect(15, imgBoxY, 180, imgBoxH); 
        drawText(doc, "< 디자인 시안 확인 >", 105, imgBoxY - 2, {align:'center', size:9}, "#666666");

        let imgData = null; 
        if (item.thumb && item.thumb.startsWith('data:image')) imgData = item.thumb;
        else if (item.thumb) imgData = await getSafeImageDataUrl(item.thumb);
        else if (item.originalUrl && item.mimeType?.startsWith('image')) imgData = await getSafeImageDataUrl(item.originalUrl);

        if (imgData) {
            try {
                let format = 'PNG'; if (imgData.startsWith('data:image/jpeg')) format = 'JPEG';
                const imgProps = doc.getImageProperties(imgData);
                const maxW = 178; const maxH = 98;
                let w = maxW; let h = (imgProps.height * w) / imgProps.width;
                if (h > maxH) { h = maxH; w = (imgProps.width * h) / imgProps.height; }
                const imgX = 105 - (w / 2); const imgY = imgBoxY + (imgBoxH / 2) - (h / 2);
                doc.addImage(imgData, format, imgX, imgY, w, h);
            } catch (err) {}
        } else {
            drawText(doc, "이미지 없음", 105, imgBoxY + 50, {align:'center'});
        }

        // [QR 대신 상세 텍스트] - 보안 문제 해결
        const qrY = 255;
        doc.setDrawColor(0); doc.rect(15, qrY, 180, 30);
        drawLine(doc, 15, qrY+10, 195, qrY+10);
        
        drawText(doc, "제 작 담 당", 45, qrY+7, {align:'center', weight:'bold'});
        drawText(doc, "검 수 / 출 고", 105, qrY+7, {align:'center', weight:'bold'});
        drawText(doc, "배 송 담 당", 165, qrY+7, {align:'center', weight:'bold'});
        
        drawLine(doc, 75, qrY, 75, qrY+30);
        drawLine(doc, 135, qrY, 135, qrY+30);

        doc.setFontSize(9); 
        drawText(doc, "Generated by Chameleon Printing System", 105, 290, { align: 'center' }, "#888888");
    }
    return doc.output('blob');
}

if (!window.Buffer) {
    window.Buffer = { from: (data) => ({ toString: () => String.fromCharCode.apply(null, new Uint8Array(data)) }) };
}