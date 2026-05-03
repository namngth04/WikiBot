"""
Initialize default data for WikiBot
Run this script after starting the backend for the first time
"""

import os
import sys
import shutil

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.models import Base, Role, User, AISafetyConfig, AIProviderConfig
from sqlalchemy import inspect
import subprocess
import sys
import shutil


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
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("✅ Alembic migration completed successfully")
            
            # Verify that tables were created
            print("Verifying database tables...")
            import time
            time.sleep(0.5)  # Give database a moment to settle
            
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
            print(f"⚠️  Alembic migration warning: {result.stderr}")
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


def clear_existing_data():
    """Clear existing data for fresh initialization"""
    print("Clearing existing data...")
    
    # Clear database data
    db = SessionLocal()
    try:
        # Check which tables exist
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        print(f"Found tables: {existing_tables}")
        
        # Delete in correct order to avoid foreign key constraints
        if "ai_provider_config" in existing_tables:
            db.query(AIProviderConfig).delete()
        if "ai_safety_config" in existing_tables:
            db.query(AISafetyConfig).delete()
        if "user_ai_settings" in existing_tables:
            from app.models.models import UserAISettings
            db.query(UserAISettings).delete()
        if "messages" in existing_tables:
            from app.models.models import Message
            db.query(Message).delete()
        if "conversations" in existing_tables:
            from app.models.models import Conversation
            db.query(Conversation).delete()
        if "documents" in existing_tables:
            from app.models.models import Document
            db.query(Document).delete()
        if "users" in existing_tables:
            db.query(User).delete()
        if "roles" in existing_tables:
            db.query(Role).delete()
        if "faqs" in existing_tables:
            from app.models.models import FAQ
            from app.models.models import FAQ as FaqModel
            db.query(FaqModel).delete()
            
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
    
    # Close all database connections before file operations
    engine.dispose()
    
    # Remove old database file if exists
    old_db_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")
    try:
        if os.path.exists(old_db_file):
            print(f"Removing old database file: {old_db_file}")
            os.unlink(old_db_file)
            print("✅ Removed old database file")
    except Exception as e:
        print(f"⚠️  Could not remove old database file: {e}")
    
    # Clear ChromaDB
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
    
    # Clear __pycache__ directories
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
    
    # Clear data directory
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


def init_default_data():
    """Create default roles, admin user and AI configs"""
    
    db = SessionLocal()
    
    try:
        # Create default roles
        print("Creating default roles...")
        
        # Check if roles already exist
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
            print("Created 3 default roles:")
            print("  - Admin (level 0)")
            print("  - Trưởng phòng (level 1)")
            print("  - Nhân viên (level 2)")
        
        # Create default admin user
        print("\nCreating default admin user...")
        
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            print("Admin user already exists. Skipping creation.")
        else:
            admin = User(
                username="admin",
                full_name="Quản trị viên",
                email="admin@wikibot.local",
                phone=None,
                department="IT",
                hashed_password=get_password_hash("admin123"),
                role_id=1,  # Admin role
                is_active=True
            )
            
            db.add(admin)
            db.commit()
            print("Created default admin user:")
            print("  Username: admin")
            print("  Password: admin123")
            print("  Role: Admin")
        
        # Create default AI Safety Config
        print("\nCreating default AI Safety Config...")
        
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
        
        # Create default AI Provider Configs
        print("\nCreating default AI Provider Configs...")
        
        provider_configs = [
            {
                "ai_type": "rag",
                "provider": "local",
                "local_model_path": "./llm_models/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
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
        
        for config_data in provider_configs:
            existing = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == config_data["ai_type"]).first()
            if not existing:
                config = AIProviderConfig(**config_data)
                db.add(config)
        
        db.commit()
        print("✅ Created default AI Provider Configs for RAG, Embedding, and FAQ")
        
        print("\n✅ Initialization complete!")
        print("\nYou can now start the backend and login with:")
        print("  Username: admin")
        print("  Password: admin123")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during initialization: {e}")
        raise
    finally:
        db.close()


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
        clear_existing_data()
        # After clearing, run alembic to recreate tables
        run_alembic_migration()
        # Wait a moment for database to be ready
        import time
        time.sleep(1)
    else:
        # Check if database is empty (no roles) - if so, run alembic
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
    
    init_default_data()
