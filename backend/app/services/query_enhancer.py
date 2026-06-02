"""
Query Enhancer Module
Use LLM to enhance queries with rewrite, decomposition, and expansion in a single call
"""

from typing import List, Dict, Any
import json

import re


class QueryEnhancer:
    """Use LLM to enhance queries in a single call"""
    
    def __init__(self, llm_provider):
        self.llm = llm_provider
        
    def _extract_json(self, text: str) -> str:
        """Trích xuất khối JSON từ chuỗi văn bản phản hồi của LLM một cách mạnh mẽ"""
        if not text:
            return ""
            
        cleaned = text.strip()
        
        # 1. Tìm các block ```json ... ``` hoặc ``` ... ```
        code_block_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
        if code_block_match:
            return code_block_match.group(1).strip()
            
        # 2. Nếu không có block ```, tìm cặp dấu ngoặc nhọn { ... } ngoài cùng
        brace_match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if brace_match:
            return brace_match.group(1).strip()
            
        return cleaned
    
    def enhance_query(self, query: str) -> Dict[str, Any]:
        """Enhance query with rewrite, decomposition, intent classification, and expansion in one LLM call"""
        prompt = f"""Phân tích và xử lý câu hỏi sau. Trả lời dưới dạng JSON:

Câu hỏi gốc: {query}

Yêu cầu:
1. rewritten: Viết lại câu hỏi cho rõ ràng, chính xác hơn bằng tiếng Việt.
2. intent: Phân loại ý định của câu hỏi vào một trong ba nhóm duy nhất:
   - "greeting": Các câu chào hỏi xã giao, cảm ơn, tạm biệt, hỏi thăm sức khỏe bot (ví dụ: "xin chào", "bạn khỏe không", "tạm biệt", "cảm ơn bạn", "hello bot").
   - "out_of_domain": Các câu hỏi ngoài phạm vi tài liệu nghiệp vụ nội bộ công ty (ví dụ: thời tiết hôm nay thế nào, giá vàng hôm nay bao nhiêu, tin tức thời sự thế giới, công thức toán học, thơ ca, lướt web, v.v.).
   - "rag": Các câu hỏi tra cứu quy định, tài liệu, hướng dẫn nghiệp vụ nội bộ doanh nghiệp (ví dụ: quy định nghỉ phép, chế độ bảo hiểm, thủ tục tạm ứng, hướng dẫn kỹ thuật...).
3. is_complex: Câu hỏi có phức tạp không? (true/false)
4. sub_queries: Nếu phức tạp, chia thành các câu hỏi con. Nếu đơn giản, trả về câu hỏi đã viết lại.
5. variations: Tạo 2-3 câu hỏi tương đương dùng từ khác nhưng cùng ý nghĩa.

Trả lời JSON:
{{
    "rewritten": "câu hỏi đã viết lại",
    "intent": "greeting" / "out_of_domain" / "rag",
    "is_complex": true/false,
    "sub_queries": ["câu hỏi 1", "câu hỏi 2", ...],
    "variations": ["câu hỏi tương đương 1", "câu hỏi tương đương 2", ...]
}}"""

        try:
            response = self.llm.generate(
                prompt,
                max_tokens=300,
                temperature=0.2
            )
            
            # Clean and extract JSON response
            cleaned_response = self._extract_json(response)
            
            # Parse JSON response
            result = json.loads(cleaned_response)
            
            # Validate and fill defaults
            result.setdefault('rewritten', query)
            result.setdefault('intent', 'rag')
            result.setdefault('is_complex', False)
            result.setdefault('sub_queries', [result.get('rewritten', query)])
            result.setdefault('variations', [])
            
            # Ensure intent is valid, fallback to rag
            if result['intent'] not in ['greeting', 'out_of_domain', 'rag']:
                result['intent'] = 'rag'
                
            # Ensure sub_queries has at least one query
            if not result['sub_queries']:
                result['sub_queries'] = [result['rewritten']]
            
            # Combine all queries for retrieval
            all_queries = [result['rewritten']] + result['sub_queries'] + result['variations']
            
            # Remove duplicates while preserving order
            unique_queries = list(dict.fromkeys(all_queries))
            
            return {
                'original': query,
                'rewritten': result['rewritten'],
                'intent': result['intent'],
                'is_complex': result['is_complex'],
                'sub_queries': result['sub_queries'],
                'variations': result['variations'],
                'all_queries': unique_queries[:5]  # Limit to 5 queries
            }
            
        except Exception as e:
            # Fallback an toàn tuyệt đối khi lỗi API Key, lỗi mạng hoặc lỗi parse JSON
            import logging
            logging.getLogger(__name__).warning(
                f"[QueryEnhancer] Error during LLM query enhancement: {e}. Falling back to default RAG intent."
            )
            return {
                'original': query,
                'rewritten': query,
                'intent': 'rag',
                'is_complex': False,
                'sub_queries': [query],
                'variations': [],
                'all_queries': [query]
            }
