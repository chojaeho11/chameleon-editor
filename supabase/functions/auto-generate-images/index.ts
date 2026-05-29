// supabase/functions/auto-generate-images/index.ts
// 자동 이미지 생성 파이프라인 — DALL-E 3 로 누락된 img_url 채움.
//
// 트리거:
//   1) HTTP POST (수동 실행 또는 외부 cron)
//   2) Supabase cron (pg_cron) — 매 N분마다 호출
//
// 동작:
//   1) admin_products 에서 img_url 비어있는 pkg_* 상품 N개 조회 (BATCH_LIMIT)
//   2) 각각 코드 파싱 → 프롬프트 생성 → DALL-E 호출 → Storage 업로드 → DB 갱신
//   3) 한 번 호출에 BATCH_LIMIT 개만 처리 (Edge timeout 150s 안에 끝나도록)
//   4) 큐가 비면 즉시 return
//
// 환경변수:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//   - OPENAI_API_KEY (Supabase Secrets 에 미리 등록 필요)
//   - DALL_E_QUALITY ('standard' | 'hd', 기본 standard)
//   - CATEGORY_PREFIX ('pkg_' 등, 기본 'pkg_' — 카테고리 prefix 로 작업 범위 한정)
//   - BATCH_LIMIT (기본 6)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── 프롬프트 템플릿 (ai-prompts.md 와 동일 패턴, 39 서브카) ───
const STYLE_SUFFIX =
  ", product photography, soft studio lighting, white seamless background, " +
  "3/4 angle view, commercial catalog style, high detail, sharp focus, " +
  "no text, no logo, blank surface";

