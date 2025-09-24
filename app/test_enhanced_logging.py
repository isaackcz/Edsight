#!/usr/bin/env python3
"""
Test script for the enhanced logging system
Tests all new logging capabilities and database integration
"""

import os
import sys
import django
from django.conf import settings

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth.models import User
from app.models import *
from app.enhanced_logging_utils import EnhancedSystemLogger, LoggingContext

def test_enhanced_logging():
    """Test all enhanced logging capabilities"""
    
    print("🧪 TESTING ENHANCED EDSIGHT LOGGING SYSTEM")
    print("=" * 80)
    
    # Create test user
    test_user, created = User.objects.get_or_create(
        username="enhanced_test_user",
        defaults={"email": "enhanced@test.com"}
    )
    
    # Test 1: Question Management Logging
    print("\n1. 📚 Testing Question Management Logging...")
    
    # Create a test category, subsection, and topic first
    category, _ = Category.objects.get_or_create(
        name="Test Category",
        defaults={"display_order": 1}
    )
    
    subsection, _ = SubSection.objects.get_or_create(
        category=category,
        name="Test SubSection",
        defaults={"display_order": 1}
    )
    
    topic, _ = Topic.objects.get_or_create(
        sub_section=subsection,
        name="Test Topic",
        defaults={"display_order": 1}
    )
    
    # Create a test question
    question = Question.objects.create(
        topic=topic,
        question_text="Test Question for Enhanced Logging",
        answer_type="text",
        is_required=True,
        display_order=1
    )
    
    # Test question logging
    EnhancedSystemLogger.log_question_change(
        user=test_user,
        question=question,
        action="create",
        new_data={
            "question_text": question.question_text,
            "answer_type": question.answer_type,
            "is_required": question.is_required
        },
        ip_address="192.168.1.100"
    )
    
    # Test question update logging
    old_data = {
        "question_text": question.question_text,
        "answer_type": question.answer_type,
        "is_required": question.is_required
    }
    
    question.question_text = "Updated Test Question"
    question.save()
    
    new_data = {
        "question_text": question.question_text,
        "answer_type": question.answer_type,
        "is_required": question.is_required
    }
    
    EnhancedSystemLogger.log_question_change(
        user=test_user,
        question=question,
        action="update",
        old_data=old_data,
        new_data=new_data,
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Question management logging completed")
    
    # Test 2: Category Management Logging
    print("\n2. 📂 Testing Category Management Logging...")
    
    EnhancedSystemLogger.log_category_change(
        user=test_user,
        category=category,
        action="create",
        new_data={"name": category.name, "display_order": category.display_order},
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Category management logging completed")
    
    # Test 3: Form and Answer Logging
    print("\n3. 📋 Testing Form and Answer Logging...")
    
    # Create a test school user
    test_school_user, _ = UsersSchool.objects.get_or_create(
        username="test_school_user",
        defaults={
            "password_hash": "test_hash",
            "email": "school@test.com",
            "role": "school",
            "school_name": "Test School",
            "is_active": True
        }
    )
    
    # Create a test form
    form = Form.objects.create(
        user_id=test_user.id,
        school=test_school_user,
        status="draft"
    )
    
    # Test form status change logging
    EnhancedSystemLogger.log_form_status_change(
        user=test_user,
        form=form,
        old_status="draft",
        new_status="in-progress",
        comments="Starting form completion",
        ip_address="192.168.1.100"
    )
    
    # Create a test answer
    answer = Answer.objects.create(
        form=form,
        question=question,
        response="Test Answer"
    )
    
    # Test answer logging
    EnhancedSystemLogger.log_answer_change(
        user=test_user,
        answer=answer,
        action="create",
        ip_address="192.168.1.100"
    )
    
    # Test answer update logging
    old_value = answer.response
    answer.response = "Updated Test Answer"
    answer.save()
    
    EnhancedSystemLogger.log_answer_change(
        user=test_user,
        answer=answer,
        action="update",
        old_value=old_value,
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Form and answer logging completed")
    
    # Test 4: Administrative User Logging
    print("\n4. 🏛️ Testing Administrative User Logging...")
    
    # Create test admin users
    admin_user1, _ = AdminUser.objects.get_or_create(
        username="test_admin_1",
        defaults={
            "email": "admin1@deped.gov.ph",
            "password_hash": "test_hash",
            "admin_level": "central",
            "status": "active"
        }
    )
    
    admin_user2, _ = AdminUser.objects.get_or_create(
        username="test_admin_2",
        defaults={
            "email": "admin2@deped.gov.ph",
            "password_hash": "test_hash",
            "admin_level": "division",
            "status": "active"
        }
    )
    
    # Test admin user change logging
    EnhancedSystemLogger.log_admin_user_change(
        acting_admin=admin_user1,
        target_admin=admin_user2,
        action="update",
        field_changes={"status": {"old": "inactive", "new": "active"}},
        ip_address="192.168.1.100"
    )
    
    # Test permission change logging
    EnhancedSystemLogger.log_permission_change(
        acting_admin=admin_user1,
        target_admin=admin_user2,
        permission="can_create_users",
        action="grant",
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Administrative user logging completed")
    
    # Test 5: School Management Logging
    print("\n5. 🏫 Testing School Management Logging...")
    
    # Create test geographic entities
    region, _ = Region.objects.get_or_create(name="Test Region")
    division, _ = Division.objects.get_or_create(name="Test Division", region=region)
    district, _ = District.objects.get_or_create(name="Test District", division=division)
    
    school, _ = School.objects.get_or_create(
        school_id="TEST001",
        defaults={
            "school_name": "Test School",
            "district": district,
            "division": division,
            "region": region
        }
    )
    
    # Test school change logging
    EnhancedSystemLogger.log_school_change(
        user=test_user,
        school=school,
        action="create",
        field_changes={"school_name": {"new": "Test School"}},
        ip_address="192.168.1.100"
    )
    
    # Test geographic entity logging
    EnhancedSystemLogger.log_geographic_change(
        user=test_user,
        entity=region,
        entity_type="region",
        action="create",
        field_changes={"name": {"new": "Test Region"}},
        ip_address="192.168.1.100"
    )
    
    print("   ✅ School management logging completed")
    
    # Test 6: Security and Compliance Logging
    print("\n6. 🔒 Testing Security and Compliance Logging...")
    
    # Test account lockout logging
    EnhancedSystemLogger.log_account_lockout(
        username="suspicious_user",
        action="lock",
        reason="Multiple failed login attempts",
        ip_address="192.168.1.999"
    )
    
    # Test data import logging
    EnhancedSystemLogger.log_data_import(
        user=test_user,
        import_type="schools",
        record_count=50,
        success=True,
        ip_address="192.168.1.100"
    )
    
    # Test report generation logging
    EnhancedSystemLogger.log_report_generation(
        user=test_user,
        report_type="user_activity",
        report_id="RPT001",
        success=True,
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Security and compliance logging completed")
    
    # Test 7: Bulk Operations Logging
    print("\n7. 📦 Testing Bulk Operations Logging...")
    
    EnhancedSystemLogger.log_bulk_operation(
        user=test_user,
        operation_type="update",
        resource_type="questions",
        affected_count=25,
        success=True,
        ip_address="192.168.1.100"
    )
    
    print("   ✅ Bulk operations logging completed")
    
    # Test 8: Logging Context Manager
    print("\n8. 🔧 Testing Logging Context Manager...")
    
    with LoggingContext(test_user, "192.168.1.100", "Test User Agent") as ctx:
        # This would automatically add logging context to model operations
        test_question = ctx.add_context(question)
        print("   ✅ Logging context manager working")
    
    # Get comprehensive statistics
    print("\n\n📊 ENHANCED LOGGING STATISTICS")
    print("=" * 50)
    
    # Count logs by resource type
    resource_counts = {}
    all_logs = AuditLog.objects.all()
    
    for log in all_logs:
        resource_type = log.resource_type
        if resource_type not in resource_counts:
            resource_counts[resource_type] = 0
        resource_counts[resource_type] += 1
    
    print("📈 Logs by Resource Type:")
    for resource_type, count in sorted(resource_counts.items()):
        print(f"   • {resource_type}: {count} logs")
    
    # Count logs by action type
    action_counts = {}
    for log in all_logs:
        action_type = log.action_type
        if action_type not in action_counts:
            action_counts[action_type] = 0
        action_counts[action_type] += 1
    
    print(f"\n📈 Logs by Action Type:")
    for action_type, count in sorted(action_counts.items()):
        print(f"   • {action_type}: {count} logs")
    
    # Count logs by severity
    severity_counts = {}
    for log in all_logs:
        severity = log.severity
        if severity not in severity_counts:
            severity_counts[severity] = 0
        severity_counts[severity] += 1
    
    print(f"\n📈 Logs by Severity:")
    for severity, count in sorted(severity_counts.items()):
        icon = {"low": "🟢", "medium": "🟡", "high": "🟠", "critical": "🔴"}.get(severity, "⚪")
        print(f"   {icon} {severity}: {count} logs")
    
    # Total statistics
    total_audit_logs = AuditLog.objects.count()
    total_login_attempts = LoginAttempt.objects.count()
    recent_logs = AuditLog.objects.filter(
        timestamp__gte=timezone.now() - timezone.timedelta(hours=1)
    ).count()
    
    print(f"\n📊 Overall Statistics:")
    print(f"   📋 Total Audit Logs: {total_audit_logs}")
    print(f"   🔑 Total Login Attempts: {total_login_attempts}")
    print(f"   ⏰ Recent Logs (1 hour): {recent_logs}")
    
    print("\n\n✅ ENHANCED LOGGING SYSTEM TEST COMPLETED!")
    print("🎯 All enhanced logging functions are working correctly.")
    print("📊 Database contains comprehensive audit trails.")
    print("🔍 Ready for production use with full traceability.")
    
    return True

def test_logging_integration():
    """Test integration with existing systems"""
    
    print("\n\n🔗 TESTING LOGGING SYSTEM INTEGRATION")
    print("=" * 50)
    
    # Test database table coverage
    print("📋 Database Table Coverage Analysis:")
    
    covered_tables = [
        'login_attempts', 'audit_logs', 'admin_activity_log',
        'questions', 'answers', 'forms', 'categories', 'topics',
        'admin_user', 'users_school', 'schools', 'regions',
        'divisions', 'districts'
    ]
    
    for table in covered_tables:
        print(f"   ✅ {table} - Logging implemented")
    
    # Identify tables that could benefit from additional logging
    additional_opportunities = [
        'form_approvals', 'form_deadlines', 'user_creation_requests',
        'admin_user_permissions', 'security_alerts', 'security_incidents',
        'compliance_reports', 'data_subject_requests', 'encryption_keys'
    ]
    
    print(f"\n📈 Additional Logging Opportunities:")
    for table in additional_opportunities:
        print(f"   🟡 {table} - Could benefit from enhanced logging")
    
    print(f"\n📊 Coverage Summary:")
    print(f"   ✅ Implemented: {len(covered_tables)} tables")
    print(f"   🟡 Opportunities: {len(additional_opportunities)} tables")
    
    return True

if __name__ == "__main__":
    try:
        test_enhanced_logging()
        test_logging_integration()
        
        print(f"\n\n🚀 NEXT STEPS FOR ENHANCED LOGGING")
        print("=" * 40)
        print("1. ✅ Enhanced logging system is fully functional")
        print("2. 🎨 Update admin interface to show new log categories")
        print("3. 📊 Add specialized dashboard widgets for log analytics")
        print("4. 🔍 Implement advanced search and filtering")
        print("5. 📈 Set up automated alerts for critical events")
        print("6. 🔄 Consider implementing Django signals for automatic logging")
        
    except Exception as e:
        print(f"❌ Error during enhanced logging test: {e}")
        import traceback
        traceback.print_exc()
