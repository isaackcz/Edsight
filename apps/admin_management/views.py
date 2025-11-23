"""
Enhanced admin views with role-based access control
Replaces the basic admin views with comprehensive permission checking
"""

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from django.core.paginator import Paginator
from django.core.exceptions import PermissionDenied
import json
import bcrypt
import csv
import io

from apps.core.models import (
    AdminUser, AdminUserPermission, AdminActivityLog, AdminSession,
    FormDeadline, FormApproval, UserCreationRequest, AdminUser,
    Region, Division, District, School, LoginAttempt, AuditLog,
    Question, Answer, Form, Category, Topic
)
from .utils import (
    AdminUserManager, DeadlineManager, PermissionChecker, AuditLogger,
    require_admin_permission, require_admin_level, log_admin_activity
)
from apps.utils.enhanced_logging import EnhancedSystemLogger


def get_admin_division_filter(request):
    """
    Get division filter for admin endpoints.
    Only division and central office admins have access to admin page.
    Returns division_id if admin is division-level, None for central office.
    """
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None
    
    try:
        admin_user = AdminUser.objects.get(admin_id=admin_id)
        # Only division and central office admins have access
        if admin_user.admin_level == 'division':
            return admin_user.division_id
        # Central office admins see all data - return None (no filter)
        elif admin_user.admin_level == 'central':
            return None
        # Other admin levels should not have access (handled by decorator)
        return None
    except AdminUser.DoesNotExist:
        return None


def get_admin_context(request):
    """Get admin context data for templates"""
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None
    
    try:
        # DEVELOPMENT BYPASS - Create mock admin scope for development
        from django.conf import settings
        if getattr(settings, 'DEBUG', False) and admin_id == 2:
            return {
                'admin_scope': {
                    'admin_level': 'central',
                    'admin_id': 2,
                    'username': 'admin',
                    'permissions': {
                        'can_create_users': True,
                        'can_manage_users': True,
                        'can_set_deadlines': True,
                        'can_approve_submissions': True,
                        'can_view_system_logs': True,
                    },
                    'scope': 'nationwide',
                    'coverage': 'All regions, divisions, districts, and schools (Development Mode)',
                    'geographic_scope': {
                        'region_id': None,
                        'division_id': None,
                        'district_id': None,
                        'school_id': None,
                        'accessible_regions': [],
                        'accessible_divisions': [],
                        'accessible_districts': [],
                        'accessible_schools': []
                    }
                },
                'admin_id': 2,
                'admin_level': 'central',
                'permissions': {
                    'can_create_users': True,
                    'can_manage_users': True,
                    'can_set_deadlines': True,
                    'can_approve_submissions': True,
                    'can_view_system_logs': True,
                },
                'coverage': 'All regions, divisions, districts, and schools (Development Mode)',
            }
        
        admin_scope = AdminUserManager.get_user_access_scope(admin_id)
        return {
            'admin_scope': admin_scope,
            'admin_id': admin_id,
            'admin_level': admin_scope.get('admin_level'),
            'permissions': admin_scope.get('permissions', {}),
            'coverage': admin_scope.get('coverage', ''),
        }
    except Exception:
        return None


@require_admin_level(blocked_levels=['district'])
def admin_page(request):
    """Enhanced admin dashboard with role-based content"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    # Get dashboard statistics based on admin's scope
    admin_scope = context['admin_scope']
    
    # Apply division filter (only division and central office admins have access)
    division_id = get_admin_division_filter(request)
    
    # Get recent activity
    recent_activities_query = AdminActivityLog.objects.all()
    if division_id:
        # Filter activities for division-level admins
        accessible_admin_ids = AdminUser.objects.filter(
            division_id=division_id
        ).values_list('admin_id', flat=True)
        recent_activities_query = recent_activities_query.filter(admin_user_id__in=accessible_admin_ids)
    recent_activities = recent_activities_query.order_by('-timestamp')[:10]
    
    # Get pending approvals (if admin can approve)
    pending_approvals = []
    if admin_scope.get('permissions', {}).get('can_approve_submissions'):
        pending_approvals_query = FormApproval.objects.filter(
            status='pending',
            approval_level=admin_scope['admin_level']
        )
        if division_id:
            # Filter approvals by division
            pending_approvals_query = pending_approvals_query.filter(
                form__school__division_id=division_id
            )
        pending_approvals = pending_approvals_query[:5]
    
    # Get deadline alerts (if admin can set deadlines)
    upcoming_deadlines = []
    if admin_scope.get('permissions', {}).get('can_set_deadlines'):
        upcoming_deadlines_query = FormDeadline.objects.filter(
            is_active=True,
            deadline_date__gte=timezone.now()
        )
        if division_id:
            # Filter deadlines by division
            upcoming_deadlines_query = upcoming_deadlines_query.filter(division_id=division_id)
        upcoming_deadlines = upcoming_deadlines_query.order_by('deadline_date')[:5]
    
    # Get dashboard stats with division filter
    users_query = AdminUser.objects.filter(status='active')
    if division_id:
        users_query = users_query.filter(division_id=division_id)
    
    requests_query = UserCreationRequest.objects.filter(status='pending')
    if division_id:
        requests_query = requests_query.filter(division_id=division_id)
    
    sessions_query = AdminSession.objects.filter(is_active=True)
    if division_id:
        accessible_admin_ids = AdminUser.objects.filter(
            division_id=division_id
        ).values_list('admin_id', flat=True)
        sessions_query = sessions_query.filter(admin_user_id__in=accessible_admin_ids)
    
    context.update({
        'recent_activities': recent_activities,
        'pending_approvals': pending_approvals,
        'upcoming_deadlines': upcoming_deadlines,
        'dashboard_stats': {
            'total_users': users_query.count(),
            'pending_requests': requests_query.count(),
            'active_sessions': sessions_query.count(),
        }
    })
    
    return render(request, 'admin/admin.html', context)


@require_admin_level(blocked_levels=['district'])
@require_admin_permission('manage_users')
def user_management_page(request):
    """User management page with scope-based filtering"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    # Get users within admin's scope
    admin_scope = context['admin_scope']
    users_query = AdminUser.objects.filter(status='active')
    
    # Apply division filter (only division and central office admins have access)
    division_id = get_admin_division_filter(request)
    if division_id:
        users_query = users_query.filter(division_id=division_id)
    
    # Pagination
    paginator = Paginator(users_query.order_by('-created_at'), 25)
    page_number = request.GET.get('page', 1)
    users = paginator.get_page(page_number)
    
    # Get pending user creation requests
    pending_requests_query = UserCreationRequest.objects.filter(
        status='pending'
    )
    if division_id:
        pending_requests_query = pending_requests_query.filter(division_id=division_id)
    pending_requests = pending_requests_query.order_by('-created_at')[:10]
    
    context.update({
        'users': users,
        'pending_requests': pending_requests,
        'can_create_users': admin_scope.get('permissions', {}).get('can_create_users', False),
    })
    
    return render(request, 'admin/user_management.html', context)


