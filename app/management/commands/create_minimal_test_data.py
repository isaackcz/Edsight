"""
Django management command to create minimal test data for immediate testing.
This creates a small dataset to test analytics functionality without waiting for large data generation.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import datetime, timedelta
import random

from app.models import (
    Region, Division, District, School, UsersSchool,
    Category, SubSection, Topic, Question, SubQuestion, QuestionChoice,
    Form, Answer
)
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Create minimal test data for immediate analytics testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Clean existing test data before creating new data'
        )

    def handle(self, *args, **options):
        clean_data = options['clean']
        
        self.stdout.write("Creating minimal test data for analytics testing...")
        
        if clean_data:
            self.clean_test_data()
        
        try:
            with transaction.atomic():
                self.create_minimal_geographic_data()
                self.create_minimal_questions_data()
                self.create_minimal_users_and_forms()
                
            self.stdout.write(
                self.style.SUCCESS('Successfully created minimal test data!')
            )
            
            self.display_statistics()
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating test data: {str(e)}')
            )

    def clean_test_data(self):
        """Clean existing test data"""
        self.stdout.write("Cleaning existing test data...")
        
        Answer.objects.filter(form__is_test_data=True).delete()
        Form.objects.filter(is_test_data=True).delete()
        User.objects.filter(is_test_user=True).delete()
        
        self.stdout.write("Test data cleaned successfully.")

    def create_minimal_geographic_data(self):
        """Create minimal geographic hierarchy"""
        self.stdout.write("Creating minimal geographic data...")
        
        # Create one region
        region, created = Region.objects.get_or_create(
            name='Test Region'
        )
        if created:
            self.stdout.write(f"Created region: {region.name}")
        
        # Create one division
        division, created = Division.objects.get_or_create(
            name='Test Division',
            region=region
        )
        if created:
            self.stdout.write(f"Created division: {division.name}")
        
        # Create one district
        district, created = District.objects.get_or_create(
            name='Test District',
            division=division
        )
        if created:
            self.stdout.write(f"Created district: {district.name}")
        
        # Create 5 schools
        for i in range(5):
            school, created = School.objects.get_or_create(
                school_name=f'Test School {i+1}',
                school_id=f'TESTSCH{i+1}',
                district=district,
                division=division,
                region=region
            )
            if created:
                self.stdout.write(f"Created school: {school.school_name}")

    def create_minimal_questions_data(self):
        """Create minimal questions structure"""
        self.stdout.write("Creating minimal questions data...")
        
        # Create 2 categories
        categories_data = [
            {'name': 'School Information', 'description': 'Basic school details'},
            {'name': 'Academic Performance', 'description': 'Student achievement data'},
        ]
        
        for cat_data in categories_data:
            category, created = Category.objects.get_or_create(
                name=cat_data['name'],
                defaults={'display_order': 1}
            )
            if created:
                self.stdout.write(f"Created category: {category.name}")
        
        # Create subsections for each category
        for category in Category.objects.all():
            for i in range(2):
                subsection, created = SubSection.objects.get_or_create(
                    name=f'{category.name} - Subsection {i+1}',
                    category=category,
                    defaults={'display_order': i + 1}
                )
                if created:
                    self.stdout.write(f"Created subsection: {subsection.name}")
        
        # Create topics for each subsection
        for subsection in SubSection.objects.all():
            for i in range(2):
                topic, created = Topic.objects.get_or_create(
                    name=f'{subsection.name} - Topic {i+1}',
                    sub_section=subsection,
                    defaults={'display_order': i + 1}
                )
                if created:
                    self.stdout.write(f"Created topic: {topic.name}")
        
        # Create questions for each topic
        answer_types = ['text', 'number', 'date', 'percentage']
        
        for topic in Topic.objects.all():
            for i in range(3):
                answer_type = random.choice(answer_types)
                question, created = Question.objects.get_or_create(
                    question_text=f'Question {i+1} for {topic.name}',
                    topic=topic,
                    defaults={
                        'answer_type': answer_type,
                        'is_required': random.choice([True, False]),
                        'display_order': i + 1
                    }
                )
                if created:
                    self.stdout.write(f"Created question: {question.question_text[:50]}...")

    def create_minimal_users_and_forms(self):
        """Create minimal users and forms with answers"""
        self.stdout.write("Creating minimal users and forms...")
        
        schools = list(School.objects.all())
        questions = list(Question.objects.all())
        
        if not schools or not questions:
            self.stdout.write(
                self.style.ERROR("No schools or questions found. Please create geographic and questions data first.")
            )
            return
        
        # Create 20 users
        for i in range(20):
            school = random.choice(schools)
            user, created = User.objects.get_or_create(
                username=f'minitestuser_{i+1:03d}',
                defaults={
                    'email': f'minitestuser_{i+1:03d}@example.com',
                    'first_name': f'Test',
                    'last_name': f'User {i+1}'
                }
            )
            
            if created:
                # Associate user with school
                users_school, us_created = UsersSchool.objects.get_or_create(
                    user=user,
                    defaults={
                        'username': f'minitestuser_{i+1:03d}',
                        'password_hash': 'test_hash',
                        'email': f'minitestuser_{i+1:03d}@example.com',
                        'role': 'school',
                        'school': school,
                        'school_name': school.school_name,
                        'district': school.district,
                        'division': school.division,
                        'region': school.region
                    }
                )
                
                # Create form for user
                form, form_created = Form.objects.get_or_create(
                    user=user,
                    school=users_school,
                    defaults={
                        'status': 'draft'
                    }
                )
                
                if form_created:
                    # Determine if form is completed (80% completion rate)
                    is_completed = random.random() < 0.8
                    
                    if is_completed:
                        form.status = 'completed'
                        form.save()
                    
                    # Generate answers for this form
                    self.generate_answers_for_form(form, questions, is_completed)
            
            if (i + 1) % 5 == 0:
                self.stdout.write(f"Created {i + 1} users...")

    def generate_answers_for_form(self, form, questions, is_completed):
        """Generate answers for a specific form"""
        # Answer 70% of questions
        questions_to_answer = random.sample(
            questions, 
            int(len(questions) * 0.7)
        )
        
        for question in questions_to_answer:
            answer_value = self.generate_answer_value(question)
            
            Answer.objects.get_or_create(
                form=form,
                question=question,
                defaults={
                    'response': answer_value
                }
            )

    def generate_answer_value(self, question):
        """Generate realistic answer value based on question type"""
        if question.answer_type == 'text':
            return f"Sample answer for {question.question_text[:20]}..."
        elif question.answer_type == 'number':
            return str(random.randint(1, 100))
        elif question.answer_type == 'date':
            return (timezone.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d')
        elif question.answer_type == 'percentage':
            return str(random.randint(0, 100))
        return "Default answer"

    def display_statistics(self):
        """Display created data statistics"""
        self.stdout.write("\n" + "="*50)
        self.stdout.write("MINIMAL TEST DATA STATISTICS")
        self.stdout.write("="*50)
        
        stats = {
            'Regions': Region.objects.count(),
            'Divisions': Division.objects.count(),
            'Districts': District.objects.count(),
            'Schools': School.objects.count(),
            'Users': User.objects.count(),
            'Categories': Category.objects.count(),
            'SubSections': SubSection.objects.count(),
            'Topics': Topic.objects.count(),
            'Questions': Question.objects.count(),
            'Forms': Form.objects.count(),
            'Answers': Answer.objects.count(),
        }
        
        for key, value in stats.items():
            self.stdout.write(f"{key}: {value}")
        
        # Completion statistics
        total_forms = Form.objects.count()
        completed_forms = Form.objects.filter(status='completed').count()
        completion_rate = (completed_forms / total_forms * 100) if total_forms > 0 else 0
        
        self.stdout.write(f"\nForm Completion Rate: {completion_rate:.1f}%")
        self.stdout.write(f"Completed Forms: {completed_forms} / {total_forms}")
        
        self.stdout.write("="*50)
        self.stdout.write("\n✅ Minimal test data created successfully!")
        self.stdout.write("You can now test the analytics system with this data.")
        self.stdout.write("\nNext steps:")
        self.stdout.write("1. Run 'python test_analytics_comprehensive.py' to test the system")
        self.stdout.write("2. Visit the reports page to see the analytics in action")
        self.stdout.write("3. Run 'python manage.py generate_test_data --users 1000' for larger dataset")
