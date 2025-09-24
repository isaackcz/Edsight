# School User Transfer Guide

## Overview

This guide documents the process of transferring school users from the `users_school` table to the `admin_user` table as part of the EdSight system's user management consolidation.

## Background

The EdSight system initially had separate user management systems:
- `users_school` table for school-level users
- `admin_user` table for administrative users

To consolidate user management and improve system consistency, all school users need to be transferred to the `admin_user` table with the `admin_level` set to 'school'.

## Field Mapping

The following table shows how fields are mapped from `users_school` to `admin_user`:

| users_school Field | admin_user Field | Transformation | Notes |
|-------------------|------------------|----------------|-------|
| `id` | - | Not mapped | admin_id will auto-increment |
| `username` | `username` | Direct copy | Must be unique |
| `password_hash` | `password_hash` | Direct copy | Password hash preserved |
| `email` | `email` | Direct copy | Must be unique |
| `role` | `admin_level` | Set to 'school' | Fixed value for all transfers |
| `region_id` | `region_id` | Direct copy | FK to regions table |
| `division_id` | `division_id` | Direct copy | FK to divisions table |
| `district_id` | `district_id` | Direct copy | FK to districts table |
| `school_id` | `school_id` | Direct copy | FK to schools table |
| `school_name` | `assigned_area` | Direct copy | Geographic assignment |
| `school_name` | `full_name` | Direct copy | Used as display name |
| `is_active` | `status` | Boolean to enum | True → 'active', False → 'inactive' |
| `last_login` | `last_login` | Direct copy | Timestamp preserved |
| `created_at` | `created_at` | Direct copy | Timestamp preserved |

## Permissions Assignment

Transferred school users will receive the following permissions:
- `can_create_users`: False
- `can_manage_users`: False  
- `can_set_deadlines`: False
- `can_approve_submissions`: True (schools can approve their submissions)
- `can_view_system_logs`: False

## Pre-Migration Checklist

Before running the migration, ensure:

1. **Database Backup**: Create a full backup of the database
   ```sql
   mysqldump -u username -p edsight > edsight_backup_before_transfer.sql
   ```

2. **Verify Foreign Key Integrity**: Ensure all referenced regions, divisions, districts, and schools exist
   ```python
   python transfer_school_users.py --dry-run
   ```

3. **Check for Conflicts**: Verify no username/email conflicts exist between tables
   ```sql
   SELECT us.username, au.username 
   FROM users_school us 
   INNER JOIN admin_user au ON us.username = au.username;
   
   SELECT us.email, au.email 
   FROM users_school us 
   INNER JOIN admin_user au ON us.email = au.email;
   ```

4. **Review Current Data**:
   ```sql
   SELECT COUNT(*) as users_school_count FROM users_school;
   SELECT COUNT(*) as admin_school_count FROM admin_user WHERE admin_level = 'school';
   ```

## Migration Process

### Step 1: Dry Run
Always start with a dry run to preview changes:

```bash
cd database_updates
run_school_user_transfer.bat
# Choose option 1 for dry run
```

Or directly:
```bash
python transfer_school_users.py --dry-run
```

### Step 2: Review Dry Run Results
Check the output for:
- Total users to be transferred
- Any validation errors
- Conflicts with existing users
- Foreign key issues

### Step 3: Execute Transfer
If dry run looks good, execute the actual transfer:

```bash
run_school_user_transfer.bat
# Choose option 2 for actual transfer
```

Or directly:
```bash
python transfer_school_users.py
```

### Step 4: Verify Transfer
After completion, verify the transfer:

```bash
run_school_user_transfer.bat
# Choose option 3 for verification
```

Or directly:
```bash
python transfer_school_users.py --verify
```

## Post-Migration Steps

### 1. Verify Data Integrity
```sql
-- Check total counts match
SELECT 
    (SELECT COUNT(*) FROM users_school) as original_count,
    (SELECT COUNT(*) FROM admin_user WHERE admin_level = 'school') as transferred_count;

-- Verify specific user data
SELECT 
    us.username,
    us.email,
    us.school_name,
    au.username as admin_username,
    au.email as admin_email,
    au.assigned_area,
    au.admin_level
FROM users_school us
LEFT JOIN admin_user au ON us.username = au.username
WHERE au.admin_level = 'school'
LIMIT 10;
```

### 2. Update Application References
Search and update any code that directly references `users_school`:

```bash
# Search for direct table references
grep -r "users_school" app/
grep -r "UsersSchool" app/
```

### 3. Update Authentication Logic
Ensure authentication systems now use the `admin_user` table for school users.

### 4. Test School User Login
1. Test login functionality for transferred school users
2. Verify permissions work correctly
3. Check that school-specific features still function

### 5. Consider Dropping Old Table (OPTIONAL)
**⚠️ CAUTION**: Only after thorough testing and verification

```sql
-- Rename table instead of dropping (safer)
RENAME TABLE users_school TO users_school_backup_YYYYMMDD;

-- Or drop if absolutely certain
-- DROP TABLE users_school;
```

## Rollback Procedure

If issues are discovered after migration:

### Option 1: Selective Rollback
Remove only the transferred users:
```sql
DELETE FROM admin_user 
WHERE admin_level = 'school' 
AND created_at >= 'YYYY-MM-DD HH:MM:SS';  -- Use migration timestamp
```

### Option 2: Full Database Restore
```bash
mysql -u username -p edsight < edsight_backup_before_transfer.sql
```

## Troubleshooting

### Common Issues

1. **Username/Email Conflicts**
   - **Error**: User already exists
   - **Solution**: Manually resolve conflicts or update existing records

2. **Foreign Key Violations**
   - **Error**: Referenced region/division/district/school doesn't exist
   - **Solution**: Create missing records or update references

3. **Permission Issues**
   - **Error**: Database permission denied
   - **Solution**: Ensure user has INSERT/UPDATE permissions on admin_user table

### Validation Queries

```sql
-- Check for orphaned references
SELECT * FROM users_school us
LEFT JOIN regions r ON us.region_id = r.id
WHERE us.region_id IS NOT NULL AND r.id IS NULL;

-- Verify password hashes are preserved
SELECT 
    us.username,
    us.password_hash as original_hash,
    au.password_hash as transferred_hash,
    (us.password_hash = au.password_hash) as hash_match
FROM users_school us
JOIN admin_user au ON us.username = au.username
WHERE au.admin_level = 'school';
```

## Security Considerations

1. **Password Preservation**: Original password hashes are preserved
2. **Audit Trail**: All transfers are logged via EnhancedSystemLogger
3. **Permissions**: School users receive minimal required permissions
4. **Access Control**: Geographic restrictions are maintained

## Performance Notes

- Migration runs within a database transaction for consistency
- Large datasets may take several minutes to transfer
- Consider running during low-usage periods
- Monitor database performance during migration

## Support

If you encounter issues during migration:

1. Check the migration logs for detailed error messages
2. Verify all prerequisites are met
3. Test with a smaller subset of data first
4. Contact the development team with specific error details

---

**Last Updated**: December 2024  
**Version**: 1.0  
**Author**: EdSight Development Team
