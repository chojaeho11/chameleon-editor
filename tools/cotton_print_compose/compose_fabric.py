#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cotton Print - パブリック印刷データ自動生成 / 패브릭 인쇄 데이터 자동 생성
========================================================================

작업지시서의 pattern_spec(셀 크기 / 레이아웃 / 배경색 / 이미지비율) +
고객 업로드 이미지를 -> 실제 출력 사이즈의 인쇄 데이터로 합성.

제품 사양:
    - 가로 폭: 90 ~ 130cm (사용자 선택)
    - 세로 길이: 100cm 단위 (제한 없음)
    - 레이아웃: basic(반복), centered(중앙단일), brick(벽돌), half_drop(반칸어긋남)
    - 배경색: HEX 또는 "transparent"

Usage:

    # 1) Supabase 에서 자동 fetch
    export SUPABASE_ANON_KEY="eyJhbGciOi..."
    python compose_fabric.py --order-id 3553

    # 2) 특정 항목만
    python compose_fabric.py --order-id 3553 --item-idx 0

    # 3) 로컬 파일 (디버깅 / 테스트)
    python compose_fabric.py \\
        --image ./pattern.png \\
        --output-cm 130x100 \\
        --cell-cm 37x37.2 \\
        --layout basic \\
        --bg "#ffffff" \\
        --scale 100

출력:
    output/order<id>_item<idx>_<W>x<H>cm.tiff

Requirements:
    pip install Pillow
