from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import tempfile
import os

from app.core.database import get_db
from app.models.models import User, Conversation, Message
from app.schemas.schemas import (
    ConversationCreate, ConversationUpdate, ConversationResponse,
    ConversationDetailResponse, MessageResponse, ChatRequest, ChatResponse,
    MessageRatingUpdate, FeedbackCreate
)
from app.routers.auth import get_current_user
from app.routers.documents import get_accessible_role_ids
from app.services.response_generator import ResponseGenerator
from app.models.models import UserAISettings, AISafetyConfig
from app.services.export_service import ExportService
from app.services.agent.agent_graph import compile_agentic_rag_graph

agentic_graph = compile_agentic_rag_graph()

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


@router.post("/messages/{message_id}/feedback", response_model=MessageResponse)
def create_message_feedback(
    message_id: int,
    feedback_data: FeedbackCreate,
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
    
    message.rating = feedback_data.rating
    message.feedback_category = feedback_data.feedback_category
    message.feedback_text = feedback_data.feedback_text
    db.commit()
    db.refresh(message)
    
    return message



@router.post("/send", response_model=ChatResponse)
def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Chặn Superadmin hệ thống sử dụng tính năng Chat
    if current_user.role and current_user.role.level == 0 and current_user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản Superadmin hệ thống không có quyền sử dụng tính năng Chat."
        )

    # Quota Guard for Free Tier (Personal User) - Exempt system admin
    is_admin = current_user.role and current_user.role.level == 0
    if not is_admin and current_user.subscription_tier == "free" and current_user.tenant_id is None:
        from datetime import datetime, time as datetime_time
        today = datetime.utcnow().date()
        start_of_today = datetime.combine(today, datetime_time.min)
        
        questions_used = db.query(Message).join(Conversation).filter(
            Conversation.user_id == current_user.id,
            Message.role == "user",
            Message.created_at >= start_of_today
        ).count()
        
        if questions_used >= 10:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn đã sử dụng hết hạn ngạch 10 câu hỏi/ngày của gói Free. Vui lòng nâng cấp lên gói Pro để tiếp tục trò chuyện không giới hạn."
            )

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
        
        # Tự động cập nhật tiêu đề nếu vẫn đang giữ tên mặc định
        if conversation.title == "Cuộc trò chuyện mới":
            conversation.title = request.message[:50] + "..." if len(request.message) > 50 else request.message
            db.commit()
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
    
    # Get AI settings (User settings or Tenant settings)
    is_staff = current_user.user_type == "employee"
    
    if is_staff:
        from app.models.models import TenantAISettings
        tenant_settings = db.query(TenantAISettings).filter(
            TenantAISettings.tenant_id == current_user.tenant_id
        ).first()
        
        if not tenant_settings:
            # Tự động tạo cấu hình Tenant mặc định
            tenant_settings = TenantAISettings(
                tenant_id=current_user.tenant_id,
                temperature=0.2,
                response_style="concise",
                show_sources=True,
                preferred_max_tokens=512,
                ollama_endpoint="http://localhost:11434"
            )
            db.add(tenant_settings)
            db.commit()
            db.refresh(tenant_settings)
            
        # Ánh xạ thành object tương đương để tương thích ngược với code bên dưới
        class UnifiedSettings:
            pass
        user_settings = UnifiedSettings()
        user_settings.temperature = tenant_settings.temperature
        user_settings.response_style = tenant_settings.response_style
        user_settings.show_sources = tenant_settings.show_sources
        user_settings.preferred_max_tokens = tenant_settings.preferred_max_tokens
        user_settings.receive_community_knowledge = False
    else:
        user_settings = db.query(UserAISettings).filter(
            UserAISettings.user_id == current_user.id
        ).first()
        
        if not user_settings:
            # Create default settings
            safety_config = db.query(AISafetyConfig).first()
            user_settings = UserAISettings(
                user_id=current_user.id,
                temperature=safety_config.default_temperature if safety_config else 0.2,
                response_style=safety_config.default_response_style if safety_config else "concise",
                show_sources=True,
                preferred_max_tokens=512
            )
            db.add(user_settings)
            db.commit()
            db.refresh(user_settings)

    
    # Get safety limits
    safety_config = db.query(AISafetyConfig).first()
    
    # Merge settings: user_settings -> request_override -> safety_limits
    final_response_style = request.response_style or user_settings.response_style
    final_show_sources = request.show_sources if request.show_sources is not None else user_settings.show_sources
    
    # Apply safety limits to max_tokens
    requested_max = request.max_tokens or user_settings.preferred_max_tokens
    if safety_config:
        final_max_tokens = min(requested_max, safety_config.max_tokens_limit)
    else:
        final_max_tokens = min(requested_max, 2048)
    
    # Generate RAG response using Agentic RAG (LangGraph)
    try:
        # Get receive_community_knowledge from user settings
        receive_community = user_settings.receive_community_knowledge if user_settings else False
        
        # Prepare graph state
        initial_state = {
            "query": request.message,
            "original_query": request.message,
            "conversation_history": [{"role": m.role, "content": m.content} for m in history],
            "accessible_role_ids": accessible_role_ids,
            "current_user_id": current_user.id,
            "current_user_type": current_user.user_type,
            "current_user_tenant_id": current_user.tenant_id,
            "receive_community": receive_community,
            "response_style": final_response_style,
            "max_tokens": final_max_tokens,
            "db": db,
            "documents": [],
            "relevant_documents": [],
            "generation": "",
            "confidence": {"overall": 0.5, "level": "medium"},
            "rewrite_count": 0,
            "needs_rewrite": False,
            "steps": [],
            "suggested_questions": []
        }
        
        # Invoke LangGraph
        result_state = agentic_graph.invoke(initial_state)
        
        # Formulate response_data to match response schemas
        sources_data = [
            {
                "chunk_index": c["metadata"].get("chunk_index"),
                "source": c["metadata"].get("source"),
                "page_number": c["metadata"].get("page_number"),
                "content": c["content"]
            }
            for c in result_state.get("relevant_documents", [])
        ]
        
        # Save assistant message
        used_chunk_ids = [s.get("chunk_index") for s in sources_data if s.get("chunk_index")]
            
        assistant_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=result_state["generation"],
            used_chunks=used_chunk_ids
        )
        db.add(assistant_message)
        db.commit()
        assistant_message_id = assistant_message.id
        
        # Update conversation timestamp
        conversation.updated_at = db.query(Message).filter(
            Message.id == assistant_message.id
        ).first().created_at
        db.commit()
        
        # Validate required IDs before returning
        if not user_message_id or not assistant_message_id:
            raise ValueError("Failed to generate message IDs")
        
        suggested_questions = result_state.get("suggested_questions", [])
        
        return {
            "success": True,
            "response": result_state["generation"],
            "answer": result_state["generation"],
            "conversation_id": conversation.id,
            "sources": sources_data,
            "citations": sources_data,
            "confidence": result_state.get("confidence", {"overall": 0.5, "level": "medium"}),
            "query_processing": {
                "original_query": request.message,
                "refined_query": result_state["query"],
                "rewrite_count": result_state.get("rewrite_count", 0),
                "steps": result_state.get("steps", [])
            },
            "retrieval_stats": {
                "total_retrieved": len(result_state.get("documents", [])),
                "relevant_retrieved": len(result_state.get("relevant_documents", []))
            },
            "user_message_id": user_message_id,
            "assistant_message_id": assistant_message_id,
            "suggested_questions": suggested_questions
        }
        
    except Exception as e:
        # Rollback any database changes
        db.rollback()
        
        # Log the error for debugging
        import logging
        logging.error(f"Error in send_message: {str(e)}", exc_info=True)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error": f"Lỗi khi tạo phản hồi: {str(e)}",
                "user_message_id": None,
                "assistant_message_id": None,
                "response": None
            }
        )


