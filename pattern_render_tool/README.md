# 패턴 재조합 도구

cotton-print 주문 시 작가의 **원본 이미지 1장 + 패턴 메타데이터**만 저장하고, 인쇄 시점에 원하는 해상도로 합성하기 위한 데스크탑 스크립트.

## 왜 이렇게 하나?

- 미리보기 캔버스(800×660 px)를 그대로 PNG로 저장하면 **130cm 원단 인쇄에 해상도가 부족**합니다.
- 매번 4000~6000 px 패턴 PNG를 저장하면 **용량/업로드 시간**이 부담됩니다.
- 원본 PNG ~1MB + JSON 메타 ~500B로 분리해두면, **언제든 8000 px 이상도 재합성**할 수 있습니다.

## 흐름

```
주문 ─▶ cotton-print 사이트(원본 1장 + pattern_spec 저장)
        │
        ▼
   Supabase orders 테이블
        │
        ▼ (Edge Function 'sync-order-to-drive')
   Google Drive(다크팩토리)
   └─ 고객주문/5월11일_조재호/
        ├─ CT_2826_조재호_01.png       ← 작가 원본
        └─ CT_2826_조재호_정보.txt     ← 메모 + [PATTERN_RENDER_SPEC] JSON
                │
                ▼  (이 폴더를 로컬로 다운로드)
        python pattern_render.py 5월11일_조재호/CT_2826_조재호_정보.txt --dpi 60
                │
                ▼
        CT_2826_조재호_pattern.png  ← 인쇄용 고해상도
```

## 설치

```bash
pip install Pillow
```

## 사용법

```bash
# 기본 (60 DPI, 130×100cm 원단 → 약 3071×2362 px)
python pattern_render.py CT_2826_조재호_정보.txt

# 인쇄 품질 (120 DPI → 약 6142×4724 px)
python pattern_render.py CT_2826_조재호_정보.txt --dpi 120

# 출력 파일명 지정
python pattern_render.py 정보.txt --out final.png

# 주문에 여러 아이템이 있을 때 두 번째
python pattern_render.py 정보.txt --item 1

# 원본 이미지를 직접 지정 (자동 탐지가 안 될 때)
python pattern_render.py 정보.txt --artwork ./원본디자인.png
```

원본 이미지는 같은 폴더에서 자동으로 찾습니다(`{baseName}_01.png` 패턴). 못 찾으면 `--artwork`로 지정하세요.

## 메모(`정보.txt`) 안의 패턴 메타 형식

```
[PATTERN_RENDER_SPEC]
# 이 JSON 블록을 pattern_render.py 가 자동 파싱해 패턴을 재합성합니다.
# Claude(또는 다른 AI)에게 '이 메모로 패턴 재조합해줘'라고 하면 본 블록만 봐도 충분합니다.
{
  "spec_version": 1,
  "items": [
    {
      "index": 0,
      "product_code": "cotton20_white",
      "product_name": "면20수 평직 (화이트)",
      "fabric": "면20수 평직 (화이트)",
      "qty": 1,
      "version": 1,
      "fabric_cm":   { "w": 130, "h": 100 },
      "cell_cm":     { "w": 10,  "h": 7.4 },
      "layout":      "halfdrop",
      "bg_color":    "#fef3c7",
      "image_scale": 1.0,
      "artwork_filename": "vif0hvz4.png",
      "artwork_url":      "https://qinvtnhiidtmrzosyvys.supabase.co/storage/v1/object/public/orders/cotton-print/orders/1733...0.png",
      "notes": "..."
    }
  ]
}
[/PATTERN_RENDER_SPEC]
```

## 레이아웃 5종

| 코드 | 설명 |
|---|---|
| `centered`  | 캔버스 중앙에 한 번만 (목업/단발 인쇄용) |
| `basic`     | 격자 반복 (가장 단순) |
| `halfdrop`  | 매 두 번째 컬럼이 세로 절반 내림 (보태니컬에 자연스러움) |
| `halfbrick` | 매 두 번째 행이 가로 절반 밂 (벽돌 쌓기) |
| `mirror`    | 좌우/상하 미러 반복 — 시밍리스 보장 |

## DPI 가이드

| DPI | 130×100cm 결과 해상도 | 용도 |
|---|---|---|
| 60  | 3071×2362 px (~5 MB)  | 일반 패브릭 인쇄 (디지털 직물 출력기 기본) |
| 100 | 5118×3937 px (~15 MB) | 의류용 고품질 |
| 150 | 7677×5905 px (~30 MB) | 최고급 / 근거리 시인용 |

DPI를 올리면 결과 PNG가 커지고 메모리 사용도 늘어납니다(150 DPI에서 약 1~2 GB RAM 권장).

## AI 도구로 재조합하기

Claude / ChatGPT 등에게 `정보.txt` 내용을 그대로 붙여넣고:

> "이 메모의 PATTERN_RENDER_SPEC을 보고 Python 코드를 만들어줘"

라고 하면, 본 도구와 동일한 결과를 얻을 수 있는 코드를 생성합니다. 메모 안에 모든 사양이 자기완결적으로 들어있기 때문입니다.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `[PATTERN_RENDER_SPEC] JSON 블록을 찾을 수 없습니다` | 2026-05-11 이전 옛 주문이거나 cotton-print가 아닌 일반 인쇄 주문. 그런 경우는 직접 원본만 사용. |
| 원본 이미지가 자동 탐지 안 됨 | `--artwork` 옵션으로 직접 경로 지정. 또는 메모와 같은 폴더에 원본 이미지를 두세요. |
| 결과가 너무 작음/픽셀 깨짐 | `--dpi` 값 올리기. 단 원본 해상도 자체가 낮으면 보간 한계. 작가에게 더 큰 원본 요청. |
| `MemoryError` | 매우 큰 DPI(200+)에서 발생. 64-bit Python + 충분한 RAM 필요. 또는 DPI를 낮추세요. |
| 배경색이 다름 | `정보.txt` 의 `bg_color`가 인쇄 시 의도와 다르면 작가에게 확인. `--bg` 같은 오버라이드는 의도적으로 두지 않음(데이터 무결성). |
