# 패키지 굿즈 AI 이미지 생성 프롬프트 가이드

> 카멜레온프린팅 /goods 카탈로그용 상품 이미지 생성 레퍼런스.  
> Midjourney v6 · DALL-E 3 · Stable Diffusion XL 모두 호환되는 프롬프트.

---

## 🎨 공통 스타일 가이드 (모든 카테고리 적용)

모든 굿즈 이미지가 카탈로그에서 **일관된 룩**으로 보이려면 다음 요소를 고정하세요.

| 요소 | 값 |
|---|---|
| 배경 | 순백 (#ffffff) 또는 따뜻한 그레이 (#f5f5f5) |
| 조명 | 부드러운 소프트박스 (그림자 부드러움) |
| 앵글 | 정면 살짝 위 (3/4 view, 약 15° 위에서) |
| 종횡비 | 정사각 (1:1) — 카탈로그 그리드 매칭 |
| 해상도 | 1024×1024 이상 |
| 스타일 | product photography, commercial catalog |
| 로고 | 후처리 단계에서 합성 (프롬프트로 박지 않음 — 일관성 ↓) |

### Universal Suffix (모든 프롬프트 끝에 붙임)
```
, product photography, soft studio lighting, white seamless background,
3/4 angle view, commercial catalog style, high detail, sharp focus,
no text, no logo, blank surface, --ar 1:1 --v 6
```

### Universal Negative (Stable Diffusion 등)
```
text, watermark, logo, brand name, multiple objects, cluttered background,
shadow harsh, low quality, blurry, distorted, person, hand
```

---

## 📦 페이퍼박스 (Paper Box)

### 무지 페이퍼박스 (pkg_box_plain)
```
A minimalist plain paper box with clean folded edges,
matte cardboard surface, lid slightly open showing depth,
[화이트/크래프트/블랙] finish
```
**변형 키워드**: `white`, `kraft brown`, `matte black`, `cream`, `pastel pink`

### 접이식 박스 (pkg_box_fold)
```
A flat-pack foldable paper box laid open showing the fold pattern,
[finish] cardstock, geometric crease lines visible,
suitable for shipping and gifts
```

### 자석 박스 (pkg_box_mag)
```
A premium hinged magnetic-closure rigid box with smooth matte exterior,
[finish] finish, lid slightly open at 30 degrees,
luxury packaging look, soft inner foam visible
```

### 슬리브 박스 (pkg_box_sleeve)
```
A two-piece sleeve-style paper box, the sliding inner tray pulled out halfway,
[finish] outer sleeve over [contrast color] inner box,
minimal elegant design
```

### 원형 박스 (pkg_box_round)
```
A cylindrical round paper box with matching lid,
[finish] finish, smooth seam, slight overhead angle,
similar to a hat box but compact (10cm diameter)
```

---

## 🛍️ 종이쇼핑백 (Paper Shopping Bag)

### 크래프트 쇼핑백 (pkg_bag_kraft)
```
A natural kraft paper shopping bag standing upright,
twisted paper handles, gusseted sides, blank front face,
warm beige color, slight texture visible
```

### 코팅 쇼핑백 (pkg_bag_coat)
```
A glossy coated paper shopping bag with smooth reflective surface,
[white/black] finish, ribbon handles, crisp edges,
luxury retail look
```

### 끈손잡이 쇼핑백 (pkg_bag_string)
```
A paper shopping bag with rope-style cotton string handles,
[kraft/white] body, eyelet reinforced handle holes,
casual boutique style
```

### 접이식 쇼핑백 (pkg_bag_fold)
```
A flat-folded paper shopping bag shown semi-opened,
demonstrating the collapsible structure,
[finish] color, compact design
```

---

## 👜 부직포 가방 (Non-woven Bag)

### 기본형 부직포백 (pkg_nw_basic)
```
A simple non-woven polypropylene tote bag with flat handles,
matte fabric texture, [natural/black/navy] color,
stands upright, blank front
```

### 핸들형 부직포백 (pkg_nw_handle)
```
A non-woven bag with reinforced loop handles,
slightly larger gusset for grocery use,
[color], spunbond fabric texture
```

### 어깨끈 부직포백 (pkg_nw_shoulder)
```
A non-woven shoulder bag with long straps (60cm),
medium-sized rectangular body, [color],
modern tote style
```

### 보냉 부직포백 (pkg_nw_cooler)
```
A thermal-insulated non-woven cooler bag,
silver aluminum-foil interior visible at top opening,
[color] exterior, zipper top, blank surface
```

---

## 🎒 PP·PVC 가방

### PP 가방 (pkg_pp_pp)
```
A woven polypropylene bag with flat handles,
[white/clear/matte] finish, durable plastic weave texture,
shopping bag size
```

### PVC 투명백 (pkg_pp_pvc)
```
A clear transparent PVC tote bag,
visible plastic seam edges, vinyl handles,
modern fashion-forward look, empty interior
```

### PE 비닐백 (pkg_pp_pe)
```
A polyethylene plastic shopping bag with die-cut handle,
matte [white/black/colored] finish, slight wrinkle texture,
retail packaging style
```

---

## ♻️ 리유저블백

### rPET 리유저블백 (pkg_rpet_rpet)
```
A recycled PET fabric tote bag, slightly heathered texture,
[natural/black/navy], sturdy long handles,
eco-conscious modern design
```

### 캔버스백 (pkg_rpet_canvas)
```
A heavy-weight cotton canvas tote bag,
[natural off-white/black/navy] color, visible weave,
sturdy cotton handles, lifestyle look
```

### 면 토트백 (pkg_rpet_cotton)
```
A lightweight cotton fabric tote bag,
soft cotton drape, [natural/black] color,
casual everyday style, long shoulder straps
```

### 타포린 백 (pkg_rpet_tarp)
```
A tarpaulin tote bag made from recycled banner material,
waterproof glossy texture, [color] body,
industrial-chic look, reinforced seams
```

---

## 🥫 틴케이스 (Tin Case)

### 사각 틴케이스 (pkg_tin_sq)
```
A small rectangular metal tin box with hinged lid slightly open,
[silver/gold/black] finish, smooth matte metal surface,
clean edges, hinge visible at back
```

### 원형 틴케이스 (pkg_tin_round)
```
A circular metal tin with pull-off lid resting beside,
[silver/gold/black], shallow profile,
similar to a mint or candy tin, brushed metal
```

### 슬라이드 틴케이스 (pkg_tin_slide)
```
A flat metal slide-top tin, the sliding lid pulled out halfway showing the rail,
[silver/gold/black], pocket-sized, brushed finish
```

---

## 🪪 파우치 (Pouch)

### 지퍼 파우치 (pkg_pouch_zip)
```
A flat zipper pouch with metal zipper across the top,
[clear PVC/white/matte] body, slightly unzipped,
clean rectangular shape
```

### 캔버스 파우치 (pkg_pouch_canvas)
```
A canvas zippered pouch, [natural/black/navy] color,
visible cotton weave, contrast zipper pull,
casual lifestyle pouch
```

### 가죽 파우치 (pkg_pouch_leather)
```
A premium leather zip pouch, [black/brown/tan] color,
smooth surface with subtle grain texture,
metal zipper, gusseted bottom, luxury feel
```

### 비닐 파우치 (pkg_pouch_pvc)
```
A clear vinyl zipper pouch with [colored] piping,
contents visible through transparent body,
travel/cosmetic pouch style
```

---

## 📂 폴딩박스 (Folding Box)

### 자석 폴딩박스 (pkg_fold_mag)
```
A collapsible magnetic-flap gift box partially unfolded,
[finish] exterior, magnetic side flaps, ribbon detail,
shown mid-assembly to demonstrate folding
```

### 리본 폴딩박스 (pkg_fold_ribbon)
```
A flat-folded gift box tied with a satin ribbon bow,
[finish] cardstock, ribbon in [color],
elegant gift presentation
```

### 자동 조립박스 (pkg_fold_auto)
```
A snap-bottom auto-lock box shown in folded flat state next to assembled version,
[finish] cardboard, demonstrates one-touch assembly,
practical shipping box
```

---

## 🏷️ 라벨·스티커

### 원형 라벨 (pkg_label_round)
```
A small circular paper label, [finish] surface,
slight peel from backing showing adhesive,
diameter [30/50/80/120mm], blank face
```

### 사각 라벨 (pkg_label_sq)
```
A rectangular paper sticker label, [finish] surface,
slight curl at corner, clean cut edges,
displayed on neutral surface
```

### 투명 스티커 (pkg_label_clear)
```
A transparent vinyl sticker with no visible background,
slight glossy reflection,
shape: [round/rectangular],
partially peeled from backing sheet
```

### 메탈 스티커 (pkg_label_metal)
```
A metallic foil sticker with mirror finish,
[silver/gold/black-chrome] surface,
high-reflective brushed texture,
embossed border subtle
```

### 홀로그램 스티커 (pkg_label_holo)
```
A holographic rainbow sticker with prismatic surface,
visible rainbow refraction pattern,
shape: [shape], peel-off backing visible
```

---

## 🎀 부자재 (Accessories)

### 리본 (pkg_parts_ribbon)
```
A spool of satin gift-wrap ribbon, [color] color,
partially unrolled showing texture,
clean studio shot on white background
```

### 티슈 페이퍼 (pkg_parts_tissue)
```
A stack of thin tissue paper sheets in [color],
top sheet slightly raised showing translucency,
soft folded edges
```

### 끈·핸들 (pkg_parts_string)
```
A coil of cotton twine / paper string,
[natural/colored] color,
neatly wound, slight texture detail
```

### 봉투 씰 (pkg_parts_seal)
```
A wax-style adhesive seal sticker on neutral surface,
[gold/silver/red] finish, embossed circular border,
luxury envelope closure
```

---

## 🔧 후처리 워크플로우 (이미지 생성 후)

1. **AI 이미지 생성** (위 프롬프트로 1024×1024 PNG 생성)
2. **배경 클린업** — remove.bg 또는 Photoshop 으로 완전 투명 PNG 또는 순백 처리
3. **카멜레온 로고 합성** — 박스 정면 또는 가방 한쪽에 로고 50–80px 합성
   - 위치: 정면 중앙 약간 위 (박스), 가방 정면 중앙
   - 색상: 배경 대비 — 다크 박스에는 흰색 로고, 라이트 박스에는 다크 로고
4. **사이즈 최적화** — 800×800 WebP 변환 (페이지 로딩 속도)
5. **업로드** — Supabase Storage `goods-images/{code}.webp` 경로
6. **DB 연결** — `admin_products.img_url` 에 Storage public URL 입력

### Storage 업로드 코드 예시 (브라우저 콘솔)
```js
const file = document.querySelector('input[type=file]').files[0];
const { data, error } = await sb.storage
    .from('goods-images')
    .upload(`${productCode}.webp`, file, { upsert: true });
const url = sb.storage.from('goods-images').getPublicUrl(`${productCode}.webp`).data.publicUrl;
await sb.from('admin_products').update({ img_url: url }).eq('code', productCode);
```

---

## 💡 효율 팁

- **배치 처리** — Midjourney `/imagine` 한 번에 4장 생성됨. 사이즈/색상 다른 4개 변형을 한 프롬프트로 묶기
- **Style Reference 활용** — Midjourney v6 `--sref` 로 첫 번째 박스 이미지를 레퍼런스 등록 → 이후 모든 박스가 동일 스타일 유지
- **Seed 고정** — DALL-E `--seed` 옵션으로 같은 카테고리는 같은 seed 사용 → 일관된 룩
- **하루 100장 목표** — 약 6일이면 600개 placeholder 채울 수 있음

## 📂 관련 파일

- [`/goods`](goods.html) — 카탈로그 페이지 (자동으로 DB 의 pkg_* 카테고리 상품 로드)
- [`/seed-goods.html`](seed-goods.html) — 시드 데이터 일괄 등록 도구 (어드민 전용)
- [`_worker.js`](_worker.js) — `/goods` 라우팅