@require_admin_level(blocked_levels=['district'])
@require_admin_permission('manage_users')
def role_page(request):
    """Role and permissions management page"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    # Get all admin levels and their permissions
    admin_levels = AdminUser.ADMIN_LEVEL_CHOICES
    
    # Get permission statistics with proper role hierarchy
    permission_stats = {}
    for level_code, level_name in admin_levels:
        permission_stats[level_code] = {
            'name': level_name,
            'count': AdminUser.objects.filter(admin_level=level_code, status='active').count(),
            'permissions': AdminUserPermission.objects.filter(
                admin_user__admin_level=level_code
            ).count(),
            'level_number': {
                'central': 5,
                'region': 4, 
                'division': 3,
                'district': 2,
                'school': 1
            }.get(level_code, 1)
        }
    
    # Get real user data for display
    admin_scope = context.get('admin_scope', {})
    users_query = AdminUser.objects.select_related('region', 'division', 'district', 'school')
    
    # Apply filtering based on current admin's access scope
    if admin_scope.get('admin_level') != 'central':
        if admin_scope.get('admin_level') == 'region':
            users_query = users_query.filter(region_id=admin_scope.get('region_id'))
        elif admin_scope.get('admin_level') == 'division':
            users_query = users_query.filter(division_id=admin_scope.get('division_id'))
        elif admin_scope.get('admin_level') == 'district':
            users_query = users_query.filter(district_id=admin_scope.get('district_id'))
        elif admin_scope.get('admin_level') == 'school':
            users_query = users_query.filter(school_id=admin_scope.get('school_id'))
    
    # Get users with their permissions
    users = users_query.prefetch_related('permissions').filter(status='active')[:50]  # Limit for performance
    
    # Prepare user data for template
    user_data = []
    for user in users:
        # Get user's geographic assignment
        assignment = ""
        access_scope = ""
        
        if user.admin_level == 'central':
            assignment = "Central Office - Nationwide"
            access_scope = "Nationwide"
        elif user.admin_level == 'region' and user.region:
            assignment = f"Region {user.region.name}"
            access_scope = f"Region {user.region.name}"
        elif user.admin_level == 'division' and user.division:
            assignment = f"Division - {user.division.name}"
            access_scope = f"{user.division.name} Division"
        elif user.admin_level == 'district' and user.district:
            assignment = f"District - {user.district.name}"
            access_scope = f"{user.district.name} District"
        elif user.admin_level == 'school' and user.school:
            assignment = f"School - {user.school.school_name}"
            access_scope = f"{user.school.school_name}"
        else:
            assignment = f"{user.get_admin_level_display()} - Unassigned"
            access_scope = "Limited"
        
        # Get user permissions
        permissions = list(user.permissions.values_list('permission_name', flat=True))
        
        # Calculate last activity (using last_login or created_at)
        if user.last_login:
            from django.utils import timezone
            from datetime import timedelta
            
            time_diff = timezone.now() - user.last_login
            if time_diff < timedelta(hours=1):
                last_active = f"{time_diff.seconds // 60} minutes ago"
            elif time_diff < timedelta(days=1):
                last_active = f"{time_diff.seconds // 3600} hours ago"
            else:
                last_active = f"{time_diff.days} days ago"
        else:
            last_active = "Never"
        
        user_data.append({
            'admin_id': user.admin_id,
            'username': user.username,
            'full_name': user.full_name or user.username,
            'email': user.email,
            'admin_level': user.admin_level,
            'admin_level_display': user.get_admin_level_display(),
            'assignment': assignment,
            'access_scope': access_scope,
            'permissions': permissions,
            'permission_count': len(permissions),
            'last_active': last_active,
            'status': user.status,
            'created_at': user.created_at,
        })
    
    # Convert permission_stats to JSON for JavaScript
    import json
    permission_stats_json = json.dumps(permission_stats)
    
    context.update({
        'admin_levels': admin_levels,
        'permission_stats': permission_stats,
        'permission_stats_json': permission_stats_json,
        'users': user_data,
        'total_users': len(user_data),
    })
    
    return render(request, 'admin/role.html', context)


@require_admin_permission('view_system_logs')
def logs_page(request):
    """System logs and audit trail page with real database data"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    # Get date range filters
    date_range = request.GET.get('date_range', 'month')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    search_query = request.GET.get('search', '')
    
    # Calculate date range
    from datetime import datetime, timedelta
    from django.utils import timezone
    
    now = timezone.now()
    if date_range == 'today':
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif date_range == 'yesterday':
        yesterday = now - timedelta(days=1)
        start_dt = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_range == 'week':
        start_dt = now - timedelta(days=7)
        end_dt = now
    elif date_range == 'month':
        start_dt = now - timedelta(days=30)
        end_dt = now
    elif date_range == 'custom' and start_date and end_date:
        start_dt = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
        end_dt = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59))
    else:
        start_dt = now - timedelta(days=30)
        end_dt = now
    
    # Get admin scope for filtering
    admin_scope = context['admin_scope']
    
    # Get login history data
    login_history = LoginAttempt.objects.filter(
        timestamp__range=(start_dt, end_dt)
    ).select_related().order_by('-timestamp')
    
    if search_query:
        login_history = login_history.filter(
            Q(username__icontains=search_query) |
            Q(ip_address__icontains=search_query) |
            Q(location__icontains=search_query)
        )
    
    # Get activity logs
    activity_logs = AuditLog.objects.filter(
        timestamp__range=(start_dt, end_dt)
    ).select_related('user').order_by('-timestamp')
    
    if search_query:
        activity_logs = activity_logs.filter(
            Q(user__username__icontains=search_query) |
            Q(action_type__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(resource_type__icontains=search_query)
        )
    
    # Get audit logs (high-level security events)
    audit_logs = AuditLog.objects.filter(
        timestamp__range=(start_dt, end_dt),
        severity__in=['high', 'critical']
    ).select_related('user').order_by('-timestamp')
    
    if search_query:
        audit_logs = audit_logs.filter(
            Q(user__username__icontains=search_query) |
            Q(action_type__icontains=search_query) |
            Q(description__icontains=search_query)
        )
    
    # Get failed login attempts
    failed_logins = LoginAttempt.objects.filter(
        timestamp__range=(start_dt, end_dt),
        success=False
    ).order_by('-timestamp')
    
    if search_query:
        failed_logins = failed_logins.filter(
            Q(username__icontains=search_query) |
            Q(ip_address__icontains=search_query) |
            Q(failure_reason__icontains=search_query)
        )
    
    # Get educational data logs (questions, forms, answers)
    educational_logs = AuditLog.objects.filter(
        timestamp__range=(start_dt, end_dt),
        resource_type__in=['question', 'answer', 'form', 'category', 'topic']
    ).select_related('user').order_by('-timestamp')
    
    if search_query:
        educational_logs = educational_logs.filter(
            Q(user__username__icontains=search_query) |
            Q(action_type__icontains=search_query) |
            Q(description__icontains=search_query)
        )
    
    # Get administrative logs (admin users, permissions)
    admin_logs = AuditLog.objects.filter(
        timestamp__range=(start_dt, end_dt),
        resource_type__in=['admin_user', 'admin_permission', 'users_school']
    ).select_related('user').order_by('-timestamp')
    
    if search_query:
        admin_logs = admin_logs.filter(
            Q(user__username__icontains=search_query) |
            Q(action_type__icontains=search_query) |
            Q(description__icontains=search_query)
        )
    
    # Get system operation logs
    system_logs = AuditLog.objects.filter(
        timestamp__range=(start_dt, end_dt),
        resource_type__in=['school', 'region', 'division', 'district', 'report', 'data_import']
    ).select_related('user').order_by('-timestamp')
    
    if search_query:
        system_logs = system_logs.filter(
            Q(user__username__icontains=search_query) |
            Q(action_type__icontains=search_query) |
            Q(description__icontains=search_query)
        )
    
    # Get statistics
    total_users = AdminUser.objects.filter(admin_level='school').count()
    successful_logins = LoginAttempt.objects.filter(
        timestamp__range=(start_dt, end_dt),
        success=True
    ).count()
    
    failed_login_count = failed_logins.count()
    
    # Activity summary
    activity_summary = {
        'create_actions': AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            action_type='create'
        ).count(),
        'update_actions': AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            action_type='update'
        ).count(),
        'delete_actions': AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            action_type='delete'
        ).count(),
    }
    
    # Security alerts from recent failed logins
    security_alerts = []
    
    # Check for multiple failed attempts from same IP
    from django.db.models import Count
    suspicious_ips = failed_logins.values('ip_address').annotate(
        attempt_count=Count('id')
    ).filter(attempt_count__gte=3)
    
    for ip_data in suspicious_ips:
        security_alerts.append({
            'type': 'critical',
            'title': 'Multiple Failed Login Attempts',
            'details': f"IP: {ip_data['ip_address']} has {ip_data['attempt_count']} failed attempts",
            'time': 'Recent'
        })
    
    # Pagination for each tab
    from django.core.paginator import Paginator
    
    login_paginator = Paginator(login_history, 25)
    activity_paginator = Paginator(activity_logs, 25)
    audit_paginator = Paginator(audit_logs, 25)
    failed_paginator = Paginator(failed_logins, 25)
    educational_paginator = Paginator(educational_logs, 25)
    admin_paginator = Paginator(admin_logs, 25)
    system_paginator = Paginator(system_logs, 25)
    
    page_number = request.GET.get('page', 1)
    login_page = login_paginator.get_page(page_number)
    activity_page = activity_paginator.get_page(page_number)
    audit_page = audit_paginator.get_page(page_number)
    failed_page = failed_paginator.get_page(page_number)
    educational_page = educational_paginator.get_page(page_number)
    admin_page = admin_paginator.get_page(page_number)
    system_page = system_paginator.get_page(page_number)
    
    context.update({
        'login_history': login_page,
        'activity_logs': activity_page,
        'audit_logs': audit_page,
        'failed_logins': failed_page,
        'educational_logs': educational_page,
        'admin_logs': admin_page,
        'system_logs': system_page,
        'total_users': total_users,
        'successful_logins': successful_logins,
        'failed_login_count': failed_login_count,
        'activity_summary': activity_summary,
        'security_alerts': security_alerts,
        'date_range': date_range,
        'start_date': start_date,
        'end_date': end_date,
        'search_query': search_query,
        # Additional statistics
        'educational_log_count': educational_logs.count(),
        'admin_log_count': admin_logs.count(),
        'system_log_count': system_logs.count(),
    })
    
    return render(request, 'admin/logs.html', context)


