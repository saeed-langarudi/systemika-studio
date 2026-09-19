@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is required to run Systemika Studio from the source tree.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
node web-server.js
if errorlevel 1 pause
