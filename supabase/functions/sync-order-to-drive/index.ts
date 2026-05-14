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
//     고객주문/
//       {YYYY-MM-DD}_{고객명}/                           ← 주문일 + 고객명
//         {코드}_{주문번호}_{고객명}_01.{ext}            ← 디자인 파일들
//         {코드}_{주문번호}_{고객명}_02.{ext}
//         {코드}_{주문번호}_{고객명}_정보.txt            ← 주문 전체 정보
//         .design_complete                                ← 관리자가 데이터작업완료 누르면 생성. 파이썬 칼선 도구가 이 파일 존재만 보고 처리.
//     끝난작업/                                          ← 칼선 작업 후 파이썬 도구가 고객 폴더를 여기로 이동 (TS 함수는 폴더만 미리 보장)
//
// 폴더 색상:
//   design_complete=true  → 초록 (#16a765)
//   design_complete=false → 빨강 (#f83a22)   ← 파일 유무와 무관
//
// 2026-05-14: 사용자 요청 — 색상 기준을 "파일 유무" 에서 "관리자 데이터작업완료 클릭 여부"로 변경.
//             그리고 기존 "작업지시서" 평면 폴더는 작업지시서 HTML 페이지(/workorder.html) 로 대체됐으므로 제거.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 2026-05-14: ORDER_DOC_FOLDER_NAME 제거 — 작업지시서 폴더는 더 이상 생성/관리 안 함.
const CUSTOMER_ORDERS_FOLDER_NAME = "고객주문";
const DONE_FOLDER_NAME = "끝난작업";   // 칼선 처리 후 파이썬이 고객 폴더 이동시키는 곳
const DESIGN_COMPLETE_MARKER = ".design_complete";   // 빈 마커 파일

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

