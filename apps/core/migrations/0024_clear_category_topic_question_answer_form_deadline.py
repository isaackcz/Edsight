# Migration to clear data from categories, topics, questions, answers, forms, and form_deadlines tables
# This preserves table structure but removes all data

from django.db import migrations


def table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute("""
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = %s
    """, (table_name,))
    return cursor.fetchone()[0] > 0


def clear_tables(apps, schema_editor):
    """
    Clear data from tables in the correct order to respect foreign key constraints.
    Order: answers -> question_choices -> forms -> questions -> topics -> categories -> form_deadlines
    """
    with schema_editor.connection.cursor() as cursor:
        # Disable foreign key checks temporarily for faster deletion
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        try:
            tables_to_clear = [
                ('answers', 'answers'),
                ('question_choices', 'question_choices'),
                ('forms', 'forms'),
                ('questions', 'questions'),
                ('topics', 'topics'),
                ('categories', 'categories'),
                ('form_deadlines', 'form_deadlines'),
                ('form_remarks', 'form_remarks'),
                ('form_approvals', 'form_approvals'),
                ('form_notifications', 'form_notifications'),
            ]
            
            for table_name, display_name in tables_to_clear:
                if table_exists(cursor, table_name):
                    cursor.execute(f"TRUNCATE TABLE {table_name}")
                    print(f"Cleared {display_name} table")
                else:
                    print(f"Skipped {display_name} table (does not exist)")
            
        finally:
            # Re-enable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


def reverse_clear_tables(apps, schema_editor):
    """
    Reverse operation - cannot restore deleted data, but we can reset auto-increment counters
    """
    # This is a destructive operation, so we can't reverse it
    # But we can reset auto-increment counters if needed
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        try:
            # Reset auto-increment counters
            cursor.execute("ALTER TABLE answers AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE question_choices AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE forms AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE questions AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE topics AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE categories AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE form_deadlines AUTO_INCREMENT = 1")
        finally:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_alter_form_notification_options_and_more'),
    ]

    operations = [
        migrations.RunPython(clear_tables, reverse_clear_tables),
    ]

