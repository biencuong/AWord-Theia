@echo off
chcp 65001 >nul
rem AWord Lite (v3) - khoi dong vo nhe: may chu Node + mo giao dien trong cua so Edge (WebView2).
rem Khong can Electron/Theia. Node phai co san (node --version).

where node >nul 2>&1 || (echo [LOI] Chua co Node.js. Cai tai https://nodejs.org roi chay lai. & pause & exit /b 1)

echo Dang khoi dong AWord Lite...
start "AWord Lite server" /min cmd /c "cd /d "%~dp0backend" && node server.js %1"

rem Cho may chu san sang
timeout /t 2 >nul

rem Mo giao dien nhu app that (khong thanh trinh duyet). Edge/WebView2 co san tren Windows.
start "" msedge --app=http://127.0.0.1:41789 --window-size=1200,820 2>nul || start "" http://127.0.0.1:41789

echo AWord Lite dang chay tai http://127.0.0.1:41789
echo Dong cua so nay khong tat may chu; de tat, dong cua so "AWord Lite server".
