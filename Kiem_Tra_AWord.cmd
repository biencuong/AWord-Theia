@echo off
chcp 65001 >nul
rem Kiem_Tra_AWord.cmd — chẩn đoán nhanh khi AWord báo lỗi "native binary failed to launch"
rem hoặc khung chat Claude không mở. Nằm trong thư mục cài AWord, chạy không cần Admin.

echo ================= KIEM TRA AWORD =================
set "CLAUDE_EXE=%~dp0resources\app\plugins\Anthropic.claude-code\extension\resources\native-binary\claude.exe"

if not exist "%CLAUDE_EXE%" (
  echo [LOI] Khong tim thay claude.exe trong thu muc cai dat.
  echo       Hay go AWord roi cai lai bang bo cai moi nhat.
  goto :ket
)

for %%A in ("%CLAUDE_EXE%") do echo Kich thuoc claude.exe: %%~zA byte (binh thuong ~253.000.000)
echo Dang thu khoi dong Claude CLI...
"%CLAUDE_EXE%" --version
if errorlevel 1 (
  echo.
  echo [LOI] claude.exe CO tren may nhung KHONG khoi dong duoc. Nguyen nhan thuong gap:
  echo   1. Phan mem diet virus / chinh sach cong ty chan file exe chua ky so.
  echo      - Mo Windows Security ^> Protection history xem co muc nao chan AWord khong.
  echo      - Nho quan tri vien them ngoai le cho thu muc: %~dp0
  echo   2. File hong do tai/cai dat loi mang: go AWord, tai lai bo cai, cai lai.
  echo   3. O dia day hoac loi: kiem tra dung luong trong con lai.
) else (
  echo.
  echo [OK] Claude CLI khoi dong binh thuong. Neu khung chat van loi, chup man hinh
  echo      thong bao loi va lien he ho tro AWord: 0983 606 845.
)

:ket
echo ==================================================
pause
