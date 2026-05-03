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
    
    # Update fields
    settings.temperature = settings_data.temperature
    settings.response_style = settings_data.response_style
    settings.show_sources = settings_data.show_sources
    settings.preferred_max_tokens = settings_data.preferred_max_tokens
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
