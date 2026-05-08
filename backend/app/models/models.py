from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    level = Column(Integer, default=2)  # 0=Admin, 1=Truong phong, 2=Nhan vien
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="role")
    documents = relationship("Document", back_populates="role")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=True)
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    role = relationship("Role", back_populates="users")
    documents = relationship("Document", back_populates="uploaded_by_user")
    conversations = relationship("Conversation", back_populates="user")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)  # Stored filename
    original_name = Column(String(255), nullable=False)  # Original filename
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # in bytes
    file_type = Column(String(50), nullable=True)  # pdf, docx, txt
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)  # NULL = public
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    chunk_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    role = relationship("Role", back_populates="documents")
    uploaded_by_user = relationship("User", back_populates="documents")


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="Cuộc trò chuyện mới")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)  # 1 for Like, -1 for Dislike, None for no rating
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")


class FAQ(Base):
    __tablename__ = "faqs"
    
    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    hits = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# AI Configuration Models (Multi-Provider Support)
# ============================================

class AISafetyConfig(Base):
    """Global safety limits for all AI types (1 row)"""
    __tablename__ = "ai_safety_config"
    
    id = Column(Integer, primary_key=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"))
    
    # Global limits for all AI types
    max_temperature_limit = Column(Float, default=1.0)
    max_context_length = Column(Integer, default=8192)
    max_tokens_limit = Column(Integer, default=2048)
    
    # Default user settings
    default_temperature = Column(Float, default=0.2)
    default_response_style = Column(String(20), default="concise")
    
    # Relationship
    updater = relationship("User")


class AIProviderConfig(Base):
    """Configuration for each AI type: chat, embedding, faq"""
    __tablename__ = "ai_provider_config"
    
    id = Column(Integer, primary_key=True)
    ai_type = Column(String(20), unique=True, nullable=False)  # 'chat', 'embedding', 'faq'
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"))
    
    # Provider type
    provider = Column(String(20), default="local")  # local/openrouter/ollama/openai
    
    # Local GGUF settings
    local_model_path = Column(String(500))
    local_context_length = Column(Integer, default=4096)
    
    # API settings
    api_base_url = Column(String(500))
    api_key = Column(String(500))  # encrypted
    api_model = Column(String(100))
    use_custom_model = Column(Boolean, default=False)
    custom_api_model = Column(String(100))
    
    # Type-specific settings
    embedding_model_name = Column(String(100))  # only for embedding type
    use_rag_provider = Column(Boolean, default=True)  # only for faq type
    
    # Default params for this type
    default_temperature = Column(Float, default=0.2)
    default_max_tokens = Column(Integer, default=512)
    timeout = Column(Integer, default=30)  # Timeout in seconds for API providers
    
    # Relationship
    updater = relationship("User")


class UserAISettings(Base):
    """User-specific AI preferences"""
    __tablename__ = "user_ai_settings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # User preferences (bounded by system limits)
    temperature = Column(Float, default=0.2)
    response_style = Column(String(20), default="concise")  # concise/normal/detailed
    show_sources = Column(Boolean, default=True)
    preferred_max_tokens = Column(Integer, default=512)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = relationship("User")
