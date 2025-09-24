-- ============================================
-- EDSIGHT ADMIN USER SYSTEM DATABASE UPDATES
-- ============================================
-- This script creates and modifies tables to support the comprehensive admin user system
-- Following the requirements for Central Office, Region, Division, District, and School roles

-- Drop existing admin_user table if it exists (to recreate with proper structure)
DROP TABLE IF EXISTS `admin_user`;

-- Create the main admin_user table with comprehensive role-based access
CREATE TABLE `admin_user` (
  `admin_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `admin_level` enum('central','region','division','district','school') NOT NULL,
  `assigned_area` varchar(150) DEFAULT NULL,
  `status` enum('active','inactive','suspended') DEFAULT 'active',
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `profile_image` varchar(255) DEFAULT NULL,
  
  -- Geographic coverage fields (NULL means no restriction at that level)
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `school_id` int(11) DEFAULT NULL,
  
  -- User management permissions
  `can_create_users` tinyint(1) DEFAULT 0,
  `can_manage_users` tinyint(1) DEFAULT 0,
  `can_set_deadlines` tinyint(1) DEFAULT 0,
  `can_approve_submissions` tinyint(1) DEFAULT 0,
  `can_view_system_logs` tinyint(1) DEFAULT 0,
  
  -- Audit fields
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_admin_level` (`admin_level`),
  KEY `idx_status` (`status`),
  KEY `idx_region` (`region_id`),
  KEY `idx_division` (`division_id`),
  KEY `idx_district` (`district_id`),
  KEY `idx_school` (`school_id`),
  KEY `idx_created_by` (`created_by`),
  
  -- Foreign key constraints for geographic coverage
  CONSTRAINT `admin_user_region_fk` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `admin_user_division_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `admin_user_district_fk` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `admin_user_school_fk` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL,
  CONSTRAINT `admin_user_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_user` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create admin_user_permissions table for fine-grained permission control
CREATE TABLE `admin_user_permissions` (
  `permission_id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `permission_name` varchar(100) NOT NULL,
  `resource_type` enum('user','form','report','system','school_data') NOT NULL,
  `action` enum('create','read','update','delete','approve','manage') NOT NULL,
  `scope` enum('own','assigned_area','all') DEFAULT 'assigned_area',
  `granted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `granted_by` int(11) DEFAULT NULL,
  
  PRIMARY KEY (`permission_id`),
  UNIQUE KEY `unique_admin_permission` (`admin_id`, `permission_name`, `resource_type`, `action`),
  KEY `idx_admin_permissions` (`admin_id`),
  KEY `idx_resource_type` (`resource_type`),
  KEY `idx_granted_by` (`granted_by`),
  
  CONSTRAINT `admin_permissions_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE,
  CONSTRAINT `admin_permissions_granted_by_fk` FOREIGN KEY (`granted_by`) REFERENCES `admin_user` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create admin_activity_log table for comprehensive audit trail
CREATE TABLE `admin_activity_log` (
  `log_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(50) DEFAULT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  
  PRIMARY KEY (`log_id`),
  KEY `idx_admin_activity` (`admin_id`),
  KEY `idx_action` (`action`),
  KEY `idx_resource_type` (`resource_type`),
  KEY `idx_timestamp` (`timestamp`),
  
  CONSTRAINT `admin_activity_log_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create admin_sessions table for session management
CREATE TABLE `admin_sessions` (
  `session_id` varchar(128) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expires_at` timestamp NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  
  PRIMARY KEY (`session_id`),
  KEY `idx_admin_sessions` (`admin_id`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_is_active` (`is_active`),
  
  CONSTRAINT `admin_sessions_admin_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create form_deadlines table for deadline management
CREATE TABLE `form_deadlines` (
  `deadline_id` int(11) NOT NULL AUTO_INCREMENT,
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `form_type` varchar(100) NOT NULL,
  `deadline_date` datetime NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  
  PRIMARY KEY (`deadline_id`),
  KEY `idx_region_deadline` (`region_id`),
  KEY `idx_division_deadline` (`division_id`),
  KEY `idx_district_deadline` (`district_id`),
  KEY `idx_form_type` (`form_type`),
  KEY `idx_deadline_date` (`deadline_date`),
  KEY `idx_created_by` (`created_by`),
  
  CONSTRAINT `form_deadlines_region_fk` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `form_deadlines_division_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `form_deadlines_district_fk` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `form_deadlines_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_user` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create form_approvals table for tracking approval workflow
CREATE TABLE `form_approvals` (
  `approval_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL,
  `approver_id` int(11) NOT NULL,
  `approval_level` enum('district','division','region','central') NOT NULL,
  `status` enum('pending','approved','rejected','returned') DEFAULT 'pending',
  `comments` text DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  
  PRIMARY KEY (`approval_id`),
  KEY `idx_form_approvals` (`form_id`),
  KEY `idx_approver` (`approver_id`),
  KEY `idx_approval_level` (`approval_level`),
  KEY `idx_status` (`status`),
  
  CONSTRAINT `form_approvals_form_fk` FOREIGN KEY (`form_id`) REFERENCES `forms` (`form_id`) ON DELETE CASCADE,
  CONSTRAINT `form_approvals_approver_fk` FOREIGN KEY (`approver_id`) REFERENCES `admin_user` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Modify the existing users_school table to add creator tracking
ALTER TABLE `users_school` 
ADD COLUMN `created_by` int(11) DEFAULT NULL,
ADD COLUMN `approved_by` int(11) DEFAULT NULL,
ADD COLUMN `approval_status` enum('pending','approved','rejected') DEFAULT 'approved',
ADD KEY `idx_created_by` (`created_by`),
ADD KEY `idx_approved_by` (`approved_by`),
ADD CONSTRAINT `users_school_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_user` (`admin_id`) ON DELETE SET NULL,
ADD CONSTRAINT `users_school_approved_by_fk` FOREIGN KEY (`approved_by`) REFERENCES `admin_user` (`admin_id`) ON DELETE SET NULL;

-- Insert default Central Office admin (super admin)
-- Password: EdSight2024! (hashed with bcrypt)
INSERT INTO `admin_user` (
  `username`, 
  `email`, 
  `password_hash`, 
  `full_name`, 
  `admin_level`, 
  `assigned_area`, 
  `status`,
  `can_create_users`,
  `can_manage_users`,
  `can_set_deadlines`,
  `can_approve_submissions`,
  `can_view_system_logs`
) VALUES (
  'central_admin',
  'central.admin@deped.gov.ph',
  '$2b$12$sexiIjxPJ/CBfdLRFmcBPuMrRuiQ0UziGKy1EAnhVHdxO1qC5aguW',
  'Central Office Administrator',
  'central',
  'Philippines',
  'active',
  1, 1, 1, 1, 1
);

-- Create default permissions for Central Office
INSERT INTO `admin_user_permissions` (`admin_id`, `permission_name`, `resource_type`, `action`, `scope`)
SELECT 
  admin_id,
  'full_system_access',
  resource_type,
  action,
  'all'
FROM `admin_user`,
  (SELECT 'user' as resource_type, 'create' as action UNION ALL
   SELECT 'user' as resource_type, 'read' as action UNION ALL
   SELECT 'user' as resource_type, 'update' as action UNION ALL
   SELECT 'user' as resource_type, 'delete' as action UNION ALL
   SELECT 'user' as resource_type, 'manage' as action UNION ALL
   SELECT 'form' as resource_type, 'read' as action UNION ALL
   SELECT 'form' as resource_type, 'approve' as action UNION ALL
   SELECT 'report' as resource_type, 'read' as action UNION ALL
   SELECT 'system' as resource_type, 'manage' as action UNION ALL
   SELECT 'school_data' as resource_type, 'read' as action) as perms
WHERE admin_level = 'central';

-- Create indexes for optimal performance with 90k users
CREATE INDEX `idx_admin_user_composite` ON `admin_user` (`admin_level`, `status`, `region_id`, `division_id`);
CREATE INDEX `idx_admin_activity_composite` ON `admin_activity_log` (`admin_id`, `timestamp`, `action`);
CREATE INDEX `idx_form_approvals_composite` ON `form_approvals` (`form_id`, `approval_level`, `status`);
CREATE INDEX `idx_users_school_coverage` ON `users_school` (`region_id`, `division_id`, `district_id`, `school_id`);

-- Create view for admin user access control
CREATE VIEW `v_admin_user_access` AS
SELECT 
  au.admin_id,
  au.username,
  au.email,
  au.admin_level,
  au.status,
  r.name as region_name,
  d.name as division_name,
  dt.name as district_name,
  s.school_name,
  au.can_create_users,
  au.can_manage_users,
  au.can_set_deadlines,
  au.can_approve_submissions,
  au.can_view_system_logs
FROM admin_user au
LEFT JOIN regions r ON au.region_id = r.id
LEFT JOIN divisions d ON au.division_id = d.id
LEFT JOIN districts dt ON au.district_id = dt.id
LEFT JOIN schools s ON au.school_id = s.id
WHERE au.status = 'active';

-- Create stored procedure for role-based user creation validation
DELIMITER //
CREATE PROCEDURE ValidateUserCreation(
  IN p_creator_admin_id INT,
  IN p_target_role VARCHAR(20),
  IN p_target_region_id INT,
  IN p_target_division_id INT,
  IN p_target_district_id INT,
  OUT p_can_create BOOLEAN,
  OUT p_message VARCHAR(255)
)
BEGIN
  DECLARE v_creator_level VARCHAR(20);
  DECLARE v_creator_region_id INT;
  DECLARE v_creator_division_id INT;
  DECLARE v_creator_district_id INT;
  
  -- Get creator's details
  SELECT admin_level, region_id, division_id, district_id
  INTO v_creator_level, v_creator_region_id, v_creator_division_id, v_creator_district_id
  FROM admin_user
  WHERE admin_id = p_creator_admin_id AND status = 'active';
  
  SET p_can_create = FALSE;
  SET p_message = 'Access denied';
  
  -- Central Office can create anyone
  IF v_creator_level = 'central' THEN
    SET p_can_create = TRUE;
    SET p_message = 'Central Office has full access';
    
  -- Division can create District and School within their division
  ELSEIF v_creator_level = 'division' AND p_target_role IN ('district', 'school') THEN
    IF p_target_division_id = v_creator_division_id THEN
      SET p_can_create = TRUE;
      SET p_message = 'Division can create within assigned area';
    ELSE
      SET p_message = 'Division can only create within assigned division';
    END IF;
    
  -- Division can also create Region accounts if instructed by Central Office
  ELSEIF v_creator_level = 'division' AND p_target_role = 'region' THEN
    SET p_can_create = TRUE;
    SET p_message = 'Division can create Region accounts';
    
  -- Other levels cannot create users
  ELSE
    SET p_message = CONCAT(v_creator_level, ' level cannot create ', p_target_role, ' accounts');
  END IF;
  
END //
DELIMITER ;

-- Create function to get user's access scope
DELIMITER //
CREATE FUNCTION GetUserAccessScope(p_admin_id INT) 
RETURNS JSON
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE v_result JSON;
  DECLARE v_admin_level VARCHAR(20);
  DECLARE v_region_id, v_division_id, v_district_id, v_school_id INT;
  
  SELECT admin_level, region_id, division_id, district_id, school_id
  INTO v_admin_level, v_region_id, v_division_id, v_district_id, v_school_id
  FROM admin_user
  WHERE admin_id = p_admin_id AND status = 'active';
  
  SET v_result = JSON_OBJECT(
    'admin_level', v_admin_level,
    'region_id', v_region_id,
    'division_id', v_division_id,
    'district_id', v_district_id,
    'school_id', v_school_id,
    'scope', CASE 
      WHEN v_admin_level = 'central' THEN 'nationwide'
      WHEN v_admin_level = 'region' THEN 'regional'
      WHEN v_admin_level = 'division' THEN 'divisional'
      WHEN v_admin_level = 'district' THEN 'district'
      WHEN v_admin_level = 'school' THEN 'school'
      ELSE 'none'
    END
  );
  
  RETURN v_result;
END //
DELIMITER ;

-- Add email validation constraints
ALTER TABLE `admin_user` 
ADD CONSTRAINT `chk_email_format` CHECK (
  CASE 
    WHEN admin_level = 'school' THEN email REGEXP '^[A-Za-z0-9]+@deped\\.gov\\.ph$'
    ELSE email REGEXP '^[A-Za-z]+\\.[A-Za-z]+@deped\\.gov\\.ph$'
  END
);

-- Create trigger to log admin user changes
DELIMITER //
CREATE TRIGGER tr_admin_user_audit 
AFTER INSERT ON admin_user
FOR EACH ROW
BEGIN
  INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
  VALUES (NEW.admin_id, 'CREATE_ADMIN_USER', 'admin_user', NEW.admin_id, 
          JSON_OBJECT('username', NEW.username, 'admin_level', NEW.admin_level));
END //
DELIMITER ;

DELIMITER //
CREATE TRIGGER tr_admin_user_update_audit 
AFTER UPDATE ON admin_user
FOR EACH ROW
BEGIN
  INSERT INTO admin_activity_log (admin_id, action, resource_type, resource_id, details)
  VALUES (NEW.admin_id, 'UPDATE_ADMIN_USER', 'admin_user', NEW.admin_id,
          JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status,
                     'old_level', OLD.admin_level, 'new_level', NEW.admin_level));
END //
DELIMITER ;

-- Performance optimization: Partition admin_activity_log by month for large scale
-- This helps with the 90k user requirement
ALTER TABLE admin_activity_log 
PARTITION BY RANGE (UNIX_TIMESTAMP(timestamp)) (
    PARTITION p202501 VALUES LESS THAN (UNIX_TIMESTAMP('2025-02-01')),
    PARTITION p202502 VALUES LESS THAN (UNIX_TIMESTAMP('2025-03-01')),
    PARTITION p202503 VALUES LESS THAN (UNIX_TIMESTAMP('2025-04-01')),
    PARTITION p202504 VALUES LESS THAN (UNIX_TIMESTAMP('2025-05-01')),
    PARTITION p202505 VALUES LESS THAN (UNIX_TIMESTAMP('2025-06-01')),
    PARTITION p202506 VALUES LESS THAN (UNIX_TIMESTAMP('2025-07-01')),
    PARTITION p202507 VALUES LESS THAN (UNIX_TIMESTAMP('2025-08-01')),
    PARTITION p202508 VALUES LESS THAN (UNIX_TIMESTAMP('2025-09-01')),
    PARTITION p202509 VALUES LESS THAN (UNIX_TIMESTAMP('2025-10-01')),
    PARTITION p202510 VALUES LESS THAN (UNIX_TIMESTAMP('2025-11-01')),
    PARTITION p202511 VALUES LESS THAN (UNIX_TIMESTAMP('2025-12-01')),
    PARTITION p202512 VALUES LESS THAN (UNIX_TIMESTAMP('2026-01-01')),
    PARTITION pfuture VALUES LESS THAN MAXVALUE
);

-- ============================================
-- SUMMARY OF CHANGES
-- ============================================
-- 1. Created comprehensive admin_user table with role hierarchy
-- 2. Added admin_user_permissions for fine-grained access control
-- 3. Created admin_activity_log for complete audit trail
-- 4. Added admin_sessions for session management
-- 5. Created form_deadlines for deadline management by Region level
-- 6. Added form_approvals for approval workflow tracking
-- 7. Modified users_school to track creator and approval status
-- 8. Added performance indexes for 90k user scalability
-- 9. Created views and stored procedures for access control validation
-- 10. Added email validation constraints per role requirements
-- 11. Created audit triggers for all admin user changes
-- 12. Added table partitioning for performance optimization
-- ============================================
