@echo off
title Cotton Print Composer
setlocal
cd /d "%~dp0"

REM ============================================================
REM Cotton Print GUI Launcher
REM Checks Python, downloads gui.py if missing, then launches GUI
REM ============================================================

set "GUI_NAME=gui.py"
set "SCRIPT_NAME=compose_fabric.py"
set "GUI_URL=https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/gui.py"
set "SCRIPT_URL=https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/compose_fabric.py"

REM --- 1) Check Python ----------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [X] Python is not installed.
    echo.
    echo      Install from: https://www.python.org/downloads/
    echo      IMPORTANT: Check "Add Python to PATH" during install
    echo.
    echo      Opening download page...
    timeout /t 3 >nul
    start "" "https://www.python.org/downloads/"
    pause
    exit /b 1
)

REM --- 2) Download GUI script if missing ---------------------
if not exist "%GUI_NAME%" (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%GUI_URL%' -OutFile '%GUI_NAME%' -UseBasicParsing } catch { exit 1 }" 2>nul
    if not exist "%GUI_NAME%" (
        echo.
        echo  [X] gui.py download failed.
        echo      Place gui.py in this folder manually.
        pause
        exit /b 1
    )
)

REM --- 3) Download compose script if missing -----------------
if not exist "%SCRIPT_NAME%" (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%SCRIPT_URL%' -OutFile '%SCRIPT_NAME%' -UseBasicParsing } catch { exit 1 }" 2>nul
)

REM --- 4) Launch GUI (no console window) ---------------------
REM pythonw.exe runs without showing a console window
start "" pythonw.exe "%~dp0%GUI_NAME%"

REM Wait briefly to detect if pythonw failed
timeout /t 2 >nul

REM If pythonw.exe is not available, fall back to python.exe
REM (older Python versions may not have pythonw)
tasklist /FI "IMAGENAME eq pythonw.exe" 2>nul | find /I "pythonw.exe" >nul
if errorlevel 1 (
    REM pythonw not running — try python.exe instead
    where pythonw.exe >nul 2>&1
    if errorlevel 1 (
        start "" python.exe "%~dp0%GUI_NAME%"
    )
)

exit /b 0
