"""
Form Management Views
Handles form workflow, approval, and hierarchical display
"""

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST, require_http_methods
from django.db import transaction
from django.db.models import Q, Count, Prefetch, F
from django.utils import timezone
from django.core.paginator import Paginator
from django.contrib.auth.decorators import login_required
import json
import csv
import io

from apps.core.models import (
    AdminUser, Form, FormApproval, FormNotification, Answer,
    Region, Division, District, School, Category, Topic, Question
)
from apps.admin_management.utils import require_admin_permission, log_admin_activity


def get_admin_context(request):
    """Get admin context data for templates"""
    admin_id = request.session.get('admin_id')
    if not admin_id:
        return None
    
    try:
        # DEVELOPMENT BYPASS - Create mock admin scope for development
        from django.conf import settings
        if getattr(settings, 'DEBUG', False) and admin_id == 2:
            return {
                'admin_scope': {
                    'admin_level': 'central',
                    'admin_id': 2,
                    'username': 'admin',
                    'permissions': {
                        'can_create_users': True,
                        'can_manage_users': True,
                        'can_set_deadlines': True,
                        'can_approve_submissions': True,
                        'can_view_system_logs': True,
                    },
                    'scope': 'nationwide',
                    'coverage': 'All regions, divisions, districts, and schools (Development Mode)',
                    'geographic_scope': {
                        'region_id': None,
                        'division_id': None,
                        'district_id': None,
                        'school_id': None,
                        'accessible_regions': [],
                        'accessible_divisions': [],
                        'accessible_districts': [],
                        'accessible_schools': []
                    }
                },
                'admin_id': 2,
                'admin_level': 'central',
                'permissions': {
                    'can_create_users': True,
                    'can_manage_users': True,
                    'can_set_deadlines': True,
                    'can_approve_submissions': True,
                    'can_view_system_logs': True,
                },
                'coverage': 'All regions, divisions, districts, and schools (Development Mode)',
            }
        
        # TODO: Implement proper admin scope retrieval
        admin_scope = {
            'admin_level': 'central',
            'admin_id': admin_id,
            'username': 'admin',
            'permissions': {
                'can_create_users': True,
                'can_manage_users': True,
                'can_set_deadlines': True,
                'can_approve_submissions': True,
                'can_view_system_logs': True,
            },
            'scope': 'nationwide',
            'coverage': 'All regions, divisions, districts, and schools',
        }
        return {
            'admin_scope': admin_scope,
            'admin_id': admin_id,
            'admin_level': admin_scope.get('admin_level'),
            'permissions': admin_scope.get('permissions', {}),
            'coverage': admin_scope.get('coverage', ''),
        }
    except Exception:
        return None


def form_management_page(request):
    """Standalone form management page with hierarchical view and workflow controls"""
    # For now, we'll use a simple context for the standalone page
    # TODO: Implement proper authentication and user context
    context = {
        'page_title': 'Form Management',
        'user': request.user if request.user.is_authenticated else None
    }
    
    return render(request, 'form_management/form_management.html', context)


