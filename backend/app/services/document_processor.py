import os
import re
import time
import logging
from typing import List, Optional
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

def get_embedding_model(db_session=None):
    """Get embedding model from DB config or fallback to settings"""
    from app.services.llm_providers import get_embedding_provider
    return get_embedding_provider(db_session)


class DocumentProcessor:
    def __init__(self, db_session=None):
        settings = get_settings()
        self.chunk_size = 500  # Increased for better context
        self.chunk_overlap = 50  # Adjusted overlap
        
        # Use cached embedding model (pass db_session for DB config lookup)
        self.embedding_model = get_embedding_model(db_session)
        
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

    def extract_elements(self, file_path: str, file_type: str, document_id: Optional[int] = None) -> List[dict]:
        """Extract structured elements from document with multimodal support for PDF and DOCX"""
        file_type_lower = file_type.lower()
        
        # Nếu là file PDF hoặc DOCX và có document_id, sử dụng bộ trích xuất nâng cao tự viết
        if file_type_lower == "pdf" and document_id is not None:
            try:
                return self._extract_pdf_multimodal(file_path, document_id)
            except Exception as e:
                logger.error(f"Lỗi khi trích xuất PDF đa phương thức nâng cao: {e}. Đang dùng fallback loader.")
                
        elif file_type_lower == "docx" and document_id is not None:
            try:
                return self._extract_docx_multimodal(file_path, document_id)
            except Exception as e:
                logger.error(f"Lỗi khi trích xuất DOCX đa phương thức nâng cao: {e}. Đang dùng fallback loader.")
        
        # Fallback về LangChain loaders cũ
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

    
    def _extract_pdf_multimodal(self, file_path: str, document_id: int) -> List[dict]:
        """Extract elements from PDF using pdfplumber for tables and PyMuPDF + OCR for images"""
        import pdfplumber
        import fitz  # PyMuPDF
        from app.services.vision_processor import VisionProcessor
        
        elements = []
        vision_processor = VisionProcessor()
        
        # Tạo thư mục lưu hình ảnh trích xuất
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(file_path))))
        images_dir = os.path.join(backend_dir, "backend", "data", "extracted_images")
        if not os.path.exists(images_dir):
            images_dir = os.path.join(os.path.dirname(file_path), "extracted_images")
        os.makedirs(images_dir, exist_ok=True)
        
        # Mở PyMuPDF để trích xuất hình ảnh
        pdf_document = fitz.open(file_path)
        
        # Mở pdfplumber để trích xuất văn bản và bảng biểu
        with pdfplumber.open(file_path) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                page_num = page_idx + 1
                
                # 1. Trích xuất văn bản thô của trang
                page_text = page.extract_text() or ""
                
                # 2. Phát hiện và trích xuất bảng biểu
                tables = page.find_tables()
                table_contents = []
                for t_idx, table in enumerate(tables):
                    table_data = table.extract()
                    if table_data:
                        # Chuyển đổi thành Markdown Table
                        markdown_lines = []
                        # Header
                        headers = [str(cell or "").strip().replace('\n', ' ') for cell in table_data[0]]
                        markdown_lines.append("| " + " | ".join(headers) + " |")
                        markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                        # Rows
                        for row in table_data[1:]:
                            cells = [str(cell or "").strip().replace('\n', ' ') for cell in row]
                            markdown_lines.append("| " + " | ".join(cells) + " |")
                        markdown_table = "\n".join(markdown_lines)
                        table_contents.append(markdown_table)
                
                # 3. Trích xuất hình ảnh từ trang bằng PyMuPDF
                image_descriptions = []
                fitz_page = pdf_document[page_idx]
                image_list = fitz_page.get_images(full=True)
                
                for img_idx, img in enumerate(image_list):
                    xref = img[0]
                    base_image = pdf_document.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Lưu file hình ảnh
                    img_name = f"doc_{document_id}_page_{page_num}_img_{img_idx + 1}.{image_ext}"
                    img_path = os.path.join(images_dir, img_name)
                    
                    with open(img_path, "wb") as f_img:
                        f_img.write(image_bytes)
                    
                    # Chạy OCR lấy chữ viết trong ảnh
                    ocr_text = vision_processor.extract_text_from_image(img_path)
                    if ocr_text.strip():
                        image_descriptions.append(f"[Hình ảnh {img_idx + 1} từ trang {page_num}: {ocr_text.strip()}]")
                    else:
                        image_descriptions.append(f"[Hình ảnh {img_idx + 1} từ trang {page_num}: Sơ đồ/hình vẽ nhúng]")
                
                # Kết hợp text + table + image description cho trang này
                combined_content = page_text
                
                if table_contents:
                    combined_content += "\n\n### Bảng biểu phát hiện trong trang:\n" + "\n\n".join(table_contents)
                
                if image_descriptions:
                    combined_content += "\n\n### Hình ảnh phát hiện trong trang:\n" + "\n\n".join(image_descriptions)
                
                if combined_content.strip():
                    elements.append({
                        "content": combined_content,
                        "metadata": {
                            "page_number": page_num,
                            "category": "page_content",
                            "has_tables": len(tables) > 0,
                            "has_images": len(image_list) > 0
                        },
                        "type": "text"
                    })
                    
                    # Lưu các bảng thành element table riêng để giữ nguyên cấu trúc
                    for table_md in table_contents:
                        elements.append({
                            "content": table_md,
                            "metadata": {
                                "page_number": page_num,
                                "category": "table",
                                "element_type": "table"
                            },
                            "type": "table"
                        })
                        
        pdf_document.close()
        return elements

    def _extract_docx_multimodal(self, file_path: str, document_id: int) -> List[dict]:
        """Extract elements from DOCX using python-docx for flow and zipfile for embedded images"""
        import docx
        from docx.text.paragraph import Paragraph
        from docx.table import Table
        from app.services.vision_processor import VisionProcessor
        import zipfile
        
        elements = []
        vision_processor = VisionProcessor()
        
        # Thư mục lưu ảnh trích xuất
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(file_path))))
        images_dir = os.path.join(backend_dir, "backend", "data", "extracted_images")
        if not os.path.exists(images_dir):
            images_dir = os.path.join(os.path.dirname(file_path), "extracted_images")
        os.makedirs(images_dir, exist_ok=True)
        
        # 1. Trích xuất tất cả ảnh nhúng từ tệp zip docx (word/media/)
        image_descriptions = {}
        try:
            with zipfile.ZipFile(file_path) as z:
                media_files = [f for f in z.namelist() if f.startswith('word/media/')]
                for idx, media_file in enumerate(media_files):
                    img_data = z.read(media_file)
                    ext = media_file.split('.')[-1]
                    img_name = f"doc_{document_id}_docx_img_{idx + 1}.{ext}"
                    img_path = os.path.join(images_dir, img_name)
                    
                    with open(img_path, 'wb') as f_img:
                        f_img.write(img_data)
                    
                    # Chạy OCR
                    ocr_text = vision_processor.extract_text_from_image(img_path)
                    if ocr_text.strip():
                        image_descriptions[media_file] = f"[Hình ảnh {idx + 1}: {ocr_text.strip()}]"
                    else:
                        image_descriptions[media_file] = f"[Hình ảnh {idx + 1}: Biểu đồ/hình vẽ nhúng]"
        except Exception as e:
            logger.warning(f"Không thể giải nén hình ảnh từ file Word: {e}")
        
        # 2. Duyệt tuần tự qua các phần tử XML để giữ đúng thứ tự
        doc = docx.Document(file_path)
        
        paragraph_idx = 0
        table_idx = 0
        
        for child in doc.element.body:
            if child.tag.endswith('p'):
                p = Paragraph(child, doc)
                text = p.text.strip()
                
                # Kiểm tra xem paragraph có chứa run hình vẽ (drawing/pict) không
                has_image = False
                for run in p.runs:
                    if 'w:drawing' in run._r.xml or 'w:pict' in run._r.xml:
                        has_image = True
                
                combined_p_content = text
                if has_image:
                    # Ánh xạ hình ảnh theo thứ tự xuất hiện của paragraph
                    keys = list(image_descriptions.keys())
                    if paragraph_idx < len(keys):
                        img_desc = image_descriptions[keys[paragraph_idx]]
                        combined_p_content += f"\n\n{img_desc}\n"
                
                if combined_p_content.strip():
                    elements.append({
                        "content": combined_p_content,
                        "metadata": {
                            "category": "narrative",
                            "paragraph_index": paragraph_idx
                        },
                        "type": "text"
                    })
                paragraph_idx += 1
                
            elif child.tag.endswith('tbl'):
                tbl = Table(child, doc)
                # Chuyển table Word thành Markdown Table
                markdown_lines = []
                rows = tbl.rows
                if rows:
                    headers = [cell.text.strip().replace('\n', ' ') for cell in rows[0].cells]
                    markdown_lines.append("| " + " | ".join(headers) + " |")
                    markdown_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                    
                    for row in rows[1:]:
                        cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
                        markdown_lines.append("| " + " | ".join(cells) + " |")
                
                markdown_table = "\n".join(markdown_lines)
                if markdown_table.strip():
                    elements.append({
                        "content": markdown_table,
                        "metadata": {
                            "category": "table",
                            "table_index": table_idx,
                            "element_type": "table"
                        },
                        "type": "table"
                    })
                table_idx += 1
        
        # Đảm bảo không sót hình ảnh chưa dùng
        unused_images = []
        keys = list(image_descriptions.keys())
        if len(keys) > paragraph_idx:
            for k in keys[paragraph_idx:]:
                unused_images.append(image_descriptions[k])
                
        if unused_images:
            elements.append({
                "content": "\n\n### Hình ảnh bổ sung từ tài liệu:\n" + "\n\n".join(unused_images),
                "metadata": {
                    "category": "narrative",
                    "unused_images": True
                },
                "type": "text"
            })
            
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
        """Process document with LangChain + Unstructured and store chunks in PostgreSQL pgvector"""
        # Extract structured elements
        elements = self.extract_elements(document.file_path, document.file_type, document.id)

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
        
        # Store in PostgreSQL using SQLAlchemy pgvector
        from app.models.models import DocumentChunk
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            db_chunk = DocumentChunk(
                document_id=document.id,
                content=chunk["content"],
                embedding=embedding,
                page_number=chunk["metadata"].get("page_number"),
                element_type=chunk["metadata"].get("element_type", "narrative")
            )
            db.add(db_chunk)
        
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
        """No-op as metadata is stored in the documents table and resolved via joins in pgvector"""
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
        
    def update_document_community_share_in_vector_db(self, document_id: int, is_public: bool):
        """No-op as metadata is stored in the documents table and resolved via joins in pgvector"""
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
    
    def delete_document_from_vector_db(self, document_id: int):
        """No-op because of CASCADE delete on the SQL table relationship"""
        from app.services.retriever import invalidate_bm25_cache
        invalidate_bm25_cache()
    
    def search_similar(
        self, 
        query: str, 
        accessible_role_ids: List[Optional[int]], 
        top_k: int = 5,
        max_distance: float = 0.3,
        receive_community: bool = False,
        current_user_id: Optional[int] = None,
        current_user_type: Optional[str] = "personal",
        current_user_tenant_id: Optional[int] = None
    ) -> List[dict]:
        """Search is now handled directly by retriever.py using SQL pgvector. 
        This is a legacy compatibility placeholder."""
        logger.warning("search_similar in DocumentProcessor is deprecated. Use retriever.py instead.")
        return []
