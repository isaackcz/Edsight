@echo off
echo ================================================
echo    Quick Docker Cleanup
echo ================================================
echo.
echo Quick cleanup to free some space and RAM
echo.
echo 🔄 Cleaning up unused Docker resources...
echo.

echo 🧹 Removing stopped containers...
docker container prune -f

echo 🗑️ Removing unused images...
docker image prune -f

echo 🏗️ Removing build cache...
docker builder prune -f

echo.
echo 📊 Current Docker usage:
docker system df
echo.

echo ✅ Quick cleanup completed!
echo.
pause
