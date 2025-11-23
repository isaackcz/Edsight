# Form Management Tree View - School Display Filters

## Overview

The Form Management page (`http://localhost:8000/form-management/`) implements a hierarchical tree view that displays schools based on multiple filtering criteria. This document outlines all the filters and logic used to determine which schools are visible to each admin level.

## Filter Chain

Schools are displayed in the tree view only if ALL of the following conditions are met:

### 1. Form Existence Filter (FIRST FILTER)
**Condition:** The school MUST have at least one form in the `forms` table
- Query uses: `INNER JOIN forms f ON f.school_id = s.id`
- **Effect:** Only schools that have submitted forms are displayed
- **Rationale:** There's no need to show schools without any forms in the system

### 2. Workflow Status Filter (SECOND FILTER)
**Condition:** The form's `workflow_status` must be at the admin's visibility level

The visibility depends on the admin's level:

#### Central Admin
- **Visible workflow_status:** ALL statuses
- **Rationale:** Central admins oversee the entire workflow and need to see all forms

#### Region Admin
- **Visible workflow_status:** 
  - `region_pending` - Forms waiting for region review
  - `region_approved` - Forms approved by region
  - `region_returned` - Forms returned by region
  - `central_pending` - Forms that have progressed to central
- **NOT VISIBLE:** `district_pending`, `district_approved`, `district_returned`, `division_pending`, `division_approved`, `division_returned`
- **Rationale:** Region admins don't see forms still at district/division levels

#### Division Admin
- **Visible workflow_status:** 
  - `division_pending` - Forms waiting for division review
  - `division_approved` - Forms approved by division
  - `division_returned` - Forms returned by division
  - `region_pending` - Forms that have progressed to region
- **NOT VISIBLE:** `district_pending`, `district_approved`, `district_returned`
- **Rationale:** Division admins don't see forms still at district level

#### District Admin
- **Visible workflow_status:** 
  - `district_pending` - Forms waiting for district review
  - `district_approved` - Forms approved by district
  - `district_returned` - Forms returned by district
  - `division_pending` - Forms that have progressed to division
- **NOT VISIBLE:** None (district is the lowest admin level shown in form management)
- **Rationale:** District admins see forms at their level and above

### 3. Admin Assignment Filter (THIRD FILTER)
**Condition:** The school must be within the admin's assigned geographical area

#### Central Admin
- **Filter:** No geographical restriction
- **Rationale:** Central admins have nationwide access

#### Region Admin
- **Filter:** `s.region_id = admin_scope['region_id']`
- **Visible:** Only schools in the admin's assigned region
- **Rationale:** Region admins manage only their region

#### Division Admin
- **Filter:** `s.division_id = admin_scope['division_id']`
- **Visible:** Only schools in the admin's assigned division
- **Rationale:** Division admins manage only their division

#### District Admin
- **Filter:** `s.district_id = admin_scope['district_id']`
- **Visible:** Only schools in the admin's assigned district
- **Rationale:** District admins manage only their district

## Complete Filter Logic Summary

### Central Admin
```
Schools Displayed = Schools WHERE:
  - EXISTS form in forms table
  - (No additional filters)
```

### Region Admin
```
Schools Displayed = Schools WHERE:
  - EXISTS form in forms table
  - workflow_status IN ('region_pending', 'region_approved', 'region_returned', 'central_pending')
  - region_id = admin's assigned region_id
```

### Division Admin
```
Schools Displayed = Schools WHERE:
  - EXISTS form in forms table
  - workflow_status IN ('division_pending', 'division_approved', 'division_returned', 'region_pending')
  - division_id = admin's assigned division_id
```

### District Admin
```
Schools Displayed = Schools WHERE:
  - EXISTS form in forms table
  - workflow_status IN ('district_pending', 'district_approved', 'district_returned', 'division_pending')
  - district_id = admin's assigned district_id
```

## Tree View Hierarchy

The tree view is organized as follows:
```
Regions
  └── Divisions
      └── Districts
          └── Schools
```

Each level filters based on:
1. **Form existence** (applies at all levels)
2. **Workflow status visibility** (applies based on admin level)
3. **Geographical assignment** (applies based on admin level)

## Workflow Status Transitions

Understanding when forms change status helps explain the filtering:

```
School Level:
  draft → submitted → district_pending (when completed)

District Level:
  district_pending → district_approved → division_pending
  district_pending → district_returned → draft

Division Level:
  division_pending → division_approved → region_pending
  division_pending → division_returned → district_returned

Region Level:
  region_pending → region_approved → central_pending
  region_pending → region_returned → division_returned

Central Level:
  central_pending → central_approved → completed
  central_pending → central_returned → region_returned
```

## Implementation Details

### Database Queries

All queries use SQL with these key components:
- `INNER JOIN forms f ON f.school_id = s.id` - Ensures schools have forms
- `f.workflow_status IN (...)` - Filters by visible statuses
- `s.region_id/division_id/district_id = ...` - Filters by geographical assignment

### Caching

- Cache keys include the admin_id to prevent cross-admin data leakage
- Cache duration: 10 minutes
- Cache invalidation: Manual via clear-cache endpoint or automatic on form status changes

### Security Considerations

