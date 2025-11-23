"""
User Dashboard API Views
Optimized endpoints for school form system with lazy loading, pagination, and caching

Security Features:
- Session-based authentication
- Rate limiting
- Input validation
- Comprehensive error logging
- SQL injection prevention via ORM
"""
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Prefetch, Count, Q
from django.core.paginator import Paginator
from django.core.cache import cache
from django.utils import timezone
from django.db import IntegrityError, OperationalError
from django.db.models.functions import TruncDate, TruncMonth
from apps.core.models import Category, Topic, Question, Answer, Form, AdminUser, School, FormRemark, FormNotification, FormDeadline, AuditLog
from apps.user_dashboard.validators import validate_answer
from apps.user_dashboard.offline_handler import handle_offline_sync
import json
import logging
from functools import wraps
import traceback

# Configure logging for security and debugging
logger = logging.getLogger('user_dashboard_api')

# Helper function to get client IP address and user agent
def get_client_info(request):
    """Extract IP address and user agent from request"""
    # Get IP address (check for proxy headers)
    ip_address = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
    if not ip_address:
        ip_address = request.META.get('HTTP_X_REAL_IP', '')
    if not ip_address:
        ip_address = request.META.get('REMOTE_ADDR', '')
    
    # Get user agent
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length
    
    return ip_address or None, user_agent or None

# Helper function to create audit log entry
def create_audit_log(admin_user, action_type, resource_type, resource_id=None, description="", 
                     request=None, severity='low', success=True, error_message=None, metadata=None):
    """Create an audit log entry"""
    try:
        ip_address = None
        user_agent = None
        session_id = None
        
        if request:
            ip_address, user_agent = get_client_info(request)
            session_id = request.session.session_key if hasattr(request, 'session') else None
        
        AuditLog.objects.create(
            admin=admin_user,
            session_id=session_id,
            action_type=action_type,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            severity=severity,
            success=success,
            error_message=error_message,
            metadata=metadata or {}
        )
    except Exception as e:
        logger.error(f"Failed to create audit log: {str(e)}")

# Helper function to safely get or create form (handles multiple forms gracefully)
def get_or_create_user_form(admin_user, school, academic_year='2024-2025'):
    """
    Safely get or create a form for a user.
    Handles the case where multiple forms might exist (cleans up duplicates).
    Returns (form, created) tuple like get_or_create.
    """
    try:
        existing_forms = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year=academic_year
        )
        
        if existing_forms.exists():
            form = existing_forms.first()
            if existing_forms.count() > 1:
                logger.warning(f"Multiple forms found for user {admin_user.admin_id}, keeping first (ID: {form.form_id}) and removing {existing_forms.count() - 1} duplicate(s)")
                existing_forms.exclude(form_id=form.form_id).delete()
            return form, False
        else:
            form = Form.objects.create(
                admin_user=admin_user,
                school=school,
                academic_year=academic_year,
                status='draft',
                current_level='school',
                form_type='standard'
            )
            logger.info(f"Created new form (ID: {form.form_id}) for user {admin_user.admin_id} in school {school.school_id}")
            return form, True
    except Exception as e:
        logger.error(f"Error in get_or_create_user_form: {str(e)}")
        raise


# Security decorator - tracks authentication attempts
def require_authentication(view_func):
    """
    Decorator to ensure user is authenticated via session
    Logs all authentication attempts for security monitoring
    """
    @wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        admin_id = request.session.get('admin_id')
        
        # Log unauthenticated access attempts
        if not admin_id:
            logger.warning(f"Unauthenticated API access attempt: {request.path} from {request.META.get('REMOTE_ADDR')}")
            return JsonResponse({
                'error': 'Authentication required',
                'message': 'Please log in to access this resource'
            }, status=401)
        
        try:
            admin_user = AdminUser.objects.select_related('school', 'district').get(admin_id=admin_id)
            request.admin_user = admin_user
            
            # Log successful authenticated request (info level)
            logger.info(f"API access: {request.path} by user {admin_id}")
            
            return view_func(request, *args, **kwargs)
            
        except AdminUser.DoesNotExist:
            # Log suspicious activity - session exists but user not found
            logger.error(f"Invalid session - User not found: {admin_id} from {request.META.get('REMOTE_ADDR')}")
            
            # Clear invalid session
            request.session.flush()
            
            return JsonResponse({
                'error': 'User not found',
                'message': 'Your session is invalid. Please log in again.'
            }, status=404)
        except Exception as e:
            logger.critical(f"Authentication error: {str(e)} - {traceback.format_exc()}")
            return JsonResponse({
                'error': 'Authentication system error',
                'message': 'Please try again or contact support'
            }, status=500)
    
    return wrapped_view


