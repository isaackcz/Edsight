"""
User Dashboard Views
Separate views for each user dashboard page: overview, form, analytics, settings
"""
from django.shortcuts import render, redirect
from django.http import JsonResponse
from apps.core.models import AdminUser


def get_user_context(request):
    """
    Helper function to get authenticated user context.
    Returns user context dict or None if not authenticated.
    """
    # Enhanced session authentication check
    admin_id = request.session.get('admin_id')
    
    # If no admin_id, try alternative authentication methods
    if not admin_id:
        # Check if user is authenticated via Django auth (fallback)
        if request.user.is_authenticated:
            # Try to find corresponding AdminUser
            try:
                admin_user = AdminUser.objects.filter(email=request.user.email).first()
                if admin_user:
                    admin_id = admin_user.admin_id
                    # Update session
                    request.session['admin_id'] = admin_id
                    request.session['user_type'] = 'school_user' if admin_user.admin_level == 'school' else 'admin'
                    request.session['email'] = admin_user.email
                    request.session['admin_level'] = admin_user.admin_level
                    request.session.save()
            except Exception as e:
                print(f"Error finding AdminUser: {e}")
        
        # If still no admin_id, return None
        if not admin_id:
            return None
    
    try:
        # Get the AdminUser record
        admin_user = AdminUser.objects.select_related(
            'school', 'region', 'division', 'district'
        ).get(admin_id=admin_id)
        
        context = {
            'user': {
                'id': admin_user.admin_id,
                'username': admin_user.username,
                'email': admin_user.email,
                'school_name': admin_user.school.school_name if admin_user.school else admin_user.assigned_area,
                'role': admin_user.admin_level,
                'region': admin_user.region.name if admin_user.region else '',
                'division': admin_user.division.name if admin_user.division else '',
                'district': admin_user.district.name if admin_user.district else '',
                'is_authenticated': True
            },
            'admin_user': admin_user,
            'school_name': admin_user.school.school_name if admin_user.school else admin_user.assigned_area,
            'role': admin_user.admin_level,
            'full_name': admin_user.full_name,
            'assigned_area': admin_user.assigned_area,
            'admin_level': admin_user.admin_level,
            'user_type': request.session.get('user_type', 'school_user')
        }
        
        return context
        
    except AdminUser.DoesNotExist:
        return None


def user_dashboard_overview(request):
    """
    User Dashboard Overview Page
    Shows stats, recent activity, deadline tracker, quick actions
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/')
    
    # Add page-specific context
    context['active_page'] = 'overview'
    
    # TODO: Add stats data
    # context['stats'] = get_user_stats(request)
    # context['recent_activity'] = get_recent_activity(request)
    # context['deadline'] = get_submission_deadline(request)
    
    return render(request, 'user_dashboard/overview.html', context)


def user_dashboard_form(request):
    """
    User Dashboard Form Page
    Application form with tree view navigation
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/form/')
    
    # Add page-specific context
    context['active_page'] = 'form'
    
    # TODO: Add form data
    # context['form_sections'] = get_form_sections(request)
    # context['form_progress'] = get_form_progress(request)
    
    return render(request, 'user_dashboard/form.html', context)


def user_dashboard_analytics(request):
    """
    User Dashboard Analytics Page
    Charts, progress tracking, and insights
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/analytics/')
    
    # Add page-specific context
    context['active_page'] = 'analytics'
    
    # TODO: Add analytics data
    # context['progress_timeline'] = get_progress_timeline(request)
    # context['category_status'] = get_category_status(request)
    # context['completion_stats'] = get_completion_stats(request)
    
    return render(request, 'user_dashboard/analytics.html', context)


def user_dashboard_settings(request):
    """
    User Dashboard Settings Page
    Profile, security, sessions, audit logs, preferences
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/settings/')
    
    # Add page-specific context
    context['active_page'] = 'settings'
    
    # TODO: Add settings data
    # context['active_sessions'] = get_active_sessions(request)
    # context['audit_logs'] = get_audit_logs(request)
    # context['preferences'] = get_user_preferences(request)
    
    return render(request, 'user_dashboard/settings.html', context)

