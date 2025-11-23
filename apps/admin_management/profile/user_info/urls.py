"""
User Info URL patterns
"""

from django.urls import path
from . import views

app_name = 'profile_user_info'

urlpatterns = [
    path('', views.api_profile_user_info, name='api-profile-user-info'),
]

