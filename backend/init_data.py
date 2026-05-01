"""
Initialize default data for WikiBot
Run this script after starting the backend for the first time
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.models import Base, Role, User


def init_default_data():
    """Create default roles and admin user"""
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
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
    print("=" * 50)
    print("WikiBot Data Initialization")
    print("=" * 50)
    
    # Check if .env exists
    if not os.path.exists(".env"):
        print("\n⚠️  Warning: .env file not found!")
        print("Please copy .env.example to .env and configure your settings:")
        print("  cp .env.example .env")
        print("\nThen edit .env to set your MODEL_PATH (path to GGUF model file)")
    
    init_default_data()
