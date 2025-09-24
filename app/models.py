from django.db import models
from django.contrib.auth import get_user_model

# --- ENUM choices ---
FORM_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('in-progress', 'In Progress'),
    ('completed', 'Completed'),
]

ANSWER_TYPE_CHOICES = [
    ('text', 'Text'),
    ('number', 'Number'),
    ('date', 'Date'),
    ('percentage', 'Percentage'),
]

ROLE_CHOICES = [
    ('school', 'School'),
]

# --- MODELS ---

class Region(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'regions'

class Division(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, db_column='region_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'divisions'
        indexes = [
            models.Index(fields=['region'], name='division_region_id_idx'),
        ]

class District(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, db_column='division_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'districts'
        indexes = [
            models.Index(fields=['division'], name='district_division_id_idx'),
        ]

class School(models.Model):
    id = models.AutoField(primary_key=True)
    school_name = models.CharField(max_length=100)
    school_id = models.CharField(max_length=20, unique=True)
    district = models.ForeignKey(District, on_delete=models.CASCADE, db_column='district_id')
    division = models.ForeignKey(Division, on_delete=models.CASCADE, db_column='division_id')
    region = models.ForeignKey(Region, on_delete=models.CASCADE, db_column='region_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'schools'
        indexes = [
            models.Index(fields=['district'], name='school_district_id_idx'),
            models.Index(fields=['division'], name='school_division_id_idx'),
            models.Index(fields=['region'], name='school_region_id_idx'),
        ]

class UsersSchool(models.Model):
    """
    DEPRECATED: This model is deprecated and should not be used for new development.
    Use AdminUser model instead. This model is kept only for migration compatibility.
    """
    user = models.OneToOneField('auth.User', on_delete=models.CASCADE, null=True, blank=True)
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    password_hash = models.CharField(max_length=255)
    email = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, db_column='region_id', blank=True)
    division = models.ForeignKey(Division, on_delete=models.SET_NULL, null=True, db_column='division_id', blank=True)
    district = models.ForeignKey(District, on_delete=models.SET_NULL, null=True, db_column='district_id', blank=True)
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, db_column='school_id', blank=True)
    school_name = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Admin user system integration - track who created and approved this user
    created_by = models.ForeignKey('AdminUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_school_users')
    approved_by = models.ForeignKey('AdminUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_school_users')
    
    APPROVAL_STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    approval_status = models.CharField(max_length=10, choices=APPROVAL_STATUS_CHOICES, default='approved')

    class Meta:
        db_table = 'users_school'
        indexes = [
            models.Index(fields=['region'], name='userschool_region_id_idx'),
            models.Index(fields=['division'], name='userschool_division_id_idx'),
            models.Index(fields=['district'], name='userschool_district_id_idx'),
            models.Index(fields=['school'], name='userschool_school_id_idx'),
            models.Index(fields=['created_by'], name='usr_sch_created_by_idx'),
            models.Index(fields=['approved_by'], name='usr_sch_approved_by_idx'),
            models.Index(fields=['approval_status'], name='usr_sch_approval_idx'),
        ]

class Category(models.Model):
    category_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    display_order = models.IntegerField()

    class Meta:
        db_table = 'categories'
        indexes = [
            models.Index(fields=['display_order'], name='idx_categories_order'),
        ]

class SubSection(models.Model):
    sub_section_id = models.AutoField(primary_key=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, db_column='category_id')
    name = models.CharField(max_length=100)
    display_order = models.IntegerField()

    class Meta:
        db_table = 'sub_sections'
        indexes = [
            models.Index(fields=['category'], name='subsection_category_id_idx'),
            models.Index(fields=['display_order'], name='idx_sub_sections_order'),
        ]

class Topic(models.Model):
    topic_id = models.AutoField(primary_key=True)
    sub_section = models.ForeignKey(SubSection, on_delete=models.CASCADE, db_column='sub_section_id')
    name = models.CharField(max_length=100)
    display_order = models.IntegerField()

    class Meta:
        db_table = 'topics'
        indexes = [
            models.Index(fields=['sub_section'], name='topic_sub_section_id_idx'),
            models.Index(fields=['display_order'], name='idx_topics_order'),
        ]

class Question(models.Model):
    question_id = models.AutoField(primary_key=True)
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, db_column='topic_id')
    question_text = models.TextField()
    answer_type = models.CharField(max_length=10, choices=ANSWER_TYPE_CHOICES)
    is_required = models.BooleanField(default=False)
    display_order = models.IntegerField()

    class Meta:
        db_table = 'questions'
        indexes = [
            models.Index(fields=['topic'], name='question_topic_id_idx'),
            models.Index(fields=['display_order'], name='idx_questions_order'),
        ]

class SubQuestion(models.Model):
    sub_question_id = models.AutoField(primary_key=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='question_id')
    sub_question_text = models.CharField(max_length=255)
    answer_type = models.CharField(max_length=10, choices=ANSWER_TYPE_CHOICES, default='text')
    display_order = models.IntegerField(default=1)

    class Meta:
        db_table = 'sub_questions'
        indexes = [
            models.Index(fields=['question'], name='idx_sub_questions_question_id'),
            models.Index(fields=['display_order'], name='idx_sub_questions_order'),
        ]

class QuestionChoice(models.Model):
    choice_id = models.AutoField(primary_key=True)
    question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='question_id')
    choice_text = models.CharField(max_length=255)

    class Meta:
        db_table = 'question_choices'
        indexes = [
            models.Index(fields=['question'], name='questionchoice_question_id_idx'),
        ]

