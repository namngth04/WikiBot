"""
Response Generator Module
Refactored from rag_service.py to use modular architecture
"""

import os
import time
import json
import re
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import Message, FAQ, AIProviderConfig, AISafetyConfig, UserAISettings
from app.services.document_processor import DocumentProcessor
from app.services.llm_providers import get_llm_provider
from app.services.query_enhancer import QueryEnhancer
from app.services.retriever import HybridRetriever
from app.services.confidence_scorer import ConfidenceScorer


class ResponseGenerator:
    """Main response generation orchestrator using modular components"""
    
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()
        
        # Initialize components
        self.document_processor = DocumentProcessor(db)
        self.hybrid_retriever = HybridRetriever(self.document_processor)
        self.confidence_scorer = ConfidenceScorer(self.document_processor.embedding_model)
        
        # Load LLM provider
        self.llm_provider = get_llm_provider("chat", db)
        
        # Initialize query enhancer (replaces QueryProcessor)
        self.query_enhancer = QueryEnhancer(self.llm_provider)
        
        # Load FAQ provider if configured
        faq_config = db.query(AIProviderConfig).filter(
            AIProviderConfig.ai_type == "faq"
        ).first()
        if faq_config and not faq_config.use_rag_provider:
            self.faq_provider = get_llm_provider("faq", db)
        else:
            self.faq_provider = None
        
        # Default generation budget
        self.max_tokens = 512
    
    def build_system_prompt(self, response_style: str) -> str:
        """Build system prompt with enhanced reasoning capabilities"""
        
        style_rules = {
            "concise": "- Trả lời ngắn gọn, tập trung vào điểm chính.\n- Sử dụng cấu trúc rõ ràng: ý chính → chi tiết → kết luận.",
            "normal": "- Trả lời đầy đủ, rõ ràng và dễ hiểu.\n- Giải thích khi cần thiết, cung cấp bối cảnh để người dùng hiểu.",
            "detailed": "- Trả lời chi tiết, giải thích từng phần.\n- Cung cấp lý do, ví dụ, và phân tích sâu khi có thể.\n- Sử dụng cấu trúc: phân tích → giải thích → ví dụ → kết luận.",
            "creative": "- Dùng ngôn ngữ linh hoạt, sáng tạo.\n- Cung cấp góc nhìn mới, so sánh, liên hệ thực tế.\n- Giữ nội dung chính xác theo tài liệu."
        }
        
        return """Bạn là WikiBot - trợ lý AI chuyên gia về tài liệu nội bộ.

NGUYÊN TẮC CỐT LÕI:
1. Chỉ sử dụng thông tin từ tài liệu được cung cấp
2. Không thêm thông tin bên ngoài hoặc suy đoán không có trong tài liệu
3. Nếu thông tin không đủ, hãy nói rõ phần nào thiếu
4. Trả lời trung thực, không cố gắng trả lời khi không có dữ liệu

CÁCH TRẢ LỜI CÂU HỎI PHỨC TẠP:
- Phân tích câu hỏi thành các phần nhỏ
- Xác định thông tin cần tìm trong tài liệu
- Kết nối thông tin từ nhiều nguồn khác nhau
- Suy luận logic dựa trên thông tin có sẵn
- Tổng hợp và đưa ra kết luận rõ ràng

ĐIỀU CHỈNH ĐỘ DÀI THEO MONG MUỐN:
""" + f"\n\nQUY TẮC ĐỘ DÀI ({response_style.upper()}):\n{style_rules.get(response_style, style_rules['concise'])}"
    
    def build_context_prompt(self, query: str, chunks: List[dict]) -> str:
        """Build prompt with enhanced reasoning guidance"""
        context = "\n\n".join([
            f"[Tài liệu: {chunk['metadata']['source']}, Đoạn {chunk['metadata']['chunk_index']}]: {chunk['content']}"
            for chunk in chunks
        ])
        
        prompt = f"""THÔNG TIN TỪ TÀI LIỆU NỘI BỘ:
{context}

CÂU HỎI: {query}

HƯỚNG DẪN TRẢ LỜI:
1. Đọc kỹ tất cả tài liệu trên
2. Xác định thông tin liên quan trực tiếp đến câu hỏi
3. Kết nối thông tin từ nhiều đoạn tài liệu khác nhau
4. Phân tích và suy luận dựa trên thông tin có sẵn
5. Nếu câu hỏi có nhiều phần, hãy trả lời từng phần một cách rõ ràng
6. Nếu thông tin không đủ, hãy nói rõ: "Theo tài liệu, không có thông tin về..."
7. Không tự thêm thông tin không có trong tài liệu
"""
        
        return prompt
    
    def format_chat_history(self, messages: List[Message]) -> str:
        """Format chat history for the prompt"""
        if len(messages) <= 1:  # Only current message or empty
            return ""
        
        history = "Cuộc trò chuyện trước:\n"
        # Take last 8 messages (4 exchanges) before current
        recent_messages = messages[-9:-1] if len(messages) > 1 else []
        
        for msg in recent_messages:
            role = "Người dùng" if msg.role == "user" else "Trợ lý"
            history += f"{role}: {msg.content}\n"
        
        return history
    
    def _resolve_generation_profile(self, response_style: str, requested_max_tokens: Optional[int]) -> tuple[float, int]:
        """Resolve temperature and max_tokens based on style with enhanced values"""
        style_map = {
            "concise": {"temperature": 0.2, "max_tokens": 300},
            "normal": {"temperature": 0.3, "max_tokens": 600},
            "detailed": {"temperature": 0.4, "max_tokens": 1000},
            "creative": {"temperature": 0.5, "max_tokens": 1200},
        }
        profile = style_map.get(response_style, style_map[self.settings.rag_default_style])
        max_tokens = profile["max_tokens"]
        if requested_max_tokens is not None:
            max_tokens = requested_max_tokens
        max_tokens = min(max_tokens, self.settings.model_max_tokens, 2048)
        return profile["temperature"], max_tokens
    
    def _dedup_and_truncate_chunks(self, chunks: List[dict], max_chars: int = 700) -> List[dict]:
        """Deduplicate and truncate chunks"""
        deduped = []
        seen = set()
        for chunk in chunks:
            normalized = " ".join(chunk["content"].lower().split())
            key = normalized[:180]
            if key in seen:
                continue
            seen.add(key)
            chunk["content"] = chunk["content"][:max_chars].strip()
            deduped.append(chunk)
        return deduped
    
    def _dedup_and_rerank_chunks(self, chunks: List[dict], original_query: str) -> List[dict]:
        """Deduplicate and rerank chunks based on relevance to original query"""
        seen = set()
        deduped = []
        for chunk in chunks:
            key = chunk['content'][:200]
            if key not in seen:
                seen.add(key)
                deduped.append(chunk)
        
        # Rerank based on original query
        query_words = set(original_query.lower().split())
        for chunk in deduped:
            content_lower = chunk['content'].lower()
            word_matches = sum(1 for word in query_words if word in content_lower)
            chunk['rerank_score'] = chunk.get('distance', 1.0) - (word_matches * 0.03)
        
        sorted_chunks = sorted(deduped, key=lambda x: x['rerank_score'])
        return sorted_chunks[:8]
    
    def _trim_redundant_sentences(self, text: str) -> str:
        """Remove redundant sentences"""
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        compact = []
        seen = set()
        for line in lines:
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            compact.append(line)
        return "\n".join(compact).strip()
    
    def _remove_assistant_prefix(self, text: str) -> str:
        """Strip assistant self-intro prefixes"""
        return re.sub(r"^\s*(wikibot|trợ lý|assistant)\s*:\s*", "", text, flags=re.IGNORECASE).strip()
    
    def check_faqs(self, query: str) -> Optional[FAQ]:
        """Check if query matches active FAQ with improved matching"""
        # Use query directly (QueryEnhancer will be called in generate_response)
        query_variations = [query]
        
        candidates = self.db.query(FAQ).filter(FAQ.is_active.is_(True)).all()
        best_faq = None
        best_score = 0.0
        
        for faq in candidates:
            for variation in query_variations:
                # Simple keyword matching (keeping original logic for now)
                normalized_variation = re.sub(r"\s+", " ", variation.lower()).strip()
                normalized_faq = re.sub(r"\s+", " ", faq.question.lower()).strip()
                
                # Check for exact match or containment
                if normalized_variation in normalized_faq or normalized_faq in normalized_variation:
                    score = 1.0
                else:
                    # Token overlap
                    var_tokens = set(re.findall(r"\w+", normalized_variation))
                    faq_tokens = set(re.findall(r"\w+", normalized_faq))
                    if var_tokens and faq_tokens:
                        score = len(var_tokens & faq_tokens) / len(var_tokens | faq_tokens)
                    else:
                        score = 0.0
                
                if score > best_score:
                    best_score = score
                    best_faq = faq
        
        if best_faq and best_score >= 0.35:
            best_faq.hits = (best_faq.hits or 0) + 1
            self.db.commit()
            return best_faq
        return None
    
    def generate_response(
        self,
        query: str,
        conversation_history: List[Message],
        accessible_role_ids: List[Optional[int]],
        response_style: str = "concise",
        requested_max_tokens: Optional[int] = None,
        show_sources: bool = True,
    ) -> dict:
        """Generate RAG-based response using enhanced query processing"""
        start_time = time.time()
        
        # 1. Enhance query với LLM (thay thế QueryProcessor)
        enhanced = self.query_enhancer.enhance_query(query)
        query_to_use = enhanced['rewritten']
        
        # 2. Check FAQs first
        faq = self.check_faqs(query_to_use)
        if faq:
            return {
                "response": f"{faq.answer}\n\n---\n*Câu trả lời từ FAQ chuẩn*",
                "answer": faq.answer,
                "sources": [{"source": "FAQ Hệ thống", "chunk_index": 0, "distance": 0.0}],
                "citations": [],
                "confidence": {"overall": 0.95, "source_coverage": 1.0, "level": "high"},
                "query_processing": enhanced
            }
        
        # 3. Hybrid search với multiple query variations
        try:
            all_chunks = []
            for query_var in enhanced['all_queries']:
                chunks = self.hybrid_retriever.search(
                    query=query_var,
                    accessible_role_ids=accessible_role_ids,
                    top_k=3,  # Giảm vì có nhiều variations
                    max_distance=self.settings.rag_max_distance
                )
                all_chunks.extend(chunks)
            
            # Dedup và rerank
            chunks = self._dedup_and_rerank_chunks(all_chunks, query_to_use)
        except Exception as e:
            print(f"Error in hybrid search: {e}")
            raise
        
        # 4. Determine provider
        provider = self.faq_provider if self.faq_provider else self.llm_provider
        print(f"[DEBUG ResponseGenerator] Using provider: {type(provider).__name__}")
        
        # 5. Build prompts
        system_prompt = self.build_system_prompt(response_style)
        temperature, max_tokens = self._resolve_generation_profile(response_style, requested_max_tokens)
        
        # Adjust parameters cho câu hỏi phức tạp
        if enhanced['is_complex']:
            temperature = min(temperature + 0.1, 0.7)
            max_tokens = min(max_tokens * 1.5, 2048)
        
        if chunks:
            # Truncate chunks
            max_chars = 1000 if enhanced['is_complex'] else 700
            max_chunk_count = 7 if enhanced['is_complex'] else 4
            chunks = self._dedup_and_truncate_chunks(chunks, max_chars=max_chars)[:max_chunk_count]
            
            context_prompt = self.build_context_prompt(query_to_use, chunks)
        else:
            context_prompt = f"Câu hỏi: {query_to_use}\n\nKhông tìm thấy tài liệu liên quan."
        
        chat_history = self.format_chat_history(conversation_history)
        
        # Combine everything
        full_prompt = f"{system_prompt}\n\n"
        if chat_history:
            full_prompt += f"{chat_history}\n\n"
        full_prompt += f"{context_prompt}\n\n"
        
        # 6. Generate response
        try:
            llm_start = time.time()
            
            # Handle lazy loading providers
            if hasattr(provider, '_client') and provider._client is None:
                provider_client = provider.client
                client_time = time.time() - llm_start
                print(f"[DEBUG ResponseGenerator] Client creation time: {client_time:.3f}s")
            
            # Generate response
            response_text = provider.generate(
                full_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["</s>", "Trả lời:", "Người dùng:", "Câu hỏi:"],
                system_prompt=None
            )
            
            llm_time = time.time() - llm_start
            print(f"[DEBUG ResponseGenerator] LLM generation time: {llm_time:.3f}s")
            
            # Post-process response
            response_text = self._trim_redundant_sentences(response_text)
            response_text = self._remove_assistant_prefix(response_text)
            
            # 7. Score confidence
            confidence_scores = self.confidence_scorer.score_answer(
                question=query,
                answer=response_text,
                sources=chunks,
                query_terms=query_to_use.split()
            )
            
            # 8. Prepare sources
            sources = []
            if chunks:
                seen_sources = set()
                for chunk in chunks:
                    source = chunk['metadata']['source']
                    if source not in seen_sources:
                        seen_sources.add(source)
                        sources.append({
                            "source": source,
                            "chunk_index": chunk['metadata']['chunk_index'],
                            "distance": chunk['distance']
                        })
            
            # 9. Format final response
            final_response = response_text if not show_sources else self._attach_inline_sources(response_text, sources)
            
            total_time = time.time() - start_time
            print(f"[DEBUG ResponseGenerator] Total generation time: {total_time:.3f}s")
            
            return {
                "response": final_response,
                "answer": response_text,
                "sources": sources,
                "citations": sources,
                "confidence": confidence_scores,
                "query_processing": enhanced,
                "retrieval_stats": self.hybrid_retriever.get_search_stats(query_to_use, accessible_role_ids)
            }
            
        except Exception as e:
            import traceback
            print(f"[ERROR ResponseGenerator] Error generating response: {e}")
            print(f"[ERROR ResponseGenerator] Traceback:\n{traceback.format_exc()}")
            return {
                "response": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "answer": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "sources": [],
                "citations": [],
                "confidence": {"overall": 0.0, "level": "very_low"},
                "query_processing": enhanced,
                "error": str(e)
            }
    
    def _rerank_chunks(self, query: str, chunks: List[dict]) -> List[dict]:
        """Rerank chunks based on keyword matching and other factors"""
        query_words = set(query.lower().split())
        
        for chunk in chunks:
            content_lower = chunk['content'].lower()
            
            # Keyword matching boost
            word_matches = sum(1 for word in query_words if word in content_lower)
            chunk['rerank_score'] = chunk['distance'] - (word_matches * 0.05)
            
            # Boost chunks with structured content
            if any(pattern in content_lower for pattern in [':', '-', '•', '1.', '2.', 'quy định', 'chính sách']):
                chunk['rerank_score'] -= 0.1
            
            # Boost chunks with numbers/dates (often more specific)
            if re.search(r'\d+', content_lower):
                chunk['rerank_score'] -= 0.05
        
        return sorted(chunks, key=lambda x: x['rerank_score'])
    
    def _attach_inline_sources(self, response_text: str, sources: List[dict]) -> str:
        """Attach inline sources to response"""
        if not sources or not response_text:
            return response_text
        citation_text = "\n\n---\n**Nguồn:**"
        for i, source in enumerate(sources[:3], 1):
            citation_text += f"\n{i}. {source['source']} (Đoạn {source['chunk_index']})"
        return response_text + citation_text
