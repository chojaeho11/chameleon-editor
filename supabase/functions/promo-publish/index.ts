// ============================================================
// promo-publish — 홍보사진 → AI 제품 판별 → 한/일/영 블로그 자동 발행
// 2026-07-17 신규.
//
// 흐름:
//   promo-sync.sh 가 홍보사진/ 폴더의 사진을 storage 에 올리고 promo_photos(status='new') 에 등록
//   → (pg_cron 매일 18시 KST) 이 함수가 대기 사진을 모아서
//     1) Vision 1회 호출로 "각 사진이 우리 제품 중 무엇인지" 판별
//     2) 판별된 제품들로 「게임하듯 클릭 몇 번으로」 컨셉의 글을 한/일/영 3개국어 생성
//     3) blog_posts 에 발행 (사진 여러 장 = 글 1개)
//     4) 인스타/쓰레드는 marketing_social_config 에 설정이 있을 때만 게시
//
// 설계 메모:
//   - marketing-content 를 재사용하지 않고 독립 함수로 만든 이유:
//     marketing-content 는 global_products.js 의 밤샘 자동작업과 marketing_bot 이 공유한다.
//     또 imageBase64 를 1장만 받고 media_type 이 image/jpeg 로 하드코딩돼 있어
//     다중 이미지 + PNG/WebP 판별에 못 쓴다. 건드리면 회귀 위험이 커서 분리했다.
//   - 판별 실패 사진은 발행하지 않고 skipped — 완전 자동이라 엉뚱한 글이 나가면 되돌리기 어렵다.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_MAIN = "claude-sonnet-4-5-20250929";
const MODEL_FALLBACK = "claude-haiku-4-5-20251001";

// 발행 언어 — 사장님 결정: 8개국어 → 한/일/영 3개만 (하루 3글 = 스팸 안전)
const LANGS = [
    { lang: "kr", countryCode: "KR", label: "한국어", site: "www.cafe2626.com" },
    { lang: "ja", countryCode: "JP", label: "日本語", site: "www.cafe0101.com" },
    { lang: "en", countryCode: "US", label: "English", site: "www.cafe3355.com" },
];

async function callClaude(apiKey: string, body: any): Promise<any> {
    for (const model of [MODEL_MAIN, MODEL_FALLBACK]) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({ ...body, model }),
        });
        if (r.ok) {
            const d = await r.json();
            // max_tokens 로 잘리면 JSON 이 미완성이라 파싱이 실패한다.
            // (실제로 한국어 글에서 발생 — 한국어는 토큰 소모가 커서 3000 으로는 부족했음)
            if (d.stop_reason === "max_tokens") {
                throw new Error(`응답이 max_tokens(${body.max_tokens})에서 잘렸습니다`);
            }
            return d.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
        }
        // 429/5xx 면 폴백 모델로 재시도, 그 외는 즉시 실패
        if (r.status !== 429 && r.status < 500) {
            throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
        }
        console.warn(`[promo] ${model} ${r.status} → 폴백 시도`);
    }
    throw new Error("Claude 호출 실패 (폴백까지 소진)");
}

function parseJson(raw: string): any {
    let t = String(raw || "").replace(/```(?:json)?\s*\n?/g, "").replace(/```\s*$/g, "").trim();
    try { return JSON.parse(t); } catch (_) { /* fallthrough */ }
    // 앞뒤 설명이 붙은 경우 첫 { ~ 마지막 } 만 추출
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s >= 0 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch (_) {} }
    throw new Error("JSON 파싱 실패: " + t.slice(0, 200));
}

