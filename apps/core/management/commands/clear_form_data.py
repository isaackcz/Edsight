"""
Django management command to clear data from form-related tables.

This command safely clears data from:
- sub_questions
- questions  
- topics
- sub_sections
- categories

The command handles foreign key constraints by clearing tables in the correct order.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings
from apps.core.models import (
    Question, Topic, Category,
    Answer, QuestionChoice
)
import sys


class Command(BaseCommand):
    help = 'Clear data from form-related tables (questions, topics, categories)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Skip confirmation prompts and clear data immediately',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']
        
        # Count records before deletion
        counts = {
            'questions': Question.objects.count(),
            'topics': Topic.objects.count(),
            'categories': Category.objects.count(),
            'answers': Answer.objects.count(),
            'question_choices': QuestionChoice.objects.count(),
        }
        
        total_records = sum(counts.values())
        
        if total_records == 0:
            self.stdout.write(
                self.style.WARNING('No data found in the specified tables. Nothing to clear.')
            )
            return
        
        # Display what will be deleted
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.WARNING('FORM DATA CLEARING OPERATION'))
        self.stdout.write('='*60)
        self.stdout.write(f"Records to be deleted:")
        for table, count in counts.items():
            if count > 0:
                self.stdout.write(f"  {table}: {count:,} records")
        self.stdout.write(f"\nTotal records to be deleted: {total_records:,}")
        self.stdout.write('='*60)
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS('DRY RUN: No data was actually deleted.')
            )
            return
        
        # Safety check - require confirmation unless --force is used
        if not force:
            self.stdout.write(
                self.style.ERROR(
                    '\n⚠️  WARNING: This operation will permanently delete all form data!'
                )
            )
            self.stdout.write(
                'This includes all questions, topics, categories, and related answers.'
            )
            
            # Check if we're in production
            if not settings.DEBUG:
                self.stdout.write(
                    self.style.ERROR(
                        '⚠️  PRODUCTION ENVIRONMENT DETECTED!'
                    )
                )
                self.stdout.write(
                    'This operation is not recommended in production.'
                )
            
            confirm = input('\nType "DELETE" to confirm (case sensitive): ')
            if confirm != 'DELETE':
                self.stdout.write(
                    self.style.SUCCESS('Operation cancelled.')
                )
                return
        
        # Perform the deletion in a transaction
        try:
            with transaction.atomic():
                self.stdout.write('\nStarting deletion process...')
                
                # Clear in order to respect foreign key constraints
                # 1. Clear dependent tables first
                if counts['answers'] > 0:
                    self.stdout.write(f"Deleting {counts['answers']:,} answers...")
                    Answer.objects.all().delete()
                
                if counts['question_choices'] > 0:
                    self.stdout.write(f"Deleting {counts['question_choices']:,} question choices...")
                    QuestionChoice.objects.all().delete()
                
                # sub_questions removed in new schema
                
                # 2. Clear main tables
                if counts['questions'] > 0:
                    self.stdout.write(f"Deleting {counts['questions']:,} questions...")
                    Question.objects.all().delete()
                
                if counts['topics'] > 0:
                    self.stdout.write(f"Deleting {counts['topics']:,} topics...")
                    Topic.objects.all().delete()
                
                # sub_sections removed in new schema
                
                if counts['categories'] > 0:
                    self.stdout.write(f"Deleting {counts['categories']:,} categories...")
                    Category.objects.all().delete()
                
                # Verify deletion
                remaining_counts = {
                    'questions': Question.objects.count(),
                    'topics': Topic.objects.count(),
                    'categories': Category.objects.count(),
                    'answers': Answer.objects.count(),
                    'question_choices': QuestionChoice.objects.count(),
                }
                
                remaining_total = sum(remaining_counts.values())
                
                if remaining_total == 0:
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'\n✅ SUCCESS: All {total_records:,} records have been deleted.'
                        )
                    )
                    self.stdout.write('Form data has been successfully cleared.')
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'\n⚠️  WARNING: {remaining_total} records still remain.'
                        )
                    )
                    for table, count in remaining_counts.items():
                        if count > 0:
                            self.stdout.write(f"  {table}: {count} records remaining")
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'\n❌ ERROR: Failed to clear data: {str(e)}')
            )
            raise CommandError(f'Data clearing failed: {str(e)}')
        
        self.stdout.write('\n' + '='*60)
        self.stdout.write('Operation completed.')
        self.stdout.write('='*60)
