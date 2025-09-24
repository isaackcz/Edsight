#!/usr/bin/env python3
"""
Comprehensive GitHub setup script for EdSight project
"""

import subprocess
import os
import sys
import time

def execute_command(command, description, show_output=True):
    """Execute a command and handle the output"""
    print(f"🔄 {description}...")
    
    try:
        # Use subprocess.run with proper encoding for Windows
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            encoding='utf-8',
            errors='replace',
            cwd=os.getcwd()
        )
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            if show_output and result.stdout:
                print(f"Output: {result.stdout}")
        else:
            print(f"❌ {description} failed with return code {result.returncode}")
            if result.stderr:
                print(f"Error: {result.stderr}")
        
        return result
        
    except Exception as e:
        print(f"❌ Exception in {description}: {e}")
        return None

def main():
    print("🚀 EdSight GitHub Setup Script")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("manage.py"):
        print("❌ Error: manage.py not found. Please run this script from the EdSight project root.")
        sys.exit(1)
    
    print("📁 Current directory:", os.getcwd())
    print("📄 Files in directory:", len(os.listdir('.')))
    
    # Step 1: Initialize git if needed
    if not os.path.exists(".git"):
        print("\n🔧 Step 1: Initializing git repository...")
        result = execute_command("git init", "Initializing git repository")
        if not result or result.returncode != 0:
            print("❌ Failed to initialize git repository")
            return
    else:
        print("✅ Git repository already initialized")
    
    # Step 2: Configure git user (if not set)
    print("\n🔧 Step 2: Configuring git user...")
    execute_command('git config user.name "EdSight Developer"', "Setting git user name")
    execute_command('git config user.email "developer@edsight.com"', "Setting git user email")
    
    # Step 3: Add remote origin
    print("\n🔧 Step 3: Adding remote origin...")
    # Remove existing origin if it exists
    execute_command("git remote remove origin", "Removing existing origin (if any)", show_output=False)
    result = execute_command("git remote add origin https://github.com/isaackcz/Edsight.git", "Adding remote origin")
    if not result or result.returncode != 0:
        print("❌ Failed to add remote origin")
        return
    
    # Step 4: Add all files
    print("\n🔧 Step 4: Adding files to git...")
    result = execute_command("git add .", "Adding files to git")
    if not result or result.returncode != 0:
        print("❌ Failed to add files to git")
        return
    
    # Step 5: Check what's staged
    print("\n🔧 Step 5: Checking staged files...")
    result = execute_command("git status --porcelain", "Checking staged files")
    if result and result.stdout:
        print(f"Files to be committed: {len(result.stdout.strip().split('\\n'))}")
    
    # Step 6: Commit changes
    print("\n🔧 Step 6: Committing changes...")
    commit_message = "Initial commit: EdSight project setup with Django backend and FastAPI"
    result = execute_command(f'git commit -m "{commit_message}"', "Committing changes")
    if not result or result.returncode != 0:
        print("❌ Failed to commit changes")
        return
    
    # Step 7: Push to GitHub
    print("\n🔧 Step 7: Pushing to GitHub...")
    result = execute_command("git push -u origin master", "Pushing to GitHub")
    
    if result and result.returncode == 0:
        print("\n🎉 SUCCESS! EdSight project has been pushed to GitHub!")
        print("📁 Repository: https://github.com/isaackcz/Edsight.git")
        print("🔍 You can now view your project on GitHub")
    else:
        print("\n⚠️  Push may have failed. This could be due to:")
        print("   - Authentication issues (need to set up GitHub credentials)")
        print("   - Network connectivity issues")
        print("   - Repository permissions")
        print("\n💡 Try running these commands manually:")
        print("   git push -u origin master")
        print("   or set up GitHub authentication first")

if __name__ == "__main__":
    main()
