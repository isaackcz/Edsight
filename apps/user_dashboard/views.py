"""
User Dashboard Views
Separate views for each user dashboard page: overview, form, analytics, settings
"""
from datetime import timedelta

from django.shortcuts import render, redirect
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate, TruncMonth
from django.http import HttpResponse
from django.conf import settings
import os

from apps.core.models import AdminUser, Form, Answer, Question, Category, Topic, FormNotification, FormDeadline
from apps.core.decorators import session_required, only_school_users


def get_user_context(request):
    """
    Helper function to get authenticated user context.
    Returns user context dict or None if not authenticated.
    """
    # Enhanced session authentication check
    admin_id = request.session.get('admin_id')
    
    # If no admin_id, try alternative authentication methods
    if not admin_id:
        # Check if user is authenticated via Django auth (fallback)
        if request.user.is_authenticated:
            # Try to find corresponding AdminUser
            try:
                admin_user = AdminUser.objects.filter(email=request.user.email).first()
                if admin_user:
                    admin_id = admin_user.admin_id
                    # Update session
                    request.session['admin_id'] = admin_id
                    request.session['user_type'] = 'school_user' if admin_user.admin_level == 'school' else 'admin'
                    request.session['email'] = admin_user.email
                    request.session['admin_level'] = admin_user.admin_level
                    request.session.save()
            except Exception as e:
                print(f"Error finding AdminUser: {e}")
        
        # If still no admin_id, return None
        if not admin_id:
            return None
    
    try:
        # Get the AdminUser record
        admin_user = AdminUser.objects.select_related(
            'school', 'region', 'division', 'district'
        ).get(admin_id=admin_id)
        
        context = {
            'user': {
                'id': admin_user.admin_id,
                'username': admin_user.username,
                'email': admin_user.email,
                'school_name': admin_user.school.school_name if admin_user.school else admin_user.assigned_area,
                'role': admin_user.admin_level,
                'region': admin_user.region.name if admin_user.region else '',
                'division': admin_user.division.name if admin_user.division else '',
                'district': admin_user.district.name if admin_user.district else '',
                'is_authenticated': True
            },
            'admin_user': admin_user,
            'school_name': admin_user.school.school_name if admin_user.school else admin_user.assigned_area,
            'role': admin_user.admin_level,
            'full_name': admin_user.full_name,
            'assigned_area': admin_user.assigned_area,
            'admin_level': admin_user.admin_level,
            'user_type': request.session.get('user_type', 'school_user')
        }
        
        return context
        
    except AdminUser.DoesNotExist:
        return None


@session_required
@only_school_users
def user_dashboard_overview(request):
    """
    User Dashboard Overview Page
    Shows stats, recent activity, deadline tracker, quick actions
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/')
    
    # Compute overview stats
    admin_user = context['admin_user']
    stats = _get_overview_stats(admin_user)
    deadline_info = _get_deadline_info(admin_user)
    donut_data = _get_donut_chart_data(admin_user)
    workflow_status = _get_workflow_status(admin_user)

    context['overview_stats'] = stats
    context['deadline'] = deadline_info
    context['donut_data'] = donut_data
    context['workflow_status'] = workflow_status

    # Add page-specific context
    context['active_page'] = 'overview'
    
    return render(request, 'user_dashboard/overview.html', context)


@session_required
@only_school_users
def user_dashboard_form(request):
    """
    User Dashboard Form Page
    Application form with tree view navigation
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/form/')
    
    # Get deadline info to check if form should be disabled
    admin_user = context['admin_user']
    deadline_info = _get_deadline_info(admin_user)
    
    # Check if deadline has passed
    is_deadline_passed = False
    if deadline_info.get('has_deadline'):
        is_deadline_passed = deadline_info.get('is_overdue', False) or deadline_info.get('days_remaining', 0) < 0
    
    # Add page-specific context
    context['active_page'] = 'form'
    context['deadline'] = deadline_info
    context['is_deadline_passed'] = is_deadline_passed
    context['form_disabled'] = is_deadline_passed  # Disable form if deadline passed
    
    # TODO: Add form data
    # context['form_sections'] = get_form_sections(request)
    # context['form_progress'] = get_form_progress(request)
    
    return render(request, 'user_dashboard/form.html', context)


