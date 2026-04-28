@echo off
setlocal

REM Portable Windows launcher. Double-click this file from a local Janus IA
REM clone to update, install missing runtime pieces, start the dashboard, and
REM open http://localhost:3100.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "JANUS_OPEN_BROWSER=1"
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=bash"

pushd "%ROOT%"
"%BASH%" dash --open
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
  echo.
  echo Janus IA failed to start. Review the error above.
  pause
)
