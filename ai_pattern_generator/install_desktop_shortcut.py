"""
바탕화면 바로가기 생성 스크립트
==============================
"Cotton Pattern Studio.lnk"를 사용자 바탕화면에 만듭니다.
PowerShell의 WScript.Shell COM을 호출하므로 추가 패키지 불필요.

실행: python install_desktop_shortcut.py
"""

import os
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).parent.resolve()
TARGET_BAT = HERE / "start_studio.bat"
ICON_PATH = HERE / "studio.ico"  # 있으면 사용, 없으면 기본 아이콘


def find_desktop() -> Path:
    """바탕화면 경로 찾기 — OneDrive 경로도 고려."""
    candidates = []
    home = Path.home()
    # OneDrive Desktop
    onedrive = os.environ.get("OneDrive") or os.environ.get("OneDriveConsumer")
    if onedrive:
        candidates.append(Path(onedrive) / "Desktop")
        candidates.append(Path(onedrive) / "바탕 화면")
    # 일반 Desktop
    candidates.append(home / "Desktop")
    candidates.append(home / "바탕 화면")
    # USERPROFILE
    up = os.environ.get("USERPROFILE")
    if up:
        candidates.append(Path(up) / "Desktop")
        candidates.append(Path(up) / "바탕 화면")
    for p in candidates:
        if p.exists():
            return p
    return home / "Desktop"


def create_shortcut():
    if os.name != "nt":
        sys.exit("Windows에서만 동작합니다.")
    if not TARGET_BAT.exists():
        sys.exit(f"start_studio.bat이 없습니다: {TARGET_BAT}")

    desktop = find_desktop()
    shortcut_path = desktop / "Cotton Pattern Studio.lnk"

    icon_arg = f'$s.IconLocation = "{ICON_PATH}"' if ICON_PATH.exists() else ""

    ps_script = f"""
$WshShell = New-Object -ComObject WScript.Shell
$s = $WshShell.CreateShortcut("{shortcut_path}")
$s.TargetPath = "{TARGET_BAT}"
$s.WorkingDirectory = "{HERE}"
$s.WindowStyle = 7
$s.Description = "Cotton Print AI 패턴 생성기"
{icon_arg}
$s.Save()
Write-Host "✓ 바로가기 생성됨: {shortcut_path}"
"""

    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        print("✗ 바로가기 생성 실패:")
        print(result.stderr)
        sys.exit(1)
    print(result.stdout.strip() or f"✓ 생성 완료: {shortcut_path}")
    print(f"\n바탕화면에서 'Cotton Pattern Studio'를 더블클릭하면 GUI가 열립니다.")


if __name__ == "__main__":
    create_shortcut()