class Form(models.Model):
    form_id = models.AutoField(primary_key=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, db_column='user_id')
    # This points to schools.id (auto-increment), which is correct for the current database
    school = models.ForeignKey(School, on_delete=models.CASCADE, db_column='school_id')
    status = models.CharField(max_length=20, choices=FORM_STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'forms'
        indexes = [
            models.Index(fields=['user'], name='form_user_id_idx'),
            models.Index(fields=['school'], name='form_school_id_idx'),
        ]
        unique_together = ['user', 'school']  # Ensure one form per user per school

class Answer(models.Model):
    answer_id = models.AutoField(primary_key=True)
    form = models.ForeignKey(Form, on_delete=models.CASCADE, db_column='form_id')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, db_column='question_id')
    sub_question = models.ForeignKey(SubQuestion, on_delete=models.CASCADE, db_column='sub_question_id', null=True, blank=True)
    response = models.TextField(null=True, blank=True)
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'answers'
        indexes = [
            models.Index(fields=['form'], name='idx_answers_form'),
            models.Index(fields=['question'], name='idx_answers_question'),
            models.Index(fields=['sub_question'], name='idx_answers_sub_question'),
        ]

class RawImport(models.Model):
    id = models.AutoField(primary_key=True)
    original_id = models.CharField(max_length=50, null=True, blank=True)
    region = models.CharField(max_length=100, null=True, blank=True)
    division = models.CharField(max_length=100, null=True, blank=True)
    district = models.CharField(max_length=100, null=True, blank=True)
    school = models.CharField(max_length=100, null=True, blank=True)
    school_id = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'raw_imports'


