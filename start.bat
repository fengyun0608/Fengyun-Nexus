@echo off
REM ASCII-only launcher (avoid UTF-8 breaking cmd.exe)
cd /d "%~dp0"
echo [Fengyun Nexus] Starting...

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 20+ from https://nodejs.org/
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm not found. Installing via npm...
  call npm install -g pnpm
  if errorlevel 1 (
    echo Failed to install pnpm. Run: npm install -g pnpm
    pause
    exit /b 1
  )
)

if not defined NEXUS_ENV set NEXUS_ENV=desktop

call pnpm boot
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo Boot failed with code %ERR%
  pause
)
exit /b %ERR%
