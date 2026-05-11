"""
허니콤보드 / 종이가벽 / 배너 — 정형 사이즈 인쇄 데이터 생성
==========================================================
모두 직사각형(또는 라운드 코너) 칼선 + 코너 크롭마크 + 정보 라벨로 동일하게 처리.

입력:
  spec = {
      'width_mm':     1000,           # 가벽/배너 가로
      'height_mm':    2000,           # 가벽/배너 세로
      'artwork_path': './design.png', # 원본 디자인
      'corner_radius_mm': 0,          # 0 = 직각, >0 = 라운드
      'has_vcut':     False,           # 가벽 V홈 필요 시 True (옵션)
      'order_no':     '2826',
      'customer':     '조재호',
      'product':      '허니콤 가벽 DW1',
      'qty':          1,
      'date':         '2026-05-11',
  }

출력:
  PrintJob 인스턴스 — to_svg() / to_pdf() 호출 가능
"""

from pathlib import Path
from typing import Optional

from ..common import (
    PrintJob,
    MarkStyle,
    add_corner_crop_marks,
    add_corner_registration_marks,
    add_job_info_label,
)


def build_honeycomb(spec: dict, style: Optional[MarkStyle] = None) -> PrintJob:
    s = style or MarkStyle()

    w = float(spec['width_mm'])
    h = float(spec['height_mm'])
    bleed = s.bleed_mm
    r = float(spec.get('corner_radius_mm', 0))

    # 페이지 = 칼선 + 도련(블리드) + 마크 여유 공간
    margin_for_marks = max(s.crop_gap_mm + s.crop_length_mm, 10) + 5  # 모서리 마크 + 라벨용
    page_w = w + 2 * (bleed + margin_for_marks)
    page_h = h + 2 * (bleed + margin_for_marks)

    name = f"{spec.get('order_no','?')}_{spec.get('product','honeycomb')}_{int(w)}x{int(h)}"
    job = PrintJob(page_w, page_h, name=name)
    job.meta = {
        'order_no': spec.get('order_no', ''),
        'customer': spec.get('customer', ''),
        'product':  spec.get('product', ''),
        'size':     f"{int(w)}x{int(h)}mm",
        'qty':      spec.get('qty', 1),
        'date':     spec.get('date', ''),
        'template': 'honeycomb',
    }

    # 좌상단 기준 칼선 시작 위치
    cut_x = bleed + margin_for_marks
    cut_y = bleed + margin_for_marks

    # ─── 아트워크 (블리드 포함, 칼선보다 bleed_mm 만큼 외곽으로 확장) ───
    art = spec.get('artwork_path')
    if art and Path(art).exists():
        job.add_image(
            'artwork', art,
            cut_x - bleed, cut_y - bleed,
            w + 2 * bleed, h + 2 * bleed
        )

    # ─── 칼선 (마젠타, 라운드 옵션) ───
    if r > 0:
        # 라운드 사각형
        job.add_rect(
            'cutline',
            cut_x, cut_y, w, h,
            stroke_color=s.cutline_color, stroke_width=s.crop_stroke_mm,
            rx=r
        )
    else:
        job.add_rect(
            'cutline',
            cut_x, cut_y, w, h,
            stroke_color=s.cutline_color, stroke_width=s.crop_stroke_mm
        )

    # ─── V-Cut (옵션) — 가벽의 접힘선 등 ───
    if spec.get('has_vcut'):
        vcuts = spec.get('vcut_lines', [])  # [(x1,y1,x2,y2), ...] (mm, 칼선 영역 기준 상대좌표)
        for (vx1, vy1, vx2, vy2) in vcuts:
            job.add_line(
                'vcut',
                cut_x + vx1, cut_y + vy1, cut_x + vx2, cut_y + vy2,
                stroke_color=s.vcut_color, stroke_width=s.crop_stroke_mm
            )

    # ─── 돔보(코너 크롭마크) ───
    add_corner_crop_marks(job, cut_x, cut_y, w, h, style=s)

    # ─── 레지스트레이션 마크 (옵션 — 다색 인쇄 시 유용) ───
    if spec.get('with_registration_marks', True):
        add_corner_registration_marks(job, page_w, page_h, style=s, margin_mm=margin_for_marks - 5)

    # ─── 정보 라벨 (페이지 하단 중앙, 칼선 바깥) ───
    label_y = cut_y + h + s.crop_gap_mm + s.crop_length_mm + s.label_height_mm + 1
    if label_y < page_h - 2:
        add_job_info_label(
            job,
            page_w / 2, label_y,
            job.meta,
            style=s, align='center'
        )

    return job
