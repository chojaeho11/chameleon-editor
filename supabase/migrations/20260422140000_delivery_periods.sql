-- ============================================================
-- Delivery period model (Phase 1)
-- 기존 installation_time (exact HH:MM, 3팀 slot) → 3 시간대 (오전 8건 / 오후 10건 / 야간 6건)
-- 주소 기반 자동 팀 배정 + 지방설치 플래그
-- ============================================================

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS delivery_period text,          -- 'am' | 'pm' | 'night' | 'any'
    ADD COLUMN IF NOT EXISTS delivery_time_flexible boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS assigned_team text,            -- 'hwaseong' | 'north' | 'seoul'
    ADD COLUMN IF NOT EXISTS is_province_install boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS install_duration_min int;      -- 설치 소요분 (100만원당 60분, 최소 60)

CREATE INDEX IF NOT EXISTS idx_orders_delivery_date_period ON public.orders (delivery_target_date, delivery_period);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_team        ON public.orders (assigned_team, delivery_target_date);
CREATE INDEX IF NOT EXISTS idx_orders_province_install     ON public.orders (is_province_install, delivery_target_date);

-- 기존 installation_time 값 → delivery_period 자동 매핑 (일회성 백필)
UPDATE public.orders
SET delivery_period = CASE
    WHEN installation_time IS NULL OR installation_time = '' THEN NULL
    WHEN installation_time < '12:00' THEN 'am'
    WHEN installation_time < '18:00' THEN 'pm'
    ELSE 'night'
END
WHERE delivery_period IS NULL;

-- 주석: Phase 2에서 추가될 예정
--   - 팀 배정 이력 테이블 (assignment_log)
--   - 설치 완료 시각 / 실제 소요시간 기록
