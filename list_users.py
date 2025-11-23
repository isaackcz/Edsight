#!/usr/bin/env python
"""
Script to list all users in the database
Run with: python list_users.py
Or: docker exec edsight_django python /app/list_users.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import AdminUser, UsersSchool
from django.contrib.auth import get_user_model

User = get_user_model()

def list_all_users():
    """List all users from all tables"""
    
    print("=" * 80)
    print("ADMIN USERS (admin_user table)")
    print("=" * 80)
    admin_users = AdminUser.objects.all().order_by('admin_level', 'username')
    if admin_users.exists():
        print(f"\nTotal: {admin_users.count()} admin users\n")
        print(f"{'ID':<6} {'Username':<25} {'Email':<35} {'Level':<12} {'Status':<10}")
        print("-" * 80)
        for admin in admin_users:
            print(f"{admin.admin_id:<6} {admin.username:<25} {admin.email:<35} {admin.admin_level:<12} {admin.status:<10}")
    else:
        print("No admin users found.")

    print("\n" + "=" * 80)
    print("SCHOOL USERS (users_school table)")
    print("=" * 80)
    school_users = UsersSchool.objects.all().order_by('username')
    if school_users.exists():
        print(f"\nTotal: {school_users.count()} school users\n")
        print(f"{'ID':<6} {'Username':<25} {'Email':<35} {'School ID':<12} {'Status':<10}")
        print("-" * 80)
        for user in school_users[:20]:  # Show first 20
            school_id = str(user.school_id) if user.school_id else 'N/A'
            status = 'Active' if user.is_active else 'Inactive'
            print(f"{user.id:<6} {user.username:<25} {user.email:<35} {school_id:<12} {status:<10}")
        if school_users.count() > 20:
            print(f"\n... and {school_users.count() - 20} more school users")
    else:
        print("No school users found.")

    print("\n" + "=" * 80)
    print("DJANGO AUTH USERS (auth_user table)")
    print("=" * 80)
    django_users = User.objects.all().order_by('username')
    if django_users.exists():
        print(f"\nTotal: {django_users.count()} Django users\n")
        print(f"{'ID':<6} {'Username':<25} {'Email':<35} {'Superuser':<12} {'Active':<10}")
        print("-" * 80)
        for user in django_users:
            superuser = 'Yes' if user.is_superuser else 'No'
            active = 'Yes' if user.is_active else 'No'
            print(f"{user.id:<6} {user.username:<25} {user.email:<35} {superuser:<12} {active:<10}")
    else:
        print("No Django auth users found.")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    admin_count = AdminUser.objects.count()
    school_count = UsersSchool.objects.count()
    django_count = User.objects.count()
    print(f"Total Admin Users: {admin_count}")
    print(f"Total School Users: {school_count}")
    print(f"Total Django Users: {django_count}")
    print(f"Grand Total: {admin_count + school_count + django_count}")
    print("=" * 80)

if __name__ == '__main__':
    try:
        list_all_users()
    except Exception as e:
        print(f"Error listing users: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