@csrf_exempt
@require_GET
def api_user_info(request):
    """Get current admin user information"""
    admin_id = request.session.get('admin_id')
    
    try:
        # DEVELOPMENT BYPASS
        from django.conf import settings
        if getattr(settings, 'DEBUG', False) and admin_id == 2:
            return JsonResponse({
                'success': True,
                'admin_id': 2,
                'username': 'admin',
                'admin_level': 'central',
                'admin_level_display': 'Central Office',
                'permissions': {
                    'can_approve_submissions': True,
                    'can_view_system_logs': True,
                }
            })
        
        # TODO: Implement proper admin user retrieval
        return JsonResponse({
            'success': True,
            'admin_id': admin_id,
            'username': 'admin',
            'admin_level': 'central',
            'admin_level_display': 'Central Office',
            'permissions': {
                'can_approve_submissions': True,
                'can_view_system_logs': True,
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to get user info: {str(e)}'
        })


@csrf_exempt
@require_GET
def api_statistics(request):
    """Get form management statistics"""
    admin_id = request.session.get('admin_id')
    
    try:
        # Get forms based on admin level and scope
        forms_queryset = get_accessible_forms(admin_id)
        
        # Calculate statistics
        pending_review = forms_queryset.filter(
            status__in=['district_pending', 'division_pending', 'region_pending', 'central_pending']
        ).count()
        
        approved_today = forms_queryset.filter(
            status__in=['district_approved', 'division_approved', 'region_approved', 'central_approved'],
            updated_at__date=timezone.now().date()
        ).count()
        
        returned_for_revision = forms_queryset.filter(
            status__in=['district_returned', 'division_returned', 'region_returned', 'central_returned']
        ).count()
        
        total_forms = forms_queryset.count()
        
        return JsonResponse({
            'success': True,
            'pending_review': pending_review,
            'approved_today': approved_today,
            'returned_for_revision': returned_for_revision,
            'total_forms': total_forms,
            'pending_trend': 'No change',
            'approved_trend': 'No change',
            'returned_trend': 'No change',
            'total_trend': 'No change',
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to get statistics: {str(e)}'
        })


@csrf_exempt
@require_GET
def api_forms(request):
    """Get forms with filtering and pagination"""
    admin_id = request.session.get('admin_id')
    
    try:
        # Get filter parameters
        search = request.GET.get('search', '')
        status_filter = request.GET.get('status', '')
        level_filter = request.GET.get('level', '')
        date_filter = request.GET.get('date', '')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        
        # Get accessible forms
        forms_queryset = get_accessible_forms(admin_id)
        
        # Apply filters
        if search:
            forms_queryset = forms_queryset.filter(
                Q(school__school_name__icontains=search) |
                Q(school__school_id__icontains=search) |
                Q(user__username__icontains=search)
            )
        
        if status_filter:
            if status_filter == 'pending':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_pending', 'division_pending', 'region_pending', 'central_pending']
                )
            elif status_filter == 'approved':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_approved', 'division_approved', 'region_approved', 'central_approved']
                )
            elif status_filter == 'returned':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_returned', 'division_returned', 'region_returned', 'central_returned']
                )
            elif status_filter == 'overdue':
                # Forms that are past deadline and still pending
                forms_queryset = forms_queryset.filter(
                    status__in=['district_pending', 'division_pending', 'region_pending', 'central_pending'],
                    submission_deadline__lt=timezone.now()
                )
        
        if level_filter:
            forms_queryset = forms_queryset.filter(current_level=level_filter)
        
        if date_filter:
            now = timezone.now()
            if date_filter == 'today':
                forms_queryset = forms_queryset.filter(submitted_at__date=now.date())
            elif date_filter == 'week':
                week_ago = now - timezone.timedelta(days=7)
                forms_queryset = forms_queryset.filter(submitted_at__gte=week_ago)
            elif date_filter == 'month':
                month_ago = now - timezone.timedelta(days=30)
                forms_queryset = forms_queryset.filter(submitted_at__gte=month_ago)
        
        # Order by submission date (most recent first)
        forms_queryset = forms_queryset.order_by('-submitted_at', '-updated_at')
        
        # Pagination
        paginator = Paginator(forms_queryset, page_size)
        page_obj = paginator.get_page(page)
        
        # Serialize forms
        forms_data = []
        for form in page_obj:
            forms_data.append({
                'id': form.form_id,
                'school_name': form.school.school_name,
                'school_id': form.school.school_id,
                'district_name': form.school.district.name if form.school.district else '',
                'division_name': form.school.division.name if form.school.division else '',
                'region_name': form.school.region.name if form.school.region else '',
                'status': form.status,
                'current_level': form.current_level,
                'submitted_date': form.submitted_at.isoformat() if form.submitted_at else None,
                'academic_year': form.academic_year,
                'form_type': form.form_type,
                'last_reviewed_at': form.last_reviewed_at.isoformat() if form.last_reviewed_at else None,
                'created_at': form.created_at.isoformat(),
                'updated_at': form.updated_at.isoformat(),
            })
        
        return JsonResponse({
            'success': True,
            'forms': forms_data,
            'total': paginator.count,
            'page': page,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to get forms: {str(e)}'
        })


