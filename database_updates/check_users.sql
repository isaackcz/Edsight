-- Check for existing school users in both tables
SELECT 'users_school' as table_name, COUNT(*) as user_count FROM users_school
UNION ALL
SELECT 'admin_user (school level)' as table_name, COUNT(*) as user_count FROM admin_user WHERE admin_level = 'school';

-- Show sample users from users_school if any exist
SELECT 'Sample users_school data:' as info;
SELECT id, username, email, school_name, is_active, created_at 
FROM users_school 
LIMIT 5;

-- Show sample admin users with school level if any exist  
SELECT 'Sample admin_user school data:' as info;
SELECT admin_id, username, email, assigned_area, status, created_at 
FROM admin_user 
WHERE admin_level = 'school' 
LIMIT 5;

-- Check for potential conflicts
SELECT 'Potential username conflicts:' as info;
SELECT us.username, us.email as us_email, au.email as au_email
FROM users_school us
INNER JOIN admin_user au ON us.username = au.username;

SELECT 'Potential email conflicts:' as info;
SELECT us.username as us_username, us.email, au.username as au_username
FROM users_school us
INNER JOIN admin_user au ON us.email = au.email;
