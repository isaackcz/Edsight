"""
Offline Sync Handler
Handles batch synchronization of offline answers with duplicate prevention
"""
from django.http import JsonResponse
from django.utils import timezone
from django.db import transaction
from apps.core.models import Question, Answer, Form
from apps.user_dashboard.validators import validate_answer
import json


def handle_offline_sync(request, answers):
    """
    Handle offline answer synchronization with UUID-based duplicate prevention
    
    Args:
        request: Django request object with authenticated user
        answers: List of answer dictionaries with UUID, question_id, answer
    
    Returns:
        JsonResponse with sync results
    """
    admin_user = request.admin_user
    school = admin_user.school
    
    if not school:
        return JsonResponse({'error': 'User not associated with a school'}, status=403)
    
    synced_count = 0
    errors = []
    duplicate_count = 0
    skipped_count = 0
    
    # Track processed UUIDs to prevent duplicates in this batch
    processed_uuids = set()
    
    # Collect all question_ids to fetch in one query
    question_ids = [a.get('question_id') for a in answers if a.get('question_id')]
    
    # Fetch all questions at once
    questions = Question.objects.filter(question_id__in=question_ids)
    questions_dict = {q.question_id: q for q in questions}
    
    # First, validate and filter out empty answers
    valid_answers = []
    for answer_data in answers:
        uuid = answer_data.get('uuid')
        question_id = answer_data.get('question_id')
        answer_value = answer_data.get('answer', '')
        
        # Validate required fields
        if not question_id:
            errors.append({'error': 'Missing question_id', 'uuid': uuid})
            skipped_count += 1
            continue
        
        # Check for duplicate UUID in this batch
        if uuid and uuid in processed_uuids:
            duplicate_count += 1
            continue
        
        if uuid:
            processed_uuids.add(uuid)
        
        # Get question
        question = questions_dict.get(question_id)
        if not question:
            errors.append({
                'question_id': question_id,
                'error': 'Question not found',
                'uuid': uuid
            })
            skipped_count += 1
            continue
        
        # Skip empty answers - don't create form for empty answers
        if not answer_value or str(answer_value).strip() == '':
            skipped_count += 1
            continue
        
        # Validate answer
        is_valid, error_message = validate_answer(question, answer_value)
        if not is_valid:
            errors.append({
                'question_id': question_id,
                'error': error_message,
                'uuid': uuid
            })
            skipped_count += 1
            continue
        
        # Only add to valid_answers if it's not empty and valid
        valid_answers.append(answer_data)
    
    # Only create form if there's at least one valid (non-empty) answer to save
    if not valid_answers:
        return JsonResponse({
            'success': False,
            'error': 'No valid answers to sync. Please provide at least one answer.',
            'synced_count': 0,
            'skipped_count': skipped_count
        }, status=400)
    
    # Create form only when we have at least one valid answer to save
    form, created = Form.objects.get_or_create(
        admin_user=admin_user,
        school=school,
        academic_year='2024-2025',
        defaults={
            'status': 'draft',
            'current_level': 'school',
            'form_type': 'standard'
        }
    )
    
    if created:
        from apps.user_dashboard.api_views import logger
        logger.info(f"Created new form (ID: {form.form_id}) for user {admin_user.admin_id} when syncing first answer")
    
    # Get existing answers for these questions
    existing_answers = Answer.objects.filter(
        form=form,
        question_id__in=question_ids
    ).select_related('question')
    existing_dict = {ans.question_id: ans for ans in existing_answers}
    
    # Prepare bulk operations
    answers_to_create = []
    answers_to_update = []
    
    # Use transaction for atomic operations
    try:
        with transaction.atomic():
            # Process only valid_answers
            for answer_data in valid_answers:
                uuid = answer_data.get('uuid')
                question_id = answer_data.get('question_id')
                answer_value = answer_data.get('answer', '')
                timestamp = answer_data.get('timestamp')
                
                question = questions_dict.get(question_id)
                
                # Prepare answer for save
                if question_id in existing_dict:
                    # Update existing answer
                    ans = existing_dict[question_id]
                    ans.response = str(answer_value)[:500]
                    ans.answered_at = timezone.now()
                    answers_to_update.append(ans)
                else:
                    # Create new answer
                    answers_to_create.append(Answer(
                        form=form,
                        question=question,
                        response=str(answer_value)[:500],
                        answered_at=timezone.now()
                    ))
            
            # Perform bulk operations
            if answers_to_create:
                Answer.objects.bulk_create(answers_to_create, ignore_conflicts=True)
                synced_count += len(answers_to_create)
            
            if answers_to_update:
                Answer.objects.bulk_update(answers_to_update, ['response', 'answered_at'])
                synced_count += len(answers_to_update)
            
            # Update form timestamp
            form.updated_at = timezone.now()
            form.save(update_fields=['updated_at'])
    
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Sync failed: {str(e)}'
        }, status=500)
    
    # Clear caches after syncing
    from django.core.cache import cache
    from apps.core.models import Topic
    
    # Clear category cache (completion status may have changed)
    category_cache_key = f'school_form_categories_user_{admin_user.admin_id}'
    cache.delete(category_cache_key)
    
    # Get affected category IDs from synced questions to clear topic caches
    # Use question_ids from answers that were processed
    synced_question_ids = []
    for ans in answers_to_create:
        synced_question_ids.append(ans.question_id)
    for ans in answers_to_update:
        synced_question_ids.append(ans.question_id)
    
    if synced_question_ids:
        affected_topics = Question.objects.filter(
            question_id__in=synced_question_ids
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
        'synced_count': synced_count,
        'duplicate_count': duplicate_count,
        'skipped_count': skipped_count,
        'errors': errors if errors else None,
        'form_id': form.form_id,
        'total_processed': len(answers),
    })


def generate_sync_report(synced_count, duplicate_count, skipped_count, errors):
    """
    Generate a human-readable sync report
    
    Args:
        synced_count: Number of successfully synced answers
        duplicate_count: Number of duplicate answers skipped
        skipped_count: Number of invalid answers skipped
        errors: List of error dictionaries
    
    Returns:
        dict: Report summary
    """
    report = {
        'summary': f'{synced_count} answers synced successfully',
        'details': []
    }
    
    if duplicate_count > 0:
        report['details'].append(f'{duplicate_count} duplicates prevented')
    
    if skipped_count > 0:
        report['details'].append(f'{skipped_count} invalid answers skipped')
    
    if errors:
        report['details'].append(f'{len(errors)} errors encountered')
        report['errors'] = errors
    
    return report

