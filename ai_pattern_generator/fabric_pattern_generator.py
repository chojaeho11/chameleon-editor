"""
Cotton Print — AI Fabric Pattern Generator
==========================================
OpenAI gpt-image-1으로 패브릭 패턴을 자동 생성하고, 좌우/상하 이어지는
타일러블 이미지로 가공한 뒤, Supabase Storage에 업로드하고 user_patterns
테이블에 자동 등록합니다. 카테고리(동물/식물/사람/모던/풍경/타이포/키즈/기타)를
순회하며 가상의 한국·일본·미국 디자이너 이름과 패턴 제목을 자동 생성합니다.

Setup:
    1) pip install -r requirements.txt
    2) .env.example을 .env로 복사하고 OPENAI_API_KEY, SUPABASE_SERVICE_KEY 입력
    3) python fabric_pattern_generator.py             # 무한 루프 (Ctrl+C로 중단)
       python fabric_pattern_generator.py --dry-run   # 로컬 저장만 (업로드/등록 안 함)
       python fabric_pattern_generator.py --rounds 1  # 한 바퀴(8장)만

비용:
    gpt-image-1 medium 1024×1024 = ~$0.04/장
    하룻밤 100장 ≈ $4.0
"""

import os
import re
import sys
import io
import time
import base64
import random
import secrets
import argparse
from pathlib import Path
from datetime import datetime

import numpy as np
from PIL import Image, ImageFilter
import requests
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv


# ============================================================
# 설정 로드
# ============================================================
load_dotenv()

OPENAI_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qinvtnhiidtmrzosyvys.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service_role (RLS 우회용)

if not OPENAI_KEY:
    sys.exit("❌ OPENAI_API_KEY 환경변수가 없습니다. .env 파일을 만들어주세요.")
if not SUPABASE_KEY:
    sys.exit("❌ SUPABASE_SERVICE_KEY 환경변수가 없습니다. .env 파일을 만들어주세요.")

