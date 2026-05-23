from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import get_settings

settings = get_settings()

# Xác định URL kết nối CSDL động dựa trên Offline Mode và loại DB local
db_url = settings.database_url
if settings.offline_mode:
    if settings.local_db_type == "sqlite":
        db_url = "sqlite:///./data/wikibot.db"
    elif settings.local_db_type == "postgresql" and "sqlite" in db_url:
        db_url = "postgresql://postgres:postgres@localhost:5432/wikibot"

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
