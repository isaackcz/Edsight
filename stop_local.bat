@echo off
echo ================================================
echo    Stopping EdSight Local Development Servers
echo ================================================
echo.

echo Stopping Django Server...
taskkill /FI "WINDOWTITLE eq Django Server*" /F >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  Django Server window not found
) else (
    echo    ✅ Django Server stopped
)

echo.
echo Stopping FastAPI Server...
taskkill /FI "WINDOWTITLE eq FastAPI Server*" /F >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  FastAPI Server window not found
) else (
    echo    ✅ FastAPI Server stopped
)

echo.
echo Also stopping any processes on ports 8000 and 8002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8002" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ================================================
echo    ✅ All local servers stopped!
echo ================================================
echo.
pause

