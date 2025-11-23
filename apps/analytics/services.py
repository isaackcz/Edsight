"""
Analytics Service Module
Centralized service for all analytics operations with real database data.
"""

from django.db import models
from django.db.models import Q, Count, Avg, Min, Max, F
from django.utils import timezone
from datetime import timedelta, datetime
from apps.core.models import (
    Form, Answer, Question, AdminUser,
    Region, Division, District, Category, Topic, School, FormApproval,
    FormDeadline, AdminActivityLog, AdminSession, FormRemark,
    LoginAttempt, SecurityAlert, SecurityIncident, AuditLog
)


class AnalyticsService:
    """Centralized analytics service for real-time data processing."""
    
    @staticmethod
    def build_filtered_queryset(filters, request=None):
        """Build a filtered queryset based on provided filters.
        
        Args:
            filters: Dictionary of filter parameters
            request: Optional Django request object for geographic filtering based on admin's assigned area
        """
        # Start with all forms
        # Note: Form model uses 'admin_user' not 'user'
        queryset = Form.objects.select_related('school', 'admin_user').prefetch_related('answer_set')
        
        # Apply geographic filter based on admin's assigned area (if request provided)
        if request:
            admin_id = request.session.get('admin_id')
            if admin_id:
                try:
                    admin_user = AdminUser.objects.get(admin_id=admin_id)
                    # Filter based on the most specific assigned area
                    if admin_user.school_id:
                        queryset = queryset.filter(school_id=admin_user.school_id)
                    elif admin_user.district_id:
                        queryset = queryset.filter(school__district_id=admin_user.district_id)
                    elif admin_user.division_id:
                        queryset = queryset.filter(school__division_id=admin_user.division_id)
                    elif admin_user.region_id:
                        queryset = queryset.filter(school__region_id=admin_user.region_id)
                    # Central admins (no assigned area) see all data - no filter applied
                except AdminUser.DoesNotExist:
                    pass  # If admin not found, don't apply filter
        
        # Apply filters
        # Handle both region_ids (array) and region (single value or array)
        region_ids = filters.get('region_ids') or filters.get('region')
        if region_ids:
            if not isinstance(region_ids, list):
                region_ids = [region_ids]
            queryset = queryset.filter(school__region_id__in=region_ids)
        
        division_ids = filters.get('division_ids') or filters.get('division')
        if division_ids:
            if not isinstance(division_ids, list):
                division_ids = [division_ids]
            queryset = queryset.filter(school__division_id__in=division_ids)
        
        district_ids = filters.get('district_ids') or filters.get('district')
        if district_ids:
            if not isinstance(district_ids, list):
                district_ids = [district_ids]
            queryset = queryset.filter(school__district_id__in=district_ids)
        
        if filters.get('school_ids'):
            queryset = queryset.filter(school_id__in=filters['school_ids'])
        
        if filters.get('date_from'):
            queryset = queryset.filter(created_at__date__gte=filters['date_from'])
        
        if filters.get('date_to'):
            queryset = queryset.filter(created_at__date__lte=filters['date_to'])
        
        if filters.get('submission_status'):
            # Calculate submission status based on deadline
            status_mapping = {
                'early': 'completed',
                'on-time': 'completed', 
                'late': 'in-progress'
            }
            statuses = [status_mapping.get(status, status) for status in filters['submission_status']]
            queryset = queryset.filter(status__in=statuses)
        
        if filters.get('completion_status'):
            queryset = queryset.filter(status__in=filters['completion_status'])
        
        # Status filter (for workflow reports) - supports multiple values
        if filters.get('status'):
            status_values = filters['status']
            # Handle both single value and array
            if not isinstance(status_values, list):
                status_values = [status_values]
            
            if status_values:
                from django.db.models import Q
                status_q = Q()
                for status_value in status_values:
                    if status_value == 'draft':
                        status_q |= Q(workflow_status='draft')
                    elif status_value == 'pending':
                        status_q |= Q(workflow_status__contains='pending')
                    elif status_value == 'approved':
                        status_q |= Q(workflow_status__contains='approved')
                    elif status_value == 'returned':
                        status_q |= Q(workflow_status__contains='returned')
                    elif status_value == 'completed':
                        status_q |= Q(workflow_status='completed')
                
                if status_q:
                    queryset = queryset.filter(status_q)
        
        # Text search across school names and regions
        if filters.get('q'):
            search_term = filters['q']
            queryset = queryset.filter(
                Q(school__school_name__icontains=search_term) |
                Q(school__region__name__icontains=search_term) |
                Q(school__division__name__icontains=search_term) |
                Q(school__district__name__icontains=search_term)
            )
        
        return queryset
    
    @staticmethod
    def calculate_completion_stats(queryset):
        """Calculate overall completion statistics."""
        total_forms = queryset.count()
        completed_forms = queryset.filter(status='completed').count()
        
        # Calculate completion rate based on answered questions
        total_questions = Question.objects.count()
        if total_questions > 0:
            # Get total answered questions across all forms
            total_answered = Answer.objects.filter(
                form__in=queryset,
                response__isnull=False
            ).exclude(response='').count()
            
            completion_rate = total_answered / (total_forms * total_questions) if total_forms > 0 else 0
        else:
            completion_rate = 0
        
        return {
            'completion_rate': completion_rate,
            'completed_forms': completed_forms,
            'pending_forms': total_forms - completed_forms
        }
    
    @staticmethod
    def get_school_completion_data(queryset, filters):
        """Get completion data for each school."""
        school_data = []
        
        # Get all schools from the filtered queryset
        schools = AdminUser.objects.filter(admin_level='school',
            id__in=queryset.values_list('school_id', flat=True)
        ).select_related('region', 'division', 'district')
        
        total_questions = Question.objects.count()
        
        for school in schools:
            # Get forms for this school
            school_forms = queryset.filter(school_id=school.id)
            
            # Count answered questions for this school
            answered_questions = Answer.objects.filter(
                form__in=school_forms,
                response__isnull=False
            ).exclude(response='').count()
            
            # Calculate completion percentage
            completion_pct = answered_questions / total_questions if total_questions > 0 else 0
            
            # Determine status
            if completion_pct >= 0.9:
                status = 'completed'
            elif completion_pct >= 0.5:
                status = 'in-progress'
            else:
                status = 'not-started'
            
            school_data.append({
                'school_id': school.id,
                'school_name': school.school_name,
                'completion_pct': completion_pct,
                'answered': answered_questions,
                'required': total_questions,
                'status': status
            })
        
        return school_data
    
    @staticmethod
    def get_group_aggregates(queryset, filters):
        """Get aggregated completion data by group (region/division/district)."""
        group_by = filters.get('group_by', 'region')
        aggregates = []
        
        if group_by == 'region':
            # Group by region
            regions = Region.objects.filter(
                id__in=queryset.values_list('school__region_id', flat=True)
            )
            
            for region in regions:
                region_forms = queryset.filter(school__region_id=region.id)
                region_schools = AdminUser.objects.filter(admin_level='school', region_id=region.id)
                
                total_questions = Question.objects.count()
                answered_questions = Answer.objects.filter(
                    form__in=region_forms,
                    response__isnull=False
                ).exclude(response='').count()
                
                completion_pct = answered_questions / (region_schools.count() * total_questions) if region_schools.count() > 0 and total_questions > 0 else 0
                
                aggregates.append({
                    'group': region.name,
                    'completion_pct': completion_pct,
                    'answered': answered_questions,
                    'required': region_schools.count() * total_questions,
                    'schools': region_schools.count()
                })
        
        elif group_by == 'division':
            # Group by division
            divisions = Division.objects.filter(
                id__in=queryset.values_list('school__division_id', flat=True)
            )
            
            for division in divisions:
                division_forms = queryset.filter(school__division_id=division.id)
                division_schools = AdminUser.objects.filter(admin_level='school', division_id=division.id)
                
                total_questions = Question.objects.count()
                answered_questions = Answer.objects.filter(
                    form__in=division_forms,
                    response__isnull=False
                ).exclude(response='').count()
                
                completion_pct = answered_questions / (division_schools.count() * total_questions) if division_schools.count() > 0 and total_questions > 0 else 0
                
                aggregates.append({
                    'group': division.name,
                    'completion_pct': completion_pct,
                    'answered': answered_questions,
                    'required': division_schools.count() * total_questions,
                    'schools': division_schools.count()
                })
        
        elif group_by == 'district':
            # Group by district
            districts = District.objects.filter(
                id__in=queryset.values_list('school__district_id', flat=True)
            )
            
            for district in districts:
                district_forms = queryset.filter(school__district_id=district.id)
                district_schools = AdminUser.objects.filter(admin_level='school', district_id=district.id)
                
                total_questions = Question.objects.count()
                answered_questions = Answer.objects.filter(
                    form__in=district_forms,
                    response__isnull=False
                ).exclude(response='').count()
                
                completion_pct = answered_questions / (district_schools.count() * total_questions) if district_schools.count() > 0 and total_questions > 0 else 0
                
                aggregates.append({
                    'group': district.name,
                    'completion_pct': completion_pct,
                    'answered': answered_questions,
                    'required': district_schools.count() * total_questions,
                    'schools': district_schools.count()
                })
        
        return aggregates
    
    @staticmethod
    def calculate_avg_completion_time(queryset):
        """Calculate average completion time in hours."""
        # Get forms that have been completed
        completed_forms = queryset.filter(status='completed')
        
        if not completed_forms.exists():
            return 0.0
        
        # Calculate time difference between created_at and updated_at
        avg_time = completed_forms.aggregate(
            avg_time=Avg(F('updated_at') - F('created_at'))
        )['avg_time']
        
        if avg_time:
            # Convert to hours
            return avg_time.total_seconds() / 3600
        return 0.0
    
    @staticmethod
    def calculate_kpi_metrics(queryset, filters=None):
        """Calculate KPI metrics with period-over-period comparisons."""
        now = timezone.now()
        today = now.date()
        
        # Get date range from filters
        date_from = None
        date_to = today
        
        if filters:
            if filters.get('date_from'):
                try:
                    if isinstance(filters['date_from'], str):
                        date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d').date()
                    else:
                        date_from = filters['date_from']
                except:
                    pass
            if filters.get('date_to'):
                try:
                    if isinstance(filters['date_to'], str):
                        date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d').date()
                    else:
                        date_to = filters['date_to']
                except:
                    pass
        
        # Default to last 30 days if no date filter
        if not date_from:
            date_from = today - timedelta(days=30)
        
        # Current period data (use the queryset which already has filters applied)
        current_forms = queryset
        
        current_completed = current_forms.filter(status='completed').count()
        current_pending = current_forms.exclude(status='completed').count()
        current_total = current_forms.count()
        
        # Previous period data (same length as current period)
        period_length = (date_to - date_from).days
        prev_period_end = date_from - timedelta(days=1)
        prev_period_start = prev_period_end - timedelta(days=period_length)
        
        # Build base queryset for previous period with same filters (except date)
        base_queryset = Form.objects.select_related('school', 'admin_user').prefetch_related('answer_set')
        
        # Apply same geographic filters as current queryset
        if filters:
            if filters.get('region_ids'):
                base_queryset = base_queryset.filter(school__region_id__in=filters['region_ids'])
            if filters.get('division_ids'):
                base_queryset = base_queryset.filter(school__division_id__in=filters['division_ids'])
            if filters.get('district_ids'):
                base_queryset = base_queryset.filter(school__district_id__in=filters['district_ids'])
            if filters.get('school_ids'):
                base_queryset = base_queryset.filter(school_id__in=filters['school_ids'])
        
        # Apply previous period date filter
        last_forms = base_queryset.filter(
            created_at__date__gte=prev_period_start,
            created_at__date__lte=prev_period_end
        )
        
        last_completed = last_forms.filter(status='completed').count()
        last_pending = last_forms.exclude(status='completed').count()
        last_total = last_forms.count()
        
        # Calculate completion rate
        total_questions = Question.objects.count()
        if total_questions > 0 and current_total > 0:
            current_answered = Answer.objects.filter(
                form__in=current_forms,
                response__isnull=False
            ).exclude(response='').count()
            current_completion_rate = (current_answered / (current_total * total_questions)) * 100
        else:
            current_completion_rate = 0.0
        
        if total_questions > 0 and last_total > 0:
            last_answered = Answer.objects.filter(
                form__in=last_forms,
                response__isnull=False
            ).exclude(response='').count()
            last_completion_rate = (last_answered / (last_total * total_questions)) * 100
        else:
            last_completion_rate = 0.0
        
        completion_rate_change = current_completion_rate - last_completion_rate
        
        # Calculate average completion time
        current_avg_time = AnalyticsService.calculate_avg_completion_time(current_forms.filter(status='completed'))
        last_avg_time = AnalyticsService.calculate_avg_completion_time(last_forms.filter(status='completed'))
        avg_time_change = current_avg_time - last_avg_time if last_avg_time > 0 else 0
        
        # Calculate changes
        completed_change = current_completed - last_completed
        pending_change = current_pending - last_pending
        
        # Get additional metrics
        workflow_stats = AnalyticsService.get_workflow_statistics(queryset, filters)
        geographic_stats = AnalyticsService.get_geographic_statistics(queryset, filters)
        deadline_stats = AnalyticsService.get_deadline_compliance(queryset, filters)
        
        # Calculate previous period for additional metrics
        last_workflow_stats = AnalyticsService.get_workflow_statistics(last_forms, filters)
        last_geographic_stats = AnalyticsService.get_geographic_statistics(last_forms, filters)
        last_deadline_stats = AnalyticsService.get_deadline_compliance(last_forms, filters)
        
        return {
            'completion_rate': {
                'value': round(current_completion_rate, 1),
                'change': round(completion_rate_change, 1),
                'is_positive': completion_rate_change >= 0
            },
            'avg_time': {
                'value': round(current_avg_time, 1),
                'change': round(avg_time_change, 1),
                'is_positive': avg_time_change <= 0  # Lower time is better
            },
            'completed_forms': {
                'value': current_completed,
                'change': completed_change,
                'is_positive': completed_change >= 0
            },
            'pending_forms': {
                'value': current_pending,
                'change': pending_change,
                'is_positive': pending_change <= 0  # Lower pending is better
            },
            'in_workflow': {
                'value': workflow_stats.get('in_workflow', 0),
                'change': workflow_stats.get('in_workflow', 0) - last_workflow_stats.get('in_workflow', 0),
                'is_positive': True  # More in workflow can be positive (shows activity)
            },
            'active_schools': {
                'value': geographic_stats.get('active_schools', 0),
                'change': geographic_stats.get('active_schools', 0) - last_geographic_stats.get('active_schools', 0),
                'is_positive': True
            },
            'on_time_rate': {
                'value': round(deadline_stats.get('on_time_rate', 0.0), 1),
                'change': round(deadline_stats.get('on_time_rate', 0.0) - last_deadline_stats.get('on_time_rate', 0.0), 1),
                'is_positive': True
            },
            'forms_returned': {
                'value': workflow_stats.get('forms_returned', 0),
                'change': workflow_stats.get('forms_returned', 0) - last_workflow_stats.get('forms_returned', 0),
                'is_positive': False  # Lower is better
            }
        }
    
    @staticmethod
    def get_forms_per_day_chart(queryset):
        """Get forms completed per day chart data."""
        # Get last 7 days
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=6)
        
        # Get forms completed per day
        daily_forms = queryset.filter(
            status='completed',
            updated_at__date__gte=start_date,
            updated_at__date__lte=end_date
        ).extra(
            select={'day': 'DATE(updated_at)'}
        ).values('day').annotate(
            count=Count('form_id')
        ).order_by('day')
        
        # Create labels and data arrays
        labels = []
        data = []
        
        for i in range(7):
            date = start_date + timedelta(days=i)
            labels.append(date.strftime('%a'))
            
            # Find count for this date
            count = 0
            for day_data in daily_forms:
                if day_data['day'] == date:
                    count = day_data['count']
                    break
            data.append(count)
        
        return {
            'labels': labels,
            'datasets': [{
                'data': data,
                'label': 'Forms Completed'
            }]
        }
    
    @staticmethod
    def get_response_distribution_chart(queryset):
        """Get response distribution chart data."""
        # This is a simplified version - you might want to analyze specific questions
        # For now, we'll return a basic distribution based on completion status
        
        total_forms = queryset.count()
        completed = queryset.filter(status='completed').count()
        in_progress = queryset.filter(status='in-progress').count()
        draft = queryset.filter(status='draft').count()
        
        return {
            'labels': ['Completed', 'In Progress', 'Draft'],
            'datasets': [{
                'data': [completed, in_progress, draft],
                'label': 'Response Distribution'
            }]
        }
    
    @staticmethod
    def get_drilldown_data(queryset, level):
        """Get drilldown data for the specified level."""
        drilldown_data = []
        
        if level == 'category':
            # Drill down by category
            categories = Category.objects.all().order_by('display_order')
            
            for category in categories:
                # Get questions in this category
                category_questions = Question.objects.filter(topic__category=category)
                
                # Get answers for these questions
                category_answers = Answer.objects.filter(
                    question__in=category_questions,
                    form__in=queryset,
                    response__isnull=False
                ).exclude(response='')
                
                count = category_answers.count()
                total_possible = category_questions.count() * queryset.count()
                percentage = (count / total_possible * 100) if total_possible > 0 else 0
                
                drilldown_data.append({
                    'name': category.name,
                    'count': count,
                    'percentage_distribution': f"{percentage:.1f}%",
                    'average': '',
                    'median': '',
                    'min': '',
                    'max': '',
                    'frequency_distribution': '',
                    'comparison_by_geo': ''
                })
        
        # Sub-sections removed
            # Sub-sections removed; no data
            drilldown_data = []
        
        elif level == 'topic':
            # Drill down by topic
            topics = Topic.objects.all().order_by('display_order')
            
            for topic in topics:
                topic_questions = Question.objects.filter(topic=topic)
                
                topic_answers = Answer.objects.filter(
                    question__in=topic_questions,
                    form__in=queryset,
                    response__isnull=False
                ).exclude(response='')
                
                count = topic_answers.count()
                total_possible = topic_questions.count() * queryset.count()
                percentage = (count / total_possible * 100) if total_possible > 0 else 0
                
                drilldown_data.append({
                    'name': topic.name,
                    'count': count,
                    'percentage_distribution': f"{percentage:.1f}%",
                    'average': '',
                    'median': '',
                    'min': '',
                    'max': '',
                    'frequency_distribution': '',
                    'comparison_by_geo': ''
                })
        
        elif level == 'question':
            # Drill down by question
            questions = Question.objects.all().order_by('display_order')
            
            for question in questions:
                question_answers = Answer.objects.filter(
                    question=question,
                    form__in=queryset,
                    response__isnull=False
                ).exclude(response='')
                
                count = question_answers.count()
                total_possible = queryset.count()
                percentage = (count / total_possible * 100) if total_possible > 0 else 0
                
                # For numeric questions, calculate statistics
                if question.answer_type == 'number':
                    numeric_answers = question_answers.filter(
                        response__regex=r'^-?\d+(\.\d+)?$'
                    ).extra(
                        select={'numeric_value': 'CAST(response AS DECIMAL)'}
                    )
                    
                    if numeric_answers.exists():
                        stats = numeric_answers.aggregate(
                            avg=Avg('numeric_value'),
                            min_val=Min('numeric_value'),
                            max_val=Max('numeric_value')
                        )
                        average = f"{stats['avg']:.2f}" if stats['avg'] else ''
                        min_val = f"{stats['min_val']:.2f}" if stats['min_val'] else ''
                        max_val = f"{stats['max_val']:.2f}" if stats['max_val'] else ''
                    else:
                        average = min_val = max_val = ''
                else:
                    average = min_val = max_val = ''
                
                drilldown_data.append({
                    'name': question.question_text[:50] + '...' if len(question.question_text) > 50 else question.question_text,
                    'count': count,
                    'percentage_distribution': f"{percentage:.1f}%",
                    'average': average,
                    'median': '',
                    'min': min_val,
                    'max': max_val,
                    'frequency_distribution': '',
                    'comparison_by_geo': ''
                })
        
        return drilldown_data
    
    @staticmethod
    def get_filter_options():
        """Get enhanced filter options with counts using Django ORM."""
        try:
            # Get regions
            regions = list(Region.objects.values('id', 'name').order_by('name'))
                
                # Get divisions with region relationships
            divisions = list(Division.objects.values('id', 'name', 'region_id').order_by('name'))
                
                # Get districts with division relationships
            districts = list(District.objects.values('id', 'name', 'division_id').order_by('name'))
                
            # Get schools with geographic data and form counts (only schools with forms)
            schools_data = Form.objects.values(
                'school_id',
                'school__school_name',
                'school__district_id',
                'school__division_id',
                'school__region_id'
            ).annotate(
                form_count=Count('form_id', distinct=True),
                completed_forms=Count('form_id', distinct=True, filter=Q(status='completed'))
            ).filter(
                form_count__gt=0
            ).order_by('school__school_name')
            schools = [{
                'id': row['school_id'],
                'school_name': row['school__school_name'],
                'district_id': row['school__district_id'],
                'division_id': row['school__division_id'],
                'region_id': row['school__region_id'],
                'form_count': row['form_count'],
                'completed_forms': row['completed_forms']
            } for row in schools_data]
                
                # Get categories
            categories = list(Category.objects.values('category_id', 'name').order_by('display_order'))
            
            # Get topics with category relationships
            topics = list(Topic.objects.values('topic_id', 'name', 'category_id').order_by('display_order'))
            
            # Get questions with answer counts
            questions_data = Question.objects.annotate(
                answer_count=Count('answer', distinct=True)
            ).values(
                'question_id', 'question_text', 'topic_id', 'is_required', 
                'answer_type', 'answer_count'
            ).order_by('display_order')
            questions = list(questions_data)
            
            return {
                'regions': regions,
                'divisions': divisions,
                'districts': districts,
                'schools': schools,
                'categories': categories,
                'topics': topics,
                'questions': questions,
            }
        except Exception as e:
            print(f"Filter options error: {e}")
            return {
                'regions': [],
                'divisions': [],
                'districts': [],
                'schools': [],
                'categories': [],
                'sub_sections': [],
                'topics': [],
                'questions': [],
            }
    
    @staticmethod
    def get_enhanced_school_completion_data(queryset, filters):
        """Get enhanced completion data with geographic information for each school using Django ORM."""
        school_data = []
        total_questions = Question.objects.count()
        
        # Query Form objects and group by school
        schools_data = Form.objects.values(
            'school_id',
            'school__school_name',
            'school__region_id',
            'school__region__name',
            'school__division_id',
            'school__division__name',
            'school__district_id',
            'school__district__name'
        ).annotate(
            total_forms=Count('form_id', distinct=True),
            completed_forms=Count('form_id', distinct=True, filter=Q(status='completed')),
            total_answers=Count('answer', distinct=True),
            answered_questions=Count(
                'answer',
                distinct=True,
                filter=Q(answer__response__isnull=False) & ~Q(answer__response='')
            )
        ).order_by(
            'school__region__name',
            'school__division__name',
            'school__district__name',
            'school__school_name'
        )
        
        for school_info in schools_data:
            school_id = school_info['school_id']
            school_name = school_info['school__school_name'] or 'Unknown School'
            region_id = school_info['school__region_id']
            region_name = school_info['school__region__name'] or 'Unknown Region'
            division_id = school_info['school__division_id']
            division_name = school_info['school__division__name'] or 'Unknown Division'
            district_id = school_info['school__district_id']
            district_name = school_info['school__district__name'] or 'Unknown District'
            total_forms = school_info['total_forms'] or 0
            completed_forms = school_info['completed_forms'] or 0
            total_answers = school_info['total_answers'] or 0
            answered_questions = school_info['answered_questions'] or 0
            
            # Calculate completion percentage
            completion_pct = (answered_questions / total_questions * 100) if total_questions > 0 else 0
            
            # Determine status
            if completion_pct >= 90:
                status = 'Completed'
            elif completion_pct >= 50:
                status = 'In Progress'
            else:
                status = 'Not Started'
            
            school_data.append({
                'school_id': school_id,
                'school_name': school_name,
                'region_id': region_id,
                'region_name': region_name,
                'division_id': division_id,
                'division_name': division_name,
                'district_id': district_id,
                'district_name': district_name,
                'completion_pct': completion_pct,
                'answered': answered_questions,
                'required': total_questions,
                'status': status,
                'total_forms': total_forms,
                'completed_forms': completed_forms
            })
        
        return school_data
    
    @staticmethod
    def get_category_content_data(queryset, filters):
        """Get category content data only for schools that have started (have forms with answers)."""
        content_data = []
        
        # Get all answers for schools that have started (have forms with status != 'draft' and at least one answer)
        answers = Answer.objects.filter(
            form__status__in=['in-progress', 'submitted', 'completed'],
            response__isnull=False
        ).exclude(
            response=''
        ).select_related(
            'form__school',
            'form__school__region',
            'form__school__division',
            'form__school__district',
            'question__topic__category'
        ).filter(
            question__isnull=False,
            question__topic__isnull=False,
            question__topic__category__isnull=False
        ).order_by(
            'form__school__region__name',
            'form__school__division__name',
            'form__school__district__name',
            'form__school__school_name',
            'question__topic__category__display_order',
            'question__topic__display_order',
            'question__display_order'
        )
        
        for answer in answers:
            school = answer.form.school
            question = answer.question
            topic = question.topic
            category = topic.category
                
            # Only include rows where we have actual content structure
            if category and topic and question:
                    content_data.append({
                    'school_id': school.id,
                    'school_name': school.school_name or 'Unknown School',
                    'region_id': school.region_id,
                    'region_name': school.region.name if school.region else 'Unknown Region',
                    'division_id': school.division_id,
                    'division_name': school.division.name if school.division else 'Unknown Division',
                    'district_id': school.district_id,
                    'district_name': school.district.name if school.district else 'Unknown District',
                    'category_id': category.category_id,
                    'category': category.name or 'Unknown Category',
                        'subsection_id': None,
                        'subsection': '',
                    'topic_id': topic.topic_id,
                    'topic': topic.name or 'Unknown Topic',
                    'question_id': question.question_id,
                    'question': question.question_text or 'Unknown Question',
                    'answer_type': question.answer_type,
                    'is_required': question.is_required,
                    'response': answer.response or '',
                    'form_status': answer.form.status,
                    'has_answer': bool(answer.answer_id and answer.response),
                    'answer': answer.response or ''
                    })
        
        return content_data
    
    @staticmethod
    def get_hierarchical_filter_options(filter_type, parent_id):
        """Get hierarchical filter options based on parent selection using Django ORM."""
        try:
            # Validate and convert parent_id to integer
            try:
                parent_id_int = int(parent_id)
            except (ValueError, TypeError):
                return []
            
            if not parent_id_int or parent_id_int <= 0:
                return []
            
            if filter_type == 'division' and parent_id:
                # Get divisions for a specific region
                divisions = Division.objects.filter(
                    region_id=parent_id_int
                ).values('id', 'name').order_by('name')
                return list(divisions)
                
            elif filter_type == 'district' and parent_id:
                # Get districts for a specific division
                districts = District.objects.filter(
                    division_id=parent_id_int
                ).values('id', 'name').order_by('name')
                return list(districts)
                
            elif filter_type == 'school' and parent_id:
                # Get schools for a specific district (only schools with forms)
                schools_data = Form.objects.filter(
                    school__district_id=parent_id_int
                ).values(
                    'school_id',
                    'school__school_name'
                ).annotate(
                    form_count=Count('form_id')
                ).filter(
                    form_count__gt=0
                ).order_by('school__school_name').distinct()
                return [{'id': row['school_id'], 'school_name': row['school__school_name']} for row in schools_data]
                
            elif filter_type == 'topic' and parent_id:
                # Get topics for a specific category
                topics = Topic.objects.filter(
                    category_id=parent_id_int
                ).values('topic_id', 'name').order_by('display_order')
                return [{'topic_id': row['topic_id'], 'name': row['name']} for row in topics]
                
            elif filter_type == 'question' and parent_id:
                # Get questions for a specific topic
                questions = Question.objects.filter(
                    topic_id=parent_id_int
                ).values('question_id', 'question_text', 'answer_type', 'is_required').order_by('display_order')
                return [{
                    'question_id': row['question_id'],
                    'question_text': row['question_text'],
                    'answer_type': row['answer_type'],
                    'is_required': bool(row['is_required'])
                } for row in questions]
                
            elif filter_type == 'subquestion' and parent_id:
                # Sub-questions functionality removed
                return []
                
            else:
                return []
        except Exception as e:
            print(f"Hierarchical filter options error: {e}")
            return []
    
    @staticmethod
    def get_workflow_statistics(queryset, filters=None):
        """Get workflow statistics including forms in workflow and returned forms."""
        try:
            # Count forms in workflow (not draft, not completed)
            in_workflow = queryset.exclude(
                workflow_status__in=['draft', 'completed']
            ).count()
            
            # Count forms returned (any status ending with 'returned')
            forms_returned = queryset.filter(
                workflow_status__contains='returned'
            ).count()
            
            # Count by workflow status
            status_counts = queryset.values('workflow_status').annotate(
                count=Count('form_id')
            ).order_by('workflow_status')
            
            status_breakdown = {item['workflow_status']: item['count'] for item in status_counts}
            
            return {
                'in_workflow': in_workflow,
                'forms_returned': forms_returned,
                'status_breakdown': status_breakdown
            }
        except Exception as e:
            print(f"Workflow statistics error: {e}")
            return {
                'in_workflow': 0,
                'forms_returned': 0,
                'status_breakdown': {}
            }
    
    @staticmethod
    def get_geographic_statistics(queryset, filters=None):
        """Get geographic statistics including active schools count."""
        try:
            # Count distinct schools that have forms (active schools)
            active_schools = queryset.values('school_id').distinct().count()
            
            # Count forms by region
            forms_by_region = queryset.values(
                'school__region__id',
                'school__region__name'
            ).annotate(
                count=Count('form_id')
            ).order_by('-count')
            
            # Count forms by division
            forms_by_division = queryset.values(
                'school__division__id',
                'school__division__name'
            ).annotate(
                count=Count('form_id')
            ).order_by('-count')
            
            # Count forms by district
            forms_by_district = queryset.values(
                'school__district__id',
                'school__district__name'
            ).annotate(
                count=Count('form_id')
            ).order_by('-count')
            
            return {
                'active_schools': active_schools,
                'by_region': list(forms_by_region),
                'by_division': list(forms_by_division),
                'by_district': list(forms_by_district)
            }
        except Exception as e:
            print(f"Geographic statistics error: {e}")
            return {
                'active_schools': 0,
                'by_region': [],
                'by_division': [],
                'by_district': []
            }
    
    @staticmethod
    def get_deadline_compliance(queryset, filters=None):
        """Get deadline compliance statistics."""
        try:
            # Get forms with deadlines
            forms_with_deadlines = queryset.exclude(submission_deadline__isnull=True)
            total_with_deadlines = forms_with_deadlines.count()
            
            if total_with_deadlines == 0:
                return {
                    'on_time': 0,
                    'late': 0,
                    'overdue': 0,
                    'on_time_rate': 0.0,
                    'total_with_deadlines': 0
                }
            
            now = timezone.now()
            
            # Forms submitted on time (submitted_at <= submission_deadline)
            on_time = forms_with_deadlines.filter(
                submitted_at__isnull=False,
                submitted_at__lte=F('submission_deadline')
            ).count()
            
            # Forms submitted late (submitted_at > submission_deadline)
            late = forms_with_deadlines.filter(
                submitted_at__isnull=False,
                submitted_at__gt=F('submission_deadline')
            ).count()
            
            # Forms overdue (submission_deadline < now and not submitted)
            overdue = forms_with_deadlines.filter(
                submission_deadline__lt=now,
                submitted_at__isnull=True
            ).count()
            
            # Calculate on-time rate
            submitted_count = on_time + late
            on_time_rate = (on_time / submitted_count * 100) if submitted_count > 0 else 0.0
            
            return {
                'on_time': on_time,
                'late': late,
                'overdue': overdue,
                'on_time_rate': on_time_rate,
                'total_with_deadlines': total_with_deadlines
            }
        except Exception as e:
            print(f"Deadline compliance error: {e}")
            return {
                'on_time': 0,
                'late': 0,
                'overdue': 0,
                'on_time_rate': 0.0,
                'total_with_deadlines': 0
            }
    
    @staticmethod
    def get_active_schools_count(queryset, filters=None):
        """Get count of active schools (schools with started/completed forms)."""
        try:
            return queryset.values('school_id').distinct().count()
        except Exception as e:
            print(f"Active schools count error: {e}")
            return 0
    
    @staticmethod
    def get_forms_returned_count(queryset, filters=None):
        """Get count of forms returned for revision."""
        try:
            return queryset.filter(workflow_status__contains='returned').count()
        except Exception as e:
            print(f"Forms returned count error: {e}")
            return 0
    
    @staticmethod
    def get_forms_over_time(queryset, filters=None, group_by='day'):
        """Get forms started and completed over time."""
        try:
            from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
            
            # Determine truncation function based on group_by
            if group_by == 'week':
                trunc_func = TruncWeek('created_at')
            elif group_by == 'month':
                trunc_func = TruncMonth('created_at')
            else:  # default to day
                trunc_func = TruncDate('created_at')
            
            # Forms started over time
            forms_started = queryset.annotate(
                period=trunc_func
            ).values('period').annotate(
                count=Count('form_id')
            ).order_by('period')
            
            # Forms completed over time
            forms_completed = queryset.filter(
                status='completed'
            ).annotate(
                period=trunc_func
            ).values('period').annotate(
                count=Count('form_id')
            ).order_by('period')
            
            # Convert to lists with formatted labels
            started_data = []
            completed_data = []
            
            for item in forms_started:
                period = item['period']
                if period:
                    if group_by == 'week':
                        label = period.strftime('%Y-W%W')
                    elif group_by == 'month':
                        label = period.strftime('%Y-%m')
                    else:
                        label = period.strftime('%Y-%m-%d')
                    started_data.append({
                        'period': period.isoformat() if hasattr(period, 'isoformat') else str(period),
                        'label': label,
                        'count': item['count']
                    })
            
            for item in forms_completed:
                period = item['period']
                if period:
                    if group_by == 'week':
                        label = period.strftime('%Y-W%W')
                    elif group_by == 'month':
                        label = period.strftime('%Y-%m')
                    else:
                        label = period.strftime('%Y-%m-%d')
                    completed_data.append({
                        'period': period.isoformat() if hasattr(period, 'isoformat') else str(period),
                        'label': label,
                        'count': item['count']
                    })
            
            return {
                'started': started_data,
                'completed': completed_data,
                'group_by': group_by
            }
        except Exception as e:
            print(f"Forms over time error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'started': [],
                'completed': [],
                'group_by': group_by
            }
    
    @staticmethod
    def get_completion_rate_trend(queryset, filters=None, group_by='day'):
        """Get completion rate trend over time."""
        try:
            from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
            
            # Determine truncation function
            if group_by == 'week':
                trunc_func = TruncWeek('created_at')
            elif group_by == 'month':
                trunc_func = TruncMonth('created_at')
            else:
                trunc_func = TruncDate('created_at')
            
            # Get total forms and completed forms per period
            total_forms = queryset.annotate(
                period=trunc_func
            ).values('period').annotate(
                total=Count('form_id')
            ).order_by('period')
            
            completed_forms = queryset.filter(
                status='completed'
            ).annotate(
                period=trunc_func
            ).values('period').annotate(
                completed=Count('form_id')
            ).order_by('period')
            
            # Create a dictionary for quick lookup
            completed_dict = {item['period']: item['completed'] for item in completed_forms if item['period']}
            
            # Calculate completion rates
            trend_data = []
            for item in total_forms:
                period = item['period']
                if period:
                    total = item['total']
                    completed = completed_dict.get(period, 0)
                    rate = (completed / total * 100) if total > 0 else 0.0
                    
                    if group_by == 'week':
                        label = period.strftime('%Y-W%W')
                    elif group_by == 'month':
                        label = period.strftime('%Y-%m')
                    else:
                        label = period.strftime('%Y-%m-%d')
                    
                    trend_data.append({
                        'period': period.isoformat() if hasattr(period, 'isoformat') else str(period),
                        'label': label,
                        'rate': round(rate, 2),
                        'total': total,
                        'completed': completed
                    })
            
            return {
                'trend': trend_data,
                'group_by': group_by
            }
        except Exception as e:
            print(f"Completion rate trend error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'trend': [],
                'group_by': group_by
            }
    
    @staticmethod
    def get_workflow_status_over_time(queryset, filters=None, group_by='day'):
        """Get workflow status distribution over time."""
        try:
            from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
            
            # Determine truncation function
            if group_by == 'week':
                trunc_func = TruncWeek('created_at')
            elif group_by == 'month':
                trunc_func = TruncMonth('created_at')
            else:
                trunc_func = TruncDate('created_at')
            
            # Get status counts per period
            status_over_time = queryset.annotate(
                period=trunc_func
            ).values('period', 'workflow_status').annotate(
                count=Count('form_id')
            ).order_by('period', 'workflow_status')
            
            # Organize data by period
            periods_dict = {}
            for item in status_over_time:
                period = item['period']
                if not period:
                    continue
                
                if group_by == 'week':
                    label = period.strftime('%Y-W%W')
                elif group_by == 'month':
                    label = period.strftime('%Y-%m')
                else:
                    label = period.strftime('%Y-%m-%d')
                
                period_key = period.isoformat() if hasattr(period, 'isoformat') else str(period)
                
                if period_key not in periods_dict:
                    periods_dict[period_key] = {
                        'period': period_key,
                        'label': label,
                        'statuses': {}
                    }
                
                periods_dict[period_key]['statuses'][item['workflow_status']] = item['count']
            
            return {
                'data': list(periods_dict.values()),
                'group_by': group_by
            }
        except Exception as e:
            print(f"Workflow status over time error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'data': [],
                'group_by': group_by
            }
    
    @staticmethod
    def get_forms_by_status_distribution(queryset, filters=None):
        """Get distribution of forms by status."""
        try:
            status_distribution = queryset.values('status').annotate(
                count=Count('form_id')
            ).order_by('status')
            
            return [
                {
                    'status': item['status'],
                    'count': item['count']
                }
                for item in status_distribution
            ]
        except Exception as e:
            print(f"Status distribution error: {e}")
            return []
    
    @staticmethod
    def get_forms_by_workflow_level(queryset, filters=None):
        """Get distribution of forms by workflow level."""
        try:
            workflow_distribution = queryset.values('workflow_status').annotate(
                count=Count('form_id')
            ).order_by('workflow_status')
            
            return [
                {
                    'workflow_status': item['workflow_status'],
                    'count': item['count']
                }
                for item in workflow_distribution
            ]
        except Exception as e:
            print(f"Workflow level distribution error: {e}")
            return []
    
    @staticmethod
    def get_geographic_distribution(queryset, filters=None, level='region'):
        """Get distribution of forms by geographic level."""
        try:
            if level == 'region':
                distribution = queryset.values(
                    'school__region__id',
                    'school__region__name'
                ).annotate(
                    count=Count('form_id')
                ).order_by('-count')
                
                return [
                    {
                        'id': item['school__region__id'],
                        'name': item['school__region__name'] or 'Unknown',
                        'count': item['count']
                    }
                    for item in distribution
                ]
            elif level == 'division':
                distribution = queryset.values(
                    'school__division__id',
                    'school__division__name'
                ).annotate(
                    count=Count('form_id')
                ).order_by('-count')
                
                return [
                    {
                        'id': item['school__division__id'],
                        'name': item['school__division__name'] or 'Unknown',
                        'count': item['count']
                    }
                    for item in distribution
                ]
            elif level == 'district':
                distribution = queryset.values(
                    'school__district__id',
                    'school__district__name'
                ).annotate(
                    count=Count('form_id')
                ).order_by('-count')
                
                return [
                    {
                        'id': item['school__district__id'],
                        'name': item['school__district__name'] or 'Unknown',
                        'count': item['count']
                    }
                    for item in distribution
                ]
            else:
                return []
        except Exception as e:
            print(f"Geographic distribution error: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    def get_workflow_performance_report(queryset, filters=None):
        """Get detailed workflow performance report with pagination and search."""
        try:
            from django.db.models import DurationField, ExpressionWrapper, F, Q
            from django.db.models.functions import Coalesce
            
            # Get pagination parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            
            # Get forms at each workflow stage
            workflow_stages = [
                'draft',
                'district_pending', 'district_approved', 'district_returned',
                'division_pending', 'division_approved', 'division_returned',
                'region_pending', 'region_approved', 'region_returned',
                'central_pending', 'central_approved', 'central_returned',
                'completed'
            ]
            
            stage_data = []
            
            for stage in workflow_stages:
                stage_forms = queryset.filter(workflow_status=stage)
                count = stage_forms.count()
                
                # Calculate average time in this stage
                # For pending stages, calculate time from created_at or submitted_at to now
                # For approved/returned stages, calculate time from last_reviewed_at
                avg_time_hours = 0.0
                
                if count > 0:
                    if 'pending' in stage:
                        # Time from submission to now (or last_reviewed_at if exists)
                        pending_forms = stage_forms.filter(submitted_at__isnull=False)
                        if pending_forms.exists():
                            now = timezone.now()
                            total_seconds = 0
                            for form in pending_forms:
                                start_time = form.last_reviewed_at or form.submitted_at or form.created_at
                                if start_time:
                                    delta = now - start_time
                                    total_seconds += delta.total_seconds()
                            avg_time_hours = (total_seconds / count) / 3600 if count > 0 else 0.0
                    elif 'approved' in stage or 'returned' in stage:
                        # Time from last_reviewed_at
                        reviewed_forms = stage_forms.filter(last_reviewed_at__isnull=False)
                        if reviewed_forms.exists():
                            total_seconds = 0
                            for form in reviewed_forms:
                                if form.last_reviewed_at and form.submitted_at:
                                    delta = form.last_reviewed_at - form.submitted_at
                                    total_seconds += delta.total_seconds()
                            avg_time_hours = (total_seconds / reviewed_forms.count()) / 3600 if reviewed_forms.count() > 0 else 0.0
                
                # Get approval vs return rates for this level
                approval_count = 0
                return_count = 0
                
                if 'district' in stage:
                    approval_count = queryset.filter(workflow_status='district_approved').count()
                    return_count = queryset.filter(workflow_status='district_returned').count()
                elif 'division' in stage:
                    approval_count = queryset.filter(workflow_status='division_approved').count()
                    return_count = queryset.filter(workflow_status='division_returned').count()
                elif 'region' in stage:
                    approval_count = queryset.filter(workflow_status='region_approved').count()
                    return_count = queryset.filter(workflow_status='region_returned').count()
                elif 'central' in stage:
                    approval_count = queryset.filter(workflow_status='central_approved').count()
                    return_count = queryset.filter(workflow_status='central_returned').count()
                
                approval_rate = 0.0
                if approval_count + return_count > 0:
                    approval_rate = (approval_count / (approval_count + return_count)) * 100
                
                stage_data.append({
                    'stage': stage,
                    'stage_display': stage.replace('_', ' ').title(),
                    'count': count,
                    'avg_time_hours': round(avg_time_hours, 2),
                    'approval_count': approval_count,
                    'return_count': return_count,
                    'approval_rate': round(approval_rate, 2)
                })
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                stage_data = [
                    s for s in stage_data
                    if search_lower in s['stage'].lower() or 
                       search_lower in s['stage_display'].lower()
                ]
            
            # Get total count before pagination
            total_count = len(stage_data)
            
            # Apply pagination
            paginated_stages = stage_data[offset:offset + limit]
            
            # Identify bottlenecks (stages with longest average time)
            bottlenecks = sorted(
                [s for s in stage_data if s['count'] > 0 and s['avg_time_hours'] > 0],
                key=lambda x: x['avg_time_hours'],
                reverse=True
            )[:5]
            
            # Forms stuck in workflow (exceeding average time by 2x)
            stuck_forms = []
            for stage_info in stage_data:
                if stage_info['count'] > 0 and stage_info['avg_time_hours'] > 0:
                    threshold_hours = stage_info['avg_time_hours'] * 2
                    stage_forms = queryset.filter(workflow_status=stage_info['stage'])
                    for form in stage_forms[:10]:  # Limit to 10 for performance
                        start_time = form.last_reviewed_at or form.submitted_at or form.created_at
                        if start_time:
                            delta = timezone.now() - start_time
                            hours = delta.total_seconds() / 3600
                            if hours > threshold_hours:
                                stuck_forms.append({
                                    'form_id': form.form_id,
                                    'school_name': form.school.school_name if form.school else 'Unknown',
                                    'stage': stage_info['stage'],
                                    'hours_stuck': round(hours, 2)
                                })
            
            return {
                'stages': paginated_stages,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'bottlenecks': bottlenecks,
                'stuck_forms': stuck_forms[:20],  # Limit to 20
                'summary': {
                    'total_forms': queryset.count(),
                    'in_workflow': queryset.exclude(workflow_status__in=['draft', 'completed']).count(),
                    'completed': queryset.filter(workflow_status='completed').count(),
                    'returned': queryset.filter(workflow_status__contains='returned').count()
                }
            }
        except Exception as e:
            print(f"Workflow performance report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'stages': [],
                'bottlenecks': [],
                'stuck_forms': [],
                'summary': {}
            }
    
    @staticmethod
    def get_geographic_performance_report(queryset, filters=None):
        """Get detailed geographic performance report with pagination and search."""
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            level = filters.get('level', 'region') if filters else 'region'
            
            # Performance by region
            region_performance = queryset.values(
                'school__region__id',
                'school__region__name'
            ).annotate(
                total_forms=Count('form_id'),
                completed_forms=Count('form_id', filter=Q(status='completed')),
                active_schools=Count('school_id', distinct=True)
            ).order_by('-total_forms')
            
            region_data = []
            for item in region_performance:
                total = item['total_forms']
                completed = item['completed_forms']
                completion_rate = (completed / total * 100) if total > 0 else 0.0
                
                region_data.append({
                    'id': item['school__region__id'],
                    'name': item['school__region__name'] or 'Unknown',
                    'total_forms': total,
                    'completed_forms': completed,
                    'completion_rate': round(completion_rate, 2),
                    'active_schools': item['active_schools']
                })
            
            # Performance by division
            division_performance = queryset.values(
                'school__division__id',
                'school__division__name',
                'school__region__name'
            ).annotate(
                total_forms=Count('form_id'),
                completed_forms=Count('form_id', filter=Q(status='completed')),
                active_schools=Count('school_id', distinct=True)
            ).order_by('-total_forms')
            
            division_data = []
            for item in division_performance:
                total = item['total_forms']
                completed = item['completed_forms']
                completion_rate = (completed / total * 100) if total > 0 else 0.0
                
                division_data.append({
                    'id': item['school__division__id'],
                    'name': item['school__division__name'] or 'Unknown',
                    'region_name': item['school__region__name'] or 'Unknown',
                    'total_forms': total,
                    'completed_forms': completed,
                    'completion_rate': round(completion_rate, 2),
                    'active_schools': item['active_schools']
                })
            
            # Performance by district
            district_performance = queryset.values(
                'school__district__id',
                'school__district__name',
                'school__division__name',
                'school__region__name'
            ).annotate(
                total_forms=Count('form_id'),
                completed_forms=Count('form_id', filter=Q(status='completed')),
                active_schools=Count('school_id', distinct=True)
            ).order_by('-total_forms')
            
            district_data = []
            for item in district_performance:
                total = item['total_forms']
                completed = item['completed_forms']
                completion_rate = (completed / total * 100) if total > 0 else 0.0
                
                district_data.append({
                    'id': item['school__district__id'],
                    'name': item['school__district__name'] or 'Unknown',
                    'division_name': item['school__division__name'] or 'Unknown',
                    'region_name': item['school__region__name'] or 'Unknown',
                    'total_forms': total,
                    'completed_forms': completed,
                    'completion_rate': round(completion_rate, 2),
                    'active_schools': item['active_schools']
                })
            
            # Select data based on level
            selected_data = []
            if level == 'region':
                selected_data = region_data
            elif level == 'division':
                selected_data = division_data
            elif level == 'district':
                selected_data = district_data
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                selected_data = [
                    item for item in selected_data
                    if search_lower in (item.get('name', '') or '').lower() or
                       search_lower in (item.get('region_name', '') or '').lower() or
                       search_lower in (item.get('division_name', '') or '').lower()
                ]
            
            # Get total count before pagination
            total_count = len(selected_data)
            
            # Apply pagination
            paginated_data = selected_data[offset:offset + limit]
            
            # Top and bottom performing areas
            top_regions = sorted(region_data, key=lambda x: x['completion_rate'], reverse=True)[:10]
            bottom_regions = sorted(region_data, key=lambda x: x['completion_rate'])[:10]
            
            # Coverage analysis - schools with/without forms
            all_schools = School.objects.count()
            schools_with_forms = queryset.values('school_id').distinct().count()
            schools_without_forms = all_schools - schools_with_forms
            
            # Return data based on level
            result = {
                'data': paginated_data,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'level': level,
                'top_performers': {
                    'regions': top_regions
                },
                'bottom_performers': {
                    'regions': bottom_regions
                },
                'coverage': {
                    'total_schools': all_schools,
                    'schools_with_forms': schools_with_forms,
                    'schools_without_forms': schools_without_forms,
                    'coverage_rate': round((schools_with_forms / all_schools * 100) if all_schools > 0 else 0.0, 2)
                }
            }
            
            # Keep backward compatibility
            result['by_region'] = region_data
            result['by_division'] = division_data
            result['by_district'] = district_data
            
            return result
        except Exception as e:
            print(f"Geographic performance report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'by_region': [],
                'by_division': [],
                'by_district': [],
                'top_performers': {'regions': []},
                'bottom_performers': {'regions': []},
                'coverage': {}
            }
    
    @staticmethod
    def get_deadline_compliance_report(queryset, filters=None):
        """Get detailed deadline compliance report with pagination and search."""
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            level = filters.get('level', 'all') if filters else 'all'
            
            now = timezone.now()
            
            # IMPORTANT: Get ALL deadlines from database, regardless of queryset filters
            # Deadlines should be shown even if no forms match the filters
            # This ensures deadlines are independent of form filtering
            all_deadlines = FormDeadline.objects.select_related('region', 'division', 'district').all()
            
            deadline_count = all_deadlines.count()
            queryset_count = queryset.count()
            print(f"DEBUG Deadline Report: Found {deadline_count} deadlines in database")
            print(f"DEBUG Deadline Report: Queryset has {queryset_count} forms (may be 0 due to date/other filters)")
            print(f"DEBUG Deadline Report: Filters received: {filters}")
            
            deadline_data = []
            
            for deadline in all_deadlines:
                try:
                    # Get forms for this deadline's geographic area
                    deadline_forms = queryset
                    
                    # Apply geographic filter based on deadline's area
                    if deadline.region_id:
                        deadline_forms = deadline_forms.filter(school__region_id=deadline.region_id)
                    elif deadline.division_id:
                        deadline_forms = deadline_forms.filter(school__division_id=deadline.division_id)
                    elif deadline.district_id:
                        deadline_forms = deadline_forms.filter(school__district_id=deadline.district_id)
                    
                    total_forms = deadline_forms.count()
                    print(f"DEBUG Deadline {deadline.deadline_id}: form_type={deadline.form_type}, region_id={deadline.region_id}, total_forms={total_forms}")
                    
                    # Forms submitted before deadline
                    on_time = deadline_forms.filter(
                        submitted_at__isnull=False,
                        submitted_at__lte=deadline.deadline_date
                    ).count()
                    
                    # Forms submitted after deadline
                    late = deadline_forms.filter(
                        submitted_at__isnull=False,
                        submitted_at__gt=deadline.deadline_date
                    ).count()
                    
                    # Forms approaching deadline (within 7 days)
                    days_until_deadline = (deadline.deadline_date - now).days
                    approaching = deadline_forms.filter(
                        submitted_at__isnull=True,
                        created_at__lte=deadline.deadline_date
                    ).count() if days_until_deadline <= 7 and days_until_deadline > 0 else 0
                    
                    # Forms overdue (deadline passed, not submitted)
                    overdue = deadline_forms.filter(
                        submission_deadline__lt=now,
                        submitted_at__isnull=True
                    ).count() if deadline.deadline_date < now else 0
                    
                    # Calculate compliance rate
                    submitted_count = on_time + late
                    compliance_rate = (on_time / submitted_count * 100) if submitted_count > 0 else 0.0
                    
                    # Average days before/after deadline
                    avg_days_before = 0.0
                    avg_days_after = 0.0
                    
                    if on_time > 0:
                        on_time_forms = deadline_forms.filter(
                            submitted_at__isnull=False,
                            submitted_at__lte=deadline.deadline_date
                        )
                        total_days = 0
                        for form in on_time_forms:
                            if form.submitted_at:
                                delta = deadline.deadline_date - form.submitted_at
                                total_days += delta.days
                        avg_days_before = total_days / on_time if on_time > 0 else 0.0
                    
                    if late > 0:
                        late_forms = deadline_forms.filter(
                            submitted_at__isnull=False,
                            submitted_at__gt=deadline.deadline_date
                        )
                        total_days = 0
                        for form in late_forms:
                            if form.submitted_at:
                                delta = form.submitted_at - deadline.deadline_date
                                total_days += delta.days
                        avg_days_after = total_days / late if late > 0 else 0.0
                    
                    # Get area name safely
                    area_name = 'All Areas'
                    if deadline.region_id and deadline.region:
                        area_name = deadline.region.name
                    elif deadline.division_id and deadline.division:
                        area_name = deadline.division.name
                    elif deadline.district_id and deadline.district:
                        area_name = deadline.district.name
                    
                    # Determine level for filtering
                    deadline_level = 'all'
                    if deadline.region_id:
                        deadline_level = 'region'
                    elif deadline.division_id:
                        deadline_level = 'division'
                    elif deadline.district_id:
                        deadline_level = 'district'
                    
                    deadline_data.append({
                        'deadline_id': deadline.deadline_id,
                        'area_name': area_name,
                        'form_type': deadline.form_type,
                        'deadline_date': deadline.deadline_date.isoformat(),
                        'days_until_deadline': days_until_deadline,
                        'total_forms': total_forms,
                        'on_time': on_time,
                        'late': late,
                        'approaching': approaching,
                        'overdue': overdue,
                        'compliance_rate': round(compliance_rate, 2),
                        'avg_days_before': round(avg_days_before, 2),
                        'avg_days_after': round(avg_days_after, 2),
                        'level': deadline_level
                    })
                except Exception as e:
                    print(f"ERROR processing deadline {deadline.deadline_id}: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    # Continue processing other deadlines even if one fails
            
            # Apply level filter
            if level != 'all':
                deadline_data = [item for item in deadline_data if item['level'] == level]
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                deadline_data = [
                    item for item in deadline_data
                    if search_lower in (item.get('area_name', '') or '').lower() or
                       search_lower in (item.get('form_type', '') or '').lower()
                ]
            
            # Get total count before pagination
            total_count = len(deadline_data)
            
            # Apply pagination
            paginated_data = deadline_data[offset:offset + limit]
            
            # Overall summary
            total_with_deadlines = sum(item['total_forms'] for item in deadline_data)
            total_on_time = sum(item['on_time'] for item in deadline_data)
            total_late = sum(item['late'] for item in deadline_data)
            total_overdue = sum(item['overdue'] for item in deadline_data)
            overall_compliance = (total_on_time / (total_on_time + total_late) * 100) if (total_on_time + total_late) > 0 else 0.0
            
            return {
                'deadlines': paginated_data,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'level': level,
                'summary': {
                    'total_deadlines': len(deadline_data),
                    'total_forms_with_deadlines': total_with_deadlines,
                    'total_on_time': total_on_time,
                    'total_late': total_late,
                    'total_overdue': total_overdue,
                    'overall_compliance_rate': round(overall_compliance, 2)
                }
            }
        except Exception as e:
            print(f"Deadline compliance report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'deadlines': [],
                'summary': {}
            }
    
    @staticmethod
    def get_school_performance_report(queryset, filters=None):
        """Get detailed school performance report with pagination and search."""
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            
            # Get school performance data
            school_performance = queryset.values(
                'school_id',
                'school__school_name',
                'school__school_id',
                'school__region__name',
                'school__division__name',
                'school__district__name'
            ).annotate(
                total_forms=Count('form_id'),
                completed_forms=Count('form_id', filter=Q(status='completed')),
                last_activity=Max('updated_at')
            ).order_by('-total_forms')
            
            school_data = []
            for item in school_performance:
                total = item['total_forms']
                completed = item['completed_forms']
                completion_rate = (completed / total * 100) if total > 0 else 0.0
                
                # Check if school has no activity
                has_activity = total > 0
                
                # Check if school has incomplete forms
                has_incomplete = total > completed
                
                # Last activity date
                last_activity = item['last_activity']
                days_since_activity = None
                if last_activity:
                    delta = timezone.now() - last_activity
                    days_since_activity = delta.days
                
                school_data.append({
                    'school_id': item['school_id'],
                    'school_name': item['school__school_name'] or 'Unknown',
                    'school_code': item['school__school_id'] or '',
                    'region_name': item['school__region__name'] or 'Unknown',
                    'division_name': item['school__division__name'] or 'Unknown',
                    'district_name': item['school__district__name'] or 'Unknown',
                    'total_forms': total,
                    'completed_forms': completed,
                    'completion_rate': round(completion_rate, 2),
                    'has_activity': has_activity,
                    'has_incomplete': has_incomplete,
                    'last_activity': last_activity.isoformat() if last_activity else None,
                    'days_since_activity': days_since_activity
                })
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                school_data = [
                    item for item in school_data
                    if search_lower in (item.get('school_name', '') or '').lower() or
                       search_lower in (item.get('school_code', '') or '').lower() or
                       search_lower in (item.get('region_name', '') or '').lower() or
                       search_lower in (item.get('division_name', '') or '').lower() or
                       search_lower in (item.get('district_name', '') or '').lower()
                ]
            
            # Get total count before pagination
            total_count = len(school_data)
            
            # Apply pagination
            paginated_data = school_data[offset:offset + limit]
            
            # Schools with no activity
            schools_with_no_activity = [s for s in school_data if not s['has_activity']]
            
            # Schools with incomplete forms
            schools_with_incomplete = [s for s in school_data if s['has_incomplete']]
            
            # Schools approaching deadlines (if deadline info available)
            schools_approaching_deadline = []
            # This would require deadline information - can be enhanced later
            
            return {
                'schools': paginated_data,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'summary': {
                    'total_schools': len(school_data),
                    'schools_with_activity': len([s for s in school_data if s['has_activity']]),
                    'schools_with_no_activity': len(schools_with_no_activity),
                    'schools_with_incomplete': len(schools_with_incomplete)
                },
                'schools_with_no_activity': schools_with_no_activity[:50],  # Limit to 50
                'schools_with_incomplete': schools_with_incomplete[:50]  # Limit to 50
            }
        except Exception as e:
            print(f"School performance report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'schools': [],
                'summary': {},
                'schools_with_no_activity': [],
                'schools_with_incomplete': []
            }
    
    @staticmethod
    def get_admin_activity_report(filters=None, request=None):
        """Get detailed admin activity report with pagination and search.
        
        Args:
            filters: Dictionary of filter parameters
            request: Optional Django request object for geographic filtering based on admin's assigned area
        """
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            admin_level = filters.get('admin_level', '').strip() if filters else ''
            
            # Apply geographic filter based on admin's assigned area (if request provided)
            admin_user_ids = None
            if request:
                admin_id = request.session.get('admin_id')
                if admin_id:
                    try:
                        admin_user = AdminUser.objects.get(admin_id=admin_id)
                        # Filter admin users based on the most specific assigned area
                        if admin_user.school_id:
                            admin_user_ids = AdminUser.objects.filter(school_id=admin_user.school_id).values_list('admin_id', flat=True)
                        elif admin_user.district_id:
                            admin_user_ids = AdminUser.objects.filter(district_id=admin_user.district_id).values_list('admin_id', flat=True)
                        elif admin_user.division_id:
                            admin_user_ids = AdminUser.objects.filter(division_id=admin_user.division_id).values_list('admin_id', flat=True)
                        elif admin_user.region_id:
                            admin_user_ids = AdminUser.objects.filter(region_id=admin_user.region_id).values_list('admin_id', flat=True)
                        # Central admins (no assigned area) see all data - no filter applied
                    except AdminUser.DoesNotExist:
                        pass  # If admin not found, don't apply filter
            
            # Apply date filters if provided
            activity_queryset = AdminActivityLog.objects.select_related('admin_user')
            session_queryset = AdminSession.objects.select_related('admin_user')
            
            # Apply geographic filter to activity and session querysets
            if admin_user_ids is not None:
                activity_queryset = activity_queryset.filter(admin_user_id__in=admin_user_ids)
                session_queryset = session_queryset.filter(admin_user_id__in=admin_user_ids)
            
            if filters:
                if filters.get('date_from'):
                    try:
                        if isinstance(filters['date_from'], str):
                            date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d').date()
                        else:
                            date_from = filters['date_from']
                        activity_queryset = activity_queryset.filter(timestamp__date__gte=date_from)
                        session_queryset = session_queryset.filter(created_at__date__gte=date_from)
                    except:
                        pass
                
                if filters.get('date_to'):
                    try:
                        if isinstance(filters['date_to'], str):
                            date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d').date()
                        else:
                            date_to = filters['date_to']
                        activity_queryset = activity_queryset.filter(timestamp__date__lte=date_to)
                        session_queryset = session_queryset.filter(created_at__date__lte=date_to)
                    except:
                        pass
                
                # Filter by admin level
                if admin_level:
                    activity_queryset = activity_queryset.filter(admin_user__admin_level=admin_level)
            
            # Get admin activity summary
            admin_activity = activity_queryset.values(
                'admin_user__admin_id',
                'admin_user__username',
                'admin_user__full_name',
                'admin_user__admin_level'
            ).annotate(
                activity_count=Count('log_id'),
                last_activity=Max('timestamp')
            ).order_by('-activity_count')
            
            admin_data = []
            for item in admin_activity:
                admin_id = item['admin_user__admin_id']
                
                # Get login count from sessions
                login_count = session_queryset.filter(admin_user_id=admin_id).count()
                
                # Get active sessions
                active_sessions = session_queryset.filter(
                    admin_user_id=admin_id,
                    is_active=True
                ).count()
                
                # Calculate session duration (average)
                sessions = session_queryset.filter(admin_user_id=admin_id)
                avg_session_duration = 0.0
                if sessions.exists():
                    total_duration = 0
                    count = 0
                    for session in sessions:
                        if session.last_activity and session.created_at:
                            delta = session.last_activity - session.created_at
                            total_duration += delta.total_seconds()
                            count += 1
                    avg_session_duration = (total_duration / count / 3600) if count > 0 else 0.0  # in hours
                
                # Last login
                last_session = sessions.order_by('-created_at').first()
                last_login = last_session.created_at if last_session else None
                
                admin_data.append({
                    'admin_id': admin_id,
                    'username': item['admin_user__username'],
                    'full_name': item['admin_user__full_name'] or item['admin_user__username'],
                    'admin_level': item['admin_user__admin_level'],
                    'activity_count': item['activity_count'],
                    'login_count': login_count,
                    'active_sessions': active_sessions,
                    'avg_session_duration_hours': round(avg_session_duration, 2),
                    'last_activity': item['last_activity'].isoformat() if item['last_activity'] else None,
                    'last_login': last_login.isoformat() if last_login else None
                })
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                admin_data = [
                    item for item in admin_data
                    if search_lower in (item.get('username', '') or '').lower() or
                       search_lower in (item.get('full_name', '') or '').lower() or
                       search_lower in (item.get('admin_level', '') or '').lower()
                ]
            
            # Get total count before pagination
            total_count = len(admin_data)
            
            # Apply pagination
            paginated_data = admin_data[offset:offset + limit]
            
            # Activity by admin level
            activity_by_level = activity_queryset.values(
                'admin_user__admin_level'
            ).annotate(
                count=Count('log_id')
            ).order_by('-count')
            
            # Most active admins (top 10)
            most_active = sorted(admin_data, key=lambda x: x['activity_count'], reverse=True)[:10]
            
            # Inactive admins (no activity in date range)
            inactive_admins = [a for a in admin_data if a['activity_count'] == 0]
            
            # Admin coverage (admins assigned to regions/divisions/districts)
            admin_coverage_queryset = AdminUser.objects.all()
            if admin_user_ids is not None:
                admin_coverage_queryset = admin_coverage_queryset.filter(admin_id__in=admin_user_ids)
            total_admins = admin_coverage_queryset.count()
            admins_with_assignments = admin_coverage_queryset.exclude(
                region__isnull=True,
                division__isnull=True,
                district__isnull=True,
                school__isnull=True
            ).count()
            
            return {
                'admins': paginated_data,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'activity_by_level': list(activity_by_level),
                'most_active': most_active,
                'inactive_admins': inactive_admins[:50],  # Limit to 50
                'summary': {
                    'total_admins': total_admins,
                    'active_admins': len([a for a in admin_data if a['activity_count'] > 0]),
                    'inactive_admins': len(inactive_admins),
                    'admins_with_assignments': admins_with_assignments,
                    'total_activities': sum(a['activity_count'] for a in admin_data)
                }
            }
        except Exception as e:
            print(f"Admin activity report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'admins': [],
                'activity_by_level': [],
                'most_active': [],
                'inactive_admins': [],
                'summary': {}
            }
    
    @staticmethod
    def get_security_audit_report(filters=None, request=None):
        """Get detailed security and audit report with pagination and search.
        
        Args:
            filters: Dictionary of filter parameters
            request: Optional Django request object for geographic filtering based on admin's assigned area
        """
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            alert_type = filters.get('alert_type', '').strip() if filters else ''
            severity = filters.get('severity', '').strip() if filters else ''
            
            # Apply geographic filter based on admin's assigned area (if request provided)
            admin_user_ids = None
            if request:
                admin_id = request.session.get('admin_id')
                if admin_id:
                    try:
                        admin_user = AdminUser.objects.get(admin_id=admin_id)
                        # Filter admin users based on the most specific assigned area
                        if admin_user.school_id:
                            admin_user_ids = AdminUser.objects.filter(school_id=admin_user.school_id).values_list('admin_id', flat=True)
                        elif admin_user.district_id:
                            admin_user_ids = AdminUser.objects.filter(district_id=admin_user.district_id).values_list('admin_id', flat=True)
                        elif admin_user.division_id:
                            admin_user_ids = AdminUser.objects.filter(division_id=admin_user.division_id).values_list('admin_id', flat=True)
                        elif admin_user.region_id:
                            admin_user_ids = AdminUser.objects.filter(region_id=admin_user.region_id).values_list('admin_id', flat=True)
                        # Central admins (no assigned area) see all data - no filter applied
                    except AdminUser.DoesNotExist:
                        pass  # If admin not found, don't apply filter
            
            # Apply date filters if provided
            login_queryset = LoginAttempt.objects.all()
            alert_queryset = SecurityAlert.objects.all()
            incident_queryset = SecurityIncident.objects.all()
            audit_queryset = AuditLog.objects.select_related('admin')
            
            # Apply geographic filter to audit queryset (if admin_user_ids available)
            # Note: LoginAttempt, SecurityAlert, and SecurityIncident may not have direct admin relationships
            # so we filter AuditLog which has admin relationship
            if admin_user_ids is not None:
                audit_queryset = audit_queryset.filter(admin_id__in=admin_user_ids)
            
            if filters:
                if filters.get('date_from'):
                    try:
                        if isinstance(filters['date_from'], str):
                            date_from = datetime.strptime(filters['date_from'], '%Y-%m-%d').date()
                        else:
                            date_from = filters['date_from']
                        login_queryset = login_queryset.filter(timestamp__date__gte=date_from)
                        alert_queryset = alert_queryset.filter(created_at__date__gte=date_from)
                        incident_queryset = incident_queryset.filter(detection_time__date__gte=date_from)
                        audit_queryset = audit_queryset.filter(timestamp__date__gte=date_from)
                    except:
                        pass
                
                if filters.get('date_to'):
                    try:
                        if isinstance(filters['date_to'], str):
                            date_to = datetime.strptime(filters['date_to'], '%Y-%m-%d').date()
                        else:
                            date_to = filters['date_to']
                        login_queryset = login_queryset.filter(timestamp__date__lte=date_to)
                        alert_queryset = alert_queryset.filter(created_at__date__lte=date_to)
                        incident_queryset = incident_queryset.filter(detection_time__date__lte=date_to)
                        audit_queryset = audit_queryset.filter(timestamp__date__lte=date_to)
                    except:
                        pass
                
                # Filter by alert type
                if alert_type:
                    alert_queryset = alert_queryset.filter(alert_type=alert_type)
                
                # Filter by severity (for alerts and incidents)
                if severity:
                    alert_queryset = alert_queryset.filter(priority=severity)
                    incident_queryset = incident_queryset.filter(severity=severity)
            
            # Login attempts summary
            total_login_attempts = login_queryset.count()
            successful_logins = login_queryset.filter(success=True).count()
            failed_logins = login_queryset.filter(success=False).count()
            login_success_rate = (successful_logins / total_login_attempts * 100) if total_login_attempts > 0 else 0.0
            
            # Suspicious and blocked attempts
            suspicious_attempts = login_queryset.filter(is_suspicious=True).count()
            blocked_attempts = login_queryset.filter(blocked=True).count()
            
            # Failed login attempts by reason
            failed_by_reason = login_queryset.filter(success=False).values('failure_reason').annotate(
                count=Count('id')
            ).order_by('-count')
            
            # Security alerts summary
            alerts_by_type = alert_queryset.values('alert_type').annotate(
                count=Count('id')
            ).order_by('-count')
            
            alerts_by_priority = alert_queryset.values('priority').annotate(
                count=Count('id')
            ).order_by('-count')
            
            unacknowledged_alerts = alert_queryset.filter(is_acknowledged=False).count()
            
            # Security incidents summary
            incidents_by_type = incident_queryset.values('incident_type').annotate(
                count=Count('id')
            ).order_by('-count')
            
            incidents_by_severity = incident_queryset.values('severity').annotate(
                count=Count('id')
            ).order_by('-count')
            
            incidents_by_status = incident_queryset.values('status').annotate(
                count=Count('id')
            ).order_by('-count')
            
            open_incidents = incident_queryset.filter(status__in=['open', 'investigating']).count()
            
            # Audit log summary
            audit_by_action = audit_queryset.values('action_type').annotate(
                count=Count('id')
            ).order_by('-count')
            
            audit_by_severity = audit_queryset.values('severity').annotate(
                count=Count('id')
            ).order_by('-count')
            
            failed_audit_actions = audit_queryset.filter(success=False).count()
            
            # IP address analysis
            top_ips = list(login_queryset.values('ip_address').annotate(
                attempt_count=Count('id'),
                success_count=Count('id', filter=Q(success=True)),
                suspicious_count=Count('id', filter=Q(is_suspicious=True))
            ).order_by('-attempt_count')[:10])
            
            # Blocked IPs
            blocked_ips = login_queryset.filter(blocked=True).values('ip_address').distinct().count()
            
            # Get individual security events for table display
            security_events = []
            
            # Get security alerts - use select_related and convert to list to avoid QuerySet issues
            alerts = list(alert_queryset.select_related('acknowledged_by', 'affected_user').order_by('-created_at'))
            for alert in alerts:
                # Get user info from affected_user or acknowledged_by
                user_info = 'System'
                try:
                    if alert.affected_user:
                        user_info = getattr(alert.affected_user, 'username', None) or str(alert.affected_user)
                    elif alert.acknowledged_by:
                        user_info = getattr(alert.acknowledged_by, 'username', None) or str(alert.acknowledged_by)
                except:
                    pass
                
                security_events.append({
                    'id': int(alert.id) if alert.id else None,
                    'type': 'alert',
                    'event_type': str(alert.alert_type) if alert.alert_type else 'Unknown',
                    'severity': str(alert.priority) if alert.priority else 'Unknown',
                    'description': str(alert.description) if alert.description else '',
                    'status': 'Acknowledged' if alert.is_acknowledged else 'Unacknowledged',
                    'timestamp': alert.created_at.isoformat() if alert.created_at else None,
                    'admin_user': str(user_info)
                })
            
            # Get security incidents - use select_related and convert to list
            incidents = list(incident_queryset.select_related('assigned_to').prefetch_related('affected_users').order_by('-detection_time'))
            for incident in incidents:
                # Get user info from assigned_to or first affected_user
                user_info = 'System'
                try:
                    if incident.assigned_to:
                        user_info = getattr(incident.assigned_to, 'username', None) or str(incident.assigned_to)
                    else:
                        # Get first affected user safely
                        affected_users_list = list(incident.affected_users.all()[:1])
                        if affected_users_list:
                            first_user = affected_users_list[0]
                            user_info = getattr(first_user, 'username', None) or str(first_user)
                except:
                    pass
                
                security_events.append({
                    'id': int(incident.id) if incident.id else None,
                    'type': 'incident',
                    'event_type': str(incident.incident_type) if incident.incident_type else 'Unknown',
                    'severity': str(incident.severity) if incident.severity else 'Unknown',
                    'description': str(incident.description) if incident.description else '',
                    'status': str(incident.status) if incident.status else 'Unknown',
                    'timestamp': incident.detection_time.isoformat() if incident.detection_time else None,
                    'admin_user': str(user_info)
                })
            
            # Get failed login attempts - use values() to get dictionaries directly
            failed_logins = list(login_queryset.filter(success=False).values(
                'id', 'username', 'ip_address', 'failure_reason', 
                'is_suspicious', 'blocked', 'timestamp'
            ).order_by('-timestamp'))
            for login in failed_logins:
                ip_addr = login.get('ip_address') or 'Unknown IP'
                failure_reason = login.get('failure_reason') or ''
                desc = f"Failed login from {ip_addr}"
                if failure_reason:
                    desc += f" - {failure_reason}"
                
                security_events.append({
                    'id': login.get('id'),
                    'type': 'failed_login',
                    'event_type': 'Failed Login',
                    'severity': 'High' if login.get('is_suspicious') else 'Medium',
                    'description': desc,
                    'status': 'Blocked' if login.get('blocked') else 'Active',
                    'timestamp': login.get('timestamp').isoformat() if login.get('timestamp') else None,
                    'admin_user': login.get('username') or 'Unknown'
                })
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                security_events = [
                    event for event in security_events
                    if search_lower in (event.get('event_type', '') or '').lower() or
                       search_lower in (event.get('description', '') or '').lower() or
                       search_lower in (event.get('admin_user', '') or '').lower() or
                       search_lower in (event.get('severity', '') or '').lower() or
                       search_lower in (event.get('status', '') or '').lower()
                ]
            
            # Sort by timestamp (most recent first)
            security_events.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            # Get total count before pagination
            total_count = len(security_events)
            
            # Apply pagination
            paginated_events = security_events[offset:offset + limit]
            
            return {
                'events': paginated_events,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0,
                'login_attempts': {
                    'total': total_login_attempts,
                    'successful': successful_logins,
                    'failed': failed_logins,
                    'success_rate': round(login_success_rate, 2),
                    'suspicious': suspicious_attempts,
                    'blocked': blocked_attempts,
                    'failed_by_reason': list(failed_by_reason)
                },
                'security_alerts': {
                    'total': alert_queryset.count(),
                    'unacknowledged': unacknowledged_alerts,
                    'by_type': list(alerts_by_type),
                    'by_priority': list(alerts_by_priority)
                },
                'security_incidents': {
                    'total': incident_queryset.count(),
                    'open': open_incidents,
                    'by_type': list(incidents_by_type),
                    'by_severity': list(incidents_by_severity),
                    'by_status': list(incidents_by_status)
                },
                'audit_logs': {
                    'total': audit_queryset.count(),
                    'failed_actions': failed_audit_actions,
                    'by_action': list(audit_by_action),
                    'by_severity': list(audit_by_severity)
                },
                'ip_analysis': {
                    'top_ips': top_ips,
                    'blocked_ips_count': blocked_ips
                }
            }
        except Exception as e:
            print(f"Security audit report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'login_attempts': {},
                'security_alerts': {},
                'security_incidents': {},
                'audit_logs': {},
                'ip_analysis': {}
            }
    
    @staticmethod
    def get_form_quality_report(queryset, filters=None):
        """Get detailed form quality report."""
        try:
            # Forms with remarks
            forms_with_remarks = queryset.filter(remarks__isnull=False).distinct()
            forms_with_remarks_count = forms_with_remarks.count()
            
            # Average remarks per form
            total_remarks = FormRemark.objects.filter(form__in=queryset).count()
            total_forms = queryset.count()
            avg_remarks_per_form = (total_remarks / total_forms) if total_forms > 0 else 0.0
            
            # Forms requiring multiple revisions (returned more than once)
            forms_returned_multiple = queryset.filter(
                workflow_status__contains='returned'
            ).annotate(
                return_count=Count('approvals', filter=Q(approvals__status='returned'))
            ).filter(return_count__gt=1).count()
            
            # Answer completeness per form
            total_questions = Question.objects.count()
            form_completeness = []
            
            for form in queryset[:100]:  # Limit to 100 for performance
                answered_count = Answer.objects.filter(
                    form=form,
                    response__isnull=False
                ).exclude(response='').count()
                
                completeness_rate = (answered_count / total_questions * 100) if total_questions > 0 else 0.0
                
                form_completeness.append({
                    'form_id': form.form_id,
                    'school_name': form.school.school_name if form.school else 'Unknown',
                    'answered_count': answered_count,
                    'total_questions': total_questions,
                    'completeness_rate': round(completeness_rate, 2)
                })
            
            # Forms with missing required answers
            required_questions = Question.objects.filter(is_required=True)
            forms_with_missing_required = []
            
            for form in queryset[:100]:  # Limit to 100 for performance
                missing_required = []
                for question in required_questions:
                    answer = Answer.objects.filter(form=form, question=question).first()
                    if not answer or not answer.response or answer.response.strip() == '':
                        missing_required.append(question.question_id)
                
                if missing_required:
                    forms_with_missing_required.append({
                        'form_id': form.form_id,
                        'school_name': form.school.school_name if form.school else 'Unknown',
                        'missing_count': len(missing_required)
                    })
            
            # Quality score per form (based on completeness and revisions)
            quality_scores = []
            for form in queryset[:100]:  # Limit to 100 for performance
                # Completeness score (0-70 points)
                answered_count = Answer.objects.filter(
                    form=form,
                    response__isnull=False
                ).exclude(response='').count()
                completeness_score = (answered_count / total_questions * 70) if total_questions > 0 else 0
                
                # Revision penalty (0-30 points, -10 per return)
                return_count = FormApproval.objects.filter(
                    form=form,
                    status='returned'
                ).count()
                revision_score = max(0, 30 - (return_count * 10))
                
                quality_score = completeness_score + revision_score
                
                quality_scores.append({
                    'form_id': form.form_id,
                    'school_name': form.school.school_name if form.school else 'Unknown',
                    'quality_score': round(quality_score, 2),
                    'completeness_score': round(completeness_score, 2),
                    'revision_score': round(revision_score, 2)
                })
            
            # Remarks by type
            remarks_by_type = FormRemark.objects.filter(form__in=queryset).values('remark_type').annotate(
                count=Count('remark_id')
            ).order_by('-count')
            
            return {
                'summary': {
                    'total_forms': total_forms,
                    'forms_with_remarks': forms_with_remarks_count,
                    'total_remarks': total_remarks,
                    'avg_remarks_per_form': round(avg_remarks_per_form, 2),
                    'forms_requiring_multiple_revisions': forms_returned_multiple
                },
                'form_completeness': form_completeness,
                'forms_with_missing_required': forms_with_missing_required[:50],  # Limit to 50
                'quality_scores': sorted(quality_scores, key=lambda x: x['quality_score'])[:50],  # Top 50
                'remarks_by_type': list(remarks_by_type)
            }
        except Exception as e:
            print(f"Form quality report error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'summary': {},
                'form_completeness': [],
                'forms_with_missing_required': [],
                'quality_scores': [],
                'remarks_by_type': []
            }
    
    @staticmethod
    def get_category_topic_analysis(queryset, filters=None):
        """Get detailed category and topic analysis with pagination and search."""
        try:
            # Get pagination and search parameters
            limit = int(filters.get('limit', 100)) if filters else 100
            offset = int(filters.get('offset', 0)) if filters else 0
            search_query = filters.get('search', '').strip() if filters else ''
            category_id = filters.get('category_ids') or filters.get('category')
            topic_id = filters.get('topic_ids') or filters.get('topic')
            
            # Handle single value or array for category/topic
            if category_id and not isinstance(category_id, list):
                category_id = [category_id]
            if topic_id and not isinstance(topic_id, list):
                topic_id = [topic_id]
            
            # Topic completion rates - base query
            # Note: Topic model uses 'question' (singular) as the reverse relationship name
            # Show all topics, even if they have no answers
            queryset_count = queryset.count()
            print(f"DEBUG: Queryset count: {queryset_count}")
            print(f"DEBUG: Filters: {filters}")
            
            # First, check if there are any topics at all
            total_topics = Topic.objects.count()
            print(f"DEBUG: Total topics in database: {total_topics}")
            
            # Always show all topics, but count answers only from forms in queryset
            # Use manual iteration approach (similar to drilldown code) since relationship traversal in annotations is complex
            topic_completion_list = []
            
            if queryset_count > 0:
                # Get form IDs from queryset (Form model uses 'form_id' as primary key, not 'id')
                form_ids = list(queryset.values_list('form_id', flat=True))
                num_forms = len(form_ids)
                print(f"DEBUG: Form IDs in queryset: {num_forms}")
                print(f"DEBUG: First 5 form IDs: {form_ids[:5]}")
                
                # Check if there are any answers for these forms
                answer_count = Answer.objects.filter(
                    form_id__in=form_ids,
                    response__isnull=False
                ).exclude(response='').count()
                print(f"DEBUG: Total answers for these forms: {answer_count}")
                
                # Iterate through all topics and count school statuses
                for topic in Topic.objects.all():
                    # Get questions for this topic
                    topic_questions = Question.objects.filter(topic=topic)
                    topic_question_ids = list(topic_questions.values_list('question_id', flat=True))
                    total_questions = len(topic_question_ids)
                    
                    # Count school statuses for this topic
                    # Status definitions:
                    # - Not Started: 0 answers for this topic
                    # - Started: 1+ answers but not all questions answered
                    # - Continuing: Same as Started (some answers but not all)
                    # - Finished: All questions in topic are answered
                    
                    not_started_count = 0
                    started_count = 0
                    continuing_count = 0
                    finished_count = 0
                    
                    # For each form, check how many questions in this topic have been answered
                    for form_id in form_ids:
                        # Count answered questions for this form in this topic
                        answered_for_form = Answer.objects.filter(
                            form_id=form_id,
                            question_id__in=topic_question_ids,
                            response__isnull=False
                        ).exclude(response='').count()
                        
                        if answered_for_form == 0:
                            not_started_count += 1
                        elif answered_for_form == total_questions and total_questions > 0:
                            finished_count += 1
                            started_count += 1  # Finished schools are also counted as started
                        elif answered_for_form > 0:
                            started_count += 1
                            continuing_count += 1  # Started but not finished = continuing
                    
                    topic_completion_list.append({
                        'topic_id': topic.topic_id,
                        'name': topic.name,
                        'category__name': topic.category.name if topic.category else None,
                        'category__category_id': topic.category_id,
                        'total_questions': total_questions,
                        'not_started': not_started_count,
                        'started': started_count,
                        'continuing': continuing_count,
                        'finished': finished_count,
                        'num_forms': num_forms
                    })
            else:
                # If queryset is empty, show all topics with 0 answered questions
                print("DEBUG: Queryset is empty, showing all topics with 0 answered questions")
                for topic in Topic.objects.all():
                    topic_questions = Question.objects.filter(topic=topic)
                    topic_question_ids = list(topic_questions.values_list('question_id', flat=True))
                    
                    topic_completion_list.append({
                        'topic_id': topic.topic_id,
                        'name': topic.name,
                        'category__name': topic.category.name if topic.category else None,
                        'category__category_id': topic.category_id,
                        'total_questions': len(topic_question_ids),
                        'not_started': 0,
                        'started': 0,
                        'continuing': 0,
                        'finished': 0,
                        'num_forms': 0  # No forms in queryset
                    })
            
            # Debug: Print topic completion count
            topic_count = len(topic_completion_list)
            print(f"DEBUG: Topic completion count before filtering: {topic_count}")
            
            # Convert to list to see what we have
            topic_list = topic_completion_list[:5]  # Get first 5 for debugging
            print(f"DEBUG: First 5 topics: {topic_list}")
            
            print(f"DEBUG: Topic completion list length BEFORE category/topic filtering: {len(topic_completion_list)}")
            
            # Filter by category if provided (filter the list, not the queryset)
            if category_id:
                if not isinstance(category_id, list):
                    category_id = [category_id]
                category_id = [int(cid) for cid in category_id if cid]
                topic_completion_list = [
                    item for item in topic_completion_list 
                    if item.get('category__category_id') in category_id
                ]
                print(f"DEBUG: After category filter ({category_id}): {len(topic_completion_list)}")
            
            # Filter by topic if provided (filter the list, not the queryset)
            if topic_id:
                if not isinstance(topic_id, list):
                    topic_id = [topic_id]
                topic_id = [int(tid) for tid in topic_id if tid]
                topic_completion_list = [
                    item for item in topic_completion_list 
                    if item.get('topic_id') in topic_id
                ]
                print(f"DEBUG: After topic filter ({topic_id}): {len(topic_completion_list)}")
            
            # Initialize topic_data list
            topic_data = []
            
            for item in topic_completion_list:
                total = item.get('total_questions', 0) or 0
                not_started = item.get('not_started', 0) or 0
                started = item.get('started', 0) or 0
                continuing = item.get('continuing', 0) or 0
                finished = item.get('finished', 0) or 0
                
                topic_data.append({
                    'topic_id': item['topic_id'],
                    'topic_name': item.get('name', 'Unknown'),
                    'category_name': item.get('category__name', 'Unknown'),
                    'category_id': item.get('category__category_id'),
                    'total_questions': total,
                    'not_started': not_started,
                    'started': started,
                    'continuing': continuing,
                    'finished': finished,
                    'total_schools': not_started + started  # Total schools (not_started + started)
                })
            
            print(f"DEBUG: Topic data length after processing: {len(topic_data)}")
            
            # Apply search filter if provided
            if search_query:
                search_lower = search_query.lower()
                topic_data = [
                    item for item in topic_data
                    if search_lower in (item.get('category_name', '') or '').lower() or
                       search_lower in (item.get('topic_name', '') or '').lower()
                ]
            
            # Get total count before pagination
            total_count = len(topic_data)
            
            # Apply pagination
            paginated_data = topic_data[offset:offset + limit]
            
            return {
                'topic_completion': paginated_data,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_next': (offset + limit) < total_count,
                'has_previous': offset > 0
            }
        except Exception as e:
            print(f"Category topic analysis error: {e}")
            import traceback
            traceback.print_exc()
            return {
                'topic_completion': [],
                'total_count': 0,
                'limit': limit if filters else 100,
                'offset': offset if filters else 0,
                'has_next': False,
                'has_previous': False
            }
    