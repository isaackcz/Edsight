from django.shortcuts import render, redirect
from django.http import JsonResponse
from app.models import AdminUser

def user_dashboard(request):
    """
    User dashboard view that works with session-based admin authentication.
    Access admin user data through session admin_id.
    """
    # Enhanced session authentication check
    admin_id = request.session.get('admin_id')
    
    # Debug logging
    print(f"DEBUG: User dashboard accessed")
    print(f"DEBUG: Request method: {request.method}")
    print(f"DEBUG: Session key: {request.session.session_key}")
    print(f"DEBUG: Session admin_id: {admin_id}")
    print(f"DEBUG: All session data: {dict(request.session)}")
    
    # If no admin_id, try alternative authentication methods
    if not admin_id:
        print(f"DEBUG: No admin_id in session")
        
        # Check if user is authenticated via Django auth (fallback)
        if request.user.is_authenticated:
            print(f"DEBUG: User authenticated via Django: {request.user.username}")
            # Try to find corresponding AdminUser
            try:
                admin_user = AdminUser.objects.filter(email=request.user.email).first()
                if admin_user:
                    print(f"DEBUG: Found AdminUser for Django user: {admin_user.admin_id}")
                    admin_id = admin_user.admin_id
                    # Update session
                    request.session['admin_id'] = admin_id
                    request.session['user_type'] = 'school_user' if admin_user.admin_level == 'school' else 'admin'
                    request.session['email'] = admin_user.email
                    request.session['admin_level'] = admin_user.admin_level
                    request.session.save()
                    print(f"DEBUG: Updated session with admin_id: {admin_id}")
            except Exception as e:
                print(f"DEBUG: Error finding AdminUser: {e}")
        
        # If still no admin_id, redirect to login
        if not admin_id:
            print(f"DEBUG: Still no admin_id, redirecting to login")
            return redirect('/auth/login/?next=/user-dashboard/')
    
    try:
        # Get the AdminUser record
        admin_user = AdminUser.objects.select_related('school', 'region', 'division', 'district').get(admin_id=admin_id)
        
        context = {
            'user': {
                'id': admin_user.admin_id,
                'username': admin_user.username,
                'email': admin_user.email,
                'is_authenticated': True
            },
            'admin_user': admin_user,
            'school_name': admin_user.school.school_name if admin_user.school else admin_user.assigned_area,
            'role': admin_user.admin_level,
            'full_name': admin_user.full_name,
            'assigned_area': admin_user.assigned_area,
            'admin_level': admin_user.admin_level,
            'user_type': request.session.get('user_type', 'school_user')
        }
        
    except AdminUser.DoesNotExist:
        # If admin user not found, redirect to login
        return redirect('/auth/login/?next=/user-dashboard/')
    
    return render(request, 'dashboard/user_dash.html', context)
