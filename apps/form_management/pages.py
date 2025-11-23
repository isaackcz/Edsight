"""
Form Management Page Views
Renders HTML templates for form management and review interfaces
"""

from django.shortcuts import render
from .utils import get_admin_scope


def form_management_page(request):
    """Standalone form management page with hierarchical view"""
    context = {
        'page_title': 'Form Management',
        'user': request.user if request.user.is_authenticated else None,
        'admin_level': request.session.get('admin_level'),
        'admin_username': request.session.get('admin_username'),
    }
    return render(request, 'form_management/form_management.html', context)


def form_review_page(request, form_id):
    """Form review page for admins to view submitted forms and add remarks"""
    admin_scope = get_admin_scope(request)
    context = {
        'page_title': 'Form Review',
        'form_id': form_id,
        'admin_level': admin_scope.get('admin_level') if admin_scope else None,
        'admin_username': admin_scope.get('username') if admin_scope else request.session.get('admin_username'),
    }
    return render(request, 'form_management/form_review.html', context)

