# Admin Capabilities in Form Management

## Reference Modules
- `apps/form_management/` (modular structure):
  - `utils.py` - Shared helpers for admin scope and workflow status
  - `pages.py` - Page view renderers
  - `tree_endpoints.py` - Region/Division/District hierarchy APIs
  - `school_endpoints.py` - School list and form queries
  - `form_review.py` - Form detail viewing with lazy-loaded categories/topics/questions
  - `remarks.py` - Remark management (create, retrieve, update, delete)
  - `exports.py` - CSV exports and cache management
- `apps/admin_management/utils.py`
- `apps/core/models.py` (for form and remark models)
- Workflow status enum: `WORKFLOW_STATUS_CHOICES` in `apps/core/models.py`

## Access Prerequisites
- Session must include a valid `admin_id`; `get_admin_scope()` pulls role, geographic scope, and permission flags.
- All endpoints verify scope using region/division/district IDs before returning data or performing mutations.

## Navigation & Visibility
- **Region Tree**: `api_regions` returns regions with submitted forms. Central users see all; others see their assigned region only. Tree nodes should exclude schools whose forms have already been approved or returned at the current admin level, ensuring district/division/region reviewers only see items still pending their action.
- **Division/District Nodes**: `api_divisions` and `api_districts` cascade the tree, trimming results to the admin’s geographic bounds.
- **Auto Expand**: `api_admin_scope` tells the UI which hierarchy levels to auto-open based on admin level (e.g., district admins auto-expand region → division → district).

### Workflow Status Filters by Admin Level
Derived from `get_pending_workflow_statuses()` in `apps/form_management/views.py` and the `WORKFLOW_STATUS_CHOICES` enum in `apps/core/models.py`:

| Admin Level | Visible Workflow Statuses |
|-------------|---------------------------|
| Central | `central_pending` |
| Region | `region_pending`, `central_returned` |
| Division | `division_pending`, `region_returned` |
| District | `district_pending`, `division_returned` |
| School | N/A (school users rely on submission UI; admin tree hides forms already handled) |

Forms move to the next level or return downstream once actioned, so they drop off that admin level’s tree automatically.

## School & Form Listings
- **School Table (`api_schools_table`)**
  - Shows schools that have submitted forms, with total/submitted/pending counts.
  - Filters (`region_id`, `division_id`, `district_id`, search) are accepted only if they remain inside the admin’s scope.
  - Pagination metadata returned for UI controls.
- **School Forms (`api_school_forms`)**
  - Lists forms per school with workflow status, level, submission time, and school metadata.
  - Access denied if the school lies outside the admin’s allowed geography.

## Form Review Operations
- **Basic Overview (`api_form_basic`)**
  - Displays form status, workflow stage, submitting admin, and school profile.
- **Content Drilldown**
  - `api_form_categories`, `api_form_topics`, and `api_form_questions` allow lazy loading of categories → topics → questions with completion metrics.
  - Answer data is returned alongside questions for quick evaluation.
- **Remarks Management**
  - `api_form_remarks` groups remarks by entity type (category/topic/question).
  - `api_create_remark` and `api_upsert_remark` let admins add or edit structured feedback linked to specific entities.
  - `api_clear_remarks` wipes remarks for a form, defaulting to the current admin level when approval actions trigger it (admins can still request a full wipe via explicit scope).
  - Any reviewing admin level (central, region, division, district) can add remarks while returning a form, provided the school/form sits within their geographic scope.

## Export & Auditing
- **CSV Export (`api_export_schools`)**
  - Generates scoped school/form statistics. If provided IDs fall outside the admin’s coverage, the request is rejected.
- **Cache Maintenance (`api_clear_cache`)**
  - Manual cache reset endpoint for region/division tree data; used sparingly during data corrections.

## Role-Based Behaviors
- **Central**: Full visibility and exports across all regions; unrestricted form review.
- **Region**: Restricted to assigned region; can drill into all nested divisions/districts/schools and manage remarks within that geography.
- **Division**: Limited to assigned division; can view/approve forms for any district or school inside it.
- **District**: Sees only their district’s schools; can review submitted forms and manage remarks locally.
- **School**: Form management endpoints are generally read-only or inaccessible; school users rely on submission interfaces rather than admin APIs.

## Execution Flow Summary
1. UI requests admin scope → determines tree auto-expansion and permitted filters.
2. Hierarchical endpoints fetch region/division/district lists filtered by scope.
3. Admin selects a school → `api_schools_table` produces scoped results with form counts.
4. Admin drills into a school → `api_school_forms` lists submissions; selecting a form opens review endpoints.
5. During review, categories/topics/questions load on demand, and remarks can be created, updated, or cleared.
6. Optional: Export selected schools within scope or clear caches after large data updates.

## Security Guarantees
- Every endpoint rejects out-of-scope requests with `403` status.
- Pagination queries use parameterized SQL to avoid injection.
- Remarks, exports, and cache actions require authenticated admin sessions and reuse centralized permission checks from the admin utilities.
