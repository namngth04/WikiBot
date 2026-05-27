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
    if current_user.user_type != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên hệ thống (Superadmin)"
        )
    return current_user


def get_current_company_admin(current_user: User = Depends(get_current_user)) -> User:
    # Superadmin có đầy đủ quyền quản trị cao nhất
    if current_user.user_type == "superadmin":
        return current_user
        
    # Company Admin là nhân viên (employee) có chức vụ với level = 1
    if current_user.user_type == "employee" and current_user.role and current_user.role.level == 1 and current_user.tenant_id is not None:
        return current_user
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Yêu cầu quyền quản trị viên công ty hoặc hệ thống"
    )



from pydantic import BaseModel
import datetime

class SelectTenantRequest(BaseModel):
    temp_token: str
    tenant_id: Optional[int] = None

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Tìm kiếm tài khoản theo username hoặc email
    users = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).all()
    
    # Lọc ra danh sách tài khoản khớp mật khẩu và đang hoạt động
    valid_users = [u for u in users if verify_password(form_data.password, u.hashed_password) and u.is_active]
    
    if not valid_users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập, email hoặc mật khẩu không đúng",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Nếu có nhiều Workspace kết nối với email này
    if len(valid_users) > 1:
        # Tạo temp_token chứa danh sách user_id hợp lệ
        temp_token = create_access_token(
            data={"temp_user_ids": [u.id for u in valid_users]},
            expires_delta=datetime.timedelta(minutes=10)
        )
        
        # Lấy danh sách Workspace
        tenants_list = []
        for u in valid_users:
            if u.tenant_id is None:
                company_name = "Cá nhân (Tài liệu riêng)"
            else:
                tenant_settings = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == u.tenant_id).first()
                company_name = tenant_settings.company_name if tenant_settings and tenant_settings.company_name else f"Công ty #{u.tenant_id}"
            
            tenants_list.append({
                "tenant_id": u.tenant_id,
                "company_name": company_name,
                "username": u.username
            })
            
        return {
            "require_tenant_selection": True,
            "temp_token": temp_token,
            "tenants": tenants_list
        }
    
    # Đăng nhập trực tiếp nếu chỉ có 1 Workspace
    user = valid_users[0]
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
    }


@router.post("/login/select-tenant")
def select_tenant(request_data: SelectTenantRequest, db: Session = Depends(get_db)):
    payload = decode_token(request_data.temp_token)
    if payload is None or "temp_user_ids" not in payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác thực tạm thời không hợp lệ hoặc đã hết hạn"
        )
        
    temp_user_ids = payload["temp_user_ids"]
    
    # Tìm user có id trong temp_user_ids và khớp với tenant_id được chọn
    user = db.query(User).filter(
        User.id.in_(temp_user_ids),
        User.tenant_id == request_data.tenant_id,
        User.is_active == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lựa chọn Workspace không hợp lệ hoặc tài khoản đã bị khóa"
        )
        
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
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
    
    # 2. Phân luồng đăng ký SaaS tự phục vụ để xác định tenant_id trước
    role_id = None  # Mặc định cá nhân không cần chức vụ ở bảng roles
    user_type = "personal"
    subscription_tier = "free"
    tenant_id = None
    
    # Đăng ký cho Doanh nghiệp (Company Admin)
    if user_data.company_name:
        # Sinh một tenant_id mới ngẫu nhiên (hoặc tự tăng từ max+1)
        max_tenant_id = db.query(func.max(User.tenant_id)).scalar() or 0
        if max_tenant_id is None or max_tenant_id < 100:
            max_tenant_id = 100  # Bắt đầu tenant_id từ 100 trở đi
        tenant_id = max_tenant_id + 1
        
        # Tự động tạo bộ chức vụ mặc định cho doanh nghiệp này
        admin_role = Role(
            name="Admin",
            description="Quản trị viên doanh nghiệp",
            level=1,
            tenant_id=tenant_id
        )
        employee_role = Role(
            name="Nhân viên",
            description="Nhân viên doanh nghiệp",
            level=2,
            tenant_id=tenant_id
        )
        db.add(admin_role)
        db.add(employee_role)
        db.commit()  # Commit để sinh ID cho vai trò mới
        db.refresh(admin_role)
        db.refresh(employee_role)
        
        role_id = admin_role.id
        user_type = "employee"
        subscription_tier = "free"  # Mặc định free, doanh nghiệp tự nâng cấp Pro sau
        
    # Đăng ký cho Nhân viên Doanh nghiệp bằng mã mời
    elif user_data.invite_code:
        tenant_settings = db.query(TenantAISettings).filter(
            TenantAISettings.invite_code == user_data.invite_code.strip()
        ).first()
        if not tenant_settings:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã mời doanh nghiệp không hợp lệ hoặc đã hết hạn"
            )
        tenant_id = tenant_settings.tenant_id
        user_type = "employee"
        subscription_tier = "free"
        
        # Tìm vai trò "Nhân viên" của doanh nghiệp này (có level=2)
        emp_role = db.query(Role).filter(
            Role.tenant_id == tenant_id,
            Role.level == 2
        ).first()
        if emp_role:
            role_id = emp_role.id

    # 3. Kiểm tra email nếu được cung cấp (chỉ cấm nếu email đã đăng ký cho cùng tenant_id)
    if user_data.email:
        existing_email = db.query(User).filter(
            User.email == user_data.email,
            User.tenant_id == tenant_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email này đã được sử dụng đăng ký tài khoản khác trong tổ chức này"
            )
        pass
 
    # Tạo User mới
    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name or user_data.username,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=get_password_hash(user_data.password),
        role_id=role_id,
        user_type=user_type,
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

