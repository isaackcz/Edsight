"""
Form Management Utility Functions
Shared helpers for admin scope and workflow status filtering
"""

from django.core.cache import cache


def get_pending_workflow_statuses(admin_level):
    """
    Return the workflow statuses that indicate a form still requires action
    from the specified admin level. Keeps tree nodes focused on pending work.
    """
    status_map = {
        'central': ('central_pending', 'completed'),
        'region': ('region_pending', 'central_returned'),
        'division': ('division_pending', 'region_returned'),
        'district': ('district_pending', 'division_returned'),
    }
    return status_map.get(admin_level, ())


def get_admin_scope(request):
    """Get admin user scope from session (cached for performance)"""
    from apps.admin_management.utils import AdminUserManager
    
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None
    
    # Cache admin scope for 5 minutes to avoid repeated database queries
    cache_key = f'admin_scope_{admin_id}'
    cached_scope = cache.get(cache_key)
    if cached_scope:
        return cached_scope
    
    scope = AdminUserManager.get_user_access_scope(admin_id)
    if scope:
        cache.set(cache_key, scope, 300)  # Cache for 5 minutes
    return scope

