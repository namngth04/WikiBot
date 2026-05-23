from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ============== Role Schemas ==============
class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    level: int = Field(default=2, ge=0, le=10)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    level: Optional[int] = Field(None, ge=0, le=10)


class RoleResponse(RoleBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== User Schemas ==============
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    subscription_tier: Optional[str] = Field(default="free", max_length=50)
    tenant_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    role_id: Optional[int] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None
    subscription_tier: Optional[str] = Field(None, max_length=50)
    tenant_id: Optional[int] = None


class UserResponse(UserBase):
    id: int
    role_id: Optional[int]
    is_active: bool
    created_at: datetime
    role: Optional[RoleResponse] = None
    
    class Config:
        from_attributes = True


class UserInToken(BaseModel):
    id: int
    username: str
    role_id: Optional[int] = None


# ============== Document Schemas ==============
class DocumentBase(BaseModel):
    original_name: str
    file_type: Optional[str] = None
    role_id: Optional[int] = None  # NULL = public
    privacy_mode: Optional[bool] = False
    is_public_community: Optional[bool] = False
    tenant_id: Optional[int] = None


class DocumentCreate(DocumentBase):
    filename: str
    file_path: str
    file_size: int
    uploaded_by: int


class DocumentUpdate(BaseModel):
    role_id: Optional[int] = None
    original_name: Optional[str] = None
    privacy_mode: Optional[bool] = None
    is_public_community: Optional[bool] = None
    tenant_id: Optional[int] = None


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    file_path: str
    file_size: int
    file_type: Optional[str]
    role_id: Optional[int]
    uploaded_by: int
    uploaded_at: datetime
    chunk_count: int
    is_active: bool
    privacy_mode: bool
    is_public_community: bool
    tenant_id: Optional[int]
    role: Optional[RoleResponse] = None
    uploaded_by_user: Optional[UserResponse] = None
    
    class Config:
        from_attributes = True


# ============== Message Schemas ==============
class MessageBase(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    rating: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class MessageRatingUpdate(BaseModel):
    rating: int = Field(..., ge=-1, le=1)


# ============== Conversation Schemas ==============
class ConversationBase(BaseModel):
    title: Optional[str] = "Cuộc trò chuyện mới"


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ConversationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []


# ============== Auth Schemas ==============
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============== Chat Schemas ==============
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[int] = None
    response_style: Literal["concise", "normal", "detailed", "creative"] = "concise"
    max_tokens: Optional[int] = Field(None, ge=64, le=512)
    show_sources: bool = True


class ChatResponse(BaseModel):
    response: str
    answer: str
    conversation_id: int
    sources: List[dict] = []
    citations: List[dict] = []
    user_message_id: Optional[int] = None
    assistant_message_id: Optional[int] = None


# ============== Generic ==============
class SuccessResponse(BaseModel):
    success: bool
    message: str


# ============== FAQ Schemas ==============
class FAQBase(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class FAQCreate(FAQBase):
    pass


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class FAQResponse(FAQBase):
    id: int
    hits: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Admin Dashboard Schemas ==============
class DashboardStats(BaseModel):
    total_users: int
    total_messages: int
    total_documents: int
    satisfaction_rate: float
    rating_details: dict
    feedback_ratio: dict
    # Trend fields (so với ngày hôm qua)
    user_trend: Optional[float] = None  # % tăng trưởng người dùng
    message_trend: Optional[float] = None  # % tăng trưởng tin nhắn
    document_trend: Optional[float] = None  # % tăng trưởng tài liệu
    rating_trend: Optional[float] = None  # % thay đổi tỷ lệ hài lòng


class UsageStats(BaseModel):
    date: str
    count: int


class SuggestedFAQ(BaseModel):
    question: str
    occurrence: int
    suggested_answer: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


# ============================================
# AI Configuration Schemas (Multi-Provider)
# ============================================

class AISafetyConfigSchema(BaseModel):
    """Global safety limits schema"""
    max_temperature_limit: float = Field(default=1.0, ge=0.1, le=2.0)
    max_context_length: int = Field(default=8192, ge=1024, le=32768)
    max_tokens_limit: int = Field(default=2048, ge=128, le=4096)
    default_temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    default_response_style: str = Field(default="concise", pattern="^(concise|normal|detailed|creative)$")


class AIProviderConfigSchema(BaseModel):
    """Provider config for each AI type"""
    ai_type: str = Field(..., pattern="^(chat|embedding|faq)$")
    provider: str = Field(default="local", pattern="^(local|openrouter|ollama)$")
    
    # Local settings
    local_model_path: Optional[str] = None
    local_context_length: Optional[int] = Field(None, ge=1024, le=32768)
    
    # API settings
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None  # plain text for input, will be encrypted
    api_model: Optional[str] = None
    use_custom_model: bool = False  # If true, use custom_api_model instead of api_model
    custom_api_model: Optional[str] = None  # Custom model ID for flexibility
    
    # Type-specific
    embedding_model_name: Optional[str] = None
    use_rag_provider: bool = True
    
    # Defaults
    default_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    default_max_tokens: int = Field(default=512, ge=64, le=2048)
    timeout: int = Field(default=30, ge=5, le=300)  # Timeout in seconds


class AIProviderConfigResponse(BaseModel):
    """Response schema (api_key masked)"""
    id: int
    ai_type: str
    provider: str
    local_model_path: Optional[str] = None
    local_context_length: Optional[int] = None
    api_base_url: Optional[str] = None
    api_model: Optional[str] = None
    use_custom_model: bool = False
    custom_api_model: Optional[str] = None
    embedding_model_name: Optional[str] = None
    use_rag_provider: bool = True
    default_temperature: float = 0.2
    default_max_tokens: int = 512
    timeout: int = 30
    updated_at: Optional[datetime] = None
    has_api_key: bool = False
    
    class Config:
        from_attributes = True


class UserAISettingsSchema(BaseModel):
    """User AI preferences"""
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    response_style: str = Field(default="concise", pattern="^(concise|normal|detailed|creative)$")
    show_sources: bool = True
    preferred_max_tokens: int = Field(default=512, ge=64, le=2048)
    receive_community_knowledge: bool = False
    ollama_endpoint: str = Field(default="http://localhost:11434", max_length=255)


class UserAISettingsResponse(BaseModel):
    """User settings response"""
    id: int
    user_id: int
    temperature: float
    response_style: str
    show_sources: bool
    preferred_max_tokens: int
    receive_community_knowledge: bool
    ollama_endpoint: str
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TenantAISettingsSchema(BaseModel):
    """Tenant AI preferences configured by Company Admin"""
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    response_style: str = Field(default="concise", pattern="^(concise|normal|detailed|creative)$")
    show_sources: bool = True
    preferred_max_tokens: int = Field(default=512, ge=64, le=2048)
    ollama_endpoint: str = Field(default="http://localhost:11434", max_length=255)


class TenantAISettingsResponse(BaseModel):
    """Tenant AI settings response"""
    id: int
    tenant_id: int
    temperature: float
    response_style: str
    show_sources: bool
    preferred_max_tokens: int
    ollama_endpoint: str
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None
    
    class Config:
        from_attributes = True



class TestConnectionRequest(BaseModel):
    """Test connection request"""
    provider: str = Field(..., pattern="^(local|openrouter|ollama)$")
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    api_model: Optional[str] = None
    local_model_path: Optional[str] = None
    use_custom_model: bool = False
    custom_api_model: Optional[str] = None
    timeout: Optional[int] = Field(default=30, ge=5, le=300)  # Timeout in seconds for API providers


class TestConnectionResponse(BaseModel):
    """Test connection response"""
    success: bool
    message: str
    latency_ms: Optional[float] = None


# ============== UpgradeRequest Schemas ==============
class UpgradeRequestBase(BaseModel):
    user_id: int
    status: str = "pending"


class UpgradeRequestCreate(BaseModel):
    pass


class UpgradeRequestUpdate(BaseModel):
    status: Literal["pending", "approved", "rejected"]


class UpgradeRequestResponse(UpgradeRequestBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
