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
    from PIL import Image, ImageDraw, ImageFont
    Image.MAX_IMAGE_PIXELS = None      # 큰 패턴 이미지 허용 (decompression bomb 경고 비활성)
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)

# python-barcode 는 옵션 — 미설치 시 텍스트 라벨로 대체
try:
    import barcode as _barcode_mod
    from barcode.writer import ImageWriter as _BarcodeWriter
    HAS_BARCODE = True
except ImportError:
    HAS_BARCODE = False


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


# ─── 돔보마크 / 등록 마크 (커팅 가이드) ──────────────────────────
def draw_tombow_on_region(canvas: 'Image.Image', x0: int, y0: int,
                           w: int, h: int, dpi: int,
                           diameter_mm: float = 5.0,
                           edge_offset_mm: float = 5.0,
                           color=(0, 0, 0)) -> None:
    """캔버스 안 지정 사각 영역(x0, y0, w, h) 의 4 모서리에 돔보."""
    diameter_px = max(1, int(round(diameter_mm * dpi / 25.4)))
    offset_px   = max(1, int(round(edge_offset_mm * dpi / 25.4)))
    radius = diameter_px / 2.0
    draw = ImageDraw.Draw(canvas)
    cx_l = x0 + offset_px + radius
    cx_r = x0 + w - offset_px - radius
    cy_t = y0 + offset_px + radius
    cy_b = y0 + h - offset_px - radius
    for cx, cy in [(cx_l, cy_t), (cx_r, cy_t), (cx_l, cy_b), (cx_r, cy_b)]:
        bbox = (cx - radius, cy - radius, cx + radius, cy + radius)
        draw.ellipse(bbox, fill=color)


def draw_tombow_marks(canvas: 'Image.Image', dpi: int,
                       diameter_mm: float = 5.0,
                       edge_offset_mm: float = 5.0,
                       color=(0, 0, 0)) -> 'Image.Image':
    """캔버스 전체 4 모서리에 돔보 (편의 래퍼)."""
    w, h = canvas.size
    draw_tombow_on_region(canvas, 0, 0, w, h, dpi,
                           diameter_mm, edge_offset_mm, color)
    return canvas


# ─── Korean 폰트 헬퍼 ─────────────────────────────────────────
_FONT_CACHE = {}

def get_korean_font(size_px: int):
    """플랫폼별 한글 폰트 자동 탐지 (Windows 맑은고딕 우선)."""
    key = size_px
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    candidates = [
        # Windows
        r'C:\Windows\Fonts\malgun.ttf',
        r'C:\Windows\Fonts\malgunbd.ttf',
        r'C:\Windows\Fonts\gulim.ttc',
        # Mac
        '/Library/Fonts/AppleGothic.ttf',
        '/System/Library/Fonts/AppleSDGothicNeo.ttc',
        # Linux
        '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                f = ImageFont.truetype(path, size_px)
                _FONT_CACHE[key] = f
                return f
            except Exception:
                continue
    # 폴백
    _FONT_CACHE[key] = ImageFont.load_default()
    return _FONT_CACHE[key]


# ─── 바코드 생성 ─────────────────────────────────────────────
def _text_label_fallback(text: str, dpi: int, target_height_mm: float) -> 'Image.Image':
    """바코드 미지원/실패 시 텍스트 라벨 폴백."""
    font_px = max(14, int(target_height_mm * dpi / 25.4 * 0.5))
    font = get_korean_font(font_px)
    txt = f'주문 #{text}'
    tmp = Image.new('RGB', (10, 10))
    d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    img = Image.new('RGB', (tw + 24, th + 12), 'white')
    dd = ImageDraw.Draw(img)
    dd.rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), outline='black', width=2)
    dd.text((12, 6), txt, fill='black', font=font)
    return img


