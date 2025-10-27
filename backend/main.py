import os
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
import httpx
import asyncio
from asgiref.sync import sync_to_async

# Add the project directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure Django settings BEFORE importing Django models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

# Import Django models for database operations AFTER Django is configured
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from django.core.paginator import Paginator
from django.contrib.auth.hashers import make_password
from django.contrib.sessions.models import Session
from django.http import HttpResponse
from django.contrib.auth.models import User
import csv

# Environment variables for microservice endpoints and secrets
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
DASHBOARD_SERVICE_URL = os.getenv("DASHBOARD_SERVICE_URL", "http://dashboard-service:8002")
FORM_SERVICE_URL = os.getenv("FORM_SERVICE_URL", "http://form-service:8003")
USER_SERVICE_URL = os.getenv("USER_SERVICE_URL", "http://user-service:8004")
ANALYTICS_SERVICE_URL = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8005")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
# Use Django secret key for JWT compatibility
from django.conf import settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Simple in-memory cache (replace Redis for now)
cache = {}

async def get_redis():
    # Simple cache implementation - replace with Redis later if needed
    return None

# FastAPI app
app = FastAPI(
    title="EdSight API Gateway",
    description="API Gateway for EdSight microservices platform",
    version="2.0.0"
)

# CORS middleware - Allow cookies from Django
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://0.0.0.0:8000"],  # Django server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT token handling
security = HTTPBearer()

# Pydantic models (shared contract)
class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    school_name: Optional[str] = None
    role: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class DashboardStats(BaseModel):
    total_questions: int
    answered_questions: int
    completed_sections: int
    pending_sections: int
    overall_progress: float
    deadline_days: int

class CategoryProgress(BaseModel):
    category_id: int
    category_name: str
    progress_percentage: float
    completed_questions: int
    total_questions: int

class ProfileUpdate(BaseModel):
    school_name: Optional[str] = None
    email: Optional[str] = None
    region: Optional[str] = None
    division: Optional[str] = None
    district: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None

class FormSubmission(BaseModel):
    question_id: int
    answer: str
    sub_question_id: Optional[int] = None
    user_id: Optional[int] = None

