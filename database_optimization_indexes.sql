-- Database Optimization Indexes for Admin Access Control
-- This file adds composite indexes to improve query performance for the form-management system
-- These indexes optimize geographic hierarchy filtering and prevent performance issues at scale (90k+ users)

-- Use the edsight database
USE edsight;

-- 1. Composite index for schools geographic hierarchy
-- This index optimizes queries that filter schools by region, division, and district
-- Used by: api_schools_table, api_export_schools
CREATE INDEX IF NOT EXISTS idx_schools_region_division_district 
ON schools(region_id, division_id, district_id);

-- 2. Composite index for admin user geographic lookups with level
-- This index optimizes admin scope queries that need to find admins by geographic area and level
-- Used by: AdminUserManager.get_user_access_scope and related functions
CREATE INDEX IF NOT EXISTS idx_admin_user_region_division_district 
ON admin_user(region_id, division_id, district_id, admin_level);

-- 3. Composite index for form counting queries
-- This index optimizes queries that count forms by school and creation date
-- Used by: api_schools_table for form statistics
CREATE INDEX IF NOT EXISTS idx_forms_school_created 
ON forms(school_id, created_at);

-- Verify indexes were created
SHOW INDEX FROM schools WHERE Key_name LIKE 'idx_schools_region_division_district';
SHOW INDEX FROM admin_user WHERE Key_name LIKE 'idx_admin_user_region_division_district';
SHOW INDEX FROM forms WHERE Key_name LIKE 'idx_forms_school_created';

-- Performance Analysis Query
-- Run this to check if indexes are being used properly:
-- EXPLAIN SELECT s.id, s.school_name, COUNT(f.form_id) 
-- FROM schools s 
-- INNER JOIN forms f ON f.school_id = s.id 
-- WHERE s.district_id = 1 
-- GROUP BY s.id, s.school_name;

-- Notes:
-- - These indexes will improve query performance especially for:
--   * Hierarchical geographic filtering (region -> division -> district -> school)
--   * Form counting and aggregation queries
--   * Admin access scope verification
-- - Indexes are created with IF NOT EXISTS to prevent errors if they already exist
-- - Regular index maintenance (OPTIMIZE TABLE) should be performed periodically
-- - Monitor slow query log to identify additional optimization opportunities

