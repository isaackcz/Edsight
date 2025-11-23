-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 23, 2025 at 11:58 AM
-- Server version: 11.8.3-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `edsight`
--

-- --------------------------------------------------------

--
-- Table structure for table `account_lockouts`
--

CREATE TABLE `account_lockouts` (
  `id` bigint(20) NOT NULL,
  `reason` varchar(100) NOT NULL,
  `locked_at` datetime(6) NOT NULL,
  `unlock_at` datetime(6) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `unlock_token` varchar(100) DEFAULT NULL,
  `locked_by_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_activity_log`
--

CREATE TABLE `admin_activity_log` (
  `log_id` bigint(20) NOT NULL,
  `action` varchar(100) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(50) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` char(39) DEFAULT NULL,
  `user_agent` longtext DEFAULT NULL,
  `timestamp` datetime(6) NOT NULL,
  `admin_user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_sessions`
--

CREATE TABLE `admin_sessions` (
  `session_id` varchar(128) NOT NULL,
  `ip_address` char(39) DEFAULT NULL,
  `user_agent` longtext DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `last_activity` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `admin_user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_user`
--

CREATE TABLE `admin_user` (
  `admin_id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `admin_level` varchar(10) NOT NULL,
  `assigned_area` varchar(150) DEFAULT NULL,
  `status` varchar(10) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `school_id` int(11) DEFAULT NULL,
  `can_create_users` tinyint(1) NOT NULL,
  `can_manage_users` tinyint(1) NOT NULL,
  `can_set_deadlines` tinyint(1) NOT NULL,
  `can_approve_submissions` tinyint(1) NOT NULL,
  `can_view_system_logs` tinyint(1) NOT NULL,
  `created_by_id` int(11) DEFAULT NULL,
  `updated_by_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_user_permissions`
--

CREATE TABLE `admin_user_permissions` (
  `permission_id` int(11) NOT NULL,
  `permission_name` varchar(100) NOT NULL,
  `resource_type` varchar(20) NOT NULL,
  `action` varchar(10) NOT NULL,
  `scope` varchar(15) NOT NULL,
  `granted_at` datetime(6) NOT NULL,
  `admin_user_id` int(11) NOT NULL,
  `granted_by_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `answers`
--

CREATE TABLE `answers` (
  `answer_id` bigint(20) NOT NULL,
  `form_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `response` text DEFAULT NULL,
  `answered_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `session_id` varchar(100) DEFAULT NULL,
  `action_type` varchar(20) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(50) DEFAULT NULL,
  `description` longtext NOT NULL,
  `ip_address` char(39) DEFAULT NULL,
  `user_agent` longtext DEFAULT NULL,
  `severity` varchar(10) NOT NULL,
  `success` tinyint(1) NOT NULL,
  `error_message` longtext DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `encrypted_data` longtext DEFAULT NULL,
  `timestamp` datetime(6) NOT NULL,
  `admin_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_trail`
--

CREATE TABLE `audit_trail` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(10) NOT NULL,
  `question_id` int(11) NOT NULL,
  `old_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `timestamp` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_group`
--

CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_group_permissions`
--

CREATE TABLE `auth_group_permissions` (
  `id` bigint(20) NOT NULL,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_permission`
--

CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_user`
--

CREATE TABLE `auth_user` (
  `id` int(11) NOT NULL,
  `password` varchar(128) NOT NULL,
  `last_login` datetime(6) DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(150) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_user_groups`
--

CREATE TABLE `auth_user_groups` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_user_user_permissions`
--

CREATE TABLE `auth_user_user_permissions` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_order` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `compliance_reports`
--

CREATE TABLE `compliance_reports` (
  `id` int(11) NOT NULL,
  `report_type` varchar(20) NOT NULL,
  `title` varchar(200) NOT NULL,
  `date_from` datetime(6) NOT NULL,
  `date_to` datetime(6) NOT NULL,
  `report_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`report_data`)),
  `file_path` varchar(500) DEFAULT NULL,
  `generated_at` datetime(6) NOT NULL,
  `is_encrypted` tinyint(1) NOT NULL,
  `generated_by_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `daily_analytics`
-- (See below for the actual view)
--
CREATE TABLE `daily_analytics` (
`date` date
,`forms_started` bigint(21)
,`forms_completed` bigint(21)
,`schools_active` bigint(21)
,`avg_completion_hours` decimal(24,4)
);

-- --------------------------------------------------------

--
-- Table structure for table `data_processing_consent`
--

CREATE TABLE `data_processing_consent` (
  `id` bigint(20) NOT NULL,
  `consent_type` varchar(20) NOT NULL,
  `granted` tinyint(1) NOT NULL,
  `granted_at` datetime(6) NOT NULL,
  `withdrawn_at` datetime(6) DEFAULT NULL,
  `ip_address` char(39) NOT NULL,
  `consent_text` longtext NOT NULL,
  `version` varchar(10) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `data_retention_policies`
--

CREATE TABLE `data_retention_policies` (
  `id` bigint(20) NOT NULL,
  `data_type` varchar(50) NOT NULL,
  `retention_period_days` int(11) NOT NULL,
  `description` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `legal_basis` varchar(100) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `data_subject_requests`
--

CREATE TABLE `data_subject_requests` (
  `id` int(11) NOT NULL,
  `request_type` varchar(15) NOT NULL,
  `description` longtext NOT NULL,
  `status` varchar(15) NOT NULL,
  `submitted_at` datetime(6) NOT NULL,
  `completed_at` datetime(6) DEFAULT NULL,
  `response_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`response_data`)),
  `verification_token` varchar(100) NOT NULL,
  `processed_by_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `districts`
--

CREATE TABLE `districts` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `division_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `divisions`
--

CREATE TABLE `divisions` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `region_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `django_admin_log`
--

CREATE TABLE `django_admin_log` (
  `id` int(11) NOT NULL,
  `action_time` datetime(6) NOT NULL,
  `object_id` longtext DEFAULT NULL,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint(5) UNSIGNED NOT NULL CHECK (`action_flag` >= 0),
  `change_message` longtext NOT NULL,
  `content_type_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `django_content_type`
--

CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `django_migrations`
--

CREATE TABLE `django_migrations` (
  `id` bigint(20) NOT NULL,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `django_session`
--

CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `encrypted_form_data`
--

CREATE TABLE `encrypted_form_data` (
  `id` bigint(20) NOT NULL,
  `form_id` varchar(50) NOT NULL,
  `question_id` varchar(50) NOT NULL,
  `encrypted_data` longtext NOT NULL,
  `encryption_key_id` varchar(50) NOT NULL,
  `data_hash` varchar(64) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `accessed_at` datetime(6) DEFAULT NULL,
  `access_count` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `encryption_keys`
--

CREATE TABLE `encryption_keys` (
  `id` bigint(20) NOT NULL,
  `key_id` varchar(50) NOT NULL,
  `key_purpose` varchar(100) NOT NULL,
  `encrypted_key` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `rotation_count` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `forms`
--

CREATE TABLE `forms` (
  `form_id` int(11) NOT NULL,
  `school_id` int(11) NOT NULL,
  `status` varchar(20) DEFAULT 'draft' COMMENT 'Form status',
  `workflow_status` enum('draft','submitted','district_pending','district_approved','district_returned','division_pending','division_approved','division_returned','region_pending','region_approved','region_returned','central_pending','central_approved','central_returned','completed') DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `admin_id` int(11) NOT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `current_level` varchar(10) DEFAULT 'school',
  `last_reviewed_by` int(11) DEFAULT NULL,
  `last_reviewed_at` timestamp NULL DEFAULT NULL,
  `form_type` varchar(50) DEFAULT 'standard',
  `academic_year` varchar(10) DEFAULT '2024-2025',
  `submission_deadline` timestamp NULL DEFAULT NULL,
  `last_reviewed_by_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `form_approvals`
--

CREATE TABLE `form_approvals` (
  `approval_id` bigint(20) NOT NULL,
  `approval_level` varchar(10) NOT NULL,
  `status` varchar(10) NOT NULL,
  `comments` longtext DEFAULT NULL,
  `approved_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `form_id` int(11) NOT NULL,
  `approver_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `form_deadlines`
--

CREATE TABLE `form_deadlines` (
  `deadline_id` int(11) NOT NULL,
  `form_type` varchar(100) NOT NULL,
  `deadline_date` datetime(6) NOT NULL,
  `description` longtext DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `created_by_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `form_notifications`
--

CREATE TABLE `form_notifications` (
  `notification_id` bigint(20) NOT NULL,
  `notification_type` varchar(20) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` longtext NOT NULL,
  `priority` varchar(10) NOT NULL,
  `is_read` tinyint(1) NOT NULL,
  `read_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `action_required` tinyint(1) NOT NULL,
  `action_url` varchar(500) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `form_id` int(11) DEFAULT NULL,
  `recipient_id` int(11) DEFAULT NULL,
  `sender_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `form_remarks`
--

CREATE TABLE `form_remarks` (
  `remark_id` int(11) NOT NULL,
  `remark_type` varchar(10) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `remark_text` longtext NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `admin_user_id` int(11) NOT NULL,
  `form_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `login_attempts`
--

CREATE TABLE `login_attempts` (
  `id` bigint(20) NOT NULL,
  `username` varchar(150) NOT NULL,
  `ip_address` char(39) NOT NULL,
  `user_agent` longtext NOT NULL,
  `success` tinyint(1) NOT NULL,
  `failure_reason` varchar(100) DEFAULT NULL,
  `timestamp` datetime(6) NOT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_suspicious` tinyint(1) NOT NULL,
  `blocked` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `questions`
--

CREATE TABLE `questions` (
  `question_id` int(11) NOT NULL,
  `topic_id` int(11) NOT NULL,
  `question_text` text NOT NULL,
  `answer_type` enum('text','date','number','percentage') NOT NULL,
  `is_required` tinyint(1) DEFAULT 0,
  `display_order` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `question_choices`
--

CREATE TABLE `question_choices` (
  `choice_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `choice_text` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `raw_csv_data`
--

CREATE TABLE `raw_csv_data` (
  `id` int(11) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `sub_section` varchar(100) DEFAULT NULL,
  `topic` text DEFAULT NULL,
  `question` text DEFAULT NULL,
  `sub_question` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `raw_imports`
--

CREATE TABLE `raw_imports` (
  `id` int(11) NOT NULL,
  `original_id` varchar(50) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `division` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `school` varchar(100) DEFAULT NULL,
  `school_id` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `regions`
--

CREATE TABLE `regions` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `schools`
--

CREATE TABLE `schools` (
  `id` int(11) NOT NULL,
  `school_name` varchar(100) NOT NULL,
  `school_id` varchar(20) NOT NULL,
  `district_id` int(11) NOT NULL,
  `division_id` int(11) NOT NULL,
  `region_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `school_performance_summary`
-- (See below for the actual view)
--
CREATE TABLE `school_performance_summary` (
`school_id` int(11)
,`school_name` varchar(100)
,`school_code` varchar(20)
,`region_name` varchar(100)
,`division_name` varchar(100)
,`district_name` varchar(100)
,`total_forms` bigint(21)
,`completed_forms` bigint(21)
,`last_activity` timestamp
,`completion_rate` decimal(26,2)
);

-- --------------------------------------------------------

--
-- Table structure for table `security_alerts`
--

CREATE TABLE `security_alerts` (
  `id` int(11) NOT NULL,
  `alert_type` varchar(25) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` longtext NOT NULL,
  `priority` varchar(10) NOT NULL,
  `ip_address` char(39) DEFAULT NULL,
  `is_acknowledged` tinyint(1) NOT NULL,
  `acknowledged_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `acknowledged_by_id` int(11) DEFAULT NULL,
  `affected_user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `security_incidents`
--

CREATE TABLE `security_incidents` (
  `id` int(11) NOT NULL,
  `incident_type` varchar(30) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` longtext NOT NULL,
  `severity` varchar(10) NOT NULL,
  `status` varchar(15) NOT NULL,
  `ip_addresses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`ip_addresses`)),
  `detection_time` datetime(6) NOT NULL,
  `resolution_time` datetime(6) DEFAULT NULL,
  `notes` longtext NOT NULL,
  `automated_response` tinyint(1) NOT NULL,
  `assigned_to_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `security_incidents_affected_users`
--

CREATE TABLE `security_incidents_affected_users` (
  `id` bigint(20) NOT NULL,
  `securityincident_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `security_settings`
--

CREATE TABLE `security_settings` (
  `id` bigint(20) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` longtext NOT NULL,
  `description` longtext NOT NULL,
  `is_encrypted` tinyint(1) NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `updated_by_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topics`
--

CREATE TABLE `topics` (
  `topic_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `display_order` int(11) NOT NULL,
  `can_skip` tinyint(1) NOT NULL,
  `category_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users_school`
--

CREATE TABLE `users_school` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('school') NOT NULL,
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `school_id` int(11) DEFAULT NULL,
  `school_name` varchar(20) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `created_by_id` int(11) DEFAULT NULL,
  `approved_by_id` int(11) DEFAULT NULL,
  `approval_status` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_creation_requests`
--

CREATE TABLE `user_creation_requests` (
  `request_id` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `requested_role` varchar(20) NOT NULL,
  `justification` longtext NOT NULL,
  `status` varchar(10) NOT NULL,
  `approval_comments` longtext DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `processed_at` datetime(6) DEFAULT NULL,
  `requested_by_id` int(11) NOT NULL,
  `approved_by_id` int(11) DEFAULT NULL,
  `region_id` int(11) DEFAULT NULL,
  `division_id` int(11) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `school_id` int(11) DEFAULT NULL,
  `created_user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure for view `daily_analytics`
--
DROP TABLE IF EXISTS `daily_analytics`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `daily_analytics`  AS SELECT cast(`f`.`created_at` as date) AS `date`, count(distinct `f`.`form_id`) AS `forms_started`, count(distinct case when `f`.`status` = 'completed' then `f`.`form_id` end) AS `forms_completed`, count(distinct `f`.`school_id`) AS `schools_active`, avg(timestampdiff(HOUR,`f`.`created_at`,`f`.`updated_at`)) AS `avg_completion_hours` FROM `forms` AS `f` GROUP BY cast(`f`.`created_at` as date) ;

-- --------------------------------------------------------

--
-- Structure for view `school_performance_summary`
--
DROP TABLE IF EXISTS `school_performance_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `school_performance_summary`  AS SELECT `s`.`id` AS `school_id`, `s`.`school_name` AS `school_name`, `s`.`school_id` AS `school_code`, `r`.`name` AS `region_name`, `d`.`name` AS `division_name`, `dt`.`name` AS `district_name`, count(distinct `f`.`form_id`) AS `total_forms`, count(distinct case when `f`.`status` = 'completed' then `f`.`form_id` end) AS `completed_forms`, max(`f`.`updated_at`) AS `last_activity`, round(count(distinct case when `f`.`status` = 'completed' then `f`.`form_id` end) * 100.0 / count(distinct `f`.`form_id`),2) AS `completion_rate` FROM ((((`schools` `s` join `regions` `r` on(`s`.`region_id` = `r`.`id`)) join `divisions` `d` on(`s`.`division_id` = `d`.`id`)) join `districts` `dt` on(`s`.`district_id` = `dt`.`id`)) left join `forms` `f` on(`s`.`id` = `f`.`school_id`)) GROUP BY `s`.`id`, `s`.`school_name`, `s`.`school_id`, `r`.`name`, `d`.`name`, `dt`.`name` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `account_lockouts`
--
ALTER TABLE `account_lockouts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `account_lockouts_locked_by_id_401ab5e8_fk_auth_user_id` (`locked_by_id`),
  ADD KEY `account_lockouts_user_id_b8df622c_fk_auth_user_id` (`user_id`);

--
-- Indexes for table `admin_activity_log`
--
ALTER TABLE `admin_activity_log`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `adm_log_usr_time_idx` (`admin_user_id`,`timestamp`);

--
-- Indexes for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `adm_sess_usr_act_idx` (`admin_user_id`,`is_active`);

--
-- Indexes for table `admin_user`
--
ALTER TABLE `admin_user`
  ADD PRIMARY KEY (`admin_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `admin_user_school_id_cee360b4_fk_schools_id` (`school_id`),
  ADD KEY `admin_user_created_by_id_5c7511f1_fk_admin_user_admin_id` (`created_by_id`),
  ADD KEY `admin_user_updated_by_id_6da46784_fk_admin_user_admin_id` (`updated_by_id`),
  ADD KEY `admin_user_level_status_idx` (`admin_level`,`status`),
  ADD KEY `admin_user_coverage_idx` (`region_id`,`division_id`,`district_id`),
  ADD KEY `idx_admin_user_level_status` (`admin_level`,`status`),
  ADD KEY `idx_admin_user_region` (`region_id`),
  ADD KEY `idx_admin_user_division` (`division_id`),
  ADD KEY `idx_admin_user_district` (`district_id`),
  ADD KEY `idx_admin_user_level_region` (`admin_level`,`region_id`);

--
-- Indexes for table `admin_user_permissions`
--
ALTER TABLE `admin_user_permissions`
  ADD PRIMARY KEY (`permission_id`),
  ADD UNIQUE KEY `unique_admin_permission` (`admin_user_id`,`permission_name`,`resource_type`,`action`),
  ADD KEY `adm_perm_usr_res_idx` (`admin_user_id`,`resource_type`),
  ADD KEY `admin_user_permissio_granted_by_id_f59779ad_fk_admin_use` (`granted_by_id`);

--
-- Indexes for table `answers`
--
ALTER TABLE `answers`
  ADD PRIMARY KEY (`answer_id`),
  ADD KEY `idx_answers_form` (`form_id`),
  ADD KEY `idx_answers_question` (`question_id`),
  ADD KEY `idx_answers_form_question` (`form_id`,`question_id`),
  ADD KEY `idx_answers_answered_at` (`answered_at`),
  ADD KEY `idx_answers_form_question_sub` (`form_id`,`question_id`),
  ADD KEY `idx_answers_question_response` (`question_id`,`response`(100)),
  ADD KEY `idx_answers_form_question_answered` (`form_id`,`question_id`,`answered_at`),
  ADD KEY `idx_answers_form_id` (`form_id`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `audit_logs_action__11f9f1_idx` (`action_type`,`timestamp`),
  ADD KEY `audit_logs_severit_549d29_idx` (`severity`,`timestamp`),
  ADD KEY `audit_logs_ip_addr_932507_idx` (`ip_address`,`timestamp`),
  ADD KEY `audit_logs_resourc_bda8a6_idx` (`resource_type`,`resource_id`),
  ADD KEY `idx_audit_logs_timestamp` (`timestamp`),
  ADD KEY `idx_audit_logs_ip_timestamp` (`ip_address`,`timestamp`),
  ADD KEY `audit_logs_admin_id_88267f_idx` (`admin_id`,`timestamp`),
  ADD KEY `idx_audit_logs_admin_action` (`admin_id`,`action_type`);

--
-- Indexes for table `audit_trail`
--
ALTER TABLE `audit_trail`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `auth_group`
--
ALTER TABLE `auth_group`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_group_permissions_group_id_permission_id_0cd325b0_uniq` (`group_id`,`permission_id`),
  ADD KEY `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` (`permission_id`);

--
-- Indexes for table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_permission_content_type_id_codename_01ab375a_uniq` (`content_type_id`,`codename`);

--
-- Indexes for table `auth_user`
--
ALTER TABLE `auth_user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Indexes for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_user_groups_user_id_group_id_94350c0c_uniq` (`user_id`,`group_id`),
  ADD KEY `auth_user_groups_group_id_97559544_fk_auth_group_id` (`group_id`);

--
-- Indexes for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auth_user_user_permissions_user_id_permission_id_14a6b632_uniq` (`user_id`,`permission_id`),
  ADD KEY `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` (`permission_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`),
  ADD KEY `idx_categories_order` (`display_order`);

--
-- Indexes for table `compliance_reports`
--
ALTER TABLE `compliance_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `compliance_reports_generated_by_id_6871378e_fk_auth_user_id` (`generated_by_id`);

--
-- Indexes for table `data_processing_consent`
--
ALTER TABLE `data_processing_consent`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `data_processing_consent_user_id_consent_type_ver_bd722976_uniq` (`user_id`,`consent_type`,`version`);

--
-- Indexes for table `data_retention_policies`
--
ALTER TABLE `data_retention_policies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `data_subject_requests`
--
ALTER TABLE `data_subject_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `verification_token` (`verification_token`),
  ADD KEY `data_subject_requests_processed_by_id_111f8368_fk_auth_user_id` (`processed_by_id`),
  ADD KEY `data_subject_requests_user_id_8b1c017a_fk_auth_user_id` (`user_id`);

--
-- Indexes for table `districts`
--
ALTER TABLE `districts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `division_id` (`division_id`);

--
-- Indexes for table `divisions`
--
ALTER TABLE `divisions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `region_id` (`region_id`);

--
-- Indexes for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `django_admin_log_content_type_id_c4bce8eb_fk_django_co` (`content_type_id`),
  ADD KEY `django_admin_log_user_id_c564eba6_fk_auth_user_id` (`user_id`);

--
-- Indexes for table `django_content_type`
--
ALTER TABLE `django_content_type`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `django_content_type_app_label_model_76bd3d3b_uniq` (`app_label`,`model`);

--
-- Indexes for table `django_migrations`
--
ALTER TABLE `django_migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `django_session`
--
ALTER TABLE `django_session`
  ADD PRIMARY KEY (`session_key`),
  ADD KEY `django_session_expire_date_a5c62663` (`expire_date`);

--
-- Indexes for table `encrypted_form_data`
--
ALTER TABLE `encrypted_form_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `encrypted_f_form_id_af8dc3_idx` (`form_id`,`question_id`),
  ADD KEY `encrypted_f_encrypt_d2d653_idx` (`encryption_key_id`);

--
-- Indexes for table `encryption_keys`
--
ALTER TABLE `encryption_keys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key_id` (`key_id`);

--
-- Indexes for table `forms`
--
ALTER TABLE `forms`
  ADD PRIMARY KEY (`form_id`),
  ADD KEY `school_id` (`school_id`),
  ADD KEY `idx_forms_school_status` (`school_id`,`status`),
  ADD KEY `idx_forms_created_at` (`created_at`),
  ADD KEY `idx_forms_updated_at` (`updated_at`),
  ADD KEY `idx_forms_status_updated` (`status`,`updated_at`),
  ADD KEY `idx_forms_school_status_updated` (`school_id`,`status`,`updated_at`),
  ADD KEY `idx_forms_user_status` (`admin_id`,`status`),
  ADD KEY `idx_forms_user_school_status` (`admin_id`,`school_id`,`status`),
  ADD KEY `idx_forms_user_school` (`admin_id`,`school_id`),
  ADD KEY `forms_last_reviewed_by_id_idx` (`last_reviewed_by_id`),
  ADD KEY `form_school_id_idx` (`school_id`),
  ADD KEY `form_status_idx` (`status`),
  ADD KEY `form_current_level_idx` (`current_level`),
  ADD KEY `form_submitted_at_idx` (`submitted_at`),
  ADD KEY `form_workflow_status_idx` (`workflow_status`),
  ADD KEY `form_school_workflow_idx` (`school_id`,`workflow_status`),
  ADD KEY `form_admin_id_idx` (`admin_id`);

--
-- Indexes for table `form_approvals`
--
ALTER TABLE `form_approvals`
  ADD PRIMARY KEY (`approval_id`),
  ADD KEY `appr_form_level_idx` (`form_id`,`approval_level`),
  ADD KEY `form_approvals_approver_id_efc834e4_fk_admin_user_admin_id` (`approver_id`);

--
-- Indexes for table `form_deadlines`
--
ALTER TABLE `form_deadlines`
  ADD PRIMARY KEY (`deadline_id`),
  ADD KEY `deadline_reg_date_idx` (`region_id`,`deadline_date`),
  ADD KEY `form_deadlines_division_id_5711c2ea_fk_divisions_id` (`division_id`),
  ADD KEY `form_deadlines_district_id_bec9ae46_fk_districts_id` (`district_id`),
  ADD KEY `form_deadlines_created_by_id_b3199d05_fk_admin_user_admin_id` (`created_by_id`);

--
-- Indexes for table `form_notifications`
--
ALTER TABLE `form_notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `form_notifications_sender_id_fk` (`sender_id`),
  ADD KEY `form_notifications_recipient_id_idx` (`recipient_id`,`is_read`),
  ADD KEY `form_notifications_form_id_idx` (`form_id`,`notification_type`);

--
-- Indexes for table `form_remarks`
--
ALTER TABLE `form_remarks`
  ADD PRIMARY KEY (`remark_id`),
  ADD KEY `idx_form_remarks_form` (`form_id`),
  ADD KEY `idx_form_remarks_type_entity` (`remark_type`,`entity_id`),
  ADD KEY `idx_form_remarks_admin` (`admin_user_id`),
  ADD KEY `idx_form_remarks_created` (`created_at`);

--
-- Indexes for table `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `login_attem_usernam_ece61f_idx` (`username`,`timestamp`),
  ADD KEY `login_attem_ip_addr_340a7c_idx` (`ip_address`,`timestamp`),
  ADD KEY `login_attem_success_f3dfbd_idx` (`success`,`timestamp`);

--
-- Indexes for table `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`question_id`),
  ADD KEY `questions_ibfk_1` (`topic_id`),
  ADD KEY `idx_questions_topic_display` (`topic_id`,`display_order`),
  ADD KEY `idx_questions_answer_type` (`answer_type`),
  ADD KEY `idx_questions_text` (`question_text`(768)),
  ADD KEY `idx_questions_topic_type` (`topic_id`,`answer_type`),
  ADD KEY `idx_questions_required` (`is_required`),
  ADD KEY `idx_questions_topic` (`topic_id`),
  ADD KEY `idx_questions_order` (`display_order`),
  ADD KEY `idx_questions_topic_required` (`topic_id`,`is_required`),
  ADD KEY `question_topic_id_idx` (`topic_id`),
  ADD KEY `idx_questions_topic_id` (`topic_id`),
  ADD KEY `idx_questions_topic_order` (`topic_id`,`display_order`);

--
-- Indexes for table `question_choices`
--
ALTER TABLE `question_choices`
  ADD PRIMARY KEY (`choice_id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `raw_csv_data`
--
ALTER TABLE `raw_csv_data`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `raw_imports`
--
ALTER TABLE `raw_imports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `regions`
--
ALTER TABLE `regions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `schools`
--
ALTER TABLE `schools`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `school_id` (`school_id`),
  ADD KEY `district_id` (`district_id`),
  ADD KEY `division_id` (`division_id`),
  ADD KEY `region_id` (`region_id`),
  ADD KEY `idx_schools_district` (`district_id`),
  ADD KEY `idx_schools_division` (`division_id`),
  ADD KEY `idx_schools_region` (`region_id`);

--
-- Indexes for table `security_alerts`
--
ALTER TABLE `security_alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `security_alerts_acknowledged_by_id_17242fe2_fk_auth_user_id` (`acknowledged_by_id`),
  ADD KEY `security_alerts_affected_user_id_506a24d2_fk_auth_user_id` (`affected_user_id`);

--
-- Indexes for table `security_incidents`
--
ALTER TABLE `security_incidents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `security_incidents_assigned_to_id_5898326a_fk_auth_user_id` (`assigned_to_id`);

--
-- Indexes for table `security_incidents_affected_users`
--
ALTER TABLE `security_incidents_affected_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `security_incidents_affec_securityincident_id_user_c4386342_uniq` (`securityincident_id`,`user_id`),
  ADD KEY `security_incidents_a_user_id_6a7bd31f_fk_auth_user` (`user_id`);

--
-- Indexes for table `security_settings`
--
ALTER TABLE `security_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `security_settings_updated_by_id_90a00853_fk_auth_user_id` (`updated_by_id`);

--
-- Indexes for table `topics`
--
ALTER TABLE `topics`
  ADD PRIMARY KEY (`topic_id`),
  ADD KEY `idx_topics_order` (`display_order`),
  ADD KEY `topic_category_id_idx` (`category_id`),
  ADD KEY `idx_topics_category_id` (`category_id`),
  ADD KEY `idx_topics_category_order` (`category_id`,`display_order`);

--
-- Indexes for table `users_school`
--
ALTER TABLE `users_school`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `region_id` (`region_id`),
  ADD KEY `division_id` (`division_id`),
  ADD KEY `district_id` (`district_id`),
  ADD KEY `school_id` (`school_id`),
  ADD KEY `idx_users_school_region` (`region_id`),
  ADD KEY `idx_users_school_division` (`division_id`),
  ADD KEY `idx_users_school_district` (`district_id`),
  ADD KEY `idx_users_school_name` (`school_name`),
  ADD KEY `idx_users_school_name_text` (`school_name`),
  ADD KEY `users_school_approved_by_id_bf5310c7_fk_admin_user_admin_id` (`approved_by_id`),
  ADD KEY `usr_sch_created_by_idx` (`created_by_id`);

--
-- Indexes for table `user_creation_requests`
--
ALTER TABLE `user_creation_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `user_creation_reques_requested_by_id_034917c7_fk_admin_use` (`requested_by_id`),
  ADD KEY `user_creation_reques_approved_by_id_fc3fea11_fk_admin_use` (`approved_by_id`),
  ADD KEY `user_creation_requests_region_id_41c39f91_fk_regions_id` (`region_id`),
  ADD KEY `user_creation_requests_division_id_893ed345_fk_divisions_id` (`division_id`),
  ADD KEY `user_creation_requests_district_id_d10f1874_fk_districts_id` (`district_id`),
  ADD KEY `user_creation_requests_school_id_c04011d7_fk_schools_id` (`school_id`),
  ADD KEY `user_creation_reques_created_user_id_d6d227a6_fk_users_sch` (`created_user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `account_lockouts`
--
ALTER TABLE `account_lockouts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_activity_log`
--
ALTER TABLE `admin_activity_log`
  MODIFY `log_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_user`
--
ALTER TABLE `admin_user`
  MODIFY `admin_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admin_user_permissions`
--
ALTER TABLE `admin_user_permissions`
  MODIFY `permission_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `answers`
--
ALTER TABLE `answers`
  MODIFY `answer_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_trail`
--
ALTER TABLE `audit_trail`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_group`
--
ALTER TABLE `auth_group`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_permission`
--
ALTER TABLE `auth_permission`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_user`
--
ALTER TABLE `auth_user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `compliance_reports`
--
ALTER TABLE `compliance_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `data_processing_consent`
--
ALTER TABLE `data_processing_consent`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `data_retention_policies`
--
ALTER TABLE `data_retention_policies`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `data_subject_requests`
--
ALTER TABLE `data_subject_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `districts`
--
ALTER TABLE `districts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `divisions`
--
ALTER TABLE `divisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `django_content_type`
--
ALTER TABLE `django_content_type`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `django_migrations`
--
ALTER TABLE `django_migrations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `encrypted_form_data`
--
ALTER TABLE `encrypted_form_data`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `encryption_keys`
--
ALTER TABLE `encryption_keys`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `forms`
--
ALTER TABLE `forms`
  MODIFY `form_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `form_approvals`
--
ALTER TABLE `form_approvals`
  MODIFY `approval_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `form_deadlines`
--
ALTER TABLE `form_deadlines`
  MODIFY `deadline_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `form_notifications`
--
ALTER TABLE `form_notifications`
  MODIFY `notification_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `form_remarks`
--
ALTER TABLE `form_remarks`
  MODIFY `remark_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `questions`
--
ALTER TABLE `questions`
  MODIFY `question_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `question_choices`
--
ALTER TABLE `question_choices`
  MODIFY `choice_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `raw_csv_data`
--
ALTER TABLE `raw_csv_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `raw_imports`
--
ALTER TABLE `raw_imports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `regions`
--
ALTER TABLE `regions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `schools`
--
ALTER TABLE `schools`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `security_alerts`
--
ALTER TABLE `security_alerts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `security_incidents`
--
ALTER TABLE `security_incidents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `security_incidents_affected_users`
--
ALTER TABLE `security_incidents_affected_users`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `security_settings`
--
ALTER TABLE `security_settings`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `topics`
--
ALTER TABLE `topics`
  MODIFY `topic_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users_school`
--
ALTER TABLE `users_school`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_creation_requests`
--
ALTER TABLE `user_creation_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_lockouts`
--
ALTER TABLE `account_lockouts`
  ADD CONSTRAINT `account_lockouts_locked_by_id_401ab5e8_fk_auth_user_id` FOREIGN KEY (`locked_by_id`) REFERENCES `auth_user` (`id`),
  ADD CONSTRAINT `account_lockouts_user_id_b8df622c_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `admin_activity_log`
--
ALTER TABLE `admin_activity_log`
  ADD CONSTRAINT `admin_activity_log_admin_user_id_aa8be473_fk_admin_user_admin_id` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`admin_id`);

--
-- Constraints for table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `admin_sessions_admin_user_id_8e7bf4cd_fk_admin_user_admin_id` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`admin_id`);

--
-- Constraints for table `admin_user`
--
ALTER TABLE `admin_user`
  ADD CONSTRAINT `admin_user_created_by_id_5c7511f1_fk_admin_user_admin_id` FOREIGN KEY (`created_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `admin_user_district_id_6aaf4db9_fk_districts_id` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`),
  ADD CONSTRAINT `admin_user_division_id_54bd269c_fk_divisions_id` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  ADD CONSTRAINT `admin_user_region_id_51462baa_fk_regions_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`),
  ADD CONSTRAINT `admin_user_school_id_cee360b4_fk_schools_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  ADD CONSTRAINT `admin_user_updated_by_id_6da46784_fk_admin_user_admin_id` FOREIGN KEY (`updated_by_id`) REFERENCES `admin_user` (`admin_id`);

--
-- Constraints for table `admin_user_permissions`
--
ALTER TABLE `admin_user_permissions`
  ADD CONSTRAINT `admin_user_permissio_admin_user_id_9ac8199f_fk_admin_use` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `admin_user_permissio_granted_by_id_f59779ad_fk_admin_use` FOREIGN KEY (`granted_by_id`) REFERENCES `admin_user` (`admin_id`);

--
-- Constraints for table `answers`
--
ALTER TABLE `answers`
  ADD CONSTRAINT `answers_ibfk_1` FOREIGN KEY (`form_id`) REFERENCES `forms` (`form_id`),
  ADD CONSTRAINT `answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`question_id`);

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_admin_id_752b0e2b_fk_admin_user_admin_id` FOREIGN KEY (`admin_id`) REFERENCES `admin_user` (`admin_id`);

--
-- Constraints for table `audit_trail`
--
ALTER TABLE `audit_trail`
  ADD CONSTRAINT `audit_trail_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`question_id`);

--
-- Constraints for table `auth_group_permissions`
--
ALTER TABLE `auth_group_permissions`
  ADD CONSTRAINT `auth_group_permissio_permission_id_84c5c92e_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `auth_group_permissions_group_id_b120cbf9_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`);

--
-- Constraints for table `auth_permission`
--
ALTER TABLE `auth_permission`
  ADD CONSTRAINT `auth_permission_content_type_id_2f476e4b_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`);

--
-- Constraints for table `auth_user_groups`
--
ALTER TABLE `auth_user_groups`
  ADD CONSTRAINT `auth_user_groups_group_id_97559544_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  ADD CONSTRAINT `auth_user_groups_user_id_6a12ed8b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `auth_user_user_permissions`
--
ALTER TABLE `auth_user_user_permissions`
  ADD CONSTRAINT `auth_user_user_permi_permission_id_1fbb5f2c_fk_auth_perm` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`),
  ADD CONSTRAINT `auth_user_user_permissions_user_id_a95ead1b_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `compliance_reports`
--
ALTER TABLE `compliance_reports`
  ADD CONSTRAINT `compliance_reports_generated_by_id_6871378e_fk_auth_user_id` FOREIGN KEY (`generated_by_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `data_processing_consent`
--
ALTER TABLE `data_processing_consent`
  ADD CONSTRAINT `data_processing_consent_user_id_4149f8d2_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `data_subject_requests`
--
ALTER TABLE `data_subject_requests`
  ADD CONSTRAINT `data_subject_requests_processed_by_id_111f8368_fk_auth_user_id` FOREIGN KEY (`processed_by_id`) REFERENCES `auth_user` (`id`),
  ADD CONSTRAINT `data_subject_requests_user_id_8b1c017a_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `districts`
--
ALTER TABLE `districts`
  ADD CONSTRAINT `districts_ibfk_1` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `divisions`
--
ALTER TABLE `divisions`
  ADD CONSTRAINT `divisions_ibfk_1` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `django_admin_log`
--
ALTER TABLE `django_admin_log`
  ADD CONSTRAINT `django_admin_log_content_type_id_c4bce8eb_fk_django_co` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`),
  ADD CONSTRAINT `django_admin_log_user_id_c564eba6_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `forms`
--
ALTER TABLE `forms`
  ADD CONSTRAINT `forms_admin_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `forms_school_id_6bcdd7e5_fk_schools_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`);

--
-- Constraints for table `form_approvals`
--
ALTER TABLE `form_approvals`
  ADD CONSTRAINT `form_approvals_approver_id_efc834e4_fk_admin_user_admin_id` FOREIGN KEY (`approver_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `form_approvals_form_id_afe78c9f_fk_forms_form_id` FOREIGN KEY (`form_id`) REFERENCES `forms` (`form_id`);

--
-- Constraints for table `form_deadlines`
--
ALTER TABLE `form_deadlines`
  ADD CONSTRAINT `form_deadlines_created_by_id_b3199d05_fk_admin_user_admin_id` FOREIGN KEY (`created_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `form_deadlines_district_id_bec9ae46_fk_districts_id` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`),
  ADD CONSTRAINT `form_deadlines_division_id_5711c2ea_fk_divisions_id` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  ADD CONSTRAINT `form_deadlines_region_id_d8d87f1d_fk_regions_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`);

--
-- Constraints for table `form_notifications`
--
ALTER TABLE `form_notifications`
  ADD CONSTRAINT `form_notifications_form_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms` (`form_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `form_notifications_recipient_id_fk` FOREIGN KEY (`recipient_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `form_notifications_sender_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `admin_user` (`admin_id`) ON DELETE CASCADE;

--
-- Constraints for table `form_remarks`
--
ALTER TABLE `form_remarks`
  ADD CONSTRAINT `form_remarks_admin_user_id_16147425_fk_admin_user_admin_id` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `form_remarks_form_id_73eeaff1_fk_forms_form_id` FOREIGN KEY (`form_id`) REFERENCES `forms` (`form_id`);

--
-- Constraints for table `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`topic_id`);

--
-- Constraints for table `question_choices`
--
ALTER TABLE `question_choices`
  ADD CONSTRAINT `question_choices_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`question_id`);

--
-- Constraints for table `schools`
--
ALTER TABLE `schools`
  ADD CONSTRAINT `schools_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `schools_ibfk_2` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `schools_ibfk_3` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `security_alerts`
--
ALTER TABLE `security_alerts`
  ADD CONSTRAINT `security_alerts_acknowledged_by_id_17242fe2_fk_auth_user_id` FOREIGN KEY (`acknowledged_by_id`) REFERENCES `auth_user` (`id`),
  ADD CONSTRAINT `security_alerts_affected_user_id_506a24d2_fk_auth_user_id` FOREIGN KEY (`affected_user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `security_incidents`
--
ALTER TABLE `security_incidents`
  ADD CONSTRAINT `security_incidents_assigned_to_id_5898326a_fk_auth_user_id` FOREIGN KEY (`assigned_to_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `security_incidents_affected_users`
--
ALTER TABLE `security_incidents_affected_users`
  ADD CONSTRAINT `security_incidents_a_securityincident_id_7d38acc5_fk_security_` FOREIGN KEY (`securityincident_id`) REFERENCES `security_incidents` (`id`),
  ADD CONSTRAINT `security_incidents_a_user_id_6a7bd31f_fk_auth_user` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `security_settings`
--
ALTER TABLE `security_settings`
  ADD CONSTRAINT `security_settings_updated_by_id_90a00853_fk_auth_user_id` FOREIGN KEY (`updated_by_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `topics`
--
ALTER TABLE `topics`
  ADD CONSTRAINT `topics_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE CASCADE;

--
-- Constraints for table `users_school`
--
ALTER TABLE `users_school`
  ADD CONSTRAINT `users_school_approved_by_id_bf5310c7_fk_admin_user_admin_id` FOREIGN KEY (`approved_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `users_school_created_by_id_053a9140_fk_admin_user_admin_id` FOREIGN KEY (`created_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `users_school_ibfk_1` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_school_ibfk_2` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_school_ibfk_3` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_school_ibfk_4` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `users_school_user_id_1de6d99f_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`);

--
-- Constraints for table `user_creation_requests`
--
ALTER TABLE `user_creation_requests`
  ADD CONSTRAINT `user_creation_reques_approved_by_id_fc3fea11_fk_admin_use` FOREIGN KEY (`approved_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `user_creation_reques_created_user_id_d6d227a6_fk_users_sch` FOREIGN KEY (`created_user_id`) REFERENCES `users_school` (`id`),
  ADD CONSTRAINT `user_creation_reques_requested_by_id_034917c7_fk_admin_use` FOREIGN KEY (`requested_by_id`) REFERENCES `admin_user` (`admin_id`),
  ADD CONSTRAINT `user_creation_requests_district_id_d10f1874_fk_districts_id` FOREIGN KEY (`district_id`) REFERENCES `districts` (`id`),
  ADD CONSTRAINT `user_creation_requests_division_id_893ed345_fk_divisions_id` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`),
  ADD CONSTRAINT `user_creation_requests_region_id_41c39f91_fk_regions_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`),
  ADD CONSTRAINT `user_creation_requests_school_id_c04011d7_fk_schools_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
