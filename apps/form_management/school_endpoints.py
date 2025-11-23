"""
Form Management School Endpoints
Handles school list table and individual school form queries
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from django.db.models import Q, Count, Subquery, OuterRef, DateTimeField, CharField
from django.db.models.functions import Coalesce
from django.core.paginator import Paginator

from apps.core.models import School, Form
from apps.core.decorators import session_required, block_non_school_users
from .utils import get_admin_scope, get_pending_workflow_statuses


@csrf_exempt
@require_GET
@session_required
@block_non_school_users
def api_schools_table(request):
    """Get schools for display in MUI table with pagination"""
    try:
        # Get admin scope for filtering
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_level = admin_scope['admin_level']
        
        # Get filter parameters
        region_id = request.GET.get('region_id')
        division_id = request.GET.get('division_id')
        district_id = request.GET.get('district_id')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        search = request.GET.get('search', '')
        
        # Build ORM query for schools with forms - optimized with select_related
        schools_queryset = School.objects.select_related('region', 'division', 'district').prefetch_related(
            'form_set'
        ).filter(
            form__isnull=False
        )
        
        # CRITICAL: Add admin scope filtering based on admin level
        if admin_level == 'district':
            schools_queryset = schools_queryset.filter(district_id=admin_scope['district_id'])
        elif admin_level == 'division':
            schools_queryset = schools_queryset.filter(division_id=admin_scope['division_id'])
        elif admin_level == 'region':
            schools_queryset = schools_queryset.filter(region_id=admin_scope['region_id'])
        # central admin sees all - no additional filtering needed
        
        # Apply user-requested filters (must be within admin scope)
        if region_id:
            # Verify the requested region is within admin scope
            if admin_level == 'region' and str(admin_scope['region_id']) != str(region_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this region'
                }, status=403)
            schools_queryset = schools_queryset.filter(region_id=region_id)
        
        if division_id:
            # Verify the requested division is within admin scope
            if admin_level == 'division' and str(admin_scope['division_id']) != str(division_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this division'
                }, status=403)
            schools_queryset = schools_queryset.filter(division_id=division_id)
        
        if district_id:
            # Verify the requested district is within admin scope
            if admin_level == 'district' and str(admin_scope['district_id']) != str(district_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this district'
                }, status=403)
            schools_queryset = schools_queryset.filter(district_id=district_id)
        
        if search:
            schools_queryset = schools_queryset.filter(
                Q(school_name__icontains=search) | Q(school_id__icontains=search)
            )
        
        # Determine workflow statuses relevant for this admin level
        workflow_statuses = get_pending_workflow_statuses(admin_level)
        if workflow_statuses:
            relevant_statuses = workflow_statuses
        else:
            # Fallback to union of statuses that indicate pending/returned along the chain
            relevant_statuses = (
                'district_pending',
                'division_returned',
                'division_pending',
                'region_returned',
                'region_pending',
                'central_returned',
                'central_pending',
            )
        
        # Annotate with form statistics
        submitted_statuses = [
            'submitted',
            'district_pending',
            'district_approved',
            'division_pending',
            'division_approved',
            'region_pending',
            'region_approved',
            'central_pending',
            'central_approved',
            'completed',
        ]
        include_completed_latest = admin_level == 'central'
        
        latest_any_form = Form.objects.filter(
            school_id=OuterRef('id')
        ).order_by('-submitted_at', '-created_at')
        
        latest_any_status_subquery = Subquery(
            latest_any_form.values('workflow_status')[:1],
            output_field=CharField()
        )
        latest_any_submitted_subquery = Subquery(
            latest_any_form.values('submitted_at')[:1],
            output_field=DateTimeField()
        )
        latest_any_created_subquery = Subquery(
            latest_any_form.values('created_at')[:1],
            output_field=DateTimeField()
        )
        
        annotations = {
            'total_forms': Count('form', distinct=True),
            'submitted_forms': Count('form', filter=Q(form__workflow_status__in=submitted_statuses), distinct=True),
            'pending_forms': Count('form', filter=Q(form__workflow_status__in=relevant_statuses), distinct=True),
        }
        
        latest_status_expression = latest_any_status_subquery
        latest_submitted_expression = Coalesce(
            latest_any_submitted_subquery,
            latest_any_created_subquery,
            output_field=DateTimeField()
        )
        
        if workflow_statuses:
            latest_relevant_form = Form.objects.filter(
                school_id=OuterRef('id'),
                workflow_status__in=workflow_statuses
            ).order_by('-submitted_at', '-created_at')
            
            latest_relevant_status = Subquery(
                latest_relevant_form.values('workflow_status')[:1],
                output_field=CharField()
            )
            latest_relevant_submitted = Subquery(
                latest_relevant_form.values('submitted_at')[:1],
                output_field=DateTimeField()
            )
            latest_relevant_created = Subquery(
                latest_relevant_form.values('created_at')[:1],
                output_field=DateTimeField()
            )
            
            latest_status_expression = Coalesce(
                latest_relevant_status,
                latest_any_status_subquery,
                output_field=CharField()
            )
            latest_submitted_expression = Coalesce(
                latest_relevant_submitted,
                latest_relevant_created,
                latest_any_submitted_subquery,
                latest_any_created_subquery,
                output_field=DateTimeField()
            )
        elif include_completed_latest:
            latest_completed_form = Form.objects.filter(
                school_id=OuterRef('id'),
                workflow_status='completed'
            ).order_by('-submitted_at', '-created_at')
            latest_completed_status = Subquery(
                latest_completed_form.values('workflow_status')[:1],
                output_field=CharField()
            )
            latest_completed_submitted = Subquery(
                latest_completed_form.values('submitted_at')[:1],
                output_field=DateTimeField()
            )
            latest_completed_created = Subquery(
                latest_completed_form.values('created_at')[:1],
                output_field=DateTimeField()
            )

            latest_status_expression = Coalesce(
                latest_completed_status,
                latest_any_status_subquery,
                output_field=CharField()
            )
            latest_submitted_expression = Coalesce(
                latest_completed_submitted,
                latest_completed_created,
                latest_any_submitted_subquery,
                latest_any_created_subquery,
                output_field=DateTimeField()
            )
        
        schools_queryset = schools_queryset.annotate(
            **annotations,
            latest_workflow_status=latest_status_expression,
            latest_submitted_at=latest_submitted_expression,
        )

        if admin_level == 'central':
            schools_queryset = schools_queryset.filter(
                Q(pending_forms__gt=0) | Q(latest_workflow_status='completed')
            )
        else:
            schools_queryset = schools_queryset.filter(
                pending_forms__gt=0
            )

        schools_queryset = schools_queryset.order_by('school_name')
        
        # Get total count for pagination
        total_count = schools_queryset.count()
        
        # Apply pagination
        paginator = Paginator(schools_queryset, page_size)
        schools_page = paginator.get_page(page)
        
        schools = []
        for school in schools_page:
            schools.append({
                'id': school.id,
                'school_name': school.school_name,
                'school_id': school.school_id,
                'region_name': school.region.name if school.region else 'Unknown',
                'division_name': school.division.name if school.division else 'Unknown',
                'district_name': school.district.name if school.district else 'Unknown',
                'total_forms': school.total_forms,
                'submitted_forms': school.submitted_forms,
                'pending_forms': school.pending_forms,
                'workflow_status': school.latest_workflow_status,
                'submitted_at': school.latest_submitted_at.isoformat() if school.latest_submitted_at else None,
            })
        
        # Calculate pagination info
        total_pages = paginator.num_pages
        
        return JsonResponse({
            'success': True,
            'schools': schools,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_schools': total_count,
                'page_size': page_size,
                'has_next': page < total_pages,
                'has_previous': page > 1
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
@session_required
@block_non_school_users
def api_school_forms(request, school_id):
    """Get forms for a specific school"""
    try:
        # Get admin scope for permission checking
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_level = admin_scope['admin_level']
        
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        
        # Get school info
        school = School.objects.select_related('region', 'division', 'district').get(id=school_id)
        
        # Verify admin has access to this school
        if admin_level == 'district':
            if school.district_id != admin_scope['district_id']:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this school'
                }, status=403)
        elif admin_level == 'division':
            if school.division_id != admin_scope['division_id']:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this school'
                }, status=403)
        elif admin_level == 'region':
            if school.region_id != admin_scope['region_id']:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this school'
                }, status=403)
        # central admin has access to all schools
        
        # Get forms for this school with pagination, limited to pending statuses for this admin level
        pending_statuses = get_pending_workflow_statuses(admin_level)
        forms_queryset = Form.objects.filter(school_id=school_id)

        if pending_statuses:
            forms_queryset = forms_queryset.filter(workflow_status__in=pending_statuses)
        else:
            forms_queryset = forms_queryset.none()

        forms_queryset = forms_queryset.order_by('-created_at')
        paginator = Paginator(forms_queryset, page_size)
        forms_page = paginator.get_page(page)
        
        forms_data = []
        for form in forms_page:
            forms_data.append({
                'id': form.form_id,
                'status': form.status,
                'workflow_status': form.workflow_status,
                'current_level': form.current_level,
                'submitted_date': form.submitted_at.isoformat() if form.submitted_at else None,
                'academic_year': form.academic_year,
                'form_type': form.form_type,
                'created_at': form.created_at.isoformat(),
                'updated_at': form.updated_at.isoformat(),
                'school_name': school.school_name,
                'school_id': school.school_id,
            })
        
        return JsonResponse({
            'success': True,
            'school': {
                'id': school.id,
                'school_name': school.school_name,
                'school_id': school.school_id,
                'region_name': school.region.name if school.region else 'Unknown',
                'division_name': school.division.name if school.division else 'Unknown',
                'district_name': school.district.name if school.district else 'Unknown',
            },
            'forms': forms_data,
            'pagination': {
                'current_page': forms_page.number,
                'total_pages': paginator.num_pages,
                'total_forms': paginator.count,
                'page_size': page_size,
                'has_next': forms_page.has_next(),
                'has_previous': forms_page.has_previous()
            }
        })
        
    except School.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'School not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

