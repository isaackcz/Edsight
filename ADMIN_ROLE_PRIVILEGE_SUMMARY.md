# EdSight Admin Roles, Assignments, and Privileges

## Source Overview
- Primary data model: `AdminUser` in `apps/core/models.py`
- Utility layer: `AdminUserManager`, `PermissionChecker`, and `DeadlineManager` in `apps/admin_management/utils.py`
- Fine-grained permissions: `AdminUserPermission` in `apps/core/models.py`
- Audit trail and session controls: `AdminActivityLog`, `AdminSession`, and `AuditLog` in `apps/core/models.py`

## Role Hierarchy and Geographic Assignment
- **Central Office**
  - Coverage: Nationwide, no geographic restrictions.
  - Assignment fields remain `null` because access is global.
- **Region**
  - Coverage: Single region (`region_id` required).
  - Implicit access to every division, district, and school within that region.
- **Division**
  - Coverage: Single division (`division_id` required and tied to a parent region).
  - Gains access to districts and schools under the assigned division.
- **District**
  - Coverage: Single district (`district_id` required and tied to parent division/region).
  - Access limited to schools within the district.
- **School**
  - Coverage: Single school (`school_id` required and tied to parent district/division/region).
  - Access limited to the school’s own records.

`AdminUserManager.get_user_access_scope()` consolidates these assignments into the session context, while `AdminUser.can_access_area()` enforces geographic checks during runtime access decisions.

## Default Permission Flags by Role
Derived from `AdminUserManager._get_default_permissions`:

| Role | can_create_users | can_manage_users | can_set_deadlines | can_approve_submissions | can_view_system_logs |
|------|------------------|------------------|-------------------|-------------------------|----------------------|
| Central | ✅ | ✅ | ✅ | ✅ | ✅ |
| Region | ❌ | ❌ | ✅ | ✅ | ✅ |
| Division | ✅ | ✅ | ❌ | ✅ | ❌ |
| District | ❌ | ❌ | ❌ | ✅ | ❌ |
| School | ❌ | ❌ | ❌ | ❌ | ❌ |

These boolean flags live on the `AdminUser` model and are also surfaced through the access scope payload to drive UI rendering and backend permission gates.

## Operational Privileges and Validation Flow
- **User Provisioning**
  - `AdminUserManager.validate_user_creation_permission()` controls who can create which roles and ensures new accounts stay within the creator’s geographic bounds.
  - Only Central and Division admins can create accounts (Division limited to district/school, optionally region when instructed).
- **Deadline Management**
  - `DeadlineManager.can_set_deadline()` restricts deadline creation to Region admins targeting their assigned region.
- **Form Approval**
  - Approval capability follows the `can_approve_submissions` flag and is further scoped through `AdminUser.can_access_area()` to keep reviews within assigned geography.
- **System Visibility**
  - Access to sensitive dashboards and logs requires `can_view_system_logs`. `PermissionChecker.check_resource_access()` unifies flag checks with geographic validation before serving data.

## Fine-Grained Permissions Layer
- `AdminUserPermission` records extend the flag system with resource/action/scope triplets (e.g., `resource_type="user"`, `action="manage"`, `scope="assigned_area"`).
- Aggregated counts per level feed the admin role dashboard (`apps/admin_management/views.py`), enabling audits of actual permission grants versus defaults.

## Audit and Compliance Controls
- `AuditLog` and `AdminActivityLog` capture every privileged action (creation, deadline setting, permission changes) with IP/user-agent metadata.
- `AdminSession` enforces active-session tracking, supporting session invalidation and anomaly detection.
- Decorators `require_admin_permission` and `log_admin_activity` wrap sensitive views to enforce checks and guarantee logging consistency.

## Key Takeaways
- Roles cascade from Central to School, with geography shrinking at each level. Assignment fields on `AdminUser` are mandatory for Region/District/Division/School roles to enable scope enforcement.
- Default permission flags provide quick checks, while `AdminUserPermission` enables granular overrides without code changes.
- Access control is a two-step process: verify capability flag, then confirm geographic scope.
- All privileged operations generate structured audit entries, supporting compliance and security monitoring.
