"""
Confidence Scorer Module
Evaluates the confidence and reliability of generated answers
"""

import re
from typing import List, Dict, Optional, Tuple
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity


class ConfidenceScorer:
    """Scores the confidence of generated answers based on multiple factors"""
    
    def __init__(self, embedding_model: Optional[SentenceTransformer] = None):
        self.embedding_model = embedding_model
        self.confidence_thresholds = {
            'high': 0.8,
            'medium': 0.6,
            'low': 0.4
        }
        
        # Keywords that indicate uncertainty
        self.uncertainty_keywords = [
            'có thể', 'có lẽ', 'nhiều khả năng', 'thường', 'đôi khi',
            'không chắc chắn', 'tùy thuộc', 'có thể là', 'có thể có',
            'dường như', 'có vẻ', 'hình như', 'có thể', 'không rõ',
            'không chắc', 'chưa rõ', 'cần kiểm tra', 'cần xác nhận',
            'theo tôi', 'theo hiểu biết của tôi', 'theo thông tin',
            'có thông tin cho thấy', 'có lẽ', 'có thể là', 'có thể có'
        ]
        
        # Keywords that indicate high confidence
        self.confidence_keywords = [
            'chắc chắn', 'đảm bảo', 'cam kết', 'luôn luôn', 'mọi lúc',
            'theo quy định', 'theo chính sách', 'theo quy trình',
            'bắt buộc', 'yêu cầu', 'quy định rõ', 'nêu rõ',
            'được quy định', 'được nêu rõ', 'theo', 'theo như'
        ]
    
    def score_answer(self, question: str, answer: str, sources: List[Dict], 
                    query_terms: List[str] = None) -> Dict[str, float]:
        """
        Calculate comprehensive confidence score for an answer
        
        Returns:
            Dict with individual scores and overall confidence
        """
        scores = {}
        
        # 1. Source coverage score
        scores['source_coverage'] = self._score_source_coverage(answer, sources)
        
        # 2. Semantic similarity score
        scores['semantic_similarity'] = self._score_semantic_similarity(question, answer, sources)
        
        # 3. Answer completeness score
        scores['answer_completeness'] = self._score_answer_completeness(question, answer)
        
        # 4. Query relevance score
        scores['query_relevance'] = self._score_query_relevance(question, answer, query_terms)
        
        # 5. Source quality score
        scores['source_quality'] = self._score_source_quality(sources)
        
        # 6. Language confidence score
        scores['language_confidence'] = self._score_language_confidence(answer)
        
        # 7. Length appropriateness score
        scores['length_appropriateness'] = self._score_length_appropriateness(question, answer)
        
        # Calculate overall confidence (weighted average)
        weights = {
            'source_coverage': 0.25,
            'semantic_similarity': 0.20,
            'answer_completeness': 0.15,
            'query_relevance': 0.15,
            'source_quality': 0.10,
            'language_confidence': 0.10,
            'length_appropriateness': 0.05
        }
        
        overall_confidence = sum(scores[key] * weights[key] for key in scores)
        scores['overall'] = round(overall_confidence, 3)
        
        return scores
    
    def _score_source_coverage(self, answer: str, sources: List[Dict]) -> float:
        """Score how well the answer is supported by sources"""
        if not sources:
            return 0.1  # Very low confidence if no sources
        
        # Extract key terms from answer
        answer_terms = set(re.findall(r'\b\w+\b', answer.lower()))
        
        # Extract terms from sources
        source_terms = set()
        for source in sources:
            source_content = source.get('content', '').lower()
            source_terms.update(re.findall(r'\b\w+\b', source_content))
        
        # Calculate coverage
        if not answer_terms:
            return 0.0
        
        coverage = len(answer_terms & source_terms) / len(answer_terms)
        
        # Bonus for multiple sources
        source_bonus = min(len(sources) * 0.1, 0.3)
        
        return min(coverage + source_bonus, 1.0)
    
    def _score_semantic_similarity(self, question: str, answer: str, sources: List[Dict]) -> float:
        """Score semantic similarity between answer and sources"""
        if not self.embedding_model or not sources:
            return 0.5  # Default score if no embedding model or sources
        
        try:
            # Get embeddings
            answer_embedding = self.embedding_model.encode([answer])
            
            # Combine all sources into one text
            combined_sources = ' '.join([source.get('content', '') for source in sources])
            source_embedding = self.embedding_model.encode([combined_sources])
            
            # Calculate similarity
            similarity = cosine_similarity(answer_embedding, source_embedding)[0][0]
            
            return max(0.0, min(1.0, float(similarity)))
            
        except Exception as e:
            print(f"[ERROR ConfidenceScorer] Semantic similarity calculation failed: {e}")
            return 0.5
    
    def _score_answer_completeness(self, question: str, answer: str) -> float:
        """Score if the answer directly addresses the question"""
        question_lower = question.lower()
        answer_lower = answer.lower()
        
        # Check if answer is too short
        if len(answer.split()) < 3:
            return 0.2
        
        # Check for question words in answer (indicates addressing the question)
        question_words = ['cái gì', 'thế nào', 'tại sao', 'như thế nào', 'bao nhiêu', 'khi nào', 'ở đâu']
        has_question_words = any(word in question_lower for word in question_words)
        
        # Check if answer contains negation or refusal
        refusal_words = ['không có', 'không tìm thấy', 'không rõ', 'không thể', 'không biết']
        has_refusal = any(word in answer_lower for word in refusal_words)
        
        if has_refusal:
            return 0.3
        
        # Check for specific information (numbers, dates, names)
        has_specific_info = bool(re.search(r'\d+', answer)) or bool(re.search(r'[A-Z][a-z]+', answer))
        
        # Base score
        base_score = 0.6
        
        # Adjustments
        if has_question_words and any(word in answer_lower for word in ['là', 'là gì', 'là như thế nào']):
            base_score += 0.2
        
        if has_specific_info:
            base_score += 0.1
        
        # Penalty for very generic answers
        generic_phrases = ['tùy thuộc', 'có thể', 'nhiều yếu tố', 'nhiều trường hợp']
        if any(phrase in answer_lower for phrase in generic_phrases):
            base_score -= 0.2
        
        return max(0.0, min(1.0, base_score))
    
    def _score_query_relevance(self, question: str, answer: str, query_terms: List[str] = None) -> float:
        """Score relevance of answer to the original query"""
        if not query_terms:
            query_terms = re.findall(r'\b\w+\b', question.lower())
        
        answer_terms = re.findall(r'\b\w+\b', answer.lower())
        
        if not query_terms or not answer_terms:
            return 0.5
        
        # Calculate term overlap
        query_set = set(query_terms)
        answer_set = set(answer_terms)
        
        overlap = len(query_set & answer_set)
        relevance_score = overlap / len(query_set)
        
        # Bonus for answering the specific question type
        question_lower = question.lower()
        if any(word in question_lower for word in ['làm thế nào', 'cách', 'quy trình']):
            if any(step_word in answer.lower() for step_word in ['bước', 'quy trình', 'hướng dẫn']):
                relevance_score += 0.2
        
        elif any(word in question_lower for word in ['là gì', 'định nghĩa']):
            if any(def_word in answer.lower() for def_word in ['là', 'được định nghĩa', 'có nghĩa là']):
                relevance_score += 0.2
        
        elif any(word in question_lower for word in ['tại sao', 'vì sao']):
            if any(reason_word in answer.lower() for reason_word in ['vì', 'do', 'nguyên nhân', 'lý do']):
                relevance_score += 0.2
        
        return max(0.0, min(1.0, relevance_score))
    
    def _score_source_quality(self, sources: List[Dict]) -> float:
        """Score the quality and relevance of sources"""
        if not sources:
            return 0.0
        
        quality_scores = []
        
        for source in sources:
            score = 0.5  # Base score
            
            content = source.get('content', '')
            distance = source.get('distance', 1.0)
            
            # Distance score (lower is better)
            distance_score = max(0.0, 1.0 - distance)
            score += distance_score * 0.3
            
            # Content length score (prefer substantial content)
            if len(content) > 100:
                score += 0.1
            elif len(content) > 50:
                score += 0.05
            
            # Check for structured content
            if any(pattern in content for pattern in [':', '-', '•', '1.', '2.']):
                score += 0.1
            
            quality_scores.append(min(score, 1.0))
        
        # Average quality across all sources
        return sum(quality_scores) / len(quality_scores)
    
    def _score_language_confidence(self, answer: str) -> float:
        """Score based on language patterns indicating confidence"""
        answer_lower = answer.lower()
        
        # Check for uncertainty indicators
        uncertainty_count = sum(1 for phrase in self.uncertainty_keywords if phrase in answer_lower)
        
        # Check for confidence indicators
        confidence_count = sum(1 for phrase in self.confidence_keywords if phrase in answer_lower)
        
        # Base score
        base_score = 0.6
        
        # Adjust based on indicators
        base_score -= uncertainty_count * 0.1
        base_score += confidence_count * 0.1
        
        # Check for hedging language
        hedge_phrases = ['có thể', 'có lẽ', 'dường như', 'hình như']
        hedge_count = sum(1 for phrase in hedge_phrases if phrase in answer_lower)
        base_score -= hedge_count * 0.05
        
        return max(0.0, min(1.0, base_score))
    
    def _score_length_appropriateness(self, question: str, answer: str) -> float:
        """Score if answer length is appropriate for the question"""
        question_words = len(question.split())
        answer_words = len(answer.split())
        
        # Very short answers are less confident
        if answer_words < 5:
            return 0.2
        
        # Very long answers might be unfocused
        if answer_words > question_words * 10:
            return 0.6
        
        # Ideal ratio is 2-5x question length
        ideal_ratio_min = 2
        ideal_ratio_max = 5
        actual_ratio = answer_words / max(question_words, 1)
        
        if ideal_ratio_min <= actual_ratio <= ideal_ratio_max:
            return 0.8
        elif actual_ratio < ideal_ratio_min:
            return 0.5
        else:
            return 0.6
    
    def get_confidence_level(self, confidence_score: float) -> str:
        """Convert confidence score to level"""
        if confidence_score >= self.confidence_thresholds['high']:
            return 'high'
        elif confidence_score >= self.confidence_thresholds['medium']:
            return 'medium'
        elif confidence_score >= self.confidence_thresholds['low']:
            return 'low'
        else:
            return 'very_low'
    
    def should_show_answer(self, confidence_score: float) -> bool:
        """Determine if answer should be shown based on confidence"""
        return confidence_score >= self.confidence_thresholds['low']
    
    def get_confidence_explanation(self, scores: Dict[str, float]) -> str:
        """Generate explanation for confidence score"""
        overall = scores['overall']
        level = self.get_confidence_level(overall)
        
        explanations = []
        
        if scores['source_coverage'] < 0.5:
            explanations.append("Câu trả lời không được hỗ trợ đầy đủ bởi nguồn tài liệu")
        
        if scores['semantic_similarity'] < 0.5:
            explanations.append("Câu trả lời có thể không liên quan chặt chẽ đến tài liệu")
        
        if scores['answer_completeness'] < 0.5:
            explanations.append("Câu trả lời có thể chưa đầy đủ")
        
        if scores['query_relevance'] < 0.5:
            explanations.append("Câu trả lời có thể không trực tiếp giải quyết câu hỏi")
        
        if not explanations:
            if level == 'high':
                return "Câu trả lời có độ tin cậy cao dựa trên các nguồn tài liệu"
            elif level == 'medium':
                return "Câu trả lời có độ tin cậy trung bình"
            else:
                return "Câu trả lời có độ tin cậy thấp, vui lòng kiểm tra kỹ các nguồn"
        
        return ". ".join(explanations)
