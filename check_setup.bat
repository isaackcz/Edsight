@echo off
echo ================================================
echo    EdSight Setup Validation
echo ================================================
echo.
echo This script will check if your system is ready for EdSight
echo.

echo 🔍 Checking prerequisites...
echo.

REM Check if XAMPP is installed
echo [1/4] Checking XAMPP installation...
if exist "C:\xampp\xampp-control.exe" (
    echo ✅ XAMPP found
) else (
    echo ❌ XAMPP not found at C:\xampp\
    echo    Please install XAMPP from https://www.apachefriends.org/download.html
    goto :error
)

REM Check if Docker is installed
echo [2/4] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker found
    docker --version
) else (
    echo ❌ Docker not found
    echo    Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    goto :error
)

REM Check if Docker is running
echo [3/4] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Docker is running
) else (
    echo ❌ Docker is not running
    echo    Please start Docker Desktop
    goto :error
)

REM Check if project files exist
echo [4/4] Checking project files...
if exist "docker-compose.yml" (
    echo ✅ Project files found
) else (
    echo ❌ Project files not found
    echo    Please make sure you're in the correct directory
    goto :error
)

echo.
echo 🎯 Checking XAMPP services...
echo.

REM Check if MySQL is running
echo Checking MySQL service...
netstat -an | findstr :3306 >nul
if %errorlevel% equ 0 (
    echo ✅ MySQL is running on port 3306
) else (
    echo ⚠️  MySQL might not be running
    echo    Please start MySQL in XAMPP Control Panel
)

REM Check if Apache is running
echo Checking Apache service...
netstat -an | findstr :80 >nul
if %errorlevel% equ 0 (
    echo ✅ Apache is running on port 80
) else (
    echo ⚠️  Apache might not be running
    echo    Please start Apache in XAMPP Control Panel
)

echo.
echo 🐳 Checking Docker containers...
echo.

REM Check if containers are running
docker-compose ps 2>nul | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo ✅ Docker containers are running
    echo.
    echo 📊 Container Status:
    docker-compose ps
) else (
    echo ⚠️  No Docker containers running
    echo    Run 'start_docker.bat' to start the application
)

echo.
echo 🌐 Testing application access...
echo.

REM Test if Django is accessible
curl -s -o nul -w "%%{http_code}" http://localhost:8000/ 2>nul | findstr "200" >nul
if %errorlevel% equ 0 (
    echo ✅ Django application is accessible at http://localhost:8000
) else (
    echo ⚠️  Django application might not be accessible
    echo    Check if containers are running with 'docker-compose ps'
)

echo.
echo ================================================
echo    Setup Validation Complete
echo ================================================
echo.
echo 📋 Summary:
echo    - XAMPP: ✅ Installed
echo    - Docker: ✅ Installed and running
echo    - Project: ✅ Files present
echo    - Services: Check status above
echo.
echo 🚀 Next steps:
echo    1. If MySQL/Apache aren't running, start them in XAMPP
echo    2. If containers aren't running, run 'start_docker.bat'
echo    3. Access your app at http://localhost:8000
echo.
pause
exit /b 0

:error
echo.
echo ❌ Setup validation failed!
echo.
echo 🔧 Please fix the issues above and run this script again.
echo.
pause
exit /b 1
