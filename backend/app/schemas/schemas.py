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
    department: Optional[str] = Field(None, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role_id: Optional[int] = None


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    role_id: Optional[int] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None


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


class DocumentCreate(DocumentBase):
    filename: str
    file_path: str
    file_size: int
    uploaded_by: int


class DocumentUpdate(BaseModel):
    role_id: Optional[int] = None
    original_name: Optional[str] = None


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
    response_style: Literal["concise", "normal", "detailed"] = "concise"
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


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
