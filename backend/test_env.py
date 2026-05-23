import sys
import time
from app.core.config import get_settings
from sqlalchemy import create_engine
import chromadb
import httpx

def print_header(title):
    print("\n" + "="*60)
    print(f" {title.upper()} ".center(60, "="))
    print("="*60)

def test_database(settings):
    print("\n[1] KIỂM TRA KẾT NỐI CƠ SỞ DỮ LIỆU QUAN HỆ (SQLAlchemy):")
    db_url = settings.database_url
    if settings.offline_mode:
        if settings.local_db_type == "sqlite":
            db_url = "sqlite:///./data/wikibot.db"
            print(" -> Chế độ: Local Offline - CSDL SQLite")
        elif settings.local_db_type == "postgresql" and "sqlite" in db_url:
            db_url = "postgresql://postgres:postgres@localhost:5432/wikibot"
            print(" -> Chế độ: Local Offline - CSDL PostgreSQL (Docker)")
    else:
        print(" -> Chế độ: WAN Cloud - CSDL PostgreSQL Cloud")
    
    print(f" -> URL Kết nối: {db_url}")
    try:
        engine = create_engine(db_url, connect_args={"connect_args": {"timeout": 5}} if "sqlite" not in db_url else {})
        # Try a quick connect
        with engine.connect() as conn:
            print(" 💚 THÀNH CÔNG: Kết nối Cơ sở dữ liệu hoạt động hoàn hảo!")
        return True
    except Exception as e:
        print(f" ❌ THẤT BẠI: Không thể kết nối CSDL. Lỗi: {e}")
        return False

def test_chromadb(settings):
    print("\n[2] KIỂM TRA KẾT NỐI CƠ SỞ DỮ LIỆU VECTOR (ChromaDB):")
    try:
        if settings.chroma_type == "http":
            print(f" -> Loại: ChromaDB Server (HTTP Client)")
            print(f" -> Địa chỉ: {settings.chroma_host}:{settings.chroma_port}")
            client = chromadb.HttpClient(host=settings.chroma_host, port=int(settings.chroma_port))
        else:
            print(f" -> Loại: Local Persistent Client")
            print(f" -> Thư mục: {settings.chroma_db_path}")
            client = chromadb.PersistentClient(path=settings.chroma_db_path)
        
        # Test heartbeat
        client.heartbeat()
        collections = client.list_collections()
        print(f" 💚 THÀNH CÔNG: Kết nối ChromaDB hoạt động! Số lượng collection hiện tại: {len(collections)}")
        return True
    except Exception as e:
        print(f" ❌ THẤT BẠI: Không thể khởi tạo hoặc kết nối ChromaDB. Lỗi: {e}")
        return False

def test_llm_provider(settings):
    print("\n[3] KIỂM TRA KẾT NỐI MÁY CHỦ AI SUY LUẬN (Ollama/API):")
    # Kiểm tra Ollama mặc định cục bộ
    ollama_url = "http://localhost:11434"
    print(f" -> Endpoint Ollama kiểm tra: {ollama_url}")
    try:
        with httpx.Client(timeout=3) as client:
            resp = client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                models = [m['name'] for m in resp.json().get('models', [])]
                print(f" 💚 THÀNH CÔNG: Máy chủ Ollama đang chạy cục bộ!")
                print(f" -> Danh sách mô hình khả dụng: {models}")
                return True
    except Exception:
        print(" -> Cảnh báo: Không phát hiện máy chủ Ollama chạy cục bộ tại localhost.")
        print(" -> Kiểm tra tệp GGUF local hoặc API Cloud...")
        # Fallback test model path
        if settings.offline_mode and settings.local_db_type == "sqlite":
            import os
            print(f" -> Kiểm tra tệp GGUF local: {settings.model_path}")
            if os.path.exists(settings.model_path):
                print(f" 💚 THÀNH CÔNG: Phát hiện tệp mô hình GGUF local sẵn sàng tại ổ đĩa!")
                return True
            else:
                print(f" ❌ CẢNH BÁO: Không tìm thấy tệp GGUF tại {settings.model_path}")
    return False

if __name__ == "__main__":
    print_header("WikiBot Diagnostic Tool")
    settings = get_settings()
    print(f"Trạng thái OFFLINE_MODE: {settings.offline_mode}")
    print(f"Trường hợp LOCAL_DB_TYPE: {settings.local_db_type}")
    print(f"Trường hợp CHROMA_TYPE: {settings.chroma_type}")
    
    db_ok = test_database(settings)
    chroma_ok = test_chromadb(settings)
    llm_ok = test_llm_provider(settings)
    
    print_header("BÁO CÁO CHẨN ĐOÁN CUỐI CÙNG")
    if db_ok and chroma_ok and llm_ok:
        print(" 😎 TUYỆT VỜI: Môi trường hiện tại của bạn đã sẵn sàng 100% để khởi chạy!")
    else:
        print(" ⚠️ LƯU Ý: Một số dịch vụ chưa sẵn sàng, vui lòng kiểm tra lại cấu hình file .env tương ứng.")
    print("="*60 + "\n")
