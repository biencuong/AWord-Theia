@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  VIET HOA CLAUDE CODE (extension trong VS Code va AWord) - GIU SAU MOI LAN CAP NHAT
REM  - Chep cong cu vao %USERPROFILE%\.aword\viet-hoa-claude-code
REM  - Dang ky tac vu ngam "AWord\Viet hoa Claude Code": chay luc dang nhap va moi gio,
REM    tu va lai ban Claude Code moi cap nhat (khong hien cua so).
REM  - Chay ngay mot lan va bao ket qua.
REM  Go bo:  Cai_Viet_Hoa_Claude_Code.cmd /go      (tra khung chat ve tieng Anh + xoa tac vu)
REM  Khong can quyen Quan tri.
REM ============================================================
set "DICH=%USERPROFILE%\.aword\viet-hoa-claude-code"
set "TAC_VU=AWord\Viet hoa Claude Code"

if /i "%~1"=="/go" goto GO_BO

echo.
echo  ================================================
echo   VIET HOA CLAUDE CODE (VS Code + AWord)
echo  ================================================
echo.
if not exist "%DICH%" mkdir "%DICH%"
copy /y "%~dp0viet-hoa.cjs" "%DICH%\" >nul || goto LOI_CHEP
copy /y "%~dp0chay-an.vbs" "%DICH%\" >nul || goto LOI_CHEP
REM Bang dich di kem (du phong khi khong co mang): lay tu repo AWord neu chay trong repo, hoac canh tep nay
if exist "%~dp0..\..\aword-chat\src\common\viet-hoa-claude-code.json" copy /y "%~dp0..\..\aword-chat\src\common\viet-hoa-claude-code.json" "%DICH%\bang-dich.json" >nul
if exist "%~dp0bang-dich.json" copy /y "%~dp0bang-dich.json" "%DICH%\bang-dich.json" >nul

echo  Dang dang ky tac vu ngam (luc dang nhap + moi gio)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$vbs = Join-Path $env:DICH 'chay-an.vbs';" ^
  "$q = [char]34; $tacVu = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ($q + $vbs + $q);" ^
  "$dangNhap = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME;" ^
  "$moiGio = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1);" ^
  "$caiDat = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10);" ^
  "Register-ScheduledTask -TaskName 'Viet hoa Claude Code' -TaskPath '\AWord\' -Action $tacVu -Trigger $dangNhap,$moiGio -Settings $caiDat -Description 'AWord: Viet hoa lai Claude Code (VS Code + AWord) sau moi lan cap nhat' -Force | Out-Null"
if errorlevel 1 (
  echo  [CHU Y] Chua dang ky duoc tac vu ngam - van Viet hoa ngay bay gio, nhung sau khi Claude Code
  echo          cap nhat can chay lai tep nay.
)

echo.
echo  Dang Viet hoa cac ban Claude Code tren may...
echo.
where node >nul 2>nul
if not errorlevel 1 (
  node "%DICH%\viet-hoa.cjs"
) else (
  if exist "%LOCALAPPDATA%\Programs\AWordPro\AWordPro.exe" (
    set "ELECTRON_RUN_AS_NODE=1"
    "%LOCALAPPDATA%\Programs\AWordPro\AWordPro.exe" "%DICH%\viet-hoa.cjs"
  ) else (
    echo  [LOI] Can Node.js hoac AWord Pro de chay cong cu nay.
  )
)
echo.
echo  ------------------------------------------------
echo  Xong. VS Code: Ctrl+Shift+P -^> Developer: Reload Window de thay tieng Viet.
echo  AWord: dong han roi mo lai.
echo  Nhat ky lan chay gan nhat: %DICH%\nhat-ky.txt
echo  ------------------------------------------------
echo.
pause
exit /b 0

:GO_BO
echo  Dang tra khung chat Claude Code ve tieng Anh va go tac vu ngam...
schtasks /Delete /TN "%TAC_VU%" /F >nul 2>nul
where node >nul 2>nul
if not errorlevel 1 (
  node "%DICH%\viet-hoa.cjs" --khoi-phuc
) else (
  set "ELECTRON_RUN_AS_NODE=1"
  if exist "%LOCALAPPDATA%\Programs\AWordPro\AWordPro.exe" "%LOCALAPPDATA%\Programs\AWordPro\AWordPro.exe" "%DICH%\viet-hoa.cjs" --khoi-phuc
)
echo  Da go. Tai lai cua so VS Code / mo lai AWord de ap dung.
pause
exit /b 0

:LOI_CHEP
echo  [LOI] Khong chep duoc cong cu vao %DICH%.
pause
exit /b 1
