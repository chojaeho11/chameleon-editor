# Cotton Print — AI Fabric Pattern Generator

OpenAI gpt-image-1으로 패브릭 패턴을 자동 생성하고, **좌우/상하가 이어지는 타일러블 이미지**로 가공한 뒤, Supabase에 자동 등록하는 도구입니다.

카테고리 8종(동물·식물·사람·모던·풍경·타이포·키즈·기타)을 순회하며 가상의 한국·일본·미국 디자이너 이름과 패턴 제목까지 자동 생성합니다.

---

## 🎨 가장 쉬운 방법: 바탕화면 GUI

**3단계로 끝.**

1. PowerShell 열기 (Win+R → `powershell`)
2. 아래 명령 한 줄씩 복사 → 실행:
   ```powershell
   cd "c:\Users\win 10\Desktop\작업\ai_pattern_generator"
   .\start_studio.bat
   ```
   - 첫 실행 시 가상환경 + 의존성 자동 설치 (1~2분)
   - 자동으로 GUI 창 뜸
3. 바탕화면 바로가기 만들기:
   ```powershell
   python install_desktop_shortcut.py
   ```
   → 바탕화면에 **"Cotton Pattern Studio"** 아이콘 생김. 이후엔 더블클릭만 하면 GUI 실행.

GUI 사용법:
- API 키 2개 입력 → **💾 .env에 저장** 클릭 (한 번만)
- 카테고리 체크 (기본 전체 선택)
- 라운드 수 0이면 무한, 원하는 만큼만 돌리려면 숫자 지정
- **▶ 시작** 클릭 → 실시간 로그 보면서 자동 생성됨
- **■ 중단** 으로 언제든 중지

CLI 모드도 그대로 사용 가능 — 아래 "수동 사용법" 참고.

---

## 수동 사용법 (CLI)

GUI 안 쓰고 명령줄로 직접 돌리고 싶을 때:

### 설치

```bash
cd ai_pattern_generator

# 가상환경 권장
python -m venv .venv
.venv\Scripts\activate           # Windows
# source .venv/bin/activate      # macOS/Linux

pip install -r requirements.txt
```

## 설정

1. `.env.example`을 복사해서 `.env` 만들기:
   ```bash
   copy .env.example .env       # Windows
   # cp .env.example .env       # macOS/Linux
   ```

2. `.env` 파일에 키 입력:
   - **OPENAI_API_KEY**: https://platform.openai.com/api-keys
   - **SUPABASE_SERVICE_KEY**: Supabase 대시보드 → Settings → API → `service_role` 키 복사 (anon 말고 service_role!)

> ⚠️ `service_role` 키는 RLS를 우회하므로 절대 깃에 커밋하거나 클라이언트에 노출하지 마세요. `.env`는 이미 .gitignore에 들어 있어야 합니다.

## 사용법

```bash
# 무한 루프 (밤새 돌리기, Ctrl+C로 중단)
python fabric_pattern_generator.py

# 한 바퀴만 (8장 = 카테고리 × 1장)
python fabric_pattern_generator.py --rounds 1

# 카테고리당 3장씩 5바퀴 = 120장
python fabric_pattern_generator.py --rounds 5 --per-category 3

# 특정 카테고리만
python fabric_pattern_generator.py --categories animal plant kids

# 업로드 안 하고 로컬 저장만 (테스트용)
python fabric_pattern_generator.py --rounds 1 --dry-run

# 이미지 사이 대기시간 조정 (rate limit 회피)
python fabric_pattern_generator.py --sleep 15
```

### 옵션 정리

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--rounds N` | 0 (무한) | 총 라운드 수. 0이면 Ctrl+C 전까지 무한 |
| `--per-category N` | 1 | 라운드당 카테고리별 생성 수 |
| `--sleep N` | 8 | 이미지 사이 대기 (초) |
| `--categories ...` | 전체 8개 | 특정 카테고리만 (예: `animal plant`) |
| `--dry-run` | off | 업로드/등록 없이 로컬 저장만 |
| `--output PATH` | `./generated_patterns` | 로컬 저장 경로 |

---

## 동작 흐름

각 패턴 1장당:

1. **AI 생성** — gpt-image-1로 모티프에 맞는 1024×1024 이미지 생성 (실패 시 dall-e-3 폴백)
2. **타일러블 가공** — 가장자리 픽셀이 반대쪽과 같아지도록 코사인 페이드 블렌딩 → 좌우/상하 이어짐
3. **Supabase 업로드** — `design` 버킷의 `patterns/ai/` 경로에 원본 + 600px 썸네일 저장
4. **DB 등록** — `user_patterns` 테이블에 `status='approved'`로 즉시 등록 (코튼프린트 갤러리에 바로 노출)

생성된 파일은 로컬 `./generated_patterns/`에도 백업되며, 검증용 2×2 미리보기(`*_2x2preview.jpg`)도 같이 저장됩니다 — 이걸 보면 이음새가 안 보이는지 한눈에 확인 가능합니다.

---

## 비용 가이드 (gpt-image-1 medium · 1024×1024)

- 장당 약 **$0.04**
- 카테고리당 1장 × 8개 카테고리 = 라운드당 ~$0.32
- 100장 ≈ **$4**, 200장 ≈ **$8**, 1000장 ≈ **$40**

`--per-category 1 --sleep 8`로 무한 루프 돌리면 시간당 약 30~50장 = $1.2~$2/시간 정도 됩니다.

---

## Windows 백그라운드 실행 (밤새 돌리기)

PowerShell에서:

```powershell
# 새 콘솔 창에서 백그라운드로 실행, 로그도 파일로
Start-Process powershell -ArgumentList "-NoExit","-Command","python fabric_pattern_generator.py 2>&1 | Tee-Object -FilePath gen.log"
```

또는 그냥 새 PowerShell 탭 열어두고:
```powershell
python fabric_pattern_generator.py 2>&1 | Tee-Object -FilePath gen.log
```

진행 상황은 콘솔에 실시간으로 찍히고, `gen.log`에도 기록됩니다.

---

## 결과물 검증

1. **로컬 미리보기** — `./generated_patterns/` 폴더 열어서 `*_2x2preview.jpg` 확인. 이음새가 거의 안 보여야 정상.
2. **사이트 확인** — https://www.cotton-print.com → "디자이너 패턴 컬렉션" 섹션에서 즉시 노출됨 (`source: 'ai-generator'`로 필터링하면 AI 생성분만 골라볼 수 있음)
3. **품질 안 좋은 패턴 제거** — Supabase 대시보드 → user_patterns → `source = 'ai-generator'` 필터 후 `status = 'rejected'`로 변경하거나 삭제

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|-------------|
| `OPENAI_API_KEY 환경변수가 없습니다` | `.env` 파일이 같은 폴더에 있는지 확인 |
| `RLS policy violation` | service_role 키가 아니라 anon 키를 쓴 경우. Supabase 대시보드에서 다시 확인 |
| `Rate limit exceeded` | `--sleep` 값을 30 이상으로 늘리기 |
| 패턴이 너무 일관성 없음 | `CATEGORIES`의 `motifs` 리스트를 더 구체적으로 다듬기 |
| 가장자리가 흐릿함 | `make_seamless_tile(img, fade_pct=0.05)`로 페이드 폭 줄이기 (기본 0.08) |
| 사이트에 안 보임 | RLS SELECT 정책에 `status='approved'` 허용되어 있는지, `?lang=` 다른 사이트면 사이트별 필터 확인 |
