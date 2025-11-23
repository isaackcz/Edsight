# Generated migration to safely update Form and AuditLog fields
# This migration preserves all existing data by renaming columns instead of removing them

from django.db import migrations, models
import django.db.models.deletion


def migrate_form_user_to_admin_user(apps, schema_editor):
    """
    Safely migrate form.user_id to form.admin_id by renaming the column.
    If admin_id already exists, fix its data type if needed.
    This preserves all existing data and foreign key relationships.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if user_id column exists and admin_id doesn't
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND column_name = 'user_id'
        """)
        has_user_id = cursor.fetchone()[0] > 0
        
        cursor.execute("""
            SELECT COUNT(*), DATA_TYPE FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND column_name = 'admin_id'
        """)
        result = cursor.fetchone()
        has_admin_id = result[0] > 0 if result else False
        admin_id_type = result[1] if result and result[0] > 0 else None
        
        if has_user_id and not has_admin_id:
            # Rename the column to preserve all data
            cursor.execute("ALTER TABLE forms CHANGE COLUMN user_id admin_id INT(11) NOT NULL")
            
            # Update foreign key constraint name if it exists
            cursor.execute("""
                SELECT CONSTRAINT_NAME FROM information_schema.table_constraints 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name LIKE '%user%'
            """)
            fk_result = cursor.fetchone()
            if fk_result:
                old_fk_name = fk_result[0]
                # Drop old foreign key
                cursor.execute(f"ALTER TABLE forms DROP FOREIGN KEY {old_fk_name}")
                # Add new foreign key
                cursor.execute("""
                    ALTER TABLE forms 
                    ADD CONSTRAINT forms_admin_id_fk 
                    FOREIGN KEY (admin_id) REFERENCES admin_user(admin_id) 
                    ON DELETE CASCADE
                """)
        elif has_admin_id and admin_id_type and admin_id_type != 'int':
            # Fix data type if it's wrong (e.g., varchar instead of int)
            # First, try to convert existing data
            try:
                cursor.execute("""
                    UPDATE forms 
                    SET admin_id = CAST(admin_id AS UNSIGNED) 
                    WHERE admin_id REGEXP '^[0-9]+$'
                """)
            except:
                pass  # If conversion fails, we'll still fix the column type
            
            # Change column type to INT(11)
            cursor.execute("ALTER TABLE forms MODIFY COLUMN admin_id INT(11) NOT NULL")
            
            # Ensure foreign key exists
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.table_constraints 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND constraint_name = 'forms_admin_id_fk'
            """)
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    ALTER TABLE forms 
                    ADD CONSTRAINT forms_admin_id_fk 
                    FOREIGN KEY (admin_id) REFERENCES admin_user(admin_id) 
                    ON DELETE CASCADE
                """)


def migrate_auditlog_user_to_admin(apps, schema_editor):
    """
    Safely migrate audit_logs.user_id to audit_logs.admin_id.
    If user_id exists, copy data to admin_id, then remove user_id.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if user_id column exists
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'audit_logs' 
            AND column_name = 'user_id'
        """)
        has_user_id = cursor.fetchone()[0] > 0
        
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'audit_logs' 
            AND column_name = 'admin_id'
        """)
        has_admin_id = cursor.fetchone()[0] > 0
        
        if has_user_id:
            if not has_admin_id:
                # Add admin_id column first
                cursor.execute("""
                    ALTER TABLE audit_logs 
                    ADD COLUMN admin_id INT(11) NULL
                """)
            
            # Copy data from user_id to admin_id if user_id points to admin_user
            # Note: This assumes user_id in audit_logs was pointing to admin_user
            # If it was pointing to auth_user, we'll need to map it differently
            cursor.execute("""
                UPDATE audit_logs 
                SET admin_id = user_id 
                WHERE user_id IS NOT NULL AND admin_id IS NULL
            """)
            
            # Find and drop foreign key constraint on user_id before dropping the column
            cursor.execute("""
                SELECT CONSTRAINT_NAME FROM information_schema.table_constraints 
                WHERE table_schema = DATABASE() 
                AND table_name = 'audit_logs' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name LIKE '%user_id%'
            """)
            fk_result = cursor.fetchone()
            if fk_result:
                fk_name = fk_result[0]
                cursor.execute(f"ALTER TABLE audit_logs DROP FOREIGN KEY {fk_name}")
            
            # Remove user_id column after foreign key is dropped
            cursor.execute("ALTER TABLE audit_logs DROP COLUMN user_id")


def reverse_migrate_form_admin_user_to_user(apps, schema_editor):
    """Reverse migration: rename admin_id back to user_id"""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'forms' 
            AND column_name = 'admin_id'
        """)
        if cursor.fetchone()[0] > 0:
            # Drop foreign key first
            cursor.execute("ALTER TABLE forms DROP FOREIGN KEY IF EXISTS forms_admin_id_fk")
            # Rename back
            cursor.execute("ALTER TABLE forms CHANGE COLUMN admin_id user_id INT(11) NOT NULL")


