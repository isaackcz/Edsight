from django.urls import path, include
from django.shortcuts import render, redirect
from . import views
from apps.admin_management import views as admin_views
from apps.forms import views as form_management_views
from apps.forms.form_management_views import (
    form_management_page,
    api_regions,
    api_divisions,
    api_districts,
    api_schools_table,
    api_school_forms,
    api_export_schools,
    api_clear_cache
)
from apps.analytics import services as analytics_service
from apps.security import views as security_views
# Removed old user_dashboard import - now using dedicated app
# from .controllers.user_dashboard import user_dashboard
from django.contrib import admin
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Root URL - redirect to dashboard
    path('', lambda request: redirect('/dashboard/'), name='root'),
    
    # Development tools
    path("__reload__/", include("django_browser_reload.urls")),
    
    # Main pages
    path('dashboard/', views.dashboard_page, name='dashboard-page'),
    path('form/', views.form_page, name='form-page'),
    path('form-management/', form_management_page, name='form-management-page'),
    path('report/', views.report_page, name='report-page'),
    path('reports/', lambda request: redirect('/report/'), name='reports-redirect'),  # Redirect plural to singular
    
    # User Dashboard - New dedicated app with separate pages
    path('user/dashboard/', include('apps.user_dashboard.urls', namespace='user-dashboard')),
    
    # Legacy redirect for old URL
    path('user-dashboard/', lambda request: redirect('/user/dashboard/'), name='user_dashboard_legacy'),
    
    # Authentication routes
    path('auth/', views.auth_page, name='auth-page'),
    path('auth/login/', views.auth_page, name='auth-login-page'),
    path('auth/signin/', views.signin_page, name='signin-page'),
    path('login/', views.login_view, name='login'),   
    path('signin/', views.signin, name='signin'),
    path('logout/', views.logout_view, name='logout'),
    
    # Admin pages - Enhanced with role-based access control
    path('admin/', admin_views.admin_page, name='admin-page'),
    path('admin/user-management/', admin_views.user_management_page, name='user-management-page'),
    path('admin/role/', admin_views.role_page, name='role-page'),
    path('admin/logs/', admin_views.logs_page, name='logs-page'),
    path('admin/logs/export/', admin_views.export_logs_csv, name='export-logs-csv'),
    path('admin/settings/', admin_views.settings_page, name='settings-page'),
    
    # Admin API endpoints - New admin user system
    path('api/admin/users/', admin_views.api_admin_users, name='api-admin-users'),
    path('api/admin/users/create/', admin_views.api_create_admin_user, name='api-create-admin-user'),
    path('api/admin/users/<int:user_id>/', admin_views.api_edit_admin_user, name='api-edit-admin-user'),
    path('api/admin/users/<int:user_id>/reset-password/', admin_views.api_reset_admin_password, name='api-reset-admin-password'),
    path('api/admin/users/<int:user_id>/delete/', admin_views.api_delete_admin_user, name='api-delete-admin-user'),
    path('api/admin/users/export/', admin_views.api_export_admin_users, name='api-export-admin-users'),
    path('api/admin/deadlines/', admin_views.api_set_deadline, name='api-set-deadline'),
    path('api/admin/activity-logs/', admin_views.api_activity_logs, name='api-admin-activity-logs'),
    path('api/admin/roles/create/', admin_views.api_create_role, name='api-create-role'),
    path('api/admin/roles/assign/', admin_views.api_assign_role, name='api-assign-role'),
    path('api/geographic-data/<str:data_type>/', views.api_geographic_data, name='api-geographic-data'),
    path('api/schools/search/', views.api_schools_search, name='api-schools-search'),
    
    # Form Management API endpoints
    path('api/admin/form-management/user-info/', form_management_views.api_user_info, name='api-form-management-user-info'),
    path('api/admin/form-management/statistics/', form_management_views.api_statistics, name='api-form-management-statistics'),
    path('api/admin/form-management/forms/', form_management_views.api_forms, name='api-form-management-forms'),
    path('api/admin/form-management/forms/<int:form_id>/', form_management_views.api_form_detail, name='api-form-management-form-detail'),
    path('api/admin/form-management/forms/<int:form_id>/approve/', form_management_views.api_approve_form, name='api-form-management-approve-form'),
    path('api/admin/form-management/forms/<int:form_id>/return/', form_management_views.api_return_form, name='api-form-management-return-form'),
    path('api/admin/form-management/bulk-approve/', form_management_views.api_bulk_approve, name='api-form-management-bulk-approve'),
    path('api/admin/form-management/bulk-return/', form_management_views.api_bulk_return, name='api-form-management-bulk-return'),
    path('api/admin/form-management/export/', form_management_views.api_export_forms, name='api-form-management-export'),
    path('api/admin/form-management/notifications/', form_management_views.api_notifications, name='api-form-management-notifications'),
    
    # New optimized form management API endpoints
    path('api/form-management/regions/', api_regions, name='api-form-management-regions'),
    path('api/form-management/divisions/', api_divisions, name='api-form-management-divisions'),
    path('api/form-management/districts/', api_districts, name='api-form-management-districts'),
    path('api/form-management/schools-table/', api_schools_table, name='api-form-management-schools-table'),
    path('api/form-management/schools/<int:school_id>/forms/', api_school_forms, name='api-form-management-school-forms'),
    path('api/form-management/export-schools/', api_export_schools, name='api-form-management-export-schools'),
    path('api/form-management/clear-cache/', api_clear_cache, name='api-form-management-clear-cache'),
    
    # Legacy Treeview API endpoints (deprecated - moved to form_management_views.py)
    # These endpoints are now handled by the new optimized endpoints above
    
    # Geographic data API endpoints for hierarchical loading
    path('api/admin/form-management/geographic-data/regions/', admin_views.api_geographic_data, {'data_type': 'regions'}, name='api-form-management-regions'),
    path('api/admin/form-management/geographic-data/divisions/', admin_views.api_geographic_data, {'data_type': 'divisions'}, name='api-form-management-divisions'),
    path('api/admin/form-management/geographic-data/districts/', admin_views.api_geographic_data, {'data_type': 'districts'}, name='api-form-management-districts'),
    path('api/admin/form-management/geographic-data/schools/', admin_views.api_geographic_data, {'data_type': 'schools'}, name='api-form-management-schools-geographic'),
    
    # Legacy form endpoints (consider deprecating)
    path('get_categories', views.get_categories, name='get-categories'),
    # Sub-sections removed
    path('get_topics/<int:category_id>', views.get_topics, name='get-topics'),
    path('get_questions/<int:topic_id>', views.get_questions, name='get-questions'),
    path('drafts', views.get_drafts, name='get-drafts'),
    path('save_topic', views.save_topic, name='save-topic'),
    path('question/<int:question_id>/update', views.update_question, name='update-question'),
    path('search_location/', views.search_location, name='search-location'),
    path('test-dashboard/', views.test_dashboard_direct, name='test-dashboard'),
    path('manual-login/', views.manual_login, name='manual-login'),
    
    # Dashboard API Routes
    path('api/dashboard/stats/', views.api_dashboard_stats, name='api_dashboard_stats'),
    path('api/dashboard/categories/', views.api_dashboard_categories, name='api_dashboard_categories'),
    path('api/dashboard/completion/', views.api_dashboard_completion, name='api_dashboard_completion'),
    path('api/dashboard/recent-activity/', views.api_dashboard_recent_activity, name='api_dashboard_recent_activity'),
    path('api/dashboard/quick-stats/', views.api_dashboard_quick_stats, name='api_dashboard_quick_stats'),
    path('api/dashboard/completion_by_region/', views.api_dashboard_completion_by_region, name='api_dashboard_completion_by_region'),
    path('api/dashboard/response_distribution/', views.api_dashboard_response_distribution, name='api_dashboard_response_distribution'),
    path('api/dashboard/forms_over_time/', views.api_dashboard_forms_over_time, name='api_dashboard_forms_over_time'),
    path('api/dashboard/top_schools/', views.api_dashboard_top_schools, name='api_dashboard_top_schools'),
    path('api/form/sections/', views.api_form_sections, name='api_form_sections'),
    path('api/form/answers/', views.api_form_answers, name='api_form_answers'),
    path('api/form/submit/', views.api_form_submit, name='api_form_submit'),
    path('api/profile/', views.api_profile, name='api_profile'),
    path('api/profile/update/', views.api_profile_update, name='api_profile_update'),
    
    # Security & Audit API endpoints
    path('api/security/last-login/', views.api_security_last_login, name='api_security_last_login'),
    path('api/security/sessions/', views.api_security_sessions, name='api_security_sessions'),
    path('api/security/login-history/', views.api_security_login_history, name='api_security_login_history'),
    path('api/security/terminate-session/<str:session_id>/', views.api_security_terminate_session, name='api_security_terminate_session'),
    path('api/audit/logs/', views.api_audit_logs, name='api_audit_logs'),
    path('api/audit/export/', views.api_audit_export, name='api_audit_export'),
    
    # Analytics API endpoints
    path('api/analytics/data/', views.api_analytics_data, name='api_analytics_data'),
    path('api/analytics/date-range/', views.api_analytics_date_range, name='api_analytics_date_range'),
    path('api/analytics/test/', views.api_analytics_test, name='api_analytics_test'),
    path('api/analytics/simple/', views.api_analytics_simple, name='api_analytics_simple'),
    path('api/analytics/bundle/', views.api_analytics_bundle, name='api_analytics_bundle'),
    path('api/analytics/drilldown/', views.api_analytics_drilldown, name='api_analytics_drilldown'),
    path('api/analytics/filter-options/', views.api_analytics_filter_options, name='api_analytics_filter_options'),
    path('api/analytics/hierarchical-filter-options/', views.api_hierarchical_filter_options, name='api_hierarchical_filter_options'),
    path('api/reports/school-completion/', views.api_reports_school_completion, name='api_reports_school_completion'),
    path('api/reports/category-content/', views.api_reports_category_content, name='api_reports_category_content'),
    path('api/exports/csv/', views.api_export_csv, name='api_export_csv'),
    path('api/exports/xlsx/', views.api_export_bundle_xlsx, name='api_export_bundle_xlsx'),
    path('api/exports/drilldown/csv/', views.api_export_drilldown_csv, name='api_export_drilldown_csv'),
    path('api/exports/drilldown/xlsx/', views.api_export_drilldown_xlsx, name='api_export_drilldown_xlsx'),
    path('api/presets/', views.api_presets, name='api_presets'),
    path('api/filters/options/', views.api_filters_options, name='api_filters_options'),
    
    path('test-dashboard/', lambda request: render(request, 'test_dashboard.html'), name='test_dashboard'),
    path('test-audit/', lambda request: HttpResponse(open('test_audit_logs.html').read(), content_type='text/html'), name='test_audit'),
    
    # Static file routes
    path('favicon.ico', lambda request: redirect('/static/components/auth/img/logo_big.png'), name='favicon'),
    

]   
urlpatterns += [
    path('api/categories/', views.get_categories, name='categories_api'),
    path('api/drafts/', views.get_drafts, name='get_drafts_api'),
    path('api/submit-form/', views.submit_form_session, name='submit_form'),
    path('api/get-form-state/', views.get_form_state, name='get_form_state'),
    path('api/save_topic/', views.save_topic, name='save_topic_api'),
    path('api/topics/', views.get_topics, name='get_topics_api'),
    path('api/topics/<int:topic_id>/questions/', views.get_questions, name='get_questions_api'),
    path('api/question/create/', views.create_question, name='create_question_api'),
    path('api/question/<int:question_id>/update/', views.update_question, name='update_question_api'),
    path('api/question/<int:question_id>/', views.get_question, name='get_question_api'),
    path('api/questions/<int:question_id>/', views.delete_question, name='delete_question_api'),
    path('api/category/create/', views.create_category, name='create_category_api'),
    path('api/category/<int:category_id>/update/', views.update_category, name='update_category_api'),
    path('api/category/<int:category_id>/delete/', views.delete_category, name='delete_category_api'),
    # Subsection create removed
    path('api/topic/create/', views.create_topic, name='create_topic_api'),
    path('api/topic/<int:topic_id>/update/', views.update_topic, name='update_topic_api'),
    path('api/topic/<int:topic_id>/delete/', views.delete_topic, name='delete_topic_api'),
]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)