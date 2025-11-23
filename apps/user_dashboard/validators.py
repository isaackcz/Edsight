"""
Answer Validation Module
Validates answers based on question answer_type
"""
from datetime import datetime
import re


def validate_answer(question, answer_value):
    """
    Validate answer based on question type
    
    Args:
        question: Question model instance
        answer_value: The answer value to validate
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    # Convert to string for validation
    answer_str = str(answer_value).strip() if answer_value is not None else ''
    
    # Check if required
    if question.is_required and not answer_str:
        return False, 'This question is required'
    
    # If empty and not required, it's valid
    if not answer_str:
        return True, None
    
    # Validate based on answer_type
    answer_type = question.answer_type
    
    if answer_type == 'text':
        return validate_text(answer_str)
    elif answer_type == 'number':
        return validate_number(answer_str)
    elif answer_type == 'date':
        return validate_date(answer_str)
    elif answer_type == 'percentage':
        return validate_percentage(answer_str)
    else:
        # Unknown type, accept it
        return True, None


def validate_text(value):
    """Validate text answer"""
    if len(value) > 500:
        return False, 'Text must be 500 characters or less'
    
    if len(value) < 1:
        return False, 'Text cannot be empty'
    
    return True, None


def validate_number(value):
    """Validate number answer"""
    try:
        num = float(value)
        
        # Check for reasonable bounds
        if num < -999999999 or num > 999999999:
            return False, 'Number is out of range'
        
        return True, None
    except (ValueError, TypeError):
        return False, 'Must be a valid number'


def validate_date(value):
    """Validate date answer"""
    # Common date formats
    date_formats = [
        '%Y-%m-%d',         # 2024-01-31
        '%m/%d/%Y',         # 01/31/2024
        '%d/%m/%Y',         # 31/01/2024
        '%Y/%m/%d',         # 2024/01/31
        '%d-%m-%Y',         # 31-01-2024
        '%m-%d-%Y',         # 01-31-2024
    ]
    
    for date_format in date_formats:
        try:
            parsed_date = datetime.strptime(value, date_format)
            
            # Check if date is reasonable (between 1900 and 2100)
            if parsed_date.year < 1900 or parsed_date.year > 2100:
                return False, 'Date must be between 1900 and 2100'
            
            return True, None
        except ValueError:
            continue
    
    return False, 'Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY'


def validate_percentage(value):
    """Validate percentage answer (0-100)"""
    try:
        num = float(value)
        
        if num < 0 or num > 100:
            return False, 'Percentage must be between 0 and 100'
        
        # Check decimal places (max 2)
        if '.' in str(value):
            decimal_places = len(str(value).split('.')[1])
            if decimal_places > 2:
                return False, 'Percentage can have maximum 2 decimal places'
        
        return True, None
    except (ValueError, TypeError):
        return False, 'Must be a valid percentage (0-100)'


def validate_bulk_answers(questions_dict, answers_list):
    """
    Validate multiple answers at once
    
    Args:
        questions_dict: Dict mapping question_id to Question instance
        answers_list: List of answer dictionaries with question_id and answer
    
    Returns:
        tuple: (all_valid: bool, errors: list)
    """
    errors = []
    
    for answer_data in answers_list:
        question_id = answer_data.get('question_id')
        answer_value = answer_data.get('answer', '')
        
        if question_id not in questions_dict:
            errors.append({
                'question_id': question_id,
                'error': 'Question not found'
            })
            continue
        
        question = questions_dict[question_id]
        is_valid, error_message = validate_answer(question, answer_value)
        
        if not is_valid:
            errors.append({
                'question_id': question_id,
                'error': error_message
            })
    
    return len(errors) == 0, errors