@require_admin_permission('view_system_logs')
def export_logs_csv(request):
    """Export logs to CSV format"""
    context = get_admin_context(request)
    if not context:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    
    log_type = request.GET.get('type', 'login_history')
    date_range = request.GET.get('date_range', 'month')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    search_query = request.GET.get('search', '')
    
    # Calculate date range (same logic as logs_page)
    from datetime import datetime, timedelta
    from django.utils import timezone
    
    now = timezone.now()
    if date_range == 'today':
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif date_range == 'yesterday':
        yesterday = now - timedelta(days=1)
        start_dt = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_range == 'week':
        start_dt = now - timedelta(days=7)
        end_dt = now
    elif date_range == 'month':
        start_dt = now - timedelta(days=30)
        end_dt = now
    elif date_range == 'custom' and start_date and end_date:
        start_dt = timezone.make_aware(datetime.strptime(start_date, '%Y-%m-%d'))
        end_dt = timezone.make_aware(datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59))
    else:
        start_dt = now - timedelta(days=30)
        end_dt = now
    
    # Create CSV response
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{log_type}_{date_range}.csv"'
    
    writer = csv.writer(response)
    
    if log_type == 'login_history':
        # Export login history
        writer.writerow(['Username', 'Success', 'Timestamp', 'IP Address', 'Location', 'User Agent', 'Failure Reason'])
        
        login_history = LoginAttempt.objects.filter(
            timestamp__range=(start_dt, end_dt)
        ).order_by('-timestamp')
        
        if search_query:
            login_history = login_history.filter(
                Q(username__icontains=search_query) |
                Q(ip_address__icontains=search_query) |
                Q(location__icontains=search_query)
            )
        
        for attempt in login_history:
            writer.writerow([
                attempt.username,
                'Success' if attempt.success else 'Failed',
                attempt.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                attempt.ip_address,
                attempt.location or 'Unknown',
                attempt.user_agent[:100] + '...' if len(attempt.user_agent) > 100 else attempt.user_agent,
                attempt.failure_reason or ''
            ])
    
    elif log_type == 'activity_logs':
        # Export activity logs
        writer.writerow(['User', 'Action Type', 'Resource Type', 'Resource ID', 'Description', 'Timestamp', 'IP Address', 'Success'])
        
        activity_logs = AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt)
        ).select_related('user').order_by('-timestamp')
        
        if search_query:
            activity_logs = activity_logs.filter(
                Q(user__username__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(resource_type__icontains=search_query)
            )
        
        for log in activity_logs:
            writer.writerow([
                log.user.username if log.user else 'System',
                log.action_type,
                log.resource_type,
                log.resource_id or '',
                log.description[:200] + '...' if len(log.description) > 200 else log.description,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.ip_address or '',
                'Success' if log.success else 'Failed'
            ])
    
    elif log_type == 'audit_logs':
        # Export audit logs (high-level security events)
        writer.writerow(['User', 'Action Type', 'Resource Type', 'Description', 'Severity', 'Timestamp', 'IP Address', 'Metadata'])
        
        audit_logs = AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            severity__in=['high', 'critical']
        ).select_related('user').order_by('-timestamp')
        
        if search_query:
            audit_logs = audit_logs.filter(
                Q(user__username__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(description__icontains=search_query)
            )
        
        for log in audit_logs:
            writer.writerow([
                log.user.username if log.user else 'System',
                log.action_type,
                log.resource_type,
                log.description[:200] + '...' if len(log.description) > 200 else log.description,
                log.severity,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.ip_address or '',
                json.dumps(log.metadata) if log.metadata else ''
            ])
    
    elif log_type == 'failed_logins':
        # Export failed login attempts
        writer.writerow(['Username', 'Timestamp', 'IP Address', 'Location', 'Failure Reason', 'User Agent', 'Is Suspicious'])
        
        failed_logins = LoginAttempt.objects.filter(
            timestamp__range=(start_dt, end_dt),
            success=False
        ).order_by('-timestamp')
        
        if search_query:
            failed_logins = failed_logins.filter(
                Q(username__icontains=search_query) |
                Q(ip_address__icontains=search_query) |
                Q(failure_reason__icontains=search_query)
            )
        
        for attempt in failed_logins:
            writer.writerow([
                attempt.username,
                attempt.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                attempt.ip_address,
                attempt.location or 'Unknown',
                attempt.failure_reason or 'Unknown',
                attempt.user_agent[:100] + '...' if len(attempt.user_agent) > 100 else attempt.user_agent,
                'Yes' if attempt.is_suspicious else 'No'
            ])
    
    elif log_type == 'educational_logs':
        # Export educational data logs
        writer.writerow(['User', 'Action Type', 'Resource Type', 'Resource ID', 'Description', 'Timestamp', 'IP Address', 'Severity', 'Metadata'])
        
        educational_logs = AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            resource_type__in=['question', 'answer', 'form', 'category', 'topic']
        ).select_related('user').order_by('-timestamp')
        
        if search_query:
            educational_logs = educational_logs.filter(
                Q(user__username__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(description__icontains=search_query)
            )
        
        for log in educational_logs:
            writer.writerow([
                log.user.username if log.user else 'System',
                log.action_type,
                log.resource_type,
                log.resource_id or '',
                log.description[:200] + '...' if len(log.description) > 200 else log.description,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.ip_address or '',
                log.severity,
                json.dumps(log.metadata) if log.metadata else ''
            ])
    
    elif log_type == 'admin_logs':
        # Export administrative logs
        writer.writerow(['User', 'Action Type', 'Resource Type', 'Resource ID', 'Description', 'Timestamp', 'IP Address', 'Severity', 'Metadata'])
        
        admin_logs = AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            resource_type__in=['admin_user', 'admin_permission', 'users_school']
        ).select_related('user').order_by('-timestamp')
        
        if search_query:
            admin_logs = admin_logs.filter(
                Q(user__username__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(description__icontains=search_query)
            )
        
        for log in admin_logs:
            writer.writerow([
                log.user.username if log.user else 'System',
                log.action_type,
                log.resource_type,
                log.resource_id or '',
                log.description[:200] + '...' if len(log.description) > 200 else log.description,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.ip_address or '',
                log.severity,
                json.dumps(log.metadata) if log.metadata else ''
            ])
    
    elif log_type == 'system_logs':
        # Export system operation logs
        writer.writerow(['User', 'Action Type', 'Resource Type', 'Resource ID', 'Description', 'Timestamp', 'IP Address', 'Success', 'Metadata'])
        
        system_logs = AuditLog.objects.filter(
            timestamp__range=(start_dt, end_dt),
            resource_type__in=['school', 'region', 'division', 'district', 'report', 'data_import']
        ).select_related('user').order_by('-timestamp')
        
        if search_query:
            system_logs = system_logs.filter(
                Q(user__username__icontains=search_query) |
                Q(action_type__icontains=search_query) |
                Q(description__icontains=search_query)
            )
        
        for log in system_logs:
            writer.writerow([
                log.user.username if log.user else 'System',
                log.action_type,
                log.resource_type,
                log.resource_id or '',
                log.description[:200] + '...' if len(log.description) > 200 else log.description,
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.ip_address or '',
                'Success' if log.success else 'Failed',
                json.dumps(log.metadata) if log.metadata else ''
            ])
    
    return response


def profile_page(request):
    """Admin profile/settings page - accessible to all admin levels including District"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')

    admin_scope = context.get('admin_scope') or {}
    if admin_scope.get('admin_level') == 'school':
        return redirect('user-dashboard:overview')

    # Minimal context - APIs will handle data loading
    return render(request, 'admin/profile.html', context)


@require_admin_level(blocked_levels=['district'])
def settings_page(request):
    """Admin settings and configuration page"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    # Get admin's current settings
    admin_user = AdminUser.objects.get(admin_id=context['admin_id'])
    
    # Get active sessions
    active_sessions = AdminSession.objects.filter(
        admin_user=admin_user,
        is_active=True
    ).order_by('-last_activity')
    
    context.update({
        'admin_user': admin_user,
        'active_sessions': active_sessions,
    })
    
    return render(request, 'admin/settings.html', context)


# API Endpoints for Admin Operations

@require_admin_permission('create_users')
@csrf_exempt
@require_GET
def api_check_user_exists(request):
    """API endpoint to check if username, email, or school already has an account"""
    try:
        username = request.GET.get('username', '').strip()
        email = request.GET.get('email', '').strip()
        school_id = request.GET.get('school_id', '').strip()
        
        result = {
            'username_exists': False,
            'email_exists': False,
            'school_has_account': False
        }
        
        # Check username
        if username:
            result['username_exists'] = AdminUser.objects.filter(username=username).exists()
        
        # Check email
        if email:
            result['email_exists'] = AdminUser.objects.filter(email=email).exists()
        
        # Check if school already has an account (only one account per school)
        if school_id:
            try:
                school_id_int = int(school_id)
                result['school_has_account'] = AdminUser.objects.filter(
                    school_id=school_id_int,
                    admin_level='school'
                ).exists()
            except (ValueError, TypeError):
                pass
        
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_admin_permission('create_users')
@csrf_exempt
@require_POST
def api_create_admin_user(request):
    """API endpoint to create new admin users"""
    try:
        # DEVELOPMENT BYPASS - Create actual user but skip some validations
        from django.conf import settings
        if getattr(settings, 'DEBUG', False):
            try:
                data = json.loads(request.body.decode())
                admin_id = request.session.get('admin_id')
                
                print(f"DEBUG: Received data: {data}")
                print(f"DEBUG: Admin ID: {admin_id}")
                
                # Validate required fields
                required_fields = ['username', 'email', 'full_name', 'admin_level']
                for field in required_fields:
                    if not data.get(field):
                        return JsonResponse({
                            'success': False, 
                            'error': f'{field} is required'
                        }, status=400)
                
                # Check if username already exists
                if AdminUser.objects.filter(username=data.get('username')).exists():
                    return JsonResponse({
                        'success': False,
                        'error': 'Username already exists'
                    }, status=400)
                
                # Check if email already exists
                if AdminUser.objects.filter(email=data.get('email')).exists():
                    return JsonResponse({
                        'success': False,
                        'error': 'Email already exists'
                    }, status=400)
                
                # For school-level users: validate that email matches school_id
                if data.get('admin_level') == 'school':
                    email = data.get('email', '')
                    school_db_id = data.get('school_id')  # This is the database primary key
                    
                    if school_db_id:
                        try:
                            school_db_id_int = int(school_db_id)
                            # Get the School object to access its school_id field (the 6-digit identifier)
                            try:
                                school = School.objects.get(id=school_db_id_int)
                                school_id_value = school.school_id  # This is the 6-digit identifier like "100611"
                            except School.DoesNotExist:
                                return JsonResponse({
                                    'success': False,
                                    'error': 'Selected school not found.'
                                }, status=400)
                            
                            # Extract school ID from email (should be email prefix before @deped.gov.ph)
                            email_prefix = email.replace('@deped.gov.ph', '').strip()
                            
                            # Check if email prefix matches school's school_id field (the 6-digit identifier)
                            if email_prefix != str(school_id_value):
                                    return JsonResponse({
                                        'success': False,
                                        'error': 'Email must match the selected school ID. The email should be the same as the school ID.'
                                }, status=400)
                            
                            # Check if school already has an account (only one account per school)
                            # Use the database id for the filter
                            if AdminUser.objects.filter(school_id=school_db_id_int, admin_level='school').exists():
                                return JsonResponse({
                                    'success': False,
                                    'error': 'This school already has an account. Only one account per school is allowed.'
                                }, status=400)
                        except (ValueError, TypeError) as e:
                            return JsonResponse({
                                'success': False,
                                'error': f'Invalid school ID format: {str(e)}'
                            }, status=400)
                    else:
                        return JsonResponse({
                            'success': False,
                            'error': 'School ID is required for school-level users.'
                    }, status=400)
                
                # Create the admin user directly in development
                with transaction.atomic():
                    # Hash password (default: Edsight.123)
                    password = data.get('password', 'Edsight.123')
                    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                    
                    # Set default permissions based on admin level
                    permissions = AdminUserManager._get_default_permissions(data.get('admin_level'))
                    
                    # Override permissions if provided and convert to boolean
                    for perm_key in ['can_create_users', 'can_manage_users', 'can_set_deadlines', 
                                   'can_approve_submissions', 'can_view_system_logs']:
                        if perm_key in data:
                            perm_value = data.get(perm_key, False)
                            # Convert string values to boolean
                            if isinstance(perm_value, str):
                                permissions[perm_key] = perm_value.lower() in ['true', '1', 'on', 'yes']
                            else:
                                permissions[perm_key] = bool(perm_value)
                    
                    print(f"DEBUG: Final permissions: {permissions}")
                    
                    # Create user
                    new_admin = AdminUser.objects.create(
                        username=data.get('username'),
                        email=data.get('email'),
                        full_name=data.get('full_name'),
                        admin_level=data.get('admin_level'),
                        status=data.get('status', 'active'),
                        password_hash=password_hash,
                        assigned_area=data.get('assigned_area', ''),
                        region_id=data.get('region_id') or None,
                        division_id=data.get('division_id') or None,
                        district_id=data.get('district_id') or None,
                        school_id=data.get('school_id') or None,
                        created_by_id=admin_id,
                        **permissions
                    )
                    
                    print(f"DEBUG: User created successfully with ID: {new_admin.admin_id}")
                    
                    return JsonResponse({
                        'success': True,
                        'admin_id': new_admin.admin_id,
                        'username': new_admin.username,
                        'message': f'Admin user {new_admin.username} created successfully'
                    })
                    
            except json.JSONDecodeError as e:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid JSON data: {str(e)}'
                }, status=400)
            except Exception as e:
                print(f"DEBUG: Error creating user: {str(e)}")
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to create user: {str(e)}'
                }, status=400)
        
        data = json.loads(request.body.decode())
        admin_id = request.session.get('admin_id')
        
        # Validate required fields
        required_fields = ['username', 'email', 'full_name', 'admin_level']
        for field in required_fields:
            if not data.get(field):
                return JsonResponse({
                    'success': False, 
                    'error': f'{field} is required'
                }, status=400)
        
        # Create the admin user
        new_admin = AdminUserManager.create_admin_user(
            creator_admin_id=admin_id,
            user_data=data,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return JsonResponse({
            'success': True,
            'admin_id': new_admin.admin_id,
            'username': new_admin.username,
            'message': f'Admin user {new_admin.username} created successfully'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


@require_admin_permission('manage_users')
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_admin_users(request):
    """API endpoint for admin user management"""
    admin_id = request.session.get('admin_id')
    
    # Get users from database (including newly created ones)
    try:
        # Get all admin users from database
        users_query = AdminUser.objects.filter(status__in=['active', 'inactive', 'suspended'])
        
        users_data = []
        for user in users_query.select_related('region', 'division', 'district', 'school'):
            users_data.append({
                'admin_id': user.admin_id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'admin_level': user.admin_level,
                'assigned_area': user.assigned_area or f'{user.get_admin_level_display()} Level',
                'status': user.status,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
                'permissions': {
                    'can_create_users': user.can_create_users,
                    'can_manage_users': user.can_manage_users,
                    'can_set_deadlines': user.can_set_deadlines,
                    'can_approve_submissions': user.can_approve_submissions,
                    'can_view_system_logs': user.can_view_system_logs,
                }
            })
        
        # If no users found, add mock data for development
        from django.conf import settings
        if getattr(settings, 'DEBUG', False) and len(users_data) == 0:
            mock_users = [
                {
                    'admin_id': 999,
                    'username': 'dev_admin',
                    'email': 'dev.admin@deped.gov.ph',
                    'full_name': 'Development Admin',
                    'admin_level': 'central',
                    'assigned_area': 'Nationwide (Development)',
                    'status': 'active',
                    'last_login': timezone.now().isoformat(),
                    'created_at': timezone.now().isoformat(),
                    'permissions': {
                        'can_create_users': True,
                        'can_manage_users': True,
                        'can_set_deadlines': True,
                        'can_approve_submissions': True,
                        'can_view_system_logs': True,
                    }
                }
            ]
            users_data = mock_users
        
        return JsonResponse({
            'success': True,
            'users': users_data,
            'total': len(users_data),
            'admin_scope': {
                'admin_level': 'central',
                'scope': 'nationwide'
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Failed to load users: {str(e)}'
        }, status=400)
    
    if request.method == 'GET':
        # Get users within admin's scope
        users_query = AdminUser.objects.filter(status='active')
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        if division_id:
            users_query = users_query.filter(division_id=division_id)
        
        users_data = []
        for user in users_query.select_related('region', 'division', 'district', 'school'):
            users_data.append({
                'admin_id': user.admin_id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'admin_level': user.admin_level,
                'assigned_area': user.assigned_area,
                'status': user.status,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
                'permissions': {
                    'can_create_users': user.can_create_users,
                    'can_manage_users': user.can_manage_users,
                    'can_set_deadlines': user.can_set_deadlines,
                    'can_approve_submissions': user.can_approve_submissions,
                    'can_view_system_logs': user.can_view_system_logs,
                }
            })
        
        return JsonResponse({
            'success': True,
            'users': users_data,
            'total': len(users_data)
        })
    
    elif request.method == 'POST':
        # Create new admin user
        return api_create_admin_user(request)


@require_admin_permission('set_deadlines')
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def api_set_deadline(request):
    """API endpoint to get and set form deadlines - Only Region admins can access this endpoint"""
    try:
        admin_id = request.session.get('admin_id')
        if not admin_id:
            return JsonResponse({
                'success': False,
                'error': 'Not authenticated'
            }, status=403)
        
        # Query admin_user table directly to get accurate admin_level
        try:
            admin_user = AdminUser.objects.get(admin_id=admin_id, status='active')
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Admin user not found or inactive'
            }, status=403)
        
        # Check admin_level directly from database
        admin_level = admin_user.admin_level
        
        # Only Region admins can access this endpoint
        if admin_level != 'region':
            return JsonResponse({
                'success': False,
                'error': f'Only Region admins can manage deadlines. Your admin level: {admin_level}'
            }, status=403)
        
        # Verify admin has set_deadlines permission
        if not admin_user.can_set_deadlines:
            return JsonResponse({
                'success': False,
                'error': 'You do not have permission to set deadlines. Please contact your administrator.'
            }, status=403)
        
        # Get admin scope for region_id and other data
        admin_scope = AdminUserManager.get_user_access_scope(admin_id)
        
        if request.method == 'GET':
            # Get deadlines filtered by admin's region
            deadlines_query = FormDeadline.objects.select_related('region', 'division', 'district', 'created_by').filter(is_active=True)
            
            # Region admins can only see deadlines for their region
            region_id = admin_user.region_id
            if region_id:
                deadlines_query = deadlines_query.filter(region_id=region_id)
            else:
                deadlines_query = deadlines_query.none()
            
            # Optional filters
            form_type = request.GET.get('form_type')
            if form_type:
                deadlines_query = deadlines_query.filter(form_type=form_type)
            
            # Order by deadline date
            deadlines_query = deadlines_query.order_by('deadline_date')
            
            deadlines_data = []
            for deadline in deadlines_query:
                deadlines_data.append({
                    'deadline_id': deadline.deadline_id,
                    'form_type': deadline.form_type,
                    'deadline_date': deadline.deadline_date.isoformat(),
                    'description': deadline.description,
                    'is_active': deadline.is_active,
                    'region_id': deadline.region_id,
                    'region_name': deadline.region.name if deadline.region else None,
                    'division_id': deadline.division_id,
                    'division_name': deadline.division.name if deadline.division else None,
                    'district_id': deadline.district_id,
                    'district_name': deadline.district.name if deadline.district else None,
                    'created_by': deadline.created_by.username if deadline.created_by else None,
                    'created_at': deadline.created_at.isoformat(),
                    'updated_at': deadline.updated_at.isoformat(),
                })
            
            return JsonResponse({
                'success': True,
                'deadlines': deadlines_data,
                'count': len(deadlines_data)
            })
        
        elif request.method == 'POST':
            # Set a new deadline
            data = json.loads(request.body.decode())
            
            # Automatically set region_id to the Region admin's assigned region
            region_id = admin_user.region_id
            if not region_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Region admin must have an assigned region'
                }, status=400)
            # Override any region_id in the request data
            data['region_id'] = region_id
            # Region admins cannot set division or district-specific deadlines
            data['division_id'] = None
            data['district_id'] = None
            
            # Validate required fields
            required_fields = ['form_type', 'deadline_date']
            for field in required_fields:
                if not data.get(field):
                    return JsonResponse({
                        'success': False,
                        'error': f'{field} is required'
                    }, status=400)
            
            # Validate and convert deadline_date to datetime object
            from datetime import datetime
            from django.utils import timezone
            deadline_date_str = data.get('deadline_date')
            try:
                # Parse the date string (format: YYYY-MM-DD from HTML date input)
                if isinstance(deadline_date_str, str):
                    # Parse as date first
                    parsed_date = datetime.strptime(deadline_date_str, '%Y-%m-%d').date()
                    
                    # Validate that deadline is not in the past
                    if parsed_date < timezone.now().date():
                        return JsonResponse({
                            'success': False,
                            'error': 'Deadline date cannot be in the past'
                        }, status=400)
                    
                    # Convert to datetime (use start of day - midnight)
                    deadline_datetime = timezone.make_aware(
                        datetime.combine(parsed_date, datetime.min.time())
                    )
                    
                    # Replace string with datetime object
                    data['deadline_date'] = deadline_datetime
                else:
                    return JsonResponse({
                        'success': False,
                        'error': 'Invalid deadline date format. Expected YYYY-MM-DD'
                    }, status=400)
                
            except ValueError as e:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid deadline date format: {str(e)}. Expected YYYY-MM-DD'
                }, status=400)
            
            # Validate form_type
            valid_form_types = ['annual', 'quarterly', 'monthly']
            form_type = data.get('form_type', '').lower()
            if form_type not in valid_form_types:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid form type. Must be one of: {", ".join(valid_form_types)}'
                }, status=400)
            data['form_type'] = form_type
            
            # Validate description length if provided
            if 'description' in data and data['description']:
                description = str(data['description']).strip()
                if len(description) > 500:
                    return JsonResponse({
                        'success': False,
                        'error': 'Description cannot exceed 500 characters'
                    }, status=400)
                data['description'] = description if description else None
            else:
                data['description'] = None
            
            # Check if a deadline already exists for this region and form_type
            # Only one deadline per region per form_type is allowed
            existing_deadline = FormDeadline.objects.filter(
                region_id=region_id,
                form_type=form_type,
                is_active=True
            ).first()
            
            if existing_deadline:
                # Update existing deadline instead of creating a new one
                deadline = DeadlineManager.update_deadline(
                    existing_deadline.deadline_id,
                    admin_id=admin_id,
                    deadline_data=data,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                action = 'updated'
            else:
                # Create new deadline
                deadline = DeadlineManager.set_deadline(
                    admin_id=admin_id,
                    deadline_data=data,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                action = 'created'
        
        return JsonResponse({
            'success': True,
            'deadline_id': deadline.deadline_id,
            'form_type': deadline.form_type,
            'deadline_date': deadline.deadline_date.isoformat(),
            'region_id': deadline.region_id,
            'message': f'Deadline {action} successfully',
            'action': action
        })
        
    except PermissionDenied as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=403)
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


@require_admin_permission('set_deadlines')
@csrf_exempt
@require_http_methods(['DELETE'])
def api_delete_deadline(request, deadline_id):
    """Deactivate a deadline within the region admin's scope."""
    try:
        admin_id = request.session.get('admin_id')
        if not admin_id:
            return JsonResponse({
                'success': False,
                'error': 'Not authenticated'
            }, status=403)

        try:
            admin_user = AdminUser.objects.get(admin_id=admin_id, status='active')
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Admin user not found or inactive'
            }, status=403)

        if admin_user.admin_level != 'region':
            return JsonResponse({
                'success': False,
                'error': f'Only Region admins can delete deadlines. Your admin level: {admin_user.admin_level}'
            }, status=403)

        if not admin_user.can_set_deadlines:
            return JsonResponse({
                'success': False,
                'error': 'You do not have permission to delete deadlines.'
            }, status=403)

        try:
            deadline = FormDeadline.objects.get(deadline_id=deadline_id, is_active=True)
        except FormDeadline.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Deadline not found or already deleted.'
            }, status=404)

        if admin_user.region_id and deadline.region_id != admin_user.region_id:
            return JsonResponse({
                'success': False,
                'error': 'You can only delete deadlines within your region.'
            }, status=403)

        deadline.is_active = False
        deadline.save(update_fields=['is_active', 'updated_at'])

        AdminActivityLog.objects.create(
            admin_user_id=admin_id,
            action='DELETE_DEADLINE',
            resource_type='form_deadline',
            resource_id=str(deadline.deadline_id),
            details={
                'form_type': deadline.form_type,
                'deadline_date': deadline.deadline_date.isoformat(),
                'region_id': deadline.region_id,
                'division_id': deadline.division_id,
                'district_id': deadline.district_id
            },
            ip_address=request.META.get('REMOTE_ADDR')
        )

        return JsonResponse({
            'success': True,
            'message': 'Deadline deleted successfully.'
        })

    except PermissionDenied as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=403)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


