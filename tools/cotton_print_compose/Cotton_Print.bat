@echo off
title Cotton Print Composer
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM ============================================================
REM Cotton Print GUI Launcher (Auto-Update Edition)
REM - Always tries to download latest gui.py and compose_fabric.py
REM - Falls back to local copy if offline / download fails
REM - Launches GUI with pythonw (no console window)
REM ============================================================

set "GUI_NAME=gui.py"
set "SCRIPT_NAME=compose_fabric.py"

REM Cloudflare Pages URL (public, always-on, CDN cached)
set "BASE_URL=https://www.cafe2626.com/tools/cotton_print_compose"

REM --- 1) Check Python ----------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [X] Python is NOT installed.
    echo.
    echo      Install from: https://www.python.org/downloads/
    echo      IMPORTANT: Check "Add Python to PATH" during install
    echo.
    timeout /t 3 >nul
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

REM --- 2) Auto-update: silent download of latest files --------
REM Cache-buster ?t=%RANDOM% to bypass any Cloudflare caching
echo  Checking for updates...

REM Download GUI (silent, with timeout)
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%BASE_URL%/%GUI_NAME%?t=%RANDOM%' -OutFile '%GUI_NAME%.new' -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop } catch { }" 2>nul
if exist "%GUI_NAME%.new" (
    REM Sanity: new file must be non-empty
    for %%I in ("%GUI_NAME%.new") do if %%~zI GTR 1000 (
        move /Y "%GUI_NAME%.new" "%GUI_NAME%" >nul
        echo  [OK] GUI updated
    ) else (
        del /Q "%GUI_NAME%.new" >nul 2>&1
    )
)

REM Download compose script
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%BASE_URL%/%SCRIPT_NAME%?t=%RANDOM%' -OutFile '%SCRIPT_NAME%.new' -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop } catch { }" 2>nul
if exist "%SCRIPT_NAME%.new" (
    for %%I in ("%SCRIPT_NAME%.new") do if %%~zI GTR 1000 (
        move /Y "%SCRIPT_NAME%.new" "%SCRIPT_NAME%" >nul
        echo  [OK] Compose engine updated
    ) else (
        del /Q "%SCRIPT_NAME%.new" >nul 2>&1
    )
)

REM --- 3) Verify files exist ---------------------------------
if not exist "%GUI_NAME%" (
    echo.
    echo  [X] gui.py not found and download failed.
    echo      Check internet connection and try again.
    pause
    exit /b 1
)
if not exist "%SCRIPT_NAME%" (
    echo.
    echo  [X] compose_fabric.py not found and download failed.
    echo      Check internet connection and try again.
    pause
    exit /b 1
)

REM --- 4) Launch GUI without console window ------------------
REM Prefer pythonw.exe (no console). Fall back to python.exe.
where pythonw.exe >nul 2>&1
if not errorlevel 1 (
    start "" pythonw.exe "%~dp0%GUI_NAME%"
) else (
    start "" python.exe "%~dp0%GUI_NAME%"
)

exit /b 0
