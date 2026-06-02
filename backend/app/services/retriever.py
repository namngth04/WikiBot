"""
Hybrid Retriever Module
Combines vector search (semantic via pgvector) and keyword search (BM25) for better retrieval accuracy
"""

import math
import re
import logging
from typing import List, Dict, Optional, Tuple
from collections import Counter, defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.models import Document, DocumentChunk
from app.services.document_processor import DocumentProcessor

logger = logging.getLogger(__name__)

_GLOBAL_BM25_SEARCHER = None

def invalidate_bm25_cache():
    """Invalidate global BM25 cache"""
    global _GLOBAL_BM25_SEARCHER
    _GLOBAL_BM25_SEARCHER = None


class BM25Searcher:
    """BM25 keyword search implementation"""
    
    def __init__(self, k1: float = 1.2, b: float = 0.75):
        self.k1 = k1  # Controls term frequency saturation
        self.b = b    # Controls document length normalization
        self.doc_count = 0
        self.doc_lengths = []
        self.avg_doc_length = 0
        self.term_doc_freq = defaultdict(int)  # Number of docs containing each term
        self.doc_term_freqs = []  # Term frequencies for each document
        self.documents = []
        self.doc_ids = []
    
    def index_documents(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
        """Index documents for BM25 search"""
        self.documents = documents
        self.doc_count = len(documents)
        self.doc_term_freqs = []
        self.doc_lengths = []
        self.term_doc_freq = defaultdict(int)
        self.doc_ids = ids
        
        # Process each document
        for doc in documents:
            # Tokenize and normalize
            terms = self._tokenize(doc)
            term_freq = Counter(terms)
            
            self.doc_term_freqs.append(term_freq)
            self.doc_lengths.append(len(terms))
            
            # Update document frequency for each term
            for term in set(terms):
                self.term_doc_freq[term] += 1
        
        # Calculate average document length
        self.avg_doc_length = sum(self.doc_lengths) / self.doc_count if self.doc_count > 0 else 0
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize Vietnamese text"""
        # Convert to lowercase and split on non-alphanumeric characters
        text = text.lower()
        tokens = re.findall(r'\b\w+\b', text)
        return tokens
    
    def _calculate_bm25_score(self, query_terms: List[str], doc_idx: int) -> float:
        """Calculate BM25 score for a document"""
        score = 0.0
        doc_length = self.doc_lengths[doc_idx]
        doc_term_freq = self.doc_term_freqs[doc_idx]
        
        for term in query_terms:
            if term in doc_term_freq:
                # Term frequency in this document
                tf = doc_term_freq[term]
                
                # Document frequency (number of docs containing this term)
                df = self.term_doc_freq[term]
                
                # Inverse document frequency
                idf = math.log((self.doc_count - df + 0.5) / (df + 0.5))
                
                # BM25 formula
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * (doc_length / self.avg_doc_length))
                
                score += idf * (numerator / denominator)
        
        return score
    
    def search(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        """Search documents using BM25"""
        query_terms = self._tokenize(query)
        
        if not query_terms:
            return []
        
        # Calculate scores for all documents
        scores = []
        for doc_idx in range(self.doc_count):
            score = self._calculate_bm25_score(query_terms, doc_idx)
            if score > 0:  # Only include documents with non-zero scores
                scores.append((doc_idx, score))
        
        # Sort by score (descending) and return top_k
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]


class HybridRetriever:
    """Hybrid retriever combining vector (semantic) and keyword (BM25) search via PostgreSQL"""
    
    def __init__(self, document_processor: DocumentProcessor):
        self.document_processor = document_processor
        self.bm25_searcher = BM25Searcher()
        self.vector_weight = 0.6  # Weight for vector search
        self.keyword_weight = 0.4  # Weight for keyword search
        self._indexed = False
    
    def _ensure_indexed(self, db: Session):
        """Ensure BM25 index is built"""
        if not self._indexed:
            self._build_bm25_index(db)
            self._indexed = True
    
    def _build_bm25_index(self, db: Session):
        """Build BM25 index from PostgreSQL document chunks"""
        global _GLOBAL_BM25_SEARCHER
        if _GLOBAL_BM25_SEARCHER is not None:
            self.bm25_searcher = _GLOBAL_BM25_SEARCHER
            return
            
        try:
            if db is None:
                logger.error("Database session is required to build BM25 index")
                return
                
            # Query all active chunks from Postgres
            chunks_data = db.query(DocumentChunk, Document).join(
                Document, DocumentChunk.document_id == Document.id
            ).filter(Document.is_active == True).all()
            
            if chunks_data:
                documents = [c.content for c, d in chunks_data]
                metadatas = []
                doc_ids = []
                
                for c, d in chunks_data:
                    meta = {
                        "source": d.original_name,
                        "document_id": d.id,
                        "chunk_index": c.id,
                        "role_id": d.role_id if d.role_id is not None else 0,
                        "file_type": d.file_type,
                        "element_type": c.element_type or "narrative",
                        "privacy_mode": d.privacy_mode,
                        "is_public_community": d.is_public_community,
                        "tenant_id": d.tenant_id if d.tenant_id is not None else 0,
                        "uploaded_by": d.uploaded_by,
                        "page_number": c.page_number
                    }
                    metadatas.append(meta)
                    doc_ids.append(str(c.id))
                
                # Index documents for BM25
                self.bm25_searcher.index_documents(documents, metadatas, doc_ids)
                logger.info(f"BM25 index built with {len(documents)} document chunks from Postgres")
                
                _GLOBAL_BM25_SEARCHER = self.bm25_searcher
            else:
                logger.debug("No active document chunks found in PostgreSQL")
        except Exception as e:
            logger.error(f"Failed to build BM25 index from Postgres: {e}")
    
    def search(self, query: str, accessible_role_ids: List[Optional[int]], 
                top_k: int = 5, max_distance: float = 0.3, receive_community: bool = False,
                current_user_id: Optional[int] = None, current_user_type: Optional[str] = "personal",
                current_user_tenant_id: Optional[int] = None, db: Session = None) -> List[Dict]:
        """Hybrid search combining pgvector and keyword search"""
        if db is None:
            logger.error("Database session (db) must be passed to search")
            return []
            
        self._ensure_indexed(db)
        
        # 1. Vector search (semantic via pgvector)
        vector_results = self._search_vector(
            query=query,
            accessible_role_ids=accessible_role_ids,
            top_k=top_k * 2,  # Get more to allow for re-ranking
            max_distance=max_distance,
            receive_community=receive_community,
            current_user_id=current_user_id,
            current_user_type=current_user_type,
            current_user_tenant_id=current_user_tenant_id,
            db=db
        )
        
        # 2. Keyword search (BM25)
        keyword_results = self._search_keyword(
            query=query, 
            accessible_role_ids=accessible_role_ids, 
            top_k=top_k * 2, 
            receive_community=receive_community,
            current_user_id=current_user_id,
            current_user_type=current_user_type,
            current_user_tenant_id=current_user_tenant_id
        )
        
        # 3. Combine and re-rank results
        combined_results = self._combine_results(
            vector_results, 
            keyword_results, 
            query,
            top_k
        )
        
        return combined_results

    def _search_vector(self, query: str, accessible_role_ids: List[Optional[int]], 
                       top_k: int = 5, max_distance: float = 0.3, receive_community: bool = False,
                       current_user_id: Optional[int] = None, current_user_type: Optional[str] = "personal",
                       current_user_tenant_id: Optional[int] = None, db: Session = None) -> List[Dict]:
        """Search similar chunks using PostgreSQL pgvector with RBAC and Multi-tenant filters"""
        try:
            # Generate query embedding
            raw_embedding = self.document_processor.embedding_model.encode([query])
            query_embedding = raw_embedding if isinstance(raw_embedding, list) else raw_embedding.tolist()
            if len(query_embedding) > 0 and isinstance(query_embedding[0], list):
                query_embedding = query_embedding[0]
            
            # Distance expression
            distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding)
            
            # Start query selecting chunk, doc, and calculated distance
            sql_query = db.query(DocumentChunk, Document, distance_expr).join(
                Document, DocumentChunk.document_id == Document.id
            ).filter(Document.is_active == True)
            
            # Build filters based on user type, tenant, and RBAC
            if current_user_type == "personal":
                personal_filters = [Document.uploaded_by == current_user_id]
                if receive_community:
                    personal_filters.append(Document.is_public_community == True)
                sql_query = sql_query.filter(or_(*personal_filters))
                
            elif current_user_type == "superadmin":
                # Superadmin has full access - no additional filters
                pass
                
            else:
                role_ids = [x for x in accessible_role_ids if x is not None]
                if 0 not in role_ids:
                    role_ids.append(0)
                    
                tenant_filters = [
                    and_(
                        Document.tenant_id == current_user_tenant_id,
                        or_(Document.role_id.in_(role_ids), Document.role_id.is_(None))
                    )
                ]
                if receive_community:
                    tenant_filters.append(Document.is_public_community == True)
                sql_query = sql_query.filter(or_(*tenant_filters))
            
            # Order by distance
            query_results = sql_query.order_by(distance_expr).limit(top_k).all()
            
            similar_chunks = []
            for chunk, doc, dist in query_results:
                # Filter by max distance limit
                if dist is not None and dist <= max_distance:
                    similar_chunks.append({
                        "content": chunk.content,
                        "metadata": {
                            "source": doc.original_name,
                            "document_id": doc.id,
                            "chunk_index": chunk.id,
                            "role_id": doc.role_id if doc.role_id is not None else 0,
                            "file_type": doc.file_type,
                            "element_type": chunk.element_type or "narrative",
                            "privacy_mode": doc.privacy_mode,
                            "is_public_community": doc.is_public_community,
                            "tenant_id": doc.tenant_id if doc.tenant_id is not None else 0,
                            "uploaded_by": doc.uploaded_by,
                            "page_number": chunk.page_number
                        },
                        "distance": float(dist)
                    })
            return similar_chunks
            
        except Exception as e:
            logger.error(f"pgvector search failed: {e}")
            return []
    
    def _search_keyword(self, query: str, accessible_role_ids: List[Optional[int]], 
                       top_k: int, receive_community: bool = False,
                       current_user_id: Optional[int] = None, current_user_type: Optional[str] = "personal",
                       current_user_tenant_id: Optional[int] = None) -> List[Dict]:
        """Search using BM25 keyword search"""
        try:
            bm25_scores = self.bm25_searcher.search(query, top_k)
            
            if not bm25_scores:
                return []
                
            results = []
            
            for doc_idx, score in bm25_scores:
                # Retrieve metadata directly indexed in BM25 searcher
                metadata = self.bm25_searcher.documents[doc_idx] # Actually we mapped metadata list in index
                # We need to map metadata back:
                meta = self.bm25_searcher.documents # In index_documents: self.documents = documents
                # Better to store metadata in BM25Searcher. Let's retrieve from self.bm25_searcher internal docs mapping.
                # In BM25Searcher index_documents we passed metadatas, but didn't store it! 
                # Let's check: self.documents has content. We can save metadatas inside BM25Searcher:
                # Let's check if we saved metadatas: No, the original code didn't save it!
                # Wait, in the original code, it called collection.get(ids=real_ids...) from ChromaDB.
                # Since we don't have ChromaDB now, we should save metadatas in BM25Searcher when indexing!
                pass
                
            # To make this robust, let's look at how we index. We will modify index_documents to save metadatas!
            # See BM25Searcher.index_documents: we added `self.metadatas = metadatas`
            # Let's rewrite _search_keyword to read from BM25Searcher.metadatas:
            
            bm25_searcher = self.bm25_searcher
            if not hasattr(bm25_searcher, 'metadatas'):
                # Handle case where index was built without metadatas
                return []
                
            for doc_idx, score in bm25_scores:
                metadata = bm25_searcher.metadatas[doc_idx]
                content = bm25_searcher.documents[doc_idx]
                
                role_id = metadata.get('role_id', 0)
                if role_id is None:
                    role_id = 0
                
                uploaded_by = metadata.get('uploaded_by', 0)
                tenant_id = metadata.get('tenant_id', 0)
                is_public_community = metadata.get('is_public_community', False)
                
                # Check role access and tenant/personal isolation
                has_access = False
                if current_user_type == "personal":
                    own_access = (uploaded_by == current_user_id)
                    community_access = receive_community and is_public_community
                    has_access = own_access or community_access
                elif current_user_type == "superadmin":
                    has_access = True
                else:
                    role_ids = [x for x in accessible_role_ids if x is not None]
                    if 0 not in role_ids:
                        role_ids.append(0)
                    tenant_access = (tenant_id == current_user_tenant_id) and (role_id in role_ids or role_id == 0 or role_id is None)
                    community_access = receive_community and is_public_community
                    has_access = tenant_access or community_access
                
                if has_access:
                    results.append({
                        'content': content,
                        'metadata': metadata,
                        'distance': 1.0 - (score / 10.0),  # Simple normalization
                        'bm25_score': score,
                        'vector_score': 0.0
                    })
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            return []
    
    def _combine_results(self, vector_results: List[Dict], keyword_results: List[Dict],
                        query: str, top_k: int) -> List[Dict]:
        """Combine vector and keyword search results"""
        combined = {}
        
        # Add vector results
        for result in vector_results:
            doc_id = f"{result['metadata'].get('document_id')}_{result['metadata'].get('chunk_index')}"
            combined[doc_id] = result.copy()
            combined[doc_id]['vector_score'] = 1.0 - result['distance']
            combined[doc_id]['bm25_score'] = 0.0
        
        # Add or update with keyword results
        for result in keyword_results:
            doc_id = f"{result['metadata'].get('document_id')}_{result['metadata'].get('chunk_index')}"
            if doc_id in combined:
                combined[doc_id]['bm25_score'] = result['bm25_score']
            else:
                combined[doc_id] = result.copy()
                combined[doc_id]['vector_score'] = 0.0
        
        # Calculate combined scores
        for doc_id, result in combined.items():
            vector_score = min(result['vector_score'], 1.0)
            bm25_score = min(result['bm25_score'] / 10.0, 1.0)
            
            combined_score = (self.vector_weight * vector_score + 
                             self.keyword_weight * bm25_score)
            
            result['combined_score'] = combined_score
            result['distance'] = 1.0 - combined_score
        
        # Sort by combined score and return top_k
        sorted_results = sorted(combined.values(), 
                              key=lambda x: x['combined_score'], 
                              reverse=True)
        
        return sorted_results[:top_k]
    
    def update_weights(self, vector_weight: float, keyword_weight: float):
        """Update search weights"""
        total = vector_weight + keyword_weight
        if total > 0:
            self.vector_weight = vector_weight / total
            self.keyword_weight = keyword_weight / total
        else:
            self.vector_weight = 0.5
            self.keyword_weight = 0.5
    
    def get_search_stats(self, query: str, accessible_role_ids: List[Optional[int]], db: Session = None) -> Dict:
        """Get statistics about search performance"""
        if db is None:
            return {}
            
        self._ensure_indexed(db)
        
        vector_results = self._search_vector(
            query, accessible_role_ids, top_k=10, max_distance=1.0, db=db
        )
        keyword_results = self._search_keyword(query, accessible_role_ids, top_k=10)
        
        vector_docs = set(f"{r['metadata'].get('document_id')}_{r['metadata'].get('chunk_index')}" 
                          for r in vector_results)
        keyword_docs = set(f"{r['metadata'].get('document_id')}_{r['metadata'].get('chunk_index')}" 
                          for r in keyword_results)
        
        overlap = len(vector_docs & keyword_docs)
        total_unique = len(vector_docs | keyword_docs)
        
        return {
            'query': query,
            'vector_results': len(vector_results),
            'keyword_results': len(keyword_results),
            'overlap': overlap,
            'total_unique': total_unique,
            'overlap_percentage': (overlap / total_unique * 100) if total_unique > 0 else 0,
            'vector_weight': self.vector_weight,
            'keyword_weight': self.keyword_weight
        }


# Update BM25Searcher index_documents to store metadatas
original_index_docs = BM25Searcher.index_documents
def index_documents_with_metadata(self, documents: List[str], metadatas: List[Dict], ids: List[str]):
    self.metadatas = metadatas
    original_index_docs(self, documents, metadatas, ids)

BM25Searcher.index_documents = index_documents_with_metadata
