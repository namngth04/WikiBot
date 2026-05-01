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
    
    # ChromaDB
    chroma_db_path: str = "./chroma_db"
    
    # LLM Model
    model_path: str = "./llm_models/model.gguf"
    model_context_length: int = 8192
    model_temperature: float = 0.2
    model_max_tokens: int = 1024
    rag_max_distance: float = 0.55
    rag_default_style: str = "concise"
    
    # Embedding
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    
    # File Storage
    data_dir: str = "./data"
    max_file_size: int = 50  # MB
    
    # Logging
    log_level: str = "INFO"
    rag_log_level: str = "INFO"
    rag_log_file: str = "rag_debug.log"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        protected_namespaces = ('settings_',)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
