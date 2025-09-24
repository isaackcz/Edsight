#!/usr/bin/env python
"""
Test database connection and check for school users
"""

import os
import sys
import django
from datetime import datetime

# Setup Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    django.setup()
    print(f"[{datetime.now()}] Django setup successful")
except Exception as e:
    print(f"[{datetime.now()}] Django setup failed: {e}")
    sys.exit(1)

try:
    from django.db import connection
    print(f"[{datetime.now()}] Testing database connection...")
    
    with connection.cursor() as cursor:
        # Test basic connection
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print(f"[{datetime.now()}] Database connection test: {result}")
        
        # Check if tables exist
        cursor.execute("SHOW TABLES LIKE 'users_school'")
        users_school_exists = cursor.fetchone()
        print(f"[{datetime.now()}] users_school table exists: {bool(users_school_exists)}")
        
        cursor.execute("SHOW TABLES LIKE 'admin_user'")
        admin_user_exists = cursor.fetchone()
        print(f"[{datetime.now()}] admin_user table exists: {bool(admin_user_exists)}")
        
        if users_school_exists:
            cursor.execute("SELECT COUNT(*) FROM users_school")
            users_school_count = cursor.fetchone()[0]
            print(f"[{datetime.now()}] users_school count: {users_school_count}")
            
            if users_school_count > 0:
                cursor.execute("SELECT username, email, school_name FROM users_school LIMIT 3")
                sample_users = cursor.fetchall()
                print(f"[{datetime.now()}] Sample users:")
                for user in sample_users:
                    print(f"  - {user[0]} ({user[1]}) - {user[2]}")
        
        if admin_user_exists:
            cursor.execute("SELECT COUNT(*) FROM admin_user WHERE admin_level = 'school'")
            admin_school_count = cursor.fetchone()[0]
            print(f"[{datetime.now()}] admin_user school count: {admin_school_count}")
            
            if admin_school_count > 0:
                cursor.execute("SELECT username, email, assigned_area FROM admin_user WHERE admin_level = 'school' LIMIT 3")
                sample_admin_users = cursor.fetchall()
                print(f"[{datetime.now()}] Sample admin school users:")
                for user in sample_admin_users:
                    print(f"  - {user[0]} ({user[1]}) - {user[2]}")

except Exception as e:
    print(f"[{datetime.now()}] Database connection failed: {e}")
    import traceback
    traceback.print_exc()

print(f"[{datetime.now()}] Test completed")
