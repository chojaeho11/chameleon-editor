"""
바탕화면 바로가기 생성 스크립트 (강화판)
=====================================
"Cotton Pattern Studio.lnk"를 바탕화면에 생성합니다.

3단계 폴백:
  1. PowerShell COM (WScript.Shell) - 가장 표준적
  2. 만약 .lnk 생성 실패하면 → 같은 위치에 'Cotton Pattern Studio.bat' 복사
  3. 실패해도 항상 어디에 생성하려 시도했는지 로그 출력

실행: python install_desktop_shortcut.py
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from typing import Tuple

# Windows 콘솔이 cp949여도 유니코드 출력 안 깨지게
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HERE = Path(__file__).parent.resolve()
TARGET_BAT = HERE / "start_studio.bat"
GUI_SCRIPT = HERE / "pattern_studio_gui.py"
LAUNCH_SCRIPT = HERE / "launch.py"
VENV_PYTHONW = HERE / ".venv" / "Scripts" / "pythonw.exe"
VENV_PYTHON = HERE / ".venv" / "Scripts" / "python.exe"


def find_desktop() -> Path:
    """바탕화면 경로 찾기 — OneDrive Desktop 우선, 후보 모두 시도."""
    candidates = []
    home = Path.home()

    # 1순위: PowerShell이 알려주는 'Desktop' 폴더 (가장 정확)
    try:
        ps_desktop = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "[Environment]::GetFolderPath('Desktop')"],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=5,
        )
        if ps_desktop.returncode == 0:
            p = Path(ps_desktop.stdout.strip())
            if p.exists():
                candidates.append(p)
    except Exception:
        pass

    # 2순위: OneDrive 경로
    onedrive = os.environ.get("OneDrive") or os.environ.get("OneDriveConsumer") or os.environ.get("OneDriveCommercial")
    if onedrive:
        candidates.append(Path(onedrive) / "Desktop")
        candidates.append(Path(onedrive) / "바탕 화면")

    # 3순위: home/USERPROFILE
    for base in [home, Path(os.environ.get("USERPROFILE", str(home)))]:
        candidates.append(base / "Desktop")
        candidates.append(base / "바탕 화면")
        candidates.append(base / "OneDrive" / "Desktop")
        candidates.append(base / "OneDrive" / "바탕 화면")

    # 첫 번째로 존재하는 것
    for p in candidates:
        try:
            if p.exists() and p.is_dir():
                return p
        except Exception:
            continue
    # 폴백
    return home / "Desktop"


def create_lnk_via_powershell(shortcut_path: Path) -> Tuple[bool, str]:
    """PowerShell COM으로 .lnk 생성. .bat 거치지 않고 pythonw.exe 직접 실행.

    target/argument 결정:
      - venv가 있고 pythonw.exe 존재 → pythonw.exe + pattern_studio_gui.py
      - venv가 없으면 → 시스템 python.exe + launch.py (자동 setup + 실행)

    .lnk가 .bat을 가리키면 OneDrive Online-only 상태에서 실행 안 되거나
    파일 연결이 메모장으로 바뀌면 메모장에서 열림. .lnk가 pythonw.exe를
    직접 가리키면 두 문제 모두 우회됨.
    """
    if VENV_PYTHONW.exists():
        target_exe = VENV_PYTHONW
        arg_script = GUI_SCRIPT
    elif VENV_PYTHON.exists():
        target_exe = VENV_PYTHON
        arg_script = GUI_SCRIPT
    else:
        # venv 미생성 → launch.py가 venv 만들고 GUI 띄움 (콘솔창 보임)
        target_exe = Path(sys.executable).with_name("pythonw.exe")
        if not target_exe.exists():
            target_exe = Path(sys.executable)
        arg_script = LAUNCH_SCRIPT

    ps_script = (
        '$ErrorActionPreference = "Stop"; '
        f'$lnk = "{shortcut_path}"; '
        f'$tgt = "{target_exe}"; '
        f'$arg = "`"{arg_script}`""; '
        f'$wd  = "{HERE}"; '
        'try {'
        '  $WshShell = New-Object -ComObject WScript.Shell;'
        '  $s = $WshShell.CreateShortcut($lnk);'
        '  $s.TargetPath = $tgt;'
        '  $s.Arguments = $arg;'
        '  $s.WorkingDirectory = $wd;'
        '  $s.WindowStyle = 7;'
        '  $s.Description = "Cotton Print AI 패턴 생성기";'
        '  $s.Save();'
        '  if (Test-Path $lnk) { Write-Output "OK:$lnk" }'
        '  else { Write-Output "NOFILE:$lnk"; exit 2 }'
        '} catch {'
        '  Write-Output ("ERR:" + $_.Exception.Message);'
        '  exit 3'
        '}'
    )
    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
             "-Command", ps_script],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=15,
        )
        out = (res.stdout or "").strip()
        err = (res.stderr or "").strip()
        log = f"  PS exit={res.returncode}\n  stdout: {out}\n  stderr: {err}"
        # 파일 실제 생성 검증
        if shortcut_path.exists():
            return True, log + "\n  ✓ 파일 검증 OK"
        return False, log + "\n  ✗ Save()는 호출됐지만 파일이 없음"
    except subprocess.TimeoutExpired:
        return False, "  ✗ PowerShell 타임아웃 (15초)"
    except Exception as e:
        return False, f"  ✗ PowerShell 실행 오류: {e}"


def fallback_create_wrapper_bat(desktop: Path) -> Path:
    """폴백: 절대경로로 원본 폴더의 GUI를 실행하는 wrapper .bat 생성.

    원본 .bat을 그대로 복사하면 %~dp0가 바탕화면을 가리켜서
    venv를 못 찾음. 이 wrapper는 무조건 원본 폴더로 cd 한 뒤 실행."""
    target = desktop / "Cotton Pattern Studio.bat"
    venv_pyw = HERE / ".venv" / "Scripts" / "pythonw.exe"
    venv_py = HERE / ".venv" / "Scripts" / "python.exe"
    gui = HERE / "pattern_studio_gui.py"
    launcher = HERE / "launch.py"
    start_bat = HERE / "start_studio.bat"

    content = (
        '@echo off\r\n'
        'chcp 65001 >nul\r\n'
        f'cd /d "{HERE}"\r\n'
        f'if exist "{venv_pyw}" (\r\n'
        f'    start "" "{venv_pyw}" "{gui}"\r\n'
        f') else if exist "{venv_py}" (\r\n'
        f'    start "" "{venv_py}" "{gui}"\r\n'
        f') else (\r\n'
        f'    REM venv 미생성 — 원본 setup .bat으로 폴백\r\n'
        f'    call "{start_bat}"\r\n'
        ')\r\n'
    )
    # ASCII로 저장 (cmd.exe가 cp949로 파싱)
    target.write_text(content, encoding="ascii", errors="replace")
    return target


def main():
    if os.name != "nt":
        sys.exit("Windows에서만 동작합니다.")
    if not TARGET_BAT.exists():
        sys.exit(f"start_studio.bat이 없습니다: {TARGET_BAT}")

    desktop = find_desktop()
    print(f"[info] 바탕화면 경로: {desktop}")
    print(f"[info] 바탕화면 존재: {desktop.exists()}")

    if not desktop.exists():
        try:
            desktop.mkdir(parents=True, exist_ok=True)
            print(f"[info] 바탕화면 폴더 생성됨")
        except Exception as e:
            print(f"[warn] 바탕화면 폴더 생성 실패: {e}")

    shortcut_path = desktop / "Cotton Pattern Studio.lnk"
    fallback_bat = desktop / "Cotton Pattern Studio.bat"
    print(f"[info] 생성할 바로가기: {shortcut_path}")

    # 기존 (망가진 가능성 있는) 바로가기 정리 — 재설치 시
    for old in [shortcut_path, fallback_bat]:
        if old.exists():
            try:
                old.unlink()
                print(f"[info] 기존 파일 삭제: {old.name}")
            except Exception as e:
                print(f"[warn] 기존 파일 삭제 실패: {e}")

    # 시도 1: PowerShell COM으로 .lnk 생성
    print("\n[try 1] PowerShell COM으로 .lnk 생성 중...")
    ok, log = create_lnk_via_powershell(shortcut_path)
    print(log)

    if ok:
        print(f"\n✅ 성공! 바탕화면을 확인하세요:")
        print(f"   {shortcut_path}")
        return

    # 시도 2: 절대경로 wrapper .bat 생성
    print("\n[try 2] .lnk 실패 → 절대경로 wrapper .bat 생성으로 폴백")
    try:
        target = fallback_create_wrapper_bat(desktop)
        if target.exists():
            print(f"\n✅ 폴백 성공! 바탕화면에 wrapper .bat 생성됨:")
            print(f"   {target}")
            print(f"   더블클릭하면 GUI가 실행됩니다.")
            return
        else:
            print(f"\n✗ 폴백도 실패: 생성 후 파일이 없음")
    except Exception as e:
        print(f"\n✗ 폴백 실패: {e}")

    # 모든 시도 실패
    print("\n" + "=" * 60)
    print("✗ 바로가기 생성에 실패했습니다.")
    print("=" * 60)
    print(f"\n수동으로 만드시려면:")
    print(f"1. 파일 탐색기에서 다음 폴더 열기:")
    print(f"   {HERE}")
    print(f"2. 'start_studio.bat' 파일을 우클릭 → '바로 가기 만들기'")
    print(f"3. 만들어진 .lnk 파일을 바탕화면으로 끌어다 놓기")
    sys.exit(1)


if __name__ == "__main__":
    main()
