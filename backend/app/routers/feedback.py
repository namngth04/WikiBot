from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.models import User, Message, Conversation, Document, DocumentChunk
from app.schemas.schemas import MessageResponse, FeedbackCreate, MessageRatingUpdate
from app.routers.auth import get_current_user, get_current_company_admin

router = APIRouter(tags=["Feedback"])


@router.put("/api/chat/messages/{message_id}/rating", response_model=MessageResponse)
def update_message_rating(
    message_id: int,
    rating_data: MessageRatingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cập nhật đánh giá (like/dislike) cho tin nhắn cụ thể
    """
    # Join với Conversation để đảm bảo tin nhắn thuộc về người dùng hiện tại
    message = db.query(Message).join(Conversation).filter(
        Message.id == message_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tin nhắn ID {message_id} hoặc bạn không có quyền truy cập"
        )
    
    message.rating = rating_data.rating
    db.commit()
    db.refresh(message)
    
    return message


@router.post("/api/chat/messages/{message_id}/feedback", response_model=MessageResponse)
def create_message_feedback(
    message_id: int,
    feedback_data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Gửi phản hồi chi tiết về chất lượng tin nhắn của trợ lý ảo
    """
    # Join với Conversation để đảm bảo tin nhắn thuộc về người dùng hiện tại
    message = db.query(Message).join(Conversation).filter(
        Message.id == message_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tin nhắn ID {message_id} hoặc bạn không có quyền truy cập"
        )
    
    message.rating = feedback_data.rating
    message.feedback_category = feedback_data.feedback_category
    message.feedback_text = feedback_data.feedback_text
    db.commit()
    db.refresh(message)
    
    return message


@router.get("/api/admin/feedback")
def list_feedback_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_company_admin)
):
    """
    Lấy danh sách nhật ký phản hồi tiêu cực của người dùng (dành cho Admin & Superadmin)
    """
    tenant_id = current_admin.tenant_id
    
    # Lọc các tin nhắn phản hồi tiêu cực (rating == -1)
    query = db.query(Message).filter(Message.role == "assistant", Message.rating == -1)
    
    # Lọc theo tenant_id đối với Admin doanh nghiệp
    if tenant_id is not None:
        query = query.join(Conversation).join(User).filter(User.tenant_id == tenant_id)
        
    disliked_messages = query.order_by(Message.created_at.desc()).offset(skip).limit(limit).all()
    
    logs = []
    for msg in disliked_messages:
        # Tìm câu hỏi liền trước của người dùng
        user_msg = db.query(Message).filter(
            Message.conversation_id == msg.conversation_id,
            Message.role == "user",
            Message.created_at < msg.created_at
        ).order_by(Message.created_at.desc()).first()
        
        user_question = user_msg.content if user_msg else "Không tìm thấy câu hỏi"
        
        # Lấy tên tài khoản chủ nhân cuộc hội thoại
        conversation = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first()
        username = conversation.user.username if conversation and conversation.user else "N/A"
        
        # Lấy thông tin các tài liệu nguồn đã được dùng
        chunks_info = []
        if msg.used_chunks:
            db_chunks = db.query(DocumentChunk, Document).join(
                Document, DocumentChunk.document_id == Document.id
            ).filter(DocumentChunk.id.in_(msg.used_chunks)).all()
            
            for chunk, doc in db_chunks:
                chunks_info.append({
                    "chunk_id": chunk.id,
                    "document_id": doc.id,
                    "source": doc.original_name,
                    "content": chunk.content,
                    "page_number": chunk.page_number
                })
                
        logs.append({
            "message_id": msg.id,
            "conversation_id": msg.conversation_id,
            "username": username,
            "user_question": user_question,
            "assistant_answer": msg.content,
            "feedback_category": msg.feedback_category,
            "feedback_text": msg.feedback_text,
            "created_at": msg.created_at,
            "used_chunks": chunks_info
        })
        
    return logs


@router.get("/api/chat/feedback-history")
def list_user_feedback_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lấy danh sách lịch sử phản hồi (like/dislike/góp ý) của chính người dùng hiện tại
    """
    # Lấy các tin nhắn có rating khác 0 thuộc về các hội thoại của user hiện tại
    query = db.query(Message).join(Conversation).filter(
        Conversation.user_id == current_user.id,
        Message.role == "assistant",
        Message.rating != 0
    )
    
    rated_messages = query.order_by(Message.created_at.desc()).offset(skip).limit(limit).all()
    
    logs = []
    for msg in rated_messages:
        # Tìm câu hỏi liền trước của người dùng
        user_msg = db.query(Message).filter(
            Message.conversation_id == msg.conversation_id,
            Message.role == "user",
            Message.created_at < msg.created_at
        ).order_by(Message.created_at.desc()).first()
        
        user_question = user_msg.content if user_msg else "Không tìm thấy câu hỏi"
        
        logs.append({
            "message_id": msg.id,
            "conversation_id": msg.conversation_id,
            "user_question": user_question,
            "assistant_answer": msg.content,
            "rating": msg.rating,
            "feedback_category": msg.feedback_category,
            "feedback_text": msg.feedback_text,
            "created_at": msg.created_at
        })
        
    return logs