// ── YYYY-MM-DD → "M월D일" (한국어 짧은 날짜) ──
function toKoreanShortDate(yyyymmdd: string): string {
  const m = yyyymmdd.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return yyyymmdd;
  return `${parseInt(m[1], 10)}월${parseInt(m[2], 10)}일`;
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

// ── Drive: 폴더 색상 설정 (Drive UI에서 시각적 구분용) ──
//    유효 색상은 #ac725e #d06b64 #f83a22 #fa573c #ff7537 #ffad46 #42d692 #16a765 등
async function setFolderColor(folderId: string, colorHex: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,folderColorRgb`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ folderColorRgb: colorHex }),
  });
  if (!r.ok) throw new Error(`set folder color: ${r.status} ${await r.text()}`);
}

// 색상 코드
const COLOR_HAS_FILES = "#16a765";  // 초록 — 고객 파일 있음
const COLOR_EMPTY = "#f83a22";      // 빨강 — 메모만 있음 (고객 파일 미입력)

// 2026-05-14: 관리자 "데이터작업완료" 마커 — 고객 폴더 안에 빈 .design_complete 파일을 만들거나/지운다.
//   파이썬 칼선 도구가 이 파일 존재 여부만 보고 처리 여부를 결정하므로 Supabase 자격증명 불필요.
async function ensureDesignCompleteMarker(folderId: string, token: string): Promise<void> {
  // 이미 존재하면 skip
  const findUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${DESIGN_COMPLETE_MARKER}' and '${folderId}' in parents and trashed=false`)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const fr = await fetch(findUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (fr.ok) {
    const fj = await fr.json();
    if ((fj.files || []).length > 0) return;
  }
  const empty = new Uint8Array(0);
  await uploadFile(DESIGN_COMPLETE_MARKER, folderId, "application/octet-stream", empty, token);
}

async function removeDesignCompleteMarker(folderId: string, token: string): Promise<number> {
  const findUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${DESIGN_COMPLETE_MARKER}' and '${folderId}' in parents and trashed=false`)}&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const fr = await fetch(findUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!fr.ok) return 0;
  const fj = await fr.json();
  let removed = 0;
  for (const f of (fj.files || [])) {
    try { await trashItem(f.id, token); removed++; } catch (_) {}
  }
  return removed;
}

async function folderHasDesignCompleteMarker(folderId: string, token: string): Promise<boolean> {
  const findUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${DESIGN_COMPLETE_MARKER}' and '${folderId}' in parents and trashed=false`)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const fr = await fetch(findUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!fr.ok) return false;
  const fj = await fr.json();
  return (fj.files || []).length > 0;
}

// ── Drive: 빈 폴더 마킹 — 색상 빨강 + modifiedTime을 1970으로 (수정날짜 정렬 시 맨 아래로) ──
//    Drive UI에서 "수정 날짜 ↓" 정렬 시 빈 폴더는 자동으로 하단에 모이고
//    파일이 들어있는 폴더는 최근 활동 순으로 상단에 정렬됨.
//    추후 고객이 파일을 직접 업로드하면 Drive가 modifiedTime을 자동으로 현재로 갱신 → 자동으로 상단 이동.
async function markFolderEmpty(folderId: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,folderColorRgb,modifiedTime`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ folderColorRgb: COLOR_EMPTY, modifiedTime: "1970-01-01T00:00:00.000Z" }),
  });
  if (!r.ok) throw new Error(`mark folder empty: ${r.status} ${await r.text()}`);
}

// ── Drive: 폴더 안의 같은 이름 파일들 중복 제거 (가장 오래된 것만 유지) ──
async function dedupFilesInFolder(folderId: string, token: string): Promise<number> {
  const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'&fields=files(id,name,createdTime)&pageSize=200&orderBy=createdTime&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.warn(`[dedup files] list failed: ${r.status}`);
    return 0;
  }
  const j = await r.json();
  const files = j.files || [];
  // 이름별로 그룹핑
  const byName: Record<string, any[]> = {};
  for (const f of files) {
    if (!byName[f.name]) byName[f.name] = [];
    byName[f.name].push(f);
  }
  let trashed = 0;
  for (const name in byName) {
    const group = byName[name];
    if (group.length <= 1) continue;
    // 가장 오래된 것(첫 번째, orderBy createdTime asc) 유지, 나머지 휴지통
    for (let i = 1; i < group.length; i++) {
      try {
        await trashItem(group[i].id, token);
        trashed++;
      } catch (e: any) {
        console.warn(`[dedup files] trash failed ${group[i].name}: ${e?.message || e}`);
      }
    }
  }
  if (trashed > 0) console.log(`[dedup files] trashed ${trashed} duplicate files in folder ${folderId}`);
  return trashed;
}

// ── Drive: 같은 이름의 중복 폴더가 여러 개 있으면 가장 오래된 것 하나로 통합 ──
//    동시 실행(race condition)으로 같은 이름 폴더가 여러 개 생긴 경우를 정리
async function dedupFolder(name: string, parentId: string, token: string): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&pageSize=20&orderBy=createdTime&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    console.warn(`[dedup] list failed: ${r.status}`);
    return null;
  }
  const j = await r.json();
  const folders = j.files || [];
  if (folders.length === 0) return null;
  if (folders.length === 1) return folders[0].id;
  // 중복: 가장 먼저 만들어진 것을 유지, 나머지는 콘텐츠 이전 후 휴지통
  const keep = folders[0];
  console.log(`[dedup] "${name}" has ${folders.length} duplicates → keeping oldest ${keep.id}`);
  for (let i = 1; i < folders.length; i++) {
    const dup = folders[i];
    try {
      const children = await listFolderChildren(dup.id, token);
      for (const child of children) {
        try {
          await moveItem(child.id, dup.id, keep.id, token);
        } catch (e: any) {
          console.warn(`[dedup] move failed ${child.name}: ${e?.message || e}`);
        }
      }
      await trashItem(dup.id, token);
      console.log(`[dedup] merged & trashed dup ${dup.id} (${children.length} items moved)`);
    } catch (e: any) {
      console.warn(`[dedup] dup ${dup.id} cleanup failed: ${e?.message || e}`);
    }
  }
  return keep.id;
}

// ── Drive: 폴더 안의 모든 항목 (파일 + 폴더) 나열 ──
async function listFolderChildren(folderId: string, token: string): Promise<{ id: string; name: string; mimeType: string }[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`list children: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.files || [];
}

// ── Drive: 파일/폴더 부모 변경 (이동) ──
async function moveItem(itemId: string, fromParent: string, toParent: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${itemId}?addParents=${toParent}&removeParents=${fromParent}&supportsAllDrives=true&fields=id,parents`;
  const r = await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`move: ${r.status} ${await r.text()}`);
}

// ── Drive: 폴더(또는 파일) 삭제 (휴지통으로 이동) ──
async function trashItem(itemId: string, token: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${itemId}?supportsAllDrives=true`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!r.ok) throw new Error(`trash: ${r.status} ${await r.text()}`);
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

  // ★ 2026-05-11: 패턴 재조합 (Python/Claude용 메타) — cotton-print 주문일 때만 출력
  //   원본 이미지 1장 + 이 spec 블록만 있으면 pattern_render.py 로 어떤 해상도로든 재조합 가능.
  //   섹션 헤더는 정규식으로 잘라쓰기 좋게 고정 — "[PATTERN_RENDER_SPEC]"
  const patternItems: any[] = [];
  items.forEach((it: any, idx: number) => {
    const ps = it.pattern_spec;
    if (ps && ps.cell_cm) {
      // 2026-05-11: finish_code/hook_code 명시 — fabric_pattern.py 가 칼선 모양 결정
      //   ps 안에 이미 finish_code 있으면 그걸 우선, 없으면 item-level 에서 추출
      const finishCode = ps.finish_code || it.finish_code || it.finishCode
        || (Array.isArray(it.options)
              ? (it.options.find((o: any) => o?.type === 'finish')?.code || '')
              : '')
        || 'roll';
      const hookCode = ps.hook_code || it.hook_code || it.hookCode
        || (Array.isArray(it.options)
              ? (it.options.find((o: any) => o?.type === 'hook')?.code || '')
              : '')
        || '';
      patternItems.push({
        index: idx,
        product_code: it.product_code,
        product_name: it.product_name,
        fabric: it.fabric,
        qty: it.qty,
        ...ps,
        finish_code: finishCode,
        hook_code: hookCode,
      });
    }
  });
  if (patternItems.length > 0) {
    lines.push(sub);
    lines.push("[패턴 정보 — 사람용 요약]");
    patternItems.forEach((p: any, i: number) => {
      lines.push(`아이템 ${i + 1}: ${p.product_name || p.product_code || '-'}`);
      lines.push(`  원단:       ${p.fabric_cm.w} × ${p.fabric_cm.h} cm`);
      lines.push(`  패턴 셀:    ${p.cell_cm.w} × ${p.cell_cm.h} cm`);
      lines.push(`  레이아웃:   ${p.layout}`);
      lines.push(`  배경색:     ${p.bg_color}`);
      lines.push(`  이미지 비율: ${Math.round((p.image_scale ?? 1) * 100)}%`);
      lines.push(`  원본 파일:  ${p.artwork_filename || '(미상)'}`);
      lines.push("");
    });
    lines.push(sub);
    lines.push("[PATTERN_RENDER_SPEC]");
    lines.push("# 이 JSON 블록을 pattern_render.py 가 자동 파싱해 패턴을 재합성합니다.");
    lines.push("# Claude(또는 다른 AI)에게 '이 메모로 패턴 재조합해줘'라고 하면 본 블록만 봐도 충분합니다.");
    lines.push(JSON.stringify({ spec_version: 1, items: patternItems }, null, 2));
    lines.push("[/PATTERN_RENDER_SPEC]");
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

    // ★ 모드: 'refresh_colors' — 고객주문 폴더 안 모든 customer 폴더 색상을 현재 design_complete 마커에 맞게 갱신.
    //    2026-05-14: 사용자 요청 — 파일 유무 → 마커 파일(.design_complete) 존재 여부 기준으로 변경.
    if (body?.mode === 'refresh_colors') {
      const token = await withRetry("auth", () => getAccessToken(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN));
      const ordersFolderId = await findFolderByName(CUSTOMER_ORDERS_FOLDER_NAME, ROOT_ID, token);
      if (!ordersFolderId) {
        return new Response(JSON.stringify({ error: "고객주문 folder not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const subfolders = await listFolderChildren(ordersFolderId, token);
      const customerFolders = subfolders.filter((f: any) => f.mimeType === "application/vnd.google-apps.folder");
      const results: any[] = [];
      for (const folder of customerFolders) {
        try {
          const hasMarker = await folderHasDesignCompleteMarker(folder.id, token);
          if (hasMarker) {
            await setFolderColor(folder.id, COLOR_HAS_FILES, token);
          } else {
            await markFolderEmpty(folder.id, token);
          }
          results.push({ name: folder.name, design_complete: hasMarker, color: hasMarker ? COLOR_HAS_FILES : COLOR_EMPTY });
        } catch (e: any) {
          results.push({ name: folder.name, error: String(e?.message || e) });
        }
      }
      console.log(`[drive sync] refresh_colors done: ${results.length} folders processed`);
      return new Response(JSON.stringify({ ok: true, mode: 'refresh_colors', folders_processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ★ 모드: 'migrate_folder_names' — 옛 포맷({고객}_{날짜})과 신 포맷({날짜}_{고객}) 중복 폴더 병합
    //    - 중복 그룹: 같은 고객+날짜 조합으로 양쪽 포맷이 다 존재
    //    - 신 포맷이 있으면 신 포맷이 primary, 옛 포맷의 자식들을 신 포맷 폴더로 이동 후 옛 폴더 휴지통으로
    //    - 단독 옛 포맷만 있으면 신 포맷으로 rename
    //    - dry_run: true 옵션으로 미리보기 가능
    if (body?.mode === 'migrate_folder_names') {
      const dryRun = !!body?.dry_run;
      const token = await withRetry("auth", () => getAccessToken(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN));
      const ordersFolderId = await findFolderByName(CUSTOMER_ORDERS_FOLDER_NAME, ROOT_ID, token);
      if (!ordersFolderId) {
        return new Response(JSON.stringify({ error: "고객주문 folder not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const subfolders = await listFolderChildren(ordersFolderId, token);
      const customerFolders = subfolders.filter((f: any) => f.mimeType === "application/vnd.google-apps.folder");

      // Parse + group
      const groups: Record<string, { id: string; name: string; format: 'old' | 'new' }[]> = {};
      const skipped: string[] = [];
      for (const f of customerFolders) {
        const newMatch = (f.name || "").match(/^(\d+월\d+일)_(.+)$/);
        const oldMatch = (f.name || "").match(/^(.+)_(\d+월\d+일)$/);
        let date = "", customer = "", format: 'old' | 'new' | null = null;
        // 신 포맷 우선 매치 (날짜가 앞)
        if (newMatch) { date = newMatch[1]; customer = newMatch[2]; format = 'new'; }
        else if (oldMatch) { date = oldMatch[2]; customer = oldMatch[1]; format = 'old'; }
        else { skipped.push(f.name); continue; }
        const key = `${date}|${customer}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ id: f.id, name: f.name, format });
      }

      const results: any[] = [];
      let merged = 0, renamed = 0, errors = 0;
      for (const [key, folders] of Object.entries(groups)) {
        const [date, customer] = key.split('|');
        const canonicalName = `${date}_${customer}`;

        if (folders.length === 1) {
          const only = folders[0];
          if (only.format === 'old') {
            // 단독 옛 포맷 → rename
            if (!dryRun) {
              try {
                const r = await fetch(`https://www.googleapis.com/drive/v3/files/${only.id}?supportsAllDrives=true`, {
                  method: 'PATCH',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: canonicalName }),
                });
                if (!r.ok) throw new Error(`rename ${r.status}: ${await r.text()}`);
                renamed++;
              } catch (e: any) {
                errors++;
                results.push({ action: 'rename', from: only.name, to: canonicalName, error: e?.message || String(e) });
                continue;
              }
            }
            results.push({ action: 'rename', from: only.name, to: canonicalName, dry_run: dryRun });
          }
          continue;
        }

        // 중복: primary는 신 포맷 우선, 없으면 첫 번째
        const newFmt = folders.find(f => f.format === 'new');
        const primary = newFmt || folders[0];
        const others = folders.filter(f => f.id !== primary.id);

        let movedFiles = 0;
        const otherDetails: any[] = [];
        for (const other of others) {
          try {
            const children = await listFolderChildren(other.id, token);
            if (!dryRun) {
              for (const child of children) {
                try {
                  await moveItem(child.id, other.id, primary.id, token);
                  movedFiles++;
                } catch (e: any) {
                  console.warn(`[migrate] move failed ${child.name}: ${e?.message || e}`);
                }
              }
              await trashItem(other.id, token);
            }
            otherDetails.push({ name: other.name, children: children.length });
          } catch (e: any) {
            errors++;
            otherDetails.push({ name: other.name, error: e?.message || String(e) });
          }
        }

        // primary가 옛 포맷이면 rename
        if (primary.format === 'old' && !dryRun) {
          try {
            const r = await fetch(`https://www.googleapis.com/drive/v3/files/${primary.id}?supportsAllDrives=true`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: canonicalName }),
            });
            if (r.ok) renamed++;
          } catch (e: any) {
            console.warn(`[migrate] rename primary failed: ${e?.message || e}`);
          }
        }

        merged++;
        results.push({
          action: 'merge',
          primary: primary.name,
          primary_renamed_to: primary.format === 'old' ? canonicalName : null,
          others: otherDetails,
          files_moved: movedFiles,
          dry_run: dryRun,
        });
      }

      console.log(`[migrate] dry_run=${dryRun} groups=${results.length} merged=${merged} renamed=${renamed} errors=${errors} skipped=${skipped.length}`);
      return new Response(JSON.stringify({
        ok: true, mode: 'migrate_folder_names', dry_run: dryRun,
        merged, renamed, errors, skipped_count: skipped.length, skipped,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // ★ 임시작성(미결제) 주문은 동기화 스킵 — Drive 노이즈 방지
    if (order.status === '임시작성') {
      console.log(`[drive sync] skip draft order=${orderId} status=임시작성`);
      return new Response(JSON.stringify({ ok: true, skipped: 'draft order', order_no: order.id, status: order.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    // 주문일 기준: order.order_date 우선, 없으면 KST 오늘
    const orderDateStr = (order.order_date && /^\d{4}-\d{2}-\d{2}/.test(String(order.order_date)))
      ? String(order.order_date).slice(0, 10)
      : todayKST();
    // 폴더명용 짧은 한국어 날짜 (예: 4월27일)
    const orderDateShort = toKoreanShortDate(orderDateStr);
    const customerFolderName = sanitize(`${orderDateShort}_${customerRaw}`);
    const baseName = `${code}_${orderNo}_${customer}`;  // 파일 prefix

    // 3) Drive 토큰 (OAuth refresh_token 기반)
    const token = await withRetry("auth", () => getAccessToken(OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN));

    // 3-2) ★ 멱등성 체크: 이미 동기화된 주문이면 작업 스킵 (중복 호출 방지)
    //      판단 기준: {고객명}_{주문일} 폴더 안에 {baseName}_정보.txt 파일이 이미 있으면 동기화 완료된 상태
    try {
      const customerOrdersForCheck = await findFolderByName(CUSTOMER_ORDERS_FOLDER_NAME, ROOT_ID, token);
      if (customerOrdersForCheck) {
        const customerFolderForCheck = await findFolderByName(customerFolderName, customerOrdersForCheck, token);
        if (customerFolderForCheck) {
          const expectedMemoName = `${baseName}_정보.txt`;
          const q = `name='${expectedMemoName.replace(/'/g, "\\'")}' and '${customerFolderForCheck}' in parents and trashed=false`;
          const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const j = await r.json();
            if ((j.files || []).length > 0) {
              console.log(`[drive sync] already synced — memo "${expectedMemoName}" exists, applying color/marker and skipping order=${orderId}`);
              // 2026-05-14: design_complete 기반으로 색상/마커 갱신.
              let appliedColor = "";
              try {
                const isDesignDone = !!order.design_complete;
                if (isDesignDone) {
                  try { await ensureDesignCompleteMarker(customerFolderForCheck, token); } catch (_) {}
                  try { await setFolderColor(customerFolderForCheck, COLOR_HAS_FILES, token); appliedColor = COLOR_HAS_FILES; } catch (_) {}
                } else {
                  try { await removeDesignCompleteMarker(customerFolderForCheck, token); } catch (_) {}
                  try { await markFolderEmpty(customerFolderForCheck, token); appliedColor = COLOR_EMPTY; } catch (_) {}
                }
              } catch (colorErr: any) {
                console.warn(`[drive sync] skip-path color update failed: ${colorErr?.message || colorErr}`);
              }
              const folderUrl = `https://drive.google.com/drive/folders/${customerFolderForCheck}`;
              return new Response(JSON.stringify({
                ok: true,
                skipped: 'already synced (memo exists)',
                customer_folder_id: customerFolderForCheck,
                customer_folder_url: folderUrl,
                folder_color: appliedColor,
                design_complete: !!order.design_complete,
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[drive sync] idempotency check failed (proceeding): ${e?.message || e}`);
    }

    // 4) 폴더 트리 준비:
    //    {ROOT}/고객주문/{고객명}_{주문일}/   + {ROOT}/끝난작업/ (파이썬이 이동시킬 곳, 미리 보장)
    // 2026-05-14: 작업지시서 평면 폴더 생성 제거 — workorder.html 페이지로 대체됨.
    const customerOrdersFolderId = await withRetry("customerOrdersFolder", () => findOrCreateFolder(CUSTOMER_ORDERS_FOLDER_NAME, ROOT_ID, token));
    const customerFolderId = await withRetry("customerFolder", () => findOrCreateFolder(customerFolderName, customerOrdersFolderId, token));
    // 끝난작업 폴더는 한 번만 보장 (fire-and-forget, 실패해도 sync 자체엔 영향 없음)
    withRetry("doneFolder", () => findOrCreateFolder(DONE_FOLDER_NAME, ROOT_ID, token)).catch((e: any) => console.warn(`[drive sync] 끝난작업 folder ensure failed: ${e?.message || e}`));
    console.log(`[drive sync] folders ready: ${CUSTOMER_ORDERS_FOLDER_NAME}/${customerFolderName} (${customerFolderId})`);

    // 4-2) ★ 고객이 미리 만들어둔 {고객명} 폴더 (날짜 접두사 없음) 자동 병합
    //      예: 고객이 "진기효" 폴더에 큰 파일 업로드 → 주문 시 "4월27일_진기효"로 자동 이전
    let mergedFromManual = 0;
    try {
      const manualFolderId = await findFolderByName(customer, customerOrdersFolderId, token);
      if (manualFolderId && manualFolderId !== customerFolderId) {
        console.log(`[drive sync] manual folder found: ${customer} (${manualFolderId}) — merging into ${customerFolderName}`);
        const children = await listFolderChildren(manualFolderId, token);
        for (const child of children) {
          try {
            await moveItem(child.id, manualFolderId, customerFolderId, token);
            mergedFromManual++;
          } catch (e: any) {
            console.warn(`[drive sync] move failed: ${child.name} — ${e?.message || e}`);
          }
        }
        console.log(`[drive sync] merged ${mergedFromManual}/${children.length} items from manual folder`);
        // 모든 항목 이동 성공 시 빈 폴더 휴지통으로
        if (mergedFromManual === children.length && children.length > 0) {
          try {
            await trashItem(manualFolderId, token);
            console.log(`[drive sync] empty manual folder trashed: ${customer}`);
          } catch (e: any) {
            console.warn(`[drive sync] trash empty folder failed: ${e?.message || e}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`[drive sync] manual folder merge skipped: ${e?.message || e}`);
    }

    // 5) 파일 분류 — 디자인 파일만 업로드 대상.
    //    2026-05-14: 작업지시서 폴더 제거 — order_sheet/quotation 타입은 더 이상 Drive로 업로드하지 않음.
    //                작업지시서는 /workorder.html?id=NNN HTML 페이지로 직접 조회.
    const allFiles = (Array.isArray(order.files) ? order.files : [])
      .filter((f: any) => f && f.url && f.type !== "_error_log" && f.type !== "order_sheet" && f.type !== "quotation");
    const designs: any[] = allFiles;

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

    // 7) 작업지시서/견적서 업로드: 2026-05-14 제거됨.
    //    /workorder.html?id=NNN (Cotton: /cotton_workorder.html) HTML 페이지로 대체.

    // 8) 정보 메모 (txt) — 항상 생성, 고객 폴더({날짜}/{고객명}/) 안에 저장
    try {
      const memoContent = buildOrderMemo(order);
      const memoBytes = new TextEncoder().encode(memoContent);
      const memoName = `${baseName}_정보.txt`;
      await withRetry("memo", () =>
        uploadFile(memoName, customerFolderId, "text/plain; charset=utf-8", memoBytes, token)
      );
      filesUploaded.push(memoName);
    } catch (e: any) {
      console.error(`[drive sync] memo failed: ${e?.message || e}`);
      fileErrors.push({ name: "정보.txt", error: String(e?.message || e) });
    }

    // 9) 동시 실행으로 같은 이름 폴더가 여러 개 생긴 경우를 정리 (race condition 방어)
    let finalCustomerFolderId = customerFolderId;
    try {
      const dedupedId = await dedupFolder(customerFolderName, customerOrdersFolderId, token);
      if (dedupedId && dedupedId !== customerFolderId) {
        console.log(`[drive sync] dedup: customer folder consolidated ${customerFolderId} → ${dedupedId}`);
        finalCustomerFolderId = dedupedId;
      }
    } catch (e: any) {
      console.warn(`[drive sync] customer folder dedup failed: ${e?.message || e}`);
    }

    // 9-2) ★ 파일 레벨 dedup: 고객 폴더만 (작업지시서 폴더 제거됨)
    try {
      const trashedCustomer = await dedupFilesInFolder(finalCustomerFolderId, token);
      if (trashedCustomer > 0) {
        console.log(`[drive sync] file dedup cleaned: customer=${trashedCustomer}`);
      }
    } catch (e: any) {
      console.warn(`[drive sync] file dedup failed: ${e?.message || e}`);
    }

    // 9-3) ★ 폴더 색상 마킹 + design_complete 마커 파일.
    //   2026-05-14: 파일 유무 → order.design_complete 기준으로 변경.
    //   design_complete=true: 초록 + .design_complete 마커 파일 ON
    //   design_complete=false: 빨강 + 마커 OFF
    let folderColorApplied = "";
    let markerState: "added" | "removed" | "kept" | "error" = "kept";
    try {
      const isDesignDone = !!order.design_complete;
      if (isDesignDone) {
        try { await ensureDesignCompleteMarker(finalCustomerFolderId, token); markerState = "added"; }
        catch (mErr: any) { markerState = "error"; console.warn(`[drive sync] marker add failed: ${mErr?.message || mErr}`); }
        try { await setFolderColor(finalCustomerFolderId, COLOR_HAS_FILES, token); folderColorApplied = COLOR_HAS_FILES; }
        catch (cErr: any) { console.warn(`[drive sync] color GREEN failed: ${cErr?.message || cErr}`); }
        console.log(`[drive sync] folder marked DESIGN COMPLETE — green + marker`);
      } else {
        try { const removed = await removeDesignCompleteMarker(finalCustomerFolderId, token); if (removed > 0) markerState = "removed"; }
        catch (mErr: any) { console.warn(`[drive sync] marker remove failed: ${mErr?.message || mErr}`); }
        try { await markFolderEmpty(finalCustomerFolderId, token); folderColorApplied = COLOR_EMPTY; }
        catch (cErr: any) { console.warn(`[drive sync] color RED failed: ${cErr?.message || cErr}`); }
        console.log(`[drive sync] folder marked PENDING — red, marker removed`);
      }
    } catch (e: any) {
      console.warn(`[drive sync] color/marker step failed: ${e?.message || e}`);
    }

    const customerFolderUrl = `https://drive.google.com/drive/folders/${finalCustomerFolderId}`;
    console.log(`[drive sync] done order=${orderId} customer=${customer} files=${filesUploaded.length}/${allFiles.length + 1} url=${customerFolderUrl}`);

    return new Response(JSON.stringify({
      ok: true,
      order_date: orderDateStr,
      customer_folder_name: customerFolderName,
      customer_folder_id: finalCustomerFolderId,
      customer_folder_url: customerFolderUrl,
      merged_from_manual: mergedFromManual,
      folder_color: folderColorApplied,
      design_complete: !!order.design_complete,
      design_complete_marker: markerState,
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
