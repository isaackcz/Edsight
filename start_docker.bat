@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    EdSight Docker - Auto-Refresh Development
echo ================================================
echo.
echo This will start Docker containers with auto-refresh on file changes
echo.
echo PREREQUISITES:
echo    1. Docker Desktop must be installed and running
echo    2. Docker Compose must be available
echo    3. At least 4GB RAM available
echo    4. PowerShell execution policy must allow scripts (optional)
echo.
echo Note: All services are now fully containerized - no XAMPP required!
echo.
pause
echo.

REM Resolve Docker Compose command (supports v2 'docker compose' and v1 'docker-compose')
set "COMPOSE_CMD="
for /f "delims=" %%i in ('docker compose version 2^>nul') do set "COMPOSE_CMD=docker compose"
if not defined COMPOSE_CMD (
    for /f "delims=" %%i in ('docker-compose version 2^>nul') do set "COMPOSE_CMD=docker-compose"
)
if not defined COMPOSE_CMD (
    echo ❌ Docker Compose not found. Please install Docker Desktop and ensure Docker is in PATH.
    echo    Try opening a new terminal and run: docker --version
    pause
    exit /b 1
)

REM Check that Docker engine is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker engine is not running. Please start Docker Desktop and retry.
    pause
    exit /b 1
)

REM Optional: Log file for troubleshooting
set "LOGFILE=%~dp0start_docker.log"
echo [%date% %time%] Starting EdSight containers... > "%LOGFILE%"

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if errorlevel 1 (
    echo ❌ PowerShell is not available. Auto-refresh will be disabled.
    echo Starting containers without auto-refresh...
    goto :start_containers
)

echo 🔄 Setting up auto-refresh file watcher...
echo.

:start_containers
echo.
echo Checking for required Docker images...
echo This may take a few minutes on first run (downloading images)...
echo.

REM Check for required Dockerfiles
echo [1/4] Checking for required files...
if not exist "Dockerfile.django" (
    echo    ⚠️  Warning: Dockerfile.django not found - build may fail
) else (
    echo    ✅ Dockerfile.django found
)

if not exist "Dockerfile.fastapi" (
    echo    ⚠️  Warning: Dockerfile.fastapi not found - build may fail
) else (
    echo    ✅ Dockerfile.fastapi found
)

if not exist "docker-compose.yml" (
    echo    ❌ Error: docker-compose.yml not found!
    pause
    exit /b 1
) else (
    echo    ✅ docker-compose.yml found
)

echo.
echo    Checking Docker images...
docker images mysql:8.0 --format "{{.Repository}}:{{.Tag}}" | findstr /C:"mysql:8.0" >nul 2>&1
if errorlevel 1 (
    echo    ⏳ MySQL image not found - will download on first start...
) else (
    echo    ✅ MySQL image found
)

docker images redis:7-alpine --format "{{.Repository}}:{{.Tag}}" | findstr /C:"redis:7-alpine" >nul 2>&1
if errorlevel 1 (
    echo    ⏳ Redis image not found - will download on first start...
) else (
    echo    ✅ Redis image found
)

docker images nginx:1.27-alpine --format "{{.Repository}}:{{.Tag}}" | findstr /C:"nginx:1.27-alpine" >nul 2>&1
if errorlevel 1 (
    echo    ⏳ Nginx image not found - will download on first start...
) else (
    echo    ✅ Nginx image found
)

echo.
echo [2/5] Starting Docker containers (this may take 2-5 minutes on first run)...
echo       Watch for progress below...
echo.
echo       If this hangs for more than 10 minutes, press Ctrl+C and check:
echo       1. Docker Desktop is running
echo       2. Your internet connection (for downloading images)
echo       3. Disk space available
echo.

REM Show output in real-time instead of redirecting
%COMPOSE_CMD% up -d --build
set COMPOSE_EXIT_CODE=%ERRORLEVEL%

if errorlevel 1 (
    echo.
    echo ❌ Failed to start Docker containers!
    echo.
    echo Troubleshooting steps:
    echo   1. Check Docker Desktop is running: docker info
    echo   2. Check logs: %COMPOSE_CMD% logs
    echo   3. Try manually: %COMPOSE_CMD% up -d --build
    echo   4. Check log file: "%LOGFILE%"
    echo.
    pause
    exit /b 1
)

