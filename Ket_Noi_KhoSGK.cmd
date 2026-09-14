@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  KET NOI AWORD VOI KHO SGK (MCP HTTP tren aword.vn) - vai Giao vien
REM  Chay 1 lan sau khi cai AWord. Chay lai de doi dia chi may chu.
REM  Khong can ma khoa: script tu tinh MA MAY + sinh TOKEN thiet bi va luu
REM  vao %USERPROFILE%\.aword\khosgk.json. Chay lai DUNG LAI token cu
REM  (giu ban quyen da mua). Khong can quyen Quan tri (Administrator).
REM ============================================================

REM -- Dia chi mac dinh: uu tien file khosgk.url canh script (giu qua cac lan cap nhat AWord,
REM    vi file .cmd nay bi installer ghi de moi ban); khong co thi dung dia chi chinh thuc --
set "URL_MACDINH=https://aword.vn/khosgk/mcp"
if exist "%~dp0khosgk.url" (
  set /p URL_MACDINH=<"%~dp0khosgk.url"
)

echo.
echo  ================================================
echo   KET NOI AWORD VOI KHO SGK (vai Giao vien)
echo  ================================================
echo.

REM ---- Buoc 1: tim claude.exe (PATH truoc, roi ban dong goi kem AWord) ----
set "CLAUDE_EXE="
for /f "delims=" %%i in ('where claude.exe 2^>nul') do if not defined CLAUDE_EXE set "CLAUDE_EXE=%%i"
if not defined CLAUDE_EXE (
  if exist "%~dp0resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe" (
    set "CLAUDE_EXE=%~dp0resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe"
  )
)
if not defined CLAUDE_EXE (
  if exist "%LOCALAPPDATA%\Programs\AWord\resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe" (
    set "CLAUDE_EXE=%LOCALAPPDATA%\Programs\AWord\resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe"
  )
)
if not defined CLAUDE_EXE (
  echo [LOI] Khong tim thay claude.exe.
  echo       Hay cai dat AWord truoc, hoac chay tep nay tu dung thu muc da cai AWord.
  echo.
  pause
  exit /b 1
)
echo Dung Claude CLI: "%CLAUDE_EXE%"
echo.

REM ---- Buoc 2: nhap dia chi may chu (Enter = mac dinh) ----
set "KHO_URL="
set /p KHO_URL=Nhap dia chi Kho SGK [Enter = %URL_MACDINH%]:
if not defined KHO_URL set "KHO_URL=%URL_MACDINH%"

REM ---- Buoc 3: tinh MA MAY + TOKEN (PowerShell), luu %USERPROFILE%\.aword\khosgk.json ----
REM  Ma may = "M-" + 20 ky tu hex dau cua SHA-256("UUID bo mach|so se-ri o he thong|ten may"), nhom 4.
REM  Token = 32 byte ngau nhien (RNGCryptoServiceProvider) dang hex; DA CO file thi DUNG LAI token.
REM  PowerShell ghi ra %TEMP%\khosgk_env.cmd (2 dong set) de cmd doc lai - tranh loi trich dan.
set "ENV_TMP=%TEMP%\khosgk_env.cmd"
if exist "%ENV_TMP%" del /q "%ENV_TMP%" >nul 2>&1
echo Dang tinh ma may va token thiet bi...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$thuMuc = Join-Path $env:USERPROFILE '.aword';" ^
  "if (-not (Test-Path -LiteralPath $thuMuc)) { New-Item -ItemType Directory -Force -Path $thuMuc | Out-Null };" ^
  "$tep = Join-Path $thuMuc 'khosgk.json';" ^
  "$uuid = ''; try { $uuid = [string](Get-CimInstance Win32_ComputerSystemProduct).UUID } catch { };" ^
  "$oHT = $env:SystemDrive; if (-not $oHT) { $oHT = 'C:' };" ^
  "$seri = ''; try { $seri = [string](Get-CimInstance Win32_LogicalDisk -Filter ('DeviceID=''' + $oHT + '''')).VolumeSerialNumber } catch { };" ^
  "$goc = $uuid + '|' + $seri + '|' + $env:COMPUTERNAME;" ^
  "$sha = [System.Security.Cryptography.SHA256]::Create();" ^
  "$bam = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($goc));" ^
  "$hex = (($bam | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 20).ToUpper();" ^
  "$maMay = 'M-' + $hex.Substring(0,4) + '-' + $hex.Substring(4,4) + '-' + $hex.Substring(8,4) + '-' + $hex.Substring(12,4) + '-' + $hex.Substring(16,4);" ^
  "$token = ''; $cu = $null;" ^
  "if (Test-Path -LiteralPath $tep) { try { $cu = Get-Content -LiteralPath $tep -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $cu = $null } };" ^
  "if ($cu -and $cu.token -and ([string]$cu.token).Length -ge 32) { $token = [string]$cu.token; Write-Host ('  Dung lai token thiet bi da co (ngay dang ky: ' + $cu.ngay + ') - giu ban quyen.') };" ^
  "if ($cu -and $cu.ma_may -and ($cu.ma_may -ne $maMay)) { Write-Host ('  [CHU Y] Ma may da doi (cu: ' + $cu.ma_may + ') - neu may chu bao may khong khop, hoi Claude: chuyen may Kho SGK.') };" ^
  "if (-not $token) { $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider; $b = New-Object byte[] 32; $rng.GetBytes($b); $token = ($b | ForEach-Object { $_.ToString('x2') }) -join ''; Write-Host '  Da sinh token thiet bi moi.' };" ^
  "$ngay = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz';" ^
  "$obj = [ordered]@{ url = $env:KHO_URL; ma_may = $maMay; token = $token; ngay = $ngay };" ^
  "if ($cu -and $cu.ngay -and $token -eq [string]$cu.token) { $obj.ngay = $cu.ngay; $obj['cap_nhat'] = $ngay };" ^
  "$json = $obj | ConvertTo-Json;" ^
  "[System.IO.File]::WriteAllText($tep, $json, (New-Object System.Text.UTF8Encoding($false)));" ^
  "$dongEnv = 'set MA_MAY=' + $maMay + [Environment]::NewLine + 'set KHO_TOKEN=' + $token + [Environment]::NewLine;" ^
  "[System.IO.File]::WriteAllText($env:ENV_TMP, $dongEnv, (New-Object System.Text.ASCIIEncoding));" ^
  "Write-Host ('  Ma may: ' + $maMay)"
