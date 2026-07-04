# 카멜레온 프린트 — 작업 지침

## 0. 디자인 원칙 (UI 만들거나 고칠 때 항상)

사용자(사장님) 취향 — 새로 만들거나 수정하는 모든 UI 에 적용:

- **아이콘 / 픽토그램 최대한 쓰지 말 것.** 꼭 필요할 때만, 기본은 **텍스트로** 표현. (이모지·FontAwesome 아이콘 남발 금지)
- **그림자 효과 금지** — `box-shadow`, `text-shadow`, `drop-shadow` 쓰지 말 것. **납작한 플랫 디자인** 유지.
- **굵은 글씨(볼드) 효과 지양** — 강조는 `font-weight:700+` 대신 **색·크기·여백**으로. (볼드로 도배하지 말 것)
- 적용 범위: **새로 만들거나 내가 고치는 UI**. 기존 코드의 아이콘/그림자/볼드를 **전면 제거하는 건 사용자가 명시적으로 요청할 때만** (대량 변경 = 회귀 위험).

## 0-1. 회귀 방지 — `simple_order.js` 는 전 제품 공유 (한 곳 고치면 다른 제품 깨짐)

`simple_order.js` **한 파일이 명함·스티커·배너·현수막·실사출력·허니콤보드·패브릭 등 모든 제품**을
`state.is*` 플래그 분기로 처리한다. 한 제품 분기/공유 함수를 고치면 **다른 제품이 깨질 수 있음** (예: 명함 수정 → 스티커 오작동).

**공유 코드(함수·플래그·배송/가격 계산) 수정 시 필수 절차**:
1. 고칠 함수/플래그를 **`Grep` 으로 전부 검색** → 어떤 제품들이 그걸 쓰는지 먼저 파악
2. 수정은 **해당 제품만** 영향 받도록 분기 안에서 (다른 제품 분기 건드리지 말 것)
3. 배포 전 **`node --check simple_order.js`** (문법 오류 1개면 전 제품 다운)
4. 영향 가능성 있는 다른 제품(특히 명함↔스티커↔배너↔현수막)도 한 번 점검 후 배포

## 1. simple_order.js — `state.is*` 플래그는 다중 override 함정

`state.isCustomSize` / `state.isBannerOutput` / `state.isRealPrint` / `state.isAdPrint` /
`state.shipMethod` / `calcPrice` 등은 **한 번 set 한 뒤 5~10곳에서 다시 덮어쓰임**.
한 군데만 고치면 다른 분기가 그대로 끄고 끝남.

특히 `state.shipMethod` 는 product-load 마지막에 `state.shipMethod = defaultShip` 으로
무조건 재설정됨 → family-specific 무료배송은 그 줄 *직후* 에 최종 override 필요.

**수정 절차 (필수)**:
1. 먼저 `Grep` 으로 `state\.<플래그명>\s*=` 와 `state\.<플래그명>\b` 둘 다 검색 — 모든 set / 사용 위치 확인
2. 분기마다 어떤 조건일 때 무엇으로 덮는지 정리
3. UI 표시 (`custSec.style.display = ...`) 분기도 같은 플래그를 따로 보는지 확인
   (`state.isCustomSize` 와 `state.isBannerOutput` 가 각각 별도 display 분기 있음 — 둘 다 패치 필요)
4. 모든 분기를 일관되게 패치 후 한 번에 커밋

**실제 사례 (2026-06-14)**: 현수막(placard 9종) 사이즈 입력 복구 — 4번 패치 (v=399~402)
- v399: `if (state.isBannerOutput) state.isCustomSize=false` 차단
- v400: `if (state.isBannerOutput) custSec.display='none'` 차단
- v401: 어깨띠 별도 분기 (flat 1000원 + 무료배송)
- v402: `_soOnCustomDimsChange` 의 `calcPrice = product.price` 덮어쓰기 차단

**핵심 교훈**: `isBannerOutput` 처럼 정규식으로 set 되는 family 플래그는 단순 `state.is* = ...` 만 보지 말고 **`calcPrice = ...`, `unit = ...`, `subtotal = ...`, `*.style.display = ...`** 까지 모든 형태의 영향 분기를 grep 으로 찾아야 함. 한 곳만 고치고 배포하면 다음 분기가 다시 덮어서 회귀.

