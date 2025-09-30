@echo off
echo ================================================
echo    EdSight Docker - Single Solution
echo ================================================
echo.
echo This will start Docker containers that use your XAMPP MySQL data
echo.
echo PREREQUISITES:
echo    1. Start XAMPP Control Panel as Administrator
echo    2. Start MySQL service in XAMPP
echo    3. Start Apache service in XAMPP
echo.
echo Press any key when XAMPP MySQL and Apache are running...
pause
echo.
echo Starting Docker containers...
docker-compose up -d
echo.
echo ✅ Docker containers started!
echo.
echo 🌐 ACCESS YOUR SERVICES:
echo    - Django App: http://localhost:8000
echo    - FastAPI App: http://localhost:9000
echo    - Nginx Load Balancer: http://localhost:8082
echo    - XAMPP phpMyAdmin: http://localhost/phpmyadmin
echo.
echo 📊 MONITORING:
echo    - Check status: docker-compose ps
echo    - View logs: docker-compose logs -f
echo    - Stop services: docker-compose down
echo.
echo ⚠️  Note: Keep XAMPP MySQL and Apache running while using Docker
echo.
pause
