import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STAMP_URL = "https://gdadmin.signmini.com/data/etc/stampImage";
const FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf";
const FONT_BOLD_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Bold.ttf";

let _fontCache: ArrayBuffer | null = null;
let _fontBoldCache: ArrayBuffer | null = null;

const COMPANY_KR = { regNo: "470-81-02808", name: "(주)카멜레온프린팅", ceo: "조재호", addr: "경기 화성시 우정읍 한말길 72-2", biz: "제조업 / 서비스업", phone: "031-366-1984" };
const COMPANY_INT = { regNo: "470-81-02808", name: "CHAMELEON PRINTING INC.", ceo: "Jaeho Cho", addr: "Gyeonggi-do, South Korea", biz: "Manufacturing / Service", phone: "+82-31-366-1984" };

// 다국어 라벨
const LABELS: Record<string, any> = {
    kr: { title: "견 적 서", recipient: "[ 수신자 ]", name: "성   명", contact: "연 락 처", address: "주   소",
          regNo: "등록번호", company: "상      호", ceo: "대      표", compAddr: "주      소", bizType: "업      태", compPhone: "연 락 처",
          headers: ["No", "품목명", "규격/옵션", "수량", "단가", "금액"],
          supply: "공급가액 :", vat: "부 가 세 :", totalLabel: "합계금액 (VAT포함)",
          shLabels: { truck: "지방 용차배송비 :", parcel: "지방 택배비 :", install: "지방 배송+시공비 :" },
          footer: "위와 같이 청구(영수)합니다.", currency: "원", locale: "ko-KR" },
    ja: { title: "見 積 書", recipient: "[ 宛先 ]", name: "お名前", contact: "電話番号", address: "住  所",
          regNo: "登録番号", company: "会社名", ceo: "代  表", compAddr: "住  所", bizType: "業  種", compPhone: "電話番号",
          headers: ["No", "品目名", "仕様", "数量", "単価", "金額"],
          supply: "小計 :", vat: "消費税 :", totalLabel: "合計金額 (税込)",
          shLabels: { truck: "地方配送料 :", parcel: "宅配送料 :", install: "配送+設置費 :" },
          footer: "上記の通りお見積り申し上げます。", currency: "円", locale: "ja-JP" },
    en: { title: "QUOTATION", recipient: "[ To ]", name: "Name", contact: "Phone", address: "Address",
          regNo: "Reg. No.", company: "Company", ceo: "CEO", compAddr: "Address", bizType: "Business", compPhone: "Phone",
          headers: ["No", "Item", "Spec/Option", "Qty", "Unit Price", "Amount"],
          supply: "Subtotal :", vat: "Tax :", totalLabel: "Total (Tax incl.)",
          shLabels: { truck: "Shipping (Truck) :", parcel: "Shipping :", install: "Shipping + Install :" },
          footer: "We hereby submit this quotation as above.", currency: "", locale: "en-US" },
};

