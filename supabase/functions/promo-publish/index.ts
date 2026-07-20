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
//   노출: 한국어=한국 사이트만 / 일본어=일본 사이트만 / 영어=한국·일본 제외 전 국가
//   2026-07-17: 영어권 도메인은 chameleon.design. cafe3355.com 은 종이매대 전용 랜딩이라
//   블로그가 없다(_worker.js:609) — 글 안의 링크가 엉뚱한 페이지로 가고 있었다.
//   contact/fabricSite: 글 말미 안내에 들어갈 실제 연락처·사이트 (2026-07-17 사장님 지시).
//     한국 = 본사 031-366-1984 / 일본 = 나나미 090-5397-0420 (LINE @astro.0420)
//     번호는 실제 사이트에서 확인한 값 — 임의로 바꾸지 말 것.
const LANGS = [
    // author: 작성자명도 해당 언어로 (일본 사이트에 '카멜레온프린팅' 이 한글로 뜨던 문제)
    {
        lang: "kr", countryCode: "KR", label: "한국어", site: "www.cafe2626.com", author: "카멜레온프린팅",
        contact: "본사 031-366-1984", fabricSite: "www.cotton-print.com",
    },
    {
        lang: "ja", countryCode: "JP", label: "日本語", site: "www.cafe0101.com", author: "カメレオンプリンティング",
        contact: "ナナミ 090-5397-0420 (LINE: @astro.0420)", fabricSite: "www.cotton-printer.com",
    },
    {
        lang: "en", countryCode: "US", label: "English", site: "www.chameleon.design", author: "Chameleon Printing",
        contact: "Hiba +82 10-3491-3535 (WhatsApp)", fabricSite: "www.cotton-printer.com",
    },
];

// 2026-07-17: 모든 블로그 글에 들어가는 고정 브랜드 메시지 (사장님 지시 문구 그대로).
//   AI 에게 매번 쓰게 하면 문구가 조금씩 달라지므로 코드에서 그대로 붙인다.
//   번역도 고정 — 매번 번역하면 표현이 흔들리고 토큰만 더 든다.
const BRAND_PITCH: Record<string, { q: string; body: string; slogan: string }> = {
    kr: {
        q: "이런 거 만들려고 하는데 디자인을 어디서 의뢰하지? 사이즈도 잘 모르겠고, 설치는 어떻게 의뢰하지? 가격이 비싸지 않을까?",
        body: "이런 고민 많죠? 쓰고 싶은 내용만 넣으면 최신 인공지능이 놀라운 디자인을 해주고, 그 다음은 튜토리얼대로 클릭 몇 번만 하면 그냥 뚝딱! 담당 매니저가 내 물건이 잘 만들어지고 있는지 세심하게 챙겨드리니까 안심. 이제 모든 인쇄 광고물 굿즈는 카멜레온프린팅에서 쉽게 빠르게 저렴하게.",
        slogan: "1등이 1등인 이유, 카멜레온프린팅!",
    },
    ja: {
        q: "こんなものを作りたいけど、デザインはどこに頼めばいい？サイズもよく分からないし、設置は誰に頼むの？値段も高いんじゃない？",
        body: "そんなお悩み、ありませんか？ 入れたい内容を入力するだけで、最新のAIが驚くようなデザインに仕上げます。あとはチュートリアル通りにクリック数回、それだけで完成！ 担当マネージャーがお客様の商品がきちんと作られているか細かく見守るので安心です。これからは、印刷物・広告物・グッズのすべてをカメレオンプリンティングで。簡単に、速く、お手頃に。",
        slogan: "1位が1位である理由。カメレオンプリンティング！",
    },
    en: {
        q: "I want to make something like this — but where do I get the design done? I'm not sure about the size, and who handles the installation? Won't it be expensive?",
        body: "Sound familiar? Just enter what you want on it, and our latest AI turns it into a stunning design. After that, follow the tutorial — a few clicks and it's done. Your dedicated manager keeps a close eye on your order while it's being made, so you can relax. From now on, every printed item, sign, and piece of merch: easy, fast and affordable at Chameleon Printing.",
        slogan: "There's a reason the No.1 is No.1 — Chameleon Printing!",
    },
};
const INDEXNOW_KEY = "cf8e9a2b4d6f1c3e5a7b9d0f2e4c6a8b";

