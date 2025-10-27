"""
Form Management Views
Optimized views for form management with hierarchical display
Only shows schools that have forms in the forms table
"""

from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.db import connection
from django.core.cache import cache
from django.core.paginator import Paginator
from django.utils import timezone
import csv
import json

from apps.core.models import Region, Division, District, School, Form


def form_management_page(request):
    """Standalone form management page with hierarchical view"""
    context = {
        'page_title': 'Form Management',
        'user': request.user if request.user.is_authenticated else None
    }
    return render(request, 'form_management/form_management.html', context)


@csrf_exempt
@require_GET
def api_regions(request):
    """Get regions that have schools with forms"""
    try:
        # Check cache first (cache for 10 minutes)
        cache_key = 'form_management_regions'
        cached_regions = cache.get(cache_key)
        if cached_regions:
            return JsonResponse({
                'success': True,
                'regions': cached_regions,
                'cached': True
            })
        
        with connection.cursor() as cursor:
            # Get regions that have schools with forms
            cursor.execute("""
                SELECT r.id, COALESCE(r.name, 'Unnamed Region') as name, COUNT(DISTINCT s.id) as school_count
                FROM regions r
                INNER JOIN schools s ON s.region_id = r.id
                INNER JOIN forms f ON f.school_id = s.id
                GROUP BY r.id, r.name
                HAVING COUNT(DISTINCT s.id) > 0
                ORDER BY COALESCE(r.name, 'Unnamed Region')
            """)
            
            regions = []
            for row in cursor.fetchall():
                regions.append({
                    'id': f'region-{row[0]}',
                    'name': row[1] or 'Unnamed Region',
                    'type': 'region',
                    'school_count': row[2],
                    'has_children': True
                })
        
        # Cache for 10 minutes
        cache.set(cache_key, regions, 600)
        
        return JsonResponse({
            'success': True,
            'regions': regions,
            'cached': False
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_divisions(request):
    """Get divisions for a specific region that have schools with forms"""
    try:
        region_id = request.GET.get('region_id')
        if not region_id:
            return JsonResponse({
                'success': False,
                'error': 'region_id is required'
            }, status=400)
        
        # Check cache first
        cache_key = f'form_management_divisions_region_{region_id}'
        cached_divisions = cache.get(cache_key)
        if cached_divisions:
            return JsonResponse({
                'success': True,
                'divisions': cached_divisions,
                'cached': True
            })
        
        with connection.cursor() as cursor:
            # Get divisions for this region that have schools with forms
            cursor.execute("""
                SELECT d.id, COALESCE(d.name, 'Unnamed Division') as name, COUNT(DISTINCT s.id) as school_count
                FROM divisions d
                INNER JOIN schools s ON s.division_id = d.id
                INNER JOIN forms f ON f.school_id = s.id
                WHERE d.region_id = %s
                GROUP BY d.id, d.name
                HAVING COUNT(DISTINCT s.id) > 0
                ORDER BY COALESCE(d.name, 'Unnamed Division')
            """, [region_id])
            
            divisions = []
            for row in cursor.fetchall():
                divisions.append({
                    'id': f'division-{row[0]}',
                    'name': row[1] or 'Unnamed Division',
                    'type': 'division',
                    'school_count': row[2],
                    'has_children': True
                })
        
        # Cache for 10 minutes
        cache.set(cache_key, divisions, 600)
        
        return JsonResponse({
            'success': True,
            'divisions': divisions,
            'cached': False
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_districts(request):
    """Get districts for a specific division that have schools with forms"""
    try:
        division_id = request.GET.get('division_id')
        if not division_id:
            return JsonResponse({
                'success': False,
                'error': 'division_id is required'
            }, status=400)
        
        # Check cache first
        cache_key = f'form_management_districts_division_{division_id}'
        cached_districts = cache.get(cache_key)
        if cached_districts:
            return JsonResponse({
                'success': True,
                'districts': cached_districts,
                'cached': True
            })
        
        with connection.cursor() as cursor:
            # Get districts for this division that have schools with forms
            cursor.execute("""
                SELECT dt.id, COALESCE(dt.name, 'Unnamed District') as name, COUNT(DISTINCT s.id) as school_count
                FROM districts dt
                INNER JOIN schools s ON s.district_id = dt.id
                INNER JOIN forms f ON f.school_id = s.id
                WHERE dt.division_id = %s
                GROUP BY dt.id, dt.name
                HAVING COUNT(DISTINCT s.id) > 0
                ORDER BY COALESCE(dt.name, 'Unnamed District')
            """, [division_id])
            
            districts = []
            for row in cursor.fetchall():
                districts.append({
                    'id': f'district-{row[0]}',
                    'name': row[1] or 'Unnamed District',
                    'type': 'district',
                    'school_count': row[2],
                    'has_children': True
                })
        
        # Cache for 10 minutes
        cache.set(cache_key, districts, 600)
        
        return JsonResponse({
            'success': True,
            'districts': districts,
            'cached': False
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_schools_table(request):
    """Get schools for display in MUI table with pagination"""
    try:
        # Get filter parameters
        region_id = request.GET.get('region_id')
        division_id = request.GET.get('division_id')
        district_id = request.GET.get('district_id')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        search = request.GET.get('search', '')
        
        # Build base query for schools with forms
        base_query = """
            SELECT DISTINCT s.id, COALESCE(s.school_name, 'Unnamed School') as school_name, s.school_id, 
                   COALESCE(r.name, 'Unnamed Region') as region_name, 
                   COALESCE(d.name, 'Unnamed Division') as division_name, 
                   COALESCE(dt.name, 'Unnamed District') as district_name,
                   COUNT(f.form_id) as total_forms,
                   COUNT(CASE WHEN f.status IN ('submitted', 'district_pending', 'district_approved', 
                                               'division_pending', 'division_approved', 'region_pending', 
                                               'region_approved', 'central_pending', 'central_approved', 'completed') 
                             THEN 1 END) as submitted_forms,
                   COUNT(CASE WHEN f.status IN ('district_pending', 'division_pending', 'region_pending', 'central_pending') 
                             THEN 1 END) as pending_forms
            FROM schools s
            INNER JOIN forms f ON f.school_id = s.id
            LEFT JOIN regions r ON s.region_id = r.id
            LEFT JOIN divisions d ON s.division_id = d.id
            LEFT JOIN districts dt ON s.district_id = dt.id
        """
        
        # Build WHERE conditions
        where_conditions = []
        params = []
        
        if region_id:
            where_conditions.append("s.region_id = %s")
            params.append(region_id)
        
        if division_id:
            where_conditions.append("s.division_id = %s")
            params.append(division_id)
        
        if district_id:
            where_conditions.append("s.district_id = %s")
            params.append(district_id)
        
        if search:
            where_conditions.append("(s.school_name LIKE %s OR s.school_id LIKE %s)")
            params.extend([f'%{search}%', f'%{search}%'])
        
        # Add WHERE clause if conditions exist
        if where_conditions:
            base_query += " WHERE " + " AND ".join(where_conditions)
        
        # Add GROUP BY and ORDER BY
        base_query += """
            GROUP BY s.id, s.school_name, s.school_id, r.name, d.name, dt.name
            ORDER BY COALESCE(s.school_name, 'Unnamed School')
        """
        
        # Get total count for pagination
        count_query = f"""
            SELECT COUNT(DISTINCT s.id)
            FROM schools s
            INNER JOIN forms f ON f.school_id = s.id
            LEFT JOIN regions r ON s.region_id = r.id
            LEFT JOIN divisions d ON s.division_id = d.id
            LEFT JOIN districts dt ON s.district_id = dt.id
        """
        if where_conditions:
            count_query += " WHERE " + " AND ".join(where_conditions)
        
        with connection.cursor() as cursor:
            # Get total count
            cursor.execute(count_query, params)
            total_count = cursor.fetchone()[0]
            
            # Get paginated results
            offset = (page - 1) * page_size
            paginated_query = base_query + f" LIMIT {page_size} OFFSET {offset}"
            
            cursor.execute(paginated_query, params)
            
            schools = []
            for row in cursor.fetchall():
                schools.append({
                    'id': row[0],
                    'school_name': row[1],
                    'school_id': row[2],
                    'region_name': row[3] or 'Unknown',
                    'division_name': row[4] or 'Unknown',
                    'district_name': row[5] or 'Unknown',
                    'total_forms': row[6],
                    'submitted_forms': row[7],
                    'pending_forms': row[8]
                })
        
        # Calculate pagination info
        total_pages = (total_count + page_size - 1) // page_size
        
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
def api_school_forms(request, school_id):
    """Get forms for a specific school"""
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 10))
        
        # Get school info
        school = School.objects.select_related('region', 'division', 'district').get(id=school_id)
        
        # Get forms for this school with pagination
        forms_queryset = Form.objects.filter(school_id=school_id).order_by('-created_at')
        paginator = Paginator(forms_queryset, page_size)
        forms_page = paginator.get_page(page)
        
        forms_data = []
        for form in forms_page:
            forms_data.append({
                'id': form.form_id,
                'status': form.status,
                'current_level': form.current_level,
                'submitted_date': form.submitted_at.isoformat() if form.submitted_at else None,
                'academic_year': form.academic_year,
                'form_type': form.form_type,
                'created_at': form.created_at.isoformat(),
                'updated_at': form.updated_at.isoformat(),
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


@csrf_exempt
@require_POST
def api_export_schools(request):
    """Export schools data to CSV"""
    try:
        data = json.loads(request.body)
        school_ids = data.get('school_ids', [])
        
        if not school_ids:
            return JsonResponse({
                'success': False,
                'error': 'No schools selected'
            }, status=400)
        
        # Get schools data
        schools = School.objects.filter(
            id__in=school_ids
        ).select_related('region', 'division', 'district').order_by('school_name')
        
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
        
        return response
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_clear_cache(request):
    """Clear cache for form management data"""
    try:
        # Clear all form management cache keys
        cache.delete('form_management_regions')
        
        # Clear pattern-based keys (this is a simplified approach)
        # In production, you might want to use a more sophisticated cache key management
        for i in range(1, 100):  # Clear up to 100 regions/divisions/districts
            cache.delete(f'form_management_divisions_region_{i}')
            cache.delete(f'form_management_districts_division_{i}')
        
        return JsonResponse({
            'success': True,
            'message': 'Cache cleared successfully. Please refresh the page to see updated data.'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
