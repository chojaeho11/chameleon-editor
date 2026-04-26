// 주문 → Google Drive 자동 동기화 (테스트용 별도 백업).
// 기존 Supabase 흐름은 100% 유지. 이 함수는 fire-and-forget으로 호출되며 실패해도 주문에 영향 없음.
//
// 필요 환경변수 (Supabase Secrets):
//   GOOGLE_DRIVE_SA_JSON       — Service Account JSON 전문 (한 줄 문자열)
//   GOOGLE_DRIVE_ROOT_FOLDER_ID — 루트 폴더 ID (서비스 계정과 공유 필요)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — 자동 주입
//
// 호출:
//   POST /functions/v1/sync-order-to-drive  body: { order_id: "uuid" }
//
// 폴더 구조:
//   {루트}/{paper_code}_{customer}_{order_no}/
//     order.json
//     design_*.<ext>  (orders.files의 각 항목)
//
// 폴더명 충돌 시 _2, _3 등으로 자동 분기.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── 폴더/파일 이름 정리 ── (특수문자/공백 → _)
function sanitize(s: string): string {
  if (!s) return "unknown";
  return String(s)
    .replace(/[\/\\:*?"<>|\r\n\t]/g, "_")          // OS 금지 문자 + 개행/탭
    .replace(/\s+/g, "_")                            // 공백류 통합
    .replace(/_+/g, "_")                             // 연속 _ 축약
    .replace(/^_|_$/g, "")                           // 양끝 _ 제거
    .slice(0, 80) || "unknown";
}

// ── base64url (JWT용) ──
function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ── PEM(PKCS8) → CryptoKey ──
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "\n")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

// ── Service Account → OAuth access token ──
let _tokenCache: { token: string; exp: number } | null = null;
async function getAccessToken(saJson: string): Promise<string> {
  if (_tokenCache && _tokenCache.exp > Date.now() + 30_000) return _tokenCache.token;

  const sa = JSON.parse(saJson);
  if (!sa.client_email || !sa.private_key) throw new Error("invalid SA JSON");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    // drive.file 은 앱이 만든 파일만 접근 가능 → 공유받은 기존 폴더는 못 봄.
    // drive 스코프로 변경: 공유된 폴더 안에서 읽기/쓰기 모두 가능.
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const data = `${header}.${claim}`;
  const key = await importPrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const sig = b64url(new Uint8Array(sigBuf));
  const jwt = `${data}.${sig}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`oauth token: ${r.status} ${await r.text()}`);
  const j = await r.json();
  _tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

// ── Drive: 동일 이름 폴더 찾기 (parent 안) ──
async function findFolderByName(name: string, parentId: string, token: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`find folder: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.files?.[0]?.id || null;
}

// ── Drive: 폴더 생성 (이름 충돌 시 _2, _3...) ──
async function createUniqueFolder(baseName: string, parentId: string, token: string): Promise<{ id: string; name: string }> {
  let name = baseName;
  for (let i = 1; i <= 99; i++) {
    const existing = await findFolderByName(name, parentId, token);
    if (!existing) {
      const r = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        }),
      });
      if (!r.ok) throw new Error(`create folder: ${r.status} ${await r.text()}`);
      const j = await r.json();
      return { id: j.id, name };
    }
    name = `${baseName}_${i + 1}`;
  }
  throw new Error("too many folder name collisions");
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