// 2026-07-17: 발행 즉시 색인 요청 (IndexNow → Bing/Yandex/Naver 등).
//   기존 search-index-notify 는 제품 URL 만 제출해서 블로그 글은 색인 요청이 한 번도 안 나갔다.
async function pingIndexNow(urls: string[]) {
    const byHost: Record<string, string[]> = {};
    urls.forEach((u) => {
        try { const h = new URL(u).hostname; (byHost[h] = byHost[h] || []).push(u); } catch (_) {}
    });
    for (const host of Object.keys(byHost)) {
        try {
            const r = await fetch("https://yandex.com/indexnow", {
                method: "POST",
                headers: { "Content-Type": "application/json; charset=utf-8" },
                body: JSON.stringify({
                    host, key: INDEXNOW_KEY,
                    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
                    urlList: byHost[host],
                }),
            });
            console.log(`[promo] IndexNow ${host}: ${r.status}`);
        } catch (e) { console.warn("[promo] IndexNow 실패:", host, e); }
    }
}

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

        // 2026-07-17: 호출자 검증.
        //   블로그 화면(board.html)에 「지금 발행」 버튼을 노출하면서 이 엔드포인트가 사실상 공개된다.
        //   버튼은 관리자에게만 보이지만 엔드포인트 자체는 로그인한 누구나 부를 수 있으므로
        //   (Claude 토큰 소모 + 임의 발행) 서버에서 직접 막는다.
        //   허용: service_role (cron/스크립트) 또는 관리자 이메일 (config.js ADMIN_EMAILS 와 동일)
        const ADMIN_EMAILS = ["korea900as@gmail.com", "ceo@test.com", "scr3257@naver.com"];
        const authz = req.headers.get("Authorization") || "";
        let allowed = false;
        try {
            const jwt = authz.replace(/^Bearer\s+/i, "");
            const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            if (payload.role === "service_role") allowed = true;
            else if (payload.email && ADMIN_EMAILS.includes(String(payload.email).toLowerCase())) allowed = true;
        } catch (_) { allowed = false; }
        if (!allowed) return json({ ok: false, error: "관리자만 실행할 수 있습니다." });

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
        // 2026-07-17: 제품군(카테고리) 목록 — 227개 SKU 중 하나를 정확히 고르라고 하면 AI 가 몸을 사려서
        //   실제로 우리 제품인 사진(가벽·포토존 등)도 전부 스킵됐다. 제품군 단위로 먼저 맞추게 한다.
        const catNames = [...new Set(products.map((p: any) => catName[p.category]).filter(Boolean))];
        const catalogCats = catNames.join(", ");

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
각 사진의 제작물이 어느 제품군(category)에 속하는지 판별하세요.

[우리 제품군 목록 — 이 중에서 고르세요]
${catalogCats}

[참고: 세부 제품 목록 (코드 | 이름 | 제품군)]
${catalog}

규칙:
- 출력은 오직 JSON. 설명·마크다운 금지.
- 형식: {"items":[{"index":0,"category":"허니콤 포토존","product_code":"","note":"사진에 보이는 제작물 설명"}]}
- index 는 사진 순서(0부터).
- **category 는 위 제품군 목록에 있는 이름을 그대로** 쓰세요. 우리 제품군 중 하나로 보이면 반드시 채우세요.
  (예: 한옥 대문 모양 포토존 → "허니콤 포토존" / 기와지붕·돌담 질감 벽 → "허니콤 가벽" / 전시 안내 패널 → 해당 보드·판넬 제품군)
