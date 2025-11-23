"""
Role Analytics Service
Business logic for aggregating and processing role and access statistics
"""

from django.db.models import Count, Q, F, Sum
from django.utils import timezone
from datetime import timedelta
from apps.core.models import (
    AdminUser, AdminUserPermission, AdminActivityLog,
    Region, Division, District, School
)


class RoleAnalyticsService:
    """Service class for role analytics data aggregation"""
    
    @staticmethod
    def get_overall_statistics():
        """Get overall statistics for summary cards - only role and permission counts"""
        # Count by role
        role_counts = AdminUser.objects.values('admin_level').annotate(
            count=Count('admin_id')
        )
        role_stats = {item['admin_level']: item['count'] for item in role_counts}
        
        # Count by permission
        permission_counts = {
            'can_create_users': AdminUser.objects.filter(can_create_users=True).count(),
            'can_manage_users': AdminUser.objects.filter(can_manage_users=True).count(),
            'can_set_deadlines': AdminUser.objects.filter(can_set_deadlines=True).count(),
            'can_approve_submissions': AdminUser.objects.filter(can_approve_submissions=True).count(),
            'can_view_system_logs': AdminUser.objects.filter(can_view_system_logs=True).count(),
        }
        
        return {
            'role_counts': {
                'central': role_stats.get('central', 0),
                'region': role_stats.get('region', 0),
                'division': role_stats.get('division', 0),
                'district': role_stats.get('district', 0),
                'school': role_stats.get('school', 0),
            },
            'permission_counts': permission_counts
        }
    
    @staticmethod
    def get_role_distribution():
        """Get data for role distribution chart"""
        distribution = AdminUser.objects.values('admin_level').annotate(
            count=Count('admin_id')
        ).order_by('admin_level')
        
        labels = []
        data = []
        colors = {
            'central': '#FF6384',
            'region': '#36A2EB',
            'division': '#FFCE56',
            'district': '#4BC0C0',
            'school': '#9966FF'
        }
        
        role_names = {
            'central': 'Central Office',
            'region': 'Region',
            'division': 'Division',
            'district': 'District',
            'school': 'School'
        }
        
        for item in distribution:
            labels.append(role_names.get(item['admin_level'], item['admin_level']))
            data.append(item['count'])
        
        return {
            'labels': labels,
            'data': data,
            'colors': [colors.get(level, '#CCCCCC') for level in [item['admin_level'] for item in distribution]]
        }
    
    @staticmethod
    def get_permission_usage():
        """Get permission usage by role for stacked bar chart"""
        roles = ['central', 'region', 'division', 'district', 'school']
        permissions = [
            'can_create_users',
            'can_manage_users',
            'can_set_deadlines',
            'can_approve_submissions',
            'can_view_system_logs'
        ]
        
        permission_names = {
            'can_create_users': 'Create Users',
            'can_manage_users': 'Manage Users',
            'can_set_deadlines': 'Set Deadlines',
            'can_approve_submissions': 'Approve Submissions',
            'can_view_system_logs': 'View System Logs'
        }
        
        datasets = []
        colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF']
        
        for idx, permission in enumerate(permissions):
            data = []
            for role in roles:
                count = AdminUser.objects.filter(
                    admin_level=role,
                    **{permission: True}
                ).count()
                data.append(count)
            
            datasets.append({
                'label': permission_names[permission],
                'data': data,
                'backgroundColor': colors[idx % len(colors)]
            })
        
        return {
            'labels': ['Central', 'Region', 'Division', 'District', 'School'],
            'datasets': datasets
        }
    
    @staticmethod
    def get_geographic_distribution():
        """Get geographic distribution data"""
        # By region
        region_data = AdminUser.objects.filter(
            region__isnull=False
        ).values('region__name').annotate(
            count=Count('admin_id')
        ).order_by('-count')[:10]
        
        # By division
        division_data = AdminUser.objects.filter(
            division__isnull=False
        ).values('division__name').annotate(
            count=Count('admin_id')
        ).order_by('-count')[:10]
        
        # By district
        district_data = AdminUser.objects.filter(
            district__isnull=False
        ).values('district__name').annotate(
            count=Count('admin_id')
        ).order_by('-count')[:10]
        
        return {
            'regions': [
                {'name': item['region__name'], 'count': item['count']}
                for item in region_data
            ],
            'divisions': [
                {'name': item['division__name'], 'count': item['count']}
                for item in division_data
            ],
            'districts': [
                {'name': item['district__name'], 'count': item['count']}
                for item in district_data
            ]
        }
    
    @staticmethod
    def get_activity_timeline():
        """Get user activity timeline data"""
        from django.db.models.functions import TruncMonth
        
        # Get user creation timeline (last 12 months)
        end_date = timezone.now()
        start_date = end_date - timedelta(days=365)
        
        # Group by month using Django's TruncMonth
        timeline_data = AdminUser.objects.filter(
            created_at__gte=start_date
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            count=Count('admin_id')
        ).order_by('month')
        
        labels = []
        data = []
        
        for item in timeline_data:
            # Format month as YYYY-MM
            month_str = item['month'].strftime('%Y-%m') if item['month'] else ''
            labels.append(month_str)
            data.append(item['count'])
        
        return {
            'labels': labels,
            'data': data
        }
    
    @staticmethod
    def get_permission_flags_breakdown():
        """Get breakdown of permission flags"""
        permissions = {
            'can_create_users': AdminUser.objects.filter(can_create_users=True).count(),
            'can_manage_users': AdminUser.objects.filter(can_manage_users=True).count(),
            'can_set_deadlines': AdminUser.objects.filter(can_set_deadlines=True).count(),
            'can_approve_submissions': AdminUser.objects.filter(can_approve_submissions=True).count(),
            'can_view_system_logs': AdminUser.objects.filter(can_view_system_logs=True).count(),
        }
        
        permission_names = {
            'can_create_users': 'Create Users',
            'can_manage_users': 'Manage Users',
            'can_set_deadlines': 'Set Deadlines',
            'can_approve_submissions': 'Approve Submissions',
            'can_view_system_logs': 'View System Logs'
        }
        
        labels = [permission_names[key] for key in permissions.keys()]
        data = list(permissions.values())
        
        return {
            'labels': labels,
            'data': data
        }
    
    @staticmethod
    def get_access_scope_analysis():
        """Get access scope hierarchy analysis"""
        # Count users by access scope type
        central_count = AdminUser.objects.filter(admin_level='central').count()
        regional_count = AdminUser.objects.filter(
            admin_level='region',
            region__isnull=False
        ).count()
        divisional_count = AdminUser.objects.filter(
            admin_level='division',
            division__isnull=False
        ).count()
        district_count = AdminUser.objects.filter(
            admin_level='district',
            district__isnull=False
        ).count()
        school_count = AdminUser.objects.filter(
            admin_level='school',
            school__isnull=False
        ).count()
        
        return {
            'labels': ['Central', 'Regional', 'Divisional', 'District', 'School'],
            'data': [central_count, regional_count, divisional_count, district_count, school_count]
        }
    
    @staticmethod
    def get_status_distribution():
        """Get status distribution data"""
        status_data = AdminUser.objects.values('status').annotate(
            count=Count('admin_id')
        )
        
        status_names = {
            'active': 'Active',
            'inactive': 'Inactive',
            'suspended': 'Suspended'
        }
        
        labels = []
        data = []
        colors = ['#4BC0C0', '#FFCE56', '#FF6384']
        
        for item in status_data:
            labels.append(status_names.get(item['status'], item['status']))
            data.append(item['count'])
        
        return {
            'labels': labels,
            'data': data,
            'colors': colors[:len(labels)]
        }
    
    @staticmethod
    def get_paginated_users(offset=0, limit=100, search_query=None, role_filter=None, status_filter=None, sort_column='username', sort_direction='asc'):
        """Get paginated user data for table with sorting"""
        queryset = AdminUser.objects.select_related(
            'region', 'division', 'district', 'school'
        ).all()
        
        # Apply filters
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(full_name__icontains=search_query)
            )
        
        if role_filter:
            queryset = queryset.filter(admin_level=role_filter)
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Apply sorting
        sort_field_map = {
            'username': 'username',
            'admin_level': 'admin_level',
            'assignment': 'region__name',  # Sort by region name as primary
            'access_scope': 'admin_level',  # Sort by admin level
            'status': 'status',
            'last_active': 'last_login'
        }
        
        sort_field = sort_field_map.get(sort_column, 'username')
        if sort_direction == 'desc':
            sort_field = f'-{sort_field}'
        
        queryset = queryset.order_by(sort_field)
        
        # Get total count before pagination
        total_count = queryset.count()
        
        # Apply pagination
        users = queryset[offset:offset + limit]
        
        # Format user data
        user_data = []
        for user in users:
            # Get geographic assignment
            assignment = []
            if user.region:
                assignment.append(user.region.name)
            if user.division:
                assignment.append(user.division.name)
            if user.district:
                assignment.append(user.district.name)
            if user.school:
                assignment.append(user.school.school_name)
            
            assignment_str = ' > '.join(assignment) if assignment else 'N/A'
            
            # Get permissions
            permissions = []
            if user.can_create_users:
                permissions.append('Create Users')
            if user.can_manage_users:
                permissions.append('Manage Users')
            if user.can_set_deadlines:
                permissions.append('Set Deadlines')
            if user.can_approve_submissions:
                permissions.append('Approve Submissions')
            if user.can_view_system_logs:
                permissions.append('View System Logs')
            
            # Get access scope
            access_scope = user.get_access_scope()
            
            # Last active
            if user.last_login:
                time_diff = timezone.now() - user.last_login
                if time_diff.days == 0:
                    last_active = "Today"
                elif time_diff.days == 1:
                    last_active = "Yesterday"
                else:
                    last_active = f"{time_diff.days} days ago"
            else:
                last_active = "Never"
            
            user_data.append({
                'admin_id': user.admin_id,
                'username': user.username,
                'full_name': user.full_name or user.username,
                'email': user.email,
                'admin_level': user.admin_level,
                'admin_level_display': user.get_admin_level_display(),
                'assignment': assignment_str,
                'permissions': permissions,
                'permission_count': len(permissions),
                'access_scope': access_scope.get('scope', 'none'),
                'last_active': last_active,
                'status': user.status,
                'status_display': user.get_status_display(),
                'created_at': user.created_at.isoformat() if user.created_at else None,
            })
        
        return {
            'users': user_data,
            'total_count': total_count,
            'offset': offset,
            'limit': limit,
            'has_more': (offset + limit) < total_count
        }

