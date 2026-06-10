@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Cotton Print - 인쇄 데이터 생성

REM ============================================================
REM Cotton Print 인쇄 데이터 자동 생성기
REM 단일 BAT 파일 — 카톡으로 받아 바탕화면에 저장 후 더블클릭
REM ============================================================

set "SCRIPT_NAME=compose_fabric.py"
set "SCRIPT_URL=https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/compose_fabric.py"
set "WORK_DIR=%~dp0"
cd /d "%WORK_DIR%"

cls
echo.
echo  ============================================================
echo    Cotton Print - 패브릭 인쇄 데이터 자동 생성
echo    Chameleon Printing
echo  ============================================================
echo.

REM ─── 1) Python 설치 확인 ───────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [X] Python 이 설치되어 있지 않습니다.
    echo.
    echo      ----------------------------------------
    echo      다음 단계를 진행해주세요:
    echo      ----------------------------------------
    echo      1. https://www.python.org/downloads/
    echo      2. "Download Python 3.x" 클릭
    echo      3. 설치 시 "Add Python to PATH" 반드시 체크
    echo      4. 설치 완료 후 이 파일 다시 실행
    echo.
    echo      자동으로 다운로드 페이지를 엽니다...
    timeout /t 3 >nul
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

REM Python 버전 출력
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo  [O] %PYVER% 확인됨

REM ─── 2) 합성 스크립트 다운로드 (없으면) ────────────────
if not exist "%SCRIPT_NAME%" (
    echo  [..] 합성 스크립트 다운로드 중...
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%SCRIPT_NAME%' -UseBasicParsing } catch { exit 1 }" 2>nul
    if not exist "%SCRIPT_NAME%" (
        echo  [X] 다운로드 실패. 인터넷 연결을 확인 후 다시 시도해주세요.
        pause
        exit /b 1
    )
    echo  [O] 스크립트 다운로드 완료
) else (
    REM 일주일에 한번씩 자동 업데이트
    forfiles /M "%SCRIPT_NAME%" /D -7 /C "cmd /c echo OUTDATED" 2>nul | findstr OUTDATED >nul
    if not errorlevel 1 (
        echo  [..] 스크립트 업데이트 확인 중...
        powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%SCRIPT_NAME%' -UseBasicParsing } catch { }" 2>nul
        echo  [O] 스크립트 최신화 완료
    ) else (
        echo  [O] 스크립트 준비됨
    )
)

REM ─── 3) Pillow 설치 확인 ────────────────────────────────
python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo  [..] Pillow 라이브러리 설치 중... ^(최초 1회만^)
    python -m pip install --quiet --upgrade pip >nul 2>&1
    python -m pip install --quiet Pillow >nul 2>&1
    python -c "import PIL" >nul 2>&1
    if errorlevel 1 (
        echo  [X] Pillow 설치 실패. 관리자 권한으로 다시 실행해보세요.
        pause
        exit /b 1
    )
    echo  [O] Pillow 설치 완료
) else (
    echo  [O] Pillow 준비됨
)

echo.
echo  ============================================================

REM ─── 4) 주문번호 입력 ───────────────────────────────────
:ASK_ORDER
echo.
set "ORDER_ID="
set /p "ORDER_ID=  주문번호를 입력하세요 (예: 3553) : "

if "%ORDER_ID%"=="" (
    echo.
    echo  [X] 주문번호가 입력되지 않았습니다.
    goto ASK_ORDER
)

REM 숫자만 통과
echo %ORDER_ID%| findstr /R "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo.
    echo  [X] 주문번호는 숫자만 입력하세요. 입력값: %ORDER_ID%
    goto ASK_ORDER
)

REM ─── 5) 출력 옵션 (선택) ────────────────────────────────
echo.
echo  --- 출력 옵션 (선택 사항, 그냥 Enter 누르면 기본값) ---
echo     1) TIFF (인쇄소 표준, 기본)
echo     2) JPG  (용량 작음, 일반 확인용)
echo     3) PNG  (투명 배경 지원)
echo.
set /p "FMT_CHOICE=  포맷 선택 (1/2/3, Enter=1): "

set "EXTRA_ARGS="
if "%FMT_CHOICE%"=="2" set "EXTRA_ARGS=--format jpg"
if "%FMT_CHOICE%"=="3" set "EXTRA_ARGS=--format png"

REM 특정 항목 (대부분 비워둠)
echo.
set /p "ITEM_IDX=  특정 항목만? (0=첫번째, Enter=전체): "
if not "%ITEM_IDX%"=="" set "EXTRA_ARGS=%EXTRA_ARGS% --item-idx %ITEM_IDX%"

REM ─── 6) 실행 ───────────────────────────────────────────
echo.
echo  ============================================================
echo    주문 #%ORDER_ID% 합성 시작...
echo  ============================================================
echo.

python "%SCRIPT_NAME%" --order-id %ORDER_ID% %EXTRA_ARGS%
set EXIT_CODE=%errorlevel%

echo.
echo  ============================================================

if %EXIT_CODE% NEQ 0 (
    echo    [X] 실행 실패. 위 메시지 확인 후 매니저에게 문의.
    echo  ============================================================
    echo.
    pause
    exit /b %EXIT_CODE%
)

echo    [O] 완료!  결과물은 output 폴더에 저장되었습니다.
echo  ============================================================
echo.

REM ─── 7) 출력 폴더 열기 ─────────────────────────────────
if exist "output" (
    echo  output 폴더를 엽니다...
    start "" "%WORK_DIR%output"
) else (
    echo  [!] output 폴더를 찾을 수 없습니다.
)

echo.
echo  다른 주문을 처리하려면 Enter, 종료하려면 창 닫기
pause >nul
cls
goto ASK_ORDER
