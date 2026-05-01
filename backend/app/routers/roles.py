from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.models import Role
from app.schemas.schemas import RoleCreate, RoleUpdate, RoleResponse, SuccessResponse
from app.routers.auth import get_current_admin

router = APIRouter(prefix="/api/roles", tags=["Roles"])


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: Role = Depends(get_current_admin)
):
    roles = db.query(Role).order_by(Role.level).all()
    return roles


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: Role = Depends(get_current_admin)
):
    # Prevent creating role with level 0 (reserved for Admin)
    if role_data.level == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cấp độ 0 được dành riêng cho Admin, không thể tạo chức vụ với cấp độ này"
        )

    # Check if role name exists
    existing = db.query(Role).filter(Role.name == role_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chức vụ '{role_data.name}' đã tồn tại"
        )
    
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        level=role_data.level
    )
    
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    
    return new_role


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: Role = Depends(get_current_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: Role = Depends(get_current_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    
    # Check name uniqueness if changing
    if role_data.name and role_data.name != role.name:
        existing = db.query(Role).filter(Role.name == role_data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ '{role_data.name}' đã tồn tại"
            )
        role.name = role_data.name
    
    # Prevent changing role level to 0 (reserved for Admin)
    if role_data.level is not None and role_data.level == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cấp độ 0 được dành riêng cho Admin, không thể đặt cấp độ này"
        )

    # Update other fields
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
    current_user: Role = Depends(get_current_admin)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy chức vụ ID {role_id}"
        )
    
    # Check if role has users or documents
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
