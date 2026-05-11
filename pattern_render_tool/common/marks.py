"""
인쇄용 마크 공용 함수 — 돔보(코너 크롭) / 레지스트레이션 마크 / 정보 라벨
==============================================================
모든 좌표/길이 단위는 mm. 좌상단(0,0) 기준, x→오른쪽, y→아래.

PrintJob 인스턴스(layers.py)에 add_path / add_rect / add_text 로 그려넣음.
PrintJob을 직접 임포트하지 않고 builder 객체에 .add_* 메서드만 있으면 됨 (duck-typing).
"""
from dataclasses import dataclass


# ─────────────────────────────────────────────────────────────
# 스타일 기본값
# ─────────────────────────────────────────────────────────────
@dataclass
class MarkStyle:
    bleed_mm: float = 3.0        # 칼선 바깥 도련 (인쇄 영역이 칼선보다 얼마나 더 큰지)
    crop_length_mm: float = 5.0  # 코너 크롭마크 길이
    crop_gap_mm: float = 1.5     # 칼선과 크롭마크 사이 간격
    crop_stroke_mm: float = 0.25 # 마크 선 두께
    reg_size_mm: float = 4.0     # +자 레지스트레이션 마크 크기
    reg_stroke_mm: float = 0.2
    label_height_mm: float = 4.0 # 정보 라벨 글자 크기 (대략 = 점수)
    cutline_color: str = "#FF00FF"   # 마젠타 — 일러스트레이터에서 "Cut" 스팟컬러로 흔히 쓰임
    vcut_color: str = "#00FFFF"      # 시안 — "V-Cut" 스팟컬러
    mark_color: str = "#000000"      # 검정
    label_color: str = "#666666"


# ─────────────────────────────────────────────────────────────
# 1) 코너 크롭마크 (돔보) — 아트워크 네 모서리 바깥쪽에 짧은 선 8개
#    구조: 각 코너에 가로 1개 + 세로 1개 (총 4×2 = 8개)
#    위치: 칼선에서 crop_gap_mm 밖으로, crop_length_mm 길이
# ─────────────────────────────────────────────────────────────
def add_corner_crop_marks(builder, cut_x_mm, cut_y_mm, cut_w_mm, cut_h_mm, style=None):
    """builder = PrintJob 같은 .add_path 가능한 객체. layer='marks'에 그림."""
    s = style or MarkStyle()
    g = s.crop_gap_mm
    L = s.crop_length_mm
    sw = s.crop_stroke_mm
    color = s.mark_color

    x1, y1 = cut_x_mm,            cut_y_mm
    x2, y2 = cut_x_mm + cut_w_mm, cut_y_mm + cut_h_mm

    # 코너별 (가로 + 세로) 8개
    segs = [
        # 좌상단
        ((x1 - g - L, y1),       (x1 - g, y1)),       # 가로
        ((x1,         y1 - g - L), (x1,   y1 - g)),   # 세로
        # 우상단
        ((x2 + g,     y1),       (x2 + g + L, y1)),
        ((x2,         y1 - g - L), (x2,   y1 - g)),
        # 좌하단
        ((x1 - g - L, y2),       (x1 - g, y2)),
        ((x1,         y2 + g),   (x1,   y2 + g + L)),
        # 우하단
        ((x2 + g,     y2),       (x2 + g + L, y2)),
        ((x2,         y2 + g),   (x2,   y2 + g + L)),
    ]
    for (sx, sy), (ex, ey) in segs:
        builder.add_line('marks', sx, sy, ex, ey, stroke_color=color, stroke_width=sw)


