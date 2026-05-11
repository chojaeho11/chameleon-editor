"""
제품 코드 → 인쇄 템플릿 매핑
==============================
admin_products.code / admin_products.category / orders.items[].product_code
를 기반으로 어떤 template을 쓸지 결정.

새 제품 추가 시:
  1. 아래 TEMPLATES dict에 매핑 추가
  2. 또는 admin_products 테이블의 print_template 컬럼에서 직접 지정 (향후 확장)
"""

# 카테고리 → 템플릿 함수 매핑
#   값은 (template_name, default_spec_overrides)
#   spec_overrides는 모든 주문에 공통 적용되는 기본값
PATTERN_HINT_TO_TEMPLATE = {
    # 허니콤보드 가벽 (4종) — 정확한 코드는 admin_products에서 확인 필요
    # 임시 매핑: hb_dw* 패턴 모두 honeycomb 템플릿
    'hb_':           ('honeycomb', {'corner_radius_mm': 0}),
    'honeycomb_':    ('honeycomb', {'corner_radius_mm': 0}),
    'paper_wall':    ('honeycomb', {'corner_radius_mm': 0}),
    'paperwall':     ('honeycomb', {'corner_radius_mm': 0}),
    '종이가벽':       ('honeycomb', {'corner_radius_mm': 0}),
    '가벽':          ('honeycomb', {'corner_radius_mm': 0}),

    # 배너 — 자유 사이즈, 라운드 코너 일반적
    'banner_':       ('honeycomb', {'corner_radius_mm': 0}),  # 배너도 정형 사각이라 honeycomb 재사용
    '배너':          ('honeycomb', {'corner_radius_mm': 0}),

    # 패브릭 (cotton-print) — 별도 처리, pattern_render.py가 담당
    'cotton':        ('fabric', {}),
    'fabric':        ('fabric', {}),
}


def resolve_template(product_code: str = '', product_name: str = '', category: str = '') -> tuple:
    """
    (template_name, default_overrides) 반환.
    매핑 못 찾으면 ('unknown', {}).

    매칭 우선순위:
      1. product_code 시작 패턴 (예: 'hb_dw1' → 'hb_')
      2. category 시작 패턴
      3. product_name 부분 일치 (한글 가능)
    """
    haystack = [
        (product_code or '').lower(),
        (category or '').lower(),
        (product_name or '').lower(),
    ]
    for needle, val in PATTERN_HINT_TO_TEMPLATE.items():
        for h in haystack:
            if h and needle.lower() in h:
                return val
    return ('unknown', {})


def is_supported(template_name: str) -> bool:
    """현재 지원되는 템플릿인지 (개발 진행 상황)."""
    return template_name in ('honeycomb', 'fabric')


# CLI 도움말용
def list_supported() -> dict:
    return {
        'honeycomb': '허니콤보드 가벽 · 종이가벽 · 배너 — 정형 사각/라운드 칼선 + 코너 크롭마크',
        'fabric':    '패브릭 패턴 인쇄 — pattern_render.py 사용 (5 레이아웃 타일링)',
        'keyring':   '(미구현) 키링/등신대 — 이미지 외곽 트레이싱 → 매끄러운 칼선',
        'banner':    '(honeycomb로 통합) 배너',
    }
