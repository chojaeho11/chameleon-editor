-- 2026-06-18: JP 후리가나 + 영수증 이메일 컬럼 추가
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS name_furigana TEXT,
    ADD COLUMN IF NOT EXISTS receipt_email TEXT,
    ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;

-- receipt_email 이 있는 주문만 빠르게 조회할 인덱스 (사후 발송/재발송 관리용)
CREATE INDEX IF NOT EXISTS idx_orders_receipt_email
    ON orders (receipt_email)
    WHERE receipt_email IS NOT NULL;
