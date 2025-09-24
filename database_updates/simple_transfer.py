#!/usr/bin/env python
"""
Simplified school user transfer script
"""

import os
import sys
import django
from datetime import datetime

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction
from app.models import UsersSchool, AdminUser

def main():
    print(f"[{datetime.now()}] Starting school user transfer...")
    
    try:
        # Check existing data
        school_users = UsersSchool.objects.all()
        existing_admin_school = AdminUser.objects.filter(admin_level='school')
        
        print(f"[{datetime.now()}] Found {school_users.count()} users in users_school table")
        print(f"[{datetime.now()}] Found {existing_admin_school.count()} existing school admin users")
        
        if school_users.count() == 0:
            print(f"[{datetime.now()}] No school users to transfer.")
            return
        
        # Show first few users
        print(f"[{datetime.now()}] Sample users to transfer:")
        for user in school_users[:3]:
            print(f"  - {user.username} ({user.email}) - {user.school_name}")
        
        # Confirm transfer
        response = input(f"\nTransfer {school_users.count()} users? (y/N): ")
        if response.lower() != 'y':
            print("Transfer cancelled.")
            return
        
        # Transfer users
        transferred = 0
        skipped = 0
        errors = []
        
        with transaction.atomic():
            for school_user in school_users:
                try:
                    # Check if already exists
                    if AdminUser.objects.filter(username=school_user.username).exists():
                        print(f"  Skipping {school_user.username} - already exists")
                        skipped += 1
                        continue
                    
                    if AdminUser.objects.filter(email=school_user.email).exists():
                        print(f"  Skipping {school_user.username} - email exists")
                        skipped += 1
                        continue
                    
                    # Create admin user
                    status = 'active' if school_user.is_active else 'inactive'
                    
                    admin_user = AdminUser.objects.create(
                        username=school_user.username,
                        email=school_user.email,
                        password_hash=school_user.password_hash,
                        full_name=school_user.school_name,
                        admin_level='school',
                        assigned_area=school_user.school_name,
                        status=status,
                        last_login=school_user.last_login,
                        created_at=school_user.created_at,
                        region_id=school_user.region_id,
                        division_id=school_user.division_id,
                        district_id=school_user.district_id,
                        school_id=school_user.school_id,
                        can_create_users=False,
                        can_manage_users=False,
                        can_set_deadlines=False,
                        can_approve_submissions=True,
                        can_view_system_logs=False,
                    )
                    
                    print(f"  ✅ Transferred {school_user.username}")
                    transferred += 1
                    
                except Exception as e:
                    error_msg = f"Failed to transfer {school_user.username}: {str(e)}"
                    print(f"  ❌ {error_msg}")
                    errors.append(error_msg)
        
        # Summary
        print(f"\n[{datetime.now()}] Transfer Summary:")
        print(f"  Total processed: {school_users.count()}")
        print(f"  Successfully transferred: {transferred}")
        print(f"  Skipped: {skipped}")
        print(f"  Errors: {len(errors)}")
        
        if errors:
            print(f"\nErrors:")
            for error in errors:
                print(f"  - {error}")
        
        # Verification
        final_count = AdminUser.objects.filter(admin_level='school').count()
        print(f"\nFinal admin_user school count: {final_count}")
        
    except Exception as e:
        print(f"[{datetime.now()}] Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
