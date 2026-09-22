@echo off
setlocal

rem Makes a release: raises the version, builds the desktop app (BlockCreator.zip) and the web app,
rem and uploads both to saphros.de. The work is done by scripts\release.mjs.
rem
rem   release.bat                     asks for the new version
rem   release.bat patch               (or minor, major, keep, or a version like 1.0.0)
rem   release.bat --dry-run           shows the steps and changes nothing
rem   release.bat --no-upload         builds everything and uploads nothing

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install it or open this from a terminal where "node" works.
    pause
    exit /b 1
)

node scripts\release.mjs %*
set RELEASE_EXIT=%ERRORLEVEL%

echo.
if not "%RELEASE_EXIT%"=="0" (
    echo ===================================================
    echo   RELEASE STOPPED - see the message above.
    echo ===================================================
) else (
    echo ===================================================
    echo   Done.
    echo ===================================================
)
pause
exit /b %RELEASE_EXIT%
