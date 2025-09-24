#!/usr/bin/env python
"""
Quick test script to check school users and run migration
"""

import os
import sys
import django

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from app.models import UsersSchool, AdminUser

def main():
    print("=== School User Transfer Test ===")
    
    try:
        # Check users_school table
        school_users = UsersSchool.objects.all()
        print(f"Users in users_school table: {school_users.count()}")
        
        if school_users.count() > 0:
            print("\nFirst 5 school users:")
            for user in school_users[:5]:
                print(f"  - {user.username} ({user.email}) - {user.school_name}")
        
        # Check admin_user table for school users
        admin_school_users = AdminUser.objects.filter(admin_level='school')
        print(f"\nSchool users in admin_user table: {admin_school_users.count()}")
        
        if admin_school_users.count() > 0:
            print("\nFirst 5 admin school users:")
            for user in admin_school_users[:5]:
                print(f"  - {user.username} ({user.email}) - {user.assigned_area}")
        
        print("\n=== Test completed ===")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
