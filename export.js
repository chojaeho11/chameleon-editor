import { canvas } from "./canvas-core.js?v=122";
import { ADDON_DB, currentUser, sb } from "./config.js?v=122";
import { pageDataList, currentPageIndex } from "./canvas-pages.js?v=122"; // 페이지 인덱스 가져오기

// [안전장치] 언어별 기본 폰트 URL 설정
const FONT_CONFIG = {
    kr: {
        url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
        name: "NanumGothic"
    },
    // export.js 수정 (일본어 폰트 주소 변경)
jp: {
    // 수파베이스 대신 빠르고 제한 없는 구글 폰트 CDN 주소 사용
    url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP-Regular.ttf",
    name: "NotoSansJP"
},
    us: {
        url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf",
        name: "NanumGothic"
    },
    cn: {
        url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
        name: "NotoSansSC"
    },
    ar: {
        url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic%5Bwght%5D.ttf",
        name: "NotoSansArabic"
    },
    es: {
        url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
        name: "Inter"
    }
};

// 현재 URL/도메인에서 언어 설정 가져오기
const urlParams = new URLSearchParams(window.location.search);
let _exportLang = urlParams.get('lang');
if (!_exportLang) {
    const _eh = window.location.hostname;
    if (_eh.includes('cafe0101.com')) _exportLang = 'ja';
    else if (_eh.includes('cafe3355.com')) _exportLang = 'us';
    else _exportLang = 'kr';
}
const CURRENT_LANG_CODE = _exportLang.toLowerCase();
const _fontKey = { 'ja': 'jp', 'jp': 'jp', 'en': 'us', 'us': 'us', 'kr': 'kr', 'zh': 'cn', 'cn': 'cn', 'ar': 'ar', 'es': 'es' }[CURRENT_LANG_CODE] || 'kr';
const TARGET_FONT = FONT_CONFIG[_fontKey] || FONT_CONFIG['kr'];

const BASE_FONT_NAME = TARGET_FONT.name;

