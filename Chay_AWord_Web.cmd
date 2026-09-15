@echo off
REM ============================================================
REM  CHAY AWORD BAN TRINH DUYET TREN MAY NAY - bam dup la chay.
REM  Tu build lai phan da cu, chay may chu chi trong may (127.0.0.1)
REM  roi mo trinh duyet o http://localhost:3030.
REM  Dong cua so nay (hoac Ctrl+C) de tat AWord Web.
REM  Chi tiet: scripts\chay-aword-web.cjs
REM ============================================================
chcp 65001 >nul
title AWord Web
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [AWord Web] Khong tim thay Node.js. Cai Node.js 20 tro len roi chay lai.
  pause
  exit /b 1
)
node "%~dp0scripts\chay-aword-web.cjs"
if errorlevel 1 pause
