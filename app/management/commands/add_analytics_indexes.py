from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Add database indexes for analytics performance optimization'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Add indexes for analytics queries
            indexes = [
                # Form-related indexes
                "CREATE INDEX IF NOT EXISTS idx_forms_school_status ON forms(school_id, status)",
                "CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at)",
                "CREATE INDEX IF NOT EXISTS idx_forms_updated_at ON forms(updated_at)",
                "CREATE INDEX IF NOT EXISTS idx_forms_status_updated ON forms(status, updated_at)",
                
                # Answer-related indexes
                "CREATE INDEX IF NOT EXISTS idx_answers_form_question ON answers(form_id, question_id)",
                "CREATE INDEX IF NOT EXISTS idx_answers_question_response ON answers(question_id, response)",
                "CREATE INDEX IF NOT EXISTS idx_answers_answered_at ON answers(answered_at)",
                "CREATE INDEX IF NOT EXISTS idx_answers_sub_question ON answers(sub_question_id)",
                
                # School-related indexes for filtering
                "CREATE INDEX IF NOT EXISTS idx_users_school_region ON users_school(region_id)",
                "CREATE INDEX IF NOT EXISTS idx_users_school_division ON users_school(division_id)",
                "CREATE INDEX IF NOT EXISTS idx_users_school_district ON users_school(district_id)",
                "CREATE INDEX IF NOT EXISTS idx_users_school_name ON users_school(school_name)",
                
                # Question hierarchy indexes
                "CREATE INDEX IF NOT EXISTS idx_questions_topic_display ON questions(topic_id, display_order)",
                "CREATE INDEX IF NOT EXISTS idx_questions_answer_type ON questions(answer_type)",
                "CREATE INDEX IF NOT EXISTS idx_sub_questions_question_display ON sub_questions(question_id, display_order)",
                
                # Topic hierarchy indexes
                "CREATE INDEX IF NOT EXISTS idx_topics_subsection_display ON topics(sub_section_id, display_order)",
                "CREATE INDEX IF NOT EXISTS idx_sub_sections_category_display ON sub_sections(category_id, display_order)",
                
                # Composite indexes for complex queries
                "CREATE INDEX IF NOT EXISTS idx_forms_school_status_updated ON forms(school_id, status, updated_at)",
                "CREATE INDEX IF NOT EXISTS idx_answers_form_question_sub ON answers(form_id, question_id, sub_question_id)",
                
                # Text search indexes (if using full-text search)
                "CREATE INDEX IF NOT EXISTS idx_users_school_name_text ON users_school(school_name)",
                "CREATE INDEX IF NOT EXISTS idx_questions_text ON questions(question_text)",
            ]
            
            for index_sql in indexes:
                try:
                    cursor.execute(index_sql)
                    self.stdout.write(f"Created index: {index_sql.split('IF NOT EXISTS ')[1].split(' ON ')[0]}")
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f"Failed to create index: {e}")
                    )
            
            # Analyze tables for query optimization
            tables_to_analyze = [
                'forms', 'answers', 'users_school', 'questions', 
                'sub_questions', 'topics', 'sub_sections', 'categories',
                'regions', 'divisions', 'districts'
            ]
            
            for table in tables_to_analyze:
                try:
                    cursor.execute(f"ANALYZE TABLE {table}")
                    self.stdout.write(f"Analyzed table: {table}")
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f"Failed to analyze table {table}: {e}")
                    )
        
        self.stdout.write(
            self.style.SUCCESS('Successfully added analytics indexes and analyzed tables')
        )
