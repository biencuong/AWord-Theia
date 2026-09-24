@echo off
REM ============================================================
REM  TAT AWORD WEB BAN CO DANG NHAP (may chu chay nen).
REM  Dung may chu kem moi phien lam viec cua cac tai khoan.
REM ============================================================
chcp 65001 >nul
title Tat AWord Web (dang nhap)
cd /d "%~dp0"
node "%~dp0scripts\chay-aword-web-dang-nhap.cjs" --tat
timeout /t 3 >nul
