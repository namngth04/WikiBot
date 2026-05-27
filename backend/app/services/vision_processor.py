"""
Vision Processor for Image Understanding
Supports: OCR, Image Description, Table Extraction from Images
"""

from typing import Optional, Dict, Any
from PIL import Image
import io
import os


class VisionProcessor:
    def __init__(self, ocr_engine: str = "paddle"):
        """
        Args:
            ocr_engine: 'paddle' (recommended for Vietnamese) or 'tesseract'
        """
        self.ocr_engine = ocr_engine
        self.pytesseract = None
        
        if ocr_engine == "paddle":
            try:
                from paddleocr import PaddleOCR
                # PaddleOCR - better for Vietnamese
                self.ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='vi',
                    use_gpu=False,
                    show_log=False
                )
            except ImportError:
                print("Warning: PaddleOCR not installed. Falling back to tesseract.")
                self.ocr_engine = "tesseract"
                ocr_engine = "tesseract"
                
        if ocr_engine == "tesseract":
            # Tesseract - need to install binary
            try:
                import pytesseract
                import shutil
                self.pytesseract = pytesseract
                
                # 1. Kiểm tra xem lệnh tesseract có sẵn trong hệ thống (PATH) không (Dành cho Linux/Docker)
                tesseract_in_path = shutil.which("tesseract")
                if tesseract_in_path:
                    # Đã tìm thấy tesseract toàn cục, pytesseract tự động nhận dạng được
                    pass
                else:
                    # 2. Nếu không có toàn cục, thử tìm theo đường dẫn mặc định trên Windows
                    tesseract_path = os.getenv('TESSERACT_PATH', r'C:\Program Files\Tesseract-OCR\tesseract.exe')
                    if os.path.exists(tesseract_path):
                        self.pytesseract.pytesseract.tesseract_cmd = tesseract_path
                    else:
                        print(f"Warning: Tesseract not found globally in system PATH or at {tesseract_path}")
            except ImportError:
                print("Warning: pytesseract library is not installed. Tesseract OCR will be disabled.")
                self.pytesseract = None
    
    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using OCR"""
        try:
            if self.ocr_engine == "paddle":
                result = self.ocr.ocr(image_path, cls=True)
                
                if not result or not result[0]:
                    return ""
                
                # Extract text from PaddleOCR result
                texts = []
                for line in result[0]:
                    texts.append(line[1][0])
                
                return "\n".join(texts)
            
            elif self.ocr_engine == "tesseract":
                if not self.pytesseract:
                    print("Error: pytesseract library is not available. Please install it or use PaddleOCR.")
                    return ""
                image = Image.open(image_path)
                text = self.pytesseract.image_to_string(
                    image,
                    lang='vie+eng',
                    config='--psm 6'
                )
                return text
        except Exception as e:
            print(f"Error extracting text from image: {e}")
            return ""
    
    def extract_table_from_image(self, image_path: str) -> Optional[str]:
        """
        Extract table structure from image
        Note: This is currently a placeholder wrapper that falls back to standard OCR text extraction.
        Future versions will integrate specialized table extraction models (e.g. TableTransformer or layoutparsers).
        """
        text = self.extract_text_from_image(image_path)
        return text
    
    def describe_image(self, image_path: str, llm_provider=None) -> str:
        """
        Describe image using vision model
        Requires vision-capable LLM (GPT-4V, Claude 3 Vision, etc.)
        """
        if not llm_provider or not hasattr(llm_provider, 'describe_image'):
            # Fallback to OCR
            return f"[OCR Text]: {self.extract_text_from_image(image_path)}"
        
        # Use vision model to describe image
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        description = llm_provider.describe_image(image_data)
        return description

