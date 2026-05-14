-- 2026-05-14: 디자인 작업 완료 플래그 추가
--
-- 배경: 고객이 결제는 먼저 하고, 실제 디자인 파일은 나중에 올리는 경우가 많음.
--   결제 직후 임시/가짜 파일이 들어오면 다크팩토리(Drive 동기화) 가 미완성 파일로
--   칼선 자동화에 들어감 → 잘못된 출력.
--
-- 해결: orders.design_complete 플래그 추가. 고객 또는 관리자가 '데이터작업완료'
--   버튼을 누르면 true 로 토글. 이 상태일 때만 다크팩토리에서 본 작업 (칼선, 출력)
--   시작.
--
-- 사용 흐름:
--   1. 주문 생성 (default false)
--   2. 결제 완료 → payment_status='결제완료'
--   3. 고객/매니저가 디자인 작업 완료 → design_complete=true, design_complete_at=now()
--   4. sync-order-to-drive 가 Drive 폴더에 '_FINAL' 마커 + 최종 파일 동기화
--   5. 칼선 자동화 (pattern_render.py / make_print_files.py) 실행 가능
--
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS design_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS design_complete_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS design_complete_by TEXT;

-- 기존 결제완료 주문은 design_complete=true 로 일괄 처리 (기존 워크플로우 보존)
-- 신규 주문부터 새 플래그 적용
UPDATE orders
SET design_complete = true, design_complete_at = COALESCE(updated_at, created_at)
WHERE design_complete IS NULL OR design_complete = false
  AND payment_status = '결제완료'
  AND created_at < NOW() - INTERVAL '1 day';

-- 인덱스 — design pending 필터 빠르게
CREATE INDEX IF NOT EXISTS idx_orders_design_complete ON orders(design_complete) WHERE design_complete = false;

-- 결과 확인
-- SELECT id, manager_name, payment_status, design_complete, design_complete_at, created_at
-- FROM orders ORDER BY created_at DESC LIMIT 30;
