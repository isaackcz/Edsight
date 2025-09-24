"""
Enhanced Logging Utilities for EdSight
Extends the basic logging system with comprehensive audit trails for all database operations
"""

from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import LoginAttempt, AuditLog
from .logging_utils import SystemLogger
import logging
import json

logger = logging.getLogger(__name__)

class EnhancedSystemLogger(SystemLogger):
    """Extended logging system with comprehensive database operation tracking"""
    
    # ========== EDUCATIONAL DATA OPERATIONS ==========
    
    @staticmethod
    def log_question_change(user, question, action, old_data=None, new_data=None, ip_address=None, user_agent=None):
        """Log question management operations"""
        changes = {}
        if old_data and new_data:
            for key in new_data:
                if key in old_data and old_data[key] != new_data[key]:
                    changes[key] = {'old': old_data[key], 'new': new_data[key]}
        
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'question_{action}',
            resource_type='question',
            resource_id=question.question_id,
            description=f'{action.title()} question: {question.question_text[:100]}...',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='high',  # Educational content is critical
            metadata={
                'question_id': question.question_id,
                'topic_id': question.topic_id,
                'answer_type': question.answer_type,
                'is_required': question.is_required,
                'changes': changes,
                'full_old_data': old_data,
                'full_new_data': new_data
            }
        )
    
    @staticmethod
    def log_category_change(user, category, action, old_data=None, new_data=None, ip_address=None, user_agent=None):
        """Log category management operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'category_{action}',
            resource_type='category',
            resource_id=category.category_id,
            description=f'{action.title()} category: {category.name}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='medium',
            metadata={
                'category_id': category.category_id,
                'name': category.name,
                'display_order': category.display_order,
                'old_data': old_data,
                'new_data': new_data
            }
        )
    
    @staticmethod
    def log_topic_change(user, topic, action, old_data=None, new_data=None, ip_address=None, user_agent=None):
        """Log topic management operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'topic_{action}',
            resource_type='topic',
            resource_id=topic.topic_id,
            description=f'{action.title()} topic: {topic.name}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='medium',
            metadata={
                'topic_id': topic.topic_id,
                'sub_section_id': topic.sub_section_id,
                'name': topic.name,
                'display_order': topic.display_order,
                'old_data': old_data,
                'new_data': new_data
            }
        )
    
    # ========== FORM & RESPONSE TRACKING ==========
    
    @staticmethod
    def log_form_status_change(user, form, old_status, new_status, comments=None, ip_address=None, user_agent=None):
        """Log form status changes"""
        SystemLogger.log_user_activity(
            user=user,
            action_type='form_status_change',
            resource_type='form',
            resource_id=form.form_id,
            description=f'Form status changed from {old_status} to {new_status}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='high',
            metadata={
                'form_id': form.form_id,
                'school_id': form.school_id,
                'old_status': old_status,
                'new_status': new_status,
                'comments': comments,
                'created_at': form.created_at.isoformat() if form.created_at else None
            }
        )
    
    @staticmethod
    def log_answer_change(user, answer, action, old_value=None, ip_address=None, user_agent=None):
        """Log answer modifications"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'answer_{action}',
            resource_type='answer',
            resource_id=answer.answer_id,
            description=f'{action.title()} answer for question {answer.question_id}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='high',  # Answer changes are critical for data integrity
            metadata={
                'answer_id': answer.answer_id,
                'form_id': answer.form_id,
                'question_id': answer.question_id,
                'sub_question_id': answer.sub_question_id,
                'old_value': old_value,
                'new_value': answer.response,
                'answered_at': answer.answered_at.isoformat() if answer.answered_at else None
            }
        )
    
    @staticmethod
    def log_form_approval(user, approval, action, comments=None, ip_address=None, user_agent=None):
        """Log form approval workflow events"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'form_{action}',
            resource_type='form_approval',
            resource_id=approval.approval_id,
            description=f'Form {approval.form_id} {action} at {approval.approval_level} level',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='critical',  # Approval workflow is critical
            metadata={
                'approval_id': approval.approval_id,
                'form_id': approval.form_id,
                'approval_level': approval.approval_level,
                'status': approval.status,
                'comments': comments or approval.comments,
                'approved_at': approval.approved_at.isoformat() if approval.approved_at else None
            }
        )
    
    # ========== ADMINISTRATIVE OPERATIONS ==========
    
    @staticmethod
    def log_admin_user_change(acting_admin, target_admin, action, field_changes=None, ip_address=None, user_agent=None):
        """Log admin user management operations"""
        User = get_user_model()
        try:
            user_obj = User.objects.get(username=acting_admin.username)
        except User.DoesNotExist:
            user_obj = None
        
        SystemLogger.log_user_activity(
            user=user_obj,
            action_type=f'admin_{action}',
            resource_type='admin_user',
            resource_id=target_admin.admin_id,
            description=f'{action.title()} admin user: {target_admin.username} ({target_admin.admin_level})',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='critical',  # Admin changes are always critical
            metadata={
                'acting_admin_id': acting_admin.admin_id,
                'target_admin_id': target_admin.admin_id,
                'target_username': target_admin.username,
                'target_admin_level': target_admin.admin_level,
                'target_status': target_admin.status,
                'field_changes': field_changes,
                'assigned_area': target_admin.assigned_area
            }
        )
    
    @staticmethod
    def log_permission_change(acting_admin, target_admin, permission, action, ip_address=None, user_agent=None):
        """Log admin permission changes"""
        User = get_user_model()
        try:
            user_obj = User.objects.get(username=acting_admin.username)
        except User.DoesNotExist:
            user_obj = None
        
        SystemLogger.log_user_activity(
            user=user_obj,
            action_type=f'permission_{action}',
            resource_type='admin_permission',
            resource_id=target_admin.admin_id,
            description=f'{action.title()} permission "{permission}" for {target_admin.username}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='critical',  # Permission changes are critical
            metadata={
                'acting_admin_id': acting_admin.admin_id,
                'target_admin_id': target_admin.admin_id,
                'permission_name': permission,
                'action': action,
                'target_admin_level': target_admin.admin_level
            }
        )
    
    @staticmethod
    def log_user_school_change(user, user_school, action, field_changes=None, ip_address=None, user_agent=None):
        """Log school user management operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'school_user_{action}',
            resource_type='users_school',
            resource_id=user_school.id,
            description=f'{action.title()} school user: {user_school.username}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='high',
            metadata={
                'user_school_id': user_school.id,
                'username': user_school.username,
                'email': user_school.email,
                'school_id': user_school.school_id,
                'school_name': user_school.school_name,
                'is_active': user_school.is_active,
                'field_changes': field_changes,
                'approval_status': user_school.approval_status
            }
        )
    
    # ========== GEOGRAPHIC & ORGANIZATIONAL OPERATIONS ==========
    
    @staticmethod
    def log_school_change(user, school, action, field_changes=None, ip_address=None, user_agent=None):
        """Log school management operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'school_{action}',
            resource_type='school',
            resource_id=school.id,
            description=f'{action.title()} school: {school.school_name}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='high',
            metadata={
                'school_id': school.school_id,
                'school_name': school.school_name,
                'district_id': school.district_id,
                'division_id': school.division_id,
                'region_id': school.region_id,
                'field_changes': field_changes
            }
        )
    
    @staticmethod
    def log_geographic_change(user, entity, entity_type, action, field_changes=None, ip_address=None, user_agent=None):
        """Log geographic entity changes (regions, divisions, districts)"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'{entity_type}_{action}',
            resource_type=entity_type,
            resource_id=entity.id,
            description=f'{action.title()} {entity_type}: {entity.name}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='medium',
            metadata={
                f'{entity_type}_id': entity.id,
                'name': entity.name,
                'field_changes': field_changes
            }
        )
    
    # ========== SECURITY & COMPLIANCE OPERATIONS ==========
    
    @staticmethod
    def log_account_lockout(username, action, reason=None, ip_address=None, user_agent=None):
        """Log account lockout events"""
        SystemLogger.log_security_event(
            event_type='account_lockout',
            description=f'Account {action}: {username}' + (f' - {reason}' if reason else ''),
            ip_address=ip_address,
            severity='high',
            metadata={
                'username': username,
                'action': action,
                'reason': reason,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    @staticmethod
    def log_data_subject_request(user, request_obj, action, ip_address=None, user_agent=None):
        """Log GDPR data subject requests"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'gdpr_{action}',
            resource_type='data_subject_request',
            resource_id=request_obj.id,
            description=f'{action.title()} GDPR request: {request_obj.request_type}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='critical',  # GDPR compliance is critical
            metadata={
                'request_id': request_obj.id,
                'request_type': request_obj.request_type,
                'status': request_obj.status,
                'verification_token': request_obj.verification_token,
                'submitted_at': request_obj.submitted_at.isoformat() if request_obj.submitted_at else None
            }
        )
    
    @staticmethod
    def log_encryption_key_operation(user, key_obj, action, ip_address=None, user_agent=None):
        """Log encryption key management operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'encryption_key_{action}',
            resource_type='encryption_key',
            resource_id=key_obj.key_id,
            description=f'{action.title()} encryption key: {key_obj.key_purpose}',
            ip_address=ip_address,
            user_agent=user_agent,
            severity='critical',  # Key management is critical
            metadata={
                'key_id': key_obj.key_id,
                'key_purpose': key_obj.key_purpose,
                'is_active': key_obj.is_active,
                'rotation_count': key_obj.rotation_count,
                'expires_at': key_obj.expires_at.isoformat() if key_obj.expires_at else None
            }
        )
    
    # ========== DATA & ANALYTICS OPERATIONS ==========
    
    @staticmethod
    def log_data_import(user, import_type, record_count, success=True, errors=None, ip_address=None, user_agent=None):
        """Log data import operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type='data_import',
            resource_type=import_type,
            description=f'Data import: {record_count} {import_type} records {"imported" if success else "failed"}',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            severity='medium',
            error_message=str(errors) if errors else None,
            metadata={
                'import_type': import_type,
                'record_count': record_count,
                'errors': errors,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    @staticmethod
    def log_report_generation(user, report_type, report_id=None, success=True, ip_address=None, user_agent=None):
        """Log report generation and access"""
        SystemLogger.log_user_activity(
            user=user,
            action_type='report_generate',
            resource_type='report',
            resource_id=report_id,
            description=f'Generated {report_type} report',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            severity='low',
            metadata={
                'report_type': report_type,
                'report_id': report_id,
                'generated_at': timezone.now().isoformat()
            }
        )
    
    # ========== BULK OPERATIONS ==========
    
    @staticmethod
    def log_bulk_operation(user, operation_type, resource_type, affected_count, success=True, errors=None, ip_address=None, user_agent=None):
        """Log bulk operations"""
        SystemLogger.log_user_activity(
            user=user,
            action_type=f'bulk_{operation_type}',
            resource_type=resource_type,
            description=f'Bulk {operation_type}: {affected_count} {resource_type} records',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            severity='medium',
            error_message=str(errors) if errors else None,
            metadata={
                'operation_type': operation_type,
                'resource_type': resource_type,
                'affected_count': affected_count,
                'errors': errors,
                'timestamp': timezone.now().isoformat()
            }
        )


# Django Signals for Automatic Logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import Question, Answer, Form, AdminUser, UsersSchool, School

# Store original values for comparison
_original_values = {}

@receiver(pre_save, sender=Question)
def store_original_question(sender, instance, **kwargs):
    """Store original question data before save"""
    if instance.pk:
        try:
            original = Question.objects.get(pk=instance.pk)
            _original_values[f'question_{instance.pk}'] = {
                'question_text': original.question_text,
                'answer_type': original.answer_type,
                'is_required': original.is_required,
                'display_order': original.display_order
            }
        except Question.DoesNotExist:
            pass

@receiver(post_save, sender=Question)
def log_question_save(sender, instance, created, **kwargs):
    """Automatically log question changes"""
    if hasattr(instance, '_logging_user'):
        action = 'create' if created else 'update'
        old_data = _original_values.get(f'question_{instance.pk}')
        new_data = {
            'question_text': instance.question_text,
            'answer_type': instance.answer_type,
            'is_required': instance.is_required,
            'display_order': instance.display_order
        }
        
        EnhancedSystemLogger.log_question_change(
            user=instance._logging_user,
            question=instance,
            action=action,
            old_data=old_data,
            new_data=new_data,
            ip_address=getattr(instance, '_logging_ip', None),
            user_agent=getattr(instance, '_logging_user_agent', None)
        )
        
        # Clean up stored data
        if f'question_{instance.pk}' in _original_values:
            del _original_values[f'question_{instance.pk}']

@receiver(post_delete, sender=Question)
def log_question_delete(sender, instance, **kwargs):
    """Automatically log question deletion"""
    if hasattr(instance, '_logging_user'):
        EnhancedSystemLogger.log_question_change(
            user=instance._logging_user,
            question=instance,
            action='delete',
            ip_address=getattr(instance, '_logging_ip', None),
            user_agent=getattr(instance, '_logging_user_agent', None)
        )

# Similar patterns can be implemented for other models...

# Context manager for adding logging context to model operations
class LoggingContext:
    """Context manager to add logging information to model operations"""
    
    def __init__(self, user, ip_address=None, user_agent=None):
        self.user = user
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.models = []
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Clean up any stored logging context
        for model in self.models:
            if hasattr(model, '_logging_user'):
                delattr(model, '_logging_user')
            if hasattr(model, '_logging_ip'):
                delattr(model, '_logging_ip')
            if hasattr(model, '_logging_user_agent'):
                delattr(model, '_logging_user_agent')
    
    def add_context(self, model):
        """Add logging context to a model instance"""
        model._logging_user = self.user
        model._logging_ip = self.ip_address
        model._logging_user_agent = self.user_agent
        self.models.append(model)
        return model

# Usage example:
# with LoggingContext(request.user, ip_address, user_agent) as ctx:
#     question = ctx.add_context(Question.objects.get(pk=1))
#     question.question_text = "Updated question"
#     question.save()  # This will automatically log the change
