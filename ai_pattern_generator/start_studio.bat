@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM Cotton Pattern Studio launcher (ASCII-only, no Korean comments)

if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo [error] Could not create venv. Is Python installed?
        echo Install from: https://www.python.org/downloads/
        pause
        exit /b 1
    )

    echo [setup] Installing dependencies (this takes 1-2 minutes)...
    ".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [error] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo [setup] Done.
    echo.
)

REM Use pythonw if available (no console window), else fall back to python
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" pattern_studio_gui.py
) else (
    ".venv\Scripts\python.exe" pattern_studio_gui.py
)

endlocal