// [신규] PDF 내부 고정 텍스트 다국어 정의
const PDF_LABELS = {
    kr: {
        quote_title: "견 적 서",
        receipt_title: "영 수 증",
        statement_title: "거 래 명 세 서",
        ordersheet_title: "작 업 지 시 서",
        recipient: "[ 수신자 ]",
        name: "성   명 :",
        phone: "연 락 처 :",
        address: "주   소 :",
        provider_labels: ["등록번호", "상      호", "대      표", "주      소", "업      태", "연 락 처"],
        provider_values: ["470-81-02808", "(주)카멜레온프린팅", "조재호", "경기 화성시 우정읍 한말길 72-2", "제조업 / 서비스업", "031-366-1984"],
        headers: ["No", "품목명", "규격/옵션", "수량", "단가", "금액"],
        supply_price: "공급가액 :",
        vat: "부 가 세 :",
        discount: "할인금액 :",
        mileage: "마일리지 :",
        total_amount: "합계금액 (VAT포함)",
        footer_claim: "위와 같이 청구(영수)합니다.",
        staff_make: "제 작 담 당",
        staff_check: "검 수 / 출 고",
        staff_ship: "배 송 담 당",
        payment_card: "신용카드로 결제되었습니다.",
        payment_bank: "계좌이체로 결제되었습니다.",
        payment_deposit: "예치금으로 결제되었습니다.",
        opt_default: "기본 사양",
        opt_add: "추가 옵션",
        ordersheet_order_no: "주 문 번 호",
        ordersheet_date: "접 수 일 자",
        ordersheet_customer: "주   문   자",
        ordersheet_phone: "연   락   처",
        ordersheet_address: "배 송 주 소",
        ordersheet_request: "요 청 사 항",
        ordersheet_none: "없음",
        ordersheet_unspecified: "미지정",
        ordersheet_delivery_date: "배송 희망일",
        ordersheet_prod_spec: "제 작 사 양",
        ordersheet_qty_unit: "개",
        ordersheet_qty_label: "수량",
        ordersheet_design_preview: "디자인 시안 확인",
        ordersheet_no_image: "이미지 없음 (파일 별도 확인)",
        ordersheet_page_label: "Page"
    },
    ja: {
        quote_title: "御 見 積 書",
        receipt_title: "領 収 書",
        statement_title: "納 品 書",
        ordersheet_title: "発 注 書",
        recipient: "[ 受信者 ]",
        name: "氏   名 :",
        phone: "連絡先 :",
        address: "住   所 :",
        provider_labels: ["登録番号", "商      号", "代      表", "住      所", "業      態", "連絡先"],
        provider_values: ["2025-京畿華城-0033", "(株)カメレオンプリンティング", "趙 宰鎬", "京畿道 華城市 雨汀邑 ハンマルギル 72-2", "製造業 / サービス業", "047-712-1148"],
        headers: ["No", "品名", "仕様/オプション", "数量", "単価", "金額"],
        supply_price: "税抜金額 :",
        vat: "消費税 :",
        discount: "割引金額 :",
        mileage: "ポイント使用 :",
        total_amount: "合計金額 (税込)",
        footer_claim: "上記の通り、相違なく領収いたしました。",
        staff_make: "制作担当",
        staff_check: "検品/出荷",
        staff_ship: "配送担当",
        payment_card: "クレジットカード決済完了",
        payment_bank: "銀行振込完了",
        payment_deposit: "デポジット決済完了",
        opt_default: "基本仕様",
        opt_add: "追加オプション",
        ordersheet_order_no: "注文番号",
        ordersheet_date: "受付日",
        ordersheet_customer: "注文者",
        ordersheet_phone: "連絡先",
        ordersheet_address: "配送先住所",
        ordersheet_request: "備考・要望",
        ordersheet_none: "なし",
        ordersheet_unspecified: "未指定",
        ordersheet_delivery_date: "配送希望日",
        ordersheet_prod_spec: "製作仕様",
        ordersheet_qty_unit: "個",
        ordersheet_qty_label: "数量",
        ordersheet_design_preview: "デザインプレビュー",
        ordersheet_no_image: "画像なし（ファイルを別途ご確認ください）",
        ordersheet_page_label: "Page"
    },
    us: {
        quote_title: "QUOTATION",
        receipt_title: "RECEIPT",
        statement_title: "INVOICE",
        ordersheet_title: "WORK ORDER",
        recipient: "[ Customer ]",
        name: "Name :",
        phone: "Phone :",
        address: "Addr :",
        provider_labels: ["Reg No.", "Company", "CEO", "Address", "Type", "Contact"],
        provider_values: ["470-81-02808", "Chameleon Printing Inc.", "Jae-ho Cho", "72-2 Hanmal-gil, Ujeong-eup, Hwaseong-si", "Manufacturing", "+82-31-366-1984"],
        headers: ["No", "Item", "Spec/Option", "Qty", "Price", "Amount"],
        supply_price: "Subtotal :",
        vat: "Sales Tax :",
        discount: "Discount :",
        mileage: "Points Used :",
        total_amount: "Grand Total",
        footer_claim: "Authorized Signature",
        staff_make: "Production",
        staff_check: "Inspection",
        staff_ship: "Shipping",
        payment_card: "Paid by Credit Card",
        payment_bank: "Paid by Bank Transfer",
        payment_deposit: "Paid by Deposit",
        opt_default: "Basic Spec",
        opt_add: "Add-ons",
        ordersheet_order_no: "Order No.",
        ordersheet_date: "Date",
        ordersheet_customer: "Customer",
        ordersheet_phone: "Phone",
        ordersheet_address: "Ship To",
        ordersheet_request: "Notes",
        ordersheet_none: "None",
        ordersheet_unspecified: "TBD",
        ordersheet_delivery_date: "Requested Delivery",
        ordersheet_prod_spec: "SPECIFICATIONS",
        ordersheet_qty_unit: "pcs",
        ordersheet_qty_label: "Qty",
        ordersheet_design_preview: "Design Preview",
        ordersheet_no_image: "No image (see attached file)",
        ordersheet_page_label: "Page"
    },
    zh: {
        quote_title: "报 价 单",
        receipt_title: "收 据",
        statement_title: "交 易 明 细",
        ordersheet_title: "工 作 指 示 单",
        recipient: "[ 收件人 ]",
        name: "姓   名 :",
        phone: "联系方式 :",
        address: "地   址 :",
        provider_labels: ["注册号", "公司名称", "代表人", "地   址", "行   业", "联系方式"],
        provider_values: ["470-81-02808", "Chameleon Printing Inc.", "Jae-ho Cho", "72-2 Hanmal-gil, Ujeong-eup, Hwaseong-si", "Manufacturing", "+82-31-366-1984"],
        headers: ["No", "品名", "规格/选项", "数量", "单价", "金额"],
        supply_price: "供应价 :",
        vat: "增值税 :",
        discount: "折扣金额 :",
        mileage: "积分使用 :",
        total_amount: "合计金额 (含税)",
        footer_claim: "以上内容确认无误。",
        staff_make: "制作负责",
        staff_check: "检验/出库",
        staff_ship: "配送负责",
        payment_card: "信用卡支付完成",
        payment_bank: "银行转账支付完成",
        payment_deposit: "预存款支付完成",
        opt_default: "基本规格",
        opt_add: "附加选项",
        ordersheet_order_no: "订 单 号",
        ordersheet_date: "接 收 日",
        ordersheet_customer: "下 单 人",
        ordersheet_phone: "联系方式",
        ordersheet_address: "配送地址",
        ordersheet_request: "备注要求",
        ordersheet_none: "无",
        ordersheet_unspecified: "未指定",
        ordersheet_delivery_date: "期望配送日",
        ordersheet_prod_spec: "制 作 规 格",
        ordersheet_qty_unit: "个",
        ordersheet_qty_label: "数量",
        ordersheet_design_preview: "设计预览",
        ordersheet_no_image: "无图片（请另行确认文件）",
        ordersheet_page_label: "Page"
    },
    ar: {
        quote_title: "عرض سعر",
        receipt_title: "إيصال",
        statement_title: "كشف حساب",
        ordersheet_title: "أمر عمل",
        recipient: "[ المستلم ]",
        name: "الاسم :",
        phone: "الهاتف :",
        address: "العنوان :",
        provider_labels: ["رقم التسجيل", "الشركة", "المدير", "العنوان", "النشاط", "الاتصال"],
        provider_values: ["470-81-02808", "Chameleon Printing Inc.", "Jae-ho Cho", "72-2 Hanmal-gil, Ujeong-eup, Hwaseong-si", "Manufacturing", "+82-31-366-1984"],
        headers: ["رقم", "الصنف", "المواصفات", "الكمية", "السعر", "المبلغ"],
        supply_price: "المبلغ قبل الضريبة :",
        vat: "ضريبة القيمة المضافة :",
        discount: "الخصم :",
        mileage: "النقاط المستخدمة :",
        total_amount: "المبلغ الإجمالي",
        footer_claim: "التوقيع المعتمد",
        staff_make: "الإنتاج",
        staff_check: "الفحص",
        staff_ship: "الشحن",
        payment_card: "تم الدفع ببطاقة الائتمان",
        payment_bank: "تم الدفع بالتحويل البنكي",
        payment_deposit: "تم الدفع من الرصيد",
        opt_default: "المواصفات الأساسية",
        opt_add: "خيارات إضافية",
        ordersheet_order_no: "رقم الطلب",
        ordersheet_date: "التاريخ",
        ordersheet_customer: "العميل",
        ordersheet_phone: "الهاتف",
        ordersheet_address: "عنوان الشحن",
        ordersheet_request: "ملاحظات",
        ordersheet_none: "لا يوجد",
        ordersheet_unspecified: "غير محدد",
        ordersheet_delivery_date: "تاريخ التسليم المطلوب",
        ordersheet_prod_spec: "مواصفات التصنيع",
        ordersheet_qty_unit: "قطعة",
        ordersheet_qty_label: "الكمية",
        ordersheet_design_preview: "معاينة التصميم",
        ordersheet_no_image: "لا توجد صورة (راجع الملف المرفق)",
        ordersheet_page_label: "Page"
    },
    es: {
        quote_title: "PRESUPUESTO",
        receipt_title: "RECIBO",
        statement_title: "FACTURA",
        ordersheet_title: "ORDEN DE TRABAJO",
        recipient: "[ Cliente ]",
        name: "Nombre :",
        phone: "Teléfono :",
        address: "Dirección :",
        provider_labels: ["Nº Registro", "Empresa", "Director", "Dirección", "Sector", "Contacto"],
        provider_values: ["470-81-02808", "Chameleon Printing Inc.", "Jae-ho Cho", "72-2 Hanmal-gil, Ujeong-eup, Hwaseong-si", "Manufacturing", "+82-31-366-1984"],
        headers: ["Nº", "Artículo", "Especificación", "Cant.", "Precio", "Importe"],
        supply_price: "Subtotal :",
        vat: "IVA :",
        discount: "Descuento :",
        mileage: "Puntos usados :",
        total_amount: "Total (IVA incluido)",
        footer_claim: "Firma autorizada",
        staff_make: "Producción",
        staff_check: "Inspección",
        staff_ship: "Envío",
        payment_card: "Pagado con tarjeta de crédito",
        payment_bank: "Pagado por transferencia bancaria",
        payment_deposit: "Pagado con depósito",
        opt_default: "Especificación básica",
        opt_add: "Opciones adicionales",
        ordersheet_order_no: "Nº de pedido",
        ordersheet_date: "Fecha",
        ordersheet_customer: "Cliente",
        ordersheet_phone: "Teléfono",
        ordersheet_address: "Dirección de envío",
        ordersheet_request: "Observaciones",
        ordersheet_none: "Ninguno",
        ordersheet_unspecified: "No especificado",
        ordersheet_delivery_date: "Fecha de entrega solicitada",
        ordersheet_prod_spec: "ESPECIFICACIONES",
        ordersheet_qty_unit: "uds",
        ordersheet_qty_label: "Cant.",
        ordersheet_design_preview: "Vista previa del diseño",
        ordersheet_no_image: "Sin imagen (ver archivo adjunto)",
        ordersheet_page_label: "Página"
    }
};

