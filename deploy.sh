#!/usr/bin/env bash
# 카멜레온 배포 스크립트 — 항상 이걸로 배포할 것.
#   매 배포마다 version.txt + index.html 의 CV 를 동일한 새 stamp 로 교체한다.
#   → 구버전을 보고 있던 고객(일본/한국 모두)의 브라우저가 version.txt 불일치를 감지해
#     스스로 새로고침 = 고객이 수동으로 새로고침할 필요 없이 항상 최신 버전을 받는다.
#
# 사용법:  ./deploy.sh "ASCII commit message"
#   커밋 메시지는 반드시 ASCII (한국어 넣으면 Cloudflare 'Invalid commit message' 에러).
set -e

MSG="${1:-deploy}"
STAMP="$(date +%Y%m%d%H%M%S)"

# 1) version.txt = 새 stamp
printf '%s' "$STAMP" > version.txt

# 2) 내장 CV = 같은 stamp (버전 자동 갱신 블록)
#    2026-07-21: index.html/global_admin.html 만 하드코딩하던 것을 자동 탐지로 변경.
#    새 페이지에 자동갱신 블록을 넣고 여기 추가하는 걸 잊으면, 그 페이지는 CV 가 영영 안 바뀌어
#    version.txt 와 항상 불일치 = 무한 새로고침에 빠진다. 그래서 블록이 든 HTML 을 전부 찾아 갱신한다.
CV_FILES="$(grep -l "var CV = '" *.html 2>/dev/null)"
for _f in $CV_FILES; do
    sed -i "s/var CV = '[^']*';/var CV = '$STAMP';/" "$_f"
    grep -q "var CV = '$STAMP'" "$_f" || { echo "[deploy] ERROR: CV not updated in $_f"; exit 1; }
done
echo "[deploy] CV stamped: $(echo $CV_FILES | tr '\n' ' ')"

echo "[deploy] build stamp = $STAMP"

# 3) git
git add -A
git commit -m "$MSG (build $STAMP)" || echo "[deploy] nothing to commit"
git push origin main

# 4) Cloudflare Pages (7개 도메인 동시 배포)
npx wrangler pages deploy . --project-name=chameleon-print --commit-dirty=true --commit-message="$MSG build $STAMP"

echo "[deploy] done. build=$STAMP — 구버전 고객은 version.txt 불일치 감지 시 자동 새로고침됩니다."
