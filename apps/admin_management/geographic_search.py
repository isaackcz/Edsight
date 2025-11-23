"""
Geographic search API endpoints for autocomplete functionality
Uses Django ORM exclusively - no raw SQL
"""

from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q

from apps.core.models import Region, Division, District, School, Category, Topic
from apps.admin_management.views import get_admin_division_filter


@csrf_exempt
@require_GET
def api_search_regions(request):
    """Search regions by name - returns max 5 results"""
    try:
        q = request.GET.get('q', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        
        # Use Django ORM with icontains for case-insensitive search
        regions_query = Region.objects.filter(name__icontains=q)
        
        # For division-level admins, only show their own region
        if division_id:
            try:
                division = Division.objects.get(id=division_id)
                regions_query = regions_query.filter(id=division.region_id)
            except Division.DoesNotExist:
                regions_query = Region.objects.none()
        
        regions = regions_query.values('id', 'name')[:5]
        
        results = [{'id': r['id'], 'name': r['name']} for r in regions]
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_search_divisions(request):
    """Search divisions by name - returns max 5 results. Can filter by region_id."""
    try:
        q = request.GET.get('q', '').strip()
        region_id = request.GET.get('region_id', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Use Django ORM with icontains for case-insensitive search
        divisions_query = Division.objects.filter(name__icontains=q)
        
        # Filter by region if provided
        if region_id:
            try:
                region_id_int = int(region_id)
                divisions_query = divisions_query.filter(region_id=region_id_int)
                # Verify division-level admin can only access their own region
                if admin_division_id:
                    try:
                        division = Division.objects.get(id=admin_division_id)
                        if division.region_id != region_id_int:
                            return JsonResponse({'results': []})
                    except Division.DoesNotExist:
                        return JsonResponse({'results': []})
            except (ValueError, TypeError):
                pass
        
        # For division-level admins, only show their own division
        if admin_division_id:
            divisions_query = divisions_query.filter(id=admin_division_id)
        
        divisions = divisions_query.values('id', 'name')[:5]
        
        results = [{'id': d['id'], 'name': d['name']} for d in divisions]
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_search_districts(request):
    """Search districts by name - returns max 5 results. Can filter by division_id."""
    try:
        q = request.GET.get('q', '').strip()
        division_id = request.GET.get('division_id', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Use Django ORM with icontains for case-insensitive search
        districts_query = District.objects.filter(name__icontains=q)
        
        # Filter by division if provided
        if division_id:
            try:
                division_id_int = int(division_id)
                districts_query = districts_query.filter(division_id=division_id_int)
                # Verify division-level admin can only access their own division
                if admin_division_id and admin_division_id != division_id_int:
                    return JsonResponse({'results': []})
            except (ValueError, TypeError):
                pass
        
        # For division-level admins, only show districts in their division
        if admin_division_id:
            districts_query = districts_query.filter(division_id=admin_division_id)
        
        districts = districts_query.values('id', 'name')[:5]
        
        results = [{'id': d['id'], 'name': d['name']} for d in districts]
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_search_schools(request):
    """Search schools by school_id or school_name - returns max 5 results with parent geographic data"""
    try:
        q = request.GET.get('q', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Use Django ORM with Q objects for OR search, include parent relationships
        schools_query = School.objects.filter(
            Q(school_id__icontains=q) | Q(school_name__icontains=q)
        ).select_related('region', 'division', 'district')
        
        # For division-level admins, only show schools in their division
        if admin_division_id:
            schools_query = schools_query.filter(division_id=admin_division_id)
        
        schools = schools_query[:5]
        
        results = []
        for school in schools:
            results.append({
                'id': school.id,
                'school_id': school.school_id,
                'school_name': school.school_name,
                'region_id': school.region_id,
                'region_name': school.region.name if school.region else None,
                'division_id': school.division_id,
                'division_name': school.division.name if school.division else None,
                'district_id': school.district_id,
                'district_name': school.district.name if school.district else None
            })
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_search_categories(request):
    """Search categories by name - returns max 5 results"""
    try:
        q = request.GET.get('q', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Use Django ORM with icontains for case-insensitive search
        categories = Category.objects.filter(
            name__icontains=q
        ).values('category_id', 'name')[:5]
        
        results = [{'id': c['category_id'], 'name': c['name']} for c in categories]
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_search_topics(request):
    """Search topics by name - returns max 5 results. Can filter by category_id."""
    try:
        q = request.GET.get('q', '').strip()
        category_id = request.GET.get('category_id', '').strip()
        
        if not q:
            return JsonResponse({'results': []})
        
        # Use Django ORM with icontains for case-insensitive search
        topics = Topic.objects.filter(name__icontains=q)
        
        # Filter by category if provided
        if category_id:
            try:
                category_id_int = int(category_id)
                topics = topics.filter(category_id=category_id_int)
            except (ValueError, TypeError):
                pass
        
        topics = topics.values('topic_id', 'name')[:5]
        
        results = [{'id': t['topic_id'], 'name': t['name']} for t in topics]
        
        return JsonResponse({'results': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
