-- 2026-07-27: 디자이너 등록 오류 근본 원인 수정
--
-- 증상: 신규 디자이너 등록 시 "오류" (본사직원 HQ_STAFF_EMAILS 제외). 박소정 등 수동 등록 필요.
--
-- 근본 원인:
--   supabase-js .upsert() 는 기본 Prefer: return=representation 로 INSERT ... RETURNING * 실행.
--   RETURNING 되는 새 행은 SELECT 정책을 통과해야 하는데,
--   designer_profiles 의 유일한 SELECT 정책이 "Anyone can view active designers" = (is_active = true) 뿐.
--   일반 디자이너는 승인 대기(is_active=false)로 등록되므로 → RETURNING 행이 SELECT 통과 실패
--   → 42501 "new row violates row-level security policy".
--   본사직원은 _isHQ 로 is_active=true 등록이라 이 오류를 피해감(그래서 자동승인만 정상이었음).
--   추가로 loadDesignerProfile 의 .select('*').eq('id',uid).single() 도 pending 본인 행을 못 읽어 PGRST116.
--
-- 검증(롤백 트랜잭션): 정책 추가 후 is_active=false INSERT ... RETURNING 성공 확인.
--
-- 수정: 본인 프로필은 is_active 무관하게 항상 읽게 (design_gallery 의 dg_read_own 패턴).

drop policy if exists "Users can view own profile" on public.designer_profiles;
create policy "Users can view own profile"
  on public.designer_profiles
  for select
  using (auth.uid() = id);
