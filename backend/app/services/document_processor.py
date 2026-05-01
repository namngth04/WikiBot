import os
import re
from typing import List, Optional
import chromadb
from sentence_transformers import SentenceTransformer
from PyPDF2 import PdfReader
from docx import Document as DocxDocument
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.models import Document


# Singleton pattern for embedding model
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        settings = get_settings()
        _embedding_model = SentenceTransformer(settings.embedding_model)
    return _embedding_model


class DocumentProcessor:
    def __init__(self):
        settings = get_settings()
        self.chunk_size = 250  # Reduced for more focused chunks
        self.chunk_overlap = 30  # Reduced overlap
        
        # Use cached embedding model
        self.embedding_model = get_embedding_model()
        
        # Initialize ChromaDB
        os.makedirs(settings.chroma_db_path, exist_ok=True)
        self.chroma_client = chromadb.PersistentClient(path=settings.chroma_db_path)
        self.collection = self.chroma_client.get_or_create_collection(
            name="documents",
            metadata={"hnsw:space": "cosine"}
        )
    
    def extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text from different file types"""
        if file_type == 'pdf':
            return self._extract_from_pdf(file_path)
        elif file_type == 'docx':
            return self._extract_from_docx(file_path)
        elif file_type == 'txt':
            return self._extract_from_txt(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    
    def _extract_from_pdf(self, file_path: str) -> str:
        text = ""
        with open(file_path, 'rb') as file:
            reader = PdfReader(file)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    def _extract_from_docx(self, file_path: str) -> str:
        doc = DocxDocument(file_path)
        text = ""
        for para in doc.paragraphs:
            text += para.text + "\n"
        return text
    
    def _extract_from_txt(self, file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into chunks with overlap"""
        # Clean text
        text = re.sub(r'\s+', ' ', text).strip()
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            # Find a good breaking point (end of sentence or word)
            if end < len(text):
                # Try to find sentence boundary
                sentence_end = text.rfind('.', start, end + 50)
                if sentence_end > start:
                    end = sentence_end + 1
                else:
                    # Try word boundary
                    word_end = text.rfind(' ', start, end)
                    if word_end > start:
                        end = word_end
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move to next chunk with overlap
            start = end - self.chunk_overlap
            if start < end - self.chunk_size:  # Prevent infinite loop
                start = end
        
        return chunks
    
    async def process_document(self, document: Document, db: Session) -> int:
        """Process document: extract text, chunk, embed, and store"""
        # Extract text
        text = self.extract_text(document.file_path, document.file_type)
        
        if not text.strip():
            raise ValueError("Không thể trích xuất nội dung từ tài liệu")
        
        # Chunk text
        chunks = self.chunk_text(text)
        
        if not chunks:
            raise ValueError("Không thể chia nhỏ tài liệu")
        
        # Generate embeddings
        embeddings = self.embedding_model.encode(chunks).tolist()
        
        # Store in ChromaDB
        documents_data = []
        metadatas = []
        ids = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"doc_{document.id}_chunk_{i}"
            ids.append(chunk_id)
            documents_data.append(chunk)
            # Use 0 for public documents (role_id is None) to avoid ChromaDB None filter issues
            chroma_role_id = document.role_id if document.role_id is not None else 0
            metadatas.append({
                "source": document.original_name,
                "document_id": document.id,
                "chunk_index": i,
                "role_id": chroma_role_id,
                "file_type": document.file_type
            })
        
        self.collection.add(
            documents=documents_data,
            metadatas=metadatas,
            ids=ids,
            embeddings=embeddings
        )
        
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
    
    def delete_document_from_vector_db(self, document_id: int):
        """Delete all chunks of a document from ChromaDB"""
        # Find and delete all chunks for this document
        self.collection.delete(
            where={"document_id": document_id}
        )
    
    def search_similar(
        self, 
        query: str, 
        accessible_role_ids: List[Optional[int]], 
        top_k: int = 5,
        max_distance: float = 0.3
    ) -> List[dict]:
        """Search for similar chunks with RBAC filtering"""
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query]).tolist()
        
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