1. **Authorization:** All endpoints require authentication via `get_admin_scope()`
2. **Scope Verification:** Double-checks that requested filters are within admin's scope
3. **Return Status:** Returns 403 Forbidden for unauthorized access attempts

## Examples

### Example 1: Region Admin Viewing Schools

**Admin:** Region 1 Officer
**Forms in database:**
- School A (Region 1) - workflow_status: `district_pending` (NOT VISIBLE)
- School B (Region 1) - workflow_status: `region_pending` (VISIBLE)
- School C (Region 1) - workflow_status: `central_pending` (VISIBLE)
- School D (Region 2) - workflow_status: `region_pending` (NOT VISIBLE - wrong region)

**Result:** Only Schools B and C are displayed

### Example 2: District Admin Viewing Schools

**Admin:** District 5 Officer
**Forms in database:**
- School X (District 5) - workflow_status: `district_pending` (VISIBLE)
- School Y (District 5) - workflow_status: `division_pending` (VISIBLE)
- School Z (District 5) - workflow_status: `region_pending` (VISIBLE)
- School W (District 6) - workflow_status: `district_pending` (NOT VISIBLE - wrong district)

**Result:** Schools X, Y, and Z are displayed

### Example 3: Central Admin Viewing Schools

**Admin:** Central Office
**Forms in database:**
- All schools with any workflow_status

**Result:** All schools with forms are displayed

## Testing Scenarios

### Scenario 1: Form Status Change Visibility
1. School submits form → `workflow_status` = `district_pending`
2. **District admin can see:** ✅ Yes
3. **Division admin can see:** ❌ No (form not at division level yet)
4. **Region admin can see:** ❌ No (form not at region level yet)

### Scenario 2: Form Progress Through Workflow
1. District approves form → `workflow_status` = `division_pending`
2. **District admin can see:** ✅ Yes (division_pending is visible to district)
3. **Division admin can see:** ✅ Yes (now at division level)
4. **Region admin can see:** ❌ No (form not at region level yet)

### Scenario 3: Form Returned to School
1. District returns form → `workflow_status` = `district_returned`
2. **District admin can see:** ✅ Yes (returned forms visible)
3. **Division admin can see:** ❌ No (form returned to lower level)
4. **Region admin can see:** ❌ No (form returned to lower level)

## API Endpoints

### Form Management Endpoints

| Endpoint | Method | Description | Filters Applied |
|----------|--------|-------------|-----------------|
| `/api/form-management/regions/` | GET | Get regions | Form existence, Workflow status, Admin scope |
| `/api/form-management/divisions/` | GET | Get divisions | Form existence, Workflow status, Admin scope |
| `/api/form-management/districts/` | GET | Get districts | Form existence, Workflow status, Admin scope |
| `/api/form-management/schools-table/` | GET | Get schools | Form existence, Workflow status, Admin scope, Pagination |
| `/api/form-management/schools/<id>/forms/` | GET | Get school forms | Admin scope permission check |
| `/api/form-management/admin-scope/` | GET | Get admin scope info | None (info endpoint) |

## Configuration

### Clear Cache Endpoint
- **Endpoint:** `/api/form-management/clear-cache/`
- **Method:** GET
- **Purpose:** Clear all cached hierarchical data
- **Use:** When forms are submitted/approved/returned to refresh tree view

### Admin Scope Cache Keys
```
form_management_regions_admin_{admin_id}
form_management_divisions_region_{region_id}_admin_{admin_id}
form_management_districts_division_{division_id}_admin_{admin_id}
```

## Maintenance Notes

### When Adding New Workflow Statuses
1. Update `FORM_STATUS_CHOICES` in `apps/core/models.py`
2. Update database enum for `workflow_status` column
3. Review filter logic in `api_regions`, `api_divisions`, `api_districts`, `api_schools_table`
4. Update this documentation

### When Modifying Admin Levels
1. Update admin assignment verification in `get_admin_scope()`
2. Review filter conditions for each admin level
3. Test hierarchical filtering across all levels
4. Update this documentation

## Key Files

- **Main Logic:** `apps/form_management/` (modular structure):
  - `utils.py` - Admin scope and workflow helpers
  - `tree_endpoints.py` - Region/Division/District APIs
  - `school_endpoints.py` - School list and forms
  - `form_review.py` - Form detail viewing
  - `remarks.py` - Remark management
  - `exports.py` - CSV exports and cache
- **Models:** `apps/core/models.py` (Form model)
- **Admin Utils:** `apps/admin_management/utils.py` (AdminUserManager)
- **Frontend:** `app/static/form-management/js/optimized_treeview.js`
- **Template:** `app/templates/form_management/form_management.html`

## Summary Table

| Admin Level | Form Existence | Workflow Status Filter | Geographical Filter | Result |
|-------------|----------------|------------------------|---------------------|--------|
| Central | ✅ Required | ✅ All statuses | ❌ None | See all schools with any form |
| Region | ✅ Required | ✅ Region-level only | ✅ Own region | See schools with region-level forms in their region |
| Division | ✅ Required | ✅ Division-level only | ✅ Own division | See schools with division-level forms in their division |
| District | ✅ Required | ✅ District-level only | ✅ Own district | See schools with district-level forms in their district |

**Key Principle:** Admins only see forms that have reached their approval level, ensuring proper workflow progression and preventing premature visibility.