@csrf_exempt
@require_GET
def api_form_detail(request, form_id):
    """Get detailed form information with answers"""
    admin_id = request.session.get('admin_id')
    
    try:
        # Get form with related data
        form = Form.objects.select_related(
            'school', 'school__district', 'school__division', 'school__region', 'user'
        ).prefetch_related(
            'answers__question__topic__category'
        ).get(form_id=form_id)
        
        # Check if admin can access this form
        if not can_access_form(admin_id, form):
            return JsonResponse({
                'success': False,
                'message': 'You do not have permission to access this form'
            })
        
        # Get answers with full hierarchy
        answers_data = []
        for answer in form.answers.all():
            question = answer.question
            topic = question.topic
            category = topic.category
            
            answers_data.append({
                'answer_id': answer.answer_id,
                'question_id': question.question_id,
                'question_text': question.question_text,
                'answer_type': question.answer_type,
                'response': answer.response,
                'answered_at': answer.answered_at.isoformat(),
                'category_name': category.name,
                'subsection_name': subsection.name,
                'topic_name': topic.name,
                'sub_question': {
                    'id': answer.sub_question.sub_question_id if answer.sub_question else None,
                    'text': answer.sub_question.sub_question_text if answer.sub_question else None,
                    'answer_type': answer.sub_question.answer_type if answer.sub_question else None,
                } if answer.sub_question else None,
            })
        
        # Serialize form data
        form_data = {
            'id': form.form_id,
            'school_name': form.school.school_name,
            'school_id': form.school.school_id,
            'district_name': form.school.district.name if form.school.district else '',
            'division_name': form.school.division.name if form.school.division else '',
            'region_name': form.school.region.name if form.school.region else '',
            'status': form.status,
            'current_level': form.current_level,
            'submitted_date': form.submitted_at.isoformat() if form.submitted_at else None,
            'academic_year': form.academic_year,
            'form_type': form.form_type,
            'last_reviewed_by': form.last_reviewed_by.username if form.last_reviewed_by else None,
            'last_reviewed_at': form.last_reviewed_at.isoformat() if form.last_reviewed_at else None,
            'created_at': form.created_at.isoformat(),
            'updated_at': form.updated_at.isoformat(),
            'answers': answers_data,
        }
        
        return JsonResponse({
            'success': True,
            'form': form_data,
        })
    except Form.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Form not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to get form details: {str(e)}'
        })


@csrf_exempt
@require_POST
def api_approve_form(request, form_id):
    """Approve a form and move it to the next level"""
    admin_id = request.session.get('admin_id')
    
    try:
        data = json.loads(request.body)
        comments = data.get('comments', '')
        
        with transaction.atomic():
            # Get form
            form = Form.objects.select_related('school').get(form_id=form_id)
            
            # Check permissions
            if not can_access_form(admin_id, form):
                return JsonResponse({
                    'success': False,
                    'message': 'You do not have permission to approve this form'
                })
            
            # Get admin user
            admin_user = get_admin_user(admin_id)
            
            # Determine next level
            next_level = form.get_next_level()
            if not next_level:
                return JsonResponse({
                    'success': False,
                    'message': 'Form is already at the final level'
                })
            
            # Update form status
            status_map = {
                'district': 'district_approved',
                'division': 'division_approved',
                'region': 'region_approved',
                'central': 'central_approved',
                'completed': 'completed'
            }
            
            form.status = status_map.get(next_level, 'completed')
            form.current_level = next_level
            form.last_reviewed_by = admin_user
            form.last_reviewed_at = timezone.now()
            form.save()
            
            # Create approval record
            approval = FormApproval.objects.create(
                form=form,
                approver=admin_user,
                approval_level=form.current_level,
                status='approved',
                comments=comments,
                approved_at=timezone.now()
            )
            
            # Send notification to next level (if not completed)
            if next_level != 'completed':
                send_notification_to_next_level(form, admin_user, 'form_approved', comments)
            
            # Log activity
            log_admin_activity(
                admin_user, 'approve_form', 'form',
                f"Approved form {form_id} for {form.school.school_name}",
                {'form_id': form_id, 'next_level': next_level, 'comments': comments}
            )
        
        return JsonResponse({
            'success': True,
            'message': f'Form approved and moved to {next_level} level',
            'next_level': next_level,
            'new_status': form.status,
        })
    except Form.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Form not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to approve form: {str(e)}'
        })


