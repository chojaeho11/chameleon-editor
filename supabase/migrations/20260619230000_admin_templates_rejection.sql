-- 2026-06-19 v689: 디자이너 자산 반려 사유 저장 컬럼.
--   admin 이 "🔄 반려" 버튼으로 디자이너에게 수정 요청 메시지(영어) 전송.
--   대표적: PNG 배경이 있어서 못 쓰는 경우 → "Please re-upload as transparent PNG."
--   디자이너 페이지(향후)에서 본인의 반려된 자산 + 사유를 보고 재제출.

ALTER TABLE admin_templates
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admin_templates_submitted_by_status
    ON admin_templates (submitted_by, status, rejected_at DESC NULLS LAST);
