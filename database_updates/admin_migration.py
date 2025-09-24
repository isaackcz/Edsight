"""
Django migration script for admin user system
Run this after applying the SQL schema updates
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.hashers import make_password
from app.models import AdminUser, AdminUserPermission, Region
import bcrypt


class Command(BaseCommand):
    help = 'Initialize admin user system with default data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-super-admin',
            action='store_true',
            help='Create a super admin user for Central Office',
        )
        parser.add_argument(
            '--setup-permissions',
            action='store_true',
            help='Setup default permissions for all admin levels',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['create_super_admin']:
            self.create_super_admin()
        
        if options['setup_permissions']:
            self.setup_default_permissions()
        
        self.stdout.write(
            self.style.SUCCESS('Admin user system initialized successfully')
        )

    def create_super_admin(self):
        """Create the default Central Office super admin"""
        # Check if super admin already exists
        if AdminUser.objects.filter(admin_level='central').exists():
            self.stdout.write(
                self.style.WARNING('Central Office admin already exists')
            )
            return

        # Create super admin
        password = 'EdSight2024!'
        password_hash = make_password(password)
        
        super_admin = AdminUser.objects.create(
            username='central_admin',
            email='central.admin@deped.gov.ph',
            password_hash=password_hash,
            full_name='Central Office Administrator',
            admin_level='central',
            assigned_area='Philippines',
            status='active',
            can_create_users=True,
            can_manage_users=True,
            can_set_deadlines=True,
            can_approve_submissions=True,
            can_view_system_logs=True
        )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Super admin created: {super_admin.username} (Password: {password})'
            )
        )
        
        # Create default permissions for super admin
        self.create_permissions_for_admin(super_admin, 'central')

    def setup_default_permissions(self):
        """Setup default permissions for all admin levels"""
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
        
        self.stdout.write(
            self.style.SUCCESS('Default permissions setup completed')
        )

    def create_permissions_for_admin(self, admin_user, admin_level):
        """Create permissions for a specific admin user"""
        permission_templates = {
            'central': [
                ('full_system_access', 'system', 'manage', 'all'),
                ('manage_all_users', 'user', 'manage', 'all'),
                ('create_all_users', 'user', 'create', 'all'),
                ('approve_all_forms', 'form', 'approve', 'all'),
                ('view_all_reports', 'report', 'read', 'all'),
                ('manage_school_data', 'school_data', 'manage', 'all'),
            ]
        }
        
        permissions = permission_templates.get(admin_level, [])
        for perm_name, resource_type, action, scope in permissions:
            AdminUserPermission.objects.get_or_create(
                admin_user=admin_user,
                permission_name=perm_name,
                resource_type=resource_type,
                action=action,
                defaults={'scope': scope}
            )