const PROMPT_TPL: Record<string, string> = {
  pkg_box_plain:    "A minimalist plain paper box with clean folded edges, matte cardboard surface, lid slightly open showing depth, {finish} finish",
  pkg_box_fold:     "A flat-pack foldable paper box laid open showing the fold pattern, {finish} cardstock, geometric crease lines visible",
  pkg_box_mag:      "A premium hinged magnetic-closure rigid box with smooth matte exterior, {finish} finish, lid slightly open at 30 degrees, luxury packaging look",
  pkg_box_sleeve:   "A two-piece sleeve-style paper box, the sliding inner tray pulled out halfway, {finish} outer sleeve, minimal elegant design",
  pkg_box_round:    "A cylindrical round paper box with matching lid, {finish} finish, smooth seam, slight overhead angle",
  pkg_bag_kraft:    "A natural kraft paper shopping bag standing upright, twisted paper handles, gusseted sides, blank front face, {finish} color",
  pkg_bag_coat:     "A glossy coated paper shopping bag with smooth reflective surface, {finish} finish, ribbon handles, crisp edges, luxury retail look",
  pkg_bag_string:   "A paper shopping bag with rope-style cotton string handles, {finish} body, eyelet reinforced handle holes",
  pkg_bag_fold:     "A flat-folded paper shopping bag shown semi-opened, {finish} color, compact design",
  pkg_nw_basic:     "A simple non-woven polypropylene tote bag with flat handles, matte fabric texture, {finish} color, stands upright",
  pkg_nw_handle:    "A non-woven bag with reinforced loop handles, slightly larger gusset, {finish} color, spunbond fabric texture",
  pkg_nw_shoulder:  "A non-woven shoulder bag with long straps, medium-sized rectangular body, {finish} color, modern tote style",
  pkg_nw_cooler:    "A thermal-insulated non-woven cooler bag, silver foil interior visible at top opening, {finish} exterior, zipper top",
  pkg_pp_pp:        "A woven polypropylene bag with flat handles, {finish} finish, durable plastic weave texture",
  pkg_pp_pvc:       "A clear transparent PVC tote bag, visible plastic seam edges, vinyl handles, modern fashion-forward look",
  pkg_pp_pe:        "A polyethylene plastic shopping bag with die-cut handle, {finish} finish, slight wrinkle texture",
  pkg_rpet_rpet:    "A recycled PET fabric tote bag, slightly heathered texture, {finish} color, sturdy long handles, eco-conscious design",
  pkg_rpet_canvas:  "A heavy-weight cotton canvas tote bag, {finish} color, visible weave, sturdy cotton handles, lifestyle look",
  pkg_rpet_cotton:  "A lightweight cotton fabric tote bag, soft cotton drape, {finish} color, casual everyday style, long shoulder straps",
  pkg_rpet_tarp:    "A tarpaulin tote bag made from recycled banner material, waterproof glossy texture, {finish} body, industrial-chic look",
  pkg_tin_sq:       "A small rectangular metal tin box with hinged lid slightly open, {finish} finish, smooth matte metal surface, clean edges",
  pkg_tin_round:    "A circular metal tin with pull-off lid resting beside, {finish} finish, shallow profile, brushed metal",
  pkg_tin_slide:    "A flat metal slide-top tin, the sliding lid pulled out halfway showing the rail, {finish} finish, pocket-sized, brushed metal",
  pkg_pouch_zip:    "A flat zipper pouch with metal zipper across the top, {finish} body, slightly unzipped, clean rectangular shape",
  pkg_pouch_canvas: "A canvas zippered pouch, {finish} color, visible cotton weave, contrast zipper pull",
  pkg_pouch_leather:"A premium leather zip pouch, {finish} color, smooth surface with subtle grain texture, metal zipper, luxury feel",
  pkg_pouch_pvc:    "A clear vinyl zipper pouch with {finish} piping, contents visible through transparent body, travel pouch style",
  pkg_fold_mag:     "A collapsible magnetic-flap gift box partially unfolded, {finish} exterior, magnetic side flaps, mid-assembly view",
  pkg_fold_ribbon:  "A flat-folded gift box tied with a satin ribbon bow, {finish} cardstock, elegant gift presentation",
  pkg_fold_auto:    "A snap-bottom auto-lock box shown in folded flat state next to assembled version, {finish} cardboard, practical shipping box",
  pkg_label_round:  "A small circular paper label, {finish} surface, slight peel from backing showing adhesive, blank face",
  pkg_label_sq:     "A rectangular paper sticker label, {finish} surface, slight curl at corner, clean cut edges",
  pkg_label_clear:  "A transparent vinyl sticker with no visible background, slight glossy reflection, {finish} accent",
  pkg_label_metal:  "A metallic foil sticker with mirror finish, {finish} surface, high-reflective brushed texture",
  pkg_label_holo:   "A holographic rainbow sticker with prismatic surface, visible rainbow refraction pattern, {finish} accent",
  pkg_parts_ribbon: "A spool of satin gift-wrap ribbon, {finish} color, partially unrolled showing texture, clean studio shot",
  pkg_parts_tissue: "A stack of thin tissue paper sheets, {finish} color, top sheet slightly raised showing translucency",
  pkg_parts_string: "A coil of cotton twine, {finish} color, neatly wound, slight texture detail",
  pkg_parts_seal:   "A wax-style adhesive seal sticker on neutral surface, {finish} finish, embossed circular border, luxury closure",
};

const FINISH_EN: Record<string, string> = {
  white:"white", kraft:"kraft brown", black:"black",
  natural:"natural", navy:"navy",
  clear:"clear", matte:"matte",
  silver:"silver brushed metal", gold:"gold brushed metal",
};

function parseCode(code: string) {
  if (!code || !code.startsWith("goods_")) return null;
  const parts = code.slice(6).split("_");
  if (parts.length < 4) return null;
  const finishId = parts[parts.length - 1];
  const sizeId = parts[parts.length - 2];
  const category = parts.slice(0, parts.length - 2).join("_");
  return { category, sizeId, finishId };
}

function buildPrompt(code: string): string | null {
  const parsed = parseCode(code);
  if (!parsed) return null;
  const tpl = PROMPT_TPL[parsed.category];
  if (!tpl) return null;
  const finishWord = FINISH_EN[parsed.finishId] || parsed.finishId;
  return tpl.replace("{finish}", finishWord) + STYLE_SUFFIX;
}

