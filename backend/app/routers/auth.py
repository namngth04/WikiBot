from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, decode_token, get_password_hash
from app.models.models import User, Role, UserAISettings, TenantAISettings
from app.schemas.schemas import TokenResponse, UserResponse, LoginRequest, UserCreate
from sqlalchemy import func

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception
    
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.role or current_user.role.level != 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên hệ thống (Superadmin)"
        )
    return current_user


def get_current_company_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.role or current_user.role.level not in [0, 1]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên công ty hoặc hệ thống"
        )
    return current_user



@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không đúng",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # 1. Kiểm tra xem username đã tồn tại chưa
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã tồn tại trên hệ thống"
        )
    
    # 2. Kiểm tra email nếu được cung cấp
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email này đã được sử dụng đăng ký tài khoản khác"
            )

    # 3. Phân luồng đăng ký SaaS tự phục vụ
    role_id = 3  # Mặc định: Nhân viên
    subscription_tier = "free"
    tenant_id = None
    
    # A. Nhân sự gia nhập qua mã mời (Invite Code)
    if user_data.invite_code:
        tenant_settings = db.query(TenantAISettings).filter(
            TenantAISettings.invite_code == user_data.invite_code.strip()
        ).first()
        if not tenant_settings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã mời (Invite Code) doanh nghiệp không tồn tại hoặc đã hết hạn."
            )
        tenant_id = tenant_settings.tenant_id
        role_id = 3  # Nhân viên của công ty đó
        
        # Đồng bộ gói cước PRO nếu Company Admin của Tenant này đã ở gói PRO
        company_admin = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role_id == 2
        ).first()
        if company_admin:
            subscription_tier = company_admin.subscription_tier
            
    # B. Đăng ký cho Doanh nghiệp (Company Admin)
    elif user_data.company_name:
        # Sinh một tenant_id mới ngẫu nhiên (hoặc tự tăng từ max+1)
        max_tenant_id = db.query(func.max(User.tenant_id)).scalar() or 0
        if max_tenant_id < 100:
            max_tenant_id = 100  # Bắt đầu tenant_id từ 100 trở đi
        tenant_id = max_tenant_id + 1
        role_id = 2  # Company Admin (Trưởng phòng/Admin cấp công ty)
        subscription_tier = "free"  # Mặc định free, doanh nghiệp tự nâng cấp Pro sau

    # Tạo User mới
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name or user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        role_id=role_id,
        subscription_tier=subscription_tier,
        tenant_id=tenant_id,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 4. Khởi tạo AI Settings & Mã mời Doanh nghiệp
    if user_data.company_name:
        # Sinh mã mời dạng COMP-XXXX-YYYY
        import uuid
        short_uuid = str(uuid.uuid4()).split('-')[0].upper()
        invite_code = f"COMP-{tenant_id}-{short_uuid}"
        
        tenant_settings = TenantAISettings(
            tenant_id=tenant_id,
            temperature=0.2,
            response_style="concise",
            show_sources=True,
            preferred_max_tokens=512,
            ollama_endpoint="http://localhost:11434",
            company_name=user_data.company_name.strip(),
            invite_code=invite_code,
            updated_by=new_user.id
        )
        db.add(tenant_settings)
        db.commit()
    else:
        # Tạo User AI Settings mặc định cho cá nhân hoặc nhân viên mới
        default_settings = UserAISettings(
            user_id=new_user.id,
            temperature=0.2,
            response_style="concise",
            show_sources=True,
            preferred_max_tokens=512,
            receive_community_knowledge=False
        )
        db.add(default_settings)
        db.commit()

    return new_user