class AdminUser(models.Model):
    """
    Comprehensive admin user model supporting role-based access control
    for Central Office, Region, Division, District, and School levels
    """
    admin_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=100, unique=True)
    email = models.CharField(max_length=150, unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150, blank=True, null=True)
    
    ADMIN_LEVEL_CHOICES = [
        ('central', 'Central Office'),
        ('region', 'Region'),
        ('division', 'Division'), 
        ('district', 'District'),
        ('school', 'School'),
    ]
    admin_level = models.CharField(max_length=10, choices=ADMIN_LEVEL_CHOICES)
    assigned_area = models.CharField(max_length=150, blank=True, null=True)
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    profile_image = models.CharField(max_length=255, blank=True, null=True)
    
    # Geographic coverage fields - defines what areas this admin can access
    region = models.ForeignKey('Region', on_delete=models.SET_NULL, null=True, blank=True, db_column='region_id')
    division = models.ForeignKey('Division', on_delete=models.SET_NULL, null=True, blank=True, db_column='division_id')
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True, db_column='district_id')
    school = models.ForeignKey('School', on_delete=models.SET_NULL, null=True, blank=True, db_column='school_id')
    
    # Permission flags for role-based access
    can_create_users = models.BooleanField(default=False)
    can_manage_users = models.BooleanField(default=False)
    can_set_deadlines = models.BooleanField(default=False)
    can_approve_submissions = models.BooleanField(default=False)
    can_view_system_logs = models.BooleanField(default=False)
    
    # Audit fields
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    updated_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_users')

    class Meta:
        db_table = 'admin_user'
        indexes = [
            models.Index(fields=['admin_level', 'status']),
            models.Index(fields=['region', 'division', 'district']),
        ]
    
    def __str__(self):
        return f"{self.username} ({self.get_admin_level_display()})"
    
    def clean(self):
        """Validate email format based on admin level"""
        from django.core.exceptions import ValidationError
        import re
        
        if self.admin_level == 'school':
            # School users: schoolid@deped.gov.ph
            if not re.match(r'^[A-Za-z0-9]+@deped\.gov\.ph$', self.email):
                raise ValidationError('School users must use format: schoolid@deped.gov.ph')
        else:
            # Non-school users: firstname.lastname@deped.gov.ph
            if not re.match(r'^[A-Za-z]+\.[A-Za-z]+@deped\.gov\.ph$', self.email):
                raise ValidationError('Non-school users must use format: firstname.lastname@deped.gov.ph')
    
    def get_access_scope(self):
        """Get the geographic scope this admin can access"""
        if self.admin_level == 'central':
            return {'scope': 'nationwide', 'regions': 'all'}
        elif self.admin_level == 'region':
            return {'scope': 'regional', 'region_id': self.region_id}
        elif self.admin_level == 'division':
            return {'scope': 'divisional', 'division_id': self.division_id}
        elif self.admin_level == 'district':
            return {'scope': 'district', 'district_id': self.district_id}
        elif self.admin_level == 'school':
            return {'scope': 'school', 'school_id': self.school_id}
        return {'scope': 'none'}
    
    def can_create_user_type(self, target_role):
        """Check if this admin can create users of the target role"""
        if self.admin_level == 'central':
            return True  # Central can create anyone
        elif self.admin_level == 'division':
            # Division can create district, school, and region (if instructed by central)
            return target_role in ['district', 'school', 'region']
        return False  # Other levels cannot create users
    
    def can_access_area(self, region_id=None, division_id=None, district_id=None, school_id=None):
        """Check if this admin can access the specified geographic area"""
        if self.admin_level == 'central':
            return True
        elif self.admin_level == 'region':
            return self.region_id == region_id
        elif self.admin_level == 'division':
            return self.division_id == division_id
        elif self.admin_level == 'district':
            return self.district_id == district_id
        elif self.admin_level == 'school':
            return self.school_id == school_id
        return False

