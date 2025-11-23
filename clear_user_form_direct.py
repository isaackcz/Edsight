#!/usr/bin/env python
"""
Direct script to clear form data - can be run independently
Run: python clear_user_form_direct.py
"""
import os
import sys
import django

# Setup Django
if __name__ == '__main__':
    # Add project root to path
    project_root = os.path.dirname(os.path.abspath(__file__))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    
    try:
        django.setup()
        
        from apps.core.models import AdminUser, Form, Answer
        
        # User email to clear
        user_email = '100001@deped.gov.ph'
        
        print(f"\n{'='*60}")
        print(f"Clearing Form Data for User: {user_email}")
        print(f"{'='*60}\n")
        
        try:
            # Find the user
            admin_user = AdminUser.objects.get(email=user_email)
            print(f"✅ Found user: {admin_user.username} (ID: {admin_user.admin_id})")
            print(f"   School: {admin_user.school.school_name if admin_user.school else 'None'}")
            
            # Find all forms for this user
            forms = Form.objects.filter(admin_user=admin_user)
            form_count = forms.count()
            print(f"\n📋 Found {form_count} form(s) for this user")
            
            if form_count > 0:
                # Get all form IDs
                form_ids = list(forms.values_list('form_id', flat=True))
                
                # Delete all answers for these forms
                answers_deleted = Answer.objects.filter(form_id__in=form_ids).delete()
                print(f"🗑️  Deleted {answers_deleted[0]} answer(s)")
                
                # Delete all forms
                forms_deleted = forms.delete()
                print(f"🗑️  Deleted {forms_deleted[0]} form(s)")
                
                print(f"\n✅ Successfully cleared all form data!")
                print(f"   - Deleted {answers_deleted[0]} answers")
                print(f"   - Deleted {forms_deleted[0]} forms")
            else:
                print(f"ℹ️  No forms found for this user. Nothing to delete.")
                
            # Verify deletion
            print(f"\n📊 Verification:")
            remaining_forms = Form.objects.filter(admin_user=admin_user).count()
            remaining_answers = Answer.objects.filter(form__admin_user=admin_user).count()
            print(f"   - Remaining Forms: {remaining_forms}")
            print(f"   - Remaining Answers: {remaining_answers}")
            
            if remaining_forms == 0 and remaining_answers == 0:
                print(f"\n✨ User form data has been completely cleared!")
                print(f"   The user can now start fresh with a new form.\n")
            else:
                print(f"\n⚠️  Warning: Some data still exists. Check manually.\n")
                
        except AdminUser.DoesNotExist:
            print(f"❌ User with email '{user_email}' not found!")
            print(f"\nSearching for similar users...")
            similar_users = AdminUser.objects.filter(email__icontains='100001')
            if similar_users.exists():
                print(f"\nFound {similar_users.count()} user(s) with '100001' in email:")
                for user in similar_users[:10]:
                    print(f"   - {user.email} ({user.username})")
            else:
                print("   No similar users found.")
            print()
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            print()
            
    except Exception as e:
        print(f"❌ Django setup failed: {str(e)}")
        print("\nMake sure you're running this from the project root directory.")
        print("And that Django is properly configured.\n")

