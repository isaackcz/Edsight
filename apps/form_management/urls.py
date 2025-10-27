from django.urls import path
from . import views

app_name = 'form_management'

urlpatterns = [
    # Main page
    path('', views.form_management_page, name='form_management_page'),
    
    # API endpoints
    path('api/regions/', views.api_regions, name='api_regions'),
    path('api/divisions/', views.api_divisions, name='api_divisions'),
    path('api/districts/', views.api_districts, name='api_districts'),
    path('api/schools/', views.api_schools_table, name='api_schools_table'),
    path('api/schools/<int:school_id>/forms/', views.api_school_forms, name='api_school_forms'),
    path('api/export/schools/', views.api_export_schools, name='api_export_schools'),
    path('api/clear-cache/', views.api_clear_cache, name='api_clear_cache'),
]
