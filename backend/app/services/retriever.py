"""
Hybrid Retriever Module
Combines vector search (semantic) and keyword search (BM25) for better retrieval accuracy
"""

import math
import re
import logging
from typing import List, Dict, Optional, Tuple
from collections import Counter, defaultdict
import chromadb

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
    """Hybrid retriever combining vector (semantic) and keyword (BM25) search"""
    
    def __init__(self, document_processor: DocumentProcessor):
        self.document_processor = document_processor
        self.bm25_searcher = BM25Searcher()
        self.vector_weight = 0.6  # Weight for vector search
        self.keyword_weight = 0.4  # Weight for keyword search
        self._indexed = False
    
    def _ensure_indexed(self):
        """Ensure BM25 index is built"""
        if not self._indexed:
            self._build_bm25_index()
            self._indexed = True
    
    def _build_bm25_index(self):
        """Build BM25 index from ChromaDB documents"""
        global _GLOBAL_BM25_SEARCHER
        if _GLOBAL_BM25_SEARCHER is not None:
            self.bm25_searcher = _GLOBAL_BM25_SEARCHER
            return
            
        try:
            # Get all documents from ChromaDB
            collection = self.document_processor.collection
            results = collection.get(include=["documents", "metadatas"])
            
            if results and results['documents']:
                documents = results['documents']
                metadatas = results['metadatas']
                doc_ids = results.get('ids', [str(i) for i in range(len(documents))])
                
                # Build BM25 index
                self.bm25_searcher.index_documents(documents, metadatas, doc_ids)
                logger.info(f"BM25 index built with {len(documents)} documents")
                
                # Cache globally
                _GLOBAL_BM25_SEARCHER = self.bm25_searcher
            else:
                logger.debug("No documents found in ChromaDB")
        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}")
    
    def search(self, query: str, accessible_role_ids: List[Optional[int]], 
                top_k: int = 5, max_distance: float = 0.3, receive_community: bool = False) -> List[Dict]:
        """Hybrid search combining vector and keyword search"""
        self._ensure_indexed()
        
        # 1. Vector search (semantic)
        vector_results = self.document_processor.search_similar(
            query=query,
            accessible_role_ids=accessible_role_ids,
            top_k=top_k * 2,  # Get more to allow for re-ranking
            max_distance=max_distance,
            receive_community=receive_community
        )
        
        # 2. Keyword search (BM25)
        keyword_results = self._search_keyword(query, accessible_role_ids, top_k * 2, receive_community=receive_community)
        
        # 3. Combine and re-rank results
        combined_results = self._combine_results(
            vector_results, 
            keyword_results, 
            query,
            top_k
        )
        
        return combined_results
    
    def _search_keyword(self, query: str, accessible_role_ids: List[Optional[int]], 
                       top_k: int, receive_community: bool = False) -> List[Dict]:
        """Search using BM25 keyword search"""
        try:
            # Get BM25 scores
            bm25_scores = self.bm25_searcher.search(query, top_k)
            
            if not bm25_scores:
                return []
                
            # Convert to our format and filter by role
            results = []
            collection = self.document_processor.collection
            
            # Get all real IDs for batching
            real_ids = [self.bm25_searcher.doc_ids[doc_idx] for doc_idx, _ in bm25_scores]
            
            # Get all documents in one batch
            batch_results = collection.get(
                ids=real_ids,
                include=["documents", "metadatas"]
            )
            
            if not batch_results or not batch_results['ids']:
                return []
                
            # Map batch results back to order of bm25_scores
            id_to_data = {
                id_: {'doc': doc, 'meta': meta} 
                for id_, doc, meta in zip(batch_results['ids'], batch_results['documents'], batch_results['metadatas'])
            }
            
            for doc_idx, score in bm25_scores:
                real_id = self.bm25_searcher.doc_ids[doc_idx]
                if real_id not in id_to_data:
                    continue
                    
                data = id_to_data[real_id]
                metadata = data['meta']
                role_id = metadata.get('role_id', 0)
                if role_id is None:
                    role_id = 0
                
                is_public_community = metadata.get('is_public_community', False)
                
                # Check role access HOẶC community sharing
                role_access = role_id in accessible_role_ids or 0 in accessible_role_ids
                community_access = receive_community and is_public_community
                
                if role_access or community_access:
                    results.append({
                        'content': data['doc'],
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
        # Create a dictionary to store combined results by document ID
        combined = {}
        
        # Add vector results
        for result in vector_results:
            doc_id = f"{result['metadata'].get('document_id')}_{result['metadata'].get('chunk_index')}"
            combined[doc_id] = result.copy()
            combined[doc_id]['vector_score'] = 1.0 - result['distance']  # Convert distance to score
            combined[doc_id]['bm25_score'] = 0.0
        
        # Add or update with keyword results
        for result in keyword_results:
            doc_id = f"{result['metadata'].get('document_id')}_{result['metadata'].get('chunk_index')}"
            if doc_id in combined:
                # Update existing result with BM25 score
                combined[doc_id]['bm25_score'] = result['bm25_score']
            else:
                # Add new result
                combined[doc_id] = result.copy()
        
        # Calculate combined scores
        for doc_id, result in combined.items():
            # Normalize scores to 0-1 range
            vector_score = min(result['vector_score'], 1.0)
            bm25_score = min(result['bm25_score'] / 10.0, 1.0)  # BM25 scores can be >1
            
            # Weighted combination
            combined_score = (self.vector_weight * vector_score + 
                             self.keyword_weight * bm25_score)
            
            result['combined_score'] = combined_score
            result['distance'] = 1.0 - combined_score  # Convert back to distance for compatibility
        
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
    
    def get_search_stats(self, query: str, accessible_role_ids: List[Optional[int]]) -> Dict:
        """Get statistics about search performance"""
        self._ensure_indexed()
        
        # Perform searches
        vector_results = self.document_processor.search_similar(
            query, accessible_role_ids, top_k=10, max_distance=1.0
        )
        keyword_results = self._search_keyword(query, accessible_role_ids, top_k=10)
        
        # Calculate overlap
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