// 현재 언어 라벨 가져오기 (없으면 한국어)
const TEXT = PDF_LABELS[CURRENT_LANG_CODE] || PDF_LABELS['kr'];

// 직인 이미지
const STAMP_IMAGE_URL = "https://gdadmin.signmini.com/data/etc/stampImage";

// ==========================================================
// [1] 내보내기 버튼 초기화 (주문 시스템 방식 적용)
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
            // [수정] 다국어 적용
            if (!currentUser) return alert(window.t('msg_login_required', "Login required."));
            
            const btn = btnPNG;
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${window.t('msg_saving', "Saving...")}`;
            btn.disabled = true;

            try {
                // 주문 시스템 로직(generateRasterPDF)을 활용하여 PNG 생성
                const board = canvas.getObjects().find(o => o.isBoard);
                const finalW = board ? board.width * board.scaleX : canvas.width;
                const finalH = board ? board.height * board.scaleY : canvas.height;
                const cropX = board ? board.left : 0;
                const cropY = board ? board.top : 0;

                const json = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented']);
                
                // 가상 캔버스 생성
                const tempEl = document.createElement('canvas');
                const tempCanvas = new fabric.StaticCanvas(tempEl);
                tempCanvas.setWidth(finalW); 
                tempCanvas.setHeight(finalH);
                tempCanvas.setBackgroundColor('#ffffff'); // 흰색 배경

                await new Promise(resolve => {
                    tempCanvas.loadFromJSON(json, () => {
                        // 뷰포트 이동으로 좌표 보정 (이동 X, 이동 Y)
                        tempCanvas.setViewportTransform([1, 0, 0, 1, -cropX, -cropY]);
                        tempCanvas.renderAll();
                        setTimeout(resolve, 500); // 렌더링 안정화
                    });
                });

                const dataUrl = tempCanvas.toDataURL({ format: 'png', multiplier: 2 });
                
                const link = document.createElement('a');
                link.download = `design_${new Date().getTime()}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                tempCanvas.dispose();

            } catch (err) {
                console.error("PNG 저장 실패:", err);
                // [수정] 다국어 적용
                alert(window.t('msg_save_failed', "Save Failed."));
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        };
    }

    // 3. PDF 다운로드 (★ 핵심: 주문 시스템 함수 호출 ★)
    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = async () => {
            // [수정] fallback 추가
            if (!currentUser) return alert(window.t('msg_login_required', "Login is required."));

            const btn = btnPDF;
            const originalText = btn.innerText;
            // [수정] 다국어 적용
            btn.innerText = window.t('msg_generating_print_pdf', "Generating PDF...");
            btn.disabled = true;

            try {
                // 1. 데이터 최신화 (현재 작업중인 페이지 저장)
                const currentJson = canvas.toJSON(['id', 'isBoard', 'selectable', 'evented', 'locked', 'isGuide']);
                let targetPages = [];

                if (pageDataList && pageDataList.length > 0) {
                    targetPages = [...pageDataList];
                    // 현재 보고 있는 페이지 업데이트
                    if (typeof currentPageIndex !== 'undefined' && currentPageIndex >= 0) {
                        targetPages[currentPageIndex] = currentJson;
                    } else {
                        targetPages[targetPages.length - 1] = currentJson;
                    }
                } else {
                    targetPages = [currentJson];
                }

                // 2. 대지 정보 계산 (주문 시스템과 동일한 기준)
                const board = canvas.getObjects().find(o => o.isBoard);
                const finalW = board ? board.width * board.scaleX : canvas.width;
                const finalH = board ? board.height * board.scaleY : canvas.height;
                const boardX = board ? board.left : 0;
                const boardY = board ? board.top : 0;

                // 3. ★ 핵심 ★ 주문 시스템 함수(generateProductVectorPDF)를 그대로 호출
                // 이렇게 하면 주문했을 때 관리자가 보는 파일과 똑같은 파일이 생성됩니다.
                let blob = await generateProductVectorPDF(targetPages, finalW, finalH, boardX, boardY);
                
                // 만약 벡터 생성 실패 시 래스터(이미지) 방식으로 재시도
                if (!blob) {
                    console.log("벡터 PDF 실패 -> 래스터 PDF 전환");
                    blob = await generateRasterPDF(targetPages, finalW, finalH, boardX, boardY);
                }

                if (blob) {
                    downloadBlob(blob, `design_result_${Date.now()}.pdf`);
                    // [수정] 다국어 적용
                    alert(window.t('msg_design_saved', "PDF Downloaded!"));
                } else {
                    throw new Error("PDF Generation Failed.");
                }

            } catch (err) {
                console.error("PDF 생성 오류:", err);
                // [수정] 다국어 적용
                alert(window.t('err_quote_gen_failed', "Error generating PDF.") + "\n" + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    }
}

// ==========================================================
// [2] 유틸리티 및 헬퍼 함수
// ==========================================================
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadFile(url, fileName) { 
    const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); 
}

function hexToCMYK(hex) {
    let c = 0, m = 0, y = 0, k = 0;
    hex = (hex.charAt(0) == "#") ? hex.substring(1, 7) : hex;
    if (hex.length != 6) return [0, 0, 0, 1]; 
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 1];
    if (r === 255 && g === 255 && b === 255) return [0, 0, 0, 0];
    c = 1 - (r / 255); m = 1 - (g / 255); y = 1 - (b / 255);
    let minCMY = Math.min(c, Math.min(m, y));
    c = (c - minCMY) / (1 - minCMY); m = (m - minCMY) / (1 - minCMY); y = (y - minCMY) / (1 - minCMY); k = minCMY;
    return [c, m, y, k];
}

