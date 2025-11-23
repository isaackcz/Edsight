"""
Access Control Decorators
Provides decorators for role-based access control and session management
"""

from functools import wraps
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import render, redirect


def only_school_users(view_func):
    """
    Decorator that only allows school users to access the view.
    Blocks all other admin levels.
    If user is not authenticated, clears the session to log them out.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check if user is authenticated first
        if not request.session.get('admin_id'):
            request.session.flush()
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Not authenticated', 'status': 403}, status=403)
            return redirect('/auth/login/')
        
        admin_level = request.session.get('admin_level')
        
        if admin_level != 'school':
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({
                    'error': 'Access denied. Only school users can access this resource.',
                    'status': 403
                }, status=403)
            # For pages, render 404 error page
            return render(request, 'errors/404.html', status=403)
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def only_admin_users(view_func):
    """
    Decorator that only allows non-school admin users (central, region, division, district) to access the view.
    Blocks school users.
    If user is not authenticated, clears the session to log them out.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check if user is authenticated first
        if not request.session.get('admin_id'):
            request.session.flush()
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Not authenticated', 'status': 403}, status=403)
            return redirect('/auth/login/')
        
        admin_level = request.session.get('admin_level')
        
        if admin_level == 'school':
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({
                    'error': 'Access denied. School users cannot access this resource.',
                    'status': 403
                }, status=403)
            # For pages, render 404 error page
            return render(request, 'errors/404.html', status=403)
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def session_required(view_func):
    """
    Decorator that requires a valid session with admin_id.
    Returns 403 JSON response for API endpoints, redirects to login for pages.
    If user is not authenticated, clears the session to log them out.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.session.get('admin_id'):
            # Clear session data to log out the user
            request.session.flush()
            
            # Simple check: only return JSON for explicit API paths
            # All other paths (including /dashboard/, /form/, etc.) should redirect
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Not authenticated', 'status': 403}, status=403)
            # For all page requests, redirect to login
            return redirect('/auth/login/')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def block_school_users(view_func):
    """
    Decorator that blocks school users from accessing specific endpoints.
    School users cannot access region, division, or district resources.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        admin_level = request.session.get('admin_level')
        
        if admin_level == 'school':
            # Check if this is an API endpoint
            if request.path.startswith('/api/'):
                return JsonResponse({
                    'error': 'Access denied. School users cannot access this resource.',
                    'status': 403
                }, status=403)
            # For pages, render 404 error page
            return render(request, 'errors/404.html', status=403)
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def block_non_school_users(view_func):
    """
    Decorator that blocks non-school admin levels from accessing school resources.
    Only school users can access school-specific endpoints.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        admin_level = request.session.get('admin_level')
        
        if admin_level not in ['school', None]:
            # Check if this is an API endpoint
            if request.path.startswith('/api/'):
                return JsonResponse({
                    'error': 'Access denied. Only school users can access this resource.',
                    'status': 403
                }, status=403)
            # For pages, render 404 error page
            return render(request, 'errors/404.html', status=403)
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def admin_level_required(allowed_levels):
    """
    Decorator that requires the user to have one of the specified admin levels.
    
    Args:
        allowed_levels: List of allowed admin levels (e.g., ['central', 'region'])
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            admin_level = request.session.get('admin_level')
            
            if admin_level not in allowed_levels:
                # Check if this is an API endpoint
                if request.path.startswith('/api/'):
                    return JsonResponse({
                        'error': f'Access denied. Required admin level: {", ".join(allowed_levels)}',
                        'status': 403
                    }, status=403)
                # For pages, render 404 error page
                return render(request, 'errors/404.html', status=403)
            
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def only_division_and_central(view_func):
    """
    Decorator that only allows division and central office users to access the view.
    Blocks all other admin levels including school, district, and region.
    If user is not authenticated, clears the session to log them out.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # Check if user is authenticated first
        if not request.session.get('admin_id'):
            request.session.flush()
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({'error': 'Not authenticated', 'status': 403}, status=403)
            return redirect('/auth/login/')
        
        admin_level = request.session.get('admin_level')
        
        if admin_level not in ['division', 'central']:
            # Only return JSON for explicit API paths
            if request.path.startswith('/api/'):
                return JsonResponse({
                    'error': 'Access denied. Only division and central office users can access this resource.',
                    'status': 403
                }, status=403)
            # For pages, render 404 error page
            return render(request, 'errors/404.html', status=403)
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view

