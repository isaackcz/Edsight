@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    EdSight Local Development Server (XAMPP)
echo ================================================
echo.

REM Check if XAMPP MySQL is running
echo [1/7] Checking XAMPP MySQL service...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I /N "mysqld.exe">nul
if errorlevel 1 (
    echo    ❌ MySQL is not running!
    echo    Please start MySQL in XAMPP Control Panel first.
    echo.
    pause
    exit /b 1
) else (
    echo    ✅ MySQL is running
)

REM Check if XAMPP Apache is running (optional but good to verify)
echo.
echo [2/7] Checking XAMPP Apache service...
tasklist /FI "IMAGENAME eq httpd.exe" 2>nul | find /I /N "httpd.exe">nul
if errorlevel 1 (
    echo    ⚠️  Apache is not running (optional for this app)
) else (
    echo    ✅ Apache is running
)

REM Check Python installation
echo.
echo [3/7] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ Python is not installed or not in PATH
    echo    Please install Python 3.8+ and add it to PATH
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo    ✅ Python found: !PYVER!

REM Check if virtual environment exists (optional)
if exist "venv\Scripts\activate.bat" (
    echo.
    echo    Activating virtual environment...
    call venv\Scripts\activate.bat
    echo    ✅ Virtual environment activated
) else (
    echo.
    echo    ⚠️  No virtual environment found (using system Python)
    echo    Consider creating one: python -m venv venv
)

REM Check if requirements are installed
echo.
echo [4/8] Checking Python dependencies...
python -c "import django" >nul 2>&1
if errorlevel 1 (
    echo    ❌ Django not found. Installing requirements...
    echo    This may take a few minutes...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo    ❌ Failed to install requirements!
        pause
        exit /b 1
    )
    echo    ✅ Requirements installed
) else (
    echo    ✅ Python dependencies found
)

REM Check if watchdog and pyautogui are installed (for hard refresh)
python -c "import watchdog" >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  Installing watchdog for file watching...
    pip install watchdog
)
python -c "import pyautogui" >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  Installing pyautogui for browser refresh...
    pip install pyautogui
)

REM Set environment variables for local XAMPP MySQL (no trailing spaces!)
echo.
echo [5/8] Setting up environment variables...
set "DB_HOST=localhost"
set "DB_PORT=3306"
set "DB_NAME=edsight"
set "DB_USER=root"
set "DB_PASSWORD="
set "DEBUG=True"
set "SECRET_KEY=django-insecure-local-dev-key-change-in-production"
set "ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0"

echo    ✅ Environment configured for XAMPP MySQL
echo       Host: %DB_HOST%:%DB_PORT%
echo       Database: %DB_NAME%
echo       User: %DB_USER%

REM Check database connection
echo.
echo [6/8] Testing database connection...
python -c "import mysql.connector; mysql.connector.connect(host='%DB_HOST%', port=%DB_PORT%, user='%DB_USER%', password='%DB_PASSWORD%'); print('✅ Database connection successful')" 2>nul
if errorlevel 1 (
    echo    ⚠️  Could not connect to MySQL
    echo    Make sure:
    echo      - MySQL is running in XAMPP
    echo      - Database 'edsight' exists (or will be created by migrations)
    echo      - MySQL user has proper permissions
)

REM Run migrations
echo.
echo    Running database migrations...
python manage.py migrate --noinput
if errorlevel 1 (
    echo    ⚠️  Migration warning (this is OK if database is already set up)
) else (
    echo    ✅ Migrations completed
)

echo.
echo [7/8] Starting servers...
echo.

REM Start Hard Refresh Watcher (monitors code changes)
echo    Starting Hard Refresh Watcher...
start "Hard Refresh Watcher" cmd /k "python extra\hard_refresh_watcher.py"

REM Wait a moment for watcher to start
timeout /t 2 /nobreak >nul

REM Start FastAPI Server
echo    Starting FastAPI Server (Port 8002)...
start "FastAPI Server" cmd /k "set "DB_HOST=%DB_HOST%" && set "DB_PORT=%DB_PORT%" && set "DB_NAME=%DB_NAME%" && set "DB_USER=%DB_USER%" && set "DB_PASSWORD=%DB_PASSWORD%" && python extra\start_fastapi.py"

REM Wait a moment for FastAPI to start
timeout /t 3 /nobreak >nul

REM Start Django Server
echo    Starting Django Server (Port 8000)...
start "Django Server" cmd /k "set "DB_HOST=%DB_HOST%" && set "DB_PORT=%DB_PORT%" && set "DB_NAME=%DB_NAME%" && set "DB_USER=%DB_USER%" && set "DB_PASSWORD=%DB_PASSWORD%" && set "DEBUG=%DEBUG%" && set "SECRET_KEY=%SECRET_KEY%" && set "ALLOWED_HOSTS=%ALLOWED_HOSTS%" && python manage.py runserver 0.0.0.0:8000"

REM Wait a moment for servers to initialize
timeout /t 5 /nobreak >nul

echo.
echo ================================================
echo    ✅ Servers Started Successfully!
echo ================================================
echo.
echo 🌐 ACCESS YOUR SERVICES:
echo    - Django App: http://localhost:8000
echo    - FastAPI API: http://localhost:8002
echo.
echo 🔗 IMPORTANT PAGES:
echo    - Login Page: http://localhost:8000/auth/login/
echo    - User Dashboard: http://localhost:8000/user-dashboard/
echo    - Admin Panel: http://localhost:8000/admin/
echo.
echo 📊 DATABASE INFO:
echo    - MySQL Host: %DB_HOST%:%DB_PORT%
echo    - Database: %DB_NAME%
echo    - phpMyAdmin: http://localhost/phpmyadmin (if Apache is running)
echo.
echo 📝 NOTES:
echo    - Three command windows opened:
echo      * Hard Refresh Watcher (monitors code changes)
echo      * FastAPI Server (Port 8002)
echo      * Django Server (Port 8000)
echo    - Close those windows to stop the servers
echo    - Files auto-reload on save (Django dev server)
echo    - Hard refresh (Ctrl+F5) triggers automatically on code changes
echo    - Keep browser window focused for auto-refresh to work
echo    - Make sure XAMPP MySQL stays running
echo.
echo Press any key to open the login page in your browser...
pause >nul

echo.
echo Opening login page...
start http://localhost:8000/auth/login/

echo.
echo ================================================
echo    Development servers are running!
echo ================================================
echo.
echo 🔄 HARD REFRESH FEATURE:
echo    - Automatically triggers browser refresh (Ctrl+F5) on code changes
echo    - Monitors: .py, .html, .css, .js, .json, .jsx, .ts, .tsx files
echo    - Keep your browser window active/focused for best results
echo.
echo To stop servers: Close the Hard Refresh Watcher, FastAPI, and Django command windows
echo.

pause

