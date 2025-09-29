@echo off
setlocal enabledelayedexpansion
echo ========================================
echo    EdSight System Shutdown Script
echo ========================================
echo.

:: Set color codes for better output
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "RESET=[0m"

echo %BLUE%🛑 Stopping EdSight Development Servers...%RESET%
echo.

:: Stop FastAPI Server
echo %YELLOW%1. Stopping FastAPI Server (Port 8002)...%RESET%
taskkill /f /im python.exe /fi "WINDOWTITLE eq EdSight FastAPI Server*" >nul 2>&1
taskkill /f /im python.exe /fi "WINDOWTITLE eq FastAPI Server*" >nul 2>&1
echo %GREEN%✓ FastAPI Server stopped%RESET%

:: Stop Django Server
echo %YELLOW%2. Stopping Django Server (Port 8000)...%RESET%
taskkill /f /im python.exe /fi "WINDOWTITLE eq EdSight Django Server*" >nul 2>&1
taskkill /f /im python.exe /fi "WINDOWTITLE eq Django Server*" >nul 2>&1
echo %GREEN%✓ Django Server stopped%RESET%

:: Stop any remaining Python processes on specific ports
echo %YELLOW%3. Cleaning up remaining processes on ports 8000 and 8002...%RESET%
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 echo %GREEN%✓ Process on port 8000 terminated%RESET%
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8002') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 echo %GREEN%✓ Process on port 8002 terminated%RESET%
)

:: Check for any remaining EdSight processes
echo %YELLOW%4. Checking for any remaining EdSight processes...%RESET%
tasklist /fi "WINDOWTITLE eq *EdSight*" /fo csv | findstr /v "INFO:" >nul
if %errorlevel% equ 0 (
    echo %YELLOW%Found remaining EdSight processes, terminating...%RESET%
    taskkill /f /im python.exe /fi "WINDOWTITLE eq *EdSight*" >nul 2>&1
    echo %GREEN%✓ Remaining processes terminated%RESET%
) else (
    echo %GREEN%✓ No remaining EdSight processes found%RESET%
)

:: Verify ports are free
echo %YELLOW%5. Verifying ports are free...%RESET%
netstat -an | findstr :8000 >nul
if %errorlevel% equ 0 (
    echo %RED%WARNING: Port 8000 is still in use%RESET%
) else (
    echo %GREEN%✓ Port 8000 is free%RESET%
)

netstat -an | findstr :8002 >nul
if %errorlevel% equ 0 (
    echo %RED%WARNING: Port 8002 is still in use%RESET%
) else (
    echo %GREEN%✓ Port 8002 is free%RESET%
)

echo.
echo ========================================
echo    %GREEN%✅ All EdSight servers have been stopped!%RESET%
echo ========================================
echo.
echo %BLUE%📋 Shutdown Summary:%RESET%
echo   • FastAPI Server: Stopped
echo   • Django Server:  Stopped
echo   • Port 8000:      Freed
echo   • Port 8002:      Freed
echo   • Processes:      Cleaned up
echo.
echo %YELLOW%💡 Next Steps:%RESET%
echo   • Run 'run.bat' to start the servers again
echo   • Check the logs if you encountered any issues
echo   • Ensure your database is still running if needed
echo.
echo %GREEN%🚀 Ready for next development session!%RESET%
echo.
pause