@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM ASCII-only: UTF-8 Chinese in .bat breaks cmd (not recognized as internal command).
echo [Fengyun Nexus] Foreground start. Close this window to stop.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERR] Node.js not found. Install Node.js 20+ from https://nodejs.org/
  goto :fail
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [Nexus] pnpm missing, installing via npm...
  call npm install -g pnpm
  if errorlevel 1 (
    echo [ERR] Failed to install pnpm. Run: npm install -g pnpm
    goto :fail
  )
)

if not defined NEXUS_ENV set "NEXUS_ENV=desktop"

call pnpm boot
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo [ERR] Boot failed, exit code %ERR%
  goto :fail
)
exit /b 0

:fail
echo.
pause
exit /b 1
