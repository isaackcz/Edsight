# Testing Guide: Admin Access Control for Form Management

This guide provides step-by-step instructions to test the admin access control implementation for the form-management system.

## Prerequisites

1. Apply the database optimization indexes:
   ```bash
   mysql -u root -p edsight < database_optimization_indexes.sql
   ```

2. Ensure you have test admin accounts at different levels:
   - Central admin
   - Region admin
   - Division admin
   - District admin

## Test Cases

### Test 1: District Admin Access Control

**Objective:** Verify district admin can only see schools within their assigned district.

**Steps:**
1. Login as a district admin (e.g., district 1)
2. Navigate to `http://localhost:8000/form-management/`
3. Verify:
   - ✓ Only sees their assigned region in the region list
   - ✓ Only sees their assigned division in the division list
   - ✓ Only sees their assigned district in the district list
   - ✓ Only sees schools belonging to their district in the schools table
4. Try to manually access another district's data:
   - Open browser console
   - Try: `fetch('/api/form-management/schools-table/?district_id=999')`
   - Expected: 403 Forbidden error with "Access denied" message

**Expected Result:** District admin cannot view or access schools outside their district.

---

### Test 2: Division Admin Access Control

**Objective:** Verify division admin can see all districts within their division but not other divisions.

**Steps:**
1. Login as a division admin
2. Navigate to form-management page
3. Verify:
   - ✓ Sees their assigned region
   - ✓ Sees their assigned division
   - ✓ Sees all districts within their division
   - ✓ Sees all schools within their division (across all districts)
4. Select different districts within their division:
   - ✓ Can filter schools by district
   - ✓ Can view forms for schools in any district within their division
5. Try to access another division's data:
   - Use browser console to request division_id outside their scope
   - Expected: 403 Forbidden error

**Expected Result:** Division admin can access all districts/schools in their division only.

---

### Test 3: Region Admin Access Control

**Objective:** Verify region admin can see all divisions and districts within their region.

**Steps:**
1. Login as a region admin
2. Navigate to form-management page
3. Verify:
   - ✓ Sees their assigned region only
   - ✓ Sees all divisions within their region
   - ✓ Sees all districts within their region
   - ✓ Can filter schools by any division or district in their region
4. Try to access another region's data:
   - Use browser console to request region_id outside their scope
   - Expected: 403 Forbidden error

**Expected Result:** Region admin can access all data within their region only.

---

### Test 4: Central Admin Access Control

**Objective:** Verify central admin can see all regions, divisions, districts, and schools.

**Steps:**
1. Login as a central admin
2. Navigate to form-management page
3. Verify:
   - ✓ Sees all regions
   - ✓ Can select any region and see all its divisions
   - ✓ Can select any division and see all its districts
   - ✓ Can view all schools nationwide
   - ✓ Can filter and search across all geographic levels

**Expected Result:** Central admin has unrestricted access to all data.

---

### Test 5: Export Functionality Security

**Objective:** Verify export functionality respects admin scope.

**Steps:**
1. Login as a district admin
2. Navigate to form-management page
3. Select schools within your district
4. Click export
   - Expected: ✓ Export succeeds
5. Use browser console to try exporting schools from another district:
   ```javascript
   fetch('/api/form-management/export-schools/', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({school_ids: [999, 998, 997]}) // IDs from another district
   })
   ```
   - Expected: 403 Forbidden or filtered results

**Expected Result:** Admins can only export schools within their scope.

---

### Test 6: School Forms Access Control

**Objective:** Verify admins cannot access forms for schools outside their scope.

**Steps:**
1. Login as a district admin
2. Find a school_id from another district (check database or logs)
3. Try to access: `http://localhost:8000/api/form-management/schools/{school_id}/forms/`
   - Expected: 403 Forbidden error
4. Access a school within your district:
   - Expected: ✓ Forms displayed successfully

**Expected Result:** Admins cannot view forms for schools outside their scope.

---

### Test 7: Cache Isolation

**Objective:** Verify admin-specific cache isolation works correctly.

**Steps:**
1. Login as district admin A
2. Load form-management page (caches their regions)
3. Logout and login as district admin B (different district)
4. Load form-management page
5. Verify:
   - ✓ District admin B sees only their own data
   - ✓ No data leakage from district admin A's cache

**Expected Result:** Each admin's cached data is isolated.

---

### Test 8: Performance Testing

**Objective:** Verify database indexes improve query performance.

**Steps:**
1. Use MySQL EXPLAIN to verify indexes are being used:
   ```sql
   EXPLAIN SELECT s.id, s.school_name, COUNT(f.form_id)
   FROM schools s
   INNER JOIN forms f ON f.school_id = s.id
   WHERE s.district_id = 1
   GROUP BY s.id, s.school_name;
   ```
2. Verify the query uses `idx_schools_region_division_district` or similar
3. Check query execution time is under 100ms for typical queries

**Expected Result:** Queries use indexes and execute quickly.

---

## Testing Checklist

Use this checklist to track your testing progress:

- [ ] Test 1: District Admin Access Control
- [ ] Test 2: Division Admin Access Control
- [ ] Test 3: Region Admin Access Control
- [ ] Test 4: Central Admin Access Control
- [ ] Test 5: Export Functionality Security
- [ ] Test 6: School Forms Access Control
- [ ] Test 7: Cache Isolation
- [ ] Test 8: Performance Testing

## Troubleshooting

### Issue: All admins see all data

**Possible Cause:** Admin session not set properly or development bypass active.

**Solution:**
1. Check `apps/admin_management/utils.py` - look for `DEBUG` bypass code
2. Verify admin session contains correct `admin_id`
3. Check `get_admin_scope()` returns correct scope data

### Issue: 403 errors for legitimate access

**Possible Cause:** Admin scope data missing or incorrect.

**Solution:**
1. Check admin user record in database:
   ```sql
   SELECT admin_id, admin_level, region_id, division_id, district_id 
   FROM admin_user WHERE admin_id = ?;
   ```
2. Verify geographic assignments are correct
3. Check `AdminUserManager.get_user_access_scope()` output

### Issue: Slow query performance

**Possible Cause:** Indexes not created or not being used.

**Solution:**
1. Verify indexes exist:
   ```sql
   SHOW INDEX FROM schools;
   SHOW INDEX FROM forms;
   ```
2. Use EXPLAIN to check query plans
3. Run `OPTIMIZE TABLE schools, forms, admin_user;`

## Database Queries for Testing

### Get admin user info:
```sql
SELECT admin_id, username, admin_level, region_id, division_id, district_id
FROM admin_user
WHERE status = 'active';
```

### Get schools by district:
```sql
SELECT id, school_name, district_id
FROM schools
WHERE district_id = 1;
```

### Count forms by school:
```sql
SELECT school_id, COUNT(*) as form_count
FROM forms
GROUP BY school_id;
```

## Success Criteria

All tests should pass with the following outcomes:
- ✓ No unauthorized data access across admin levels
- ✓ All API endpoints return 403 for out-of-scope requests
- ✓ Export functionality respects scope boundaries
- ✓ Cache is properly isolated per admin
- ✓ Query performance is acceptable (< 100ms for typical queries)
- ✓ Database indexes are being used

## Reporting Issues

If you find any issues during testing:
1. Note which test case failed
2. Record the admin level being tested
3. Capture any error messages or unexpected behavior
4. Check browser console for JavaScript errors
5. Check Django logs for server-side errors

