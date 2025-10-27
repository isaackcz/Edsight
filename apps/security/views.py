from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from django.contrib.sessions.models import Session
from apps.core.models import UsersSchool, LoginAttempt, AuditLog, AccountLockout

router = APIRouter(prefix="/api/security", tags=["security"])

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False

class SessionInfo(BaseModel):
    session_key: str
    ip_address: str
    user_agent: str
    created_at: datetime
    last_activity: datetime
    is_current: bool

class AuditLogEntry(BaseModel):
    id: int
    action: str
    resource_type: str
    details: dict
    timestamp: datetime
    ip_address: Optional[str]

@router.post("/login")
async def login(request: LoginRequest, req: Request):
    """Enhanced login with security tracking"""
    ip_address = req.client.host
    user_agent = req.headers.get("user-agent", "")
    
    # Record login attempt
    login_attempt = LoginAttempt.objects.create(
        username=request.username,
        ip_address=ip_address,
        user_agent=user_agent,
        success=False
    )
    
    try:
        user = UsersSchool.objects.get(username=request.username)
        
        # Check account lockout
        lockout = AccountLockout.objects.filter(
            user=user, 
            is_active=True,
            unlock_at__gt=datetime.now()
        ).first()
        
        if lockout:
            raise HTTPException(status_code=423, detail="Account is locked")
        
        # Authenticate user (implement your authentication logic)
        if authenticate_user(request.username, request.password):
            login_attempt.success = True
            login_attempt.user = user
            login_attempt.save()
            
            # Update last login
            user.last_login = datetime.now()
            user.save()
            
            # Create audit log
            AuditLog.objects.create(
                user=user,
                action="LOGIN",
                resource_type="USER",
                details={"ip_address": ip_address, "user_agent": user_agent},
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            return {"success": True, "user_id": user.id, "username": user.username}
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
    except UsersSchool.DoesNotExist:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        login_attempt.failure_reason = str(e)
        login_attempt.save()
        raise

@router.get("/sessions")
async def get_user_sessions(user_id: int):
    """Get active sessions for user"""
    sessions = Session.objects.filter(
        session_data__contains=f'"_auth_user_id":"{user_id}"'
    )
    
    session_list = []
    for session in sessions:
        session_data = session.get_decoded()
        session_list.append(SessionInfo(
            session_key=session.session_key,
            ip_address=session_data.get('ip_address', 'Unknown'),
            user_agent=session_data.get('user_agent', 'Unknown'),
            created_at=session_data.get('created_at', session.expire_date),
            last_activity=session.expire_date,
            is_current=True  # Determine based on current session
        ))
    
    return session_list

@router.delete("/sessions/{session_key}")
async def terminate_session(session_key: str, user_id: int):
    """Terminate a specific session"""
    try:
        session = Session.objects.get(session_key=session_key)
        session.delete()
        
        # Create audit log
        user = UsersSchool.objects.get(id=user_id)
        AuditLog.objects.create(
            user=user,
            action="SESSION_TERMINATE",
            resource_type="SESSION",
            details={"session_key": session_key}
        )
        
        return {"success": True, "message": "Session terminated"}
    except Session.DoesNotExist:
        raise HTTPException(status_code=404, detail="Session not found")

@router.get("/audit-logs")
async def get_audit_logs(
    user_id: int,
    page: int = 1,
    limit: int = 50,
    action_filter: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """Get audit logs with filtering"""
    queryset = AuditLog.objects.filter(user_id=user_id)
    
    if action_filter:
        queryset = queryset.filter(action__icontains=action_filter)
    if start_date:
        queryset = queryset.filter(timestamp__gte=start_date)
    if end_date:
        queryset = queryset.filter(timestamp__lte=end_date)
    
    total = queryset.count()
    logs = queryset.order_by('-timestamp')[(page-1)*limit:page*limit]
    
    return {
        "logs": [AuditLogEntry(
            id=log.id,
            action=log.action,
            resource_type=log.resource_type,
            details=log.details,
            timestamp=log.timestamp,
            ip_address=log.ip_address
        ) for log in logs],
        "total": total,
        "page": page,
        "limit": limit
    }

def authenticate_user(username: str, password: str) -> bool:
    """Authenticate user with username and password"""
    try:
        user = UsersSchool.objects.get(username=username)
        # Use Django's built-in password verification
        import bcrypt
        return bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8'))
    except UsersSchool.DoesNotExist:
        return False
    except Exception:
        return False