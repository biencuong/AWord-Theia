@echo off
REM ============================================================
REM  CHAY AWORD WEB BAN CO DANG NHAP (may chu da nguoi dung).
REM  Bam dup la chay: tu lam moi phan da cu, lan dau hoi tao tai khoan quan tri,
REM  roi chay may chu o nen (khong cua so) va mo http://aword.localhost:8080
REM  Tat bang Tat_AWord_Web_DangNhap.cmd
REM  Chi tiet: scripts\chay-aword-web-dang-nhap.cjs
REM ============================================================
chcp 65001 >nul
title AWord Web (dang nhap)
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [AWord Web] Khong tim thay Node.js. Cai Node.js 24 tro len roi chay lai.
  pause
  exit /b 1
)
node "%~dp0scripts\chay-aword-web-dang-nhap.cjs"
if errorlevel 1 pause
