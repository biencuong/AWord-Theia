@echo off
:: Dong goi AWord thanh bo cai .exe (chi build cuc bo, KHONG phat hanh).
:: Tu dong danh ma phien ban theo thoi gian (YYYYMMDD.gio.phut) truoc khi build.
:: De phat hanh (build + commit + push + release), dung: Phat_Hanh_AWord.ps1

cd /d "%~dp0electron-app"
set CSC_IDENTITY_AUTO_DISCOVERY=false

echo === Danh ma phien ban theo thoi gian ===
call node scripts\stamp-version.cjs

echo === Bundle ===
call npm run bundle
if errorlevel 1 goto :loi

echo === Tao bo cai ===
call npm run package
if errorlevel 1 goto :loi

echo.
echo ================================================
echo  Da chay xong. Bo cai nam trong: electron-app\dist\AWord-Setup-*.exe
echo ================================================
goto :xong

:loi
echo.
echo [LOI] Build that bai - xem thong bao o tren.

:xong
pause
