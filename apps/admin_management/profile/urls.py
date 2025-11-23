"""
Profile URL patterns - aggregates all profile section URLs
"""

from django.urls import path, include

app_name = 'admin_profile'

urlpatterns = [
    path('user-info/', include('apps.admin_management.profile.user_info.urls')),
    path('permissions/', include('apps.admin_management.profile.permissions.urls')),
    path('password/', include('apps.admin_management.profile.password.urls')),
    path('audit-log/', include('apps.admin_management.profile.audit_log.urls')),
]