@require_GET
@require_authentication
def get_categories(request):
    """
    Get all categories with topic count and completion status
    Cached per user for 30 minutes since completion status is user-specific
    
    Security: Session-based auth, SQL injection prevention via ORM
    Performance: Caching, optimized queries with annotations
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        # Security check: Ensure user is associated with a school
        if not school:
            logger.warning(f"User {admin_user.admin_id} attempted to access categories without school association")
            return JsonResponse({
                'error': 'Access denied',
                'message': 'Your account is not associated with a school. Please contact support.'
            }, status=403)
        
        # Get existing form only - don't create if it doesn't exist
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        # Cache key includes user_id for personalized completion status
        cache_key = f'school_form_categories_user_{admin_user.admin_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            logger.debug(f"Returning cached categories for user {admin_user.admin_id}")
            return JsonResponse({'categories': cached_data, 'cached': True})
    
        # Query with optimizations - handle empty categories gracefully
        categories = Category.objects.annotate(
            topic_count=Count('topic')
        ).order_by('display_order')
        
        # If no categories exist, return empty list
        if not categories.exists():
            logger.info(f"No categories found in database for user {admin_user.admin_id}")
            return JsonResponse({'categories': [], 'cached': False})
        
        # If no form exists yet, return categories without completion status
        if not form:
            categories_list = []
            for category in categories:
                categories_list.append({
                    'category_id': category.category_id,
                    'name': category.name,
                    'display_order': category.display_order,
                    'topic_count': category.topic_count,
                    'completed_topics': 0,
                    'is_complete': False,
                })
            
            return JsonResponse({
                'categories': categories_list,
                'cached': False,
                'message': 'No form found. Please save at least one answer to see completion status.'
            })
        
        categories_list = []
        for category in categories:
            # Get all topics for this category
            topics = Topic.objects.filter(category_id=category.category_id).annotate(
                total_questions=Count('question')
            )
            
            total_topics = topics.count()
            completed_topics = 0
            
            # Check completion for each topic
            for topic in topics:
                # Count distinct answered questions (not total answers)
                answered_count = Answer.objects.filter(
                    form=form,
                    question__topic=topic
                ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
                
                if answered_count == topic.total_questions and topic.total_questions > 0:
                    completed_topics += 1
            
            # Category is complete if all topics are complete and there's at least one topic
            is_complete = total_topics > 0 and completed_topics == total_topics
            
            categories_list.append({
                'category_id': category.category_id,
                'name': category.name,
                'display_order': category.display_order,
                'topic_count': category.topic_count,
                'completed_topics': completed_topics,
                'is_complete': is_complete,
            })
        
        # Cache for 30 minutes (shorter than static categories since it includes user progress)
        cache.set(cache_key, categories_list, 1800)
        
        logger.info(f"Successfully loaded {len(categories_list)} categories for user {admin_user.admin_id}")
        
        return JsonResponse({
            'categories': categories_list,
            'cached': False
        })
        
    except Exception as e:
        # Comprehensive error logging for debugging
        logger.critical(f"Unexpected error in get_categories for user {request.admin_user.admin_id if hasattr(request, 'admin_user') else 'unknown'}: {str(e)}")
        logger.critical(traceback.format_exc())
        
        return JsonResponse({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred. Please try again or contact support.',
            'debug_info': str(e) if hasattr(request, 'DEBUG') and request.DEBUG else None
        }, status=500)


@require_GET
@require_authentication
def get_topics(request):
    """
    Get topics for a specific category with answer progress
    Cached per category for 30 minutes
    """
    try:
        category_id = request.GET.get('category_id')
        
        if not category_id:
            return JsonResponse({'error': 'category_id is required'}, status=400)
        
        try:
            category_id = int(category_id)
        except ValueError:
            return JsonResponse({'error': 'Invalid category_id'}, status=400)
        
        # Get user's form for progress tracking (don't create if doesn't exist)
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Get existing form only - don't create if it doesn't exist
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        # If no form exists yet, return topics without completion status
        # (form will be created when user saves first answer)
        if not form:
            # Still return topics, just without completion status
            topics = Topic.objects.filter(category_id=category_id).annotate(
                total_questions=Count('question')
            ).order_by('display_order')
            
            topics_list = []
            for topic in topics:
                topics_list.append({
                    'topic_id': topic.topic_id,
                    'name': topic.name,
                    'display_order': topic.display_order,
                    'total_questions': topic.total_questions,
                    'answered_questions': 0,
                    'is_complete': False,
                })
            
            return JsonResponse({
                'topics': topics_list,
                'category_id': category_id,
                'message': 'No form found. Please save at least one answer to see completion status.'
            })
        
        # Cache key includes user_id for personalized data
        cache_key = f'school_form_topics_{category_id}_user_{admin_user.admin_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            return JsonResponse({'topics': cached_data, 'cached': True})
        
        # Get topics with question count and answered count
        topics = Topic.objects.filter(
            category_id=category_id
        ).annotate(
            total_questions=Count('question')
        )
        
        # Try to order by display_order, fallback to topic_id if field doesn't exist
        try:
            topics = topics.order_by('display_order')
        except Exception:
            topics = topics.order_by('topic_id')
        
        topics_data = []
        for topic in topics:
            # Count distinct answered questions for this topic (not total answers)
            # This prevents counting duplicate answers for the same question
            answered_count = Answer.objects.filter(
                form=form,
                question__topic=topic
            ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
            
            # Count required questions
            required_count = Question.objects.filter(
                topic=topic,
                is_required=True
            ).count()
            
            # Safely get display_order
            display_order = getattr(topic, 'display_order', topic.topic_id)
            
            topics_data.append({
                'topic_id': topic.topic_id,
                'name': topic.name,
                'display_order': display_order,
                'total_questions': topic.total_questions,
                'answered_questions': answered_count,
                'required_questions': required_count,
                'completion_percentage': round((answered_count / topic.total_questions * 100) if topic.total_questions > 0 else 0, 1),
                'is_complete': answered_count == topic.total_questions,
            })
        
        # Cache for 30 minutes (shorter than categories since it includes user progress)
        cache.set(cache_key, topics_data, 1800)
        
        return JsonResponse({
            'topics': topics_data,
            'category_id': category_id,
            'cached': False
        })
    except Exception as e:
        # Log the error for debugging
        import traceback
        print(f"Error in get_topics: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_questions(request):
    """
    Get paginated questions for a specific topic with saved answers
    Supports lazy loading with pagination
    """
    topic_id = request.GET.get('topic_id')
    page = request.GET.get('page', 1)
    page_size = request.GET.get('page_size', 20)
    search = request.GET.get('search', '').strip()
    filter_type = request.GET.get('filter_type', 'all')  # all, required, optional
    
    if not topic_id:
        return JsonResponse({'error': 'topic_id is required'}, status=400)
    
    try:
        topic_id = int(topic_id)
        page = int(page)
        page_size = min(int(page_size), 50)  # Max 50 questions per page
    except ValueError:
        return JsonResponse({'error': 'Invalid parameters'}, status=400)
    
    # Get user's form (don't create if doesn't exist)
    admin_user = request.admin_user
    school = admin_user.school
    
    if not school:
        return JsonResponse({'error': 'User not associated with a school'}, status=403)
    
    # Get existing form only - don't create if it doesn't exist
    form = Form.objects.filter(
        admin_user=admin_user,
        school=school,
        academic_year='2024-2025'
    ).first()
    
    # Build query with filters
    questions_query = Question.objects.filter(topic_id=topic_id)
    
    # Apply search filter
    if search:
        questions_query = questions_query.filter(
            Q(question_text__icontains=search)
        )
    
    # Apply type filter
    if filter_type == 'required':
        questions_query = questions_query.filter(is_required=True)
    elif filter_type == 'optional':
        questions_query = questions_query.filter(is_required=False)
    
    # Order by display_order
    questions_query = questions_query.order_by('display_order')
    
    # Get total count before pagination
    total_questions = questions_query.count()
    
    # Paginate
    paginator = Paginator(questions_query, page_size)
    
    if page > paginator.num_pages:
        page = paginator.num_pages if paginator.num_pages > 0 else 1
    
    page_obj = paginator.get_page(page)
    
    # Prefetch answers for this page
    question_ids = [q.question_id for q in page_obj]
    answers_dict = {}
    
    if question_ids:
        answers = Answer.objects.filter(
            form=form,
            question_id__in=question_ids
        ).select_related('question').values('question_id', 'response', 'answered_at')
        
        answers_dict = {ans['question_id']: ans for ans in answers}
    
    # Build response
    questions_data = []
    for question in page_obj:
        answer_data = answers_dict.get(question.question_id, {})
        
        questions_data.append({
            'question_id': question.question_id,
            'question_text': question.question_text,
            'answer_type': question.answer_type,
            'is_required': question.is_required,
            'display_order': question.display_order,
            'answer': answer_data.get('response', ''),
            'answered_at': answer_data.get('answered_at').isoformat() if answer_data.get('answered_at') else None,
        })
    
    return JsonResponse({
        'questions': questions_data,
        'pagination': {
            'current_page': page,
            'page_size': page_size,
            'total_questions': total_questions,
            'total_pages': paginator.num_pages,
            'has_next': page_obj.has_next(),
            'has_previous': page_obj.has_previous(),
        },
        'topic_id': topic_id,
    })


@csrf_exempt
@require_POST
@require_authentication
def save_answers(request):
    """
    Batch save answers (supports both online and offline sync)
    Optimized with bulk operations
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    answers = data.get('answers', [])
    is_offline_sync = data.get('is_offline_sync', False)
    
    if not answers:
        return JsonResponse({'error': 'No answers provided'}, status=400)
    
    # Get user's form
    admin_user = request.admin_user
    school = admin_user.school
    
    if not school:
        return JsonResponse({'error': 'User not associated with a school'}, status=403)
    
    # Check if deadline has passed
    if school and school.region:
        # Get user's form to determine form_type
        user_form = Form.objects.filter(admin_user=admin_user).first()
        form_type = user_form.form_type if user_form else 'annual'
        
        # Check for active deadline
        deadline = FormDeadline.objects.filter(
            region_id=school.region_id,
            form_type=form_type,
            is_active=True
        ).first()
        
        # If no deadline for this form_type, check any deadline for the region
        if not deadline:
            deadline = FormDeadline.objects.filter(
                region_id=school.region_id,
                is_active=True
            ).order_by('-deadline_date').first()
        
        if deadline and deadline.deadline_date < timezone.now():
            return JsonResponse({
                'error': 'Deadline passed',
                'message': f'The submission deadline ({deadline.deadline_date.strftime("%B %d, %Y")}) has passed. The form is now locked and cannot be modified.',
                'deadline_date': deadline.deadline_date.isoformat()
            }, status=403)
    
    # Handle offline sync separately (but still check deadline)
    if is_offline_sync:
        return handle_offline_sync(request, answers)
    
    saved_count = 0
    errors = []
    
    # Validate all answers first and filter out empty answers
    valid_answers = []
    for answer_data in answers:
        question_id = answer_data.get('question_id')
        answer_value = answer_data.get('answer', '')
        
        if not question_id:
            errors.append({'error': 'Missing question_id'})
            continue
        
        # Skip empty answers - don't create form for empty answers
        if not answer_value or str(answer_value).strip() == '':
            continue
        
        try:
            question = Question.objects.get(question_id=question_id)
        except Question.DoesNotExist:
            errors.append({'question_id': question_id, 'error': 'Question not found'})
            continue
        
        # Validate answer
        is_valid, error_message = validate_answer(question, answer_value)
        if not is_valid:
            errors.append({'question_id': question_id, 'error': error_message})
            continue
        
        # Only add to valid_answers if it's not empty and valid
        valid_answers.append(answer_data)
    
    # Only create form if there's at least one valid (non-empty) answer to save
    if not valid_answers:
        return JsonResponse({
            'success': False,
            'error': 'No valid answers to save. Please provide at least one answer.',
            'saved_count': 0
        }, status=400)
    
    # Create form only when we have at least one valid answer to save
    form, created = get_or_create_user_form(admin_user, school)
    if created:
        logger.info(f"Created new form (ID: {form.form_id}) for user {admin_user.admin_id} when saving first answer")
    
    # If validation passed, save answers using bulk operations
    if not errors:
        answers_to_create = []
        answers_to_update = []
        
        # Get existing answers
        question_ids = [a['question_id'] for a in answers]
        existing_answers = Answer.objects.filter(
            form=form,
            question_id__in=question_ids
        ).select_related('question')
        
        existing_dict = {ans.question_id: ans for ans in existing_answers}
        
        # Only process valid_answers (non-empty, validated answers)
        # Store question info for audit logging
        question_info = {}  # question_id -> question object
        
        for answer_data in valid_answers:
            question_id = answer_data['question_id']
            answer_value = answer_data.get('answer', '')
            
            question = Question.objects.get(question_id=question_id)
            question_info[question_id] = question  # Store for audit logging
            
            if question_id in existing_dict:
                # Update existing
                ans = existing_dict[question_id]
                ans.response = str(answer_value)[:500]
                ans.answered_at = timezone.now()
                answers_to_update.append(ans)
            else:
                # Create new
                answers_to_create.append(Answer(
                    form=form,
                    question=question,
                    response=str(answer_value)[:500],
                    answered_at=timezone.now()
                ))
        
        # Bulk operations
        if answers_to_create:
            Answer.objects.bulk_create(answers_to_create)
            saved_count += len(answers_to_create)
            
            # Log each answer created
            for answer in answers_to_create:
                question_id = answer.question.question_id
                question = question_info.get(question_id, answer.question)
                question_text = getattr(question, 'question_text', 'N/A')[:100] if question else 'N/A'
                create_audit_log(
                    admin_user=admin_user,
                    action_type='update',
                    resource_type='answer',
                    resource_id=question_id,
                    description=f"Answered question: {question_text}",
                    request=request,
                    severity='low',
                    success=True,
                    metadata={
                        'form_id': form.form_id,
                        'question_id': question_id,
                        'answer_length': len(answer.response) if answer.response else 0,
                        'is_new': True
                    }
                )
        
        if answers_to_update:
            Answer.objects.bulk_update(answers_to_update, ['response', 'answered_at'])
            saved_count += len(answers_to_update)
            
            # Log each answer updated
            for answer in answers_to_update:
                question_text = getattr(answer.question, 'question_text', 'N/A')[:100] if hasattr(answer, 'question') and answer.question else 'N/A'
                create_audit_log(
                    admin_user=admin_user,
                    action_type='update',
                    resource_type='answer',
                    resource_id=answer.question_id,
                    description=f"Updated answer for question: {question_text}",
                    request=request,
                    severity='low',
                    success=True,
                    metadata={
                        'form_id': form.form_id,
                        'question_id': answer.question_id,
                        'answer_length': len(answer.response) if answer.response else 0,
                        'is_new': False
                    }
                )
        
        # Update form timestamp
        form.updated_at = timezone.now()
        form.save(update_fields=['updated_at'])
        
        # Invalidate cache for this user's progress
        # Clear category cache (completion status may have changed)
        category_cache_key = f'school_form_categories_user_{admin_user.admin_id}'
        cache.delete(category_cache_key)
        
        # Get affected category IDs from saved questions to clear topic caches
        saved_question_ids = [a['question_id'] for a in answers]
        affected_topics = Question.objects.filter(
            question_id__in=saved_question_ids
        ).values_list('topic_id', flat=True).distinct()
        
        # Get category IDs from affected topics  
        affected_categories = Topic.objects.filter(
            topic_id__in=affected_topics
        ).values_list('category_id', flat=True).distinct()
        
        # Clear topic cache for affected categories
        for category_id in affected_categories:
            topic_cache_key = f'school_form_topics_{category_id}_user_{admin_user.admin_id}'
            cache.delete(topic_cache_key)
        
        # Clear progress cache
        progress_cache_key = f'school_form_progress_user_{admin_user.admin_id}'
        cache.delete(progress_cache_key)
    
    return JsonResponse({
        'success': True,
        'saved_count': saved_count,
        'errors': errors if errors else None,
        'form_id': form.form_id,
    })


