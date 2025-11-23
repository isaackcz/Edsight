"""
User Info utility functions for formatting profile data
"""

from django.utils import timezone


def format_user_info(admin_user):
    """
    Format admin user data for profile display
    
    Args:
        admin_user: AdminUser instance with select_related relationships
    
    Returns:
        dict with formatted user information
    """
    return {
        'admin_id': admin_user.admin_id,
        'username': admin_user.username,
        'email': admin_user.email,
        'full_name': admin_user.full_name or 'Not set',
        'admin_level': admin_user.admin_level,
        'admin_level_display': admin_user.get_admin_level_display(),
        'status': admin_user.status,
        'status_display': admin_user.get_status_display(),
        'assigned_area': admin_user.assigned_area or 'Not specified',
        'region': {
            'id': admin_user.region_id,
            'name': admin_user.region.name if admin_user.region else None
        },
        'division': {
            'id': admin_user.division_id,
            'name': admin_user.division.name if admin_user.division else None
        },
        'district': {
            'id': admin_user.district_id,
            'name': admin_user.district.name if admin_user.district else None
        },
        'school': {
            'id': admin_user.school_id,
            'name': admin_user.school.school_name if admin_user.school else None
        },
        'created_at': admin_user.created_at.isoformat() if admin_user.created_at else None,
        'created_at_display': admin_user.created_at.strftime('%B %d, %Y at %I:%M %p') if admin_user.created_at else 'Unknown',
        'updated_at': admin_user.updated_at.isoformat() if admin_user.updated_at else None,
        'updated_at_display': admin_user.updated_at.strftime('%B %d, %Y at %I:%M %p') if admin_user.updated_at else 'Unknown',
        'last_login': admin_user.last_login.isoformat() if admin_user.last_login else None,
        'last_login_display': admin_user.last_login.strftime('%B %d, %Y at %I:%M %p') if admin_user.last_login else 'Never',
        'created_by': {
            'id': admin_user.created_by_id,
            'username': admin_user.created_by.username if admin_user.created_by else None,
            'full_name': admin_user.created_by.full_name if admin_user.created_by else None
        },
        'updated_by': {
            'id': admin_user.updated_by_id,
            'username': admin_user.updated_by.username if admin_user.updated_by else None,
            'full_name': admin_user.updated_by.full_name if admin_user.updated_by else None
        }
    }