- product_code 는 세부 제품까지 확신할 때만 채우고, 아니면 빈 문자열 "" 로 두세요. (category 만 맞아도 충분합니다)
- 우리 제품군 어디에도 해당하지 않으면(예: 음식 사진, 풍경, 사람만 찍힌 사진) category 를 "" 로 두세요.
- note 는 한국어로, **사진에서 실제로 보이는 것만** 구체적으로 적으세요. 용도·사용처를 추측하지 마세요.
  글감이 되므로 무엇이 어떻게 만들어졌는지(형태·소재감·인쇄된 문구·설치 형태)를 적되, **사진 한 장당 150자 이내**로 압축하세요.`;

        const visionContent: any[] = [];
        imgs.forEach((im, i) => {
            visionContent.push({ type: "text", text: `사진 ${i}:` });
            visionContent.push({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
        });
        visionContent.push({ type: "text", text: "위 사진들을 판별해 JSON 으로만 답하세요." });

        // 2026-07-20: max_tokens 2000 → 8000.
        //   사진 12장 × 한국어 note(형태·소재·문구·설치형태) 를 JSON 으로 뱉으면 2000 을 넘어
        //   "응답이 max_tokens(2000)에서 잘렸습니다" 로 발행 전체가 죽었다 (본문 생성은 이미 8000).
        //   Vision 은 재시도 경로가 없어 여기서 던지면 그날 발행이 통째로 날아간다 → 1회 재시도 추가.
        let vision: any = null, visionErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const visionRaw = await callClaude(ANTHROPIC_API_KEY, {
                    max_tokens: 8000, system: visionSystem,
                    messages: [{ role: "user", content: visionContent }],
                });
                vision = parseJson(visionRaw);
                break;
            } catch (e) {
                visionErr = e;
                console.warn(`[promo] vision 판별 실패 (시도 ${attempt + 1}/2):`, e);
            }
        }
        if (!vision) throw visionErr || new Error("vision 판별 실패");
        const items: any[] = Array.isArray(vision.items) ? vision.items : [];

        // 판별 결과 기록 + 실패분 skipped
        // 2026-07-17: 제품군(category)만 맞아도 발행한다. 정확한 SKU 는 링크용 보너스.
        //   (SKU 강제였을 때 한옥 포토존·가벽 사진 6장 중 5장이 스킵됐다)
        const identified: any[] = [];
        for (let i = 0; i < usable.length; i++) {
            const it = items.find((x: any) => Number(x.index) === i) || {};
            const cat = String(it.category || "").trim();
            const knownCat = catNames.find((c: any) => c === cat);
            if (!knownCat) {
                await sb.from("promo_photos").update({
                    status: "skipped", vision_note: it.note || null,
                    error: "우리 제품군으로 판별되지 않음 — 발행 제외",
                }).eq("id", usable[i].id);
                continue;
            }
            const code = String(it.product_code || "").trim();
            const known = code ? products.find((p: any) => p.code === code) : null;
            await sb.from("promo_photos").update({
                product_code: known ? known.code : null,
                product_name: knownCat,          // 제품군 이름으로 표기 (SKU 이름은 오해를 부름 — 아래 주석)
                vision_note: it.note || null,
            }).eq("id", usable[i].id);
            identified.push({
                photo: usable[i], product: known, name: knownCat, note: it.note || "",
            });
        }

        if (identified.length === 0) {
            return json({ ok: false, error: "판별된 제품이 없어 발행하지 않았습니다.", checked: usable.length });
        }

        // ── 5) 언어별 글 생성 + 발행
        // 글의 주제는 "사진에 실제로 보이는 것"(note)이어야 한다.
        //   제품 카탈로그 이름을 주제로 주면 AI 가 사진을 무시하고 그 이름으로 소설을 쓴다.
        //   (실제 사고: 한옥 포토존 사진에 hb_pt_1 이 매칭됐는데 그 제품명이 '등신대 POP' 이라
        //    "매장 앞 등신대POP, 카페 손님 시선 집중" 이라는 완전히 엉뚱한 글이 발행됐다.)
        const productSummary = identified
            .map((d, i) => `${i + 1}. [제품군: ${d.name}] 사진 속 실제 모습: ${d.note}`)
            .join("\n");
        const uniqNames = [...new Set(identified.map((d) => d.name))];
        const batchId = Date.now();
        const results: any[] = [];
        let sourceId: string | null = null;   // KR 글 id — ja/en 이 이걸 물고 hreflang 형제가 됨

        for (const L of LANGS) {
            try {
                // 2026-07-17: 구조를 「검색어 → 답변 → 우리 사례」 로 변경.
                //   기존엔 "우리가 만든 것" 이 주제라, 아무도 검색하지 않는 제목이 나왔다
                //   (예: "공공기관 전시 패널과 한옥 포토존 제작 후기" = 검색량 0).
                //   이제 제품군에서 실제 검색 수요가 있는 키워드를 뽑아 그 답을 먼저 주고,
                //   사진은 그 답을 뒷받침하는 실제 사례로 배치한다.
                const isHoneycomb = uniqNames.some((n) => /허니콤|하니컴/.test(n));
                const sys = `당신은 인쇄·광고물 제작업체 '카멜레온프린팅'의 ${L.label} SEO 콘텐츠 마케터입니다.

