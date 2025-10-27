from rest_framework import serializers
from .models import Category, AdminUser, School

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['category_id', 'name', 'display_order']

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminUser
        fields = [
            'admin_id', 'username', 'email', 'full_name', 'admin_level', 'assigned_area', 
            'status', 'region', 'division', 'district', 'school', 'last_login', 'created_at'
        ]

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = [
            'school_name', 'school_id', 'district', 'division', 'region', 'created_at'
        ] 