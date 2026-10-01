@echo off
REM Fengyun Nexus — 电脑双击：前台窗口跑；关窗口即停。不要用 PM2。
REM 服务器 / 容器后台请用：nexus.cmd start 或 Linux 上 NEXUS_ENV=server ./boot.sh
cd /d "%~dp0"
echo [Fengyun Nexus] 前台启动（电脑用双击；关本窗口即停止）

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js。请先安装 Node.js 20+ ：https://nodejs.org/
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo 未找到 pnpm，正在用 npm 安装…
  call npm install -g pnpm
  if errorlevel 1 (
    echo 安装 pnpm 失败。请手动：npm install -g pnpm
    pause
    exit /b 1
  )
)

if not defined NEXUS_ENV set NEXUS_ENV=desktop

call pnpm boot
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo 启动失败，退出码 %ERR%
  pause
)
exit /b %ERR%
