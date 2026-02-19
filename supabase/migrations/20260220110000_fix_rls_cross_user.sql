-- ============================================================
-- Migration: Fix RLS policies for cross-user access patterns
-- Date: 2026-02-20
-- Purpose: Previous RLS was too restrictive — broke referral bonus,
--          template royalty, partner/driver order access, etc.
-- ============================================================

-- ============================================================
-- 1. profiles — 인증된 사용자는 다른 유저 프로필 읽기 가능
--    (추천인 확인, 파트너 정보, 이메일 검색 등)
-- ============================================================
-- 기존 정책 제거
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- SELECT: 인증된 사용자는 모든 프로필 읽기 가능
-- (추천인 이메일 검색, 파트너 정보 조회, 입찰자 정보 등)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- UPDATE: 본인 프로필 수정 + 관리자 전체 수정
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (public.is_admin());
-- 추천인/로열티 deposit 업데이트: 인증된 사용자 허용
-- ⚠️ 장기적으로는 Edge Function으로 이전 필요 (보안)
CREATE POLICY "profiles_update_deposit_authenticated" ON public.profiles
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. orders — 파트너/기사도 접근 필요
-- ============================================================
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;

-- SELECT: 본인 주문 + 관리자/스태프 전체 + 인증 사용자 (파트너/기사용)
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "orders_select_staff" ON public.orders
  FOR SELECT USING (public.is_staff());
-- 파트너: partner_settlements에 자기 settlement이 있는 주문 조회
CREATE POLICY "orders_select_partner" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partner_settlements ps
      WHERE ps.order_id = orders.id
      AND ps.partner_id = auth.uid()
    )
  );

-- UPDATE: 본인 주문 + 관리자/스태프
CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "orders_update_staff" ON public.orders
  FOR UPDATE USING (public.is_staff());
-- 파트너: 자기 settlement이 있는 주문 상태 변경 (배송중 등)
CREATE POLICY "orders_update_partner" ON public.orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.partner_settlements ps
      WHERE ps.order_id = orders.id
      AND ps.partner_id = auth.uid()
    )
  );

-- ============================================================
-- 3. wallet_logs — 추천인 보너스/로열티 INSERT 허용
-- ============================================================
-- 기존 정책 제거 (이전 마이그레이션 20260219에서 생성됨)
DROP POLICY IF EXISTS "Users can insert own wallet logs" ON public.wallet_logs;
DROP POLICY IF EXISTS "Users can view own wallet logs" ON public.wallet_logs;

-- INSERT: 인증된 사용자는 다른 유저 user_id로도 INSERT 가능
-- (추천인 보너스, 템플릿 로열티 등)
CREATE POLICY "wallet_logs_insert_authenticated" ON public.wallet_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: 본인 로그 + 관리자
CREATE POLICY "wallet_logs_select_own" ON public.wallet_logs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallet_logs_select_admin" ON public.wallet_logs
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- 4. partner_settlements — 고객이 파트너 settlement INSERT
-- ============================================================
DROP POLICY IF EXISTS "partner_settlements_select_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_insert_auth" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_update_own" ON public.partner_settlements;
DROP POLICY IF EXISTS "partner_settlements_all_admin" ON public.partner_settlements;

-- INSERT: 인증된 사용자 (구매자가 파트너 settlement 생성)
CREATE POLICY "partner_settlements_insert_auth" ON public.partner_settlements
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: 파트너 본인 settlement + 관리자
CREATE POLICY "partner_settlements_select_own" ON public.partner_settlements
  FOR SELECT USING (partner_id = auth.uid());
CREATE POLICY "partner_settlements_select_admin" ON public.partner_settlements
  FOR SELECT USING (public.is_admin());

-- UPDATE: 파트너 본인 + 인증된 사용자 (고객 구매확정) + 관리자
CREATE POLICY "partner_settlements_update_auth" ON public.partner_settlements
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. withdrawal_requests — 기존 정책도 수정
--    (이전 마이그레이션의 정책에 관리자 SELECT 추가)
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON public.withdrawal_requests;

CREATE POLICY "withdrawal_requests_insert_own" ON public.withdrawal_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "withdrawal_requests_select_own" ON public.withdrawal_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "withdrawal_requests_select_admin" ON public.withdrawal_requests
  FOR SELECT USING (public.is_admin());
CREATE POLICY "withdrawal_requests_update_admin" ON public.withdrawal_requests
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- 6. is_staff() 함수 확장 — 파트너(franchise) 포함
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'platinum', 'staff', 'franchise')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- DONE
-- ============================================================
