"""
EdSight User Dashboard Security Configuration
Implements rate limiting, security headers, and monitoring

Security Features:
- Rate limiting per user and per IP
- Security headers (CSP, HSTS, etc.)
- Request logging and monitoring
- SQL injection prevention
- XSS protection
"""
from django.core.cache import cache
from django.http import JsonResponse
from functools import wraps
import logging
from datetime import datetime, timedelta

logger = logging.getLogger('user_dashboard_security')

# Rate limiting configuration
RATE_LIMIT_SETTINGS = {
    'api_requests': {
        'limit': 100,  # requests
        'window': 60,  # seconds (1 minute)
    },
    'form_submissions': {
        'limit': 10,  # requests
        'window': 300,  # seconds (5 minutes)
    },
    'authentication': {
        'limit': 5,  # attempts
        'window': 300,  # seconds (5 minutes)
    }
}


def rate_limit(limit_type='api_requests'):
    """
    Rate limiting decorator for API endpoints
    
    Usage:
        @rate_limit('api_requests')
        @require_authentication
        def my_view(request):
            pass
    
    Security: Prevents abuse and DOS attacks
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            # Get rate limit settings
            settings = RATE_LIMIT_SETTINGS.get(limit_type, RATE_LIMIT_SETTINGS['api_requests'])
            limit = settings['limit']
            window = settings['window']
            
            # Identify user (prefer user ID over IP for authenticated requests)
            if hasattr(request, 'admin_user'):
                identifier = f"user_{request.admin_user.admin_id}"
            else:
                identifier = f"ip_{get_client_ip(request)}"
            
            # Cache key for rate limiting
            cache_key = f"rate_limit_{limit_type}_{identifier}"
            
            # Get current count
            current_count = cache.get(cache_key, 0)
            
            # Check if rate limit exceeded
            if current_count >= limit:
                logger.warning(f"Rate limit exceeded for {identifier} on {request.path} - {current_count} requests in {window}s")
                return JsonResponse({
                    'error': 'Rate limit exceeded',
                    'message': f'Too many requests. Please wait {window} seconds and try again.',
                    'retry_after': window
                }, status=429)
            
            # Increment counter
            cache.set(cache_key, current_count + 1, window)
            
            # Log if approaching limit (80% threshold)
            if current_count >= limit * 0.8:
                logger.info(f"Rate limit warning for {identifier}: {current_count}/{limit} requests")
            
            return view_func(request, *args, **kwargs)
        
        return wrapped_view
    return decorator


def get_client_ip(request):
    """
    Extract client IP address from request
    Handles proxies and load balancers
    
    Security: Properly identifies clients behind proxies
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # Get the first IP in the chain (original client)
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', 'unknown')
    return ip


def add_security_headers(get_response):
    """
    Middleware to add security headers to all responses
    
    Security Headers:
    - Content-Security-Policy: Prevents XSS attacks
    - X-Content-Type-Options: Prevents MIME sniffing
    - X-Frame-Options: Prevents clickjacking
    - Strict-Transport-Security: Enforces HTTPS
    - X-XSS-Protection: Browser XSS protection
    - Referrer-Policy: Controls referrer information
    
    Usage in settings.py:
        MIDDLEWARE = [
            ...
            'apps.user_dashboard.security_config.add_security_headers',
        ]
    """
    def middleware(request):
        response = get_response(request)
        
        # Content Security Policy - Adjust based on your needs
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self';"
        )
        
        # Prevent MIME sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking
        response['X-Frame-Options'] = 'SAMEORIGIN'
        
        # HSTS - Force HTTPS (only in production)
        # Uncomment for production with HTTPS
        # response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        # XSS Protection
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer Policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions Policy (formerly Feature-Policy)
        response['Permissions-Policy'] = (
            'geolocation=(), '
            'microphone=(), '
            'camera=(), '
            'payment=(), '
            'usb=(), '
            'magnetometer=(), '
            'gyroscope=(), '
            'accelerometer=()'
        )
        
        return response
    
    return middleware


def log_suspicious_activity(request, activity_type, details):
    """
    Log suspicious activities for security monitoring
    
    Args:
        request: Django request object
        activity_type: Type of suspicious activity (e.g., 'invalid_session', 'sql_injection_attempt')
        details: Additional details about the activity
    
    Security: Creates audit trail for security incidents
    """
    logger.warning(
        f"SECURITY ALERT - {activity_type}: "
        f"User: {getattr(request, 'admin_user', 'unknown')}, "
        f"IP: {get_client_ip(request)}, "
        f"Path: {request.path}, "
        f"Details: {details}"
    )


def validate_input_length(data, max_length=500):
    """
    Validate input length to prevent buffer overflow attacks
    
    Args:
        data: Input data to validate
        max_length: Maximum allowed length
    
    Returns:
        tuple: (is_valid, error_message)
    
    Security: Prevents buffer overflow and DOS via large inputs
    """
    if not data:
        return True, None
    
    data_str = str(data)
    if len(data_str) > max_length:
        return False, f'Input too long. Maximum {max_length} characters allowed.'
    
    return True, None


def sanitize_sql_input(value):
    """
    Additional validation for SQL inputs (Django ORM handles this, but extra layer)
    
    Args:
        value: Input value to sanitize
    
    Returns:
        bool: True if input is safe, False if suspicious
    
    Security: Detects potential SQL injection attempts
    """
    if not value:
        return True
    
    # Common SQL injection patterns
    dangerous_patterns = [
        'DROP TABLE',
        'DELETE FROM',
        'INSERT INTO',
        'UPDATE ',
        'UNION SELECT',
        'EXEC(',
        'EXECUTE(',
        '--',
        ';--',
        '/*',
        '*/',
        'xp_',
        'sp_',
        'WAITFOR DELAY',
        'BENCHMARK',
        'SLEEP(',
    ]
    
    value_upper = str(value).upper()
    for pattern in dangerous_patterns:
        if pattern in value_upper:
            logger.critical(f"Potential SQL injection attempt detected: {value}")
            return False
    
    return True


# Security monitoring statistics
def get_security_stats():
    """
    Get security statistics for monitoring dashboard
    
    Returns:
        dict: Security statistics
    
    Usage: Can be called from admin dashboard to monitor security
    """
    return {
        'rate_limit_violations': cache.get('security_stats_rate_limit_violations', 0),
        'authentication_failures': cache.get('security_stats_auth_failures', 0),
        'suspicious_activities': cache.get('security_stats_suspicious', 0),
        'last_updated': datetime.now().isoformat()
    }


def increment_security_stat(stat_name):
    """
    Increment a security statistic counter
    
    Args:
        stat_name: Name of the statistic to increment
    """
    cache_key = f'security_stats_{stat_name}'
    current = cache.get(cache_key, 0)
    cache.set(cache_key, current + 1, 86400)  # 24 hours