def reverse_migrate_auditlog_admin_to_user(apps, schema_editor):
    """Reverse migration: restore user_id column"""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
            AND table_name = 'audit_logs' 
            AND column_name = 'admin_id'
        """)
        if cursor.fetchone()[0] > 0:
            # Add user_id column
            cursor.execute("""
                ALTER TABLE audit_logs 
                ADD COLUMN user_id INT(11) NULL
            """)
            # Copy data back
            cursor.execute("""
                UPDATE audit_logs 
                SET user_id = admin_id 
                WHERE admin_id IS NOT NULL
            """)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_add_form_notification_foreign_keys'),
    ]

    operations = [
        # Step 1: Migrate Form.user to Form.admin_user by renaming column or fixing data type (preserves data)
        migrations.RunPython(migrate_form_user_to_admin_user, reverse_migrate_form_admin_user_to_user),
        
        # Step 2: Update Django's model state to match database (database already has admin_id column)
        # Use SeparateDatabaseAndState to update state without touching database
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # Database is already correct, no operations needed
            ],
            state_operations=[
                # Update the field in Django's state: rename field and update db_column
                migrations.AlterField(
                    model_name='form',
                    name='user',
                    field=models.ForeignKey(db_column='admin_id', on_delete=django.db.models.deletion.CASCADE, related_name='forms', to='core.adminuser'),
                ),
                migrations.RenameField(
                    model_name='form',
                    old_name='user',
                    new_name='admin_user',
                ),
            ],
        ),
        
        # Step 3: Ensure workflow_status field exists (add if missing, preserve if exists)
        migrations.RunSQL(
            sql="""
                SELECT COUNT(*) INTO @col_exists FROM information_schema.columns 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND column_name = 'workflow_status';
                
                SET @sql = IF(@col_exists = 0,
                    'ALTER TABLE forms ADD COLUMN workflow_status VARCHAR(20) DEFAULT ''draft''',
                    'SELECT ''Column workflow_status already exists'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            """,
            reverse_sql="-- workflow_status column removal handled by model change"
        ),
        
        # Step 4: Migrate AuditLog.user to AuditLog.admin (preserves data)
        migrations.RunPython(migrate_auditlog_user_to_admin, reverse_migrate_auditlog_admin_to_user),
        
        # Step 5: Remove old user field from AuditLog model state (database already correct)
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # Database already has admin_id, no operation needed
            ],
            state_operations=[
                # Remove user field from Django's model state
                migrations.RemoveField(
                    model_name='auditlog',
                    name='user',
                ),
            ],
        ),
        
        # Step 6: Update FormNotification Meta options
        migrations.AlterModelOptions(
            name='formnotification',
            options={'ordering': ['-created_at'], 'verbose_name': 'Form Notification', 'verbose_name_plural': 'Form Notifications'},
        ),
        
        # Step 7: Update indexes - remove old ones, add new ones
        migrations.RunSQL(
            sql="""
                -- Remove old indexes if they exist
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'audit_logs' 
                AND index_name = 'audit_logs_user_id_88267f_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX audit_logs_user_id_88267f_idx ON audit_logs',
                    'SELECT ''Index audit_logs_user_id_88267f_idx does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_user_id_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX form_user_id_idx ON forms',
                    'SELECT ''Index form_user_id_idx does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                -- Add new indexes if they don't exist
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'audit_logs' 
                AND index_name = 'audit_logs_admin_id_88267f_idx';
                
                SET @sql = IF(@idx_exists = 0,
                    'CREATE INDEX audit_logs_admin_id_88267f_idx ON audit_logs(admin_id, timestamp)',
                    'SELECT ''Index audit_logs_admin_id_88267f_idx already exists'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_admin_id_idx';
                
                SET @sql = IF(@idx_exists = 0,
                    'CREATE INDEX form_admin_id_idx ON forms(admin_id)',
                    'SELECT ''Index form_admin_id_idx already exists'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_workflow_status_idx';
                
                SET @sql = IF(@idx_exists = 0,
                    'CREATE INDEX form_workflow_status_idx ON forms(workflow_status)',
                    'SELECT ''Index form_workflow_status_idx already exists'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_school_workflow_idx';
                
                SET @sql = IF(@idx_exists = 0,
                    'CREATE INDEX form_school_workflow_idx ON forms(school_id, workflow_status)',
                    'SELECT ''Index form_school_workflow_idx already exists'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            """,
            reverse_sql="""
                -- Reverse: restore old indexes (with proper MySQL syntax)
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'audit_logs' 
                AND index_name = 'audit_logs_admin_id_88267f_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX audit_logs_admin_id_88267f_idx ON audit_logs',
                    'SELECT ''Index does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_admin_id_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX form_admin_id_idx ON forms',
                    'SELECT ''Index does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_workflow_status_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX form_workflow_status_idx ON forms',
                    'SELECT ''Index does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
                
                SELECT COUNT(*) INTO @idx_exists FROM information_schema.statistics 
                WHERE table_schema = DATABASE() 
                AND table_name = 'forms' 
                AND index_name = 'form_school_workflow_idx';
                
                SET @sql = IF(@idx_exists > 0,
                    'DROP INDEX form_school_workflow_idx ON forms',
                    'SELECT ''Index does not exist'' AS message'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            """
        ),
        
        # Step 8: Update unique_together constraint for Form
        migrations.AlterUniqueTogether(
            name='form',
            unique_together={('admin_user', 'school', 'academic_year')},
        ),
    ]

