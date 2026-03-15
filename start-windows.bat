@echo off
setlocal

cd /d "%~dp0"

echo [SD-OutfitHub] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js is not installed or not in PATH.
  echo Please install Node.js first: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "server.js" (
  echo [Error] server.js not found in current directory.
  pause
  exit /b 1
)

echo [SD-OutfitHub] Starting server on http://localhost:3000 ...
echo Press Ctrl+C to stop.
echo.

node server.js

endlocal
