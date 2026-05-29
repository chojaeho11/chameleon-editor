# 자율 카탈로그 사이트 구축 인프라

> 카멜레온 굿즈 사이트를 기반으로 일반화한 "AI 카탈로그 자동 구축" 프레임워크.
> 목표: 카테고리 타입 한 줄 → 카탈로그 사이트 자동 완성·운영.

---

## 🎯 비전

```
[입력]            [자동화 레이어]                      [출력]
─────────         ────────────────                    ─────────────────
카테고리 타입  →  ① 카테고리 분류 생성        →     /<category-slug> 랜딩
                  ② AI 이미지 자동 생성             가격·옵션 자동 채움
                  ③ 시장 가격 벤치마크 → 가격 설정  결제 흐름 즉시 동작
                  ④ UX QA (Claude 자동 점검)       Google/네이버 광고 자동 연결
```

사용자 개입: 카테고리 타입 지정 + 결과물 spot-check 만.

---

## 🏗️ 현재 구축된 모듈

### 1) 카탈로그 페이지 템플릿
- **파일**: [`goods.html`](goods.html)
- **URL**: `/goods` (별도 도메인 라우팅 가능 — `_worker.js`)
- **기능**: 메인 카테고리 탭 + 서브카 칩 + DB 자동 로드 + 다국어 + placeholder
- **재사용**: 다른 카테고리는 이 파일 복제 → CATS 배열만 교체 → 새 URL 매핑

### 2) 시드 데이터 일괄 등록 도구
- **파일**: [`seed-goods.html`](seed-goods.html)
- **URL**: `/seed-goods` (로그인 게이트)
- **동작**: 39 서브카 × 사이즈 × 마감 조합 → ~485개 상품 자동 생성 + UPSERT
- **재사용**: 카테고리 템플릿 교체로 다른 카테고리에도 적용

### 3) 이미지 관리 도구 (4 탭)
- **파일**: [`goods-images.html`](goods-images.html)
- **URL**: `/goods-images` (로그인 게이트)
- **탭 1 — 프롬프트 헬퍼**: 카테고리별 프롬프트 클립보드 복사 + 파일명 일괄 다운로드
- **탭 2 — 일괄 업로드**: 드래그앤드롭 → 파일명↔코드 자동 매칭 → Storage + DB 일괄 갱신
- **탭 3 — DALL-E 자동생성 (브라우저)**: OpenAI 키 입력 → 한 번에 N개 자동
- **탭 4 — 서버 자동화**: Edge Function 호출 (개별 / 루프) + cron 설치 가이드

### 4) Edge Function: 자율 이미지 생성
- **파일**: [`supabase/functions/auto-generate-images/index.ts`](supabase/functions/auto-generate-images/index.ts)
- **트리거**: HTTP POST (cron / 수동 / 다른 함수에서)
- **동작**:
  1. `admin_products` 에서 `img_url` 비어있는 `pkg_*` 상품 N개 조회
  2. 코드 파싱 → 카테고리/사이즈/마감 → DALL-E 프롬프트 생성
  3. OpenAI DALL-E 3 호출 → b64 응답 → `products` 버킷 업로드 → `img_url` 갱신
  4. 응답에 `remaining` 큐 잔여수 포함 → 호출자가 루프 여부 판단
- **batch 크기**: 환경변수 `BATCH_LIMIT` (기본 6, Edge Function 150초 안에 안전)
- **카테고리 범위**: `CATEGORY_PREFIX` 환경변수로 다른 카테고리에도 재사용

### 5) Cron 자동 호출
- **파일**: [`supabase/functions/auto-generate-images/cron.sql`](supabase/functions/auto-generate-images/cron.sql)
- **주기**: 매 10분 (`*/10 * * * *`)
- **의존성**: `pg_cron` + `pg_net` Supabase Extensions
- **자동 중단**: 큐 비면 Edge Function 이 즉시 return → 호출 비용 0

---

## 🚀 배포 절차 (한 번만)

### A. Edge Function 배포
```bash
# Supabase CLI 가 설치되어 있어야 함
supabase functions deploy auto-generate-images --no-verify-jwt
```

### B. Secrets 확인
Dashboard → Edge Functions → Secrets:
- `OPENAI_API_KEY` (이미 등록됨)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (자동 주입)

선택적 환경변수 (없으면 기본값):
- `DALL_E_QUALITY` = `standard` (또는 `hd`)
- `CATEGORY_PREFIX` = `pkg_`
- `BATCH_LIMIT` = `6`

### C. Storage 정책 (이미 안 되어있으면)
Dashboard → SQL Editor:
```sql
-- products 버킷에 admin service_role 이 INSERT/UPDATE 가능하게
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 공개 SELECT 정책 (이미지 URL 공개)
CREATE POLICY IF NOT EXISTS "Public read products bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- service_role 이 모든 작업 가능 (Edge Function 용)
CREATE POLICY IF NOT EXISTS "Service role full access products"
ON storage.objects FOR ALL
USING (bucket_id = 'products' AND auth.role() = 'service_role');
```

### D. cron 등록
`supabase/functions/auto-generate-images/cron.sql` 내용을 SQL Editor 에 붙여넣고 실행.

