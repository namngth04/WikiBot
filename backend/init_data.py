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
            ("tenant_ai_settings", "TenantAISettings"),
            ("upgrade_requests", "UpgradeRequest"),
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
                    from app.models.models import UserAISettings, Message, Conversation, Document, FAQ, TenantAISettings, UpgradeRequest
                    model_map = {
                        "UserAISettings": UserAISettings,
                        "TenantAISettings": TenantAISettings,
                        "UpgradeRequest": UpgradeRequest,
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
                    # Chỉ giữ lại duy nhất vai trò Admin hệ thống cho khóa ngoại của Superadmin
                    Role(id=1, name="Admin", description="Quản trị viên hệ thống", level=0, tenant_id=None)
                ]
                for role in roles:
                    db.add(role)
                db.commit()
                
                # Reset PostgreSQL primary key sequence for roles to avoid duplicate key errors
                try:
                    from sqlalchemy import text
                    bind = db.get_bind()
                    if bind.dialect.name == "postgresql":
                        print("Resetting roles primary key sequence...")
                        db.execute(text("SELECT setval(pg_get_serial_sequence('roles', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM roles;"))
                        db.commit()
                        print("✅ Sequence reset successfully!")
                except Exception as seq_err:
                    print(f"⚠️  Could not reset postgres sequence: {seq_err}")
                    
                print("Created default global roles successfully.")
        except Exception as e:
            print(f"⚠️  Error creating roles: {e}")
            db.rollback()
            raise
        
        # 2. Create default users (Only Superadmin)
        print("\nCreating default users...")
        users_to_create = [
            # Superadmin
            {
                "username": DEFAULT_ADMIN_USERNAME,
                "full_name": "Quản trị viên hệ thống",
                "email": "admin@wikibot.local",
                "hashed_password": get_password_hash(DEFAULT_ADMIN_PASSWORD),
                "role_id": 1,
                "subscription_tier": "pro",
                "tenant_id": None,
                "is_active": True,
                "user_type": "superadmin"
            }
        ]
        
        created_users = []
        admin_id = 1  # Mặc định dự phòng
        try:
            for user_data in users_to_create:
                existing = db.query(User).filter(User.username == user_data["username"]).first()
                if existing:
                    print(f"User '{user_data['username']}' already exists. Skipping.")
                    created_users.append(existing)
                    if user_data["username"] == DEFAULT_ADMIN_USERNAME:
                        admin_id = existing.id
                else:
                    user = User(**user_data)
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    created_users.append(user)
                    if user_data["username"] == DEFAULT_ADMIN_USERNAME:
                        admin_id = user.id
                    print(f"Created user: {user.username} (Role Level: {user.role_id}, Type: {user.user_type}, Tenant: {user.tenant_id})")
            
            # Reset PostgreSQL primary key sequence for users to avoid duplicate key errors
            try:
                from sqlalchemy import text
                bind = db.get_bind()
                if bind.dialect.name == "postgresql":
                    print("Resetting users primary key sequence...")
                    db.execute(text("SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM users;"))
                    db.commit()
                    print("✅ Sequence reset successfully for users!")
            except Exception as seq_err:
                print(f"⚠️  Could not reset postgres sequence for users: {seq_err}")
        except Exception as e:
            print(f"⚠️  Error creating users: {e}")
            db.rollback()
            raise
 
        # 3. Create default User AI Settings
        print("\nCreating default User AI Settings...")
        from app.models.models import UserAISettings, TenantAISettings
        try:
            for user in created_users:
                # Chỉ tạo UserAISettings cho các tài khoản không phải employee
                if user.user_type != "employee":
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
            print("✅ Created default User AI Settings for personal users")
        except Exception as e:
            print(f"⚠️  Error creating User AI Settings: {e}")
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
                    updated_by=admin_id  # Admin user ID động
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
            openrouter_key = "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"
            provider_configs = [
                {
                    "ai_type": "chat",
                    "provider": "openrouter",
                    "api_base_url": "https://openrouter.ai/api/v1",
                    "api_key": openrouter_key,
                    "api_model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
                    "default_temperature": 0.3,
                    "default_max_tokens": 512,
                    "updated_by": admin_id
                },
                {
                    "ai_type": "embedding",
                    "provider": "openrouter",
                    "api_base_url": "https://openrouter.ai/api/v1",
                    "api_key": openrouter_key,
                    "api_model": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
                    "embedding_model_name": "nvidia/llama-nemotron-embed-vl-1b-v2:free",
                    "updated_by": admin_id
                },
                {
                    "ai_type": "faq",
                    "provider": "local",
                    "use_rag_provider": True,
                    "default_temperature": 0.2,
                    "default_max_tokens": 256,
                    "updated_by": admin_id
                }
            ]
            created_configs = 0
            for config_data in provider_configs:
                existing = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == config_data["ai_type"]).first()
                if existing:
                    # Tự động cập nhật nếu đã tồn tại
                    for key, val in config_data.items():
                        setattr(existing, key, val)
                    print(f"🔄 Updated default AI Provider Config for: {config_data['ai_type']}")
                else:
                    config = AIProviderConfig(**config_data)
                    db.add(config)
                    created_configs += 1
            
            db.commit()
            print(f"✅ Finished setting up AI Provider Configs (created {created_configs} new)")
            
        except Exception as e:
            print(f"⚠️  Error creating AI Provider Configs: {e}")
            db.rollback()
            raise
        
        print("\n✅ Initialization complete!")
        print("\nYou can now start the backend and login with:")
        print(f"  Superadmin: {DEFAULT_ADMIN_USERNAME} / {DEFAULT_ADMIN_PASSWORD}")
        
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
    
    # Always run clear mode to ensure a fresh, clean database matching user requirements
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
