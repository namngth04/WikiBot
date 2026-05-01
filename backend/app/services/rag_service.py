import os
import traceback
import logging
import time
import json
import re
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from llama_cpp import Llama

from app.core.config import get_settings
from app.models.models import Message
from app.services.document_processor import DocumentProcessor


def setup_rag_logger():
    """Setup RAG logger with console and file handlers"""
    settings = get_settings()
    logger = logging.getLogger('RAG')
    
    # Ensure logger is set to lowest level to capture all logs
    logger.setLevel(logging.DEBUG)
    
    # Clear existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Console handler (INFO level)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # File handler (DEBUG level - captures everything)
    file_handler = logging.FileHandler(settings.rag_log_file, encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    
    # Formatter
    formatter = logging.Formatter('[RAG] %(asctime)s | %(levelname)s | %(name)s | %(message)s')
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Test logging
    logger.debug("RAG Logger initialized - DEBUG level test")
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
    def __init__(self):
        settings = get_settings()
        self.settings = settings
        
                
        try:
            self.document_processor = DocumentProcessor()
        except Exception as e:
            print(f"Error initializing DocumentProcessor: {e}")
            raise
        
        # Load LLM
        if not os.path.exists(settings.model_path):
            error_msg = (
                f"Model file not found: {settings.model_path}\n"
                "Please download a GGUF model and update MODEL_PATH in .env file\n"
                "Recommended: Qwen2.5-3B-Instruct-Q4_K_M.gguf or Llama-3.2-3B-Instruct-Q4_K_M.gguf"
            )
            print(f"DEBUG RAG: {error_msg}")
            raise FileNotFoundError(error_msg)
        
        try:
            self.llm = Llama(
                model_path=settings.model_path,
                n_ctx=settings.model_context_length,
                temperature=settings.model_temperature,
                verbose=False
            )
        except Exception as e:
            print(f"Error loading LLM: {e}")
            traceback.print_exc()
            raise
        
        # Default generation budget, can be overridden per request.
        self.max_tokens = min(220, settings.model_max_tokens)
    
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
        
        # Search for relevant chunks
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
        
                
        # Generate response with Llama
        try:
            llm_start = time.time()
            output = self.llm(
                full_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=["</s>", "Trả lời:", "Người dùng:", "Câu hỏi:"],
                echo=False
            )
            llm_time = time.time() - llm_start
            
            response_text = self._trim_redundant_sentences(output['choices'][0]['text'].strip())
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
            print(f"Error generating response: {e}")
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
    
    