@router.get("/conversations/{conv_id}/export/{export_format}")
def export_conversation(
    conv_id: int,
    export_format: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exports conversation history into Word (docx), Markdown (md), or text (txt).
    Enforces user data privacy, only allows export of owned conversations.
    """
    # 1. Check conversation exists and belongs to current user
    conversation = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy cuộc trò chuyện ID {conv_id}"
        )
        
    # 2. Get messages in chronological order
    messages = db.query(Message).filter(
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.asc()).all()
    
    messages_list = [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]
    
    if not messages_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cuộc trò chuyện này chưa có tin nhắn nào để xuất"
        )
        
    # Normalize title for safe filename
    safe_title = "".join([c for c in conversation.title if c.isalnum() or c in (' ', '_', '-')]).rstrip()
    safe_title = safe_title.replace(' ', '_')
    if not safe_title:
        safe_title = f"Hoi_thoai_{conv_id}"
        
    temp_dir = tempfile.gettempdir()
    
    headers = {}
    is_new_file = False
    
    # 3. Handle export format logic
    if export_format == "txt":
        filename = f"{safe_title}.txt"
        temp_file_path = os.path.join(temp_dir, filename)
        content = ExportService.export_to_txt(conversation.title, messages_list)
        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(content)
        media_type = "text/plain"
        
    elif export_format == "md":
        filename = f"{safe_title}.md"
        temp_file_path = os.path.join(temp_dir, filename)
        content = ExportService.export_to_markdown(conversation.title, messages_list)
        with open(temp_file_path, "w", encoding="utf-8") as f:
            f.write(content)
        media_type = "text/markdown"
        
    elif export_format == "docx":
        filename = f"{safe_title}.docx"
        temp_file_path = os.path.join(temp_dir, filename)
        
        username = current_user.full_name or current_user.username
        
        final_path, is_new_file = ExportService.export_to_docx(
            conversation.title,
            messages_list,
            username,
            temp_file_path
        )
        
        temp_file_path = final_path
        filename = os.path.basename(final_path)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        headers["X-Export-New-File"] = "true" if is_new_file else "false"
        
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng '{export_format}' không được hỗ trợ. Chỉ hỗ trợ 'docx', 'md', 'txt'."
        )
        
    # Schedule temp file removal to free disk space
    background_tasks.add_task(os.remove, temp_file_path)
    
    # Expose custom headers so that Next.js / Axios can read it
    headers["Access-Control-Expose-Headers"] = "Content-Disposition, X-Export-New-File"
    
    return FileResponse(
        temp_file_path,
        media_type=media_type,
        filename=filename,
        headers=headers
    )
