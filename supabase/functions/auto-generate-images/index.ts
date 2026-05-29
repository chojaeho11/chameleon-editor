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
// 2026-05-29: 한국 미니멀 라이프스타일 브랜드 톤 — 흰 배경, 자연광, 매트, 정면뷰
const STYLE_SUFFIX =
  ", clean product photography for an e-commerce catalog, " +
  "pure white seamless background, soft natural daylight from upper left, " +
  "centered front view at eye level, subtle soft shadow beneath the object, " +
  "minimal Korean lifestyle stationery brand aesthetic, friendly approachable look, " +
  "authentic material texture, NOT shiny plastic, NOT leather, NOT glossy vinyl, " +
  "high resolution, true to material, blank surface with no text or logo";

const PROMPT_TPL: Record<string, string> = {
  pkg_box_plain:    "A simple plain matte uncoated paper gift box with crisp clean folded edges and visible cardboard grain texture, {finish} color cardstock, lid slightly ajar showing 2cm of depth",
  pkg_box_fold:     "A flat-pack matte uncoated cardstock box laid open showing the printed fold lines and crease pattern, {finish} color, paper-fiber surface, no gloss",
  pkg_box_mag:      "A small premium magnetic-closure rigid gift box, matte uncoated paper wrap, {finish} color, lid hinged open 30 degrees revealing soft interior, minimal craft feel",
  pkg_box_sleeve:   "A two-piece sleeve box with inner drawer pulled out halfway, {finish} matte paper outer sleeve over white inner tray, minimal Korean stationery brand look",
  pkg_box_round:    "A small cylindrical paper drum box with matching lid resting beside it, {finish} matte uncoated paper wrap with visible fiber, slight overhead angle",
  pkg_bag_kraft:    "A natural unbleached kraft paper shopping bag standing upright with twisted paper handles, gusseted sides, visible paper fiber and matte finish, {finish} color, blank front face",
  pkg_bag_coat:     "A matte-finish paper shopping bag with smooth flat surface (not shiny, not glossy), grosgrain ribbon handles, {finish} color paper body, crisp folded edges, soft minimal feel",
  pkg_bag_string:   "A small paper shopping bag with thin cotton rope handles threaded through reinforced eyelets, {finish} color matte paper body, visible paper grain",
  pkg_bag_fold:     "A flat-folded paper shopping bag shown semi-opened to display the gusset, {finish} matte paper, compact minimal Korean stationery brand style",
  pkg_nw_basic:     "A simple non-woven spunbond fabric tote bag with flat handles, soft matte fabric weave texture clearly visible, {finish} color, stands upright on white surface, eco-friendly minimal look",
  pkg_nw_handle:    "A non-woven fabric grocery bag with reinforced loop handles and slightly wider gusset, soft matte spunbond texture, {finish} color, friendly daily-use look",
  pkg_nw_shoulder:  "A non-woven fabric shoulder tote bag with long flat straps, medium rectangular body, visible spunbond fabric texture, {finish} color, casual lifestyle look",
  pkg_nw_cooler:    "A non-woven fabric insulated cooler tote bag with zipper top slightly open showing silver foil interior, {finish} color matte fabric exterior, picnic-friendly look",
  pkg_pp_pp:        "A woven polypropylene reusable shopping bag with flat handles, visible plastic weave pattern, {finish} color, durable everyday tote look (not shiny, semi-matte)",
  pkg_pp_pvc:       "A clear transparent PVC tote bag with subtle frosted edges, vinyl handles, modern minimalist fashion look, blank empty interior, soft natural light",
  pkg_pp_pe:        "A polyethylene plastic shopping bag with die-cut handle hole, {finish} color matte PE surface with very subtle wrinkle texture, retail packaging look",
  pkg_rpet_rpet:    "A recycled PET fabric tote bag with slightly heathered melange texture, {finish} color, sturdy webbing handles, modern eco-conscious minimal Korean brand design",
  pkg_rpet_canvas:  "A heavy-weight 12oz cotton canvas tote bag, {finish} color natural fabric with clearly visible woven texture, sturdy cotton webbing handles, blank front, lifestyle minimal brand look",
  pkg_rpet_cotton:  "A lightweight cotton fabric eco tote bag, soft natural drape with subtle wrinkles, {finish} color, casual everyday minimal style, long flat shoulder straps",
  pkg_rpet_tarp:    "A small tarpaulin tote bag made from upcycled banner vinyl, semi-matte coated surface (not shiny), {finish} color body, reinforced seams, industrial-chic eco look",
  pkg_tin_sq:       "A small rectangular powder-coated metal tin box with hinged lid slightly open, matte {finish} color powder-coat finish (not mirror, not shiny), clean rounded edges, minimal Korean stationery brand feel",
  pkg_tin_round:    "A small circular metal tin with pull-off lid resting beside the body, matte {finish} powder-coat finish, shallow profile like a candy tin, soft natural daylight",
  pkg_tin_slide:    "A flat rectangular metal slide-top tin with the sliding lid pulled halfway out revealing the rail, matte {finish} powder-coat color, pocket-sized minimal look",
  pkg_pouch_zip:    "A flat fabric zipper pouch with a small metal zipper across the top edge, {finish} color matte fabric body, slightly unzipped showing thin interior, clean rectangular minimal design",
  pkg_pouch_canvas: "A small canvas zippered pouch with cotton fabric and visible woven texture, {finish} color natural cotton, contrast color zipper pull, casual minimal Korean stationery look",
  pkg_pouch_leather:"A small synthetic-leather zip pouch with soft matte surface (not glossy), subtle pebble grain texture, {finish} color, small metal zipper, premium minimal look",
  pkg_pouch_pvc:    "A clear transparent vinyl zipper pouch with thin {finish} color fabric piping along the edges, slightly soft body, minimal travel pouch look",
  pkg_fold_mag:     "A collapsible magnetic-flap rigid gift box partially folded, matte {finish} paper-wrapped exterior, magnetic side flaps visible, mid-assembly clearly showing the folding structure",
  pkg_fold_ribbon:  "A flat-folded matte paper gift box tied with a thin satin ribbon bow on top, {finish} color cardstock, elegant minimal gift presentation, soft natural daylight",
  pkg_fold_auto:    "An auto-lock snap-bottom shipping box shown in flat folded state laid next to its assembled version, matte uncoated {finish} corrugated cardboard, practical no-frills look",
  pkg_label_round:  "A small circular matte paper sticker label peeling slightly from its backing paper, {finish} color paper surface visible, clean die-cut edge",
  pkg_label_sq:     "A small rectangular matte paper sticker with slightly curled corner showing the adhesive backing, {finish} color paper, clean die-cut edges, minimal label design",
  pkg_label_clear:  "A small transparent vinyl sticker peeling from its backing paper, the sticker itself is fully clear with a subtle frosted edge, slight glossy reflection on the surface",
  pkg_label_metal:  "A small metallic foil sticker with brushed {finish} mirror finish peeling slightly from backing, clean shape, subtle reflection of soft daylight",
  pkg_label_holo:   "A small holographic rainbow sticker showing prismatic rainbow refraction across its surface, {finish} accent shape, peeling slightly from backing",
  pkg_parts_ribbon: "A small spool of matte grosgrain gift-wrap ribbon partially unrolled showing fabric texture, {finish} color, clean minimal product shot",
  pkg_parts_tissue: "A neat stack of thin {finish} color tissue paper sheets with soft translucent quality, top sheet slightly fanned, minimal look",
  pkg_parts_string: "A neat coil of cotton paper-twine in {finish} color, slight natural texture, minimal clean product shot",
  pkg_parts_seal:   "A small wax-style adhesive seal sticker with embossed circular border, matte {finish} finish (not mirror), luxury envelope closure look",
  // ───── 2026-05-29 굿즈 풀스펙 확장 ─────
  pkg_acr_keyring:  "A small clear acrylic keyring charm with thin profile, rounded cutout shape, attached metal split ring at top, {finish} tinted acrylic body, soft daylight reflection, clean minimal product photography on pure white background",
  pkg_acr_stand:    "A small clear acrylic display standee with thin base and upright cutout shape, {finish} tinted acrylic, blank surface, pure white background, soft natural daylight",
  pkg_acr_badge:    "A small round acrylic badge with metal safety pin back, {finish} tinted acrylic body, slight depth visible at edges, white background",
  pkg_acr_magnet:   "A small thin acrylic refrigerator magnet with simple rounded shape, {finish} tinted acrylic body, soft daylight, white background",
  pkg_acr_jibbitz:  "A small acrylic shoe charm with hole for attachment, casual rounded shape, {finish} tinted acrylic, white background, soft daylight",
  pkg_acr_nametag:  "A clear acrylic nametag pendant with metal lobster clasp, blank rectangular surface, {finish} tinted accent edge, white background",
  pkg_sil_keyring:  "A small soft silicone keyring charm, matte rubber surface with no shine, {finish} color, attached metal split ring, friendly minimal look on white background",
  pkg_sil_wristband:"A flexible silicone wristband bracelet, matte rubber finish, {finish} color, simple band shape, white background",
  pkg_sil_coaster:  "A round silicone drink coaster, soft matte rubber surface, {finish} color, thin profile, white background",
  pkg_sil_grip:     "A pop-out silicone phone grip socket (collapsible round disc), matte rubber finish, {finish} color, blank top surface, white background",
  pkg_mtb_enamel:   "A small enamel lapel pin with metal border and smooth enamel infill, {finish} colored enamel section, metal butterfly clutch back partially visible, white background",
  pkg_mtb_metal:    "A small die-cut metal badge with brushed matte surface, {finish} colored metal finish, safety pin back, white background",
  pkg_mtb_gold:     "A small luxurious gold-tone metal pin badge with brushed gold finish, {finish} accent color, premium minimal look on white background",
  pkg_mtb_patch:    "A small embroidered fabric patch with visible woven thread texture, {finish} color thread, iron-on backing slightly visible at edge, white background",
  pkg_mug_ceramic:  "A simple matte ceramic coffee mug with smooth glaze finish, {finish} color body, clean cylindrical shape, blank surface, soft natural daylight on white background",
  pkg_mug_tumbler:  "A stainless steel travel tumbler with matte powder-coat exterior, {finish} color, screw-on lid, slight angle, soft daylight, white background",
  pkg_mug_glass:    "A clear drinking glass with thick base, simple cylindrical shape, soft daylight reflection, white background",
  pkg_mir_hand:     "A small round hand mirror with thin matte metal frame, {finish} color frame, mirror surface showing soft natural daylight reflection, white background",
  pkg_mir_card:     "A flat credit-card-sized pocket mirror with fabric case, {finish} color case, slightly open showing mirror inside, white background",
  pkg_mir_stand:    "A small folding stand mirror with thin metal frame, {finish} color frame, standing upright, white background",
  pkg_stn_pen:      "A simple matte ballpoint pen with cylindrical body, {finish} color, clean minimal design, no logo, white background",
  pkg_stn_note:     "A small spiral-bound notebook with matte paper cover, {finish} color cover, lying flat at slight angle, white background",
  pkg_stn_diary:    "A small hardcover diary with cloth-bound spine, {finish} color cover, elastic band closure visible, white background",
  pkg_stn_memo:     "A small stack of memo pad sheets, {finish} color top cover, paper edges visible, white background",
  pkg_stn_stkbook:  "A small sticker book with matte paper cover, {finish} color, slightly open showing blank sticker sheets inside, white background",
  pkg_apl_tshirt:   "A simple {finish} color cotton t-shirt folded flat on white surface, soft cotton fabric texture visible, blank front, soft daylight",
  pkg_apl_hoodie:   "A {finish} color cotton hoodie folded flat with hood visible at top, soft fleece interior, drawstrings, blank front, white background",
  pkg_apl_socks:    "A pair of {finish} color cotton crew socks folded together, soft knit fabric texture, white background",
  pkg_apl_cap:      "A simple {finish} color baseball cap with curved brim, blank front panel, structured fit, white background",
  pkg_apl_mask:     "A simple {finish} color fabric face mask with elastic ear loops, folded flat, white background",
  pkg_acc_phonecase:"A {finish} color matte silicone phone case for a generic smartphone, soft rubber finish, blank back, no logo, white background",
  pkg_acc_strap:    "A short phone strap with {finish} color fabric loop and small metal connector, white background",
  pkg_acc_cardwallet:"A small slim card wallet with {finish} color matte surface, slightly open showing card slots, white background",
  pkg_acc_coinpurse:"A small zippered coin purse with {finish} color matte fabric, metal zipper, white background",
  pkg_dec_plushie:  "A small soft plush toy with cute simple round face and {finish} color body, soft fabric texture, friendly minimal look on white background",
  pkg_dec_plushring:"A small plush mascot keyring with {finish} color fabric body, attached metal split ring, white background",
  pkg_dec_hairtie:  "A small fabric hair scrunchie with {finish} color matte fabric, gathered ruffle texture, white background",
  pkg_dec_wristband:"A soft fabric wristband bracelet with {finish} color matte fabric, casual everyday style, white background",
  pkg_liv_diffuser: "A small ceramic reed diffuser bottle with rattan reeds, {finish} color matte ceramic body, minimal home decor look on white background",
  pkg_liv_candle:   "A small glass jar candle with matte {finish} color wax inside, wood wick visible, minimal home decor style, white background",
  pkg_liv_incense:  "A small incense holder with thin metal stand and ceramic base, {finish} color ceramic, single incense stick, white background",
  pkg_liv_moodlight:"A small portable LED mood light with frosted globe top, {finish} color base, soft warm glow, white background",
  pkg_sea_fan:      "A round flat paper hand fan with bamboo handle, {finish} color paper, blank front face, white background",
  pkg_sea_umbrella: "A folding pocket umbrella in {finish} color, partially open showing canopy and ribs, white background",
  pkg_sea_towel:    "A folded cotton bath towel with {finish} color, soft terry cloth texture, white background",
  pkg_sea_picmat:   "A folded picnic blanket with {finish} color simple pattern, waterproof backing slightly visible, outdoor lifestyle look on white background",
  // ───── 인쇄물 카테고리 10개 ─────
  pkg_bsc_std:     "A flat printed business card lying on a clean white surface, matte uncoated paper, {finish} color cardstock, blank front and back, professional product photo, soft daylight",
  pkg_bsc_premium: "A premium business card with textured cardstock, slightly thicker profile, {finish} color, blank front for branding, soft natural daylight on white background",
  pkg_bsc_foil:    "A business card with metallic foil stamp accent on matte cardstock, {finish} foil finish, blank surface, premium product photo on white background",
  pkg_bsc_clear:   "A transparent acrylic business card with thin profile, slight {finish} tint, blank surface, clean product photo on white background, subtle shadow",
  pkg_bsc_metal:   "A thin brushed metal business card with engraved edge, {finish} metallic finish, blank surface, premium product photo on white background",
  pkg_flyer_a4:    "A flat A4 printed flyer on clean white surface, matte paper, {finish} color cardstock, blank front, soft natural daylight",
  pkg_flyer_a5:    "A flat A5 printed flyer on clean white surface, matte paper, {finish} color, blank, soft daylight",
  pkg_flyer_b5:    "A flat B5 printed flyer on clean white surface, matte paper, {finish} color, blank, soft daylight",
  pkg_flyer_double:"A double-sided flyer fanned open showing both sides, matte paper, {finish} color, blank surfaces, clean product shot",
  pkg_flyer_fold:  "A tri-fold paper brochure partially opened revealing fold panels, matte paper, {finish} color cardstock, blank surfaces, soft daylight",
  pkg_pst_a3:      "A flat A3 paper poster lying on white surface, matte paper, {finish} color cardstock, blank surface for design, soft natural daylight",
  pkg_pst_a2:      "A flat A2 paper poster lying on white surface, matte paper, {finish} color, blank surface, soft daylight",
  pkg_pst_a1:      "A flat A1 paper poster lying on white surface, matte paper, {finish} color, blank surface, soft daylight",
  pkg_pst_b2:      "A flat B2 paper poster lying on white surface, matte paper, {finish} color, blank surface, soft daylight",
  pkg_cat_8p:      "A slim 8-page printed catalog booklet with saddle-stitch binding, matte paper cover, {finish} color, slightly open showing pages, white background",
  pkg_cat_16p:     "A medium 16-page printed catalog with saddle-stitch binding, matte paper cover, {finish} color, slightly open, white background",
  pkg_cat_32p:     "A thick 32-page printed catalog with perfect binding spine, matte paper cover, {finish} color, slightly open, white background",
  pkg_cat_fold:    "A tri-fold paper brochure shown half-folded with visible fold lines, matte paper, {finish} color cardstock, blank surfaces, white background",
  pkg_env_small:   "A small paper envelope (4×9 inch) lying flat with flap closed, matte paper, {finish} color cardstock, blank front, soft daylight, white background",
  pkg_env_medium:  "A medium paper envelope (6×9 inch) lying flat with flap closed, matte paper, {finish} color, blank, soft daylight",
  pkg_env_large:   "A large paper envelope (9×12 inch) lying flat with flap closed, matte paper, {finish} color, blank, soft daylight",
  pkg_env_a4:      "An A4 paper envelope lying flat with flap closed, matte paper, {finish} color cardstock, blank front, soft daylight on white background",
  pkg_tag_sq:      "A small square paper tag with a thin string loop through a metal eyelet, matte paper, {finish} color cardstock, blank surface, white background",
  pkg_tag_round:   "A small round paper tag with thin string loop and metal eyelet, matte paper, {finish} color, blank surface, white background",
  pkg_tag_hang:    "A rectangular paper hang tag with twine attached, matte paper, {finish} color cardstock, blank surface, white background",
  pkg_tag_cloth:   "A clothing care tag with string loop, matte paper, {finish} color cardstock, blank front, white background",
  pkg_cal_desk:    "A small desk calendar with spiral binding on top, easel back, {finish} color matte paper, blank monthly grid, soft daylight on white background",
  pkg_cal_wall:    "A wall calendar hanging by a thin metal loop at top, matte paper, {finish} color, blank monthly grid, soft daylight on white background",
  pkg_cal_mini:    "A small mini calendar standing upright with metal base, matte paper, {finish} color, blank, soft daylight on white background",
  pkg_cal_card:    "A flat card-sized yearly calendar, matte paper, {finish} color cardstock, blank surface with grid, white background",
  pkg_tkt_std:     "A flat printed paper ticket with perforated tear edge, matte paper, {finish} color cardstock, blank surface, white background",
  pkg_tkt_cpn:     "A flat printed coupon with dashed border, matte paper, {finish} color cardstock, blank surface ready for offer text, white background",
  pkg_tkt_entry:   "A flat printed admission ticket with perforated stub, matte paper, {finish} color cardstock, blank surface, white background",
  pkg_tkt_meal:    "A flat printed meal voucher in book form with one ticket lifted, matte paper, {finish} color cardstock, blank, white background",
  pkg_card_wed:    "A flat wedding invitation card lying on a clean white surface, premium matte paper, {finish} color cardstock, blank front, soft elegant lighting",
  pkg_card_greet:  "A flat greeting card folded in half, matte paper, {finish} color cardstock, blank front cover, soft daylight on white background",
  pkg_card_thanks: "A small thank-you card lying flat, matte paper, {finish} color cardstock, blank front, soft daylight on white background",
  pkg_card_invite: "A flat invitation card lying on white surface, matte paper, {finish} color cardstock, blank front, soft elegant daylight",
  pkg_stk_cut:     "A die-cut shaped paper sticker partially peeled from its release paper backing showing adhesive, {finish} color matte paper, blank front, white background",
  pkg_stk_sheet:   "A sheet of small printed paper stickers in a grid layout on release paper, {finish} color matte, blank designs, white background",
  pkg_stk_roll:    "A small roll of paper stickers partially unrolled showing the strip, {finish} color matte paper, blank repeating spots, white background",
  pkg_stk_kiss:    "A kiss-cut sticker sheet with multiple shapes on a single backing, {finish} color matte paper, blank designs, white background"
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
