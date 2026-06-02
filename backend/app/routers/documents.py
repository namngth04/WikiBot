from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import aiofiles
import glob

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import User, Document, Role, DocumentChunk
from app.schemas.schemas import DocumentUpdate, DocumentResponse, SuccessResponse
from app.routers.auth import get_current_user, get_current_admin, get_current_company_admin
from app.services.document_processor import DocumentProcessor

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def get_accessible_role_ids(user: User) -> List[Optional[int]]:
    """Get list of role IDs the user can access (including 0 for public docs)"""
    if not user.role:
        # User has no role - only public documents
        return [0]
    
    db_session = user._sa_instance_state.session
    
    if user.role.level == 0:
        # Admin can access all documents of their tenant
        tenant_roles = db_session.query(Role).filter(Role.tenant_id == user.tenant_id).all()
        return [0] + [r.id for r in tenant_roles]
    
    # User with role can access their role + all lower level roles within the same tenant
    accessible_roles = [0]  # Public docs
    
    # Get all roles at user's level or lower (larger level number = lower privilege) for this tenant
    all_roles = db_session.query(Role).filter(Role.tenant_id == user.tenant_id).all()
    for role in all_roles:
        if role.level >= user.role.level:
            accessible_roles.append(role.id)
    
    return accessible_roles


def can_access_document(user: User, doc_role_id: Optional[int]) -> bool:
    """Check if user can access a document with the given role_id"""
    if doc_role_id is None or doc_role_id == 0:
        # Public document - everyone can access
        return True
    
    if not user.role:
        # User has no role - cannot access role-specific docs
        return False
    
    if user.role.level == 0:
        # Admin can access everything
        return True
    
    # Get the document's role
    doc_role = user._sa_instance_state.session.query(Role).filter(Role.id == doc_role_id).first()
    if not doc_role:
        return False
    
    # User can access if their level is <= document's role level
    return user.role.level <= doc_role.level