def make_barcode_image(text: str, dpi: int,
                        target_height_mm: float = 12.0,
                        module_width_mm: float = 0.3) -> 'Image.Image':
    """Code128 바코드 PNG 이미지 생성. python-barcode 미설치 시 폴백 텍스트."""
    if not HAS_BARCODE:
        return _text_label_fallback(text, dpi, target_height_mm)
    # dpi 낮을 때 module_width 가 1px 미만 → python-barcode 실패 방지
    # 최소 module_width = 2 px 유지
    min_module_mm = (2.0 * 25.4) / max(dpi, 1)
    effective_mw = max(module_width_mm, min_module_mm)
    try:
        code = _barcode_mod.get('code128', str(text), writer=_BarcodeWriter())
        buf = BytesIO()
        options = {
            'module_width':  effective_mw,
            'module_height': max(target_height_mm, 6.0),
            'quiet_zone':    2.0,
            'font_size':     8,
            'text_distance': 2,
            'background':    'white',
            'foreground':    'black',
            'write_text':    True,
            'dpi':           dpi,
        }
        code.write(buf, options)
        buf.seek(0)
        return Image.open(buf).convert('RGB')
    except Exception as e:
        # 라이브러리 내부 오류 → 폴백
        print(f'  [!] 바코드 생성 폴백 (텍스트): {e}')
        return _text_label_fallback(text, dpi, target_height_mm)


# ─── 포스터 한 항목 렌더링 ────────────────────────────────────
def render_poster_item(item: dict, order_id, manager_name: str, dpi: int,
                        tombow_mm: float = 5.0,
                        tombow_offset_mm: float = 5.0,
                        label_height_mm: float = 22.0,
                        files: list = None, item_idx: int = None,
                        image_only: bool = False) -> 'Image.Image':
    """layout=centered 한 항목을 포스터로 합성.
    image_only=True 면 이미지만 (인쇄 레이어용), False 면 + 돔보 + 라벨 (참고용).
    files+item_idx 가 있으면 artwork_url 누락 시 files[idx] 로 폴백."""
    output_w_cm = float(item.get('width_cm') or (item.get('width_mm', 1000) / 10))
    output_h_cm = float(item.get('height_cm') or (item.get('height_mm', 1000) / 10))

    img_w_px = cm_to_px(output_w_cm, dpi)
    img_h_px = cm_to_px(output_h_cm, dpi)

    # 아트워크 URL — 다중 폴백
    art_url = item.get('artwork_url') or item.get('cartImageUrl')
    if not art_url and files is not None and item_idx is not None:
        if 0 <= item_idx < len(files) and files[item_idx]:
            art_url = files[item_idx].get('url')
    if not art_url:
        raise ValueError('artwork_url 없음 (item / files 모두 비어있음)')
    src = download_image(art_url)
    src = src.resize((img_w_px, img_h_px), Image.LANCZOS)

    # image_only 모드 — 이미지만 반환 (인쇄 레이어)
    if image_only:
        return src.convert('RGB') if src.mode != 'RGB' else src

    # 라벨 높이 + 전체 캔버스
    label_h_px = max(1, int(round(label_height_mm * dpi / 25.4)))
    total_h_px = img_h_px + label_h_px

    poster = Image.new('RGB', (img_w_px, total_h_px), 'white')
    # 이미지 영역: 알파 합성 처리
    if src.mode == 'RGBA':
        poster.paste(src, (0, 0), src)
    else:
        poster.paste(src, (0, 0))

    # 이미지 영역에 돔보마크
    if tombow_mm > 0:
        draw_tombow_on_region(poster, 0, 0, img_w_px, img_h_px, dpi,
                               diameter_mm=tombow_mm,
                               edge_offset_mm=tombow_offset_mm)

    # 라벨 텍스트
    draw = ImageDraw.Draw(poster)
    fabric_kr = fabric_to_korean(item.get('fabric') or item.get('product_name') or '')
    fabric_short = fabric_kr.replace('(', '').replace(')', '').strip()
    # 작품명 — product_name 에서 fabric 부분 빼고 남은 추가 정보
    pname = item.get('product_name') or ''
    work_label = ''
    if '—' in pname or '-' in pname:
        sep = '—' if '—' in pname else '-'
        parts = pname.split(sep, 1)
        if len(parts) == 2:
            work_label = parts[1].strip()

    font_px = max(20, int(label_h_px * 0.32))
    font_main = get_korean_font(font_px)
    font_sub  = get_korean_font(max(14, int(font_px * 0.7)))

    text_x = cm_to_px(0.4, dpi)
    text_y = img_h_px + cm_to_px(0.3, dpi)

    line1 = f'재질: {fabric_short}'
    if work_label:
        line1 += f'  ·  {work_label[:40]}'
    line2 = f'고객: {manager_name}    주문 #{order_id}'

    draw.text((text_x, text_y), line1, fill='black', font=font_main)
    draw.text((text_x, text_y + font_px + cm_to_px(0.15, dpi)),
              line2, fill='black', font=font_sub)

    # 바코드 (우측)
    try:
        bc = make_barcode_image(str(order_id), dpi,
                                 target_height_mm=label_height_mm * 0.5,
                                 module_width_mm=0.28)
        # 라벨 영역에 맞게 비율 조정 (높이 기준)
        target_bc_h = int(label_h_px * 0.62)
        ratio = target_bc_h / bc.size[1]
        new_bc_w = max(1, int(bc.size[0] * ratio))
        bc = bc.resize((new_bc_w, target_bc_h), Image.LANCZOS)
        bc_x = img_w_px - new_bc_w - cm_to_px(0.4, dpi)
        bc_y = img_h_px + cm_to_px(0.25, dpi)
        # 폭이 좁아 라벨 영역과 겹치면 줄임
        if bc_x < text_x + cm_to_px(8.0, dpi):
            # 너무 좁은 항목은 폴백 — 작은 바코드
            scale_down = 0.55
            bc = bc.resize((max(1, int(new_bc_w * scale_down)),
                            max(1, int(target_bc_h * scale_down))), Image.LANCZOS)
            bc_x = img_w_px - bc.size[0] - cm_to_px(0.3, dpi)
        poster.paste(bc, (bc_x, bc_y))
    except Exception as e:
        print(f'  [!] 바코드 생성 스킵: {e}')

    return poster


