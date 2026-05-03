import os
import traceback
import logging
import time
import json
import re
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import Message, FAQ, AIProviderConfig, AISafetyConfig, UserAISettings
from app.services.document_processor import DocumentProcessor
from app.services.llm_providers import get_llm_provider, ProviderRegistry


def setup_rag_logger():
    """Setup RAG logger with console handler only"""
    settings = get_settings()
    logger = logging.getLogger('RAG')
    
    # Ensure logger is set to lowest level to capture all logs
    logger.setLevel(logging.DEBUG)
    
    # Clear existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler (INFO level)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # Formatter
    formatter = logging.Formatter('[RAG] %(asctime)s | %(levelname)s | %(name)s | %(message)s')
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    # Test logging
    logger.info("RAG Logger initialized - INFO level test")
    
    return logger


def log_structured_data(logger, level, component, data):
    """Log structured data for analysis"""
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'component': component,
        'data': data
    }
    logger.log(level, json.dumps(log_data, ensure_ascii=False))


class RAGService:
    def __init__(self, db: Session = None):
        settings = get_settings()
        self.settings = settings
        
        try:
            self.document_processor = DocumentProcessor(db)
        except Exception as e:
            print(f"Error initializing DocumentProcessor: {e}")
            raise
        
        # Load LLM from provider (DB config)
        try:
            if db:
                self.llm_provider = get_llm_provider("rag", db)
                # Load FAQ provider config
                from app.models.models import AIProviderConfig
                faq_config = db.query(AIProviderConfig).filter(
                    AIProviderConfig.ai_type == "faq"
                ).first()
                if faq_config and not faq_config.use_rag_provider:
                    # Use separate provider for FAQ
                    self.faq_provider = get_llm_provider("faq", db)
                else:
                    self.faq_provider = None  # Use RAG provider for FAQ
            else:
                # Fallback to env settings for backward compatibility
                from app.services.llm_providers import LocalGGUFProvider
                if not os.path.exists(settings.model_path):
                    error_msg = (
                        f"Model file not found: {settings.model_path}\n"
                        "Please download a GGUF model and update MODEL_PATH in .env file\n"
                        "Recommended: Qwen2.5-3B-Instruct-Q4_K_M.gguf or Llama-3.2-3B-Instruct-Q4_K_M.gguf"
                    )
                    print(f"DEBUG RAG: {error_msg}")
                    raise FileNotFoundError(error_msg)
                
                self.llm_provider = LocalGGUFProvider(
                    model_path=settings.model_path,
                    context_length=settings.model_context_length
                )
                self.faq_provider = None
        except Exception as e:
            print(f"Error loading LLM provider: {e}")
            traceback.print_exc()
            raise
        
        # Default generation budget
        self.max_tokens = 512
    
    def build_system_prompt(self, response_style: str) -> str:
        """Build system prompt for the assistant"""
        style_rules = {
            "concise": "- Tối đa 3 gạch đầu dòng hoặc 3 câu ngắn.\n- Mỗi ý tối đa 1 câu.",
            "normal": "- Tối đa 5 gạch đầu dòng hoặc 5 câu.\n- Trình bày rõ trọng tâm, tránh lặp.",
            "detailed": "- Tối đa 8 gạch đầu dòng hoặc 8 câu.\n- Chỉ mở rộng khi có trong tài liệu.",
        }
        return """Bạn là WikiBot - trợ lý AI chuyên gia về tài liệu nội bộ, bạn sẽ trả lời các câu hỏi dựa trên tài liệu được cung cấp.

NGUYÊN TẮC TUYỆT ĐỐI:
1. CHỈ DỮNG THÔNG TIN TỪ TÀI LIỆU: Không bao giờ thêm thông tin không có trong context
2. TRẢ LỜI TRỰC TIẾP: Đi thẳng vào câu trả lời, không mở đầu, không kết thúc
3. DỪNG NGAY KHI TRẢ LỜI XONG: Không thêm câu chúc, không giới thiệu bản thân
4. KHÔNG SÁNG TẠO: Không suy diễn, không thêm chi tiết không có trong tài liệu
5. NGẮN GỌN: Trả lời đủ để giải quyết câu hỏi, không dài dòng

CẤM TUYỆT ĐỐI:
- Không nói "WikiBot sẽ tiếp tục hỗ trợ"
- Không nói "Chúc bạn một ngày tốt lành"
- Không lặp lại thông tin
- Không xin lỗi khi không cần thiết
- Không thêm câu kết thúc bất kỳ
- Không giới thiệu bản thân sau khi trả lời
""" + f"\n\nQUY TẮC ĐỘ DÀI ({response_style.upper()}):\n{style_rules.get(response_style, style_rules['concise'])}"
    
    def build_context_prompt(self, query: str, chunks: List[dict]) -> str:
        """Build prompt with context from retrieved chunks"""
        context = "\n\n".join([
            f"[Tài liệu: {chunk['metadata']['source']}, Đoạn {chunk['metadata']['chunk_index']}]: {chunk['content']}"
            for chunk in chunks
        ])
        
        prompt = f"""THÔNG TIN TỪ TÀI LIỆU NỘI BỘ:
{context}

CÂU HỎI: {query}

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
    
    def _resolve_generation_profile(self, response_style: str, requested_max_tokens: Optional[int]) -> Tuple[float, int]:
        style_map = {
            "concise": {"temperature": 0.15, "max_tokens": 180},
            "normal": {"temperature": 0.2, "max_tokens": 260},
            "detailed": {"temperature": 0.3, "max_tokens": 360},
        }
        profile = style_map.get(response_style, style_map[self.settings.rag_default_style])
        max_tokens = profile["max_tokens"]
        if requested_max_tokens is not None:
            max_tokens = requested_max_tokens
        max_tokens = min(max_tokens, self.settings.model_max_tokens, 512)
        return profile["temperature"], max_tokens

    def _dedup_and_truncate_chunks(self, chunks: List[dict], max_chars: int = 500) -> List[dict]:
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

    def _trim_redundant_sentences(self, text: str) -> str:
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
        """Strip assistant self-intro prefixes like 'WikiBot:'."""
        return re.sub(r"^\s*(wikibot|trợ lý|assistant)\s*:\s*", "", text, flags=re.IGNORECASE).strip()

    def check_faqs(self, query: str, db: Session) -> Optional[FAQ]:
        """Check if query matches active FAQ with lightweight keyword scoring."""
        clean_query = query.strip()
        if not clean_query:
            return None

        normalized_query = re.sub(r"\s+", " ", clean_query.lower()).strip()
        query_tokens = {
            token for token in re.findall(r"\w+", normalized_query) if len(token) > 2
        }

        candidates = db.query(FAQ).filter(FAQ.is_active.is_(True)).all()
        best_faq = None
        best_score = 0.0

        for faq in candidates:
            faq_question = re.sub(r"\s+", " ", faq.question.lower()).strip()
            faq_tokens = {token for token in re.findall(r"\w+", faq_question) if len(token) > 2}

            contains_score = 1.0 if (
                normalized_query in faq_question or faq_question in normalized_query
            ) else 0.0

            overlap_score = 0.0
            if query_tokens and faq_tokens:
                overlap_score = len(query_tokens & faq_tokens) / len(query_tokens | faq_tokens)

            score = max(contains_score, overlap_score)
            if score > best_score:
                best_score = score
                best_faq = faq

        if best_faq and best_score >= 0.35:
            best_faq.hits = (best_faq.hits or 0) + 1
            db.commit()
            return best_faq
        return None

    def generate_response(
        self,
        query: str,
        conversation_history: List[Message],
        accessible_role_ids: List[Optional[int]],
        db: Session,
        response_style: str = "concise",
        requested_max_tokens: Optional[int] = None,
        show_sources: bool = True,
    ) -> dict:
        """Generate RAG-based response"""
        start_time = time.time()
        
        # 1. Check FAQs first
        faq = self.check_faqs(query, db)
        if faq:
            return {
                "response": f"{faq.answer}\n\n---\n*Câu trả lời từ FAQ chuẩn*",
                "answer": faq.answer,
                "sources": [{"source": "FAQ Hệ thống", "chunk_index": 0, "distance": 0.0}],
                "citations": []
            }

        # 2. Search for relevant chunks
        try:
            chunks = self.document_processor.search_similar(
                query=query,
                accessible_role_ids=accessible_role_ids,
                top_k=5,
                max_distance=self.settings.rag_max_distance
            )
        except Exception as e:
            print(f"Error in search_similar: {e}")
            raise
        
        # Determine which provider to use for generation
        provider = self.faq_provider if self.faq_provider else self.llm_provider
        print(f"[DEBUG RAG] Using provider: {type(provider).__name__ if provider else 'None'}")
        print(f"[DEBUG RAG] faq_provider: {self.faq_provider is not None}, llm_provider: {self.llm_provider is not None}")
        
        # Build prompts
        system_prompt = self.build_system_prompt(response_style)
        temperature, max_tokens = self._resolve_generation_profile(response_style, requested_max_tokens)
        
        if chunks:
            # Rerank chunks based on keyword matching
            chunks = self._rerank_chunks(query, chunks)
            chunks = self._dedup_and_truncate_chunks(chunks)[:3]  # Keep only top 3 after cleanup
            
            context_prompt = self.build_context_prompt(query, chunks)
        else:
            context_prompt = f"Câu hỏi: {query}\n\nKhông tìm thấy tài liệu liên quan."
        
        chat_history = self.format_chat_history(conversation_history)
        
        # Combine everything
        full_prompt = f"{system_prompt}\n\n"
        if chat_history:
            full_prompt += f"{chat_history}\n\n"
        full_prompt += f"{context_prompt}\n\n"
        
                
        # Generate response with provider
        try:
            llm_start = time.time()
            print(f"[DEBUG RAG] Calling provider.generate() with max_tokens={max_tokens}, temperature={temperature}")
            print(f"[DEBUG RAG] Prompt length: {len(full_prompt)} chars")
            response_text = provider.generate(
                full_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["</s>", "Trả lời:", "Người dùng:", "Câu hỏi:"],
                system_prompt=None  # Already included in full_prompt
            )
            print(f"[DEBUG RAG] Provider.generate() succeeded, response length: {len(response_text)} chars")
            llm_time = time.time() - llm_start
            
            response_text = self._trim_redundant_sentences(response_text)
            response_text = self._remove_assistant_prefix(response_text)
            
                        
            # Prepare sources with citation format
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
            
            return {
                "response": response_text if not show_sources else self._attach_inline_sources(response_text, sources),
                "answer": response_text,
                "sources": sources,
                "citations": sources
            }
            
        except Exception as e:
            import traceback
            print(f"[ERROR RAG] Error generating response: {e}")
            print(f"[ERROR RAG] Exception type: {type(e).__name__}")
            print(f"[ERROR RAG] Exception args: {e.args}")
            print(f"[ERROR RAG] Provider type: {type(provider).__name__ if provider else 'None'}")
            print(f"[ERROR RAG] llm_provider type: {type(self.llm_provider).__name__ if self.llm_provider else 'None'}")
            print(f"[ERROR RAG] faq_provider type: {type(self.faq_provider).__name__ if hasattr(self, 'faq_provider') and self.faq_provider else 'None'}")
            print(f"[ERROR RAG] Traceback:\n{traceback.format_exc()}")
            return {
                "response": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "answer": "Xin lỗi, đã xảy ra lỗi khi xử lý câu hỏi của bạn. Vui lòng thử lại.",
                "sources": [],
                "citations": []
            }
    
        
    def _rerank_chunks(self, query: str, chunks: List[dict]) -> List[dict]:
        """Rerank chunks based on keyword matching"""
        query_words = set(query.lower().split())
        
        for chunk in chunks:
            content_lower = chunk['content'].lower()
            # Boost score if query words appear in chunk
            word_matches = sum(1 for word in query_words if word in content_lower)
            chunk['rerank_score'] = chunk['distance'] - (word_matches * 0.05)
        
        return sorted(chunks, key=lambda x: x['rerank_score'])

    def _attach_inline_sources(self, response_text: str, sources: List[dict]) -> str:
        if not sources or not response_text:
            return response_text
        citation_text = "\n\n---\n**Nguồn:**"
        for i, source in enumerate(sources[:3], 1):
            citation_text += f"\n{i}. {source['source']} (Đoạn {source['chunk_index']})"
        return response_text + citation_text
    
    
