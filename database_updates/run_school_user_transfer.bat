@echo off
echo ================================================
echo EdSight School User Transfer Utility
echo ================================================
echo.

cd /d "%~dp0"

echo Checking Python environment...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python or add it to PATH.
    pause
    exit /b 1
)

echo.
echo Available options:
echo 1. Dry run (preview changes without making them)
echo 2. Run actual transfer
echo 3. Verify existing transfer
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Running dry-run mode...
    python transfer_school_users.py --dry-run
) else if "%choice%"=="2" (
    echo.
    echo WARNING: This will transfer all school users from users_school to admin_user table.
    echo This operation cannot be easily undone.
    echo.
    set /p confirm="Are you sure you want to continue? (y/N): "
    if /i "%confirm%"=="y" (
        echo.
        echo Running transfer...
        python transfer_school_users.py
    ) else (
        echo Transfer cancelled.
    )
) else if "%choice%"=="3" (
    echo.
    echo Verifying transfer...
    python transfer_school_users.py --verify
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo Press any key to exit...
pause >nul