// ── 재시도 헬퍼 (3회, 지수 백오프) ──
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = 800 * Math.pow(2, i); // 800, 1600, 3200ms
      console.warn(`[retry ${label}] attempt ${i + 1}/${attempts} failed: ${e?.message || e}. waiting ${wait}ms`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── 메인 핸들러 ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SA_JSON = (Deno.env.get("GOOGLE_DRIVE_SA_JSON") || "").trim();
    const ROOT_ID = (Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID") || "").trim();
    const SUPA_URL = Deno.env.get("SUPABASE_URL");
    const SUPA_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log(`[drive sync] ROOT_ID="${ROOT_ID}" (length=${ROOT_ID.length})`);
    if (!SA_JSON || !ROOT_ID) {
      return new Response(JSON.stringify({ error: "Drive env vars missing", needed: ["GOOGLE_DRIVE_SA_JSON", "GOOGLE_DRIVE_ROOT_FOLDER_ID"] }), {
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

    // 2) 폴더명 만들기
    const firstItem = Array.isArray(order.items) ? order.items[0] : null;
    const paperCode = sanitize(firstItem?.product?.code || firstItem?.product?.name || "PRODUCT");
    const customer = sanitize(order.manager_name || "GUEST");
    const orderNo = sanitize(order.id || "NOID");
    const baseName = `${paperCode}_${customer}_${orderNo}`;

    // 3) Drive 토큰 + 폴더 생성
    const token = await withRetry("auth", () => getAccessToken(SA_JSON));

    // DEBUG: 부모 폴더에 SA가 직접 접근 가능한지 사전 확인
    try {
      const checkUrl = `https://www.googleapis.com/drive/v3/files/${ROOT_ID}?fields=id,name,mimeType,driveId&supportsAllDrives=true`;
      const checkR = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
      const checkText = await checkR.text();
      console.log(`[drive sync] parent check: status=${checkR.status} body=${checkText.slice(0, 400)}`);
    } catch (e: any) {
      console.warn(`[drive sync] parent check error: ${e?.message || e}`);
    }

    const folder = await withRetry("folder", () => createUniqueFolder(baseName, ROOT_ID, token));
    console.log(`[drive sync] folder created: ${folder.name} (${folder.id})`);

    // 4) order.json 생성 후 업로드
    const orderJson = {
      order_no: order.id,
      customer: order.manager_name || null,
      paper_code: firstItem?.product?.code || null,
      size_mm: firstItem?.product ? { w: firstItem.product.w_mm || 0, h: firstItem.product.h_mm || 0 } : null,
      qty: firstItem?.qty || null,
      sides: firstItem?.product?._artworkType || null,
      created_at: order.order_date || new Date().toISOString(),
      design_files: (Array.isArray(order.files) ? order.files : [])
        .filter((f: any) => f && f.url && f.type !== "_error_log")
        .map((f: any) => f.name),
      // 원본 주문 전체
      raw_order: order,
    };
    const orderJsonBytes = new TextEncoder().encode(JSON.stringify(orderJson, null, 2));
    await withRetry("order.json", () =>
      uploadFile("order.json", folder.id, "application/json; charset=utf-8", orderJsonBytes, token)
    );

    // 5) 디자인 파일들 (Supabase Storage URL → Drive)
    const filesUploaded: string[] = [];
    const fileErrors: { name: string; error: string }[] = [];
    const designFiles = (Array.isArray(order.files) ? order.files : [])
      .filter((f: any) => f && f.url && f.type !== "_error_log");

    for (const f of designFiles) {
      const driveName = `design_${sanitize(f.name)}`;
      try {
        await withRetry(`download ${f.name}`, async () => {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`fetch ${f.url}: ${r.status}`);
          const buf = new Uint8Array(await r.arrayBuffer());
          const mime = r.headers.get("content-type") || "application/octet-stream";
          await withRetry(`upload ${f.name}`, () => uploadFile(driveName, folder.id, mime, buf, token));
        });
        filesUploaded.push(driveName);
      } catch (e: any) {
        console.error(`[drive sync] file failed: ${f.name} — ${e?.message || e}`);
        fileErrors.push({ name: f.name, error: String(e?.message || e) });
      }
    }

    const folderUrl = `https://drive.google.com/drive/folders/${folder.id}`;
    console.log(`[drive sync] done order=${orderId} folder=${folder.name} files=${filesUploaded.length}/${designFiles.length} url=${folderUrl}`);

    return new Response(JSON.stringify({
      ok: true,
      folder_id: folder.id,
      folder_name: folder.name,
      folder_url: folderUrl,
      files_uploaded: filesUploaded.length,
      files_failed: fileErrors.length,
      file_errors: fileErrors,
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
