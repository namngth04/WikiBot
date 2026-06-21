import re
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models.models import Message, FAQ
from app.services.response_generator import ResponseGenerator


def normalize_vietnamese_text(text: str) -> str:
    """Chuẩn hóa văn bản tiếng Việt cơ bản"""
    # Chuyển về chữ thường
    text = text.lower().strip()
    
    # Loại bỏ khoảng trắng thừa
    text = re.sub(r'\s+', ' ', text)
    
    # Loại bỏ dấu câu thừa ở đầu/cuối
    text = text.strip('.,!?;:')
    
    return text


def create_spelling_dict() -> Dict[str, str]:
    """Dictionary mapping lỗi chính tả phổ biến → đúng"""
    return {
        "xin chao": "xin chào",
        "cam on": "cảm ơn", 
        "nhin vien": "nhân viên",
        "ngay nghi": "ngày nghỉ",
        "chinh sach": "chính sách",
        "luong": "lương",
        "thuong": "thưởng",
        "tai sao": "tại sao",
        "lam sao": "làm sao",
        "bao nhieu": "bao nhiêu",
        "muc luong": "mức lương",
        "ngay phep": "ngày phép",
        "thue thu nhap": "thuế thu nhập",
        "bao hiem": "bảo hiểm",
        "thoi gian": "thời gian",
        "dinh kem": "đính kèm",
        "gui den": "gửi đến",
        "nhan duoc": "nhận được",
    }


def correct_spelling(text: str) -> str:
    """Sửa lỗi chính tả phổ biến"""
    spelling_dict = create_spelling_dict()
    normalized = normalize_vietnamese_text(text)
    
    # Thay thế từng lỗi chính tả
    for wrong, correct in spelling_dict.items():
        if wrong in normalized:
            normalized = normalized.replace(wrong, correct)
    
    return normalized


