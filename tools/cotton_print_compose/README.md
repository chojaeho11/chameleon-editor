# Cotton Print — 패브릭 인쇄 데이터 자동 생성

작업지시서(orders.items.pattern_spec) + 고객 업로드 이미지를 **실제 출력 사이즈의 인쇄 데이터**로 자동 합성하는 Python 스크립트.

## 설치 (1회만)

```bash
cd tools/cotton_print_compose
pip install -r requirements.txt
```

## 사용법

### 1) 주문 ID로 자동 처리 (가장 일반적)

작업지시서 URL 의 `?id=NNN` 값을 그대로 넣으면 끝:

```bash
python compose_fabric.py --order-id 3553
```

→ `output/order3553_item1_*_130x100cm.tiff` 등이 자동 생성됨.

특정 항목만:
```bash
python compose_fabric.py --order-id 3553 --item-idx 0     # 첫 번째 항목만
```

### 2) 로컬 파일로 합성 (테스트/디버깅)

```bash
python compose_fabric.py \
    --image ./mypattern.png \
    --output-cm 130x200 \
    --cell-cm 37x37.2 \
    --layout basic \
    --bg "#ffffff" \
    --scale 100
```

## 옵션

| 옵션 | 설명 | 기본값 |
|---|---|---|
| `--order-id` | Supabase 주문 ID | - |
| `--item-idx` | 특정 항목 인덱스 (생략시 전체) | 전체 |
| `--image` | 로컬 이미지 파일 (로컬 모드) | - |
| `--output-cm` | 출력 크기 `WxH` (예: `130x100`) | - |
| `--cell-cm` | 셀 크기 `WxH` (예: `37x37.2`) | - |
| `--layout` | `basic` / `centered` / `brick` / `half_drop` / `mirror` | `basic` |
| `--bg` | 배경색 HEX 또는 `transparent` | `#ffffff` |
| `--scale` | 이미지 비율(%) | 100 |
| `--dpi` | 출력 DPI | 150 |
| `--output-dir` | 출력 폴더 | `./output` |
| `--format` | `tiff` / `png` / `jpg` | `tiff` |

## 레이아웃 설명

- **basic** — 균등 타일 (가장 일반적)
- **centered** — 단일 중앙 배치 (한 장만 인쇄)
- **brick** — 가로로 반칸 어긋난 벽돌 패턴 (행마다 X 오프셋)
- **half_drop** — 세로로 반칸 어긋난 패턴 (열마다 Y 오프셋)
- **mirror** — 거울 반복 (좌우 + 상하 반전)

## 제품 사양

- 가로 폭: **90 ~ 130cm**
- 세로 길이: **100cm 단위, 무제한**
- 권장 DPI: **150** (패브릭 디지털 프린팅 표준)
- 권장 포맷: **TIFF (LZW 압축)** — 인쇄소 표준

## 파일 크기 예상

| 출력 크기 | DPI | 픽셀 | TIFF 크기 (LZW) |
|---|---|---|---|
| 130×100cm | 150 | 7,677×5,906 | ~30MB |
| 130×500cm | 150 | 7,677×29,528 | ~150MB |
| 130×1000cm | 150 | 7,677×59,055 | ~300MB |
| 130×100cm | 300 | 15,354×11,811 | ~120MB |

## 환경변수

```bash
export SUPABASE_ANON_KEY="eyJhbGciOi..."   # 옵션 — 코드에 기본키 들어있음
```

## 흐름

```
주문 ID (3553)
    │
    ▼
[Supabase REST] orders 테이블에서 fetch
    │
    ├─ items[i].pattern_spec.cell_cm       → 셀 크기
    ├─ items[i].pattern_spec.layout        → basic / centered / ...
    ├─ items[i].pattern_spec.bg_color      → #ffffff
    ├─ items[i].pattern_spec.image_scale   → 1.0 (100%)
    ├─ items[i].width_cm / height_cm       → 출력 사이즈
    └─ items[i].artwork_url                → 다운로드할 패턴 이미지
    │
    ▼
[Pillow] 출력 사이즈 캔버스 생성 → 배경색 채우기 → 셀 크기로 리사이즈 → 레이아웃에 따라 타일
    │
    ▼
output/order3553_item1_130x100cm.tiff   (인쇄소 보낼 수 있는 최종 데이터)
```

## 예시

작업지시서가 다음과 같다면:
- 출력: 130×100cm
- 한 셀: 37×37.2cm
- 레이아웃: basic
- 배경: #ffffff
- 비율: 100%

기본값으로 그냥 실행하면 됨:
```bash
python compose_fabric.py --order-id 3553
```

## 트러블슈팅

**"artwork_url 없음" 스킵**
→ 작업지시서에 디자인 파일이 업로드 안 됨. cotton_workorder 페이지에서 「파일 첨부」 후 재실행.

**메모리 부족**
→ `--dpi 100` 으로 낮추거나 `--format jpg --quality 90` 으로 압축.

**LZW 압축 실패**
→ `--format png` 로 변경하거나 Pillow 업데이트 (`pip install -U Pillow`).
