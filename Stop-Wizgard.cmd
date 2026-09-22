@echo off
powershell.exe -NoProfile -Command "try { Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3210/api/shutdown' | Out-Null; Write-Host 'Wizgard stopped.' } catch { Write-Host 'Wizgard is not running.' }"