oai = OpenAI(api_key=OPENAI_KEY)
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ============================================================
# 카테고리 + 모티프 풀 (영문 — 이미지 모델용)
# ============================================================
CATEGORIES = {
    "animal": {
        "ko": "동물",
        "motifs": [
            "tiny cute kawaii cats in pastel pink, mint, and yellow",
            "small tropical birds and butterflies",
            "small playful puppies, flat illustration",
            "tiny ocean creatures - whales, dolphins, jellyfish, fish",
            "small forest animals - foxes, deer, owls in muted earth tones",
            "small geometric origami animals",
            "tiny safari animals - elephants, giraffes, zebras",
            "small rabbits and teddy bears, scandinavian flat style",
            "tiny birds on small branches",
            "small woodland creatures with tiny mushrooms",
        ],
    },
    "plant": {
        "ko": "식물",
        "motifs": [
            "tiny wildflowers in pastel pink, blue, and yellow",
            "small tropical monstera and palm leaves",
            "small line-art succulents",
            "tiny botanical herbs and ferns",
            "small cherry blossoms scattered",
            "small abstract eucalyptus leaves in sage green",
            "tiny lavender sprigs and chamomile",
            "small bamboo sprigs",
            "small scandinavian folk flowers in muted colors",
            "tiny pressed flowers and ferns scattered",
        ],
    },
    "people": {
        "ko": "사람",
        "motifs": [
            "tiny minimalist single-line faces",
            "small abstract dancing silhouettes in pastel",
            "small line-art portrait sketches",
            "tiny boho lifestyle figures",
            "small yoga poses in single-line art",
            "tiny chibi characters scattered",
            "small fashion line-sketches",
            "small abstract figures in mid-century flat style",
            "tiny people walking in minimalist style",
            "small matisse-style flat cut-out figures",
        ],
    },
    "modern": {
        "ko": "모던",
        "motifs": [
            "small geometric shapes - circles, squares, triangles in primary colors",
            "small bauhaus-inspired color blocks",
            "minimalist scandinavian abstract lines and dots",
            "small terrazzo speckles in pink and beige",
            "small art-deco gold lines on deep navy flat background",
            "small memphis design pastel shapes and squiggles",
            "small midcentury modern atomic starbursts",
            "monochrome dot grid pattern",
            "small abstract flat shapes in mustard and teal",
            "small minimalist arches and waves",
        ],
    },
    "scenery": {
        "ko": "풍경",
        "motifs": [
            "tiny pastel mountains with small suns scattered",
            "tiny rolling hills with small houses",
            "small wave shapes in flat blue tones",
            "tiny stars and constellations on dark blue",
            "small forest tree shapes in flat green",
            "tiny desert dune shapes with cacti",
            "small city skyline silhouettes scattered",
            "small snowy peak shapes flat",
            "small tropical island shapes with palm trees",
            "tiny lavender field rows scattered",
        ],
    },
    "typo": {
        "ko": "타이포",
        "motifs": [
            "small abstract calligraphy strokes in black and red",
            "tiny alphabet letters in colorful retro fonts",
            "small japanese kanji characters scattered",
            "small korean hangul characters in playful colors",
            "tiny vintage letterforms",
            "small graffiti scribbles in pastel",
            "small monogram letter shapes",
            "tiny handwritten word marks",
            "small abstract typography characters",
            "small letter blocks like building toys",
        ],
    },
    "kids": {
        "ko": "키즈",
        "motifs": [
            "small rainbow clouds and unicorns in pastel",
            "tiny candy and ice cream icons",
            "small balloons and party hats in primary colors",
            "tiny school supplies - crayons, pencils, books",
            "small wooden toy blocks and teddy bears",
            "tiny circus tents and carousel icons",
            "small baby animals with tiny stars and moons",
            "tiny spaceships and planets in pastels",
            "small cute dinosaurs in muted colors",
            "small fairy tale castles and dragons",
        ],
    },
    "etc": {
        "ko": "기타",
        "motifs": [
            "small abstract flat shapes in mustard and indigo",
            "tiny vintage stamp and postmark icons",
            "small colorful musical notes and instruments",
            "tiny kitchen utensil icons",
            "small tools and gears scattered",
            "tiny stationery icons - notebooks, pens, paper clips",
            "small tea cups, teapots, and pastry icons",
            "tiny vintage camera and film roll icons",
            "small constellation and star icons",
            "tiny antique key and lock icons",
        ],
    },
}


# ============================================================
# 가상 디자이너 이름 (한국 / 일본 / 미국)
# ============================================================
KR_FIRST = ["민준", "서연", "도윤", "하준", "서진", "지호", "지안", "수아", "하린", "예준",
            "이안", "지유", "하윤", "시우", "유나", "우진", "서아", "지원", "채원", "민서",
            "윤서", "다은", "예린", "주원", "건우"]
KR_LAST = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"]
KR_BRAND_ADJ = ["벨벳", "따스한", "민들레", "코튼", "바람", "구름", "달빛", "숲속", "달콤한",
                "올리브", "해질녘", "여름의", "햇살", "이슬", "도토리"]
KR_STUDIO_SFX = ["스튜디오", "아틀리에", "디자인", "패턴", "테이블", "공방", "랩", "컬렉티브"]

JP_FIRST = ["Yuki", "Hiroshi", "Sakura", "Akira", "Hana", "Ren", "Aoi", "Haru", "Mei", "Sora",
            "Kaede", "Riko", "Naoki", "Yuna", "Aya", "Kenji", "Mio", "Taro", "Kana", "Saki"]
JP_LAST = ["Tanaka", "Suzuki", "Sato", "Watanabe", "Yamamoto", "Nakamura", "Kobayashi",
           "Kato", "Ito", "Yoshida", "Matsuda", "Shimizu", "Hayashi", "Mori", "Inoue"]
JP_BRAND_ADJ = ["Sakura", "Hinoki", "Yuzu", "Aoi", "Komorebi", "Tsuki", "Hana", "Kaze",
                "Ame", "Yuki", "Kogarashi", "Hoshi", "Mizuiro", "Asahi"]
