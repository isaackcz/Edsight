"""
Django management command to test analytics performance with large datasets.
This simulates real-world usage patterns and measures response times.
"""

from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
import time
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from threading import Lock

from app.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Test analytics performance with various data sizes and concurrent users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--concurrent-users',
            type=int,
            default=10,
            help='Number of concurrent users to simulate (default: 10)'
        )
        parser.add_argument(
            '--requests-per-user',
            type=int,
            default=5,
            help='Number of requests per concurrent user (default: 5)'
        )
        parser.add_argument(
            '--base-url',
            type=str,
            default='http://localhost:8000',
            help='Base URL for the application (default: http://localhost:8000)'
        )
        parser.add_argument(
            '--test-scenarios',
            nargs='+',
            default=['bundle', 'drilldown', 'filters', 'export'],
            help='Test scenarios to run (default: bundle, drilldown, filters, export)'
        )

    def handle(self, *args, **options):
        concurrent_users = options['concurrent_users']
        requests_per_user = options['requests_per_user']
        base_url = options['base_url']
        test_scenarios = options['test_scenarios']
        
        self.stdout.write("Starting Analytics Performance Testing...")
        self.stdout.write(f"Concurrent Users: {concurrent_users}")
        self.stdout.write(f"Requests per User: {requests_per_user}")
        self.stdout.write(f"Total Requests: {concurrent_users * requests_per_user}")
        self.stdout.write(f"Test Scenarios: {', '.join(test_scenarios)}")
        
        # Check if we have test data
        self.check_test_data()
        
        # Run performance tests
        results = {}
        
        if 'bundle' in test_scenarios:
            results['bundle'] = self.test_analytics_bundle_performance()
        
        if 'drilldown' in test_scenarios:
            results['drilldown'] = self.test_drilldown_performance()
        
        if 'filters' in test_scenarios:
            results['filters'] = self.test_filters_performance()
        
        if 'export' in test_scenarios:
            results['export'] = self.test_export_performance()
        
        # Run concurrent load testing
        if concurrent_users > 1:
            results['concurrent'] = self.test_concurrent_load(
                base_url, concurrent_users, requests_per_user, test_scenarios
            )
        
        # Display results
        self.display_performance_results(results)

    def check_test_data(self):
        """Check if we have sufficient test data"""
        from app.models import User, Form, Answer, Question
        
        user_count = User.objects.filter(is_test_user=True).count()
        form_count = Form.objects.filter(is_test_data=True).count()
        answer_count = Answer.objects.filter(form__is_test_data=True).count()
        question_count = Question.objects.count()
        
        self.stdout.write(f"\nTest Data Status:")
        self.stdout.write(f"Users: {user_count:,}")
        self.stdout.write(f"Forms: {form_count:,}")
        self.stdout.write(f"Answers: {answer_count:,}")
        self.stdout.write(f"Questions: {question_count:,}")
        
        if user_count < 100:
            self.stdout.write(
                self.style.WARNING(
                    "Warning: Low user count. Consider running 'generate_test_data' first."
                )
            )
        
        if answer_count < 1000:
            self.stdout.write(
                self.style.WARNING(
                    "Warning: Low answer count. Consider running 'generate_test_data' first."
                )
            )

    def test_analytics_bundle_performance(self):
        """Test analytics bundle endpoint performance"""
        self.stdout.write("\nTesting Analytics Bundle Performance...")
        
        # Test different filter combinations
        test_cases = [
            {'name': 'No Filters', 'filters': {}},
            {'name': 'School Filter', 'filters': {'school_name': 'Elementary'}},
            {'name': 'Region Filter', 'filters': {'region': 'NCR'}},
            {'name': 'Date Range', 'filters': {'date_from': '2024-01-01', 'date_to': '2024-12-31'}},
            {'name': 'Complex Filters', 'filters': {
                'region': 'NCR',
                'completion_status': 'completed',
                'date_from': '2024-01-01'
            }},
        ]
        
        results = []
        
        for test_case in test_cases:
            times = []
            
            # Run each test case 5 times
            for i in range(5):
                start_time = time.time()
                
                try:
                    # Build filtered queryset
                    base_queryset = AnalyticsService.build_filtered_queryset(test_case['filters'])
                    
                    # Calculate completion stats
                    completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
                    
                    # Get school completion data
                    school_completion = AnalyticsService.get_school_completion_data(
                        base_queryset, test_case['filters']
                    )
                    
                    # Get group aggregates
                    group_aggregates = AnalyticsService.get_group_aggregates(
                        base_queryset, test_case['filters']
                    )
                    
                    # Calculate average completion time
                    avg_completion_time = AnalyticsService.calculate_avg_completion_time(base_queryset)
                    
                    end_time = time.time()
                    execution_time = end_time - start_time
                    times.append(execution_time)
                    
                except Exception as e:
                    self.stdout.write(f"Error in {test_case['name']}: {str(e)}")
                    times.append(float('inf'))
            
            avg_time = sum(times) / len(times) if times else 0
            min_time = min(times) if times else 0
            max_time = max(times) if times else 0
            
            results.append({
                'test_case': test_case['name'],
                'avg_time': avg_time,
                'min_time': min_time,
                'max_time': max_time,
                'times': times
            })
            
            self.stdout.write(
                f"{test_case['name']}: "
                f"Avg: {avg_time:.3f}s, Min: {min_time:.3f}s, Max: {max_time:.3f}s"
            )
        
        return results

    def test_drilldown_performance(self):
        """Test drilldown analytics performance"""
        self.stdout.write("\nTesting Drilldown Performance...")
        
        test_cases = [
            {'name': 'Category Level', 'level': 'category'},
            {'name': 'Subsection Level', 'level': 'subsection'},
            {'name': 'Topic Level', 'level': 'topic'},
            {'name': 'Question Level', 'level': 'question'},
        ]
        
        results = []
        
        for test_case in test_cases:
            times = []
            
            for i in range(5):
                start_time = time.time()
                
                try:
                    drilldown_data = AnalyticsService.get_drilldown_data(
                        test_case['level'], {}
                    )
                    
                    end_time = time.time()
                    execution_time = end_time - start_time
                    times.append(execution_time)
                    
                except Exception as e:
                    self.stdout.write(f"Error in {test_case['name']}: {str(e)}")
                    times.append(float('inf'))
            
            avg_time = sum(times) / len(times) if times else 0
            min_time = min(times) if times else 0
            max_time = max(times) if times else 0
            
            results.append({
                'test_case': test_case['name'],
                'avg_time': avg_time,
                'min_time': min_time,
                'max_time': max_time,
                'times': times
            })
            
            self.stdout.write(
                f"{test_case['name']}: "
                f"Avg: {avg_time:.3f}s, Min: {min_time:.3f}s, Max: {max_time:.3f}s"
            )
        
        return results

    def test_filters_performance(self):
        """Test filter options performance"""
        self.stdout.write("\nTesting Filters Performance...")
        
        times = []
        
        for i in range(10):
            start_time = time.time()
            
            try:
                filter_options = AnalyticsService.get_filter_options()
                
                end_time = time.time()
                execution_time = end_time - start_time
                times.append(execution_time)
                
            except Exception as e:
                self.stdout.write(f"Error in filters test: {str(e)}")
                times.append(float('inf'))
        
        avg_time = sum(times) / len(times) if times else 0
        min_time = min(times) if times else 0
        max_time = max(times) if times else 0
        
        self.stdout.write(
            f"Filter Options: Avg: {avg_time:.3f}s, Min: {min_time:.3f}s, Max: {max_time:.3f}s"
        )
        
        return {
            'avg_time': avg_time,
            'min_time': min_time,
            'max_time': max_time,
            'times': times
        }

    def test_export_performance(self):
        """Test export functionality performance"""
        self.stdout.write("\nTesting Export Performance...")
        
        test_cases = [
            {'name': 'CSV Export', 'type': 'csv'},
            {'name': 'XLSX Export', 'type': 'xlsx'},
        ]
        
        results = []
        
        for test_case in test_cases:
            times = []
            
            for i in range(3):  # Fewer iterations for export tests
                start_time = time.time()
                
                try:
                    if test_case['type'] == 'csv':
                        # Simulate CSV export
                        base_queryset = AnalyticsService.build_filtered_queryset({})
                        completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
                        school_completion = AnalyticsService.get_school_completion_data(base_queryset, {})
                        
                    elif test_case['type'] == 'xlsx':
                        # Simulate XLSX export
                        base_queryset = AnalyticsService.build_filtered_queryset({})
                        completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
                        school_completion = AnalyticsService.get_school_completion_data(base_queryset, {})
                        group_aggregates = AnalyticsService.get_group_aggregates(base_queryset, {})
                    
                    end_time = time.time()
                    execution_time = end_time - start_time
                    times.append(execution_time)
                    
                except Exception as e:
                    self.stdout.write(f"Error in {test_case['name']}: {str(e)}")
                    times.append(float('inf'))
            
            avg_time = sum(times) / len(times) if times else 0
            min_time = min(times) if times else 0
            max_time = max(times) if times else 0
            
            results.append({
                'test_case': test_case['name'],
                'avg_time': avg_time,
                'min_time': min_time,
                'max_time': max_time,
                'times': times
            })
            
            self.stdout.write(
                f"{test_case['name']}: "
                f"Avg: {avg_time:.3f}s, Min: {min_time:.3f}s, Max: {max_time:.3f}s"
            )
        
        return results

    def test_concurrent_load(self, base_url, concurrent_users, requests_per_user, test_scenarios):
        """Test concurrent load with multiple users"""
        self.stdout.write(f"\nTesting Concurrent Load ({concurrent_users} users)...")
        
        results = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'response_times': [],
            'errors': []
        }
        
        def simulate_user(user_id):
            """Simulate a single user making requests"""
            user_results = {
                'successful': 0,
                'failed': 0,
                'response_times': [],
                'errors': []
            }
            
            for request_id in range(requests_per_user):
                try:
                    # Simulate different types of requests
                    if 'bundle' in test_scenarios:
                        start_time = time.time()
                        # Simulate analytics bundle request
                        base_queryset = AnalyticsService.build_filtered_queryset({})
                        completion_stats = AnalyticsService.calculate_completion_stats(base_queryset)
                        end_time = time.time()
                        
                        user_results['response_times'].append(end_time - start_time)
                        user_results['successful'] += 1
                    
                except Exception as e:
                    user_results['failed'] += 1
                    user_results['errors'].append(str(e))
            
            return user_results
        
        # Run concurrent users
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = [
                executor.submit(simulate_user, user_id) 
                for user_id in range(concurrent_users)
            ]
            
            for future in as_completed(futures):
                user_results = future.result()
                
                results['total_requests'] += user_results['successful'] + user_results['failed']
                results['successful_requests'] += user_results['successful']
                results['failed_requests'] += user_results['failed']
                results['response_times'].extend(user_results['response_times'])
                results['errors'].extend(user_results['errors'])
        
        # Calculate statistics
        if results['response_times']:
            avg_response_time = sum(results['response_times']) / len(results['response_times'])
            min_response_time = min(results['response_times'])
            max_response_time = max(results['response_times'])
            
            self.stdout.write(f"Concurrent Load Results:")
            self.stdout.write(f"Total Requests: {results['total_requests']}")
            self.stdout.write(f"Successful: {results['successful_requests']}")
            self.stdout.write(f"Failed: {results['failed_requests']}")
            self.stdout.write(f"Success Rate: {(results['successful_requests']/results['total_requests']*100):.1f}%")
            self.stdout.write(f"Avg Response Time: {avg_response_time:.3f}s")
            self.stdout.write(f"Min Response Time: {min_response_time:.3f}s")
            self.stdout.write(f"Max Response Time: {max_response_time:.3f}s")
        
        return results

    def display_performance_results(self, results):
        """Display comprehensive performance results"""
        self.stdout.write("\n" + "="*60)
        self.stdout.write("PERFORMANCE TEST RESULTS SUMMARY")
        self.stdout.write("="*60)
        
        # Performance thresholds (in seconds)
        thresholds = {
            'bundle': 2.0,
            'drilldown': 1.5,
            'filters': 1.0,
            'export': 5.0,
            'concurrent_avg': 3.0
        }
        
        for test_type, test_results in results.items():
            if test_type == 'bundle' and isinstance(test_results, list):
                self.stdout.write(f"\n{test_type.upper()} PERFORMANCE:")
                for result in test_results:
                    status = "✅ PASS" if result['avg_time'] <= thresholds.get(test_type, 5.0) else "❌ FAIL"
                    self.stdout.write(
                        f"  {result['test_case']}: {result['avg_time']:.3f}s {status}"
                    )
            
            elif test_type == 'drilldown' and isinstance(test_results, list):
                self.stdout.write(f"\n{test_type.upper()} PERFORMANCE:")
                for result in test_results:
                    status = "✅ PASS" if result['avg_time'] <= thresholds.get(test_type, 5.0) else "❌ FAIL"
                    self.stdout.write(
                        f"  {result['test_case']}: {result['avg_time']:.3f}s {status}"
                    )
            
            elif test_type == 'filters':
                status = "✅ PASS" if test_results['avg_time'] <= thresholds.get(test_type, 5.0) else "❌ FAIL"
                self.stdout.write(f"\n{test_type.upper()} PERFORMANCE:")
                self.stdout.write(f"  Filter Options: {test_results['avg_time']:.3f}s {status}")
            
            elif test_type == 'export' and isinstance(test_results, list):
                self.stdout.write(f"\n{test_type.upper()} PERFORMANCE:")
                for result in test_results:
                    status = "✅ PASS" if result['avg_time'] <= thresholds.get(test_type, 5.0) else "❌ FAIL"
                    self.stdout.write(
                        f"  {result['test_case']}: {result['avg_time']:.3f}s {status}"
                    )
            
            elif test_type == 'concurrent':
                self.stdout.write(f"\n{test_type.upper()} LOAD TEST:")
                self.stdout.write(f"  Total Requests: {test_results['total_requests']}")
                self.stdout.write(f"  Success Rate: {(test_results['successful_requests']/test_results['total_requests']*100):.1f}%")
                if test_results['response_times']:
                    avg_time = sum(test_results['response_times']) / len(test_results['response_times'])
                    status = "✅ PASS" if avg_time <= thresholds.get('concurrent_avg', 5.0) else "❌ FAIL"
                    self.stdout.write(f"  Avg Response Time: {avg_time:.3f}s {status}")
        
        # Database query analysis
        self.stdout.write(f"\nDATABASE QUERY ANALYSIS:")
        self.stdout.write(f"Total Queries Executed: {len(connection.queries)}")
        
        if connection.queries:
            total_query_time = sum(float(query['time']) for query in connection.queries)
            avg_query_time = total_query_time / len(connection.queries)
            slow_queries = [q for q in connection.queries if float(q['time']) > 0.1]
            
            self.stdout.write(f"Total Query Time: {total_query_time:.3f}s")
            self.stdout.write(f"Average Query Time: {avg_query_time:.3f}s")
            self.stdout.write(f"Slow Queries (>0.1s): {len(slow_queries)}")
            
            if slow_queries:
                self.stdout.write("Slowest Queries:")
                for query in sorted(slow_queries, key=lambda x: float(x['time']), reverse=True)[:3]:
                    self.stdout.write(f"  {float(query['time']):.3f}s: {query['sql'][:100]}...")
        
        self.stdout.write("="*60)
        
        # Recommendations
        self.stdout.write("\nRECOMMENDATIONS:")
        if any(result.get('avg_time', 0) > thresholds.get('bundle', 2.0) for result in results.get('bundle', [])):
            self.stdout.write("• Consider adding more database indexes for analytics queries")
        if results.get('concurrent', {}).get('successful_requests', 0) / results.get('concurrent', {}).get('total_requests', 1) < 0.95:
            self.stdout.write("• Consider implementing caching for frequently accessed data")
        if len(slow_queries) > 5:
            self.stdout.write("• Review and optimize slow database queries")
        
        self.stdout.write("• Monitor database connection pool usage under load")
        self.stdout.write("• Consider implementing Redis caching for filter options")
        self.stdout.write("• Set up database read replicas for analytics queries")