@require_admin_permission('view_system_logs')
@csrf_exempt
@require_GET
def api_activity_logs(request):
    """API endpoint to get activity logs"""
    # Get logs based on admin's scope
    logs_query = AdminActivityLog.objects.all()
    
    # Apply division filter (only division and central office admins have access)
    division_id = get_admin_division_filter(request)
    if division_id:
        # Filter logs for division-level admins - get all admins in this division
        accessible_admin_ids = AdminUser.objects.filter(
            division_id=division_id
            ).values_list('admin_id', flat=True)
        logs_query = logs_query.filter(admin_user_id__in=accessible_admin_ids)
    
    # Pagination
    page = int(request.GET.get('page', 1))
    page_size = int(request.GET.get('page_size', 50))
    
    paginator = Paginator(logs_query.order_by('-timestamp'), page_size)
    logs_page = paginator.get_page(page)
    
    logs_data = []
    for log in logs_page:
        logs_data.append({
            'log_id': log.log_id,
            'admin_user': log.admin_user.username,
            'action': log.action,
            'resource_type': log.resource_type,
            'resource_id': log.resource_id,
            'details': log.details,
            'ip_address': log.ip_address,
            'timestamp': log.timestamp.isoformat(),
        })
    
    return JsonResponse({
        'success': True,
        'logs': logs_data,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
            'total_logs': paginator.count,
            'has_next': logs_page.has_next(),
            'has_previous': logs_page.has_previous(),
        }
    })


