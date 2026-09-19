@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is required to run Systemika from source.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe (
  echo Installing the Electron runtime for Systemika...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
call npm run electron
