@echo off
echo ========================================
echo    EdSight Development Server Starter
echo ========================================
echo.

echo Checking Python installation...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Starting FastAPI Server (Port 8002)...
start "FastAPI Server" cmd /k "python extra/start_fastapi.py"

echo Waiting for FastAPI to start...
timeout /t 5 /nobreak > nul

echo Starting Django Server (Port 8000)...
start "Django Server" cmd /k "python manage.py runserver 0.0.0.0:8000"

echo.
echo ========================================
echo    Servers are starting...
echo ========================================
echo.
echo FastAPI Server: http://127.0.0.1:8002
echo Django Server:  http://127.0.0.1:8000
echo Django Server (Mobile): http://192.168.1.7:8000
echo.
echo User Dashboard: http://127.0.0.1:8000/user-dashboard/
echo Login Page:     http://127.0.0.1:8000/auth/login/
echo Mobile Login:   http://192.168.1.7:8000/auth/login/
echo.
echo Press any key to open the login page in your browser...
pause > nul

echo Opening login page in browser...
start http://127.0.0.1:8000/auth/login/

echo.
echo ========================================
echo    Development servers are running!
echo ========================================
echo.
echo To stop the servers, close the command windows or press Ctrl+C in each window.
echo.
pause