@session_required
@only_school_users
def user_dashboard_analytics(request):
    """
    User Dashboard Analytics Page
    Charts, progress tracking, and insights
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/analytics/')
    
    # Add page-specific context
    context['active_page'] = 'analytics'
    
    # TODO: Add analytics data
    # context['progress_timeline'] = get_progress_timeline(request)
    # context['category_status'] = get_category_status(request)
    # context['completion_stats'] = get_completion_stats(request)
    
    return render(request, 'user_dashboard/analytics.html', context)


@session_required
@only_school_users
def user_dashboard_settings(request):
    """
    User Dashboard Settings Page
    Profile, security, sessions, audit logs, preferences
    """
    context = get_user_context(request)
    
    if context is None:
        return redirect('/auth/login/?next=/user/dashboard/settings/')
    
    # Add page-specific context
    context['active_page'] = 'settings'
    
    # TODO: Add settings data
    # context['active_sessions'] = get_active_sessions(request)
    # context['audit_logs'] = get_audit_logs(request)
    # context['preferences'] = get_user_preferences(request)
    
    return render(request, 'user_dashboard/settings.html', context)


def service_worker(request):
    """
    Serve service worker with proper scope header
    """
    sw_path = os.path.join(settings.BASE_DIR, 'app', 'static', 'service-worker.js')
    
    try:
        with open(sw_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        response = HttpResponse(content, content_type='application/javascript')
        # Set Service-Worker-Allowed header to allow broader scope
        response['Service-Worker-Allowed'] = '/'
        # Add cache headers for better performance
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    except FileNotFoundError:
        return HttpResponse('Service worker not found', status=404)


def _get_overview_stats(admin_user):
    """
    Build basic overview statistics for the current admin user.
    """
    user_forms = Form.objects.filter(admin_user=admin_user)
    total_questions = Question.objects.count()

    answered_questions = Answer.objects.filter(
        form__in=user_forms,
        response__isnull=False
    ).exclude(response='').count()

    completion_rate = (
        round((answered_questions / total_questions) * 100, 1)
        if total_questions > 0 else 0
    )

    remaining_questions = max(total_questions - answered_questions, 0)

    submitted_forms = user_forms.filter(
        status__in=['submitted', 'completed']
    ).count()

    return {
        'answered_questions': answered_questions,
        'remaining_questions': remaining_questions,
        'total_questions': total_questions,
        'completion_rate': completion_rate,
        'submitted_forms': submitted_forms,
    }


def _get_deadline_info(admin_user):
    """
    Gather deadline metadata from FormDeadline for the user's region.
    Gets the deadline set by Region admin for the user's school's region.
    """
    # Get user's school and region
    if not admin_user.school or not admin_user.school.region:
        return {
            'has_deadline': False,
            'progress_percent': 0,
            'label': 'No deadline set for your region',
            'due_date': None,
            'form_type': None,
            'description': None,
        }
    
    region_id = admin_user.school.region_id
    
    # Get user's form to determine form_type
    user_form = Form.objects.filter(admin_user=admin_user).first()
    form_type = user_form.form_type if user_form else 'annual'  # Default to annual if no form
    
    # Get the active deadline for this region and form_type
    deadline = FormDeadline.objects.filter(
        region_id=region_id,
        form_type=form_type,
        is_active=True
    ).select_related('region').first()
    
    # If no deadline for this form_type, try to get any deadline for the region
    if not deadline:
        deadline = FormDeadline.objects.filter(
            region_id=region_id,
            is_active=True
        ).select_related('region').order_by('-deadline_date').first()
    
    if not deadline:
        return {
            'has_deadline': False,
            'progress_percent': 0,
            'label': 'No deadline set for your region',
            'due_date': None,
            'form_type': None,
            'description': None,
        }
    
    due_date = deadline.deadline_date
    now = timezone.now()
    
    # Calculate days remaining
    days_remaining = (due_date.date() - now.date()).days
    
    # Calculate progress percentage
    # Always use a consistent 30-day window before the deadline
    # This ensures progress is always relative to a meaningful timeframe
    # Start reference is ALWAYS 30 days before deadline (standardized window)
    # This gives users a consistent reference point regardless of when the deadline was created
    start_reference = due_date - timedelta(days=30)
    
    # Calculate total time window and elapsed time
    # Use total_seconds() for more precise calculation (handles partial days)
    total_window_seconds = max((due_date - start_reference).total_seconds(), 1)
    
    # Calculate elapsed time from start reference to now
    # If now is before start_reference (shouldn't happen, but handle it), use 0
    elapsed_seconds = max((now - start_reference).total_seconds(), 0)
    
    # Progress percentage = (elapsed time / total time) * 100
    # This shows how much of the 30-day deadline window has passed
    # Example: If deadline is in 1 day and window is 30 days, then 29 days elapsed = 96.7%
    progress_percent = min(100, max(0, (elapsed_seconds / total_window_seconds) * 100))
    
    # If overdue, show 100%
    if due_date < now:
        days_overdue = abs(days_remaining)
        label = f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}"
        progress_percent = 100
    elif days_remaining == 0:
        label = "Due today"
        # Progress is already calculated correctly above using seconds
        # No need to recalculate - the seconds-based calculation handles partial days
    elif days_remaining == 1:
        label = "1 day remaining"
    else:
        label = f"{days_remaining} day{'s' if days_remaining != 1 else ''} remaining"
    
    return {
        'has_deadline': True,
        'progress_percent': round(progress_percent, 1),
        'label': label,
        'due_date': due_date,
        'form_type': deadline.form_type,
        'description': deadline.description,
        'region_name': deadline.region.name if deadline.region else 'your region',
        'days_remaining': days_remaining,
        'is_overdue': due_date < now,
    }


def _get_donut_chart_data(admin_user):
    """
    Calculate completion percentages for questions, topics, and categories.
    """
    user_forms = Form.objects.filter(admin_user=admin_user)
    
    # Get user's form (don't create if doesn't exist)
    form = user_forms.first()
    
    if not form:
        return {
            'questions': {'answered': 0, 'total': 0, 'percentage': 0},
            'topics': {'completed': 0, 'total': 0, 'percentage': 0},
            'categories': {'completed': 0, 'total': 0, 'percentage': 0},
        }
    
    # Questions data
    total_questions = Question.objects.count()
    answered_questions = Answer.objects.filter(
        form=form,
        response__isnull=False
    ).exclude(response='').count()
    questions_percentage = round((answered_questions / total_questions * 100) if total_questions > 0 else 0, 1)
    
    # Topics data
    topics = Topic.objects.annotate(total_questions=Count('question'))
    total_topics = topics.count()
    completed_topics = 0
    
    for topic in topics:
        answered_in_topic = Answer.objects.filter(
            form=form,
            question__topic=topic
        ).exclude(response='').count()
        
        if answered_in_topic == topic.total_questions and topic.total_questions > 0:
            completed_topics += 1
    
    topics_percentage = round((completed_topics / total_topics * 100) if total_topics > 0 else 0, 1)
    
    # Categories data
    categories = Category.objects.annotate(total_topics=Count('topic'))
    total_categories = categories.count()
    completed_categories = 0
    
    for category in categories:
        category_topics = Topic.objects.filter(category=category).annotate(total_questions=Count('question'))
        all_topics_complete = True
        
        for topic in category_topics:
            answered_in_topic = Answer.objects.filter(
                form=form,
                question__topic=topic
            ).exclude(response='').count()
            
            if answered_in_topic != topic.total_questions or topic.total_questions == 0:
                all_topics_complete = False
                break
        
        if all_topics_complete and category_topics.count() > 0:
            completed_categories += 1
    
    categories_percentage = round((completed_categories / total_categories * 100) if total_categories > 0 else 0, 1)
    
    return {
        'questions': {
            'answered': answered_questions,
            'total': total_questions,
            'percentage': questions_percentage
        },
        'topics': {
            'completed': completed_topics,
            'total': total_topics,
            'percentage': topics_percentage
        },
        'categories': {
            'completed': completed_categories,
            'total': total_categories,
            'percentage': categories_percentage
        },
    }


def _get_progress_timeline(admin_user, view_type='daily'):
    """
    Get progress timeline data grouped by day or month.
    Returns list of {date, answered_count} objects.
    """
    user_forms = Form.objects.filter(admin_user=admin_user)
    form = user_forms.first()
    
    if not form:
        return []
    
    # Get all answers with dates
    answers = Answer.objects.filter(
        form=form,
        response__isnull=False
    ).exclude(response='').order_by('answered_at')
    
    if view_type == 'monthly':
        answers_grouped = answers.annotate(
            period=TruncMonth('answered_at')
        ).values('period').annotate(
            count=Count('answer_id')
        ).order_by('period')
    else:  # daily
        answers_grouped = answers.annotate(
            period=TruncDate('answered_at')
        ).values('period').annotate(
            count=Count('answer_id')
        ).order_by('period')
    
    timeline_data = []
    cumulative = 0
    
    for item in answers_grouped:
        cumulative += item['count']
        timeline_data.append({
            'date': item['period'].isoformat() if item['period'] else '',
            'answered': item['count'],
            'cumulative': cumulative
        })
    
    return timeline_data


def _get_user_notifications(admin_user, limit=10):
    """
    Fetch user notifications from FormNotification model.
    """
    notifications = FormNotification.objects.filter(
        recipient=admin_user
    ).select_related('form', 'sender').order_by('-created_at')[:limit]
    
    notifications_data = []
    for notif in notifications:
        notifications_data.append({
            'id': notif.notification_id,
            'title': notif.title,
            'message': notif.message,
            'type': notif.notification_type,
            'priority': notif.priority,
            'is_read': notif.is_read,
            'created_at': notif.created_at.isoformat(),
            'action_required': notif.action_required,
            'action_url': notif.action_url,
        })
    
    return notifications_data


def _get_workflow_status(admin_user):
    """
    Get detailed workflow status information.
    """
    user_forms = Form.objects.filter(admin_user=admin_user)
    form = user_forms.first()
    
    if not form:
        return {
            'current_status': 'draft',
            'current_level': 'school',
            'form_status': 'draft',
            'workflow_status': 'draft',
            'last_updated': None,
            'submitted_at': None,
        }
    
    # Map workflow status to display names
    status_map = {
        'draft': 'Draft',
        'district_pending': 'Pending District Review',
        'district_approved': 'Approved by District',
        'district_returned': 'Returned by District',
        'division_pending': 'Pending Division Review',
        'division_approved': 'Approved by Division',
        'division_returned': 'Returned by Division',
        'region_pending': 'Pending Region Review',
        'region_approved': 'Approved by Region',
        'region_returned': 'Returned by Region',
        'central_pending': 'Pending Central Review',
        'central_approved': 'Approved by Central',
        'central_returned': 'Returned by Central',
        'completed': 'Completed',
    }
    
    level_map = {
        'school': 'School',
        'district': 'District',
        'division': 'Division',
        'region': 'Region',
        'central': 'Central Office',
    }
    
    form_status_map = {
        'draft': 'Draft',
        'in-progress': 'In Progress',
        'submitted': 'Submitted',
        'completed': 'Completed',
    }
    
    return {
        'current_status': status_map.get(form.workflow_status, form.workflow_status),
        'current_level': level_map.get(form.current_level, form.current_level),
        'form_status': form_status_map.get(form.status, form.status),
        'workflow_status': form.workflow_status,
        'last_updated': form.updated_at.isoformat() if form.updated_at else None,
        'submitted_at': form.submitted_at.isoformat() if form.submitted_at else None,
    }