async function getSafeImageDataUrl(url) {
    if (!url) return null;
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            console.warn("[getSafeImageDataUrl] 15초 타임아웃:", url);
            resolve(null);
        }, 15000);
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            clearTimeout(timeout);
            const isMobile = window.innerWidth <= 768;
            const MAX_SIZE = isMobile ? 800 : 1500;
            let w = img.width; let h = img.height;
            if (w > MAX_SIZE || h > MAX_SIZE) {
                if (w > h) { h = Math.round((h * MAX_SIZE) / w); w = MAX_SIZE; }
                else { w = Math.round((w * MAX_SIZE) / h); h = MAX_SIZE; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try { resolve(c.toDataURL('image/jpeg', isMobile ? 0.6 : 0.8)); } catch(e) { resolve(null); }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(null); };
    });
}

// ==========================================================
// [3] PDF 폰트 로더
// ==========================================================
// [3] PDF 폰트 로더 (DB 연동형으로 업그레이드)
const fontBufferCache = {};

async function loadPdfFonts(doc) {
    let targetUrl = TARGET_FONT.url; // 기본값 (백업용)
    
    // 1. 에디터처럼 DB에서 폰트 주소 가져오기
    try {
        // 언어 코드 매핑 (kr->KR, jp->JA, us->US 등)
        const langMap = { 'kr': 'KR', 'jp': 'JA', 'ja': 'JA', 'us': 'EN', 'en': 'EN' };
        const dbLangCode = langMap[CURRENT_LANG_CODE] || 'KR';
        
        console.log(`[PDF] DB에서 ${dbLangCode} 폰트 검색 시도...`);
        
        // Supabase DB 조회 (site_fonts 테이블)
        const { data, error } = await sb
            .from('site_fonts')
            .select('file_url')
            .eq('site_code', dbLangCode)
            .order('id', { ascending: true }) // 정렬 기준
            .limit(1); // 가장 첫 번째 폰트 가져오기

        if (data && data.length > 0 && data[0].file_url) {
            targetUrl = data[0].file_url;
            console.log(`[PDF] DB 폰트 주소 확보 성공: ${targetUrl}`);
        } else {
            console.warn("[PDF] DB에 해당 언어 폰트가 없어 기본 설정 사용");
        }
    } catch (err) {
        console.error("[PDF] DB 조회 중 오류 (기본값 사용):", err);
    }

    // 2. 확보된 주소로 폰트 다운로드 및 적용 (기존 로직 유지)
    if (!fontBufferCache[BASE_FONT_NAME]) {
        try {
            // [중요] fetch 옵션에 mode: 'cors' 명시
            const res = await fetch(targetUrl, { mode: 'cors' });
            if (res.ok) {
                fontBufferCache[BASE_FONT_NAME] = await res.arrayBuffer();
            } else {
                throw new Error(`다운로드 실패 상태코드: ${res.status}`);
            }
        } catch (e) { 
            console.error("폰트 다운로드 실패, 백업(KR) 시도:", e);
            try {
                // 실패 시 한국어 폰트라도 시도
                const backupRes = await fetch(FONT_CONFIG['kr'].url);
                if(backupRes.ok) fontBufferCache[BASE_FONT_NAME] = await backupRes.arrayBuffer();
            } catch(err) { console.error("백업 폰트 치명적 오류:", err); }
        }
    }
    
    if (fontBufferCache[BASE_FONT_NAME]) {
        const fontData = (function(buffer) {
            let binary = ''; const bytes = new Uint8Array(buffer); const len = bytes.byteLength;
            for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
            return window.btoa(binary);
        })(fontBufferCache[BASE_FONT_NAME]);

        if (!doc.existsFileInVFS(BASE_FONT_NAME + ".ttf")) {
            doc.addFileToVFS(BASE_FONT_NAME + ".ttf", fontData);
            doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "normal");
            doc.addFont(BASE_FONT_NAME + ".ttf", BASE_FONT_NAME, "bold");
        }
        doc.setFont(BASE_FONT_NAME);
    }
}

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
    
    doc.setDrawColor(0); 
    doc.setLineWidth(0.1); 
    doc.rect(x, y, w, h);
    
    doc.setTextColor(0, 0, 0, 1);
    doc.setFont(BASE_FONT_NAME, isHeader ? 'bold' : 'normal');
    
    const textX = align === 'left' ? x + 2 : (align === 'right' ? x + w - 2 : x + w/2);
    
    // [수정] 텍스트가 배열(여러 줄)일 때 수직 중앙 정렬 계산
    if (Array.isArray(text)) {
        const lineHeight = fontSize * 0.45; // 줄 간격 보정값
        // 텍스트 블록의 전체 높이 계산 후 시작 Y좌표 설정
        const totalTextHeight = (text.length - 1) * lineHeight * 1.15;
        const startY = y + (h / 2) - (totalTextHeight / 2) + (fontSize / 3.5);
        
        doc.text(text, textX, startY, { align: align, lineHeightFactor: 1.15 });
    } else {
        // 한 줄일 때는 기존 방식 유지
        doc.text(String(text), textX, y + (h/2) + (fontSize/3.5), { align: align, maxWidth: w-4 });
    }
}

// ==========================================================
// [4] 벡터(아웃라인) PDF 생성 함수 (주문 시스템 로직)
// ==========================================================
export async function generateProductVectorPDF(inputData, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    const pages = Array.isArray(inputData) ? inputData : [inputData];
    
    try {
        const MM_TO_PX = 3.7795; 
        const widthMM = w / MM_TO_PX; const heightMM = h / MM_TO_PX;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM], compress: true });

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) doc.addPage([widthMM, heightMM], widthMM > heightMM ? 'l' : 'p');
            const json = pages[i];
            
            // 가상 캔버스 생성
            const tempElement = document.createElement('canvas');
            const tempCanvas = new fabric.StaticCanvas(tempElement);
            tempCanvas.setWidth(w); tempCanvas.setHeight(h);
            tempCanvas.setBackgroundColor('#ffffff'); // 배경 흰색

            await new Promise((resolve) => {
                tempCanvas.loadFromJSON(json, () => {
                    // ★ 핵심: 뷰포트를 이동시켜서 대지 영역을 (0,0)으로 맞춤
                    // 대지의 시작점(x, y)만큼 반대로 이동(-x, -y)시키면 대지가 캔버스의 (0,0)에 오게 됨
                    if (json.objects) tempCanvas.setViewportTransform([1, 0, 0, 1, -x, -y]);
                    resolve();
                });
            });
            
            // 텍스트 패스 변환 (글자 깨짐 방지)
            await convertCanvasTextToPaths(tempCanvas);

            // SVG 생성 (뷰포트가 적용된 상태 그대로 출력)
            const svgStr = tempCanvas.toSVG({ 
                viewBox: { x: 0, y: 0, width: w, height: h }, // 여기서 x,y는 0으로 고정 (이미 Viewport로 이동했으므로)
                width: w, height: h, 
                suppressPreamble: true 
            });
            
            const parser = new DOMParser();
            const svgElem = parser.parseFromString(svgStr, "image/svg+xml").documentElement;
            await doc.svg(svgElem, { x: 0, y: 0, width: widthMM, height: heightMM });
            tempCanvas.dispose();
        }
        return doc.output('blob');
    } catch (e) { console.error("Vector Gen Error:", e); return null; }
}