# ─── Shelf-pack 알고리즘 — 120cm 폭 시트에 nest 배치 ──────────
def compute_nest_placements(items_data: list, sheet_width_cm: float, dpi: int,
                             padding_cm: float = 0.5) -> dict:
    """Posters + meta 들을 sheet_width 안에 nest packing — 좌표 계산만.
    items_data: [{'image': PIL.Image, 'item': dict, 'rotated': bool}, ...]
    Returns: { sheet_w_px, sheet_h_px, placements: [(img, x_px, y_px, rotated, item), ...] }
    """
    sheet_w_px = cm_to_px(sheet_width_cm, dpi)
    padding_px = max(0, cm_to_px(padding_cm, dpi))

    # 1) 회전 처리 + scale-down (sheet_w 넘으면) + 메타 보존
    prepared = []
    for entry in items_data:
        img = entry['image']
        item = entry['item']
        pw, ph = img.size
        rotated = False
        if pw > sheet_w_px and ph <= sheet_w_px:
            img = img.rotate(90, expand=True, resample=Image.BICUBIC)
            pw, ph = img.size
            rotated = True
        if pw > sheet_w_px:
            r = sheet_w_px / pw
            img = img.resize((sheet_w_px, max(1, int(ph * r))), Image.LANCZOS)
            pw, ph = img.size
        prepared.append({'image': img, 'item': item, 'rotated': rotated, 'w': pw, 'h': ph})

    # 2) 높이 내림차순 정렬
    prepared.sort(key=lambda e: -e['h'])

    # 3) Shelf packing
    placements = []
    cur_x = 0
    cur_y = 0
    cur_shelf_h = 0
    for e in prepared:
        if cur_x + e['w'] > sheet_w_px:
            cur_y += cur_shelf_h + padding_px
            cur_x = 0
            cur_shelf_h = 0
        placements.append({
            'image': e['image'],
            'item': e['item'],
            'x': cur_x, 'y': cur_y,
            'w': e['w'], 'h': e['h'],
            'rotated': e['rotated'],
        })
        cur_x += e['w'] + padding_px
        cur_shelf_h = max(cur_shelf_h, e['h'])

    total_h_px = cur_y + cur_shelf_h
    if total_h_px <= 0:
        raise ValueError('빈 시트 — 합성할 항목 없음')

    return {
        'sheet_w_px': sheet_w_px,
        'sheet_h_px': total_h_px,
        'placements': placements,
    }