@csrf_exempt
@require_POST
def api_return_form(request, form_id):
    """Return a form to the previous level for revision"""
    admin_id = request.session.get('admin_id')
    
    try:
        data = json.loads(request.body)
        comments = data.get('comments', '')
        
        if not comments.strip():
            return JsonResponse({
                'success': False,
                'message': 'Comments are required when returning a form'
            })
        
        with transaction.atomic():
            # Get form
            form = Form.objects.select_related('school').get(form_id=form_id)
            
            # Check permissions
            if not can_access_form(admin_id, form):
                return JsonResponse({
                    'success': False,
                    'message': 'You do not have permission to return this form'
                })
            
            # Get admin user
            admin_user = get_admin_user(admin_id)
            
            # Determine previous level
            previous_level = form.get_previous_level()
            if not previous_level:
                return JsonResponse({
                    'success': False,
                    'message': 'Form is already at the school level'
                })
            
            # Update form status
            status_map = {
                'school': 'district_returned',
                'district': 'division_returned',
                'division': 'region_returned',
                'region': 'central_returned'
            }
            
            form.status = status_map.get(previous_level, 'district_returned')
            form.current_level = previous_level
            form.last_reviewed_by = admin_user
            form.last_reviewed_at = timezone.now()
            form.save()
            
            # Create approval record
            approval = FormApproval.objects.create(
                form=form,
                approver=admin_user,
                approval_level=form.current_level,
                status='returned',
                comments=comments,
                approved_at=timezone.now()
            )
            
            # Send notification to previous level
            send_notification_to_previous_level(form, admin_user, 'form_returned', comments)
            
            # Log activity
            log_admin_activity(
                admin_user, 'return_form', 'form',
                f"Returned form {form_id} for {form.school.school_name}",
                {'form_id': form_id, 'previous_level': previous_level, 'comments': comments}
            )
        
        return JsonResponse({
            'success': True,
            'message': f'Form returned to {previous_level} level',
            'previous_level': previous_level,
            'new_status': form.status,
        })
    except Form.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Form not found'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to return form: {str(e)}'
        })


@csrf_exempt
@require_POST
def api_bulk_approve(request):
    """Bulk approve multiple forms"""
    admin_id = request.session.get('admin_id')
    
    try:
        data = json.loads(request.body)
        form_ids = data.get('form_ids', [])
        comments = data.get('comments', '')
        
        if not form_ids:
            return JsonResponse({
                'success': False,
                'message': 'No forms selected for approval'
            })
        
        admin_user = get_admin_user(admin_id)
        approved_count = 0
        
        with transaction.atomic():
            for form_id in form_ids:
                try:
                    form = Form.objects.select_related('school').get(form_id=form_id)
                    
                    # Check permissions
                    if not can_access_form(admin_id, form):
                        continue
                    
                    # Determine next level
                    next_level = form.get_next_level()
                    if not next_level:
                        continue
                    
                    # Update form status
                    status_map = {
                        'district': 'district_approved',
                        'division': 'division_approved',
                        'region': 'region_approved',
                        'central': 'central_approved',
                        'completed': 'completed'
                    }
                    
                    form.status = status_map.get(next_level, 'completed')
                    form.current_level = next_level
                    form.last_reviewed_by = admin_user
                    form.last_reviewed_at = timezone.now()
                    form.save()
                    
                    # Create approval record
                    FormApproval.objects.create(
                        form=form,
                        approver=admin_user,
                        approval_level=form.current_level,
                        status='approved',
                        comments=f"Bulk approval: {comments}",
                        approved_at=timezone.now()
                    )
                    
                    approved_count += 1
                    
                except Form.DoesNotExist:
                    continue
        
        # Log activity
        log_admin_activity(
            admin_user, 'bulk_approve_forms', 'form',
            f"Bulk approved {approved_count} forms",
            {'form_ids': form_ids, 'approved_count': approved_count, 'comments': comments}
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Successfully approved {approved_count} forms',
            'approved_count': approved_count,
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to bulk approve forms: {str(e)}'
        })


