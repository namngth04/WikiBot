import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import engine, Base
from app.routers import auth, users, roles, documents, chat, admin, admin_ai, user_ai, upgrade

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Bộ lọc giảm tải log thừa: Ẩn log truy cập của endpoint /health khi hoạt động bình thường (status 200)
class HealthCheckFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Nếu không phải log liên quan đến /health thì cho qua bình thường
        if "/health" not in record.getMessage():
            return True
            
        # Nếu là log /health, kiểm tra status code
        # Định dạng record.args của uvicorn.access thường là: (host, port, method, path, http_version, status_code)
        if record.args and len(record.args) >= 5:
            status_code = record.args[4]
            if status_code == 200:
                return False  # Status 200 (OK) -> Ẩn log này đi ("ăn log")
        else:
            # Phòng trường hợp cấu trúc args thay đổi, kiểm tra qua chuỗi message
            if " 200 " in record.getMessage() or record.getMessage().endswith(" 200"):
                return False  # Status 200 -> Ẩn log
                
        return True  # Các trường hợp lỗi (500, 400...) hoặc bất thường -> Giữ lại log để hiển thị

# Áp dụng bộ lọc cho uvicorn logger
logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting up WikiBot API...")
    
    # Create data directory
    settings = get_settings()
    os.makedirs(settings.data_dir, exist_ok=True)
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    
    yield
    
    # Shutdown
    logger.info("Shutting down WikiBot API...")


# Create FastAPI app
app = FastAPI(
    title="WikiBot API",
    description="AI-based chatbot with Role-Based Access Control",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(admin_ai.router)  # AI Configuration (Admin)
app.include_router(user_ai.router)   # AI Settings (User)
app.include_router(upgrade.router)   # Upgrade & Quota System [NEW]


@app.get("/")
def root():
    return {
        "message": "WikiBot API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    health_status = {"status": "healthy", "postgres": "up"}
    
    # 1. Kiểm tra kết nối Postgres
    try:
        from sqlalchemy import text
        from app.core.database import SessionLocal
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        logger.error(f"Database healthcheck failed: {e}")
        health_status["postgres"] = "down"
        health_status["status"] = "unhealthy"

    if health_status["status"] == "unhealthy":
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content=health_status)
        
    return health_status


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
