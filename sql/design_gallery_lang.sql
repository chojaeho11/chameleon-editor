-- 2026-07-21: design_gallery — 작품 갤러리 언어 분리 (한국어 프롬프트는 한국 사이트, 일본어는 일본 사이트)
--
-- 배경
--   design_gallery 는 마이그레이션 없이 Supabase 대시보드에서 만들어진 테이블이라
--   sql/ 폴더의 이 파일들이 유일한 변경 기록이다. (앞선 변경: design_gallery_soft_reject.sql)
--
--   홈 히어로와 미니에디터의 작품 갤러리가 status='public' 전체를 언어 구분 없이 보여줘서
--   한국 고객에게 일본어 디자인이, 일본 고객에게 한글 디자인이 섞여 나왔다.
--
-- 판정 기준 — 프롬프트에 실제로 쓰인 문자
--   한글(가-힣) 있으면 ko / 카나(぀-ヿ) 있으면 ja / 그 외 en
--   값은 _meAiLang() 반환값 및 kw_ko·kw_ja·kw_en 컬럼 명명과 맞춰 ko/ja/en 로 통일.
--   (적용 시점 실측 77건: 한글 69 · 카나 6 · 영문 2, 한자 전용 애매 케이스 0건)
--
--   앞으로 생성되는 행은 mini-editor.js 의 _meDetectLang() 이 같은 규칙으로 채운다.
--   한자만 쓴 일본어 프롬프트처럼 문자로 판정이 안 되는 경우는 사이트 언어로 폴백한다.

ALTER TABLE design_gallery ADD COLUMN IF NOT EXISTS lang text;

UPDATE design_gallery SET lang = CASE
    WHEN prompt ~ '[가-힣]' THEN 'ko'
    WHEN prompt ~ '[぀-ヿ]' THEN 'ja'
    ELSE 'en'
  END
  WHERE lang IS NULL;

-- 갤러리 조회 패턴: status + lang 으로 걸러 최신순
CREATE INDEX IF NOT EXISTS design_gallery_lang_idx
  ON design_gallery (status, lang, created_at DESC);
