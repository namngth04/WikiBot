from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.models import Role, User
from app.schemas.schemas import RoleCreate, RoleUpdate, RoleResponse, SuccessResponse
from app.routers.auth import get_current_admin, get_current_company_admin

router = APIRouter(prefix="/api/roles", tags=["Roles"])


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    query = db.query(Role)
    if current_user.tenant_id is not None:
        # Company Admin: chỉ xem chức vụ thuộc doanh nghiệp của mình (cách ly 100%)
        query = query.filter(Role.tenant_id == current_user.tenant_id)
    roles = query.order_by(Role.level).all()
    return roles


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    # Ngăn chặn tạo vai trò có level <= 0 (chỉ Superadmin hệ thống có level = 0 nhưng không nằm ở bảng roles doanh nghiệp)
    if role_data.level <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cấp độ 0 được dành riêng cho hệ thống, vui lòng chọn cấp độ lớn hơn hoặc bằng 1"
        )

    tenant_id = current_user.tenant_id if current_user.tenant_id is not None else role_data.tenant_id

    # Kiểm tra trùng tên vai trò trong nội bộ doanh nghiệp (tenant)
    existing = db.query(Role).filter(Role.name == role_data.name, Role.tenant_id == tenant_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chức vụ '{role_data.name}' đã tồn tại trong doanh nghiệp"
        )
    
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        level=role_data.level,
        tenant_id=tenant_id
    )
    
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    
    return new_role


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and role.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập chức vụ này"
        )
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and role.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa chức vụ này"
        )
    
    # Ngăn chặn cập nhật level chức vụ xuống <= 0
    if role_data.level is not None and role_data.level <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cấp độ 0 được dành riêng cho hệ thống, không thể đặt cấp độ này"
        )

    # Kiểm tra trùng tên vai trò trong nội bộ doanh nghiệp nếu đổi tên
    if role_data.name and role_data.name != role.name:
        existing = db.query(Role).filter(Role.name == role_data.name, Role.tenant_id == role.tenant_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ '{role_data.name}' đã tồn tại"
            )
        role.name = role_data.name
    
    # Cập nhật các trường khác
    if role_data.description is not None:
        role.description = role_data.description
    if role_data.level is not None:
        role.level = role_data.level
    
    db.commit()
    db.refresh(role)
    
    return role


@router.delete("/{role_id}", response_model=SuccessResponse)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy
    if current_user.tenant_id is not None and role.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa chức vụ này"
        )
    
    # Kiểm tra xem chức vụ có người dùng hoặc tài liệu nào đang sử dụng không
    if role.users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa chức vụ '{role.name}' vì có người dùng đang sử dụng"
        )
    
    if role.documents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa chức vụ '{role.name}' vì có tài liệu đang sử dụng"
        )
    
    db.delete(role)
    db.commit()
    
    return SuccessResponse(success=True, message=f"Đã xóa chức vụ '{role.name}'")
