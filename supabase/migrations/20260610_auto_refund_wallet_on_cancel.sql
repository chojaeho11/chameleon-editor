-- 2026-06-10: 주문 취소/삭제 시 wallet(event_coupon/mileage) 자동 복구
--
-- 문제: 사용자가 쿠폰/마일리지 사용 → 결제 안 함 → 주문 취소 → 쿠폰만 차감된 채 남음
-- 예시: order #3643 (iann@ianndesign.com) - 27,000원 쿠폰 사용 후 미결제 취소 → 자동 복구 안 됨
--
-- 해결:
--   1. wallet_logs.related_order_id 가 null 인 행들에 대해 description 에서 주문번호 추출 backfill
--   2. refund_order_wallet(order_id, user_id) 함수 — 멱등 (이미 복구된 건 스킵)
--   3. orders.status → 취소/삭제 변경 시 자동 호출하는 트리거
--   4. 이미 취소된 주문들에 대해 1회성 backfill 실행

------------------------------------------------------------
-- 1) wallet_logs.related_order_id backfill (description 파싱)
------------------------------------------------------------
UPDATE public.wallet_logs
SET related_order_id = ((regexp_match(description, '주문번호:?\s*(\d+)'))[1])::int
WHERE related_order_id IS NULL
  AND description ~ '주문번호:?\s*\d+';

------------------------------------------------------------
-- 2) refund_order_wallet — 핵심 환불 함수 (멱등)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_order_wallet(p_order_id BIGINT, p_user_id UUID)
RETURNS TABLE(refunded_coupon INT, refunded_mileage INT, refunded_deposit INT) AS $$
DECLARE
  v_coupon_used INT;
  v_mileage_used INT;
  v_deposit_used INT;
BEGIN
  -- 이미 복구 처리된 주문이면 스킵 (멱등성)
  IF EXISTS (
    SELECT 1 FROM public.wallet_logs
    WHERE related_order_id = p_order_id
      AND type IN ('event_coupon_restore', 'mileage_restore', 'deposit_restore')
  ) THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- 이 주문에서 차감된 wallet 합계 조회 (type별)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_coupon_used
  FROM public.wallet_logs
  WHERE user_id = p_user_id
    AND type = 'event_coupon_use'
    AND amount < 0
    AND related_order_id = p_order_id;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_mileage_used
  FROM public.wallet_logs
  WHERE user_id = p_user_id
    AND type IN ('usage_purchase', 'mileage_use')
    AND amount < 0
    AND related_order_id = p_order_id;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_deposit_used
  FROM public.wallet_logs
  WHERE user_id = p_user_id
    AND type IN ('deposit_use', 'usage_deposit')
    AND amount < 0
    AND related_order_id = p_order_id;

  -- 이벤트 쿠폰 복구
  IF v_coupon_used > 0 THEN
    UPDATE public.profiles
    SET event_coupon = COALESCE(event_coupon, 0) + v_coupon_used
    WHERE id = p_user_id;
    INSERT INTO public.wallet_logs (user_id, type, amount, description, related_order_id)
    VALUES (p_user_id, 'event_coupon_restore', v_coupon_used,
            '주문 #' || p_order_id || ' 취소 자동 복구', p_order_id);
  END IF;

  -- 마일리지 복구
  IF v_mileage_used > 0 THEN
    UPDATE public.profiles
    SET mileage = COALESCE(mileage, 0) + v_mileage_used
    WHERE id = p_user_id;
    INSERT INTO public.wallet_logs (user_id, type, amount, description, related_order_id)
    VALUES (p_user_id, 'mileage_restore', v_mileage_used,
            '주문 #' || p_order_id || ' 취소 자동 복구', p_order_id);
  END IF;

  -- 예치금 복구 (deposit 컬럼이 있다면)
  IF v_deposit_used > 0 THEN
    BEGIN
      UPDATE public.profiles
      SET deposit = COALESCE(deposit, 0) + v_deposit_used
      WHERE id = p_user_id;
      INSERT INTO public.wallet_logs (user_id, type, amount, description, related_order_id)
      VALUES (p_user_id, 'deposit_restore', v_deposit_used,
              '주문 #' || p_order_id || ' 취소 자동 복구', p_order_id);
    EXCEPTION WHEN undefined_column THEN
      -- deposit 컬럼 미존재 환경 — 마일리지로 폴백
      UPDATE public.profiles
      SET mileage = COALESCE(mileage, 0) + v_deposit_used
      WHERE id = p_user_id;
      INSERT INTO public.wallet_logs (user_id, type, amount, description, related_order_id)
      VALUES (p_user_id, 'mileage_restore', v_deposit_used,
              '주문 #' || p_order_id || ' 취소 자동 복구 (deposit→mileage)', p_order_id);
    END;
  END IF;

  RETURN QUERY SELECT v_coupon_used, v_mileage_used, v_deposit_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

------------------------------------------------------------
-- 3) 트리거 함수 + 트리거 — status 변경 시 자동 호출
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_wallet_on_order_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- 취소/삭제 상태로 진입할 때만 (이미 그 상태면 skip)
  IF NEW.status IN ('취소됨', '삭제됨', '취소', '관리자차단')
     AND COALESCE(OLD.status, '') NOT IN ('취소됨', '삭제됨', '취소', '관리자차단')
     AND NEW.user_id IS NOT NULL THEN
    PERFORM public.refund_order_wallet(NEW.id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

DROP TRIGGER IF EXISTS trg_refund_wallet_on_cancel ON public.orders;
CREATE TRIGGER trg_refund_wallet_on_cancel
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.refund_wallet_on_order_cancel();

------------------------------------------------------------
-- 4) 1회성 backfill — 이미 취소/삭제 상태인 주문 환불 처리
--    멱등 (refund_order_wallet 안에서 중복 처리 방지)
------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_result RECORD;
  v_total_orders INT := 0;
  v_total_refund_coupon BIGINT := 0;
  v_total_refund_mileage BIGINT := 0;
BEGIN
  FOR r IN
    SELECT id, user_id
    FROM public.orders
    WHERE status IN ('취소됨', '삭제됨', '취소', '관리자차단')
      AND user_id IS NOT NULL
    ORDER BY id
  LOOP
    SELECT * INTO v_result FROM public.refund_order_wallet(r.id, r.user_id);
    IF v_result.refunded_coupon > 0 OR v_result.refunded_mileage > 0 THEN
      v_total_orders := v_total_orders + 1;
      v_total_refund_coupon := v_total_refund_coupon + v_result.refunded_coupon;
      v_total_refund_mileage := v_total_refund_mileage + v_result.refunded_mileage;
      RAISE NOTICE 'Order #% restored: coupon=%, mileage=%',
                   r.id, v_result.refunded_coupon, v_result.refunded_mileage;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Backfill complete: % orders restored, total coupon=%, total mileage=% ===',
               v_total_orders, v_total_refund_coupon, v_total_refund_mileage;
END $$;

------------------------------------------------------------
-- 5) 검증 쿼리 (실행 후 결과 확인용)
------------------------------------------------------------
-- iann 의 현재 잔액 확인
-- SELECT email, event_coupon, mileage FROM public.profiles
-- WHERE id = '65b0dd3c-78f8-4c61-a3dd-31892c84dc38';

-- 주문 #3643 에 대한 wallet_logs 이력
-- SELECT type, amount, description, related_order_id, created_at
-- FROM public.wallet_logs
-- WHERE related_order_id = 3643
-- ORDER BY created_at;
