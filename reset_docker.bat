@echo off
echo ================================================
echo    Docker Complete Reset - Nuclear Option
echo ================================================
echo.
echo ⚠️  DANGER: This will COMPLETELY reset Docker!
echo.
echo This will remove:
echo    - ALL containers (running and stopped)
echo    - ALL images (including base images)
echo    - ALL volumes (including data)
echo    - ALL networks
echo    - ALL build cache
echo    - EVERYTHING Docker-related
echo.
echo 🔥 This is the "nuclear option" for a fresh start
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause
echo.
echo.

echo 🛑 Step 1: Stopping ALL containers...
docker stop $(docker ps -aq) 2>nul
echo.

echo 💥 Step 2: Removing ALL containers...
docker rm $(docker ps -aq) 2>nul
echo.

echo 🗑️ Step 3: Removing ALL images...
docker rmi $(docker images -aq) 2>nul
echo.

echo 💾 Step 4: Removing ALL volumes...
docker volume rm $(docker volume ls -q) 2>nul
echo.

echo 🌐 Step 5: Removing ALL networks...
docker network rm $(docker network ls -q) 2>nul
echo.

echo 🏗️ Step 6: Removing ALL build cache...
docker builder prune -a -f
echo.

echo 🧽 Step 7: System-wide nuclear cleanup...
docker system prune -a --volumes -f
echo.

echo 📊 Step 8: Final system status...
echo.
echo Docker System Summary:
docker system df
echo.

echo ✅ Docker completely reset!
echo.
echo 🚀 Next steps:
echo    1. Run: .\start_docker.bat (to rebuild everything)
echo    2. Wait for Docker to download and rebuild images
echo    3. Your XAMPP data will be preserved
echo.
pause
