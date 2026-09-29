@echo off
REM Fengyun Nexus launcher — default PM2 background
REM Foreground debug: set NEXUS_FOREGROUND=1
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

if "%NEXUS_FOREGROUND%"=="1" (
  echo [Nexus] Foreground mode
  call pnpm boot
  set ERR=%ERRORLEVEL%
  if not "%ERR%"=="0" (
    echo Boot failed with code %ERR%
    pause
  )
  exit /b %ERR%
)

where pm2 >nul 2>nul
if errorlevel 1 (
  echo [Nexus] Installing PM2...
  call node scripts\ensure-runtime.mjs --pm2-only
  if errorlevel 1 call npm install -g pm2
)

where pm2 >nul 2>nul
if errorlevel 1 (
  echo [Nexus] No PM2, fallback foreground
  call pnpm boot
  exit /b %ERRORLEVEL%
)

echo [Nexus] PM2 background start
call pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts start
if not "%NEXUS_SKIP_DESK%"=="1" (
  call pnpm --filter @fengyun/nexus-cli exec tsx src/index.ts desk
)
echo Done. Console http://127.0.0.1:8787/  Logs: nexus.cmd logs -f
exit /b 0
