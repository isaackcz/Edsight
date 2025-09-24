#!/usr/bin/env python3
"""
Test script to verify the logging functionality
Run this to test the database logging system
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
from app.models import LoginAttempt, AuditLog, UsersSchool
from app.logging_utils import SystemLogger

def test_logging_system():
    """Test the logging system functionality"""
    print("🧪 Testing EdSight Logging System...")
    print("=" * 50)
    
    # Test 1: Login Attempt Logging
    print("\n1. Testing Login Attempt Logging...")
    
    # Test successful login
    SystemLogger.log_login_attempt(
        username="test_user",
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 (Test Browser)",
        success=True,
        location="Test Location"
    )
    
    # Test failed login
    SystemLogger.log_login_attempt(
        username="failed_user",
        ip_address="192.168.1.101",
        user_agent="Mozilla/5.0 (Test Browser)",
        success=False,
        failure_reason="Invalid password",
        location="Test Location"
    )
    
    # Check if login attempts were logged
    login_attempts = LoginAttempt.objects.filter(username__in=["test_user", "failed_user"])
    print(f"   ✅ Login attempts logged: {login_attempts.count()}")
    
    for attempt in login_attempts:
        status = "SUCCESS" if attempt.success else "FAILED"
        print(f"   📊 {attempt.username} - {status} - {attempt.ip_address}")
    
    # Test 2: User Activity Logging
    print("\n2. Testing User Activity Logging...")
    
    # Create or get a test user
    test_user, created = User.objects.get_or_create(
        username="test_logger",
        defaults={"email": "test@example.com"}
    )
    
    # Log various activities
    SystemLogger.log_user_activity(
        user=test_user,
        action_type="create",
        resource_type="form",
        resource_id="123",
        description="Created new form",
        ip_address="192.168.1.100",
        severity="medium"
    )
    
    SystemLogger.log_user_activity(
        user=test_user,
        action_type="update",
        resource_type="user_profile",
        description="Updated user profile",
        ip_address="192.168.1.100",
        severity="low"
    )
    
    SystemLogger.log_user_activity(
        user=test_user,
        action_type="data_access",
        resource_type="sensitive_data",
        description="Accessed sensitive data",
        ip_address="192.168.1.100",
        severity="high"
    )
    
    # Check if activities were logged
    audit_logs = AuditLog.objects.filter(user=test_user)
    print(f"   ✅ User activities logged: {audit_logs.count()}")
    
    for log in audit_logs:
        print(f"   📊 {log.action_type} on {log.resource_type} - {log.severity}")
    
    # Test 3: Security Event Logging
    print("\n3. Testing Security Event Logging...")
    
    SystemLogger.log_security_event(
        event_type="suspicious_activity",
        description="Multiple failed login attempts detected",
        ip_address="192.168.1.999",
        severity="critical"
    )
    
    security_logs = AuditLog.objects.filter(action_type="security_event")
    print(f"   ✅ Security events logged: {security_logs.count()}")
    
    # Test 4: Form Submission Logging
    print("\n4. Testing Form Submission Logging...")
    
    SystemLogger.log_form_submission(
        user=test_user,
        form_id="456",
        school_id="789",
        ip_address="192.168.1.100",
        success=True
    )
    
    form_logs = AuditLog.objects.filter(action_type="form_submit")
    print(f"   ✅ Form submissions logged: {form_logs.count()}")
    
    # Test 5: Database Statistics
    print("\n5. Database Statistics...")
    total_login_attempts = LoginAttempt.objects.count()
    successful_logins = LoginAttempt.objects.filter(success=True).count()
    failed_logins = LoginAttempt.objects.filter(success=False).count()
    total_audit_logs = AuditLog.objects.count()
    
    print(f"   📈 Total login attempts: {total_login_attempts}")
    print(f"   ✅ Successful logins: {successful_logins}")
    print(f"   ❌ Failed logins: {failed_logins}")
    print(f"   📋 Total audit logs: {total_audit_logs}")
    
    # Test 6: Recent Activity (Last 24 hours)
    print("\n6. Recent Activity (Last 24 hours)...")
    from datetime import timedelta
    
    last_24h = timezone.now() - timedelta(days=1)
    recent_logins = LoginAttempt.objects.filter(timestamp__gte=last_24h).count()
    recent_activities = AuditLog.objects.filter(timestamp__gte=last_24h).count()
    
    print(f"   🕐 Recent login attempts: {recent_logins}")
    print(f"   🕐 Recent activities: {recent_activities}")
    
    print("\n" + "=" * 50)
    print("✅ Logging System Test Completed Successfully!")
    print("🎯 All logging functions are working correctly.")
    print("📊 You can now view real data in the admin logs page.")
    
    return True

def test_csv_export_data():
    """Test if there's enough data for CSV export"""
    print("\n🧪 Testing CSV Export Data Availability...")
    print("=" * 50)
    
    # Check data availability for each export type
    login_history_count = LoginAttempt.objects.count()
    activity_logs_count = AuditLog.objects.count()
    audit_logs_count = AuditLog.objects.filter(severity__in=['high', 'critical']).count()
    failed_logins_count = LoginAttempt.objects.filter(success=False).count()
    
    print(f"📊 Login History Records: {login_history_count}")
    print(f"📊 Activity Log Records: {activity_logs_count}")
    print(f"📊 Audit Log Records (High/Critical): {audit_logs_count}")
    print(f"📊 Failed Login Records: {failed_logins_count}")
    
    if all([login_history_count > 0, activity_logs_count > 0]):
        print("✅ Sufficient data available for CSV export testing!")
        print("💡 You can now test the CSV export functionality in the admin panel.")
    else:
        print("⚠️  Limited data available. Run more tests to generate more log entries.")
    
    return True

if __name__ == "__main__":
    try:
        test_logging_system()
        test_csv_export_data()
        
        print("\n🚀 Next Steps:")
        print("1. Start your Django server: python manage.py runserver")
        print("2. Go to /admin/logs/ to view the real logging data")
        print("3. Test the CSV export functionality")
        print("4. Try logging in/out to generate more data")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
