@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -Command "try { Invoke-RestMethod 'http://127.0.0.1:11435/api/version' -TimeoutSec 2 | Out-Null } catch { exit 1 }"
if errorlevel 1 (
  echo Start Run_WIN.cmd first and keep its terminal open, then reopen this shortcut.
  pause
  exit /b 1
)
set "OLLAMA_HOST=127.0.0.1:11435"
"%~dp0runtime\ollama\ollama.exe" run wizgard-qwen3.8
endlocal
