from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, time as datetime_time
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.models import User, Role, UpgradeRequest, Message, Conversation, Document
from app.routers.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/api/upgrade", tags=["Upgrade & Quota System"])


# ============== Schemas ==============
class UpgradeRequestResponse(BaseModel):
    id: int
    user_id: int
    username: str
    full_name: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuotaResponse(BaseModel):
    subscription_tier: str
    questions_limit: int
    questions_used: int
    documents_limit: int
    documents_used: int
    file_size_limit_mb: float
    ollama_allowed: bool
    staff_limit: Optional[int] = None
    staff_used: Optional[int] = None


# ============== Helpers ==============
def get_current_superadmin(current_user: User = Depends(get_current_admin)) -> User:
    """Superadmin must be an Admin (level=0) and not belong to any tenant (tenant_id is NULL)"""
    if current_user.tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền Superadmin hệ thống"
        )
    return current_user


# ============== Endpoints ==============

@router.post("/request", status_code=status.HTTP_201_CREATED)
def request_upgrade(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Ràng buộc: Cho phép Personal User hoặc Company Admin nâng cấp
    if current_user.tenant_id is not None:
        if not current_user.role or current_user.role.level != 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ Quản trị viên Doanh nghiệp mới có quyền nâng cấp gói cước Doanh nghiệp."
            )
    
    # 2. Ràng buộc: Chỉ áp dụng khi tài khoản đang ở gói free
    if current_user.subscription_tier != "free":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tài khoản của bạn hiện đang ở gói {current_user.subscription_tier.upper()}"
        )
    
    # 3. Ràng buộc: Không được có yêu cầu nâng cấp đang ở trạng thái pending
    existing_pending = db.query(UpgradeRequest).filter(
        UpgradeRequest.user_id == current_user.id,
        UpgradeRequest.status == "pending"
    ).first()
    
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn đã gửi một yêu cầu nâng cấp trước đó và đang chờ phê duyệt"
        )
    
    # Tạo yêu cầu nâng cấp mới và tự động phê duyệt ngay lập tức (Auto-approve)
    new_request = UpgradeRequest(
        user_id=current_user.id,
        status="approved"
    )
    db.add(new_request)
    
    # Nâng cấp gói cước cho người dùng lên PRO
    current_user.subscription_tier = "pro"
    
    # Nếu user có tenant_id (doanh nghiệp), nâng cấp toàn bộ nhân sự cùng tenant lên PRO
    if current_user.tenant_id is not None:
        db.query(User).filter(User.tenant_id == current_user.tenant_id).update(
            {"subscription_tier": "pro"}
        )
        
    db.commit()
    
    return {
        "request_id": new_request.id,
        "status": "approved"
    }


@router.get("/requests", response_model=List[UpgradeRequestResponse])
def list_upgrade_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Superadmin views all upgrade requests"""
    requests = db.query(UpgradeRequest).order_by(UpgradeRequest.created_at.desc()).all()
    
    result = []
    for req in requests:
        user = db.query(User).filter(User.id == req.user_id).first()
        is_corporate = user.tenant_id is not None if user else False
        result.append(
            UpgradeRequestResponse(
                id=req.id,
                user_id=req.user_id,
                username=user.username if user else "N/A",
                full_name=user.full_name if user else "Người dùng ẩn danh",
                status=req.status,
                created_at=req.created_at,
                type="corporate" if is_corporate else "personal",
                plan_name="PREMIUM SaaS 🛡️" if is_corporate else "PRO TIER ⚡"
            )
        )
    return result


@router.post("/approve/{request_id}")
def approve_upgrade(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Superadmin approves an upgrade request (Transaction safety)"""
    req = db.query(UpgradeRequest).filter(UpgradeRequest.id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy yêu cầu nâng cấp ID {request_id}"
        )
    
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Yêu cầu nâng cấp này đã được xử lý (Trạng thái hiện tại: {req.status})"
        )
    
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Người dùng gửi yêu cầu này không còn tồn tại trên hệ thống"
        )
    
    # Thực hiện transaction đồng thời cập nhật yêu cầu và nâng cấp gói cước người dùng
    try:
        req.status = "approved"
        user.subscription_tier = "pro"
        db.commit()
        return {"message": f"Đã phê duyệt thành công. Tài khoản {user.username} đã được nâng cấp lên gói PRO."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi phê duyệt: {str(e)}"
        )


