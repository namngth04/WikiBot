import logging
from typing import TypedDict, List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.services.response_generator import ResponseGenerator
from app.core.config import get_settings


logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    query: str
    original_query: str
    conversation_history: List[Dict[str, str]]
    accessible_role_ids: List[Optional[int]]
    current_user_id: Optional[int]
    current_user_type: Optional[str]
    current_user_tenant_id: Optional[int]
    receive_community: bool
    response_style: str
    max_tokens: int
    db: Session
    stream_queue: Optional[Any]  # Queue for SSE Streaming
    model_id: Optional[int]
    is_complex: Optional[bool]

    
    # RAG internal states
    documents: List[Dict[str, Any]]
    relevant_documents: List[Dict[str, Any]]
    generation: str
    confidence: Dict[str, Any]
    rewrite_count: int
    needs_rewrite: bool
    steps: List[str]
    suggested_questions: List[str]

# ==================== NODES LOGIC ====================

def analyze_query_node(state: AgentState) -> Dict[str, Any]:
    """Analyze query and extract key search keywords or refine it"""
    query = state["query"]
    db = state["db"]
    steps = state.get("steps", [])
    steps.append("analyze_query")
    
    logger.info(f"[Agentic RAG] Node: analyze_query for query: '{query}'")
    
    # Skip LLM query analysis for simple queries
    if not state.get("is_complex", True):
        logger.info(f"[Agentic RAG] Skipping query analysis (LLM) since query is simple.")
        return {
            "query": query,
            "steps": steps
        }
        
    try:
        response_gen = ResponseGenerator(db=db, model_id=state.get("model_id"))
        llm = response_gen.llm_provider
        
        # Call LLM to optimize query keywords
        prompt = f"""Bạn là một chuyên gia phân tích từ khóa tìm kiếm.
Nhiệm vụ của bạn là phân tích câu hỏi của người dùng và trích xuất ra các từ khóa, thực thể cốt lõi nhất (bằng tiếng Việt) để tối ưu hóa việc tìm kiếm Hybrid Search (pgvector + BM25).

Câu hỏi: {query}

Hãy trả về một danh sách các từ khóa quan trọng cách nhau bởi dấu phẩy, không thêm bất kỳ văn bản giải thích nào khác.
Ví dụ: quy định nghỉ phép, năm 2026, chế độ bảo hiểm
Từ khóa tối ưu:"""
        
        refined_query = llm.generate(prompt, temperature=0.1, max_tokens=2024).strip()
        logger.info(f"[Agentic RAG] Refined query keywords: '{refined_query}'")
        
        if not refined_query or len(refined_query) < 2:
            refined_query = query
            
        return {
            "query": refined_query,
            "steps": steps
        }
    except Exception as e:
        logger.error(f"[Agentic RAG] Error in analyze_query_node: {e}", exc_info=True)
        return {"steps": steps}


def retrieve_node(state: AgentState) -> Dict[str, Any]:
    """Retrieve document chunks using pgvector and BM25 hybrid search"""
    query = state["query"]
    db = state["db"]
    steps = state.get("steps", [])
    steps.append("retrieve")
    
    logger.info(f"[Agentic RAG] Node: retrieve for query: '{query}'")
    
    # Kiểm tra tránh gọi API với từ khóa rỗng làm crash pgvector/embeddings
    if not query or not query.strip():
        logger.warning("[Agentic RAG] Query is empty, skipping hybrid search retrieval node.")
        return {
            "documents": [],
            "steps": steps
        }
        
    try:
        response_gen = ResponseGenerator(db=db, model_id=state.get("model_id"))
        retriever = response_gen.hybrid_retriever
        
        settings = get_settings()
        # Search documents
        chunks = retriever.search(
            query=query,
            accessible_role_ids=state["accessible_role_ids"],
            top_k=6,  # Retrieve slightly more for grading
            max_distance=settings.rag_max_distance,  # Tolerant distance for initial retrieval
            receive_community=state["receive_community"],
            current_user_id=state["current_user_id"],
            current_user_type=state["current_user_type"],
            current_user_tenant_id=state["current_user_tenant_id"],
            db=db
        )
        
        logger.info(f"[Agentic RAG] Retrieved {len(chunks)} chunks")
        for i, ch in enumerate(chunks):
            logger.info(f"[Agentic RAG] Chunk {i} - Nguồn: {ch['metadata'].get('source')} - Khoảng cách (distance): {ch.get('distance', 'N/A')}")
        return {
            "documents": chunks,
            "steps": steps
        }
    except Exception as e:
        logger.error(f"[Agentic RAG] Error in retrieve_node: {e}", exc_info=True)
        return {"documents": [], "steps": steps}