@require_admin_permission('manage_users')
@csrf_exempt
@require_http_methods(['GET', 'PUT'])
@log_admin_activity('EDIT_ADMIN_USER', 'admin_user')
def api_edit_admin_user(request, user_id):
    """API endpoint to edit admin users"""
    try:
        admin_id = request.session.get('admin_id')
        admin_scope = AdminUserManager.get_user_access_scope(admin_id)
        
        # DEVELOPMENT BYPASS - Skip database checks for development
        from django.conf import settings
        if not getattr(settings, 'DEBUG', False):
            # Get the user to edit
            try:
                user_to_edit = AdminUser.objects.get(admin_id=user_id)
            except AdminUser.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'User not found'
                }, status=404)
            
            # Check if the admin can edit this user (scope-based access)
            if not AdminUserManager.can_access_user(admin_id, user_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied'
                }, status=403)
        
        if request.method == 'GET':
            # Try to get user from database first
            try:
                user_to_edit = AdminUser.objects.get(admin_id=user_id)
                
                # Return actual user data for editing
                user_data = {
                    'admin_id': user_to_edit.admin_id,
                    'username': user_to_edit.username,
                    'email': user_to_edit.email,
                    'full_name': user_to_edit.full_name,
                    'admin_level': user_to_edit.admin_level,
                    'status': user_to_edit.status,
                    'assigned_area': user_to_edit.assigned_area,
                    'region_id': user_to_edit.region_id,
                    'division_id': user_to_edit.division_id,
                    'district_id': user_to_edit.district_id,
                    'school_id': user_to_edit.school_id,
                    'created_at': user_to_edit.created_at.isoformat(),
                    'permissions': {
                        'can_create_users': user_to_edit.can_create_users,
                        'can_manage_users': user_to_edit.can_manage_users,
                        'can_set_deadlines': user_to_edit.can_set_deadlines,
                        'can_approve_submissions': user_to_edit.can_approve_submissions,
                        'can_view_system_logs': user_to_edit.can_view_system_logs,
                    }
                }
                return JsonResponse({
                    'success': True,
                    'user': user_data
                })
                
            except AdminUser.DoesNotExist:
                # DEVELOPMENT BYPASS - Return mock user data if not found in database
                from django.conf import settings
                if getattr(settings, 'DEBUG', False):
                    mock_user_data = {
                        999: {
                            'admin_id': 999,
                            'username': 'dev_admin',
                            'email': 'dev.admin@deped.gov.ph',
                            'full_name': 'Development Admin',
                            'admin_level': 'central',
                            'status': 'active',
                            'assigned_area': 'Nationwide (Development)',
                            'region_id': None,
                            'division_id': None,
                            'district_id': None,
                            'school_id': None,
                            'created_at': timezone.now().isoformat(),
                            'permissions': {
                                'can_create_users': True,
                                'can_manage_users': True,
                                'can_set_deadlines': True,
                                'can_approve_submissions': True,
                                'can_view_system_logs': True,
                            }
                        }
                    }
                    
                    if user_id in mock_user_data:
                        return JsonResponse({
                            'success': True,
                            'user': mock_user_data[user_id]
                        })
                
                return JsonResponse({
                    'success': False,
                    'error': 'User not found'
                }, status=404)
        
        elif request.method == 'PUT':
            # Get the user to edit (needed for both DEBUG and non-DEBUG modes)
            try:
                user_to_edit = AdminUser.objects.get(admin_id=user_id)
            except AdminUser.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'User not found'
                }, status=404)
            
            # Check if the admin can edit this user (scope-based access)
            if not AdminUserManager.can_access_user(admin_id, user_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied'
                }, status=403)
            
            # Update user - Parse JSON data
            try:
                if not request.body:
                    return JsonResponse({
                        'success': False,
                        'error': 'Request body is empty'
                    }, status=400)
                
                # Try to decode and parse JSON
                body_str = request.body.decode('utf-8')
                data = json.loads(body_str)
            except UnicodeDecodeError as e:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid request encoding: {str(e)}'
                }, status=400)
            except json.JSONDecodeError as e:
                return JsonResponse({
                    'success': False,
                    'error': f'Invalid JSON data: {str(e)}'
                }, status=400)
            
            # Update user fields
            if 'full_name' in data:
                user_to_edit.full_name = data['full_name']
            if 'email' in data:
                user_to_edit.email = data['email']
            if 'status' in data:
                # Validate status value
                valid_statuses = ['active', 'inactive', 'suspended']
                if data['status'] not in valid_statuses:
                    return JsonResponse({
                        'success': False,
                        'error': f'Invalid status value. Must be one of: {", ".join(valid_statuses)}'
                    }, status=400)
                user_to_edit.status = data['status']
            if 'admin_level' in data:
                user_to_edit.admin_level = data['admin_level']
            
            # Update geographic assignments
            if 'region_id' in data:
                user_to_edit.region_id = data['region_id'] or None
            if 'division_id' in data:
                user_to_edit.division_id = data['division_id'] or None
            if 'district_id' in data:
                user_to_edit.district_id = data['district_id'] or None
            if 'school_id' in data:
                user_to_edit.school_id = data['school_id'] or None
            
            # Update permissions
            if 'can_create_users' in data:
                user_to_edit.can_create_users = data['can_create_users']
            if 'can_manage_users' in data:
                user_to_edit.can_manage_users = data['can_manage_users']
            if 'can_set_deadlines' in data:
                user_to_edit.can_set_deadlines = data['can_set_deadlines']
            if 'can_approve_submissions' in data:
                user_to_edit.can_approve_submissions = data['can_approve_submissions']
            if 'can_view_system_logs' in data:
                user_to_edit.can_view_system_logs = data['can_view_system_logs']
            
            # Set updated_by
            user_to_edit.updated_by_id = admin_id
            
            # Save the user with validation
            try:
                user_to_edit.full_clean()  # Validate model fields
                user_to_edit.save()
            except Exception as save_error:
                return JsonResponse({
                    'success': False,
                    'error': f'Validation error: {str(save_error)}'
                }, status=400)
            
            return JsonResponse({
                'success': True,
                'message': f'User {user_to_edit.username} updated successfully',
                'user': {
                    'admin_id': user_to_edit.admin_id,
                    'username': user_to_edit.username,
                    'full_name': user_to_edit.full_name,
                    'email': user_to_edit.email,
                    'status': user_to_edit.status
                }
            })
            
    except Exception as e:
        import traceback
        from django.conf import settings
        error_trace = traceback.format_exc()
        return JsonResponse({
            'success': False,
            'error': f'Unexpected error: {str(e)}',
            'details': error_trace if getattr(settings, 'DEBUG', False) else None
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


@require_admin_permission('manage_users')
@csrf_exempt
@require_POST
@log_admin_activity('RESET_PASSWORD', 'admin_user')
def api_reset_admin_password(request, user_id):
    """API endpoint to reset admin user password"""
    try:
        admin_id = request.session.get('admin_id')
        
        # Get the user to reset password for
        try:
            user_to_reset = AdminUser.objects.get(admin_id=user_id)
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
        
        # Check if the admin can manage this user
        if not AdminUserManager.can_access_user(admin_id, user_id):
            return JsonResponse({
                'success': False,
                'error': 'Access denied'
            }, status=403)
        
        # Generate new secure password
        import secrets
        import string
        
        # Generate a secure random password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Ensure password meets requirements (at least one of each type)
        while not (any(c.islower() for c in new_password) and
                   any(c.isupper() for c in new_password) and
                   any(c.isdigit() for c in new_password) and
                   any(c in "!@#$%^&*" for c in new_password)):
            new_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Hash the password
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_to_reset.password_hash = password_hash
        user_to_reset.updated_by_id = admin_id
        user_to_reset.save()
        
        return JsonResponse({
            'success': True,
            'message': f'Password reset successfully for {user_to_reset.username}',
            'new_password': new_password,  # In production, this should be sent securely
            'user': {
                'admin_id': user_to_reset.admin_id,
                'username': user_to_reset.username,
                'full_name': user_to_reset.full_name,
                'email': user_to_reset.email
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


@require_admin_permission('manage_users')
@csrf_exempt
@require_POST
@log_admin_activity('DELETE_ADMIN_USER', 'admin_user')
def api_delete_admin_user(request, user_id):
    """API endpoint to delete admin users (permanent delete)"""
    try:
        admin_id = request.session.get('admin_id')
        
        # Get the user to delete
        try:
            user_to_delete = AdminUser.objects.get(admin_id=user_id)
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
        
        # Check if the admin can manage this user
        if not AdminUserManager.can_access_user(admin_id, user_id):
            return JsonResponse({
                'success': False,
                'error': 'Access denied'
            }, status=403)
        
        # Prevent self-deletion
        if user_id == admin_id:
            return JsonResponse({
                'success': False,
                'error': 'Cannot delete your own account'
            }, status=400)
        
        # Store username for response message before deletion
        username = user_to_delete.username
        
        # Permanently delete the user
        # Related records will be handled by CASCADE or SET_NULL based on model definitions:
        # - AdminSession: CASCADE (sessions will be deleted)
        # - AdminActivityLog: CASCADE (activity logs will be deleted)
        # - created_by/updated_by: SET_NULL (will be set to NULL in related records)
        user_to_delete.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'User {username} deleted successfully'
        })
        
    except Exception as e:
        import traceback
        from django.conf import settings
        error_trace = traceback.format_exc()
        return JsonResponse({
            'success': False,
            'error': f'Error deleting user: {str(e)}',
            'details': error_trace if getattr(settings, 'DEBUG', False) else None
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


@require_admin_permission('manage_users')
@csrf_exempt
@require_GET
def api_export_admin_users(request):
    """API endpoint to export admin users data"""
    try:
        import csv
        from django.http import HttpResponse
        from io import StringIO
        
        # DEVELOPMENT BYPASS - Return mock CSV data
        from django.conf import settings
        if getattr(settings, 'DEBUG', False):
            export_format = request.GET.get('format', 'csv').lower()
            
            if export_format == 'csv':
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="admin_users.csv"'
                
                writer = csv.writer(response)
                writer.writerow([
                    'Admin ID', 'Username', 'Full Name', 'Email', 'Admin Level',
                    'Status', 'Assigned Area', 'Last Login', 'Created At',
                    'Can Create Users', 'Can Manage Users', 'Can Set Deadlines',
                    'Can Approve Submissions', 'Can View System Logs'
                ])
                
                # Mock data
                mock_rows = [
                    [1, 'dev_admin', 'Development Admin', 'dev.admin@deped.gov.ph', 'Central Office', 'Active', 'Nationwide (Development)', timezone.now().isoformat(), timezone.now().isoformat(), 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
                    [2, 'region_admin', 'Regional Admin', 'region.admin@deped.gov.ph', 'Region', 'Active', 'Region IV-A (Development)', timezone.now().isoformat(), timezone.now().isoformat(), 'No', 'No', 'Yes', 'Yes', 'Yes']
                ]
                
                for row in mock_rows:
                    writer.writerow(row)
                
                return response
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Unsupported export format'
                }, status=400)
        
        admin_id = request.session.get('admin_id')
        admin_scope = AdminUserManager.get_user_access_scope(admin_id)
        
        # Get users within admin's scope
        users_query = AdminUser.objects.filter(status='active')
        
        # Apply geographic filtering
        if admin_scope['admin_level'] == 'region':
            users_query = users_query.filter(region_id=admin_scope.get('region_id'))
        elif admin_scope['admin_level'] == 'division':
            users_query = users_query.filter(division_id=admin_scope.get('division_id'))
        elif admin_scope['admin_level'] == 'district':
            users_query = users_query.filter(district_id=admin_scope.get('district_id'))
        elif admin_scope['admin_level'] == 'school':
            users_query = users_query.filter(school_id=admin_scope.get('school_id'))
        
        export_format = request.GET.get('format', 'csv').lower()
        
        if export_format == 'csv':
            # Create CSV response
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="admin_users.csv"'
            
            writer = csv.writer(response)
            writer.writerow([
                'Admin ID', 'Username', 'Full Name', 'Email', 'Admin Level',
                'Status', 'Assigned Area', 'Last Login', 'Created At',
                'Can Create Users', 'Can Manage Users', 'Can Set Deadlines',
                'Can Approve Submissions', 'Can View System Logs'
            ])
            
            for user in users_query.select_related('region', 'division', 'district', 'school'):
                writer.writerow([
                    user.admin_id,
                    user.username,
                    user.full_name,
                    user.email,
                    user.get_admin_level_display(),
                    user.get_status_display(),
                    user.assigned_area or '',
                    user.last_login.isoformat() if user.last_login else '',
                    user.created_at.isoformat(),
                    'Yes' if user.can_create_users else 'No',
                    'Yes' if user.can_manage_users else 'No',
                    'Yes' if user.can_set_deadlines else 'No',
                    'Yes' if user.can_approve_submissions else 'No',
                    'Yes' if user.can_view_system_logs else 'No'
                ])
            
            return response
            
        else:
            return JsonResponse({
                'success': False,
                'error': 'Unsupported export format'
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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


def get_filtered_geographic_data(admin_level, admin_scope_data, data_type, parent_id=None):
    """
    Filter geographic data based on admin level and scope
    Implements the rule: users should only access areas within their scope
    """
    from django.conf import settings
    
    # Get mock data for development
    mock_data = {
        'regions': [
            {'id': 1, 'name': 'Region I (Ilocos Region)'},
            {'id': 2, 'name': 'Region II (Cagayan Valley)'},
            {'id': 3, 'name': 'Region III (Central Luzon)'},
            {'id': 4, 'name': 'Region IV-A (CALABARZON)'},
            {'id': 5, 'name': 'Region IV-B (MIMAROPA)'},
            {'id': 6, 'name': 'Region V (Bicol Region)'},
            {'id': 7, 'name': 'Region VI (Western Visayas)'},
            {'id': 8, 'name': 'Region VII (Central Visayas)'},
            {'id': 9, 'name': 'Region VIII (Eastern Visayas)'},
            {'id': 10, 'name': 'Region IX (Zamboanga Peninsula)'},
            {'id': 11, 'name': 'Region X (Northern Mindanao)'},
            {'id': 12, 'name': 'Region XI (Davao Region)'},
            {'id': 13, 'name': 'Region XII (SOCCSKSARGEN)'},
            {'id': 14, 'name': 'CARAGA'},
            {'id': 15, 'name': 'BARMM (Bangsamoro)'},
            {'id': 16, 'name': 'CAR (Cordillera)'},
            {'id': 17, 'name': 'NCR (National Capital Region)'},
        ],
        'divisions': [
            # Region I divisions
            {'id': 1, 'name': 'Ilocos Norte Division', 'region_id': 1},
            {'id': 2, 'name': 'Ilocos Sur Division', 'region_id': 1},
            {'id': 3, 'name': 'La Union Division', 'region_id': 1},
            {'id': 4, 'name': 'Pangasinan Division', 'region_id': 1},
            # Region IV-A divisions (for testing)
            {'id': 15, 'name': 'Batangas Division', 'region_id': 4},
            {'id': 16, 'name': 'Cavite Division', 'region_id': 4},
            {'id': 17, 'name': 'Laguna Division', 'region_id': 4},
            {'id': 18, 'name': 'Quezon Division', 'region_id': 4},
            {'id': 19, 'name': 'Rizal Division', 'region_id': 4},
        ],
        'districts': [
            # Laguna districts
            {'id': 1, 'name': 'Calamba District', 'division_id': 17},
            {'id': 2, 'name': 'Los Baños District', 'division_id': 17},
            {'id': 3, 'name': 'San Pablo District', 'division_id': 17},
            {'id': 4, 'name': 'Santa Cruz District', 'division_id': 17},
            # Batangas districts
            {'id': 5, 'name': 'Batangas City District', 'division_id': 15},
            {'id': 6, 'name': 'Lipa City District', 'division_id': 15},
            {'id': 7, 'name': 'Tanauan District', 'division_id': 15},
        ],
        'schools': [
            # Laguna schools
            {'id': 1, 'school_name': 'Calamba National High School', 'district_id': 1},
            {'id': 2, 'school_name': 'Los Baños National High School', 'district_id': 2},
            {'id': 3, 'school_name': 'San Pablo City Science High School', 'district_id': 3},
            {'id': 4, 'school_name': 'Santa Cruz National High School', 'district_id': 4},
            # Batangas schools
            {'id': 5, 'school_name': 'Batangas National High School', 'district_id': 5},
            {'id': 6, 'school_name': 'Lipa City Science High School', 'district_id': 6},
            {'id': 7, 'school_name': 'Tanauan City National High School', 'district_id': 7},
        ]
    }
    
    # Apply role-based filtering
    data = mock_data.get(data_type, [])
    
    # Filter based on admin level and scope
    if admin_level == 'central':
        # Central office can see all
        filtered_data = data
    elif admin_level == 'region':
        # Region admin can only see their region and below
        region_id = admin_scope_data.get('region_id')
        if data_type == 'regions':
            filtered_data = [item for item in data if item['id'] == region_id] if region_id else []
        elif data_type == 'divisions':
            if parent_id:
                filtered_data = [item for item in data if item.get('region_id') == int(parent_id)]
            else:
                filtered_data = [item for item in data if item.get('region_id') == region_id] if region_id else []
        elif data_type == 'districts':
            # Get divisions in this region first
            region_divisions = [item['id'] for item in mock_data['divisions'] if item.get('region_id') == region_id]
            if parent_id:
                filtered_data = [item for item in data if item.get('division_id') == int(parent_id) and int(parent_id) in region_divisions]
            else:
                filtered_data = [item for item in data if item.get('division_id') in region_divisions]
        elif data_type == 'schools':
            # Get districts in this region's divisions
            region_divisions = [item['id'] for item in mock_data['divisions'] if item.get('region_id') == region_id]
            region_districts = [item['id'] for item in mock_data['districts'] if item.get('division_id') in region_divisions]
            if parent_id:
                filtered_data = [item for item in data if item.get('district_id') == int(parent_id) and int(parent_id) in region_districts]
            else:
                filtered_data = [item for item in data if item.get('district_id') in region_districts]
        else:
            filtered_data = []
    elif admin_level == 'division':
        # Division admin can only see their division and below
        division_id = admin_scope_data.get('division_id')
        region_id = admin_scope_data.get('region_id')
        if data_type == 'regions':
            filtered_data = [item for item in data if item['id'] == region_id] if region_id else []
        elif data_type == 'divisions':
            filtered_data = [item for item in data if item['id'] == division_id] if division_id else []
        elif data_type == 'districts':
            if parent_id:
                filtered_data = [item for item in data if item.get('division_id') == int(parent_id) and int(parent_id) == division_id]
            else:
                filtered_data = [item for item in data if item.get('division_id') == division_id] if division_id else []
        elif data_type == 'schools':
            # Get districts in this division
            division_districts = [item['id'] for item in mock_data['districts'] if item.get('division_id') == division_id]
            if parent_id:
                filtered_data = [item for item in data if item.get('district_id') == int(parent_id) and int(parent_id) in division_districts]
            else:
                filtered_data = [item for item in data if item.get('district_id') in division_districts]
        else:
            filtered_data = []
    elif admin_level == 'district':
        # District admin can only see their district and below
        district_id = admin_scope_data.get('district_id')
        division_id = admin_scope_data.get('division_id')
        region_id = admin_scope_data.get('region_id')
        if data_type == 'regions':
            filtered_data = [item for item in data if item['id'] == region_id] if region_id else []
        elif data_type == 'divisions':
            filtered_data = [item for item in data if item['id'] == division_id] if division_id else []
        elif data_type == 'districts':
            filtered_data = [item for item in data if item['id'] == district_id] if district_id else []
        elif data_type == 'schools':
            if parent_id:
                filtered_data = [item for item in data if item.get('district_id') == int(parent_id) and int(parent_id) == district_id]
            else:
                filtered_data = [item for item in data if item.get('district_id') == district_id] if district_id else []
        else:
            filtered_data = []
    elif admin_level == 'school':
        # School admin can only see their specific assignments
        school_id = admin_scope_data.get('school_id')
        district_id = admin_scope_data.get('district_id')
        division_id = admin_scope_data.get('division_id')
        region_id = admin_scope_data.get('region_id')
        if data_type == 'regions':
            filtered_data = [item for item in data if item['id'] == region_id] if region_id else []
        elif data_type == 'divisions':
            filtered_data = [item for item in data if item['id'] == division_id] if division_id else []
        elif data_type == 'districts':
            filtered_data = [item for item in data if item['id'] == district_id] if district_id else []
        elif data_type == 'schools':
            filtered_data = [item for item in data if item['id'] == school_id] if school_id else []
        else:
            filtered_data = []
    else:
        # Default to empty for unknown admin levels
        filtered_data = []
    
    return filtered_data


@csrf_exempt
def api_geographic_data(request, data_type=None):
    """API endpoint to get geographic data for hierarchical loading"""
    try:
        # Debug: Print the data_type parameter
        print(f"DEBUG: data_type = {data_type}")
        print(f"DEBUG: request.GET = {dict(request.GET)}")
        
        # Import models from core app
        from apps.core.models import Region, Division, District, School
        
        parent_id = request.GET.get('parent_id')
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        
        if data_type == 'regions':
            # Only load regions initially - no parent required
            regions_query = Region.objects.all()
            # For division-level admins, only show their own region
            if division_id:
                try:
                    division = Division.objects.get(id=division_id)
                    regions_query = regions_query.filter(id=division.region_id)
                except Division.DoesNotExist:
                    regions_query = Region.objects.none()
            regions = regions_query.values('id', 'name').order_by('name')
            return JsonResponse({
                'success': True,
                'data': list(regions),
                'total': len(regions)
            })
        elif data_type == 'divisions':
            # Only load divisions when a region is selected
            if not parent_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Region ID required to load divisions'
                }, status=400)
            # Verify division-level admin can only access their own region
            if division_id:
                try:
                    division = Division.objects.get(id=division_id)
                    if str(division.region_id) != str(parent_id):
                        return JsonResponse({
                            'success': False,
                            'error': 'Access denied to this region'
                        }, status=403)
                except Division.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': 'Access denied'
                    }, status=403)
            divisions_query = Division.objects.filter(region_id=parent_id)
            # Filter by division if division-level admin
            if division_id:
                divisions_query = divisions_query.filter(id=division_id)
            divisions = divisions_query.values('id', 'name').order_by('name')
            return JsonResponse({
                'success': True,
                'data': list(divisions),
                'total': len(divisions)
            })
        elif data_type == 'districts':
            # Only load districts when a division is selected
            if not parent_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Division ID required to load districts'
                }, status=400)
            # Verify division-level admin can only access their own division
            if division_id and str(division_id) != str(parent_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this division'
                }, status=403)
            districts_query = District.objects.filter(division_id=parent_id)
            districts = districts_query.values('id', 'name').order_by('name')
            return JsonResponse({
                'success': True,
                'data': list(districts),
                'total': len(districts)
            })
        elif data_type == 'schools':
            # Only load schools when a district is selected
            if not parent_id:
                return JsonResponse({
                    'success': False,
                    'error': 'District ID required to load schools'
                }, status=400)
            # Verify division-level admin can only access districts in their division
            if division_id:
                try:
                    district = District.objects.get(id=parent_id)
                    if str(district.division_id) != str(division_id):
                        return JsonResponse({
                            'success': False,
                            'error': 'Access denied to this district'
                        }, status=403)
                except District.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': 'District not found'
                    }, status=404)
            schools_query = School.objects.filter(district_id=parent_id)
            # Filter by division if division-level admin (additional safety check)
            if division_id:
                schools_query = schools_query.filter(division_id=division_id)
            schools = schools_query.values('id', 'school_name').order_by('school_name')
            return JsonResponse({
                'success': True,
                'data': list(schools),
                'total': len(schools)
            })
        else:
            return JsonResponse({
                'success': False,
                'error': f'Invalid data type: {data_type}'
            }, status=400)
            
    except Exception as e:
        print(f"DEBUG: Exception occurred: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_create_role(request):
    """Create a new role with organizational hierarchy permissions"""
    try:
        data = json.loads(request.body)
        role_name = data.get('role_name')
        role_level = data.get('role_level')
        permissions = data.get('permissions', {})
        
        # Validate role level
        valid_levels = {
            '5': 'central',
            '4': 'region', 
            '3': 'division',
            '2': 'district',
            '1': 'school'
        }
        
        if role_level not in valid_levels:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        admin_level = valid_levels[role_level]
        
        # Map permissions based on organizational hierarchy
        permission_mapping = {
            'central': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
                'can_view_all_schools': True,
                'can_final_submission': True
            },
            'region': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'division': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'district': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': True,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            },
            'school': {
                'can_create_users': False,
                'can_manage_users': False,
                'can_set_deadlines': False,
                'can_approve_submissions': False,
                'can_view_system_logs': False,
                'can_view_all_schools': False,
                'can_final_submission': False
            }
        }
        
        role_permissions = permission_mapping.get(admin_level, {})
        
        return JsonResponse({
            'success': True,
            'message': f'Role "{role_name}" created successfully',
            'role': {
                'name': role_name,
                'level': admin_level,
                'level_number': role_level,
                'permissions': role_permissions
            }
        })
        
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


