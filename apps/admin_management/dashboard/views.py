"""
Dashboard API views for admin panel
Separated from main views.py for better organization
"""

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.db.models import Q, Count
from django.utils import timezone
from django.core.exceptions import PermissionDenied

from apps.core.models import (
    AdminUser, AdminActivityLog, AdminSession, LoginAttempt
)
from apps.admin_management.views import get_admin_context, get_admin_division_filter
from apps.admin_management.utils import AdminUserManager, require_admin_permission, log_admin_activity
from .utils import paginate_queryset, filter_users_queryset, export_to_excel, format_relative_time


@csrf_exempt
@require_GET
def api_dashboard_statistics(request):
    """
    API endpoint to get dashboard statistics
    Returns: total_users, suspicious_activity, active_sessions, suspended_accounts
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_scope = context.get('admin_scope', {})
    admin_id = context.get('admin_id')
    
    try:
        # Get users within admin's scope
        users_query = AdminUser.objects.all()
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        if division_id:
            users_query = users_query.filter(division_id=division_id)
        
        # Total users count
        total_users = users_query.count()
        
        # Suspicious activity count (from LoginAttempt) - filter by division
        suspicious_activity_query = LoginAttempt.objects.filter(is_suspicious=True)
        if division_id:
            # Filter by usernames of admin users in this division
            accessible_usernames = AdminUser.objects.filter(
                division_id=division_id
            ).values_list('username', flat=True)
            suspicious_activity_query = suspicious_activity_query.filter(
                username__in=accessible_usernames
            )
        suspicious_activity = suspicious_activity_query.count()
        
        # Active sessions count - filter by division
        active_sessions_query = AdminSession.objects.filter(is_active=True)
        if division_id:
            # Filter by admin users in this division
            accessible_admin_ids = AdminUser.objects.filter(
                division_id=division_id
            ).values_list('admin_id', flat=True)
            active_sessions_query = active_sessions_query.filter(
                admin_user_id__in=accessible_admin_ids
            )
        active_sessions = active_sessions_query.count()
        
        # Suspended accounts count
        suspended_accounts = users_query.filter(status='suspended').count()
        
        return JsonResponse({
            'success': True,
            'statistics': {
                'total_users': total_users,
                'suspicious_activity': suspicious_activity,
                'active_sessions': active_sessions,
                'suspended_accounts': suspended_accounts,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_GET
def api_dashboard_users(request):
    """
    API endpoint for user management table
    Supports pagination (100 rows max), search, and filtering
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_scope = context.get('admin_scope', {})
    
    try:
        # Get query parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        search = request.GET.get('search', '').strip()
        role = request.GET.get('role', '').strip()
        status = request.GET.get('status', '').strip()
        sort_by = request.GET.get('sort_by', 'created_at').strip()
        sort_order = request.GET.get('sort_order', 'desc').strip().lower()
        
        # Get users within admin's scope
        users_query = AdminUser.objects.select_related('region', 'division', 'district', 'school').all()
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        if division_id:
            users_query = users_query.filter(division_id=division_id)
        
        # Apply filters
        users_query = filter_users_queryset(users_query, search=search, role=role, status=status)
        
        # Validate and apply sorting
        valid_sort_fields = ['username', 'email', 'admin_level', 'status', 'last_login', 'created_at']
        if sort_by not in valid_sort_fields:
            sort_by = 'created_at'
        
        if sort_order not in ['asc', 'desc']:
            sort_order = 'desc'
        
        order_prefix = '-' if sort_order == 'desc' else ''
        users_query = users_query.order_by(f'{order_prefix}{sort_by}')
        
        # Paginate (max 100 rows per page)
        paginated_data = paginate_queryset(users_query, page=page, page_size=page_size, max_page_size=100)
        
        # Serialize user data
        users_data = []
        for user in paginated_data['items']:
            users_data.append({
                'admin_id': user.admin_id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name or '',
                'admin_level': user.admin_level,
                'admin_level_display': user.get_admin_level_display(),
                'status': user.status,
                'status_display': user.get_status_display(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'last_login_relative': format_relative_time(user.last_login),
                'created_at': user.created_at.isoformat(),
                'assigned_area': user.assigned_area or '',
            })
        
        return JsonResponse({
            'success': True,
            'users': users_data,
            'pagination': paginated_data['pagination'],
            'sort': {
                'sort_by': sort_by,
                'sort_order': sort_order
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_GET
def api_dashboard_activity(request):
    """
    API endpoint for recent activity logs
    Supports pagination (100 rows max per page)
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_scope = context.get('admin_scope', {})
    admin_id = context.get('admin_id')
    
    try:
        # Get query parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        
        # Get logs based on admin's scope
        logs_query = AdminActivityLog.objects.select_related('admin_user').all()
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        if division_id:
            # Filter logs for division-level admins - get all admins in this division
            accessible_admin_ids = AdminUser.objects.filter(
                division_id=division_id
            ).values_list('admin_id', flat=True)
            logs_query = logs_query.filter(admin_user_id__in=accessible_admin_ids)
        
        # Order by timestamp descending
        logs_query = logs_query.order_by('-timestamp')
        
        # Paginate (max 100 rows per page)
        paginated_data = paginate_queryset(logs_query, page=page, page_size=page_size, max_page_size=100)
        
        # Serialize activity data
        activities_data = []
        for log in paginated_data['items']:
            # Get admin user info
            if log.admin_user:
                username = log.admin_user.username
                admin_level = log.admin_user.get_admin_level_display()
                username_with_role = f"{username} ({admin_level})"
            else:
                username_with_role = 'System'
            
            activities_data.append({
                'log_id': log.log_id,
                'action': log.action,
                'username_with_role': username_with_role,
                'timestamp': log.timestamp.isoformat(),
                'timestamp_relative': format_relative_time(log.timestamp),
                'date': log.timestamp.strftime('%Y-%m-%d') if log.timestamp else '',
            })
        
        return JsonResponse({
            'success': True,
            'activities': activities_data,
            'pagination': paginated_data['pagination']
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_GET
@require_admin_permission('manage_users')
def api_dashboard_export(request):
    """
    API endpoint to export dashboard data to Excel
    Supports: users, activity, or all
    """
    context = get_admin_context(request)
    if not context:
        return JsonResponse({
            'success': False,
            'error': 'Unauthorized'
        }, status=401)
    
    admin_scope = context.get('admin_scope', {})
    export_type = request.GET.get('type', 'users').lower()
    
    try:
        if export_type == 'users':
            # Export users data
            users_query = AdminUser.objects.select_related('region', 'division', 'district', 'school').all()
            
            # Apply division filter (only division and central office admins have access)
            division_id = get_admin_division_filter(request)
            if division_id:
                users_query = users_query.filter(division_id=division_id)
            
            # Apply filters from query params
            search = request.GET.get('search', '').strip()
            role = request.GET.get('role', '').strip()
            status = request.GET.get('status', '').strip()
            users_query = filter_users_queryset(users_query, search=search, role=role, status=status)
            
            # Prepare data
            headers = ['Admin ID', 'Username', 'Email', 'Full Name', 'Admin Level', 'Status', 'Assigned Area', 'Last Login', 'Created At']
            data = []
            for user in users_query.order_by('-created_at'):
                data.append([
                    user.admin_id,
                    user.username,
                    user.email,
                    user.full_name or '',
                    user.get_admin_level_display(),
                    user.get_status_display(),
                    user.assigned_area or '',
                    user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else 'Never',
                    user.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                ])
            
            return export_to_excel(data, headers, filename='admin_users_export.xlsx', sheet_name='Users')
        
        elif export_type == 'activity':
            # Export activity logs
            logs_query = AdminActivityLog.objects.select_related('admin_user').all()
            
            # Apply division filter (only division and central office admins have access)
            division_id = get_admin_division_filter(request)
            if division_id:
                # Filter logs for division-level admins - get all admins in this division
                accessible_admin_ids = AdminUser.objects.filter(
                    division_id=division_id
                ).values_list('admin_id', flat=True)
                logs_query = logs_query.filter(admin_user_id__in=accessible_admin_ids)
            
            headers = ['Log ID', 'Admin User', 'Action', 'Resource Type', 'Resource ID', 'Details', 'IP Address', 'Timestamp']
            data = []
            for log in logs_query.order_by('-timestamp')[:1000]:  # Limit to 1000 rows for export
                data.append([
                    log.log_id,
                    log.admin_user.username if log.admin_user else 'System',
                    log.action,
                    log.resource_type or '',
                    log.resource_id or '',
                    log.details or '',
                    log.ip_address or '',
                    log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                ])
            
            return export_to_excel(data, headers, filename='admin_activity_export.xlsx', sheet_name='Activity')
        
        else:
            return JsonResponse({
                'success': False,
                'error': 'Invalid export type. Use "users" or "activity"'
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)

