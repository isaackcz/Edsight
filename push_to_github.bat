@echo off
echo Setting up Git repository for EdSight...

REM Check if git is initialized
if not exist ".git" (
    echo Initializing git repository...
    git init
)

REM Add remote origin
echo Adding remote origin...
git remote add origin https://github.com/isaackcz/Edsight.git

REM Add all files (respecting .gitignore)
echo Adding files to git...
git add .

REM Check status
echo Checking git status...
git status

REM Commit changes
echo Committing changes...
git commit -m "Initial commit: EdSight project setup with Django backend and FastAPI"

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin master

echo Done! Check your repository at https://github.com/isaackcz/Edsight.git
pause
