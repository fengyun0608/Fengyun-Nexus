@echo off
REM Fengyun Nexus — system restart (called by #重启)
REM Parent launches this via: start /min ... so we survive gateway exit.
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "data" mkdir data
set "LOG=%~dp0data\restart.log"
set "DELAY=%NEXUS_RESTART_DELAY%"
if "%DELAY%"=="" set "DELAY=4"

echo [%date% %time%] restart.bat begin delay=%DELAY%s>> "%LOG%"

REM Wait for old gateway to release the listen port
timeout /t %DELAY% /nobreak >nul

echo [%date% %time%] launching start.bat in new console>> "%LOG%"
REM New titled console = the running Nexus instance (one window, stays while gateway runs)
start "Fengyun Nexus" /D "%~dp0" cmd /c "call start.bat >> data\restart.log 2>&1 & if errorlevel 1 (echo Boot failed & pause)"

echo [%date% %time%] restart scheduled OK>> "%LOG%"
endlocal
exit /b 0