def grade_documents_node(state: AgentState) -> Dict[str, Any]:
    """Grades retrieved documents for relevance to the original query using Batch Grading"""
    original_query = state["original_query"]
    documents = state.get("documents", [])
    db = state["db"]
    rewrite_count = state.get("rewrite_count", 0)
    steps = state.get("steps", [])
    steps.append("grade_documents")
    
    logger.info(f"[Agentic RAG] Node: grade_documents for original query: '{original_query}'")
    
    # We run batch grading for all queries to ensure only relevant documents are included in the source list and context.
        
    # Solution B: Early exit heuristic based on vector distance
    # If even the best matching document has a poor cosine distance (e.g., > 0.55),
    # we consider retrieval failed and skip LLM grading to save calls.
    settings = get_settings()
    best_distance = min([doc.get("distance", 1.0) for doc in documents]) if documents else 1.0
    if best_distance > settings.rag_max_distance:
        needs_rewrite = rewrite_count < 1
        logger.info(f"[Agentic RAG] Early exit: best document distance is too poor ({best_distance:.3f} > {settings.rag_max_distance}). needs_rewrite: {needs_rewrite}")
        return {
            "relevant_documents": [],
            "needs_rewrite": needs_rewrite,
            "steps": steps
        }

    query = state["query"]
    
    if not documents:
        # Solution A: Limit rewrite count to 1
        needs_rewrite = rewrite_count < 1
        logger.info(f"[Agentic RAG] No documents retrieved. needs_rewrite: {needs_rewrite}")
        return {
            "relevant_documents": [],
            "needs_rewrite": needs_rewrite,
            "steps": steps
        }
        
    try:
        response_gen = ResponseGenerator(db=db, model_id=state.get("model_id"))
        llm = response_gen.llm_provider
        
        # Build batch grading prompt for all documents
        chunks_str = ""
        for i, chunk in enumerate(documents):
            content = chunk["content"]
            source = chunk["metadata"].get("source", "N/A")
            chunks_str += f'---\n[Đoạn {i}] (Nguồn: {source}): "{content}"\n'
            
        prompt = f"""Bạn là một chuyên gia thẩm định tài liệu.
Nhiệm vụ của bạn là đánh giá xem trong các đoạn tài liệu được cung cấp dưới đây, đoạn nào có chứa thông tin hữu ích giúp trả lời câu hỏi của người dùng.

Câu hỏi người dùng: {query}

Danh sách các đoạn tài liệu cần đánh giá:
{chunks_str}
---

Hãy trả về kết quả dưới định dạng JSON array chứa các giá trị boolean tương ứng (True nếu liên quan và chứa câu trả lời, False nếu không liên quan).
Ví dụ kết quả trả về: [true, false, true, false, false, false] (tương ứng từ Đoạn 0 đến Đoạn {len(documents)-1}).

Yêu cầu bắt buộc: Chỉ trả về duy nhất chuỗi JSON array đó, không giải thích, không dẫn dắt hay định dạng markdown nào khác ngoài JSON array.
Kết quả JSON:"""
        
        raw_grade = llm.generate(prompt, temperature=0.1, max_tokens=100).strip()
        logger.info(f"[Agentic RAG] Batch grading raw result: '{raw_grade}'")
        
        # Safe JSON parsing with fallback
        import re
        import json
        
        cleaned_grade = raw_grade
        if cleaned_grade.startswith("```"):
            cleaned_grade = re.sub(r"^```(?:json)?\n", "", cleaned_grade)
            cleaned_grade = re.sub(r"\n```$", "", cleaned_grade)
        cleaned_grade = cleaned_grade.strip()
        
        grades = None
        try:
            grades = json.loads(cleaned_grade)
        except Exception as je:
            logger.warning(f"[Agentic RAG] Failed to parse batch grading JSON natively: {je}. Attempting regex recovery.")
            # Search for JSON array pattern containing true/false
            match = re.search(r"\[\s*(?:true|false|True|False)(?:\s*,\s*(?:true|false|True|False))*\s*\]", cleaned_grade)
            if match:
                try:
                    json_str = match.group(0).lower()
                    grades = json.loads(json_str)
                except Exception as re_err:
                    logger.error(f"[Agentic RAG] Regex recovery parsing failed: {re_err}")
        
        relevant_docs = []
        if isinstance(grades, list) and len(grades) == len(documents):
            for idx, is_relevant in enumerate(grades):
                if is_relevant:
                    relevant_docs.append(documents[idx])
            logger.info(f"[Agentic RAG] Batch grading completed. Relevant chunks count: {len(relevant_docs)} / {len(documents)}")
        else:
            logger.warning(f"[Agentic RAG] Mismatch or parsing failed. Fallback to keeping all retrieved documents.")
            # Fallback: assume all documents are relevant to prevent block/failure
            relevant_docs = documents
            
        # If we have at least one relevant document, we do NOT need to rewrite
        if len(relevant_docs) > 0:
            return {
                "relevant_documents": relevant_docs,
                "needs_rewrite": False,
                "steps": steps
            }
        else:
            # Solution A: Limit rewrite count to 1
            needs_rewrite = rewrite_count < 1
            logger.info(f"[Agentic RAG] No relevant chunks found. needs_rewrite: {needs_rewrite} (rewrite_count: {rewrite_count})")
            return {
                "relevant_documents": [],
                "needs_rewrite": needs_rewrite,
                "steps": steps
            }
            
    except Exception as e:
        logger.error(f"[Agentic RAG] Error in grade_documents_node: {e}", exc_info=True)
        # Fallback: assume all documents are relevant to prevent loop/failure
        return {
            "relevant_documents": documents,
            "needs_rewrite": False,
            "steps": steps
        }


