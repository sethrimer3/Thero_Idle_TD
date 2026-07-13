@echo off
setlocal
pushd "%~dp0"

if /i not "%~1"=="--hidden" (
  powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', '\"%~f0\" --hidden') -WorkingDirectory '%~dp0' -WindowStyle Hidden"
  timeout /t 1 /nobreak >nul
  popd
  exit /b 0
)

if not exist package.json (
  echo ERROR: package.json was not found in this folder.
  goto error
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto error
)

echo Starting Thero Idle TD desktop launcher with: npm run desktop
call npm run desktop
if errorlevel 1 goto error

popd
exit /b 0

:error
echo.
echo Desktop launcher failed. Review the error above.
pause
popd
exit /b 1
