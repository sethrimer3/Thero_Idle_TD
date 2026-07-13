@echo off
setlocal
pushd "%~dp0"

if not exist package.json (
  echo ERROR: package.json was not found in this folder.
  goto error
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto error
)

echo Building Thero Idle TD with: npm run build
call npm run build
if errorlevel 1 goto error

popd
exit /b 0

:error
echo.
echo Build failed. Review the error above.
pause
popd
exit /b 1
