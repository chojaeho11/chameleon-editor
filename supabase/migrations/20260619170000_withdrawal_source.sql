-- 2026-06-19 v659: design_withdrawal_requests 에 출처 컬럼 추가
--   기존 row 는 'legacy' (옛 마일리지/의뢰 정산 출처 — 자산 적립과 무관).
--   /contribute 에서 자산 적립금 출금 시 source='asset' 으로 INSERT.
--   디자이너 정산 카드는 source='asset' row 만 집계 → 옛 출금이 자산 적립에 영향 없음.

ALTER TABLE design_withdrawal_requests
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_design_withdrawal_requests_source_designer
    ON design_withdrawal_requests (source, designer_id, status);