@csrf_exempt
@require_POST
def api_bulk_return(request):
    """Bulk return multiple forms"""
    admin_id = request.session.get('admin_id')
    
    try:
        data = json.loads(request.body)
        form_ids = data.get('form_ids', [])
        comments = data.get('comments', '')
        
        if not form_ids:
            return JsonResponse({
                'success': False,
                'message': 'No forms selected for return'
            })
        
        if not comments.strip():
            return JsonResponse({
                'success': False,
                'message': 'Comments are required for bulk return'
            })
        
        admin_user = get_admin_user(admin_id)
        returned_count = 0
        
        with transaction.atomic():
            for form_id in form_ids:
                try:
                    form = Form.objects.select_related('school').get(form_id=form_id)
                    
                    # Check permissions
                    if not can_access_form(admin_id, form):
                        continue
                    
                    # Determine previous level
                    previous_level = form.get_previous_level()
                    if not previous_level:
                        continue
                    
                    # Update form status
                    status_map = {
                        'school': 'district_returned',
                        'district': 'division_returned',
                        'division': 'region_returned',
                        'region': 'central_returned'
                    }
                    
                    form.status = status_map.get(previous_level, 'district_returned')
                    form.current_level = previous_level
                    form.last_reviewed_by = admin_user
                    form.last_reviewed_at = timezone.now()
                    form.save()
                    
                    # Create approval record
                    FormApproval.objects.create(
                        form=form,
                        approver=admin_user,
                        approval_level=form.current_level,
                        status='returned',
                        comments=f"Bulk return: {comments}",
                        approved_at=timezone.now()
                    )
                    
                    returned_count += 1
                    
                except Form.DoesNotExist:
                    continue
        
        # Log activity
        log_admin_activity(
            admin_user, 'bulk_return_forms', 'form',
            f"Bulk returned {returned_count} forms",
            {'form_ids': form_ids, 'returned_count': returned_count, 'comments': comments}
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Successfully returned {returned_count} forms',
            'returned_count': returned_count,
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to bulk return forms: {str(e)}'
        })


@csrf_exempt
@require_GET
def api_export_forms(request):
    """Export forms data to CSV"""
    admin_id = request.session.get('admin_id')
    
    try:
        # Get filter parameters
        search = request.GET.get('search', '')
        status_filter = request.GET.get('status', '')
        level_filter = request.GET.get('level', '')
        date_filter = request.GET.get('date', '')
        
        # Get accessible forms
        forms_queryset = get_accessible_forms(admin_id)
        
        # Apply filters (same logic as api_forms)
        if search:
            forms_queryset = forms_queryset.filter(
                Q(school__school_name__icontains=search) |
                Q(school__school_id__icontains=search) |
                Q(user__username__icontains=search)
            )
        
        if status_filter:
            if status_filter == 'pending':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_pending', 'division_pending', 'region_pending', 'central_pending']
                )
            elif status_filter == 'approved':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_approved', 'division_approved', 'region_approved', 'central_approved']
                )
            elif status_filter == 'returned':
                forms_queryset = forms_queryset.filter(
                    status__in=['district_returned', 'division_returned', 'region_returned', 'central_returned']
                )
        
        if level_filter:
            forms_queryset = forms_queryset.filter(current_level=level_filter)
        
        if date_filter:
            now = timezone.now()
            if date_filter == 'today':
                forms_queryset = forms_queryset.filter(submitted_at__date=now.date())
            elif date_filter == 'week':
                week_ago = now - timezone.timedelta(days=7)
                forms_queryset = forms_queryset.filter(submitted_at__gte=week_ago)
            elif date_filter == 'month':
                month_ago = now - timezone.timedelta(days=30)
                forms_queryset = forms_queryset.filter(submitted_at__gte=month_ago)
        
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="form_data_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        writer = csv.writer(response)
        
        # Write header
        writer.writerow([
            'Form ID', 'School Name', 'School ID', 'District', 'Division', 'Region',
            'Status', 'Current Level', 'Submitted Date', 'Academic Year', 'Form Type',
            'Last Reviewed By', 'Last Reviewed At', 'Created At', 'Updated At'
        ])
        
        # Write data
        for form in forms_queryset.select_related('school', 'school__district', 'school__division', 'school__region', 'last_reviewed_by'):
            writer.writerow([
                form.form_id,
                form.school.school_name,
                form.school.school_id,
                form.school.district.name if form.school.district else '',
                form.school.division.name if form.school.division else '',
                form.school.region.name if form.school.region else '',
                form.status,
                form.current_level,
                form.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if form.submitted_at else '',
                form.academic_year,
                form.form_type,
                form.last_reviewed_by.username if form.last_reviewed_by else '',
                form.last_reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if form.last_reviewed_at else '',
                form.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                form.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            ])
        
        return response
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to export forms: {str(e)}'
        })