@router.post("/reject/{request_id}")
def reject_upgrade(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_superadmin)
):
    """Superadmin rejects an upgrade request"""
    req = db.query(UpgradeRequest).filter(UpgradeRequest.id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy yêu cầu nâng cấp ID {request_id}"
        )
    
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Yêu cầu nâng cấp này đã được xử lý (Trạng thái hiện tại: {req.status})"
        )
    
    req.status = "rejected"
    db.commit()
    return {"message": "Đã từ chối yêu cầu nâng cấp."}


@router.get("/quota", response_model=QuotaResponse)
def get_user_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's SaaS tier quota and consumption statistics"""
    # 1. Đếm số câu hỏi đã dùng hôm nay (sử dụng Redis + DB fallback)
    from app.services.semantic_cache import SemanticCacheService
    cache_service = SemanticCacheService(db)
    questions_used = cache_service.get_user_quota_used(current_user.id, current_user.tenant_id)
    
    # 2. Đếm số tài liệu đã tải lên và còn active
    documents_used = db.query(Document).filter(
        Document.uploaded_by == current_user.id,
        Document.is_active == True
    ).count()
    
    # 3. Định hình cấu trúc hạn ngạch dựa trên loại gói cước (SaaS Tier)
    tier = current_user.subscription_tier or "free"
    
    # Hệ thống quản trị viên (Superadmin/Admin level=0) luôn được hưởng hạn ngạch tối đa không giới hạn
    is_admin = current_user.role and current_user.role.level == 0
    if is_admin:
        return QuotaResponse(
            subscription_tier="enterprise",
            questions_limit=999999,
            questions_used=questions_used,
            documents_limit=999999,
            documents_used=documents_used,
            file_size_limit_mb=100.0,
            ollama_allowed=True
        )
    
    # Nếu thuộc công ty (Company Staff/Admin), họ tự động hưởng các hạn ngạch dựa trên gói của Company Admin
    if current_user.tenant_id is not None:
        company_admin = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            User.role.has(level=1)
        ).first()
        is_free = (company_admin.subscription_tier == "free") if company_admin else True
        
        staff_used = db.query(User).filter(User.tenant_id == current_user.tenant_id).count()
        
        documents_used = db.query(Document).filter(
            Document.tenant_id == current_user.tenant_id,
            Document.is_active == True
        ).count()
        
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        questions_used = cache_service.get_user_quota_used(current_user.id, current_user.tenant_id)
        
        if is_free:
            return QuotaResponse(
                subscription_tier="free",
                questions_limit=10,
                questions_used=questions_used,
                documents_limit=3,
                documents_used=documents_used,
                file_size_limit_mb=2.0,
                ollama_allowed=False,
                staff_limit=5,
                staff_used=staff_used
            )
        else:
            return QuotaResponse(
                subscription_tier="pro",
                questions_limit=999999,
                questions_used=questions_used,
                documents_limit=999999,
                documents_used=documents_used,
                file_size_limit_mb=100.0,
                ollama_allowed=True,
                staff_limit=None,
                staff_used=staff_used
            )
    
    if tier == "pro":
        return QuotaResponse(
            subscription_tier="pro",
            questions_limit=999999,
            questions_used=questions_used,
            documents_limit=999999,
            documents_used=documents_used,
            file_size_limit_mb=100.0,
            ollama_allowed=True
        )
    else:  # free
        return QuotaResponse(
            subscription_tier="free",
            questions_limit=10,
            questions_used=questions_used,
            documents_limit=3,
            documents_used=documents_used,
            file_size_limit_mb=2.0,
            ollama_allowed=False
        )
