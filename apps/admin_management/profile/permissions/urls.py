"""
Permissions URL patterns
"""

from django.urls import path
from . import views

app_name = 'profile_permissions'

urlpatterns = [
    path('', views.api_profile_permissions, name='api-profile-permissions'),
]

