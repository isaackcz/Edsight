@echo off
REM ============================================================
REM EdSight - Fix Forms Table Schema
REM Ensures admin_id properly references admin_users table
REM ============================================================

echo.
echo ============================================================
echo EdSight - Fix Forms Table Schema
echo ============================================================
echo.
echo This will ensure forms.admin_id properly references admin_users.admin_id
echo.
echo Changes:
echo   - Rename user_id to admin_id (if exists)
echo   - Set correct data type: varchar(255)
echo   - Add foreign key constraint
echo.
echo IMPORTANT: Backup will be created automatically
echo.

pause

echo.
echo Step 1: Creating backup...
echo.

set MYSQL_PATH=D:\xampp\mysql\bin
set DB_USER=root

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /format:list') do set datetime=%%I
set BACKUP_FILE=edsight_forms_backup_%datetime:~0,8%_%datetime:~8,6%.sql

echo Backup location: %BACKUP_FILE%
echo.

"%MYSQL_PATH%\mysqldump.exe" -u %DB_USER% -p edsight forms > "%BACKUP_FILE%"

if errorlevel 1 (
    echo ERROR: Backup failed!
    echo Please check your MySQL password and try again.
    pause
    exit /b 1
)

echo ✅ Backup created successfully
echo.

echo Step 2: Applying schema fix...
echo.

"%MYSQL_PATH%\mysql.exe" -u %DB_USER% -p edsight < "fix_forms_schema_correct.sql"

if errorlevel 1 (
    echo.
    echo ❌ ERROR: Migration failed!
    echo.
    echo Your backup is safe at: %BACKUP_FILE%
    echo.
    echo To restore, run:
    echo "%MYSQL_PATH%\mysql.exe" -u %DB_USER% -p edsight ^< %BACKUP_FILE%
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo ✅ SUCCESS! Forms table schema fixed
echo ============================================================
echo.
echo Changes applied:
echo   ✅ forms.admin_id now references admin_users.admin_id
echo   ✅ Data type: varchar(255)
echo   ✅ Foreign key constraint added
echo   ✅ Index created for performance
echo.
echo Backup saved at: %BACKUP_FILE%
echo.
echo ============================================================
echo NEXT STEPS:
echo ============================================================
echo.
echo 1. Restart your Django development server
echo 2. Test the API endpoints:
echo    - http://localhost:8000/user/dashboard/api/categories/
echo    - http://localhost:8000/user/dashboard/api/progress/
echo 3. Check browser console - should see 200 OK responses
echo.
echo ============================================================

pause