# ─────────────────────────────────────────────────────────────
# 2) 사이드 크롭마크 (가운데 위/아래/좌/우) — 옵션
#    Adobe Illustrator의 기본 트림마크에 포함되는 4개의 중간 마크.
#    스크린프린트나 다색 인쇄에서 사이드 정렬 보조.
# ─────────────────────────────────────────────────────────────
def add_side_crop_marks(builder, cut_x_mm, cut_y_mm, cut_w_mm, cut_h_mm, style=None):
    s = style or MarkStyle()
    g, L, sw, c = s.crop_gap_mm, s.crop_length_mm, s.crop_stroke_mm, s.mark_color
    mx = cut_x_mm + cut_w_mm / 2
    my = cut_y_mm + cut_h_mm / 2

    segs = [
        # 위/아래 중심에 세로선
        ((mx, cut_y_mm - g - L), (mx, cut_y_mm - g)),
        ((mx, cut_y_mm + cut_h_mm + g), (mx, cut_y_mm + cut_h_mm + g + L)),
        # 좌/우 중심에 가로선
        ((cut_x_mm - g - L, my), (cut_x_mm - g, my)),
        ((cut_x_mm + cut_w_mm + g, my), (cut_x_mm + cut_w_mm + g + L, my)),
    ]
    for (sx, sy), (ex, ey) in segs:
        builder.add_line('marks', sx, sy, ex, ey, stroke_color=c, stroke_width=sw)


# ─────────────────────────────────────────────────────────────
# 3) 레지스트레이션 마크 (+ 모양) — 색상 정합용
#    인쇄기에서 CMYK 4색 정렬 확인. 네 모서리 + 옵션으로 중앙.
# ─────────────────────────────────────────────────────────────
def add_registration_mark(builder, cx_mm, cy_mm, style=None, color=None):
    s = style or MarkStyle()
    r = s.reg_size_mm / 2
    sw = s.reg_stroke_mm
    c = color or s.mark_color
    # 십자
    builder.add_line('marks', cx_mm - r, cy_mm, cx_mm + r, cy_mm, stroke_color=c, stroke_width=sw)
    builder.add_line('marks', cx_mm, cy_mm - r, cx_mm, cy_mm + r, stroke_color=c, stroke_width=sw)
    # 외곽 원 (registration target)
    builder.add_circle('marks', cx_mm, cy_mm, r * 0.7, stroke_color=c, stroke_width=sw, fill=None)


def add_corner_registration_marks(builder, page_w_mm, page_h_mm, style=None, margin_mm=8):
    """페이지 네 모서리에 +자 레지스트레이션 마크 (인쇄팀 정합 확인용)"""
    s = style or MarkStyle()
    m = margin_mm
    positions = [
        (m, m),
        (page_w_mm - m, m),
        (m, page_h_mm - m),
        (page_w_mm - m, page_h_mm - m),
    ]
    for (cx, cy) in positions:
        add_registration_mark(builder, cx, cy, style=s)


# ─────────────────────────────────────────────────────────────
# 4) 정보 라벨 — 주문번호 / 고객명 / 사이즈 / 제품 / 날짜
#    종이 모서리 바깥쪽 빈 공간(블리드 영역)에 표시. 재단 후 잘려나가는 곳이 일반적.
# ─────────────────────────────────────────────────────────────
def add_job_info_label(builder, x_mm, y_mm, info_dict, style=None, align='left'):
    """info_dict 예시:
        { 'order_no': '2826', 'customer': '조재호', 'size': '130x100cm',
          'product': '면20수 평직', 'date': '2026-05-11', 'qty': 1 }
    """
    s = style or MarkStyle()
    h = s.label_height_mm
    parts = []
    if 'order_no'  in info_dict: parts.append(f"#{info_dict['order_no']}")
    if 'customer'  in info_dict: parts.append(info_dict['customer'])
    if 'product'   in info_dict: parts.append(info_dict['product'])
    if 'size'      in info_dict: parts.append(info_dict['size'])
    if 'qty'       in info_dict: parts.append(f"qty {info_dict['qty']}")
    if 'date'      in info_dict: parts.append(info_dict['date'])
    text = '  ·  '.join(str(p) for p in parts)
    builder.add_text('marks', text, x_mm, y_mm, size_mm=h, color=s.label_color, align=align)
