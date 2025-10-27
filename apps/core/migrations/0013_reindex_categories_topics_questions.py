from django.db import migrations


def reindex_schema(apps, schema_editor):
    """Drop legacy tables and ensure FKs and indexes for categories → topics → questions."""
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        # 1) Drop legacy tables if they still exist
        try:
            cursor.execute("DROP TABLE IF EXISTS sub_questions")
        except Exception:
            pass
        try:
            cursor.execute("DROP TABLE IF EXISTS sub_sections")
        except Exception:
            pass

        # 2) Ensure topics has category_id column
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'topics'
              AND COLUMN_NAME = 'category_id'
            """
        )
        has_category_id = cursor.fetchone()[0] > 0
        if not has_category_id:
            try:
                cursor.execute("ALTER TABLE topics ADD COLUMN category_id INT NULL")
            except Exception:
                pass

        # 3) If legacy sub_section_id exists, migrate category_id from it
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'topics'
              AND COLUMN_NAME = 'sub_section_id'
            """
        )
        has_sub_section_id = cursor.fetchone()[0] > 0
        if has_sub_section_id:
            # Backfill category_id from sub_sections if possible
            try:
                cursor.execute(
                    """
                    UPDATE topics t
                    JOIN sub_sections s ON t.sub_section_id = s.sub_section_id
                    SET t.category_id = s.category_id
                    WHERE t.category_id IS NULL
                    """
                )
            except Exception:
                pass
            # Drop legacy column
            try:
                cursor.execute("ALTER TABLE topics DROP COLUMN sub_section_id")
            except Exception:
                pass

        # 4) Ensure FK topics.category_id → categories.category_id
        # Drop any existing FK on category_id to avoid duplicates
        try:
            cursor.execute(
                """
                SELECT CONSTRAINT_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'topics'
                  AND COLUMN_NAME = 'category_id'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
                """
            )
            for (constraint_name,) in cursor.fetchall() or []:
                try:
                    cursor.execute(f"ALTER TABLE topics DROP FOREIGN KEY `{constraint_name}`")
                except Exception:
                    pass
        except Exception:
            pass
        # Add FK
        try:
            cursor.execute(
                """
                ALTER TABLE topics
                ADD CONSTRAINT topics_category_id_fk
                FOREIGN KEY (category_id)
                REFERENCES categories(category_id)
                ON DELETE CASCADE
                """
            )
        except Exception:
            pass

        # 5) Ensure indexes
        # topics(category_id), topics(display_order)
        try:
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS topic_category_id_idx ON topics(category_id)"
            )
        except Exception:
            pass
        try:
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_topics_order ON topics(display_order)"
            )
        except Exception:
            pass

        # questions(topic_id), questions(display_order)
        try:
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS question_topic_id_idx ON questions(topic_id)"
            )
        except Exception:
            pass
        try:
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(display_order)"
            )
        except Exception:
            pass

        # categories(display_order)
        try:
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order)"
            )
        except Exception:
            pass


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0004_remove_answer_idx_answers_sub_question_and_more'),
    ]

    operations = [
        migrations.RunPython(reindex_schema, migrations.RunPython.noop),
    ]


