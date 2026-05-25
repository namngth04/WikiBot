"""
Initialize default data for WikiBot
Run this script after starting the backend for the first time
"""

import os
import sys
import shutil
import subprocess
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.models import Base, Role, User, AISafetyConfig, AIProviderConfig
from sqlalchemy import inspect


# Constants
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_SLEEP_TIME = 0.5
DEFAULT_TIMEOUT = 30


def run_alembic_migration():
    """Run alembic database migration"""
    print("Running alembic migration...")
    
    try:
        # Ensure data directory exists
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        if not os.path.exists(data_dir):
            print(f"Creating data directory: {data_dir}")
            os.makedirs(data_dir, exist_ok=True)
        
        # Close all database connections before migration
        engine.dispose()
        
        # Run alembic upgrade head
        print("Executing: alembic upgrade head")
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT
        )
        
        if result.returncode == 0:
            print("✅ Alembic migration completed successfully")
            if result.stdout:
                print(f"Alembic output: {result.stdout}")
            
            # Verify that tables were created
            print("Verifying database tables...")
            time.sleep(DEFAULT_SLEEP_TIME)  # Give database a moment to settle
            
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print(f"Tables found after migration: {tables}")
            
            if not tables or "roles" not in tables:
                print("⚠️  Tables not found after alembic, trying fallback...")
                Base.metadata.create_all(bind=engine)
                print("✅ Created tables using fallback method")
            else:
                print("✅ All required tables are present")
        else:
            print(f"⚠️  Alembic migration failed with return code: {result.returncode}")
            if result.stderr:
                print(f"Error output: {result.stderr}")
            print("Falling back to Base.metadata.create_all()")
            Base.metadata.create_all(bind=engine)
            
    except subprocess.TimeoutExpired:
        print(f"⚠️  Alembic migration timed out after {DEFAULT_TIMEOUT} seconds")
        print("Falling back to Base.metadata.create_all()")
        Base.metadata.create_all(bind=engine)
        
    except Exception as e:
        print(f"⚠️  Could not run alembic migration: {e}")
        print("Falling back to Base.metadata.create_all()")
        try:
            # Ensure data directory exists before creating tables
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
            if not os.path.exists(data_dir):
                print(f"Creating data directory: {data_dir}")
                os.makedirs(data_dir, exist_ok=True)
            Base.metadata.create_all(bind=engine)
            print("✅ Created tables using fallback method")
        except Exception as e2:
            print(f"⚠️  Error creating tables: {e2}")
            print("Please check database permissions and directory structure")
            raise


def clear_database_data():
    """Clear all database data in correct order"""
    print("Clearing database data...")
    
    db = SessionLocal()
    try:
        # Check which tables exist
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        print(f"Found tables: {existing_tables}")
        
        # Delete in correct order to avoid foreign key constraints
        table_order = [
            ("ai_provider_config", AIProviderConfig),
            ("ai_safety_config", AISafetyConfig),
            ("user_ai_settings", "UserAISettings"),
            ("messages", "Message"),
            ("conversations", "Conversation"),
            ("documents", "Document"),
            ("users", User),
            ("roles", Role),
            ("faqs", "FAQ")
        ]
        
        for table_name, model in table_order:
            if table_name in existing_tables:
                if isinstance(model, str):
                    # Import model dynamically
                    from app.models.models import UserAISettings, Message, Conversation, Document, FAQ
                    model_map = {
                        "UserAISettings": UserAISettings,
                        "Message": Message,
                        "Conversation": Conversation,
                        "Document": Document,
                        "FAQ": FAQ
                    }
                    model = model_map.get(model, FAQ)
                
                db.query(model).delete()
        
        db.commit()
        print("✅ Cleared all database data")
    except Exception as e:
        db.rollback()
        print(f"⚠️  Error clearing database data: {e}")
        print("Trying alternative approach: dropping all tables...")
        try:
            Base.metadata.drop_all(bind=engine)
            print("✅ Dropped all tables successfully")
        except Exception as e2:
            print(f"⚠️  Error dropping tables: {e2}")
    finally:
        db.close()


def clear_database_file():
    """Remove old database file if exists"""
    print("Clearing database file...")
    
    old_db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    try:
        if os.path.exists(old_db_file):
            print(f"Removing old database file: {old_db_file}")
            os.unlink(old_db_file)
            print("✅ Removed old database file")
        else:
            print("Database file does not exist, skipping")
    except Exception as e:
        print(f"⚠️  Could not remove old database file: {e}")


