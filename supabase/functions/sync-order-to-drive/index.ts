// 주문 → Google Drive 자동 동기화.
// 기존 Supabase 흐름은 100% 유지. 이 함수는 fire-and-forget으로 호출되며 실패해도 주문에 영향 없음.
//
// 인증: OAuth 2.0 사용자 위임 (Service Account는 storage quota가 없어서 파일 업로드 불가)
//
// 필요 환경변수 (Supabase Secrets):
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN
//   GOOGLE_DRIVE_ROOT_FOLDER_ID — 다크팩토리 루트 폴더 ID
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — 자동 주입
//
// 호출:
//   POST /functions/v1/sync-order-to-drive  body: { order_id: "1234" }
//
// 폴더 구조:
//   {루트(다크팩토리)}/
//     {YYYY-MM-DD}/                                      ← 오늘 날짜 (KST)
//       {고객명}/                                        ← 같은 날 같은 고객은 누적
//         {코드}_{주문번호}_{고객명}_01.{ext}            ← 디자인 파일들
//         {코드}_{주문번호}_{고객명}_02.{ext}
//     작업지시서/                                        ← 평면적 누적
//       {코드}_{주문번호}_{고객명}_작업지시서.pdf
//       {코드}_{주문번호}_{고객명}_견적서.pdf
//       {코드}_{주문번호}_{고객명}_정보.txt              ← 주문 전체 정보
//
// 파일이 없어도 폴더는 생성됨.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ORDER_DOC_FOLDER_NAME = "작업지시서";

// ── 폴더/파일 이름 정리 (OS 금지 문자만 제거, 한글/괄호는 유지) ──
function sanitize(s: string): string {
  if (!s) return "unknown";
  return String(s)
    .replace(/[\/\\:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "unknown";
}

// ── KST(서울 시간) 기준 오늘 날짜 YYYY-MM-DD ──
function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── KST 기준 풀 타임스탬프 ──
function nowKSTString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const h = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

// ── URL/이름에서 확장자 추출 ──
function extractExt(name: string, url: string, mime: string): string {
  const fromName = (name || "").match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  const fromUrl = (url || "").split("?")[0].match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("svg")) return "svg";
  if (m.includes("zip")) return "zip";
  return "bin";
}

// ── OAuth refresh_token → access token ──
// 사용자 본인 계정으로 인증 (SA의 quota 제약 회피).
let _tokenCache: { token: string; exp: number } | null = null;
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  if (_tokenCache && _tokenCache.exp > Date.now() + 30_000) return _tokenCache.token;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`oauth refresh: ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (!j.access_token) throw new Error(`no access_token in response: ${JSON.stringify(j)}`);
  _tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

// ── Drive: parent 안에서 동일 이름 폴더 검색 ──
async function findFolderByName(name: string, parentId: string, token: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`find folder: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

// ── Drive: 폴더 찾기 또는 생성 (있으면 재사용) ──
async function findOrCreateFolder(name: string, parentId: string, token: string): Promise<string> {
  const existing = await findFolderByName(name, parentId, token);
  if (existing) return existing;
  const r = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!r.ok) throw new Error(`create folder ${name}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.id;
}

// ── Drive: 파일 업로드 (multipart) ──
async function uploadFile(
  name: string,
  parentId: string,
  mimeType: string,
  body: Uint8Array,
  token: string,
): Promise<string> {
  const boundary = "drv_" + crypto.randomUUID().replace(/-/g, "");
  const meta = JSON.stringify({ name, parents: [parentId] });
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = new TextEncoder().encode(`\r\n--${boundary}--`);
  const combined = new Uint8Array(head.length + body.length + tail.length);
  combined.set(head, 0);
  combined.set(body, head.length);
  combined.set(tail, head.length + body.length);

  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: combined,
  });
  if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.id;
}

// ── 재시도 헬퍼 ──
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = 800 * Math.pow(2, i);
      console.warn(`[retry ${label}] attempt ${i + 1}/${attempts} failed: ${e?.message || e}. waiting ${wait}ms`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── 메모(정보 텍스트) 생성: 사람이 읽기 좋은 형식 ──
function buildOrderMemo(order: any): string {
  const lines: string[] = [];
  const sep = "═".repeat(50);
  const sub = "─".repeat(50);

  lines.push(sep);
  lines.push(`주문번호: ${order.id ?? "?"}`);
  lines.push(`주문일시: ${order.order_date || order.created_at || nowKSTString()}`);
  lines.push(`상태: ${order.status ?? "-"}`);
  lines.push(sep);
  lines.push("");

  lines.push("[고객 정보]");
  lines.push(`이름: ${order.manager_name ?? "-"}`);
  lines.push(`전화: ${order.phone ?? order.manager_phone ?? "-"}`);
  lines.push(`이메일: ${order.email ?? "-"}`);
  lines.push("");

  lines.push("[배송 정보]");
  lines.push(`배송지: ${order.address ?? order.shipping_address ?? "-"}`);
  if (order.delivery_date) lines.push(`희망 배송일: ${order.delivery_date}`);
  if (order.shipping_method) lines.push(`배송 방식: ${order.shipping_method}`);
  lines.push("");

  // 상품/옵션 목록
  lines.push("[상품 목록]");
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    lines.push("(상품 정보 없음)");
  } else {
    items.forEach((it: any, idx: number) => {
      const p = it.product || {};
      const code = p.code || "-";
      const name = p.name || "-";
      const w = p.w_mm ?? "?";
      const h = p.h_mm ?? "?";
      const qty = it.qty ?? "?";
      const sides = p._artworkType || it.sides || "-";
      lines.push(`${idx + 1}. [${code}] ${name}`);
      lines.push(`   사이즈: ${w} x ${h} mm`);
      lines.push(`   수량: ${qty}`);
      lines.push(`   인쇄면: ${sides}`);
      // 추가 옵션 (addons / options)
      const addons = it.addons || it.options || it.selectedOptions;
      if (addons) {
        if (Array.isArray(addons)) {
          addons.forEach((a: any) => {
            const aname = a?.name || a?.label || JSON.stringify(a);
            lines.push(`   옵션: ${aname}`);
          });
        } else if (typeof addons === "object") {
          Object.entries(addons).forEach(([k, v]) => {
            lines.push(`   옵션 ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
          });
        }
      }
      lines.push("");
    });
  }

  lines.push("[결제 정보]");
  lines.push(`총 금액: ${order.total_amount ?? "-"}`);
  if (order.shipping_fee != null) lines.push(`배송비: ${order.shipping_fee}`);
  if (order.used_mileage != null) lines.push(`사용 마일리지: ${order.used_mileage}`);
  if (order.payment_method) lines.push(`결제 방식: ${order.payment_method}`);
  lines.push("");

  lines.push("[고객 요청사항]");
  lines.push(order.request_note || order.note || "(없음)");
  lines.push("");

  if (order.admin_note) {
    lines.push("[관리자 메모]");
    lines.push(order.admin_note);
    lines.push("");
  }

  lines.push(sub);
  lines.push("[원본 주문 데이터 (JSON)]");
  lines.push(JSON.stringify(order, null, 2));

  return lines.join("\n");
}

