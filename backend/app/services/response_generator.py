"""
Response Generator Module
Refactored from rag_service.py to use modular architecture
"""

import os
import time
import json
import re
import logging
from typing import List, Optional, Dict, Any

import numpy as np
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import Message, FAQ, AIProviderConfig, AISafetyConfig, UserAISettings
from app.services.document_processor import DocumentProcessor
from app.services.llm_providers import get_llm_provider, get_custom_llm_provider

from app.services.query_enhancer import QueryEnhancer
from app.services.retriever import HybridRetriever
from app.services.confidence_scorer import ConfidenceScorer


logger = logging.getLogger(__name__)

# Global cache for FAQ embeddings to avoid re-encoding
_FAQ_EMBEDDING_CACHE = {}

class ResponseGenerator:
    """Main response generation orchestrator using modular components"""
    
    def __init__(self, db: Session, model_id: Optional[int] = None):
        self.db = db
        self.settings = get_settings()
        
        # Initialize components
        self.document_processor = DocumentProcessor(db)
        self.hybrid_retriever = HybridRetriever(self.document_processor)
        self.confidence_scorer = ConfidenceScorer(self.document_processor.embedding_model)
        
        # Load LLM provider
        if model_id is not None:
            self.llm_provider = get_custom_llm_provider(model_id, db)
        else:
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
1. Chỉ sử dụng thông tin từ tài liệu được cung cấp.
2. Không thêm thông tin bên ngoài hoặc suy đoán không có trong tài liệu.
3. Nếu thông tin không đủ, hãy nói rõ phần nào thiếu.
4. Trả lời trung thực, không cố gắng trả lời khi không có dữ liệu.
5. Tuyệt đối không tự viết ký hiệu "Đoạn X", "Chunk X", hay "Đoạn số X" vào câu trả lời. Hãy gọi trực tiếp tên tài liệu nguồn khi trích dẫn (ví dụ: "Theo tài liệu A,...").

CÁCH TRẢ LỜI CÂU HỎI PHỨC TẠP:
- Phân tích câu hỏi thành các phần nhỏ
- Xác định thông tin cần tìm trong tài liệu
- Kết nối thông tin từ nhiều nguồn khác nhau
- Suy luận logic dựa trên thông tin có sẵn
- Tổng hợp và đưa ra kết luận rõ ràng

ĐIỀU CHỈNH ĐỘ DÀI THEO MONG MUỐN:
""" + f"\n\nQUY TẮC ĐỘ DÀI ({response_style.upper()}):\n{style_rules.get(response_style, style_rules['concise'])}"
    
    def build_context_prompt(self, query: str, chunks: List[dict]) -> str:
        """Build prompt with metadata-driven formatting"""
        context_parts = []
        
        for chunk in chunks:
            metadata = chunk['metadata']
            source = metadata['source']
            content = chunk['content']
            
            # Build context line based on available metadata
            context_line_parts = []
            
            # Add element type if available
            if 'element_type' in metadata and metadata['element_type']:
                context_line_parts.append(f"[{metadata['element_type'].upper()}]")
            
            # Add page number if available
            if 'page_number' in metadata and metadata['page_number']:
                context_line_parts.append(f"Trang {metadata['page_number']}")
            
            # Add source
            context_line_parts.append(f"Tài liệu {source}")
            
            # Join all metadata parts
            context_header = " - ".join(context_line_parts)
            
            context_parts.append(
                f"{context_header}:\n{content}"
            )
        
        context = "\n\n".join(context_parts)
        
        prompt = f"""THÔNG TIN TỪ TÀI LIỆU NỘI BỘ:
{context}

CÂU HỎI: {query}