// 통화 변환
const CURRENCY_RATES: Record<string, number> = { kr: 1, ja: 0.1, en: 0.001, us: 0.001 };
function formatPrice(amount: number, lang: string): string {
    const l = lang.toLowerCase();
    if (l === 'ja' || l === 'jp') return '¥' + Math.round(amount * 0.1).toLocaleString('ja-JP');
    if (l === 'en' || l === 'us') return '$' + (amount * 0.001).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return amount.toLocaleString('ko-KR') + '원';
}

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface QuoteItem { name: string; spec: string; qty: number; unit_price: number; total: number; is_addon?: boolean; }
interface QuoteRequest { customer_name?: string; customer_phone?: string; customer_address?: string; items: QuoteItem[]; shipping_fee?: number; lang?: string; }

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    try {
        const body: QuoteRequest = await req.json();
        const { items, customer_name, customer_phone, customer_address, shipping_fee, lang } = body;

        if (!items || items.length === 0) {
            return new Response(JSON.stringify({ error: "No items" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
        }

        const l = (lang || 'kr').toLowerCase();
        const isKR = l === 'kr';
        const L = LABELS[l] || LABELS[l === 'jp' ? 'ja' : l] || LABELS['en'];
        const CO = isKR ? COMPANY_KR : COMPANY_INT;

        if (!_fontCache) _fontCache = await fetch(FONT_URL).then(r => r.arrayBuffer());
        if (!_fontBoldCache) _fontBoldCache = await fetch(FONT_BOLD_URL).then(r => r.arrayBuffer());

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const font = await pdfDoc.embedFont(_fontCache);
        const fontBold = await pdfDoc.embedFont(_fontBoldCache);

        let stampImage: any = null;
        if (isKR) { try { const sr = await fetch(STAMP_URL); stampImage = await pdfDoc.embedPng(new Uint8Array(await sr.arrayBuffer())); } catch(e) {} }

        let page = pdfDoc.addPage([595.28, 841.89]);
        const { width: W, height: H } = page.getSize();
        const mm = (v: number) => v * 2.835;
        const LEFT = mm(15);
        let y = H - mm(22);

        // Title
        const titleWidth = fontBold.widthOfTextAtSize(L.title, 26);
        page.drawText(L.title, { x: (W - titleWidth) / 2, y, size: 26, font: fontBold, color: rgb(0, 0, 0) });
        y -= mm(6);
        page.drawLine({ start: { x: LEFT, y }, end: { x: W - LEFT, y }, thickness: 0.5, color: rgb(0, 0, 0) });
        y -= mm(10);

        // Recipient
        const fs = 10;
        page.drawText(L.recipient, { x: LEFT, y, size: fs, font: fontBold });
        y -= mm(8);
        page.drawText(`${L.name} :  ${customer_name || "-"}`, { x: LEFT, y, size: fs, font });
        y -= mm(6);
        page.drawText(`${L.contact} :  ${customer_phone || "-"}`, { x: LEFT, y, size: fs, font });
        y -= mm(6);
        page.drawText(`${L.address} :  ${(customer_address || "-").substring(0, 50)}`, { x: LEFT, y, size: fs, font });

        // Provider table
        const boxX = mm(105); const boxY = H - mm(32); const cellH = mm(7); const labelW = mm(20); const valW = mm(70);
        const provLabels = [L.regNo, L.company, L.ceo, L.compAddr, L.bizType, L.compPhone];
        const provValues = [CO.regNo, CO.name, CO.ceo, CO.addr, CO.biz, CO.phone];
        for (let i = 0; i < 6; i++) {
            const cy = boxY - i * cellH;
            page.drawRectangle({ x: boxX, y: cy - cellH, width: labelW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 0.3, color: rgb(0.96, 0.96, 0.96) });
            const lw = font.widthOfTextAtSize(provLabels[i], 9);
            page.drawText(provLabels[i], { x: boxX + (labelW - lw) / 2, y: cy - cellH + mm(2), size: 9, font });
            page.drawRectangle({ x: boxX + labelW, y: cy - cellH, width: valW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 0.3 });
            page.drawText(provValues[i], { x: boxX + labelW + mm(2), y: cy - cellH + mm(2), size: 9, font });
        }
        if (stampImage) page.drawImage(stampImage, { x: boxX + labelW + mm(48), y: boxY - cellH * 2 - mm(1), width: mm(14), height: mm(14) });

        // Item table
        y = H - mm(85);
        const cols = [mm(8), mm(45), mm(47), mm(16), mm(28), mm(36)];
        let curX = LEFT;
        for (let i = 0; i < L.headers.length; i++) {
            page.drawRectangle({ x: curX, y: y - mm(8), width: cols[i], height: mm(8), borderColor: rgb(0, 0, 0), borderWidth: 0.3, color: rgb(0.93, 0.93, 0.93) });
            const hw = fontBold.widthOfTextAtSize(L.headers[i], 10);
            page.drawText(L.headers[i], { x: curX + (cols[i] - hw) / 2, y: y - mm(6), size: 10, font: fontBold });
            curX += cols[i];
        }
        y -= mm(8);

        // Data rows — 가격을 현지 통화로 변환
        let totalAmt = 0;
        let no = 1;
        for (const item of items) {
            const rowH = mm(8);
            curX = LEFT;
            // No
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[0], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            if (!item.is_addon) { const ns = String(no++); const nw = font.widthOfTextAtSize(ns, 9); page.drawText(ns, { x: curX + (cols[0] - nw) / 2, y: y - mm(6), size: 9, font }); }
            curX += cols[0];
            // Name
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[1], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const dn = item.is_addon ? `└ ${item.name}` : item.name;
            page.drawText(dn.substring(0, 20), { x: curX + mm(1), y: y - mm(6), size: item.is_addon ? 8 : 9, font });
            curX += cols[1];
            // Spec
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[2], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            page.drawText((item.spec || "").substring(0, 22), { x: curX + mm(1), y: y - mm(6), size: 8, font });
            curX += cols[2];
            // Qty
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[3], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const qs = String(item.qty); const qw = font.widthOfTextAtSize(qs, 9);
            page.drawText(qs, { x: curX + (cols[3] - qw) / 2, y: y - mm(6), size: 9, font });
            curX += cols[3];
            // Unit price (현지 통화) — 음수(할인)는 빨간색
            const _isDiscount = item.total < 0;
            const _textColor = _isDiscount ? rgb(0.86, 0.15, 0.15) : rgb(0, 0, 0);
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[4], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const upStr = item.unit_price !== 0 ? formatPrice(Math.abs(item.unit_price), l) : "";
            const upw = font.widthOfTextAtSize(upStr, 9);
            if (upStr) page.drawText((_isDiscount ? '-' : '') + upStr, { x: curX + cols[4] - upw - mm(_isDiscount ? 4 : 2), y: y - mm(6), size: 9, font, color: _textColor });
            curX += cols[4];
            // Total (현지 통화)
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[5], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const tStr = (_isDiscount ? '-' : '') + formatPrice(Math.abs(item.total), l);
            const tw = font.widthOfTextAtSize(tStr, 9);
            page.drawText(tStr, { x: curX + cols[5] - tw - mm(2), y: y - mm(6), size: 9, font, color: _textColor });

            totalAmt += item.total; // KRW 기준 합산
            y -= rowH;
            if (y < mm(60)) { page = pdfDoc.addPage([595.28, 841.89]); y = H - mm(20); }
        }

        // Totals
        y -= mm(5);
        const shFee = shipping_fee || 0;
        const vat = isKR ? Math.floor(totalAmt / 11) : 0; // 해외는 VAT 없음
        const supply = totalAmt - vat;
        const finalAmt = totalAmt + shFee;
        const sumX = mm(105); const valRightX = W - LEFT;

        const drawLine2 = (label: string, value: string, bold = false) => {
            const f = bold ? fontBold : font; const sz = bold ? 11 : 10;
            const lw2 = f.widthOfTextAtSize(label, sz);
            page.drawText(label, { x: sumX - lw2, y, size: sz, font: f, color: rgb(0, 0, 0) });
            const vw2 = f.widthOfTextAtSize(value, sz);
            page.drawText(value, { x: valRightX - vw2, y, size: sz, font: f, color: rgb(0, 0, 0) });
            y -= mm(6);
        };

        if (isKR) {
            drawLine2(L.supply, formatPrice(supply, l));
            drawLine2(L.vat, formatPrice(vat, l));
        } else {
            drawLine2(L.supply, formatPrice(totalAmt, l));
        }
        if (shFee > 0) {
            const shLabel = shFee >= 700000 ? L.shLabels.install : shFee >= 200000 ? L.shLabels.truck : L.shLabels.parcel;
            drawLine2(shLabel, "+" + formatPrice(shFee, l));
        }

        y -= mm(2);
        page.drawLine({ start: { x: sumX - mm(20), y: y + mm(3) }, end: { x: valRightX, y: y + mm(3) }, thickness: 0.5, color: rgb(0, 0, 0) });
        y -= mm(5);

        const totalLabel = L.totalLabel;
        const totalValue = formatPrice(finalAmt, l);
        const tlw = fontBold.widthOfTextAtSize(totalLabel, 11);
        page.drawText(totalLabel, { x: sumX - tlw, y, size: 11, font: fontBold });
        const tvw = fontBold.widthOfTextAtSize(totalValue, 14);
        page.drawText(totalValue, { x: valRightX - tvw, y, size: 14, font: fontBold, color: rgb(0.1, 0.14, 0.48) });

        // Footer
        const footY = mm(40);
        const ftw = font.widthOfTextAtSize(L.footer, 10);
        page.drawText(L.footer, { x: (W - ftw) / 2, y: footY, size: 10, font });
        const dateStr = new Date().toLocaleDateString(L.locale);
        const dw = font.widthOfTextAtSize(dateStr, 10);
        page.drawText(dateStr, { x: (W - dw) / 2, y: footY - mm(12), size: 10, font });

        // Save and upload
        const pdfBytes = await pdfDoc.save();
        const sb = createClient(SUPA_URL, SUPA_KEY);
        const fileName = `quotes/QUOTE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
        const { error: upErr } = await sb.storage.from("orders").upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error("Upload failed: " + upErr.message);
        const { data: urlData } = sb.storage.from("orders").getPublicUrl(fileName);

        return new Response(JSON.stringify({ url: urlData.publicUrl, total: finalAmt }), {
            headers: { ...CORS, "Content-Type": "application/json" }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
});