def rewrite_query_node(state: AgentState) -> Dict[str, Any]:
    """Rewrites the query using conversation context and original query to get better retrieval"""
    original_query = state["original_query"]
    conversation_history = state.get("conversation_history", [])
    db = state["db"]
    rewrite_count = state.get("rewrite_count", 0)
    steps = state.get("steps", [])
    steps.append("rewrite_query")
    
    logger.info(f"[Agentic RAG] Node: rewrite_query. Current rewrite count: {rewrite_count}")
    
    try:
        response_gen = ResponseGenerator(db=db, model_id=state.get("model_id"))
        llm = response_gen.llm_provider
        
        # Context building
        context_str = ""
        if conversation_history:
            recent_turns = conversation_history[-4:]  # Last 2 turns
            context_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_turns])
            
        prompt = f"""Bạn là một chuyên gia viết lại câu hỏi (Query Rewriter).
Nhiệm vụ của bạn là phân tích câu hỏi gốc của người dùng và bối cảnh hội thoại bên dưới để viết lại câu hỏi đó thành một câu truy vấn tìm kiếm tri thức (tiếng Việt) rõ ràng, đầy đủ ý và tối ưu hơn cho việc tìm kiếm trong tài liệu.

Bối cảnh hội thoại:
{context_str}

Câu hỏi gốc: {original_query}

Hãy trả về duy nhất câu hỏi đã được viết lại, không thêm bất kỳ văn bản dẫn dắt hay giải thích nào.
Câu hỏi viết lại:"""
        
        rewritten_query = llm.generate(prompt, temperature=0.3, max_tokens=2024).strip()
        logger.info(f"[Agentic RAG] Rewritten query: '{rewritten_query}'")
        
        # Fallback về câu hỏi gốc nếu câu hỏi viết lại bị rỗng hoặc lỗi
        if not rewritten_query or not rewritten_query.strip():
            rewritten_query = original_query
            
        return {
            "query": rewritten_query,
            "rewrite_count": rewrite_count + 1,
            "steps": steps
        }
    except Exception as e:
        logger.error(f"[Agentic RAG] Error in rewrite_query_node: {e}", exc_info=True)
        # Fallback an toàn về câu hỏi gốc
        return {
            "query": original_query,
            "rewrite_count": rewrite_count + 1,
            "steps": steps
        }


