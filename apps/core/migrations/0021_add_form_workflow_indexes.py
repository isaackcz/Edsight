# Generated manually for performance optimization
# Uses raw SQL to add indexes directly to avoid migration state issues

from django.db import migrations


def add_indexes(apps, schema_editor):
    """Add indexes using raw SQL"""
    with schema_editor.connection.cursor() as cursor:
        # First, check if workflow_status column exists, if not add it
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND column_name = 'workflow_status'
        """)
        if cursor.fetchone()[0] == 0:
            # Add the workflow_status column
            cursor.execute("""
                ALTER TABLE forms 
                ADD COLUMN workflow_status VARCHAR(20) DEFAULT 'draft' 
                AFTER status
            """)
            # Update existing rows
            cursor.execute("""
                UPDATE forms SET workflow_status = CASE 
                    WHEN status = 'draft' THEN 'draft'
                    WHEN status = 'in-progress' THEN 'draft'
                    WHEN status = 'completed' THEN 'completed'
                    ELSE 'draft'
                END
            """)
        
        # Check if indexes already exist before creating
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND index_name = 'form_workflow_status_idx'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                CREATE INDEX form_workflow_status_idx ON forms(workflow_status)
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND index_name = 'form_school_workflow_idx'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                CREATE INDEX form_school_workflow_idx ON forms(school_id, workflow_status)
            """)


def remove_indexes(apps, schema_editor):
    """Remove indexes if migration is reversed"""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS form_workflow_status_idx ON forms")
        cursor.execute("DROP INDEX IF EXISTS form_school_workflow_idx ON forms")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_add_form_remark_model'),
    ]

    operations = [
        migrations.RunPython(add_indexes, remove_indexes),
    ]

