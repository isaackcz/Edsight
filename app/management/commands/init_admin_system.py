"""
Management command to initialize the admin user system
Creates default admin users for each level and sets up permissions
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from app.models import (
    AdminUser, AdminUserPermission, Region, Division, District, School,
    AdminActivityLog
)
import random


class Command(BaseCommand):
    help = 'Initialize admin user system with sample users for each level'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-sample-users',
            action='store_true',
            help='Create sample admin users for each level',
        )
        parser.add_argument(
            '--setup-permissions',
            action='store_true',
            help='Setup default permissions for admin users',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset all admin users and start fresh (DANGEROUS)',
        )

    def handle(self, *args, **options):
        if options['reset']:
            self.reset_admin_system()
        
        if options['create_sample_users']:
            self.create_sample_users()
        
        if options['setup_permissions']:
            self.setup_default_permissions()
        
        self.stdout.write(
            self.style.SUCCESS('Admin user system initialization completed successfully')
        )

    @transaction.atomic
    def reset_admin_system(self):
        """Reset the admin system - WARNING: This deletes all admin users"""
        self.stdout.write(
            self.style.WARNING('RESETTING admin user system - This will delete ALL admin users!')
        )
        
        # Delete all admin users (cascade will handle related records)
        AdminUser.objects.all().delete()
        
        self.stdout.write(
            self.style.SUCCESS('Admin system reset completed')
        )

    @transaction.atomic
    def create_sample_users(self):
        """Create sample admin users for each level"""
        self.stdout.write('Creating sample admin users...')
        
        # Get some sample geographic data
        regions = list(Region.objects.all()[:3])
        divisions = list(Division.objects.all()[:5])
        districts = list(District.objects.all()[:5])
        schools = list(School.objects.all()[:10])
        
        if not regions:
            self.stdout.write(
                self.style.WARNING('No regions found in database. Please import geographic data first.')
            )
            return
        
        # 1. Create Central Office Admin (Super Admin)
        central_admin = self.create_admin_user(
            username='central_admin',
            email='central.admin@deped.gov.ph',
            full_name='Central Office Administrator',
            admin_level='central',
            assigned_area='Philippines',
            permissions={
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
            }
        )
        self.stdout.write(f'✓ Created Central Admin: {central_admin.username}')
        
        # 2. Create Region Admin
        region_admin = self.create_admin_user(
            username='region01_admin',
            email='region.admin@deped.gov.ph',
            full_name='Region I Administrator',
            admin_level='region',
            assigned_area=f'Region: {regions[0].name}',
            region=regions[0],
            permissions={
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
            },
            created_by=central_admin
        )
        self.stdout.write(f'✓ Created Region Admin: {region_admin.username}')
        
        # 3. Create Division Admin
        division_admin = self.create_admin_user(
            username='division01_admin',
            email='division.admin@deped.gov.ph',
            full_name='Division Administrator',
            admin_level='division',
            assigned_area=f'Division: {divisions[0].name}',
            region=divisions[0].region,
            division=divisions[0],
            permissions={
                'can_create_users': True,
                'can_manage_users': True,
                'can_approve_submissions': True,
            },
            created_by=central_admin
        )
        self.stdout.write(f'✓ Created Division Admin: {division_admin.username}')
        
        # 4. Create District Admin
        district_admin = self.create_admin_user(
            username='district01_admin',
            email='district.admin@deped.gov.ph',
            full_name='District Administrator',
            admin_level='district',
            assigned_area=f'District: {districts[0].name}',
            region=districts[0].division.region,
            division=districts[0].division,
            district=districts[0],
            permissions={
                'can_approve_submissions': True,
            },
            created_by=division_admin
        )
        self.stdout.write(f'✓ Created District Admin: {district_admin.username}')
        
        # 5. Create School Admin
        school_admin = self.create_admin_user(
            username=f'school{schools[0].school_id}_admin',
            email=f'{schools[0].school_id}@deped.gov.ph',
            full_name=f'{schools[0].school_name} Administrator',
            admin_level='school',
            assigned_area=f'School: {schools[0].school_name}',
            region=schools[0].region,
            division=schools[0].division,
            district=schools[0].district,
            school=schools[0],
            permissions={},  # No special permissions for school level
            created_by=division_admin
        )
        self.stdout.write(f'✓ Created School Admin: {school_admin.username}')
        
        # Display login credentials
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('SAMPLE ADMIN USERS CREATED'))
        self.stdout.write('='*60)
        self.stdout.write('Default password for all users: EdSight2024!')
        self.stdout.write('')
        self.stdout.write('Login Credentials:')
        self.stdout.write(f'Central Office: {central_admin.username} / EdSight2024!')
        self.stdout.write(f'Region:        {region_admin.username} / EdSight2024!')
        self.stdout.write(f'Division:      {division_admin.username} / EdSight2024!')
        self.stdout.write(f'District:      {district_admin.username} / EdSight2024!')
        self.stdout.write(f'School:        {school_admin.username} / EdSight2024!')
        self.stdout.write('='*60)
        self.stdout.write(self.style.WARNING('IMPORTANT: Change these passwords after first login!'))
        self.stdout.write('='*60)

    def create_admin_user(self, username, email, full_name, admin_level, assigned_area, 
                         region=None, division=None, district=None, school=None, 
                         permissions=None, created_by=None):
        """Helper method to create an admin user"""
        if permissions is None:
            permissions = {}
        
        # Check if user already exists
        if AdminUser.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Admin user {username} already exists, skipping...')
            )
            return AdminUser.objects.get(username=username)
        
        # Create the admin user
        admin_user = AdminUser.objects.create(
            username=username,
            email=email,
            password_hash=make_password('EdSight2024!'),  # Default password
            full_name=full_name,
            admin_level=admin_level,
            assigned_area=assigned_area,
            status='active',
            region=region,
            division=division,
            district=district,
            school=school,
            created_by=created_by,
            **permissions
        )
        
        # Log the creation
        AdminActivityLog.objects.create(
            admin_user=created_by or admin_user,
            action='CREATE_ADMIN_USER',
            resource_type='admin_user',
            resource_id=str(admin_user.admin_id),
            details={
                'created_user': admin_user.username,
                'admin_level': admin_user.admin_level,
                'assigned_area': admin_user.assigned_area,
                'created_via': 'management_command'
            }
        )
        
        return admin_user

    @transaction.atomic
    def setup_default_permissions(self):
        """Setup default permissions for all admin users"""
        self.stdout.write('Setting up default permissions...')
        
        permission_templates = {
            'central': [
                ('full_system_access', 'system', 'manage', 'all'),
                ('manage_all_users', 'user', 'manage', 'all'),
                ('create_all_users', 'user', 'create', 'all'),
                ('approve_all_forms', 'form', 'approve', 'all'),
                ('view_all_reports', 'report', 'read', 'all'),
                ('manage_school_data', 'school_data', 'manage', 'all'),
            ],
            'region': [
                ('review_regional_forms', 'form', 'approve', 'assigned_area'),
                ('set_regional_deadlines', 'form', 'manage', 'assigned_area'),
                ('view_regional_reports', 'report', 'read', 'assigned_area'),
                ('view_regional_logs', 'system', 'read', 'assigned_area'),
            ],
            'division': [
                ('create_district_users', 'user', 'create', 'assigned_area'),
                ('create_school_users', 'user', 'create', 'assigned_area'),
                ('manage_division_users', 'user', 'manage', 'assigned_area'),
                ('approve_division_forms', 'form', 'approve', 'assigned_area'),
                ('view_division_reports', 'report', 'read', 'assigned_area'),
            ],
            'district': [
                ('review_district_forms', 'form', 'approve', 'assigned_area'),
                ('view_district_reports', 'report', 'read', 'assigned_area'),
            ],
            'school': [
                ('view_own_data', 'school_data', 'read', 'own'),
                ('submit_school_forms', 'form', 'create', 'own'),
            ]
        }
        
        for admin_level, permissions in permission_templates.items():
            admins = AdminUser.objects.filter(admin_level=admin_level, status='active')
            for admin in admins:
                for perm_name, resource_type, action, scope in permissions:
                    AdminUserPermission.objects.get_or_create(
                        admin_user=admin,
                        permission_name=perm_name,
                        resource_type=resource_type,
                        action=action,
                        defaults={'scope': scope}
                    )
                self.stdout.write(f'✓ Setup permissions for {admin.username}')
        
        self.stdout.write(
            self.style.SUCCESS('Default permissions setup completed')
        )