[글의 구조 — 반드시 이 순서]
1) **검색어**: 아래 제품군을 찾는 사람이 실제로 검색창에 칠 만한 질문/키워드를 하나 정한다.
   (예: "허니콤보드 가벽 설치 방법", "아크릴 키링 소량 제작", "전시 부스 포토존 제작")
   → 그 검색어가 제목(title)과 focus_keyword 에 자연스럽게 들어가야 한다.
   → "제작 후기", "사례 소개" 같은 제목은 금지. 아무도 그렇게 검색하지 않는다.
2) **답변**: 그 검색어에 대한 실질적인 답을 먼저 준다. 재질/크기/설치/제작 방식/주의점 등
   읽는 사람이 궁금해할 정보를 구체적으로. 광고보다 답변이 먼저다.
3) **우리 사례**: 그 다음에 아래 사진 속 실제 제작물을 "이렇게 실제로 만들었습니다" 로 연결한다.

[가장 중요한 규칙 — 어기면 글을 폐기합니다]
사진에 없는 사용처·상황·고객을 상상해서 쓰지 마세요. 사례 부분은 아래 "사진 속 실제 모습" 만 근거로.
(예: 사진이 '전시장 한옥 포토존' 이면 그 전시 이야기를 쓰는 것이지,
 제품군이 '보드 인쇄' 라고 해서 "매장 앞 홍보물" 같은 없는 이야기를 만들면 안 됩니다)

[반드시 포함할 내용]
- **주문이 매우 쉽다**: 홈페이지의 튜토리얼 가이드를 따라가면 게임하듯 클릭 몇 번으로
  디자인부터 주문까지 끝난다는 점. 디자인 프로그램·전문가 없이도 가능하다는 점을 구체적으로.
  (단, 2)답변 또는 3)사례 안에 자연스럽게 녹이세요. 마지막에 따로 홍보 문단을 만들지 마세요)
${isHoneycomb ? `- **허니콤보드 강점(중요)**: 카멜레온프린팅은 **수도권에 무료로 배송·설치까지 해주는 유일한 업체**입니다.
  이 점을 눈에 띄게 강조하세요. (${L.lang === "kr" ? "수도권" : L.lang === "ja" ? "韓国・首都圏" : "the Seoul metropolitan area"} 기준)` : ""}

[자주 묻는 질문 (faq) — 3~5개]
- 이 제품군(${uniqNames.join(", ")})을 주문하려는 사람이 **실제로 궁금해할 질문**만.
  제품에 맞춰 다르게: 허니콤보드/가벽/포토존이면 설치·무게·강도·운반,
  굿즈·키링이면 소량 제작·최소수량·납기, 인쇄물이면 용지·규격·시안 확인 등.
- 답변은 카멜레온프린팅이 직접 답하는 말투로, 실제로 도움이 되는 구체적인 내용.
  (질문을 지어내 자랑하는 식 금지. "정말 저렴한가요?" 같은 자문자답 광고 금지)
- 답변 안에 강점을 자연스럽게: 튜토리얼로 클릭 몇 번이면 주문 완료${isHoneycomb ? ", 수도권 무료 배송·설치" : ""}.
- 가격·금액은 쓰지 마세요. 전화번호·URL 도 쓰지 마세요.

[쓰지 말아야 할 것 — 시스템이 자동으로 붙입니다. 쓰면 중복됩니다]
- 전화번호·문의처 (${L.contact})
- 홈페이지 주소 (https://${L.site}, https://${L.fabricSite})
- 글 마지막의 홍보/마무리 멘트 ("~에서 만나보세요", "지금 문의하세요" 류)
→ 본문은 3)우리 사례 설명으로 끝내세요.

[사진 속 실제 모습 — 사례 부분의 유일한 근거]
${productSummary}

