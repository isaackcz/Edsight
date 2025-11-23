"""
Form Management Form Review Endpoints
Handles form detail viewing with lazy-loaded categories, topics, and questions
"""

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from apps.core.models import Form, Category, Topic, Question, Answer
from .utils import get_admin_scope


@csrf_exempt
@require_GET
def api_form_basic(request, form_id):
    """Get basic form information including school details and workflow status"""
    try:
        admin_scope = get_admin_scope(request)
        if not admin_scope:
            return JsonResponse({
                'success': False,
                'error': 'Authentication required'
            }, status=403)
        
        # Get form with related data
        form = Form.objects.select_related(
            'school', 
            'school__region', 
            'school__division', 
            'school__district',
            'admin_user'
        ).get(form_id=form_id)
        
        # Check admin has permission to view this form
        admin_level = admin_scope['admin_level']
        if admin_level == 'district' and form.school.district_id != admin_scope.get('district_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'division' and form.school.division_id != admin_scope.get('division_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        elif admin_level == 'region' and form.school.region_id != admin_scope.get('region_id'):
            return JsonResponse({'success': False, 'error': 'Access denied'}, status=403)
        
        return JsonResponse({
            'success': True,
            'form': {
                'form_id': form.form_id,
                'status': form.status,
                'workflow_status': form.workflow_status,
                'current_level': form.current_level,
                'submitted_at': form.submitted_at.isoformat() if form.submitted_at else None,
                'academic_year': form.academic_year,
                'school': {
                    'id': form.school.id,
                    'school_name': form.school.school_name,
                    'school_id': form.school.school_id,
                    'region_name': form.school.region.name if form.school.region else 'Unknown',
                    'division_name': form.school.division.name if form.school.division else 'Unknown',
                    'district_name': form.school.district.name if form.school.district else 'Unknown',
                },
                'submitted_by': {
                    'username': form.admin_user.username if form.admin_user else 'Unknown',
                    'full_name': form.admin_user.full_name if form.admin_user else 'Unknown',
                }
            }
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_form_categories(request, form_id):
    """Get categories for the form (lazy-loaded)"""
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
        
        # Get all categories, normalize display order (1..N)
        categories = list(Category.objects.all().order_by('display_order', 'category_id'))
        
        categories_data = []
        for idx, category in enumerate(categories, start=1):
            categories_data.append({
                'category_id': category.category_id,
                'category_name': category.name,
                'display_order': idx,
            })
        
        return JsonResponse({
            'success': True,
            'categories': categories_data
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_form_topics(request, form_id, category_id):
    """Get topics for a specific category (lazy-loaded when category is clicked)"""
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
        
        # Get topics for this category with completion counts, normalize display order (1..N)
        topics = list(Topic.objects.filter(category_id=category_id).order_by('display_order', 'topic_id'))
        
        topics_data = []
        for idx, topic in enumerate(topics, start=1):
            # Compute total questions and answered count for this form/topic
            total_questions = Question.objects.filter(topic_id=topic.topic_id).count()
            answered_questions = Answer.objects.filter(
                form_id=form_id,
                question__topic_id=topic.topic_id
            ).exclude(response__isnull=True).exclude(response__exact='').count()

            topics_data.append({
                'topic_id': topic.topic_id,
                'topic_name': topic.name,
                'display_order': idx,
                'total_questions': total_questions,
                'answered_questions': answered_questions,
                'is_complete': total_questions > 0 and answered_questions >= total_questions
            })
        
        return JsonResponse({
            'success': True,
            'topics': topics_data
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_GET
def api_form_questions(request, form_id, topic_id):
    """Get questions with answers for a specific topic (lazy-loaded when topic is clicked)"""
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
        
        # Get questions for this topic and normalize display order (1..N)
        questions_qs = Question.objects.filter(topic_id=topic_id).order_by('display_order', 'question_id')
        questions = list(questions_qs)
        
        # Get answers for this form
        answers = Answer.objects.filter(form_id=form_id, question__topic_id=topic_id).select_related('question')
        answers_dict = {answer.question_id: answer.response for answer in answers}
        
        questions_data = []
        for idx, question in enumerate(questions, start=1):
            questions_data.append({
                'question_id': question.question_id,
                'question_text': question.question_text,
                'answer_type': question.answer_type,
                'is_required': question.is_required,
                'display_order': idx,
                'answer': answers_dict.get(question.question_id, ''),
            })
        
        return JsonResponse({
            'success': True,
            'questions': questions_data
        })
        
    except Form.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Form not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

