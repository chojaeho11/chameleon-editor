@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Cotton Print - Fabric Print Composer

REM ============================================================
REM Cotton Print - Fabric Print Composer (Auto Setup + Run)
REM Save to Desktop, double-click to run.
REM ============================================================

set "SCRIPT_NAME=compose_fabric.py"
set "SCRIPT_URL=https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/compose_fabric.py"
set "WORK_DIR=%~dp0"
cd /d "%WORK_DIR%"

cls
echo.
echo  ============================================================
echo    Cotton Print - Fabric Print Data Composer
echo    Chameleon Printing
echo  ============================================================
echo.

REM --- 1) Check Python ----------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo  [X] Python is NOT installed.
    echo.
    echo      Please:
    echo      1. https://www.python.org/downloads/
    echo      2. Click "Download Python 3.x"
    echo      3. CHECK "Add Python to PATH" during install
    echo      4. Re-run this file after install
    echo.
    echo      Opening download page in 3 seconds...
    timeout /t 3 >nul
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PYVER=%%i"
echo  [OK] !PYVER!

REM --- 2) Download script if missing --------------------------
if not exist "%SCRIPT_NAME%" (
    echo  [..] Downloading compose script...
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%SCRIPT_NAME%' -UseBasicParsing } catch { exit 1 }" 2>nul
    if not exist "%SCRIPT_NAME%" (
        echo  [X] Download failed.
        echo      Please put compose_fabric.py in the same folder as this BAT.
        pause
        exit /b 1
    )
    echo  [OK] Script downloaded
) else (
    echo  [OK] Script ready
)

REM --- 3) Check Pillow ----------------------------------------
python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo  [..] Installing Pillow library... ^(first run only^)
    python -m pip install --quiet --upgrade pip >nul 2>&1
    python -m pip install --quiet Pillow >nul 2>&1
    python -c "import PIL" >nul 2>&1
    if errorlevel 1 (
        echo  [X] Pillow install failed. Try running as Administrator.
        pause
        exit /b 1
    )
    echo  [OK] Pillow installed
) else (
    echo  [OK] Pillow ready
)

echo.
echo  ============================================================

REM --- 4) Main loop -------------------------------------------
:ASK_ORDER
echo.
set "ORDER_ID="
set /p "ORDER_ID=  Enter order number (ex: 3553): "

if "%ORDER_ID%"=="" (
    echo  [X] No order number entered.
    goto ASK_ORDER
)

echo %ORDER_ID%| findstr /R "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo  [X] Order number must be digits only. Got: %ORDER_ID%
    goto ASK_ORDER
)

echo.
echo  --- Output Format ---
echo     1) TIFF  ^(print standard, default^)
echo     2) JPG   ^(smaller file size^)
echo     3) PNG   ^(transparent background^)
echo.
set "FMT_CHOICE="
set /p "FMT_CHOICE=  Format (1/2/3, Enter=1): "

set "EXTRA_ARGS="
if "%FMT_CHOICE%"=="2" set "EXTRA_ARGS=--format jpg"
if "%FMT_CHOICE%"=="3" set "EXTRA_ARGS=--format png"

echo.
set "ITEM_IDX="
set /p "ITEM_IDX=  Specific item? (0=first, Enter=all): "
if not "%ITEM_IDX%"=="" set "EXTRA_ARGS=!EXTRA_ARGS! --item-idx !ITEM_IDX!"

echo.
echo  ============================================================
echo    Order #%ORDER_ID% - Composing...
echo  ============================================================
echo.

python "%SCRIPT_NAME%" --order-id %ORDER_ID% !EXTRA_ARGS!
set "EXIT_CODE=!errorlevel!"

echo.
echo  ============================================================

if !EXIT_CODE! NEQ 0 (
    echo    [X] Failed. Check messages above.
    echo  ============================================================
    echo.
    pause
    goto ASK_ORDER
)

echo    [OK] Done!  Files saved in output\ folder.
echo  ============================================================
echo.

if exist "output" (
    echo  Opening output folder...
    start "" "%WORK_DIR%output"
)

echo.
echo  Press Enter to process another order, or close window to exit.
pause >nul
cls
goto ASK_ORDER