async function callDallE(apiKey: string, prompt: string, quality: string): Promise<Uint8Array> {
  // gpt-image-1 (신규, 2026~) — quality: low/medium/high. 구버전 standard/hd 자동 매핑.
  const qMap: Record<string, string> = { standard: "medium", hd: "high", low: "low", medium: "medium", high: "high" };
  const finalQuality = qMap[quality] || "medium";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: finalQuality,
      output_format: "png",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  // gpt-image-1 은 b64_json 기본 반환
  const b64 = json.data?.[0]?.b64_json;
  const url = json.data?.[0]?.url;
  if (b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  if (url) {
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: ${imgRes.status}`);
    return new Uint8Array(await imgRes.arrayBuffer());
  }
  throw new Error("OpenAI 응답에 b64_json/url 둘 다 없음");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured in Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const quality = Deno.env.get("DALL_E_QUALITY") || "standard";
    const categoryPrefix = Deno.env.get("CATEGORY_PREFIX") || "pkg_";
    const batchLimit = parseInt(Deno.env.get("BATCH_LIMIT") || "6", 10);

    // 호출 시 body 로 batchLimit 등을 override 할 수 있음
    let bodyOverrides: Record<string, any> = {};
    try { bodyOverrides = await req.json(); } catch (_e) { /* ok */ }
    const finalBatch = parseInt(bodyOverrides.batchLimit || batchLimit, 10);
    const finalPrefix = bodyOverrides.categoryPrefix || categoryPrefix;

    const sb = createClient(supabaseUrl, supabaseKey);

    // img_url 비어있거나 null 인 상품 조회
    const { data: products, error: qErr } = await sb
      .from("admin_products")
      .select("code, category, name, img_url")
      .like("category", `${finalPrefix}%`)
      .or("img_url.is.null,img_url.eq.")
      .order("code", { ascending: true })
      .limit(finalBatch);

    if (qErr) {
      return new Response(
        JSON.stringify({ error: `Query failed: ${qErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ done: true, processed: 0, message: "큐가 비었습니다 — 모든 상품에 이미지 등록됨." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ code: string; status: string; error?: string }> = [];
    for (const p of products) {
      try {
        const prompt = buildPrompt(p.code);
        if (!prompt) {
          results.push({ code: p.code, status: "skip", error: "프롬프트 매핑 없음" });
          continue;
        }
        // 1) DALL-E
        const imgBytes = await callDallE(openaiKey, prompt, quality);
        // 2) Storage upload
        const path = `goods/${p.code}.png`;
        const up = await sb.storage.from("products").upload(path, imgBytes, {
          upsert: true,
          contentType: "image/png",
        });
        if (up.error) {
          results.push({ code: p.code, status: "fail", error: `Storage: ${up.error.message}` });
          continue;
        }
        const pub = sb.storage.from("products").getPublicUrl(path);
        // 3) DB update
        const upd = await sb.from("admin_products").update({ img_url: pub.data.publicUrl }).eq("code", p.code);
        if (upd.error) {
          results.push({ code: p.code, status: "fail", error: `DB: ${upd.error.message}` });
          continue;
        }
        results.push({ code: p.code, status: "ok" });
      } catch (e: any) {
        results.push({ code: p.code, status: "fail", error: e.message || String(e) });
      }
    }

    // 잔여 큐 확인
    const { count: remaining } = await sb
      .from("admin_products")
      .select("code", { count: "exact", head: true })
      .like("category", `${finalPrefix}%`)
      .or("img_url.is.null,img_url.eq.");

    return new Response(
      JSON.stringify({
        processed: results.length,
        ok: results.filter(r => r.status === "ok").length,
        fail: results.filter(r => r.status === "fail").length,
        skip: results.filter(r => r.status === "skip").length,
        remaining: remaining ?? null,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
