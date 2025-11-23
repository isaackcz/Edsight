"""
Audit Log utility functions for formatting log data
"""

from django.utils import timezone


def format_relative_time(timestamp):
    """
    Format timestamp to relative time (e.g., "2 hours ago")
    
    Args:
        timestamp: datetime object
    
    Returns:
        Formatted string
    """
    if not timestamp:
        return "Never"
    
    now = timezone.now()
    diff = now - timestamp
    
    if diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif diff.seconds >= 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    else:
        return "Just now"


def format_audit_log_entry(log_entry, log_type='activity'):
    """
    Format a single audit log entry
    
    Args:
        log_entry: AdminActivityLog or AuditLog instance
        log_type: 'activity' for AdminActivityLog, 'audit' for AuditLog
    
    Returns:
        dict with formatted log data
    """
    if log_type == 'activity':
        return {
            'log_id': log_entry.log_id,
            'type': 'activity',
            'action': log_entry.action,
            'resource_type': log_entry.resource_type or '',
            'resource_id': log_entry.resource_id or '',
            'details': str(log_entry.details) if log_entry.details else '',
            'ip_address': str(log_entry.ip_address) if log_entry.ip_address else '',
            'timestamp': log_entry.timestamp.isoformat(),
            'timestamp_display': log_entry.timestamp.strftime('%B %d, %Y at %I:%M %p'),
            'timestamp_relative': format_relative_time(log_entry.timestamp),
        }
    else:  # AuditLog
        return {
            'log_id': log_entry.id,
            'type': 'audit',
            'action': log_entry.action_type,
            'resource_type': log_entry.resource_type or '',
            'resource_id': log_entry.resource_id or '',
            'description': log_entry.description or '',
            'severity': log_entry.severity,
            'success': log_entry.success,
            'ip_address': str(log_entry.ip_address) if log_entry.ip_address else '',
            'timestamp': log_entry.timestamp.isoformat(),
            'timestamp_display': log_entry.timestamp.strftime('%B %d, %Y at %I:%M %p'),
            'timestamp_relative': format_relative_time(log_entry.timestamp),
        }

