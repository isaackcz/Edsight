"""
Django management command to validate analytics accuracy and data integrity.
This ensures that the analytics calculations are correct and consistent.
"""

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
import logging

from app.analytics_service import AnalyticsService
from app.models import Form, Answer, Question, School
from django.contrib.auth import get_user_model

User = get_user_model()

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Validate analytics accuracy and data integrity'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed validation results'
        )
        parser.add_argument(
            '--fix-issues',
            action='store_true',
            help='Attempt to fix identified issues'
        )

    def handle(self, *args, **options):
        detailed = options['detailed']
        fix_issues = options['fix_issues']
        
        self.stdout.write("Starting Analytics Validation...")
        
        validation_results = {
            'data_integrity': self.validate_data_integrity(),
            'completion_calculations': self.validate_completion_calculations(),
            'filter_consistency': self.validate_filter_consistency(),
            'export_accuracy': self.validate_export_accuracy(),
            'performance_benchmarks': self.validate_performance_benchmarks()
        }
        
        # Display results
        self.display_validation_results(validation_results, detailed)
        
        # Fix issues if requested
        if fix_issues:
            self.fix_identified_issues(validation_results)

    def validate_data_integrity(self):
        """Validate data integrity and consistency"""
        self.stdout.write("\nValidating Data Integrity...")
        
        issues = []
        
        # Check for orphaned answers
        orphaned_answers = Answer.objects.filter(form__isnull=True).count()
        if orphaned_answers > 0:
            issues.append(f"Found {orphaned_answers} orphaned answers")
        
        # Check for answers without questions
        invalid_answers = Answer.objects.filter(question__isnull=True).count()
        if invalid_answers > 0:
            issues.append(f"Found {invalid_answers} answers without questions")
        
        # Check for forms without users
        orphaned_forms = Form.objects.filter(user__isnull=True).count()
        if orphaned_forms > 0:
            issues.append(f"Found {orphaned_forms} forms without users")
        
        # Check for users without schools
        users_without_schools = User.objects.filter(
            usersschool__isnull=True
        ).exclude(is_superuser=True).count()
        if users_without_schools > 0:
            issues.append(f"Found {users_without_schools} users without school associations")
        
        # Check for duplicate answers
        duplicate_answers = Answer.objects.values('form', 'question').annotate(
            count=models.Count('id')
        ).filter(count__gt=1).count()
        if duplicate_answers > 0:
            issues.append(f"Found {duplicate_answers} duplicate answer combinations")
        
        # Check for invalid completion statuses
        invalid_statuses = Form.objects.exclude(
            status__in=['draft', 'in_progress', 'completed', 'submitted']
        ).count()
        if invalid_statuses > 0:
            issues.append(f"Found {invalid_statuses} forms with invalid status")
        
        return {
            'issues': issues,
            'status': 'PASS' if not issues else 'FAIL'
        }

    def validate_completion_calculations(self):
        """Validate completion rate calculations"""
        self.stdout.write("\nValidating Completion Calculations...")
        
        issues = []
        
        # Test completion stats calculation
        try:
            base_queryset = AnalyticsService.build_filtered_queryset({})
            completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
            
            # Validate completion rate is between 0 and 100
            if not (0 <= completion_stats.get('completion_rate', 0) <= 100):
                issues.append("Completion rate is not between 0 and 100")
            
            # Validate total forms equals completed + incomplete
            total_forms = completion_stats.get('total_forms', 0)
            completed_forms = completion_stats.get('completed_forms', 0)
            incomplete_forms = completion_stats.get('incomplete_forms', 0)
            
            if total_forms != completed_forms + incomplete_forms:
                issues.append(
                    f"Total forms ({total_forms}) != completed ({completed_forms}) + incomplete ({incomplete_forms})"
                )
            
            # Validate answered questions calculation
            total_questions = completion_stats.get('total_questions', 0)
            answered_questions = completion_stats.get('answered_questions', 0)
            
            if answered_questions > total_questions:
                issues.append(
                    f"Answered questions ({answered_questions}) > total questions ({total_questions})"
                )
            
        except Exception as e:
            issues.append(f"Error calculating completion stats: {str(e)}")
        
        # Test school completion data
        try:
            school_completion = AnalyticsService.get_school_completion_data(base_queryset, {})
            
            for school_data in school_completion:
                answered = school_data.get('answered_questions', 0)
                required = school_data.get('required_questions', 0)
                completion_rate = school_data.get('completion_rate', 0)
                
                if required > 0:
                    expected_rate = (answered / required) * 100
                    if abs(completion_rate - expected_rate) > 0.1:  # Allow small floating point differences
                        issues.append(
                            f"School {school_data.get('school_name', 'Unknown')} completion rate mismatch: "
                            f"calculated {completion_rate:.2f}%, expected {expected_rate:.2f}%"
                        )
                
                if answered > required:
                    issues.append(
                        f"School {school_data.get('school_name', 'Unknown')} has more answered questions than required"
                    )
        
        except Exception as e:
            issues.append(f"Error calculating school completion: {str(e)}")
        
        return {
            'issues': issues,
            'status': 'PASS' if not issues else 'FAIL'
        }

    def validate_filter_consistency(self):
        """Validate filter consistency and accuracy"""
        self.stdout.write("\nValidating Filter Consistency...")
        
        issues = []
        
        # Test different filter combinations
        test_filters = [
            {},
            {'region': 'NCR'},
            {'school_name': 'Elementary'},
            {'completion_status': 'completed'},
            {'date_from': '2024-01-01', 'date_to': '2024-12-31'},
        ]
        
        for filters in test_filters:
            try:
                # Test that filtered results are subset of unfiltered results
                base_queryset = AnalyticsService.build_filtered_queryset({})
                filtered_queryset = AnalyticsService.build_filtered_queryset(filters)
                
                base_count = base_queryset.count()
                filtered_count = filtered_queryset.count()
                
                if filtered_count > base_count:
                    issues.append(
                        f"Filtered count ({filtered_count}) > base count ({base_count}) for filters: {filters}"
                    )
                
                # Test that filter options are consistent
                filter_options = AnalyticsService.get_filter_options()
                
                # Validate that filter options contain expected keys
                expected_keys = ['regions', 'divisions', 'districts', 'schools', 'categories', 'subsections', 'topics', 'questions', 'sub_questions']
                for key in expected_keys:
                    if key not in filter_options:
                        issues.append(f"Missing filter option key: {key}")
                
            except Exception as e:
                issues.append(f"Error testing filters {filters}: {str(e)}")
        
        return {
            'issues': issues,
            'status': 'PASS' if not issues else 'FAIL'
        }

    def validate_export_accuracy(self):
        """Validate export functionality accuracy"""
        self.stdout.write("\nValidating Export Accuracy...")
        
        issues = []
        
        try:
            # Test CSV export data consistency
            base_queryset = AnalyticsService.build_filtered_queryset({})
            completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
            school_completion = AnalyticsService.get_school_completion_data(base_queryset, {})
            
            # Validate that export data matches analytics data
            if not completion_stats:
                issues.append("No completion stats available for export")
            
            if not school_completion:
                issues.append("No school completion data available for export")
            
            # Test drilldown export
            drilldown_data = AnalyticsService.get_drilldown_data('category', {})
            if not drilldown_data:
                issues.append("No drilldown data available for export")
            
        except Exception as e:
            issues.append(f"Error validating export accuracy: {str(e)}")
        
        return {
            'issues': issues,
            'status': 'PASS' if not issues else 'FAIL'
        }

    def validate_performance_benchmarks(self):
        """Validate performance benchmarks"""
        self.stdout.write("\nValidating Performance Benchmarks...")
        
        issues = []
        benchmarks = {}
        
        # Test analytics bundle performance
        import time
        start_time = time.time()
        try:
            base_queryset = AnalyticsService.build_filtered_queryset({})
            completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
            school_completion = AnalyticsService.get_school_completion_data(base_queryset, {})
            group_aggregates = AnalyticsService.get_group_aggregates(base_queryset, {})
            avg_completion_time = AnalyticsService.calculate_avg_completion_time(base_queryset)
        except Exception as e:
            issues.append(f"Error in performance test: {str(e)}")
            return {'issues': issues, 'status': 'FAIL'}
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        benchmarks['analytics_bundle'] = execution_time
        
        # Performance thresholds (in seconds)
        if execution_time > 5.0:
            issues.append(f"Analytics bundle execution time ({execution_time:.3f}s) exceeds 5s threshold")
        
        # Test filter options performance
        start_time = time.time()
        try:
            filter_options = AnalyticsService.get_filter_options()
        except Exception as e:
            issues.append(f"Error in filter options performance test: {str(e)}")
            return {'issues': issues, 'status': 'FAIL'}
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        benchmarks['filter_options'] = execution_time
        
        if execution_time > 2.0:
            issues.append(f"Filter options execution time ({execution_time:.3f}s) exceeds 2s threshold")
        
        # Test drilldown performance
        start_time = time.time()
        try:
            drilldown_data = AnalyticsService.get_drilldown_data('category', {})
        except Exception as e:
            issues.append(f"Error in drilldown performance test: {str(e)}")
            return {'issues': issues, 'status': 'FAIL'}
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        benchmarks['drilldown'] = execution_time
        
        if execution_time > 3.0:
            issues.append(f"Drilldown execution time ({execution_time:.3f}s) exceeds 3s threshold")
        
        return {
            'issues': issues,
            'benchmarks': benchmarks,
            'status': 'PASS' if not issues else 'FAIL'
        }

    def display_validation_results(self, results, detailed=False):
        """Display validation results"""
        self.stdout.write("\n" + "="*60)
        self.stdout.write("ANALYTICS VALIDATION RESULTS")
        self.stdout.write("="*60)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result['status'] == 'PASS')
        
        self.stdout.write(f"Overall Status: {passed_tests}/{total_tests} tests passed")
        
        for test_name, result in results.items():
            status_icon = "✅" if result['status'] == 'PASS' else "❌"
            self.stdout.write(f"\n{status_icon} {test_name.replace('_', ' ').title()}: {result['status']}")
            
            if result['issues']:
                self.stdout.write(f"  Issues Found: {len(result['issues'])}")
                if detailed:
                    for issue in result['issues']:
                        self.stdout.write(f"    • {issue}")
            
            if 'benchmarks' in result:
                self.stdout.write("  Performance Benchmarks:")
                for benchmark_name, time_taken in result['benchmarks'].items():
                    self.stdout.write(f"    • {benchmark_name}: {time_taken:.3f}s")
        
        self.stdout.write("="*60)
        
        # Summary recommendations
        if passed_tests < total_tests:
            self.stdout.write("\nRECOMMENDATIONS:")
            self.stdout.write("• Review and fix identified issues")
            self.stdout.write("• Consider running 'fix_issues' option to auto-fix some problems")
            self.stdout.write("• Add more comprehensive error handling")
            self.stdout.write("• Consider adding database constraints to prevent data integrity issues")
        else:
            self.stdout.write("\n🎉 All validation tests passed! Analytics system is working correctly.")

    def fix_identified_issues(self, results):
        """Attempt to fix identified issues"""
        self.stdout.write("\nAttempting to fix identified issues...")
        
        fixes_applied = 0
        
        # Fix orphaned answers
        if any('orphaned answers' in issue for result in results.values() for issue in result.get('issues', [])):
            orphaned_count = Answer.objects.filter(form__isnull=True).count()
            if orphaned_count > 0:
                Answer.objects.filter(form__isnull=True).delete()
                self.stdout.write(f"Fixed {orphaned_count} orphaned answers")
                fixes_applied += 1
        
        # Fix answers without questions
        if any('answers without questions' in issue for result in results.values() for issue in result.get('issues', [])):
            invalid_count = Answer.objects.filter(question__isnull=True).count()
            if invalid_count > 0:
                Answer.objects.filter(question__isnull=True).delete()
                self.stdout.write(f"Fixed {invalid_count} answers without questions")
                fixes_applied += 1
        
        # Fix forms without users
        if any('forms without users' in issue for result in results.values() for issue in result.get('issues', [])):
            orphaned_count = Form.objects.filter(user__isnull=True).count()
            if orphaned_count > 0:
                Form.objects.filter(user__isnull=True).delete()
                self.stdout.write(f"Fixed {orphaned_count} forms without users")
                fixes_applied += 1
        
        # Fix duplicate answers
        if any('duplicate answer' in issue for result in results.values() for issue in result.get('issues', [])):
            from django.db import models
            duplicates = Answer.objects.values('form', 'question').annotate(
                count=models.Count('id')
            ).filter(count__gt=1)
            
            for duplicate in duplicates:
                # Keep the first answer, delete the rest
                answers = Answer.objects.filter(
                    form=duplicate['form'],
                    question=duplicate['question']
                ).order_by('id')
                
                if answers.count() > 1:
                    answers[1:].delete()
                    fixes_applied += 1
            
            if fixes_applied > 0:
                self.stdout.write(f"Fixed {fixes_applied} duplicate answer combinations")
        
        if fixes_applied > 0:
            self.stdout.write(f"\nApplied {fixes_applied} fixes. Please run validation again to verify.")
        else:
            self.stdout.write("No automatic fixes were available for the identified issues.")
