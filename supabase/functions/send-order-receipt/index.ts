// 2026-06-18: 주문 영수증 자동발송 (JP 사용자 — 결제 완료 후 success.html 에서 호출)
//   Resend API 사용. RESEND_API_KEY + RESEND_FROM 시크릿 필요.
//   POST body: { order_id: "...", email: "user@example.com", lang?: "ja"|"ko"|"en" }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
// 2026-06-18 v605: 언어별 FROM 주소 — 각 국가 도메인에서 발송 (브랜드/스팸함 방어)
//   미설정 환경은 기본 FROM 으로 폴백 (보통 cafe0101.com 이 가장 먼저 인증된 도메인이라 default).
const RESEND_FROM_DEFAULT = Deno.env.get('RESEND_FROM') || 'no-reply@cafe0101.com';
const RESEND_FROM_KO = Deno.env.get('RESEND_FROM_KO') || RESEND_FROM_DEFAULT;
const RESEND_FROM_JA = Deno.env.get('RESEND_FROM_JA') || RESEND_FROM_DEFAULT;
const RESEND_FROM_EN = Deno.env.get('RESEND_FROM_EN') || RESEND_FROM_DEFAULT;

function pickFrom(lang: string): string {
    if (lang === 'ja') return RESEND_FROM_JA;
    if (lang === 'en') return RESEND_FROM_EN;
    return RESEND_FROM_KO;
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function fmtAmt(krw: number, lang: string): string {
    if (krw == null) return '-';
    if (lang === 'ja') return '¥' + Math.round(krw * 0.1).toLocaleString();
    if (lang === 'en') return '$' + (krw * 0.001).toFixed(2);
    return Number(krw).toLocaleString() + '원';
}

function fmtDate(iso: string | Date, lang: string): string {
    const d = (iso instanceof Date) ? iso : new Date(iso);
    const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
    if (lang === 'ja') return `${y}年${m}月${dd}日`;
    if (lang === 'en') return d.toDateString();
    return `${y}. ${m}. ${dd}.`;
}

function buildEmail(order: any, items: any[], lang: string) {
    const langTbl: Record<string, any> = {
        ja: {
            subject: `【コットンプリント】ご注文の領収書 #${order.id}`,
            title: 'ご注文ありがとうございます',
            sub: '下記のご注文を正常に受け付けました。',
            orderNo: 'ご注文番号', orderDate: 'お支払い日', amount: 'お支払い金額',
            items: 'ご注文内容', address: 'お届け先', phone: 'お電話番号',
            receipt: '領収書', total: '合計',
            footer1: 'ご質問は info@cafe0101.com までお気軽にお問い合わせください。',
            footer2: '製作・検品・配送に平均5〜7営業日かかります。マイページからリアルタイムで進行状況をご確認いただけます。',
            company: '株式会社カメレオンプリンティング (Cotton Print)',
            tokusho: '特定商取引法に基づく表記',
        },
        ko: {
            subject: `[카멜레온프린팅] 주문 영수증 #${order.id}`,
            title: '주문해주셔서 감사합니다',
            sub: '아래 주문이 정상 접수되었습니다.',
            orderNo: '주문번호', orderDate: '결제일', amount: '결제금액',
            items: '주문 내역', address: '배송지', phone: '연락처',
            receipt: '영수증', total: '합계',
            footer1: '문의: support@cafe2626.com',
            footer2: '제작·검수·배송에 평균 5~7 영업일이 소요됩니다.',
            company: '(주)카멜레온프린팅',
            tokusho: '',
        },
        en: {
            subject: `[Cotton Print] Order Receipt #${order.id}`,
            title: 'Thank you for your order',
            sub: 'Your order has been successfully received.',
            orderNo: 'Order #', orderDate: 'Payment Date', amount: 'Amount',
            items: 'Items', address: 'Ship To', phone: 'Phone',
            receipt: 'Receipt', total: 'Total',
            footer1: 'Questions? Email support@chameleon.design',
            footer2: 'Production, QA and shipping take an average of 5–7 business days.',
            company: 'Chameleon Printing Co., Ltd.',
            tokusho: '',
        },
    };
    const t = langTbl[lang] || langTbl.ja;

    const total = order.total_amount || 0;
    const paidDate = fmtDate(order.created_at || new Date(), lang);
    const addrFull = order.address || '';
    const phone = order.phone || '';

    const itemsHtml = (items || []).map((it: any) => {
        const nm = it.product_name || it.title || it.name || '(item)';
        const qty = it.qty || 1;
        const price = it.price || 0;
        return `<tr>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px;">${nm}</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:center;">${qty}</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:right;">${fmtAmt(price, lang)}</td>
        </tr>`;
    }).join('');

    const tokushoLine = (lang === 'ja' && t.tokusho)
        ? `<div style="margin-top:14px;"><a href="https://www.cafe0101.com/tokushoho" style="color:#a16207; text-decoration:underline; font-size:11px;">${t.tokusho}</a></div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>${t.subject}</title></head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:'Hiragino Sans','Yu Gothic','Noto Sans JP','Pretendard',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:24px 12px;">
<tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.05); overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#fbbf24,#b45309); padding:24px 28px; color:#fff;">
            <div style="font-size:20px; font-weight:900; letter-spacing:-0.3px;">${t.title}</div>
            <div style="font-size:13px; opacity:0.92; margin-top:4px;">${t.sub}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#1f2937;">
                <tr><td style="padding:4px 0; color:#6b7280; width:120px;">${t.orderNo}</td><td style="padding:4px 0; font-weight:700;">#${order.id}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280;">${t.orderDate}</td><td style="padding:4px 0;">${paidDate}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280;">${t.phone}</td><td style="padding:4px 0;">${phone}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; vertical-align:top;">${t.address}</td><td style="padding:4px 0;">${addrFull}</td></tr>
            </table>
            <div style="margin-top:22px; margin-bottom:10px; font-weight:800; font-size:14px; color:#1f2937;">${t.items}</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1f2937;">
                ${itemsHtml || `<tr><td style="padding:8px 12px; font-size:13px; color:#9ca3af;">-</td></tr>`}
                <tr><td colspan="2" style="padding:14px 12px 8px; font-weight:800; font-size:14px; text-align:right; color:#1f2937;">${t.total}</td>
                    <td style="padding:14px 12px 8px; font-weight:900; font-size:16px; text-align:right; color:#b45309;">${fmtAmt(total, lang)}</td></tr>
            </table>
            <div style="margin-top:24px; padding:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; font-size:12px; color:#92400e; line-height:1.7;">
                ${t.footer2}
            </div>
            <div style="margin-top:14px; font-size:11.5px; color:#6b7280; line-height:1.7;">
                ${t.footer1}<br>
                ${t.company}
                ${tokushoLine}
            </div>
        </td></tr>
    </table>
</td></tr>
</table>
</body></html>`;
    return { subject: t.subject, html };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

    try {
        const { order_id, email, lang } = await req.json();
        if (!order_id) return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // 주문 조회
        const { data: order, error: oerr } = await sb.from('orders').select('*').eq('id', order_id).maybeSingle();
        if (oerr || !order) return new Response(JSON.stringify({ error: 'order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const langCode = (lang === 'ja' || lang === 'jp') ? 'ja' : (lang === 'en' || lang === 'us') ? 'en' : 'ko';

        const items = Array.isArray(order.items) ? order.items : [];
        const { subject, html } = buildEmail(order, items, langCode);

        // Resend API 호출
        const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: pickFrom(langCode),
                to: [email],
                subject,
                html,
            }),
        });

        const resendBody = await resendRes.json();
        if (!resendRes.ok) {
            console.error('[send-order-receipt] resend error', resendBody);
            return new Response(JSON.stringify({ error: 'resend failed', detail: resendBody }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 주문에 영수증 발송 기록
        await sb.from('orders').update({
            receipt_email: email,
            receipt_sent_at: new Date().toISOString(),
        }).eq('id', order_id);

        return new Response(JSON.stringify({ ok: true, message_id: resendBody.id }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        console.error('[send-order-receipt]', e);
        return new Response(JSON.stringify({ error: e?.message || String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
