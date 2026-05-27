import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# 1. Thêm đường dẫn thư mục backend vào Python Path để Alembic có thể tìm thấy thư mục "app"
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 2. Import Base và db_url từ core database để Alembic đồng bộ động cấu hình
from app.models.models import Base
from app.core.database import db_url

# Đây là đối tượng Config của Alembic đọc cấu hình từ alembic.ini
config = context.config

# Ghi đè URL cấu hình từ app config (luôn sử dụng DB PostgreSQL thực tế, không tạo SQLite)
config.set_main_option("sqlalchemy.url", db_url)

# Thiết lập hệ thống Logging (in ra các dòng nhật ký khi chạy lệnh)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 3. Gán target_metadata bằng metadata của Base chứa cấu trúc bảng của dự án
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Chạy migration ở chế độ ngoại tuyến (Offline)"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # 4. Bật chế độ Batch Mode để hỗ trợ SQLite
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Chạy migration ở chế độ trực tuyến (Online)"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True,  # 4. Bật chế độ Batch Mode để hỗ trợ SQLite
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
