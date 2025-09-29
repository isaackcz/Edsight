from django.urls import path, include
from django.shortcuts import render, redirect
from . import views
from . import admin_views
from . import form_management_views
from .views import (
    dashboard_page, form_page, auth_page, login_view, signin_page, 
    report_page, logout_view, api_dashboard_stats, api_dashboard_categories, 
    api_dashboard_completion, api_dashboard_recent_activity, 
    api_dashboard_quick_stats,
    api_form_sections, api_form_submit, api_form_answers, api_profile, api_profile_update,
    api_security_last_login, api_security_sessions, api_security_login_history,
    api_security_terminate_session, api_audit_logs, api_audit_export,
    api_analytics_data, api_analytics_date_range
)
from .controllers.user_dashboard import user_dashboard
from django.contrib import admin
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, HttpResponse

urlpatterns = [
    # Root URL - redirect to dashboard
    path('', lambda request: redirect('/dashboard/'), name='root'),
    
    # Development tools
    path("__reload__/", include("django_browser_reload.urls")),
    
    # Main pages
    path('dashboard/', dashboard_page, name='dashboard-page'),
    path('form/', form_page, name='form-page'),
    path('form-management/', form_management_views.form_management_page, name='form-management-page'),
    path('report/', report_page, name='report-page'),
    path('user-dashboard/', user_dashboard, name='user_dashboard'),
    
    # Authentication routes
    path('auth/', auth_page, name='auth-page'),
    path('auth/login/', auth_page, name='auth-login-page'),
    path('auth/signin/', signin_page, name='signin-page'),
    path('login/', login_view, name='login'),   
    path('signin/', views.signin, name='signin'),
    path('logout/', logout_view, name='logout'),
    
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
    
    # Legacy form endpoints (consider deprecating)
    path('get_categories', views.get_categories, name='get-categories'),
    path('get_sub_sections', views.get_sub_sections, name='get-sub-sections'),
    path('get_topics/<int:sub_section_id>', views.get_topics, name='get-topics'),
    path('get_questions/<int:topic_id>', views.get_questions, name='get-questions'),
    path('drafts', views.get_drafts, name='get-drafts'),
    path('save_topic', views.save_topic, name='save-topic'),
    path('question/<int:question_id>/update', views.update_question, name='update-question'),
    path('search_location/', views.search_location, name='search-location'),
    path('test-dashboard/', views.test_dashboard_direct, name='test-dashboard'),
    path('manual-login/', views.manual_login, name='manual-login'),
    
    # Dashboard API Routes
    path('api/dashboard/stats/', api_dashboard_stats, name='api_dashboard_stats'),
    path('api/dashboard/categories/', api_dashboard_categories, name='api_dashboard_categories'),
    path('api/dashboard/completion/', api_dashboard_completion, name='api_dashboard_completion'),
    path('api/dashboard/recent-activity/', api_dashboard_recent_activity, name='api_dashboard_recent_activity'),
    path('api/dashboard/quick-stats/', api_dashboard_quick_stats, name='api_dashboard_quick_stats'),
    path('api/dashboard/completion_by_region/', views.api_dashboard_completion_by_region, name='api_dashboard_completion_by_region'),
    path('api/dashboard/response_distribution/', views.api_dashboard_response_distribution, name='api_dashboard_response_distribution'),
    path('api/dashboard/forms_over_time/', views.api_dashboard_forms_over_time, name='api_dashboard_forms_over_time'),
    path('api/dashboard/top_schools/', views.api_dashboard_top_schools, name='api_dashboard_top_schools'),
    path('api/form/sections/', api_form_sections, name='api_form_sections'),
    path('api/form/answers/', api_form_answers, name='api_form_answers'),
    path('api/form/submit/', api_form_submit, name='api_form_submit'),
    path('api/profile/', api_profile, name='api_profile'),
    path('api/profile/update/', api_profile_update, name='api_profile_update'),
    
    # Security & Audit API endpoints
    path('api/security/last-login/', api_security_last_login, name='api_security_last_login'),
    path('api/security/sessions/', api_security_sessions, name='api_security_sessions'),
    path('api/security/login-history/', api_security_login_history, name='api_security_login_history'),
    path('api/security/terminate-session/<str:session_id>/', api_security_terminate_session, name='api_security_terminate_session'),
    path('api/audit/logs/', api_audit_logs, name='api_audit_logs'),
    path('api/audit/export/', api_audit_export, name='api_audit_export'),
    
    # Analytics API endpoints
    path('api/analytics/data/', api_analytics_data, name='api_analytics_data'),
    path('api/analytics/date-range/', api_analytics_date_range, name='api_analytics_date_range'),
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
    path('favicon.ico', lambda request: redirect('/static/auth/img/logo_big.png'), name='favicon'),
    

]   
urlpatterns += [
    path('api/categories/', views.get_categories, name='categories_api'),
    path('api/drafts/', views.get_drafts, name='get_drafts_api'),
    path('api/sub_sections/', views.get_sub_sections, name='sub_sections_api'),
    path('api/submit-form/', views.submit_form_session, name='submit_form'),
    path('api/get-form-state/', views.get_form_state, name='get_form_state'),
    path('api/save_topic/', views.save_topic, name='save_topic_api'),
    path('api/topics/', views.get_topics, name='get_topics_api'),
    path('api/topics/<int:topic_id>/questions/', views.get_questions, name='get_questions_api'),
    path('api/question/create/', views.create_question, name='create_question_api'),
    path('api/question/<int:question_id>/update/', views.update_question, name='update_question_api'),
    path('api/questions/<int:question_id>/', views.delete_question, name='delete_question_api'),
]