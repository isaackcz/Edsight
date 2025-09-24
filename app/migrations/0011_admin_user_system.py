# Generated manually for admin user system implementation

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0010_add_sub_question_to_answer'),
    ]

    operations = [
        # Update AdminUser model with new fields
        migrations.AlterField(
            model_name='adminuser',
            name='admin_level',
            field=models.CharField(choices=[('central', 'Central Office'), ('region', 'Region'), ('division', 'Division'), ('district', 'District'), ('school', 'School')], max_length=10),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='region',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.region'),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='division',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.division'),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='district',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.district'),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='school',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.school'),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='can_create_users',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='can_manage_users',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='can_set_deadlines',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='can_approve_submissions',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='can_view_system_logs',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_users', to='app.adminuser'),
        ),
        migrations.AddField(
            model_name='adminuser',
            name='updated_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_users', to='app.adminuser'),
        ),

        # Add indexes for AdminUser
        migrations.AddIndex(
            model_name='adminuser',
            index=models.Index(fields=['admin_level', 'status'], name='admin_user_level_status_idx'),
        ),
        migrations.AddIndex(
            model_name='adminuser',
            index=models.Index(fields=['region', 'division', 'district'], name='admin_user_coverage_idx'),
        ),

        # Create AdminUserPermission model
        migrations.CreateModel(
            name='AdminUserPermission',
            fields=[
                ('permission_id', models.AutoField(primary_key=True, serialize=False)),
                ('permission_name', models.CharField(max_length=100)),
                ('resource_type', models.CharField(choices=[('user', 'User Management'), ('form', 'Form Management'), ('report', 'Report Management'), ('system', 'System Management'), ('school_data', 'School Data')], max_length=20)),
                ('action', models.CharField(choices=[('create', 'Create'), ('read', 'Read'), ('update', 'Update'), ('delete', 'Delete'), ('approve', 'Approve'), ('manage', 'Manage')], max_length=10)),
                ('scope', models.CharField(choices=[('own', 'Own Data Only'), ('assigned_area', 'Assigned Area'), ('all', 'All Data')], default='assigned_area', max_length=15)),
                ('granted_at', models.DateTimeField(auto_now_add=True)),
                ('admin_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='permissions', to='app.adminuser')),
                ('granted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='granted_permissions', to='app.adminuser')),
            ],
            options={
                'db_table': 'admin_user_permissions',
            },
        ),

        # Create AdminActivityLog model
        migrations.CreateModel(
            name='AdminActivityLog',
            fields=[
                ('log_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('action', models.CharField(max_length=100)),
                ('resource_type', models.CharField(max_length=50)),
                ('resource_id', models.CharField(blank=True, max_length=50, null=True)),
                ('details', models.JSONField(blank=True, null=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('admin_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activity_logs', to='app.adminuser')),
            ],
            options={
                'db_table': 'admin_activity_log',
                'ordering': ['-timestamp'],
            },
        ),

        # Create AdminSession model
        migrations.CreateModel(
            name='AdminSession',
            fields=[
                ('session_id', models.CharField(max_length=128, primary_key=True, serialize=False)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_activity', models.DateTimeField(auto_now=True)),
                ('expires_at', models.DateTimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('admin_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to='app.adminuser')),
            ],
            options={
                'db_table': 'admin_sessions',
            },
        ),

        # Create FormDeadline model
        migrations.CreateModel(
            name='FormDeadline',
            fields=[
                ('deadline_id', models.AutoField(primary_key=True, serialize=False)),
                ('form_type', models.CharField(max_length=100)),
                ('deadline_date', models.DateTimeField()),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('region', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='app.region')),
                ('division', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='app.division')),
                ('district', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='app.district')),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_deadlines', to='app.adminuser')),
            ],
            options={
                'db_table': 'form_deadlines',
            },
        ),

        # Create FormApproval model
        migrations.CreateModel(
            name='FormApproval',
            fields=[
                ('approval_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('approval_level', models.CharField(choices=[('district', 'District'), ('division', 'Division'), ('region', 'Region'), ('central', 'Central Office')], max_length=10)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('returned', 'Returned for Revision')], default='pending', max_length=10)),
                ('comments', models.TextField(blank=True, null=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('form', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='approvals', to='app.form')),
                ('approver', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='approvals_made', to='app.adminuser')),
            ],
            options={
                'db_table': 'form_approvals',
            },
        ),

        # Create UserCreationRequest model
        migrations.CreateModel(
            name='UserCreationRequest',
            fields=[
                ('request_id', models.AutoField(primary_key=True, serialize=False)),
                ('username', models.CharField(max_length=100)),
                ('email', models.CharField(max_length=150)),
                ('full_name', models.CharField(max_length=150)),
                ('requested_role', models.CharField(max_length=20)),
                ('justification', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Pending Approval'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'User Created')], default='pending', max_length=10)),
                ('approval_comments', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_creation_requests', to='app.adminuser')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='user_approvals', to='app.adminuser')),
                ('region', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.region')),
                ('division', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.division')),
                ('district', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.district')),
                ('school', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.school')),
                ('created_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='app.usersschool')),
            ],
            options={
                'db_table': 'user_creation_requests',
            },
        ),

        # Update UsersSchool model with admin tracking
        migrations.AddField(
            model_name='usersschool',
            name='created_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_school_users', to='app.adminuser'),
        ),
        migrations.AddField(
            model_name='usersschool',
            name='approved_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_school_users', to='app.adminuser'),
        ),
        migrations.AddField(
            model_name='usersschool',
            name='approval_status',
            field=models.CharField(choices=[('pending', 'Pending Approval'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='approved', max_length=10),
        ),

        # Add indexes for performance
        migrations.AddIndex(
            model_name='adminuserpermission',
            index=models.Index(fields=['admin_user', 'resource_type'], name='adm_perm_usr_res_idx'),
        ),
        migrations.AddIndex(
            model_name='adminactivitylog',
            index=models.Index(fields=['admin_user', 'timestamp'], name='adm_log_usr_time_idx'),
        ),
        migrations.AddIndex(
            model_name='adminsession',
            index=models.Index(fields=['admin_user', 'is_active'], name='adm_sess_usr_act_idx'),
        ),
        migrations.AddIndex(
            model_name='formdeadline',
            index=models.Index(fields=['region', 'deadline_date'], name='deadline_reg_date_idx'),
        ),
        migrations.AddIndex(
            model_name='formapproval',
            index=models.Index(fields=['form', 'approval_level'], name='appr_form_level_idx'),
        ),
        migrations.AddIndex(
            model_name='usersschool',
            index=models.Index(fields=['created_by'], name='usr_sch_created_by_idx'),
        ),

        # Add unique constraints
        migrations.AddConstraint(
            model_name='adminuserpermission',
            constraint=models.UniqueConstraint(fields=['admin_user', 'permission_name', 'resource_type', 'action'], name='unique_admin_permission'),
        ),
    ]
