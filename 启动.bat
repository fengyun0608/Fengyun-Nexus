@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [Fengyun Nexus] 正在启动…
where pnpm >nul 2>nul
if errorlevel 1 (
  echo 未找到 pnpm。请先安装 Node.js 20+ 并执行: npm install -g pnpm
  pause
  exit /b 1
)
pnpm boot
pause
