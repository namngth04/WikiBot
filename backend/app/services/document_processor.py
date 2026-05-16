import os
import re
import logging
from typing import List, Optional
import chromadb
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.models import Document

# LangChain imports for multimodal document processing
from langchain_community.document_loaders import (
    UnstructuredPDFLoader,
    UnstructuredWordDocumentLoader,
    UnstructuredExcelLoader,
    UnstructuredPowerPointLoader,
    UnstructuredImageLoader,
    UnstructuredHTMLLoader,
    UnstructuredMarkdownLoader,
    TextLoader
)
from langchain_text_splitters import RecursiveCharacterTextSplitter


# Setup logging
logger = logging.getLogger(__name__)

# Singleton pattern for embedding model
_embedding_model = None

def get_embedding_model(db_session=None):
    """Get embedding model from DB config or fallback to settings"""
    global _embedding_model
    if _embedding_model is None:
        from app.services.llm_providers import get_embedding_provider
        _embedding_model = get_embedding_provider(db_session)
    return _embedding_model


class DocumentProcessor:
    def __init__(self, db_session=None):
        settings = get_settings()
        self.chunk_size = 500  # Increased for better context
        self.chunk_overlap = 50  # Adjusted overlap
        
        # Use cached embedding model (pass db_session for DB config lookup)
        self.embedding_model = get_embedding_model(db_session)
        
        # Initialize ChromaDB
        os.makedirs(settings.chroma_db_path, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=settings.chroma_db_path)
        self.collection = self.chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Initialize text splitter for LangChain
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
    
    def get_loader(self, file_path: str, file_type: str):
        """Get appropriate LangChain loader based on file type"""
        loader_map = {
            'pdf': UnstructuredPDFLoader,
            'docx': UnstructuredWordDocumentLoader,
            'xlsx': UnstructuredExcelLoader,
            'pptx': UnstructuredPowerPointLoader,
            'png': UnstructuredImageLoader,
            'jpg': UnstructuredImageLoader,
            'jpeg': UnstructuredImageLoader,
            'html': UnstructuredHTMLLoader,
            'htm': UnstructuredHTMLLoader,
            'md': UnstructuredMarkdownLoader,
            'markdown': UnstructuredMarkdownLoader,
            'txt': TextLoader,
        }
        
        loader_class = loader_map.get(file_type.lower())
        if not loader_class:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        # Configurable parameters per file type (dynamic, no hardcoded if-else)
        loader_configs = {
            'pdf': {
                'mode': "elements",
                'strategy': "fast",
                'extract_images_in_pdf': True,
                'extract_tables': True
            },
            'png': {
                'strategy': "hi_res",
                'extract_table': True,
                'ocr_languages': ["vie", "eng"]
            },
            'jpg': {
                'strategy': "hi_res",
                'extract_table': True,
                'ocr_languages': ["vie", "eng"]
            },
            'jpeg': {
                'strategy': "hi_res",
                'extract_table': True,
                'ocr_languages': ["vie", "eng"]
            },
            'txt': {
                'autodetect_encoding': True
            }
        }
        
        config = loader_configs.get(file_type.lower(), {})
        return loader_class(file_path, **config)

    def extract_elements(self, file_path: str, file_type: str) -> List[dict]:
        """Extract structured elements from document"""
        loader = self.get_loader(file_path, file_type)
        documents = loader.load()
        
        elements = []
        for doc in documents:
            element = {
                "content": doc.page_content,
                "metadata": doc.metadata,
                "type": doc.metadata.get("category", "narrative")
            }
            elements.append(element)
        
        return elements
    
    def chunk_elements(self, elements: List[dict]) -> List[dict]:
        """Chunk elements while preserving structure with robust category handling"""
        chunks = []
        
        # 1. Separate tables - preserve their structure entirely
        table_elements = [e for e in elements if e["type"].lower() == "table"]
        
        # 2. Treat everything else as text if it has content
        # This fixes the "Cannot chunk document" error by including all categories
        text_elements = [
            e for e in elements 
            if e["type"].lower() != "table" and e.get("content", "").strip()
        ]
        
        # Chunk text elements
        if text_elements:
            # Combine all text content with double newlines
            text_content = "\n\n".join([e["content"] for e in text_elements])
            text_chunks = self.text_splitter.split_text(text_content)
            
            for i, chunk in enumerate(text_chunks):
                chunks.append({
                    "content": chunk,
                    "type": "text",
                    "metadata": {"chunk_index": i, "element_type": "narrative"}
                })
        
        # Add tables as whole chunks
        for table in table_elements:
            chunks.append({
                "content": table["content"],
                "type": "table",
                "metadata": {
                    "chunk_index": len(chunks), 
                    "element_type": "table", 
                    **table.get("metadata", {})
                }
            })
        
        return chunks
    
    async def process_document(self, document: Document, db: Session) -> int:
        """Process document with LangChain + Unstructured"""
        # Extract structured elements
        elements = self.extract_elements(document.file_path, document.file_type)
        
        if not elements:
            raise ValueError("Không thể trích xuất nội dung từ tài liệu")
        
        # Chunk elements while preserving structure
        chunks = self.chunk_elements(elements)
        
        if not chunks:
            raise ValueError("Không thể chia nhỏ tài liệu")
        
        # Check if embedding provider supports multimodal
        is_multimodal = hasattr(self.embedding_model, 'is_multimodal') and self.embedding_model.is_multimodal
        
        # Separate chunks by type
        text_chunks = [c for c in chunks if c["type"] in ["text", "narrative", "title"]]
        image_chunks = [c for c in chunks if c["type"] in ["table", "image"] and "image_path" in c["metadata"]]
        
        # Generate embeddings
        if is_multimodal and image_chunks:
            # Multimodal encoding: separate text-only and image chunks
            embeddings = []
            
            # Text-only chunks
            if text_chunks:
                text_embeddings = self.embedding_model.encode(
                    texts=[c["content"] for c in text_chunks],
                    images=None
                )
                embeddings.extend(text_embeddings)
            
            # Image chunks: text + image
            for chunk in image_chunks:
                img_path = chunk["metadata"]["image_path"]
                try:
                    img_embedding = self.embedding_model.encode(
                        texts=[chunk["content"]],
                        images=[img_path]
                    )
                    embeddings.extend(img_embedding)
                except Exception as e:
                    logger.debug(f"Multimodal encoding failed for chunk, falling back to text-only: {e}")
                    # Fallback to text-only encoding
                    text_embedding = self.embedding_model.encode([chunk["content"]], images=None)
                    embeddings.extend(text_embedding)
        else:
            # Text-only encoding (fallback)
            texts = [chunk["content"] for chunk in chunks]
            embeddings = self.embedding_model.encode(texts)
            if not isinstance(embeddings, list):
                embeddings = embeddings.tolist()
        
        # Store in ChromaDB with enhanced metadata
        documents_data = []
        metadatas = []
        ids = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"doc_{document.id}_chunk_{i}"
            ids.append(chunk_id)
            documents_data.append(chunk["content"])
            
            chroma_role_id = document.role_id if document.role_id is not None else 0
            
            # Build enhanced metadata
            base_metadata = {
                "source": document.original_name,
                "document_id": document.id,
                "chunk_index": i,
                "role_id": chroma_role_id,
                "file_type": document.file_type,
                "element_type": chunk["metadata"].get("element_type", "narrative")
            }
            
            # Add optional metadata if available
            if "page_number" in chunk["metadata"]:
                base_metadata["page_number"] = chunk["metadata"]["page_number"]
            if "image_path" in chunk["metadata"]:
                base_metadata["has_image"] = True
                base_metadata["image_path"] = chunk["metadata"]["image_path"]
            
            # Add embedding type metadata
            if is_multimodal and chunk["type"] in ["table", "image"] and "image_path" in chunk["metadata"]:
                base_metadata["embedding_type"] = "multimodal"
            else:
                base_metadata["embedding_type"] = "text"
            
            metadatas.append(base_metadata)
        
        self.collection.add(
            documents=documents_data,
            metadatas=metadatas,
            ids=ids,
            embeddings=embeddings
        )
        
        # Update document metadata
        document.has_images = len(image_chunks) > 0
        document.image_count = len(image_chunks)
        document.has_tables = len([c for c in chunks if c["type"] == "table"]) > 0
        document.table_count = len([c for c in chunks if c["type"] == "table"])
        
        db.commit()
        
        # Invalidate BM25 cache since we added new documents
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
        
        return len(chunks)
    
    def update_document_role_in_vector_db(
        self, 
        document_id: int, 
        new_role_id: Optional[int], 
        old_role_id: Optional[int]
    ):
        """Update role_id in ChromaDB metadata for all chunks of a document"""
        # Find all chunks for this document
        results = self.collection.get(
            where={"document_id": document_id}
        )
        
        if not results or not results['ids']:
            return
        
        # Update metadata for each chunk
        # Use 0 for public documents (role_id is None)
        chroma_new_role_id = new_role_id if new_role_id is not None else 0
        for i, chunk_id in enumerate(results['ids']):
            metadata = results['metadatas'][i]
            metadata['role_id'] = chroma_new_role_id
            
            self.collection.update(
                ids=[chunk_id],
                metadatas=[metadata]
            )
            
        # Invalidate BM25 cache since metadata (role_id) changed
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
    
    def delete_document_from_vector_db(self, document_id: int):
        """Delete all chunks of a document from ChromaDB"""
        # Find and delete all chunks for this document
        self.collection.delete(
            where={"document_id": document_id}
        )
        
        # Invalidate BM25 cache since documents were deleted
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
    
    def search_similar(
        self, 
        query: str, 
        accessible_role_ids: List[Optional[int]], 
        top_k: int = 5,
        max_distance: float = 0.3
    ) -> List[dict]:
        """Search for similar chunks with RBAC filtering"""
        # Generate query embedding
        raw_embedding = self.embedding_model.encode([query])
        query_embedding = raw_embedding if isinstance(raw_embedding, list) else raw_embedding.tolist()
        
        # Build filter for RBAC
        # Simplify: just use $in with all accessible role IDs
        where_filter = None
        if accessible_role_ids:
            # Filter by all accessible role IDs (including 0 for public)
            where_filter = {"role_id": {"$in": accessible_role_ids}}
        
        
        # Query ChromaDB
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )
        
        # Filter by distance and format results
        similar_chunks = []
        if results and results['ids'] and len(results['ids']) > 0:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i]
                if distance <= max_distance:
                    similar_chunks.append({
                        "content": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i],
                        "distance": distance
                    })
        
        # Return top_k results
        return similar_chunks[:top_k]
