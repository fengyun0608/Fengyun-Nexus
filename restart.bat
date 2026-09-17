@echo off
REM Fengyun Nexus — system-level restart executable
REM Invoked by gateway #重启: wait, then start.bat
cd /d "%~dp0"
if not exist "data" mkdir data
set DELAY=%NEXUS_RESTART_DELAY%
if "%DELAY%"=="" set DELAY=2

echo [%date% %time%] Nexus restart begin delay=%DELAY%s>> "data\restart.log"

start "" /b cmd /c "timeout /t %DELAY% /nobreak >nul & call \"%~dp0start.bat\" >> \"%~dp0data\restart.log\" 2>&1"

echo Fengyun Nexus restart scheduled
exit /b 0