class AuditTrail(models.Model):
    ACTION_CHOICES = [
        ('edit', 'Edit'),
        ('delete', 'Delete'),
    ]
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(get_user_model(), null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_trail'
        ordering = ['-timestamp']

# === SECURITY & AUDIT MODELS ===

class EncryptionKey(models.Model):
    key_id = models.CharField(max_length=50, unique=True)
    key_purpose = models.CharField(max_length=100)
    encrypted_key = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    rotation_count = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Encryption Key'
        verbose_name_plural = 'Encryption Keys'
        db_table = 'encryption_keys'

class ComplianceReport(models.Model):
    REPORT_TYPE_CHOICES = [
        ('gdpr', 'GDPR Compliance Report'),
        ('security_audit', 'Security Audit Report'),
        ('data_access', 'Data Access Report'),
        ('user_activity', 'User Activity Report'),
        ('incident_summary', 'Security Incident Summary'),
    ]
    
    id = models.AutoField(primary_key=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    date_from = models.DateTimeField()
    date_to = models.DateTimeField()
    report_data = models.JSONField(default=dict)
    file_path = models.CharField(max_length=500, blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_encrypted = models.BooleanField(default=True)
    generated_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        db_table = 'compliance_reports'
        ordering = ['-generated_at']

class DataSubjectRequest(models.Model):
    REQUEST_TYPE_CHOICES = [
        ('access', 'Data Access Request'),
        ('rectification', 'Data Rectification'),
        ('erasure', 'Data Erasure (Right to be Forgotten)'),
        ('portability', 'Data Portability'),
        ('restriction', 'Restriction of Processing'),
        ('objection', 'Objection to Processing'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    request_type = models.CharField(max_length=15, choices=REQUEST_TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    response_data = models.JSONField(blank=True, default=dict)
    verification_token = models.CharField(max_length=100, unique=True)
    processed_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, related_name='processed_requests')

    class Meta:
        db_table = 'data_subject_requests'
        ordering = ['-submitted_at']

class EncryptedFormData(models.Model):
    form_id = models.CharField(max_length=50)
    question_id = models.CharField(max_length=50)
    encrypted_data = models.TextField()
    encryption_key_id = models.CharField(max_length=50)
    data_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    accessed_at = models.DateTimeField(blank=True, null=True)
    access_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'encrypted_form_data'
        indexes = [
            models.Index(fields=['form_id', 'question_id'], name='encrypted_f_form_id_af8dc3_idx'),
            models.Index(fields=['encryption_key_id'], name='encrypted_f_encrypt_d2d653_idx'),
        ]

class LoginAttempt(models.Model):
    username = models.CharField(max_length=150)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    success = models.BooleanField()
    failure_reason = models.CharField(max_length=100, blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    is_suspicious = models.BooleanField(default=False)
    blocked = models.BooleanField(default=False)

    class Meta:
        db_table = 'login_attempts'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['username', 'timestamp'], name='login_attem_usernam_ece61f_idx'),
            models.Index(fields=['ip_address', 'timestamp'], name='login_attem_ip_addr_340a7c_idx'),
            models.Index(fields=['success', 'timestamp'], name='login_attem_success_f3dfbd_idx'),
        ]

class SecurityAlert(models.Model):
    ALERT_TYPE_CHOICES = [
        ('failed_login', 'Multiple Failed Logins'),
        ('suspicious_activity', 'Suspicious Activity'),
        ('data_breach', 'Potential Data Breach'),
        ('unauthorized_access', 'Unauthorized Access'),
        ('system_compromise', 'System Compromise'),
        ('policy_violation', 'Policy Violation'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    id = models.AutoField(primary_key=True)
    alert_type = models.CharField(max_length=25, choices=ALERT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(blank=True, default=dict)
    acknowledged_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, blank=True, null=True, related_name='acknowledged_alerts')
    affected_user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, blank=True, null=True)

    class Meta:
        db_table = 'security_alerts'
        ordering = ['-created_at']

class SecurityIncident(models.Model):
    INCIDENT_TYPE_CHOICES = [
        ('brute_force', 'Brute Force Attack'),
        ('suspicious_login', 'Suspicious Login'),
        ('data_breach', 'Data Breach'),
        ('unauthorized_access', 'Unauthorized Access'),
        ('malware', 'Malware Detection'),
        ('phishing', 'Phishing Attempt'),
        ('ddos', 'DDoS Attack'),
        ('privilege_escalation', 'Privilege Escalation'),
        ('data_exfiltration', 'Data Exfiltration'),
        ('other', 'Other'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('investigating', 'Under Investigation'),
        ('resolved', 'Resolved'),
        ('false_positive', 'False Positive'),
    ]
    
    id = models.AutoField(primary_key=True)
    incident_type = models.CharField(max_length=30, choices=INCIDENT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    ip_addresses = models.JSONField(blank=True, default=list)
    detection_time = models.DateTimeField(auto_now_add=True)
    resolution_time = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True)
    automated_response = models.BooleanField(default=False)
    affected_users = models.ManyToManyField('auth.User', blank=True)
    assigned_to = models.ForeignKey('auth.User', on_delete=models.SET_NULL, blank=True, null=True, related_name='assigned_incidents')

    class Meta:
        db_table = 'security_incidents'
        ordering = ['-detection_time']

class SecuritySettings(models.Model):
    setting_key = models.CharField(max_length=100, unique=True)
    setting_value = models.TextField()
    description = models.TextField(blank=True)
    is_encrypted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True)

    class Meta:
        verbose_name = 'Security Setting'
        verbose_name_plural = 'Security Settings'
        db_table = 'security_settings'

# Duplicate AuditLog model removed - using the one defined earlier

# Duplicate DataProcessingConsent and TwoFactorAuth models removed - using the ones defined earlier


class DataRetentionPolicy(models.Model):
    name = models.CharField(max_length=100, default='Default Policy')
    description = models.TextField(blank=True)
    retention_period_days = models.IntegerField(default=365)
    data_types = models.JSONField(default=list)  # Added default value
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'data_retention_policies'

class AccountLockout(models.Model):
    user = models.ForeignKey(UsersSchool, on_delete=models.CASCADE)
    locked_at = models.DateTimeField(auto_now_add=True)
    unlock_at = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(max_length=200)
    failed_attempts = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'account_lockouts'

class AuditLog(models.Model):
    ACTION_TYPE_CHOICES = [
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('create', 'Create Record'),
        ('read', 'Read Record'),
        ('update', 'Update Record'),
        ('delete', 'Delete Record'),
        ('export', 'Data Export'),
        ('import', 'Data Import'),
        ('permission_change', 'Permission Change'),
        ('security_change', 'Security Setting Change'),
        ('failed_login', 'Failed Login Attempt'),
        ('password_change', 'Password Change'),
        ('account_lock', 'Account Locked'),
        ('account_unlock', 'Account Unlocked'),
        ('data_access', 'Sensitive Data Access'),
        ('backup', 'Data Backup'),
        ('restore', 'Data Restore'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey('auth.User', on_delete=models.SET_NULL, blank=True, null=True)
    session_id = models.CharField(max_length=100, blank=True, null=True)
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='low')
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)
    metadata = models.JSONField(blank=True, default=dict)
    encrypted_data = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp'], name='audit_logs_user_id_88267f_idx'),
            models.Index(fields=['action_type', 'timestamp'], name='audit_logs_action__11f9f1_idx'),
            models.Index(fields=['severity', 'timestamp'], name='audit_logs_severit_549d29_idx'),
            models.Index(fields=['ip_address', 'timestamp'], name='audit_logs_ip_addr_932507_idx'),
            models.Index(fields=['resource_type', 'resource_id'], name='audit_logs_resourc_bda8a6_idx'),
        ]

class DataProcessingConsent(models.Model):
    CONSENT_TYPE_CHOICES = [
        ('data_processing', 'Data Processing'),
        ('marketing', 'Marketing Communications'),
        ('analytics', 'Analytics'),
        ('third_party', 'Third Party Sharing'),
    ]
    
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    consent_type = models.CharField(max_length=20, choices=CONSENT_TYPE_CHOICES)
    granted = models.BooleanField()
    granted_at = models.DateTimeField(auto_now_add=True)
    withdrawn_at = models.DateTimeField(blank=True, null=True)
    ip_address = models.GenericIPAddressField()
    consent_text = models.TextField()
    version = models.CharField(max_length=10, default='1.0')

    class Meta:
        db_table = 'data_processing_consent'
        unique_together = [('user', 'consent_type', 'version')]


# === ADMIN USER SYSTEM MODELS ===

class AdminUserPermission(models.Model):
    """Fine-grained permissions for admin users"""
    RESOURCE_TYPE_CHOICES = [
        ('user', 'User Management'),
        ('form', 'Form Management'),
        ('report', 'Report Management'),
        ('system', 'System Management'),
        ('school_data', 'School Data'),
    ]
    
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('read', 'Read'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('approve', 'Approve'),
        ('manage', 'Manage'),
    ]
    
    SCOPE_CHOICES = [
        ('own', 'Own Data Only'),
        ('assigned_area', 'Assigned Area'),
        ('all', 'All Data'),
    ]
    
    permission_id = models.AutoField(primary_key=True)
    admin_user = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='permissions')
    permission_name = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPE_CHOICES)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    scope = models.CharField(max_length=15, choices=SCOPE_CHOICES, default='assigned_area')
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(AdminUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='granted_permissions')
    
    class Meta:
        db_table = 'admin_user_permissions'
        unique_together = [('admin_user', 'permission_name', 'resource_type', 'action')]
        indexes = [
            models.Index(fields=['admin_user', 'resource_type'], name='adm_perm_usr_res_idx'),
            models.Index(fields=['resource_type', 'action'], name='adm_perm_res_act_idx'),
        ]
    
    def __str__(self):
        return f"{self.admin_user.username} - {self.permission_name}"


class AdminActivityLog(models.Model):
    """Comprehensive audit trail for admin user activities"""
    log_id = models.BigAutoField(primary_key=True)
    admin_user = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=50)
    resource_id = models.CharField(max_length=50, null=True, blank=True)
    details = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'admin_activity_log'
        indexes = [
            models.Index(fields=['admin_user', 'timestamp'], name='adm_log_usr_time_idx'),
            models.Index(fields=['action', 'timestamp'], name='adm_log_act_time_idx'),
            models.Index(fields=['resource_type', 'timestamp'], name='adm_log_res_time_idx'),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.admin_user.username} - {self.action} at {self.timestamp}"


class AdminSession(models.Model):
    """Session management for admin users"""
    session_id = models.CharField(max_length=128, primary_key=True)
    admin_user = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='sessions')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'admin_sessions'
        indexes = [
            models.Index(fields=['admin_user', 'is_active'], name='adm_sess_usr_act_idx'),
            models.Index(fields=['expires_at'], name='adm_sess_exp_idx'),
        ]
    
    def __str__(self):
        return f"Session for {self.admin_user.username}"
    
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at