@router.get("/", response_model=List[DocumentResponse])
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Document).filter(Document.is_active == True)
    
    # 1. Phân quyền cách ly Multi-tenancy & cá nhân
    if current_user.user_type == "superadmin":
        # Superadmin xem toàn bộ tài liệu hệ thống
        pass
    elif current_user.tenant_id is not None:
        # Người dùng doanh nghiệp: Chỉ xem tài liệu thuộc cùng tenant
        query = query.filter(Document.tenant_id == current_user.tenant_id)
        
        # Áp dụng RBAC trong nội bộ doanh nghiệp
        if current_user.role and current_user.role.level == 1:
            # Admin doanh nghiệp (Trưởng phòng) xem được hết tài liệu của doanh nghiệp mình
            pass
        else:
            # Nhân viên: Lọc theo các chức vụ có quyền xem trong cùng doanh nghiệp
            accessible_ids = get_accessible_role_ids(current_user)
            if 0 in accessible_ids:
                other_ids = [x for x in accessible_ids if x is not None]
                if other_ids:
                    query = query.filter((Document.role_id.in_(other_ids)) | (Document.role_id.is_(None)))
                else:
                    query = query.filter(Document.role_id.is_(None))
            else:
                query = query.filter(Document.role_id.in_(accessible_ids))
    else:
        # Người dùng cá nhân: Chỉ xem tài liệu của chính mình tải lên
        query = query.filter(Document.uploaded_by == current_user.id)
    
    # 2. Lọc thêm theo role_id cụ thể nếu có yêu cầu từ frontend
    if role_id is not None:
        if not can_access_document(current_user, role_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền xem tài liệu của chức vụ này"
            )
        query = query.filter(Document.role_id == role_id)
    
    documents = query.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit).all()
    return documents


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    role_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Chặn Superadmin hệ thống tải lên tài liệu
    if current_user.role and current_user.role.level == 0 and current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản Superadmin hệ thống không có quyền tải lên tài liệu cá nhân/nội bộ."
        )

    settings = get_settings()
    
    # Validate file type
    allowed_types = ['.pdf', '.docx', '.txt', '.pptx', '.xlsx', '.csv', '.html', '.htm', '.md', '.png', '.jpg', '.jpeg']
    file_ext = os.path.splitext(file.filename.lower())[1]
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Loại file không được hỗ trợ. Chỉ chấp nhận: {', '.join(allowed_types)}"
        )
    
    # Validate file size
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    # Quota Guard for Free Tier (Personal User)
    if current_user.subscription_tier == "free" and current_user.tenant_id is None:
        # 1. Kiểm tra kích thước file (> 2MB)
        if file_size > 2 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dung lượng file vượt quá giới hạn 2MB của gói Free. Vui lòng nâng cấp gói cước để tải lên file lên tới 100MB."
            )
        
        # 2. Kiểm tra số lượng file hiện tại (>= 3)
        existing_count = db.query(Document).filter(
            Document.uploaded_by == current_user.id,
            Document.is_active == True
        ).count()
        
        if existing_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bạn đã đạt giới hạn tối đa 3 tài liệu của gói Free. Vui lòng nâng cấp gói cước để tải lên không giới hạn."
            )
            
    max_size = settings.max_file_size * 1024 * 1024  # Convert MB to bytes
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kích thước file vượt quá giới hạn {settings.max_file_size}MB"
        )
    
    # Validate role_id if provided
    if role_id is not None:
        role = db.query(Role).filter(Role.id == role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ ID {role_id} không tồn tại"
            )
        
        print(f"[DEBUG UPLOAD] User role: {current_user.role}")
        if current_user.role:
            print(f"[DEBUG UPLOAD] User role level: {current_user.role.level}")
        print(f"[DEBUG UPLOAD] User tenant_id: {current_user.tenant_id}")
        print(f"[DEBUG UPLOAD] Target role tenant_id: {role.tenant_id}")

        # Chỉ Admin hệ thống (level=0) hoặc Admin doanh nghiệp (level=1) mới được gán chức vụ cho tài liệu
        if not current_user.role or current_user.role.level not in [0, 1]:
            print(f"[DEBUG UPLOAD] Blocked: Role not found or level not in [0, 1]")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ quản trị viên mới có thể gán chức vụ cho tài liệu"
            )
        # Nếu là Admin doanh nghiệp, chức vụ được gán phải thuộc về doanh nghiệp đó
        if current_user.tenant_id is not None and role.tenant_id != current_user.tenant_id:
            print(f"[DEBUG UPLOAD] Blocked: role.tenant_id ({role.tenant_id}) != user.tenant_id ({current_user.tenant_id})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chỉ có thể gán chức vụ thuộc doanh nghiệp của mình cho tài liệu"
            )
    
    # Create data directory if not exists
    data_dir = settings.data_dir
    os.makedirs(data_dir, exist_ok=True)
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(data_dir, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Create document record
    new_document = Document(
        filename=unique_filename,
        original_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        file_type=file_ext.replace('.', ''),
        role_id=role_id,
        uploaded_by=current_user.id,
        tenant_id=current_user.tenant_id,  # Tự động gán tenant_id để cách ly dữ liệu
        chunk_count=0
    )
    
    db.add(new_document)
    db.commit()
    db.refresh(new_document)
    
    # Process document (extract text, chunk, embed)
    try:
        processor = DocumentProcessor()
        chunk_count = await processor.process_document(new_document, db)
        new_document.chunk_count = chunk_count
        db.commit()
    except Exception as e:
        # Rollback: delete file and document record
        if os.path.exists(file_path):
            os.remove(file_path)
        db.delete(new_document)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xử lý tài liệu: {str(e)}"
        )
    
    return new_document