@csrf_exempt
@require_http_methods(["POST"])
@require_admin_permission('manage_users')
def api_assign_role(request):
    """Assign role to a user with proper hierarchy validation"""
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        role_level = data.get('role_level')
        
        # Get current admin context to validate permissions
        context = get_admin_context(request)
        current_admin_level = context.get('admin_level')
        
        # Hierarchy validation - admin can only assign roles at their level or below
        level_hierarchy = {
            'central': 5,
            'region': 4,
            'division': 3,
            'district': 2,
            'school': 1
        }
        
        current_level_num = level_hierarchy.get(current_admin_level, 1)
        target_level_num = int(role_level)
        
        if target_level_num > current_level_num:
            return JsonResponse({
                'success': False,
                'error': 'Cannot assign a role higher than your current level'
            }, status=403)
        
        # Map level number to admin level
        level_mapping = {
            5: 'central',
            4: 'region',
            3: 'division', 
            2: 'district',
            1: 'school'
        }
        
        target_admin_level = level_mapping.get(target_level_num)
        
        if not target_admin_level:
            return JsonResponse({
                'success': False,
                'error': 'Invalid role level'
            }, status=400)
        
        # Update user's admin level
        try:
            admin_user = AdminUser.objects.get(admin_id=user_id)
            admin_user.admin_level = target_admin_level
            admin_user.save()
            
            # Log the activity
            log_admin_activity(
                admin_user_id=context['admin_id'],
                action='assign_role',
                details=f'Assigned {target_admin_level} role to user {admin_user.username}',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Role assigned successfully to {admin_user.username}',
                'user': {
                    'id': admin_user.admin_id,
                    'username': admin_user.username,
                    'role': target_admin_level,
                    'role_display': level_mapping[target_level_num].replace('_', ' ').title()
                }
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