## 2. Banner family 정규식이 placard 도 잡음

[simple_order.js:9397](simple_order.js#L9397) `_bannerKw = /배너|...|현수막|.../` 가 "현수막" 도 매치 →
`state.isBannerOutput = true` 됨.

- **배너 family** (X배너/거치대 세트): 고정 사이즈, DB flat price → `isCustomSize = false`
- **현수막 family** (PLACARD_CODES_ORDERED 9종, 44578 등): m² 가격 → `isCustomSize = true` 필수
- **실사출력 family** (REAL_PRINT_CODES_ORDERED 9종): m 단위 판매 → 폭/코팅 UI 사용, `isCustomSize = false`

세 family 가 모두 "현수막/배너/실사" 키워드를 공유하므로 **이름 정규식만 믿지 말고 코드 화이트리스트(_soIsPlacardProduct / _soIsRealPrintProduct) 도 같이 확인**.

## 3. 버전 번프 — JS 수정 시 index.html `?v=` 동시 변경 필수

- `simple_order.js` 수정 → `index.html` 의 `simple_order.js?v=NNN` 동반 bump
- `advisor-panel.js` 수정 → `index.html` + `chameleon-chatbot.html` + `cotton_print.html` 의 `?v=NNN` 동시 bump
- `_headers` 는 v171 이후 JS/CSS 를 no-cache 로 설정했지만 버전 번프는 CDN 캐시 무효화 + 브라우저 강제 재요청 보장용으로 계속 필요

## 4. 배포 절차 — 반드시 `./deploy.sh` 사용 (고객 자동 최신화)

```bash
./deploy.sh "ASCII commit message"
```

- **항상 `deploy.sh` 로 배포할 것.** 이 스크립트가 매 배포마다 `version.txt` + `index.html` 의 `var CV='...'` 를
  **동일한 새 stamp(타임스탬프)** 로 교체한다. → 구버전을 보던 고객(일본/한국 모두)의 브라우저가
  version.txt 불일치를 감지해 **스스로 새로고침** = 고객 수동 새로고침 없이 항상 최신 버전.
  (자동 갱신 로직: index.html 상단 `[버전 자동 갱신]` 블록 — 최초 로드 즉시 + 탭 재포커스/online/bfcache 복귀 시 재체크, 작업 중이면 보류.)
- 수동 `wrangler` 명령 직접 실행 금지 — version.txt/CV 갱신이 빠져 자동 최신화가 멈춤(휴면). 급하면 deploy.sh 내부 명령 참고.
- **커밋 메시지는 반드시 ASCII** — 한국어 포함 시 "Invalid commit message" 에러
- Cloudflare Pages 가 7개 도메인 (cafe2626 / cafe0101 / cafe3355 / chameleon.design / cotton-print / cotton-printer / hexa-board) 동시 배포
- JS 를 수정했으면 `?v=NNN` bump 은 여전히 병행(§3) — deploy.sh 는 전역 자동새로고침, `?v=` 는 파일별 CDN 버스팅.

## 5. 사이트 감지 (3중 layer)

순서: `window.__SITE_CODE` (HTML inline) → `site-config.js` `SITE_CONFIG.COUNTRY` → hostname fallback.
이 중 하나라도 잘못되면 가격/언어/PG 가 어긋남. 추가 도메인 시 `_worker.js` 의 `getCountry()` + `OG_DATA` + `getSiteData()` 모두 같이 업데이트.

## 6. 통화 변환

DB 는 KRW 만 저장. 프론트엔드에서 `CURRENCY_RATE` (KR=1, JP=0.1, US=0.001) 로 환산.
`admin_addons` 만 `price_kr/jp/us` 별도 컬럼 있지만 일관성을 위해 KRW×rate 로 계산.

## 7. 작업 전 확인 사항

- 코드 수정 전: **메모리(`MEMORY.md`) 와 `auto memory` 폴더의 관련 파일 확인**
- 비자명한 수정(2개 이상 파일 변경): **EnterPlanMode 로 계획 먼저 제시** 후 사용자 승인
- `state.is*` / 정규식 family 감지 / 배포 / 통화·도메인 라우팅 관련 수정 시: 영향 범위를 grep 으로 전체 확인 후 진행
