@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    EdSight Docker Build Script
echo    Optimized for Fast Builds
echo ================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and retry.
    pause
    exit /b 1
)

REM Resolve Docker Compose command (supports v2 'docker compose' and v1 'docker-compose')
set "COMPOSE_CMD="
for /f "delims=" %%i in ('docker compose version 2^>nul') do set "COMPOSE_CMD=docker compose"
if not defined COMPOSE_CMD (
    for /f "delims=" %%i in ('docker-compose version 2^>nul') do set "COMPOSE_CMD=docker-compose"
)
if not defined COMPOSE_CMD (
    echo [ERROR] Docker Compose not found. Please install Docker Desktop.
    pause
    exit /b 1
)

echo [INFO] Using: %COMPOSE_CMD%
echo.

REM Enable BuildKit for faster builds (Windows equivalent)
echo [TIP] Enabling Docker BuildKit for faster builds...
set "DOCKER_BUILDKIT=1"
set "COMPOSE_DOCKER_CLI_BUILD=1"
echo [OK] BuildKit enabled
echo.

REM Parse command line arguments
set "BUILD_MODE=all"
set "PARALLEL=--parallel"
set "NO_CACHE="
set "SERVICE="

:parse_args
if "%~1"=="" goto :build_start
if /i "%~1"=="--no-cache" (
    set "NO_CACHE=--no-cache"
    echo [INFO] Building without cache (slower but ensures fresh build)
    shift
    goto :parse_args
)
if /i "%~1"=="--no-parallel" (
    set "PARALLEL="
    echo [INFO] Building sequentially (may be slower)
    shift
    goto :parse_args
)
if /i "%~1"=="django" (
    set "SERVICE=django"
    set "BUILD_MODE=single"
    shift
    goto :parse_args
)
if /i "%~1"=="fastapi" (
    set "SERVICE=fastapi"
    set "BUILD_MODE=single"
    shift
    goto :parse_args
)
if /i "%~1"=="celery" (
    set "SERVICE=celery"
    set "BUILD_MODE=single"
    shift
    goto :parse_args
)
if /i "%~1"=="--help" (
    goto :show_help
)
shift
goto :parse_args

:show_help
echo.
echo Usage: build_docker.bat [options] [service]
echo.
echo Options:
echo   --no-cache       Build without using cache (slower but fresh)
echo   --no-parallel    Build sequentially instead of in parallel
echo   --help           Show this help message
echo.
echo Services (build only specific service):
echo   django           Build only Django image
echo   fastapi          Build only FastAPI image
echo   celery           Build only Celery image
echo.
echo Examples:
echo   build_docker.bat                    Build all images in parallel
echo   build_docker.bat django             Build only Django image
echo   build_docker.bat --no-cache         Build all without cache
echo   build_docker.bat --no-parallel      Build all sequentially
echo.
pause
exit /b 0

:build_start
echo ================================================
echo    Build Configuration
echo ================================================
echo   BuildKit: Enabled
echo   Mode: %BUILD_MODE%
if defined SERVICE (
    echo   Service: %SERVICE%
)
if defined PARALLEL (
    echo   Parallel: Yes
) else (
    echo   Parallel: No
)
if defined NO_CACHE (
    echo   Cache: Disabled
) else (
    echo   Cache: Enabled
)
echo ================================================
echo.

REM Show build tips
echo [TIPS] Speed up your build:
echo   - First build: 25-35 minutes (downloading base images)
echo   - Subsequent builds: 1-5 minutes (using cache)
echo   - BuildKit is enabled for faster builds
if defined PARALLEL (
    echo   - Building in parallel for faster completion
)
if not defined NO_CACHE (
    echo   - Using cache for faster rebuilds
    echo   - Use --no-cache only when you need a fresh build
)
echo.

REM Check disk space (basic check)
echo [INFO] Checking available disk space...
for /f "tokens=3" %%a in ('dir /-c ^| find "bytes free"') do set "FREESPACE=%%a"
echo [INFO] Free space available
echo.

REM Show current image sizes before build
echo [INFO] Current image sizes:
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | findstr /i "edsight python mysql redis nginx" 2>nul || echo   No existing images found
echo.

REM Start build timer
set "START_TIME=%TIME%"
echo [BUILD] Starting build at %START_TIME%...
echo.

REM Build based on mode
if "%BUILD_MODE%"=="single" (
    echo [BUILD] Building %SERVICE% service...
    %COMPOSE_CMD% build %NO_CACHE% %SERVICE%
    set "BUILD_EXIT_CODE=%ERRORLEVEL%"
) else (
    echo [BUILD] Building all services...
    if defined PARALLEL (
        %COMPOSE_CMD% build %NO_CACHE% --parallel
    ) else (
        %COMPOSE_CMD% build %NO_CACHE%
    )
    set "BUILD_EXIT_CODE=%ERRORLEVEL%"
)

echo.

REM Check build result
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    echo.
    echo Troubleshooting:
    echo   1. Check Docker Desktop is running
    echo   2. Check internet connection (needed for base images)
    echo   3. Check disk space (need at least 5GB free)
    echo   4. Try: docker system prune -a (clean up old images)
    echo   5. Check logs above for specific errors
    echo.
    pause
    exit /b 1
)

REM Calculate build time
set "END_TIME=%TIME%"
echo [SUCCESS] Build completed at %END_TIME%!
echo.

REM Show new image sizes
echo [INFO] Built image sizes:
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | findstr /i "edsight"
echo.

REM Show total disk usage
echo [INFO] Docker disk usage:
docker system df
echo.

REM Show build tips for next time
echo ================================================
echo    Build Tips for Next Time
echo ================================================
echo   - Build only changed service: build_docker.bat django
echo   - Faster rebuilds: Use cache (default)
echo   - Fresh build: build_docker.bat --no-cache
echo   - Check image sizes: docker images ^| findstr edsight
echo   - Clean up old images: docker system prune -a
echo   - View build progress: Add --progress=plain flag
echo ================================================
echo.

REM Show next steps
echo [NEXT STEPS]
echo   1. Start services: docker-compose up -d
echo   2. View logs: docker-compose logs -f
echo   3. Check status: docker-compose ps
echo   4. Stop services: docker-compose down
echo.

pause
exit /b 0

