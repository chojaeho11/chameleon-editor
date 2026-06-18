// 2026-06-18 v608: 주문 알림 자동발송 — 영수증/접수/발송/환불 4종 타입 지원.
//   Resend API. RESEND_API_KEY + (선택) RESEND_FROM_KO/JA/EN 시크릿 필요.
//   POST body: { order_id, email?, lang?, type? }
//     type: 'receipt' (default) | 'accepted' | 'shipped' | 'refund'
//     lang 미지정 시 orders.site_code 로 자동 (KR→ko / JP→ja / US→en)
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

// site_code (KR/JP/US) → lang (ko/ja/en)
function langFromSite(siteCode: string | undefined | null): string {
    const s = (siteCode || '').toUpperCase();
    if (s === 'JP') return 'ja';
    if (s === 'US' || s === 'EN') return 'en';
    return 'ko';
}

// 타입별 헤더(제목/색)·문구·CTA
type TypeKey = 'receipt' | 'accepted' | 'shipped' | 'refund';
function getTypeMeta(type: TypeKey, lang: string, orderId: number | string) {
    const tbl: Record<string, Record<TypeKey, any>> = {
        ko: {
            receipt:  { subject:`[카멜레온프린팅] 주문 영수증 #${orderId}`,         title:'주문해주셔서 감사합니다',     sub:'아래 주문이 정상 접수되었습니다.',           gradient:'linear-gradient(135deg,#fbbf24,#b45309)',   note:'제작·검수·배송에 평균 5~7 영업일이 소요됩니다.' },
            accepted: { subject:`[카멜레온프린팅] 주문 접수 완료 #${orderId}`,       title:'주문이 접수되었습니다 ✅',     sub:'영업일 기준 5~7일 이내 제작 후 발송 예정입니다.', gradient:'linear-gradient(135deg,#3b82f6,#1d4ed8)',   note:'제작 진행 상황은 마이페이지에서 실시간 확인 가능합니다.' },
            shipped:  { subject:`[카멜레온프린팅] 발송 완료 #${orderId}`,            title:'상품이 발송되었습니다 🚚',     sub:'배송 출발 안내입니다. 곧 받아보실 수 있습니다.',   gradient:'linear-gradient(135deg,#10b981,#047857)',   note:'배송 도착까지 영업일 기준 1~3일이 소요됩니다.' },
            refund:   { subject:`[카멜레온프린팅] 환불 처리 완료 #${orderId}`,        title:'환불이 정상 처리되었습니다',    sub:'결제 카드사로 환불이 요청되었습니다.',           gradient:'linear-gradient(135deg,#6b7280,#374151)',   note:'카드사 정책에 따라 영업일 기준 3~10일 내 환불이 완료됩니다.' },
        },
        ja: {
            receipt:  { subject:`【コットンプリント】ご注文の領収書 #${orderId}`,    title:'ご注文ありがとうございます',  sub:'下記のご注文を正常に受け付けました。',         gradient:'linear-gradient(135deg,#fbbf24,#b45309)',   note:'製作・検品・配送に平均5〜7営業日かかります。' },
            accepted: { subject:`【コットンプリント】ご注文受付完了 #${orderId}`,    title:'ご注文を受け付けました ✅',   sub:'営業日5〜7日以内に製作後、発送いたします。',     gradient:'linear-gradient(135deg,#3b82f6,#1d4ed8)',   note:'製作の進行状況はマイページからリアルタイムでご確認いただけます。' },
            shipped:  { subject:`【コットンプリント】発送完了 #${orderId}`,         title:'商品を発送いたしました 🚚',   sub:'配送が開始されました。間もなくお手元に届きます。', gradient:'linear-gradient(135deg,#10b981,#047857)',   note:'お届けまで営業日1〜3日かかります。' },
            refund:   { subject:`【コットンプリント】返金処理完了 #${orderId}`,      title:'返金処理が完了いたしました',  sub:'ご利用のカード会社へ返金を申請いたしました。',     gradient:'linear-gradient(135deg,#6b7280,#374151)',   note:'カード会社の規定により、営業日3〜10日以内にご返金が反映されます。' },
        },
        en: {
            receipt:  { subject:`[Cotton Print] Order Receipt #${orderId}`,        title:'Thank you for your order',     sub:'Your order has been received.',               gradient:'linear-gradient(135deg,#fbbf24,#b45309)',   note:'Production, QA and shipping take ~5–7 business days.' },
            accepted: { subject:`[Cotton Print] Order Confirmed #${orderId}`,      title:'Order confirmed ✅',           sub:'Your order will ship within 5–7 business days.', gradient:'linear-gradient(135deg,#3b82f6,#1d4ed8)',   note:'Track progress in your account page.' },
            shipped:  { subject:`[Cotton Print] Shipped #${orderId}`,              title:'Your order has shipped 🚚',    sub:'Delivery is on the way.',                     gradient:'linear-gradient(135deg,#10b981,#047857)',   note:'Expected delivery in 1–3 business days.' },
            refund:   { subject:`[Cotton Print] Refund Processed #${orderId}`,     title:'Refund has been issued',        sub:'A refund request was sent to your card issuer.', gradient:'linear-gradient(135deg,#6b7280,#374151)',   note:'Refunds typically appear in 3–10 business days, subject to your bank.' },
        },
    };
    return (tbl[lang] || tbl.ko)[type] || tbl.ko.receipt;
}

