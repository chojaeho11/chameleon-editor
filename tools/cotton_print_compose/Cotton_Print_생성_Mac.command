#!/bin/bash
# Cotton Print - Mac 용 인쇄 데이터 생성기
# 더블클릭 → 자동 실행

cd "$(dirname "$0")"

SCRIPT_NAME="compose_fabric.py"
SCRIPT_URL="https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/compose_fabric.py"

clear
echo ""
echo "============================================================"
echo "  Cotton Print - 패브릭 인쇄 데이터 자동 생성"
echo "  Chameleon Printing"
echo "============================================================"
echo ""

# 1) Python 확인
if ! command -v python3 &> /dev/null; then
    echo "  [X] Python3 가 설치되어 있지 않습니다."
    echo ""
    echo "      해결법: 터미널에서 다음 실행 후 재시도"
    echo "      brew install python3"
    echo ""
    echo "      Homebrew 가 없으면: https://brew.sh"
    echo ""
    read -p "엔터를 눌러 종료" _
    exit 1
fi

PYVER=$(python3 --version)
echo "  [O] $PYVER 확인됨"

# 2) 합성 스크립트 다운로드
if [ ! -f "$SCRIPT_NAME" ]; then
    echo "  [..] 합성 스크립트 다운로드 중..."
    if ! curl -fsSL "$SCRIPT_URL" -o "$SCRIPT_NAME"; then
        echo "  [X] 다운로드 실패. 인터넷 연결 확인 후 재시도."
        echo "      또는 compose_fabric.py 를 이 파일과 같은 폴더에 직접 넣어주세요."
        read -p "엔터를 눌러 종료" _
        exit 1
    fi
    echo "  [O] 스크립트 다운로드 완료"
else
    # 7일 지나면 자동 업데이트
    if [ -n "$(find "$SCRIPT_NAME" -mtime +7 2>/dev/null)" ]; then
        echo "  [..] 스크립트 업데이트 확인 중..."
        curl -fsSL "$SCRIPT_URL" -o "$SCRIPT_NAME" 2>/dev/null
        echo "  [O] 스크립트 최신화 완료"
    else
        echo "  [O] 스크립트 준비됨"
    fi
fi

# 3) Pillow 확인 / 설치
if ! python3 -c "import PIL" &> /dev/null; then
    echo "  [..] Pillow 라이브러리 설치 중... (최초 1회만)"
    python3 -m pip install --quiet --upgrade pip &>/dev/null
    if ! python3 -m pip install --quiet Pillow; then
        echo "  [X] Pillow 설치 실패."
        read -p "엔터를 눌러 종료" _
        exit 1
    fi
    echo "  [O] Pillow 설치 완료"
else
    echo "  [O] Pillow 준비됨"
fi

echo ""
echo "============================================================"

# 메인 루프
while true; do
    # 4) 주문번호 입력
    echo ""
    read -p "  주문번호를 입력하세요 (예: 3553) : " ORDER_ID

    if [ -z "$ORDER_ID" ]; then
        echo "  [X] 주문번호가 입력되지 않았습니다."
        continue
    fi

    if ! [[ "$ORDER_ID" =~ ^[0-9]+$ ]]; then
        echo "  [X] 주문번호는 숫자만 입력하세요."
        continue
    fi

    # 5) 포맷 선택
    echo ""
    echo "  --- 출력 옵션 (그냥 Enter 누르면 기본값) ---"
    echo "    1) TIFF (인쇄소 표준, 기본)"
    echo "    2) JPG  (용량 작음)"
    echo "    3) PNG  (투명 배경)"
    echo ""
    read -p "  포맷 선택 (1/2/3, Enter=1): " FMT_CHOICE

    EXTRA_ARGS=""
    [ "$FMT_CHOICE" = "2" ] && EXTRA_ARGS="--format jpg"
    [ "$FMT_CHOICE" = "3" ] && EXTRA_ARGS="--format png"

    echo ""
    read -p "  특정 항목만? (0=첫번째, Enter=전체): " ITEM_IDX
    [ -n "$ITEM_IDX" ] && EXTRA_ARGS="$EXTRA_ARGS --item-idx $ITEM_IDX"

    # 6) 실행
    echo ""
    echo "============================================================"
    echo "  주문 #$ORDER_ID 합성 시작..."
    echo "============================================================"
    echo ""

    python3 "$SCRIPT_NAME" --order-id "$ORDER_ID" $EXTRA_ARGS
    EXIT_CODE=$?

    echo ""
    echo "============================================================"

    if [ $EXIT_CODE -ne 0 ]; then
        echo "  [X] 실행 실패."
        echo "============================================================"
        read -p "엔터를 눌러 계속" _
        continue
    fi

    echo "  [O] 완료! 출력 폴더를 엽니다."
    echo "============================================================"
    echo ""

    [ -d "output" ] && open "output"

    echo "  다른 주문 처리하려면 Enter, 종료하려면 Ctrl+C"
    read -p "" _
    clear
done
