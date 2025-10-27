@echo off
setlocal enabledelayedexpansion

echo ================================================
echo    EdSight Docker - Auto-Refresh Development
echo ================================================
echo.
echo This will start Docker containers with auto-refresh on file changes
echo.
echo PREREQUISITES:
echo    1. Start XAMPP Control Panel as Administrator
echo    2. Start MySQL service in XAMPP
echo    3. Start Apache service in XAMPP
echo    4. PowerShell execution policy must allow scripts
echo.
echo Press any key when XAMPP MySQL and Apache are running...
pause
echo.

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
echo Starting Docker containers...
docker-compose up -d
if errorlevel 1 (
    echo ❌ Failed to start Docker containers!
    pause
    exit /b 1
)

echo.
echo ✅ Docker containers started!
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
                docker-compose restart
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