function getCommonLabels(lang: string) {
    if (lang === 'ja') return { orderNo:'ご注文番号', orderDate:'お支払い日', items:'ご注文内容', address:'お届け先', phone:'お電話番号', total:'合計', company:'株式会社カメレオンプリンティング (Cotton Print)', footer:'ご質問は info@cafe0101.com までお気軽にお問い合わせください。', tokusho:'特定商取引法に基づく表記', tokushoUrl:'https://www.cafe0101.com/tokushoho' };
    if (lang === 'en') return { orderNo:'Order #', orderDate:'Order Date', items:'Items', address:'Ship To', phone:'Phone', total:'Total', company:'Chameleon Printing Co., Ltd.', footer:'Questions? Email support@chameleon.design', tokusho:'', tokushoUrl:'' };
    return { orderNo:'주문번호', orderDate:'주문일', items:'주문 내역', address:'배송지', phone:'연락처', total:'합계', company:'(주)카멜레온프린팅', footer:'문의: support@cafe2626.com', tokusho:'', tokushoUrl:'' };
}

function buildEmail(order: any, items: any[], lang: string, type: TypeKey) {
    const meta = getTypeMeta(type, lang, order.id);
    const L = getCommonLabels(lang);
    const total = order.total_amount || 0;
    const orderDate = fmtDate(order.created_at || new Date(), lang);
    const addrFull = order.address || '';
    const phone = order.phone || '';

    // refund 타입은 아이템 리스트 생략 가능 — 간결한 안내 위주
    const showItems = (type !== 'refund');

    const itemsHtml = showItems ? (items || []).map((it: any) => {
        const nm = it.product_name || it.title || it.name || '(item)';
        const qty = it.qty || 1;
        const price = it.price || 0;
        return `<tr>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px;">${nm}</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:center;">${qty}</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; font-size:13px; text-align:right;">${fmtAmt(price, lang)}</td>
        </tr>`;
    }).join('') : '';

    const itemsSection = showItems ? `
        <div style="margin-top:22px; margin-bottom:10px; font-weight:800; font-size:14px; color:#1f2937;">${L.items}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1f2937;">
            ${itemsHtml || `<tr><td style="padding:8px 12px; font-size:13px; color:#9ca3af;">-</td></tr>`}
            <tr><td colspan="2" style="padding:14px 12px 8px; font-weight:800; font-size:14px; text-align:right; color:#1f2937;">${L.total}</td>
                <td style="padding:14px 12px 8px; font-weight:900; font-size:16px; text-align:right; color:#b45309;">${fmtAmt(total, lang)}</td></tr>
        </table>` : `
        <div style="margin-top:22px; padding:14px 16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; font-size:13px;">
            <div style="display:flex; justify-content:space-between;">
                <span style="color:#6b7280;">${L.total}</span>
                <b style="color:#b45309;">${fmtAmt(total, lang)}</b>
            </div>
        </div>`;

    const tokushoLine = (lang === 'ja' && L.tokusho)
        ? `<div style="margin-top:14px;"><a href="${L.tokushoUrl}" style="color:#a16207; text-decoration:underline; font-size:11px;">${L.tokusho}</a></div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><title>${meta.subject}</title></head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:'Hiragino Sans','Yu Gothic','Noto Sans JP','Pretendard',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:24px 12px;">
<tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#fff; border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.05); overflow:hidden;">
        <tr><td style="background:${meta.gradient}; padding:24px 28px; color:#fff;">
            <div style="font-size:20px; font-weight:900; letter-spacing:-0.3px;">${meta.title}</div>
            <div style="font-size:13px; opacity:0.92; margin-top:4px;">${meta.sub}</div>
        </td></tr>
        <tr><td style="padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#1f2937;">
                <tr><td style="padding:4px 0; color:#6b7280; width:120px;">${L.orderNo}</td><td style="padding:4px 0; font-weight:700;">#${order.id}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280;">${L.orderDate}</td><td style="padding:4px 0;">${orderDate}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280;">${L.phone}</td><td style="padding:4px 0;">${phone}</td></tr>
                <tr><td style="padding:4px 0; color:#6b7280; vertical-align:top;">${L.address}</td><td style="padding:4px 0;">${addrFull}</td></tr>
            </table>
            ${itemsSection}
            <div style="margin-top:24px; padding:16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; font-size:12px; color:#92400e; line-height:1.7;">
                ${meta.note}
            </div>
            <div style="margin-top:14px; font-size:11.5px; color:#6b7280; line-height:1.7;">
                ${L.footer}<br>
                ${L.company}
                ${tokushoLine}
            </div>
        </td></tr>
    </table>
</td></tr>
</table>
</body></html>`;
    return { subject: meta.subject, html };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

    try {
        const { order_id, email: emailInput, lang, type } = await req.json();
        if (!order_id) return new Response(JSON.stringify({ error: 'order_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // 주문 조회
        const { data: order, error: oerr } = await sb.from('orders').select('*').eq('id', order_id).maybeSingle();
        if (oerr || !order) return new Response(JSON.stringify({ error: 'order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // 이메일 우선순위: request body > orders.receipt_email > auth.users.email
        let email = (emailInput || '').trim();
        let emailSource = email ? 'request' : '';
        if (!email && order.receipt_email) { email = order.receipt_email; emailSource = 'order_field'; }
        if (!email && order.user_id) {
            try {
                const { data: { user }, error: uErr } = await sb.auth.admin.getUserById(order.user_id);
                if (!uErr && user?.email) { email = user.email; emailSource = 'auth_profile'; }
            } catch (e) { console.warn('[send-order-receipt] getUserById failed', e); }
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'no_email_available', message: 'guest order — email required in request body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 언어: body > order.site_code > 기본 ko
        const langCode = (lang === 'ja' || lang === 'jp') ? 'ja'
                       : (lang === 'en' || lang === 'us') ? 'en'
                       : (lang === 'ko' || lang === 'kr') ? 'ko'
                       : langFromSite(order.site_code);

        // 타입
        const typeKey: TypeKey = (type === 'accepted' || type === 'shipped' || type === 'refund') ? type : 'receipt';

        const items = Array.isArray(order.items) ? order.items : [];
        const { subject, html } = buildEmail(order, items, langCode, typeKey);

        // Resend API
        const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: pickFrom(langCode), to: [email], subject, html }),
        });

        const resendBody = await resendRes.json();
        if (!resendRes.ok) {
            console.error('[send-order-receipt] resend error', resendBody);
            return new Response(JSON.stringify({ error: 'resend failed', detail: resendBody }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 영수증 타입만 receipt_email/receipt_sent_at 갱신 (다른 타입은 발송 기록을 안 남김)
        if (typeKey === 'receipt') {
            await sb.from('orders').update({ receipt_email: email, receipt_sent_at: new Date().toISOString() }).eq('id', order_id);
        }

        return new Response(JSON.stringify({ ok: true, message_id: resendBody.id, email, email_source: emailSource, type: typeKey, lang: langCode }), {
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
