from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.models import User, Role, Conversation, Message
from app.schemas.schemas import UserCreate, UserUpdate, UserResponse, SuccessResponse
from app.routers.auth import get_current_admin, get_current_user, get_current_company_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    query = db.query(User).outerjoin(User.role)
    
    if current_user.tenant_id is not None:
        # Company Admin: lọc nhân viên thuộc doanh nghiệp của mình
        query = query.filter(User.tenant_id == current_user.tenant_id)
    else:
        # Superadmin: lọc bỏ các Superadmin khác ra khỏi danh sách người dùng thông thường
        query = query.filter((Role.level != 0) | (User.role_id.is_(None)))
    
    if role_id is not None:
        query = query.filter(User.role_id == role_id)
    
    users = query.offset(skip).limit(limit).all()
    return users


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    # Check if username exists
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{user_data.username}' đã tồn tại"
        )
    
    # Validate role_id if provided
    if user_data.role_id:
        role = db.query(Role).filter(Role.id == user_data.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ ID {user_data.role_id} không tồn tại"
            )
        # Prevent assigning admin role (level 0)
        if role.level == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không được gán chức vụ Admin cho người dùng mới"
            )
    
    tenant_id = current_user.tenant_id if current_user.tenant_id is not None else user_data.tenant_id
    user_type = "employee" if tenant_id is not None else "personal"
    
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        role_id=user_data.role_id,
        tenant_id=tenant_id,
        user_type=user_type,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng ID {user_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem thông tin người dùng này"
        )
        
    return user


@router.put("/me", response_model=UserResponse)
def update_me(
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """User updates their own profile (cannot change role)"""
    
    # Check username uniqueness if changing
    if user_data.username and user_data.username != current_user.username:
        existing = db.query(User).filter(User.username == user_data.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên đăng nhập '{user_data.username}' đã tồn tại"
            )
        current_user.username = user_data.username
    
    # Update other fields (exclude role_id - users cannot change their own role)
    if user_data.full_name is not None:
        current_user.full_name = user_data.full_name
    if user_data.email is not None:
        current_user.email = user_data.email
    if user_data.phone is not None:
        current_user.phone = user_data.phone
    
    # Handle password separately - only update if provided
    if user_data.password:
        current_user.hashed_password = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("/me/stats")
def get_my_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy thống kê sử dụng cá nhân của người dùng đang đăng nhập"""
    from datetime import datetime, time as datetime_time

    # Đếm cuộc hội thoại
    conv_count = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).count()

    # Đếm tổng tin nhắn đã gửi (role = user)
    message_count = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "user"
    ).count()

    # Đếm tài liệu đang active
    from app.models.models import Document
    doc_count = db.query(Document).filter(
        Document.uploaded_by == current_user.id,
        Document.is_active == True
    ).count()

    # Đếm câu hỏi đã dùng hôm nay
    today = datetime.utcnow().date()
    start_of_today = datetime.combine(today, datetime_time.min)
    questions_used_today = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "user",
        Message.created_at >= start_of_today
    ).count()

    # Xác định quota_limit
    is_superadmin = current_user.role and current_user.role.level == 0
    if current_user.user_type == "employee" and current_user.tenant_id is not None:
        # Tìm Company Admin (chủ doanh nghiệp) để kiểm tra gói cước của công ty
        company_admin = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.role.has(level=1)
        ).first()
        is_free = (company_admin.subscription_tier == "free") if company_admin else True
    else:
        is_free = current_user.subscription_tier == "free"
    quota_limit = 999999 if (not is_free or is_superadmin) else 10

    # Tính tỷ lệ hài lòng (satisfaction_rate)
    likes = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "assistant",
        Message.rating == 1
    ).count()

    dislikes = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "assistant",
        Message.rating == -1
    ).count()

    total_rated = likes + dislikes
    satisfaction_rate = round((likes / total_rated * 100), 1) if total_rated > 0 else 100.0

    return {
        "conv_count": conv_count,
        "message_count": message_count,
        "doc_count": doc_count,
        "questions_used_today": questions_used_today,
        "quota_limit": quota_limit,
        "subscription_tier": current_user.subscription_tier or "free",
        "satisfaction_rate": satisfaction_rate
    }


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng ID {user_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa người dùng này"
        )
    
    # Prevent editing OTHER admin users - but allow self-edit
    if user.role and user.role.level == 0 and user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể sửa thông tin tài khoản Admin khác"
        )
    
    # Check username uniqueness if changing
    if user_data.username and user_data.username != user.username:
        existing = db.query(User).filter(User.username == user_data.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên đăng nhập '{user_data.username}' đã tồn tại"
            )
        user.username = user_data.username
    
    # Validate role_id if provided
    if user_data.role_id is not None:
        role = db.query(Role).filter(Role.id == user_data.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ ID {user_data.role_id} không tồn tại"
            )
        # Prevent assigning admin role (level 0)
        if role.level == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không được gán chức vụ Admin"
            )
        user.role_id = user_data.role_id
    elif user_data.role_id is None and user.role_id is not None:
        # Explicitly setting to None (public access)
        user.role_id = None
    
    # Update other fields
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password:
        user.hashed_password = get_password_hash(user_data.password)
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/{user_id}", response_model=SuccessResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng ID {user_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and user.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa người dùng này"
        )
    
    # Don't delete yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa tài khoản của chính mình"
        )
    
    db.delete(user)
    db.commit()
    
    return SuccessResponse(success=True, message=f"Đã xóa người dùng '{user.username}'")
