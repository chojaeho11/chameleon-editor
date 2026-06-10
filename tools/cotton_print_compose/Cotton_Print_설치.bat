@echo off
title Cotton Print - Installer
setlocal EnableDelayedExpansion

REM ============================================================
REM Cotton Print One-File Installer
REM
REM Share this single file via KakaoTalk.
REM Manager double-clicks -> Auto installs to Desktop\Cotton_Print
REM
REM ============================================================

set "BASE_URL=https://www.cafe2626.com/tools/cotton_print_compose"
set "INSTALL_DIR=%USERPROFILE%\Desktop\Cotton_Print"

cls
echo.
echo  ============================================================
echo    Cotton Print - Fabric Print Composer
echo    Auto Installer  ^|  Chameleon Printing
echo  ============================================================
echo.
echo  This will install Cotton Print Composer to:
echo    %INSTALL_DIR%
echo.
echo  Files will be downloaded automatically.
echo  No admin rights required.
echo.
pause

REM --- 1) Check Python ----------------------------------------
echo.
echo  [1/5] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [X] Python is NOT installed.
    echo.
    echo  ============================================================
    echo   Please install Python first:
    echo   1. Download page will open automatically
    echo   2. Click "Download Python 3.x"
    echo   3. IMPORTANT: Check "Add Python to PATH" during install
    echo   4. Re-run this installer after Python is installed
    echo  ============================================================
    echo.
    timeout /t 5 >nul
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PYVER=%%i"
echo       [OK] !PYVER!

REM --- 2) Create install folder -------------------------------
echo.
echo  [2/5] Creating install folder...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if errorlevel 1 (
        echo  [X] Cannot create folder. Try as Administrator.
        pause
        exit /b 1
    )
)
echo       [OK] %INSTALL_DIR%

REM --- 3) Download files --------------------------------------
echo.
echo  [3/5] Downloading files (please wait)...
cd /d "%INSTALL_DIR%"

for %%F in (gui.py compose_fabric.py Cotton_Print_생성.bat) do (
    echo       Downloading %%F ...
    powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%BASE_URL%/%%F?t=%RANDOM%' -OutFile '%%F' -UseBasicParsing -TimeoutSec 30 } catch { exit 1 }" 2>nul
    if not exist "%%F" (
        echo  [X] Failed to download %%F
        echo      Check internet connection.
        pause
        exit /b 1
    )
)
echo       [OK] All files downloaded

REM --- 4) Install Pillow --------------------------------------
echo.
echo  [4/5] Installing Pillow library...
python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo       Installing Pillow ^(takes 1-2 minutes^)...
    python -m pip install --quiet --upgrade pip >nul 2>&1
    python -m pip install --quiet Pillow >nul 2>&1
    python -c "import PIL" >nul 2>&1
    if errorlevel 1 (
        echo       [X] Pillow install failed
        echo           Try: python -m pip install Pillow
        pause
        exit /b 1
    )
    echo       [OK] Pillow installed
) else (
    echo       [OK] Pillow already installed
)

REM --- 5) Create Desktop Shortcut ----------------------------
echo.
echo  [5/5] Creating Desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\Cotton Print.lnk"
set "TARGET=%INSTALL_DIR%\Cotton_Print_생성.bat"

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%'); $s.TargetPath='%TARGET%'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.IconLocation='%SystemRoot%\System32\imageres.dll,68'; $s.Description='Cotton Print Fabric Composer'; $s.Save()" 2>nul
if exist "%SHORTCUT%" (
    echo       [OK] Shortcut created on Desktop
) else (
    echo       [!] Shortcut creation skipped ^(non-critical^)
)

REM --- Done ---------------------------------------------------
echo.
echo  ============================================================
echo    [OK] Installation Complete!
echo  ============================================================
echo.
echo    How to use:
echo    1. Double-click "Cotton Print" shortcut on Desktop
echo       OR open %INSTALL_DIR%\Cotton_Print_생성.bat
echo    2. Enter order number in GUI
echo    3. Click "Generate Print Data"
echo.
echo    Auto-Updates:
echo    Every time you launch the BAT, the latest version
echo    is automatically downloaded. No manual update needed.
echo.
echo  ============================================================
echo.
echo  Launching GUI now...
timeout /t 2 >nul

REM Launch GUI
where pythonw.exe >nul 2>&1
if not errorlevel 1 (
    start "" pythonw.exe "%INSTALL_DIR%\gui.py"
) else (
    start "" python.exe "%INSTALL_DIR%\gui.py"
)

echo.
echo  Press any key to close this installer...
pause >nul
exit /b 0