@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: int,
    update_data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_company_admin)
):
    document = db.query(Document).filter(Document.id == doc_id, Document.is_active == True).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy & Quyền chỉnh sửa
    has_permission = False
    if current_user.user_type == "superadmin":
        has_permission = True
    elif current_user.tenant_id is not None and document.tenant_id == current_user.tenant_id and current_user.role and current_user.role.level == 1:
        has_permission = True  # Company Admin toàn quyền sửa tài liệu thuộc tenant của mình
    elif document.uploaded_by == current_user.id:
        has_permission = True  # Chủ sở hữu tài liệu được quyền sửa tài liệu của mình
        
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa tài liệu này"
        )
    
    # Validate new role_id
    if update_data.role_id is not None:
        role = db.query(Role).filter(Role.id == update_data.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ ID {update_data.role_id} không tồn tại"
            )
        # Chỉ Admin doanh nghiệp mới gán được vai trò trong cùng tenant
        if current_user.tenant_id is not None and role.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chỉ có thể gán chức vụ thuộc doanh nghiệp của mình cho tài liệu"
            )
    
    # Update role and metadata if changed
    if update_data.role_id is not None and update_data.role_id != document.role_id:
        old_role_id = document.role_id
        document.role_id = update_data.role_id
        
        # Update ChromaDB metadata
        try:
            processor = DocumentProcessor()
            processor.update_document_role_in_vector_db(document.id, update_data.role_id, old_role_id)
        except Exception as e:
            print(f"Warning: Failed to update vector DB metadata: {e}")
            
    # Update original name if changed
    if update_data.original_name is not None:
        document.original_name = update_data.original_name
    
    # Invalidate associated semantic caches because document privileges have changed
    try:
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        cache_service.invalidate_by_document(document.id)
    except Exception as ce:
        print(f"Warning: Failed to invalidate semantic cache on document update: {ce}")

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{doc_id}", response_model=SuccessResponse)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
        )
    
    # Kiểm tra bảo mật Multi-tenancy & Quyền xóa tài liệu
    has_permission = False
    if current_user.user_type == "superadmin":
        has_permission = True
    elif current_user.tenant_id is not None and document.tenant_id == current_user.tenant_id and current_user.role and current_user.role.level == 1:
        has_permission = True  # Company Admin được quyền xóa mọi tài liệu thuộc doanh nghiệp của mình
    elif document.uploaded_by == current_user.id:
        has_permission = True  # Chủ sở hữu tài liệu được quyền xóa tài liệu của mình
        
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa tài liệu này"
        )
    
    # Delete from vector DB
    try:
        processor = DocumentProcessor()
        processor.delete_document_from_vector_db(document.id)
    except Exception as e:
        print(f"Warning: Failed to delete from vector DB: {e}")
    
    # Delete file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    # Invalidate Semantic Cache related to this document
    try:
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        cache_service.invalidate_by_document(document.id)
    except Exception as ce:
        print(f"Warning: Failed to invalidate semantic cache: {ce}")

    # Delete from database
    original_name = document.original_name
    db.delete(document)
    db.commit()
    
    return SuccessResponse(
        success=True,
        message=f"Đã xóa tài liệu '{original_name}'"
    )


@router.post("/{doc_id}/toggle-share", response_model=DocumentResponse)
def toggle_document_share(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle community sharing (is_public_community) for a personal document.
    Enforces privacy boundary: Only accessible for personal users and owned documents.
    """
    document = db.query(Document).filter(Document.id == doc_id, Document.is_active == True).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
        )
        
    # Enforce privacy boundary:
    # 1. Must be a personal user (tenant_id is None)
    # 2. Must be the owner of the document
    if current_user.tenant_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tính năng chia sẻ tri thức cộng đồng chỉ khả dụng với tài khoản cá nhân (Personal)"
        )
        
    if document.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chia sẻ tài liệu này"
        )
        
    # Toggle share state
    document.is_public_community = not document.is_public_community
    
    # Sync to ChromaDB vector store
    try:
        processor = DocumentProcessor()
        processor.update_document_community_share_in_vector_db(document.id, document.is_public_community)
    except Exception as e:
        print(f"Warning: Failed to update community share in vector DB: {e}")
        
    db.commit()
    db.refresh(document)
    
    return document


@router.get("/{doc_id}/pages/{page_number}")
def get_document_page(
    doc_id: int,
    page_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all text chunks and extracted images of a specific page within a document.
    Enforces tenant isolation and RBAC checks.
    """
    # 1. Fetch document and verify existence
    document = db.query(Document).filter(Document.id == doc_id, Document.is_active == True).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
        )
        
    # 2. Enforce Security & Access Boundaries (Multi-tenancy & RBAC)
    has_access = False
    if current_user.user_type == "superadmin":
        has_access = True
    elif current_user.tenant_id is not None:
        # Tenant User: Check if document belongs to the same tenant and respects RBAC
        if document.tenant_id == current_user.tenant_id and can_access_document(current_user, document.role_id):
            has_access = True
    else:
        # Personal User: Check if owned or shared with community
        if document.uploaded_by == current_user.id or document.is_public_community:
            has_access = True
            
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập tài liệu này"
        )
        
    # 3. Retrieve chunks for the specified page
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == doc_id,
        DocumentChunk.page_number == page_number
    ).order_by(DocumentChunk.id.asc()).all()
    
    # 4. Search for any extracted images belonging to this page on disk
    settings = get_settings()
    images_dir = os.path.join(settings.data_dir, "extracted_images")
    pattern = os.path.join(images_dir, f"doc_{doc_id}_page_{page_number}_img_*")
    img_files = glob.glob(pattern)
    
    img_urls = []
    for img_file in img_files:
        filename = os.path.basename(img_file)
        img_urls.append(f"/api/documents/extracted-images/{filename}")
        
    return {
        "document_id": doc_id,
        "original_name": document.original_name,
        "page_number": page_number,
        "chunks": [
            {
                "id": chunk.id,
                "content": chunk.content,
                "element_type": chunk.element_type
            } for chunk in chunks
        ],
        "images": img_urls
    }

