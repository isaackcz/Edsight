#!/usr/bin/env python
"""
Migration script to transfer school users from users_school table to admin_user table
This script follows the project's coding standards and includes comprehensive logging.
"""

import os
import sys
import django
from datetime import datetime

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import transaction, connection
from app.models import UsersSchool, AdminUser, Region, Division, District, School
from app.enhanced_logging_utils import EnhancedSystemLogger
from django.contrib.auth.hashers import make_password


class SchoolUserTransferService:
    """Service to handle the transfer of school users to admin_user table"""
    
    def __init__(self):
        self.transferred_count = 0
        self.skipped_count = 0
        self.errors = []
        
    def log_transfer_start(self):
        """Log the start of the transfer process"""
        print(f"[{datetime.now()}] Starting school user transfer process...")
        print(f"[{datetime.now()}] Checking for existing school users in users_school table...")
        
    def check_existing_users(self):
        """Check for existing users in both tables"""
        school_users_count = UsersSchool.objects.count()
        admin_school_users_count = AdminUser.objects.filter(admin_level='school').count()
        
        print(f"[{datetime.now()}] Found {school_users_count} users in users_school table")
        print(f"[{datetime.now()}] Found {admin_school_users_count} existing school-level admin users")
        
        return school_users_count, admin_school_users_count
    
    def validate_foreign_keys(self, user):
        """Validate that foreign key references exist"""
        issues = []
        
        if user.region_id and not Region.objects.filter(id=user.region_id).exists():
            issues.append(f"Region ID {user.region_id} does not exist")
            
        if user.division_id and not Division.objects.filter(id=user.division_id).exists():
            issues.append(f"Division ID {user.division_id} does not exist")
            
        if user.district_id and not District.objects.filter(id=user.district_id).exists():
            issues.append(f"District ID {user.district_id} does not exist")
            
        if user.school_id and not School.objects.filter(id=user.school_id).exists():
            issues.append(f"School ID {user.school_id} does not exist")
            
        return issues
    
    def transfer_user(self, school_user):
        """Transfer a single school user to admin_user table"""
        try:
            # Check if user already exists in admin_user
            if AdminUser.objects.filter(username=school_user.username).exists():
                print(f"[{datetime.now()}] Skipping {school_user.username} - already exists in admin_user")
                self.skipped_count += 1
                return False
                
            if AdminUser.objects.filter(email=school_user.email).exists():
                print(f"[{datetime.now()}] Skipping {school_user.username} - email already exists in admin_user")
                self.skipped_count += 1
                return False
            
            # Validate foreign key references
            fk_issues = self.validate_foreign_keys(school_user)
            if fk_issues:
                error_msg = f"FK validation failed for {school_user.username}: {', '.join(fk_issues)}"
                print(f"[{datetime.now()}] {error_msg}")
                self.errors.append(error_msg)
                return False
            
            # Determine status based on is_active
            status = 'active' if school_user.is_active else 'inactive'
            
            # Create the admin user
            admin_user = AdminUser.objects.create(
                username=school_user.username,
                email=school_user.email,
                password_hash=school_user.password_hash,
                full_name=school_user.school_name,  # Use school_name as full_name
                admin_level='school',
                assigned_area=school_user.school_name,
                status=status,
                last_login=school_user.last_login,
                created_at=school_user.created_at,
                region_id=school_user.region_id,
                division_id=school_user.division_id,
                district_id=school_user.district_id,
                school_id=school_user.school_id,
                # Set school-level permissions
                can_create_users=False,
                can_manage_users=False,
                can_set_deadlines=False,
                can_approve_submissions=True,  # Schools can approve their own submissions
                can_view_system_logs=False,
            )
            
            print(f"[{datetime.now()}] Successfully transferred {school_user.username} (ID: {admin_user.admin_id})")
            self.transferred_count += 1
            
            # Log the transfer activity
            try:
                EnhancedSystemLogger.log_data_migration(
                    migration_type='SCHOOL_USER_TRANSFER',
                    source_table='users_school',
                    target_table='admin_user',
                    records_affected=1,
                    details=f'Transferred school user {school_user.username} to admin_user system',
                    ip_address='127.0.0.1'
                )
            except Exception as log_error:
                print(f"[{datetime.now()}] Warning: Failed to log transfer for {school_user.username}: {log_error}")
            
            return True
            
        except Exception as e:
            error_msg = f"Failed to transfer {school_user.username}: {str(e)}"
            print(f"[{datetime.now()}] {error_msg}")
            self.errors.append(error_msg)
            return False
    
    def run_transfer(self, dry_run=False):
        """Run the complete transfer process"""
        try:
            self.log_transfer_start()
            
            # Check existing users
            school_count, admin_school_count = self.check_existing_users()
            
            if school_count == 0:
                print(f"[{datetime.now()}] No school users found in users_school table. Nothing to transfer.")
                return
            
            if dry_run:
                print(f"[{datetime.now()}] DRY RUN MODE - No actual changes will be made")
            
            # Get all school users
            school_users = UsersSchool.objects.all().order_by('id')
            
            print(f"[{datetime.now()}] Starting transfer of {school_count} school users...")
            
            # Show sample users
            if school_count > 0:
                print(f"[{datetime.now()}] Sample users to be processed:")
                for user in school_users[:3]:
                    print(f"  - {user.username} ({user.email}) - {user.school_name}")
                if school_count > 3:
                    print(f"  ... and {school_count - 3} more users")
            
            if not dry_run:
                with transaction.atomic():
                    for user in school_users:
                        self.transfer_user(user)
            else:
                # Dry run - just validate
                for user in school_users:
                    fk_issues = self.validate_foreign_keys(user)
                    if fk_issues:
                        print(f"[{datetime.now()}] DRY RUN: Would fail for {user.username}: {', '.join(fk_issues)}")
                        self.errors.append(f"FK validation failed for {user.username}")
                    elif AdminUser.objects.filter(username=user.username).exists():
                        print(f"[{datetime.now()}] DRY RUN: Would skip {user.username} - username already exists")
                        self.skipped_count += 1
                    elif AdminUser.objects.filter(email=user.email).exists():
                        print(f"[{datetime.now()}] DRY RUN: Would skip {user.username} - email already exists")
                        self.skipped_count += 1
                    else:
                        print(f"[{datetime.now()}] DRY RUN: Would transfer {user.username}")
                        self.transferred_count += 1
            
            # Print summary
            print(f"\n[{datetime.now()}] Transfer Summary:")
            print(f"  Total users processed: {school_count}")
            print(f"  Successfully transferred: {self.transferred_count}")
            print(f"  Skipped (already exists): {self.skipped_count}")
            print(f"  Errors: {len(self.errors)}")
            
            if self.errors:
                print(f"\n[{datetime.now()}] Errors encountered:")
                for error in self.errors:
                    print(f"  - {error}")
            
            if not dry_run and self.transferred_count > 0:
                print(f"\n[{datetime.now()}] Transfer completed successfully!")
                print(f"[{datetime.now()}] You may want to verify the data and consider backing up users_school table before dropping it.")
                
        except Exception as e:
            print(f"[{datetime.now()}] CRITICAL ERROR during transfer: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def verify_transfer(self):
        """Verify that the transfer was successful"""
        print(f"\n[{datetime.now()}] Verifying transfer...")
        
        school_users = UsersSchool.objects.all()
        admin_school_users = AdminUser.objects.filter(admin_level='school')
        
        print(f"[{datetime.now()}] Original users_school count: {school_users.count()}")
        print(f"[{datetime.now()}] New admin_user school count: {admin_school_users.count()}")
        
        # Check for any missing users
        missing_users = []
        for school_user in school_users:
            if not AdminUser.objects.filter(username=school_user.username, admin_level='school').exists():
                missing_users.append(school_user.username)
        
        if missing_users:
            print(f"[{datetime.now()}] WARNING: The following users were not transferred:")
            for username in missing_users:
                print(f"  - {username}")
        else:
            print(f"[{datetime.now()}] ✅ All users successfully transferred!")


def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Transfer school users from users_school to admin_user table')
    parser.add_argument('--dry-run', action='store_true', help='Run in dry-run mode (no actual changes)')
    parser.add_argument('--verify', action='store_true', help='Verify existing transfer')
    
    args = parser.parse_args()
    
    transfer_service = SchoolUserTransferService()
    
    if args.verify:
        transfer_service.verify_transfer()
    else:
        transfer_service.run_transfer(dry_run=args.dry_run)


if __name__ == '__main__':
    main()
