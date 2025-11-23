from django.urls import path
from .pages import form_management_page, form_review_page
from .tree_endpoints import api_regions, api_divisions, api_districts, api_admin_scope
from .school_endpoints import api_schools_table, api_school_forms
from .exports import api_export_schools, api_clear_cache
from .form_review import api_form_basic, api_form_categories, api_form_topics, api_form_questions
from .remarks import api_form_remarks, api_create_remark, api_clear_remarks, api_upsert_remark

app_name = 'form_management'

urlpatterns = [
    # Main page
    path('', form_management_page, name='form_management_page'),
    
    # Form review page
    path('view/<int:form_id>/', form_review_page, name='form_review_page'),
    
    # API endpoints - Tree navigation
    path('api/admin-scope/', api_admin_scope, name='api_admin_scope'),
    path('api/regions/', api_regions, name='api_regions'),
    path('api/divisions/', api_divisions, name='api_divisions'),
    path('api/districts/', api_districts, name='api_districts'),
    
    # API endpoints - Schools
    path('api/schools/', api_schools_table, name='api_schools_table'),
    path('api/schools/<int:school_id>/forms/', api_school_forms, name='api_school_forms'),
    
    # API endpoints - Exports and cache
    path('api/export/schools/', api_export_schools, name='api_export_schools'),
    path('api/clear-cache/', api_clear_cache, name='api_clear_cache'),
    
    # API endpoints - Form review
    path('api/forms/<int:form_id>/basic/', api_form_basic, name='api_form_basic'),
    path('api/forms/<int:form_id>/categories/', api_form_categories, name='api_form_categories'),
    path('api/forms/<int:form_id>/categories/<int:category_id>/topics/', api_form_topics, name='api_form_topics'),
    path('api/forms/<int:form_id>/topics/<int:topic_id>/questions/', api_form_questions, name='api_form_questions'),
    
    # API endpoints - Remarks
    path('api/forms/<int:form_id>/remarks/', api_form_remarks, name='api_form_remarks'),
    path('api/forms/<int:form_id>/remarks/create/', api_create_remark, name='api_create_remark'),
    path('api/forms/<int:form_id>/remarks/upsert/', api_upsert_remark, name='api_upsert_remark'),
    path('api/forms/<int:form_id>/remarks/clear/', api_clear_remarks, name='api_clear_remarks'),
]
