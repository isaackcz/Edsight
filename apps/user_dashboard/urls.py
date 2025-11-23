"""
User Dashboard URL Configuration
Separate URLs for each user dashboard page + API endpoints
"""
from django.urls import path
from . import views
from . import api_views

app_name = 'user-dashboard'

urlpatterns = [
    # Service Worker (must be before other routes to allow proper scope)
    path('service-worker.js', views.service_worker, name='service-worker'),
    
    # User Dashboard Pages
    path('', views.user_dashboard_overview, name='overview'),
    path('form/', views.user_dashboard_form, name='form'),
    path('analytics/', views.user_dashboard_analytics, name='analytics'),
    path('settings/', views.user_dashboard_settings, name='settings'),
    
    # API Endpoints for School Form System
    path('api/categories/', api_views.get_categories, name='api-categories'),
    path('api/topics/', api_views.get_topics, name='api-topics'),
    path('api/questions/', api_views.get_questions, name='api-questions'),
    path('api/save-answers/', api_views.save_answers, name='api-save-answers'),
    path('api/validate-answer/', api_views.validate_answer_endpoint, name='api-validate-answer'),
    path('api/progress/', api_views.get_progress, name='api-progress'),
    path('api/saved-answers/', api_views.get_saved_answers, name='api-saved-answers'),
    path('api/submit-form/', api_views.submit_form, name='api-submit-form'),
    path('api/cancel-submission/', api_views.cancel_submission, name='api-cancel-submission'),
    path('api/user-district/', api_views.get_user_district, name='api-user-district'),
    path('api/remarks/', api_views.get_remarks, name='api-remarks'),
    path('api/notifications/', api_views.get_notifications, name='api-notifications'),
    path('api/progress-timeline/', api_views.get_progress_timeline, name='api-progress-timeline'),
    path('api/export-data/', api_views.get_export_data, name='api-export-data'),
]