// 텍스트 패스 변환 헬퍼 (벡터 PDF용)
async function convertCanvasTextToPaths(fabricCanvas) {
    if (!window.opentype) return;
    const fontList = []; 
    try {
        const { data } = await sb.from('site_fonts').select('font_family, file_url');
        if (data) data.forEach(f => fontList.push({ normalized: f.font_family.toLowerCase().replace(/[\s\-_]/g, ''), url: f.file_url }));
    } catch(e) {}
    
    const loadedFonts = {}; 
    const findFontUrl = (name) => {
        // [수정] 기본 폰트를 현재 언어 설정에 맞게 변경
        if (!name) return TARGET_FONT.url;
        
        const target = name.toLowerCase().replace(/[\s\-_]/g, '');
        const match = fontList.find(f => target.includes(f.normalized));
        
        // 매칭되는 폰트가 없으면 현재 언어의 기본 폰트 사용
        return match ? match.url : TARGET_FONT.url;
    };

    const processObjects = async (objects) => {
        for (let i = objects.length - 1; i >= 0; i--) {
            let obj = objects[i];
            if (obj.type === 'group') await processObjects(obj.getObjects());
            else if (['i-text', 'text', 'textbox'].includes(obj.type)) {
                try {
                    const fontUrl = findFontUrl(obj.fontFamily);
                    if (!loadedFonts[fontUrl]) {
                        const buffer = await (await fetch(fontUrl)).arrayBuffer();
                        loadedFonts[fontUrl] = window.opentype.parse(buffer);
                    }
                    const font = loadedFonts[fontUrl];
                    const fontSize = obj.fontSize;
                    const lineHeightPx = obj.lineHeight * fontSize;
                    const textLines = obj.text.split(/\r\n|\r|\n/);
                    let startY = -(textLines.length * lineHeightPx / 2) + (fontSize * 0.8);
                    
                    let fullPathData = "";
                    textLines.forEach((line, idx) => {
                        if(line.trim()) {
                            const lineWidth = font.getAdvanceWidth(line, fontSize);
                            let lineX = -obj.width / 2; 
                            if (obj.textAlign === 'center') lineX = -lineWidth / 2;
                            else if (obj.textAlign === 'right') lineX = (obj.width / 2) - lineWidth;
                            fullPathData += font.getPath(line, lineX, startY + (idx * lineHeightPx), fontSize).toPathData(2);
                        }
                    });

                    const fillPathObj = new fabric.Path(fullPathData, {
                        fill: obj.fill, stroke: obj.stroke, strokeWidth: obj.strokeWidth,
                        scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle,
                        left: obj.left, top: obj.top, originX: obj.originX, originY: obj.originY,
                        opacity: obj.opacity, shadow: obj.shadow
                    });

                    if (obj.group) {
                        obj.group.removeWithUpdate(obj);
                        obj.group.addWithUpdate(fillPathObj);
                    } else {
                        const idx = fabricCanvas.getObjects().indexOf(obj);
                        fabricCanvas.remove(obj);
                        fabricCanvas.insertAt(fillPathObj, idx);
                    }
                } catch (err) {}
            }
        }
    };
    await processObjects(fabricCanvas.getObjects());
}

// 래스터(이미지) PDF 생성 함수
export async function generateRasterPDF(inputData, w, h, x = 0, y = 0) {
    if (!window.jspdf) return null;
    const pages = Array.isArray(inputData) ? inputData : [inputData];
    try {
        const MM_TO_PX = 3.7795;
        const widthMM = w / MM_TO_PX; const heightMM = h / MM_TO_PX;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: widthMM > heightMM ? 'l' : 'p', unit: 'mm', format: [widthMM, heightMM] });

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) doc.addPage([widthMM, heightMM], widthMM > heightMM ? 'l' : 'p');
            const tempEl = document.createElement('canvas');
            const tempCvs = new fabric.StaticCanvas(tempEl);
            tempCvs.setWidth(w); tempCvs.setHeight(h);
            tempCvs.setBackgroundColor('#ffffff'); // 흰색 배경

            await new Promise(resolve => {
                tempCvs.loadFromJSON(pages[i], () => {
                    // 좌표 보정
                    tempCvs.setViewportTransform([1, 0, 0, 1, -x, -y]);
                    tempCvs.renderAll();
                    setTimeout(resolve, 300);
                });
            });
            const isMobileDevice = window.innerWidth <= 768;
            const imgData = tempCvs.toDataURL({ format: 'jpeg', quality: isMobileDevice ? 0.7 : 0.95, multiplier: isMobileDevice ? 1 : 2 });
            doc.addImage(imgData, 'JPEG', 0, 0, widthMM, heightMM);
            tempCvs.dispose();
        }
        return doc.output('blob');
    } catch (e) { return null; }
}

// ==========================================================
// [5] 견적서, 명세서, 영수증, 지시서 (order.js용)
// ==========================================================

export async function generateQuotationPDF(orderInfo, cartItems, discountRate = 0, usedMileage = 0) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 
    // [수정] 언어에 맞는 제목 사용
    return generateCommonDocument(doc, TEXT.quote_title, orderInfo, cartItems, discountRate, usedMileage);
}

export async function generateTransactionStatementPDF(orderInfo, cartItems, discountRate = 0, usedMileage = 0) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 
    return generateCommonDocument(doc, TEXT.statement_title, orderInfo, cartItems, discountRate, usedMileage);
}

export async function generateReceiptPDF(orderInfo, cartItems, discountRate = 0, usedMileage = 0) {
    if (!window.jspdf) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 
    return generateCommonDocument(doc, TEXT.receipt_title, orderInfo, cartItems, discountRate, usedMileage);
}

