-- profiles 테이블에 site(가입 국가) 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS site text DEFAULT 'KR';

-- 기존 회원: 주문 이력의 site_code로 업데이트
UPDATE profiles p
SET site = sub.sc
FROM (
    SELECT DISTINCT ON (user_id) user_id, site_code AS sc
    FROM orders
    WHERE site_code IS NOT NULL AND site_code != ''
    ORDER BY user_id, created_at DESC
) sub
WHERE p.id = sub.user_id AND (p.site IS NULL OR p.site = 'KR');