def generate_node(state: AgentState) -> Dict[str, Any]:
    """Generates the final response using the relevant chunks or gracefully declines if no chunks found"""
    original_query = state["original_query"]
    relevant_documents = state.get("relevant_documents", [])
    db = state["db"]
    response_style = state["response_style"]
    max_tokens = state["max_tokens"]
    stream_queue = state.get("stream_queue")
    steps = state.get("steps", [])
    steps.append("generate")
    
    logger.info(f"[Agentic RAG] Node: generate. Relevant documents count: {len(relevant_documents)}")
    
    try:
        response_gen = ResponseGenerator(db=db, model_id=state.get("model_id"))
        llm = response_gen.llm_provider
        
        # Resolve dynamic temperature and max_tokens based on response style
        temperature, resolved_max_tokens = response_gen._resolve_generation_profile(response_style, max_tokens)
        max_tokens_to_use = resolved_max_tokens + 200

        
        import asyncio
        # Lấy loop từ state hoặc tìm loop đang chạy an toàn, tránh lỗi khi gọi get_event_loop() trên thread phụ
        loop = state.get("loop")
        if not loop:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = None

        def put_to_queue(item):
            if not stream_queue:
                return
            if loop and loop.is_running():
                loop.call_soon_threadsafe(stream_queue.put_nowait, item)
            else:
                try:
                    stream_queue.put_nowait(item)
                except Exception as qe:
                    logger.warning(f"Could not put item to queue: {qe}")
        
        if not relevant_documents:
            # Decline gracefully based on CORE PRINCIPLES
            decline_prompt = f"""Viết một câu trả lời lịch sự từ chối trả lời câu hỏi của người dùng vì thông tin không có trong tài liệu nội bộ hệ thống.
Câu hỏi: {original_query}
Trả lời từ chối lịch sự, ngắn gọn:"""
            
            if stream_queue:
                # Stream the decline response
                answer = ""
                if hasattr(llm, "generate_stream"):
                    for chunk in llm.generate_stream(decline_prompt, temperature=0.2, max_tokens=2024):
                        answer += chunk
                        put_to_queue({"type": "token", "content": chunk})
                else:
                    answer = llm.generate(decline_prompt, temperature=0.2, max_tokens=2024)
                    put_to_queue({"type": "token", "content": answer})
                
                # Send empty metadata and close queue
                metadata_payload = {
                    "type": "metadata",
                    "sources": [],
                    "citations": [],
                    "confidence": {"overall": 0.0, "level": "low"},
                    "suggested_questions": [
                        "Bạn có thể giải thích chi tiết hơn được không?",
                        "Có tài liệu hoặc quy định nào cụ thể về việc này không?",
                        "Tôi cần làm các bước tiếp theo như thế nào?"
                    ]
                }
                put_to_queue(metadata_payload)
                put_to_queue(None)
            else:
                answer = llm.generate(decline_prompt, temperature=0.2, max_tokens=2024)
            
            return {
                "generation": answer,
                "confidence": {"overall": 0.0, "level": "low"},
                "steps": steps,
                "suggested_questions": [
                    "Bạn có thể giải thích chi tiết hơn được không?",
                    "Có tài liệu hoặc quy định nào cụ thể về việc này không?",
                    "Tôi cần làm các bước tiếp theo như thế nào?"
                ]
            }
            
        # Build conversation history context
        conversation_history = state.get("conversation_history", [])
        history_str = ""
        if conversation_history:
            history_turns = []
            for msg in conversation_history:
                # Tránh lặp lại câu hỏi hiện tại trong phần lịch sử hội thoại của Prompt
                if msg["role"] == "user" and msg["content"] == original_query:
                    continue
                role_name = "Người dùng" if msg["role"] == "user" else "Trợ lý"
                history_turns.append(f"{role_name}: {msg['content']}")
            
            if history_turns:
                history_str = "\n".join(history_turns[-4:])
        
        # Build context
        context = response_gen.build_context_prompt(original_query, relevant_documents)
        system_prompt = response_gen.build_system_prompt(response_style)
        
        # Thiết lập chỉ dẫn độ dài chặt chẽ tương ứng với từng phong cách
        style_instruction = ""
        if response_style == "concise":
            style_instruction = "Yêu cầu đặc biệt về độ dài: Hãy trả lời cực kỳ NGẮN GỌN, đi thẳng vào đáp án/kết quả cuối cùng, tuyệt đối không giải thích dài dòng các bước trung gian hoặc lặp lại thông tin không cần thiết."
        elif response_style == "detailed":
            style_instruction = "Yêu cầu đặc biệt về độ dài: Hãy trả lời một cách CHI TIẾT, trình bày đầy đủ các bước tính toán, lập luận và phân tích cặn kẽ từ tài liệu."
        else:  # normal
            style_instruction = "Yêu cầu đặc biệt về độ dài: Hãy trả lời một cách BÌNH THƯỜNG, rõ ràng, đủ ý nhưng không viết quá dài."

        history_prompt_part = f"\nBối cảnh trò chuyện gần đây:\n{history_str}\n" if history_str else ""
        
        prompt = f"""Dựa trên tài liệu được cung cấp và bối cảnh trò chuyện dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác, chân thực. {style_instruction} Đặc biệt, nếu câu hỏi liên quan đến con số cụ thể hoặc cần kết quả định lượng (ngay cả khi người dùng không ghi rõ từ 'tính toán', ví dụ như hỏi 'lương tôi bao nhiêu', 'tổng cộng là mấy', 'còn lại bao nhiêu'), hãy tự động lấy các số liệu định lượng và công thức có sẵn trong tài liệu để thay số, thực hiện phép tính toán và đưa ra kết quả con số cuối cùng cho người dùng. Sau đó, gợi ý thêm đúng 3 câu hỏi tiếp theo liên quan nhất giúp người dùng làm rõ hoặc mở rộng vấn đề.
 
Yêu cầu về trích dẫn: Khi trích dẫn thông tin, hãy gọi trực tiếp tên tài liệu nguồn (ví dụ: "Theo tài liệu A,..."), tuyệt đối không tự ghi ký hiệu "Đoạn X", "Chunk X" hay "Đoạn số X" vào câu trả lời của bạn.

Định dạng phản hồi bắt buộc của bạn phải tuân thủ cấu trúc sau, phân cách câu trả lời và câu gợi ý bằng ký tự phân tách đặc biệt "---" và tag [SUGGESTIONS] ở một dòng mới:
<Nội dung câu trả lời chi tiết của bạn ở đây>
---
[SUGGESTIONS]
1. Câu hỏi gợi ý tiếp theo 1
2. Câu hỏi gợi ý tiếp theo 2
3. Câu hỏi gợi ý tiếp theo 3
{history_prompt_part}
Tài liệu nội bộ:
{context}
 
Câu hỏi người dùng: {original_query}
Câu trả lời & Câu hỏi gợi ý:"""
        
        # Sources formatting
        sources_data = [
            {
                "chunk_index": c["metadata"].get("chunk_index"),
                "source": c["metadata"].get("source"),
                "page_number": c["metadata"].get("page_number"),
                "content": c["content"]
            }
            for c in relevant_documents
        ]
        
        raw_response = ""
        import re
        delimiter_pattern = re.compile(r"(\s*---\s*\n?\s*\[?SUGGESTIONS\]?.*)", re.IGNORECASE | re.DOTALL)
        potential_suffix_pattern = re.compile(r"(\n\s*-{1,3}\s*\[?[sSuUgGgGeEsStTiIoOnN]*)$")
        
        if stream_queue:
            # SSE streaming execution
            sent_length = 0
            stop_streaming = False
            if hasattr(llm, "generate_stream"):
                for chunk in llm.generate_stream(prompt, temperature=temperature, max_tokens=max_tokens_to_use, system_prompt=system_prompt):
                    raw_response += chunk
                    
                    # Check for suggestions separator and prevent streaming raw suggestions text to client
                    match = delimiter_pattern.search(raw_response)
                    if match:
                        answer_part = raw_response[:match.start()]
                        to_send = answer_part[sent_length:]
                        if to_send:
                            put_to_queue({"type": "token", "content": to_send})
                        sent_length = len(answer_part)
                        stop_streaming = True
                        break
                    
                    # Hold back potential separator prefixes
                    suffix_match = potential_suffix_pattern.search(raw_response)
                    if suffix_match:
                        answer_part = raw_response[:suffix_match.start()]
                        to_send = answer_part[sent_length:]
                        if to_send:
                            put_to_queue({"type": "token", "content": to_send})
                            sent_length = len(answer_part)
                    else:
                        to_send = raw_response[sent_length:]
                        if to_send:
                            put_to_queue({"type": "token", "content": to_send})
                            sent_length = len(raw_response)
                
                # Flush remaining buffer at the end of streaming if not stopped early
                if not stop_streaming and sent_length < len(raw_response):
                    to_send = raw_response[sent_length:]
                    put_to_queue({"type": "token", "content": to_send})
                    sent_length = len(raw_response)
            else:
                raw_response = llm.generate(prompt, temperature=temperature, max_tokens=max_tokens_to_use, system_prompt=system_prompt)
                match = delimiter_pattern.search(raw_response)
                answer_part = raw_response[:match.start()] if match else raw_response
                put_to_queue({"type": "token", "content": answer_part})
        else:
            raw_response = llm.generate(prompt, temperature=temperature, max_tokens=max_tokens_to_use, system_prompt=system_prompt)
            
        # Bóc tách câu trả lời và câu hỏi gợi ý
        answer = raw_response
        if answer:
            import re
            lines = []
            for line in answer.split('\n'):
                stripped = line.lstrip()
                if stripped.startswith('* '):
                    bullet_part = line[:len(line) - len(stripped)] + '* '
                    content_part = stripped[2:]
                    content_escaped = re.sub(r'(?<!\*)\*(?!\*)', r'\*', content_part)
                    lines.append(bullet_part + content_escaped)
                else:
                    line_escaped = re.sub(r'(?<!\*)\*(?!\*)', r'\*', line)
                    lines.append(line_escaped)
            answer = '\n'.join(lines)
            
        suggested_questions = []
        
        match = delimiter_pattern.search(raw_response)
        if match:
            answer = raw_response[:match.start()].strip()
            suggestions_part = raw_response[match.start():]
            matches = re.findall(r"\d+\.\s*(.+)", suggestions_part)
            if matches:
                suggested_questions = [m.strip() for m in matches[:3]]
        
        # Fallback an toàn nếu LLM quên sinh gợi ý
        if not suggested_questions:
            suggested_questions = [
                "Bạn có thể giải thích chi tiết hơn được không?",
                "Có tài liệu hoặc quy định nào cụ thể về việc này không?",
                "Tôi cần làm các bước tiếp theo như thế nào?"
            ]
            
        # Lọc các tài liệu tham khảo thực tế dựa trên nội dung câu trả lời của LLM
        filtered_relevant_docs = []
        has_any_mention = False
        import os
        for doc in relevant_documents:
            source_name = doc.get("metadata", {}).get("source", "")
            if not source_name:
                continue
            # 1. Khớp nguyên bản tên file (không phân biệt hoa thường)
            if source_name.lower() in answer.lower():
                has_any_mention = True
                break
            # 2. Khớp tên file đã lược bỏ phần mở rộng và UUID
            base_name = os.path.splitext(source_name)[0]
            clean_name1 = re.sub(r'_[a-f0-9]{32}$', '', base_name)
            clean_name2 = re.sub(r'_[a-f0-9-]{36}$', '', base_name)
            if (len(clean_name1) >= 3 and clean_name1.lower() in answer.lower()) or \
               (len(clean_name2) >= 3 and clean_name2.lower() in answer.lower()):
                has_any_mention = True
                break

        if has_any_mention:
            for doc in relevant_documents:
                source_name = doc.get("metadata", {}).get("source", "")
                if not source_name:
                    continue
                if source_name.lower() in answer.lower():
                    filtered_relevant_docs.append(doc)
                    continue
                base_name = os.path.splitext(source_name)[0]
                clean_name1 = re.sub(r'_[a-f0-9]{32}$', '', base_name)
                clean_name2 = re.sub(r'_[a-f0-9-]{36}$', '', base_name)
                if (len(clean_name1) >= 3 and clean_name1.lower() in answer.lower()) or \
                   (len(clean_name2) >= 3 and clean_name2.lower() in answer.lower()):
                    filtered_relevant_docs.append(doc)
            relevant_documents = filtered_relevant_docs
            
            # Cập nhật lại sources_data tương ứng với danh sách đã lọc
            sources_data = [
                {
                    "chunk_index": c["metadata"].get("chunk_index"),
                    "source": c["metadata"].get("source"),
                    "page_number": c["metadata"].get("page_number"),
                    "content": c["content"]
                }
                for c in relevant_documents
            ]

        # Skip confidence calculation using ConfidenceScorer to save resources (as requested)
        conf_data = {
            "overall": 1.0,
            "level": "high",
            "source_coverage": 1.0,
            "semantic_similarity": 1.0,
            "answer_completeness": 1.0
        }
        
        
        if stream_queue:
            # Gói tin cuối cùng chứa metadata để client hoàn thành cập nhật UI
            metadata_payload = {
                "type": "metadata",
                "sources": sources_data,
                "citations": sources_data,
                "confidence": conf_data,
                "suggested_questions": suggested_questions
            }
            put_to_queue(metadata_payload)
            put_to_queue(None) # Signal close stream
            
        return {
            "generation": answer,
            "relevant_documents": relevant_documents,
            "confidence": conf_data,
            "steps": steps,
            "suggested_questions": suggested_questions
        }
        
    except Exception as e:
        logger.error(f"[Agentic RAG] Error in generate_node: {e}", exc_info=True)
        if stream_queue:
            # Close stream on failure safely
            try:
                put_to_queue({"type": "error", "content": str(e)})
                put_to_queue(None)
            except:
                pass
        return {
            "generation": "Xin lỗi, đã xảy ra lỗi trong quá trình xử lý câu trả lời bằng LangGraph Agent.",
            "confidence": {"overall": 0.0, "level": "low"},
            "steps": steps,
            "suggested_questions": []
        }

