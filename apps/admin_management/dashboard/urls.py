"""
Dashboard URL patterns
"""

from django.urls import path
from . import views

app_name = 'admin_dashboard'

urlpatterns = [
    path('statistics/', views.api_dashboard_statistics, name='api-dashboard-statistics'),
    path('users/', views.api_dashboard_users, name='api-dashboard-users'),
    path('activity/', views.api_dashboard_activity, name='api-dashboard-activity'),
    path('export/', views.api_dashboard_export, name='api-dashboard-export'),
]