"""
import argparse
import json
import math
import os
import sys
from io import BytesIO
from pathlib import Path
import urllib.request
import urllib.error

# 2026-06-10: Windows 한글 CMD (CP949) 에서 이모지/한자 print 시
#   UnicodeEncodeError 가 발생하던 문제 fix — stdout/stderr 을 UTF-8 로 강제.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

try:
    from PIL import Image, ImageDraw
    Image.MAX_IMAGE_PIXELS = None      # 큰 패턴 이미지 허용 (decompression bomb 경고 비활성)
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)


# ─── 일본어/영어 원단명 → 한국어 변환 ───────────────────────────────
# cotton_designer.html 의 i18n 사전과 동일 매핑
JP_KR_MAP = [
    # 원단 종류 (긴 매칭부터)
    ('コットン20番', '면20수'),
    ('コットン30番', '면30수'),
    ('コットン16番', '면16수'),
    ('コットン10番', '면10수'),
    ('Cotton 20s', '면20수'),
    ('Cotton 30s', '면30수'),
    ('Cotton 16s', '면16수'),
    ('Cotton 10s', '면10수'),
    ('オックスフォード', '옥스포드'),
    ('シフォン',       '쉬폰'),
    ('レーヨン',       '레이온'),
    ('リネン',         '린넨'),
    ('Oxford',  '옥스포드'),
    ('Chiffon', '쉬폰'),
    ('Rayon',   '레이온'),
    ('Linen',   '린넨'),
    # 직조
    ('平織', '평직'),
    ('綾織', '능직'),
    ('朱子織', '주자직'),
    # 색상
    ('ホワイト',  '화이트'),
    ('ナチュラル', '네츄럴'),
    ('アイボリー', '아이보리'),
    ('White',   '화이트'),
    ('Natural', '네츄럴'),
    ('Ivory',   '아이보리'),
]


def fabric_to_korean(text: str) -> str:
    """JP/EN 원단명을 한국어로 변환 (cotton_designer.html i18n 기반)."""
    out = str(text or '')
    for jp, kr in JP_KR_MAP:
        out = out.replace(jp, kr)
    return out


def sanitize_filename(name: str) -> str:
    """Windows 금지 문자 + 제어 문자 제거, 양끝 공백/밑줄 정리."""
    bad = '<>:"/\\|?*'
    cleaned = ''.join(c for c in name if c not in bad and ord(c) > 31)
    cleaned = cleaned.replace(' ', '').replace('　', '')  # 전각 공백도 제거
    cleaned = cleaned.strip('._')
    return cleaned or 'untitled'


def build_pattern_filename(order_id, idx, item, output_w_cm, manager_name, layout, ext):
    """패턴 주문용 파일명:
        롤인쇄[수량]개_[원단폭]폭_[고객명]_[원단종류한글].ext
    centered 등 단일 인쇄는 기존 형식 사용 가능 — 호출부에서 분기."""
    qty = item.get('qty') or 1
    width_cm = int(round(output_w_cm))
    # 원단명 — fabric 우선, 없으면 product_name
    fabric_src = item.get('fabric') or item.get('product_name') or ''
    fabric_kr = fabric_to_korean(fabric_src)
    # 괄호 제거 (파일명 깔끔하게)
    fabric_kr = fabric_kr.replace('(', '').replace(')', '')
    fabric_kr = sanitize_filename(fabric_kr)[:40]
    # 고객명
    name = sanitize_filename(manager_name or '고객')[:25]
    parts = [
        f'롤인쇄{qty}개',
        f'{width_cm}폭',
        name,
        fabric_kr,
    ]
    base = '_'.join(p for p in parts if p)
    base = sanitize_filename(base)[:120]
    return f'{base}_#{order_id}.{ext}'


# ─── 돔보마크 (トンボ / 사방 5mm 원형 등록 마크) ──────────────────
def draw_tombow_marks(canvas: 'Image.Image', dpi: int,
                       diameter_mm: float = 5.0,
                       edge_offset_mm: float = 5.0,
                       color=(0, 0, 0)) -> 'Image.Image':
    """4 모서리에 지정 크기 원형 등록 마크 (커팅 가이드).

    Args:
        canvas: PIL 이미지 (RGB or RGBA)
        dpi: 출력 DPI
        diameter_mm: 원 지름 (mm) — 기본 5mm
        edge_offset_mm: 외곽에서 떨어진 거리 (mm) — 기본 5mm
        color: 마크 색상 RGB
    """
    # mm → px 환산 (1 inch = 25.4 mm)
    diameter_px = max(1, int(round(diameter_mm * dpi / 25.4)))
    offset_px   = max(1, int(round(edge_offset_mm * dpi / 25.4)))
    radius = diameter_px / 2.0

    w, h = canvas.size
    # ImageDraw 는 RGB/RGBA 모드 다 OK
    draw = ImageDraw.Draw(canvas)

    # 4 모서리 — 원 외곽이 edge_offset_mm 만큼 떨어지도록 (즉, 원 중심은 edge_offset + radius)
    cx_l = offset_px + radius
    cx_r = w - offset_px - radius
    cy_t = offset_px + radius
    cy_b = h - offset_px - radius

    centers = [
        (cx_l, cy_t),  # 좌상
        (cx_r, cy_t),  # 우상
        (cx_l, cy_b),  # 좌하
        (cx_r, cy_b),  # 우하
    ]
    for cx, cy in centers:
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        draw.ellipse(bbox, fill=color)

    return canvas


# ─── 기본 상수 ──────────────────────────────────────────────────────
DPI_DEFAULT     = 150     # 패브릭 디지털 프린팅 표준 (300 은 파일 너무 큼)
SUPABASE_URL    = 'https://qinvtnhiidtmrzosyvys.supabase.co'
SUPABASE_ANON   = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS'
                   'IsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLC'
                   'JpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTO'
                   'MTi19ksKSeAkx8HOOTONNSos8Xz8Y')


# ─── 헬퍼 ──────────────────────────────────────────────────────────
def cm_to_px(cm: float, dpi: int) -> int:
    return int(round(cm * dpi / 2.54))


def parse_size(s: str):
    """ '130x100' / '130x100cm' / '130.5x100' → (130.5, 100.0) """
    s = s.lower().replace('cm', '').strip()
    if 'x' not in s:
        raise ValueError(f"올바른 크기 형식: WxH (예: 130x100), 받은 값: {s}")
    w, h = s.split('x', 1)
    return float(w), float(h)


def hex_to_rgb(hex_color):
    if hex_color in (None, '', 'transparent'):
        return None
    hex_color = str(hex_color).lstrip('#')
    if len(hex_color) == 3:
        hex_color = ''.join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        return None
    try:
        return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def fetch_order(order_id: str, sb_url: str, sb_key: str) -> dict:
    url = f"{sb_url}/rest/v1/orders?id=eq.{order_id}&select=*"
    req = urllib.request.Request(url, headers={
        'apikey': sb_key,
        'Authorization': f'Bearer {sb_key}',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            if not data:
                raise ValueError(f"Order {order_id} not found")
            return data[0]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Supabase API 실패 ({e.code}): {e.read()[:300]}")


def download_image(url: str) -> Image.Image:
    print(f"  ↓ Downloading: {url[:80]}{'...' if len(url) > 80 else ''}")
    req = urllib.request.Request(url, headers={'User-Agent': 'cotton-print-compose/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        buf = BytesIO(r.read())
    img = Image.open(buf)
    img.load()
    # JPEG 등 RGB → RGBA 변환 (배경 합성용)
    if img.mode not in ('RGBA', 'RGB'):
        img = img.convert('RGBA')
    return img


def _paste(canvas: Image.Image, cell: Image.Image, x: int, y: int):
    """알파 채널 있으면 마스크 사용, 없으면 그대로 paste."""
    if cell.mode == 'RGBA':
        canvas.paste(cell, (x, y), cell)
    else:
        canvas.paste(cell, (x, y))


# ─── 합성 메인 ─────────────────────────────────────────────────────
def compose_fabric_print(
    pattern_img: Image.Image,
    output_w_cm: float,
    output_h_cm: float,
    cell_w_cm: float,
    cell_h_cm: float,
    layout: str = 'basic',
    bg_color: str = '#ffffff',
    image_scale_pct: int = 100,
    dpi: int = DPI_DEFAULT,
) -> Image.Image:
    """패턴 이미지를 출력 사이즈의 인쇄 데이터로 합성."""
    out_w_px = cm_to_px(output_w_cm, dpi)
    out_h_px = cm_to_px(output_h_cm, dpi)
    cell_w_px = cm_to_px(cell_w_cm, dpi)
    cell_h_px = cm_to_px(cell_h_cm, dpi)

    if out_w_px <= 0 or out_h_px <= 0:
        raise ValueError(f"잘못된 출력 사이즈: {output_w_cm}×{output_h_cm}cm")
    if cell_w_px <= 0 or cell_h_px <= 0:
        raise ValueError(f"잘못된 셀 사이즈: {cell_w_cm}×{cell_h_cm}cm")

    # 배경
    bg_rgb = hex_to_rgb(bg_color)
    if bg_rgb is None:
        canvas = Image.new('RGBA', (out_w_px, out_h_px), (0, 0, 0, 0))
    else:
        canvas = Image.new('RGB', (out_w_px, out_h_px), bg_rgb)

    # 셀 크기 + 이미지비율 적용
    scale = max(1, image_scale_pct) / 100.0
    cell_w_target = max(1, int(round(cell_w_px * scale)))
    cell_h_target = max(1, int(round(cell_h_px * scale)))

    # 메모리 절약 — 원본이 너무 크면 한번 다운샘플 후 작업
    src = pattern_img
    src_w, src_h = src.size
    # 패턴이 셀 크기의 3배 이상이면 한 번 줄여서 메모리 절약 (품질 거의 동일)
    if src_w > cell_w_target * 3 or src_h > cell_h_target * 3:
        intermediate = (max(cell_w_target * 2, 1), max(cell_h_target * 2, 1))
        src = src.resize(intermediate, Image.LANCZOS)
    cell = src.resize((cell_w_target, cell_h_target), Image.LANCZOS)

    layout = (layout or 'basic').lower().strip()

    if layout == 'centered':
        # 단일 중앙 배치
        x = (out_w_px - cell_w_target) // 2
        y = (out_h_px - cell_h_target) // 2
        _paste(canvas, cell, x, y)

    elif layout in ('brick', 'brick_horizontal', 'half_drop_horizontal'):
        # 가로로 반칸 어긋난 벽돌 패턴 (행마다 X 오프셋)
        rows = math.ceil(out_h_px / cell_h_target) + 1
        cols = math.ceil(out_w_px / cell_w_target) + 2
        for r in range(rows):
            offset = -(cell_w_target // 2) if r % 2 else 0
            for c in range(cols):
                x = c * cell_w_target + offset
                y = r * cell_h_target
                if x >= out_w_px or y >= out_h_px:
                    continue
                _paste(canvas, cell, x, y)

    elif layout in ('half_drop', 'half_drop_vertical', 'half-drop'):
        # 세로로 반칸 어긋난 패턴 (열마다 Y 오프셋)
        rows = math.ceil(out_h_px / cell_h_target) + 2
        cols = math.ceil(out_w_px / cell_w_target) + 1
        for c in range(cols):
            offset = -(cell_h_target // 2) if c % 2 else 0
            for r in range(rows):
                x = c * cell_w_target
                y = r * cell_h_target + offset
                if x >= out_w_px or y >= out_h_px:
                    continue
                _paste(canvas, cell, x, y)

    elif layout == 'mirror':
        # 미러 타일 (좌우 + 상하 반전 반복)
        rows = math.ceil(out_h_px / cell_h_target)
        cols = math.ceil(out_w_px / cell_w_target)
        for r in range(rows):
            for c in range(cols):
                cur = cell
                if c % 2 == 1:
                    cur = cur.transpose(Image.FLIP_LEFT_RIGHT)
                if r % 2 == 1:
                    cur = cur.transpose(Image.FLIP_TOP_BOTTOM)
                _paste(canvas, cur, c * cell_w_target, r * cell_h_target)

    else:
        # basic / repeat / tile — 균등 타일 (기본)
        rows = math.ceil(out_h_px / cell_h_target)
        cols = math.ceil(out_w_px / cell_w_target)
        for r in range(rows):
            for c in range(cols):
                _paste(canvas, cell, c * cell_w_target, r * cell_h_target)

    return canvas


# ─── 항목 처리 ─────────────────────────────────────────────────────
def process_item(order_id, idx, item, files, args, out_dir):
    name = item.get('product_name') or item.get('fabric') or '제작 항목'
    print(f"\n[{idx + 1}] {name}")

    spec = item.get('pattern_spec') or {}
    cell = spec.get('cell_cm') or {}
    cell_w = float(cell.get('w') or args.fallback_cell_w)
    cell_h = float(cell.get('h') or args.fallback_cell_h)
    layout = spec.get('layout') or 'basic'
    bg = spec.get('bg_color') or '#ffffff'
    scale = int(round((spec.get('image_scale') or 1.0) * 100))

    # 출력 크기 — width_cm 우선, 없으면 width_mm/10
    output_w = item.get('width_cm') or (item.get('width_mm', 1300) / 10.0)
    output_h = item.get('height_cm') or (item.get('height_mm', 1000) / 10.0)
    output_w = float(output_w)
    output_h = float(output_h)

    # 폭 90 ~ 130 검증
    if not (90.0 <= output_w <= 130.0):
        print(f"  ⚠️  WARN: 출력 가로 {output_w}cm — 일반 범위(90~130) 벗어남. 계속 진행.")
    # 세로는 100 단위 — 정확히 100 배수가 아니어도 작업은 진행 (정보만 표시)

    # 아트워크 URL
    art_url = (item.get('artwork_url')
               or item.get('cartImageUrl')
               or (files[idx]['url'] if idx < len(files) and files[idx] else None))
    if not art_url:
        print("  ⏭️  스킵 — artwork_url 없음")
        return False

    print(f"  📐 출력:   {output_w}×{output_h}cm  @ {args.dpi}dpi  "
          f"= {cm_to_px(output_w, args.dpi)}×{cm_to_px(output_h, args.dpi)}px")
    print(f"  🔲 셀:     {cell_w}×{cell_h}cm   Layout: {layout}   BG: {bg}   Scale: {scale}%")

    img = download_image(art_url)
    print(f"  📥 원본:   {img.size[0]}×{img.size[1]}px  ({img.mode})")

    print(f"  🎨 합성 중...")
    out_img = compose_fabric_print(
        img, output_w, output_h, cell_w, cell_h,
        layout, bg, scale, args.dpi,
    )

    # 2026-06-10: 돔보마크 — 사방 5mm 떨어진 4 모서리에 5mm 원형 등록 마크
    if not getattr(args, 'no_tombow', False):
        diameter = getattr(args, 'tombow_mm', 5.0)
        offset = getattr(args, 'tombow_offset_mm', 5.0)
        out_img = draw_tombow_marks(out_img, args.dpi,
                                     diameter_mm=diameter,
                                     edge_offset_mm=offset)
        print(f"  🎯 돔보마크: {diameter}mm 원 · 사방 {offset}mm 떨어짐")

    # 파일명 — 패턴 주문(basic/brick/half_drop/mirror) 은 새 형식, centered 는 기존 형식
    manager_name = getattr(args, '_manager_name', '') or ''
    is_pattern = (layout or '').lower() not in ('centered', 'center')
    if is_pattern and order_id:
        fname = build_pattern_filename(order_id, idx, item, output_w,
                                        manager_name, layout, args.format)
    else:
        safe_name = ''.join(c if c.isalnum() else '_' for c in name)[:30]
        fname = (f"order{order_id or 'manual'}_item{idx + 1}"
                 f"_{safe_name}_{int(output_w)}x{int(output_h)}cm.{args.format}")
    out_path = out_dir / fname

    save_kwargs = {'dpi': (args.dpi, args.dpi)}
    if args.format == 'tiff':
        save_kwargs['compression'] = 'tiff_lzw'
    elif args.format in ('jpg', 'jpeg'):
        save_kwargs['quality'] = 92
        if out_img.mode == 'RGBA':
            # 흰 배경에 flatten
            bg_canvas = Image.new('RGB', out_img.size, (255, 255, 255))
            bg_canvas.paste(out_img, mask=out_img.split()[-1])
            out_img = bg_canvas
    elif args.format == 'png':
        save_kwargs['optimize'] = True

    out_img.save(out_path, **save_kwargs)
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  ✅ 저장: {out_path.name}  ({out_img.size[0]}×{out_img.size[1]}px, {size_mb:.1f}MB)")
    return True


# ─── CLI ──────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser(
        description='Cotton Print 인쇄 데이터 자동 합성',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    # 모드 1: Supabase
    p.add_argument('--order-id', type=str, help='주문 ID (Supabase 에서 자동 fetch)')
    p.add_argument('--item-idx', type=int, default=None, help='특정 항목 인덱스만 (생략시 전체)')
    p.add_argument('--sb-url', default=SUPABASE_URL)
    p.add_argument('--sb-key', default=os.environ.get('SUPABASE_ANON_KEY') or SUPABASE_ANON,
                   help='Supabase anon key (env SUPABASE_ANON_KEY 도 가능)')

    # 모드 2: 로컬 (디버깅용)
    p.add_argument('--image', type=str, help='로컬 이미지 파일')
    p.add_argument('--output-cm', type=str, help='출력 크기 — WxH (예: 130x100)')
    p.add_argument('--cell-cm', type=str, help='셀 크기 — WxH (예: 37x37.2)')
    p.add_argument('--layout', default='basic',
                   choices=['basic', 'repeat', 'centered', 'brick', 'half_drop', 'mirror'])
    p.add_argument('--bg', default='#ffffff', help='배경색 HEX 또는 "transparent"')
    p.add_argument('--scale', type=int, default=100, help='이미지 비율(%) — 기본 100')

    # 공통
    p.add_argument('--dpi', type=int, default=DPI_DEFAULT, help=f'기본 {DPI_DEFAULT}')
    p.add_argument('--output-dir', default='output', help='출력 폴더 (기본 ./output)')
    p.add_argument('--format', default='tiff',
                   choices=['tiff', 'png', 'jpg'], help='출력 포맷 (기본 tiff)')
    p.add_argument('--fallback-cell-w', type=float, default=100.0,
                   help='cell_cm.w 누락시 기본값')
    p.add_argument('--fallback-cell-h', type=float, default=100.0,
                   help='cell_cm.h 누락시 기본값')
    # 돔보마크 (등록 마크)
    p.add_argument('--no-tombow', action='store_true',
                   help='돔보마크 비활성화 (기본: 5mm 원 4모서리)')
    p.add_argument('--tombow-mm', type=float, default=5.0,
                   help='돔보마크 지름 mm (기본 5)')
    p.add_argument('--tombow-offset-mm', type=float, default=5.0,
                   help='돔보마크 외곽 거리 mm (기본 5)')

    args = p.parse_args()
    args._manager_name = ''   # Supabase fetch 후 채워짐
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # ─── 모드 1: Supabase ───
    if args.order_id:
        if not args.sb_key:
            print("ERROR: --sb-key 또는 env SUPABASE_ANON_KEY 필요", file=sys.stderr)
            sys.exit(1)
        print(f"📦 주문 #{args.order_id} fetch 중...")
        try:
            order = fetch_order(args.order_id, args.sb_url, args.sb_key)
        except Exception as e:
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(2)

        items = order.get('items') or []
        files = order.get('files') or []
        args._manager_name = order.get('manager_name', '') or ''
        print(f"  주문자: {args._manager_name or '-'}")
        print(f"  항목수: {len(items)}건")

        if not items:
            print("ERROR: 주문에 항목이 없습니다.", file=sys.stderr)
            sys.exit(3)

        targets = list(enumerate(items))
        if args.item_idx is not None:
            if not (0 <= args.item_idx < len(items)):
                print(f"ERROR: --item-idx {args.item_idx} 범위 초과 (0~{len(items) - 1})", file=sys.stderr)
                sys.exit(4)
            targets = [(args.item_idx, items[args.item_idx])]

        ok = 0
        for idx, item in targets:
            try:
                if process_item(args.order_id, idx, item, files, args, out_dir):
                    ok += 1
            except Exception as e:
                print(f"  ❌ 실패: {e}")
        print(f"\n🏁 완료: {ok}/{len(targets)} 항목 합성됨 (저장 위치: {out_dir.resolve()})")

    # ─── 모드 2: 로컬 ───
    else:
        missing = [k for k in ('image', 'output_cm', 'cell_cm') if not getattr(args, k.replace('-', '_'))]
        if missing:
            print(f"ERROR: 로컬 모드는 --image, --output-cm, --cell-cm 모두 필요 (누락: {missing})",
                  file=sys.stderr)
            p.print_help()
            sys.exit(1)
        img = Image.open(args.image)
        img.load()
        if img.mode not in ('RGBA', 'RGB'):
            img = img.convert('RGBA')
        out_w, out_h = parse_size(args.output_cm)
        cell_w, cell_h = parse_size(args.cell_cm)
        print(f"📐 출력: {out_w}×{out_h}cm @ {args.dpi}dpi")
        print(f"🔲 셀: {cell_w}×{cell_h}cm  Layout: {args.layout}  BG: {args.bg}  Scale: {args.scale}%")
        print("🎨 합성 중...")
        out_img = compose_fabric_print(img, out_w, out_h, cell_w, cell_h,
                                       args.layout, args.bg, args.scale, args.dpi)
        safe = Path(args.image).stem[:30]
        out_path = out_dir / f"manual_{safe}_{int(out_w)}x{int(out_h)}cm.{args.format}"
        save_kwargs = {'dpi': (args.dpi, args.dpi)}
        if args.format == 'tiff':
            save_kwargs['compression'] = 'tiff_lzw'
        elif args.format in ('jpg', 'jpeg'):
            save_kwargs['quality'] = 92
            if out_img.mode == 'RGBA':
                bg_canvas = Image.new('RGB', out_img.size, (255, 255, 255))
                bg_canvas.paste(out_img, mask=out_img.split()[-1])
                out_img = bg_canvas
        elif args.format == 'png':
            save_kwargs['optimize'] = True
        out_img.save(out_path, **save_kwargs)
        size_mb = out_path.stat().st_size / (1024 * 1024)
        print(f"✅ 저장: {out_path}  ({out_img.size[0]}×{out_img.size[1]}px, {size_mb:.1f}MB)")


if __name__ == '__main__':
    main()
