"""
Chat Models API Router
Manages CRUD and connection testing for custom LLM models
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.core.database import get_db
from app.models.models import User, ChatModel
from app.schemas.schemas import ChatModelCreate, ChatModelUpdate, ChatModelResponse, SuccessResponse
from app.routers.auth import get_current_user
from app.services.llm_providers import APIKeyEncryption, ProviderFactory

router = APIRouter(prefix="/api/chat-models", tags=["Chat Models"])


@router.get("", response_model=List[ChatModelResponse])
def list_chat_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get active chat models available for the current user.
    Includes active global models, active tenant models, and active personal models.
    """
    query = db.query(ChatModel).filter(ChatModel.is_active == True)
    
    # Apply context filter
    filters = [ChatModel.is_global == True]
    
    if current_user.tenant_id is not None:
        filters.append(ChatModel.tenant_id == current_user.tenant_id)
        
    filters.append(ChatModel.user_id == current_user.id)
    
    from sqlalchemy import or_
    query = query.filter(or_(*filters))
    
    models = query.order_by(ChatModel.created_at.desc()).all()
    
    # Hide API keys in response (schemas will handle this by returning has_api_key)
    result = []
    for model in models:
        response_data = ChatModelResponse.from_orm(model)
        response_data.has_api_key = bool(model.api_key and model.api_key.strip())
        result.append(response_data)
        
    return result


@router.get("/admin", response_model=List[ChatModelResponse])
def list_chat_models_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manage-level list of chat models for configuration views.
    Superadmin sees all, Company Admin sees tenant models, Personal User sees own models.
    """
    is_superadmin = current_user.user_type == "superadmin" or (current_user.role and current_user.role.level == 0 and current_user.tenant_id is None)
    is_company_admin = current_user.user_type == "employee" and current_user.role and current_user.role.level == 1
    
    query = db.query(ChatModel)
    
    if is_superadmin:
        # Superadmin only sees global models
        query = query.filter(ChatModel.is_global == True)
    elif is_company_admin:
        # Company Admin sees tenant-specific models (not global or other tenants)
        query = query.filter(ChatModel.tenant_id == current_user.tenant_id)
    else:
        # Personal User sees own models
        query = query.filter(ChatModel.user_id == current_user.id)
        
    models = query.order_by(ChatModel.created_at.desc()).all()
    
    result = []
    for model in models:
        response_data = ChatModelResponse.from_orm(model)
        response_data.has_api_key = bool(model.api_key and model.api_key.strip())
        result.append(response_data)
        
    return result


@router.post("", response_model=ChatModelResponse, status_code=status.HTTP_201_CREATED)
def create_chat_model(
    model_data: ChatModelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Register a new custom LLM model.
    Superadmin creates global models, Company Admin creates tenant models, Personal User creates personal models.
    """
    is_superadmin = current_user.user_type == "superadmin" or (current_user.role and current_user.role.level == 0 and current_user.tenant_id is None)
    is_company_admin = current_user.user_type == "employee" and current_user.role and current_user.role.level == 1
    
    # Encrypt API Key if provided
    encrypted_key = None
    if model_data.api_key:
        encryption = APIKeyEncryption()
        encrypted_key = encryption.encrypt(model_data.api_key)
        
    # Auto-assign context ownership based on user credentials
    is_global = False
    tenant_id = None
    user_id = None
    
    if is_superadmin:
        is_global = True
    elif is_company_admin:
        tenant_id = current_user.tenant_id
    else:
        user_id = current_user.id
        
    new_model = ChatModel(
        name=model_data.name,
        provider=model_data.provider,
        api_base_url=model_data.api_base_url,
        api_key=encrypted_key,
        api_model=model_data.api_model,
        is_global=is_global,
        tenant_id=tenant_id,
        user_id=user_id,
        is_active=False # Should pass connection testing first to become active
    )
    
    db.add(new_model)
    db.commit()
    db.refresh(new_model)
    
    response_data = ChatModelResponse.from_orm(new_model)
    response_data.has_api_key = bool(new_model.api_key)
    return response_data


