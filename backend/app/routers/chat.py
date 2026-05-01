from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.models import User, Conversation, Message
from app.schemas.schemas import (
    ConversationCreate, ConversationUpdate, ConversationResponse,
    ConversationDetailResponse, MessageResponse, ChatRequest, ChatResponse,
    MessageRatingUpdate
)
from app.routers.auth import get_current_user
from app.routers.documents import get_accessible_role_ids
from app.services.rag_service import RAGService

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()).all()
    
    # Add message count
    result = []
    for conv in conversations:
        msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
        conv_dict = {
            "id": conv.id,
            "user_id": conv.user_id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": msg_count
        }
        result.append(conv_dict)
    
    return result


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_data: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_conversation = Conversation(
        user_id=current_user.id,
        title=conv_data.title or "Cuộc trò chuyện mới"
    )
    
    db.add(new_conversation)
    db.commit()
    db.refresh(new_conversation)
    
    return {
        "id": new_conversation.id,
        "user_id": new_conversation.user_id,
        "title": new_conversation.title,
        "created_at": new_conversation.created_at,
        "updated_at": new_conversation.updated_at,
        "message_count": 0
    }


@router.get("/conversations/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộc trò chuyện ID {conv_id}"
        )
    
    messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.asc()).all()
    
    return {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "message_count": len(messages),
        "messages": messages
    }


@router.put("/conversations/{conv_id}", response_model=ConversationResponse)
def update_conversation(
    conv_id: int,
    conv_data: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộc trò chuyện ID {conv_id}"
        )
    
    if conv_data.title:
        conversation.title = conv_data.title
    
    db.commit()
    db.refresh(conversation)
    
    msg_count = db.query(Message).filter(Message.conversation_id == conv_id).count()
    
    return {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "message_count": msg_count
    }


@router.delete("/conversations/{conv_id}", response_model=dict)
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộc trò chuyện ID {conv_id}"
        )
    
    db.delete(conversation)
    db.commit()
    
    return {"success": True, "message": "Đã xóa cuộc trò chuyện"}


@router.put("/messages/{message_id}/rating", response_model=MessageResponse)
def update_message_rating(
    message_id: int,
    rating_data: MessageRatingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Join with Conversation to ensure message belongs to the current user
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


@router.post("/send", response_model=ChatResponse)
def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get or create conversation
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy cuộc trò chuyện ID {request.conversation_id}"
            )
    else:
        # Create new conversation
        conversation = Conversation(
            user_id=current_user.id,
            title=request.message[:50] + "..." if len(request.message) > 50 else request.message
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Save user message
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    db.commit()
    user_message_id = user_message.id
    
    # Get accessible role IDs for RAG filtering
    accessible_role_ids = get_accessible_role_ids(current_user)
    print(f"DEBUG: User {current_user.username} accessible_role_ids: {accessible_role_ids}")
    
    # Get conversation history
    history = db.query(Message).filter(
        Message.conversation_id == conversation.id
    ).order_by(Message.created_at.asc()).all()
    
    # Generate RAG response
    try:
        rag_service = RAGService()
        response_data = rag_service.generate_response(
            query=request.message,
            conversation_history=history,
            accessible_role_ids=accessible_role_ids,
            db=db,
            response_style=request.response_style,
            requested_max_tokens=request.max_tokens,
            show_sources=request.show_sources
        )
        
        # Save assistant message
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=response_data.get("answer", response_data["response"])
        )
        db.add(assistant_message)
        db.commit()
        assistant_message_id = assistant_message.id
        
        # Update conversation timestamp
        conversation.updated_at = db.query(Message).filter(
            Message.id == assistant_message.id
        ).first().created_at
        db.commit()
        
        return {
            "response": response_data["response"],
            "answer": response_data.get("answer", response_data["response"]),
            "conversation_id": conversation.id,
            "sources": response_data.get("sources", []),
            "citations": response_data.get("citations", response_data.get("sources", [])),
            "user_message_id": user_message_id,
            "assistant_message_id": assistant_message_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tạo phản hồi: {str(e)}"
        )
