@echo off
setlocal

REM Portable Windows launcher. Double-click this file from a local Janus IA
REM clone to update, install missing runtime pieces, start the dashboard, and
REM open http://localhost:3100.

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "JANUS_OPEN_BROWSER=0"
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=bash"

start "" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='http://localhost:3100'; for ($i=0; $i -lt 180; $i++) { try { $r=Invoke-WebRequest -UseBasicParsing -Uri ($u + '/health') -TimeoutSec 1; if ($r.StatusCode -eq 200) { Start-Process $u; exit } } catch {}; Start-Sleep -Milliseconds 500 }; Start-Process $u"

pushd "%ROOT%"
"%BASH%" dash
set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" (
  echo.
  echo Janus IA failed to start. Review the error above.
  pause
)
