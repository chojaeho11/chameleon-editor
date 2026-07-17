' ============================================================
' promo-sync-hidden.vbs - run promo-sync.sh with NO console window
' 2026-07-17
'
' Why: Task Scheduler running bash.exe directly pops a black console
'   window every 5 minutes. S4U (non-interactive) would hide it but
'   requires admin rights to register, which we do not have here.
'   wscript.exe has no console of its own, and Run(..., 0, False)
'   starts bash hidden. No elevation needed.
'
' Registered by promo-autostart.ps1. Not meant to be run by hand,
' but double-clicking it just performs one silent sync.
' (ASCII only on purpose - wscript is picky about encodings.)
' ============================================================
Option Explicit

Dim fso, sh, dir, bash, bashDir, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")

dir = fso.GetParentFolderName(WScript.ScriptFullName)

' locate Git Bash
bash = "C:\Program Files\Git\bin\bash.exe"
If Not fso.FileExists(bash) Then bash = "C:\Program Files (x86)\Git\bin\bash.exe"
If Not fso.FileExists(bash) Then bash = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Git\bin\bash.exe"
If Not fso.FileExists(bash) Then
    ' nothing we can do silently; leave a trace and quit
    Dim f
    Set f = fso.OpenTextFile(dir & "\promo-sync.log", 8, True)
    f.WriteLine "[promo] ERROR: bash.exe not found - Git for Windows required"
    f.Close
    WScript.Quit 1
End If

' C:\Users\x\y  ->  /c/Users/x/y   (git-bash style path)
bashDir = Replace(dir, "\", "/")
bashDir = "/" & LCase(Left(bashDir, 1)) & Mid(bashDir, 3)

cmd = """" & bash & """ -lc ""cd '" & bashDir & "' && ./promo-sync.sh >> promo-sync.log 2>&1"""

' 0 = hidden window, False = do not wait
sh.Run cmd, 0, False