// 공통 문서 생성기 (견적서/명세서/영수증)
// 공통 문서 생성기 (견적서/명세서/영수증) - 다국어 완벽 적용
async function generateCommonDocument(doc, title, orderInfo, cartItems, discountRate, usedMileage) {
    doc.setFontSize(26); 
    // 제목 출력
    drawText(doc, title, 105, 22, { align: 'center', weight: 'bold' });
    drawLine(doc, 15, 28, 195, 28, "#000000", 0.5); 

    const topY = 35; const leftX = 15;
    doc.setFontSize(10);
    
    // [수정] 수신자 정보 (다국어 라벨 TEXT 사용)
    drawText(doc, TEXT.recipient, leftX, topY);
    drawText(doc, `${TEXT.name}  ${orderInfo.manager || '-'}`, leftX, topY+8);
    drawText(doc, `${TEXT.phone}  ${orderInfo.phone || '-'}`, leftX, topY+14);
    drawText(doc, `${TEXT.address}  ${orderInfo.address || '-'}`, leftX, topY+20, { maxWidth: 85 });

    const boxX = 105; const boxY = 32; const cellH = 7; const labelW = 20; const valW = 70;
    
    // [수정] 공급자 정보 (한국/일본/미국 정보 자동 전환)
    const pLabels = TEXT.provider_labels;
    const pValues = TEXT.provider_values;
    const providerInfo = [ 
        [pLabels[0], pValues[0]], 
        [pLabels[1], pValues[1]], 
        [pLabels[2], pValues[2]], 
        [pLabels[3], pValues[3]], 
        [pLabels[4], pValues[4]], 
        [pLabels[5], pValues[5]] 
    ];

    providerInfo.forEach((row, i) => {
        const curY = boxY + (i * cellH);
        drawCell(doc, boxX, curY, labelW, cellH, row[0], 'center', 9, true);
        drawCell(doc, boxX+labelW, curY, valW, cellH, row[1], 'left', 9, false);
    });

    // 직인 이미지
    if (STAMP_IMAGE_URL) {
        try {
            const response = await fetch(STAMP_IMAGE_URL);
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise(resolve => {
                reader.onloadend = () => {
                    if (reader.result) doc.addImage(reader.result, 'PNG', boxX+labelW+45, boxY+cellH+1, 14, 14);
                    resolve();
                };
                reader.readAsDataURL(blob);
            });
        } catch(e) {}
    }

    let y = 85;
    const cols = [10, 50, 40, 20, 30, 30]; 
    // [수정] 테이블 헤더 다국어 적용
    const headers = TEXT.headers;
    let curX = 15;
    headers.forEach((h, i) => { drawCell(doc, curX, y, cols[i], 8, h, 'center', 10, true); curX += cols[i]; });
    y += 8;

    const _cr = window.SITE_CONFIG && window.SITE_CONFIG.CURRENCY_RATE;
    let totalAmt = 0; let no = 1;
    cartItems.forEach(item => {
        if (!item.product) return;

        // 다국어 상품명/가격 선택 로직
        // price는 항상 KRW 등가 (addProductToCartDirectly에서 역환산 완료)
        let pdfName = item.product.name;
        let pdfPrice = item.product.price;
        let pdfOptionLabel = TEXT.opt_default;

        if (CURRENT_LANG_CODE === 'ja' || CURRENT_LANG_CODE === 'jp') {
            if (item.product.name_jp) pdfName = item.product.name_jp;
            if (_cr && _cr.JP) pdfPrice = Math.round(pdfPrice * _cr.JP);
        } else if (CURRENT_LANG_CODE === 'us' || CURRENT_LANG_CODE === 'en') {
            if (item.product.name_us) pdfName = item.product.name_us;
            if (_cr && _cr.US) pdfPrice = Math.round(pdfPrice * _cr.US * 100) / 100;
        }

        const pTotal = (pdfPrice || 0) * (item.qty || 1); 
        totalAmt += pTotal;

        const nameColWidth = cols[1];
        const splitTitle = doc.splitTextToSize(pdfName, nameColWidth - 4);
        const lineCount = splitTitle.length;
        
        const rowHeight = Math.max(8, 4 + (lineCount * 5));

        curX = 15;
        drawCell(doc, curX, y, cols[0], rowHeight, no++, 'center'); curX += cols[0];
        drawCell(doc, curX, y, cols[1], rowHeight, splitTitle, 'left'); curX += cols[1]; 
        drawCell(doc, curX, y, cols[2], rowHeight, pdfOptionLabel, 'left'); curX += cols[2];
        drawCell(doc, curX, y, cols[3], rowHeight, String(item.qty), 'center'); curX += cols[3];
        
        // [수정] 가격 포맷 적용 (formatCurrencyForPDF 사용)
        const priceStr = formatCurrencyForPDF(pdfPrice); 
        const totalStr = formatCurrencyForPDF(pTotal);
        
        drawCell(doc, curX, y, cols[4], rowHeight, priceStr, 'right'); curX += cols[4];
        drawCell(doc, curX, y, cols[5], rowHeight, totalStr, 'right');
        
        y += rowHeight; 
        if(y > 260) { doc.addPage(); y = 20; }
        
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = ADDON_DB[code]; if(!add) return;
                const uQty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                
                // [수정] 옵션 가격 다국어 처리 (ADDON_DB.price는 KRW 등가 - config.js에서 역환산 완료)
                let addPrice = add.price;
                let addName = add.display_name || add.name;
                if ((CURRENT_LANG_CODE === 'ja' || CURRENT_LANG_CODE === 'jp')) {
                    if (_cr && _cr.JP) addPrice = Math.round(addPrice * _cr.JP);
                    if (add.name_jp) addName = add.name_jp;
                } else if (CURRENT_LANG_CODE === 'us' || CURRENT_LANG_CODE === 'en') {
                    if (_cr && _cr.US) addPrice = Math.round(addPrice * _cr.US * 100) / 100;
                    if (add.name_us) addName = add.name_us;
                }

                const aTotal = addPrice * uQty; totalAmt += aTotal;
                
                const addonName = "└ " + addName;
                const splitAddon = doc.splitTextToSize(addonName, nameColWidth - 4);
                const addonRows = splitAddon.length;
                const addonHeight = Math.max(8, 4 + (addonRows * 5));

                curX = 15;
                drawCell(doc, curX, y, cols[0], addonHeight, "", 'center'); curX += cols[0];
                drawCell(doc, curX, y, cols[1], addonHeight, splitAddon, 'left', 8); curX += cols[1];
                drawCell(doc, curX, y, cols[2], addonHeight, TEXT.opt_add, 'left', 8); curX += cols[2];
                drawCell(doc, curX, y, cols[3], addonHeight, String(uQty), 'center'); curX += cols[3];
                drawCell(doc, curX, y, cols[4], addonHeight, formatCurrencyForPDF(addPrice), 'right'); curX += cols[4];
                drawCell(doc, curX, y, cols[5], addonHeight, formatCurrencyForPDF(aTotal), 'right');
                
                y += addonHeight; 
                if(y > 260) { doc.addPage(); y = 20; }
            });
        }
    });

    y += 5;
    const afterRateDiscount = Math.floor(totalAmt * (1 - discountRate));
    const rateDiscountAmt = totalAmt - afterRateDiscount;
    const finalAmt = afterRateDiscount - usedMileage;
    
    // [수정] 부가세 계산 (일본 10%, 한국 10%)
    const vat = Math.floor(finalAmt / 11);
    const supply = finalAmt - vat;
    
    // 통화 기호 설정
    const _fmtSummary = (v) => formatCurrencyForPDF(v);

    const summaryX = 105;
    // [수정] 합계 라벨 다국어
    drawText(doc, TEXT.supply_price, summaryX, y+5, {align:'right'});
    drawText(doc, _fmtSummary(supply), 195, y+5, {align:'right'}); y+=6;

    drawText(doc, TEXT.vat, summaryX, y+5, {align:'right'});
    drawText(doc, _fmtSummary(vat), 195, y+5, {align:'right'}); y+=6;

    if (rateDiscountAmt > 0) {
        doc.setTextColor(255, 0, 0);
        drawText(doc, `${TEXT.discount} (${(discountRate*100).toFixed(0)}%) :`, summaryX, y+5, {align:'right'}, "#ff0000");
        drawText(doc, "-" + _fmtSummary(rateDiscountAmt), 195, y+5, {align:'right'}, "#ff0000"); y+=6;
    }
    if (usedMileage > 0) {
        doc.setTextColor(255, 0, 0);
        drawText(doc, TEXT.mileage, summaryX, y+5, {align:'right'}, "#ff0000");
        drawText(doc, "-" + usedMileage.toLocaleString() + " P", 195, y+5, {align:'right'}, "#ff0000"); y+=6;
    }
    y += 2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(summaryX-20, y, 195, y); y += 8;

    // 합계 금액 (다국어 라벨)
    drawText(doc, TEXT.total_amount, summaryX, y, {align:'right', weight:'bold'});
    doc.setFontSize(14);
    drawText(doc, _fmtSummary(finalAmt), 195, y, {align:'right', weight:'bold'}, "#1a237e"); 

    // 결제 수단 표기
    if (title.includes(TEXT.receipt_title) || title.includes(TEXT.statement_title)) {
        y += 8;
        doc.setFontSize(10);
        let methodLabel = TEXT.payment_card;
        
        if (orderInfo.payMethod === 'bank') methodLabel = `${TEXT.payment_bank} (${orderInfo.depositor || ''})`;
        else if (orderInfo.payMethod === 'deposit') methodLabel = TEXT.payment_deposit;
        
        doc.setTextColor(100, 100, 100); 
        drawText(doc, `[${methodLabel}]`, summaryX, y, {align:'right'});
        drawText(doc, prefix + finalAmt.toLocaleString() + suffix, 195, y, {align:'right'});
        doc.setTextColor(0, 0, 0); 
    }

    doc.setFontSize(10);
    // [수정] 하단 청구 메시지 다국어
    drawText(doc, TEXT.footer_claim, 105, 250, {align:'center'});

    // 결제 방식 하단 표시 (중복 표시)
    let paymentText = "";
    if (orderInfo.payMethod === 'card') paymentText = TEXT.payment_card;
    else if (orderInfo.payMethod === 'bank') paymentText = `${TEXT.payment_bank} (${orderInfo.depositor || ''})`;
    else if (orderInfo.payMethod === 'deposit') paymentText = TEXT.payment_deposit;

    if (paymentText) {
        doc.setFontSize(9); 
        doc.setTextColor(80, 80, 80); 
        drawText(doc, paymentText, 105, 256, {align:'center'});
        doc.setTextColor(0, 0, 0); 
    }

    doc.setFontSize(10);
    drawText(doc, new Date().toLocaleDateString(), 105, 262, {align:'center'}); 
    
    return doc.output('blob');
}

