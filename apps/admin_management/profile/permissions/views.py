"""
Permissions API views for profile page
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from apps.core.models import AdminUser, AdminUserPermission
from apps.admin_management.views import get_admin_context
from .utils import format_permissions


@csrf_exempt
@require_GET
def api_profile_permissions(request):
    """
    API endpoint to get current user's permissions
    Returns both boolean flags and detailed AdminUserPermission entries
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_id = context.get('admin_id')
    
    try:
        # Get user
        admin_user = AdminUser.objects.get(admin_id=admin_id)
        
        # Get all permissions for this user
        permissions = AdminUserPermission.objects.select_related('granted_by').filter(
            admin_user=admin_user
        ).order_by('resource_type', 'action')
        
        # Format permissions data
        permissions_data = format_permissions(admin_user, permissions)
        
        return JsonResponse({
            'success': True,
            'permissions': permissions_data
        })
        
    except AdminUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

