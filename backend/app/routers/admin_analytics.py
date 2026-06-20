from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict

from app.core.database import get_db
from app.models.models import User
from app.routers.auth import get_current_company_admin
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/admin/analytics", tags=["Admin Analytics"])


import os
import json
from datetime import datetime

@router.get("/topics", response_model=List[Dict])
def get_company_topic_analytics(
    days: int = Query(7, ge=1, le=30),
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    """
    Endpoint dành riêng cho Company Admin (hoặc Superadmin) để xem thống kê chủ đề
    nhân viên công ty đang hỏi nhiều nhất trong N ngày qua (mặc định 7 ngày).
    Kết quả được cache 1 lần mỗi ngày để tiết kiệm tài nguyên.
    """
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn chưa được liên kết với bất kỳ Doanh nghiệp/Workspace nào."
        )
        
    # Tạo thư mục cache nếu chưa tồn tại
    cache_dir = os.path.join("data", "analytics_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    current_date = datetime.utcnow().strftime("%Y-%m-%d")
    cache_filename = f"topics_{current_user.tenant_id}_{days}_{current_date}.json"
    cache_path = os.path.join(cache_dir, cache_filename)
    
    # Nếu không yêu cầu refresh và file cache của ngày hôm nay đã tồn tại, trả về cache ngay lập tức
    if not refresh and os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as ce:
            print(f"[WARNING] Đọc cache phân tích chủ đề thất bại: {ce}")

    try:
        service = AnalyticsService(db)
        analytics_result = service.get_topic_analytics(
            tenant_id=current_user.tenant_id,
            days_limit=days
        )
        
        # Lưu kết quả mới vào file cache của ngày hôm nay
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(analytics_result, f, ensure_ascii=False, indent=2)
        except Exception as ce:
            print(f"[WARNING] Ghi cache phân tích chủ đề thất bại: {ce}")
            
        return analytics_result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tính toán phân tích chủ đề: {str(e)}"
        )
