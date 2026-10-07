-- 2026-10-07(사장님): 채팅방 담당매니저 → 고객 귀속 시스템
--   jarvis(실시간 채팅관리)에서 방에 담당매니저를 지정하면
--   그 고객(전화번호 기준)이 그 매니저의 고객으로 귀속되고,
--   향후 주문은 자동으로 그 매니저 실적/정산(orders.staff_manager_id)에 잡힘.
--   Supabase SQL Editor 에서 1회 실행.

-- 1) chat_rooms 에 담당 매니저 id (admin_staff.id) 링크 (기존 assigned_manager 텍스트는 라이브채팅 라우팅용 유지)
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS staff_manager_id int;

-- 2) 매니저 ↔ 고객 귀속 매핑 (전화번호 숫자만 = PK)
CREATE TABLE IF NOT EXISTS manager_customers (
  phone_norm       text PRIMARY KEY,
  staff_manager_id int,
  manager_name     text,
  customer_name    text,
  source_room_id   text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- 3) 신규 주문 자동 귀속 트리거
--    staff_manager_id 가 비어있고 phone 이 manager_customers 에 있으면 그 매니저로 자동 세팅.
--    (이미 지정된 주문은 절대 덮어쓰지 않음)
CREATE OR REPLACE FUNCTION _attribute_order_manager()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mid int; pnorm text;
BEGIN
  IF NEW.staff_manager_id IS NULL AND NEW.phone IS NOT NULL THEN
    pnorm := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    IF length(pnorm) >= 9 THEN
      SELECT staff_manager_id INTO mid FROM manager_customers WHERE phone_norm = pnorm LIMIT 1;
      IF mid IS NOT NULL THEN NEW.staff_manager_id := mid; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_attribute_order_manager ON orders;
CREATE TRIGGER trg_attribute_order_manager
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION _attribute_order_manager();

-- 4) 기존 주문 소급 귀속 (jarvis 에서 담당 지정 시 호출) — 미배정 주문만, 전화 숫자 매칭
CREATE OR REPLACE FUNCTION attribute_customer_orders(p_phone_norm text, p_staff_id int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE n int;
BEGIN
  IF length(coalesce(p_phone_norm,'')) < 9 OR p_staff_id IS NULL THEN RETURN 0; END IF;
  UPDATE orders SET staff_manager_id = p_staff_id
    WHERE staff_manager_id IS NULL
      AND regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = p_phone_norm;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION attribute_customer_orders(text,int) TO anon, authenticated;

SELECT 'chat room manager ownership ready' AS ok;
