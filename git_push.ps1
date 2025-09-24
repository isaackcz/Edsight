# PowerShell script to push EdSight to GitHub
Write-Host "🚀 Setting up Git repository for EdSight project..." -ForegroundColor Green

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
}

# Add remote origin
Write-Host "Adding remote origin..." -ForegroundColor Yellow
git remote add origin https://github.com/isaackcz/Edsight.git

# Add all files
Write-Host "Adding files to git..." -ForegroundColor Yellow
git add .

# Check status
Write-Host "Checking git status..." -ForegroundColor Yellow
git status

# Commit changes
Write-Host "Committing changes..." -ForegroundColor Yellow
git commit -m "Initial commit: EdSight project setup with Django backend and FastAPI"

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin master

Write-Host "✅ Done! Check your repository at https://github.com/isaackcz/Edsight.git" -ForegroundColor Green
