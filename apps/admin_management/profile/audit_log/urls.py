"""
Audit Log URL patterns
"""

from django.urls import path
from . import views

app_name = 'profile_audit_log'

urlpatterns = [
    path('', views.api_profile_audit_logs, name='api-profile-audit-logs'),
]

