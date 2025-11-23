"""
Password Change API views for profile page
"""

import json
import bcrypt
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone

from apps.core.models import AdminUser, AdminActivityLog
from apps.admin_management.views import get_admin_context
from .utils import validate_password_strength


@csrf_exempt
@require_POST
def api_profile_change_password(request):
    """
    API endpoint to change current user's password
    Requires current password for verification
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
        
        # Parse request data
        data = json.loads(request.body.decode('utf-8'))
        current_password = data.get('current_password', '').strip()
        new_password = data.get('new_password', '').strip()
        confirm_password = data.get('confirm_password', '').strip()
        
        # Validate required fields
        if not current_password or not new_password or not confirm_password:
            return JsonResponse({
                'success': False,
                'error': 'All password fields are required'
            }, status=400)
        
        # Verify current password
        try:
            if not bcrypt.checkpw(current_password.encode('utf-8'), admin_user.password_hash.encode('utf-8')):
                return JsonResponse({
                    'success': False,
                    'error': 'Current password is incorrect'
                }, status=400)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': 'Failed to verify current password'
            }, status=400)
        
        # Check if new password matches confirmation
        if new_password != confirm_password:
            return JsonResponse({
                'success': False,
                'error': 'New password and confirmation do not match'
            }, status=400)
        
        # Check if new password is different from current
        if bcrypt.checkpw(new_password.encode('utf-8'), admin_user.password_hash.encode('utf-8')):
            return JsonResponse({
                'success': False,
                'error': 'New password must be different from current password'
            }, status=400)
        
        # Validate password strength
        is_valid, errors = validate_password_strength(new_password)
        if not is_valid:
            return JsonResponse({
                'success': False,
                'error': 'Password does not meet requirements',
                'details': errors
            }, status=400)
        
        # Hash new password
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Update password
        admin_user.password_hash = password_hash
        admin_user.updated_by_id = admin_id
        admin_user.save()
        
        # Log the activity
        AdminActivityLog.objects.create(
            admin_user_id=admin_id,
            action='CHANGE_PASSWORD',
            resource_type='admin_user',
            resource_id=str(admin_id),
            details={'message': 'User changed their password'},
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Password changed successfully'
        })
        
    except AdminUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'User not found'
        }, status=404)
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

