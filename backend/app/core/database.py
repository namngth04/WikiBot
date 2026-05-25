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

# Auto migrate schema for SaaS company features if columns don't exist
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE tenant_ai_settings ADD COLUMN company_name VARCHAR(255)"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE tenant_ai_settings ADD COLUMN invite_code VARCHAR(100)"))
        conn.commit()
except Exception:
    pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Define database naming conventions for SQLAlchemy constraints to support SQLite batch mode migrations
from sqlalchemy import MetaData

naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=naming_convention)
Base = declarative_base(metadata=metadata)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
