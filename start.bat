@echo off
rem Starts the BlockCreator Tauri app in dev mode (Vite + Tauri window).
cd /d "%~dp0"
if not exist node_modules (
    call npm install || goto :error
)

rem Free port 5173 if a Vite of this project is still running from an earlier start.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*BlockCreator*vite*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"

call npm run tauri dev
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo BlockCreator konnte nicht gestartet werden.
pause
exit /b 1
