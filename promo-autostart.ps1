# ============================================================
# promo-autostart.ps1 — 홍보사진 자동 업로드를 Windows 작업 스케줄러에 등록
# 2026-07-17
#
# 이걸 한 번만 실행하면, 그 뒤로는 카톡 사진을 폴더에 넣기만 하면 끝입니다.
#   - 5분마다 promo-sync.sh 가 알아서 새 사진을 올립니다 (사진 없으면 조용히 끝)
#   - 서버 cron(promo-publish-daily)이 매일 18시에 글을 발행합니다
#
# 실행법 (PowerShell 에서 1회):
#   cd "C:\Users\win 10\Desktop\작업"
#   powershell -ExecutionPolicy Bypass -File .\promo-autostart.ps1
#
# 해제:  Unregister-ScheduledTask -TaskName "홍보사진 자동업로드" -Confirm:$false
# 상태:  Get-ScheduledTask -TaskName "홍보사진 자동업로드"
# 즉시 1회 실행:  Start-ScheduledTask -TaskName "홍보사진 자동업로드"
# ============================================================

$TaskName = "홍보사진 자동업로드"
$WorkDir  = Split-Path -Parent $MyInvocation.MyCommand.Path

# Git Bash 경로 찾기 (promo-sync.sh 는 bash 스크립트)
$BashCandidates = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)
$Bash = $BashCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Bash) {
    Write-Host "[promo] ERROR: Git Bash(bash.exe)를 찾지 못했습니다. Git for Windows 가 설치돼 있어야 합니다." -ForegroundColor Red
    exit 1
}
Write-Host "[promo] bash: $Bash"
Write-Host "[promo] 작업폴더: $WorkDir"

# bash 용 경로로 변환 (C:\Users\... -> /c/Users/...)
$BashWorkDir = $WorkDir -replace '\\', '/' -replace '^([A-Za-z]):', '/$1'
$BashWorkDir = $BashWorkDir.Substring(0,2).ToLower() + $BashWorkDir.Substring(2)

$Action = New-ScheduledTaskAction -Execute $Bash `
    -Argument "-lc `"cd '$BashWorkDir' && ./promo-sync.sh >> promo-sync.log 2>&1`""

# 2026-07-17: 30분 → 5분.
#   30분이면 "사진 넣고 바로 [지금 발행]" 을 눌렀을 때 아직 업로드 전이라
#   "대기 중인 사진이 없습니다" 가 뜬다(실제로 발생). 사진이 없으면 즉시 끝나므로 5분도 부담 없음.
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew

# 기존 등록이 있으면 교체
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[promo] 기존 등록 제거"
}

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Description "카카오톡 받은 파일/홍보사진 폴더의 새 사진을 5분마다 업로드. 발행은 서버 cron(매일 18시)이 담당." | Out-Null

Write-Host ""
Write-Host "[promo] 등록 완료 - '$TaskName'" -ForegroundColor Green
Write-Host "  * 5분마다 새 사진을 자동 업로드합니다 (PC 가 켜져 있을 때)"
Write-Host "  * 매일 18시 서버가 글을 자동 발행합니다"
Write-Host "  * 이제 사진을 폴더에 넣기만 하면 됩니다"
Write-Host ""
Write-Host "  로그: $WorkDir\promo-sync.log"
Write-Host "  즉시 1회 실행: Start-ScheduledTask -TaskName '$TaskName'"
