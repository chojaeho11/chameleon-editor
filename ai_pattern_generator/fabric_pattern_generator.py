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
from PIL import Image
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
            "cute kawaii cats with soft pastel colors",
            "tropical birds and butterflies in vibrant tones",
            "playful puppies in watercolor style",
            "ocean creatures - whales, dolphins, jellyfish",
            "forest animals - foxes, deer, owls in muted earth tones",
            "geometric origami animals on cream background",
            "safari animals - elephants, giraffes, zebras minimalist",
            "rabbits and bears in vintage scandinavian style",
            "tiny birds on branches japanese ink-wash",
            "woodland creatures with mushrooms",
        ],
    },
    "plant": {
        "ko": "식물",
        "motifs": [
            "soft watercolor wildflowers in pastel pink and blue",
            "tropical monstera and palm leaves on cream",
            "minimalist line-art succulents",
            "vintage botanical illustration of herbs",
            "cherry blossoms with delicate branches",
            "abstract eucalyptus leaves in sage green",
            "wild lavender and chamomile",
            "japanese ink-wash bamboo on rice paper",
            "scandinavian folk flowers in muted colors",
            "tiny pressed flowers and ferns",
        ],
    },
    "people": {
        "ko": "사람",
        "motifs": [
            "minimalist single-line drawings of faces",
            "diverse silhouettes dancing in soft colors",
            "abstract portrait sketches in earth tones",
            "boho lifestyle figures with plants",
            "yoga poses in continuous line art",
            "cute chibi characters on pastel background",
            "fashion illustration sketches in watercolor",
            "vintage cameo profiles in cream and gold",
            "tiny people walking minimalist",
            "matisse-style cut-out figures",
        ],
    },
    "modern": {
        "ko": "모던",
        "motifs": [
            "clean geometric shapes - circles, squares, triangles in primary colors",
            "bauhaus-inspired color blocks on neutral background",
            "minimalist scandinavian abstract lines",
            "terrazzo speckles in pink and beige",
            "art-deco gold lines on deep navy",
            "memphis design pastel shapes squiggles",
            "midcentury modern atomic starburst",
            "monochrome dot grid with subtle variation",
            "bold abstract brush strokes in mustard and teal",
            "minimalist arches and waves",
        ],
    },
    "scenery": {
        "ko": "풍경",
        "motifs": [
            "tiny pastel mountain ranges with sun",
            "rolling hills with little white houses",
            "ocean waves in japanese ukiyo-e style",
            "starry night sky with constellations",
            "forest treetops aerial view",
            "desert dunes with cacti minimalist",
            "city skyline silhouette in soft pink dawn",
            "snowy peaks in watercolor",
            "tropical island with palm trees",
            "lavender fields stretching to horizon",
        ],
    },
    "typo": {
        "ko": "타이포",
        "motifs": [
            "abstract calligraphy brush strokes in black and red",
            "scattered alphabet letters in retro fonts colorful",
            "japanese kanji in elegant ink-wash",
            "korean hangul in playful primary colors",
            "vintage newspaper letterforms",
            "graffiti tag scribbles in pastel",
            "monogram letters overlapping art-deco",
            "handwritten quotes in soft watercolor",
            "abstract typography on cream paper",
            "letter blocks scattered like building toys",
        ],
    },
    "kids": {
        "ko": "키즈",
        "motifs": [
            "rainbow clouds and unicorns in pastel",
            "candy and ice cream illustrations",
            "balloons and party hats in primary colors",
            "school supplies - crayons, pencils, books",
            "wooden toy blocks and teddy bears",
            "circus tents and carousels vintage style",
            "baby animals with stars and moons",
            "spaceships and planets in dreamy pastels",
            "cute dinosaurs in muted colors",
            "fairy tale castles and dragons",
        ],
    },
    "etc": {
        "ko": "기타",
        "motifs": [
            "abstract paint brush strokes in mustard and indigo",
            "vintage stamps and postmarks collection",
            "colorful musical notes and instruments",
            "kitchen utensils sketched simply",
            "tools and gears in industrial style",
            "stationery items - notebooks, pens, paper clips",
            "tea cups, teapots, and pastries",
            "vintage cameras and rolls of film",
            "constellations and astronomical charts",
            "antique keys and locks",
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
    """패턴 생성용 프롬프트 — 타일러블/원단 인쇄 강조."""
    return (
        f"A seamless repeating fabric pattern featuring {motif}. "
        "Edge-to-edge composition with absolutely no border, frame, or white margin. "
        "The pattern repeats naturally and tiles infinitely in all directions, "
        "as if printed on roll fabric. Motifs are evenly distributed across the entire canvas, "
        "with balanced negative space. Designed for printing on cotton fabric for clothing "
        "and home textiles. Clean illustration with a soft, harmonious color palette. "
        "No text, no watermark, no signature, no human silhouette unless explicitly part of the motif."
    )


def generate_image(prompt: str, size: str = "1024x1024") -> Image.Image:
    """OpenAI 이미지 생성 — gpt-image-1 우선, 실패 시 dall-e-3 폴백."""
    try:
        resp = oai.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size=size,
            quality="medium",
            n=1,
        )
        b64 = resp.data[0].b64_json
        return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    except Exception as e:
        print(f"      ⚠ gpt-image-1 실패 → dall-e-3 폴백 ({e.__class__.__name__})")
        resp = oai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality="standard",
            n=1,
        )
        url = resp.data[0].url
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")


# ============================================================
# Seamless Tile 가공 (좌우/상하 이어지게)
# ============================================================
def make_seamless_tile(img: Image.Image, fade_pct: float = 0.08) -> Image.Image:
    """
    이미지를 좌우/상하 이어지는 타일로 변환.

    원리:
        - 가장자리 픽셀이 반대쪽 가장자리와 같아져야 seamless 함.
        - 양쪽 가장자리에서 거리 x인 픽셀들의 평균을 구해서, 가장자리에 가까울수록
          그 평균값으로 부드럽게(코사인) 페이드.
        - 결과적으로 left[0] == right[0] == avg, top[0] == bottom[0] == avg
          → 4방향 모두 seamless 하게 이어짐.

    fade_pct: 페이드할 가장자리 폭 비율 (0.08 = 8%)
    """
    arr = np.array(img.convert("RGB")).astype(np.float32)
    h, w, _ = arr.shape
    fw = max(20, int(w * fade_pct))
    fh = max(20, int(h * fade_pct))

    out = arr.copy()

    # ── 좌우 이음 (가로 방향) ──
    for x in range(fw):
        # 코사인 smoothstep: 0(가장자리) → 1(fw 안쪽)
        a = 0.5 - 0.5 * np.cos(np.pi * x / fw)
        # x번째와 반대쪽 (w-1-x)번째 픽셀의 평균
        avg = (arr[:, x] + arr[:, w - 1 - x]) / 2
        out[:, x] = arr[:, x] * a + avg * (1 - a)
        out[:, w - 1 - x] = arr[:, w - 1 - x] * a + avg * (1 - a)

    # ── 상하 이음 (세로 방향) — 이미 좌우 처리한 결과 위에서 ──
    arr2 = out.copy()
    for y in range(fh):
        a = 0.5 - 0.5 * np.cos(np.pi * y / fh)
        avg = (arr2[y, :] + arr2[h - 1 - y, :]) / 2
        out[y, :] = arr2[y, :] * a + avg * (1 - a)
        out[h - 1 - y, :] = arr2[h - 1 - y, :] * a + avg * (1 - a)

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
