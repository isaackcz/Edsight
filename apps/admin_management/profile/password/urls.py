"""
Password Change URL patterns
"""

from django.urls import path
from . import views

app_name = 'profile_password'

urlpatterns = [
    path('', views.api_profile_change_password, name='api-profile-change-password'),
]

