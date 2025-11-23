#!/usr/bin/env python
"""
Clear form and answers for a specific user
Usage: python manage.py shell < clear_user_form_data.py
OR: python manage.py shell
    >>> exec(open('clear_user_form_data.py').read())
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import AdminUser, Form, Answer

# User email to clear
user_email = '100001@deped.gov.ph'

try:
    # Find the user
    admin_user = AdminUser.objects.get(email=user_email)
    print(f"✅ Found user: {admin_user.username} (ID: {admin_user.admin_id})")
    print(f"   School: {admin_user.school.school_name if admin_user.school else 'None'}")
    
    # Find all forms for this user
    forms = Form.objects.filter(admin_user=admin_user)
    form_count = forms.count()
    print(f"\n📋 Found {form_count} form(s) for this user")
    
    # Get all form IDs
    form_ids = list(forms.values_list('form_id', flat=True))
    
    if form_ids:
        # Delete all answers for these forms
        answers_deleted = Answer.objects.filter(form_id__in=form_ids).delete()
        print(f"🗑️  Deleted {answers_deleted[0]} answer(s)")
        
        # Delete all forms
        forms_deleted = forms.delete()
        print(f"🗑️  Deleted {forms_deleted[0]} form(s)")
        
        print(f"\n✅ Successfully cleared all form data for {user_email}")
        print(f"   - Deleted {answers_deleted[0]} answers")
        print(f"   - Deleted {forms_deleted[0]} forms")
    else:
        print(f"ℹ️  No forms found for this user. Nothing to delete.")
        
    # Show current status
    print(f"\n📊 Current status:")
    remaining_forms = Form.objects.filter(admin_user=admin_user).count()
    remaining_answers = Answer.objects.filter(form__admin_user=admin_user).count()
    print(f"   - Forms: {remaining_forms}")
    print(f"   - Answers: {remaining_answers}")
    
    if remaining_forms == 0 and remaining_answers == 0:
        print(f"\n✨ User form data has been completely cleared!")
        print(f"   The user can now start fresh with a new form.")
    else:
        print(f"\n⚠️  Warning: Some data still exists. Check manually.")
        
except AdminUser.DoesNotExist:
    print(f"❌ User with email '{user_email}' not found!")
    print(f"\nAvailable users with similar emails:")
    similar_users = AdminUser.objects.filter(email__icontains='100001')
    if similar_users.exists():
        for user in similar_users[:5]:
            print(f"   - {user.email} ({user.username})")
    else:
        print("   No similar users found.")
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()

