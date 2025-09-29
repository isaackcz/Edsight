@echo off
setlocal enabledelayedexpansion

REM Project root check
if not exist manage.py (
  echo Please run this script from the project root where manage.py exists.
  exit /b 1
)

REM Ensure .env exists
if not exist .env (
  if exist .env.docker (
    copy /Y .env.docker .env >NUL
    echo Created .env from .env.docker
  ) else (
    echo .env not found and .env.docker missing. Please create .env and rerun.
    exit /b 1
  )
)

REM Build images
echo Building Docker images...
docker compose build
if errorlevel 1 (
  echo Build failed.
  exit /b 1
)

REM Start stack
echo Starting containers...
docker compose up -d
if errorlevel 1 (
  echo Failed to start containers.
  exit /b 1
)

REM Wait briefly then show status
timeout /t 3 >NUL
echo Container status:
docker compose ps

echo Done. Access via:
echo - Nginx: http://localhost/
echo - Django: http://localhost:8000/
echo - FastAPI: http://localhost:9000/health
endlocal