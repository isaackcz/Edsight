"""
User Dashboard URL Configuration
Separate URLs for each user dashboard page
"""
from django.urls import path
from . import views

app_name = 'user-dashboard'

urlpatterns = [
    # User Dashboard Pages
    path('', views.user_dashboard_overview, name='overview'),
    path('form/', views.user_dashboard_form, name='form'),
    path('analytics/', views.user_dashboard_analytics, name='analytics'),
    path('settings/', views.user_dashboard_settings, name='settings'),
]