JP_STUDIO_SFX = ["Studio", "Atelier", "Design", "Pattern", "Lab", "Works", "Print", "Collective"]

US_FIRST = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Mia", "Sophia", "Ethan", "Lily", "Zoe",
            "Mason", "Ella", "Caleb", "Maya", "Owen", "Sage", "Iris", "Theo", "Nora", "Eli"]
US_LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
           "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee"]
US_BRAND_ADJ = ["Cotton", "Linen", "Velvet", "Sage", "Hazel", "Honey", "Wild", "Soft",
                "Maple", "Indigo", "Birch", "Coral", "Dune", "Aurora"]
US_STUDIO_SFX = ["Studio", "Atelier", "Design Co", "Pattern Lab", "Works", "Prints",
                 "House", "Collective", "Workshop", "&Co"]


def random_designer_name() -> str:
    """가상 디자이너명 — 한국/일본/미국에서 랜덤으로 (한일 약간 가중치)."""
    locale = random.choices(["kr", "jp", "us"], weights=[0.4, 0.35, 0.25])[0]
    if locale == "kr":
        roll = random.random()
        if roll < 0.4:
            return f"{random.choice(KR_LAST)}{random.choice(KR_FIRST)} {random.choice(KR_STUDIO_SFX)}"
        if roll < 0.7:
            return f"{random.choice(KR_LAST)}{random.choice(KR_FIRST)}"
        return f"{random.choice(KR_BRAND_ADJ)} {random.choice(KR_STUDIO_SFX)}"
    if locale == "jp":
        roll = random.random()
        if roll < 0.4:
            return f"{random.choice(JP_FIRST)} {random.choice(JP_LAST)} {random.choice(JP_STUDIO_SFX)}"
        if roll < 0.7:
            return f"{random.choice(JP_FIRST)} {random.choice(JP_LAST)}"
        return f"{random.choice(JP_BRAND_ADJ)} {random.choice(JP_STUDIO_SFX)}"
    # US
    roll = random.random()
    if roll < 0.4:
        return f"{random.choice(US_FIRST)} {random.choice(US_LAST)} {random.choice(US_STUDIO_SFX)}"
    if roll < 0.7:
        return f"{random.choice(US_FIRST)} {random.choice(US_LAST)}"
    return f"{random.choice(US_BRAND_ADJ)} {random.choice(US_STUDIO_SFX)}"


# ============================================================
# 패턴 제목 생성
# ============================================================
TITLE_ADJECTIVES = ["빈티지", "파스텔", "미니멀", "드림", "러블리", "코튼", "스칸디",
                    "보태니컬", "어반", "레트로", "네오", "소프트", "딥", "웜", "모던",
                    "클래식", "노르딕", "센슈얼", "에코", "젠"]
TITLE_NOUNS = {
    "animal":  ["애니멀", "사파리", "오션", "포레스트", "주", "왈츠", "크리처"],
    "plant":   ["플로럴", "보태니컬", "리프", "가든", "블룸", "바인", "허브"],
    "people":  ["피플", "페이스", "피겨", "포트레이트", "실루엣", "댄스"],
    "modern":  ["지오", "아툼", "팝", "블록", "웨이브", "라인", "터라조"],
    "scenery": ["스카이", "마운틴", "오션", "랜드", "호라이즌", "빌리지", "노을"],
    "typo":    ["타이포", "레터", "워드", "칸지", "스크립트", "글리프", "사인"],
    "kids":    ["플레이", "드림", "파티", "캔디", "툰", "베이비", "키즈"],
    "etc":     ["오브젝트", "컬렉션", "믹스", "셔플", "에센스", "뮤즈", "오라"],
}


def random_title(category: str) -> str:
    """패턴 제목 — 형용사 + 명사 (+선택적 번호)."""
    adj = random.choice(TITLE_ADJECTIVES)
    noun = random.choice(TITLE_NOUNS.get(category, ["패턴"]))
    num = random.randint(1, 99)
    return random.choice([
        f"{adj} {noun} #{num:02d}",
        f"{noun} {num:02d}",
        f"{adj} {noun}",
        f"{noun} 시리즈 {num:02d}",
        f"{adj} {noun} No.{num}",
    ])


