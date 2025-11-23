from django.urls import path, include
from django.shortcuts import render, redirect
from . import views
from apps.admin_management import views as admin_views
from apps.admin_management.role_analytics import views as role_analytics_views
from apps.admin_management.user_management_api import (
    api_user_management_stats,
    api_user_management_tree_regions,
    api_user_management_tree_divisions,
    api_user_management_tree_districts,
    api_user_management_tree_schools,
    api_user_management_table,
    api_user_management_view,
    api_user_management_view_permissions,
    api_user_management_view_audit_log,
    api_user_management_reset_password
)
from apps.admin_management.geographic_search import (
    api_search_regions,
    api_search_divisions,
    api_search_districts,
    api_search_schools,
    api_search_categories,
    api_search_topics,
)
from apps.forms import views as form_management_views
# Form Management - Modular imports from dedicated app
from apps.form_management.pages import form_management_page, form_review_page
from apps.form_management.tree_endpoints import api_regions, api_divisions, api_districts, api_admin_scope
from apps.form_management.school_endpoints import api_schools_table, api_school_forms
from apps.form_management.exports import api_export_schools, api_clear_cache
from apps.form_management.form_review import api_form_basic, api_form_categories, api_form_topics, api_form_questions
from apps.form_management.remarks import api_form_remarks, api_create_remark, api_clear_remarks, api_upsert_remark
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
    # Legacy report page - redirect to new overview
    path('report/', lambda request: redirect('/reports/overview/'), name='report-page'),
    # Report Pages
    path('reports/', views.report_overview, name='reports-overview'),
    path('reports/overview/', views.report_overview, name='reports-overview-page'),
    path('reports/workflow/', views.report_workflow, name='reports-workflow'),
    path('reports/geographic/', views.report_geographic, name='reports-geographic'),
    path('reports/deadlines/', views.report_deadlines, name='reports-deadlines'),
    path('reports/schools/', views.report_schools, name='reports-schools'),
    path('reports/admin-activity/', views.report_admin_activity, name='reports-admin-activity'),
    path('reports/security/', views.report_security, name='reports-security'),
    path('reports/category-topic/', views.report_category_topic, name='reports-category-topic'),
    # Legacy redirect
    path('report/', lambda request: redirect('/reports/overview/'), name='report-redirect'),
    
    # User Dashboard - New dedicated app with separate pages
    path('user/dashboard/', include('apps.user_dashboard.urls', namespace='user-dashboard')),
    
    # Legacy redirect for old URL
    path('user-dashboard/', lambda request: redirect('/user/dashboard/'), name='user_dashboard_legacy'),
    
    # Authentication routes
    path('auth/', views.auth_page, name='auth-page'),
    path('auth/login/', views.auth_page, name='auth-login-page'),
    path('auth/forgot-password/', views.forgot_password_page, name='forgot-password-page'),
    path('auth/forgot-password/submit/', views.forgot_password_submit, name='forgot-password-submit'),
    path('auth/signin/', views.signin_page, name='signin-page'),
    path('login/', views.login_view, name='login'),   
    path('signin/', views.signin, name='signin'),
    path('logout/', views.logout_view, name='logout'),
    
    # Admin pages - Enhanced with role-based access control
    path('admin/', admin_views.admin_page, name='admin-page'),
    path('admin/user-management/', admin_views.user_management_page, name='user-management-page'),
    path('admin/role/', role_analytics_views.role_analytics_page, name='role-analytics-page'),
    path('admin/logs/', admin_views.logs_page, name='logs-page'),
    path('admin/logs/export/', admin_views.export_logs_csv, name='export-logs-csv'),
    path('admin/settings/', admin_views.settings_page, name='settings-page'),
    path('admin/profile/', admin_views.profile_page, name='admin-profile-page'),
    
    # Admin API endpoints - New admin user system
    path('api/admin/users/', admin_views.api_admin_users, name='api-admin-users'),
    path('api/admin/users/check/', admin_views.api_check_user_exists, name='api-check-user-exists'),
    path('api/admin/users/create/', admin_views.api_create_admin_user, name='api-create-admin-user'),
    path('api/admin/users/<int:user_id>/', admin_views.api_edit_admin_user, name='api-edit-admin-user'),
    path('api/admin/users/<int:user_id>/reset-password/', admin_views.api_reset_admin_password, name='api-reset-admin-password'),
    path('api/admin/users/<int:user_id>/delete/', admin_views.api_delete_admin_user, name='api-delete-admin-user'),
    path('api/admin/users/export/', admin_views.api_export_admin_users, name='api-export-admin-users'),
    path('api/admin/deadlines/', admin_views.api_set_deadline, name='api-set-deadline'),
    path('api/admin/deadlines/<int:deadline_id>/', admin_views.api_delete_deadline, name='api-delete-deadline'),
    path('api/admin/activity-logs/', admin_views.api_activity_logs, name='api-admin-activity-logs'),
    path('api/admin/roles/create/', admin_views.api_create_role, name='api-create-role'),
    path('api/admin/roles/assign/', admin_views.api_assign_role, name='api-assign-role'),
    
    # Role Analytics API endpoints
    path('api/admin/role-analytics/stats/', role_analytics_views.api_role_analytics_stats, name='api-role-analytics-stats'),
    path('api/admin/role-analytics/charts/role-distribution/', role_analytics_views.api_role_distribution, name='api-role-distribution'),
    path('api/admin/role-analytics/charts/permissions/', role_analytics_views.api_permission_usage, name='api-permission-usage'),
    path('api/admin/role-analytics/charts/geographic/', role_analytics_views.api_geographic_distribution, name='api-geographic-distribution'),
    path('api/admin/role-analytics/charts/activity/', role_analytics_views.api_activity_timeline, name='api-activity-timeline'),
    path('api/admin/role-analytics/charts/permission-flags/', role_analytics_views.api_permission_flags_breakdown, name='api-permission-flags-breakdown'),
    path('api/admin/role-analytics/charts/access-scope/', role_analytics_views.api_access_scope_analysis, name='api-access-scope-analysis'),
    path('api/admin/role-analytics/charts/status/', role_analytics_views.api_status_distribution, name='api-status-distribution'),
    path('api/admin/role-analytics/table/', role_analytics_views.api_role_analytics_table, name='api-role-analytics-table'),
    
    # User Management API endpoints
    path('api/user-management/stats/', api_user_management_stats, name='api-user-management-stats'),
    path('api/user-management/tree/regions/', api_user_management_tree_regions, name='api-user-management-tree-regions'),
    path('api/user-management/tree/divisions/', api_user_management_tree_divisions, name='api-user-management-tree-divisions'),
    path('api/user-management/tree/districts/', api_user_management_tree_districts, name='api-user-management-tree-districts'),
    path('api/user-management/tree/schools/', api_user_management_tree_schools, name='api-user-management-tree-schools'),
    path('api/user-management/table/', api_user_management_table, name='api-user-management-table'),
    path('api/user-management/view/', api_user_management_view, name='api-user-management-view'),
    path('api/user-management/view/permissions/', api_user_management_view_permissions, name='api-user-management-view-permissions'),
    path('api/user-management/view/audit-log/', api_user_management_view_audit_log, name='api-user-management-view-audit-log'),
    path('api/user-management/reset-password/', api_user_management_reset_password, name='api-user-management-reset-password'),
    
    # Geographic Search API endpoints (for autocomplete)
    path('api/user-management/search/regions/', api_search_regions, name='api-search-regions'),
    path('api/user-management/search/divisions/', api_search_divisions, name='api-search-divisions'),
    path('api/user-management/search/districts/', api_search_districts, name='api-search-districts'),
    path('api/user-management/search/schools/', api_search_schools, name='api-search-schools'),
    
    # Category & Topic Search API endpoints (for autocomplete)
    path('api/user-management/search/categories/', api_search_categories, name='api-search-categories'),
    path('api/user-management/search/topics/', api_search_topics, name='api-search-topics'),
    
    # Dashboard API endpoints
    path('api/admin/dashboard/', include('apps.admin_management.dashboard.urls')),
    
    # Profile API endpoints
    path('api/admin/profile/', include('apps.admin_management.profile.urls')),
    
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
    path('api/form-management/admin-scope/', api_admin_scope, name='api-form-management-admin-scope'),
    path('api/form-management/regions/', api_regions, name='api-form-management-regions'),
    path('api/form-management/divisions/', api_divisions, name='api-form-management-divisions'),
    path('api/form-management/districts/', api_districts, name='api-form-management-districts'),
    path('api/form-management/schools-table/', api_schools_table, name='api-form-management-schools-table'),
    path('api/form-management/schools/<int:school_id>/forms/', api_school_forms, name='api-form-management-school-forms'),
    path('api/form-management/export-schools/', api_export_schools, name='api-form-management-export-schools'),
    path('api/form-management/clear-cache/', api_clear_cache, name='api-form-management-clear-cache'),
    
    # Form Review Page and API endpoints
    path('form-management/view/<int:form_id>/', form_review_page, name='form-review-page'),
    path('api/form-management/forms/<int:form_id>/basic/', api_form_basic, name='api-form-basic'),
    path('api/form-management/forms/<int:form_id>/categories/', api_form_categories, name='api-form-categories'),
    path('api/form-management/forms/<int:form_id>/categories/<int:category_id>/topics/', api_form_topics, name='api-form-topics'),
    path('api/form-management/forms/<int:form_id>/topics/<int:topic_id>/questions/', api_form_questions, name='api-form-questions'),
    path('api/form-management/forms/<int:form_id>/remarks/', api_form_remarks, name='api-form-remarks'),
    path('api/form-management/forms/<int:form_id>/remarks/create/', api_create_remark, name='api-create-remark'),
    path('api/form-management/forms/<int:form_id>/remarks/upsert/', api_upsert_remark, name='api-upsert-remark'),
    path('api/form-management/forms/<int:form_id>/remarks/clear/', api_clear_remarks, name='api-clear-remarks'),
    
    # Legacy Treeview API endpoints (deprecated - moved to apps/form_management/)
    # These endpoints are now handled by the modular form_management app above
    
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
    path('api/dashboard/workflow_status/', views.api_dashboard_workflow_status, name='api_dashboard_workflow_status'),
    path('api/dashboard/recent_activity/', views.api_dashboard_recent_form_activity, name='api_dashboard_recent_form_activity'),
    path('api/form/sections/', views.api_form_sections, name='api_form_sections'),
    path('api/form/answers/', views.api_form_answers, name='api_form_answers'),
    path('api/form/submit/', views.api_form_submit, name='api_form_submit'),
    path('api/profile/', views.api_profile, name='api_profile'),
    path('api/profile/update/', views.api_profile_update, name='api_profile_update'),
    path('api/security/password-change/', views.api_password_change, name='api_password_change'),
    path('api/preferences/update/', views.api_preferences_update, name='api_preferences_update'),
    path('api/audit/export/', views.api_export_audit_logs, name='api_export_audit_logs'),
    
    # Security & Audit API endpoints
    path('api/security/last-login/', views.api_security_last_login, name='api_security_last_login'),
    path('api/security/login-history/', views.api_security_login_history, name='api_security_login_history'),
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
    path('api/analytics/workflow/', views.api_analytics_workflow, name='api_analytics_workflow'),
    path('api/analytics/geographic/', views.api_analytics_geographic, name='api_analytics_geographic'),
    path('api/analytics/deadlines/', views.api_analytics_deadlines, name='api_analytics_deadlines'),
    path('api/analytics/time-series/', views.api_analytics_time_series, name='api_analytics_time_series'),
    path('api/analytics/distributions/', views.api_analytics_distributions, name='api_analytics_distributions'),
    path('api/reports/workflow-performance/', views.api_reports_workflow_performance, name='api_reports_workflow_performance'),
    path('api/reports/geographic-performance/', views.api_reports_geographic_performance, name='api_reports_geographic_performance'),
    path('api/reports/deadline-compliance/', views.api_reports_deadline_compliance, name='api_reports_deadline_compliance'),
    path('api/reports/school-performance/', views.api_reports_school_performance, name='api_reports_school_performance'),
    path('api/reports/admin-activity/', views.api_reports_admin_activity, name='api_reports_admin_activity'),
    path('api/analytics/security/', views.api_analytics_security, name='api_analytics_security'),
    path('api/reports/security-audit/', views.api_reports_security_audit, name='api_reports_security_audit'),
    path('api/reports/category-topic/', views.api_reports_category_topic, name='api_reports_category_topic'),
    path('api/analytics/hierarchical-filter-options/', views.api_hierarchical_filter_options, name='api_hierarchical_filter_options'),
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