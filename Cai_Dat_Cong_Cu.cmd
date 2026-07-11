@echo off
chcp 65001 >nul
setlocal EnableExtensions
REM ============================================================
REM  CAI CONG CU DOC TAI LIEU CHO AWORD (doc/docx/xls/xlsx/pdf/anh)
REM  OFFLINE: dung Python + wheel DONG KEM san trong bo cai
REM  (khong can Internet, khong can winget, khong can quyen Admin).
REM  Chi cai phan CON THIEU; da du se thoat ngay.
REM ============================================================

set "LOG=%TEMP%\aword-cong-cu.log"
set "MARKER=%USERPROFILE%\.claude\aword-cong-cu.ok"
REM Thu muc tai nguyen dong kem: <thu muc script>\resources\pytools
set "PYTOOLS=%~dp0resources\pytools"
set "WHEELS=%PYTOOLS%\wheels"
echo [%date% %time%] Bat dau kiem tra cong cu > "%LOG%"

echo.
echo  ================================================
echo   AWORD - KIEM TRA / CAI CONG CU DOC TAI LIEU
echo   (dung nguon dong kem san - khong can mang)
echo  ================================================
echo.

REM ---- Buoc 1: Python 3.12 (wheel dong kem la cp312 -> phai dung 3.12) ----
REM Uu tien Python 3.12 co san; neu may co Python phien ban KHAC (3.11/3.13...) hoac
REM chua co thi VAN cai ban 3.12 dong kem de wheel cp312 khop chac chan.
set "PY_CMD="
py -3.12 -c "import sys" >nul 2>&1 && set "PY_CMD=py -3.12"
if not defined PY_CMD (
  python -c "import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)" >nul 2>&1 && set "PY_CMD=python"
)
REM Neu da cai san 3.12 tu lan truoc (bo dong kem) -> dung luon
if not defined PY_CMD if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if defined PY_CMD goto :python_xong

echo [CAI] Chua co Python phu hop - dang cai Python 3.12 (dong kem, user-scope)...
echo [CAI] Cai Python tu bo dong kem >> "%LOG%"
if not exist "%PYTOOLS%\python-3.12-amd64.exe" goto :python_thieu_file
REM Cai im lang cho tai khoan hien tai, them vao PATH, khong can Admin
"%PYTOOLS%\python-3.12-amd64.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=1 SimpleInstall=1 >> "%LOG%" 2>&1
if errorlevel 1 goto :python_loi
REM Cua so nay chua co PATH moi - goi truc tiep python vua cai
set "PY_USER=%LOCALAPPDATA%\Programs\Python\Python312"
if exist "%PY_USER%\python.exe" (
  set "PY_CMD=%PY_USER%\python.exe"
) else (
  set "PY_CMD=py -3"
)
goto :python_xong

:python_thieu_file
echo [LOI] Thieu tep cai Python dong kem (%PYTOOLS%\python-3.12-amd64.exe).
echo       Hay cai lai AWord, hoac cai Python tu python.org roi chay lai tep nay.
echo [LOI] thieu python installer >> "%LOG%"
pause
exit /b 1

:python_loi
echo [LOI] Cai Python khong thanh cong. Xem chi tiet: %LOG%
echo       Co the cai tay tu python.org roi chay lai tep nay.
pause
exit /b 1

:python_xong
echo [OK] Python: %PY_CMD%
echo [OK] Python: %PY_CMD% >> "%LOG%"

REM ---- Buoc 2: cai thu vien doc tai lieu tu WHEEL DONG KEM (offline) ----
REM Chi cai goi THIEU. Cai tu thu muc wheel noi bo -> khong tai mang.
REM python-docx: .docx   openpyxl: .xlsx   xlrd: .xls cu
REM pypdf/pymupdf/pdfplumber: .pdf (pymupdf con render trang scan thanh anh cho LLM doc)
REM pillow: anh   pywin32: chuyen .doc/.xls cu qua Word/Excel   defusedxml,lxml: nen tang
set "GOI_THIEU="
for %%p in (docx openpyxl xlrd pypdf fitz pdfplumber PIL lxml defusedxml win32com) do (
  call :kiem_tra_import %%p
)
if not defined GOI_THIEU (
  echo [OK] Toan bo thu vien da du.
  echo [OK] Thu vien da du >> "%LOG%"
  goto :hoan_tat
)

echo [CAI] Cai thu vien con thieu tu nguon dong kem (offline)...
echo [CAI] thieu:%GOI_THIEU% >> "%LOG%"
if not exist "%WHEELS%" goto :wheel_thieu
REM --no-index + --find-links: chi lay tu thu muc wheel noi bo, tuyet doi khong ra mang
%PY_CMD% -m pip install --user --quiet --no-index --find-links "%WHEELS%" ^
  python-docx openpyxl xlrd pypdf pymupdf pdfplumber pillow lxml defusedxml pywin32 >> "%LOG%" 2>&1
if errorlevel 1 goto :wheel_loi
echo [OK] Da cai xong thu vien tu nguon dong kem.
goto :hoan_tat

:wheel_thieu
echo [LOI] Thieu thu muc wheel dong kem (%WHEELS%). Hay cai lai AWord.
echo [LOI] thieu wheels dir >> "%LOG%"
pause
exit /b 1

:wheel_loi
echo [LOI] Cai thu vien loi. Xem chi tiet: %LOG%
pause
exit /b 1

:hoan_tat
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude" >nul 2>&1
echo %date% %time% > "%MARKER%"
echo.
echo  ------------------------------------------------
echo  XONG. AWord da du cong cu doc: doc, docx, xls, xlsx, pdf, anh.
echo  (PDF scan: Claude tu render trang thanh anh roi doc bang thi giac.)
echo  Nhat ky: %LOG%
echo  ------------------------------------------------
timeout /t 8 /nobreak >nul 2>&1
exit /b 0

REM Kiem tra 1 module python co import duoc khong (chinh xac hon pip show)
:kiem_tra_import
%PY_CMD% -c "import %1" >nul 2>&1
if errorlevel 1 set "GOI_THIEU=%GOI_THIEU% %1"
exit /b 0
