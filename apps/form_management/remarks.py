"""
Form Management Remarks Endpoints
Handles remark creation, retrieval, updating, and deletion for form reviews
"""

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from apps.core.models import Form, FormRemark, AdminUser
from .utils import get_admin_scope


@csrf_exempt
@require_GET
def api_form_remarks(request, form_id):
    """Get all remarks for a form grouped by type and entity"""
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)
        
        # Verify form exists and admin has access
        form = Form.objects.select_related('school').get(form_id=form_id)
        admin_level = admin_scope['admin_level']
        if admin_level == 'district' and form.school.district_id != admin_scope.get('district_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'division' and form.school.division_id != admin_scope.get('division_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'region' and form.school.region_id != admin_scope.get('region_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Get all remarks for this form
        remarks = FormRemark.objects.filter(form_id=form_id).select_related('admin_user').order_by('-created_at')
        
        remarks_data = {
            'category': {},
            'topic': {},
            'question': {}
        }
        
        for remark in remarks:
            entity_key = str(remark.entity_id)
            if entity_key not in remarks_data[remark.remark_type]:
                remarks_data[remark.remark_type][entity_key] = []
            
            remarks_data[remark.remark_type][entity_key].append({
                'remark_id': remark.remark_id,
                'remark_text': remark.remark_text,
                'created_at': remark.created_at.isoformat(),
                'admin': {
                    'username': remark.admin_user.username,
                    'full_name': remark.admin_user.full_name or remark.admin_user.username,
                    'admin_level': remark.admin_user.admin_level,
                }
            })
        
        return JsonResponse({
            'success': True,
            'remarks': remarks_data
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_clear_remarks(request, form_id):
    """
    Clear remarks for a form.
    Request body can include {"scope": "current_admin_level" | "current_admin" | "all"}
    Defaults to "all" for backward compatibility.
    """
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)

        # Verify form exists and admin has access
        form = Form.objects.select_related('school').get(form_id=form_id)
        admin_level = admin_scope['admin_level']
        if admin_level == 'district' and form.school.district_id != admin_scope.get('district_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'division' and form.school.division_id != admin_scope.get('division_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'region' and form.school.region_id != admin_scope.get('region_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)

        scope = 'all'
        if request.body:
            try:
                payload = json.loads(request.body)
                scope = payload.get('scope') or 'all'
            except json.JSONDecodeError:
                return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

        remarks_qs = FormRemark.objects.filter(form_id=form_id)

        if scope == 'current_admin_level':
            remarks_qs = remarks_qs.filter(admin_user__admin_level=admin_scope['admin_level'])
        elif scope == 'current_admin':
            remarks_qs = remarks_qs.filter(admin_user_id=admin_scope['admin_id'])
        else:
            scope = 'all'

        deleted_count, _ = remarks_qs.delete()

        return JsonResponse({'success': True, 'deleted': deleted_count})

    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_POST
def api_create_remark(request, form_id):
    """Create a new remark for a form"""
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)
        
        # Get admin user
        admin_id = request.session.get('admin_id')
        admin_user = AdminUser.objects.get(admin_id=admin_id)
        
        # Verify form exists and admin has access
        form = Form.objects.select_related('school').get(form_id=form_id)
        admin_level = admin_scope['admin_level']
        if admin_level == 'district' and form.school.district_id != admin_scope.get('district_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'division' and form.school.division_id != admin_scope.get('division_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'region' and form.school.region_id != admin_scope.get('region_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        # Parse request data
        data = json.loads(request.body)
        remark_type = data.get('remark_type')
        entity_id = data.get('entity_id')
        remark_text = data.get('remark_text', '').strip()
        
        # Validate required fields
        if not remark_type or not entity_id or not remark_text:
            return JsonResponse({
                'success': False,
                'error': 'Missing required fields: remark_type, entity_id, remark_text'
            }, status=400)
        
        # Validate remark_type
        valid_types = ['category', 'topic', 'question']
        if remark_type not in valid_types:
            return JsonResponse({
                'success': False,
                'error': f'Invalid remark_type. Must be one of: {", ".join(valid_types)}'
            }, status=400)
        
        # Create remark
        remark = FormRemark.objects.create(
            form=form,
            admin_user=admin_user,
            remark_type=remark_type,
            entity_id=entity_id,
            remark_text=remark_text
        )
        
        return JsonResponse({
            'success': True,
            'remark': {
                'remark_id': remark.remark_id,
                'remark_text': remark.remark_text,
                'created_at': remark.created_at.isoformat(),
                'admin': {
                    'username': admin_user.username,
                    'full_name': admin_user.full_name or admin_user.username,
                    'admin_level': admin_user.admin_level,
                }
            }
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except AdminUser.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Admin user not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST", "PUT"])
def api_upsert_remark(request, form_id):
    """Create or update a single remark per (form, remark_type, entity_id). POST when none; PUT when exists."""
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({'success': False, 'error': 'Authentication required'}, status=403)

        admin_id = request.session.get('admin_id')
        admin_user = AdminUser.objects.get(admin_id=admin_id)

        form = Form.objects.select_related('school').get(form_id=form_id)

        data = json.loads(request.body)
        remark_type = data.get('remark_type')
        entity_id = data.get('entity_id')
        remark_text = (data.get('remark_text') or '').strip()

        if not remark_type or not entity_id:
            return JsonResponse({'success': False, 'error': 'Missing remark_type or entity_id'}, status=400)

        existing = FormRemark.objects.filter(form_id=form_id, remark_type=remark_type, entity_id=entity_id).first()

        action = None
        if existing:
            # Update
            existing.remark_text = remark_text
            existing.admin_user = admin_user
            existing.save(update_fields=['remark_text', 'admin_user', 'updated_at'])
            remark = existing
            action = 'updated'
        else:
            # Create
            remark = FormRemark.objects.create(
                form=form,
                admin_user=admin_user,
                remark_type=remark_type,
                entity_id=entity_id,
                remark_text=remark_text
            )
            action = 'created'

        return JsonResponse({
            'success': True,
            'action': action,
            'remark': {
                'remark_id': remark.remark_id,
                'remark_text': remark.remark_text,
                'created_at': remark.created_at.isoformat(),
                'admin': {
                    'username': admin_user.username,
                    'full_name': admin_user.full_name or admin_user.username,
                    'admin_level': admin_user.admin_level,
                }
            }
        })
    except AdminUser.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Admin user not found'}, status=404)
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

