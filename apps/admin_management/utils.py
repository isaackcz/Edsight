"""
Utility functions for the admin user system
Handles role-based access control, user creation validation, and permission management
"""

from django.core.exceptions import PermissionDenied, ValidationError
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from django.db import transaction
import re
import json
from apps.core.models import AdminUser, AdminActivityLog, AdminUserPermission, FormDeadline, UserCreationRequest


class AdminUserManager:
    """Centralized manager for admin user operations following SOLID principles"""
    
    @staticmethod
    def validate_user_creation_permission(creator_admin_id, target_role, target_coverage):
        """
        Validate if an admin user can create another user of specific role and coverage
        Returns (can_create: bool, message: str)
        """
        try:
            creator = AdminUser.objects.get(admin_id=creator_admin_id, status='active')
        except AdminUser.DoesNotExist:
            return False, "Creator admin user not found or inactive"
        
        # Central Office can create anyone
        if creator.admin_level == 'central':
            return True, "Central Office has full access"
        
        # Division can create District, School, and Region (if instructed by Central)
        if creator.admin_level == 'division':
            if target_role in ['district', 'school']:
                # Check if target is within creator's division
                if target_coverage.get('division_id') == creator.division_id:
                    return True, "Division can create within assigned area"
                else:
                    return False, "Division can only create within assigned division"
            elif target_role == 'region':
                return True, "Division can create Region accounts if instructed by Central Office"
            else:
                return False, f"Division cannot create {target_role} accounts"
        
        # Other levels cannot create users
        return False, f"{creator.admin_level} level cannot create {target_role} accounts"
    
    @staticmethod
    def validate_email_format(email, admin_level):
        """Validate email format based on admin level requirements"""
        if admin_level == 'school':
            # School users: schoolid@deped.gov.ph
            pattern = r'^[A-Za-z0-9]+@deped\.gov\.ph$'
            if not re.match(pattern, email):
                raise ValidationError('School users must use format: schoolid@deped.gov.ph')
        else:
            # Non-school users: firstname.lastname@deped.gov.ph
            pattern = r'^[A-Za-z]+\.[A-Za-z]+@deped\.gov\.ph$'
            if not re.match(pattern, email):
                raise ValidationError('Non-school users must use format: firstname.lastname@deped.gov.ph')
        
        return True
    
    @staticmethod
    def get_user_access_scope(admin_id):
        """Get comprehensive access scope for an admin user"""
        try:
            admin = AdminUser.objects.select_related('region', 'division', 'district', 'school').get(
                admin_id=admin_id, status='active'
            )
        except AdminUser.DoesNotExist:
            return {'scope': 'none', 'error': 'Admin user not found'}
        
        scope_data = {
            'admin_level': admin.admin_level,
            'admin_id': admin.admin_id,
            'username': admin.username,
            'permissions': {
                'can_create_users': admin.can_create_users,
                'can_manage_users': admin.can_manage_users,
                'can_set_deadlines': admin.can_set_deadlines,
                'can_approve_submissions': admin.can_approve_submissions,
                'can_view_system_logs': admin.can_view_system_logs,
            }
        }
        
        if admin.admin_level == 'central':
            scope_data.update({
                'scope': 'nationwide',
                'coverage': 'All regions, divisions, districts, and schools',
                'region_ids': 'all',
                'division_ids': 'all',
                'district_ids': 'all',
                'school_ids': 'all'
            })
        elif admin.admin_level == 'region':
            scope_data.update({
                'scope': 'regional',
                'coverage': f'Region: {admin.region.name}' if admin.region else 'No region assigned',
                'region_id': admin.region_id,
                'accessible_divisions': list(admin.region.division_set.values_list('id', flat=True)) if admin.region else [],
                'accessible_districts': list(admin.region.district_set.values_list('id', flat=True)) if admin.region else [],
                'accessible_schools': list(admin.region.school_set.values_list('id', flat=True)) if admin.region else []
            })
        elif admin.admin_level == 'division':
            scope_data.update({
                'scope': 'divisional',
                'coverage': f'Division: {admin.division.name}' if admin.division else 'No division assigned',
                'region_id': admin.region_id,
                'division_id': admin.division_id,
                'accessible_districts': list(admin.division.district_set.values_list('id', flat=True)) if admin.division else [],
                'accessible_schools': list(admin.division.school_set.values_list('id', flat=True)) if admin.division else []
            })
        elif admin.admin_level == 'district':
            scope_data.update({
                'scope': 'district',
                'coverage': f'District: {admin.district.name}' if admin.district else 'No district assigned',
                'region_id': admin.region_id,
                'division_id': admin.division_id,
                'district_id': admin.district_id,
                'accessible_schools': list(admin.district.school_set.values_list('id', flat=True)) if admin.district else []
            })
        elif admin.admin_level == 'school':
            scope_data.update({
                'scope': 'school',
                'coverage': f'School: {admin.school.school_name}' if admin.school else 'No school assigned',
                'region_id': admin.region_id,
                'division_id': admin.division_id,
                'district_id': admin.district_id,
                'school_id': admin.school_id
            })
        
        return scope_data
    
    @staticmethod
    @transaction.atomic
    def create_admin_user(creator_admin_id, user_data, ip_address=None, user_agent=None):
        """
        Create a new admin user with proper validation and audit logging
        """
        # Validate creator permissions
        can_create, message = AdminUserManager.validate_user_creation_permission(
            creator_admin_id, 
            user_data['admin_level'],
            {
                'region_id': user_data.get('region_id'),
                'division_id': user_data.get('division_id'),
                'district_id': user_data.get('district_id'),
                'school_id': user_data.get('school_id')
            }
        )
        
        if not can_create:
            raise PermissionDenied(message)
        
        # Validate email format
        AdminUserManager.validate_email_format(user_data['email'], user_data['admin_level'])
        
        # Set default permissions based on admin level
        permissions = AdminUserManager._get_default_permissions(user_data['admin_level'])
        user_data.update(permissions)
        
        # Hash password
        if 'password' in user_data:
            user_data['password_hash'] = make_password(user_data.pop('password'))
        
        # Create the admin user
        admin_user = AdminUser.objects.create(
            created_by_id=creator_admin_id,
            **user_data
        )
        
        # Log the creation activity
        AdminActivityLog.objects.create(
            admin_user_id=creator_admin_id,
            action='CREATE_ADMIN_USER',
            resource_type='admin_user',
            resource_id=str(admin_user.admin_id),
            details={
                'created_user': admin_user.username,
                'admin_level': admin_user.admin_level,
                'assigned_area': admin_user.assigned_area
            },
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return admin_user
    
    @staticmethod
    def _get_default_permissions(admin_level):
        """Get default permissions based on admin level"""
        permissions = {
            'can_create_users': False,
            'can_manage_users': False,
            'can_set_deadlines': False,
            'can_approve_submissions': False,
            'can_view_system_logs': False
        }
        
        if admin_level == 'central':
            permissions.update({
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True
            })
        elif admin_level == 'region':
            permissions.update({
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True
            })
        elif admin_level == 'division':
            permissions.update({
                'can_create_users': True,
                'can_manage_users': True,
                'can_approve_submissions': True
            })
        elif admin_level == 'district':
            permissions.update({
                'can_approve_submissions': True
            })
        # School level has no special permissions by default
        
        return permissions
    
    @staticmethod
    def can_access_user(admin_id, target_user_id):
        """Check if an admin can access/manage another admin user"""
        try:
            admin = AdminUser.objects.get(admin_id=admin_id, status='active')
            target_user = AdminUser.objects.get(admin_id=target_user_id)
        except AdminUser.DoesNotExist:
            return False
        
        # Central admins can access everyone
        if admin.admin_level == 'central':
            return True
        
        # Region admins can access users within their region
        if admin.admin_level == 'region':
            if target_user.admin_level in ['division', 'district', 'school']:
                return target_user.region_id == admin.region_id
        
        # Division admins can access users within their division
        if admin.admin_level == 'division':
            if target_user.admin_level in ['district', 'school']:
                return target_user.division_id == admin.division_id
        
        # District admins can access users within their district
        if admin.admin_level == 'district':
            if target_user.admin_level == 'school':
                return target_user.district_id == admin.district_id
        
        # School admins can only access themselves
        if admin.admin_level == 'school':
            return admin_id == target_user_id
        
        return False


class DeadlineManager:
    """Manages form deadlines with geographic scope validation"""
    
    @staticmethod
    def can_set_deadline(admin_id, target_region_id=None, target_division_id=None, target_district_id=None):
        """Check if admin can set deadlines for the specified area"""
        try:
            admin = AdminUser.objects.get(admin_id=admin_id, status='active')
        except AdminUser.DoesNotExist:
            return False, "Admin user not found"
        
        if not admin.can_set_deadlines:
            return False, "Admin does not have deadline setting permissions"
        
        # Only Region level can set deadlines
        if admin.admin_level != 'region':
            return False, "Only Region level admins can set deadlines"
        
        # Region can set deadlines within their region
        if target_region_id and target_region_id != admin.region_id:
            return False, "Can only set deadlines within assigned region"
        
        return True, "Permission granted"
    
    @staticmethod
    @transaction.atomic
    def set_deadline(admin_id, deadline_data, ip_address=None):
        """Set a form deadline with proper validation"""
        can_set, message = DeadlineManager.can_set_deadline(
            admin_id,
            deadline_data.get('region_id'),
            deadline_data.get('division_id'),
            deadline_data.get('district_id')
        )
        
        if not can_set:
            raise PermissionDenied(message)
        
        deadline = FormDeadline.objects.create(
            created_by_id=admin_id,
            **deadline_data
        )
        
        # Log the activity
        AdminActivityLog.objects.create(
            admin_user_id=admin_id,
            action='SET_DEADLINE',
            resource_type='form_deadline',
            resource_id=str(deadline.deadline_id),
            details={
                'form_type': deadline.form_type,
                'deadline_date': deadline.deadline_date.isoformat(),
                'region_id': deadline.region_id,
                'division_id': deadline.division_id,
                'district_id': deadline.district_id
            },
            ip_address=ip_address
        )
        
        return deadline


class PermissionChecker:
    """Centralized permission checking for role-based access control"""
    
    @staticmethod
    def check_resource_access(admin_id, resource_type, action, resource_location=None):
        """
        Check if admin has permission to perform action on resource
        resource_location: dict with region_id, division_id, district_id, school_id
        """
        try:
            admin = AdminUser.objects.get(admin_id=admin_id, status='active')
        except AdminUser.DoesNotExist:
            return False, "Admin user not found"
        
        # Check basic permission flags
        permission_map = {
            'user': 'can_manage_users',
            'form': 'can_approve_submissions',
            'system': 'can_view_system_logs',
            'deadline': 'can_set_deadlines'
        }
        
        required_permission = permission_map.get(resource_type)
        if required_permission and not getattr(admin, required_permission, False):
            return False, f"Missing {required_permission} permission"
        
        # Check geographic scope
        if resource_location:
            if not admin.can_access_area(**resource_location):
                return False, "Resource outside admin's geographic scope"
        
        return True, "Access granted"
    
    @staticmethod
    def get_accessible_areas(admin_id):
        """Get all areas this admin can access"""
        scope_data = AdminUserManager.get_user_access_scope(admin_id)
        
        if scope_data.get('scope') == 'none':
            return {}
        
        return {
            'regions': scope_data.get('region_ids', []),
            'divisions': scope_data.get('accessible_divisions', []),
            'districts': scope_data.get('accessible_districts', []),
            'schools': scope_data.get('accessible_schools', [])
        }


class AuditLogger:
    """Centralized audit logging for admin activities"""
    
    @staticmethod
    def log_activity(admin_id, action, resource_type, resource_id=None, details=None, ip_address=None, user_agent=None):
        """Log admin activity with comprehensive details"""
        return AdminActivityLog.objects.create(
            admin_user_id=admin_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    @staticmethod
    def get_activity_summary(admin_id, days=30):
        """Get activity summary for an admin user"""
        from datetime import timedelta
        from django.db.models import Count
        
        cutoff_date = timezone.now() - timedelta(days=days)
        
        activities = AdminActivityLog.objects.filter(
            admin_user_id=admin_id,
            timestamp__gte=cutoff_date
        ).values('action').annotate(count=Count('action')).order_by('-count')
        
        return {
            'total_activities': AdminActivityLog.objects.filter(
                admin_user_id=admin_id, 
                timestamp__gte=cutoff_date
            ).count(),
            'activity_breakdown': list(activities),
            'period_days': days
        }


# Decorators for permission checking
def require_admin_permission(permission_type, resource_type=None):
    """Decorator to check admin permissions before executing a function"""
    def decorator(func):
        def wrapper(request, *args, **kwargs):
            # DEVELOPMENT BYPASS - Remove this in production
            from django.conf import settings
            if getattr(settings, 'DEBUG', False):
                # Always create a mock admin session for development using existing admin
                request.session['admin_id'] = 2  # Use existing admin ID from database
                request.session['admin_level'] = 'central'
                request.session['admin_username'] = 'admin'
                return func(request, *args, **kwargs)
            
            admin_id = request.session.get('admin_id')
            if not admin_id:
                raise PermissionDenied("Admin authentication required")
            
            # Get admin user and check permissions
            try:
                admin = AdminUser.objects.get(admin_id=admin_id, status='active')
            except AdminUser.DoesNotExist:
                raise PermissionDenied("Admin user not found or inactive")
            
            # Check specific permission
            if permission_type == 'create_users' and not admin.can_create_users:
                raise PermissionDenied("User creation permission required")
            elif permission_type == 'manage_users' and not admin.can_manage_users:
                raise PermissionDenied("User management permission required")
            elif permission_type == 'set_deadlines' and not admin.can_set_deadlines:
                raise PermissionDenied("Deadline setting permission required")
            elif permission_type == 'approve_submissions' and not admin.can_approve_submissions:
                raise PermissionDenied("Submission approval permission required")
            elif permission_type == 'view_system_logs' and not admin.can_view_system_logs:
                raise PermissionDenied("System log viewing permission required")
            
            return func(request, *args, **kwargs)
        return wrapper
    return decorator


def log_admin_activity(action, resource_type):
    """Decorator to automatically log admin activities"""
    def decorator(func):
        def wrapper(request, *args, **kwargs):
            admin_id = request.session.get('admin_id')
            ip_address = request.META.get('REMOTE_ADDR')
            user_agent = request.META.get('HTTP_USER_AGENT')
            
            result = func(request, *args, **kwargs)
            
            # DEVELOPMENT BYPASS - Skip audit logging in development mode
            from django.conf import settings
            if getattr(settings, 'DEBUG', False):
                return result
            
            if admin_id:
                AuditLogger.log_activity(
                    admin_id=admin_id,
                    action=action,
                    resource_type=resource_type,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={'function': func.__name__, 'args': str(args), 'kwargs': str(kwargs)}
                )
            
            return result
        return wrapper
    return decorator
