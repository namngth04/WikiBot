"""
Query Processing Module
Handles query expansion, spell correction, and normalization for better retrieval
"""

import re
from typing import List, Dict, Set
from collections import Counter


class QueryProcessor:
    """Process and enhance user queries for better retrieval accuracy"""
    
    def __init__(self):
        # Vietnamese business/HR synonyms mapping
        self.synonyms = {
            "lương": ["salary", "tiền lương", "mức lương", "thu nhập"],
            "nghỉ phép": ["nghỉ phep", "nghỉ", "đ nghỉ", "nghỉ phép năm", "annual leave"],
            "tạm ứng": ["tạm ung", "tam ung", "advance", "tiền tạm ứng"],
            "đổi mật khẩu": ["doi mat khau", "doi pass", "thay đổi mật khẩu", "reset password"],
            "quy trình": ["quy trinh", "process", "flow", "workflow"],
            "chấm công": ["cham cong", "check in", "check-in", "timekeeping"],
            "phúc lợi": ["phuc loi", "benefits", "welfare", "đãi ngộ"],
            "đánh giá": ["danh gia", "evaluation", "review", "performance review"],
            "đào tạo": ["dao tao", "training", "đào tạo nhân sự", "staff training"],
            "tuyển dụng": ["tuyen dung", "recruitment", "hiring", "tuyển người"],
            "hợp đồng": ["hop dong", "contract", "labor contract", "hợp đồng lao động"],
            "thưởng": ["thuong", "bonus", "khen thưởng", "reward"],
            "khấu trừ": ["khau tru", "deduction", "trừ lương"],
            "bảo hiểm": ["bao hiem", "insurance", "social insurance", "bảo hiểm xã hội"],
            "thuế": ["thue", "tax", "thuế thu nhập", "income tax"],
            "kpi": ["kpi", "key performance indicator", "chỉ số hiệu suất"],
            "ot": ["ot", "overtime", "làm thêm giờ", "làm ngoài giờ"],
            "remote": ["remote", "work from home", "wfh", "làm việc tại nhà"],
            "meeting": ["meeting", "hop", "cuộc họp", "họp"],
            "deadline": ["deadline", "hạn chót", "due date", "due"],
            "project": ["project", "dự án", "du an"],
            "team": ["team", "đội nhóm", "đội", "nhóm"],
            "manager": ["manager", "quản lý", "trưởng nhóm", "team lead"],
            "report": ["report", "báo cáo", "bao cao"],
            "email": ["email", "mail", "thư điện tử"],
            "system": ["system", "hệ thống", "he thong"],
            "account": ["account", "tài khoản", "tai khoan"],
            "login": ["login", "đăng nhập", "dang nhap"],
            "logout": ["logout", "đăng xuất", "dang xuat"],
            "password": ["password", "mật khẩu", "mat khau", "pass"],
            "profile": ["profile", "hồ sơ", "ho so"],
            "setting": ["setting", "cài đặt", "cai dat"],
            "help": ["help", "trợ giúp", "ho tro", "hỗ trợ"],
            "contact": ["contact", "liên hệ", "lien he"],
            "support": ["support", "hỗ trợ kỹ thuật", "ho tro ky thuat"],
            "issue": ["issue", "vấn đề", "van de", "lỗi", "error"],
            "request": ["request", "yêu cầu", "yeu cau"],
            "approve": ["approve", "duyệt", "duyet", "phê duyệt"],
            "reject": ["reject", "từ chối", "tu choi"],
            "submit": ["submit", "gửi", "gui", "nộp"],
            "cancel": ["cancel", "hủy", "huy"],
            "delete": ["delete", "xóa", "xoa"],
            "edit": ["edit", "sửa", "sua", "chỉnh sửa"],
            "view": ["view", "xem", "chi tiết", "chi tiet"],
            "list": ["list", "danh sách", "danh sach"],
            "search": ["search", "tìm kiếm", "tim kiem"],
            "filter": ["filter", "bộ lọc", "bo loc"],
            "sort": ["sort", "sắp xếp", "sap xep"],
            "export": ["export", "xuất", "xuat", "tải xuống"],
            "import": ["import", "nhập", "nhap", "tải lên"],
            "backup": ["backup", "sao lưu", "sao luu"],
            "restore": ["restore", "khôi phục", "khoi phuc"],
            "update": ["update", "cập nhật", "cap nhat"],
            "version": ["version", "phiên bản", "phien ban"],
            "release": ["release", "phát hành", "phat hanh"],
            "test": ["test", "kiểm thử", "kiem thu"],
            "debug": ["debug", "gỡ lỗi", "go loi"],
            "deploy": ["deploy", "triển khai", "trien khai"],
            "monitor": ["monitor", "giám sát", "giam sat"],
            "log": ["log", "nhật ký", "nhat ky"],
            "error": ["error", "lỗi", "loi"],
            "warning": ["warning", "cảnh báo", "canh bao"],
            "info": ["info", "thông tin", "thong tin"],
            "success": ["success", "thành công", "thanh cong"],
            "fail": ["fail", "thất bại", "that bai"],
            "status": ["status", "trạng thái", "trang thai"],
            "active": ["active", "kích hoạt", "kich hoat"],
            "inactive": ["inactive", "vô hiệu", "vo hieu"],
            "enable": ["enable", "bật", "bat"],
            "disable": ["disable", "tắt", "tat"],
            "show": ["show", "hiển thị", "hien thi"],
            "hide": ["hide", "ẩn", "an"],
            "open": ["open", "mở", "mo"],
            "close": ["close", "đóng", "dong"],
            "save": ["save", "lưu", "luu"],
            "load": ["load", "tải", "tai"],
            "refresh": ["refresh", "làm mới", "lam moi"],
            "reset": ["reset", "đặt lại", "dat lai"]
        }
        
        # Common Vietnamese typos and corrections
        self.spell_corrections = {
            "lương": ["luong", "luogn", "luong"],
            "nghỉ": ["nghi", "nghi"],
            "phép": ["phep", "phec"],
            "tạm": ["tam", "tamm"],
            "ứng": ["ung", "unhg"],
            "đổi": ["doi", "dooi"],
            "mật": ["mat", "matt"],
            "khẩu": ["khau", "khauu"],
            "quy": ["quy", "quyy"],
            "trình": ["trinh", "trinhh"],
            "chấm": ["cham", "chamm"],
            "công": ["cong", "congg"],
            "phúc": ["phuc", "phucc"],
            "lợi": ["loi", "loii"],
            "đánh": ["danh", "dannh"],
            "giá": ["gia", "giaa"],
            "đào": ["dao", "daoo"],
            "tạo": ["tao", "taoo"],
            "tuyển": ["tuyen", "tuyenn"],
            "dụng": ["dung", "dunng"],
            "hợp": ["hop", "hopp"],
            "đồng": ["dong", "dongg"],
            "thưởng": ["thuong", "thuongg"],
            "khấu": ["khau", "khauu"],
            "trừ": ["tru", "truu"],
            "bảo": ["bao", "baoo"],
            "hiểm": ["hiem", "hiemm"],
            "thuế": ["thue", "thuee"],
            "nhập": ["nhap", "nhapp"],
            "xuất": ["xuat", "xuatt"],
            "đào": ["dao", "daoo"],
            "tạo": ["tao", "taoo"],
            "họp": ["hop", "hopp"],
            "cuộc": ["cuoc", "cuocc"],
            "gửi": ["gui", "guui"],
            "yêu": ["yeu", "yeuu"],
            "cầu": ["cau", "cauu"],
            "duyệt": ["duyet", "duyett"],
            "từ": ["tu", "tuu"],
            "chối": ["choi", "choii"],
            "nộp": ["nop", "nopp"],
            "hủy": ["huy", "huyy"],
            "xóa": ["xoa", "xoaa"],
            "sửa": ["sua", "suua"],
            "chỉnh": ["chinh", "chinhh"],
            "sửa": ["sua", "suua"],
            "xem": ["xem", "xemm"],
            "chi": ["chi", "chii"],
            "tiết": ["tiet", "tiett"],
            "danh": ["danh", "dannh"],
            "sách": ["sach", "sachh"],
            "tìm": ["tim", "timm"],
            "kiếm": ["kiem", "kiemm"],
            "bộ": ["bo", "boo"],
            "lọc": ["loc", "locc"],
            "sắp": ["sap", "sapp"],
            "xếp": ["xep", "xepp"],
            "xuất": ["xuat", "xuatt"],
            "nhập": ["nhap", "nhapp"],
            "sao": ["sao", "saoo"],
            "lưu": ["luu", "luuu"],
            "khôi": ["khoi", "khoii"],
            "phục": ["phuc", "phucc"],
            "cập": ["cap", "capp"],
            "nhật": ["nhat", "nhatt"],
            "ký": ["ky", "kyy"],
            "giám": ["giam", "giamm"],
            "sát": ["sat", "satt"],
            "lỗi": ["loi", "loii"],
            "cảnh": ["canh", "canhh"],
            "báo": ["bao", "baoo"],
            "thành": ["thanh", "thanh"],
            "công": ["cong", "congg"],
            "thất": ["that", "thatt"],
            "bại": ["bai", "baai"],
            "trạng": ["trang", "trangg"],
            "thái": ["thai", "thaii"],
            "kích": ["kich", "kichh"],
            "hoạt": ["hoat", "hoatt"],
            "vô": ["vo", "voo"],
            "hiệu": ["hieu", "hieeu"],
            "bật": ["bat", "batt"],
            "tắt": ["tat", "tatt"],
            "hiển": ["hien", "hienn"],
            "thị": ["thi", "thii"],
            "ẩn": ["an", "ann"],
            "mở": ["mo", "moo"],
            "đóng": ["dong", "dongg"],
            "làm": ["lam", "lamm"],
            "mới": ["moi", "moii"],
            "tải": ["tai", "taai"],
            "lại": ["lai", "laai"],
            "đặt": ["dat", "datt"],
            "triển": ["trien", "trienn"],
            "khai": ["khai", "khaai"]
        }
    
    def normalize_query(self, query: str) -> str:
        """Normalize query by removing extra spaces and converting to lowercase"""
        # Remove extra whitespace and convert to lowercase
        query = re.sub(r'\s+', ' ', query.strip().lower())
        return query
    
    def correct_spelling(self, query: str) -> str:
        """Correct common Vietnamese spelling mistakes"""
        words = query.split()
        corrected_words = []
        
        for word in words:
            corrected_word = word
            # Check if word needs correction
            for correct_word, typo_variants in self.spell_corrections.items():
                if word in typo_variants:
                    corrected_word = correct_word
                    break
            corrected_words.append(corrected_word)
        
        return ' '.join(corrected_words)
    
    def expand_query(self, query: str) -> str:
        """Expand query with synonyms for better retrieval"""
        words = query.split()
        expanded_terms = []
        
        for word in words:
            # Add original word
            expanded_terms.append(word)
            
            # Add synonyms if found
            if word in self.synonyms:
                expanded_terms.extend(self.synonyms[word])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_terms = []
        for term in expanded_terms:
            if term not in seen:
                seen.add(term)
                unique_terms.append(term)
        
        return ' '.join(unique_terms)
    
    def extract_key_terms(self, query: str) -> List[str]:
        """Extract key terms from query (removing stop words)"""
        # Vietnamese stop words
        stop_words = {
            'và', 'là', 'của', 'có', 'cho', 'trong', 'với', 'để', 'mà', 'nhưng',
            'thì', 'đã', 'sẽ', 'không', 'có', 'được', 'làm', 'nói', 'này', 'kia',
            'đó', 'ở', 'trên', 'dưới', 'vào', 'ra', 'lên', 'xuống', 'tới', 'từ',
            'đến', 'bằng', 'như', 'cũng', 'còn', 'đây', 'đó', 'nay', 'mai', 'qua',
            'sau', 'trước', 'giữa', 'bên', 'cạnh', 'gần', 'xa', 'nhanh', 'chậm',
            'lớn', 'nhỏ', 'mới', 'cũ', 'tốt', 'xấu', 'đẹp', 'rất', 'quá', 'thật',
            'hết', 'đã', 'vẫn', 'luôn', 'thường', 'đôi', 'khi', 'nào', 'đâu',
            'sao', 'vì', 'do', 'bởi', 'tuy', 'dù', 'mặc', 'dù', 'hơn', 'nhất',
            'nhị', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười',
            'một', 'hai', 'ba', 'nhiều', 'ít', 'vài', 'mấy', 'tất', 'cả',
            'mọi', 'các', 'những', 'từng', 'mỗi', 'theo', 'theo', 'từng',
            'đang', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn',
            'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn', 'sẵn'
        }
        
        words = query.split()
        key_terms = [word for word in words if word not in stop_words and len(word) > 1]
        return key_terms
    
    def process_query(self, query: str) -> Dict[str, any]:
        """Complete query processing pipeline"""
        # Step 1: Normalize
        normalized = self.normalize_query(query)
        
        # Step 2: Correct spelling
        corrected = self.correct_spelling(normalized)
        
        # Step 3: Extract key terms
        key_terms = self.extract_key_terms(corrected)
        
        # Step 4: Expand with synonyms
        expanded = self.expand_query(corrected)
        
        return {
            'original': query,
            'normalized': normalized,
            'corrected': corrected,
            'key_terms': key_terms,
            'expanded': expanded,
            'was_corrected': normalized != corrected,
            'was_expanded': corrected != expanded
        }
    
    def get_query_variations(self, query: str, max_variations: int = 3) -> List[str]:
        """Generate query variations for better recall"""
        processed = self.process_query(query)
        variations = [processed['corrected']]
        
        # Add variations with different synonym combinations
        words = processed['corrected'].split()
        if len(words) > 1:
            # Try replacing some words with synonyms
            for i, word in enumerate(words):
                if word in self.synonyms and len(variations) < max_variations:
                    synonym = self.synonyms[word][0]  # Take first synonym
                    variation = words.copy()
                    variation[i] = synonym
                    variations.append(' '.join(variation))
        
        return variations[:max_variations]
