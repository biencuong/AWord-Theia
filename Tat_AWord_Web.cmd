@echo off
REM ============================================================
REM  TAT AWORD BAN TRINH DUYET (may chu chay nen do Chay_AWord_Web.cmd mo).
REM  Dung may chu kem moi tien trinh con (Claude, Terminal...).
REM ============================================================
chcp 65001 >nul
title Tat AWord Web
cd /d "%~dp0"
node "%~dp0scripts\chay-aword-web.cjs" --tat
timeout /t 3 >nul