echo.
echo [3/5] Waiting for containers to initialize (5 seconds)...
timeout /t 5 /nobreak >nul

echo.
echo [4/5] Checking container status...
%COMPOSE_CMD% ps
echo.

REM Check if containers are running
%COMPOSE_CMD% ps --format json | findstr /C:"running" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Some containers may not be running yet. Check status above.
    echo    This is normal if images are still being downloaded/built.
    echo    Wait a minute and check: %COMPOSE_CMD% ps
    echo.
) else (
    echo ✅ Containers are running!
    echo.
)

echo [5/5] Starting file watcher (if available)...
echo.

REM Start file watcher in background if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if not errorlevel 1 (
    echo 🔍 Starting file watcher for auto-refresh...
    start /b powershell -Command "& {
        $watcher = New-Object System.IO.FileSystemWatcher
        $watcher.Path = Get-Location
        $watcher.Filter = '*.*'
        $watcher.IncludeSubdirectories = $true
        $watcher.EnableRaisingEvents = $true
        
        $action = {
            $path = $Event.SourceEventArgs.FullPath
            $changeType = $Event.SourceEventArgs.ChangeType
            $timestamp = Get-Date -Format 'HH:mm:ss'
            
            # Check if file is in frontend or backend directories
            if ($path -match '(app\\static|frontend|apps\\|backend\\|config\\)' -and 
                $path -match '\.(py|js|css|html|json)$' -and 
                $changeType -eq 'Changed') {
                
                Write-Host \"[$timestamp] 🔄 File changed: $path\" -ForegroundColor Yellow
                Write-Host \"[$timestamp] 🔄 Restarting containers...\" -ForegroundColor Cyan
                
                # Restart containers
                $compose = 'docker compose'
                if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { $compose = 'docker-compose' }
                & $compose restart
                if ($LASTEXITCODE -eq 0) {
                    Write-Host \"[$timestamp] ✅ Containers restarted successfully!\" -ForegroundColor Green
                } else {
                    Write-Host \"[$timestamp] ❌ Failed to restart containers!\" -ForegroundColor Red
                }
            }
        }
        
        Register-ObjectEvent -InputObject $watcher -EventName 'Changed' -Action $action | Out-Null
        
        Write-Host \"[$timestamp] 🔍 File watcher started. Monitoring for changes...\" -ForegroundColor Green
        Write-Host \"[$timestamp] 📁 Watching: $(Get-Location)\" -ForegroundColor Gray
        Write-Host \"[$timestamp] 🎯 File types: .py, .js, .css, .html, .json\" -ForegroundColor Gray
        Write-Host \"[$timestamp] 📂 Directories: app/static, frontend, apps/, backend/, config/\" -ForegroundColor Gray
        
        # Keep the watcher running
        try {
            while ($true) {
                Start-Sleep -Seconds 1
            }
        } finally {
            $watcher.Dispose()
        }
    }"
    
    echo 🔍 File watcher started in background!
    echo.
)

echo 🌐 ACCESS YOUR SERVICES:
echo    - Django App: http://localhost:8000
echo    - FastAPI App: http://localhost:9000
echo    - Nginx Load Balancer: http://localhost:8082
echo    - MySQL Database: localhost:3307
echo    - Redis Cache: localhost:6380
echo.
echo 📊 MONITORING:
echo    - Check status: docker-compose ps
echo    - View logs: docker-compose logs -f
echo    - Stop services: docker-compose down
echo.
echo 🔄 AUTO-REFRESH:
echo    - File changes in frontend/backend will auto-restart containers
echo    - Supported file types: .py, .js, .css, .html, .json
echo    - Monitored directories: app/static, frontend, apps/, backend/, config/
echo.
echo ✅ Note: All services are now fully containerized - no XAMPP required!
echo.
echo Press Ctrl+C to stop all services and file watcher
echo.

REM Keep the script running to maintain the file watcher
:monitor_loop
timeout /t 5 /nobreak >nul
goto :monitor_loop
