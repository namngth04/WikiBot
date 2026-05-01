from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta
import json

from app.core.database import get_db
from app.models.models import User, Message, Document, FAQ, Conversation
from app.schemas.schemas import (
    DashboardStats, UsageStats, FAQResponse, FAQCreate, FAQUpdate, 
    SuggestedFAQ, SuccessResponse
)
from app.routers.auth import get_current_admin
from app.services.rag_service import RAGService
from app.services.faq_clustering import (
    cluster_similar_questions_with_ai,
    get_suggested_faqs_rule_based
)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

# Simple in-memory cache for suggested FAQs (24 hours)
_suggested_faqs_cache = {
    "data": None,
    "timestamp": None,
    "cache_duration": 86400  # 24 hours in seconds
}

@router.get("/stats/overview", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    total_users = db.query(User).count()
    total_messages = db.query(Message).count()
    total_documents = db.query(Document).count()
    
    # Calculate avg rating
    avg_rating_query = db.query(func.avg(Message.rating)).filter(Message.rating.isnot(None)).scalar()
    avg_rating = float(avg_rating_query) if avg_rating_query else 0.0
    
    # Feedback ratio
    likes = db.query(Message).filter(Message.rating == 1).count()
    dislikes = db.query(Message).filter(Message.rating == -1).count()
    no_rating = db.query(Message).filter(Message.role == "assistant", Message.rating.is_(None)).count()
    
    return {
        "total_users": total_users,
        "total_messages": total_messages,
        "total_documents": total_documents,
        "avg_rating": round(avg_rating, 2),
        "feedback_ratio": {
            "like": likes,
            "dislike": dislikes,
            "none": no_rating
        }
    }

@router.get("/stats/usage", response_model=List[UsageStats])
def get_usage_stats(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Group by date
    stats = db.query(
        func.date(Message.created_at).label("date"),
        func.count(Message.id).label("count")
    ).filter(
        Message.created_at >= start_date,
        Message.role == "user"
    ).group_by(
        func.date(Message.created_at)
    ).order_by("date").all()
    
    return [{"date": str(s.date), "count": int(s.count)} for s in stats]

# ============== FAQ Management ==============

@router.get("/faqs", response_model=List[FAQResponse])
def list_faqs(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(FAQ)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            FAQ.question.ilike(search_term) | FAQ.answer.ilike(search_term)
        )
    
    return query.order_by(desc(FAQ.created_at)).offset(skip).limit(limit).all()

@router.post("/faqs", response_model=FAQResponse)
def create_faq(
    faq_data: FAQCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    new_faq = FAQ(**faq_data.dict())
    db.add(new_faq)
    db.commit()
    db.refresh(new_faq)
    return new_faq

@router.put("/faqs/{faq_id}", response_model=FAQResponse)
def update_faq(
    faq_id: int,
    faq_data: FAQUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    
    for key, value in faq_data.dict(exclude_unset=True).items():
        setattr(faq, key, value)
    
    db.commit()
    db.refresh(faq)
    return faq

@router.delete("/faqs/{faq_id}", response_model=SuccessResponse)
def delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    faq = db.query(FAQ).filter(FAQ.id == faq_id).first()
    if not faq:
        raise HTTPException(status_code=404, detail="FAQ not found")
    
    db.delete(faq)
    db.commit()
    return {"success": True, "message": "FAQ deleted successfully"}

@router.get("/faqs/suggested", response_model=List[SuggestedFAQ])
def get_suggested_faqs(
    limit: int = 10,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    global _suggested_faqs_cache
    current_time = datetime.utcnow().timestamp()
    
    # Check cache
    if (not force_refresh and 
        _suggested_faqs_cache["data"] is not None and
        _suggested_faqs_cache["timestamp"] is not None and
        (current_time - _suggested_faqs_cache["timestamp"]) < _suggested_faqs_cache["cache_duration"]):
        return _suggested_faqs_cache["data"]
    
    # Generate new suggestions with AI clustering
    try:
        clusters = cluster_similar_questions_with_ai(db, limit)
        
        # Convert to SuggestedFAQ format
        result = [
            SuggestedFAQ(
                question=cluster["canonical"],
                occurrence=cluster["total_occurrences"]
            )
            for cluster in clusters
        ]
        
        # Update cache
        _suggested_faqs_cache["data"] = result
        _suggested_faqs_cache["timestamp"] = current_time
        
        return result
        
    except Exception as e:
        print(f"Error in AI clustering, falling back to rule-based: {e}")
        # Fallback to rule-based
        try:
            clusters = get_suggested_faqs_rule_based(db, limit)
            result = [
                SuggestedFAQ(
                    question=cluster["canonical"],
                    occurrence=cluster["total_occurrences"]
                )
                for cluster in clusters
            ]
            
            # Update cache with fallback results
            _suggested_faqs_cache["data"] = result
            _suggested_faqs_cache["timestamp"] = current_time
            
            return result
        except Exception as fallback_error:
            print(f"Error in fallback: {fallback_error}")
            raise HTTPException(status_code=500, detail="Failed to get suggested FAQs")

@router.post("/faqs/suggested/refresh", response_model=List[SuggestedFAQ])
def refresh_suggested_faqs(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Force refresh suggested FAQs by calling AI clustering again"""
    return get_suggested_faqs(limit=limit, force_refresh=True, db=db, current_admin=current_admin)

@router.post("/faqs/generate-draft", response_model=SuggestedFAQ)
def generate_faq_draft(
    question: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    rag_service = RAGService()
    # Use RAG to get context and generate a professional answer
    # This is a simplified version of the logic
    try:
        # Get context from documents
        chunks = rag_service.document_processor.search_similar(question, accessible_role_ids=[0], top_k=3)
        if not chunks:
            return SuggestedFAQ(question=question, occurrence=1, suggested_answer="Không tìm thấy tài liệu liên quan để soạn câu trả lời.")
        
        context = "\n".join([c['content'] for c in chunks])
        prompt = f"""Dựa trên tài liệu sau đây, hãy viết một câu trả lời FAQ chuyên nghiệp, ngắn gọn cho câu hỏi của người dùng.
Tài liệu: {context}
Câu hỏi: {question}
Câu trả lời FAQ:"""
        
        # We need a method in RAGService that just generates text without the full chat logic
        # For now, we'll assume a simplified call to the LLM
        response = rag_service.llm(
            prompt,
            max_tokens=256,
            temperature=0.2,
            stop=["\n\n", "Người dùng:", "Trợ lý:"],
            echo=False
        )
        answer = response['choices'][0]['text'].strip()
        
        return SuggestedFAQ(question=question, occurrence=1, suggested_answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi soạn thảo AI: {str(e)}")
