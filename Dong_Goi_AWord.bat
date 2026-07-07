@echo off
:: Dong goi AWord thanh bo cai .exe (electron-builder).
:: Tu dong xin quyen Administrator (can de tai duoc bo cong cu dong goi Windows).

net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    echo Dang xin quyen Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run
cd /d "%~dp0electron-app"
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npm run package

echo.
echo ================================================
echo  Da chay xong. Xem ket qua o tren.
echo  Bo cai (neu thanh cong) nam trong: electron-app\dist\AWord-Setup-*.exe
echo ================================================
pause
