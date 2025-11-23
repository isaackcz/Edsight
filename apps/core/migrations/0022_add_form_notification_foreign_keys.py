# Generated migration to add missing foreign key columns to form_notifications

from django.db import migrations


def add_foreign_key_columns(apps, schema_editor):
    """Add missing foreign key columns to form_notifications table"""
    with schema_editor.connection.cursor() as cursor:
        # Check if columns already exist
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND column_name = 'form_id'
        """)
        if cursor.fetchone()[0] == 0:
            # Add form_id column
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD COLUMN form_id INT(11) NULL
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND column_name = 'recipient_id'
        """)
        if cursor.fetchone()[0] == 0:
            # Add recipient_id column
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD COLUMN recipient_id INT(11) NULL
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND column_name = 'sender_id'
        """)
        if cursor.fetchone()[0] == 0:
            # Add sender_id column (nullable)
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD COLUMN sender_id INT(11) NULL
            """)
        
        # Add foreign key constraints
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.table_constraints 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND constraint_name = 'form_notifications_form_id_fk'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD CONSTRAINT form_notifications_form_id_fk 
                FOREIGN KEY (form_id) REFERENCES forms(form_id) 
                ON DELETE CASCADE
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.table_constraints 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND constraint_name = 'form_notifications_recipient_id_fk'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD CONSTRAINT form_notifications_recipient_id_fk 
                FOREIGN KEY (recipient_id) REFERENCES admin_user(admin_id) 
                ON DELETE CASCADE
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.table_constraints 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND constraint_name = 'form_notifications_sender_id_fk'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                ALTER TABLE form_notifications 
                ADD CONSTRAINT form_notifications_sender_id_fk 
                FOREIGN KEY (sender_id) REFERENCES admin_user(admin_id) 
                ON DELETE CASCADE
            """)
        
        # Add indexes
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND index_name = 'form_notifications_recipient_id_idx'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                CREATE INDEX form_notifications_recipient_id_idx 
                ON form_notifications(recipient_id, is_read)
            """)
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = 'form_notifications' 
            AND index_name = 'form_notifications_form_id_idx'
        """)
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                CREATE INDEX form_notifications_form_id_idx 
                ON form_notifications(form_id, notification_type)
            """)


def remove_foreign_key_columns(apps, schema_editor):
    """Remove foreign key columns if migration is reversed"""
    with schema_editor.connection.cursor() as cursor:
        # Drop foreign key constraints first
        cursor.execute("ALTER TABLE form_notifications DROP FOREIGN KEY IF EXISTS form_notifications_form_id_fk")
        cursor.execute("ALTER TABLE form_notifications DROP FOREIGN KEY IF EXISTS form_notifications_recipient_id_fk")
        cursor.execute("ALTER TABLE form_notifications DROP FOREIGN KEY IF EXISTS form_notifications_sender_id_fk")
        
        # Drop indexes
        cursor.execute("DROP INDEX IF EXISTS form_notifications_recipient_id_idx ON form_notifications")
        cursor.execute("DROP INDEX IF EXISTS form_notifications_form_id_idx ON form_notifications")
        
        # Drop columns
        cursor.execute("ALTER TABLE form_notifications DROP COLUMN IF EXISTS form_id")
        cursor.execute("ALTER TABLE form_notifications DROP COLUMN IF EXISTS recipient_id")
        cursor.execute("ALTER TABLE form_notifications DROP COLUMN IF EXISTS sender_id")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_add_form_workflow_indexes'),
    ]

    operations = [
        migrations.RunPython(add_foreign_key_columns, remove_foreign_key_columns),
    ]

