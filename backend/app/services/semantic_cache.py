import logging
import json
import redis
from typing import List, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.models import SemanticCache

logger = logging.getLogger(__name__)

# Biến toàn cục lưu trữ Redis Connection Pool dùng chung để tránh khởi tạo lại kết nối vật lý nhiều lần
_redis_pool = None

def get_redis_pool(settings) -> redis.ConnectionPool:
    global _redis_pool
    if _redis_pool is None:
        try:
            logger.info("Khởi tạo Redis Connection Pool toàn cục...")
            _redis_pool = redis.ConnectionPool(
                host=settings.redis_host,
                port=settings.redis_port,
                db=0,
                decode_responses=True,
                socket_timeout=2
            )
        except Exception as e:
            logger.error(f"Lỗi khi khởi tạo Redis Connection Pool: {e}")
    return _redis_pool

class SemanticCacheService:
    def __init__(self, db_session: Optional[Session] = None):
        self.settings = get_settings()
        self.db = db_session
        self.redis_client = None
        
        # Sử dụng Redis Connection Pool toàn cục
        try:
            pool = get_redis_pool(self.settings)
            if pool:
                self.redis_client = redis.Redis(
                    connection_pool=pool,
                    socket_timeout=2
                )
                logger.info("Khởi tạo Redis client từ Connection Pool dùng chung thành công.")
        except Exception as e:
            logger.warning(f"Không thể khởi tạo Redis client từ Pool (hệ thống sẽ tự động fallback sang cơ sở dữ liệu): {e}")
            self.redis_client = None

    def get_embedding(self, query: str) -> List[float]:
        """Sinh embedding vector của câu hỏi sử dụng embedding provider hiện có"""
        from app.services.document_processor import get_embedding_model
        model = get_embedding_model(self.db)
        embeddings = model.encode([query])
        
        if not isinstance(embeddings, list):
            embeddings = embeddings.tolist()
        return embeddings[0]

    def lookup(
        self, 
        query: str, 
        threshold: float = 0.95,
        current_user_id: Optional[int] = None,
        current_user_type: Optional[str] = "personal",
        current_user_tenant_id: Optional[int] = None,
        accessible_role_ids: Optional[List[Optional[int]]] = None,
        receive_community: bool = False
    ) -> Tuple[Optional[str], Optional[List[dict]], Optional[List[int]]]:
        """
        Tìm kiếm câu hỏi tương tự ngữ nghĩa trong Cache với cơ chế lọc quyền truy cập tài liệu bảo mật.
        Trả về: (câu trả lời, sources_metadata, associated_document_ids) nếu tìm thấy, ngược lại trả về (None, None, None)
        """
        if not self.db:
            return None, None, None
            
        try:
            # 1. Sinh vector của câu hỏi
            query_vector = self.get_embedding(query)
            
            # 2. Truy vấn tương đồng ngữ nghĩa bằng pgvector trên PostgreSQL
            # Vector <=> Vector tính khoảng cách Cosine, ta lấy 1 - khoảng cách để tính độ tương đồng Cosine
            stmt = text("""
                SELECT id, query_text, response_text, associated_document_ids, 1 - (embedding <=> CAST(:vector AS vector)) AS similarity
                FROM semantic_caches
                WHERE 1 - (embedding <=> CAST(:vector AS vector)) >= :threshold
                ORDER BY similarity DESC
                LIMIT 50
            """)
            
            results = self.db.execute(stmt, {"vector": str(query_vector), "threshold": threshold}).fetchall()
            
            for result in results:
                cache_id, matched_query, response_text, associated_doc_ids, similarity = result
                
                # 2.5. Kiểm tra quyền truy cập (RBAC + Tenant Isolation) đối với associated_document_ids
                if associated_doc_ids:
                    # Tự động phát hiện và hủy bỏ cache lỗi thời nếu tài liệu liên quan không còn tồn tại trong DB
                    doc_check_stmt = text("SELECT id FROM documents WHERE id = ANY(:ids) AND is_active = True")
                    active_docs = self.db.execute(doc_check_stmt, {"ids": associated_doc_ids}).fetchall()
                    if len(active_docs) < len(associated_doc_ids):
                        logger.warning(f"[Semantic Cache] Hủy bỏ và xóa cache ID {cache_id} do có tài liệu liên kết đã bị xóa khỏi hệ thống.")
                        if self.redis_client:
                            try:
                                self.redis_client.delete(f"semantic_cache:{cache_id}")
                            except Exception as re:
                                logger.warning(f"Lỗi khi xóa key trên Redis: {re}")
                        self.db.execute(
                            text("DELETE FROM semantic_caches WHERE id = :id"),
                            {"id": cache_id}
                        )
                        self.db.commit()
                        continue
 
                    # Nếu là superadmin thì bỏ qua kiểm tra quyền (được phép truy cập mọi tài liệu)
                    if current_user_type != "superadmin":
                        # Xây dựng câu lệnh kiểm tra quyền truy cập
                        # Tìm xem trong số document_ids của cache, có tài liệu nào người dùng không được truy cập hay không
                        # Nếu có bất kỳ tài liệu nào người dùng không được truy cập -> chuyển sang cache tiếp theo
                        if current_user_type == "personal":
                            rbac_stmt = text("""
                                SELECT id FROM documents
                                WHERE id = ANY(:ids) AND is_active = True
                                AND (uploaded_by = :user_id OR (:receive_community = True AND is_public_community = True))
                            """)
                        else:
                            role_ids = [x for x in (accessible_role_ids or []) if x is not None]
                            if 0 not in role_ids:
                                role_ids.append(0)
                            rbac_stmt = text("""
                                SELECT id FROM documents
                                WHERE id = ANY(:ids) AND is_active = True
                                AND (
                                    (tenant_id = :tenant_id AND (role_id = ANY(:role_ids) OR role_id IS NULL))
                                    OR (:receive_community = True AND is_public_community = True)
                                )
                            """)
                            
                        # Thực thi query kiểm tra
                        params = {
                            "ids": associated_doc_ids,
                            "user_id": current_user_id,
                            "tenant_id": current_user_tenant_id,
                            "role_ids": role_ids if current_user_type != "personal" else [],
                            "receive_community": receive_community
                        }
                        allowed_docs = self.db.execute(rbac_stmt, params).fetchall()
                        allowed_doc_ids = {doc.id for doc in allowed_docs}
                        
                        # Nếu số lượng tài liệu được phép truy cập ít hơn số lượng tài liệu liên quan của cache
                        # -> Có tài liệu bí mật mà người dùng hiện tại không có quyền xem -> Thử cache tiếp theo
                        if len(allowed_doc_ids) < len(associated_doc_ids):
                            logger.warning(f"[Semantic Cache] Bỏ qua cache ID {cache_id} do người dùng không có quyền truy cập vào tất cả các tài liệu liên quan: {associated_doc_ids}")
                            continue
                
                logger.info(f"Tìm thấy tương đồng ngữ nghĩa: '{matched_query}' (Độ tương đồng: {similarity:.4f}).")
                
                # Cập nhật số lần chạm cache (hits)
                self.db.execute(
                    text("UPDATE semantic_caches SET hits = hits + 1 WHERE id = :id"),
                    {"id": cache_id}
                )
                self.db.commit()
                
                # 3. Thử lấy dữ liệu nhanh từ Redis Cache
                redis_key = f"semantic_cache:{cache_id}"
                if self.redis_client:
                    try:
                        cached_data = self.redis_client.get(redis_key)
                        if cached_data:
                            logger.info("Đọc câu trả lời siêu tốc từ Redis Cache thành công.")
                            parsed = json.loads(cached_data)
                            return parsed.get("response"), parsed.get("sources"), associated_doc_ids
                    except Exception as re:
                        logger.warning(f"Lỗi khi đọc từ Redis Cache: {re}")
                
                # Nếu Redis bị lỗi hoặc không có, fallback trả về trực tiếp từ PostgreSQL
                # Trích xuất nguồn tài liệu liên quan mẫu nếu có
                sources = []
                if associated_doc_ids:
                    # Truy vấn nhanh tên file nguồn tham khảo để đồng bộ hiển thị trên UI
                    doc_stmt = text("SELECT id, original_name FROM documents WHERE id = ANY(:ids)")
                    docs = self.db.execute(doc_stmt, {"ids": associated_doc_ids}).fetchall()
                    sources = [{
                        "source": doc.original_name,
                        "document_id": doc.id,
                        "page_number": 1,
                        "element_type": "narrative"
                    } for doc in docs]
                
                return response_text, sources, associated_doc_ids
                
        except Exception as e:
            logger.error(f"Lỗi trong quá trình tra cứu Semantic Cache: {e}")
            
        return None, None, None

    def store(self, query: str, response: str, associated_document_ids: List[int], sources: Optional[List[dict]] = None) -> None:
        """Lưu câu trả lời mới kèm embedding và metadata vào Cache"""
        if not self.db:
            return
            
        try:
            # 1. Sinh vector của câu hỏi
            query_vector = self.get_embedding(query)
            
            # 2. Lưu vào PostgreSQL để lưu trữ lâu dài
            db_cache = SemanticCache(
                query_text=query,
                response_text=response,
                embedding=query_vector,
                associated_document_ids=associated_document_ids,
                hits=0
            )
            self.db.add(db_cache)
            self.db.commit()
            self.db.refresh(db_cache)
            
            # 3. Đồng bộ lưu nhanh vào Redis Cache dạng JSON string với thời gian sống (TTL) 7 ngày
            if self.redis_client:
                redis_key = f"semantic_cache:{db_cache.id}"
                cache_payload = {
                    "response": response,
                    "sources": sources or []
                }
                try:
                    self.redis_client.setex(
                        redis_key,
                        60 * 60 * 24 * 7,  # 7 ngày
                        json.dumps(cache_payload)
                    )
                    logger.info("Lưu câu trả lời vào Redis Cache thành công.")
                except Exception as re:
                    logger.warning(f"Không thể ghi dữ liệu vào Redis Cache: {re}")
                    
        except Exception as e:
            logger.error(f"Lỗi khi lưu trữ bản ghi vào Semantic Cache: {e}")
            self.db.rollback()

    def invalidate_by_document(self, document_id: int) -> int:
        """
        Trigger Invalidation: Xóa toàn bộ cache ngữ nghĩa có liên quan đến document_id.
        Trả về số lượng bản ghi cache bị xóa bỏ.
        """
        if not self.db:
            return 0
            
        try:
            # 1. Tìm các bản ghi cache liên quan bằng Python để tránh lỗi tương thích JSONB trên PostgreSQL
            caches = self.db.query(SemanticCache).all()
            cache_ids = []
            
            for cache in caches:
                # associated_document_ids là trường JSON chứa danh sách ID [doc_id_1, doc_id_2, ...]
                if cache.associated_document_ids and isinstance(cache.associated_document_ids, list):
                    if document_id in cache.associated_document_ids:
                        cache_ids.append(cache.id)
            
            if not cache_ids:
                return 0
                
            # 2. Xóa các Key tương ứng trên Redis Cache
            if self.redis_client:
                for cid in cache_ids:
                    try:
                        self.redis_client.delete(f"semantic_cache:{cid}")
                    except Exception as re:
                        logger.warning(f"Lỗi khi xóa key trên Redis: {re}")
                        
            # 3. Xóa các bản ghi trên PostgreSQL
            delete_stmt = text("DELETE FROM semantic_caches WHERE id = ANY(:ids)")
            self.db.execute(delete_stmt, {"ids": cache_ids})
            self.db.commit()
            
            logger.info(f"Đã giải phóng thành công {len(cache_ids)} bản ghi Semantic Cache liên quan đến tài liệu ID {document_id}.")
            return len(cache_ids)
            
        except Exception as e:
            logger.error(f"Gặp lỗi khi xóa Semantic Cache liên quan đến tài liệu {document_id}: {e}")
            self.db.rollback()
            
        return 0
