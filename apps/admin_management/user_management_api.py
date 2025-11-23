"""
User Management API Endpoints
Handles user management statistics, tree view, and table data APIs
Separate file to avoid bloating views.py
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from django.db.models import Q, Count, Exists, OuterRef, Subquery
from django.core.paginator import Paginator
from django.utils import timezone

from apps.core.models import AdminUser, Region, Division, District, School
from apps.admin_management.utils import AdminUserManager
from apps.admin_management.views import get_admin_division_filter


def get_admin_scope_for_api(request):
    """Helper to get admin scope for API endpoints"""
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None
    
    try:
        admin_scope = AdminUserManager.get_user_access_scope(admin_id)
        return admin_scope
    except Exception:
        return None


@csrf_exempt
@require_GET
def api_user_management_stats(request):
    """Get user management statistics (user types, statuses, permission levels)"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        # Build base query based on admin scope
        users_query = AdminUser.objects.all()
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        if division_id:
            users_query = users_query.filter(division_id=division_id)
        
        # User types by admin level
        user_types = {
            'central': users_query.filter(admin_level='central').count(),
            'region': users_query.filter(admin_level='region').count(),
            'division': users_query.filter(admin_level='division').count(),
            'district': users_query.filter(admin_level='district').count(),
            'school': users_query.filter(admin_level='school').count(),
        }
        
        # Status counts
        status_counts = {
            'active': users_query.filter(status='active').count(),
            'inactive': users_query.filter(status='inactive').count(),
            'suspended': users_query.filter(status='suspended').count(),
        }
        
        # Permission levels summary
        permission_levels = {
            'can_create_users': users_query.filter(can_create_users=True).count(),
            'can_manage_users': users_query.filter(can_manage_users=True).count(),
            'can_set_deadlines': users_query.filter(can_set_deadlines=True).count(),
            'can_approve_submissions': users_query.filter(can_approve_submissions=True).count(),
            'can_view_system_logs': users_query.filter(can_view_system_logs=True).count(),
        }
        
        return JsonResponse({
            'success': True,
            'stats': {
                'user_types': user_types,
                'status_counts': status_counts,
                'permission_levels': permission_levels,
                'total_users': users_query.count()
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_tree_regions(request):
    """Get regions for tree view"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        # Apply division filter (only division and central office admins have access)
        division_id = get_admin_division_filter(request)
        
        # Build query - get regions that contain the division
        if division_id:
            # For division-level admins, get the region that contains this division
            try:
                division = Division.objects.get(id=division_id)
                regions_query = Region.objects.filter(id=division.region_id)
            except Division.DoesNotExist:
                regions_query = Region.objects.none()
        else:
            # Central office admins see all regions
            regions_query = Region.objects.all()
        
        # Get region IDs that have admin users (filtered by division if applicable)
        users_query = AdminUser.objects.filter(region__isnull=False)
        if division_id:
            users_query = users_query.filter(division_id=division_id)
        region_ids_with_users = users_query.values_list('region_id', flat=True).distinct()
        
        # Filter regions that have users
        regions_query = regions_query.filter(
            id__in=region_ids_with_users
        ).order_by('name')
        
        regions_list = list(regions_query)
        for region in regions_list:
            user_count_query = AdminUser.objects.filter(region_id=region.id)
            if division_id:
                user_count_query = user_count_query.filter(division_id=division_id)
            region.user_count = user_count_query.count()
        
        regions = [
            {
                'id': region.id,
                'name': region.name,
                'type': 'region',
                'user_count': region.user_count,
                'has_children': True
            }
            for region in regions_list
        ]
        
        return JsonResponse({
            'success': True,
            'regions': regions
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_tree_divisions(request):
    """Get divisions for selected region"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        region_id = request.GET.get('region_id')
        if not region_id:
            return JsonResponse({
                'success': False,
                'error': 'region_id is required'
            }, status=400)
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Verify admin has access to the requested region
        if admin_division_id:
            # For division-level admins, verify the region contains their division
            try:
                division = Division.objects.get(id=admin_division_id)
                if str(division.region_id) != str(region_id):
                    return JsonResponse({
                        'success': False,
                        'error': 'Access denied to this region'
                    }, status=403)
            except Division.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied'
                }, status=403)
        
        # Build query
        divisions_query = Division.objects.filter(region_id=region_id)
        
        # Filter by division if division-level admin
        if admin_division_id:
            divisions_query = divisions_query.filter(id=admin_division_id)
        
        # Get division IDs that have admin users (filtered by division if applicable)
        users_query = AdminUser.objects.filter(division__isnull=False)
        if admin_division_id:
            users_query = users_query.filter(division_id=admin_division_id)
        division_ids_with_users = users_query.values_list('division_id', flat=True).distinct()
        
        # Filter divisions that have users
        divisions_query = divisions_query.filter(
            id__in=division_ids_with_users
        ).order_by('name')
        
        divisions_list = list(divisions_query)
        for division in divisions_list:
            user_count_query = AdminUser.objects.filter(division_id=division.id)
            if admin_division_id:
                user_count_query = user_count_query.filter(division_id=admin_division_id)
            division.user_count = user_count_query.count()
        
        divisions = [
            {
                'id': division.id,
                'name': division.name,
                'type': 'division',
                'user_count': division.user_count,
                'has_children': True
            }
            for division in divisions_list
        ]
        
        return JsonResponse({
            'success': True,
            'divisions': divisions
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_tree_districts(request):
    """Get districts for selected division"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        division_id = request.GET.get('division_id')
        if not division_id:
            return JsonResponse({
                'success': False,
                'error': 'division_id is required'
            }, status=400)
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Verify admin has access to the requested division
        if admin_division_id and str(admin_division_id) != str(division_id):
            return JsonResponse({
                'success': False,
                'error': 'Access denied to this division'
            }, status=403)
        
        # Build query
        districts_query = District.objects.filter(division_id=division_id)
        
        # Get district IDs that have admin users (filtered by division if applicable)
        users_query = AdminUser.objects.filter(district__isnull=False)
        if admin_division_id:
            users_query = users_query.filter(division_id=admin_division_id)
        district_ids_with_users = users_query.values_list('district_id', flat=True).distinct()
        
        # Filter districts that have users
        districts_query = districts_query.filter(
            id__in=district_ids_with_users
        ).order_by('name')
        
        districts_list = list(districts_query)
        for district in districts_list:
            user_count_query = AdminUser.objects.filter(district_id=district.id)
            if admin_division_id:
                user_count_query = user_count_query.filter(division_id=admin_division_id)
            district.user_count = user_count_query.count()
        
        districts = [
            {
                'id': district.id,
                'name': district.name,
                'type': 'district',
                'user_count': district.user_count,
                'has_children': True
            }
            for district in districts_list
        ]
        
        return JsonResponse({
            'success': True,
            'districts': districts
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_tree_schools(request):
    """Get schools/users for selected district"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        district_id = request.GET.get('district_id')
        if not district_id:
            return JsonResponse({
                'success': False,
                'error': 'district_id is required'
            }, status=400)
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Verify admin has access to the requested district (must be in their division)
        if admin_division_id:
            try:
                district = District.objects.get(id=district_id)
                if str(district.division_id) != str(admin_division_id):
                    return JsonResponse({
                        'success': False,
                        'error': 'Access denied to this district'
                    }, status=403)
            except District.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'District not found'
                }, status=404)
        
        # Build query for schools in this district
        schools_query = School.objects.filter(district_id=district_id)
        
        # Get school IDs that have admin users (filtered by division if applicable)
        users_query = AdminUser.objects.filter(school__isnull=False)
        if admin_division_id:
            users_query = users_query.filter(division_id=admin_division_id)
        school_ids_with_users = users_query.values_list('school_id', flat=True).distinct()
        
        # Filter schools that have users (School model uses 'id' as primary key, but AdminUser.school_id references School.id)
        schools_query = schools_query.filter(
            id__in=school_ids_with_users
        ).order_by('school_name')
        
        schools_list = list(schools_query)
        for school in schools_list:
            user_count_query = AdminUser.objects.filter(school_id=school.id)
            if admin_division_id:
                user_count_query = user_count_query.filter(division_id=admin_division_id)
            school.user_count = user_count_query.count()
        
        schools = [
            {
                'id': school.school_id,
                'name': school.school_name,
                'type': 'school',
                'user_count': school.user_count,
                'has_children': False
            }
            for school in schools_list
        ]
        
        return JsonResponse({
            'success': True,
            'schools': schools
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_view(request):
    """Get detailed user information for view page"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        user_id = request.GET.get('user_id')
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id is required'
            }, status=400)
        
        try:
            # Apply division filter (only division and central office admins have access)
            admin_division_id = get_admin_division_filter(request)
            
            # Get user with all relationships
            admin_user = AdminUser.objects.select_related(
                'region', 'division', 'district', 'school', 'created_by', 'updated_by'
            ).get(admin_id=user_id)
            
            # Verify access - division-level admins can only view users in their division
            if admin_division_id and admin_user.division_id != admin_division_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this user'
                }, status=403)
            
            # Format user data similar to profile endpoint
            from apps.admin_management.profile.user_info.utils import format_user_info
            
            user_info = format_user_info(admin_user)
            
            return JsonResponse({
                'success': True,
                'user_info': user_info
            })
            
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_view_permissions(request):
    """Get user permissions for view page"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        user_id = request.GET.get('user_id')
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id is required'
            }, status=400)
        
        try:
            from apps.core.models import AdminUserPermission
            from apps.admin_management.profile.permissions.utils import format_permissions
            
            # Apply division filter (only division and central office admins have access)
            admin_division_id = get_admin_division_filter(request)
            
            admin_user = AdminUser.objects.get(admin_id=user_id)
            
            # Verify access - division-level admins can only view users in their division
            if admin_division_id and admin_user.division_id != admin_division_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this user'
                }, status=403)
            
            permissions = AdminUserPermission.objects.select_related('granted_by').filter(
                admin_user=admin_user
            ).order_by('resource_type', 'action')
            
            permissions_data = format_permissions(admin_user, permissions)
            
            return JsonResponse({
                'success': True,
                'permissions': permissions_data
            })
            
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_view_audit_log(request):
    """Get user audit logs for view page"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        user_id = request.GET.get('user_id')
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id is required'
            }, status=400)
        
        try:
            from apps.core.models import AdminActivityLog, AuditLog
            from apps.admin_management.profile.audit_log.utils import format_audit_log_entry
            
            # Apply division filter (only division and central office admins have access)
            admin_division_id = get_admin_division_filter(request)
            
            # Verify access - division-level admins can only view users in their division
            if admin_division_id:
                try:
                    admin_user = AdminUser.objects.get(admin_id=user_id)
                    if admin_user.division_id != admin_division_id:
                        return JsonResponse({
                            'success': False,
                            'error': 'Access denied to this user'
                        }, status=403)
                except AdminUser.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': 'User not found'
                    }, status=404)
            
            page = int(request.GET.get('page', 1))
            page_size = int(request.GET.get('page_size', 100))
            log_type = request.GET.get('type', 'all').lower()
            
            activity_logs = []
            if log_type in ['all', 'activity']:
                activity_logs_query = AdminActivityLog.objects.filter(
                    admin_user_id=user_id
                ).order_by('-timestamp')[:1000]
                
                activity_logs = [
                    format_audit_log_entry(log, 'activity')
                    for log in activity_logs_query
                ]
            
            audit_logs = []
            if log_type in ['all', 'audit']:
                audit_logs_query = AuditLog.objects.filter(
                    admin_id=user_id
                ).order_by('-timestamp')[:1000]
                
                audit_logs = [
                    format_audit_log_entry(log, 'audit')
                    for log in audit_logs_query
                ]
            
            all_logs = activity_logs + audit_logs
            all_logs.sort(key=lambda x: x['timestamp'], reverse=True)
            
            total_logs = len(all_logs)
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_logs = all_logs[start_idx:end_idx]
            
            total_pages = (total_logs + page_size - 1) // page_size if total_logs > 0 else 1
            
            return JsonResponse({
                'success': True,
                'logs': paginated_logs,
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total_pages': total_pages,
                    'total_items': total_logs,
                    'has_next': page < total_pages,
                    'has_previous': page > 1,
                }
            })
            
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
            
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_POST
def api_user_management_reset_password(request):
    """Reset user password to default password"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        # Check if admin has permission to manage users
        if not admin_scope.get('permissions', {}).get('can_manage_users', False):
            return JsonResponse({
                'success': False,
                'error': 'Permission denied'
            }, status=403)
        
        import json
        import bcrypt
        from apps.admin_management.utils import AuditLogger
        
        data = json.loads(request.body.decode('utf-8'))
        user_id = data.get('user_id')
        
        if not user_id:
            return JsonResponse({
                'success': False,
                'error': 'user_id is required'
            }, status=400)
        
        try:
            # Apply division filter (only division and central office admins have access)
            admin_division_id = get_admin_division_filter(request)
            
            admin_user = AdminUser.objects.get(admin_id=user_id)
            
            # Verify access - division-level admins can only reset passwords for users in their division
            if admin_division_id and admin_user.division_id != admin_division_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this user'
                }, status=403)
            
            # Default password
            default_password = 'Edsight.123'
            
            # Hash the password using bcrypt (same method used throughout the codebase)
            # This matches the format used in profile/password/views.py and other password operations
            # bcrypt.hashpw generates a salt automatically and returns a bcrypt hash string
            try:
                password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            except Exception as hash_error:
                return JsonResponse({
                    'success': False,
                    'error': f'Failed to hash password: {str(hash_error)}'
                }, status=500)
            
            # Update password hash in database (password_hash field stores bcrypt hashes)
            admin_user.password_hash = password_hash
            admin_user.save()
            
            # Log the activity
            AuditLogger.log_activity(
                admin_id=admin_scope.get('admin_id'),
                action='RESET_PASSWORD',
                resource_type='admin_user',
                resource_id=str(admin_user.admin_id),
                details={'username': admin_user.username, 'reset_by': admin_scope.get('admin_id')},
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
            
            return JsonResponse({
                'success': True,
                'message': f'Password reset successfully for {admin_user.username}',
                'new_password': default_password
            })
            
        except AdminUser.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'User not found'
            }, status=404)
            
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON data'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_GET
def api_user_management_table(request):
    """Get paginated user table data with search/filter/sort"""
    try:
        admin_scope = get_admin_scope_for_api(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        # Apply division filter (only division and central office admins have access)
        admin_division_id = get_admin_division_filter(request)
        
        # Get filter parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        search = request.GET.get('search', '').strip()
        admin_level_filter = request.GET.get('admin_level', '')
        status_filter = request.GET.get('status', '')
        region_id = request.GET.get('region_id')
        division_id = request.GET.get('division_id')
        district_id = request.GET.get('district_id')
        sort_by = request.GET.get('sort_by', 'created_at')
        sort_order = request.GET.get('sort_order', 'desc')
        
        # Build base query
        users_query = AdminUser.objects.select_related('region', 'division', 'district', 'school')
        
        # Apply division filter
        if admin_division_id:
            users_query = users_query.filter(division_id=admin_division_id)
        
        # Apply filters
        if search:
            users_query = users_query.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(full_name__icontains=search)
            )
        
        if admin_level_filter:
            users_query = users_query.filter(admin_level=admin_level_filter)
        
        if status_filter:
            users_query = users_query.filter(status=status_filter)
        
        if region_id:
            # Verify region is accessible - division-level admins can only filter by their own region
            if admin_division_id:
                try:
                    division = Division.objects.get(id=admin_division_id)
                    if str(division.region_id) != str(region_id):
                        return JsonResponse({
                            'success': False,
                            'error': 'Access denied to this region'
                        }, status=403)
                except Division.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': 'Access denied'
                    }, status=403)
            users_query = users_query.filter(region_id=region_id)
        
        if division_id:
            # Verify division is accessible (must match admin's division if division-level admin)
            if admin_division_id and str(admin_division_id) != str(division_id):
                return JsonResponse({
                    'success': False,
                    'error': 'Access denied to this division'
                }, status=403)
            users_query = users_query.filter(division_id=division_id)
        
        if district_id:
            # Verify district is in admin's division
            if admin_division_id:
                try:
                    district = District.objects.get(id=district_id)
                    if str(district.division_id) != str(admin_division_id):
                        return JsonResponse({
                            'success': False,
                            'error': 'Access denied to this district'
                        }, status=403)
                except District.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': 'District not found'
                    }, status=404)
            users_query = users_query.filter(district_id=district_id)
        
        # Apply sorting
        if sort_order == 'desc':
            sort_by = f'-{sort_by}'
        users_query = users_query.order_by(sort_by)
        
        # Paginate
        paginator = Paginator(users_query, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize users
        users_data = []
        for user in page_obj:
            users_data.append({
                'id': user.admin_id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name or '',
                'admin_level': user.admin_level,
                'admin_level_display': user.get_admin_level_display(),
                'status': user.status,
                'status_display': user.get_status_display(),
                'assigned_area': user.assigned_area or '',
                'region_name': user.region.name if user.region else '',
                'division_name': user.division.name if user.division else '',
                'district_name': user.district.name if user.district else '',
                'school_name': user.school.school_name if user.school else '',
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat() if user.created_at else None,
            })
        
        return JsonResponse({
            'success': True,
            'users': users_data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': paginator.num_pages,
                'total_count': paginator.count,
                'has_next': page_obj.has_next(),
                'has_previous': page_obj.has_previous(),
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

