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

rem BlockCreator.zip: das Programm, release\README.txt, release\AGENTS.md sowie Anleitungen, Schema
rem und die eingebauten Pieces als Beispiele fuer eine KI (siehe release\package.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "release\package.ps1"
if errorlevel 1 goto :error

echo.
echo ===================================================
echo   BUILD ERFOLGREICH!
echo ===================================================
echo.
echo   - Dist-Ordner: dist\ (enthaelt BlockCreator.exe)
echo   - Fertige ZIP: BlockCreator.zip ^(Programm, README.txt, AGENTS.md, docs, library^)
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
