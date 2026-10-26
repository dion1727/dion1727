@echo off
cd /d "%~dp0"
echo =============================================
echo Dion After Hours - Local playable website
echo Open http://localhost:8000 in your browser.
echo Press Ctrl+C here to stop the local server.
echo =============================================
start "" "http://localhost:8000"
py -m http.server 8000 --directory docs
if errorlevel 1 (
  echo.
  echo Python launcher was not found. Try: python -m http.server 8000 --directory docs
  pause
)
