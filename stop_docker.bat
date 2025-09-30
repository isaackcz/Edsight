@echo off
echo ================================================
echo    Stopping EdSight Docker
echo ================================================
echo.
echo Stopping Docker containers...
docker-compose down
echo.
echo ✅ Docker containers stopped!
echo.
echo Your XAMPP MySQL data is preserved.
echo You can now use XAMPP normally or restart Docker anytime.
echo.
pause
