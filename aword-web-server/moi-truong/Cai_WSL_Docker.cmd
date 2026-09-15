@echo off
REM ============================================================
REM  CAI MOI TRUONG PHAT TRIEN AWORD WEB: WSL2 + Ubuntu 24.04 + Docker Engine + Node.js 24.
REM  Bam dup. Tu xin quyen quan tri. Lan dau can khoi dong lai may roi bam dup lai lan nua.
REM  Chi tiet: cai-wsl-docker.ps1
REM ============================================================
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
title Cai WSL2 + Docker cho AWord Web
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cai-wsl-docker.ps1"
echo.
pause
