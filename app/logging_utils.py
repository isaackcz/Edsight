"""
Logging utilities for comprehensive audit trail and security monitoring
Integrates with the database models for persistent logging
"""

from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import LoginAttempt, AuditLog
import logging

# Standard Python logging
logger = logging.getLogger(__name__)

class SystemLogger:
    """Comprehensive logging utility for authentication and user activities"""
    
    @staticmethod
    def log_login_attempt(username, ip_address, user_agent, success=True, failure_reason=None, location=None):
        """Log login attempt (both successful and failed)"""
        try:
            LoginAttempt.objects.create(
                username=username,
                ip_address=ip_address,
                user_agent=user_agent,
                success=success,
                failure_reason=failure_reason,
                location=location,
                timestamp=timezone.now(),
                is_suspicious=SystemLogger._is_suspicious_login(ip_address, username, success)
            )
            logger.info(f"Login attempt logged: {username} from {ip_address} - {'Success' if success else 'Failed'}")
        except Exception as e:
            logger.error(f"Failed to log login attempt: {e}")
    
    @staticmethod
    def log_user_activity(user, action_type, resource_type, resource_id=None, description="", 
                         ip_address=None, user_agent=None, success=True, error_message=None, 
                         metadata=None, severity='low'):
        """Log user activity for audit trail"""
        try:
            AuditLog.objects.create(
                user=user,
                action_type=action_type,
                resource_type=resource_type,
                resource_id=str(resource_id) if resource_id else None,
                description=description,
                ip_address=ip_address,
                user_agent=user_agent,
                severity=severity,
                success=success,
                error_message=error_message,
                metadata=metadata or {},
                timestamp=timezone.now()
            )
            logger.info(f"User activity logged: {user.username if user else 'System'} - {action_type} on {resource_type}")
        except Exception as e:
            logger.error(f"Failed to log user activity: {e}")
    
    @staticmethod
    def log_authentication_event(user, event_type, ip_address=None, user_agent=None, details=None):
        """Log authentication-related events (login, logout, password changes, etc.)"""
        severity = 'medium' if event_type in ['password_change', 'account_lock'] else 'low'
        
        SystemLogger.log_user_activity(
            user=user,
            action_type=event_type,
            resource_type='authentication',
            description=details or f"User {event_type}",
            ip_address=ip_address,
            user_agent=user_agent,
            severity=severity
        )
    
    @staticmethod
    def log_data_access(user, data_type, resource_id=None, ip_address=None, user_agent=None, sensitive=False):
        """Log data access events"""
        severity = 'high' if sensitive else 'low'
        description = f"Accessed {data_type}" + (f" (ID: {resource_id})" if resource_id else "")
        
        SystemLogger.log_user_activity(
            user=user,
            action_type='data_access',
            resource_type=data_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            severity=severity
        )
    
    @staticmethod
    def log_form_submission(user, form_id, school_id=None, ip_address=None, user_agent=None, success=True):
        """Log form submission events"""
        description = f"Form submission {'completed' if success else 'failed'}"
        if school_id:
            description += f" for school ID: {school_id}"
        
        SystemLogger.log_user_activity(
            user=user,
            action_type='form_submit',
            resource_type='form',
            resource_id=form_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            severity='medium' if success else 'high'
        )
    
    @staticmethod
    def log_admin_action(admin_user, action, target_type, target_id=None, details="", ip_address=None):
        """Log admin actions for enhanced security monitoring"""
        User = get_user_model()
        
        # Create a user object for the admin if it doesn't exist in Django's User model
        try:
            user_obj = User.objects.get(username=admin_user.username)
        except User.DoesNotExist:
            user_obj = None
        
        SystemLogger.log_user_activity(
            user=user_obj,
            action_type=action,
            resource_type=target_type,
            resource_id=target_id,
            description=f"Admin action: {details}",
            ip_address=ip_address,
            severity='high',  # Admin actions are always high severity
            metadata={
                'admin_id': admin_user.admin_id,
                'admin_level': admin_user.admin_level,
                'admin_username': admin_user.username
            }
        )
    
    @staticmethod
    def log_security_event(event_type, description, ip_address=None, user=None, severity='medium', metadata=None):
        """Log security-related events"""
        SystemLogger.log_user_activity(
            user=user,
            action_type='security_event',
            resource_type='security',
            description=f"Security Event: {description}",
            ip_address=ip_address,
            severity=severity,
            metadata=metadata or {'event_type': event_type}
        )
    
    @staticmethod
    def _is_suspicious_login(ip_address, username, success):
        """Determine if a login attempt is suspicious"""
        # Check for multiple failed attempts from same IP in last hour
        from datetime import timedelta
        one_hour_ago = timezone.now() - timedelta(hours=1)
        
        recent_failures = LoginAttempt.objects.filter(
            ip_address=ip_address,
            success=False,
            timestamp__gte=one_hour_ago
        ).count()
        
        # Mark as suspicious if:
        # 1. More than 3 failed attempts from same IP in last hour
        # 2. Failed attempt with common admin usernames
        suspicious_usernames = ['admin', 'administrator', 'root', 'test', 'user']
        
        return (recent_failures >= 3) or (not success and username.lower() in suspicious_usernames)
    
    @staticmethod
    def get_client_ip(request):
        """Extract client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    @staticmethod
    def get_user_agent(request):
        """Extract user agent from request"""
        return request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length


# Decorator for automatic logging of view functions
def log_user_action(action_type, resource_type, description="", severity='low'):
    """Decorator to automatically log user actions in views"""
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            # Execute the view
            response = view_func(request, *args, **kwargs)
            
            # Log the action if user is authenticated
            if hasattr(request, 'user') and request.user.is_authenticated:
                SystemLogger.log_user_activity(
                    user=request.user,
                    action_type=action_type,
                    resource_type=resource_type,
                    description=description or f"{action_type} on {resource_type}",
                    ip_address=SystemLogger.get_client_ip(request),
                    user_agent=SystemLogger.get_user_agent(request),
                    severity=severity
                )
            
            return response
        return wrapper
    return decorator


# Context processor for logging statistics (optional)
def logging_stats(request):
    """Context processor to add logging statistics to templates"""
    if not request.user.is_authenticated:
        return {}
    
    from datetime import timedelta
    last_24h = timezone.now() - timedelta(days=1)
    
    return {
        'user_login_count_24h': LoginAttempt.objects.filter(
            username=request.user.username,
            success=True,
            timestamp__gte=last_24h
        ).count(),
        'failed_login_count_24h': LoginAttempt.objects.filter(
            username=request.user.username,
            success=False,
            timestamp__gte=last_24h
        ).count()
    }
