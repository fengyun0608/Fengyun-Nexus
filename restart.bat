@echo off
REM Legacy helper — prefer same-window restart via boot.mjs (exit 75).
REM Kept for manual ops only; #重启 no longer opens a new console.
cd /d "%~dp0"
echo [%date% %time%] manual restart.bat — use boot loop instead>> "data\restart.log" 2>nul
if not exist "data" mkdir data
call "%~dp0start.bat"
