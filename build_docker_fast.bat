@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    EdSight Docker Fast Build
echo    Optimized for Maximum Speed
echo ================================================
echo.

REM Enable BuildKit
set "DOCKER_BUILDKIT=1"
set "COMPOSE_DOCKER_CLI_BUILD=1"

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    pause
    exit /b 1
)

REM Resolve Docker Compose command
set "COMPOSE_CMD="
for /f "delims=" %%i in ('docker compose version 2^>nul') do set "COMPOSE_CMD=docker compose"
if not defined COMPOSE_CMD (
    for /f "delims=" %%i in ('docker-compose version 2^>nul') do set "COMPOSE_CMD=docker-compose"
)

echo [FAST BUILD] Building all services in parallel with BuildKit...
echo.

REM Build with all optimizations
%COMPOSE_CMD% build --parallel

if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Fast build completed!
echo.
pause