// [추가] PDF용 통화 포맷 함수 (이게 꼭 있어야 합니다)
function formatCurrencyForPDF(val) {
    const num = Number(val) || 0;
    if (CURRENT_LANG_CODE === 'ja' || CURRENT_LANG_CODE === 'jp') return '¥' + Math.floor(num).toLocaleString();
    if (CURRENT_LANG_CODE === 'us') return '$' + Math.round(num).toLocaleString();
    return num.toLocaleString();
}

// 4. 작업지시서 (Order Sheet)
export async function generateOrderSheetPDF(orderInfo, cartItems) {
    // [수정] 다국어 적용
    if (!window.jspdf) return alert(window.t('msg_loading', "Loading PDF library..."));
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    await loadPdfFonts(doc); 

    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        if (!item.product) continue;

        const itemPages = (item.pages && item.pages.length > 0) ? item.pages : (item.json ? [item.json] : []);
        const loopCount = itemPages.length > 0 ? itemPages.length : 1;

        for (let p = 0; p < loopCount; p++) {
            if (i > 0 || p > 0) doc.addPage();
        
            const NAVY_CMYK = "#1a237e"; 
            const [c,m,yk,k] = hexToCMYK(NAVY_CMYK);
            doc.setFillColor(c,m,yk,k); doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(0,0,0,0); doc.setFontSize(22); 
            drawText(doc, TEXT.ordersheet_title, 105, 14, { align: 'center', weight: 'bold' }, "#ffffff");
            
            const startY = 30; const boxH = 50;
            doc.setTextColor(0,0,0,1); doc.setDrawColor(0); doc.setLineWidth(0.4);
            doc.rect(15, startY, 180, boxH); 

            doc.setFontSize(10); 
            let curY = startY + 8;
            drawText(doc, `${TEXT.ordersheet_order_no} :  ${orderInfo.id || '-'}`, 20, curY, {weight:'bold'});
            drawText(doc, `${TEXT.ordersheet_date} :  ${new Date().toLocaleDateString()}`, 80, curY);
            doc.setDrawColor(200); doc.setLineWidth(0.1); doc.line(20, curY + 3, 130, curY + 3); curY += 8; 
            doc.setFontSize(11);
            drawText(doc, `${TEXT.ordersheet_customer} :  ${orderInfo.manager || '-'}`, 20, curY); curY += 6;
            drawText(doc, `${TEXT.ordersheet_phone} :  ${orderInfo.phone || '-'}`, 20, curY); curY += 6;
            drawText(doc, `${TEXT.ordersheet_address} :`, 20, curY); doc.setFontSize(10);
            drawText(doc, `${orderInfo.address || '-'}`, 45, curY, {maxWidth: 90}); curY += 10;
            doc.setFontSize(11);
            drawText(doc, `${TEXT.ordersheet_request} :`, 20, curY);
            drawText(doc, `${orderInfo.note || TEXT.ordersheet_none}`, 45, curY, {maxWidth: 130, weight:'bold'}, "#1d4ed8");

            let dateStr = TEXT.ordersheet_unspecified;
            if (orderInfo.date) {
                const parts = orderInfo.date.split('-');
                if(parts.length === 3) dateStr = `${parts[1]}.${parts[2]}`;
                else dateStr = orderInfo.date;
            }
            doc.setFontSize(12);
            drawText(doc, TEXT.ordersheet_delivery_date, 165, startY + 12, {align:'center', weight:'bold'}, "#ff0000");
            doc.setFontSize(42); 
            drawText(doc, dateStr, 165, startY + 32, {align:'center', weight:'bold'}, "#ff0000");
            doc.setDrawColor(255, 0, 0); doc.setLineWidth(0.5); doc.roundedRect(135, startY + 5, 55, 35, 3, 3); 

            const staffY = startY + boxH + 5; 
            doc.setFillColor(255, 247, 237); doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.3);
            doc.rect(15, staffY, 180, 14, 'FD'); 
            doc.setTextColor(194, 65, 12); doc.setFontSize(10);
            drawText(doc, `배송책임자 : 서용규 (010-8272-3017)   |   제작책임자 : 변지웅 (010-5512-5366)`, 105, staffY + 8.5, {align:'center', weight:'bold'}, "#c2410c");

            if (window.QRCode) {
                try {
                    let optionText = TEXT.opt_default;
                    if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
                        const optNames = [];
                        Object.values(item.selectedAddons).forEach(code => {
                            const add = ADDON_DB[code]; if(add) optNames.push(add.name);
                        });
                        if(optNames.length > 0) optionText = optNames.join(", ");
                    }
                    const qrContent = `[주문정보]\n고객: ${orderInfo.manager}\n전화: ${orderInfo.phone}\n주소: ${orderInfo.address}\n제품: ${item.product.name}\n옵션: ${optionText}`;
                    const qrUrl = await window.QRCode.toDataURL(qrContent, { margin: 0, width: 300 });
                    doc.addImage(qrUrl, 'PNG', 182, staffY + 1, 12, 12);
                } catch (e) {}
            }

            const prodY = staffY + 20;
            doc.setFillColor(240, 240, 240); doc.setDrawColor(0); doc.setLineWidth(0.1);
            doc.rect(15, prodY, 180, 10, 'FD');
            doc.setTextColor(0); doc.setFontSize(11);
            drawText(doc, TEXT.ordersheet_prod_spec, 20, prodY + 7, {weight:'bold'});
            drawText(doc, `${TEXT.ordersheet_qty_label}: ${item.qty}${TEXT.ordersheet_qty_unit}`, 185, prodY + 7, {align:'right', weight:'bold', fontSize:12}, "#ff0000");

            const infoY = prodY + 18; doc.setFontSize(16);
            drawText(doc, `${item.product.name}`, 20, infoY, {weight:'bold'});
            doc.setFontSize(11); let optY = infoY + 8;
            if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
                Object.values(item.selectedAddons).forEach(code => {
                    const add = ADDON_DB[code]; if(!add) return;
                    const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                    drawText(doc, `• ${add.name} (x${qty})`, 25, optY); optY += 6;
                });
            } else {
                drawText(doc, "• " + TEXT.opt_default, 25, optY); optY += 6;
            }

            const imgBoxY = optY + 5; const footerY = 255; const imgBoxH = footerY - imgBoxY - 5; 
            doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(15, imgBoxY, 180, imgBoxH); 
            const pageLabel = loopCount > 1 ? ` (${TEXT.ordersheet_page_label} ${p + 1} / ${loopCount})` : "";
            drawText(doc, `< ${TEXT.ordersheet_design_preview}${pageLabel} >`, 105, imgBoxY - 2, {align:'center', size:9, color:"#888888"});

            let imgData = null; 
            if (item.type === 'design' && itemPages.length > 0 && itemPages[p]) {
                try {
                    const tempEl = document.createElement('canvas');
                    const tempCvs = new fabric.StaticCanvas(tempEl);
                    tempCvs.setWidth(item.width || 800); tempCvs.setHeight(item.height || 800);
                    
                    await new Promise(r => tempCvs.loadFromJSON(itemPages[p], r));
                    
                    const board = tempCvs.getObjects().find(o => o.isBoard);
                    let cx = 0, cy = 0, cw = tempCvs.width, ch = tempCvs.height;
                    if(board) { cx = board.left; cy = board.top; cw = board.width * board.scaleX; ch = board.height * board.scaleY; }
                    
                    // 배경 흰색 추가 (투명 방지)
                    tempCvs.setBackgroundColor('#ffffff', () => {});
                    
                    imgData = tempCvs.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.5, left: cx, top: cy, width: cw, height: ch });
                    tempCvs.dispose();
                } catch(e) {}
            }
            if (!imgData && p === 0) {
                let targetUrl = item.thumb;
                if (item.type === 'product_only') targetUrl = null;
                else if (!targetUrl && item.originalUrl && item.mimeType?.startsWith('image')) targetUrl = item.originalUrl;
                if (targetUrl) imgData = await getSafeImageDataUrl(targetUrl);
            }

            if (imgData) {
                try {
                    let format = 'PNG'; if (imgData.startsWith('data:image/jpeg')) format = 'JPEG';
                    const imgProps = doc.getImageProperties(imgData);
                    const innerW = 176; const innerH = imgBoxH - 4;
                    let w = innerW; let h = (imgProps.height * w) / imgProps.width;
                    if (h > innerH) { h = innerH; w = (imgProps.width * h) / imgProps.height; }
                    const imgX = 105 - (w / 2); const imgY = imgBoxY + (imgBoxH / 2) - (h / 2);
                    doc.addImage(imgData, format, imgX, imgY, w, h);
                } catch (err) {}
            } else {
                drawText(doc, TEXT.ordersheet_no_image, 105, imgBoxY + (imgBoxH/2), {align:'center'});
            }

            doc.setDrawColor(0); doc.setLineWidth(0.1);
            const signBoxW = 180; const signBoxH = 25; doc.rect(15, footerY, signBoxW, signBoxH);
            const colW = signBoxW / 3;
            doc.line(15, footerY + 8, 15 + signBoxW, footerY + 8); 
            doc.line(15 + colW, footerY, 15 + colW, footerY + signBoxH); 
            doc.line(15 + colW*2, footerY, 15 + colW*2, footerY + signBoxH); 
            doc.setFontSize(10);
            drawText(doc, TEXT.staff_make, 15 + colW/2, footerY+5.5, {align:'center'});
            drawText(doc, TEXT.staff_check, 15 + colW*1.5, footerY+5.5, {align:'center'});
            drawText(doc, TEXT.staff_ship, 15 + colW*2.5, footerY+5.5, {align:'center'});
            doc.setFontSize(8); drawText(doc, "Generated by Chameleon Printing System", 105, 292, { align: 'center' }, "#888888");
        } 
    } 
    return doc.output('blob');
}