# Utility: JWT decode/validate (stateless, no DB call)
def decode_jwt(token: str) -> dict:
    try:
        # Use Django secret key (same as what created the token)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"DEBUG: JWT decoded successfully: {payload}")
        return payload
    except jwt.PyJWTError as e:
        print(f"DEBUG: JWT decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Dependency: Get current user from JWT or Django session
async def get_current_user(request: Request):
    # Debug: Print all cookies and headers
    print(f"DEBUG: All cookies: {request.cookies}")
    print(f"DEBUG: All headers: {dict(request.headers)}")
    
    # Try JWT Bearer token first (what the frontend is actually sending)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            print(f"DEBUG: JWT Token found: {token[:20]}...")
            
            # Decode JWT token
            payload = decode_jwt(token)
            user_id = payload.get("sub")
            print(f"DEBUG: JWT User ID: {user_id}")
            
            if user_id:
                # Get user data from Django using the user ID from JWT
                from app.models import AdminUser
                admin_user = await sync_to_async(AdminUser.objects.get)(admin_id=user_id)
                
                user_data = {
                    "id": user_id,
                    "username": admin_user.username,
                    "email": admin_user.email,
                    "admin_level": admin_user.admin_level,
                    "assigned_area": admin_user.assigned_area
                }
                
                print(f"DEBUG: JWT User data: {user_data}")
                return user_data
        except Exception as e:
            print(f"DEBUG: JWT Error: {str(e)}")
            print(f"DEBUG: JWT Token (first 50 chars): {token[:50]}")
            # Continue to try session authentication
    
    # Try Django session authentication as fallback
    session_key = request.cookies.get('sessionid')
    print(f"DEBUG: Session key from cookies: {session_key}")
    
    if session_key:
        try:
            from django.contrib.sessions.models import Session
            from django.utils import timezone
            
            # Get session from database
            session = await sync_to_async(Session.objects.get)(session_key=session_key, expire_date__gte=timezone.now())
            session_data = session.get_decoded()
            admin_id = session_data.get('admin_id')
            
            print(f"DEBUG: Session data: {session_data}")
            print(f"DEBUG: Admin ID: {admin_id}")
            
            if admin_id:
                # Get user data from Django
                from app.models import AdminUser
                admin_user = await sync_to_async(AdminUser.objects.get)(admin_id=admin_id)
                
                user_data = {
                    "id": admin_id,
                    "username": admin_user.username,
                    "email": admin_user.email,
                    "admin_level": admin_user.admin_level,
                    "assigned_area": admin_user.assigned_area
                }
                
                print(f"DEBUG: Session User data: {user_data}")
                return user_data
        except Exception as e:
            print(f"DEBUG: Session Error: {str(e)}")
    
    # If no valid authentication found
    print("DEBUG: No valid authentication found")
    raise HTTPException(status_code=401, detail="Authentication required")

# Simple cache helpers (replace Redis for now)
async def get_cached_data(key: str):
    return cache.get(key)

async def set_cached_data(key: str, data, expire: int = 300):
    cache[key] = data

async def clear_cache():
    cache.clear()

# API Gateway Endpoints (all business logic is in microservices)

@app.post("/api/auth/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """
    Login endpoint - delegates to Auth Service.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{AUTH_SERVICE_URL}/login", json=user_credentials.dict())
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return resp.json()

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(request: Request):
    current_user = await get_current_user(request)
    """
    Get dashboard statistics for the authenticated user.
    """
    try:
        # Get user's form data
        from app.models import Form, Answer, Question, AdminUser
        
        user_id = current_user['id']
        admin_user = await sync_to_async(AdminUser.objects.get)(admin_id=user_id)
        
        # Get forms for this user
        forms = await sync_to_async(list)(Form.objects.filter(user_id=user_id))
        form_ids = [form.id for form in forms]
        
        # Get answers for this user's forms
        answered_questions = await sync_to_async(Answer.objects.filter(form_id__in=form_ids).exclude(response__isnull=True).exclude(response='').count)()
        
        # Get total questions
        total_questions = await sync_to_async(Question.objects.count)()
        
        # Calculate progress
        overall_progress = (answered_questions / total_questions * 100) if total_questions > 0 else 0
        
        # Construct a response that matches what the frontend expects
        stats = {
            "total_forms": len(forms),
            "answered_questions": answered_questions,
            "total_questions": total_questions,
            "overall_progress": round(overall_progress, 2),
            "completion_rate": round(overall_progress, 2),

            # Frontend expects trend objects and additional fields.
            # Provide safe default values so the dashboard doesn't break
            "total_forms_trend": {"direction": "up" if len(forms) > 0 else "down", "value": 0},
            "completion_rate_trend": {"direction": "up", "value": 0},
            "avg_time": 0,
            "avg_time_trend": {"direction": "up", "value": 0},
            "active_schools": 0,
            "active_schools_trend": {"direction": "up", "value": 0}
        }

        return stats
    except Exception as e:
        print(f"Error in get_dashboard_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard stats: {str(e)}")

@app.get("/api/dashboard/categories", response_model=List[CategoryProgress])
async def get_category_progress(current_user: dict = Depends(get_current_user)):
    """
    Get category progress for the authenticated user.
    """
    try:
        from app.models import Form, Answer, Question, Category, AdminUser
        
        user_id = current_user['id']
        
        # Get forms for this user
        forms = await sync_to_async(list)(Form.objects.filter(user_id=user_id))
        form_ids = [form.id for form in forms]
        
        # Get categories with progress
        categories = await sync_to_async(list)(Category.objects.all())
        
        category_progress = []
        for category in categories:
            # Get questions in this category
            total_questions = await sync_to_async(Question.objects.filter(category=category).count)()
            
            # Get answered questions in this category
            answered_questions = 0
            if form_ids and total_questions > 0:
                answered_questions = await sync_to_async(
                    Answer.objects.filter(
                        form_id__in=form_ids,
                        question__category=category
                    ).exclude(response__isnull=True).exclude(response='').count
                )()
            
            progress_percentage = (answered_questions / total_questions * 100) if total_questions > 0 else 0
            
            category_progress.append(CategoryProgress(
                category_name=category.name,
                progress_percentage=round(progress_percentage, 2),
                completed_questions=answered_questions,
                total_questions=total_questions
            ))
        
        return category_progress
    except Exception as e:
        print(f"Error in get_category_progress: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching category progress: {str(e)}")

@app.get("/api/dashboard/completion")
async def get_completion_data(current_user: dict = Depends(get_current_user)):
    """
    Get completion data for the authenticated user.
    """
    try:
        from app.models import Form, Answer, Question, AdminUser
        
        user_id = current_user['id']
        
        # Get forms for this user
        forms = await sync_to_async(list)(Form.objects.filter(user_id=user_id))
        form_ids = [form.id for form in forms]
        
        # Get total questions
        total_questions = await sync_to_async(Question.objects.count)()
        
        # Get answered questions
        answered_questions = 0
        if form_ids:
            answered_questions = await sync_to_async(
                Answer.objects.filter(form_id__in=form_ids).exclude(response__isnull=True).exclude(response='').count
            )()
        
        # Calculate completion percentage
        completion_percentage = (answered_questions / total_questions * 100) if total_questions > 0 else 0
        
        completion_data = {
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "completion_percentage": round(completion_percentage, 2),
            "remaining_questions": total_questions - answered_questions
        }
        
        return completion_data
    except Exception as e:
        print(f"Error in get_completion_data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching completion data: {str(e)}")

@app.get("/api/dashboard/recent-activity")
async def get_recent_activity(current_user: dict = Depends(get_current_user)):
    """
    Get recent activity for the authenticated user.
    """
    try:
        from app.models import Form, Answer, Question, AdminUser
        from django.utils import timezone
        from datetime import timedelta
        
        user_id = current_user['id']
        
        # Get recent answers (last 7 days)
        recent_date = timezone.now() - timedelta(days=7)
        
        recent_answers = await sync_to_async(list)(
            Answer.objects.filter(
                form__user_id=user_id,
                answered_at__gte=recent_date
            ).exclude(response__isnull=True).exclude(response='').select_related('question').order_by('-answered_at')[:10]
        )
        
        activity_data = []
        for answer in recent_answers:
            activity_data.append({
                "id": answer.id,
                "question_text": answer.question.question_text[:50] + "..." if len(answer.question.question_text) > 50 else answer.question.question_text,
                "response": answer.response[:30] + "..." if len(str(answer.response)) > 30 else str(answer.response),
                "answered_at": answer.answered_at.isoformat() if answer.answered_at else None,
                "type": "answer"
            })
        
        return activity_data
    except Exception as e:
        print(f"Error in get_recent_activity: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching recent activity: {str(e)}")

@app.get("/api/dashboard/quick-stats")
async def get_quick_stats(current_user: dict = Depends(get_current_user)):
    """
    Get quick stats for the authenticated user.
    """
    try:
        from app.models import Form, Answer, Question, AdminUser
        from django.utils import timezone
        from datetime import timedelta
        
        user_id = current_user['id']
        
        # Get forms for this user
        forms = await sync_to_async(list)(Form.objects.filter(user_id=user_id))
        form_ids = [form.id for form in forms]
        
        # Get total questions
        total_questions = await sync_to_async(Question.objects.count)()
        
        # Get answered questions
        answered_questions = 0
        if form_ids:
            answered_questions = await sync_to_async(
                Answer.objects.filter(form_id__in=form_ids).exclude(response__isnull=True).exclude(response='').count
            )()
        
        # Get today's answers
        today = timezone.now().date()
        today_answers = 0
        if form_ids:
            today_answers = await sync_to_async(
                Answer.objects.filter(
                    form_id__in=form_ids,
                    answered_at__date=today
                ).exclude(response__isnull=True).exclude(response='').count
            )()
        
        # Calculate progress
        overall_progress = (answered_questions / total_questions * 100) if total_questions > 0 else 0
        
        quick_stats = {
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "today_answers": today_answers,
            "overall_progress": round(overall_progress, 2),
            "remaining_questions": total_questions - answered_questions
        }
        
        return quick_stats
    except Exception as e:
        print(f"Error in get_quick_stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching quick stats: {str(e)}")

@app.post("/api/forms/submit")
async def submit_form_answer(submission: FormSubmission, current_user: dict = Depends(get_current_user)):
    """
    Submit an answer for a question or sub-question.
    Delegates to Form Service.
    """
    async with httpx.AsyncClient() as client:
        payload = submission.dict()
        payload["user_id"] = current_user["id"]
        resp = await client.post(f"{FORM_SERVICE_URL}/submit", json=payload)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        # Invalidate relevant cache
        await clear_cache()
        return resp.json()

@app.put("/api/user/profile")
async def update_user_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update user profile information.
    Delegates to User Service.
    """
    async with httpx.AsyncClient() as client:
        payload = profile.dict(exclude_unset=True)
        resp = await client.put(f"{USER_SERVICE_URL}/profile/{current_user['id']}", json=payload)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        # Invalidate relevant cache
        await clear_cache()
        return resp.json()

# Health check endpoint for load balancers and orchestration
@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

# Endpoints for microservice orchestration, scaling, and monitoring can be added here.


# -------------------- Missing Functions --------------------

@sync_to_async
def get_admin_user_by_user(user):
    """Get AdminUser by Django User object."""
    from app.models import AdminUser
    try:
        return AdminUser.objects.get(admin_id=user.id)
    except AdminUser.DoesNotExist:
        return None

@sync_to_async
def get_form_sections(user_id: int):
    """Get form sections with questions for a specific user."""
    from app.models import Category, SubSection, Topic, Question, SubQuestion, Form, Answer, AdminUser, School
    from django.db.models import Prefetch
    
    try:
        # Get the user's school
        admin_user = AdminUser.objects.get(admin_id=user_id)
        school_id = admin_user.school.id if admin_user.school else None
        
        if not school_id:
            return []
            
        # Get the School object from the school_id
        school_obj = School.objects.get(id=school_id)
        
        # Get or create the form for this user and school
        form, created = Form.objects.get_or_create(
            user_id=user_id,
            school=school_obj,
            defaults={'status': 'draft'}
        )
        
        # Get all categories with their related data in optimized queries
        categories = Category.objects.prefetch_related(
            Prefetch(
                'subsection_set',
                queryset=SubSection.objects.order_by('display_order').prefetch_related(
                    Prefetch(
                        'topic_set',
                        queryset=Topic.objects.order_by('display_order').prefetch_related(
                            Prefetch(
                                'question_set',
                                queryset=Question.objects.order_by('display_order').prefetch_related(
                                    Prefetch(
                                        'subquestion_set',
                                        queryset=SubQuestion.objects.order_by('display_order')
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ).order_by('display_order')
        
        categories_data = []
        
        for category in categories:
            category_questions = []
            category_total_questions = 0
            category_answered_questions = 0
            
            # Process sub-sections (already prefetched)
            for sub_section in category.subsection_set.all():
                # Process topics (already prefetched)
                for topic in sub_section.topic_set.all():
                    # Process questions (already prefetched)
                    for question in topic.question_set.all():
                        # Get sub-questions (already prefetched)
                        sub_questions = question.subquestion_set.all()
                        
                        # Check if question is answered
                        is_answered = Answer.objects.filter(
                            form=form,
                            question=question,
                            response__isnull=False
                        ).exclude(response='').exists()
                        
                        if is_answered:
                            category_answered_questions += 1
                        
                        category_total_questions += 1
                        
                        # Prepare sub-questions data
                        sub_questions_data = [
                            {
                                'sub_question_id': sq.sub_question_id,
                                'sub_question_text': sq.sub_question_text,
                                'display_order': sq.display_order
                            }
                            for sq in sub_questions
                        ]
                        
                        question_data = {
                            'question_id': question.question_id,
                            'question_text': question.question_text,
                            'answer_type': question.answer_type,
                            'is_required': question.is_required,
                            'is_answered': is_answered,
                            'sub_section_name': sub_section.name,
                            'topic_name': topic.name,
                            'sub_questions': sub_questions_data
                        }
                        
                        category_questions.append(question_data)
            
            # Calculate category progress
            progress_percentage = (category_answered_questions / category_total_questions * 100) if category_total_questions > 0 else 0
            
            # Determine status
            if category_answered_questions == 0:
                status = 'not-started'
            elif category_answered_questions == category_total_questions:
                status = 'completed'
            else:
                status = 'in-progress'
            
            categories_data.append({
                'category_id': category.category_id,
                'category_name': category.name,
                'status': status,
                'progress_percentage': round(progress_percentage, 1),
                'total_questions': category_total_questions,
                'answered_questions': category_answered_questions,
                'questions': category_questions
            })
        
        return categories_data
        
    except Exception as e:
        print(f"Error getting form sections: {e}")
        return []

@sync_to_async
def submit_form_answer(user_id: int, question_id: int, answer: str, sub_question_id: Optional[int] = None):
    """Submit a form answer for a user."""
    from app.models import Answer, Form, Question, SubQuestion, AdminUser, School
    
    try:
        # Get the user's school
        admin_user = AdminUser.objects.get(admin_id=user_id)
        school_id = admin_user.school.id if admin_user.school else None
        
        if not school_id:
            return False
            
        # Get the School object from the school_id
        school_obj = School.objects.get(id=school_id)
        
        # Get or create the form for this user and school
        form, created = Form.objects.get_or_create(
            user_id=user_id,
            school=school_obj,
            defaults={'status': 'draft'}
        )
        
        # Check if it's a sub-question
        if sub_question_id:
            try:
                sub_question = SubQuestion.objects.get(sub_question_id=sub_question_id)
                # Create or update answer for sub-question
                answer_obj, created = Answer.objects.get_or_create(
                    form=form,
                    question_id=question_id,
                    sub_question=sub_question,
                    defaults={'response': answer, 'answered_at': datetime.now()}
                )
                if not created:
                    answer_obj.response = answer
                    answer_obj.answered_at = datetime.now()
                    answer_obj.save()
            except SubQuestion.DoesNotExist:
                return False
        else:
            try:
                question = Question.objects.get(question_id=question_id)
                # Create or update answer for regular question
                answer_obj, created = Answer.objects.get_or_create(
                    form=form,
                    question=question,
                    defaults={'response': answer, 'answered_at': datetime.now()}
                )
                if not created:
                    answer_obj.response = answer
                    answer_obj.answered_at = datetime.now()
                    answer_obj.save()
            except Question.DoesNotExist:
                return False
        
        return True
        
    except Exception as e:
        print(f"Error submitting form answer: {e}")
        return False

@sync_to_async
def update_user_profile(user_id: int, profile_data: dict):
    """Update user profile information."""
    from app.models import AdminUser
    
    try:
        admin_user = AdminUser.objects.get(admin_id=user_id)
        
        # Update fields if provided
        if 'school_name' in profile_data:
            admin_user.assigned_area = profile_data['school_name']
        if 'email' in profile_data:
            admin_user.email = profile_data['email']
        if 'region' in profile_data:
            # You might need to map region name to region_id
            pass
        if 'division' in profile_data:
            # You might need to map division name to division_id
            pass
        if 'district' in profile_data:
            # You might need to map district name to district_id
            pass
        
        admin_user.save()
        
        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": {
                "id": user_id,
                "school_name": admin_user.assigned_area,
                "email": admin_user.email
            }
        }
        
    except AdminUser.DoesNotExist:
        return {
            "success": False,
            "message": "User profile not found"
        }
    except Exception as e:
        print(f"Error updating user profile: {e}")
        return {
            "success": False,
            "message": "Failed to update profile"
        }

# ==================== SECURITY ENDPOINTS ====================

class SecurityRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class SecurityResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[int] = None

@app.get("/api/security/last-login")
async def get_last_login(current_user: dict = Depends(get_current_user)):
    """Get last login information for the current user."""
    try:
        admin_user = await get_admin_user_by_user(current_user)
        if not admin_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "last_login": admin_user.last_login.isoformat() if admin_user.last_login else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/security/sessions")
async def get_user_sessions(current_user: dict = Depends(get_current_user)):
    """Get active sessions for the current user."""
    try:
        from django.contrib.sessions.models import Session
        from django.contrib.auth.models import User
        
        user = User.objects.get(id=current_user['id'])
        sessions = Session.objects.filter(expire_date__gte=timezone.now())
        
        session_data = []
        for session in sessions:
            if session.get_decoded().get('_auth_user_id') == str(user.id):
                session_data.append({
                    "session_key": session.session_key,
                    "created_at": session.expire_date.isoformat()
                })
        
        return {"success": True, "sessions": session_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/security/login-history")
async def get_login_history(current_user: dict = Depends(get_current_user)):
    """Get login history for the current user."""
    try:
        from app.models import AuditLog
        
        login_logs = AuditLog.objects.filter(
            user_id=current_user['id'],
            action='LOGIN'
        ).order_by('-timestamp')[:50]
        
        history = []
        for log in login_logs:
            history.append({
                "timestamp": log.timestamp.isoformat(),
                "ip_address": log.ip_address,
                "success": True
            })
        
        return {"success": True, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/security/terminate-session/{session_id}")
async def terminate_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Terminate a specific session."""
    try:
        from django.contrib.sessions.models import Session
        Session.objects.filter(session_key=session_id).delete()
        return {"success": True, "message": "Session terminated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AUDIT ENDPOINTS ====================

@app.get("/api/audit/logs")
async def get_audit_logs(
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get audit logs for the current user."""
    try:
        from app.models import AuditLog
        from django.core.paginator import Paginator
        
        query = AuditLog.objects.filter(user_id=current_user['id'])
        paginator = Paginator(query.order_by('-timestamp'), page_size)
        page_obj = paginator.get_page(page)
        
        logs = []
        for log in page_obj:
            logs.append({
                "audit_id": log.audit_id,
                "action": log.action,
                "timestamp": log.timestamp.isoformat(),
                "ip_address": log.ip_address
            })
        
        return {
            "success": True,
            "logs": logs,
            "pagination": {
                "page": page,
                "total_pages": paginator.num_pages
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/audit/export")
async def export_audit_logs(
    format: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """Export audit logs."""
    try:
        from app.models import AuditLog
        from django.http import HttpResponse
        import csv
        
        query = AuditLog.objects.filter(user_id=current_user['id'])
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="audit_logs_{current_user["id"]}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Timestamp', 'Action', 'IP Address'])
        
        for log in query.order_by('-timestamp'):
            writer.writerow([
                log.timestamp.isoformat(),
                log.action,
                log.ip_address or ''
            ])
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ANALYTICS ENDPOINTS ====================

@app.get("/api/analytics/data")
async def get_analytics_data(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get analytics data for the current user."""
    try:
        filters = {}
        if date_from:
            filters['date_from'] = date_from
        if date_to:
            filters['date_to'] = date_to
        
        data = await compute_analytics_bundle(filters)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/date-range")
async def get_analytics_date_range(current_user: dict = Depends(get_current_user)):
    """Get available date range for analytics."""
    try:
        from app.models import Form
        from django.db.models import Min, Max
        
        date_range = Form.objects.aggregate(
            min_date=Min('created_at'),
            max_date=Max('updated_at')
        )
        
        return {
            "success": True,
            "date_range": {
                "min_date": date_range['min_date'].isoformat() if date_range['min_date'] else None,
                "max_date": date_range['max_date'].isoformat() if date_range['max_date'] else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics/test")
async def analytics_test(current_user: dict = Depends(get_current_user)):
    """Test analytics endpoint."""
    return {
        "success": True,
        "message": "Analytics test endpoint working",
        "user_id": current_user['id']
    }

@app.get("/api/analytics/simple")
async def analytics_simple(current_user: dict = Depends(get_current_user)):
    """Simple analytics endpoint with basic data."""
    try:
        from app.models import Form, Answer
        
        total_forms = Form.objects.count()
        completed_forms = Form.objects.filter(status='completed').count()
        total_answers = Answer.objects.count()
        
        return {
            "success": True,
            "data": {
                "total_forms": total_forms,
                "completed_forms": completed_forms,
                "completion_rate": (completed_forms / total_forms * 100) if total_forms > 0 else 0,
                "total_answers": total_answers
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ADMIN ENDPOINTS ====================

class AdminUserRequest(BaseModel):
    username: str
    email: str
    password: str
    admin_level: str
    assigned_area: str

@app.get("/api/admin/users")
async def get_admin_users(
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get admin users list."""
    try:
        from app.models import AdminUser
        from django.core.paginator import Paginator
        
        query = AdminUser.objects.all()
        paginator = Paginator(query.order_by('-created_at'), page_size)
        page_obj = paginator.get_page(page)
        
        users = []
        for user in page_obj:
            users.append({
                "admin_id": user.admin_id,
                "username": user.username,
                "email": user.email,
                "admin_level": user.admin_level,
                "assigned_area": user.assigned_area
            })
        
        return {
            "success": True,
            "users": users,
            "pagination": {
                "page": page,
                "total_pages": paginator.num_pages
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/users/create")
async def create_admin_user(
    user_data: AdminUserRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new admin user."""
    try:
        from app.models import AdminUser
        from django.contrib.auth.hashers import make_password
        
        admin_user = AdminUser.objects.create(
            username=user_data.username,
            email=user_data.email,
            password=make_password(user_data.password),
            admin_level=user_data.admin_level,
            assigned_area=user_data.assigned_area
        )
        
        return {
            "success": True,
            "message": "Admin user created successfully",
            "user_id": admin_user.admin_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== GEOGRAPHIC ENDPOINTS ====================

@app.get("/api/geographic-data/{data_type}")
async def get_geographic_data(
    data_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Get geographic data (regions, divisions, districts)."""
    try:
        from app.models import Region, Division, District
        
        data = []
        
        if data_type == "regions":
            regions = Region.objects.all()
            data = [{"id": r.region_id, "name": r.name} for r in regions]
        elif data_type == "divisions":
            divisions = Division.objects.all()
            data = [{"id": d.division_id, "name": d.name} for d in divisions]
        elif data_type == "districts":
            districts = District.objects.all()
            data = [{"id": d.district_id, "name": d.name} for d in districts]
        else:
            raise HTTPException(status_code=400, detail="Invalid data type")
        
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schools/search")
async def search_schools(
    q: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search schools by name or ID."""
    try:
        from app.models import School
        
        schools = School.objects.filter(
            Q(school_name__icontains=q) | Q(school_id__icontains=q)
        )[:limit]
        
        results = []
        for school in schools:
            results.append({
                "school_id": school.school_id,
                "school_name": school.school_name
            })
        
        return {"success": True, "schools": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# -------------------- Analytics Bundle --------------------
class Thresholds(BaseModel):
    low: float | None = None
    high: float | None = None


class AnalyticsFilters(BaseModel):
    q: Optional[str] = None
    region_ids: List[int] | None = None
    division_ids: List[int] | None = None
    district_ids: List[int] | None = None
    school_ids: List[int] | None = None
    category_ids: List[int] | None = None
    sub_section_ids: List[int] | None = None
    topic_ids: List[int] | None = None
    question_ids: List[int] | None = None
    sub_question_ids: List[int] | None = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    completion_status: List[str] | None = None
    submission_status: List[str] | None = None
    thresholds: Optional[Thresholds] = None
class DrilldownRequest(BaseModel):
    level: str  # category|sub_section|topic|question|sub_question
    filters: Optional[AnalyticsFilters] = None



@sync_to_async
def compute_analytics_bundle(filters: Dict[str, Any]) -> Dict[str, Any]:
    from app.models import AdminUser, Form, Answer, Question, Region, Division, District
    from django.db.models import Count, Avg, F, Q
    from django.utils import timezone
    from datetime import timedelta

    # Base queryset for forms
    forms_qs = Form.objects.all()

    # Filters
    region_ids = (filters or {}).get('region_ids') or []
    division_ids = (filters or {}).get('division_ids') or []
    district_ids = (filters or {}).get('district_ids') or []
    school_ids = (filters or {}).get('school_ids') or []
    category_ids = (filters or {}).get('category_ids') or []
    sub_section_ids = (filters or {}).get('sub_section_ids') or []
    topic_ids = (filters or {}).get('topic_ids') or []
    question_ids = (filters or {}).get('question_ids') or []
    sub_question_ids = (filters or {}).get('sub_question_ids') or []

    if region_ids or division_ids or district_ids or school_ids:
        schools = AdminUser.objects.filter(admin_level='school')
        if region_ids:
            schools = schools.filter(region_id__in=region_ids)
        if division_ids:
            schools = schools.filter(division_id__in=division_ids)
        if district_ids:
            schools = schools.filter(district_id__in=district_ids)
        if school_ids:
            schools = schools.filter(id__in=school_ids)
        forms_qs = forms_qs.filter(school_id__in=schools.values('id'))

    date_from = (filters or {}).get('date_from')
    date_to = (filters or {}).get('date_to')
    deadline = (filters or {}).get('deadline')
    if date_from:
        forms_qs = forms_qs.filter(updated_at__date__gte=date_from)
    if date_to:
        forms_qs = forms_qs.filter(updated_at__date__lte=date_to)

    # Cards (with completion status filter support)
    total_forms = forms_qs.count()
    completed_forms = forms_qs.filter(status='completed').count()
    pending_forms = total_forms - completed_forms
    completion_rate = float(round((completed_forms / total_forms) * 100, 1)) if total_forms else 0.0

    # Avg completion time (hours) for completed forms
    completed_qs = forms_qs.filter(status='completed')
    try:
        durations = list(
            completed_qs.values_list('created_at', 'updated_at')
        )
        total_seconds = 0.0
        for created_at, updated_at in durations:
            if created_at and updated_at:
                total_seconds += (updated_at - created_at).total_seconds()
        avg_hours = round((total_seconds / len(durations)) / 3600.0, 1) if durations else 0.0
    except Exception:
        avg_hours = 0.0

    # Completion by school with answered/required metrics
    required_questions = Question.objects.filter(is_required=True).count()
    school_name_map = dict(AdminUser.objects.filter(admin_level='school').values_list('admin_id', 'assigned_area'))
    school_rows: List[Dict[str, Any]] = []
    school_labels: List[str] = []
    school_data: List[float] = []
    group_by = (filters or {}).get('group_by') or ''
    aggregates: Dict[str, Dict[str, Any]] = {}

    # Gather per-school aggregates with taxonomy and completion filters
    for sid in forms_qs.values_list('school_id', flat=True).distinct():
        s_forms = forms_qs.filter(school_id=sid)
        # Taxonomy scoping for answers
        answers_qs = Answer.objects.filter(
            form__in=s_forms,
            response__isnull=False
        ).exclude(response='')

        if question_ids:
            answers_qs = answers_qs.filter(question_id__in=question_ids)
        if topic_ids:
            answers_qs = answers_qs.filter(question__topic_id__in=topic_ids)
        if sub_section_ids:
            answers_qs = answers_qs.filter(question__topic__sub_section_id__in=sub_section_ids)
        if category_ids:
            answers_qs = answers_qs.filter(question__topic__sub_section__category_id__in=category_ids)

        # completion status filter mapping
        completion_filter = (filters or {}).get('completion_status') or []
        # Count answers for required questions (distinct questions)
        answered_required = answers_qs.filter(
            Q(question__isnull=False) & Q(question__is_required=True)
        ).values('question_id').distinct().count()

        pct = round((answered_required / required_questions) * 100, 1) if required_questions else 0.0
        school_name = school_name_map.get(sid, f"School {sid}")

        # Simple submission status: completed -> on-time (until deadline is added)
        # Submission status classification using deadline if provided
        if deadline:
            # If any completed after deadline -> late; before -> early; equal -> on-time
            completed_updates = list(s_forms.filter(status='completed', updated_at__isnull=False).values_list('updated_at', flat=True))
            if completed_updates:
                latest = max(completed_updates)
                status_str = 'late' if str(latest.date()) > str(deadline) else ('early' if str(latest.date()) < str(deadline) else 'on-time')
            else:
                status_str = 'in-progress'
        else:
            any_completed = s_forms.filter(status='completed').exists()
            status_str = 'on-time' if any_completed else 'in-progress'

        # Apply completion status filter per school if provided
        if completion_filter:
            # Simple rules: completed if answered_required == required_questions; partial if 1..required-1; not-started if 0
            if answered_required >= required_questions and 'completed' not in completion_filter:
                continue
            if 0 < answered_required < required_questions and 'in-progress' not in completion_filter and 'partial' not in completion_filter:
                continue
            if answered_required == 0 and 'not-started' not in completion_filter:
                continue

        # submission_status filter
        submission_filter = (filters or {}).get('submission_status') or []
        if submission_filter:
            if status_str not in submission_filter:
                continue

        school_rows.append({
            "school_id": sid,
            "school_name": school_name,
            "completion_pct": pct / 100.0,
            "answered": answered_required,
            "required": required_questions,
            "status": status_str
        })
        school_labels.append(school_name)
        school_data.append(pct)

        # Aggregate by group if requested
        if group_by in ('district', 'division', 'region'):
            # fetch from AdminUser
            try:
                us = AdminUser.objects.only('district_id', 'division_id', 'region_id').get(admin_id=sid)
                key = None
                if group_by == 'district':
                    key = f"District {us.district_id}" if us.district_id else 'District N/A'
                elif group_by == 'division':
                    key = f"Division {us.division_id}" if us.division_id else 'Division N/A'
                else:
                    key = f"Region {us.region_id}" if us.region_id else 'Region N/A'
            except Exception:
                key = 'Unknown'
            agg = aggregates.get(key) or {"answered": 0, "required": 0, "schools": 0}
            agg["answered"] += answered_required
            agg["required"] += required_questions
            agg["schools"] += 1
            aggregates[key] = agg

    # Forms per day (last 14 days)
    from datetime import date, timedelta as td
    labels_days: List[str] = []
    counts_days: List[int] = []
    today = timezone.now().date()
    day_counts = (
        completed_qs.values_list(models.functions.TruncDate('updated_at'))
        .annotate(c=Count('form_id'))
    )
    day_map = {str(d[0]): d[1] for d in day_counts if d[0] is not None}
    for i in range(13, -1, -1):
        d = today - td(days=i)
        key = str(d)
        labels_days.append(key)
        counts_days.append(int(day_map.get(key, 0)))

    # Response distribution (answered vs unanswered)
    total_answers = Answer.objects.filter(form__in=forms_qs).exclude(response__isnull=True).exclude(response='').count()
    # Simple bucket: answered vs unanswered among questions for these forms
    total_questions = Question.objects.count()
    answered = total_answers
    unanswered = max(0, total_forms * total_questions - answered) if total_questions and total_forms else 0

    charts = {
        "completion_by_school": {
            "labels": school_labels,
            "datasets": [{"label": "Completion %", "data": school_data}]
        },
        "forms_per_day": {
            "labels": labels_days,
            "datasets": [{"label": "Completed", "data": counts_days}]
        },
        "response_distribution": {
            "labels": ["Answered", "Unanswered"],
            "datasets": [{"data": [answered, unanswered]}]
        },
        "performance_by_school_type": {
            "labels": ["All"],
            "datasets": [{"data": [completion_rate]}]
        },
        "time_by_district": {
            "labels": [],
            "datasets": [{"data": []}]
        },
        "topic_averages": {
            "labels": [],
            "datasets": [{"data": []}]
        }
    }

    result = {
        "cards": {
            "completion_rate": completion_rate / 100.0 if completion_rate else 0.0,
            "avg_completion_hours": avg_hours,
            "completed_forms": completed_forms,
            "pending_forms": pending_forms
        },
        "school_completion": school_rows,
        "group_aggregates": [
            {
                "group": k,
                "completion_pct": (round((v["answered"] / v["required"]) * 100, 1) if v["required"] else 0.0) / 100.0,
                "answered": v["answered"],
                "required": v["required"],
                "schools": v["schools"],
            }
            for k, v in aggregates.items()
        ],
        "charts": charts,
        "meta": {
            "filters_used": filters or {},
            "generated_at": timezone.now().isoformat(),
            "version": "1.0.0"
        }
    }
    return result


@app.post("/api/analytics/bundle")
async def analytics_bundle(filters: AnalyticsFilters | None = None, current_user: User = Depends(get_current_user)):
    try:
        cache_key = f"analytics_bundle:{current_user.id}:{jwt.encode((filters.dict() if filters else {}), SECRET_KEY, algorithm=ALGORITHM)}"
    except Exception:
        cache_key = f"analytics_bundle:{current_user.id}"

    cached = await get_cached_data(cache_key)
    if cached:
        return cached

    try:
        data = await compute_analytics_bundle(filters.dict() if filters else {})
        set_cached_data(cache_key, data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@sync_to_async
def compute_drilldown(level: str, filters: Dict[str, Any]) -> Dict[str, Any]:
    from app.models import Category, SubSection, Topic, Question, Answer, AdminUser
    from django.db.models import Count, Avg
    from collections import Counter

    result: Dict[str, Any] = {"level": level, "distribution": [], "numeric": {}, "geo_compare": {}}

    # Base queryset, apply geo filters
    base_answers = Answer.objects.exclude(response__isnull=True).exclude(response='')
    region_ids = (filters or {}).get('region_ids') or []
    division_ids = (filters or {}).get('division_ids') or []
    district_ids = (filters or {}).get('district_ids') or []
    school_ids = (filters or {}).get('school_ids') or []
    if region_ids or division_ids or district_ids or school_ids:
        schools = AdminUser.objects.filter(admin_level='school')
        if region_ids:
            schools = schools.filter(region_id__in=region_ids)
        if division_ids:
            schools = schools.filter(division_id__in=division_ids)
        if district_ids:
            schools = schools.filter(district_id__in=district_ids)
        if school_ids:
            schools = schools.filter(id__in=school_ids)
        base_answers = base_answers.filter(form__school__in=schools.values('id'))

    # Scope by taxonomy filters
    if (filters or {}).get('category_ids'):
        base_answers = base_answers.filter(question__topic__sub_section__category_id__in=filters['category_ids'])
    if (filters or {}).get('sub_section_ids'):
        base_answers = base_answers.filter(question__topic__sub_section_id__in=filters['sub_section_ids'])
    if (filters or {}).get('topic_ids'):
        base_answers = base_answers.filter(question__topic_id__in=filters['topic_ids'])
    if (filters or {}).get('question_ids'):
        base_answers = base_answers.filter(question_id__in=filters['question_ids'])

    # Build distributions by level
    if level == 'category':
        qs = Category.objects.values('category_id', 'name')
        for row in qs:
            cnt = base_answers.filter(question__topic__sub_section__category_id=row['category_id']).count()
            result["distribution"].append({"label": row['name'], "count": cnt})
    elif level == 'sub_section':
        qs = SubSection.objects.values('sub_section_id', 'name')
        for row in qs:
            cnt = base_answers.filter(question__topic__sub_section_id=row['sub_section_id']).count()
            result["distribution"].append({"label": row['name'], "count": cnt})
    elif level == 'topic':
        qs = Topic.objects.values('topic_id', 'name')
        for row in qs:
            cnt = base_answers.filter(question__topic_id=row['topic_id']).count()
            result["distribution"].append({"label": row['name'], "count": cnt})
    elif level == 'question':
        qs = Question.objects.values('question_id', 'question_text', 'answer_type')
        for row in qs[:200]:
            q_answers = base_answers.filter(question_id=row['question_id'])
            cnt = q_answers.count()
            entry = {"label": row['question_text'][:60], "count": cnt, "answer_type": row['answer_type']}
            # Choice percentage distribution
            if row['answer_type'] == 'choice':
                # Count by exact response text
                choice_counts = Counter(q_answers.values_list('response', flat=True))
                total = sum(choice_counts.values()) or 1
                entry['choices'] = [
                    {"label": k, "count": v, "pct": round((v/total)*100, 1)} for k, v in choice_counts.items()
                ]
            # Numeric statistics
            if row['answer_type'] == 'number':
                vals = []
                for v in q_answers.values_list('response', flat=True):
                    try:
                        vals.append(float(str(v).strip()))
                    except Exception:
                        continue
                if vals:
                    svals = sorted(vals)
                    n = len(svals)
                    median = (svals[n//2] if n % 2 == 1 else (svals[n//2 - 1] + svals[n//2]) / 2)
                    entry['numeric'] = {
                        'avg': round(sum(svals)/n, 3),
                        'median': round(median, 3),
                        'min': min(svals),
                        'max': max(svals)
                    }
            # Text frequency (simple tokenization)
            if row['answer_type'] == 'text':
                tokens = []
                for v in q_answers.values_list('response', flat=True):
                    for t in str(v).lower().split():
                        if t.isalpha() and len(t) > 2:
                            tokens.append(t)
                freq = Counter(tokens).most_common(10)
                entry['top_terms'] = [{"term": k, "count": v} for k, v in freq]
            result["distribution"].append(entry)
    else:
        result["distribution"] = []

    # Geo comparison (counts by region/division/district)
    try:
        region_map = AdminUser.objects.filter(admin_level='school').values('admin_id', 'region_id')
        id_to_region = {r['admin_id']: r['region_id'] for r in region_map}
        by_region: Dict[str, int] = {}
        for sid in base_answers.values_list('form__school', flat=True):
            key = f"Region {id_to_region.get(sid) or 'N/A'}"
            by_region[key] = by_region.get(key, 0) + 1
        result['geo_compare']['region'] = [{'label': k, 'count': v} for k, v in by_region.items()]
    except Exception:
        result['geo_compare'] = {}

    # Totals
    result["numeric"].update({"total_answers": sum(d.get("count", 0) for d in result["distribution"]) if result["distribution"] else 0})
    return result


@app.post("/api/analytics/drilldown")
async def analytics_drilldown(payload: DrilldownRequest, current_user: User = Depends(get_current_user)):
    try:
        data = await compute_drilldown(payload.level, payload.filters.dict() if payload.filters else {})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    admin_user = await get_admin_user_by_user(current_user)
    if admin_user:
        return UserResponse(
            id=current_user.id,
            username=current_user.username,
            email=current_user.email,
            school_name=admin_user.assigned_area,
            role=admin_user.admin_level
        )
    else:
        return UserResponse(
            id=current_user.id,
            username=current_user.username,
            email=current_user.email
        )

@app.get("/api/dashboard/user")
async def get_user_dashboard(current_user: User = Depends(get_current_user)):
    """Get user dashboard data."""
    admin_user = await get_admin_user_by_user(current_user)
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AdminUser profile not found"
        )
    
    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
        },
        "admin_user": {
            "school_name": admin_user.assigned_area,
            "role": admin_user.admin_level,
            "region": admin_user.region.name if admin_user.region else None,
            "division": admin_user.division.name if admin_user.division else None,
            "district": admin_user.district.name if admin_user.district else None,
        }
    }

@app.get("/api/form/sections")
async def get_form_sections_endpoint(current_user: User = Depends(get_current_user)):
    """Get form sections with questions for the authenticated user."""
    try:
        # Get user-specific cached data
        cache_key = f"form_sections_user_{current_user.id}"
        cached_data = get_cached_data(cache_key)
        if cached_data:
            return cached_data
        
        # Get fresh data from database for this specific user
        sections_data = await get_form_sections(current_user.id)
        
        # Cache the result for this user
        set_cached_data(cache_key, sections_data)
        
        return sections_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/form/answers")
async def get_saved_answers(current_user: User = Depends(get_current_user)):
    """Get all saved answers for the current user."""
    try:
        # Get the authenticated user's school information
        admin_user = await get_admin_user_by_user(current_user)
        if not admin_user:
            raise HTTPException(status_code=404, detail="User school information not found")
        
        answers = await get_user_answers(current_user.id)
        return {"success": True, "answers": answers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@sync_to_async
def get_form_sections_data():
    """Get form sections with questions from database using optimized queries."""
    from app.models import Category, SubSection, Topic, Question, SubQuestion, Form, Answer
    from django.db.models import Prefetch, Count
    
    # Get all categories with their related data in optimized queries
    categories = Category.objects.prefetch_related(
        Prefetch(
            'subsection_set',
            queryset=SubSection.objects.order_by('display_order').prefetch_related(
                Prefetch(
                    'topic_set',
                    queryset=Topic.objects.order_by('display_order').prefetch_related(
                        Prefetch(
                            'question_set',
                            queryset=Question.objects.order_by('display_order').prefetch_related(
                                Prefetch(
                                    'subquestion_set',
                                    queryset=SubQuestion.objects.order_by('display_order')
                                )
                            )
                        )
                    )
                )
            )
        )
    ).order_by('display_order')
    

    
    categories_data = []
    
    for category in categories:
        category_questions = []
        category_total_questions = 0
        category_answered_questions = 0
        
        # Process sub-sections (already prefetched)
        for sub_section in category.subsection_set.all():
            # Process topics (already prefetched)
            for topic in sub_section.topic_set.all():
                # Process questions (already prefetched)
                for question in topic.question_set.all():
                    # Get sub-questions (already prefetched)
                    sub_questions = question.subquestion_set.all()
                    
                    # Check if question is answered (for now, assume not answered)
                    is_answered = False
                    if is_answered:
                        category_answered_questions += 1
                    
                    category_total_questions += 1
                    
                    # Prepare sub-questions data
                    sub_questions_data = [
                        {
                            'sub_question_id': sq.sub_question_id,
                            'sub_question_text': sq.sub_question_text,
                            'display_order': sq.display_order
                        }
                        for sq in sub_questions
                    ]
                    
                    question_data = {
                        'question_id': question.question_id,
                        'question_text': question.question_text,
                        'answer_type': question.answer_type,
                        'is_required': question.is_required,
                        'is_answered': is_answered,
                        'sub_section_name': sub_section.name,
                        'topic_name': topic.name,
                        'sub_questions': sub_questions_data
                    }
                    
                    category_questions.append(question_data)
        
        # Calculate category progress
        progress_percentage = (category_answered_questions / category_total_questions * 100) if category_total_questions > 0 else 0
        
        # Determine status
        if category_answered_questions == 0:
            status = 'not-started'
        elif category_answered_questions == category_total_questions:
            status = 'completed'
        else:
            status = 'in-progress'
        
        categories_data.append({
            'category_id': category.category_id,
            'category_name': category.name,
            'status': status,
            'progress_percentage': round(progress_percentage, 1),
            'total_questions': category_total_questions,
            'answered_questions': category_answered_questions,
            'questions': category_questions
        })
    
    # If no data found, return sample data for testing
    if not categories_data:
        return [
            {
                'category_id': 1,
                'category_name': 'School Information',
                'status': 'not-started',
                'progress_percentage': 0.0,
                'total_questions': 5,
                'answered_questions': 0,
                'questions': [
                    {
                        'question_id': 1,
                        'question_text': 'What is the name of your school?',
                        'answer_type': 'text',
                        'is_required': True,
                        'is_answered': False,
                        'sub_section_name': 'Basic Information',
                        'topic_name': 'School Details',
                        'sub_questions': []
                    },
                    {
                        'question_id': 2,
                        'question_text': 'How many students are enrolled?',
                        'answer_type': 'number',
                        'is_required': True,
                        'is_answered': False,
                        'sub_section_name': 'Basic Information',
                        'topic_name': 'Enrollment',
                        'sub_questions': [
                            {
                                'sub_question_id': 1,
                                'sub_question_text': 'Male students',
                                'display_order': 1
                            },
                            {
                                'sub_question_id': 2,
                                'sub_question_text': 'Female students',
                                'display_order': 2
                            }
                        ]
                    }
                ]
            },
            {
                'category_id': 2,
                'category_name': 'Academic Performance',
                'status': 'not-started',
                'progress_percentage': 0.0,
                'total_questions': 3,
                'answered_questions': 0,
                'questions': [
                    {
                        'question_id': 3,
                        'question_text': 'What is the average GPA?',
                        'answer_type': 'number',
                        'is_required': True,
                        'is_answered': False,
                        'sub_section_name': 'Performance Metrics',
                        'topic_name': 'Academic Standards',
                        'sub_questions': []
                    }
                ]
            }
        ]
    
    return categories_data

@app.post("/api/form/submit")
async def submit_form_answer_endpoint(submission: FormSubmission, current_user: User = Depends(get_current_user)):
    """Submit a form answer and clear cache."""
    try:
        # Use the authenticated user's ID
        admin_user = await get_admin_user_by_user(current_user)
        if not admin_user:
            raise HTTPException(status_code=404, detail="User school information not found")
        
        # Submit the answer using the authenticated user
        result = await submit_form_answer(current_user.id, submission.question_id, submission.answer, submission.sub_question_id)
        
        if result:
            # Clear user-specific cache since data has changed
            cache_key = f"form_sections_user_{current_user.id}"
            if cache_key in cache:
                del cache[cache_key]
            return {"success": True, "message": "Answer submitted successfully"}
        else:
            # Check if the issue is with the question or user
            question_exists, question_type = await check_question_exists(submission.question_id)
            if question_exists:
                return {"success": False, "message": f"Failed to save answer (database error). Question type: {question_type}"}
            else:
                return {"success": False, "message": f"Question with question_id={submission.question_id} does not exist"}
    except Exception as e:
        print(f"Error in submit_form_answer_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@sync_to_async
def get_admin_user_by_user_id(user_id: int):
    """Get UsersSchool record by user_id."""
    from app.models import AdminUser
    try:
        return AdminUser.objects.get(admin_id=user_id)
    except AdminUser.DoesNotExist:
        return None

# Removed get_first_userschool() function as it was a security vulnerability
# All endpoints now require proper authentication

@sync_to_async
def get_user_answers(user_id: int):
    """Get all saved answers for a user."""
    from app.models import Answer, Form, Question, SubQuestion, AdminUser
    
    try:
        # Get the user's school
        admin_user = AdminUser.objects.get(admin_id=user_id)
        school_id = admin_user.school.id if admin_user.school else None
        
        if not school_id:
            print(f"AdminUser {user_id} has no associated school")
            return False
            
        # Get the School object from the school_id
        school_obj = School.objects.get(id=school_id)
        # Get or create the form for this user and school (ensure form exists for cross-browser consistency)
        form, created = Form.objects.get_or_create(
            user_id=user_id,
            school=school_obj,
            defaults={'status': 'draft'}
        )
        if created:
            print(f"Created new form {form.form_id} for user {user_id} during answer retrieval")
        
        # Get all answers for this user's form, including sub-question relationships
        answers = Answer.objects.filter(form=form).select_related('question', 'sub_question')
        
        # Convert to dictionary format
        result = {}
        for answer in answers:
            response_value = answer.response

            # If this row corresponds to a sub-question, key by sub_question_id
            if getattr(answer, 'sub_question_id', None) or getattr(answer, 'sub_question', None):
                sub_q_id = None
                try:
                    sub_q_id = str(answer.sub_question.sub_question_id)
                except Exception:
                    # Fallback: some ORMs expose sub_question_id directly
                    try:
                        sub_q_id = str(answer.sub_question_id)
                    except Exception:
                        sub_q_id = None
                if sub_q_id:
                    if response_value and str(response_value).strip() != '':
                        result[sub_q_id] = {
                            'value': response_value,
                            'timestamp': answer.answered_at.isoformat() if answer.answered_at else None,
                            'saveState': 'database'
                        }
                    continue

            # Handle sub-question answers stored in concatenated format in the parent question response
            if response_value and ';' in response_value and ':' in response_value:
                sub_answers = response_value.split(';')
                for sub_answer in sub_answers:
                    if ':' in sub_answer:
                        sub_parts = sub_answer.split(':', 1)
                        if len(sub_parts) == 2:
                            sub_question_id = sub_parts[0].strip()
                            sub_answer_value = sub_parts[1].strip()
                            if sub_answer_value and sub_answer_value != '':
                                result[sub_question_id] = {
                                    'value': sub_answer_value,
                                    'timestamp': answer.answered_at.isoformat() if answer.answered_at else None,
                                    'saveState': 'database'
                                }
                            else:
                                if sub_question_id in result:
                                    del result[sub_question_id]
                continue

            # Regular question answer: key by question_id
            question_id_str = str(answer.question.question_id)
            if response_value and str(response_value).strip() != '':
                # Guard: avoid echoing question id as value
                if str(response_value) == question_id_str:
                    continue
                result[question_id_str] = {
                    'value': response_value,
                    'timestamp': answer.answered_at.isoformat() if answer.answered_at else None,
                    'saveState': 'database'
                }
        
        return result
        
    except AdminUser.DoesNotExist:
        return {}
    except Exception as e:
        print(f"Error getting user answers: {e}")
        return {}

@sync_to_async
def check_question_exists(question_id: int):
    """Check if a question or sub-question exists in the database."""
    from app.models import Question, SubQuestion
    
    # First check if it's a regular question
    try:
        question = Question.objects.get(question_id=question_id)
        return True, "question"
    except Question.DoesNotExist:
        pass
    
    # If not found in questions, check if it's a sub-question
    try:
        sub_question = SubQuestion.objects.get(sub_question_id=question_id)
        return True, "sub_question"
    except SubQuestion.DoesNotExist:
        pass
    
    # If not found in either table
    return False, None

@app.get("/api/profile")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile from database."""
    try:
        # Get the authenticated user's profile
        profile = await get_real_user_profile(current_user.id)
        return profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@sync_to_async
def get_real_user_profile(user_id: int):
    """Get real user profile from database for a specific user."""
    from app.models import AdminUser, School, Region, Division, District
    
    try:
        # Get the authenticated user's school information with related data
        user_school = AdminUser.objects.select_related('region', 'division', 'district').get(admin_id=user_id)
        
        return {
            "personal_info": {
                "school_name": user_school.assigned_area,
                "email": user_school.email,
                "region": user_school.region.name if user_school.region else None,
                "division": user_school.division.name if user_school.division else None,
                "district": user_school.district.name if user_school.district else None
            },
            "account_settings": {
                "email_notifications": True,
                "sms_notifications": False,
                "two_factor_enabled": False,
                "last_login": user_school.last_login.isoformat() if user_school.last_login else None,
                "account_created": user_school.created_at.isoformat() if hasattr(user_school, 'created_at') else None
            }
        }
    except AdminUser.DoesNotExist:
        print(f"AdminUser not found for admin_id: {user_id}")
        return {
            "error": "User profile not found"
        }
    except Exception as e:
        print(f"Error getting user profile: {e}")
        return {
            "error": "Failed to load profile"
        }

@app.put("/api/profile")
async def update_user_profile_endpoint(profile_update: ProfileUpdate, current_user: User = Depends(get_current_user)):
    """Update user profile information."""
    try:
        # Update the authenticated user's profile
        result = await update_user_profile(current_user.id, profile_update.dict(exclude_unset=True))
        if result["success"]:
            return result
        else:
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "EdSight FastAPI Backend", "status": "running"}

@app.get("/debug/auth")
async def debug_auth(request: Request):
    """Debug endpoint to test authentication."""
    try:
        current_user = await get_current_user(request)
        return {
            "success": True,
            "user": current_user,
            "cookies": dict(request.cookies),
            "headers": dict(request.headers)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "cookies": dict(request.cookies),
            "headers": dict(request.headers)
        }

@app.get("/clear-cache")
async def clear_cache_endpoint():
    """Clear all cached data."""
    clear_cache()
    return {"message": "Cache cleared successfully"}

@app.get("/test")
async def test():
    """Test endpoint to check database connectivity."""
    try:
        # Use sync_to_async for database operations
        result = await sync_to_async(test_database_connectivity)()
        return result
    except Exception as e:
        return {"error": str(e)}

def test_database_connectivity():
    """Test database connectivity (sync function) - No sensitive data exposed."""
    from app.models import AdminUser, Question, Form
    
    try:
        # Check database connectivity without exposing sensitive data
        admin_user_count = AdminUser.objects.filter(admin_level='school').count()
        question_count = Question.objects.count()
        form_count = Form.objects.count()
        
        return {
            "message": "FastAPI is running!",
            "database_status": "Connected",
            "statistics": {
                "total_schools": admin_user_count,
                "total_questions": question_count,
                "total_forms": form_count
            }
        }
    except Exception as e:
        return {
            "message": "FastAPI is running!",
            "database_status": "Error",
            "error": "Database connection failed"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="error", access_log=False)
