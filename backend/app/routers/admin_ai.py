"""
Admin AI Configuration Router
Multi-provider support: Local GGUF, OpenRouter, Ollama, OpenAI
"""

import os
import traceback
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.models import User, AISafetyConfig, AIProviderConfig
from app.schemas.schemas import (
    AISafetyConfigSchema, AIProviderConfigSchema, AIProviderConfigResponse,
    TestConnectionRequest, TestConnectionResponse
)
from app.routers.auth import get_current_admin
from app.services.llm_providers import ProviderFactory, APIKeyEncryption, ProviderRegistry

router = APIRouter(prefix="/api/admin/ai-config", tags=["Admin AI Config"])


# ============================================
# AI Safety Config (Global Limits)
# ============================================

@router.get("/safety", response_model=AISafetyConfigSchema)
def get_safety_config(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get global AI safety limits"""
    config = db.query(AISafetyConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Safety config not found")
    
    return AISafetyConfigSchema(
        max_temperature_limit=config.max_temperature_limit,
        max_context_length=config.max_context_length,
        max_tokens_limit=config.max_tokens_limit,
        default_temperature=config.default_temperature,
        default_response_style=config.default_response_style
    )


@router.put("/safety", response_model=AISafetyConfigSchema)
def update_safety_config(
    config_data: AISafetyConfigSchema,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update global AI safety limits"""
    config = db.query(AISafetyConfig).first()
    if not config:
        config = AISafetyConfig(id=1)
        db.add(config)
    
    config.max_temperature_limit = config_data.max_temperature_limit
    config.max_context_length = config_data.max_context_length
    config.max_tokens_limit = config_data.max_tokens_limit
    config.default_temperature = config_data.default_temperature
    config.default_response_style = config_data.default_response_style
    config.updated_at = datetime.utcnow()
    config.updated_by = current_admin.id
    
    db.commit()
    
    return config_data


# ============================================
# AI Provider Config (Per Type: rag, embedding, faq)
# ============================================

@router.get("", response_model=List[AIProviderConfigResponse])
def get_all_provider_configs(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all AI provider configurations"""
    configs = db.query(AIProviderConfig).all()
    return configs


@router.get("/{ai_type}", response_model=AIProviderConfigResponse)
def get_provider_config(
    ai_type: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get specific AI provider configuration"""
    if ai_type not in ["chat", "embedding", "faq"]:
        raise HTTPException(status_code=400, detail="Invalid AI type. Must be: chat, embedding, faq")
    
    config = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    if not config:
        raise HTTPException(status_code=404, detail=f"Config for {ai_type} not found")
    
    return config


@router.put("/{ai_type}", response_model=AIProviderConfigResponse)
def update_provider_config(
    ai_type: str,
    config_data: AIProviderConfigSchema,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Update AI provider configuration"""
    if ai_type not in ["chat", "embedding", "faq"]:
        raise HTTPException(status_code=400, detail="Invalid AI type")
    
    # Validate config
    if config_data.provider == "local":
        if not config_data.local_model_path:
            raise HTTPException(status_code=400, detail="local_model_path required for local provider")
    else:
        # Check api_base_url and model (either preset api_model or custom_api_model)
        model_selected = config_data.api_model if not config_data.use_custom_model else config_data.custom_api_model
        if not config_data.api_base_url or not model_selected:
            raise HTTPException(status_code=400, detail="api_base_url and api_model (or custom_api_model) required for API provider")
    
    # Get or create config
    config = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    if not config:
        config = AIProviderConfig(ai_type=ai_type)
        db.add(config)
    
    # Encrypt API key if provided
    api_key = config_data.api_key
    if api_key and not api_key.startswith("sk-") and len(api_key) > 50:
        # Assume already encrypted
        pass
    elif api_key:
        # Encrypt new key
        try:
            encryption = APIKeyEncryption()
            api_key = encryption.encrypt(api_key)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to encrypt API key: {str(e)}")
    
    # Update fields
    config.provider = config_data.provider
    config.local_model_path = config_data.local_model_path
    config.local_context_length = config_data.local_context_length
    config.api_base_url = config_data.api_base_url
    if api_key:  # Only update if provided
        config.api_key = api_key
    config.api_model = config_data.api_model
    config.use_custom_model = config_data.use_custom_model
    config.custom_api_model = config_data.custom_api_model
    config.embedding_model_name = config_data.embedding_model_name
    config.use_rag_provider = config_data.use_rag_provider
    config.default_temperature = config_data.default_temperature
    config.default_max_tokens = config_data.default_max_tokens
    config.updated_at = datetime.utcnow()
    config.updated_by = current_admin.id
    
    db.commit()
    db.refresh(config)
    
    # Clear provider cache to force reload
    ProviderRegistry.clear_provider(ai_type)
    
    return config


# ============================================
# Test Connection
# ============================================

@router.get("/{ai_type}/test-connection", response_model=TestConnectionResponse)
def test_connection_auto_load(
    ai_type: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Test AI provider connection using database config (no body needed)"""
    print(f"\n[DEBUG] ========== TEST CONNECTION START ==========")
    print(f"[DEBUG] AI Type: {ai_type}")
    print(f"[DEBUG] Current working directory: {os.getcwd()}")
    
    if ai_type not in ["chat", "embedding", "faq"]:
        raise HTTPException(status_code=400, detail="Invalid AI type")
    
    # Load config from database (same as chat logic)
    config_row = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    if not config_row:
        return TestConnectionResponse(
            success=False,
            message=f"No configuration found for {ai_type}"
        )
    
    # Build config dict (same as get_llm_provider in llm_providers.py)
    config = {
        "provider": config_row.provider,
        "local_model_path": config_row.local_model_path,
        "local_context_length": config_row.local_context_length,
        "api_base_url": config_row.api_base_url,
        "api_key": config_row.api_key,  # Will be decrypted by ProviderFactory
        "api_model": config_row.custom_api_model if config_row.use_custom_model else config_row.api_model,
        "timeout": getattr(config_row, 'timeout', 30),
    }
    
    print(f"[DEBUG] Config loaded from database: {config}")
    print(f"[DEBUG] test_config.api_model: '{config.get('api_model')}'")
    print(f"[DEBUG] test_config.api_model type: {type(config.get('api_model'))}")
    
    # Validation for API providers
    if config["provider"] in ["openrouter", "ollama"] and not config.get("api_model"):
        return TestConnectionResponse(
            success=False,
            message="Model name is required for API providers. Please specify a model (e.g., 'poolside/laguna-m.1:free')"
        )
    
    # Check if local model path exists
    if config.get("local_model_path"):
        model_path = config["local_model_path"]
        abs_path = os.path.abspath(model_path)
        print(f"[DEBUG] Model path (relative): {model_path}")
        print(f"[DEBUG] Model path (absolute): {abs_path}")
        print(f"[DEBUG] File exists: {os.path.exists(model_path)}")
        print(f"[DEBUG] File exists (abs): {os.path.exists(abs_path)}")
    
    # Test connection
    try:
        if ai_type == "embedding":
            print(f"[DEBUG] Creating embedding provider...")
            # For embedding AI type, use embedding provider
            provider = ProviderFactory.create_embedding_provider(config)
            print(f"[DEBUG] Embedding provider created: {type(provider).__name__}")
            result = provider.test_connection()
        else:
            print(f"[DEBUG] Creating LLM provider...")
            # For other AI types, use regular LLM provider
            result = ProviderFactory.test_provider_config(config)
        print(f"[DEBUG] Test result: {result}")
    except Exception as e:
        print(f"[DEBUG] Exception during test: {str(e)}")
        print(f"[DEBUG] Exception type: {type(e)}")
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        result = {
            "success": False,
            "message": f"Exception: {str(e)}",
            "latency_ms": 0
        }
    
    print(f"[DEBUG] ========== TEST CONNECTION END ==========\n")
    return TestConnectionResponse(**result)


@router.post("/{ai_type}/test", response_model=TestConnectionResponse)
def test_provider_connection(
    ai_type: str,
    test_config: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Test AI provider connection using provided config (allows testing before saving)"""
    print(f"\n[DEBUG] ========== TEST CONNECTION (POST) START ==========")
    print(f"[DEBUG] AI Type: {ai_type}")
    
    if ai_type not in ["chat", "embedding", "faq"]:
        raise HTTPException(status_code=400, detail="Invalid AI type")
    
    # Load existing config from database as fallback
    config_row = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    
    # Determine which values to use (priority: request body > database)
    provider = test_config.provider
    api_base_url = test_config.api_base_url
    api_key = test_config.api_key
    api_model = test_config.custom_api_model if test_config.use_custom_model else test_config.api_model
    local_model_path = test_config.local_model_path
    timeout = test_config.timeout or (config_row.timeout if config_row else 30)

    # If api_key is missing in request, use the one from database (and decrypt it)
    if not api_key and config_row and config_row.api_key:
        api_key = config_row.api_key
        # Note: ProviderFactory will handle decryption if it doesn't start with sk-
    
    # Build final config for factory
    config = {
        "provider": provider,
        "local_model_path": local_model_path or (config_row.local_model_path if config_row else None),
        "local_context_length": config_row.local_context_length if config_row else 4096,
        "api_base_url": api_base_url or (config_row.api_base_url if config_row else None),
        "api_key": api_key,
        "api_model": api_model or (config_row.api_model if config_row else None),
        "timeout": timeout,
    }
    
    print(f"[DEBUG] Test Config: provider={provider}, model={config['api_model']}, url={api_base_url}")
    
    # Validation for API providers
    if provider in ["openrouter", "ollama"] and not config.get("api_model"):
        return TestConnectionResponse(
            success=False,
            message="Model name is required for API providers."
        )
    
    # Test connection
    try:
        if ai_type == "embedding":
            provider_inst = ProviderFactory.create_embedding_provider(config)
            result = provider_inst.test_connection()
        else:
            result = ProviderFactory.test_provider_config(config)
    except Exception as e:
        print(f"[DEBUG] Exception during test: {str(e)}")
        result = {
            "success": False,
            "message": f"Exception: {str(e)}",
            "latency_ms": 0
        }
    
    print(f"[DEBUG] ========== TEST CONNECTION (POST) END ==========\n")
    return TestConnectionResponse(**result)



# ============================================
# Available Models (for API providers)
# ============================================

@router.get("/models/{provider}")
def get_available_models(
    provider: str,
    model_type: Optional[str] = None,
    current_admin: User = Depends(get_current_admin)
):
    """Get available models for API provider, optionally filtered by type"""
    all_models = {
        "openrouter": [
            {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and affordable", "type": "chat"},
            {"id": "openai/gpt-4o", "name": "GPT-4o", "description": "Most capable", "type": "chat"},
            {"id": "anthropic/claude-3-haiku", "name": "Claude 3 Haiku", "description": "Fast and efficient", "type": "chat"},
            {"id": "anthropic/claude-3-sonnet", "name": "Claude 3 Sonnet", "description": "Balanced", "type": "chat"},
            {"id": "google/gemini-flash-1.5", "name": "Gemini Flash 1.5", "description": "Fast multimodal", "type": "chat"},
            {"id": "meta-llama/llama-3-8b-instruct", "name": "Llama 3 8B", "description": "Open source", "type": "chat"},
            {"id": "openai/text-embedding-3-small", "name": "Text Embedding 3 Small", "description": "OpenAI embedding model", "type": "embedding"},
            {"id": "openai/text-embedding-3-large", "name": "Text Embedding 3 Large", "description": "High quality embeddings", "type": "embedding"},
            {"id": "cohere/embed-v3.3", "name": "Cohere Embed v3.3", "description": "Cohere embedding model", "type": "embedding"},
            {"id": "nvidia/llama-nemotron-embed-vl-1b-v2:free", "name": "Nemotron Embed VL", "description": "NVIDIA embedding model", "type": "embedding"},
        ],
        "openai": [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and affordable", "type": "chat"},
            {"id": "gpt-4o", "name": "GPT-4o", "description": "Most capable", "type": "chat"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "description": "Legacy", "type": "chat"},
            {"id": "text-embedding-3-small", "name": "Text Embedding 3 Small", "description": "OpenAI embedding model", "type": "embedding"},
            {"id": "text-embedding-3-large", "name": "Text Embedding 3 Large", "description": "High quality embeddings", "type": "embedding"},
            {"id": "text-embedding-ada-002", "name": "Text Embedding Ada 002", "description": "Legacy embedding model", "type": "embedding"},
        ],
        "ollama": [
            {"id": "llama3.2:3b", "name": "Llama 3.2 3B", "description": "Lightweight", "type": "chat"},
            {"id": "qwen2.5:3b", "name": "Qwen 2.5 3B", "description": "Good for Vietnamese", "type": "chat"},
            {"id": "mistral:7b", "name": "Mistral 7B", "description": "Powerful", "type": "chat"},
            {"id": "gemma2:2b", "name": "Gemma 2 2B", "description": "Google lightweight", "type": "chat"},
        ],
        "local": [
            {"id": "qwen2.5-3b-instruct-q4_k_m.gguf", "name": "Qwen 2.5 3B Q4", "description": "Recommended for 8GB RAM", "type": "chat"},
            {"id": "llama-3.2-3b-instruct-q4_k_m.gguf", "name": "Llama 3.2 3B Q4", "description": "Meta model", "type": "chat"},
            {"id": "mistral-7b-instruct-v0.2.Q4_K_M.gguf", "name": "Mistral 7B Q4", "description": "More powerful, needs 16GB RAM", "type": "chat"},
        ]
    }
    
    models = all_models.get(provider, [])
    
    # Filter by model type if specified
    if model_type:
        models = [m for m in models if m.get("type") == model_type]
    
    return {"provider": provider, "models": models}
