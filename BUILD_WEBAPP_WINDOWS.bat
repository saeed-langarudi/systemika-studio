@echo off
setlocal
cd /d "%~dp0"
echo Building Systemika Studio WebApp...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js was not found.
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
node -e "const [M,m]=process.versions.node.split('.').map(Number); process.exit(M > 22 || (M === 22 && m >= 12) ? 0 : 1)"
if errorlevel 1 (
  echo.
  echo ERROR: Systemika WebApp builds require Node.js 22.12 or newer.
  pause
  exit /b 1
)
node build\build.js
if errorlevel 1 (
  echo.
  echo ERROR: WebApp build failed.
  pause
  exit /b 1
)
for /f "tokens=2 delims=:," %%V in ('findstr /c:"\"version\"" package.json') do set VER=%%~V
set VER=%VER: =%
set VER=%VER:"=%
echo.
echo WebApp build completed.
echo Output: build\output\web\%VER%
echo Upload the CONTENTS of that folder as one complete release.
pause
endlocal
