#!/usr/bin/env bash
# ============================================================
# promo-sync.sh — 홍보사진 폴더 → Supabase 업로드 + 발행 대기열 등록
# 2026-07-17 신규.
#
# 사용법:
#   1) 카톡에서 받은 제작물 사진을  카카오톡 받은 파일/홍보사진/  폴더에 넣는다
#      (경로는 .promo.env 의 PROMO_DIR 로 바꿀 수 있음)
#   2) ./promo-sync.sh          ← 업로드 + (새 사진이 있으면) 즉시 발행
#      ./promo-sync.sh --now    ← 새 사진이 없어도 발행까지 강제로 시도
#      2026-07-23: 예약발행(매일 18시 pg_cron) 폐지 — 넣는 즉시 나간다.
#
# 하는 일:
#   - 사진마다 SHA-256 해시 → 같은 사진은 두 번 안 올라감 (promo_photos.file_hash unique)
#   - storage 'community' 버킷 promo/ 에 업로드 (블로그 사진과 같은 버킷)
#   - promo_photos 에 status='new' 로 등록 → promo-publish 가 AI 로 제품 판별 후 글 발행
#   - 성공한 파일은 홍보사진/_완료/ 로 이동 (원본 보존 + 재처리 방지)
#
# 매일 무인 실행하려면 Windows 작업 스케줄러에 등록:
#   프로그램: C:\Program Files\Git\bin\bash.exe
#   인수    : -lc "cd '/c/Users/win 10/Desktop/작업' && ./promo-sync.sh"
# ============================================================
set -uo pipefail

cd "$(dirname "$0")"

ENV_FILE=".promo.env"
BUCKET="community"

if [ ! -f "$ENV_FILE" ]; then
    echo "[promo] ERROR: $ENV_FILE 이 없습니다. (service_role 키 필요 — gitignore 되어 있어 PC 마다 새로 만들어야 함)"
    exit 1
fi
# shellcheck disable=SC1090
set -a; . "./$ENV_FILE"; set +a

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
    echo "[promo] ERROR: $ENV_FILE 에 SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다."
    exit 1
fi

# 사진 폴더 — .promo.env 의 PROMO_DIR 로 지정 (기본: 카카오톡 받은 파일/홍보사진).
# 폴더를 옮기고 싶으면 .promo.env 의 PROMO_DIR 한 줄만 바꾸면 된다.
SRC_DIR="${PROMO_DIR:-$HOME/Documents/카카오톡 받은 파일/홍보사진}"
DONE_DIR="$SRC_DIR/_완료"

if [ ! -d "$SRC_DIR" ]; then
    echo "[promo] 사진 폴더가 없어 새로 만듭니다: $SRC_DIR"
fi
mkdir -p "$DONE_DIR" || { echo "[promo] ERROR: 폴더를 만들 수 없습니다: $SRC_DIR"; exit 1; }
echo "[promo] 사진 폴더: $SRC_DIR"

shopt -s nullglob nocaseglob
FILES=("$SRC_DIR"/*.jpg "$SRC_DIR"/*.jpeg "$SRC_DIR"/*.png "$SRC_DIR"/*.webp)
shopt -u nocaseglob

if [ ${#FILES[@]} -eq 0 ]; then
    echo "[promo] $SRC_DIR/ 에 새 사진이 없습니다."
    [ "${1:-}" = "--now" ] && echo "[promo] (그래도 --now 이므로 발행은 시도합니다)"
    [ "${1:-}" != "--now" ] && exit 0
fi

ok=0; dup=0; fail=0

for f in "${FILES[@]}"; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    ext="${base##*.}"
    ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    [ "$ext" = "jpeg" ] && ext="jpg"

    hash="$(sha256sum "$f" | cut -d' ' -f1)"
    path="promo/${hash}.${ext}"

    case "$ext" in
        jpg) ctype="image/jpeg" ;;
        png) ctype="image/png" ;;
        webp) ctype="image/webp" ;;
        *) ctype="application/octet-stream" ;;
    esac

    # 1) 이미 등록된 해시인지 확인 (중복 방지)
    exists="$(curl -s -G "${SUPABASE_URL}/rest/v1/promo_photos" \
        --data-urlencode "file_hash=eq.${hash}" --data-urlencode "select=id" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")"
    if [ "$exists" != "[]" ] && [ -n "$exists" ]; then
        echo "[promo] 중복 스킵: $base"
        mv -f "$f" "$DONE_DIR/" 2>/dev/null || true
        dup=$((dup+1)); continue
    fi

    # 2) storage 업로드 (upsert — 해시가 같으면 내용도 같으므로 덮어써도 무해)
    up_code="$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: ${ctype}" -H "x-upsert: true" \
        --data-binary "@${f}")"
    if [ "$up_code" != "200" ] && [ "$up_code" != "201" ]; then
        echo "[promo] 업로드 실패($up_code): $base"
        fail=$((fail+1)); continue
    fi
    url="${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}"

    # 3) 대기열 등록 (한글 파일명 → JSON 은 파일로 써서 전달, 셸 인라인은 인코딩이 깨짐)
    tmp="$(mktemp)"
    FN="$base" HS="$hash" URL="$url" python -c '
import json, os
print(json.dumps({
    "file_hash": os.environ["HS"],
    "filename":  os.environ["FN"],
    "storage_url": os.environ["URL"],
    "status": "new"
}))' > "$tmp" 2>/dev/null

    ins_code="$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        "${SUPABASE_URL}/rest/v1/promo_photos" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" -H "Prefer: return=minimal" \
        --data-binary "@${tmp}")"
    rm -f "$tmp"

    if [ "$ins_code" != "201" ] && [ "$ins_code" != "200" ]; then
        echo "[promo] 대기열 등록 실패($ins_code): $base"
        fail=$((fail+1)); continue
    fi

    echo "[promo] 등록: $base"
    mv -f "$f" "$DONE_DIR/" 2>/dev/null || true
    ok=$((ok+1))
done

echo "[promo] 새 사진 ${ok}장 · 중복 ${dup}장 · 실패 ${fail}장"

# 4) 발행 — 2026-07-23 (사장님 지시): 예약발행 폐지.
#    폴더에 사진을 넣으면 기다릴 것 없이 바로 글이 나가야 한다.
#    새 사진을 하나라도 올렸으면 그 자리에서 발행하고, --now 면 새 사진이 없어도 발행을 시도한다.
#    (예전에는 올리기만 하고 pg_cron 이 매일 18시에 발행 → 최대 하루를 기다려야 했다)
if [ $ok -gt 0 ] || [ "${1:-}" = "--now" ]; then
    echo "[promo] 발행 요청..."
    curl -s -X POST "${SUPABASE_URL}/functions/v1/promo-publish" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -d '{"maxPhotos":12,"force":true}'
    echo
fi
