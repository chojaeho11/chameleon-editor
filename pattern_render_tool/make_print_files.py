#!/usr/bin/env python3
"""
Cotton Print / Chameleon Printing — 인쇄 데이터 생성 통합 CLI
=================================================================
다크팩토리의 "_정보.txt"와 같은 폴더의 원본 디자인을 입력으로,
제품 카테고리에 맞는 인쇄 파일(SVG + PDF)을 생성합니다.

  · 돔보(코너 크롭마크) — 자동
  · 외곽 칼선 (마젠타) — 제품별 정형 사이즈 / 라운드
  · 레지스트레이션 마크 — 옵션 (다색 인쇄 정합용)
  · 정보 라벨 (주문번호 / 고객 / 사이즈 / 제품 / 날짜)

출력 파일:
  · {order}_print.svg   — Illustrator/Inkscape에서 레이어 그대로 열림
  · {order}_print.pdf   — 2페이지: page 1 = 인쇄용 (아트워크+마크),
                                  page 2 = 컷팅용 (칼선+V컷+마크)
  · {order}_cutline.svg — 칼선 단독 (커팅 머신 전송용)

사용법:
  python make_print_files.py  4월27일_조재호/CT_2826_조재호_정보.txt
  python make_print_files.py  정보.txt --item 1                # 여러 아이템 중 두 번째
  python make_print_files.py  정보.txt --template honeycomb    # 자동 라우팅 무시
  python make_print_files.py  정보.txt --out-dir ./output

의존성:
  pip install Pillow reportlab          # PDF 출력 시 필요
  pip install Pillow                    # SVG만 출력 시
"""
import argparse
import json
import re
import sys
from pathlib import Path

# Windows cp949 콘솔에서도 한글/유니코드가 안전하게 출력되도록
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except (AttributeError, Exception):
    pass

# 패키지 임포트 — 이 스크립트가 pattern_render_tool 안에 있다고 가정
sys.path.insert(0, str(Path(__file__).parent.parent))
from pattern_render_tool.product_registry import resolve_template, is_supported, list_supported
from pattern_render_tool.templates import build_honeycomb


# ─────────────────────────────────────────────────────────────
# 정보.txt 파서 (pattern_render.py와 동일)
# ─────────────────────────────────────────────────────────────
SPEC_RE = re.compile(
    r'\[PATTERN_RENDER_SPEC\]\s*(?:#[^\n]*\n)*\s*(\{.*?\})\s*\[/PATTERN_RENDER_SPEC\]',
    re.DOTALL,
)
ORDER_JSON_RE = re.compile(
    r'\[원본 주문 데이터 \(JSON\)\]\s*\n(\{.*\})\s*$',
    re.DOTALL,
)

def parse_memo(memo_text: str) -> dict:
    """정보.txt 에서 우리가 쓸 부분 추출 — pattern_spec block + raw order dump."""
    out = {'items_spec': [], 'order': None}
    m = SPEC_RE.search(memo_text)
    if m:
        try:
            out['items_spec'] = json.loads(m.group(1)).get('items', [])
        except json.JSONDecodeError:
            pass
    m2 = ORDER_JSON_RE.search(memo_text)
    if m2:
        try:
            out['order'] = json.loads(m2.group(1))
        except json.JSONDecodeError:
            pass
    return out


# ─────────────────────────────────────────────────────────────
# 원본 디자인 자동 탐지 — pattern_render.py와 동일 로직
# ─────────────────────────────────────────────────────────────
def find_artwork(memo_path: Path, hint_filename: str = '') -> Path:
    dir_ = memo_path.parent
    base = memo_path.stem
    if base.endswith('_정보'): base = base[:-3]

    # 1) hint 우선
    if hint_filename:
        for p in dir_.iterdir():
            if p.name.lower() == hint_filename.lower():
                return p

    # 2) baseName_NN.* 매칭
    candidates = sorted([
        p for p in dir_.iterdir()
        if p.is_file()
        and p.name.startswith(base + '_')
        and p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.pdf'}
        and not p.name.endswith('_정보.txt')
        and '작업지시서' not in p.name
        and '견적서' not in p.name
    ])
    if candidates:
        return candidates[0]

    # 3) 폴더의 첫 이미지
    for p in dir_.iterdir():
        if p.suffix.lower() in {'.png', '.jpg', '.jpeg'}:
            return p

    raise FileNotFoundError(f'원본 디자인을 {dir_} 에서 찾지 못함. --artwork 로 지정하세요.')


# ─────────────────────────────────────────────────────────────
# spec → 템플릿 입력 변환
# ─────────────────────────────────────────────────────────────
def make_template_spec(item_spec: dict, order: dict, artwork_path: Path, item_idx: int = 0) -> dict:
    """정보.txt의 item_spec + order JSON 에서 템플릿이 필요한 필드만 추출."""
    # 사이즈는 item_spec의 fabric_cm 또는 order.items[i] 또는 widht_cm/height_cm
    order_items = (order or {}).get('items', [])
    raw_item = order_items[item_idx] if item_idx < len(order_items) else {}

    width_cm = item_spec.get('fabric_cm', {}).get('w') or raw_item.get('width_cm') or 100
    height_cm = item_spec.get('fabric_cm', {}).get('h') or raw_item.get('height_cm') or 100

    return {
        'width_mm':       float(width_cm) * 10,
        'height_mm':      float(height_cm) * 10,
        'artwork_path':   str(artwork_path),
        'corner_radius_mm': 0,    # 기본 직각, 운영자가 --round N 로 오버라이드
        'order_no':       str((order or {}).get('id', '?')),
        'customer':       (order or {}).get('manager_name', ''),
        'product':        item_spec.get('product_name') or raw_item.get('product_name', ''),
        'qty':            item_spec.get('qty') or raw_item.get('qty', 1),
        'date':           (order or {}).get('order_date', '')[:10],
    }