def render_nest_sheet(nest_result: dict) -> 'Image.Image':
    """placements 를 흰 시트에 합성 → 인쇄 가능한 TIFF."""
    sheet = Image.new('RGB',
                       (nest_result['sheet_w_px'], nest_result['sheet_h_px']),
                       'white')
    for p in nest_result['placements']:
        img = p['image']
        if img.mode == 'RGBA':
            sheet.paste(img, (p['x'], p['y']), img)
        else:
            sheet.paste(img, (p['x'], p['y']))
    return sheet


# ─── 칼선/돔보 SVG 생성 (Illustrator 호환 레이어) ──────────────
def _px_to_mm(px: float, dpi: int) -> float:
    return round(px * 25.4 / dpi, 3)


def render_cut_svg(nest_result: dict, order_id, manager_name: str, dpi: int,
                    tombow_mm: float = 5.0,
                    tombow_offset_mm: float = 5.0) -> str:
    """칼선/돔보/라벨 3-레이어 SVG (Illustrator 호환).
    좌표는 mm 단위. <g id="..."> 가 Illustrator 레이어로 인식됨."""
    sheet_w_mm = _px_to_mm(nest_result['sheet_w_px'], dpi)
    sheet_h_mm = _px_to_mm(nest_result['sheet_h_px'], dpi)
    radius_mm = tombow_mm / 2.0

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
                 f'xmlns:xlink="http://www.w3.org/1999/xlink" '
                 f'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
                 f'width="{sheet_w_mm}mm" height="{sheet_h_mm}mm" '
                 f'viewBox="0 0 {sheet_w_mm} {sheet_h_mm}">')

    # 메타 — 주문 정보
    lines.append(f'  <title>Cotton Print Cut Layer — Order #{order_id} · {manager_name}</title>')
    lines.append(f'  <desc>Generated by compose_fabric.py</desc>')

    # 레이어 1: 칼선 (붉은색 윤곽선)
    lines.append('  <g id="칼선" inkscape:groupmode="layer" inkscape:label="칼선" '
                 'style="display:inline">')
    for p in nest_result['placements']:
        x_mm = _px_to_mm(p['x'], dpi)
        y_mm = _px_to_mm(p['y'], dpi)
        w_mm = _px_to_mm(p['w'], dpi)
        h_mm = _px_to_mm(p['h'], dpi)
        lines.append(f'    <rect x="{x_mm}" y="{y_mm}" '
                     f'width="{w_mm}" height="{h_mm}" '
                     f'stroke="#ff0000" fill="none" stroke-width="0.25"/>')
    lines.append('  </g>')

    # 레이어 2: 돔보마크 (검정 원, 4 모서리)
    lines.append('  <g id="돔보" inkscape:groupmode="layer" inkscape:label="돔보" '
                 'style="display:inline">')
    for p in nest_result['placements']:
        x_mm = _px_to_mm(p['x'], dpi)
        y_mm = _px_to_mm(p['y'], dpi)
        w_mm = _px_to_mm(p['w'], dpi)
        h_mm = _px_to_mm(p['h'], dpi)
        # 4 모서리 — edge_offset_mm 떨어진 위치 (원의 중심은 offset + radius)
        cx_l = x_mm + tombow_offset_mm + radius_mm
        cx_r = x_mm + w_mm - tombow_offset_mm - radius_mm
        cy_t = y_mm + tombow_offset_mm + radius_mm
        cy_b = y_mm + h_mm - tombow_offset_mm - radius_mm
        for cx, cy in [(cx_l, cy_t), (cx_r, cy_t), (cx_l, cy_b), (cx_r, cy_b)]:
            lines.append(f'    <circle cx="{cx}" cy="{cy}" r="{radius_mm}" '
                         f'fill="#000000"/>')
    lines.append('  </g>')

    # 레이어 3: 라벨/바코드 (재질·고객명·주문번호 텍스트)
    lines.append('  <g id="라벨" inkscape:groupmode="layer" inkscape:label="라벨" '
                 'style="display:inline">')
    for p in nest_result['placements']:
        x_mm = _px_to_mm(p['x'], dpi)
        y_mm = _px_to_mm(p['y'], dpi) + _px_to_mm(p['h'], dpi) + 3.0
        item = p['item']
        fabric = fabric_to_korean(item.get('fabric') or '').strip()
        for sep in ('—', '-', '·'):
            if sep in fabric:
                fabric = fabric.split(sep, 1)[0].strip()
                break
        pname = (item.get('product_name') or '').replace('<', '&lt;').replace('>', '&gt;').replace('&', '&amp;')
        # 작품명
        work = ''
        for sep in ('—', '-'):
            if sep in pname:
                work = pname.split(sep, 1)[1].strip()[:40]
                break
        rot_txt = ' (회전)' if p['rotated'] else ''
        line1 = f'재질: {fabric}  ·  고객: {manager_name}  ·  주문 #{order_id}{rot_txt}'
        if work:
            line2 = f'작품: {work}'
        else:
            line2 = ''
        # 라벨 텍스트
        lines.append(f'    <text x="{x_mm}" y="{y_mm}" font-family="Malgun Gothic, sans-serif" '
                     f'font-size="3.5" fill="#000000">{line1}</text>')
        if line2:
            lines.append(f'    <text x="{x_mm}" y="{y_mm + 4.5}" font-family="Malgun Gothic, sans-serif" '
                         f'font-size="3" fill="#333333">{line2}</text>')
    lines.append('  </g>')

    lines.append('</svg>')
    return '\n'.join(lines)


