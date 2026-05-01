# WikiBot

Hệ thống RAG (Retrieval-Augmented Generation) chạy hoàn toàn Local với bảo mật tuyệt đối, cho phép upload tài liệu và chat dựa trên nội dung tài liệu với Role-Based Access Control (RBAC).

## Tính năng chính

- **Authentication & Authorization**: JWT-based authentication với role hierarchy
- **Role Management**: Admin có thể tạo, sửa, xóa roles (Admin > Trưởng phòng > Nhân viên)
- **User Management**: Quản lý users với các trường thông tin đầy đủ
- **Document Management**: Upload PDF, DOCX, TXT với phân quyền role
- **RAG Chat System**: Chat dựa trên nội dung tài liệu với context-aware responses
- **Conversation History**: Lưu trữ và quản lý lịch sử trò chuyện

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **LLM Engine**: llama-cpp-python (GGUF models)
- **Vector Database**: ChromaDB (PersistentClient)
- **Embedding**: SentenceTransformers (paraphrase-multilingual-MiniLM-L12-v2)
- **ORM**: SQLAlchemy (SQLite)
- **Authentication**: JWT (OAuth2PasswordBearer)

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **State Management**: React Context

## Cài đặt

### Yêu cầu
- Python 3.10+
- Node.js 18+
- RAM: 8GB+ (khuyến nghị)

### Bước 1: Cài đặt Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv

# Kích hoạt (Windows)
venv\Scripts\activate

# Kích hoạt (Linux/Mac)
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

### Bước 2: Tải Model GGUF

Tải một model GGUF phù hợp với laptop 8GB RAM:

**Khuyến nghị:**
1. [Qwen2.5-3B-Instruct-Q4_K_M.gguf](https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF) (~2GB)
2. [Llama-3.2-3B-Instruct-Q4_K_M.gguf](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF) (~2GB)

Lưu file model vào thư mục `backend/models/`.

### Bước 3: Cấu hình môi trường

```bash
# Copy file mẫu
cp .env.example .env

# Chỉnh sửa .env
# Đặt MODEL_PATH=./models/[tên-file-model].gguf
```

### Bước 4: Khởi tạo dữ liệu

```bash
python init_data.py
```

Script này sẽ tạo:
- 3 roles mặc định: Admin, Trưởng phòng, Nhân viên
- Admin user: `admin` / `admin123`

### Bước 5: Chạy Backend

```bash
python main.py
```

Backend sẽ chạy tại: http://127.0.0.1:8000

API Docs: http://127.0.0.1:8000/docs

### Bước 6: Cài đặt Frontend

```bash
cd ../frontend

# Cài đặt dependencies
npm install

# Chạy dev server
npm run dev
```

Frontend sẽ chạy tại: http://127.0.0.1:3000

## Cách sử dụng

### 1. Đăng nhập
- Truy cập: http://127.0.0.1:3000
- Đăng nhập với: `admin` / `admin123`

### 2. Upload tài liệu (Admin)
- Vào Admin Panel → Quản lý Tài liệu
- Click "Upload Tài liệu"
- Chọn file (PDF, DOCX, TXT)
- Chọn chức vụ (để trống = Public)

### 3. Chat
- Vào trang Chat
- Hỏi các câu hỏi liên quan đến tài liệu đã upload
- Bot sẽ trả lời dựa trên nội dung tài liệu

### 4. Quản lý (Admin Panel)
- **Quản lý Nhân viên**: CRUD users
- **Quản lý Chức vụ**: CRUD roles với hierarchy
- **Quản lý Tài liệu**: Upload, phân quyền, xóa tài liệu

## RBAC - Role-Based Access Control

### Hierarchy
- **Admin (level 0)**: Xem tất cả tài liệu, quản lý hệ thống
- **Trưởng phòng (level 1)**: Xem tài liệu của mình + Nhân viên + Public
- **Nhân viên (level 2)**: Xem tài liệu của mình + Public
- **Không có role**: Chỉ xem Public documents

### Phân quyền tài liệu
- **Public** (role_id = NULL): Tất cả users đều xem được
- **Role-specific**: Chỉ users có role đó hoặc level cao hơn mới xem được

## API Endpoints

### Auth
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Thông tin user hiện tại

### Users (Admin only)
- `GET /api/users/` - Danh sách users
- `POST /api/users/` - Tạo user
- `PUT /api/users/{id}` - Cập nhật user
- `DELETE /api/users/{id}` - Xóa user

### Roles (Admin only)
- `GET /api/roles/` - Danh sách roles
- `POST /api/roles/` - Tạo role
- `PUT /api/roles/{id}` - Cập nhật role
- `DELETE /api/roles/{id}` - Xóa role

### Documents
- `GET /api/documents/` - Danh sách tài liệu (filtered by RBAC)
- `POST /api/documents/upload` - Upload tài liệu
- `PUT /api/documents/{id}/role` - Cập nhật role của tài liệu
- `DELETE /api/documents/{id}` - Xóa tài liệu

### Chat
- `GET /api/chat/conversations` - Danh sách conversations
- `POST /api/chat/conversations` - Tạo conversation mới
- `DELETE /api/chat/conversations/{id}` - Xóa conversation
- `POST /api/chat/send` - Gửi tin nhắn, nhận RAG response

## Cấu trúc thư mục

```
WikiBot/
├── backend/
│   ├── app/
│   │   ├── core/          # Config, security, database
│   │   ├── models/        # Database models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # API endpoints
│   │   └── services/      # Business logic (RAG, Document Processing)
│   ├── data/              # SQLite DB và uploaded files
│   ├── chroma_db/         # Vector database
│   ├── models/            # GGUF model files
│   ├── main.py            # FastAPI app
│   ├── init_data.py       # Initialize default data
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── lib/           # API client, types
│   │   ├── context/       # Auth context
│   │   ├── login/         # Login page
│   │   ├── chat/          # Chat interface
│   │   └── admin/         # Admin panel
│   └── package.json
└── README.md
```

## Lưu ý quan trọng

### Bảo mật
- Hệ thống chạy **hoàn toàn local**, không gọi API bên ngoài
- Dữ liệu được lưu trữ local (SQLite, ChromaDB)
- JWT secret nên được thay đổi trong production

### Hiệu năng
- Model 3B parameters (~2GB) phù hợp với laptop 8GB RAM
- Chạy trên CPU, không yêu cầu GPU
- Embedding model đa ngôn ngữ, hỗ trợ tiếng Việt tốt

### Giới hạn
- File upload tối đa: 50MB (có thể cấu hình trong `.env`)
- Context window: 4096 tokens
- Chỉ hỗ trợ PDF, DOCX, TXT

## Troubleshooting

### Lỗi "Model file not found"
- Kiểm tra đường dẫn trong `.env`
- Đảm bảo file model GGUF đã được tải và đặt đúng vị trí

### Lỗi khi upload file lớn
- Tăng `MAX_FILE_SIZE` trong `.env`
- Kiểm tra dung lượng RAM còn trống

### Lỗi CORS
- Kiểm tra `next.config.mjs` đã cấu hình đúng rewrite rules
- Đảm bảo backend chạy tại port 8000

### Lỗi "Không tìm thấy thông tin"
- Kiểm tra tài liệu đã được upload và xử lý thành công
- Kiểm tra role của user có quyền xem tài liệu đó không
- Kiểm tra chunk_count > 0 trong danh sách tài liệu

## License

MIT License
