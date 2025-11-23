"""
User Info API views for profile page
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from apps.core.models import AdminUser
from apps.admin_management.views import get_admin_context
from .utils import format_user_info


@csrf_exempt
@require_GET
def api_profile_user_info(request):
    """
    API endpoint to get current user's complete profile information
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_id = context.get('admin_id')
    
    try:
        # Get user with all relationships
        admin_user = AdminUser.objects.select_related(
            'region', 'division', 'district', 'school', 'created_by', 'updated_by'
        ).get(admin_id=admin_id)
        
        # Format user data
        user_info = format_user_info(admin_user)
        
        return JsonResponse({
            'success': True,
            'user_info': user_info
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

