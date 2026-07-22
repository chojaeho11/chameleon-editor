-- 2026-07-23: admin_templates 다국어 검색용 생성열
--
-- 배경: 코튼프린트 「디자이너 패턴 컬렉션」이 에디터 자산(admin_templates)을 보여주게 되면서,
--   승인 시 넣어둔 한국어·일본어 키워드로 검색이 안 된다는 제보(사장님). 검색이 name(영문)만
--   보고 있었다.
--
-- 왜 생성열인가: keywords 는 jsonb {ko,ja,en,fr,ar} 인데, PostgREST 로 `keywords->>ko.ilike.*`
--   필터를 보내면 이 프로젝트 게이트웨이가 HTTP 500 을 낸다(단일 필터/or() 둘 다). 그래서
--   모든 언어를 이어붙인 text 열을 만들어 평범한 ilike 로 찾는다.
--
-- 안전성: 생성열은 INSERT/UPDATE 대상이 될 수 없지만, 코드의 admin_templates 쓰기는 전부
--   컬럼을 명시한 insert(row) 라 영향 없음. update/upsert 로 전체 행을 되쓰는 코드는 없음.
--   (2026-07-23 기준 admin_templates.html / contribute.html / simple_order.js 확인)

alter table public.admin_templates
  add column if not exists keywords_text text
  generated always as (
    coalesce(name,'') || ' ' ||
    coalesce(keywords->>'ko','') || ' ' ||
    coalesce(keywords->>'ja','') || ' ' ||
    coalesce(keywords->>'en','') || ' ' ||
    coalesce(keywords->>'fr','') || ' ' ||
    coalesce(keywords->>'ar','')
  ) stored;

-- 사용처: cotton_print.html loadPatternGallery()
--   q.ilike('keywords_text', '%' + 검색어 + '%')
-- 현재 승인 자산 358건 수준이라 별도 인덱스 없이도 충분. 수천 건으로 늘면
--   pg_trgm 확장 후 gin (keywords_text gin_trgm_ops) 인덱스 추가 검토.