function esc(s: string): string {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// storage 이미지 → base64 (media_type 실제값 유지)
async function fetchImage(url: string): Promise<{ data: string; media_type: string } | null> {
    try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
        if (!/^image\/(jpeg|png|webp|gif)$/.test(ct)) return null;
        const buf = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        const CH = 0x8000;
        for (let i = 0; i < buf.length; i += CH) {
            bin += String.fromCharCode(...buf.subarray(i, i + CH));
        }
        return { data: btoa(bin), media_type: ct };
    } catch (e) {
        console.warn("[promo] 이미지 로드 실패:", url, e);
        return null;
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const json = (o: any) =>
        new Response(JSON.stringify(o), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    try {
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" });
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json({ error: "Supabase env not configured" });

        const body = await req.json().catch(() => ({}));
        const maxPhotos = Math.min(Number(body.maxPhotos) || 12, 12);
        const force = body.force === true;   // 킬스위치 무시 (관리자 수동 발행)

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // ── 0) 킬스위치
        if (!force) {
            const { data: st } = await sb.from("promo_settings").select("auto_publish").eq("id", 1).single();
            if (st && st.auto_publish === false) {
                return json({ ok: true, skipped: "자동발행이 꺼져 있습니다 (킬스위치)" });
            }
        }

        // ── 1) 대기 사진
        const { data: photos, error: pErr } = await sb
            .from("promo_photos").select("id, storage_url, filename")
            .eq("status", "new").order("created_at", { ascending: true }).limit(maxPhotos);
        if (pErr) throw pErr;
        if (!photos || photos.length === 0) return json({ ok: true, message: "대기 중인 사진이 없습니다." });

        // ── 2) 제품 목록 (ua_* 고객 아트워크 1,600여 행 제외 — 안 거르면 아트워크를 제품으로 오인)
        const [prodRes, catRes] = await Promise.all([
            sb.from("admin_products").select("code,name,name_jp,name_us,category")
                .not("code", "like", "ua_%").order("sort_order", { ascending: true }).limit(500),
            sb.from("admin_categories").select("code,name"),
        ]);
        const catName: Record<string, string> = {};
        (catRes.data || []).forEach((c: any) => { catName[c.code] = c.name; });
        const products = (prodRes.data || []).filter((p: any) => !String(p.category || "").startsWith("ua_"));
        // 카테고리 코드가 뒤죽박죽(75001, 2342424 등)이라 사람이 읽는 name 으로 후보 제시
        const catalog = products
            .map((p: any) => `${p.code} | ${p.name} | ${catName[p.category] || p.category || "-"}`)
            .join("\n");

        // ── 3) 이미지 로드
        const imgs: any[] = [];
        const usable: any[] = [];
        for (const ph of photos) {
            const im = await fetchImage(ph.storage_url);
            if (im) { imgs.push(im); usable.push(ph); }
            else await sb.from("promo_photos").update({ status: "error", error: "이미지 로드 실패" }).eq("id", ph.id);
        }
        if (usable.length === 0) return json({ ok: false, error: "로드 가능한 사진이 없습니다." });

        // ── 4) Vision — 각 사진이 우리 제품 중 무엇인지 판별 (1회 호출)
        const visionSystem = `당신은 인쇄·광고물 제작업체 '카멜레온프린팅'의 제품 분류 전문가입니다.
사용자가 자사에서 제작한 결과물 사진 ${usable.length}장을 순서대로 보냅니다.
각 사진이 아래 제품 목록 중 무엇인지 판별하세요.

[제품 목록: 코드 | 이름 | 카테고리]
${catalog}

규칙:
- 출력은 오직 JSON. 설명·마크다운 금지.
- 형식: {"items":[{"index":0,"product_code":"...","product_name":"...","note":"사진 속 제작물 한 줄 설명"}]}
- index 는 사진 순서(0부터).
- 확신이 없으면 product_code 를 빈 문자열 "" 로 두세요. (틀린 판별로 엉뚱한 홍보글이 나가는 것보다 낫습니다)
- product_name 은 위 목록의 카테고리 이름(명함, 현수막, 리플릿, 허니콤보드, 배너 등)을 우선 사용하세요.
- note 는 한국어로, 사진에서 실제로 보이는 것만 적으세요. 추측 금지.`;

        const visionContent: any[] = [];
        imgs.forEach((im, i) => {
            visionContent.push({ type: "text", text: `사진 ${i}:` });
            visionContent.push({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
        });
        visionContent.push({ type: "text", text: "위 사진들을 판별해 JSON 으로만 답하세요." });

        const visionRaw = await callClaude(ANTHROPIC_API_KEY, {
            max_tokens: 2000, system: visionSystem,
            messages: [{ role: "user", content: visionContent }],
        });
        const vision = parseJson(visionRaw);
        const items: any[] = Array.isArray(vision.items) ? vision.items : [];

        // 판별 결과 기록 + 실패분 skipped
        const identified: any[] = [];
        for (let i = 0; i < usable.length; i++) {
            const it = items.find((x: any) => Number(x.index) === i) || {};
            const code = String(it.product_code || "").trim();
            const known = code ? products.find((p: any) => p.code === code) : null;
            if (!known) {
                await sb.from("promo_photos").update({
                    status: "skipped", vision_note: it.note || null,
                    error: "제품 판별 실패 — 발행 제외",
                }).eq("id", usable[i].id);
                continue;
            }
            const pname = String(it.product_name || known.name || "").trim();
            await sb.from("promo_photos").update({
                product_code: known.code, product_name: pname, vision_note: it.note || null,
            }).eq("id", usable[i].id);
            identified.push({ photo: usable[i], product: known, name: pname, note: it.note || "" });
        }

        if (identified.length === 0) {
            return json({ ok: false, error: "판별된 제품이 없어 발행하지 않았습니다.", checked: usable.length });
        }

        // ── 5) 언어별 글 생성 + 발행
        const productSummary = identified
            .map((d, i) => `${i + 1}. ${d.name} (코드 ${d.product.code}) — ${d.note}`)
            .join("\n");
        const uniqNames = [...new Set(identified.map((d) => d.name))];
        const batchId = Date.now();
        const results: any[] = [];
        let sourceId: string | null = null;   // KR 글 id — ja/en 이 이걸 물고 hreflang 형제가 됨

        for (const L of LANGS) {
            try {
                const nameField = L.lang === "ja" ? "name_jp" : L.lang === "en" ? "name_us" : "name";
                const localNames = [...new Set(identified.map((d) => d.product[nameField] || d.name))];

                const sys = `당신은 인쇄·광고물 제작업체 '카멜레온프린팅'의 ${L.label} 콘텐츠 마케터입니다.
오늘 실제로 제작한 결과물 사진들을 소개하는 블로그 글을 ${L.label}로 씁니다.

[회사 핵심 컨셉 — 글 전체가 이 메시지를 향해야 합니다]
"세상의 모든 인쇄물·광고물을, 튜토리얼 가이드를 따라 게임하듯 클릭 몇 번으로 디자인부터 제작까지."
→ 반드시 담을 메시지: "{제품명}을 게임하듯 가이드에 따라 클릭 몇 번으로 쉽게 만드세요. 전문가처럼 멋진 홍보물이 만들어집니다."
   (${L.label}로 자연스럽게 표현. 직역투 금지)

[오늘의 제작물]
${productSummary}

[규칙]
- 출력은 오직 JSON. 설명·마크다운 펜스 금지.
- 형식: {"title":"...","meta_description":"...","focus_keyword":"...","body":"<p>...</p>","hashtags":["..."]}
- body 는 HTML (<p>, <h2>, <ul>, <strong> 만 사용). 이미지 태그는 넣지 마세요 — 시스템이 자동으로 붙입니다.
- 길이: 600~900자 분량. 과장 광고·허위 표현 금지. 가격은 언급하지 마세요.
- 디자인이 어렵다고 느끼는 사장님·소상공인이 읽는다는 전제로, 쉽다는 점을 구체적으로.
- 링크는 https://${L.site} 만 사용.
- ${L.label} 원어민이 읽기에 자연스러워야 합니다.`;

                // max_tokens 8000 — 3000 은 한국어 글에서 잘렸다(실측). 한국어/일본어는 토큰 소모가 큼.
                // 1회 재시도: 일시적 실패로 KR 이 빠지면 source_id 연결까지 어긋나므로 그냥 넘기지 않는다.
                let c: any = null, lastErr: any = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const raw = await callClaude(ANTHROPIC_API_KEY, {
                            max_tokens: 8000, system: sys,
                            messages: [{ role: "user", content: `오늘 제작물: ${localNames.join(", ")}. 위 규칙대로 ${L.label} 블로그 글을 JSON 으로 작성하세요.` }],
                        });
                        c = parseJson(raw);
                        break;
                    } catch (e) {
                        lastErr = e;
                        console.warn(`[promo] ${L.lang} 생성 실패 (시도 ${attempt + 1}/2):`, e);
                    }
                }
                if (!c) throw lastErr || new Error("생성 실패");

                // 본문 + 사진 전부 임베드 (사진 여러 장 = 글 1개)
                const gallery = identified
                    .map((d) => `<figure style="margin:18px 0;"><img src="${d.photo.storage_url}" alt="${esc(d.product[nameField] || d.name)}" style="max-width:100%;border-radius:10px;"><figcaption style="font-size:13px;color:#64748b;margin-top:6px;">${esc(d.product[nameField] || d.name)}</figcaption></figure>`)
                    .join("\n");
                const cta = `<p style="margin-top:22px;"><a href="https://${L.site}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;">${L.lang === "ja" ? "今すぐ作ってみる" : L.lang === "en" ? "Start creating now" : "지금 만들어보기"}</a></p>`;
                const htmlBody = `${c.body || ""}\n${gallery}\n${cta}`;

                const seoMeta: any = {
                    meta_description: c.meta_description || "",
                    focus_keyword: c.focus_keyword || uniqNames[0] || "",
                    hashtags: c.hashtags || [],
                    og_image: identified[0].photo.storage_url,
                    promo_batch: batchId,
                };
                // KR 이 원본 → ja/en 은 source_id 로 KR 을 가리킨다.
                // (기존 marketing_bot 은 source_id 를 안 넣어서 board.html 의 hreflang 형제 조회가 늘 자기 자신만 반환했다)
                if (sourceId) seoMeta.source_id = sourceId;

                const ins = await sb.from("blog_posts").insert({
                    category: "blog",
                    country_code: L.countryCode,
                    title: c.title || uniqNames.join(", "),
                    content: htmlBody,
                    author_name: "카멜레온프린팅",
                    author_email: "",
                    author_id: null,
                    thumbnail: identified[0].photo.storage_url,
                    markdown: JSON.stringify(seoMeta),
                    // 실제 컬럼 — board.html 의 hreflang 형제글 조회가 이걸로 동작한다.
                    // (markdown 은 text 컬럼이라 PostgREST 가 markdown->>source_id 필터를 못 쓴다)
                    source_id: sourceId,
                }).select("id").single();
                if (ins.error) throw ins.error;

                if (!sourceId) sourceId = ins.data.id;   // 첫 글(KR)을 원본으로
                results.push({ lang: L.lang, post_id: ins.data.id, title: c.title });

                // ── 인스타/쓰레드 — 설정이 있을 때만 (없으면 조용히 스킵)
                if (L.lang === "kr") {
                    for (const platform of ["instagram", "threads"]) {
                        try {
                            const { data: cfg } = await sb.from("marketing_social_config")
                                .select("enabled").eq("platform", platform).maybeSingle();
                            if (!cfg || !cfg.enabled) continue;
                            // social-post 의 인자 형식: { platform, title, summary, link, image_url, hashtags[] }
                            //   hashtags 는 '#' 없는 순수 단어 배열 (함수가 직접 '#' 를 붙임)
                            const spRes = await fetch(`${SUPABASE_URL}/functions/v1/social-post`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
                                body: JSON.stringify({
                                    platform,
                                    title: c.title || uniqNames.join(", "),
                                    summary: c.meta_description || "",
                                    link: `https://${L.site}`,
                                    image_url: identified[0].photo.storage_url,
                                    hashtags: (c.hashtags || []).map((h: string) => String(h).replace(/^#/, "")),
                                }),
                            });
                            const spData = await spRes.json().catch(() => ({}));
                            results.push({ platform, posted: spData.success === true, detail: spData.error || spData.reason || null });
                        } catch (e) {
                            console.warn(`[promo] ${platform} 게시 실패:`, e);
                        }
                    }
                }
            } catch (e) {
                console.error(`[promo] ${L.lang} 발행 실패:`, e);
                results.push({ lang: L.lang, error: String(e && (e as any).message || e) });
            }
        }

        // ── 6) 사진 상태 갱신
        const publishedIds = identified.map((d) => d.photo.id);
        await sb.from("promo_photos").update({
            status: "published", batch_id: batchId, published_at: new Date().toISOString(),
        }).in("id", publishedIds);

        return json({
            ok: true, batch_id: batchId,
            photos: publishedIds.length, skipped: usable.length - identified.length,
            products: uniqNames, results,
        });
    } catch (e) {
        console.error("[promo-publish]", e);
        return json({ ok: false, error: String(e && (e as any).message || e) });
    }
});
