from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta
import json
import os
from app.core.config import get_settings

try:
    import psutil
except ImportError:
    psutil = None

from app.core.database import get_db
from app.models.models import User, Message, Document, FAQ, Conversation, TenantAISettings
from app.schemas.schemas import (
    DashboardStats, UsageStats, FAQResponse, FAQCreate, FAQUpdate, 
    SuggestedFAQ, SuccessResponse, TenantAISettingsSchema, TenantAISettingsResponse
)
from app.routers.auth import get_current_admin, get_current_company_admin

from app.services.response_generator import ResponseGenerator
from app.services.faq_clustering import (
    cluster_similar_questions_with_ai,
    get_suggested_faqs_rule_based
)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

# Simple in-memory cache for suggested FAQs (24 hours)
_suggested_faqs_cache = {
    "data": None,
    "timestamp": None,
    "cache_duration": 86400  # 24 hours in seconds
}

@router.get("/stats/overview", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    total_users = db.query(User).count()
    total_messages = db.query(Message).count()
    total_documents = db.query(Document).count()
    
    # Calculate satisfaction rate
    likes = db.query(Message).filter(Message.rating == 1).count()
    dislikes = db.query(Message).filter(Message.rating == -1).count()
    total_rated = likes + dislikes
    satisfaction_rate = (likes / total_rated * 100) if total_rated > 0 else 0.0
    
    # Feedback ratio
    no_rating = db.query(Message).filter(Message.role == "assistant", Message.rating.is_(None)).count()
    
    # Tính toán trend so với ngày hôm qua
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    # User trend: số người dùng mới hôm nay so với hôm qua
    users_today = db.query(User).filter(User.created_at >= yesterday).count()
    users_yesterday = db.query(User).filter(
        User.created_at >= yesterday - timedelta(days=1),
        User.created_at < yesterday
    ).count()
    user_trend = round((users_today - users_yesterday) / users_yesterday * 100, 1) if users_yesterday > 0 else None
    
    # Message trend: số tin nhắn hôm nay so với hôm qua
    messages_today = db.query(Message).filter(Message.created_at >= yesterday).count()
    messages_yesterday = db.query(Message).filter(
        Message.created_at >= yesterday - timedelta(days=1),
        Message.created_at < yesterday
    ).count()
    message_trend = round((messages_today - messages_yesterday) / messages_yesterday * 100, 1) if messages_yesterday > 0 else None
    
    # Document trend: số tài liệu upload hôm nay so với hôm qua
    documents_today = db.query(Document).filter(Document.uploaded_at >= yesterday).count()
    documents_yesterday = db.query(Document).filter(
        Document.uploaded_at >= yesterday - timedelta(days=1),
        Document.uploaded_at < yesterday
    ).count()
    document_trend = round((documents_today - documents_yesterday) / documents_yesterday * 100, 1) if documents_yesterday > 0 else None
    
    # Rating trend: tỷ lệ hài lòng hôm nay so với hôm qua
    likes_today = db.query(Message).filter(Message.rating == 1, Message.created_at >= yesterday).count()
    dislikes_today = db.query(Message).filter(Message.rating == -1, Message.created_at >= yesterday).count()
    total_rated_today = likes_today + dislikes_today
    satisfaction_rate_today = (likes_today / total_rated_today * 100) if total_rated_today > 0 else 0.0
    
    likes_yesterday = db.query(Message).filter(
        Message.rating == 1,
        Message.created_at >= yesterday - timedelta(days=1),
        Message.created_at < yesterday
    ).count()
    dislikes_yesterday = db.query(Message).filter(
        Message.rating == -1,
        Message.created_at >= yesterday - timedelta(days=1),
        Message.created_at < yesterday
    ).count()
    total_rated_yesterday = likes_yesterday + dislikes_yesterday
    satisfaction_rate_yesterday = (likes_yesterday / total_rated_yesterday * 100) if total_rated_yesterday > 0 else 0.0
    
    rating_trend = round((satisfaction_rate_today - satisfaction_rate_yesterday) / satisfaction_rate_yesterday * 100, 1) if satisfaction_rate_yesterday > 0 else None
    
    return {
        "total_users": total_users,
        "total_messages": total_messages,
        "total_documents": total_documents,
        "satisfaction_rate": round(satisfaction_rate, 1),
        "rating_details": {
            "likes": likes,
            "dislikes": dislikes,
            "total_rated": total_rated
        },
        "feedback_ratio": {
            "like": likes,
            "dislike": dislikes,
            "none": no_rating
        },
        "user_trend": user_trend,
        "message_trend": message_trend,
        "document_trend": document_trend,
        "rating_trend": rating_trend
    }

@router.get("/stats/usage", response_model=List[UsageStats])
def get_usage_stats(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Group by date
    stats = db.query(
        func.date(Message.created_at).label("date"),
        func.count(Message.id).label("count")
    ).filter(
        Message.created_at >= start_date,
        Message.role == "user"
    ).group_by(
        func.date(Message.created_at)
    ).order_by("date").all()
    
    return [{"date": str(s.date), "count": int(s.count)} for s in stats]

# ============== FAQ Management ==============

@router.get("/faqs", response_model=List[FAQResponse])
def list_faqs(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(FAQ)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            FAQ.question.ilike(search_term) | FAQ.answer.ilike(search_term)
        )
    
    return query.order_by(desc(FAQ.created_at)).offset(skip).limit(limit).all()

@router.post("/faqs", response_model=FAQResponse)
def create_faq(
    faq_data: FAQCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    new_faq = FAQ(**faq_data.dict())
    db.add(new_faq)
    db.commit()
    db.refresh(new_faq)
    return new_faq

@router.put("/faqs/{faq_id}", response_model=FAQResponse)
def update_faq(
    faq_id: int,
    faq_data: FAQUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    
    for key, value in faq_data.dict(exclude_unset=True).items():
        setattr(faq, key, value)
    
    db.commit()
    db.refresh(faq)
    return faq

@router.delete("/faqs/{faq_id}", response_model=SuccessResponse)
def delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    
    db.delete(faq)
    db.commit()
    return {"success": True, "message": "FAQ deleted successfully"}

@router.get("/faqs/suggested", response_model=List[SuggestedFAQ])
def get_suggested_faqs(
    limit: int = 10,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    global _suggested_faqs_cache
    current_time = datetime.utcnow().timestamp()
    
    # Check cache
    if (not force_refresh and 
        _suggested_faqs_cache["data"] is not None and
        _suggested_faqs_cache["timestamp"] is not None and
        (current_time - _suggested_faqs_cache["timestamp"]) < _suggested_faqs_cache["cache_duration"]):
        return _suggested_faqs_cache["data"]
    
    # Generate new suggestions with AI clustering
    try:
        clusters = cluster_similar_questions_with_ai(db, limit)
        
        # Convert to SuggestedFAQ format
        result = [
            SuggestedFAQ(
                question=cluster["canonical"],
                occurrence=cluster["total_occurrences"]
            )
            for cluster in clusters
        ]
        
        # Update cache
        _suggested_faqs_cache["data"] = result
        _suggested_faqs_cache["timestamp"] = current_time
        
        return result
        
    except Exception as e:
        print(f"Error in AI clustering, falling back to rule-based: {e}")
        # Fallback to rule-based
        try:
            clusters = get_suggested_faqs_rule_based(db, limit)
            result = [
                SuggestedFAQ(
                    question=cluster["canonical"],
                    occurrence=cluster["total_occurrences"]
                )
                for cluster in clusters
            ]
            
            # Update cache with fallback results
            _suggested_faqs_cache["data"] = result
            _suggested_faqs_cache["timestamp"] = current_time
            
            return result
        except Exception as fallback_error:
            print(f"Error in fallback: {fallback_error}")
            raise HTTPException(status_code=500, detail="Failed to get suggested FAQs")

@router.post("/faqs/suggested/refresh", response_model=List[SuggestedFAQ])
def refresh_suggested_faqs(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Force refresh suggested FAQs by calling AI clustering again"""
    return get_suggested_faqs(limit=limit, force_refresh=True, db=db, current_admin=current_admin)

@router.post("/faqs/generate-draft", response_model=SuggestedFAQ)
def generate_faq_draft(
    question: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    response_generator = ResponseGenerator(db=db)
    # Use RAG to get context and generate a professional answer
    # This is a simplified version of the logic
    try:
        # Get context from documents
        chunks = response_generator.hybrid_retriever.search(question, accessible_role_ids=[0], top_k=3)
        if not chunks:
            return SuggestedFAQ(question=question, occurrence=1, suggested_answer="Không tìm thấy tài liệu liên quan để soạn câu trả lời.")
        
        context = "\n".join([c['content'] for c in chunks])
        prompt = f"""Dựa trên tài liệu sau đây, hãy viết một câu trả lời FAQ chuyên nghiệp, ngắn gọn cho câu hỏi của người dùng.
Tài liệu: {context}
Câu hỏi: {question}
Câu trả lời FAQ:"""
        
        # Use provider to generate answer
        answer = response_generator.llm_provider.generate(
            prompt,
            max_tokens=256,
            temperature=0.2,
            stop=["\n\n", "Người dùng:", "Trợ lý:"]
        )
        
        return SuggestedFAQ(question=question, occurrence=1, suggested_answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi soạn thảo AI: {str(e)}")


# ============== Tenant AI Settings (Company Admin) ==============

@router.get("/tenant/ai-settings", response_model=TenantAISettingsResponse)
def get_tenant_ai_settings(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_company_admin)
):
    """Get AI settings for current tenant (Company Admin or Superadmin)"""
    tenant_id = current_admin.tenant_id if current_admin.tenant_id is not None else 0
    
    settings = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == tenant_id).first()
    if not settings:
        settings = TenantAISettings(
            tenant_id=tenant_id,
            temperature=0.2,
            response_style="concise",
            show_sources=True,
            preferred_max_tokens=512,
            ollama_endpoint="http://localhost:11434",
            updated_by=current_admin.id
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
    return settings


@router.put("/tenant/ai-settings", response_model=TenantAISettingsResponse)
def update_tenant_ai_settings(
    settings_data: TenantAISettingsSchema,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_company_admin)
):
    """Update AI settings for current tenant (Company Admin or Superadmin)"""
    tenant_id = current_admin.tenant_id if current_admin.tenant_id is not None else 0
    
    # Enforce safety limits
    from app.models.models import AISafetyConfig
    safety = db.query(AISafetyConfig).first()
    if safety:
        if settings_data.temperature > safety.max_temperature_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Temperature vượt quá giới hạn hệ thống: {safety.max_temperature_limit}"
            )
        if settings_data.preferred_max_tokens > safety.max_tokens_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Max tokens vượt quá giới hạn hệ thống: {safety.max_tokens_limit}"
            )
            
    settings = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == tenant_id).first()
    if not settings:
        settings = TenantAISettings(tenant_id=tenant_id)
        db.add(settings)
        
    settings.temperature = settings_data.temperature
    settings.response_style = settings_data.response_style
    settings.show_sources = settings_data.show_sources
    settings.preferred_max_tokens = settings_data.preferred_max_tokens
    settings.ollama_endpoint = settings_data.ollama_endpoint
    settings.updated_by = current_admin.id
    settings.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/stats/resources")
def get_system_resources(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get system resources and statistics for Superadmin dashboard"""
    # Enforce Superadmin check (role level 0, tenant_id must be None)
    if not current_admin.role or current_admin.role.level != 0 or current_admin.tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên tối cao của hệ thống (Superadmin)."
        )
        
    settings = get_settings()
    data_dir = settings.data_dir
    
    # Calculate disk usage of document folder
    disk_usage_mb = 0.0
    if os.path.exists(data_dir):
        for dirpath, dirnames, filenames in os.walk(data_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    try:
                        disk_usage_mb += os.path.getsize(fp)
                    except OSError:
                        pass
    disk_usage_mb = round(disk_usage_mb / (1024 * 1024), 2)  # MB
    
    # Get total vector chunks in database
    total_chunks = db.query(func.sum(Document.chunk_count)).filter(Document.is_active == True).scalar() or 0
    
    # Measure RAM & CPU usage
    cpu_usage_percent = 0.0
    ram_usage_percent = 0.0
    if psutil:
        try:
            cpu_usage_percent = psutil.cpu_percent(interval=None)
            ram_usage_percent = psutil.virtual_memory().percent
        except Exception:
            pass
            
    # Count unique tenants
    total_tenants = db.query(func.count(func.distinct(User.tenant_id))).filter(
        User.tenant_id.isnot(None), 
        User.tenant_id != 0
    ).scalar() or 0
    
    return {
        "disk_usage_mb": disk_usage_mb,
        "chromadb_chunks": int(total_chunks),
        "ram_usage_percent": round(ram_usage_percent, 1),
        "cpu_usage_percent": round(cpu_usage_percent, 1),
        "total_tenants": int(total_tenants)
    }


@router.get("/tenants")
def list_tenants(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """List all registered tenants on the platform (Superadmin only)"""
    if not current_admin.role or current_admin.role.level != 0 or current_admin.tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên tối cao của hệ thống (Superadmin)."
        )
        
    tenant_settings = db.query(TenantAISettings).filter(TenantAISettings.tenant_id > 0).all()
    
    result = []
    for t in tenant_settings:
        # Đếm số lượng nhân sự thuộc tenant này
        staff_count = db.query(User).filter(User.tenant_id == t.tenant_id).count()
        
        # Đếm số lượng tài liệu đã tải lên
        doc_count = db.query(Document).filter(Document.tenant_id == t.tenant_id).count()
        
        # Tìm Company Admin (role_id = 2) để lấy trạng thái hoạt động của doanh nghiệp
        company_admin = db.query(User).filter(
            User.tenant_id == t.tenant_id,
            User.role_id == 2
        ).first()
        
        is_active = company_admin.is_active if company_admin else True
        
        result.append({
            "tenant_id": t.tenant_id,
            "company_name": t.company_name or f"Doanh nghiệp #{t.tenant_id}",
            "invite_code": t.invite_code or "N/A",
            "staff_count": staff_count,
            "doc_count": doc_count,
            "is_active": is_active
        })
        
    return result


@router.put("/tenants/{tenant_id}/status")
def toggle_tenant_status(
    tenant_id: int,
    is_active: bool,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Suspend or Activate a tenant (Superadmin only)"""
    if not current_admin.role or current_admin.role.level != 0 or current_admin.tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yêu cầu quyền quản trị viên tối cao của hệ thống (Superadmin)."
        )
        
    # Tìm xem tenant này có tồn tại trong TenantAISettings không
    tenant = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Doanh nghiệp ID {tenant_id}"
        )
        
    try:
        # Cập nhật trạng thái is_active cho tất cả user cùng tenant_id đó
        db.query(User).filter(User.tenant_id == tenant_id).update({"is_active": is_active})
        db.commit()
        
        status_text = "kích hoạt" if is_active else "vô hiệu hóa"
        return {
            "success": True,
            "message": f"Đã {status_text} thành công toàn bộ tài khoản thuộc doanh nghiệp {tenant.company_name or tenant_id}."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi cập nhật trạng thái: {str(e)}"
        )



