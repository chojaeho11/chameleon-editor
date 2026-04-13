-- 안전거래 수동 송금용 필드
-- profiles: 판매자 계좌 정보
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_holder text;

-- community_safe_transactions: 수령 확인 + 송금 처리 필드
ALTER TABLE community_safe_transactions ADD COLUMN IF NOT EXISTS received_confirmed_at timestamptz; -- 구매자 수령 확인 시점
ALTER TABLE community_safe_transactions ADD COLUMN IF NOT EXISTS payout_sent_at timestamptz;       -- 관리자 송금 완료 시점
ALTER TABLE community_safe_transactions ADD COLUMN IF NOT EXISTS payout_memo text;                 -- 송금 메모 (은행 계좌 caching / 관리자 비고)
ALTER TABLE community_safe_transactions ADD COLUMN IF NOT EXISTS seller_payout_amount integer;    -- 판매자 수령액 (fee 공제 후)

-- status 값: pending_payment → paid → received (구매자 확인) → settled (관리자 송금완료)
