from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # JWT
    jwt_secret_key: str = "your-secret-key"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # Database
    database_url: str = "sqlite:///./data/wikibot.db"
    
    # Offline & Local Deployment Configuration
    offline_mode: bool = False
    local_db_type: str = "sqlite"  # 'sqlite' or 'postgresql'
    
    # Security
    encryption_key: str = ""  # For API key encryption, generate with: Fernet.generate_key()
    
    # ChromaDB
    chroma_db_path: str = "./chroma_db"
    chroma_type: str = "persistent"  # 'persistent' or 'http'
    chroma_host: str = "localhost"
    chroma_port: int = 8000
    
    # LLM Model
    model_path: str = "./llm_models/model.gguf"
    model_context_length: int = 8192
    model_temperature: float = 0.2
    model_max_tokens: int = 1024
    rag_max_distance: float = 0.75
    rag_default_style: str = "concise"
    
    # Embedding
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dimension: int = 4096
    
    # File Storage
    data_dir: str = "./data"
    max_file_size: int = 50  # MB
    
    # Redis for Cache
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    
    # Logging
    log_level: str = "INFO"
    rag_log_level: str = "INFO"
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "protected_namespaces": ('settings_',)
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