[규칙]
- 출력은 오직 JSON. 설명·마크다운 펜스 금지.
- 형식: {"title":"...","meta_description":"...","focus_keyword":"...","body":"<p>...</p>","hashtags":["..."],"faq":[{"q":"...","a":"..."}]}
- faq 는 3~5개. body 안에는 넣지 마세요 — 시스템이 별도 섹션으로 렌더링합니다.
- body 는 HTML (<p>, <h2>, <ul>, <strong> 만 사용). 이미지 태그는 넣지 마세요 — 시스템이 자동으로 붙입니다.
- 길이: 800~1200자 분량. 과장 광고·허위 표현 금지. 가격은 언급하지 마세요.
- 본문에는 링크·전화번호를 넣지 마세요 (시스템이 하단에 붙입니다).
- ${L.label} 원어민이 읽기에 자연스러워야 합니다. 제품군 이름은 ${L.label}로 자연스럽게 옮겨 쓰세요.`;

                // max_tokens 8000 — 3000 은 한국어 글에서 잘렸다(실측). 한국어/일본어는 토큰 소모가 큼.
                // 1회 재시도: 일시적 실패로 KR 이 빠지면 source_id 연결까지 어긋나므로 그냥 넘기지 않는다.
                // 2026-07-17: faq 누락도 재시도 사유 (실측: 영어만 faq 를 빼먹고 나왔다).
                //   단 재시도해도 없으면 첫 결과라도 발행한다 — FAQ 때문에 글 자체를 잃으면 안 된다.
                let c: any = null, lastErr: any = null, partial: any = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const raw = await callClaude(ANTHROPIC_API_KEY, {
                            max_tokens: 8000, system: sys,
                            messages: [{ role: "user", content: `제품군: ${uniqNames.join(", ")}\n위 구조(검색어 → 답변 → 우리 사례)대로 ${L.label} 블로그 글을 JSON 으로 작성하세요.\n**faq 3~5개를 반드시 포함**하세요.` }],
                        });
                        const parsed = parseJson(raw);
                        const faqOk = Array.isArray(parsed.faq) && parsed.faq.filter((f: any) => f && f.q && f.a).length >= 3;
                        if (!faqOk && attempt === 0) {
                            partial = parsed;   // 본문은 살려두고 faq 만 다시 받아본다
                            lastErr = new Error("faq 누락 — 재시도");
                            console.warn(`[promo] ${L.lang} faq 누락 → 재시도`);
                            continue;
                        }
                        c = parsed;
                        break;
                    } catch (e) {
                        lastErr = e;
                        console.warn(`[promo] ${L.lang} 생성 실패 (시도 ${attempt + 1}/2):`, e);
                    }
                }
                // 재시도까지 faq 가 안 나왔으면 첫 결과로 발행 (FAQ 없다고 글을 버리진 않는다)
                if (!c && partial) { c = partial; console.warn(`[promo] ${L.lang} faq 없이 발행`); }
                if (!c) throw lastErr || new Error("생성 실패");

                // 본문 + 사진 전부 임베드 (사진 여러 장 = 글 1개)
                const gallery = identified
                    // 캡션은 사진에 실제로 보이는 것(note) — 제품 카탈로그 이름을 쓰면 사진과 어긋난다.
                    //   (product 는 SKU 까지 특정됐을 때만 존재하므로 null 접근 주의)
                    .map((d) => {
                        const cap = esc(d.note || d.name);
                        return `<figure style="margin:18px 0;"><img src="${d.photo.storage_url}" alt="${cap}" style="max-width:100%;border-radius:10px;"><figcaption style="font-size:13px;color:#64748b;margin-top:6px;">${cap}</figcaption></figure>`;
                    })
                    .join("\n");
                // 2026-07-17: 자주 묻는 질문 — 카멜레온프린팅이 직접 답하는 형식.
                //   고객인 척하는 가짜 댓글 대신 회사가 드러내놓고 답한다(정직 + FAQPage 리치결과).
                //   아래에서 FAQPage JSON-LD 로도 내보내 구글 검색결과에 질문/답변이 펼쳐지게 한다.
                const faqList: any[] = Array.isArray(c.faq)
                    ? c.faq.filter((f: any) => f && f.q && f.a).slice(0, 5)
                    : [];
                const faqTitle = L.lang === "ja" ? "よくあるご質問" : L.lang === "en" ? "Frequently asked questions" : "자주 묻는 질문";
                const faqHtml = faqList.length
                    ? `<section style="margin:26px 0;">