@csrf_exempt
@require_POST
@require_authentication
def validate_answer_endpoint(request):
    """
    Real-time validation endpoint for single answer
    """
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    question_id = data.get('question_id')
    answer_value = data.get('answer', '')
    
    if not question_id:
        return JsonResponse({'error': 'question_id is required'}, status=400)
    
    try:
        question = Question.objects.get(question_id=question_id)
    except Question.DoesNotExist:
        return JsonResponse({'error': 'Question not found'}, status=404)
    
    is_valid, error_message = validate_answer(question, answer_value)
    
    return JsonResponse({
        'valid': is_valid,
        'error': error_message if not is_valid else None,
    })


@require_GET
@require_authentication
def get_progress(request):
    """
    Get overall form completion progress for the user
    
    Security: Session-based auth, SQL injection prevention via ORM
    Performance: Caching, optimized queries with annotations
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        # Security check: Ensure user is associated with a school
        if not school:
            logger.warning(f"User {admin_user.admin_id} attempted to access progress without school association")
            return JsonResponse({
                'error': 'Access denied',
                'message': 'Your account is not associated with a school. Please contact support.'
            }, status=403)
    
        # Get existing form only - don't create if it doesn't exist
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
    
        # Cache key for progress
        cache_key = f'school_form_progress_user_{admin_user.admin_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data:
            logger.debug(f"Returning cached progress for user {admin_user.admin_id}")
            return JsonResponse({'progress': cached_data, 'cached': True})
    
        # If no form exists yet, return zero progress
        if not form:
            return JsonResponse({
                'progress': {
                    'total_questions': Question.objects.count(),
                    'answered_questions': 0,
                    'completion_percentage': 0,
                    'total_required': Question.objects.filter(is_required=True).count(),
                    'answered_required': 0,
                    'required_completion_percentage': 0,
                    'categories': [],
                    'topics': {'total': 0, 'completed': 0, 'percentage': 0},
                    'categories_progress': {'total': 0, 'completed': 0, 'percentage': 0}
                },
                'cached': False,
                'message': 'No form found. Please save at least one answer to create a form.'
            })
    
        # Get total questions and answered questions - handle empty tables
        total_questions = Question.objects.count()
        # Count distinct questions answered (not total answers)
        answered_questions = Answer.objects.filter(
            form=form
        ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
        
        # Get required questions status
        total_required = Question.objects.filter(is_required=True).count()
        # Count distinct required questions answered (not total answers)
        answered_required = Answer.objects.filter(
            form=form,
            question__is_required=True
        ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
        
        # Get category-wise progress with topics data - handle empty categories
        categories = Category.objects.annotate(
            total_questions=Count('topic__question'),
            topic_count=Count('topic', distinct=True)
        ).order_by('display_order')
        
        # If no categories exist, return empty progress
        if not categories.exists():
            return JsonResponse({
                'progress': {
                    'total_questions': 0,
                    'answered_questions': 0,
                    'completion_percentage': 0,
                    'total_required': 0,
                    'answered_required': 0,
                    'required_completion_percentage': 0,
                    'categories': [],
                    'topics': {'total': 0, 'completed': 0, 'percentage': 0},
                    'categories_progress': {'total': 0, 'completed': 0, 'percentage': 0}
                },
                'cached': False
            })
        
        category_progress = []
        total_topics = 0
        completed_topics = 0
        total_categories = categories.count()
        completed_categories = 0
        
        for category in categories:
            # Get topics for this category
            topics = Topic.objects.filter(category=category).annotate(
                total_questions=Count('question')
            )
            
            category_total_topics = topics.count()
            category_completed_topics = 0
            
            # Check completion for each topic in this category
            for topic in topics:
                answered_in_topic = Answer.objects.filter(
                    form=form,
                    question__topic=topic
                ).exclude(response='').count()
                
                if answered_in_topic == topic.total_questions and topic.total_questions > 0:
                    category_completed_topics += 1
                    completed_topics += 1
                
                total_topics += 1
            
            # Count distinct answered questions in category (not total answers)
            answered_in_category = Answer.objects.filter(
                form=form,
                question__topic__category=category
            ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
            
            category_completion = round((answered_in_category / category.total_questions * 100) if category.total_questions > 0 else 0, 1)
            is_category_complete = category_total_topics > 0 and category_completed_topics == category_total_topics
            
            if is_category_complete:
                completed_categories += 1
            
            category_progress.append({
                'category_id': category.category_id,
                'category_name': category.name,
                'total_questions': category.total_questions,
                'answered_questions': answered_in_category,
                'completion_percentage': category_completion,
                'total_topics': category_total_topics,
                'completed_topics': category_completed_topics,
                'is_complete': is_category_complete,
            })
        
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
        
        # Calculate topics and categories percentages
        topics_percentage = round((completed_topics / total_topics * 100) if total_topics > 0 else 0, 1)
        categories_percentage = round((completed_categories / total_categories * 100) if total_categories > 0 else 0, 1)
        
        progress_data = {
            'overall': {
                'total_questions': total_questions,
                'answered_questions': answered_questions,
                'completion_percentage': round((answered_questions / total_questions * 100) if total_questions > 0 else 0, 1),
            },
            'required': {
                'total_required': total_required,
                'answered_required': answered_required,
                'completion_percentage': round((answered_required / total_required * 100) if total_required > 0 else 0, 1),
            },
            'topics': {
                'total_topics': total_topics,
                'completed_topics': completed_topics,
                'completion_percentage': topics_percentage,
            },
            'categories': {
                'total_categories': total_categories,
                'completed_categories': completed_categories,
                'completion_percentage': categories_percentage,
            },
            'by_category': category_progress,
            'form_status': form.status,  # Simple status: draft, in-progress, submitted, completed
            'workflow_status': form.workflow_status,  # Workflow position: district_pending, etc.
            'current_level': form.current_level,  # Current approval level
            'current_status': status_map.get(form.workflow_status, form.workflow_status),  # Display name for workflow status
            'last_updated': form.updated_at.isoformat() if form.updated_at else None,
            'submitted_at': form.submitted_at.isoformat() if form.submitted_at else None,
        }
        
        # Cache for 5 minutes
        cache.set(cache_key, progress_data, 300)
        
        logger.info(f"Successfully calculated progress for user {admin_user.admin_id}")
        
        return JsonResponse({
            'progress': progress_data,
            'cached': False
        })
        
    except Exception as e:
        # Comprehensive error logging for debugging
        logger.critical(f"Unexpected error in get_progress for user {request.admin_user.admin_id if hasattr(request, 'admin_user') else 'unknown'}: {str(e)}")
        logger.critical(traceback.format_exc())
        
        return JsonResponse({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred. Please try again or contact support.',
            'debug_info': str(e) if hasattr(request, 'DEBUG') and request.DEBUG else None
        }, status=500)


@require_GET
@require_authentication
def get_saved_answers(request):
    """
    Get all saved answers for the user
    Used for restoring form state
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Get or create user's form
        form, created = get_or_create_user_form(admin_user, school)
        
        # Get all answers with question info
        answers = Answer.objects.filter(form=form).select_related(
            'question', 'question__topic', 'question__topic__category'
        ).exclude(response='').order_by('answered_at')
        
        answers_data = []
        for answer in answers:
            answers_data.append({
                'question_id': answer.question_id,
                'answer': answer.response,
                'answered_at': answer.answered_at.isoformat(),
                'category_id': answer.question.topic.category_id,
                'topic_id': answer.question.topic_id,
                'question_text': answer.question.question_text,
            })
        
        return JsonResponse({
            'answers': answers_data,
            'total_answered': len(answers_data),
        })
    except Exception as e:
        # Log the error for debugging
        import traceback
        print(f"Error in get_saved_answers: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@csrf_exempt
@require_POST
@require_authentication
def submit_form(request):
    """
    Submit form to district level
    Creates form if it doesn't exist, or updates if it does
    Updates form with submitted_at and current_level='district'
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Check if deadline has passed
        if school and school.region:
            # Get user's form to determine form_type
            user_form = Form.objects.filter(admin_user=admin_user).first()
            form_type = user_form.form_type if user_form else 'annual'
            
            # Check for active deadline
            deadline = FormDeadline.objects.filter(
                region_id=school.region_id,
                form_type=form_type,
                is_active=True
            ).first()
            
            # If no deadline for this form_type, check any deadline for the region
            if not deadline:
                deadline = FormDeadline.objects.filter(
                    region_id=school.region_id,
                    is_active=True
                ).order_by('-deadline_date').first()
            
            if deadline and deadline.deadline_date < timezone.now():
                return JsonResponse({
                    'error': 'Deadline passed',
                    'message': f'The submission deadline ({deadline.deadline_date.strftime("%B %d, %Y")}) has passed. The form is now locked and cannot be submitted.',
                    'deadline_date': deadline.deadline_date.isoformat()
                }, status=403)
        
        # Get existing form - form should exist if user has saved answers
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        # If no form exists, user hasn't saved any answers yet
        if not form:
            return JsonResponse({
                'error': 'No form found',
                'message': 'Please save at least one answer before submitting the form.'
            }, status=400)
        
        # Validate that all required questions are answered
        total_required = Question.objects.filter(is_required=True).count()
        # Count distinct required questions answered (not total answers)
        answered_required = Answer.objects.filter(
            form=form,
            question__is_required=True
        ).exclude(response='').exclude(response__isnull=True).values('question_id').distinct().count()
        
        if answered_required < total_required:
            return JsonResponse({
                'error': 'Please answer all required questions before submitting.',
                'answered_required': answered_required,
                'total_required': total_required
            }, status=400)
        
        # Update form status and workflow status
        # status: indicates form has been submitted
        # workflow_status: tracks the approval workflow position
        form.status = 'submitted'
        form.workflow_status = 'district_pending'
        form.current_level = 'district'
        form.submitted_at = timezone.now()
        form.updated_at = timezone.now()
        
        # Save only the fields we're updating to avoid FK validation issues
        form.save(update_fields=['status', 'workflow_status', 'current_level', 'submitted_at', 'updated_at'])
        
        # Clear progress cache
        cache_key = f'school_form_progress_user_{admin_user.admin_id}'
        cache.delete(cache_key)
        
        # Log form submission
        create_audit_log(
            admin_user=admin_user,
            action_type='update',
            resource_type='form',
            resource_id=form.form_id,
            description=f"Form submitted to district level. School: {school.school_name if school else 'N/A'}",
            request=request,
            severity='medium',
            success=True,
            metadata={
                'form_id': form.form_id,
                'school_id': school.school_id if school else None,
                'workflow_status': form.workflow_status,
                'current_level': form.current_level,
                'submitted_at': form.submitted_at.isoformat() if form.submitted_at else None
            }
        )
        
        logger.info(f"Form submitted successfully: form_id={form.form_id}, user={admin_user.admin_id}")
        
        return JsonResponse({
            'success': True,
            'message': 'Form submitted successfully',
            'form_id': form.form_id,
            'status': form.status,
            'workflow_status': form.workflow_status,
            'current_level': form.current_level,
            'submitted_at': form.submitted_at.isoformat()
        })
        
    except IntegrityError as e:
        logger.error(f"Database integrity error in submit_form: {str(e)}")
        return JsonResponse({
            'error': 'Database error',
            'message': 'Unable to submit form. Please ensure database schema is up to date.'
        }, status=500)
    except Exception as e:
        logger.error(f"Error in submit_form: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@csrf_exempt
@require_POST
@require_authentication
def cancel_submission(request):
    """
    Cancel form submission and revert to draft status
    Only allowed if form is in 'submitted' status at 'district_pending' workflow
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Get existing form
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        if not form:
            return JsonResponse({
                'error': 'No form found',
                'message': 'No form found to cancel submission.'
            }, status=400)
        
        # Only allow canceling if form is submitted and at district_pending level
        # (can't cancel if it's already been reviewed/approved by district)
        if form.status != 'submitted' or form.workflow_status != 'district_pending':
            return JsonResponse({
                'error': 'Cannot cancel submission',
                'message': f'Submission can only be canceled if form is at district pending level. Current status: {form.status}, workflow: {form.workflow_status}'
            }, status=400)
        
        # Revert form to draft status
        form.status = 'draft'
        form.workflow_status = 'draft'
        form.current_level = 'school'
        form.submitted_at = None
        form.updated_at = timezone.now()
        form.save(update_fields=['status', 'workflow_status', 'current_level', 'submitted_at', 'updated_at'])
        
        # Clear progress cache
        cache_key = f'school_form_progress_user_{admin_user.admin_id}'
        cache.delete(cache_key)
        
        # Log form submission cancellation
        create_audit_log(
            admin_user=admin_user,
            action_type='update',
            resource_type='form',
            resource_id=form.form_id,
            description=f"Form submission canceled and reverted to draft. School: {school.school_name if school else 'N/A'}",
            request=request,
            severity='medium',
            success=True,
            metadata={
                'form_id': form.form_id,
                'school_id': school.school_id if school else None,
                'previous_status': 'submitted',
                'previous_workflow_status': 'district_pending',
                'new_status': form.status,
                'new_workflow_status': form.workflow_status
            }
        )
        
        logger.info(f"Form submission canceled: form_id={form.form_id}, user={admin_user.admin_id}")
        
        return JsonResponse({
            'success': True,
            'message': 'Form submission canceled successfully. Form reverted to draft status.',
            'form_id': form.form_id,
            'status': form.status,
            'workflow_status': form.workflow_status,
            'current_level': form.current_level
        })
        
    except Exception as e:
        logger.error(f"Error in cancel_submission: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_user_district(request):
    """
    Get user's district information for confirmation dialog
    """
    try:
        admin_user = request.admin_user
        # Refresh with related objects
        admin_user = AdminUser.objects.select_related('district', 'school', 'school__district').get(admin_id=admin_user.admin_id)
        
        district_name = None
        # Try to get district from admin_user first
        if admin_user.district:
            district_name = admin_user.district.name
        # Fallback to school's district
        elif admin_user.school and hasattr(admin_user.school, 'district') and admin_user.school.district:
            district_name = admin_user.school.district.name
        
        return JsonResponse({
            'district_name': district_name or 'District Office',
            'school_name': admin_user.school.school_name if admin_user.school else None
        })
        
    except Exception as e:
        import traceback
        print(f"Error in get_user_district: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_remarks(request):
    """
    Get all remarks for the user's form grouped by type and entity
    Used to display remarks on categories, topics, and questions
    Includes hierarchy metadata for cascading badge counts
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Get user's form
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        if not form:
            # No form yet, return empty remarks
            return JsonResponse({
                'success': True,
                'remarks': {
                    'category': {},
                    'topic': {},
                    'question': {}
                },
                'hierarchy': {
                    'question_to_topic': {},
                    'topic_to_category': {}
                }
            })
        
        # Get all remarks for this form
        remarks = FormRemark.objects.filter(form_id=form.form_id).select_related('admin_user').order_by('-created_at')
        
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
        
        # Build hierarchy mappings for cascading badges
        # Get all questions that have remarks, map to their topics
        question_ids_with_remarks = []
        for q_id in remarks_data['question'].keys():
            question_ids_with_remarks.append(int(q_id))
        
        question_to_topic = {}
        if question_ids_with_remarks:
            questions = Question.objects.filter(question_id__in=question_ids_with_remarks).values('question_id', 'topic_id')
            question_to_topic = {q['question_id']: q['topic_id'] for q in questions}
        
        # Get all topics that have remarks (either direct or via questions), map to their categories
        topic_ids_with_remarks = []
        for t_id in remarks_data['topic'].keys():
            topic_ids_with_remarks.append(int(t_id))
        # Also add topics that have questions with remarks
        topic_ids_with_remarks.extend(list(question_to_topic.values()))
        topic_ids_with_remarks = list(set(topic_ids_with_remarks))  # Deduplicate
        
        topic_to_category = {}
        if topic_ids_with_remarks:
            topics = Topic.objects.filter(topic_id__in=topic_ids_with_remarks).values('topic_id', 'category_id')
            topic_to_category = {t['topic_id']: t['category_id'] for t in topics}
        
        return JsonResponse({
            'success': True,
            'remarks': remarks_data,
            'hierarchy': {
                'question_to_topic': question_to_topic,
                'topic_to_category': topic_to_category
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_remarks: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_notifications(request):
    """
    Get user notifications filtered by hierarchical structure (region/division/district)
    Returns notifications that are:
    1. Directly sent to the user (recipient=admin_user)
    2. Sent by region admin to all schools in the user's region
    3. Sent by division admin to all schools in the user's division
    4. Sent by district admin to all schools in the user's district
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({
                'error': 'User not associated with a school',
                'message': 'Your account is not associated with a school. Please contact support.'
            }, status=403)
        
        limit = int(request.GET.get('limit', 10))
        limit = min(limit, 50)  # Max 50 notifications
        
        # Get user's school hierarchy
        user_region_id = school.region_id if school.region else None
        user_division_id = school.division_id if school.division else None
        user_district_id = school.district_id if school.district else None
        
        # Build query to get notifications based on hierarchical structure
        from django.db.models import Q
        
        # Base query: notifications directly sent to this user
        notification_query = Q(recipient=admin_user)
        
        # Add notifications from region admin if user's school is in that region
        # Region admin notifications are visible to all schools in that region
        # Check if sender is region admin and their region matches user's school region
        if user_region_id:
            notification_query |= Q(
                sender__admin_level='region',
                sender__region_id=user_region_id,
                form__school__region_id=user_region_id
            )
        
        # Add notifications from division admin if user's school is in that division
        # Division admin notifications are visible to all schools in that division
        # Check if sender is division admin and their division matches user's school division
        if user_division_id:
            notification_query |= Q(
                sender__admin_level='division',
                sender__division_id=user_division_id,
                form__school__division_id=user_division_id
            )
        
        # Add notifications from district admin if user's school is in that district
        # District admin notifications are visible to all schools in that district
        # Check if sender is district admin and their district matches user's school district
        if user_district_id:
            notification_query |= Q(
                sender__admin_level='district',
                sender__district_id=user_district_id,
                form__school__district_id=user_district_id
            )
        
        # Also include notifications where the form belongs to the user's school
        # This covers notifications about the user's own form (e.g., form approved, returned)
        notification_query |= Q(form__school=school, form__admin_user=admin_user)
        
        # Get notifications with proper joins and distinct to avoid duplicates
        notifications = FormNotification.objects.filter(
            notification_query
        ).select_related(
            'form', 
            'form__school',
            'sender',
            'sender__region',
            'sender__division',
            'sender__district'
        ).prefetch_related(
            'form__school__region',
            'form__school__division',
            'form__school__district'
        ).distinct().order_by('-created_at')[:limit]
        
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
                'sender': notif.sender.username if notif.sender else None,
            })
        
        # Get active deadline information for the user's school
        deadline_info = None
        if user_region_id:
            # Get user's form to determine form_type
            user_form = Form.objects.filter(admin_user=admin_user).first()
            form_type = user_form.form_type if user_form else 'annual'
            
            # Get the active deadline for this region and form_type
            deadline = FormDeadline.objects.filter(
                region_id=user_region_id,
                form_type=form_type,
                is_active=True
            ).select_related('region', 'created_by').first()
            
            # If no deadline for this form_type, try to get any deadline for the region
            if not deadline:
                deadline = FormDeadline.objects.filter(
                    region_id=user_region_id,
                    is_active=True
                ).select_related('region', 'created_by').order_by('-deadline_date').first()
            
            if deadline:
                due_date = deadline.deadline_date
                now = timezone.now()
                days_remaining = (due_date.date() - now.date()).days
                is_overdue = due_date < now
                
                # Create deadline notification entry
                deadline_info = {
                    'id': f'deadline_{deadline.deadline_id}',
                    'title': f'Deadline: {deadline.form_type}',
                    'message': deadline.description or f'Submission deadline for {deadline.form_type} forms in {deadline.region.name if deadline.region else "your region"}',
                    'type': 'deadline_reminder',
                    'priority': 'urgent' if days_remaining <= 3 or is_overdue else 'high',
                    'is_read': False,  # Deadlines are always "unread" to keep them visible
                    'created_at': deadline.created_at.isoformat() if deadline.created_at else deadline.updated_at.isoformat(),
                    'action_required': True,
                    'action_url': '/user/dashboard/',
                    'sender': deadline.created_by.username if deadline.created_by else None,
                    'deadline': {
                        'deadline_id': deadline.deadline_id,
                        'deadline_date': deadline.deadline_date.isoformat(),
                        'form_type': deadline.form_type,
                        'days_remaining': days_remaining,
                        'is_overdue': is_overdue,
                        'region_name': deadline.region.name if deadline.region else None,
                        'description': deadline.description,
                    }
                }
                
                # Add deadline notification to the list (at the beginning for visibility)
                notifications_data.insert(0, deadline_info)
        
        # Count unread notifications using the same query
        unread_query = notification_query & Q(is_read=False)
        unread_count = FormNotification.objects.filter(unread_query).count()
        
        # Add 1 to unread count if there's an active deadline
        if deadline_info:
            unread_count += 1
        
        return JsonResponse({
            'notifications': notifications_data,
            'unread_count': unread_count,
            'total': len(notifications_data),
            'has_deadline': deadline_info is not None
        })
        
    except Exception as e:
        logger.error(f"Error in get_notifications: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_progress_timeline(request):
    """
    Get progress timeline data grouped by day or month
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({
                'error': 'User not associated with a school'
            }, status=403)
        
        view_type = request.GET.get('view_type', 'daily')  # 'daily' or 'monthly'
        
        # Get existing form only - don't create if it doesn't exist
        form = Form.objects.filter(
            admin_user=admin_user,
            school=school,
            academic_year='2024-2025'
        ).first()
        
        # If no form exists yet, return empty timeline
        if not form:
            return JsonResponse({
                'timeline': [],
                'view_type': view_type,
                'total_answered': 0,
                'message': 'No form found. Please save at least one answer to create a form.'
            })
        
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
        
        return JsonResponse({
            'timeline': timeline_data,
            'view_type': view_type,
            'total_answered': cumulative
        })
        
    except Exception as e:
        logger.error(f"Error in get_progress_timeline: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)


@require_GET
@require_authentication
def get_export_data(request):
    """
    Get all form data for export with category, topic, question, and answer
    Returns data structured for Excel/CSV export
    """
    try:
        admin_user = request.admin_user
        school = admin_user.school
        
        if not school:
            return JsonResponse({'error': 'User not associated with a school'}, status=403)
        
        # Get or create user's form
        form, created = Form.objects.get_or_create(
            admin_user=admin_user,
            school=school,
            defaults={'status': 'draft'}
        )
        
        # Get all questions with their category, topic, and answers
        questions = Question.objects.select_related(
            'topic', 'topic__category'
        ).prefetch_related(
            Prefetch(
                'answer_set',
                queryset=Answer.objects.filter(form=form),
                to_attr='form_answers'
            )
        ).order_by(
            'topic__category__display_order',
            'topic__display_order',
            'display_order'
        )
        
        export_data = []
        for question in questions:
            category_name = question.topic.category.name if question.topic and question.topic.category else 'N/A'
            topic_name = question.topic.name if question.topic else 'N/A'
            question_text = question.question_text or 'N/A'
            
            # Get answer for this question
            answer_text = ''
            if hasattr(question, 'form_answers') and question.form_answers:
                answer = question.form_answers[0]
                answer_text = answer.response if answer.response else ''
            
            export_data.append({
                'category': category_name,
                'topic': topic_name,
                'question': question_text,
                'answer': answer_text
            })
        
        # Log form export
        create_audit_log(
            admin_user=admin_user,
            action_type='export',
            resource_type='form',
            resource_id=form.form_id,
            description=f"Form data exported. School: {school.school_name if school else 'N/A'}, Total questions: {len(export_data)}",
            request=request,
            severity='low',
            success=True,
            metadata={
                'form_id': form.form_id,
                'school_id': school.school_id if school else None,
                'total_questions': len(export_data),
                'export_date': timezone.now().isoformat()
            }
        )
        
        return JsonResponse({
            'data': export_data,
            'total_questions': len(export_data),
            'school_name': school.school_name if school else 'N/A',
            'export_date': timezone.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get_export_data: {str(e)}")
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': 'Internal server error',
            'message': str(e)
        }, status=500)