# ============================================================
# AI 이미지 생성 (gpt-image-1, dall-e-3 폴백)
# ============================================================
def build_prompt(motif: str) -> str:
    """패턴 생성용 프롬프트 — Flat digital illustration, no texture.

    핵심 교훈:
    - "fabric"이라는 단어를 쓰면 AI가 실제 천 결(weave)을 이미지 안에 그려버림
    - "printing"도 종이 질감을 추가하게 만듦
    - 결과물은 PRINT용 "flat digital graphic"이어야 함 (천에 인쇄할 원본 디자인)
    - 작은 모티프를 많이 분산해야 seamless 이음새가 안 보임
    """
    return (
        f"Flat vector-style digital illustration: a dense small-scale repeating pattern of {motif}. "
        "STYLE — strict requirements: "
        "(1) FLAT digital art, like a vector illustration or modern surface pattern design. "
        "(2) Solid clean background color (cream, white, off-white, or soft pastel). "
        "(3) ABSOLUTELY NO fabric weave, NO canvas texture, NO paper grain, NO film grain, "
        "NO photo texture. The background must be perfectly smooth and flat. "
        "(4) NO fake texture overlay of any kind. This is a clean digital file, not a photo. "
        "COMPOSITION — strict requirements: "
        "(a) MANY small motifs scattered DENSELY and EVENLY across the entire image. "
        "Each motif element under 12% of canvas width. "
        "(b) NO large central focal point. NO hero element. Same visual density everywhere. "
        "(c) Motifs distributed like a wallpaper or scrapbook paper print — high motif count. "
        "(d) Edge-to-edge: absolutely no border, frame, vignette, or white margin. "
        "(e) NO text, NO letters, NO watermark, NO signature, NO labels."
    )


def generate_image(prompt: str, size: str = "1024x1024",
                   quality: str = "high") -> Image.Image:
    """OpenAI 이미지 생성 — gpt-image-2 우선, 실패 시 단계별 폴백.

    모델 우선순위 (2026-05 기준 OpenAI 실제 출시 모델):
      1. gpt-image-2 (2026-04 출시, 최신) — 한글/일본어 텍스트, 포토리얼 향상
      2. gpt-image-1.5 (중간 세대)
      3. gpt-image-1 (2025-04 출시)
      4. dall-e-3 (구세대, b64 미지원이라 url 다운로드)

    quality: "low"/"medium"/"high" — high가 디테일 좋고 깔끔. medium은 약 $0.04, high는 약 $0.17/장
    """
    fallback_chain = [
        ("gpt-image-2", quality),
        ("gpt-image-1.5", quality),
        ("gpt-image-1", quality),
    ]
    for model, q in fallback_chain:
        try:
            resp = oai.images.generate(
                model=model, prompt=prompt, size=size, quality=q, n=1,
            )
            b64 = resp.data[0].b64_json
            if b64:
                return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        except Exception as e:
            print(f"      ⚠ {model} 실패 → 다음 모델 시도 ({e.__class__.__name__})")
            continue

    # 마지막 폴백: dall-e-3 (URL 응답)
    print(f"      ⚠ 모든 gpt-image 실패 → dall-e-3 최종 폴백")
    resp = oai.images.generate(
        model="dall-e-3", prompt=prompt, size=size, quality="hd", n=1,
    )
    url = resp.data[0].url
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert("RGB")


