# EdSight Admin User System Implementation Guide

## Overview

This document provides comprehensive guidance for implementing and using the new admin user system in EdSight, designed to support 90,000+ users with role-based access control across Central Office, Region, Division, District, and School levels.

## System Architecture

### Role Hierarchy
```
Central Office (Super Admin)
├── Region (Regional Reviewer)
├── Division (Division Admin)
├── District (District Reviewer)
└── School (School User)
```

### Access Control Matrix

| Role | Create Users | Manage Users | Set Deadlines | Approve Forms | View Logs | Coverage |
|------|--------------|--------------|---------------|---------------|-----------|----------|
| Central | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | Nationwide |
| Region | ❌ | ❌ | ✅ Regional | ✅ Regional | ✅ Regional | Regional |
| Division | ✅ District/School/Region* | ✅ Division | ❌ | ✅ Division | ❌ | Divisional |
| District | ❌ | ❌ | ❌ | ✅ District | ❌ | District |
| School | ❌ | ❌ | ❌ | ❌ | ❌ | Own School |

*Division can create Region accounts only if instructed by Central Office

## Implementation Steps

### 1. Database Setup

Execute the SQL schema updates:
```bash
mysql -u root -p edsight < database_updates/admin_user_system.sql
```

### 2. Django Model Migration

Run Django migrations to sync models:
```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Initialize Admin System

```bash
python manage.py admin_migration --create-super-admin --setup-permissions
```

### 4. Default Super Admin

**Username:** `central_admin`  
**Email:** `central.admin@deped.gov.ph`  
**Password:** `EdSight2024!` (Change immediately after first login)

## User Creation Process

### Email Format Requirements

#### School Users
- **Format:** `schoolid@deped.gov.ph`
- **Example:** `301234@deped.gov.ph`

#### Non-School Users
- **Format:** `firstname.lastname@deped.gov.ph`
- **Example:** `juan.dela.cruz@deped.gov.ph`

### Coverage Assignment

#### Central Office
- No geographic restrictions
- Can access all regions, divisions, districts, schools

#### Region
- Must be assigned to a specific region
- Can access all divisions, districts, schools within that region

#### Division
- Must be assigned to a specific division
- Can access all districts and schools within that division

#### District
- Must be assigned to a specific district
- Can access all schools within that district

#### School
- Must be assigned to a specific school
- Can only access their own school's data

## API Usage Examples

### Create Admin User

```python
from app.admin_utils import AdminUserManager

# Data for new user
user_data = {
    'username': 'region01_admin',
    'email': 'region.admin@deped.gov.ph',
    'full_name': 'Region I Administrator',
    'admin_level': 'region',
    'region_id': 1,
    'password': 'SecurePassword123!'
}

# Create user (creator_admin_id must have permission)
new_admin = AdminUserManager.create_admin_user(
    creator_admin_id=1,  # Central admin ID
    user_data=user_data,
    ip_address='192.168.1.100',
    user_agent='Mozilla/5.0...'
)
```

### Check Permissions

```python
from app.admin_utils import PermissionChecker

# Check if admin can access specific resource
can_access, message = PermissionChecker.check_resource_access(
    admin_id=5,
    resource_type='form',
    action='approve',
    resource_location={
        'region_id': 1,
        'division_id': 10,
        'district_id': None,
        'school_id': None
    }
)
```

### Set Deadlines

```python
from app.admin_utils import DeadlineManager
from datetime import datetime, timedelta

deadline_data = {
    'region_id': 1,
    'form_type': 'School Profile Update',
    'deadline_date': datetime.now() + timedelta(days=30),
    'description': 'Annual school profile update deadline',
    'is_active': True
}

deadline = DeadlineManager.set_deadline(
    admin_id=2,  # Region admin ID
    deadline_data=deadline_data,
    ip_address='192.168.1.100'
)
```

### Audit Logging

```python
from app.admin_utils import AuditLogger

# Manual activity logging
AuditLogger.log_activity(
    admin_id=1,
    action='BULK_USER_IMPORT',
    resource_type='user',
    details={'imported_count': 150, 'failed_count': 5},
    ip_address='192.168.1.100'
)

# Get activity summary
summary = AuditLogger.get_activity_summary(admin_id=1, days=30)
```

## Security Features

### Password Requirements
- Minimum 12 characters
- Must include uppercase, lowercase, numbers, special characters
- Passwords are hashed using Django's PBKDF2 algorithm

### Session Management
- Automatic session expiry (configurable)
- IP address and user agent tracking
- Multiple session detection and management

### Audit Trail
- Comprehensive logging of all admin activities
- IP address and timestamp tracking
- Detailed action logging with context

### Access Control
- Role-based permissions with geographic scope
- Fine-grained permission system
- Real-time permission validation

## Performance Optimizations

### Database Indexes
- Composite indexes for common query patterns
- Geographic coverage indexes
- Activity log partitioning by month

### Query Optimization
- Use of `select_related()` and `prefetch_related()`
- Efficient permission checking algorithms
- Cached access scope calculations

### Scalability Features
- Table partitioning for activity logs
- Connection pooling support
- Asynchronous processing for bulk operations

## Monitoring and Alerts

### Key Metrics to Monitor
- Login success/failure rates
- Permission denied attempts
- Unusual activity patterns
- Database connection pool usage

### Alert Conditions
- Multiple failed login attempts
- Permission escalation attempts
- Bulk operations outside normal hours
- Database performance degradation

## Troubleshooting

### Common Issues

#### Permission Denied Errors
```python
# Check admin's current permissions
from app.admin_utils import AdminUserManager
scope = AdminUserManager.get_user_access_scope(admin_id)
print(scope)
```

#### Email Validation Failures
```python
# Validate email format
from app.admin_utils import AdminUserManager
try:
    AdminUserManager.validate_email_format('test@deped.gov.ph', 'school')
    print("Valid email format")
except ValidationError as e:
    print(f"Invalid email: {e}")
```

#### Geographic Scope Issues
```python
# Check if admin can access specific area
admin = AdminUser.objects.get(admin_id=5)
can_access = admin.can_access_area(region_id=1, division_id=10)
print(f"Can access: {can_access}")
```

## Best Practices

### User Management
1. Always validate permissions before user creation
2. Use the provided utility functions for consistency
3. Log all administrative actions
4. Regularly audit user permissions

### Security
1. Enforce strong password policies
2. Monitor for unusual login patterns
3. Regularly rotate admin passwords
4. Use HTTPS for all admin operations

### Performance
1. Use bulk operations for large datasets
2. Implement caching for frequently accessed data
3. Monitor database query performance
4. Use appropriate indexes for query patterns

## Migration Checklist

- [ ] Backup existing database
- [ ] Run SQL schema updates
- [ ] Apply Django migrations
- [ ] Initialize admin system
- [ ] Create initial admin users
- [ ] Test permission system
- [ ] Verify audit logging
- [ ] Update application authentication
- [ ] Test user creation workflows
- [ ] Monitor system performance

## Support and Maintenance

### Regular Tasks
- Weekly permission audits
- Monthly activity log archival
- Quarterly security reviews
- Annual password policy updates

### Monitoring Commands
```bash
# Check system health
python manage.py check_admin_system

# Generate activity report
python manage.py admin_activity_report --days 30

# Audit permissions
python manage.py audit_permissions --level all
```

For additional support, refer to the system documentation or contact the development team.
