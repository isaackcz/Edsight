"""
Django management command to generate test data for analytics testing.
This creates realistic test data to simulate 90k users and 4k questions with answers.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timedelta
import random
import logging

from app.models import (
    Region, Division, District, School, UsersSchool,
    Category, SubSection, Topic, Question, SubQuestion, QuestionChoice,
    Form, Answer
)
from django.contrib.auth import get_user_model

User = get_user_model()

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Generate test data for analytics testing (90k users, 4k questions with answers)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=1000,  # Start with 1000 users for testing
            help='Number of users to create (default: 1000)'
        )
        parser.add_argument(
            '--answers-per-user',
            type=int,
            default=100,  # Each user answers 100 questions
            help='Number of answers per user (default: 100)'
        )
        parser.add_argument(
            '--completion-rate',
            type=float,
            default=0.75,  # 75% completion rate
            help='Form completion rate (0.0 to 1.0, default: 0.75)'
        )
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Clean existing test data before generating new data'
        )

    def handle(self, *args, **options):
        users_count = options['users']
        answers_per_user = options['answers_per_user']
        completion_rate = options['completion_rate']
        clean_data = options['clean']

        self.stdout.write(f"Generating test data for {users_count} users...")
        
        if clean_data:
            self.clean_test_data()
        
        try:
            with transaction.atomic():
                # Generate test data
                self.generate_geographic_data()
                self.generate_questions_data()
                self.generate_users_and_forms(users_count, answers_per_user, completion_rate)
                
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully generated test data: {users_count} users, '
                    f'{answers_per_user} answers per user, {completion_rate*100}% completion rate'
                )
            )
            
            # Display statistics
            self.display_statistics()
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error generating test data: {str(e)}')
            )
            logger.error(f'Test data generation failed: {str(e)}', exc_info=True)

    def clean_test_data(self):
        """Clean existing test data"""
        self.stdout.write("Cleaning existing test data...")
        
        # Delete test answers
        Answer.objects.filter(form__is_test_data=True).delete()
        
        # Delete test forms
        Form.objects.filter(is_test_data=True).delete()
        
        # Delete test users (but keep admin users)
        User.objects.filter(is_test_user=True).delete()
        
        self.stdout.write("Test data cleaned successfully.")

    def generate_geographic_data(self):
        """Generate realistic geographic hierarchy"""
        self.stdout.write("Generating geographic data...")
        
        # Create regions if they don't exist
        regions_data = [
            {'name': 'National Capital Region', 'code': 'NCR'},
            {'name': 'Region I - Ilocos', 'code': 'R01'},
            {'name': 'Region II - Cagayan Valley', 'code': 'R02'},
            {'name': 'Region III - Central Luzon', 'code': 'R03'},
            {'name': 'Region IV-A - CALABARZON', 'code': 'R04A'},
            {'name': 'Region IV-B - MIMAROPA', 'code': 'R04B'},
            {'name': 'Region V - Bicol', 'code': 'R05'},
            {'name': 'Region VI - Western Visayas', 'code': 'R06'},
            {'name': 'Region VII - Central Visayas', 'code': 'R07'},
            {'name': 'Region VIII - Eastern Visayas', 'code': 'R08'},
            {'name': 'Region IX - Zamboanga Peninsula', 'code': 'R09'},
            {'name': 'Region X - Northern Mindanao', 'code': 'R10'},
            {'name': 'Region XI - Davao', 'code': 'R11'},
            {'name': 'Region XII - SOCCSKSARGEN', 'code': 'R12'},
            {'name': 'Region XIII - Caraga', 'code': 'R13'},
            {'name': 'Cordillera Administrative Region', 'code': 'CAR'},
            {'name': 'Bangsamoro Autonomous Region', 'code': 'BARMM'},
        ]
        
        for region_data in regions_data:
            region, created = Region.objects.get_or_create(
                code=region_data['code'],
                defaults={'name': region_data['name']}
            )
            if created:
                self.stdout.write(f"Created region: {region.name}")
        
        # Create divisions for each region (2-5 divisions per region)
        for region in Region.objects.all():
            divisions_count = random.randint(2, 5)
            for i in range(divisions_count):
                division, created = Division.objects.get_or_create(
                    name=f"{region.name} Division {i+1}",
                    region=region,
                    defaults={'code': f"{region.code}D{i+1:02d}"}
                )
                if created:
                    self.stdout.write(f"Created division: {division.name}")
        
        # Create districts for each division (3-8 districts per division)
        for division in Division.objects.all():
            districts_count = random.randint(3, 8)
            for i in range(districts_count):
                district, created = District.objects.get_or_create(
                    name=f"{division.name} District {i+1}",
                    division=division,
                    defaults={'code': f"{division.code}DT{i+1:02d}"}
                )
                if created:
                    self.stdout.write(f"Created district: {district.name}")
        
        # Create schools for each district (5-15 schools per district)
        for district in District.objects.all():
            schools_count = random.randint(5, 15)
            for i in range(schools_count):
                school, created = School.objects.get_or_create(
                    name=f"{district.name} Elementary School {i+1}",
                    district=district,
                    defaults={
                        'code': f"{district.code}ES{i+1:03d}",
                        'school_type': random.choice(['Elementary', 'High School', 'Integrated']),
                        'enrollment': random.randint(100, 2000)
                    }
                )
                if created:
                    self.stdout.write(f"Created school: {school.name}")

    def generate_questions_data(self):
        """Generate 4k questions with realistic structure"""
        self.stdout.write("Generating questions data...")
        
        # Create categories
        categories_data = [
            {'name': 'School Information', 'description': 'Basic school details and demographics'},
            {'name': 'Academic Performance', 'description': 'Student achievement and learning outcomes'},
            {'name': 'Teaching Staff', 'description': 'Teacher qualifications and professional development'},
            {'name': 'Learning Resources', 'description': 'Educational materials and facilities'},
            {'name': 'Student Support Services', 'description': 'Guidance, health, and welfare services'},
            {'name': 'Community Engagement', 'description': 'Parent and community involvement'},
            {'name': 'Financial Management', 'description': 'Budget and resource allocation'},
            {'name': 'School Leadership', 'description': 'Administrative and management practices'},
        ]
        
        for cat_data in categories_data:
            category, created = Category.objects.get_or_create(
                name=cat_data['name'],
                defaults={'description': cat_data['description']}
            )
            if created:
                self.stdout.write(f"Created category: {category.name}")
        
        # Create subsections for each category (3-5 subsections per category)
        for category in Category.objects.all():
            subsections_count = random.randint(3, 5)
            for i in range(subsections_count):
                subsection, created = SubSection.objects.get_or_create(
                    name=f"{category.name} - Subsection {i+1}",
                    category=category,
                    defaults={'description': f"Subsection {i+1} of {category.name}"}
                )
                if created:
                    self.stdout.write(f"Created subsection: {subsection.name}")
        
        # Create topics for each subsection (2-4 topics per subsection)
        for subsection in SubSection.objects.all():
            topics_count = random.randint(2, 4)
            for i in range(topics_count):
                topic, created = Topic.objects.get_or_create(
                    name=f"{subsection.name} - Topic {i+1}",
                    subsection=subsection,
                    defaults={'description': f"Topic {i+1} of {subsection.name}"}
                )
                if created:
                    self.stdout.write(f"Created topic: {topic.name}")
        
        # Create questions for each topic (5-10 questions per topic)
        question_types = ['text', 'number', 'choice', 'multiple_choice', 'date', 'boolean']
        
        for topic in Topic.objects.all():
            questions_count = random.randint(5, 10)
            for i in range(questions_count):
                question_type = random.choice(question_types)
                question, created = Question.objects.get_or_create(
                    text=f"Question {i+1} for {topic.name}",
                    topic=topic,
                    defaults={
                        'question_type': question_type,
                        'is_required': random.choice([True, False]),
                        'display_order': i + 1
                    }
                )
                if created:
                    self.stdout.write(f"Created question: {question.text[:50]}...")
                    
                    # Create choices for choice-type questions
                    if question_type in ['choice', 'multiple_choice']:
                        choices_count = random.randint(3, 6)
                        for j in range(choices_count):
                            QuestionChoice.objects.get_or_create(
                                question=question,
                                choice_text=f"Option {j+1}",
                                defaults={'display_order': j + 1}
                            )
        
        # Create sub-questions for some questions (20% of questions have sub-questions)
        questions_with_subquestions = Question.objects.all()[:Question.objects.count() // 5]
        for question in questions_with_subquestions:
            subquestions_count = random.randint(2, 4)
            for i in range(subquestions_count):
                SubQuestion.objects.get_or_create(
                    question=question,
                    text=f"Sub-question {i+1} for {question.text[:30]}...",
                    defaults={
                        'question_type': random.choice(question_types),
                        'is_required': random.choice([True, False]),
                        'display_order': i + 1
                    }
                )

    def generate_users_and_forms(self, users_count, answers_per_user, completion_rate):
        """Generate users and their form submissions with answers"""
        self.stdout.write(f"Generating {users_count} users with forms and answers...")
        
        schools = list(School.objects.all())
        if not schools:
            self.stdout.write(self.style.ERROR("No schools found. Please generate geographic data first."))
            return
        
        # Create users
        for i in range(users_count):
            school = random.choice(schools)
            user, created = User.objects.get_or_create(
                username=f"testuser_{i+1:06d}",
                defaults={
                    'email': f"testuser_{i+1:06d}@example.com",
                    'first_name': f"Test",
                    'last_name': f"User {i+1}",
                    'is_test_user': True
                }
            )
            
            if created:
                # Associate user with school
                UsersSchool.objects.get_or_create(
                    user=user,
                    school=school
                )
                
                # Create form for user
                form, form_created = Form.objects.get_or_create(
                    user=user,
                    defaults={
                        'status': 'draft',
                        'is_test_data': True,
                        'created_at': timezone.now() - timedelta(days=random.randint(1, 30))
                    }
                )
                
                if form_created:
                    # Determine if form is completed based on completion rate
                    is_completed = random.random() < completion_rate
                    
                    if is_completed:
                        form.status = 'completed'
                        form.completed_at = form.created_at + timedelta(
                            hours=random.randint(1, 48)
                        )
                        form.save()
                    
                    # Generate answers for this form
                    self.generate_answers_for_form(form, answers_per_user, is_completed)
            
            if (i + 1) % 100 == 0:
                self.stdout.write(f"Generated {i + 1} users...")

    def generate_answers_for_form(self, form, answers_count, is_completed):
        """Generate answers for a specific form"""
        questions = list(Question.objects.all())
        subquestions = list(SubQuestion.objects.all())
        
        # Select random questions to answer
        selected_questions = random.sample(questions, min(answers_count, len(questions)))
        
        for question in selected_questions:
            # Answer the main question
            self.create_answer_for_question(form, question, is_completed)
            
            # Answer sub-questions if they exist
            subquestions_for_question = subquestions.filter(question=question)
            for subquestion in subquestions_for_question:
                if random.random() < 0.8:  # 80% chance to answer sub-question
                    self.create_answer_for_question(form, subquestion, is_completed)

    def create_answer_for_question(self, form, question, is_completed):
        """Create an answer for a specific question"""
        answer_value = self.generate_answer_value(question)
        
        Answer.objects.get_or_create(
            form=form,
            question=question,
            defaults={
                'answer_value': answer_value,
                'answered_at': form.created_at + timedelta(
                    minutes=random.randint(1, 120)
                ) if is_completed else None
            }
        )

    def generate_answer_value(self, question):
        """Generate realistic answer value based on question type"""
        if question.question_type == 'text':
            return f"Sample text answer for {question.text[:20]}..."
        elif question.question_type == 'number':
            return str(random.randint(1, 100))
        elif question.question_type == 'boolean':
            return str(random.choice([True, False]))
        elif question.question_type == 'date':
            return (timezone.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d')
        elif question.question_type in ['choice', 'multiple_choice']:
            choices = QuestionChoice.objects.filter(question=question)
            if choices.exists():
                if question.question_type == 'multiple_choice':
                    # Return multiple choices as comma-separated
                    selected_choices = random.sample(list(choices), random.randint(1, 3))
                    return ','.join([choice.choice_text for choice in selected_choices])
                else:
                    return random.choice(choices).choice_text
        return "Default answer"

    def display_statistics(self):
        """Display generated data statistics"""
        self.stdout.write("\n" + "="*50)
        self.stdout.write("GENERATED DATA STATISTICS")
        self.stdout.write("="*50)
        
        stats = {
            'Regions': Region.objects.count(),
            'Divisions': Division.objects.count(),
            'Districts': District.objects.count(),
            'Schools': School.objects.count(),
            'Users': User.objects.filter(is_test_user=True).count(),
            'Categories': Category.objects.count(),
            'SubSections': SubSection.objects.count(),
            'Topics': Topic.objects.count(),
            'Questions': Question.objects.count(),
            'SubQuestions': SubQuestion.objects.count(),
            'Forms': Form.objects.filter(is_test_data=True).count(),
            'Answers': Answer.objects.filter(form__is_test_data=True).count(),
        }
        
        for key, value in stats.items():
            self.stdout.write(f"{key}: {value:,}")
        
        # Completion statistics
        total_forms = Form.objects.filter(is_test_data=True).count()
        completed_forms = Form.objects.filter(is_test_data=True, status='completed').count()
        completion_rate = (completed_forms / total_forms * 100) if total_forms > 0 else 0
        
        self.stdout.write(f"\nForm Completion Rate: {completion_rate:.1f}%")
        self.stdout.write(f"Completed Forms: {completed_forms:,} / {total_forms:,}")
        
        self.stdout.write("="*50)
