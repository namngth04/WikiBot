import json
from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import Message, Conversation, User
from app.services.response_generator import ResponseGenerator
from app.services.faq_clustering import correct_spelling


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db
        self.response_generator = ResponseGenerator(db=db)

    def get_topic_analytics(self, tenant_id: int, days_limit: int = 7) -> List[Dict]:
        """
        Lấy thống kê và phân loại chủ đề chat của nhân viên thuộc cùng tenant_id trong vòng days_limit ngày qua.
        """
        start_date = datetime.utcnow() - timedelta(days=days_limit)
        
        # 1. Truy vấn toàn bộ câu hỏi của nhân sự trong cùng Tenant
        user_messages = self.db.query(Message.content).join(
            Conversation, Message.conversation_id == Conversation.id
        ).join(
            User, Conversation.user_id == User.id
        ).filter(
            User.tenant_id == tenant_id,
            Message.role == "user",
            Message.created_at >= start_date
        ).all()
        
        questions = [m[0].strip() for m in user_messages if m[0] and m[0].strip()]
        
        if not questions:
            return []
            
        # 2. Tiền xử lý & chuẩn hóa nhanh bằng Python để lọc bớt câu hỏi tương đồng và giảm tải LLM
        unique_questions_map = {}
        for q in questions:
            normalized = correct_spelling(q)
            if normalized not in unique_questions_map:
                unique_questions_map[normalized] = {"raw": q, "count": 1}
            else:
                unique_questions_map[normalized]["count"] += 1
                
        # Sắp xếp theo tần suất xuất hiện và lấy tối đa top 100 câu hỏi
        sorted_questions = sorted(
            unique_questions_map.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )[:100]
        
        # Tạo chuỗi dữ liệu câu hỏi gửi cho LLM phân loại
        questions_payload = []
        for norm, info in sorted_questions:
            questions_payload.append(f"- \"{info['raw']}\" (Xuất hiện: {info['count']} lần)")
            
        questions_text = "\n".join(questions_payload)
        
        # 3. Sử dụng LLM phân tích ngữ nghĩa và phân nhóm câu hỏi
        prompt = f"""Bạn là một chuyên gia phân tích dữ liệu nhân sự doanh nghiệp.
Hãy phân tích danh sách các câu hỏi của nhân viên dưới đây và phân loại chúng vào các chủ đề chính (ví dụ: "Lương thưởng & Chế độ", "Nghỉ lễ & Nghỉ phép", "IT Support & Thiết bị", "Quy trình nội bộ", "Tuyển dụng & Đào tạo", "Khác" hoặc các chủ đề tự động sinh phù hợp nhất).

Danh sách câu hỏi cần phân loại:
{questions_text}

Yêu cầu:
1. Đọc và hiểu ngữ nghĩa từng câu hỏi (kể cả tiếng Việt viết không dấu hoặc viết tắt).
2. Gom các câu hỏi tương đồng vào cùng một nhóm chủ đề.
3. Cộng dồn số lượt xuất hiện của từng câu hỏi trong nhóm chủ đề đó để tính tổng số lượt của chủ đề.
4. Trả về DUY NHẤT định dạng JSON thô (không có markdown ```json) có cấu trúc như sau:
{{
  "topics": [
    {{
      "topic": "Tên nhóm chủ đề (tiếng Việt)",
      "count": 12,
      "description": "Mô tả ngắn gọn về chủ đề này"
    }}
  ]
}}"""

        try:
            response_text = self.response_generator.llm_provider.generate(
                prompt,
                max_tokens=1024,
                temperature=0.1
            )
            
            # Làm sạch phản hồi từ LLM để parse JSON
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response.strip("`").replace("json\n", "", 1).strip()
                
            result = json.loads(cleaned_response)
            topics = result.get("topics", [])
            
            # Tính tổng số câu hỏi để tính tỷ lệ phần trăm
            total_count = sum(t.get("count", 0) for t in topics)
            
            # Bổ sung tỷ lệ phần trăm vào kết quả
            for topic in topics:
                count = topic.get("count", 0)
                topic["percentage"] = round((count / total_count) * 100, 1) if total_count > 0 else 0
                
            # Sắp xếp các chủ đề theo số câu hỏi giảm dần
            return sorted(topics, key=lambda x: x.get("count", 0), reverse=True)
            
        except Exception as e:
            # Fallback nếu LLM bị lỗi: Trả về gom nhóm đơn giản dựa trên từ khóa thủ công
            print(f"[ERROR] AnalyticsService LLM classification failed: {e}")
            return self._fallback_keyword_analytics(sorted_questions)
            
    def _fallback_keyword_analytics(self, sorted_questions) -> List[Dict]:
        """Gom nhóm chủ đề dự phòng bằng từ khóa khi LLM gặp sự cố"""
        topics_map = {
            "Lương thưởng & Chế độ": {"count": 0, "description": "Câu hỏi về lương, thưởng, phụ cấp, thuế, bảo hiểm."},
            "Nghỉ lễ & Nghỉ phép": {"count": 0, "description": "Câu hỏi về ngày phép, nghỉ lễ, nghỉ chế độ."},
            "IT Support & Thiết bị": {"count": 0, "description": "Hỗ trợ kỹ thuật, tài khoản, máy tính, mạng wifi."},
            "Quy trình nội bộ": {"count": 0, "description": "Nội quy công ty, quy trình làm việc, hồ sơ thủ tục."},
            "Khác": {"count": 0, "description": "Các chủ đề chưa phân loại khác."}
        }
        
        keyword_rules = {
            "Lương thưởng & Chế độ": ["lương", "thuởng", "phụ cấp", "bảo hiểm", "thuế", "bonus", "salary", "pay"],
            "Nghỉ lễ & Nghỉ phép": ["nghỉ", "phép", "lễ", "tết", "leave", "holiday"],
            "IT Support & Thiết bị": ["máy tính", "wifi", "internet", "mật khẩu", "tài khoản", "lỗi", "phần mềm", "it"],
            "Quy trình nội bộ": ["quy chế", "nội quy", "quy trình", "hồ sơ", "ký", "gửi"]
        }
        
        for norm_q, info in sorted_questions:
            q_lower = norm_q.lower()
            classified = False
            for topic, keywords in keyword_rules.items():
                if any(kw in q_lower for kw in keywords):
                    topics_map[topic]["count"] += info["count"]
                    classified = True
                    break
            if not classified:
                topics_map["Khác"]["count"] += info["count"]
                
        # Chuyển đổi sang list và tính tỷ lệ
        result = []
        total_count = sum(t["count"] for t in topics_map.values())
        
        for name, data in topics_map.items():
            if data["count"] > 0:
                percentage = round((data["count"] / total_count) * 100, 1) if total_count > 0 else 0
                result.append({
                    "topic": name,
                    "count": data["count"],
                    "description": data["description"],
                    "percentage": percentage
                })
                
        return sorted(result, key=lambda x: x["count"], reverse=True)
