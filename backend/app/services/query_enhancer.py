"""
Query Enhancer Module
Use LLM to enhance queries with rewrite, decomposition, and expansion in a single call
"""

from typing import List, Dict, Any
import json


class QueryEnhancer:
    """Use LLM to enhance queries in a single call"""
    
    def __init__(self, llm_provider):
        self.llm = llm_provider
    
    def enhance_query(self, query: str) -> Dict[str, Any]:
        """Enhance query with rewrite, decomposition, and expansion in one LLM call"""
        prompt = f"""Phân tích và xử lý câu hỏi sau. Trả lời dưới dạng JSON:

Câu hỏi gốc: {query}

Yêu cầu:
1. rewritten: Viết lại câu hỏi cho rõ ràng, chính xác hơn
2. is_complex: Câu hỏi có phức tạp không? (true/false)
3. sub_queries: Nếu phức tạp, chia thành các câu hỏi con. Nếu đơn giản, trả về câu hỏi đã viết lại
4. variations: Tạo 2-3 câu hỏi tương đương dùng từ khác nhưng cùng ý nghĩa

Trả lời JSON:
{{
    "rewritten": "câu hỏi đã viết lại",
    "is_complex": true/false,
    "sub_queries": ["câu hỏi 1", "câu hỏi 2", ...],
    "variations": ["câu hỏi tương đương 1", "câu hỏi tương đương 2", ...]
}}"""

        response = self.llm.generate(
            prompt,
            max_tokens=300,
            temperature=0.2
        )
        
        try:
            # Parse JSON response
            result = json.loads(response)
            
            # Validate and fill defaults
            result.setdefault('rewritten', query)
            result.setdefault('is_complex', False)
            result.setdefault('sub_queries', [result.get('rewritten', query)])
            result.setdefault('variations', [])
            
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
                'is_complex': result['is_complex'],
                'sub_queries': result['sub_queries'],
                'variations': result['variations'],
                'all_queries': unique_queries[:5]  # Limit to 5 queries
            }
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                'original': query,
                'rewritten': query,
                'is_complex': False,
                'sub_queries': [query],
                'variations': [],
                'all_queries': [query]
            }
