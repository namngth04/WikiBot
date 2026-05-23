"""
User AI Settings Router
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.models import User, UserAISettings, AISafetyConfig
from app.schemas.schemas import UserAISettingsSchema, UserAISettingsResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/users/me/ai-settings", tags=["User AI Settings"])


@router.get("", response_model=UserAISettingsResponse)
def get_user_ai_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's AI settings"""
    # Nếu user là Company Staff (level == 2), tự động load cấu hình Tenant dùng chung
    if current_user.role and current_user.role.level == 2 and current_user.tenant_id is not None:
        from app.models.models import TenantAISettings
        settings = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == current_user.tenant_id).first()
        if not settings:
            # Tự động tạo cấu hình Tenant mặc định
            settings = TenantAISettings(
                tenant_id=current_user.tenant_id,
                temperature=0.2,
                response_style="concise",
                show_sources=True,
                preferred_max_tokens=512,
                ollama_endpoint="http://localhost:11434"
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        # Format response tương thích với UserAISettingsResponse
        return {
            "id": settings.id,
            "user_id": current_user.id,
            "temperature": settings.temperature,
            "response_style": settings.response_style,
            "show_sources": settings.show_sources,
            "preferred_max_tokens": settings.preferred_max_tokens,
            "receive_community_knowledge": False,  # Staff không tự ý dùng tri thức cộng đồng
            "ollama_endpoint": settings.ollama_endpoint,
            "updated_at": settings.updated_at
        }

    settings = db.query(UserAISettings).filter(UserAISettings.user_id == current_user.id).first()
    
    if not settings:
        # Create default settings
        safety = db.query(AISafetyConfig).first()
        settings = UserAISettings(
            user_id=current_user.id,
            temperature=safety.default_temperature if safety else 0.2,
            response_style=safety.default_response_style if safety else "concise",
            show_sources=True,
            preferred_max_tokens=512
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings



@router.put("", response_model=UserAISettingsResponse)
def update_user_ai_settings(
    settings_data: UserAISettingsSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's AI settings"""
    # Chặn Company Staff (level == 2)
    if current_user.role and current_user.role.level == 2:
        raise HTTPException(
            status_code=403,
            detail="Nhân viên công ty không được phép thay đổi cấu hình AI cá nhân. Cấu hình được quản lý tập trung bởi công ty."
        )
        
    # Validate against safety limits

    safety = db.query(AISafetyConfig).first()
    if safety:
        if settings_data.temperature > safety.max_temperature_limit:
            raise HTTPException(
                status_code=400, 
                detail=f"Temperature exceeds maximum limit: {safety.max_temperature_limit}"
            )
        if settings_data.preferred_max_tokens > safety.max_tokens_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Max tokens exceeds limit: {safety.max_tokens_limit}"
            )
    
    # Get or create settings
    settings = db.query(UserAISettings).filter(UserAISettings.user_id == current_user.id).first()
    if not settings:
        settings = UserAISettings(user_id=current_user.id)
        db.add(settings)
    
    # Check Quota Guard for Free Tier (Personal User)
    if current_user.subscription_tier == "free" and current_user.tenant_id is None:
        if settings_data.ollama_endpoint != "http://localhost:11434":
            raise HTTPException(
                status_code=403,
                detail="Tính năng kết nối Ollama Local riêng chỉ dành cho gói Pro. Vui lòng nâng cấp tài khoản."
            )
    
    # Update fields
    settings.temperature = settings_data.temperature
    settings.response_style = settings_data.response_style
    settings.show_sources = settings_data.show_sources
    settings.preferred_max_tokens = settings_data.preferred_max_tokens
    
    # Update advanced fields based on subscription tier / tenant
    if current_user.subscription_tier == "pro" or current_user.tenant_id is not None:
        settings.receive_community_knowledge = settings_data.receive_community_knowledge
        settings.ollama_endpoint = settings_data.ollama_endpoint
    else:
        settings.receive_community_knowledge = False
        settings.ollama_endpoint = "http://localhost:11434"
        
    settings.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(settings)
    
    return settings


@router.get("/limits")
def get_user_ai_limits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get AI limits for current user (for UI display)"""
    safety = db.query(AISafetyConfig).first()
    
    if not safety:
        return {
            "max_temperature": 1.0,
            "max_context_length": 8192,
            "max_tokens": 2048,
            "default_temperature": 0.2,
            "default_response_style": "concise"
        }
    
    return {
        "max_temperature": safety.max_temperature_limit,
        "max_context_length": safety.max_context_length,
        "max_tokens": safety.max_tokens_limit,
        "default_temperature": safety.default_temperature,
        "default_response_style": safety.default_response_style
    }
