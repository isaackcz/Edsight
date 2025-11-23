@echo off
REM ============================================================
REM Clear Form Data for User 100001@deped.gov.ph
REM ============================================================

echo.
echo ============================================================
echo Clear Form Data for User
echo ============================================================
echo.
echo This will delete ALL forms and answers for: 100001@deped.gov.ph
echo.
echo WARNING: This action cannot be undone!
echo.

pause

echo.
echo Running cleanup script...
echo.

python manage.py shell < clear_user_form_data.py

if errorlevel 1 (
    echo.
    echo ERROR: Script failed!
    echo Trying alternative method...
    echo.
    
    python manage.py shell -c "exec(open('clear_user_form_data.py').read())"
)

echo.
echo ============================================================
echo Done!
echo ============================================================
echo.
pause

