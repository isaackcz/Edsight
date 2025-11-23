"""
Permissions utility functions for formatting permission data
"""


def format_permissions(admin_user, permissions_queryset):
    """
    Format permissions data for profile display
    
    Args:
        admin_user: AdminUser instance
        permissions_queryset: QuerySet of AdminUserPermission objects
    
    Returns:
        dict with formatted permissions
    """
    # Boolean flags
    boolean_permissions = {
        'can_create_users': admin_user.can_create_users,
        'can_manage_users': admin_user.can_manage_users,
        'can_set_deadlines': admin_user.can_set_deadlines,
        'can_approve_submissions': admin_user.can_approve_submissions,
        'can_view_system_logs': admin_user.can_view_system_logs,
    }
    
    # Detailed permissions grouped by resource_type
    detailed_permissions = {}
    for perm in permissions_queryset:
        resource_type = perm.resource_type
        if resource_type not in detailed_permissions:
            detailed_permissions[resource_type] = []
        
        detailed_permissions[resource_type].append({
            'permission_id': perm.permission_id,
            'permission_name': perm.permission_name,
            'resource_type': perm.resource_type,
            'resource_type_display': perm.get_resource_type_display(),
            'action': perm.action,
            'action_display': perm.get_action_display(),
            'scope': perm.scope,
            'scope_display': perm.get_scope_display(),
            'granted_at': perm.granted_at.isoformat() if perm.granted_at else None,
            'granted_at_display': perm.granted_at.strftime('%B %d, %Y') if perm.granted_at else 'Unknown',
            'granted_by': {
                'id': perm.granted_by_id,
                'username': perm.granted_by.username if perm.granted_by else 'System',
                'full_name': perm.granted_by.full_name if perm.granted_by else None
            }
        })
    
    return {
        'admin_level': admin_user.admin_level,
        'admin_level_display': admin_user.get_admin_level_display(),
        'boolean_permissions': boolean_permissions,
        'detailed_permissions': detailed_permissions
    }