# ─── 호환 래퍼 (기존 호출자 보존) ────────────────────────────
def nest_posters_on_sheet(posters: list, sheet_width_cm: float, dpi: int,
                           padding_cm: float = 0.5) -> 'Image.Image':
    """기존 시그니처용 래퍼 — placements 정보 없이 sheet 만 반환."""
    items_data = [{'image': p, 'item': {}} for p in posters]
    res = compute_nest_placements(items_data, sheet_width_cm, dpi, padding_cm)
    return render_nest_sheet(res)


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

    # 2026-06-10: 롤인쇄(basic/brick/half_drop/mirror)는 돔보 없음 (요청).
    #            포스터(centered)는 별도 process_poster_group 에서 처리하므로 여기 안 옴.

    # 파일명 — 롤인쇄는 새 형식 (롤인쇄N개_W폭_고객명_원단_#주문)
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


# ─── 포스터 배치 처리 (재질별 nest) ────────────────────────────
def process_poster_batch(order_id, targets, files, args, out_dir):
    """centered 항목들을 재질별로 묶어 120폭 시트에 nest packing.
       각 포스터: 이미지 + 4 모서리 돔보 + 재질/고객명/바코드 라벨 포함."""
    manager_name = getattr(args, '_manager_name', '') or '고객'
    use_nest = not getattr(args, 'no_nest', False)
    sheet_w_cm = float(getattr(args, 'sheet_width_cm', 120.0))
    pad_cm = float(getattr(args, 'nest_padding_cm', 0.5))
    label_mm = float(getattr(args, 'label_mm', 22.0))
    tombow_mm = float(getattr(args, 'tombow_mm', 5.0))
    tombow_off = float(getattr(args, 'tombow_offset_mm', 5.0))
    do_tombow = not getattr(args, 'no_tombow', False)

    # 재질별 group
    groups = {}
    for idx, item in targets:
        fab = (item.get('fabric') or item.get('product_name') or '미분류')
        fab_kr = fabric_to_korean(fab).strip()
        # 작품명 등 추가 텍스트가 있으면 첫 단어만 (재질 분류용)
        # 예: "쉬폰 — 김명련" → "쉬폰"
        for sep in ('—', '-', '·'):
            if sep in fab_kr:
                fab_kr = fab_kr.split(sep, 1)[0].strip()
                break
        groups.setdefault(fab_kr, []).append((idx, item))

    print(f"  재질별 그룹: {len(groups)}종 — " + ', '.join(
        f'{k}({len(v)}건)' for k, v in groups.items()))

    saved = 0
    for fab_kr, group in groups.items():
        print(f"\n  ── [{fab_kr}] {len(group)}건 처리 중 ──")
        # 각 항목 포스터 이미지 렌더링 (이미지만 — 인쇄 레이어용)
        items_data = []
        for idx, item in group:
            try:
                print(f"  [{idx+1}] {item.get('product_name','')[:50]}")
                # 인쇄용: 이미지만 (돔보/라벨/바코드는 별도 SVG 레이어로)
                img = render_poster_item(item, order_id, manager_name,
                                          args.dpi,
                                          files=files, item_idx=idx,
                                          image_only=True)
                items_data.append({'image': img, 'item': item})
            except Exception as e:
                print(f"    ❌ 스킵: {e}")

        if not items_data:
            print(f"  [!] {fab_kr} 그룹에 처리 가능한 항목 없음")
            continue

        mgr_safe = sanitize_filename(manager_name)[:20]
        fab_safe = sanitize_filename(fab_kr)[:20]

        # nest packing — placements 계산
        print(f"  🧩 nest packing: {len(items_data)}개 → {sheet_w_cm}cm 폭 시트")
        nest_res = compute_nest_placements(items_data, sheet_w_cm,
                                            args.dpi, padding_cm=pad_cm)

        # 1) 인쇄 TIFF — 이미지 + 흰 배경 (돔보/라벨 없음)
        print_sheet = render_nest_sheet(nest_res)
        print_fname = (f'포스터_{fab_safe}_{int(sheet_w_cm)}폭'
                       f'_{mgr_safe}_{len(items_data)}점_#{order_id}.{args.format}')
        print_path = out_dir / print_fname
        final_print = _save_image(print_sheet, print_path, args)
        try:
            size_mb = final_print.stat().st_size / (1024 * 1024)
        except Exception:
            size_mb = 0
        print(f'  🖨️  인쇄 레이어: {final_print.name}  '
              f'({print_sheet.size[0]}×{print_sheet.size[1]}px, {size_mb:.1f}MB)')
        saved += 1

        # 2) 칼선 SVG — 돔보 + 칼선 + 라벨 (Illustrator 호환 레이어)
        if do_tombow or True:   # 항상 SVG 도 생성
            svg_str = render_cut_svg(nest_res, order_id, manager_name, args.dpi,
                                      tombow_mm=tombow_mm,
                                      tombow_offset_mm=tombow_off)
            svg_fname = (f'포스터_{fab_safe}_{int(sheet_w_cm)}폭'
                         f'_{mgr_safe}_{len(items_data)}점_#{order_id}_칼선.svg')
            svg_path = out_dir / svg_fname
            svg_path.write_text(svg_str, encoding='utf-8')
            svg_kb = svg_path.stat().st_size / 1024
            print(f'  ✂️  칼선 레이어: {svg_path.name}  ({svg_kb:.1f}KB · '
                  f'Illustrator/Inkscape 에서 [칼선] [돔보] [라벨] 레이어로 열림)')
            saved += 1

    return saved