HƯỚNG DẪN TRẢ LỜI:
1. Đọc kỹ tất cả tài liệu trên
2. Chú ý metadata của từng đoạn (loại phần tử, trang số) để hiểu ngữ cảnh
3. Kết nối thông tin từ nhiều đoạn khác nhau
4. Nếu thông tin không đủ, hãy nói rõ: "Theo tài liệu, không có thông tin về..."
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
        """Check if query matches active FAQ using embedding similarity"""
        try:
            candidates = self.db.query(FAQ).filter(FAQ.is_active.is_(True)).all()
            if not candidates:
                return None

            # 1. Thử so khớp chính xác/chứa từ trước (Fast track)
            normalized_query = re.sub(r"\s+", " ", query.lower()).strip()
            for faq in candidates:
                normalized_faq = re.sub(r"\s+", " ", faq.question.lower()).strip()
                if normalized_query == normalized_faq or (len(normalized_query) > 10 and normalized_query in normalized_faq):
                    faq.hits = (faq.hits or 0) + 1
                    self.db.commit()
                    return faq

            # 2. Embedding Similarity matching
            query_embedding = self.document_processor.embedding_model.encode([query])[0]
            
            best_faq = None
            best_score = 0.0
            
            global _FAQ_EMBEDDING_CACHE
            
            for faq in candidates:
                # Get or create cached embedding for FAQ question
                if faq.id not in _FAQ_EMBEDDING_CACHE:
                    faq_emb = self.document_processor.embedding_model.encode([faq.question])[0]
                    _FAQ_EMBEDDING_CACHE[faq.id] = faq_emb
                
                faq_embedding = _FAQ_EMBEDDING_CACHE[faq.id]
                
                # Calculate cosine similarity
                score = np.dot(query_embedding, faq_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(faq_embedding)
                )
                
                if score > best_score:
                    best_score = score
                    best_faq = faq
            
            logger.debug(f"FAQ Match: best_score={best_score:.4f} for '{best_faq.question if best_faq else 'None'}'")
            
            # Ngưỡng tin cậy cho embedding thường là 0.75 - 0.85
            if best_faq and best_score >= 0.8:
                best_faq.hits = (best_faq.hits or 0) + 1
                self.db.commit()
                return best_faq
                
        except Exception as e:
            logger.error(f"Error in FAQ matching: {e}")
            
        return None
    
    def generate_response(
        self,
        query: str,
        conversation_history: List[Message],
        accessible_role_ids: List[Optional[int]],
        response_style: str = "concise",
        requested_max_tokens: Optional[int] = None,
        show_sources: bool = True,
        receive_community: bool = False,
        current_user_id: Optional[int] = None
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
            # Get current user details to pass multi-tenant and personal isolation details
            user_type = "personal"
            tenant_id = None
            if current_user_id:
                from app.models.models import User
                user = self.db.query(User).filter(User.id == current_user_id).first()
                if user:
                    user_type = user.user_type
                    tenant_id = user.tenant_id
                    
            all_chunks = []
            for query_var in enhanced['all_queries']:
                chunks = self.hybrid_retriever.search(
                    query=query_var,
                    accessible_role_ids=accessible_role_ids,
                    top_k=5,  # Tăng lên 5 để quét rộng hơn, tránh bỏ sót danh sách/bảng biểu dài
                    max_distance=self.settings.rag_max_distance,
                    receive_community=receive_community,
                    current_user_id=current_user_id,
                    current_user_type=user_type,
                    current_user_tenant_id=tenant_id,
                    db=self.db
                )
                all_chunks.extend(chunks)
            
            # Dedup và rerank
            chunks = self._dedup_and_rerank_chunks(all_chunks, query_to_use)
        except Exception as e:
            logger.error(f"Error in hybrid search: {e}")
            raise
        
        # 4. Determine provider
        provider = self.faq_provider if self.faq_provider else self.llm_provider
        logger.debug(f"Using provider: {type(provider).__name__}")
        
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
                logger.debug(f"Client creation time: {client_time:.3f}s")
            
            # Generate response
            response_text = provider.generate(
                full_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["</s>", "Trả lời:", "Người dùng:", "Câu hỏi:"],
                system_prompt=None
            )
            
            llm_time = time.time() - llm_start
            logger.debug(f"LLM generation time: {llm_time:.3f}s")
            
            # Post-process response
            response_text = self._trim_redundant_sentences(response_text)
            response_text = self._remove_assistant_prefix(response_text)
            
            # Robust Output Guardrails: Ngăn chặn tuyệt đối phản hồi trống rỗng
            if not response_text or not response_text.strip():
                logger.warning("LLM generated an empty response. Applying fallback safety guardrails.")
                if not chunks:
                    response_text = "Xin lỗi, tôi không tìm thấy tài liệu hay thông tin liên quan nào trong kho tri thức của hệ thống để trả lời câu hỏi này."
                else:
                    response_text = "Xin lỗi, tôi gặp sự cố tạm thời khi kết nối với mô hình ngôn ngữ lớn để trả lời câu hỏi này. Bạn vui lòng thử lại sau nhé."
            
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
            
            # Check if any chunk belongs to community (uploaded by someone else)
            has_external_community_source = False
            for chunk in chunks:
                chunk_uploaded_by = chunk['metadata'].get('uploaded_by')
                chunk_is_public = chunk['metadata'].get('is_public_community', False)
                if chunk_is_public and chunk_uploaded_by != current_user_id:
                    has_external_community_source = True
                    break
                    
            if has_external_community_source:
                warning_msg = "\n\n⚠️ **Cảnh báo:** Thông tin này được đóng góp từ nguồn cộng đồng bên ngoài, vui lòng xác minh lại trước khi áp dụng."
                final_response += warning_msg
            
            total_time = time.time() - start_time
            logger.info(f"Total response generation time: {total_time:.3f}s")
            
            return {
                "response": final_response,
                "answer": response_text,
                "sources": sources,
                "citations": sources,
                "confidence": confidence_scores,
                "query_processing": enhanced,
                "retrieval_stats": {
                    "vector_results": len(chunks),
                    "keyword_results": len(chunks), # Approximation
                    "total_unique": len(chunks)
                }
            }
            
        except Exception as e:
            import traceback
            logger.error(f"Error generating response: {e}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            return {
                "response": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "answer": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "sources": [],
                "citations": [],
                "confidence": {"overall": 0.0, "level": "very_low"},
                "query_processing": enhanced,
                "error": str(e)
            }
    

    
    def _attach_inline_sources(self, response_text: str, sources: List[dict]) -> str:
        """Attach inline sources to response"""
        if not sources or not response_text:
            return response_text
        citation_text = "\n\n---\n**Nguồn:**"
        for i, source in enumerate(sources[:3], 1):
            citation_text += f"\n{i}. {source['source']} (Đoạn {source['chunk_index']})"
        return response_text + citation_text

    def generate_suggested_questions(self, query: str, answer: str) -> List[str]:
        """Generate 3 relevant suggested follow-up questions using LLM"""
        try:
            prompt = f"""Bạn là một trợ lý AI thông minh chuyên hỗ trợ người dùng tìm kiếm thông tin.
Dựa trên câu hỏi của người dùng và câu trả lời của trợ lý AI dưới đây, hãy gợi ý chính xác 3 câu hỏi tiếp theo có liên quan nhất, hữu ích nhất mà người dùng có thể muốn hỏi tiếp để làm rõ hoặc mở rộng vấn đề.

Câu hỏi của người dùng: {query}
Câu trả lời của trợ lý AI: {answer}

Yêu cầu:
1. Gợi ý đúng 3 câu hỏi ngắn gọn, tự nhiên, thực tế và trực tiếp (bằng tiếng Việt).
2. Trả về dưới dạng một danh sách JSON của mảng các chuỗi, ví dụ: ["Câu hỏi gợi ý 1", "Câu hỏi gợi ý 2", "Câu hỏi gợi ý 3"]. Không thêm bất kỳ giải thích, đánh dấu markdown hay văn bản dẫn dắt nào ngoài định dạng JSON này.

Đầu ra JSON:"""
            
            response = self.llm_provider.generate(
                prompt,
                max_tokens=250,
                temperature=0.3,
                system_prompt="Bạn chỉ trả về một mảng JSON thuần túy gồm 3 chuỗi câu hỏi gợi ý tiếp theo."
            ).strip()
            
            # Clean JSON markdown blocks if any
            if response.startswith("```"):
                response = re.sub(r"^```(?:json)?\n", "", response)
                response = re.sub(r"\n```$", "", response)
            response = response.strip()
            
            questions = json.loads(response)
            if isinstance(questions, list) and len(questions) > 0:
                # Trả về tối đa 3 câu hỏi, loại bỏ khoảng trắng dư thừa
                return [str(q).strip() for q in questions[:3]]
        except Exception as e:
            logger.error(f"Error generating suggested questions: {e}")
            
        # Fallback default questions if error occurs or empty result
        return [
            "Bạn có thể giải thích chi tiết hơn được không?",
            "Có tài liệu hoặc quy định nào cụ thể về việc này không?",
            "Tôi cần làm các bước tiếp theo như thế nào?"
        ]
