from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import tempfile
import os
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

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






@router.post("/send-stream")
async def send_message_stream(
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

    # Quota Guard for Free Tier (Personal & Corporate) - Exempt system admin
    is_admin = current_user.role and current_user.role.level == 0
    if not is_admin:
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        questions_used = cache_service.get_user_quota_used(current_user.id, current_user.tenant_id)
        
        if current_user.tenant_id is not None:
            company_admin = db.query(User).filter(
                User.tenant_id == current_user.tenant_id,
                User.role.has(level=1)
            ).first()
            is_free = (company_admin.subscription_tier == "free") if company_admin else True
            
            if is_free and questions_used >= 10:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Doanh nghiệp của bạn đã sử dụng hết hạn ngạch 10 câu hỏi/ngày của gói Free. Vui lòng liên hệ Admin doanh nghiệp nâng cấp lên gói Pro để tiếp tục sử dụng không giới hạn."
                )
        else:
            if current_user.subscription_tier == "free" and questions_used >= 10:
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
    
    # Merge settings
    final_response_style = request.response_style or user_settings.response_style
    
    # Apply safety limits to max_tokens
    requested_max = request.max_tokens or user_settings.preferred_max_tokens
    if safety_config:
        final_max_tokens = min(requested_max, safety_config.max_tokens_limit)
    else:
        final_max_tokens = min(requested_max, 2048)
        
    receive_community = user_settings.receive_community_knowledge if user_settings else False
    
    # 1. Khởi tạo ResponseGenerator để kiểm tra FAQ trước tiên
    from app.services.response_generator import ResponseGenerator
    response_gen = ResponseGenerator(db=db, model_id=request.model_id)

    # 1.1. Check FAQ first (Độ ưu tiên cao nhất, tránh gọi LLM)
    faq = response_gen.check_faqs(request.message)
    if faq:
        async def faq_stream_generator():
            try:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=faq.answer,
                    used_chunks=[]
                )
                db.add(assistant_message)
                db.commit()
                assistant_message_id = assistant_message.id
                
                conversation.updated_at = assistant_message.created_at
                db.commit()
                
                # Stream mượt mà
                words = faq.answer.split(" ")
                for i, word in enumerate(words):
                    space = " " if i > 0 else ""
                    yield f"data: {json.dumps({'type': 'token', 'content': space + word})}\n\n"
                    await asyncio.sleep(0.005)
                    
                # Gửi metadata
                metadata_payload = {
                    'type': 'metadata',
                    'sources': [{"source": "FAQ Hệ thống", "chunk_index": 0, "distance": 0.0}],
                    'citations': [],
                    'confidence': {'overall': 0.95, 'level': 'high'},
                    'suggested_questions': [
                        "Bạn có thể giải thích chi tiết hơn được không?",
                        "Tôi cần làm các bước tiếp theo như thế nào?"
                    ]
                }
                yield f"data: {json.dumps(metadata_payload)}\n\n"
                
                # Gửi final success
                final_payload = {
                    'type': 'final_success',
                    'user_message_id': user_message_id,
                    'assistant_message_id': assistant_message_id,
                    'conversation_id': conversation.id
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
            except Exception as ce:
                db.rollback()
                logger.error(f"Error streaming FAQ: {ce}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(ce)})}\n\n"
                
        return StreamingResponse(faq_stream_generator(), media_type="text/event-stream")

    # 1.2. Check Semantic Cache second (Tránh gọi LLM phân loại intent)
    from app.services.semantic_cache import SemanticCacheService
    cache_service = SemanticCacheService(db)
    cached_response, cached_sources, cached_associated_doc_ids = cache_service.lookup(
        query=request.message,
        response_style=final_response_style,
        threshold=0.95,
        current_user_id=current_user.id,
        current_user_type=current_user.user_type,
        current_user_tenant_id=current_user.tenant_id,
        accessible_role_ids=accessible_role_ids,
        receive_community=receive_community
    )
    
    if cached_response:
        async def cache_stream_generator():
            try:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=cached_response,
                    used_chunks=[]
                )
                db.add(assistant_message)
                db.commit()
                assistant_message_id = assistant_message.id
                
                conversation.updated_at = assistant_message.created_at
                db.commit()
                
                # Stream cache response
                words = cached_response.split(" ")
                for i, word in enumerate(words):
                    space = " " if i > 0 else ""
                    token_payload = {"type": "token", "content": space + word}
                    yield f"data: {json.dumps(token_payload)}\n\n"
                    await asyncio.sleep(0.005)
                    
                # Gửi metadata
                metadata_payload = {
                    "type": "metadata",
                    "sources": cached_sources or [],
                    "citations": cached_sources or [],
                    "confidence": {"overall": 0.99, "level": "high"},
                    "suggested_questions": []
                }
                yield f"data: {json.dumps(metadata_payload)}\n\n"
                
                # Gửi final IDs
                final_payload = {
                    "type": "final_success",
                    "user_message_id": user_message_id,
                    "assistant_message_id": assistant_message_id,
                    "conversation_id": conversation.id
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
            except Exception as ce:
                db.rollback()
                logger.error(f"Error streaming cache response: {ce}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(ce)})}\n\n"
                
        return StreamingResponse(cache_stream_generator(), media_type="text/event-stream")

    # 2. Chỉ khi trượt cả FAQ và Cache, ta mới gọi QueryEnhancer (LLM) để phân loại ý định
    try:
        enhanced = response_gen.query_enhancer.enhance_query(request.message)
    except Exception as e:
        logger.error(f"Error during query enhancement with model {request.model_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi kết nối tới mô hình được chỉ định để phân loại ý định: {str(e)}"
        )
    intent = enhanced.get('intent', 'rag')
    
    # 3. Xử lý Greeting
    if intent == "greeting":
        greeting_text = "Chào bạn! Tôi là WikiBot - Trợ lý trí tuệ nhân tạo chuyên về tài liệu và quy trình nội bộ của doanh nghiệp. Tôi rất sẵn lòng hỗ trợ bạn giải đáp các thắc mắc về quy định nghỉ phép, bảo hiểm, thủ tục hành chính, hoặc các hướng dẫn công việc nội bộ. Hôm nay bạn cần tôi hỗ trợ thông tin gì không?"
        
        async def greeting_stream_generator():
            try:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=greeting_text,
                    used_chunks=[]
                )
                db.add(assistant_message)
                db.commit()
                assistant_message_id = assistant_message.id
                
                conversation.updated_at = assistant_message.created_at
                db.commit()
                
                # Stream mượt mà
                words = greeting_text.split(" ")
                for i, word in enumerate(words):
                    space = " " if i > 0 else ""
                    yield f"data: {json.dumps({'type': 'token', 'content': space + word})}\n\n"
                    await asyncio.sleep(0.005)
                    
                # Gửi metadata
                metadata_payload = {
                    'type': 'metadata',
                    'sources': [],
                    'citations': [],
                    'confidence': {'overall': 1.0, 'level': 'high'},
                    'suggested_questions': [
                        'Quy chế nghỉ phép năm nay cụ thể thế nào?',
                        'Tôi có thể xem tài liệu bảo hiểm ở đâu?',
                        'Tôi cần làm các bước tiếp theo như thế nào?'
                    ]
                }
                yield f"data: {json.dumps(metadata_payload)}\n\n"
                
                # Gửi final success
                final_payload = {
                    'type': 'final_success',
                    'user_message_id': user_message_id,
                    'assistant_message_id': assistant_message_id,
                    'conversation_id': conversation.id
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
            except Exception as ce:
                db.rollback()
                logger.error(f"Error streaming greeting: {ce}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(ce)})}\n\n"
                
        return StreamingResponse(greeting_stream_generator(), media_type="text/event-stream")
        
    # 4. Xử lý Out of Domain
    if intent == "out_of_domain":
        ood_text = "Xin lỗi bạn, tôi là trợ lý AI được thiết kế chuyên biệt để tra cứu tài liệu nội bộ công ty và hiện tại không có kết nối internet thời gian thực để cập nhật các thông tin ngoài lề như thời tiết, giá vàng hay tin tức thời sự. Bạn vui lòng đặt câu hỏi liên quan đến chính sách, quy trình hoặc tài liệu công việc của doanh nghiệp để tôi hỗ trợ tốt nhất nhé!"
        
        async def ood_stream_generator():
            try:
                assistant_message = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=ood_text,
                    used_chunks=[]
                )
                db.add(assistant_message)
                db.commit()
                assistant_message_id = assistant_message.id
                
                conversation.updated_at = assistant_message.created_at
                db.commit()
                
                # Stream mượt mà
                words = ood_text.split(" ")
                for i, word in enumerate(words):
                    space = " " if i > 0 else ""
                    yield f"data: {json.dumps({'type': 'token', 'content': space + word})}\n\n"
                    await asyncio.sleep(0.005)
                    
                # Gửi metadata
                metadata_payload = {
                    'type': 'metadata',
                    'sources': [],
                    'citations': [],
                    'confidence': {'overall': 0.0, 'level': 'low'},
                    'suggested_questions': [
                        'Quy định nghỉ phép năm nay như thế nào?',
                        'Tôi có thể xem các tài liệu công việc nội bộ nào?',
                        'Hướng dẫn sử dụng hệ thống WikiBot'
                    ]
                }
                yield f"data: {json.dumps(metadata_payload)}\n\n"
                
                # Gửi final success
                final_payload = {
                    'type': 'final_success',
                    'user_message_id': user_message_id,
                    'assistant_message_id': assistant_message_id,
                    'conversation_id': conversation.id
                }
                yield f"data: {json.dumps(final_payload)}\n\n"
            except Exception as ce:
                db.rollback()
                logger.error(f"Error streaming OOD: {ce}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(ce)})}\n\n"
                
        return StreamingResponse(ood_stream_generator(), media_type="text/event-stream")

    # Run Agentic RAG SSE Stream
    queue = asyncio.Queue()
    
    # Tạo một session DB mới, độc lập hoàn toàn dành riêng cho background thread của LangGraph
    from app.core.database import SessionLocal
    graph_db = SessionLocal()
    
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
        "db": graph_db,  # Sử dụng session phụ đã tách biệt
        "model_id": request.model_id,
        "stream_queue": queue,
        "is_complex": enhanced.get("is_complex", False),

        "loop": asyncio.get_running_loop(),  # Chia sẻ event loop thread chính với background thread
        "documents": [],
        "relevant_documents": [],
        "generation": "",
        "confidence": {"overall": 0.5, "level": "medium"},
        "rewrite_count": 0,
        "needs_rewrite": False,
        "steps": [],
        "suggested_questions": []
    }
    
    async def event_generator():
        task = asyncio.create_task(asyncio.to_thread(agentic_graph.invoke, initial_state))
        
        assistant_content = ""
        metadata_received = None
        
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                    
                if event.get("type") == "token":
                    assistant_content += event.get("content", "")
                    yield f"data: {json.dumps(event)}\n\n"
                elif event.get("type") == "metadata":
                    metadata_received = event
                    yield f"data: {json.dumps(event)}\n\n"
                elif event.get("type") == "error":
                    yield f"data: {json.dumps(event)}\n\n"
                    raise Exception(event.get("content"))
            
            result_state = await task
            
            sources_data = metadata_received.get("sources", []) if metadata_received else []
            used_chunk_ids = [s.get("chunk_index") for s in sources_data if s.get("chunk_index")]
            
            # Sử dụng session chính 'db' của request thread để lưu tin nhắn trợ lý an toàn tuyệt đối
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=result_state.get("generation", assistant_content),
                used_chunks=used_chunk_ids
            )
            db.add(assistant_message)
            db.commit()
            assistant_message_id = assistant_message.id
            
            conversation.updated_at = db.query(Message).filter(
                Message.id == assistant_message_id
            ).first().created_at
            db.commit()
            
            # Store in Semantic Cache
            associated_doc_ids = []
            for c in result_state.get("relevant_documents", []):
                doc_id = c.get("metadata", {}).get("document_id") or c.get("metadata", {}).get("id")
                if doc_id and doc_id not in associated_doc_ids:
                    associated_doc_ids.append(int(doc_id))
                    
            if assistant_content and associated_doc_ids:
                cache_service.store(
                    query=request.message,
                    response=assistant_content,
                    associated_document_ids=associated_doc_ids,
                    response_style=final_response_style,
                    sources=sources_data
                )
            
            # Tăng quota đã dùng hôm nay trên Redis
            cache_service.increment_user_quota(current_user.id, current_user.tenant_id)
                
            final_payload = {
                "type": "final_success",
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message_id,
                "conversation_id": conversation.id
            }
            yield f"data: {json.dumps(final_payload)}\n\n"
            
        except asyncio.CancelledError:
            db.rollback()
            graph_db.rollback()
            if 'logger' in globals():
                logger.info("Client disconnected, stream cancelled.")
            return
        except Exception as stream_err:
            db.rollback()
            graph_db.rollback()  # Rollback cả session phụ nếu có lỗi xảy ra
            if 'logger' in globals():
                logger.error(f"Error in SSE stream generator: {stream_err}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': f'Lỗi stream: {str(stream_err)}'})}\n\n"
        finally:
            # Bắt buộc đóng session phụ để giải phóng kết nối về Connection Pool của Postgres
            graph_db.close()
            if 'logger' in globals():
                logger.debug("[Database] Closed graph_db session for LangGraph thread.")
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

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

    # Quota Guard for Free Tier (Personal & Corporate) - Exempt system admin
    is_admin = current_user.role and current_user.role.level == 0
    if not is_admin:
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        questions_used = cache_service.get_user_quota_used(current_user.id, current_user.tenant_id)
        
        if current_user.tenant_id is not None:
            company_admin = db.query(User).filter(
                User.tenant_id == current_user.tenant_id,
                User.role.has(level=1)
            ).first()
            is_free = (company_admin.subscription_tier == "free") if company_admin else True
            
            if is_free and questions_used >= 10:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Doanh nghiệp của bạn đã sử dụng hết hạn ngạch 10 câu hỏi/ngày của gói Free. Vui lòng liên hệ Admin doanh nghiệp nâng cấp lên gói Pro để tiếp tục sử dụng không giới hạn."
                )
        else:
            if current_user.subscription_tier == "free" and questions_used >= 10:
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
        # 1. Khởi tạo ResponseGenerator để kiểm tra FAQ trước tiên
        from app.services.response_generator import ResponseGenerator
        response_gen = ResponseGenerator(db=db, model_id=request.model_id)

        # 1.1. Check FAQ first (Độ ưu tiên cao nhất, tránh gọi LLM)
        faq = response_gen.check_faqs(request.message)
        if faq:
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=faq.answer,
                used_chunks=[]
            )
            db.add(assistant_message)
            db.commit()
            assistant_message_id = assistant_message.id
            
            conversation.updated_at = assistant_message.created_at
            db.commit()
            
            return {
                "success": True,
                "response": faq.answer,
                "answer": faq.answer,
                "conversation_id": conversation.id,
                "sources": [{"source": "FAQ Hệ thống", "chunk_index": 0, "distance": 0.0}],
                "citations": [{"source": "FAQ Hệ thống", "chunk_index": 0, "distance": 0.0}],
                "confidence": {"overall": 0.95, "level": "high"},
                "query_processing": enhanced,
                "retrieval_stats": {"total_retrieved": 0, "relevant_retrieved": 0, "cached": False, "faq": True},
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message_id,
                "suggested_questions": [
                    "Bạn có thể giải thích chi tiết hơn được không?",
                    "Tôi cần làm các bước tiếp theo như thế nào?"
                ]
            }

        # 1.2. Check Semantic Cache second with secure dynamic RBAC filters (Tránh gọi LLM phân loại)
        from app.services.semantic_cache import SemanticCacheService
        cache_service = SemanticCacheService(db)
        
        # We query the cache with a 0.95 similarity threshold
        cached_response, cached_sources, cached_associated_doc_ids = cache_service.lookup(
            query=request.message,
            response_style=final_response_style,
            threshold=0.95,
            current_user_id=current_user.id,
            current_user_type=current_user.user_type,
            current_user_tenant_id=current_user.tenant_id,
            accessible_role_ids=accessible_role_ids,
            receive_community=receive_community
        )
        
        if cached_response:
            # Touch / Update hits is already handled by cache_service.lookup
            # Save assistant message immediately
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=cached_response,
                used_chunks=[]  # Cache hit, direct response
            )
            db.add(assistant_message)
            db.commit()
            assistant_message_id = assistant_message.id
            
            # Update conversation timestamp
            conversation.updated_at = assistant_message.created_at
            db.commit()
            
            # Mock confidence and retrieval stats for cached response
            return {
                "success": True,
                "response": cached_response,
                "answer": cached_response,
                "conversation_id": conversation.id,
                "sources": cached_sources or [],
                "citations": cached_sources or [],
                "confidence": {"overall": 0.99, "level": "high"},
                "query_processing": {
                    "original_query": request.message,
                    "refined_query": request.message,
                    "rewrite_count": 0,
                    "steps": ["semantic_cache_hit"]
                },
                "retrieval_stats": {
                    "total_retrieved": len(cached_sources or []),
                    "relevant_retrieved": len(cached_sources or []),
                    "cached": True
                },
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message_id,
                "suggested_questions": []
            }

        # 2. Chỉ khi trượt cả FAQ và Cache, ta mới gọi QueryEnhancer (LLM) để phân loại ý định
        try:
            enhanced = response_gen.query_enhancer.enhance_query(request.message)
        except Exception as e:
            logger.error(f"Error during query enhancement with model {request.model_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi kết nối tới mô hình được chỉ định để phân loại ý định: {str(e)}"
            )
        intent = enhanced.get('intent', 'rag')
        
        # 3. Xử lý Greeting
        if intent == "greeting":
            greeting_text = "Chào bạn! Tôi là WikiBot - Trợ lý trí tuệ nhân tạo chuyên về tài liệu và quy trình nội bộ của doanh nghiệp. Tôi rất sẵn lòng hỗ trợ bạn giải đáp các thắc mắc về quy định nghỉ phép, bảo hiểm, thủ tục hành chính, hoặc các hướng dẫn công việc nội bộ. Hôm nay bạn cần tôi hỗ trợ thông tin gì không?"
            
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=greeting_text,
                used_chunks=[]
            )
            db.add(assistant_message)
            db.commit()
            
            conversation.updated_at = assistant_message.created_at
            db.commit()
            
            return {
                "success": True,
                "response": greeting_text,
                "answer": greeting_text,
                "conversation_id": conversation.id,
                "sources": [],
                "citations": [],
                "confidence": {"overall": 1.0, "level": "high"},
                "query_processing": enhanced,
                "retrieval_stats": {"total_retrieved": 0, "relevant_retrieved": 0},
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message.id,
                "suggested_questions": [
                    "Quy chế nghỉ phép năm nay cụ thể thế nào?",
                    "Tôi có thể xem tài liệu bảo hiểm ở đâu?",
                    "Tôi cần làm các bước tiếp theo như thế nào?"
                ]
            }
            
        # 4. Xử lý Out of Domain
        if intent == "out_of_domain":
            ood_text = "Xin lỗi bạn, tôi là trợ lý AI được thiết kế chuyên biệt để tra cứu tài liệu nội bộ công ty và hiện tại không có kết nối internet thời gian thực để cập nhật các thông tin ngoài lề như thời tiết, giá vàng hay tin tức thời sự. Bạn vui lòng đặt câu hỏi liên quan đến chính sách, quy trình hoặc tài liệu công việc của doanh nghiệp để tôi hỗ trợ tốt nhất nhé!"
            
            assistant_message = Message(
                conversation_id=conversation.id,
                role="assistant",
                content=ood_text,
                used_chunks=[]
            )
            db.add(assistant_message)
            db.commit()
            
            conversation.updated_at = assistant_message.created_at
            db.commit()
            
            return {
                "success": True,
                "response": ood_text,
                "answer": ood_text,
                "conversation_id": conversation.id,
                "sources": [],
                "citations": [],
                "confidence": {"overall": 0.0, "level": "low"},
                "query_processing": enhanced,
                "retrieval_stats": {"total_retrieved": 0, "relevant_retrieved": 0},
                "user_message_id": user_message_id,
                "assistant_message_id": assistant_message.id,
                "suggested_questions": [
                    "Quy định nghỉ phép năm nay như thế nào?",
                    "Tôi có thể xem các tài liệu công việc nội bộ nào?",
                    "Hướng dẫn sử dụng hệ thống WikiBot"
                ]
            }
            
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
            "model_id": request.model_id,
            "documents": [],
            "is_complex": enhanced.get("is_complex", False),

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
        
        # Extract associated document IDs for Semantic Cache
        associated_doc_ids = []
        for c in result_state.get("relevant_documents", []):
            # Extract document_id from the metadata dictionary
            doc_id = c.get("metadata", {}).get("document_id") or c.get("metadata", {}).get("id")
            if doc_id and doc_id not in associated_doc_ids:
                associated_doc_ids.append(int(doc_id))
        
        # Store in Semantic Cache for future identical queries
        if result_state["generation"] and associated_doc_ids:
            cache_service.store(
                query=request.message,
                response=result_state["generation"],
                associated_document_ids=associated_doc_ids,
                response_style=final_response_style,
                sources=sources_data
            )
        
        # Tăng quota đã dùng hôm nay trên Redis
        cache_service.increment_user_quota(current_user.id, current_user.tenant_id)
            
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
