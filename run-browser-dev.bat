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

echo ERROR: package.json does not define an npm "dev" script.
echo Browser dev mode cannot be started until a dev script is added.
goto error

:error
echo.
echo Browser dev launcher failed. Review the message above.
pause
popd
exit /b 1