# ============================================================
# Seamless Tile 가공 — Offset + Gradient Correction (개선판)
# ============================================================
def make_seamless_tile(img: Image.Image,
                        band_pct: float = 0.018,
                        blur_radius: int = 6) -> Image.Image:
    """
    Photoshop 스타일 Offset + Poisson 스타일 그래디언트 보정.

    이전 버전(band 4.5%, blur 22)은 중앙에 흐릿한 십자(+) 띠가 보였음.
    이번 버전은 두 단계를 결합:

    ── Stage 1: Wrap-shift (np.roll) ──
        이미지를 (h/2, w/2)만큼 이동. 새 가장자리는 원래 내부 픽셀이라
        자연스럽게 이어짐 (4방향 seamless 보장).

    ── Stage 2: Gradient-distributed seam correction ──
        roll 후 중앙에 생기는 십자(+) 이음새에서의 픽셀 차이(delta)를 계산.
        이 차이를 이미지 전체에 부드럽게 분산해서, 이음새에서의 차이가
        0이 되도록 보정. 결과: 콘텐츠 손상 없이 이음새가 거의 사라짐.
        (Poisson seamless cloning의 단순화 버전)

    ── Stage 3: 잔여 미세 블러 ──
        Stage 2로 대부분 해결되지만, 색상 차이가 큰 경우 여전히 미세
        seam이 남을 수 있어 매우 좁은 1.8% 띠에 약한 블러(radius 6) 적용.

    band_pct: 잔여 블러 띠 폭 비율 (1.8%) — 이전 4.5%에서 대폭 축소
    blur_radius: 잔여 블러 강도 (6) — 이전 22에서 대폭 축소
    """
    src = img.convert("RGB")
    arr = np.array(src).astype(np.float32)
    h, w, _ = arr.shape

    # ── Stage 1: Wrap-shift ──
    rolled = np.roll(arr, shift=(h // 2, w // 2), axis=(0, 1))

    # ── Stage 2: Gradient-distributed seam correction ──
    # 세로 이음새: x = w/2에서의 픽셀 점프
    seam_x = w // 2
    seam_y = h // 2

    # 양쪽 픽셀 차이 (h, 3): rolled[:, seam_x] - rolled[:, seam_x - 1]
    delta_v = (rolled[:, seam_x, :] - rolled[:, seam_x - 1, :])  # (h, 3)
    # 차이를 좌우로 절반씩 분산. 이음새에서 ±delta/2로 매끄럽게 만나도록.
    # 가중치: 이음새에서 1, 양 끝(0과 w-1)에서 0이 되는 cosine
    xs = np.arange(w, dtype=np.float32)
    # 거리 정규화: 0 at seam, 1 at far edge
    d_x = np.minimum(np.abs(xs - seam_x), w - np.abs(xs - seam_x)) / (w / 2.0)
    weight_x = 0.5 + 0.5 * np.cos(np.pi * (1.0 - d_x))  # 1 at seam, 0 at edges
    # 부호: 이음새 우측은 -, 좌측은 +
    sign_x = np.where(xs >= seam_x, -1.0, 1.0).astype(np.float32) * 0.5
    correction_v = delta_v[:, None, :] * (sign_x * weight_x)[None, :, None]  # (h, w, 3)
    rolled = rolled + correction_v

    # 가로 이음새: y = h/2 (Stage 2 보정 후 다시 계산)
    delta_h = (rolled[seam_y, :, :] - rolled[seam_y - 1, :, :])  # (w, 3)
    ys = np.arange(h, dtype=np.float32)
    d_y = np.minimum(np.abs(ys - seam_y), h - np.abs(ys - seam_y)) / (h / 2.0)
    weight_y = 0.5 + 0.5 * np.cos(np.pi * (1.0 - d_y))
    sign_y = np.where(ys >= seam_y, -1.0, 1.0).astype(np.float32) * 0.5
    correction_h = delta_h[None, :, :] * (sign_y * weight_y)[:, None, None]
    rolled = rolled + correction_h

    # ── Stage 3: 잔여 미세 블러 (매우 좁은 띠) ──
    rolled_clipped = np.clip(rolled, 0, 255).astype(np.uint8)
    rolled_pil = Image.fromarray(rolled_clipped)
    blurred_pil = rolled_pil.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    blurred_arr = np.array(blurred_pil).astype(np.float32)

    band = max(15, int(min(h, w) * band_pct))
    mask = np.zeros((h, w), dtype=np.float32)

    dist_x = np.abs(xs - seam_x)
    in_band_x = dist_x < band
    col_alpha = np.where(in_band_x, 0.5 + 0.5 * np.cos(np.pi * dist_x / band), 0.0)
    mask = np.maximum(mask, col_alpha[None, :])

    dist_y = np.abs(ys - seam_y)
    in_band_y = dist_y < band
    row_alpha = np.where(in_band_y, 0.5 + 0.5 * np.cos(np.pi * dist_y / band), 0.0)
    mask = np.maximum(mask, row_alpha[:, None])

    mask3 = mask[:, :, None]
    out = rolled.astype(np.float32) * (1 - mask3) + blurred_arr * mask3

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def make_2x2_preview(img: Image.Image, max_side: int = 800) -> Image.Image:
    """검증용 미리보기 — 2×2로 타일링해서 이음새 확인."""
    img_small = img.copy()
    img_small.thumbnail((max_side // 2, max_side // 2))
    w, h = img_small.size
    grid = Image.new("RGB", (w * 2, h * 2))
    for i in range(2):
        for j in range(2):
            grid.paste(img_small, (i * w, j * h))
    return grid


# ============================================================
# Supabase 업로드 + 등록
# ============================================================
def upload_image(img: Image.Image, storage_path: str, quality: int = 92) -> str:
    """이미지를 Supabase Storage(design 버킷)에 업로드, public URL 반환."""
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    sb.storage.from_("design").upload(
        path=storage_path,
        file=buf.getvalue(),
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    return sb.storage.from_("design").get_public_url(storage_path)


def register_pattern(name: str, category: str, author: str,
                     original_url: str, thumb_url: str, description: str = ""):
    """user_patterns 테이블에 status='approved'로 즉시 등록."""
    sb.table("user_patterns").insert({
        "name": name,
        "category": category,
        "author": author,
        "description": description,
        "original_url": original_url,
        "thumb_url": thumb_url,
        "mockup_urls": [],
        "source": "ai-generator",
        "status": "approved",
    }).execute()


# ============================================================
# 워커: 카테고리 1개에 대해 패턴 1개 생성
# ============================================================
def generate_one(category: str, output_dir: Path, dry_run: bool = False) -> dict:
    cat_info = CATEGORIES[category]
    motif = random.choice(cat_info["motifs"])
    designer = random_designer_name()
    title = random_title(category)

    print(f"\n  ┌─ [{cat_info['ko']}] '{title}' — by {designer}")
    print(f"  │  motif: {motif[:60]}{'…' if len(motif) > 60 else ''}")

    # 1) AI 이미지 생성
    print("  │  [1/4] AI 이미지 생성 중...", end="", flush=True)
    t0 = time.time()
    raw_img = generate_image(build_prompt(motif))
    print(f" ✓ ({time.time() - t0:.1f}s)")

    # 2) Seamless 타일 가공
    print("  │  [2/4] 타일러블 가공 중...", end="", flush=True)
    tile = make_seamless_tile(raw_img)
    print(" ✓")

    # 로컬 저장 (디버그/검증용)
    # 파일명은 순수 ASCII만 — Supabase Storage가 비ASCII 키를 거부함
    # 한글 제목 정보는 DB의 name 필드에 그대로 저장되니 손실 없음
    ts = int(time.time())
    rand = secrets.token_hex(3)  # 6 hex chars — 충돌 방지
    base = f"{category}_{ts}_{rand}"
    tile_path = output_dir / f"{base}.jpg"
    tile.save(tile_path, "JPEG", quality=92)
    preview = make_2x2_preview(tile)
    preview.save(output_dir / f"{base}_2x2preview.jpg", "JPEG", quality=80)

    if dry_run:
        print(f"  │  [dry-run] 로컬에만 저장됨")
        print(f"  └─ 📁 {tile_path.name} (+ 2x2 preview)")
        return {"status": "dry-run", "title": title, "designer": designer}

    # 3) Supabase 업로드
    print("  │  [3/4] Supabase 업로드 중...", end="", flush=True)
    fname = f"{base}.jpg"
    orig_url = upload_image(tile, f"patterns/ai/{fname}")
    thumb = tile.copy()
    thumb.thumbnail((600, 600))
    thumb_url = upload_image(thumb, f"patterns/ai/thumb_{fname}", quality=85)
    print(" ✓")

    # 4) DB 등록
    print("  │  [4/4] DB 등록 중...", end="", flush=True)
    register_pattern(
        name=title,
        category=category,
        author=designer,
        original_url=orig_url,
        thumb_url=thumb_url,
        description=f"AI-generated · {motif}",
    )
    print(" ✓")
    print(f"  └─ 🎉 등록 완료: {title} · {designer}")
    return {"status": "ok", "title": title, "designer": designer, "url": thumb_url}


# ============================================================
# 메인 루프
# ============================================================
def main():
    p = argparse.ArgumentParser(description="Cotton Print AI 패턴 자동 생성기")
    p.add_argument("--per-category", type=int, default=1,
                   help="라운드당 카테고리별 생성 수 (기본: 1)")
    p.add_argument("--rounds", type=int, default=0,
                   help="총 라운드 수 (0 = 무한, Ctrl+C로 중단)")
    p.add_argument("--sleep", type=int, default=8,
                   help="패턴 사이 대기 시간(초). 너무 짧으면 rate limit 가능")
    p.add_argument("--categories", nargs="+", default=None,
                   help="특정 카테고리만 (기본: 전체 8개 순회)")
    p.add_argument("--dry-run", action="store_true",
                   help="로컬 저장만, 업로드/등록 안 함 (테스트용)")
    p.add_argument("--output", type=str, default="./generated_patterns",
                   help="로컬 저장 경로")
    args = p.parse_args()

    cats = args.categories or list(CATEGORIES.keys())
    bad = [c for c in cats if c not in CATEGORIES]
    if bad:
        sys.exit(f"❌ 알 수 없는 카테고리: {bad}\n사용 가능: {list(CATEGORIES.keys())}")

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    rounds_label = "무한" if args.rounds == 0 else f"{args.rounds}회"
    per_round = args.per_category * len(cats)
    print("=" * 64)
    print(" 🎨 Cotton Print — AI Fabric Pattern Generator")
    print("=" * 64)
    print(f" 카테고리:  {', '.join(CATEGORIES[c]['ko'] for c in cats)} ({len(cats)}개)")
    print(f" 라운드:    {rounds_label} × 라운드당 {per_round}장")
    print(f" 대기:      {args.sleep}초 (이미지 사이)")
    print(f" 저장:      {output_dir.resolve()}")
    print(f" Dry-run:   {args.dry_run}")
    print(f" 시작:      {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 64)

    done = failed = 0
    round_no = 0

    try:
        while True:
            round_no += 1
            if args.rounds > 0 and round_no > args.rounds:
                break

            now = datetime.now().strftime("%H:%M:%S")
            print(f"\n┏━━━ ROUND {round_no} ━━━━━━━━━━━━━━━━━━━━━━━━ {now} ━━━")

            for cat in cats:
                for i in range(args.per_category):
                    try:
                        generate_one(cat, output_dir, dry_run=args.dry_run)
                        done += 1
                    except Exception as e:
                        failed += 1
                        print(f"\n  ✗ 실패: {e.__class__.__name__}: {e}")
                        time.sleep(5)
                    if args.sleep > 0:
                        time.sleep(args.sleep)

            print(f"\n┗━━━ Round {round_no} 완료 — 누적 ✅ {done} / ✗ {failed}")

    except KeyboardInterrupt:
        print("\n\n⏹  사용자 중단 (Ctrl+C)")

    print()
    print("=" * 64)
    print(f" 종료: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f" 결과: ✅ 성공 {done}장 / ✗ 실패 {failed}장")
    print("=" * 64)


if __name__ == "__main__":
    main()
