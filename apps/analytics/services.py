"""
Analytics Service Module
Centralized service for all analytics operations with real database data.
"""

from django.db import models
from django.db.models import Q, Count, Avg, Min, Max, F
from django.utils import timezone
from datetime import timedelta
from apps.core.models import (
    Form, Answer, Question, AdminUser,
    Region, Division, District, Category, Topic
)


class AnalyticsService:
    """Centralized analytics service for real-time data processing."""
    
    @staticmethod
    def build_filtered_queryset(filters):
        """Build a filtered queryset based on provided filters."""
        # Start with all forms
        queryset = Form.objects.select_related('school', 'user').prefetch_related('answer_set')
        
        # Apply filters
        if filters.get('region_ids'):
            queryset = queryset.filter(school__region_id__in=filters['region_ids'])
        
        if filters.get('division_ids'):
            queryset = queryset.filter(school__division_id__in=filters['division_ids'])
        
        if filters.get('district_ids'):
            queryset = queryset.filter(school__district_id__in=filters['district_ids'])
        
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
        """Get enhanced filter options with counts using real database structure."""
        from django.db import connection
        
        try:
            with connection.cursor() as cursor:
                # Get regions from real database
                cursor.execute("SELECT id, name FROM regions ORDER BY name")
                regions = [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
                
                # Get divisions with region relationships
                cursor.execute("SELECT id, name, region_id FROM divisions ORDER BY name")
                divisions = [{'id': row[0], 'name': row[1], 'region_id': row[2]} for row in cursor.fetchall()]
                
                # Get districts with division relationships
                cursor.execute("SELECT id, name, division_id FROM districts ORDER BY name")
                districts = [{'id': row[0], 'name': row[1], 'division_id': row[2]} for row in cursor.fetchall()]
                
                # Get schools with geographic data and form counts (only schools with users/forms)
                cursor.execute("""
                    SELECT 
                        us.id, 
                        us.school_name, 
                        us.district_id, 
                        us.division_id, 
                        us.region_id,
                        COUNT(DISTINCT f.form_id) as form_count,
                        COUNT(DISTINCT CASE WHEN f.status = 'completed' THEN f.form_id END) as completed_forms
                    FROM users_school us
                    INNER JOIN forms f ON us.id = f.school_id  -- Only schools with forms
                    WHERE us.is_active = 1
                    GROUP BY us.id, us.school_name, us.district_id, us.division_id, us.region_id
                    HAVING form_count > 0  -- Ensure at least one form exists
                    ORDER BY us.school_name
                """)
                schools = [{'id': row[0], 'school_name': row[1], 'district_id': row[2], 
                           'division_id': row[3], 'region_id': row[4], 'form_count': row[5], 
                           'completed_forms': row[6]} for row in cursor.fetchall()]
                
                # Get categories
                cursor.execute("SELECT category_id, name FROM categories ORDER BY display_order")
                categories = [{'category_id': row[0], 'name': row[1]} for row in cursor.fetchall()]
                
                # Get topics with category relationships
                topics = []
                cursor.execute("SELECT topic_id, name, category_id FROM topics ORDER BY display_order")
                topics = [{'topic_id': row[0], 'name': row[1], 'category_id': row[2]} for row in cursor.fetchall()]
                
                # Get questions with answer counts
                cursor.execute("""
                    SELECT 
                        q.question_id, 
                        q.question_text, 
                        q.topic_id, 
                        q.is_required, 
                        q.answer_type,
                        COUNT(DISTINCT a.answer_id) as answer_count
                    FROM questions q
                    LEFT JOIN answers a ON q.question_id = a.question_id
                    GROUP BY q.question_id, q.question_text, q.topic_id, q.is_required, q.answer_type
                    ORDER BY q.display_order
                """)
                questions = [{'question_id': row[0], 'question_text': row[1], 'topic_id': row[2], 
                             'is_required': bool(row[3]), 'answer_type': row[4], 'answer_count': row[5]} 
                            for row in cursor.fetchall()]
                
                # Sub-questions removed
                # Sub-questions functionality removed
                
                return {
                    'regions': regions,
                    'divisions': divisions,
                    'districts': districts,
                    'schools': schools,
                    'categories': categories,
                    'topics': topics,
                    'questions': questions,
                    # Sub-questions functionality removed
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
                # Sub-questions functionality removed
            }
    
    @staticmethod
    def get_enhanced_school_completion_data(queryset, filters):
        """Get enhanced completion data with geographic information for each school using real database structure."""
        from django.db import connection
        
        school_data = []
        
        # Use raw SQL to get real data from the database structure
        with connection.cursor() as cursor:
            # Query based on the actual database structure from edsight_structure.sql
            sql = """
            SELECT 
                us.id as school_id,
                us.school_name,
                us.region_id,
                r.name as region_name,
                us.division_id,
                d.name as division_name,
                us.district_id,
                dt.name as district_name,
                COUNT(DISTINCT f.form_id) as total_forms,
                COUNT(DISTINCT CASE WHEN f.status = 'completed' THEN f.form_id END) as completed_forms,
                COUNT(DISTINCT a.answer_id) as total_answers,
                COUNT(DISTINCT CASE WHEN a.response IS NOT NULL AND a.response != '' THEN a.answer_id END) as answered_questions,
                (SELECT COUNT(*) FROM questions) as total_questions
            FROM users_school us
            LEFT JOIN regions r ON us.region_id = r.id
            LEFT JOIN divisions d ON us.division_id = d.id
            LEFT JOIN districts dt ON us.district_id = dt.id
            LEFT JOIN forms f ON us.id = f.school_id
            LEFT JOIN answers a ON f.form_id = a.form_id
            WHERE us.is_active = 1
            GROUP BY us.id, us.school_name, us.region_id, r.name, us.division_id, d.name, us.district_id, dt.name
            ORDER BY r.name, d.name, dt.name, us.school_name
            """
            
            cursor.execute(sql)
            rows = cursor.fetchall()
            
            for row in rows:
                school_id, school_name, region_id, region_name, division_id, division_name, district_id, district_name, total_forms, completed_forms, total_answers, answered_questions, total_questions = row
                
                # Calculate completion percentage
                completion_pct = answered_questions / total_questions if total_questions > 0 else 0
                
                # Determine status
                if completion_pct >= 0.9:
                    status = 'Completed'
                elif completion_pct >= 0.5:
                    status = 'In Progress'
                else:
                    status = 'Not Started'
                
                school_data.append({
                    'school_id': school_id,
                    'school_name': school_name or 'Unknown School',
                    'region_id': region_id,
                    'region_name': region_name or 'Unknown Region',
                    'division_id': division_id,
                    'division_name': division_name or 'Unknown Division',
                    'district_id': district_id,
                    'district_name': district_name or 'Unknown District',
                    'completion_pct': completion_pct,
                    'answered': answered_questions or 0,
                    'required': total_questions or 0,
                    'status': status,
                    'total_forms': total_forms or 0,
                    'completed_forms': completed_forms or 0
                })
        
        return school_data
    
    @staticmethod
    def get_category_content_data(queryset, filters):
        """Get category content data only for schools that have users with forms/responses."""
        from django.db import connection
        
        content_data = []
        
        # Use raw SQL to get data only from schools that have actual users and forms
        with connection.cursor() as cursor:
            # Query to get data only from schools with active users and forms
            sql = """
            SELECT 
                us.id as school_id,
                us.school_name,
                us.region_id,
                r.name as region_name,
                us.division_id,
                d.name as division_name,
                us.district_id,
                dt.name as district_name,
                c.category_id,
                c.name as category_name,
                t.topic_id,
                t.name as topic_name,
                q.question_id,
                q.question_text,
                q.answer_type,
                q.is_required,
                -- Sub-questions functionality removed
                a.answer_id,
                a.response,
                f.status as form_status
            FROM users_school us
            INNER JOIN forms f ON us.id = f.school_id  -- Only schools with forms
            LEFT JOIN regions r ON us.region_id = r.id
            LEFT JOIN divisions d ON us.division_id = d.id
            LEFT JOIN districts dt ON us.district_id = dt.id
            LEFT JOIN answers a ON f.form_id = a.form_id
            LEFT JOIN questions q ON a.question_id = q.question_id
            -- Sub-questions functionality removed
            LEFT JOIN topics t ON q.topic_id = t.topic_id
            LEFT JOIN categories c ON t.category_id = c.category_id
            WHERE us.is_active = 1 
            AND EXISTS (
                SELECT 1 FROM forms f2 
                WHERE f2.school_id = us.id
            )
            AND q.question_id IS NOT NULL
            ORDER BY 
                r.name, d.name, dt.name, us.school_name,
                c.display_order, ss.display_order, t.display_order, q.display_order, sq.display_order
            """
            
            cursor.execute(sql)
            rows = cursor.fetchall()
            
            for row in rows:
                (school_id, school_name, region_id, region_name, division_id, division_name, 
                 district_id, district_name, category_id, category_name, 
                 topic_id, topic_name, question_id, question_text, 
                 answer_type, is_required, 
                 answer_id, response, form_status) = row
                
                # Only include rows where we have actual content structure and the school has forms
                if category_id and topic_id and question_id:
                    content_data.append({
                        'school_id': school_id,
                        'school_name': school_name or 'Unknown School',
                        'region_id': region_id,
                        'region_name': region_name or 'Unknown Region',
                        'division_id': division_id,
                        'division_name': division_name or 'Unknown Division',
                        'district_id': district_id,
                        'district_name': district_name or 'Unknown District',
                        'category_id': category_id,
                        'category': category_name or 'Unknown Category',
                        'subsection_id': None,
                        'subsection': '',
                        'topic_id': topic_id,
                        'topic': topic_name or 'Unknown Topic',
                        'question_id': question_id,
                        'question': question_text or 'Unknown Question',
                        # Sub-questions functionality removed
                        'answer_type': answer_type,
                        'is_required': bool(is_required),
                        'response': response or '',
                        'form_status': form_status,
                        'has_answer': bool(answer_id and response),
                        'answer': response or ''  # Add answer field for display
                    })
        
        return content_data
    
    @staticmethod
    def get_hierarchical_filter_options(filter_type, parent_id):
        """Get hierarchical filter options based on parent selection."""
        from django.db import connection
        
        try:
            with connection.cursor() as cursor:
                if filter_type == 'division' and parent_id:
                    # Get divisions for a specific region
                    cursor.execute("""
                        SELECT id, name 
                        FROM divisions 
                        WHERE region_id = %s 
                        ORDER BY name
                    """, [parent_id])
                    return [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
                
                elif filter_type == 'district' and parent_id:
                    # Get districts for a specific division
                    cursor.execute("""
                        SELECT id, name 
                        FROM districts 
                        WHERE division_id = %s 
                        ORDER BY name
                    """, [parent_id])
                    return [{'id': row[0], 'name': row[1]} for row in cursor.fetchall()]
                
                elif filter_type == 'school' and parent_id:
                    # Get schools for a specific district (only schools with users/forms)
                    cursor.execute("""
                        SELECT us.id, us.school_name 
                        FROM users_school us
                        INNER JOIN forms f ON us.id = f.school_id
                        WHERE us.district_id = %s AND us.is_active = 1
                        GROUP BY us.id, us.school_name
                        HAVING COUNT(f.form_id) > 0
                        ORDER BY us.school_name
                    """, [parent_id])
                    return [{'id': row[0], 'school_name': row[1]} for row in cursor.fetchall()]
                
                # Sub-sections removed
                
                elif filter_type == 'topic' and parent_id:
                    # Get topics for a specific category (sub-sections removed)
                    cursor.execute("""
                        SELECT topic_id, name 
                        FROM topics 
                        WHERE category_id = %s 
                        ORDER BY display_order
                    """, [parent_id])
                    return [{'topic_id': row[0], 'name': row[1]} for row in cursor.fetchall()]
                
                elif filter_type == 'question' and parent_id:
                    # Get questions for a specific topic
                    cursor.execute("""
                        SELECT question_id, question_text, answer_type, is_required
                        FROM questions 
                        WHERE topic_id = %s 
                        ORDER BY display_order
                    """, [parent_id])
                    return [{'question_id': row[0], 'question_text': row[1], 'answer_type': row[2], 'is_required': bool(row[3])} for row in cursor.fetchall()]
                
                elif filter_type == 'subquestion' and parent_id:
                    # Get sub-questions for a specific question
                    # Sub-questions functionality removed
                    return []
                
                else:
                    return []
                    
        except Exception as e:
            print(f"Hierarchical filter options error: {e}")
            return []
    