<h2 style="font-size:18px;color:#0f172a;margin:0 0 14px;">${faqTitle}</h2>
${faqList.map((f: any) => `<div style="padding:14px 0;border-top:1px solid #e2e8f0;">
<p style="margin:0 0 7px;font-size:15px;color:#0f172a;">Q. ${esc(f.q)}</p>
<p style="margin:0;font-size:14px;color:#475569;line-height:1.8;">A. ${esc(f.a)} <span style="color:#94a3b8;font-size:12.5px;">— ${esc(L.author)}</span></p>
</div>`).join("\n")}
</section>`
                    : "";

                // 2026-07-17: 고정 브랜드 메시지 — 모든 글에 동일하게 들어간다(사장님 지시).
                //   플랫 디자인: 그림자 없음, 볼드 대신 색·크기·여백으로 강조 (CLAUDE.md 디자인 원칙)
                const P = BRAND_PITCH[L.lang] || BRAND_PITCH.kr;
                const pitch = `<div style="margin:26px 0;padding:20px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #0f172a;border-radius:10px;">
<p style="margin:0 0 12px;font-size:15px;color:#0f172a;line-height:1.75;">“${esc(P.q)}”</p>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.85;">${esc(P.body)}</p>
<p style="margin:0;font-size:16px;color:#0f172a;letter-spacing:-0.2px;">${esc(P.slogan)}</p>
</div>`;

                // CTA + 문의처·사이트 안내를 본문과 별개로 항상 붙인다.
                //   (AI 가 문단 안에 자연스럽게 녹이되, 빠뜨려도 여기서 보장)
                const ctaLabel = L.lang === "ja" ? "ガイドに沿って今すぐ作る" : L.lang === "en" ? "Start with the guide" : "가이드 따라 지금 만들기";
                const inquiryLabel = L.lang === "ja" ? "お問い合わせ" : L.lang === "en" ? "Contact" : "문의";
                const fabricLabel = L.lang === "ja" ? "生地・ファブリック印刷" : L.lang === "en" ? "Fabric printing" : "패브릭·원단 인쇄";
                const cta = `<p style="margin-top:22px;"><a href="https://${L.site}" style="display:inline-block;padding:12px 20px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;">${ctaLabel}</a></p>
<p style="margin-top:14px;font-size:13.5px;color:#475569;line-height:1.8;">
${inquiryLabel}: ${esc(L.contact)}<br>
<a href="https://${L.site}">https://${L.site}</a> · ${fabricLabel}: <a href="https://${L.fabricSite}">https://${L.fabricSite}</a>
</p>`;
                // 본문 → 사진 → 자주묻는질문 → 브랜드 메시지 → CTA·문의처 순
                const htmlBody = `${c.body || ""}\n${gallery}\n${faqHtml}\n${pitch}\n${cta}`;

                const seoMeta: any = {
                    meta_description: c.meta_description || "",
                    focus_keyword: c.focus_keyword || uniqNames[0] || "",
                    hashtags: c.hashtags || [],
                    og_image: identified[0].photo.storage_url,
                    promo_batch: batchId,
                    // _worker.js 가 이걸 읽어 FAQPage 구조화 데이터를 내보낸다 (구글 리치결과)
                    faq: faqList,
                };
                // KR 이 원본 → ja/en 은 source_id 로 KR 을 가리킨다.
                // (기존 marketing_bot 은 source_id 를 안 넣어서 board.html 의 hreflang 형제 조회가 늘 자기 자신만 반환했다)
                if (sourceId) seoMeta.source_id = sourceId;

                // 명시적 any — payload 안의 source_id 가 아래에서 ins 로부터 채워져 타입 추론이 순환한다(TS7022)
                const ins: any = await sb.from("blog_posts").insert({
                    category: "blog",
                    country_code: L.countryCode,
                    title: c.title || uniqNames.join(", "),
                    content: htmlBody,
                    author_name: L.author,
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

        // ── 5-1) 색인 요청 — 발행된 글 URL 을 IndexNow 로 즉시 제출
        try {
            const idxUrls = results
                .filter((r: any) => r.post_id && r.lang)
                .map((r: any) => {
                    const L = LANGS.find((x) => x.lang === r.lang)!;
                    return `https://${L.site}/board.html?cat=blog&country=${L.countryCode}&id=${r.post_id}`;
                });
            if (idxUrls.length) await pingIndexNow(idxUrls);
        } catch (e) { console.warn("[promo] 색인 요청 실패:", e); }

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
