"""
PrintJob — 레이어별 객체 컨테이너 + SVG/PDF 출력
================================================================
구조:
  layers = {
    'artwork':  [ ... ]   # 고객 디자인 / 패턴 (이미지)
    'cutline':  [ ... ]   # 컷팅 머신용 외곽선 (마젠타)
    'vcut':     [ ... ]   # V-cut 라인 (시안, 옵션)
    'marks':    [ ... ]   # 돔보 / 레지스트레이션 / 라벨 (검정)
  }

각 요소는 (kind, *args) 튜플. kind ∈ {'image','rect','line','circle','path','text'}

출력:
- to_svg(path)  — Illustrator/Inkscape에서 레이어 그대로 열림 (inkscape:groupmode=layer)
- to_pdf(path)  — 2페이지 PDF: page 1 (인쇄용 = artwork + marks), page 2 (칼선용 = cutline + vcut + marks)
                  단일 페이지 옵션 (single_page=True)도 있음.

의존성:
- 표준 라이브러리만으로 SVG 생성 (외부 라이브러리 없음 — 더 단순)
- PDF는 reportlab 필요
"""

from typing import List, Tuple, Any, Optional
from pathlib import Path
import html
import base64


# ─────────────────────────────────────────────────────────────
# 단위 변환
# ─────────────────────────────────────────────────────────────
MM_PER_INCH = 25.4
PT_PER_INCH = 72.0
def mm_to_pt(mm: float) -> float:  return mm * PT_PER_INCH / MM_PER_INCH
def mm_to_px96(mm: float) -> float: return mm * 96 / MM_PER_INCH


# ─────────────────────────────────────────────────────────────
# PrintJob
# ─────────────────────────────────────────────────────────────
LAYER_ORDER = ['artwork', 'cutline', 'vcut', 'marks']  # 그릴 순서 (artwork 가장 아래)