def clear_chroma_db():
    """Clear ChromaDB vector database"""
    print("Clearing ChromaDB...")
    
    chroma_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")
    try:
        if os.path.exists(chroma_db_path):
            print(f"Removing ChromaDB directory: {chroma_db_path}")
            shutil.rmtree(chroma_db_path)
            print("✅ Cleared ChromaDB vector database")
        else:
            print("ChromaDB directory does not exist, skipping")
    except Exception as e:
        print(f"⚠️  Error removing ChromaDB directory: {e}")
        print("   You may need to manually remove the chroma_db directory")


def clear_python_cache():
    """Clear Python cache directories"""
    print("Clearing Python cache...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        for root, dirs, files in os.walk(backend_dir):
            if "__pycache__" in dirs:
                pycache_path = os.path.join(root, "__pycache__")
                print(f"Removing cache directory: {pycache_path}")
                shutil.rmtree(pycache_path)
                print("✅ Cleared Python cache directory")
    except Exception as e:
        print(f"⚠️  Error removing cache directories: {e}")


def clear_data_directory():
    """Clear data directory with uploaded files"""
    print("Clearing data directory...")
    
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    try:
        if os.path.exists(data_dir):
            print(f"Removing data directory: {data_dir}")
            print("⚠️  Make sure all applications using the database are closed!")
            
            # Try to remove files one by one first
            for root, dirs, files in os.walk(data_dir, topdown=False):
                for name in files:
                    file_path = os.path.join(root, name)
                    try:
                        os.unlink(file_path)
                    except Exception as e:
                        print(f"⚠️  Could not remove file {file_path}: {e}")
                        print(f"   Please close any applications using this file and try again")
                for name in dirs:
                    dir_path = os.path.join(root, name)
                    try:
                        os.rmdir(dir_path)
                    except Exception as e:
                        print(f"⚠️  Could not remove directory {dir_path}: {e}")
            
            # Finally remove the main directory
            try:
                shutil.rmtree(data_dir)
                print("✅ Cleared all uploaded documents and files")
            except Exception as e:
                print(f"⚠️  Error removing data directory: {e}")
                print("   You may need to manually remove the data directory after closing all applications")
        else:
            print("Data directory does not exist, skipping")
    except Exception as e:
        print(f"⚠️  Error processing data directory: {e}")


def clear_alembic_versions():
    """Xóa toàn bộ alembic version files để chuẩn bị tạo mới"""
    print("Clearing Alembic version files...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    alembic_versions_path = os.path.join(backend_dir, "alembic", "versions")
    
    try:
        if os.path.exists(alembic_versions_path):
            removed_files = []
            for file_name in os.listdir(alembic_versions_path):
                if file_name.endswith(".py") and not file_name.startswith("__"):
                    file_path = os.path.join(alembic_versions_path, file_name)
                    try:
                        os.remove(file_path)
                        removed_files.append(file_name)
                    except Exception as e:
                        print(f"⚠️  Could not remove alembic file {file_path}: {e}")
            
            if removed_files:
                print(f"✅ Removed {len(removed_files)} alembic version files:")
                for file_name in removed_files:
                    print(f"  - {file_name}")
            else:
                print("No alembic version files found to remove")
        else:
            print("Alembic versions directory does not exist, skipping")
    except Exception as e:
        print(f"⚠️  Error clearing alembic versions: {e}")


def create_fresh_migration():
    """Tạo alembic migration mới từ current database schema"""
    print("Creating fresh alembic migration...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    try:
        # Close all database connections before migration
        engine.dispose()
        
        # Delete alembic_version table if exists
        print("Removing alembic_version table...")
        db = SessionLocal()
        try:
            from sqlalchemy import text
            db.execute(text("DROP TABLE IF EXISTS alembic_version"))
            db.commit()
            print("✅ Removed alembic_version table")
        except Exception as e:
            print(f"⚠️  Could not remove alembic_version table: {e}")
            db.rollback()
        finally:
            db.close()
        
        # Create new migration
        print("Generating new migration...")
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "revision", "--autogenerate", "-m", "Initial migration"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT
        )
        
        if result.returncode == 0:
            print("✅ Successfully created new migration")
            if result.stdout:
                print(f"Migration output: {result.stdout}")
            
            # Verify migration file was created
            alembic_versions_path = os.path.join(backend_dir, "alembic", "versions")
            migration_files = [f for f in os.listdir(alembic_versions_path) 
                             if f.endswith(".py") and not f.startswith("__")]
            
            if migration_files:
                print(f"✅ Migration file created: {migration_files[0]}")
                return True
            else:
                print("⚠️  Migration file not found after creation")
                return False
        else:
            print(f"⚠️  Migration creation failed with return code: {result.returncode}")
            if result.stderr:
                print(f"Error output: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⚠️  Migration creation timed out after {DEFAULT_TIMEOUT} seconds")
        return False
    except Exception as e:
        print(f"⚠️  Error creating fresh migration: {e}")
        return False


def apply_fresh_migration():
    """Apply migration vừa tạo"""
    print("Applying fresh migration...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    try:
        # Close all database connections before migration
        engine.dispose()
        
        # Apply migration
        print("Running alembic upgrade head...")
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            timeout=DEFAULT_TIMEOUT
        )
        
        if result.returncode == 0:
            print("✅ Successfully applied fresh migration")
            if result.stdout:
                print(f"Migration output: {result.stdout}")
            
            # Verify tables were created
            print("Verifying database tables after migration...")
            time.sleep(DEFAULT_SLEEP_TIME)
            
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            print(f"Tables found after migration: {tables}")
            
            if tables and "roles" in tables:
                print("✅ All required tables are present after migration")
                return True
            else:
                print("⚠️  Some tables might be missing after migration")
                return False
        else:
            print(f"⚠️  Migration application failed with return code: {result.returncode}")
            if result.stderr:
                print(f"Error output: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⚠️  Migration application timed out after {DEFAULT_TIMEOUT} seconds")
        return False
    except Exception as e:
        print(f"⚠️  Error applying fresh migration: {e}")
        return False


def clear_application_logs():
    """Clear application log files"""
    print("Clearing application logs...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Common log file patterns
    log_patterns = [
        "*.log",
        "*.log.*",
        "app.log",
        "error.log",
        "debug.log"
    ]
    
    cleared_files = []
    for pattern in log_patterns:
        for log_file in Path(backend_dir).glob(pattern):
            try:
                if log_file.is_file():
                    log_file.unlink()
                    cleared_files.append(str(log_file))
                    print(f"  Removed log file: {log_file.name}")
            except Exception as e:
                print(f"  ⚠️  Could not remove log file {log_file}: {e}")
    
    if cleared_files:
        print(f"✅ Cleared {len(cleared_files)} log files")
    else:
        print("No log files found to clear")


def clear_temp_files():
    """Clear temporary files and directories"""
    print("Clearing temporary files...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Common temp directories and files
    temp_patterns = [
        "tmp",
        "temp", 
        "*.tmp",
        "*.temp",
        "*.swp",  # Vim swap files
        "*.swo",  # Vim swap files
        ".DS_Store",  # macOS
        "Thumbs.db"  # Windows thumbs
    ]
    
    cleared_items = []
    for pattern in temp_patterns:
        for temp_item in Path(backend_dir).glob(pattern):
            try:
                if temp_item.is_file():
                    temp_item.unlink()
                    cleared_items.append(f"file: {temp_item.name}")
                elif temp_item.is_dir():
                    shutil.rmtree(temp_item)
                    cleared_items.append(f"dir: {temp_item.name}")
                    print(f"  Removed temp directory: {temp_item.name}")
            except Exception as e:
                print(f"  ⚠️  Could not remove temp item {temp_item}: {e}")
    
    if cleared_items:
        print(f"✅ Cleared {len(cleared_items)} temporary items")
    else:
        print("No temporary files found to clear")


def clear_session_data():
    """Clear session and cache data"""
    print("Clearing session data...")
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Session/cache directories to clear
    session_dirs = [
        ".pytest_cache",
        "__pycache__",
        "*.egg-info"
    ]
    
    cleared_dirs = []
    for pattern in session_dirs:
        for session_dir in Path(backend_dir).rglob(pattern):
            if session_dir.is_dir() and "venv" not in str(session_dir):
                try:
                    shutil.rmtree(session_dir)
                    cleared_dirs.append(str(session_dir))
                    print(f"  Removed session directory: {session_dir.name}")
                except Exception as e:
                    print(f"  ⚠️  Could not remove session dir {session_dir}: {e}")
    
    if cleared_dirs:
        print(f"✅ Cleared {len(cleared_dirs)} session directories")
    else:
        print("No session directories found to clear")


def clear_existing_data():
    """Clear existing data for fresh initialization"""
    print("Clearing existing data...")
    
    # Clear database data first
    clear_database_data()
    
    # Close all database connections before file operations
    engine.dispose()
    
    # Clear files and directories
    clear_database_file()
    clear_chroma_db()
    clear_python_cache()
    clear_data_directory()
    clear_alembic_versions()
    
    # Additional comprehensive cleanup
    clear_application_logs()
    clear_temp_files()
    clear_session_data()


def init_default_data():
    """Create default roles, users (Admin, Trưởng phòng, Nhân viên), AI settings, FAQs and AI configs"""
    
    print("Starting default data initialization...")
    db = SessionLocal()
    
    try:
        # 1. Create default roles
        print("Creating default roles...")
        try:
            existing_roles = db.query(Role).all()
            if existing_roles:
                print(f"Found {len(existing_roles)} existing roles. Skipping role creation.")
            else:
                roles = [
                    Role(id=1, name="Admin", description="Quản trị viên hệ thống", level=0),
                    Role(id=2, name="Trưởng phòng", description="Trưởng các phòng ban", level=1),
                    Role(id=3, name="Nhân viên", description="Nhân viên các phòng ban", level=2),
                ]
                for role in roles:
                    db.add(role)
                db.commit()
                print("Created 3 default roles successfully:")
                print("  - Admin (level 0)")
                print("  - Trưởng phòng (level 1)")
                print("  - Nhân viên (level 2)")
        except Exception as e:
            print(f"⚠️  Error creating roles: {e}")
            db.rollback()
            raise
        
        # 2. Create default users (Admin, Trưởng phòng, Nhân viên A, Nhân viên B)
        print("\nCreating default users...")
        users_to_create = [
            {
                "username": DEFAULT_ADMIN_USERNAME,
                "full_name": "Quản trị viên",
                "email": "admin@wikibot.local",
                "hashed_password": get_password_hash(DEFAULT_ADMIN_PASSWORD),
                "role_id": 1,
                "subscription_tier": "pro",
                "tenant_id": None,
                "is_active": True
            },
            {
                "username": "truongphong",
                "full_name": "Trưởng phòng Nhân sự",
                "email": "truongphong@wikibot.local",
                "hashed_password": get_password_hash("tp123"),
                "role_id": 2,
                "subscription_tier": "pro",
                "tenant_id": 1,
                "is_active": True
            },
            {
                "username": "nhanvien",
                "full_name": "Nhân viên Thử nghiệm A",
                "email": "nhanvien@wikibot.local",
                "hashed_password": get_password_hash("nv123"),
                "role_id": 3,
                "subscription_tier": "free",
                "tenant_id": 1,
                "is_active": True
            },
            {
                "username": "nhanvien_b",
                "full_name": "Nhân viên Thử nghiệm B",
                "email": "nhanvien_b@wikibot.local",
                "hashed_password": get_password_hash("nv123"),
                "role_id": 3,
                "subscription_tier": "free",
                "tenant_id": 2,
                "is_active": True
            }
        ]
        
        created_users = []
        try:
            for user_data in users_to_create:
                existing = db.query(User).filter(User.username == user_data["username"]).first()
                if existing:
                    print(f"User '{user_data['username']}' already exists. Skipping.")
                    created_users.append(existing)
                else:
                    user = User(**user_data)
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    created_users.append(user)
                    print(f"Created user: {user.username} (Role Level: {user.role_id}, Tier: {user.subscription_tier}, Tenant: {user.tenant_id})")
        except Exception as e:
            print(f"⚠️  Error creating users: {e}")
            db.rollback()
            raise

        # 3. Create default User AI Settings
        print("\nCreating default User AI Settings...")
        from app.models.models import UserAISettings
        try:
            for user in created_users:
                existing = db.query(UserAISettings).filter(UserAISettings.user_id == user.id).first()
                if not existing:
                    user_settings = UserAISettings(
                        user_id=user.id,
                        temperature=0.2,
                        response_style="concise",
                        show_sources=True,
                        preferred_max_tokens=512
                    )
                    db.add(user_settings)
            db.commit()
            print("✅ Created default User AI Settings for all users")
        except Exception as e:
            print(f"⚠️  Error creating User AI Settings: {e}")
            db.rollback()
            raise

        # 4. Create default Tenant AI Settings (for tenant 1 and 2)
        print("\nCreating default Tenant AI Settings...")
        from app.models.models import TenantAISettings
        try:
            for t_id in [1, 2]:
                existing = db.query(TenantAISettings).filter(TenantAISettings.tenant_id == t_id).first()
                if not existing:
                    tenant_settings = TenantAISettings(
                        tenant_id=t_id,
                        temperature=0.2,
                        response_style="concise",
                        show_sources=True,
                        preferred_max_tokens=512,
                        updated_by=1
                    )
                    db.add(tenant_settings)
            db.commit()
            print("✅ Created default Tenant AI Settings for Tenant 1 and Tenant 2")
        except Exception as e:
            print(f"⚠️  Error creating Tenant AI Settings: {e}")
            db.rollback()
            raise

        # 5. Create default FAQs
        print("\nCreating default FAQs...")
        from app.models.models import FAQ
        try:
            faqs_to_create = [
                {
                    "question": "Làm thế nào để xin nghỉ phép?",
                    "answer": "Để xin nghỉ phép, bạn cần điền thông tin vào đơn đăng ký xin nghỉ phép trên hệ thống HR nội bộ trước ít nhất 3 ngày làm việc. Đơn sẽ được chuyển cho Trưởng phòng duyệt trước khi gửi tới ban Nhân sự.",
                    "category": "HR",
                    "is_active": True
                },
                {
                    "question": "Thời gian làm việc của công ty như thế nào?",
                    "answer": "Công ty làm việc từ thứ Hai đến thứ Sáu hàng tuần. Thời gian làm việc cụ thể: Sáng từ 8h00 - 12h00, Chiều từ 13h30 - 17h30. Nghỉ trưa từ 12h00 - 13h30.",
                    "category": "Quy chế chung",
                    "is_active": True
                },
                {
                    "question": "Quy định về trang phục của công ty?",
                    "answer": "Nhân viên mặc trang phục công sở lịch sự từ thứ Hai đến thứ Năm. Thứ Sáu nhân viên có thể mặc trang phục tự do nhưng lịch sự (quần jean, áo thun có cổ). Tránh mặc đồ quá ngắn hoặc đồ thể thao.",
                    "category": "Quy chế chung",
                    "is_active": True
                }
            ]
            created_faqs = 0
            for faq_data in faqs_to_create:
                existing = db.query(FAQ).filter(FAQ.question == faq_data["question"]).first()
                if not existing:
                    faq = FAQ(**faq_data)
                    db.add(faq)
                    created_faqs += 1
            db.commit()
            print(f"✅ Created {created_faqs} default FAQs successfully")
        except Exception as e:
            print(f"⚠️  Error creating FAQs: {e}")
            db.rollback()
            raise
        
        # 6. Create default AI Safety Config
        print("\nCreating default AI Safety Config...")
        try:
            safety_config = db.query(AISafetyConfig).first()
            if safety_config:
                print("AI Safety Config already exists. Skipping creation.")
            else:
                default_safety = AISafetyConfig(
                    max_temperature_limit=1.0,
                    max_context_length=8192,
                    max_tokens_limit=2048,
                    default_temperature=0.2,
                    default_response_style="concise",
                    updated_by=1  # Admin user
                )
                db.add(default_safety)
                db.commit()
                print("✅ Created default AI Safety Config")
        except Exception as e:
            print(f"⚠️  Error creating AI Safety Config: {e}")
            db.rollback()
            raise
        
        # 7. Create default AI Provider Configs
        print("\nCreating default AI Provider Configs...")
        try:
            provider_configs = [
                {
                    "ai_type": "chat",
                    "provider": "local",
                    "local_model_path": "./llm_models/qwen2.5-3b-instruct-q4_k_m.gguf",
                    "local_context_length": 4096,
                    "default_temperature": 0.3,
                    "default_max_tokens": 512,
                    "updated_by": 1
                },
                {
                    "ai_type": "embedding",
                    "provider": "local",
                    "embedding_model_name": "paraphrase-multilingual-MiniLM-L12-v2",
                    "updated_by": 1
                },
                {
                    "ai_type": "faq",
                    "provider": "local",
                    "use_rag_provider": True,
                    "default_temperature": 0.2,
                    "default_max_tokens": 256,
                    "updated_by": 1
                }
            ]
            created_configs = 0
            for config_data in provider_configs:
                existing = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == config_data["ai_type"]).first()
                if not existing:
                    config = AIProviderConfig(**config_data)
                    db.add(config)
                    created_configs += 1
            
            db.commit()
            print(f"✅ Created {created_configs} default AI Provider Configs")
            
        except Exception as e:
            print(f"⚠️  Error creating AI Provider Configs: {e}")
            db.rollback()
            raise
        
        print("\n✅ Initialization complete!")
        print("\nYou can now start the backend and login with:")
        print(f"  Superadmin: {DEFAULT_ADMIN_USERNAME} / {DEFAULT_ADMIN_PASSWORD}")
        print("  Trưởng phòng (Pro, Tenant 1): truongphong / tp123")
        print("  Nhân viên A (Free, Tenant 1): nhanvien / nv123")
        print("  Nhân viên B (Free, Tenant 2): nhanvien_b / nv123")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Critical error during initialization: {e}")
        print("Please check the error message above and fix any issues before retrying.")
        raise
    finally:
        try:
            db.close()
        except Exception as e:
            print(f"⚠️  Error closing database connection: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize WikiBot database")
    parser.add_argument("--clear", action="store_true", help="Clear existing data before initialization")
    args = parser.parse_args()
    
    print("=" * 50)
    print("WikiBot Data Initialization")
    print("=" * 50)
    
    # Check if .env exists
    if not os.path.exists(".env"):
        print("\n⚠️  Warning: .env file not found!")
        print("Please copy .env.example to .env and configure your settings:")
        print("  cp .env.example .env")
        print("\nThen edit .env to set your MODEL_PATH (path to GGUF model file)")
    
    # Clear data if requested
    if args.clear:
        print("\n=== CLEAR MODE: Resetting everything ===")
        clear_existing_data()
        
        # Create database tables first using alembic
        print("\n=== STEP 1: Creating database schema ===")
        run_alembic_migration()
        
        # Create default data
        print("\n=== STEP 2: Creating default data ===")
        init_default_data()
        
        # Create fresh alembic migration from current schema
        print("\n=== STEP 3: Creating fresh alembic migration ===")
        migration_success = create_fresh_migration()
        
        if migration_success:
            # Apply fresh migration
            print("\n=== STEP 4: Applying fresh migration ===")
            apply_success = apply_fresh_migration()
            
            if apply_success:
                print("\n✅ SUCCESS: Database has been reset with fresh alembic migration!")
                print("The alembic migration now matches the current database schema.")
            else:
                print("\n⚠️  WARNING: Migration application failed.")
                print("Database schema was created but alembic migration may not be in sync.")
        else:
            print("\n⚠️  WARNING: Migration creation failed.")
            print("Database schema was created but no alembic migration was generated.")
    else:
        # Normal mode: check if database needs initialization
        print("\n=== NORMAL MODE: Checking database state ===")
        
        db = SessionLocal()
        try:
            # Check if any tables exist
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            if not existing_tables or "roles" not in existing_tables:
                print("Database appears to be empty, running alembic migration...")
                db.close()  # Close connection before migration
                run_alembic_migration()
                db = SessionLocal()  # Reopen after migration
            else:
                role_count = db.query(Role).count()
                if role_count == 0:
                    print("No roles found, running alembic migration...")
                    db.close()  # Close connection before migration
                    run_alembic_migration()
                    db = SessionLocal()  # Reopen after migration
        except Exception as e:
            print(f"Error checking database state, running alembic anyway: {e}")
            db.close()  # Close connection before migration
            run_alembic_migration()
            db = SessionLocal()  # Reopen after migration
        finally:
            try:
                db.close()
            except:
                pass
        
        # Initialize default data
        print("\n=== Initializing default data ===")
        init_default_data()