# ─────────────────────────────────────────────────────────────
# 메인
# ─────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        description='제품별 인쇄 PDF/SVG 생성 (돔보 + 칼선)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="지원 템플릿:\n" + '\n'.join(f"  {k:10s} {v}" for k, v in list_supported().items())
    )
    ap.add_argument('memo', help='"_정보.txt" 파일 경로')
    ap.add_argument('--artwork', help='원본 디자인 (자동탐지 실패 시 지정)')
    ap.add_argument('--item', type=int, default=0, help='주문에 여러 아이템이 있을 때 인덱스 (0)')
    ap.add_argument('--template', help='자동 라우팅 무시하고 강제로 지정 (honeycomb / fabric)')
    ap.add_argument('--round', type=float, default=0, help='칼선 라운드 코너 반지름 mm (기본 0=직각)')
    ap.add_argument('--out-dir', default=None, help='출력 폴더 (기본: 정보.txt 와 같은 폴더)')
    ap.add_argument('--no-pdf', action='store_true', help='PDF 생성 생략 (reportlab 미설치 시)')
    ap.add_argument('--no-svg', action='store_true', help='SVG 생성 생략')
    args = ap.parse_args()

    memo_path = Path(args.memo).resolve()
    if not memo_path.exists():
        sys.exit(f'정보 파일 없음: {memo_path}')

    parsed = parse_memo(memo_path.read_text(encoding='utf-8'))
    items_spec = parsed['items_spec']
    order = parsed['order']

    if not items_spec and not order:
        sys.exit('정보.txt에서 패턴/주문 데이터를 추출하지 못했습니다. 형식이 변경됐나요?')

    # 아이템 선택
    if items_spec:
        if args.item >= len(items_spec):
            sys.exit(f'--item {args.item} 범위 초과 (아이템 {len(items_spec)}개)')
        item_spec = items_spec[args.item]
    else:
        # 패턴 스펙이 없으면 order.items[idx] 사용 (cotton-print 가 아닌 일반몰 주문)
        items = (order or {}).get('items', [])
        if not items:
            sys.exit('주문 데이터에 items가 없습니다.')
        item_spec = {
            'product_name': items[args.item].get('product_name', ''),
            'qty':          items[args.item].get('qty', 1),
        }

    # 템플릿 결정
    if args.template:
        template_name = args.template
    else:
        product_code = item_spec.get('product_code', '')
        product_name = item_spec.get('product_name', '')
        template_name, _overrides = resolve_template(product_code, product_name)

    print(f'📄 메모:     {memo_path}')
    print(f'📦 제품:     {item_spec.get("product_name", "-")}')
    print(f'🛠  템플릿:  {template_name}')

    if not is_supported(template_name):
        print(f'⚠ 템플릿 \'{template_name}\' 은 아직 구현되지 않았습니다.')
        print('   지원 목록:')
        for k, v in list_supported().items():
            print(f'     {k:10s} — {v}')
        sys.exit(1)

    # 원본 찾기
    artwork_path = (Path(args.artwork).resolve() if args.artwork
                    else find_artwork(memo_path, item_spec.get('artwork_filename', '')))
    print(f'🖼  원본:     {artwork_path}')

    # 템플릿별 스펙 빌드
    spec = make_template_spec(item_spec, order, artwork_path, args.item)
    if args.round > 0:
        spec['corner_radius_mm'] = args.round

    # 빌드 분기
    if template_name == 'honeycomb':
        job = build_honeycomb(spec)
    elif template_name == 'fabric':
        # fabric은 pattern_render.py 호출이 더 적합 (5 레이아웃 타일링)
        sys.exit('패브릭은 pattern_render.py 를 사용하세요 (이 스크립트는 정형 칼선용).')
    else:
        sys.exit(f'알 수 없는 템플릿: {template_name}')

    # 출력 폴더 + 파일명
    out_dir = Path(args.out_dir).resolve() if args.out_dir else memo_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    base = f"{spec['order_no']}_{template_name}"
    base = re.sub(r'[^\w\-가-힣]', '_', base)

    if not args.no_svg:
        p1 = job.to_svg(out_dir / f'{base}_print.svg', embed_images=True)
        p2 = job.to_svg(out_dir / f'{base}_cutline.svg', embed_images=False, single_layer='cutline')
        print(f'✅ SVG:      {p1}')
        print(f'✅ Cutline:  {p2}')

    if not args.no_pdf:
        try:
            p3 = job.to_pdf(out_dir / f'{base}_print.pdf')
            print(f'✅ PDF:      {p3}  (page 1: 인쇄, page 2: 컷팅)')
        except ImportError as e:
            print(f'⚠ PDF 생략: {e}')

    # 페이지 정보 안내
    print(f'\n📐 페이지:   {job.page_w:.1f} × {job.page_h:.1f} mm')
    print(f'📐 칼선:    {spec["width_mm"]:.0f} × {spec["height_mm"]:.0f} mm'
          + (f' (라운드 {spec["corner_radius_mm"]}mm)' if spec['corner_radius_mm'] > 0 else ''))


if __name__ == '__main__':
    main()
