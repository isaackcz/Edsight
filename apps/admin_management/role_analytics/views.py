"""
Role Analytics Views
Views and API endpoints for role statistics and analysis page
"""

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from .services import RoleAnalyticsService
from ..utils import require_admin_level
from ..views import get_admin_context


@require_admin_level(allowed_levels=['central'])
def role_analytics_page(request):
    """Role analytics and statistics page - Central Office only"""
    context = get_admin_context(request)
    if not context:
        return redirect('/auth/login/')
    
    return render(request, 'admin/role_analytics.html', context)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_role_analytics_stats(request):
    """API endpoint for overall statistics"""
    try:
        stats = RoleAnalyticsService.get_overall_statistics()
        return JsonResponse({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_role_distribution(request):
    """API endpoint for role distribution chart data"""
    try:
        data = RoleAnalyticsService.get_role_distribution()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_permission_usage(request):
    """API endpoint for permission usage by role chart data"""
    try:
        data = RoleAnalyticsService.get_permission_usage()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_geographic_distribution(request):
    """API endpoint for geographic distribution chart data"""
    try:
        data = RoleAnalyticsService.get_geographic_distribution()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_activity_timeline(request):
    """API endpoint for activity timeline chart data"""
    try:
        data = RoleAnalyticsService.get_activity_timeline()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_permission_flags_breakdown(request):
    """API endpoint for permission flags breakdown chart data"""
    try:
        data = RoleAnalyticsService.get_permission_flags_breakdown()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_access_scope_analysis(request):
    """API endpoint for access scope analysis chart data"""
    try:
        data = RoleAnalyticsService.get_access_scope_analysis()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_status_distribution(request):
    """API endpoint for status distribution chart data"""
    try:
        data = RoleAnalyticsService.get_status_distribution()
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_admin_level(allowed_levels=['central'])
@csrf_exempt
@require_GET
def api_role_analytics_table(request):
    """API endpoint for paginated user table data (max 100 rows per call)"""
    try:
        offset = int(request.GET.get('offset', 0))
        limit = int(request.GET.get('limit', 100))
        search_query = request.GET.get('search', '').strip() or None
        role_filter = request.GET.get('role', '').strip() or None
        status_filter = request.GET.get('status', '').strip() or None
        sort_column = request.GET.get('sort_column', 'username').strip()
        sort_direction = request.GET.get('sort_direction', 'asc').strip()
        
        # Ensure limit doesn't exceed 100
        limit = min(limit, 100)
        
        # Validate sort direction
        if sort_direction not in ['asc', 'desc']:
            sort_direction = 'asc'
        
        data = RoleAnalyticsService.get_paginated_users(
            offset=offset,
            limit=limit,
            search_query=search_query,
            role_filter=role_filter,
            status_filter=status_filter,
            sort_column=sort_column,
            sort_direction=sort_direction
        )
        
        return JsonResponse({
            'success': True,
            'data': data
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

