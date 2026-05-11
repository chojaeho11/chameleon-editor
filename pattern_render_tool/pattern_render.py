#!/usr/bin/env python3
"""
Cotton Print — 패턴 재조합 스크립트
========================================
다크팩토리(구글 드라이브) 동기화로 생성된 "{코드}_{주문번호}_{고객명}_정보.txt"와
같은 폴더의 원본 디자인 파일을 입력으로, 인쇄 가능한 고해상도 PNG 패턴을 합성합니다.

입력:
  정보.txt — Edge Function 'sync-order-to-drive'가 만든 메모.
            끝부분에 [PATTERN_RENDER_SPEC] ... [/PATTERN_RENDER_SPEC] JSON 블록이 있음.
  원본 이미지 — {baseName}_01.png, _02.png 등. 메모와 같은 폴더에 있어야 함.

출력:
  pattern_print.png — 지정 DPI로 합성된 인쇄용 PNG. 기본 60 DPI = 약 3071×2362 px (130×100cm 원단).

사용법:
  python pattern_render.py 정보.txt                       # 첫 아이템, 60 DPI
  python pattern_render.py 정보.txt --dpi 120             # 더 큰 출력
  python pattern_render.py 정보.txt --item 1              # 주문에 여러 아이템이 있을 때 두 번째
  python pattern_render.py 정보.txt --out result.png      # 출력 파일명 변경
  python pattern_render.py 정보.txt --artwork ./원본.png   # 원본 직접 지정

의존성:
  pip install Pillow

레이아웃:
  centered  — 중앙에 한 번만 (Mockup용)
  basic     — 격자 반복
  halfdrop  — 매 두 번째 컬럼이 세로로 절반 내림
  halfbrick — 매 두 번째 행이 가로로 절반 밂
  mirror    — 좌우/상하 미러로 시밍리스 타일

배경색은 #RRGGBB (HEX) 문자열. 'transparent' 인 경우 RGBA로 출력.
이미지 비율(image_scale)은 0.3~1.0 사이 — 셀 크기는 유지, 셀 안의 이미지만 작게.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow가 필요합니다.  pip install Pillow")


# ─────────────────────────────────────────────────────────────
# 정보.txt 파서
# ─────────────────────────────────────────────────────────────
SPEC_RE = re.compile(
    r'\[PATTERN_RENDER_SPEC\]\s*(?:#[^\n]*\n)*\s*(\{.*?\})\s*\[/PATTERN_RENDER_SPEC\]',
    re.DOTALL,
)

def parse_spec_from_memo(memo_text: str) -> dict:
    m = SPEC_RE.search(memo_text)
    if not m:
        raise ValueError(
            "[PATTERN_RENDER_SPEC] JSON 블록을 정보.txt에서 찾을 수 없습니다.\n"
            "오래된 주문이거나 cotton-print 흐름이 아닐 수 있어요."
        )
    raw = m.group(1)
    return json.loads(raw)


# ─────────────────────────────────────────────────────────────
# 원본 이미지 자동 탐지
# ─────────────────────────────────────────────────────────────
def find_artwork(memo_path: Path, item: dict) -> Path:
    """메모와 같은 폴더에서 원본 이미지 찾기.

    1. 메모 파일명 패턴: {코드}_{주문번호}_{고객명}_정보.txt
       → 원본은 {코드}_{주문번호}_{고객명}_01.{ext} 식.
    2. spec.artwork_filename 과 일치하는 이름이 있으면 우선.
    """
    dir_ = memo_path.parent
    base = memo_path.stem  # "code_123_홍길동_정보"
    if base.endswith("_정보"):
        base = base[: -len("_정보")]

    art_name_hint = item.get("artwork_filename") or ""

    # 1) 정확한 hint 이름 매칭
    if art_name_hint:
        for p in dir_.iterdir():
            if p.name.lower() == art_name_hint.lower():
                return p

    # 2) baseName_01..NN.ext 매칭
    candidates = []
    for p in dir_.iterdir():
        if not p.is_file():
            continue
        if p.name.startswith(base + "_") and not p.name.endswith("_정보.txt"):
            # 작업지시서.pdf / 견적서.pdf 제외
            if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".tif", ".tiff"}:
                candidates.append(p)
    candidates.sort()
    if candidates:
        return candidates[0]

    # 3) 폴더 안의 첫 이미지 (최후 수단)
    for p in dir_.iterdir():
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            return p

    raise FileNotFoundError(
        f"원본 이미지를 {dir_} 에서 찾지 못했습니다. --artwork 로 직접 지정해주세요."
    )


# ─────────────────────────────────────────────────────────────
# 색상 헬퍼
# ─────────────────────────────────────────────────────────────
def hex_to_rgb(hex_color: str) -> tuple:
    h = (hex_color or "#ffffff").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


# ─────────────────────────────────────────────────────────────
# 핵심 렌더러
# ─────────────────────────────────────────────────────────────
def render_pattern(spec: dict, artwork_path: Path, dpi: int = 60) -> Image.Image:
    fabric_w_cm = float(spec["fabric_cm"]["w"])
    fabric_h_cm = float(spec["fabric_cm"]["h"])
    cell_w_cm = float(spec["cell_cm"]["w"])
    cell_h_cm = float(spec["cell_cm"]["h"])
    layout = spec.get("layout", "basic")
    bg_color = spec.get("bg_color", "#ffffff")
    scale = float(spec.get("image_scale", 1.0))

    # cm → px (DPI는 dot/inch, 1 inch = 2.54 cm)
    px_per_cm = dpi / 2.54
    fabric_w_px = max(1, int(round(fabric_w_cm * px_per_cm)))
    fabric_h_px = max(1, int(round(fabric_h_cm * px_per_cm)))
    cell_w_px = cell_w_cm * px_per_cm
    cell_h_px = cell_h_cm * px_per_cm
    if cell_w_px < 2 or cell_h_px < 2:
        raise ValueError(f"셀이 너무 작습니다 ({cell_w_px:.1f} × {cell_h_px:.1f} px). DPI를 올려주세요.")

    transparent = (bg_color == "transparent")
    if transparent:
        canvas = Image.new("RGBA", (fabric_w_px, fabric_h_px), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGB", (fabric_w_px, fabric_h_px), hex_to_rgb(bg_color))

    artwork = Image.open(artwork_path).convert("RGBA")

    # 셀 내 이미지 크기 (등비) + 중앙 정렬 패딩
    draw_w_px = max(1, int(round(cell_w_px * scale)))
    draw_h_px = max(1, int(round(cell_h_px * scale)))
    pad_x = (cell_w_px - draw_w_px) / 2.0
    pad_y = (cell_h_px - draw_h_px) / 2.0
    art_scaled = artwork.resize((draw_w_px, draw_h_px), Image.LANCZOS)

    def paste(at_x: float, at_y: float, img: Image.Image = art_scaled):
        # alpha mask로 합성 — 투명 PNG 지원
        canvas.paste(img, (int(round(at_x)), int(round(at_y))), img)

    if layout == "centered":
        x = (fabric_w_px - cell_w_px) / 2.0
        y = (fabric_h_px - cell_h_px) / 2.0
        paste(x + pad_x, y + pad_y)

    elif layout == "basic":
        y = 0.0
        while y < fabric_h_px:
            x = 0.0
            while x < fabric_w_px:
                paste(x + pad_x, y + pad_y)
                x += cell_w_px
            y += cell_h_px

    elif layout == "halfdrop":
        cols = int(fabric_w_px / cell_w_px) + 2
        for c in range(cols):
            x = c * cell_w_px
            off_y = (c % 2) * (cell_h_px / 2.0)
            y = -cell_h_px
            while y < fabric_h_px:
                paste(x + pad_x, y + off_y + pad_y)
                y += cell_h_px

    elif layout == "halfbrick":
        rows = int(fabric_h_px / cell_h_px) + 2
        for r in range(rows):
            y = r * cell_h_px
            off_x = (r % 2) * (cell_w_px / 2.0)
            x = -cell_w_px
            while x < fabric_w_px:
                paste(x + off_x + pad_x, y + pad_y)
                x += cell_w_px

    elif layout == "mirror":
        cols = int(fabric_w_px / cell_w_px) + 1
        rows = int(fabric_h_px / cell_h_px) + 1
        for r in range(rows):
            for c in range(cols):
                fx = (c % 2) == 1
                fy = (r % 2) == 1
                tile = art_scaled
                if fx:
                    tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
                if fy:
                    tile = tile.transpose(Image.FLIP_TOP_BOTTOM)
                paste(c * cell_w_px + pad_x, r * cell_h_px + pad_y, tile)

    else:
        raise ValueError(f"알 수 없는 레이아웃: {layout}")

    return canvas


# ─────────────────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description="Cotton Print 패턴 재조합 — 정보.txt 와 원본 이미지로 고해상도 PNG 생성",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "예시:\n"
            "  python pattern_render.py 5월11일_조재호/CT_2826_조재호_정보.txt\n"
            "  python pattern_render.py 정보.txt --dpi 120 --out pattern_2826.png"
        ),
    )
    ap.add_argument("memo", help='"_정보.txt" 파일 경로')
    ap.add_argument("--artwork", help="원본 이미지 파일 (지정하지 않으면 자동 탐지)")
    ap.add_argument("--dpi", type=int, default=60, help="출력 DPI (기본 60, 인쇄 권장 60~150)")
    ap.add_argument("--out", default=None, help="출력 PNG 경로 (기본: {정보파일_stem}_pattern.png)")
    ap.add_argument("--item", type=int, default=0, help="주문에 여러 아이템이 있을 때 인덱스 (0=첫번째)")
    args = ap.parse_args()

    memo_path = Path(args.memo).resolve()
    if not memo_path.exists():
        sys.exit(f"정보 파일을 찾을 수 없습니다: {memo_path}")
    memo_text = memo_path.read_text(encoding="utf-8")

    try:
        spec_block = parse_spec_from_memo(memo_text)
    except ValueError as e:
        sys.exit(str(e))

    items = spec_block.get("items", [])
    if not items:
        sys.exit("재조합할 아이템이 없습니다 (items 배열이 빔).")
    if args.item >= len(items):
        sys.exit(f"--item {args.item} 은 범위를 벗어남 (아이템 수 {len(items)}개)")
    item = items[args.item]

    artwork_path = Path(args.artwork).resolve() if args.artwork else find_artwork(memo_path, item)
    print(f"📄 메모:     {memo_path}")
    print(f"🖼  원본:     {artwork_path}")
    print(
        f"📐 패턴:     {item['fabric_cm']['w']}×{item['fabric_cm']['h']}cm 원단 · "
        f"셀 {item['cell_cm']['w']}×{item['cell_cm']['h']}cm · "
        f"{item['layout']} · 배경 {item['bg_color']} · "
        f"이미지 {int(round(item.get('image_scale', 1.0) * 100))}%"
    )
    out_w = int(round(float(item["fabric_cm"]["w"]) * args.dpi / 2.54))
    out_h = int(round(float(item["fabric_cm"]["h"]) * args.dpi / 2.54))
    print(f"🎯 해상도:   {args.dpi} DPI → {out_w}×{out_h} px")

    result = render_pattern(item, artwork_path, dpi=args.dpi)

    out_path = Path(args.out) if args.out else memo_path.with_name(memo_path.stem.replace("_정보", "") + "_pattern.png")
    save_kwargs = {"dpi": (args.dpi, args.dpi)}
    result.save(out_path, "PNG", **save_kwargs)
    print(f"✅ 저장 완료: {out_path}  ({os.path.getsize(out_path)/1024/1024:.1f} MB)")


if __name__ == "__main__":
    main()
