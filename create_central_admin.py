#!/usr/bin/env python
"""
Script to create a Central Office admin user
Run with: python create_central_admin.py
Or: docker exec edsight_django python /app/create_central_admin.py
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import AdminUser
import bcrypt
from django.utils import timezone

def create_central_admin():
    """Create central office admin user"""
    
    # Check if central admin already exists
    if AdminUser.objects.filter(username='central_admin', admin_level='central').exists():
        print("⚠️  Central admin user already exists!")
        admin = AdminUser.objects.get(username='central_admin')
        print(f"Admin ID: {admin.admin_id}")
        print(f"Username: {admin.username}")
        print(f"Email: {admin.email}")
        print(f"Status: {admin.status}")
        print(f"Admin Level: {admin.admin_level}")
        return admin
    
    # Hash password using bcrypt (same as login uses)
    password = 'Edsight2024!'
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create central office admin
    central_admin = AdminUser.objects.create(
        username='central_admin',
        email='central.admin@deped.gov.ph',
        password_hash=password_hash,
        full_name='Central Office Administrator',
        admin_level='central',
        status='active',
        assigned_area='Central Office - Nationwide',
        # All permissions enabled for central office
        can_create_users=True,
        can_manage_users=True,
        can_set_deadlines=True,
        can_approve_submissions=True,
        can_view_system_logs=True,
        # Geographic fields are NULL for central office
        region_id=None,
        division_id=None,
        district_id=None,
        school_id=None,
    )
    
    print("=" * 80)
    print("✓ Central Office Admin created successfully!")
    print("=" * 80)
    print(f"Admin ID: {central_admin.admin_id}")
    print(f"Username: {central_admin.username}")
    print(f"Email: {central_admin.email}")
    print(f"Password: Edsight2024!")
    print(f"Admin Level: {central_admin.admin_level}")
    print(f"Status: {central_admin.status}")
    print(f"Full Name: {central_admin.full_name}")
    print(f"Assigned Area: {central_admin.assigned_area}")
    print("\nPermissions:")
    print(f"  - Can Create Users: {central_admin.can_create_users}")
    print(f"  - Can Manage Users: {central_admin.can_manage_users}")
    print(f"  - Can Set Deadlines: {central_admin.can_set_deadlines}")
    print(f"  - Can Approve Submissions: {central_admin.can_approve_submissions}")
    print(f"  - Can View System Logs: {central_admin.can_view_system_logs}")
    print("\n" + "=" * 80)
    print("⚠️  IMPORTANT: Change the password after first login!")
    print("=" * 80)
    print("\nYou can now log in with:")
    print("  Email: central.admin@deped.gov.ph")
    print("  Password: Edsight2024!")
    print("=" * 80)
    
    return central_admin

if __name__ == '__main__':
    try:
        create_central_admin()
    except Exception as e:
        print(f"Error creating central admin: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

