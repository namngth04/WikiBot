from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import aiofiles

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import User, Document, Role
from app.schemas.schemas import DocumentUpdate, DocumentResponse, SuccessResponse
from app.routers.auth import get_current_user, get_current_admin
from app.services.document_processor import DocumentProcessor

router = APIRouter(prefix="/api/documents", tags=["Documents"])


def get_accessible_role_ids(user: User) -> List[Optional[int]]:
    """Get list of role IDs the user can access (including 0 for public docs)"""
    if not user.role:
        # User has no role - only public documents
        return [0]
    
    if user.role.level == 0:
        # Admin can access all documents
        return [0, 1, 2, 3]  # 0 + all role IDs (will be expanded dynamically)
    
    # User with role can access their role + all lower level roles
    accessible_roles = [0]  # Public docs
    
    # Get all roles at user's level or lower
    all_roles = user._sa_instance_state.session.query(Role).all()
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
    
    # Apply RBAC filtering
    if current_user.role and current_user.role.level == 0:
        # Admin can see all
        pass
    else:
        # Filter by accessible roles
        accessible_ids = get_accessible_role_ids(current_user)
        # If accessible_ids contains 0 (public), we need to handle it specially
        if 0 in accessible_ids:
            other_ids = [x for x in accessible_ids if x is not None]
            if other_ids:
                query = query.filter((Document.role_id.in_(other_ids)) | (Document.role_id.is_(None)))
            else:
                query = query.filter(Document.role_id.is_(None))
        else:
            query = query.filter(Document.role_id.in_(accessible_ids))
    
    # Additional filter by role_id if specified
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
    settings = get_settings()
    
    # Validate file type
    allowed_types = ['.pdf', '.docx', '.txt']
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
        # Only admin can assign documents to roles
        if not current_user.role or current_user.role.level != 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chỉ quản trị viên mới có thể gán chức vụ cho tài liệu"
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
    current_user: User = Depends(get_current_admin)
):
    document = db.query(Document).filter(Document.id == doc_id, Document.is_active == True).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
        )
    
    # Validate new role_id
    if update_data.role_id is not None:
        role = db.query(Role).filter(Role.id == update_data.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chức vụ ID {update_data.role_id} không tồn tại"
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
    
    db.commit()
    db.refresh(document)
    return document


@router.delete("/{doc_id}", response_model=SuccessResponse)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tài liệu ID {doc_id}"
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
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    return SuccessResponse(
        success=True,
        message=f"Đã xóa tài liệu '{document.original_name}'"
    )
