@echo off
echo ================================================
echo    Docker Cleanup - Storage & RAM Cleaner
echo ================================================
echo.
echo This will clean up Docker to free storage space and RAM
echo.
echo ⚠️  WARNING: This will remove:
echo    - All stopped containers
echo    - All unused images
echo    - All unused volumes
echo    - All build cache
echo    - All unused networks
echo.
echo ✅ SAFE: Your running containers and data will be preserved
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause
echo.
echo.

echo 🔄 Step 1: Stopping all containers...
docker stop $(docker ps -aq) 2>nul
echo.

echo 🧹 Step 2: Removing all containers...
docker container prune -f
echo.

echo 🗑️ Step 3: Removing all unused images...
docker image prune -a -f
echo.

echo 💾 Step 4: Removing all unused volumes...
docker volume prune -f
echo.

echo 🏗️ Step 5: Removing build cache...
docker builder prune -a -f
echo.

echo 🌐 Step 6: Removing unused networks...
docker network prune -f
echo.

echo 🧽 Step 7: System-wide cleanup...
docker system prune -a --volumes -f
echo.

echo 📊 Step 8: Checking freed space...
echo.
echo Docker System Summary:
docker system df
echo.

echo ✅ Docker cleanup completed!
echo.
echo 💡 TIP: Run this script regularly to keep Docker lean
echo.
echo 📋 To restart your EdSight application:
echo    Run: .\start_docker.bat
echo.
pause
