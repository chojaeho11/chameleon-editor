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

# 2) index.html + global_admin.html 내장 CV = 같은 stamp (버전 자동 갱신 블록)
sed -i "s/var CV = '[^']*';/var CV = '$STAMP';/" index.html
sed -i "s/var CV = '[^']*';/var CV = '$STAMP';/" global_admin.html

echo "[deploy] build stamp = $STAMP"
grep -n "var CV = '$STAMP'" index.html >/dev/null && echo "[deploy] index.html CV updated OK" || { echo "[deploy] ERROR: CV not updated in index.html"; exit 1; }
grep -n "var CV = '$STAMP'" global_admin.html >/dev/null && echo "[deploy] global_admin.html CV updated OK" || echo "[deploy] WARN: CV not updated in global_admin.html"

# 3) git
git add -A
git commit -m "$MSG (build $STAMP)" || echo "[deploy] nothing to commit"
git push origin main

# 4) Cloudflare Pages (7개 도메인 동시 배포)
npx wrangler pages deploy . --project-name=chameleon-print --commit-dirty=true --commit-message="$MSG build $STAMP"

echo "[deploy] done. build=$STAMP — 구버전 고객은 version.txt 불일치 감지 시 자동 새로고침됩니다."
