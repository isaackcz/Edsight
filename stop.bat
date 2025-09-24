@echo off
echo ========================================
echo    Stopping EdSight Development Servers
echo ========================================
echo.

echo Stopping FastAPI Server...
taskkill /f /im python.exe /fi "WINDOWTITLE eq FastAPI Server*" >nul 2>&1

echo Stopping Django Server...
taskkill /f /im python.exe /fi "WINDOWTITLE eq Django Server*" >nul 2>&1

echo Stopping any remaining Python processes on ports 8000 and 8002...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8002') do taskkill /f /pid %%a >nul 2>&1

echo.
echo ========================================
echo    All servers have been stopped!
echo ========================================
echo.
pause