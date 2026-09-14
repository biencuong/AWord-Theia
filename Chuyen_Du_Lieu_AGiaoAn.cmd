@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  CHUYEN DU LIEU TU AGIAOAN SANG AWORD (vai Giao vien)
REM  Sao chep Documents\AGiaoAn -> Documents\AWord\GIAO VIEN, GIU NGUYEN cau
REM  truc (HO SO CUA TOI, TU LIEU MON HOC, KE HOACH BAI DAY, BAI TRINH CHIEU,
REM  DE KIEM TRA, HOC LIEU TRUC QUAN, BO NHO). KHONG xoa nguon. Chay lai an toan
REM  (chi chep tep moi hon). Khong can quyen Quan tri.
REM ============================================================

set "NGUON=%USERPROFILE%\Documents\AGiaoAn"
set "DICH=%USERPROFILE%\Documents\AWord\GIAO VIEN"
set "CAUHINH_CU=%USERPROFILE%\.agiaoan\CLAUDE.md"

echo.
echo  ================================================
echo   CHUYEN DU LIEU AGIAOAN SANG AWORD (vai Giao vien)
echo  ================================================
echo.

if not exist "%NGUON%" (
  echo  Khong thay thu muc "%NGUON%".
  echo  May nay chua co du lieu AGiaoAn - khong co gi de chuyen.
  echo.
  pause
  exit /b 0
)

echo  Nguon : %NGUON%
echo  Dich  : %DICH%
echo.
echo  Se SAO CHEP (khong di chuyen, khong xoa) toan bo ho so, tu lieu, giao an,
echo  de, hoc lieu va bo nho sang thu muc GIAO VIEN cua AWord. Tep da co o dich
echo  ma MOI HON thi giu nguyen. Lien ket (junction) toi Google Drive duoc bo qua.
echo  Tep CLAUDE.md cu cua AGiaoAn duoc luu thanh CLAUDE.agiaoan-cu.md de tham khao
echo  (AWord dung quy tac rieng cua vai Giao vien).
echo.
set "XN="
set /p XN=  Tiep tuc? (Y/N):
if /i not "%XN:~0,1%"=="Y" (
  echo.
  echo  Da huy - khong thay doi gi.
  pause
  exit /b 0
)

if not exist "%DICH%" mkdir "%DICH%" >nul 2>&1
echo.
echo  Dang sao chep (co the mat vai phut voi tep lon)...
echo.
robocopy "%NGUON%" "%DICH%" /E /COPY:DAT /R:1 /W:1 /XO /XJ /NFL /NDL /NJH /XD ".git" ".aword" /XF "CLAUDE.md" "AGENTS.md" ".agiaoan-tien-trinh.json" "desktop.ini" "Thumbs.db" "~$*"
set "RC=%errorlevel%"
echo.
if %RC% GEQ 8 (
  echo  [LOI] robocopy bao loi ^(ma %RC%^) - co the tep dang bi khoa ^(Word/Excel dang mo^)
  echo        hoac thieu quyen. Dong cac ung dung dang mo giao an roi chay lai tep nay.
  set "CO_LOI=1"
) else (
  echo  [OK] Da sao chep xong ^(ma robocopy %RC%: 0 = khong co gi moi, 1-3 = da chep^).
)

REM Giu lai CLAUDE.md cu cua AGiaoAn de tham khao (khong de len quy tac cua AWord)
if exist "%NGUON%\CLAUDE.md" (
  copy /y "%NGUON%\CLAUDE.md" "%DICH%\CLAUDE.agiaoan-cu.md" >nul 2>&1
  echo  [OK] Da luu CLAUDE.md cu thanh "%DICH%\CLAUDE.agiaoan-cu.md".
)

REM Quy tac RIENG nguoi dung tung viet trong ~\.agiaoan\CLAUDE.md (phan NGOAI khoi AGIAOAN) -> HO SO CUA TOI
if not exist "%CAUHINH_CU%" goto :bo_qua_quy_tac
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'SilentlyContinue';" ^
    "$nd = Get-Content -LiteralPath $env:CAUHINH_CU -Raw -Encoding UTF8;" ^
    "$re = '(?s)<!-- AGIAOAN:BEGIN.*?AGIAOAN:END[^>]*-->';" ^
    "$rieng = ([regex]::Replace($nd, $re, '')).Trim();" ^
    "if ($rieng.Length -gt 0) {" ^
    "  $d = Join-Path $env:DICH 'HO SO CUA TOI'; if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null };" ^
    "  $t = Join-Path $d 'quy-tac-rieng-tu-agiaoan.md';" ^
    "  $dau = '# Quy tac rieng chuyen tu AGiaoAn (' + (Get-Date -Format 'dd/MM/yyyy') + ')' + [Environment]::NewLine + 'Nguon: ~\.agiaoan\CLAUDE.md (phan ngoai khoi AGIAOAN). Muon ap dung, chep cac dong can vao %%USERPROFILE%%\.claude\CLAUDE.md, phia DUOI cac khoi AWORD.' + [Environment]::NewLine + [Environment]::NewLine;" ^
    "  [System.IO.File]::WriteAllText($t, $dau + $rieng + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)));" ^
    "  Write-Host ('  [OK] Da luu quy tac rieng cu vao: ' + $t)" ^
    "}"
:bo_qua_quy_tac

echo.
echo  ================================================
if defined CO_LOI (
  echo   XONG NHUNG CO LOI - kiem tra lai ban sao truoc khi tin tuong.
) else (
  echo   XONG. Du lieu AGiaoAn da co trong: %DICH%
)
echo   Nguon Documents\AGiaoAn van GIU NGUYEN (tu xoa sau khi da kiem tra).
echo.
echo   Buoc tiep theo:
echo    1. Mo AWord, trang Chao mung -^> "Vai cua ban" -^> chon Giao vien (neu chua).
echo    2. Trong khung chat Claude, go: "Toi vua chuyen du lieu tu AGiaoAn, hay doc
echo       GIAO VIEN\HO SO CUA TOI va GIAO VIEN\BO NHO roi cap nhat bo nho lam viec."
echo  ================================================
echo.
pause
endlocal
