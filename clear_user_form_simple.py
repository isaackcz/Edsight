#!/usr/bin/env python
"""Simple script to clear form data - Windows compatible"""
import os
import sys
import django

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.core.models import AdminUser, Form, Answer
from django.db import connection

user_email = '100001@deped.gov.ph'

print("\n" + "="*60)
print(f"Clearing Form Data for User: {user_email}")
print("="*60 + "\n")

try:
    admin_user = AdminUser.objects.get(email=user_email)
    print(f"[OK] Found user: {admin_user.username} (ID: {admin_user.admin_id})")
    if admin_user.school:
        print(f"     School: {admin_user.school.school_name}")
    
    forms = Form.objects.filter(admin_user=admin_user)
    form_count = forms.count()
    print(f"\n[INFO] Found {form_count} form(s) for this user")
    
    if form_count > 0:
        form_ids = list(forms.values_list('form_id', flat=True))
        print(f"[INFO] Form IDs: {form_ids}")
        
        # Delete answers first
        answers_deleted = Answer.objects.filter(form_id__in=form_ids).delete()
        print(f"[DELETED] {answers_deleted[0]} answer(s)")
        
        # Delete forms using raw SQL to avoid foreign key issues
        with connection.cursor() as cursor:
            for form_id in form_ids:
                # Delete form approvals if they exist
                try:
                    cursor.execute("DELETE FROM form_approvals WHERE form_id = %s", [form_id])
                    approvals_deleted = cursor.rowcount
                    if approvals_deleted > 0:
                        print(f"[DELETED] {approvals_deleted} approval(s) for form {form_id}")
                except Exception as e:
                    print(f"[WARN] Could not delete approvals: {e}")
                
                # Delete form notifications if they exist (handle column name issues)
                try:
                    cursor.execute("SHOW COLUMNS FROM form_notifications LIKE 'form_id'")
                    if cursor.fetchone():
                        cursor.execute("DELETE FROM form_notifications WHERE form_id = %s", [form_id])
                    else:
                        # Try alternative column name
                        cursor.execute("SHOW COLUMNS FROM form_notifications")
                        columns = [row[0] for row in cursor.fetchall()]
                        if 'forms_id' in columns:
                            cursor.execute("DELETE FROM form_notifications WHERE forms_id = %s", [form_id])
                except Exception as e:
                    print(f"[WARN] Could not delete notifications: {e}")
                
                # Finally delete the form
                cursor.execute("DELETE FROM forms WHERE form_id = %s", [form_id])
                if cursor.rowcount > 0:
                    print(f"[DELETED] Form {form_id}")
        
        print(f"\n[SUCCESS] Cleared all form data!")
    else:
        print("[INFO] No forms found. Nothing to delete.")
    
    # Verify deletion
    remaining_forms = Form.objects.filter(admin_user=admin_user).count()
    remaining_answers = Answer.objects.filter(form__admin_user=admin_user).count()
    
    print(f"\n[VERIFY] Remaining Forms: {remaining_forms}")
    print(f"         Remaining Answers: {remaining_answers}")
    
    if remaining_forms == 0 and remaining_answers == 0:
        print("\n[SUCCESS] User form data completely cleared!")
        print("          User can now start fresh with a new form.\n")
    else:
        print("\n[WARNING] Some data still exists. Check manually.\n")
        
except AdminUser.DoesNotExist:
    print(f"[ERROR] User with email '{user_email}' not found!")
    print("\nSearching for similar users...")
    similar_users = AdminUser.objects.filter(email__icontains='100001')
    if similar_users.exists():
        print(f"\nFound {similar_users.count()} user(s) with '100001' in email:")
        for user in similar_users[:10]:
            print(f"  - {user.email} ({user.username})")
    print()
except Exception as e:
    print(f"[ERROR] {str(e)}")
    import traceback
    traceback.print_exc()
    print()