@csrf_exempt
@require_GET
def api_notifications(request):
    """Get notifications for the current admin"""
    admin_id = request.session.get('admin_id')
    
    try:
        # Get unread notifications
        notifications = FormNotification.objects.filter(
            recipient__admin_id=admin_id,
            is_read=False
        ).order_by('-created_at')[:10]
        
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'id': notification.notification_id,
                'title': notification.title,
                'message': notification.message,
                'type': notification.notification_type,
                'priority': notification.priority,
                'created_at': notification.created_at.isoformat(),
                'action_required': notification.action_required,
                'action_url': notification.action_url,
            })
        
        # Mark notifications as read
        notifications.update(is_read=True, read_at=timezone.now())
        
        return JsonResponse({
            'success': True,
            'notifications': notifications_data,
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Failed to get notifications: {str(e)}'
        })


# Helper functions

def get_accessible_forms(admin_id):
    """Get forms accessible by the admin based on their level and scope"""
    # DEVELOPMENT BYPASS - Return all forms for central office
    from django.conf import settings
    if getattr(settings, 'DEBUG', False) and admin_id == 2:
        return Form.objects.select_related(
            'school', 'school__district', 'school__division', 'school__region', 'user'
        ).all()
    
    # TODO: Implement proper scope-based filtering
    # For now, return all forms (should be filtered by admin level and geographic scope)
    return Form.objects.select_related(
        'school', 'school__district', 'school__division', 'school__region', 'user'
    ).all()


def can_access_form(admin_id, form):
    """Check if admin can access a specific form"""
    # DEVELOPMENT BYPASS - Allow all access for central office
    from django.conf import settings
    if getattr(settings, 'DEBUG', False) and admin_id == 2:
        return True
    
    # TODO: Implement proper permission checking based on admin level and geographic scope
    return True


def get_admin_user(admin_id):
    """Get AdminUser instance"""
    # DEVELOPMENT BYPASS - Create mock admin user
    from django.conf import settings
    if getattr(settings, 'DEBUG', False) and admin_id == 2:
        class MockAdminUser:
            admin_id = 2
            username = 'admin'
            admin_level = 'central'
            
        return MockAdminUser()
    
    # TODO: Implement proper admin user retrieval
    return AdminUser.objects.get(admin_id=admin_id)


def send_notification_to_next_level(form, sender, notification_type, comments):
    """Send notification to the next level in the workflow"""
    try:
        # Determine recipients based on next level
        next_level = form.get_next_level()
        if not next_level or next_level == 'completed':
            return
        
        # Get recipients for the next level
        recipients = get_recipients_for_level(next_level, form.school)
        
        # Create notifications
        for recipient in recipients:
            FormNotification.objects.create(
                form=form,
                recipient=recipient,
                sender=sender,
                notification_type=notification_type,
                title=f"Form Approved - {form.school.school_name}",
                message=f"Form for {form.school.school_name} has been approved and is now pending your review.",
                priority='medium',
                action_required=True,
                action_url=f"/admin/form-management/?form_id={form.form_id}",
                metadata={'comments': comments}
            )
    except Exception as e:
        print(f"Failed to send notification to next level: {e}")


def send_notification_to_previous_level(form, sender, notification_type, comments):
    """Send notification to the previous level in the workflow"""
    try:
        # Determine recipients based on previous level
        previous_level = form.get_previous_level()
        if not previous_level:
            return
        
        # Get recipients for the previous level
        recipients = get_recipients_for_level(previous_level, form.school)
        
        # Create notifications
        for recipient in recipients:
            FormNotification.objects.create(
                form=form,
                recipient=recipient,
                sender=sender,
                notification_type=notification_type,
                title=f"Form Returned - {form.school.school_name}",
                message=f"Form for {form.school.school_name} has been returned for revision. Comments: {comments}",
                priority='high',
                action_required=True,
                action_url=f"/admin/form-management/?form_id={form.form_id}",
                metadata={'comments': comments}
            )
    except Exception as e:
        print(f"Failed to send notification to previous level: {e}")


def get_recipients_for_level(level, school):
    """Get admin users who should receive notifications for a specific level"""
    # TODO: Implement proper recipient logic based on geographic scope
    # For now, return empty list
    return []


def log_admin_activity(admin_user, action, resource_type, description, metadata=None):
    """Log admin activity"""
    try:
        # TODO: Implement proper activity logging
        print(f"Admin Activity: {admin_user.username} - {action} - {description}")
    except Exception as e:
        print(f"Failed to log admin activity: {e}")


# Form Management functionality moved to form_management_views.py