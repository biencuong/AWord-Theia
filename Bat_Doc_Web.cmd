@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  BAT DOC TRANG WEB CHO AWORD (Playwright MCP)
REM  Dang ky MCP "playwright" o pham vi user (%USERPROFILE%\.claude.json)
REM  de Claude dieu khien mot trinh duyet Chrome that: doc trang phai dang
REM  nhap, tai tep dinh kem, dien bieu mau, chup man hinh lam minh chung...
REM  Chay 1 lan. Can Node.js va mang cho lan tai dau (~100 MB Chromium).
REM  Khong can quyen Quan tri (Administrator).
REM ============================================================

echo.
echo  ================================================
echo   BAT DOC TRANG WEB (Playwright) CHO AWORD
echo  ================================================
echo.

REM ---- Buoc 1: kiem tra Node.js ----
set "NODE_VER="
for /f "delims=" %%i in ('node -v 2^>nul') do set "NODE_VER=%%i"
if not defined NODE_VER (
  echo  [CHUA DUOC] May nay chua co Node.js nen chua bat duoc chuc nang doc trang web.
  echo.
  echo   Cach xu ly:
  echo    1^) Tai Node.js ban LTS tai https://nodejs.org roi cai ^(bam Next den het^).
  echo    2^) Dong tat ca cua so dong lenh, chay lai tep nay.
  echo.
  echo   Mang co quan chan nodejs.org thi nho quan tri mang cai ho,
  echo   hoac bao AWord dung cach khac ^(doc trang cong khai van chay binh thuong^).
  echo.
  pause
  exit /b 1
)
echo  Node.js: %NODE_VER%

REM ---- Buoc 2: tim claude.exe (PATH truoc, roi ban dong goi kem AWord) ----
set "CLAUDE_EXE="
for /f "delims=" %%i in ('where claude.exe 2^>nul') do if not defined CLAUDE_EXE set "CLAUDE_EXE=%%i"
set "REL=resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe"
if not defined CLAUDE_EXE if exist "%~dp0%REL%" set "CLAUDE_EXE=%~dp0%REL%"
if not defined CLAUDE_EXE if exist "%LOCALAPPDATA%\Programs\AWordPro\%REL%" set "CLAUDE_EXE=%LOCALAPPDATA%\Programs\AWordPro\%REL%"
if not defined CLAUDE_EXE if exist "%LOCALAPPDATA%\Programs\AWord\%REL%" set "CLAUDE_EXE=%LOCALAPPDATA%\Programs\AWord\%REL%"
if not defined CLAUDE_EXE if exist "%ProgramFiles%\AWordPro\%REL%" set "CLAUDE_EXE=%ProgramFiles%\AWordPro\%REL%"
if not defined CLAUDE_EXE (
  echo.
  echo  [LOI] Khong tim thay claude.exe.
  echo        Hay cai dat AWord truoc, hoac chay tep nay tu dung thu muc da cai AWord.
  echo.
  pause
  exit /b 1
)
echo  Claude CLI: "%CLAUDE_EXE%"
echo.

REM ---- Buoc 3: dang ky MCP playwright (sao luu cau hinh; loi thi khoi phuc) ----
set "CFG=%USERPROFILE%\.claude.json"
if exist "%CFG%" copy /y "%CFG%" "%CFG%.playwright-backup" >nul 2>&1
echo  Dang dang ky cong cu doc trang web...
"%CLAUDE_EXE%" mcp remove playwright -s user >nul 2>&1
"%CLAUDE_EXE%" mcp add --scope user playwright -- npx -y @playwright/mcp@latest
if errorlevel 1 (
  echo.
  echo  [LOI] Dang ky khong thanh cong - dang KHOI PHUC cau hinh cu ^(neu co^)...
  if exist "%CFG%.playwright-backup" copy /y "%CFG%.playwright-backup" "%CFG%" >nul 2>&1
  echo        Hay chay lai tep nay; van loi thi bao ho tro AWord.
  echo.
  pause
  exit /b 1
)

REM ---- Buoc 4: tai san trinh duyet Chromium (lan dau ~100 MB) ----
echo.
set "TAI_NGAY="
set /p TAI_NGAY=Tai san trinh duyet bay gio cho lan dung dau nhanh hon? [Y/n]:
REM  Lay ky tu dau cho chac (tra loi co the kem dau cach/xuong dong)
if /i "%TAI_NGAY:~0,1%"=="n" goto BO_QUA_TAI
echo.
echo  Dang tai trinh duyet Chromium - lan dau co the mat vai phut, dung tat cua so nay...
call npx -y playwright@latest install chromium
if errorlevel 1 (
  echo.
  echo  [CHU Y] Chua tai duoc trinh duyet ^(mang cham hoac bi chan^).
  echo          Cong cu van da dang ky; lan dau dung se tu tai, chi cho lau hon.
)
:BO_QUA_TAI

REM ---- Buoc 5: kiem tra ket qua ----
echo.
set "CHK=%TEMP%\playwright_mcp_check.txt"
"%CLAUDE_EXE%" mcp list 2>nul | findstr /i /c:"playwright" > "%CHK%"
type "%CHK%"
echo.
findstr /i /c:"playwright" "%CHK%" >nul 2>&1
if errorlevel 1 (
  echo  ------------------------------------------------
  echo  [KHONG XAC DINH] Khong thay dong "playwright" trong danh sach cong cu.
  echo  Hay chay lai tep nay; van khong duoc thi bao ho tro AWord.
  echo  ------------------------------------------------
) else (
  echo  ------------------------------------------------
  echo  [XONG] Da bat chuc nang doc trang web.
  echo.
  echo  Buoc tiep theo: MO LAI AWORD ^(dong han roi mo^), trong khung chat go:
  echo      /mcp
  echo  thay dong "playwright" la dung duoc. Vi du yeu cau:
  echo      - vao iOffice lay danh sach van ban den cho xu ly cua toi
  echo      - vao trang ... dang nhap giup toi roi tai cac tep dinh kem ve
  echo      - chup man hinh trang ... de chen vao bao cao
  echo.
  echo  Luu y: Claude CHI DOC va lay du lieu. Nhung viec co hau qua that
  echo  ^(gui ho so, trinh ky, phat hanh, thanh toan^) chi lam khi ban dong y ro.
  echo  Mat khau khong go vao khung chat - de trong tep auth.local.json.
  echo  ------------------------------------------------
)
del /q "%CHK%" >nul 2>&1
echo.
pause
endlocal
