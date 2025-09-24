#!/usr/bin/env python3
"""
Git setup script for EdSight project
This script will initialize git, configure remote, and push to GitHub
"""

import subprocess
import os
import sys

def run_command(command, description):
    """Run a command and return the result"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            if result.stdout:
                print(f"Output: {result.stdout}")
        else:
            print(f"❌ {description} failed")
            if result.stderr:
                print(f"Error: {result.stderr}")
        return result
    except Exception as e:
        print(f"❌ Error running {description}: {e}")
        return None

def main():
    print("🚀 Setting up Git repository for EdSight project...")
    
    # Check if we're in the right directory
    if not os.path.exists("manage.py"):
        print("❌ Error: manage.py not found. Please run this script from the EdSight project root.")
        sys.exit(1)
    
    # Initialize git if not already done
    if not os.path.exists(".git"):
        run_command("git init", "Initializing git repository")
    
    # Add remote origin
    run_command("git remote add origin https://github.com/isaackcz/Edsight.git", "Adding remote origin")
    
    # Add all files
    run_command("git add .", "Adding files to git")
    
    # Check status
    status_result = run_command("git status", "Checking git status")
    
    # Commit changes
    run_command('git commit -m "Initial commit: EdSight project setup with Django backend and FastAPI"', "Committing changes")
    
    # Push to GitHub
    push_result = run_command("git push -u origin master", "Pushing to GitHub")
    
    if push_result and push_result.returncode == 0:
        print("🎉 Successfully pushed to GitHub!")
        print("📁 Repository: https://github.com/isaackcz/Edsight.git")
    else:
        print("⚠️  Push may have failed. Please check the output above.")
        print("💡 You may need to authenticate with GitHub first.")

if __name__ == "__main__":
    main()