class PrintJob:
    def __init__(self, page_w_mm: float, page_h_mm: float, name: str = 'print_job'):
        self.page_w = float(page_w_mm)
        self.page_h = float(page_h_mm)
        self.name = name
        self.layers: dict = {k: [] for k in LAYER_ORDER}
        self.meta: dict = {}   # 정보 메타 (order_no, customer 등) — 출력 시 라벨 자동 그릴 때 사용

    # 요소 추가 ─────────────────────────────────────────────
    def add_image(self, layer: str, image_path: str, x: float, y: float, w: float, h: float):
        self.layers[layer].append(('image', str(image_path), x, y, w, h))

    def add_rect(self, layer: str, x: float, y: float, w: float, h: float,
                 stroke_color: Optional[str] = '#000000', stroke_width: float = 0.3,
                 fill: Optional[str] = None, rx: float = 0):
        self.layers[layer].append(('rect', x, y, w, h, stroke_color, stroke_width, fill, rx))

    def add_line(self, layer: str, x1: float, y1: float, x2: float, y2: float,
                 stroke_color: str = '#000000', stroke_width: float = 0.3):
        self.layers[layer].append(('line', x1, y1, x2, y2, stroke_color, stroke_width))

    def add_circle(self, layer: str, cx: float, cy: float, r: float,
                   stroke_color: Optional[str] = '#000000', stroke_width: float = 0.3,
                   fill: Optional[str] = None):
        self.layers[layer].append(('circle', cx, cy, r, stroke_color, stroke_width, fill))

    def add_path(self, layer: str, d: str,
                 stroke_color: Optional[str] = '#000000', stroke_width: float = 0.3,
                 fill: Optional[str] = None):
        self.layers[layer].append(('path', d, stroke_color, stroke_width, fill))

    def add_text(self, layer: str, text: str, x: float, y: float,
                 size_mm: float = 3.0, color: str = '#000000', align: str = 'left',
                 weight: str = 'normal'):
        self.layers[layer].append(('text', str(text), x, y, size_mm, color, align, weight))

    # ──────────────────────────────────────────────────────
    # SVG 출력 (Illustrator 호환 — Inkscape namespace 사용해 레이어 인식됨)
    # ──────────────────────────────────────────────────────
    def to_svg(self, output_path, embed_images: bool = True, single_layer: Optional[str] = None):
        """single_layer='cutline' 같이 주면 그 레이어만 (커팅머신용)."""
        out = Path(output_path)
        w_px = mm_to_px96(self.page_w)
        h_px = mm_to_px96(self.page_h)

        lines = []
        lines.append('<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
        lines.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" '
            f'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd" '
            f'width="{self.page_w}mm" height="{self.page_h}mm" '
            f'viewBox="0 0 {self.page_w} {self.page_h}" '
            f'version="1.1">'
        )
        # 메타데이터
        lines.append(f'<title>{html.escape(self.name)}</title>')
        if self.meta:
            lines.append(f'<desc>{html.escape(str(self.meta))}</desc>')

        # 레이어 출력 (아래부터 위 순서)
        layers_to_draw = [single_layer] if single_layer else LAYER_ORDER
        for layer_name in layers_to_draw:
            items = self.layers.get(layer_name, [])
            if not items and layer_name != 'artwork':
                continue
            lines.append(
                f'<g id="{layer_name}" '
                f'inkscape:groupmode="layer" '
                f'inkscape:label="{layer_name}">'
            )
            for it in items:
                lines.append(self._svg_element(it, embed_images))
            lines.append('</g>')
        lines.append('</svg>')
        out.write_text('\n'.join(lines), encoding='utf-8')
        return out

    def _svg_element(self, it: tuple, embed_images: bool) -> str:
        kind = it[0]
        if kind == 'image':
            _, src, x, y, w, h = it
            href = self._image_href(src, embed_images)
            return f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="none" xlink:href="{href}"/>'
        if kind == 'rect':
            _, x, y, w, h, sc, sw, fill, rx = it
            attrs = f'x="{x}" y="{y}" width="{w}" height="{h}"'
            if rx: attrs += f' rx="{rx}" ry="{rx}"'
            attrs += f' fill="{fill or "none"}"'
            if sc: attrs += f' stroke="{sc}" stroke-width="{sw}"'
            return f'<rect {attrs}/>'
        if kind == 'line':
            _, x1, y1, x2, y2, sc, sw = it
            return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{sc}" stroke-width="{sw}" stroke-linecap="square"/>'
        if kind == 'circle':
            _, cx, cy, r, sc, sw, fill = it
            attrs = f'cx="{cx}" cy="{cy}" r="{r}" fill="{fill or "none"}"'
            if sc: attrs += f' stroke="{sc}" stroke-width="{sw}"'
            return f'<circle {attrs}/>'
        if kind == 'path':
            _, d, sc, sw, fill = it
            attrs = f'd="{d}" fill="{fill or "none"}"'
            if sc: attrs += f' stroke="{sc}" stroke-width="{sw}"'
            return f'<path {attrs}/>'
        if kind == 'text':
            _, text, x, y, size_mm, color, align, weight = it
            ta = {'left': 'start', 'center': 'middle', 'right': 'end'}.get(align, 'start')
            return (f'<text x="{x}" y="{y}" font-size="{size_mm}" fill="{color}" '
                    f'text-anchor="{ta}" font-weight="{weight}" '
                    f'font-family="sans-serif">{html.escape(text)}</text>')
        return ''

    @staticmethod
    def _image_href(src: str, embed: bool) -> str:
        if not embed: return str(src).replace('"', '%22')
        # base64로 임베드 (단일 파일로 휴대성 ↑)
        p = Path(src)
        if not p.exists(): return str(src)
        ext = p.suffix.lower().lstrip('.')
        mime = {'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','svg':'image/svg+xml'}.get(ext, 'image/png')
        data = base64.b64encode(p.read_bytes()).decode('ascii')
        return f'data:{mime};base64,{data}'

    # ──────────────────────────────────────────────────────
    # PDF 출력 (reportlab) — 2 페이지: print(artwork+marks), cut(cutline+vcut+marks)
    # ──────────────────────────────────────────────────────
    def to_pdf(self, output_path, single_page: bool = False):
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.colors import HexColor
        except ImportError as e:
            raise ImportError("PDF 출력에는 reportlab이 필요합니다.  pip install reportlab") from e

        page_w_pt = mm_to_pt(self.page_w)
        page_h_pt = mm_to_pt(self.page_h)
        c = canvas.Canvas(str(output_path), pagesize=(page_w_pt, page_h_pt))
        c.setTitle(self.name)

        if single_page:
            # 하나의 페이지에 모든 레이어
            for layer_name in LAYER_ORDER:
                for it in self.layers.get(layer_name, []):
                    self._pdf_draw(c, it, HexColor)
            c.showPage()
        else:
            # 페이지 1: 인쇄용 (아트워크 + 마크) — 칼선/Vcut 제외
            for layer_name in ['artwork', 'marks']:
                for it in self.layers.get(layer_name, []):
                    self._pdf_draw(c, it, HexColor)
            c.showPage()
            # 페이지 2: 컷팅용 (칼선 + Vcut + 마크)
            for layer_name in ['cutline', 'vcut', 'marks']:
                for it in self.layers.get(layer_name, []):
                    self._pdf_draw(c, it, HexColor)
            c.showPage()

        c.save()
        return Path(output_path)

    def _pdf_draw(self, c, it, HexColor):
        """reportlab은 좌하단(0,0). 우리는 좌상단(0,0)이라 y 반전."""
        H = mm_to_pt(self.page_h)
        kind = it[0]
        # 좌상단 mm → 좌하단 pt 변환 함수
        def yconv(y_mm): return H - mm_to_pt(y_mm)
        def xconv(x_mm): return mm_to_pt(x_mm)
        def lconv(l_mm): return mm_to_pt(l_mm)

        if kind == 'image':
            _, src, x, y, w, h = it
            try:
                # reportlab은 이미지 origin이 좌하단이므로 y' = H - (y + h)
                c.drawImage(str(src), xconv(x), H - mm_to_pt(y + h), lconv(w), lconv(h), mask='auto')
            except Exception as e:
                print(f'[pdf draw image fail] {src}: {e}')
        elif kind == 'rect':
            _, x, y, w, h, sc, sw, fill, rx = it
            if sc: c.setStrokeColor(HexColor(sc)); c.setLineWidth(lconv(sw))
            if fill: c.setFillColor(HexColor(fill))
            c.rect(xconv(x), H - mm_to_pt(y + h), lconv(w), lconv(h),
                   stroke=1 if sc else 0, fill=1 if fill else 0)
        elif kind == 'line':
            _, x1, y1, x2, y2, sc, sw = it
            c.setStrokeColor(HexColor(sc)); c.setLineWidth(lconv(sw))
            c.line(xconv(x1), yconv(y1), xconv(x2), yconv(y2))
        elif kind == 'circle':
            _, cx, cy, r, sc, sw, fill = it
            if sc: c.setStrokeColor(HexColor(sc)); c.setLineWidth(lconv(sw))
            if fill: c.setFillColor(HexColor(fill))
            c.circle(xconv(cx), yconv(cy), lconv(r),
                     stroke=1 if sc else 0, fill=1 if fill else 0)
        elif kind == 'path':
            _, d, sc, sw, fill = it
            # 간단한 path만 지원 (M, L, A, Z). 복잡한 path는 SVG로만.
            if sc: c.setStrokeColor(HexColor(sc)); c.setLineWidth(lconv(sw))
            self._pdf_path(c, d, yconv, xconv, lconv, stroke=bool(sc), fill=bool(fill))
        elif kind == 'text':
            _, text, x, y, size_mm, color, align, weight = it
            c.setFillColor(HexColor(color))
            c.setFont('Helvetica' if weight == 'normal' else 'Helvetica-Bold', lconv(size_mm))
            if align == 'center':
                c.drawCentredString(xconv(x), yconv(y), text)
            elif align == 'right':
                c.drawRightString(xconv(x), yconv(y), text)
            else:
                c.drawString(xconv(x), yconv(y), text)

    def _pdf_path(self, c, d: str, yconv, xconv, lconv, stroke=True, fill=False):
        """SVG path를 reportlab path로 — M/L/Z만 지원 (단순)"""
        import re
        p = c.beginPath()
        # 간단 파서: 명령 + 숫자들
        tokens = re.findall(r'[MLZmlz]|-?\d+(?:\.\d+)?', d)
        i = 0
        while i < len(tokens):
            t = tokens[i]
            if t in 'Mm':
                x, y = float(tokens[i+1]), float(tokens[i+2])
                p.moveTo(xconv(x), yconv(y))
                i += 3
            elif t in 'Ll':
                x, y = float(tokens[i+1]), float(tokens[i+2])
                p.lineTo(xconv(x), yconv(y))
                i += 3
            elif t in 'Zz':
                p.close()
                i += 1
            else:
                i += 1
        c.drawPath(p, stroke=1 if stroke else 0, fill=1 if fill else 0)
