@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0runtime\node\node.exe" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-win.ps1"
  if errorlevel 1 goto failed
)
if not exist "%~dp0runtime\node\node_modules\npm\bin\npm-cli.js" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-win.ps1"
  if errorlevel 1 goto failed
)
"%~dp0runtime\node\node.exe" "%~dp0scripts\run.mjs"
if errorlevel 1 goto failed
exit /b 0
:failed
pause
exit /b 1
endlocal
