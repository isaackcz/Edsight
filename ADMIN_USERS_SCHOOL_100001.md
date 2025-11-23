# Admin Users for School 100001 (Apaleng-Libtong ES)

Created admin users for managing forms from School 100001 (Apaleng-Libtong ES) in Region I, Division Ilocos Norte, District Bacarra I.

## Created Admin Users

### 1. District Admin - Bacarra I
- **Username:** `district_bacarra1`
- **Password:** `EdSight.123`
- **Email:** `district.bacarra1@deped.gov.ph`
- **Full Name:** District Bacarra I Admin
- **Admin Level:** District
- **Assigned Area:** Bacarra I
- **Coverage:**
  - Region ID: 1 (Region I)
  - Division ID: 1 (Ilocos Norte)
  - District ID: 1 (Bacarra I)

### 2. Division Admin - Ilocos Norte
- **Username:** `division_ilocos_norte`
- **Password:** `EdSight.123`
- **Email:** `division.ilocosnorte@deped.gov.ph`
- **Full Name:** Division Ilocos Norte Admin
- **Admin Level:** Division
- **Assigned Area:** Ilocos Norte
- **Coverage:**
  - Region ID: 1 (Region I)
  - Division ID: 1 (Ilocos Norte)

### 3. Region Admin - Region I
- **Username:** `region1_admin`
- **Password:** `EdSight.123`
- **Email:** `region.region1@deped.gov.ph`
- **Full Name:** Region I Admin
- **Admin Level:** Region
- **Assigned Area:** Region I
- **Coverage:**
  - Region ID: 1 (Region I)

### 4. School Admin - Apaleng-Libtong ES
- **Username:** `school100001_admin`
- **Password:** `EdSight.123`
- **Email:** `100001@deped.gov.ph`
- **Full Name:** Apaleng-Libtong ES Administrator
- **Admin Level:** School
- **Assigned Area:** School: Apaleng-Libtong ES
- **Coverage:**
  - School ID: 1 (100001)
  - Region ID: 1 (Region I)
  - Division ID: 1 (Ilocos Norte)
  - District ID: 1 (Bacarra I)

## School Information

- **School ID:** 100001
- **School Name:** Apaleng-Libtong ES
- **Region:** Region I
- **Division:** Ilocos Norte
- **District:** Bacarra I

## Access Verification

All four admin users have been verified to have proper access to School 100001:
- ✅ School Admin can access school 100001
- ✅ District Admin can access school 100001
- ✅ Division Admin can access school 100001
- ✅ Region Admin can access school 100001

## Form Management Visibility

Based on the implemented filters, here's what each admin will see:

### School Admin (school100001_admin)
**Note:** School admins typically don't use the form management page for viewing submitted forms. They use `/user/dashboard/` to submit forms. However, if they access `/form-management/`, they would see:
- No schools displayed (school level admin not configured for form management tree view)
- School admins are primarily for form submission, not review

If school admins need to access form management, they would need appropriate permissions configured.

### District Admin (district_bacarra1)
**Will see School 100001 when:**
- School 100001 has forms in the `forms` table
- Form `workflow_status` is: `district_pending`, `district_approved`, `district_returned`, or `division_pending`

**Will NOT see School 100001 when:**
- Form `workflow_status` is: `region_pending`, `region_approved`, `region_returned`, `central_pending`, `central_approved`, `central_returned`, or `completed`

### Division Admin (division_ilocos_norte)
**Will see School 100001 when:**
- School 100001 has forms in the `forms` table
- Form `workflow_status` is: `division_pending`, `division_approved`, `division_returned`, or `region_pending`

**Will NOT see School 100001 when:**
- Form `workflow_status` is: `district_pending`, `district_approved`, or `district_returned`

### Region Admin (region1_admin)
**Will see School 100001 when:**
- School 100001 has forms in the `forms` table
- Form `workflow_status` is: `region_pending`, `region_approved`, `region_returned`, or `central_pending`

**Will NOT see School 100001 when:**
- Form `workflow_status` is: `district_pending`, `district_approved`, `district_returned`, `division_pending`, `division_approved`, or `division_returned`

## Workflow Example

1. **School submits form** → `workflow_status` = `district_pending`
   - District Admin: ✅ Can see
   - Division Admin: ❌ Cannot see
   - Region Admin: ❌ Cannot see

2. **District approves form** → `workflow_status` = `division_pending`
   - District Admin: ✅ Can see (still visible to district level)
   - Division Admin: ✅ Can see (form reached division level)
   - Region Admin: ❌ Cannot see

3. **Division approves form** → `workflow_status` = `region_pending`
   - District Admin: ✅ Can see (still visible to district level)
   - Division Admin: ✅ Can see (still visible to division level)
   - Region Admin: ✅ Can see (form reached region level)

4. **Region approves form** → `workflow_status` = `central_pending`
   - District Admin: ✅ Can see (still visible to district level)
   - Division Admin: ✅ Can see (still visible to division level)
   - Region Admin: ✅ Can see (still visible to region level)

## Login Instructions

1. Navigate to: `http://localhost:8000/auth/login/`
2. Enter credentials from above
3. Access form management at: `http://localhost:8000/form-management/`

## Security Notes

- All passwords are: `EdSight.123`
- All users are set to `active` status
- All users follow proper email format conventions
- Geographic assignments are correctly configured for hierarchical filtering

## Related Documentation

- See `FORM_MANAGEMENT_FILTERS_README.md` for complete filtering logic
- Form workflow statuses are documented in `extra/FORM_MANAGEMENT_GUIDE.md`