@router.put("/{model_id}", response_model=ChatModelResponse)
def update_chat_model(
    model_id: int,
    model_data: ChatModelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update details of a registered model.
    Enforces ownership permissions.
    """
    model = db.query(ChatModel).filter(ChatModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Không tìm thấy mô hình LLM")
        
    # Permission verification
    is_superadmin = current_user.user_type == "superadmin" or (current_user.role and current_user.role.level == 0 and current_user.tenant_id is None)
    
    if is_superadmin:
        if not model.is_global:
            raise HTTPException(status_code=403, detail="Superadmin chỉ được chỉnh sửa mô hình hệ thống dùng chung (global)")
    else:
        if model.tenant_id is not None and model.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật mô hình của doanh nghiệp khác")
        if model.user_id is not None and model.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật mô hình của người dùng khác")
        if model.is_global:
            raise HTTPException(status_code=403, detail="Chỉ Superadmin mới được chỉnh sửa mô hình hệ thống dùng chung")
            
    # Apply updates
    if model_data.name is not None:
        model.name = model_data.name
    if model_data.provider is not None:
        model.provider = model_data.provider
    if model_data.api_base_url is not None:
        model.api_base_url = model_data.api_base_url
    if model_data.api_model is not None:
        model.api_model = model_data.api_model
    if model_data.is_active is not None:
        model.is_active = model_data.is_active
        
    if model_data.api_key is not None:
        if model_data.api_key.strip() == "":
            model.api_key = None
        else:
            encryption = APIKeyEncryption()
            model.api_key = encryption.encrypt(model_data.api_key)
            
    model.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(model)
    
    response_data = ChatModelResponse.from_orm(model)
    response_data.has_api_key = bool(model.api_key)
    return response_data


@router.delete("/{model_id}", response_model=SuccessResponse)
def delete_chat_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a registered model from the database.
    """
    model = db.query(ChatModel).filter(ChatModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Không tìm thấy mô hình LLM")
        
    is_superadmin = current_user.user_type == "superadmin" or (current_user.role and current_user.role.level == 0 and current_user.tenant_id is None)
    
    if is_superadmin:
        if not model.is_global:
            raise HTTPException(status_code=403, detail="Superadmin chỉ được xóa mô hình hệ thống dùng chung (global)")
    else:
        if model.tenant_id is not None and model.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Không có quyền xóa mô hình của doanh nghiệp khác")
        if model.user_id is not None and model.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Không có quyền xóa mô hình của người dùng khác")
        if model.is_global:
            raise HTTPException(status_code=403, detail="Chỉ Superadmin mới được xóa mô hình hệ thống dùng chung")
            
    db.delete(model)
    db.commit()
    
    return {"success": True, "message": "Đã xóa mô hình thành công"}


@router.post("/{model_id}/test")
def test_chat_model_connection(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Health check connection test for a registered model.
    If successful, activates the model (is_active = True).
    """
    model = db.query(ChatModel).filter(ChatModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Không tìm thấy mô hình LLM")
        
    # Permission verification
    is_superadmin = current_user.user_type == "superadmin" or (current_user.role and current_user.role.level == 0 and current_user.tenant_id is None)
    if is_superadmin:
        if not model.is_global:
            raise HTTPException(status_code=403, detail="Superadmin chỉ được kiểm tra kết nối mô hình hệ thống dùng chung (global)")
    else:
        if model.tenant_id is not None and model.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=403, detail="Không có quyền truy cập mô hình của doanh nghiệp khác")
        if model.user_id is not None and model.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Không có quyền truy cập mô hình của người dùng khác")
            
    # Prepare temporary provider config
    # API key encryption is stored, we need to pass the raw key (decrypted) to ProviderFactory
    raw_api_key = None
    if model.api_key:
        try:
            encryption = APIKeyEncryption()
            raw_api_key = encryption.decrypt(model.api_key)
        except:
            raw_api_key = model.api_key
            
    config = {
        "provider": model.provider,
        "api_base_url": model.api_base_url,
        "api_key": raw_api_key,
        "api_model": model.api_model,
        "timeout": 120  # Increased timeout for large model cold start (e.g. Ollama loading weight to RAM)
    }
    
    # Test connection
    result = ProviderFactory.test_provider_config(config)
    
    if result.get("success", False):
        model.is_active = True
        model.updated_at = datetime.utcnow()
        db.commit()
        return {
            "success": True,
            "message": "Kết nối thành công. Mô hình đã được kích hoạt hoạt động.",
            "latency_ms": result.get("latency_ms")
        }
    else:
        # Keep inactive or deactivate if failed
        model.is_active = False
        db.commit()
        return {
            "success": False,
            "message": f"Kết nối thất bại: {result.get('message', 'Không rõ nguyên nhân')}"
        }