if errorlevel 1 (
  echo.
  echo [LOI] Khong tinh duoc ma may/token ^(PowerShell bao loi o tren^). Hay chay lai; van loi thi bao ho tro AWord.
  echo.
  pause
  exit /b 1
)
if not exist "%ENV_TMP%" (
  echo [LOI] Khong doc duoc ket qua tu PowerShell. Hay chay lai tep nay.
  pause
  exit /b 1
)
call "%ENV_TMP%"
del /q "%ENV_TMP%" >nul 2>&1
if not defined KHO_TOKEN (
  echo [LOI] Token rong - hay chay lai tep nay.
  pause
  exit /b 1
)

REM ---- Buoc 4: dang ky MCP (sao luu cau hinh truoc; add loi thi KHOI PHUC ban cu) ----
echo.
set "CFG=%USERPROFILE%\.claude.json"
if exist "%CFG%" copy /y "%CFG%" "%CFG%.khosgk-backup" >nul 2>&1
"%CLAUDE_EXE%" mcp remove khosgk -s user >nul 2>&1
"%CLAUDE_EXE%" mcp add --scope user --transport http khosgk "%KHO_URL%" --header "Authorization: Bearer %KHO_TOKEN%" --header "X-May: %MA_MAY%"
if errorlevel 1 (
  echo.
  echo [LOI] Dang ky khong thanh cong - dang KHOI PHUC ket noi cu ^(neu co^)...
  if exist "%CFG%.khosgk-backup" copy /y "%CFG%.khosgk-backup" "%CFG%" >nul 2>&1
  echo       Kiem tra lai dia chi vua nhap roi chay lai tep nay.
  echo.
  pause
  exit /b 1
)
REM Ghi nho dia chi vua dung cho lan chay sau (song sot qua cap nhat AWord)
>"%~dp0khosgk.url" echo %KHO_URL%

REM ---- Buoc 5: kiem tra ket noi thuc te va KET LUAN ro rang ----
echo.
echo Da dang ky xong. Dang kiem tra ket noi toi may chu (co the mat vai giay)...
echo.
set "CHK=%TEMP%\khosgk_mcp_check.txt"
"%CLAUDE_EXE%" mcp list 2>nul | findstr /i /c:"khosgk" > "%CHK%"
type "%CHK%"
echo.
findstr /i /c:"fail" "%CHK%" >nul 2>&1
if not errorlevel 1 (
  echo  ------------------------------------------------
  echo  [CHUA KET NOI DUOC] Da dang ky nhung may chu khong tra loi.
  echo   1^) May co mang Internet khong? ^(Kho SGK nam tren aword.vn^)
  echo   2^) Dung dia chi %KHO_URL% chua? ^(mac dinh: https://aword.vn/khosgk/mcp^)
  echo   Neu chi la mat mang tam thoi: KHONG can chay lai tep nay,
  echo   mo AWord lai khi mang on la dung duoc.
  echo  ------------------------------------------------
) else (
  findstr /i /c:"connect" "%CHK%" >nul 2>&1
  if not errorlevel 1 (
    echo  ------------------------------------------------
    echo  [THANH CONG] Da ket noi Kho SGK. Ma may cua ban: %MA_MAY%
    echo  Buoc tiep theo: mo AWord, trong khung chat Claude go:
    echo      kiem tra trang thai Kho SGK
    echo  Claude se bao trang thai ban quyen va huong dan thanh toan
    echo  bang quet QR ngay trong chat ^(50.000 d/may/nam^) neu chua kich hoat.
    echo  ------------------------------------------------
  ) else (
    echo  ------------------------------------------------
    echo  [KHONG XAC DINH] Xem dong ket qua phia tren:
    echo   - Co chu "Connected" la THANH CONG.
    echo   - Co chu "Failed" la CHUA ket noi duoc ^(xem huong dan trong tep nay^).
    echo  Ma may cua ban: %MA_MAY%
    echo  Mo AWord va go: kiem tra trang thai Kho SGK
    echo  ------------------------------------------------
  )
)
del /q "%CHK%" >nul 2>&1
echo.
pause
endlocal
