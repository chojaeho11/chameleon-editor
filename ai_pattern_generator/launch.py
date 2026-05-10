"""
Cotton Pattern Studio launcher (Python version)
===============================================
.bat 파일이 인코딩 문제로 안 될 때 사용. 동일하게 venv 자동 생성 + GUI 실행.

실행:  python launch.py
"""
import os
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).parent.resolve()
VENV_DIR = HERE / ".venv"
REQ_FILE = HERE / "requirements.txt"
GUI_FILE = HERE / "pattern_studio_gui.py"

VENV_PYTHON = VENV_DIR / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
VENV_PYTHONW = VENV_DIR / ("Scripts/pythonw.exe" if os.name == "nt" else "bin/python")


def run(cmd, **kw):
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    res = subprocess.run(cmd, **kw)
    if res.returncode != 0:
        sys.exit(f"  ✗ failed (code {res.returncode})")


def main():
    if not GUI_FILE.exists():
        sys.exit(f"✗ pattern_studio_gui.py not found in {HERE}")

    if not VENV_PYTHON.exists():
        print("[setup] Creating virtual environment...")
        run([sys.executable, "-m", "venv", str(VENV_DIR)])

        print("[setup] Installing dependencies (1-2 minutes)...")
        run([str(VENV_PYTHON), "-m", "pip", "install", "--upgrade", "pip", "--quiet"])
        run([str(VENV_PYTHON), "-m", "pip", "install", "-r", str(REQ_FILE)])
        print("[setup] Done.\n")

    # GUI 실행 — pythonw가 있으면 콘솔창 없이, 없으면 일반 python
    py = VENV_PYTHONW if VENV_PYTHONW.exists() else VENV_PYTHON
    print(f"[run] Launching GUI with {py.name}...")
    if os.name == "nt" and py.name == "pythonw.exe":
        # detached process — launcher 종료해도 GUI는 살아있음
        DETACHED = 0x00000008
        subprocess.Popen([str(py), str(GUI_FILE)], creationflags=DETACHED, close_fds=True)
    else:
        subprocess.Popen([str(py), str(GUI_FILE)])
    print("[run] GUI launched. You can close this window.")


if __name__ == "__main__":
    main()
