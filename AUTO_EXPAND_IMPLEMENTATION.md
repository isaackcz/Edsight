# Tree Auto-Expand Implementation Summary

## Overview
Implemented auto-expand functionality for the form-management tree view so that district/division/region admins automatically see their assigned geographic hierarchy expanded on page load.

## Changes Made

### 1. Backend API Endpoint
**File:** `apps/form_management/views.py`

Added `api_admin_scope()` endpoint at line 689:
- Returns admin level and assigned geographic IDs (region_id, division_id, district_id)
- Returns `auto_expand_levels` array indicating which levels should auto-expand
- Returns 403 if admin is not authenticated

**Response Format:**
```json
{
  "success": true,
  "admin_level": "district",
  "region_id": 13,
  "division_id": 25,
  "district_id": 101,
  "auto_expand_levels": ["region", "division", "district"]
}
```

### 2. URL Route
**File:** `apps/core/urls.py`

- Added import: `from apps.form_management.views import api_admin_scope`
- Added route: `path('api/form-management/admin-scope/', api_admin_scope, ...)`

### 3. Frontend Auto-Expand Logic
**File:** `app/static/form-management/js/optimized_treeview.js`

#### Added Properties:
- `this.adminScope` - Stores admin scope information

#### New Functions:

1. **`loadAdminScope()`** (line 145):
   - Fetches admin scope from `/api/form-management/admin-scope/`
   - Stores admin level, IDs, and auto_expand_levels
   - Fails silently if endpoint unavailable (graceful degradation)

2. **`autoExpandTreePath()`** (line 198):
   - Sequentially expands tree based on admin level
   - For district admin: expands region → division → district → loads schools
   - For division admin: expands region → division
   - For region admin: expands region only
   - Uses `await` to ensure sequential loading (prevents system overload)

#### Updated `init()` Function:
- Now calls `loadAdminScope()` before loading regions
- Calls `autoExpandTreePath()` after initial tree render if auto-expand is needed

## Behavior by Admin Level

### District Admin (e.g., Manila District I)
1. Loads admin scope → gets region_id=13, division_id=25, district_id=101
2. Loads regions → sees only NCR Region
3. Auto-expands region → loads divisions → sees only Manila Division
4. Auto-expands division → loads districts → sees only Manila District I
5. Auto-expands district → loads schools → shows paginated school list

### Division Admin
1. Loads admin scope → gets region_id, division_id
2. Loads regions → sees only their region
3. Auto-expands region → loads divisions → sees only their division
4. User can manually click division to see districts

### Region Admin
1. Loads admin scope → gets region_id
2. Loads regions → sees only their region
3. Auto-expands region → shows divisions list
4. User can manually click divisions to see districts

### Central Admin
1. Loads admin scope → no auto_expand_levels
2. Loads regions → sees all regions
3. No auto-expand → user manually expands as needed

## Performance Optimizations

1. **Sequential Loading**: Uses `await` to ensure one API call completes before starting the next
2. **Lazy Loading**: Only loads children when parent is expanded
3. **Loading States**: Shows loading indicators during expansion
4. **Error Handling**: Graceful degradation if admin scope endpoint fails

## Testing Checklist

- [ ] District admin: Tree auto-expands to show region → division → district → schools
- [ ] Division admin: Tree auto-expands to show region → division
- [ ] Region admin: Tree auto-expands to show region with divisions
- [ ] Central admin: Tree does not auto-expand, shows all regions
- [ ] Verify no simultaneous API calls (sequential loading works)
- [ ] Verify loading states appear during auto-expand
- [ ] Test with slow network connection to ensure no race conditions

## Files Modified

1. `apps/form_management/views.py` - Added `api_admin_scope()` endpoint
2. `apps/core/urls.py` - Added route for admin-scope endpoint
3. `app/static/form-management/js/optimized_treeview.js` - Added auto-expand logic

## Notes

- Auto-expand is a convenience feature - if it fails, the tree still works normally
- Sequential loading prevents database overload with 90k+ users
- Admin scope is cached per admin session (handled by backend)
- All geographic filtering remains enforced at backend level

