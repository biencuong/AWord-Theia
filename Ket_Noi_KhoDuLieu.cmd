@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  KET NOI AWORD VOI KHO DU LIEU CO QUAN (MCP HTTP)
REM  Chay 1 lan sau khi cai AWord. Chay lai de doi may chu/doi key.
REM  Khong can quyen Quan tri (Administrator).
REM ============================================================

REM -- Dia chi mac dinh: uu tien file kho.url (giu qua cac lan cap nhat AWord,
REM    vi file .cmd nay bi installer ghi de moi ban); khong co thi dung dia chi cung --
set "URL_MACDINH=http://192.168.1.50:8600/mcp"
if exist "%~dp0kho.url" (
  set /p URL_MACDINH=<"%~dp0kho.url"
)

echo.
echo  ================================================
echo   KET NOI AWORD VOI KHO DU LIEU CO QUAN
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

REM ---- Buoc 2: nhap dia chi may chu va ma khoa ----
set "KHO_URL="
set /p KHO_URL=Nhap dia chi may chu Kho du lieu [Enter = %URL_MACDINH%]:
if not defined KHO_URL set "KHO_URL=%URL_MACDINH%"

set "KHO_KEY="
set /p KHO_KEY=Nhap ma khoa ca nhan (dang kdl_..., do quan tri vien cap):
if not defined KHO_KEY (
  echo.
  echo [LOI] Chua nhap ma khoa. Lien he quan tri vien de duoc cap.
  echo.
  pause
  exit /b 1
)

REM ---- Buoc 3: dang ky (sao luu cau hinh truoc; add loi thi KHOI PHUC ban cu) ----
echo.
set "CFG=%USERPROFILE%\.claude.json"
if exist "%CFG%" copy /y "%CFG%" "%CFG%.kho-backup" >nul 2>&1
"%CLAUDE_EXE%" mcp remove khodulieu -s user >nul 2>&1
"%CLAUDE_EXE%" mcp add --scope user --transport http khodulieu "%KHO_URL%" --header "Authorization: Bearer %KHO_KEY%"
if errorlevel 1 (
  echo.
  echo [LOI] Dang ky khong thanh cong - dang KHOI PHUC ket noi cu ^(neu co^)...
  if exist "%CFG%.kho-backup" copy /y "%CFG%.kho-backup" "%CFG%" >nul 2>&1
  echo       Kiem tra lai dia chi/ma khoa vua nhap roi chay lai tep nay.
  echo.
  pause
  exit /b 1
)
REM Ghi nho dia chi vua dung cho lan chay sau (song sot qua cap nhat AWord)
>"%~dp0kho.url" echo %KHO_URL%

REM ---- Buoc 4: kiem tra ket noi thuc te va KET LUAN ro rang ----
echo.
echo Da dang ky xong. Dang kiem tra ket noi toi may chu (co the mat vai giay)...
echo.
set "CHK=%TEMP%\kho_mcp_check.txt"
"%CLAUDE_EXE%" mcp list 2>nul | findstr /i /c:"khodulieu" > "%CHK%"
type "%CHK%"
echo.
findstr /i /c:"fail" "%CHK%" >nul 2>&1
if not errorlevel 1 (
  echo  ------------------------------------------------
  echo  [CHUA KET NOI DUOC] Da dang ky nhung may chu khong tra loi.
  echo   1^) May chu kho co dang chay khong? ^(bao quan tri vien^)
  echo   2^) Dung dia chi %KHO_URL% chua?
  echo   3^) Ma khoa con hieu luc khong? ^(loi 401 = ma sai/bi thu hoi^)
  echo   Neu chi la mat mang tam thoi: KHONG can chay lai tep nay,
  echo   mo AWord lai khi mang on la dung duoc.
  echo  ------------------------------------------------
) else (
  findstr /i /c:"connect" "%CHK%" >nul 2>&1
  if not errorlevel 1 (
    echo  ------------------------------------------------
    echo  [THANH CONG] Da ket noi Kho du lieu co quan.
    echo  Mo AWord, hoi Claude ve van ban/quy dinh cua co quan de dung thu.
    echo  ------------------------------------------------
  ) else (
    echo  ------------------------------------------------
    echo  [KHONG XAC DINH] Xem dong ket qua phia tren:
    echo   - Co chu "Connected" la THANH CONG.
    echo   - Co chu "Failed" la CHUA ket noi duoc ^(xem huong dan trong tep nay^).
    echo  ------------------------------------------------
  )
)
del /q "%CHK%" >nul 2>&1
echo.
pause
endlocal
