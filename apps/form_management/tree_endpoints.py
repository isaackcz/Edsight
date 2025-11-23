"""
Form Management Tree Endpoints
Handles hierarchical region/division/district tree navigation APIs
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from django.db.models import Count, Q
from django.core.cache import cache

from apps.core.models import Region, Division, District
from .utils import get_admin_scope, get_pending_workflow_statuses


@csrf_exempt
@require_GET
def api_regions(request):
    """Get regions that have schools with forms"""
    try:
        # Get admin scope for filtering
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_id = admin_scope['admin_id']
        admin_level = admin_scope['admin_level']
        
        statuses = get_pending_workflow_statuses(admin_level)
        if not statuses:
            cache_key = f'form_management_regions_admin_{admin_id}'
            cache.set(cache_key, [], 600)
            return JsonResponse({
                'success': True,
                'regions': [],
                'cached': False
            })
        
        # Check cache first (cache for 10 minutes) - include admin_id in cache key
        cache_key = f'form_management_regions_admin_{admin_id}'
        cached_regions = cache.get(cache_key)
        if cached_regions:
            return JsonResponse({
                'success': True,
                'regions': cached_regions,
                'cached': True
            })
        
        scope_filter = Q()
        region_queryset = Region.objects.all()
        
        if admin_level == 'central':
            pass
        elif admin_level == 'region':
            region_id = admin_scope.get('region_id')
            if not region_id:
                cache.set(cache_key, [], 600)
                return JsonResponse({
                    'success': True,
                    'regions': [],
                    'cached': False
                })
            scope_filter &= Q(school__region_id=region_id)
            region_queryset = region_queryset.filter(id=region_id)
        elif admin_level == 'division':
            division_id = admin_scope.get('division_id')
            region_id = admin_scope.get('region_id')
            if not division_id or not region_id:
                cache.set(cache_key, [], 600)
                return JsonResponse({
                    'success': True,
                    'regions': [],
                    'cached': False
                })
            scope_filter &= Q(school__division_id=division_id)
            region_queryset = region_queryset.filter(id=region_id)
        elif admin_level == 'district':
            district_id = admin_scope.get('district_id')
            region_id = admin_scope.get('region_id')
            if not district_id or not region_id:
                cache.set(cache_key, [], 600)
                return JsonResponse({
                    'success': True,
                    'regions': [],
                    'cached': False
                })
            scope_filter &= Q(school__district_id=district_id)
            region_queryset = region_queryset.filter(id=region_id)
        else:
            cache.set(cache_key, [], 600)
            return JsonResponse({
                'success': True,
                'regions': [],
                'cached': False
            })
        
        pending_filter = scope_filter & Q(school__form__workflow_status__in=statuses)
        region_queryset = region_queryset.prefetch_related('school_set__form_set').annotate(
            pending_school_count=Count('school__id', filter=pending_filter, distinct=True)
        ).filter(
            pending_school_count__gt=0
        ).order_by('name')
        
        regions = [
            {
                'id': f'region-{region.id}',
                'name': region.name,
                'type': 'region',
                'school_count': region.pending_school_count,
                'has_children': True
            }
            for region in region_queryset
        ]
        
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
        # Get admin scope for filtering
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_id = admin_scope['admin_id']
        admin_level = admin_scope['admin_level']
        
        region_id = request.GET.get('region_id')
        if not region_id:
            return JsonResponse({
                'success': False,
                'error': 'region_id is required'
            }, status=400)
        
        # Verify admin has access to the requested region
        admin_region_id = admin_scope.get('region_id')
        if admin_level != 'central' and str(admin_region_id) != str(region_id):
            return JsonResponse({
                'success': False,
                'error': 'Access denied to this region'
            }, status=403)
        
        # Check cache first - include admin_id in cache key
        cache_key = f'form_management_divisions_region_{region_id}_admin_{admin_id}'
        cached_divisions = cache.get(cache_key)
        if cached_divisions:
            return JsonResponse({
                'success': True,
                'divisions': cached_divisions,
                'cached': True
            })
        
        # Build ORM query based on admin level
        division_queryset = Division.objects.filter(region_id=region_id)
        
        if admin_level not in ['central', 'region']:
            # Division and district admins see only their division
            division_id = admin_scope.get('division_id')
            if not division_id:
                return JsonResponse({
                    'success': True,
                    'divisions': []
                })
            division_queryset = division_queryset.filter(id=division_id)
        
        # Annotate with school count (schools that have submitted forms) - optimized with prefetch
        division_queryset = division_queryset.prefetch_related('school_set__form_set').annotate(
            school_count=Count('school__id', filter=Q(school__form__isnull=False), distinct=True)
        ).filter(
            school_count__gt=0
        ).order_by('name')
        
        divisions = [
            {
                'id': f'division-{division.id}',
                'name': division.name,
                'type': 'division',
                'school_count': division.school_count,
                'has_children': True
            }
            for division in division_queryset
        ]
        
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
        # Get admin scope for filtering
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_id = admin_scope['admin_id']
        admin_level = admin_scope['admin_level']
        
        division_id = request.GET.get('division_id')
        if not division_id:
            return JsonResponse({
                'success': False,
                'error': 'division_id is required'
            }, status=400)
        
        # Verify admin has access to the requested division
        admin_division_id = admin_scope.get('division_id')
        if admin_level == 'division' and str(admin_division_id) != str(division_id):
            return JsonResponse({
                'success': False,
                'error': 'Access denied to this division'
            }, status=403)
        elif admin_level == 'district':
            # District admins must request their own division
            if str(admin_division_id) != str(division_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this division'
                }, status=403)
        
        # Check cache first - include admin_id in cache key
        cache_key = f'form_management_districts_division_{division_id}_admin_{admin_id}'
        cached_districts = cache.get(cache_key)
        if cached_districts:
            return JsonResponse({
                'success': True,
                'districts': cached_districts,
                'cached': True
            })
        
        # Build ORM query based on admin level
        district_queryset = District.objects.filter(division_id=division_id)
        
        if admin_level not in ['central', 'region', 'division']:
            # District admins see only their district
            district_id = admin_scope.get('district_id')
            if not district_id:
                return JsonResponse({
                    'success': True,
                    'districts': []
                })
            district_queryset = district_queryset.filter(id=district_id)
        
        # Annotate with school count (schools that have submitted forms) - optimized with prefetch
        district_queryset = district_queryset.prefetch_related('school_set__form_set').annotate(
            school_count=Count('school__id', filter=Q(school__form__isnull=False), distinct=True)
        ).filter(
            school_count__gt=0
        ).order_by('name')
        
        districts = [
            {
                'id': f'district-{district.id}',
                'name': district.name,
                'type': 'district',
                'school_count': district.school_count,
                'has_children': True
            }
            for district in district_queryset
        ]
        
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
def api_admin_scope(request):
    """Get admin scope information for tree auto-expand"""
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        admin_level = admin_scope['admin_level']
        
        # Determine which levels should auto-expand
        auto_expand_levels = []
        if admin_level in ['district', 'division', 'region']:
            auto_expand_levels.append('region')
        if admin_level in ['district', 'division']:
            auto_expand_levels.append('division')
        if admin_level == 'district':
            auto_expand_levels.append('district')
        
        return JsonResponse({
            'success': True,
            'admin_level': admin_level,
            'region_id': admin_scope.get('region_id'),
            'division_id': admin_scope.get('division_id'),
            'district_id': admin_scope.get('district_id'),
            'auto_expand_levels': auto_expand_levels
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

