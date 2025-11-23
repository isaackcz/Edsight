"""
Audit Log API views for profile page
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from django.db.models import Q

from apps.core.models import AdminUser, AdminActivityLog, AuditLog
from apps.admin_management.views import get_admin_context
from apps.admin_management.dashboard.utils import paginate_queryset
from .utils import format_audit_log_entry


@csrf_exempt
@require_GET
def api_profile_audit_logs(request):
    """
    API endpoint to get current user's audit logs
    Returns both AdminActivityLog and AuditLog entries, paginated
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_id = context.get('admin_id')
    
    try:
        # Get query parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        log_type = request.GET.get('type', 'all').lower()  # 'all', 'activity', 'audit'
        
        # Get AdminActivityLog entries (get all, we'll paginate after combining)
        activity_logs = []
        if log_type in ['all', 'activity']:
            activity_logs_query = AdminActivityLog.objects.filter(
                admin_user_id=admin_id
            ).order_by('-timestamp')[:1000]  # Limit to prevent memory issues
            
            activity_logs = [
                format_audit_log_entry(log, 'activity')
                for log in activity_logs_query
            ]
        
        # Get AuditLog entries (get all, we'll paginate after combining)
        audit_logs = []
        if log_type in ['all', 'audit']:
            audit_logs_query = AuditLog.objects.filter(
                admin_id=admin_id
            ).order_by('-timestamp')[:1000]  # Limit to prevent memory issues
            
            audit_logs = [
                format_audit_log_entry(log, 'audit')
                for log in audit_logs_query
            ]
        
        # Combine and sort by timestamp (most recent first)
        all_logs = activity_logs + audit_logs
        all_logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Apply pagination to combined results
        total_logs = len(all_logs)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_logs = all_logs[start_idx:end_idx]
        
        total_pages = (total_logs + page_size - 1) // page_size if total_logs > 0 else 1
        
        return JsonResponse({
            'success': True,
            'logs': paginated_logs,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
                'total_items': total_logs,
                'has_next': page < total_pages,
                'has_previous': page > 1,
                'next_page': page + 1 if page < total_pages else None,
                'previous_page': page - 1 if page > 1 else None,
            }
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

