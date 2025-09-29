"""
Tests for Form Management System
Tests the workflow, approval, and notification functionality
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
import json

from .models import (
    Form, FormNotification, AdminUser, Region, Division, District, School,
    Category, SubSection, Topic, Question, Answer
)


class FormManagementTestCase(TestCase):
    """Test cases for form management functionality"""
    
    def setUp(self):
        """Set up test data"""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create geographic hierarchy
        self.region = Region.objects.create(name='Test Region')
        self.division = Division.objects.create(name='Test Division', region=self.region)
        self.district = District.objects.create(name='Test District', division=self.division)
        self.school = School.objects.create(
            school_name='Test School',
            school_id='TEST001',
            district=self.district,
            division=self.division,
            region=self.region
        )
        
        # Create admin user
        self.admin_user = AdminUser.objects.create(
            username='admin',
            email='admin@deped.gov.ph',
            password_hash='hashed_password',
            admin_level='central',
            status='active'
        )
        
        # Create form structure
        self.category = Category.objects.create(name='Test Category', display_order=1)
        self.subsection = SubSection.objects.create(
            name='Test Subsection',
            category=self.category,
            display_order=1
        )
        self.topic = Topic.objects.create(
            name='Test Topic',
            sub_section=self.subsection,
            display_order=1
        )
        self.question = Question.objects.create(
            topic=self.topic,
            question_text='Test Question?',
            answer_type='text',
            display_order=1
        )
        
        # Create test form
        self.form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='district_pending',
            current_level='district',
            academic_year='2024-2025',
            submitted_at=timezone.now()
        )
        
        # Create test answer
        self.answer = Answer.objects.create(
            form=self.form,
            question=self.question,
            response='Test Response'
        )
        
        # Create test client
        self.client = Client()
        
        # Mock session for admin
        self.session = self.client.session
        self.session['admin_id'] = self.admin_user.admin_id
        self.session.save()
    
    def test_form_workflow_next_level(self):
        """Test form workflow progression"""
        # Test getting next level
        self.assertEqual(self.form.get_next_level(), 'division')
        
        # Test getting previous level
        self.assertEqual(self.form.get_previous_level(), 'school')
    
    def test_form_approval_workflow(self):
        """Test form approval workflow"""
        # Test district approval
        next_level = self.form.get_next_level()
        self.assertEqual(next_level, 'division')
        
        # Update form status
        self.form.status = 'division_pending'
        self.form.current_level = 'division'
        self.form.save()
        
        # Test division approval
        next_level = self.form.get_next_level()
        self.assertEqual(next_level, 'region')
    
    def test_form_return_workflow(self):
        """Test form return workflow"""
        # Test returning from division to district
        self.form.current_level = 'division'
        previous_level = self.form.get_previous_level()
        self.assertEqual(previous_level, 'district')
        
        # Test returning from district to school
        self.form.current_level = 'district'
        previous_level = self.form.get_previous_level()
        self.assertEqual(previous_level, 'school')
    
    def test_form_notification_creation(self):
        """Test form notification creation"""
        notification = FormNotification.objects.create(
            form=self.form,
            recipient=self.admin_user,
            sender=self.admin_user,
            notification_type='form_submitted',
            title='Test Notification',
            message='This is a test notification',
            priority='medium'
        )
        
        self.assertEqual(notification.form, self.form)
        self.assertEqual(notification.recipient, self.admin_user)
        self.assertEqual(notification.notification_type, 'form_submitted')
        self.assertFalse(notification.is_read)
    
    def test_form_notification_mark_as_read(self):
        """Test marking notification as read"""
        notification = FormNotification.objects.create(
            form=self.form,
            recipient=self.admin_user,
            notification_type='form_submitted',
            title='Test Notification',
            message='This is a test notification'
        )
        
        # Mark as read
        notification.mark_as_read()
        
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)
    
    def test_form_status_choices(self):
        """Test form status choices"""
        # Test all status choices
        statuses = [
            'draft', 'submitted', 'district_pending', 'district_approved', 'district_returned',
            'division_pending', 'division_approved', 'division_returned',
            'region_pending', 'region_approved', 'region_returned',
            'central_pending', 'central_approved', 'central_returned', 'completed'
        ]
        
        for status in statuses:
            form = Form.objects.create(
                user=self.user,
                school=self.school,
                status=status,
                current_level='school'
            )
            self.assertEqual(form.status, status)
    
    def test_form_metadata_fields(self):
        """Test form metadata fields"""
        form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='submitted',
            form_type='standard',
            academic_year='2024-2025',
            submission_deadline=timezone.now() + timezone.timedelta(days=30)
        )
        
        self.assertEqual(form.form_type, 'standard')
        self.assertEqual(form.academic_year, '2024-2025')
        self.assertIsNotNone(form.submission_deadline)
    
    def test_form_hierarchy_access(self):
        """Test form access based on hierarchy"""
        # Test school-level access
        school_form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='draft',
            current_level='school'
        )
        
        self.assertEqual(school_form.current_level, 'school')
        self.assertEqual(school_form.get_next_level(), 'district')
    
    def test_form_approval_model(self):
        """Test FormApproval model"""
        from .models import FormApproval
        
        approval = FormApproval.objects.create(
            form=self.form,
            approver=self.admin_user,
            approval_level='district',
            status='approved',
            comments='Test approval',
            approved_at=timezone.now()
        )
        
        self.assertEqual(approval.form, self.form)
        self.assertEqual(approval.approver, self.admin_user)
        self.assertEqual(approval.approval_level, 'district')
        self.assertEqual(approval.status, 'approved')
    
    def test_form_unique_constraint(self):
        """Test form unique constraint per academic year"""
        # Create first form
        form1 = Form.objects.create(
            user=self.user,
            school=self.school,
            academic_year='2024-2025'
        )
        
        # Try to create duplicate form (should work for different academic year)
        form2 = Form.objects.create(
            user=self.user,
            school=self.school,
            academic_year='2025-2026'
        )
        
        self.assertNotEqual(form1, form2)
        
        # Try to create duplicate for same academic year (should raise error)
        with self.assertRaises(Exception):
            Form.objects.create(
                user=self.user,
                school=self.school,
                academic_year='2024-2025'
            )


class FormManagementAPITestCase(TestCase):
    """Test cases for form management API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        # Create test user and admin
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.admin_user = AdminUser.objects.create(
            username='admin',
            email='admin@deped.gov.ph',
            password_hash='hashed_password',
            admin_level='central',
            status='active'
        )
        
        # Create test school
        self.region = Region.objects.create(name='Test Region')
        self.division = Division.objects.create(name='Test Division', region=self.region)
        self.district = District.objects.create(name='Test District', division=self.division)
        self.school = School.objects.create(
            school_name='Test School',
            school_id='TEST001',
            district=self.district,
            division=self.division,
            region=self.region
        )
        
        # Create test form
        self.form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='district_pending',
            current_level='district',
            submitted_at=timezone.now()
        )
        
        self.client = Client()
        
        # Mock session for admin
        self.session = self.client.session
        self.session['admin_id'] = self.admin_user.admin_id
        self.session.save()
    
    def test_api_user_info(self):
        """Test API user info endpoint"""
        response = self.client.get('/api/admin/form-management/user-info/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertEqual(data['admin_level'], 'central')
    
    def test_api_statistics(self):
        """Test API statistics endpoint"""
        response = self.client.get('/api/admin/form-management/statistics/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('pending_review', data)
        self.assertIn('total_forms', data)
    
    def test_api_forms_list(self):
        """Test API forms list endpoint"""
        response = self.client.get('/api/admin/form-management/forms/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('forms', data)
        self.assertIn('total', data)
    
    def test_api_form_detail(self):
        """Test API form detail endpoint"""
        response = self.client.get(f'/api/admin/form-management/forms/{self.form.form_id}/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('form', data)
        self.assertEqual(data['form']['id'], self.form.form_id)
    
    def test_api_form_approve(self):
        """Test API form approval endpoint"""
        response = self.client.post(
            f'/api/admin/form-management/forms/{self.form.form_id}/approve/',
            data=json.dumps({'comments': 'Test approval'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('next_level', data)
    
    def test_api_form_return(self):
        """Test API form return endpoint"""
        response = self.client.post(
            f'/api/admin/form-management/forms/{self.form.form_id}/return/',
            data=json.dumps({'comments': 'Test return comments'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('previous_level', data)
    
    def test_api_bulk_approve(self):
        """Test API bulk approval endpoint"""
        response = self.client.post(
            '/api/admin/form-management/bulk-approve/',
            data=json.dumps({
                'form_ids': [self.form.form_id],
                'comments': 'Bulk approval test'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('approved_count', data)
    
    def test_api_bulk_return(self):
        """Test API bulk return endpoint"""
        response = self.client.post(
            '/api/admin/form-management/bulk-return/',
            data=json.dumps({
                'form_ids': [self.form.form_id],
                'comments': 'Bulk return test'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('returned_count', data)
    
    def test_api_export_forms(self):
        """Test API export forms endpoint"""
        response = self.client.get('/api/admin/form-management/export/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
    
    def test_api_notifications(self):
        """Test API notifications endpoint"""
        # Create a test notification
        FormNotification.objects.create(
            form=self.form,
            recipient=self.admin_user,
            notification_type='form_submitted',
            title='Test Notification',
            message='Test message'
        )
        
        response = self.client.get('/api/admin/form-management/notifications/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertIn('notifications', data)


class FormManagementIntegrationTestCase(TestCase):
    """Integration tests for form management system"""
    
    def setUp(self):
        """Set up test data"""
        # Create comprehensive test data
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.admin_user = AdminUser.objects.create(
            username='admin',
            email='admin@deped.gov.ph',
            password_hash='hashed_password',
            admin_level='central',
            status='active'
        )
        
        # Create geographic hierarchy
        self.region = Region.objects.create(name='Test Region')
        self.division = Division.objects.create(name='Test Division', region=self.region)
        self.district = District.objects.create(name='Test District', division=self.division)
        self.school = School.objects.create(
            school_name='Test School',
            school_id='TEST001',
            district=self.district,
            division=self.division,
            region=self.region
        )
        
        # Create form structure
        self.category = Category.objects.create(name='Test Category', display_order=1)
        self.subsection = SubSection.objects.create(
            name='Test Subsection',
            category=self.category,
            display_order=1
        )
        self.topic = Topic.objects.create(
            name='Test Topic',
            sub_section=self.subsection,
            display_order=1
        )
        self.question = Question.objects.create(
            topic=self.topic,
            question_text='Test Question?',
            answer_type='text',
            display_order=1
        )
    
    def test_complete_workflow(self):
        """Test complete form workflow from school to central office"""
        # Create form at school level
        form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='draft',
            current_level='school',
            academic_year='2024-2025'
        )
        
        # Submit form to district
        form.status = 'district_pending'
        form.current_level = 'district'
        form.submitted_at = timezone.now()
        form.save()
        
        self.assertEqual(form.status, 'district_pending')
        self.assertEqual(form.current_level, 'district')
        
        # District approves to division
        form.status = 'division_pending'
        form.current_level = 'division'
        form.last_reviewed_by = self.admin_user
        form.last_reviewed_at = timezone.now()
        form.save()
        
        self.assertEqual(form.status, 'division_pending')
        self.assertEqual(form.current_level, 'division')
        
        # Division approves to region
        form.status = 'region_pending'
        form.current_level = 'region'
        form.save()
        
        self.assertEqual(form.status, 'region_pending')
        self.assertEqual(form.current_level, 'region')
        
        # Region approves to central office
        form.status = 'central_pending'
        form.current_level = 'central'
        form.save()
        
        self.assertEqual(form.status, 'central_pending')
        self.assertEqual(form.current_level, 'central')
        
        # Central office completes
        form.status = 'completed'
        form.current_level = 'central'
        form.save()
        
        self.assertEqual(form.status, 'completed')
    
    def test_return_workflow(self):
        """Test form return workflow"""
        # Create form at division level
        form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='division_pending',
            current_level='division',
            academic_year='2024-2025'
        )
        
        # Return to district
        form.status = 'district_returned'
        form.current_level = 'district'
        form.last_reviewed_by = self.admin_user
        form.last_reviewed_at = timezone.now()
        form.save()
        
        self.assertEqual(form.status, 'district_returned')
        self.assertEqual(form.current_level, 'district')
        
        # Return to school
        form.status = 'district_returned'
        form.current_level = 'school'
        form.save()
        
        self.assertEqual(form.status, 'district_returned')
        self.assertEqual(form.current_level, 'school')
    
    def test_notification_workflow(self):
        """Test notification system workflow"""
        # Create form
        form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='district_pending',
            current_level='district',
            academic_year='2024-2025'
        )
        
        # Create approval notification
        notification = FormNotification.objects.create(
            form=form,
            recipient=self.admin_user,
            sender=self.admin_user,
            notification_type='form_approved',
            title='Form Approved',
            message=f'Form for {form.school.school_name} has been approved',
            priority='medium',
            action_required=True
        )
        
        self.assertEqual(notification.form, form)
        self.assertEqual(notification.recipient, self.admin_user)
        self.assertTrue(notification.action_required)
        
        # Mark as read
        notification.mark_as_read()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)
    
    def test_form_with_answers(self):
        """Test form with answers and hierarchical structure"""
        # Create form
        form = Form.objects.create(
            user=self.user,
            school=self.school,
            status='submitted',
            current_level='district',
            academic_year='2024-2025'
        )
        
        # Create answers
        answer1 = Answer.objects.create(
            form=form,
            question=self.question,
            response='Test Response 1'
        )
        
        answer2 = Answer.objects.create(
            form=form,
            question=self.question,
            response='Test Response 2'
        )
        
        # Verify answers
        answers = form.answers.all()
        self.assertEqual(answers.count(), 2)
        self.assertIn(answer1, answers)
        self.assertIn(answer2, answers)
        
        # Verify answer hierarchy
        self.assertEqual(answer1.question.topic.sub_section.category, self.category)
        self.assertEqual(answer1.question.topic.sub_section, self.subsection)
        self.assertEqual(answer1.question.topic, self.topic)
        self.assertEqual(answer1.question, self.question)