class FormDeadline(models.Model):
    """Deadline management for forms by geographic area"""
    deadline_id = models.AutoField(primary_key=True)
    region = models.ForeignKey('Region', on_delete=models.CASCADE, null=True, blank=True)
    division = models.ForeignKey('Division', on_delete=models.CASCADE, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.CASCADE, null=True, blank=True)
    form_type = models.CharField(max_length=100)
    deadline_date = models.DateTimeField()
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='created_deadlines')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'form_deadlines'
        indexes = [
            models.Index(fields=['region', 'deadline_date']),
            models.Index(fields=['division', 'deadline_date']),
            models.Index(fields=['district', 'deadline_date']),
            models.Index(fields=['form_type', 'deadline_date']),
        ]
    
    def __str__(self):
        area = self.region.name if self.region else (
            self.division.name if self.division else (
                self.district.name if self.district else "All Areas"
            )
        )
        return f"{self.form_type} deadline for {area}"


class FormApproval(models.Model):
    """Track approval workflow for forms"""
    APPROVAL_LEVEL_CHOICES = [
        ('district', 'District'),
        ('division', 'Division'),
        ('region', 'Region'),
        ('central', 'Central Office'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('returned', 'Returned for Revision'),
    ]
    
    approval_id = models.BigAutoField(primary_key=True)
    form = models.ForeignKey('Form', on_delete=models.CASCADE, related_name='approvals')
    approver = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='approvals_made')
    approval_level = models.CharField(max_length=10, choices=APPROVAL_LEVEL_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    comments = models.TextField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'form_approvals'
        indexes = [
            models.Index(fields=['form', 'approval_level']),
            models.Index(fields=['approver', 'status']),
            models.Index(fields=['approval_level', 'status']),
        ]
    
    def __str__(self):
        return f"Form {self.form_id} - {self.get_approval_level_display()} - {self.get_status_display()}"


class UserCreationRequest(models.Model):
    """Track user creation requests and approvals"""
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'User Created'),
    ]
    
    request_id = models.AutoField(primary_key=True)
    requested_by = models.ForeignKey(AdminUser, on_delete=models.CASCADE, related_name='user_creation_requests')
    username = models.CharField(max_length=100)
    email = models.CharField(max_length=150)
    full_name = models.CharField(max_length=150)
    requested_role = models.CharField(max_length=20)
    region = models.ForeignKey('Region', on_delete=models.SET_NULL, null=True, blank=True)
    division = models.ForeignKey('Division', on_delete=models.SET_NULL, null=True, blank=True)
    district = models.ForeignKey('District', on_delete=models.SET_NULL, null=True, blank=True)
    school = models.ForeignKey('School', on_delete=models.SET_NULL, null=True, blank=True)
    justification = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(AdminUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='user_approvals')
    approval_comments = models.TextField(null=True, blank=True)
    created_user = models.ForeignKey('UsersSchool', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'user_creation_requests'
        indexes = [
            models.Index(fields=['requested_by', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]
    
    def __str__(self):
        return f"Request to create {self.username} ({self.requested_role})"
