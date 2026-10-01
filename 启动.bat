@echo off
setlocal EnableExtensions
cd /d "%~dp0"
REM Chinese filename wrapper; keep body ASCII. Window stays open on error.
call "%~dp0start.bat"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo [ERR] start.bat exit %ERR%
  pause
)
exit /b %ERR%