// ── 메인 핸들러 ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const OAUTH_CLIENT_ID = (Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "").trim();
    const OAUTH_CLIENT_SECRET = (Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "").trim();
    const OAUTH_REFRESH_TOKEN = (Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN") || "").trim();
    const ROOT_ID = (Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID") || "").trim();
    const SUPA_URL = Deno.env.get("SUPABASE_URL");
    const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log(`[drive sync] ROOT_ID="${ROOT_ID}" (length=${ROOT_ID.length})`);
    if (!OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !OAUTH_REFRESH_TOKEN || !ROOT_ID) {
      return new Response(JSON.stringify({
        error: "OAuth env vars missing",
        needed: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN", "GOOGLE_DRIVE_ROOT_FOLDER_ID"],
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!SUPA_URL || !SUPA_SVC) {
      return new Response(JSON.stringify({ error: "Supabase env missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = (body?.order_id || "").toString().trim();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[drive sync] start order=${orderId}`);

    // 1) Supabase에서 주문 조회
    const supa = createClient(SUPA_URL, SUPA_SVC);
    const { data: order, error: ordErr } = await supa.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (ordErr || !order) {
      return new Response(JSON.stringify({ error: "order not found", detail: ordErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) 명명 정보 추출
    //    상품의 print_symbol(예: "HB")을 우선 사용, 없으면 product.code(예: "hb_bn_1") fallback
    const firstItem = Array.isArray(order.items) ? order.items[0] : null;
    const productCode = firstItem?.product?.code || "";
    let printSymbol = "";
    if (productCode) {
      const { data: prod } = await supa
        .from("admin_products")
        .select("print_symbol")
        .eq("code", productCode)
        .maybeSingle();
      printSymbol = (prod?.print_symbol || "").trim();
    }
    const code = sanitize(printSymbol || productCode || firstItem?.product?.name || "PRODUCT");
    const customerRaw = order.manager_name || "GUEST";
    const customer = sanitize(customerRaw);
    const orderNo = sanitize(String(order.id || "NOID"));
    const dateStr = todayKST();
    const baseName = `${code}_${orderNo}_${customer}`;  // 파일 prefix

    // 3) Drive 토큰 (OAuth refresh_token 기반)
    const token = await withRetry("auth", () => getAccessToken(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN));

    // 4) 폴더 트리 준비:
    //    {ROOT}/{날짜}/{고객명}/    + {ROOT}/작업지시서/
    const dateFolderId = await withRetry("dateFolder", () => findOrCreateFolder(dateStr, ROOT_ID, token));
    const customerFolderId = await withRetry("customerFolder", () => findOrCreateFolder(customer, dateFolderId, token));
    const orderDocFolderId = await withRetry("orderDocFolder", () => findOrCreateFolder(ORDER_DOC_FOLDER_NAME, ROOT_ID, token));
    console.log(`[drive sync] folders ready: ${dateStr}/${customer} (${customerFolderId}), ${ORDER_DOC_FOLDER_NAME} (${orderDocFolderId})`);

    // 5) 파일 분류
    const allFiles = (Array.isArray(order.files) ? order.files : [])
      .filter((f: any) => f && f.url && f.type !== "_error_log");

    // type 기준 분리: order_sheet / quotation 은 작업지시서 폴더로, 나머지는 디자인 폴더로
    const orderDocs: any[] = [];
    const designs: any[] = [];
    for (const f of allFiles) {
      if (f.type === "order_sheet" || f.type === "quotation") orderDocs.push(f);
      else designs.push(f);
    }

    const filesUploaded: string[] = [];
    const fileErrors: { name: string; error: string }[] = [];

    // 6) 디자인 파일 업로드: {코드}_{주문번호}_{고객명}_NN.{ext}
    let nn = 0;
    for (const f of designs) {
      nn += 1;
      const idx = String(nn).padStart(2, "0");
      try {
        await withRetry(`download ${f.name}`, async () => {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`fetch ${f.url}: ${r.status}`);
          const buf = new Uint8Array(await r.arrayBuffer());
          const mime = r.headers.get("content-type") || "application/octet-stream";
          const ext = extractExt(f.name, f.url, mime);
          const newName = `${baseName}_${idx}.${ext}`;
          await withRetry(`upload ${newName}`, () => uploadFile(newName, customerFolderId, mime, buf, token));
          filesUploaded.push(newName);
        });
      } catch (e: any) {
        console.error(`[drive sync] design failed: ${f.name} — ${e?.message || e}`);
        fileErrors.push({ name: f.name, error: String(e?.message || e) });
      }
    }

    // 7) 작업지시서/견적서 업로드: {코드}_{주문번호}_{고객명}_작업지시서.pdf 등
    for (const f of orderDocs) {
      const label = f.type === "order_sheet" ? "작업지시서" : "견적서";
      try {
        await withRetry(`download ${f.name}`, async () => {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`fetch ${f.url}: ${r.status}`);
          const buf = new Uint8Array(await r.arrayBuffer());
          const mime = r.headers.get("content-type") || "application/pdf";
          const ext = extractExt(f.name, f.url, mime);
          const newName = `${baseName}_${label}.${ext}`;
          await withRetry(`upload ${newName}`, () => uploadFile(newName, orderDocFolderId, mime, buf, token));
          filesUploaded.push(newName);
        });
      } catch (e: any) {
        console.error(`[drive sync] order doc failed: ${f.name} — ${e?.message || e}`);
        fileErrors.push({ name: f.name, error: String(e?.message || e) });
      }
    }

    // 8) 정보 메모 (txt) 업로드 — 항상 생성
    try {
      const memoContent = buildOrderMemo(order);
      const memoBytes = new TextEncoder().encode(memoContent);
      const memoName = `${baseName}_정보.txt`;
      await withRetry("memo", () =>
        uploadFile(memoName, orderDocFolderId, "text/plain; charset=utf-8", memoBytes, token)
      );
      filesUploaded.push(memoName);
    } catch (e: any) {
      console.error(`[drive sync] memo failed: ${e?.message || e}`);
      fileErrors.push({ name: "정보.txt", error: String(e?.message || e) });
    }

    const customerFolderUrl = `https://drive.google.com/drive/folders/${customerFolderId}`;
    const orderDocFolderUrl = `https://drive.google.com/drive/folders/${orderDocFolderId}`;
    console.log(`[drive sync] done order=${orderId} customer=${customer} files=${filesUploaded.length}/${allFiles.length + 1} url=${customerFolderUrl}`);

    return new Response(JSON.stringify({
      ok: true,
      date: dateStr,
      customer_folder_id: customerFolderId,
      customer_folder_url: customerFolderUrl,
      order_doc_folder_id: orderDocFolderId,
      order_doc_folder_url: orderDocFolderUrl,
      files_uploaded: filesUploaded.length,
      files_failed: fileErrors.length,
      file_errors: fileErrors,
      uploaded_names: filesUploaded,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(`[drive sync] fatal: ${e?.message || e}`);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
