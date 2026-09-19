@echo off
setlocal enabledelayedexpansion

rem Builds the BlockCreator release standalone executable, prepares the dist folder, and generates BlockCreator.zip.
cd /d "%~dp0"

echo ===================================================
echo   BlockCreator - Release Build
echo ===================================================
echo.

if not exist node_modules (
    echo [1/3] Installiere npm-Pakete...
    call npm install || goto :error
) else (
    echo [1/3] npm-Pakete vorhanden.
)

echo.
echo [2/3] Kompiliere Release-Build mit Tauri...
call npx tauri build --no-bundle
if errorlevel 1 goto :error

echo.
echo [3/3] Erstelle dist-Paket und ZIP-Datei...

if not exist dist mkdir dist

copy /y "src-tauri\target\release\blockcreator.exe" "dist\BlockCreator.exe" >nul
if errorlevel 1 goto :error

(
echo BlockCreator v0.1.0
echo ===================
echo.
echo Visueller Editor fuer Super Mario World Custom Blocks ^(GPS^).
echo.
echo Starten:
echo - Einfach BlockCreator.exe doppelklicken.
echo - Voraussetzung: Windows 10 / 11 ^(mit WebView2 Runtime, standardmaessig vorhanden^).
echo.
echo Verwendung mit einem Romhack-Projekt:
echo 1. Block erstellen ^(Sides/Slots mit Logik-Pieces belegen^).
echo 2. "Save to project..." waehlen und den Romhack- oder GPS-Ordner angeben.
echo 3. Map16-Nummer und Act-as festlegen.
echo 4. GPS oder Callisto Update ausfuehren.
) > "dist\README.txt"

powershell -NoProfile -Command "Compress-Archive -Path 'dist\BlockCreator.exe', 'dist\README.txt' -DestinationPath 'BlockCreator.zip' -Force"
if errorlevel 1 goto :error

echo.
echo ===================================================
echo   BUILD ERFOLGREICH!
echo ===================================================
echo.
echo   - Dist-Ordner: dist\ (enthaelt BlockCreator.exe)
echo   - Fertige ZIP: BlockCreator.zip
echo.
echo Du kannst jetzt BlockCreator.zip direkt weitergeben oder den dist-Ordner zippen!
echo.
pause
exit /b 0

:error
echo.
echo ===================================================
echo   FEHLER BEIM BUILD!
echo ===================================================
echo Der Release-Build konnte nicht erfolgreich abgeschlossen werden.
echo.
pause
exit /b 1
