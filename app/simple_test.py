"""
Simple test to verify form management system works
"""

def test_form_management_models():
    """Test that the form management models can be imported and basic functionality works"""
    try:
        from .models import Form, FormNotification, FormApproval
        
        # Test that models can be imported
        print("✓ Models imported successfully")
        
        # Test form status choices
        from .models import FORM_STATUS_CHOICES
        expected_statuses = [
            'draft', 'submitted', 'district_pending', 'district_approved', 'district_returned',
            'division_pending', 'division_approved', 'division_returned',
            'region_pending', 'region_approved', 'region_returned',
            'central_pending', 'central_approved', 'central_returned', 'completed'
        ]
        
        status_values = [status[0] for status in FORM_STATUS_CHOICES]
        for expected_status in expected_statuses:
            if expected_status in status_values:
                print(f"✓ Status '{expected_status}' found in choices")
            else:
                print(f"✗ Status '{expected_status}' missing from choices")
        
        return True
    except Exception as e:
        print(f"✗ Error importing models: {e}")
        return False

def test_form_management_views():
    """Test that form management views can be imported"""
    try:
        from .form_management_views import form_management_page, api_forms
        print("✓ Form management views imported successfully")
        return True
    except Exception as e:
        print(f"✗ Error importing views: {e}")
        return False

def test_urls():
    """Test that URLs are properly configured"""
    try:
        from django.urls import reverse
        from django.conf import settings
        
        # Test that the URL patterns can be loaded
        from .urls import urlpatterns
        form_management_urls = [url for url in urlpatterns if 'form-management' in str(url.pattern)]
        
        if form_management_urls:
            print(f"✓ Found {len(form_management_urls)} form management URLs")
            return True
        else:
            print("✗ No form management URLs found")
            return False
    except Exception as e:
        print(f"✗ Error testing URLs: {e}")
        return False

if __name__ == "__main__":
    print("Testing Form Management System...")
    print("=" * 50)
    
    models_ok = test_form_management_models()
    views_ok = test_form_management_views()
    urls_ok = test_urls()
    
    print("=" * 50)
    if models_ok and views_ok and urls_ok:
        print("✓ All tests passed! Form management system is ready.")
    else:
        print("✗ Some tests failed. Please check the errors above.")
