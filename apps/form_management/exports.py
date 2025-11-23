"""
Form Management Export and Cache Management
Handles CSV exports and cache clearing operations
"""

import csv
import json
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.core.cache import cache
from django.utils import timezone

from apps.core.models import School, Form, AdminUser
from .utils import get_admin_scope
from apps.core.views import create_audit_log


@csrf_exempt
@require_POST
def api_export_schools(request):
    """Export schools data to CSV"""
    try:
        # Get admin scope for filtering
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_level = admin_scope['admin_level']
        
        data = json.loads(request.body)
        school_ids = data.get('school_ids', [])
        
        if not school_ids:
            return JsonResponse({
                'success': False,
                'error': 'No schools selected'
            }, status=400)
        
        # Get schools data with scope filtering
        schools_query = School.objects.filter(
            id__in=school_ids
        ).select_related('region', 'division', 'district')
        
        # Apply admin scope filtering
        if admin_level == 'district':
            schools_query = schools_query.filter(district_id=admin_scope['district_id'])
        elif admin_level == 'division':
            schools_query = schools_query.filter(division_id=admin_scope['division_id'])
        elif admin_level == 'region':
            schools_query = schools_query.filter(region_id=admin_scope['region_id'])
        # central admin sees all schools
        
        schools = schools_query.order_by('school_name')
        
        # Check if any schools were filtered out (unauthorized access attempt)
        if len(school_ids) > schools.count():
            return JsonResponse({
                'success': False,
                'error': 'Some selected schools are outside your access scope'
            }, status=403)
        
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="schools-export-{timezone.now().strftime("%Y-%m-%d")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'School ID', 'School Name', 'Region', 'Division', 'District', 
            'Total Forms', 'Submitted Forms', 'Pending Forms'
        ])
        
        for school in schools:
            # Get form statistics
            total_forms = Form.objects.filter(school=school).count()
            submitted_forms = Form.objects.filter(
                school=school, 
                status__in=['submitted', 'district_pending', 'district_approved', 
                           'division_pending', 'division_approved', 'region_pending', 
                           'region_approved', 'central_pending', 'central_approved', 'completed']
            ).count()
            pending_forms = Form.objects.filter(
                school=school,
                status__in=['district_pending', 'division_pending', 'region_pending', 'central_pending']
            ).count()
            
            writer.writerow([
                school.school_id,
                school.school_name,
                school.region.name if school.region else 'Unknown',
                school.division.name if school.division else 'Unknown',
                school.district.name if school.district else 'Unknown',
                total_forms,
                submitted_forms,
                pending_forms
            ])
        
        # Get admin user for audit logging
        admin_user_obj = None
        try:
            admin_id = request.session.get('admin_id')
            if admin_id:
                try:
                    admin_user_obj = AdminUser.objects.get(admin_id=admin_id)
                except AdminUser.DoesNotExist:
                    pass
        except Exception:
            pass

        # Create audit log for successful export
        if admin_user_obj:
            create_audit_log(
                admin_user=admin_user_obj,
                action_type='export',
                resource_type='school_export',
                description=f'Exported {len(schools)} schools data to CSV',
                request=request,
                success=True,
                metadata={
                    'school_ids': school_ids,
                    'school_count': len(schools),
                    'admin_level': admin_level
                },
                severity='low'
            )
        
        return response
        
    except Exception as e:
        # Create audit log for failed export
        admin_user_obj = None
        try:
            admin_id = request.session.get('admin_id')
            if admin_id:
                try:
                    admin_user_obj = AdminUser.objects.get(admin_id=admin_id)
                except AdminUser.DoesNotExist:
                    pass
        except Exception:
            pass

        if admin_user_obj:
            create_audit_log(
                admin_user=admin_user_obj,
                action_type='export',
                resource_type='school_export',
                description='Failed to export schools data',
                request=request,
                success=False,
                error_message=str(e),
                metadata={'error': str(e)},
                severity='medium'
            )

        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_clear_cache(request):
    """Clear cache for form management data"""
    try:
        cache_keys = [
            'form_management_regions',
            'form_management_divisions_region_*',
            'form_management_districts_division_*'
        ]
        
        # Clear specific cache keys
        cache.delete('form_management_regions')
        
        # Clear pattern-based keys (this is a simplified approach)
        # In production, you might want to use a more sophisticated cache key management
        for i in range(1, 100):  # Clear up to 100 regions/divisions/districts
            cache.delete(f'form_management_divisions_region_{i}')
            cache.delete(f'form_management_districts_division_{i}')
        
        return JsonResponse({
            'success': True,
            'message': 'Cache cleared successfully'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