# ==================== ROUTING ====================

def route_after_grading(state: AgentState) -> str:
    """Decides whether to rewrite the query or generate a response"""
    needs_rewrite = state.get("needs_rewrite", False)
    if needs_rewrite:
        logger.info("[Agentic RAG] Router: Route to 'rewrite_query'")
        return "rewrite_query"
    else:
        logger.info("[Agentic RAG] Router: Route to 'generate'")
        return "generate"

# ==================== GRAPH COMPILATION ====================

def compile_agentic_rag_graph():
    """Compiles the StateGraph for Agentic RAG using LangGraph"""
    from langgraph.graph import StateGraph, END
    
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("analyze_query", analyze_query_node)
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("grade_documents", grade_documents_node)
    workflow.add_node("rewrite_query", rewrite_query_node)
    workflow.add_node("generate", generate_node)
    
    # Build Edges
    workflow.set_entry_point("analyze_query")
    
    workflow.add_edge("analyze_query", "retrieve")
    workflow.add_edge("retrieve", "grade_documents")
    
    # Conditional Edges
    workflow.add_conditional_edges(
        "grade_documents",
        route_after_grading,
        {
            "rewrite_query": "rewrite_query",
            "generate": "generate"
        }
    )
    
    workflow.add_edge("rewrite_query", "retrieve")
    workflow.add_edge("generate", END)
    
    app = workflow.compile()
    logger.info("[Agentic RAG] LangGraph workflow compiled successfully!")
    return app
