from django.db import migrations
from django.contrib.auth.models import User


def assign_forms_to_users(apps, schema_editor):
    """Assign existing forms to their correct users based on UsersSchool relationship."""
    Form = apps.get_model('app', 'Form')
    UsersSchool = apps.get_model('app', 'UsersSchool')
    
    # Get all forms that need user assignment
    forms = Form.objects.all()
    
    for form in forms:
        try:
            # Find the UsersSchool record that matches this form's school_id
            userschool = UsersSchool.objects.get(id=form.school_id)
            
            # Assign the form to the user associated with this UsersSchool
            if userschool.user_id:
                form.user_id = userschool.user_id
                form.save()
                print(f"Assigned Form {form.form_id} to User {userschool.user_id}")
            else:
                print(f"Warning: UsersSchool {userschool.id} has no associated user")
                
        except UsersSchool.DoesNotExist:
            print(f"Warning: No UsersSchool found for Form {form.form_id} with school_id {form.school_id}")
        except Exception as e:
            print(f"Error processing Form {form.form_id}: {e}")


def reverse_assign_forms_to_users(apps, schema_editor):
    """Reverse operation - not needed as we're just updating existing data."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0006_remove_2fa_simple'),
    ]

    operations = [
        migrations.RunPython(
            assign_forms_to_users,
            reverse_assign_forms_to_users,
        ),
    ]