import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STAMP_URL = "https://gdadmin.signmini.com/data/etc/stampImage";
const FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf";
const FONT_BOLD_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Bold.ttf";

// Cache font bytes across warm invocations
let _fontCache: ArrayBuffer | null = null;
let _fontBoldCache: ArrayBuffer | null = null;

const COMPANY = {
    regNo: "470-81-02808",
    name: "(주)카멜레온프린팅",
    ceo: "조재호",
    addr: "경기 화성시 우정읍 한말길 72-2",
    biz: "제조업 / 서비스업",
    phone: "031-366-1984"
};

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface QuoteItem {
    name: string;
    spec: string;
    qty: number;
    unit_price: number;
    total: number;
    is_addon?: boolean;
}

interface QuoteRequest {
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    items: QuoteItem[];
    shipping_fee?: number;
    lang?: string;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    try {
        const body: QuoteRequest = await req.json();
        const { items, customer_name, customer_phone, customer_address, shipping_fee, lang } = body;

        if (!items || items.length === 0) {
            return new Response(JSON.stringify({ error: "No items" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
        }

        // Load fonts
        if (!_fontCache) _fontCache = await fetch(FONT_URL).then(r => r.arrayBuffer());
        if (!_fontBoldCache) _fontBoldCache = await fetch(FONT_BOLD_URL).then(r => r.arrayBuffer());

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        const font = await pdfDoc.embedFont(_fontCache);
        const fontBold = await pdfDoc.embedFont(_fontBoldCache);

        // Load stamp image
        let stampImage: any = null;
        try {
            const stampResp = await fetch(STAMP_URL);
            const stampBytes = await stampResp.arrayBuffer();
            stampImage = await pdfDoc.embedPng(new Uint8Array(stampBytes));
        } catch (e) { /* stamp optional */ }

        // --- Build PDF ---
        let page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width: W, height: H } = page.getSize();
        const mm = (v: number) => v * 2.835; // mm to pt
        const LEFT = mm(15);
        let y = H - mm(22);

        // Title
        const title = "견 적 서";
        const titleWidth = fontBold.widthOfTextAtSize(title, 26);
        page.drawText(title, { x: (W - titleWidth) / 2, y, size: 26, font: fontBold, color: rgb(0, 0, 0) });
        y -= mm(6);
        page.drawLine({ start: { x: LEFT, y }, end: { x: W - LEFT, y }, thickness: 0.5, color: rgb(0, 0, 0) });
        y -= mm(10);

        // Recipient
        const fs = 10;
        page.drawText("[ 수신자 ]", { x: LEFT, y, size: fs, font: fontBold });
        y -= mm(8);
        page.drawText(`성   명 :  ${customer_name || "-"}`, { x: LEFT, y, size: fs, font });
        y -= mm(6);
        page.drawText(`연 락 처 :  ${customer_phone || "-"}`, { x: LEFT, y, size: fs, font });
        y -= mm(6);
        const addrText = `주   소 :  ${customer_address || "-"}`;
        page.drawText(addrText.substring(0, 50), { x: LEFT, y, size: fs, font });

        // Provider table (right side)
        const boxX = mm(105);
        const boxY = H - mm(32);
        const cellH = mm(7);
        const labelW = mm(20);
        const valW = mm(70);
        const provLabels = ["등록번호", "상      호", "대      표", "주      소", "업      태", "연 락 처"];
        const provValues = [COMPANY.regNo, COMPANY.name, COMPANY.ceo, COMPANY.addr, COMPANY.biz, COMPANY.phone];

        for (let i = 0; i < 6; i++) {
            const cy = boxY - i * cellH;
            // Label cell (gray bg)
            page.drawRectangle({ x: boxX, y: cy - cellH, width: labelW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 0.3, color: rgb(0.96, 0.96, 0.96) });
            const lw = font.widthOfTextAtSize(provLabels[i], 9);
            page.drawText(provLabels[i], { x: boxX + (labelW - lw) / 2, y: cy - cellH + mm(2), size: 9, font });
            // Value cell
            page.drawRectangle({ x: boxX + labelW, y: cy - cellH, width: valW, height: cellH, borderColor: rgb(0, 0, 0), borderWidth: 0.3 });
            page.drawText(provValues[i], { x: boxX + labelW + mm(2), y: cy - cellH + mm(2), size: 9, font });
        }

        // Stamp
        if (stampImage) {
            page.drawImage(stampImage, { x: boxX + labelW + mm(48), y: boxY - cellH * 2 - mm(1), width: mm(14), height: mm(14) });
        }

        // Item table
        y = H - mm(85);
        const cols = [mm(8), mm(45), mm(47), mm(16), mm(28), mm(36)];
        const headers = ["No", "품목명", "규격/옵션", "수량", "단가", "금액"];
        let curX = LEFT;

        // Header row
        for (let i = 0; i < headers.length; i++) {
            page.drawRectangle({ x: curX, y: y - mm(8), width: cols[i], height: mm(8), borderColor: rgb(0, 0, 0), borderWidth: 0.3, color: rgb(0.93, 0.93, 0.93) });
            const hw = fontBold.widthOfTextAtSize(headers[i], 10);
            page.drawText(headers[i], { x: curX + (cols[i] - hw) / 2, y: y - mm(6), size: 10, font: fontBold });
            curX += cols[i];
        }
        y -= mm(8);

        // Data rows
        let totalAmt = 0;
        let no = 1;

        for (const item of items) {
            const rowH = mm(8);
            curX = LEFT;

            // No
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[0], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            if (!item.is_addon) {
                const noStr = String(no++);
                const nw = font.widthOfTextAtSize(noStr, 9);
                page.drawText(noStr, { x: curX + (cols[0] - nw) / 2, y: y - mm(6), size: 9, font });
            }
            curX += cols[0];

            // Name
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[1], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const dispName = item.is_addon ? `└ ${item.name}` : item.name;
            page.drawText(dispName.substring(0, 20), { x: curX + mm(1), y: y - mm(6), size: item.is_addon ? 8 : 9, font });
            curX += cols[1];

            // Spec
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[2], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            page.drawText((item.spec || "").substring(0, 22), { x: curX + mm(1), y: y - mm(6), size: 8, font });
            curX += cols[2];

            // Qty
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[3], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const qStr = String(item.qty);
            const qw = font.widthOfTextAtSize(qStr, 9);
            page.drawText(qStr, { x: curX + (cols[3] - qw) / 2, y: y - mm(6), size: 9, font });
            curX += cols[3];

            // Unit price
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[4], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const upStr = item.unit_price > 0 ? item.unit_price.toLocaleString() : "";
            const upw = font.widthOfTextAtSize(upStr, 9);
            page.drawText(upStr, { x: curX + cols[4] - upw - mm(2), y: y - mm(6), size: 9, font });
            curX += cols[4];

            // Total
            page.drawRectangle({ x: curX, y: y - rowH, width: cols[5], height: rowH, borderColor: rgb(0, 0, 0), borderWidth: 0.2 });
            const tStr = item.total.toLocaleString();
            const tw = font.widthOfTextAtSize(tStr, 9);
            page.drawText(tStr, { x: curX + cols[5] - tw - mm(2), y: y - mm(6), size: 9, font });

            totalAmt += item.total;
            y -= rowH;

            // Page break
            if (y < mm(60)) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = H - mm(20);
            }
        }

        // Totals — VAT는 상품금액에만 적용, 배송비는 별도
        y -= mm(5);
        const shFee = shipping_fee || 0;
        const vat = Math.floor(totalAmt / 11);
        const supply = totalAmt - vat;
        const finalAmt = totalAmt + shFee;
        const sumX = mm(105);
        const valRightX = W - LEFT;

        const drawSummaryLine = (label: string, value: string, bold = false, colorR = 0) => {
            const f = bold ? fontBold : font;
            const sz = bold ? 11 : 10;
            const lw2 = f.widthOfTextAtSize(label, sz);
            page.drawText(label, { x: sumX - lw2, y, size: sz, font: f, color: rgb(colorR, 0, 0) });
            const vw2 = f.widthOfTextAtSize(value, sz);
            page.drawText(value, { x: valRightX - vw2, y, size: sz, font: f, color: rgb(colorR, 0, 0) });
            y -= mm(6);
        };

        drawSummaryLine("공급가액 :", supply.toLocaleString() + "원");
        drawSummaryLine("부 가 세 :", vat.toLocaleString() + "원");
        if (shFee > 0) {
            const shLabel = shFee >= 700000 ? "지방 배송+시공비 :" : shFee >= 200000 ? "지방 용차배송비 :" : "지방 택배비 :";
            drawSummaryLine(shLabel, "+" + shFee.toLocaleString() + "원");
        }

        y -= mm(2);
        page.drawLine({ start: { x: sumX - mm(20), y: y + mm(3) }, end: { x: valRightX, y: y + mm(3) }, thickness: 0.5, color: rgb(0, 0, 0) });
        y -= mm(5);

        // Final total
        const totalLabel = "합계금액 (VAT포함)";
        const totalValue = finalAmt.toLocaleString() + "원";
        const tlw = fontBold.widthOfTextAtSize(totalLabel, 11);
        page.drawText(totalLabel, { x: sumX - tlw, y, size: 11, font: fontBold });
        const tvw = fontBold.widthOfTextAtSize(totalValue, 14);
        page.drawText(totalValue, { x: valRightX - tvw, y, size: 14, font: fontBold, color: rgb(0.1, 0.14, 0.48) });

        // Footer
        const footY = mm(40);
        const footText = "위와 같이 청구(영수)합니다.";
        const ftw = font.widthOfTextAtSize(footText, 10);
        page.drawText(footText, { x: (W - ftw) / 2, y: footY, size: 10, font });

        const dateStr = new Date().toLocaleDateString("ko-KR");
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
