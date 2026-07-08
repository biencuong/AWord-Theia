@echo off
chcp 65001 >nul
setlocal
REM ============================================================
REM  KET NOI AWORD VOI KHO DU LIEU CO QUAN (MCP HTTP)
REM  Chay 1 lan sau khi cai AWord. Chay lai de doi may chu/doi key.
REM  Khong can quyen Quan tri (Administrator).
REM ============================================================

REM -- Quan tri vien: sua dia chi may chu mac dinh truoc khi phat hanh --
set "URL_MACDINH=http://192.168.1.50:8600/mcp"

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

REM ---- Buoc 3: dang ky (go ban cu neu co de luon sach, chay lai an toan) ----
echo.
"%CLAUDE_EXE%" mcp remove khodulieu -s user >nul 2>&1
"%CLAUDE_EXE%" mcp add --scope user --transport http khodulieu "%KHO_URL%" --header "Authorization: Bearer %KHO_KEY%"
if errorlevel 1 (
  echo.
  echo [LOI] Dang ky khong thanh cong. Kiem tra lai dia chi/ma khoa vua nhap roi chay lai.
  echo.
  pause
  exit /b 1
)

REM ---- Buoc 4: kiem tra ket noi thuc te ----
echo.
echo Da dang ky xong. Dang kiem tra ket noi toi may chu (co the mat vai giay)...
echo.
"%CLAUDE_EXE%" mcp list
echo.
echo  ------------------------------------------------
echo  - Neu dong "khodulieu" bao ket noi thanh cong: XONG.
echo    Mo AWord, hoi Claude ve van ban/quy dinh cua co quan de dung thu.
echo  - Neu bao loi ket noi: kiem tra (1) may chu kho dang chay,
echo    (2) dung dia chi %KHO_URL%,
echo    (3) ma khoa con hieu luc (loi 401 = ma sai/bi thu hoi, xin cap lai).
echo    Da dang ky xong thi KHONG can chay lai khi chi loi mang tam thoi.
echo  ------------------------------------------------
echo.
pause
endlocal
