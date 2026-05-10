@echo off
REM Cotton Pattern Studio launcher
REM 더블클릭하면 GUI 실행. 가상환경 자동 활성화 + 의존성 자동 설치.

cd /d "%~dp0"

REM 가상환경 없으면 생성
if not exist ".venv\Scripts\python.exe" (
    echo [setup] 가상환경 생성 중...
    python -m venv .venv
    if errorlevel 1 (
        echo [error] python을 찾을 수 없습니다. https://python.org 에서 설치하세요.
        pause
        exit /b 1
    )
    echo [setup] 의존성 설치 중...
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

REM GUI 실행 (콘솔창 안 보이게)
start "" ".venv\Scripts\pythonw.exe" pattern_studio_gui.py
