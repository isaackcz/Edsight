"""
Password utility functions for validation
"""

import re


def validate_password_strength(password):
    """
    Validate password strength
    
    Args:
        password: Password string
    
    Returns:
        tuple: (is_valid: bool, errors: list)
    """
    errors = []
    
    if len(password) < 8:
        errors.append('Password must be at least 8 characters long')
    
    if not re.search(r'[a-z]', password):
        errors.append('Password must contain at least one lowercase letter')
    
    if not re.search(r'[A-Z]', password):
        errors.append('Password must contain at least one uppercase letter')
    
    if not re.search(r'\d', password):
        errors.append('Password must contain at least one number')
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append('Password must contain at least one special character')
    
    return len(errors) == 0, errors

