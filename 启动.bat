@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Fengyun Nexus] 正在启动…
where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请安装 Node.js 20+ ： https://nodejs.org/
  pause
  exit /b 1
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo 未找到 pnpm，正在安装…
  call npm install -g pnpm
)
if "%NEXUS_ENV%"=="" set NEXUS_ENV=desktop
pnpm boot
if errorlevel 1 pause