def cluster_similar_questions_with_ai(db: Session, limit: int = 10, tenant_id: Optional[int] = None) -> List[Dict]:
    """
    Sử dụng AI để phân loại các câu hỏi tương tự
    Trả về list của các clusters với canonical question và variants
    """
    try:
        from app.models.models import Conversation, User

        # Lấy tất cả user questions của tenant/cá nhân tương ứng chưa có trong FAQ
        existing_query = db.query(FAQ.question)
        if tenant_id is not None:
            existing_query = existing_query.filter(FAQ.tenant_id == tenant_id)
        else:
            existing_query = existing_query.filter(FAQ.tenant_id.is_(None))
        existing_questions = existing_query.all()
        existing_questions = [q[0] for q in existing_questions]
        
        user_questions_query = db.query(
            Message.content.label("question"),
            func.count(Message.id).label("occurrence")
        ).join(
            Conversation, Message.conversation_id == Conversation.id
        ).join(
            User, Conversation.user_id == User.id
        ).filter(
            Message.role == "user",
            ~Message.content.in_(existing_questions)
        )
        
        if tenant_id is not None:
            user_questions_query = user_questions_query.filter(User.tenant_id == tenant_id)
        else:
            user_questions_query = user_questions_query.filter(User.tenant_id.is_(None))
            
        user_questions = user_questions_query.group_by(
            Message.content
        ).order_by(
            func.count(Message.id).desc()
        ).limit(50).all()  # Lấy top 50 để AI phân tích
        
        if not user_questions:
            return []
        
        # Chuẩn hóa và nhóm bằng rule-based trước (hybrid approach)
        question_groups = {}
        for q in user_questions:
            normalized = correct_spelling(q.question)
            if normalized not in question_groups:
                question_groups[normalized] = {
                    "canonical": q.question,  # Giữ nguyên câu hỏi gốc
                    "variants": [q.question],
                    "total_occurrences": q.occurrence
                }
            else:
                question_groups[normalized]["variants"].append(q.question)
                question_groups[normalized]["total_occurrences"] += q.occurrence
        
        # Nếu có nhiều câu hỏi, dùng AI để phân loại phức tạp hơn
        if len(question_groups) > 5:
            try:
                from app.models.models import ChatModel
                from sqlalchemy import or_
                
                active_model = db.query(ChatModel).filter(
                    ChatModel.is_active == True,
                    or_(
                        ChatModel.tenant_id == tenant_id,
                        ChatModel.is_global == True
                    )
                ).order_by(
                    ChatModel.tenant_id.desc(),
                    ChatModel.created_at.desc()
                ).first()
                
                if active_model:
                    response_generator = ResponseGenerator(db=db, model_id=active_model.id)
                else:
                    response_generator = ResponseGenerator(db=db)
                    
                questions_text = "\n".join([f"- {q}" for q in question_groups.keys()])
                
                prompt = f"""Phân tích các câu hỏi sau và nhóm những câu hỏi có cùng ý nghĩa:
{questions_text}
 
Trả về JSON format với danh sách các nhóm, mỗi nhóm có:
- canonical: câu hỏi chuẩn đẹp nhất
- variants: danh sách các câu hỏi tương tự
- total_occurrences: tổng số lượt

JSON format:
{{
  "clusters": [
    {{
      "canonical": "câu hỏi chuẩn",
      "variants": ["câu hỏi 1", "câu hỏi 2"],
      "total_occurrences": 5
    }}
  ]
}}"""
                
                response_text = response_generator.llm_provider.generate(
                    prompt,
                    max_tokens=512,
                    temperature=0.2
                )
                
                # Parse AI response
                ai_text = response_text.strip()
                if "clusters" in ai_text:
                    ai_result = json.loads(ai_text)
                    ai_clusters = ai_result.get("clusters", [])
                    
                    # Map back to original questions
                    final_clusters = []
                    for cluster in ai_clusters[:limit]:
                        # Find matching original questions
                        matched_variants = []
                        total_occ = 0
                        for norm_q, data in question_groups.items():
                            if any(v in cluster["variants"] for v in data["variants"]):
                                matched_variants.extend(data["variants"])
                                total_occ += data["total_occurrences"]
                        
                        if matched_variants:
                            final_clusters.append({
                                "canonical": cluster["canonical"],
                                "variants": matched_variants,
                                "total_occurrences": total_occ
                            })
                    
                    if final_clusters:
                        return final_clusters[:limit]
            except Exception as ai_error:
                print(f"AI clustering failed, using rule-based: {ai_error}")
        
        # Fallback to rule-based
        sorted_groups = sorted(
            question_groups.values(),
            key=lambda x: x["total_occurrences"],
            reverse=True
        )[:limit]
        
        return sorted_groups
        
    except Exception as e:
        print(f"Error in AI clustering: {e}")
        raise e


def get_suggested_faqs_rule_based(db: Session, limit: int = 10, tenant_id: Optional[int] = None) -> List[Dict]:
    """
    Fallback: Rule-based grouping khi AI không available
    """
    from app.models.models import Conversation, User

    existing_query = db.query(FAQ.question)
    if tenant_id is not None:
        existing_query = existing_query.filter(FAQ.tenant_id == tenant_id)
    else:
        existing_query = existing_query.filter(FAQ.tenant_id.is_(None))
    existing_questions = existing_query.all()
    existing_questions = [q[0] for q in existing_questions]
    
    suggested_query = db.query(
        Message.content.label("question"),
        func.count(Message.id).label("occurrence")
    ).join(
        Conversation, Message.conversation_id == Conversation.id
    ).join(
        User, Conversation.user_id == User.id
    ).filter(
        Message.role == "user",
        ~Message.content.in_(existing_questions)
    )
    
    if tenant_id is not None:
        suggested_query = suggested_query.filter(User.tenant_id == tenant_id)
    else:
        suggested_query = suggested_query.filter(User.tenant_id.is_(None))
        
    suggested = suggested_query.group_by(
        Message.content
    ).order_by(
        desc("occurrence")
    ).limit(limit).all()
    
    return [
        {
            "canonical": s.question,
            "variants": [s.question],
            "total_occurrences": s.occurrence
        }
        for s in suggested
    ]