확인:
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-generate-images';
SELECT * FROM cron.job_run_details
WHERE jobname = 'auto-generate-images'
ORDER BY start_time DESC LIMIT 10;
```

---

## 📊 비용 시뮬레이션

| 시나리오 | 상품 수 | DALL-E quality | 단가 | 총비용 | 소요시간 (cron 10분) |
|---|---|---|---|---|---|
| 굿즈 전체 (현재) | 483 | standard | $0.04 | **$19.32** | 약 13시간 |
| 굿즈 전체 (HD) | 483 | hd | $0.08 | $38.64 | 약 13시간 |
| 신규 카테고리 추가 (예) | 200 | standard | $0.04 | $8.00 | 약 5.5시간 |

> cron 매 10분 × 배치 6개 = 시간당 36개 → 483개 ÷ 36 ≈ 13.4시간

빠르게 끝내려면 `/goods-images` 탭 4 "큐 비울 때까지 반복 호출" 누르면 배치 사이 2초만 두고 연속 호출 — 약 2시간 안에 완료.

---

## 🛣️ 로드맵 (다음 단계)

### Phase 2 — 자율 가격 최적화 ⏳
- **`pricing-benchmarks.json`** 정적 데이터 (시장 평균가, 카테고리별)
- **Edge Function `auto-price-optimizer`** — 카멜레온 가격 = 시장 평균 × 0.85 (15% 저렴)
- cron 으로 주 1회 실행 → 시장 가격 변화 반영
- ⚠️ 벤치마크 데이터는 사용자가 직접 카테고리별로 한 번씩 입력 (공개 가격대 평균치)

### Phase 3 — 카테고리 사이트 일반화 🎨
- **`site-builder.html`** — 어드민 도구로 새 카테고리 입력:
  - 카테고리 prefix (예: `txt_` for 텍스타일)
  - 메인/서브카 정의
  - placeholder 아이콘/색감
  - 자동 생성 결과:
    - `/<slug>` 카탈로그 페이지 (goods.html 템플릿 복제)
    - `seed-<slug>.html` 시드 도구
    - Edge Function 환경변수 `CATEGORY_PREFIX` 만 바꿔 재사용
- 새 사이트 한 개 추가 = 약 30분 인간 작업 + 1일 cron 대기

### Phase 4 — UX 자동 점검 (Multi-Claude QA) 🧪
- **외부 인프라 필요** (GitHub Actions / 별도 서버):
  1. Playwright 헤드리스 브라우저로 카탈로그 → 상품 → 결제 흐름 자동 진행
  2. 각 단계 스크린샷 + DOM 캡처
  3. Anthropic API 호출 → Claude 가 "구매자 관점에서 불편한 점" 평가
  4. 평가 → GitHub Issue 자동 등록 → 사용자/Claude Code 가 픽스
  5. 픽스 → 자동 배포 → 재테스트
- 카멜레온 사이트 안에서는 못 만듬 (서버 측 브라우저 자동화 + 스케줄러 필요)
- 별도 레포 `chameleon-qa-agent` 권장

### Phase 5 — 시장 분석 자동화 📈
- 사용자가 URL 입력 → Edge Function 이 fetch:
  1. 해당 페이지의 **공개 가격 정보** 추출 (HTML 파싱)
  2. 카테고리 매핑 (텍스트 키워드 → 우리 카테고리)
  3. `pricing-benchmarks.json` 업데이트 (해당 카테고리 시장가)
- ⚠️ 이미지/디자인은 가져오지 않음 — 가격 메타데이터만
- 결과: 카멜레온 가격을 그 시장의 85% 로 자동 설정 → 광고 ROAS ↑

---

## 🔐 안전장치

| 보호 대상 | 메커니즘 |
|---|---|
| OpenAI 키 노출 | Supabase Secrets, 클라이언트 미노출 |
| 무한 비용 | `BATCH_LIMIT` + cron 주기 + 큐 비면 즉시 return |
| 중복 생성 | UPSERT + img_url 채워진 건은 skip |
| 잘못된 가격 | 가격 변경 전 dry-run 로그 / 백업 테이블 (Phase 2) |
| 사이트 다운타임 | 모든 자동화는 비동기 (cron) — 페이지 응답 영향 없음 |

---

## 📁 파일 인덱스

| 파일 | 역할 |
|---|---|
| [`goods.html`](goods.html) | 카탈로그 페이지 (재사용 가능 템플릿) |
| [`seed-goods.html`](seed-goods.html) | 시드 데이터 일괄 등록 (어드민) |
| [`goods-images.html`](goods-images.html) | 이미지 관리 4-탭 도구 (어드민) |
| [`ai-prompts.md`](ai-prompts.md) | 카테고리별 AI 프롬프트 라이브러리 (수동 참고용) |
| [`supabase/functions/auto-generate-images/index.ts`](supabase/functions/auto-generate-images/index.ts) | 자율 이미지 생성 Edge Function |
| [`supabase/functions/auto-generate-images/cron.sql`](supabase/functions/auto-generate-images/cron.sql) | 자동 호출 cron 스케줄 |
| [`_worker.js`](_worker.js) | `/goods` `/seed-goods` `/goods-images` URL 라우팅 |

---

## ✅ 사용자가 지금 할 일

1. **Edge Function 배포** — 위 "배포 절차 A" 한 줄 명령
2. **Storage 정책 SQL** — 한 번 실행
3. **cron 등록 SQL** — 한 번 실행
4. **`/goods-images` → 탭 4** 에서 "한 번 호출" 버튼 → 정상 응답 확인
5. **`/goods` 새로고침** → 첫 6개 이미지 표시 확인
6. ⏳ cron 이 자동으로 13시간 동안 나머지 채움 → 다음 날 `/goods` 완성
7. 결과물 spot-check → 톤 안 맞으면 cron 멈추고 프롬프트 조정 → 재시작

새 카테고리 추가는 Phase 3 도구 만들어진 후 진행.