def _save_image(img, path, args):
    """포맷별 저장. JPG 는 65535×65535 px 제한이 있어 큰 nest 시트는 자동 TIFF 폴백.
    실제 저장된 경로 반환 (포맷이 변경됐을 수 있음)."""
    save_kwargs = {'dpi': (args.dpi, args.dpi)}
    fmt = args.format
    w, h = img.size
    if fmt in ('jpg', 'jpeg') and (w > 65000 or h > 65000):
        old_fmt = fmt
        fmt = 'tiff'
        path = path.with_suffix('.tiff')
        print(f'  [!] 시트 사이즈 {w}×{h}px 가 {old_fmt.upper()} 한계 초과 → TIFF 자동 변경')
    if fmt == 'tiff':
        save_kwargs['compression'] = 'tiff_lzw'
    elif fmt in ('jpg', 'jpeg'):
        save_kwargs['quality'] = 92
        if img.mode == 'RGBA':
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
    elif fmt == 'png':
        save_kwargs['optimize'] = True
    img.save(path, **save_kwargs)
    return path


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
    # 돔보마크 (포스터 모드 한정)
    p.add_argument('--no-tombow', action='store_true',
                   help='돔보마크 비활성화 (포스터 모드 한정)')
    p.add_argument('--tombow-mm', type=float, default=5.0,
                   help='돔보마크 지름 mm (기본 5)')
    p.add_argument('--tombow-offset-mm', type=float, default=5.0,
                   help='돔보마크 외곽 거리 mm (기본 5)')
    # 포스터 nesting (centered 항목들을 한 시트에 packing)
    p.add_argument('--sheet-width-cm', type=float, default=120.0,
                   help='포스터 nest 시트 폭 cm (기본 120)')
    p.add_argument('--nest-padding-cm', type=float, default=0.5,
                   help='포스터 사이 여백 cm (기본 0.5)')
    p.add_argument('--no-nest', action='store_true',
                   help='포스터 모드도 항목별 개별 파일로 (nest 비활성화)')
    p.add_argument('--label-mm', type=float, default=22.0,
                   help='포스터 하단 라벨 영역 높이 mm (기본 22)')

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

        # 2026-06-10: 모드 분기 — 롤인쇄(basic 등) vs 포스터(centered)
        #   롤인쇄: 항목별 개별 파일 (돔보 없음)
        #   포스터: 재질별로 group → 120폭 시트에 nest packing (돔보+라벨+바코드 포함)
        roll_targets = []
        poster_targets = []
        for idx, item in targets:
            spec = item.get('pattern_spec') or {}
            layout = (spec.get('layout') or 'basic').lower()
            if layout in ('centered', 'center'):
                poster_targets.append((idx, item))
            else:
                roll_targets.append((idx, item))

        ok = 0
        # 롤인쇄 처리
        if roll_targets:
            print(f"\n=== 롤인쇄 모드 ({len(roll_targets)}건) ===")
            for idx, item in roll_targets:
                try:
                    if process_item(args.order_id, idx, item, files, args, out_dir):
                        ok += 1
                except Exception as e:
                    print(f"  ❌ 실패: {e}")

        # 포스터 처리 — 재질별 group, 120폭 시트에 nest
        if poster_targets:
            print(f"\n=== 패브릭포스터 모드 ({len(poster_targets)}건) ===")
            ok += process_poster_batch(args.order_id, poster_targets,
                                        files, args, out_dir)

        print(f"\n🏁 완료: {ok} 출력 파일 생성됨 (저장 위치: {out_dir.resolve()})")

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
