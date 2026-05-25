"""
LLM Provider Abstraction Layer
Supports: Local GGUF (llama-cpp), OpenRouter, Ollama, OpenAI
Embedding Provider Abstraction Layer
Supports: Local (SentenceTransformer), OpenAI API
"""

import os
import time
import json
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, TYPE_CHECKING
from cryptography.fernet import Fernet
from openai import OpenAI
# from llama_cpp import Llama  # Disabled in Docker build to save build time

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# httpx is already imported via OpenAI client, we'll use it for OllamaNativeProvider
# No additional imports needed

if TYPE_CHECKING:
    from app.models.models import AIProviderConfig


class BaseLLMProvider(ABC):
    """Base class for all LLM providers"""
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from prompt"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test provider connection"""
        pass
    
    def get_config(self) -> Dict[str, Any]:
        """Get provider configuration"""
        return {}


class LocalGGUFProvider(BaseLLMProvider):
    """Local GGUF model provider using llama-cpp"""
    
    def __init__(self, model_path: str, context_length: int = 4096, **kwargs):
        print(f"[DEBUG LocalGGUF] __init__ called with model_path: {model_path}")
        print(f"[DEBUG LocalGGUF] os.path.exists(model_path): {os.path.exists(model_path)}")
        
        # Try absolute path if relative doesn't work
        if not os.path.exists(model_path):
            abs_path = os.path.abspath(model_path)
            print(f"[DEBUG LocalGGUF] Trying absolute path: {abs_path}")
            print(f"[DEBUG LocalGGUF] os.path.exists(abs_path): {os.path.exists(abs_path)}")
            if os.path.exists(abs_path):
                model_path = abs_path
            else:
                raise FileNotFoundError(f"Model not found: {model_path} (tried absolute: {abs_path})")
        
        self.model_path = model_path
        self.context_length = context_length
        self._llm = None
        self._kwargs = kwargs
        
        print(f"[DEBUG LocalGGUF] Final model_path: {self.model_path}")
        print(f"[DEBUG LocalGGUF] File size: {os.path.getsize(self.model_path) if os.path.exists(self.model_path) else 'N/A'} bytes")
    
    @property
    def llm(self):
        """Lazy load LLM"""
        if self._llm is None:
            print(f"[DEBUG LocalGGUF] Loading model from: {self.model_path}")
            print(f"[DEBUG LocalGGUF] File exists: {os.path.exists(self.model_path)}")
            if os.path.exists(self.model_path):
                print(f"[DEBUG LocalGGUF] File size: {os.path.getsize(self.model_path)} bytes")
            else:
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            try:
                raise ImportError(
                    "Local GGUF execution is disabled in this build to optimize container compilation. "
                    "Please run GGUF models locally via Ollama (http://localhost:11434) and connect using the Ollama provider instead."
                )
            except Exception as e:
                print(f"[ERROR LocalGGUF] Local GGUF is disabled: {e}")
                raise
        return self._llm
    
    def generate(self, prompt: str, temperature: float = 0.2, max_tokens: int = 512, 
                 stop: Optional[list] = None, **kwargs) -> str:
        """Generate with Llama model"""
        output = self.llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=stop or ["</s>", "Trả lời:", "Người dùng:", "Câu hỏi:"],
            echo=False
        )
        return output['choices'][0]['text'].strip()
    
    def test_connection(self) -> Dict[str, Any]:
        """Test local model"""
        import traceback
        start = time.time()
        print(f"[DEBUG LocalGGUF] Testing model at: {self.model_path}")
        print(f"[DEBUG LocalGGUF] Context length: {self.context_length}")
        print(f"[DEBUG LocalGGUF] File exists check: {os.path.exists(self.model_path)}")
        
        try:
            # Try to load and do a simple inference
            print(f"[DEBUG LocalGGUF] Triggering lazy load of LLM...")
            _ = self.llm  # Trigger lazy load
            print(f"[DEBUG LocalGGUF] LLM loaded successfully")
            
            print(f"[DEBUG LocalGGUF] Running test inference...")
            test_output = self.generate("Say 'OK'", max_tokens=5, temperature=0)
            print(f"[DEBUG LocalGGUF] Test inference successful. Output: {test_output}")
            
            latency = (time.time() - start) * 1000
            return {
                "success": True,
                "message": f"Model loaded successfully. Test output: {test_output[:20]}",
                "latency_ms": latency,
                "model_path": self.model_path
            }
        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            print(f"[DEBUG LocalGGUF] ERROR: {error_msg}")
            print(f"[DEBUG LocalGGUF] Traceback:\n{tb}")
            return {
                "success": False,
                "message": f"Failed to load model: {error_msg}",
                "latency_ms": (time.time() - start) * 1000
            }
    
    def get_config(self) -> Dict[str, Any]:
        return {
            "provider": "local",
            "model_path": self.model_path,
            "context_length": self.context_length
        }


class OpenAICompatibleProvider(BaseLLMProvider):
    """OpenAI-compatible API provider (OpenRouter, Ollama, OpenAI)"""
    
    # Valid OpenAI v1.x client parameters (proxies is NOT valid)
    VALID_OPENAI_KEYS = {'timeout', 'max_retries', 'http_client', 'transport',
                         'default_headers', 'default_query'}
    
    # Default timeout for Ollama/local providers (seconds)
    DEFAULT_TIMEOUT = 30
    
    def __init__(self, base_url: str, api_key: str, model: str, **kwargs):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self._client = None
        # Filter kwargs to only valid OpenAI v1.x parameters
        self._kwargs = {k: v for k, v in kwargs.items() if k in self.VALID_OPENAI_KEYS}
    
    @property
    def client(self):
        """Lazy load OpenAI client"""
        if self._client is None:
            print(f"[DEBUG OpenAICompatible] Creating new OpenAI client...")
            client_start = time.time()
            
            # For Ollama and other local providers, use empty string if api_key is None
            api_key = self.api_key or ""
            
            # Create httpx client with proper timeout for Ollama/local providers
            # OpenAI client's default timeout is too short for local LLM inference
            import httpx
            timeout_value = self._kwargs.get('timeout', 30)
            print(f"[DEBUG OpenAICompatible] Using timeout: {timeout_value}s")
            
            # Use a single timeout value for all operations to ensure consistency
            httpx_timeout = httpx.Timeout(timeout_value, connect=timeout_value)
            http_client = httpx.Client(timeout=httpx_timeout)
            
            # Filter out timeout from kwargs since we're passing it via http_client
            other_kwargs = {k: v for k, v in self._kwargs.items() if k != 'timeout'}
            
            openai_start = time.time()
            self._client = OpenAI(
                base_url=self.base_url,
                api_key=api_key,
                http_client=http_client,
                **other_kwargs
            )
            openai_time = time.time() - openai_start
            total_time = time.time() - client_start
            print(f"[DEBUG OpenAICompatible] OpenAI client created in {total_time:.3f}s (OpenAI init: {openai_time:.3f}s)")
            print(f"[DEBUG OpenAICompatible] Base URL: {self.base_url}")
            print(f"[DEBUG OpenAICompatible] Model: {self.model}")
        else:
            print(f"[DEBUG OpenAICompatible] Using existing OpenAI client")
        
        return self._client
    
    def generate(self, prompt: str, temperature: float = 0.2, max_tokens: int = 512,
                 system_prompt: Optional[str] = None, **kwargs) -> str:
        """Generate with OpenAI-compatible API"""
        print(f"[DEBUG OpenAICompatible] generate() called with model: {self.model}")
        print(f"[DEBUG OpenAICompatible] Temperature: {temperature}, Max tokens: {max_tokens}")
        print(f"[DEBUG OpenAICompatible] Prompt length: {len(prompt)} chars")
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        print(f"[DEBUG OpenAICompatible] Making API call to {self.base_url}")
        api_start = time.time()
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        api_time = time.time() - api_start
        content = response.choices[0].message.content
        response_text = content.strip() if content is not None else ""
        
        print(f"[DEBUG OpenAICompatible] API call completed in {api_time:.3f}s")
        print(f"[DEBUG OpenAICompatible] Response length: {len(response_text)} chars")
        print(f"[DEBUG OpenAICompatible] Response model used: {response.model}")
        
        return response_text
    
    def test_connection(self) -> Dict[str, Any]:
        """Test API connection"""
        start = time.time()
        try:
            # Try a simple completion
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Say 'OK'"}],
                max_tokens=5,
                temperature=0
            )
            latency = (time.time() - start) * 1000
            return {
                "success": True,
                "message": f"API connection successful. Model: {self.model}",
                "latency_ms": latency,
                "model": self.model,
                "base_url": self.base_url
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"API connection failed: {str(e)}",
                "latency_ms": (time.time() - start) * 1000,
                "base_url": self.base_url
            }
    
    def get_config(self) -> Dict[str, Any]:
        return {
            "provider": "api",
            "base_url": self.base_url,
            "model": self.model
        }


class OllamaProvider(BaseLLMProvider):
    """Ollama API provider using native /api/generate endpoint
    
    This provider uses Ollama's native API for reliable local connections.
    It directly calls http://localhost:11434/api/generate with httpx.
    """
    
    def __init__(self, base_url: str, model: str, timeout: int = 30, **kwargs):
        self.base_url = base_url.rstrip('/')  # Remove trailing slash
        self.model = model
        self.timeout = timeout
        self.api_url = f"{self.base_url}/api/generate"
    
    def generate(self, prompt: str, temperature: float = 0.2, max_tokens: int = 512,
                 system_prompt: Optional[str] = None, **kwargs) -> str:
        """Generate text using Ollama native /api/generate endpoint"""
        import httpx
        
        # Build the prompt with system prompt if provided
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"
        
        # Prepare request payload
        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        # Make request to Ollama
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    self.api_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                
                # Parse response
                result = response.json()
                return result.get("response", "").strip()
            
        except httpx.TimeoutException:
            raise Exception(f"Request to Ollama timed out after {self.timeout} seconds")
        except httpx.ConnectError as e:
            raise Exception(f"Cannot connect to Ollama at {self.base_url}: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise Exception(f"Ollama API error: {str(e)}")
        except Exception as e:
            raise Exception(f"Unexpected error: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test connection to Ollama using /api/generate"""
        import httpx
        start = time.time()
        
        try:
            # Simple test prompt
            payload = {
                "model": self.model,
                "prompt": "Say 'OK'",
                "stream": False,
                "options": {
                    "temperature": 0,
                    "num_predict": 5
                }
            }
            
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    self.api_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                
                result = response.json()
                latency = (time.time() - start) * 1000
                
                return {
                    "success": True,
                    "message": f"Ollama native API connected. Model: {self.model}",
                    "latency_ms": latency,
                    "model": self.model,
                    "base_url": self.base_url,
                    "test_output": result.get("response", "")[:20]
                }
            
        except httpx.TimeoutException:
            return {
                "success": False,
                "message": f"Connection timed out after {self.timeout} seconds",
                "latency_ms": (time.time() - start) * 1000,
                "base_url": self.base_url
            }
        except httpx.ConnectError as e:
            return {
                "success": False,
                "message": f"Cannot connect to Ollama: {str(e)}",
                "latency_ms": (time.time() - start) * 1000,
                "base_url": self.base_url
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"API connection failed: {str(e)}",
                "latency_ms": (time.time() - start) * 1000,
                "base_url": self.base_url
            }
    
    def get_config(self) -> Dict[str, Any]:
        return {
            "provider": "ollama",
            "base_url": self.base_url,
            "model": self.model,
            "timeout": self.timeout
        }


# ============================================
# Embedding Provider Abstraction
# ============================================

class BaseEmbeddingProvider(ABC):
    """Base class for embedding providers"""
    
    @abstractmethod
    def encode(self, texts: List[str]) -> List[List[float]]:
        """Encode texts to embeddings"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test provider connection"""
        pass


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """Local embedding provider using SentenceTransformer"""
    
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        self.model_name = model_name
        self._model = None
    
    @property
    def model(self):
        """Lazy load model"""
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        return self._model
    
    def encode(self, texts: List[str]) -> List[List[float]]:
        """Encode texts to embeddings"""
        return self.model.encode(texts).tolist()
    
    def test_connection(self) -> Dict[str, Any]:
        """Test local embedding model"""
        start = time.time()
        try:
            _ = self.model  # Trigger lazy load
            test_embedding = self.encode(["test"])
            latency = (time.time() - start) * 1000
            return {
                "success": True,
                "message": f"Embedding model loaded successfully. Model: {self.model_name}",
                "latency_ms": latency,
                "model_name": self.model_name
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to load embedding model: {str(e)}",
                "latency_ms": (time.time() - start) * 1000
            }


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """OpenAI API embedding provider with multimodal support"""
    
    def __init__(self, base_url: str, api_key: str, model: str = "text-embedding-3-small", **kwargs):
        self.base_url = base_url
        self.api_key = api_key
        self.model = model or "text-embedding-3-small"
        self._client = None
        # Filter kwargs to only valid OpenAI v1.x parameters
        self._kwargs = {k: v for k, v in kwargs.items() if k in OpenAICompatibleProvider.VALID_OPENAI_KEYS}
        # Auto-detect multimodal capability
        self.is_multimodal = self._detect_multimodal_model(self.model)
    
    def _detect_multimodal_model(self, model_name: str) -> bool:
        """Detect if model supports multimodal input based on model name"""
        if not model_name or not isinstance(model_name, str):
            return False
        multimodal_keywords = [
            "nemotron-embed-vl",
            "clip",
            "vit",
            "multimodal",
            "vision-language",
            "embed-vl"
        ]
        return any(keyword in model_name.lower() for keyword in multimodal_keywords)
    
    @property
    def client(self):
        """Lazy load OpenAI client"""
        if self._client is None:
            # Create httpx client with proper timeout
            import httpx
            timeout_value = self._kwargs.get('timeout', 30)
            httpx_timeout = httpx.Timeout(timeout_value, connect=timeout_value)
            http_client = httpx.Client(timeout=httpx_timeout)
            
            # Filter out timeout from kwargs
            other_kwargs = {k: v for k, v in self._kwargs.items() if k != 'timeout'}
            
            self._client = OpenAI(
                base_url=self.base_url,
                api_key=self.api_key,
                http_client=http_client,
                **other_kwargs
            )
        return self._client
    
    def encode(self, texts: List[str], images: Optional[List[str]] = None) -> List[List[float]]:
        """Encode texts and/or images using OpenAI API
        
        Args:
            texts: List of text strings
            images: Optional list of image paths (for multimodal models)
        
        Returns:
            List of embedding vectors
        """
        # If not multimodal or no images provided, use text-only encoding
        if not self.is_multimodal or not images:
            return self._encode_text_only(texts)
        
        # Use multimodal encoding
        return self._encode_multimodal(texts, images)
    
    def _encode_text_only(self, texts: List[str]) -> List[List[float]]:
        """Encode texts using OpenAI API (text-only)"""
        # For OpenRouter, we need to handle the raw response directly
        if "openrouter" in self.base_url.lower():
            return self._encode_openrouter(texts)
        else:
            # Use standard OpenAI client for other providers
            response = self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            logger.debug(f"Embedding response success: model={self.model}, count={len(texts)}")
            if response.data:
                logger.debug(f"Generated {len(response.data)} embeddings. Dimension of first vector: {len(response.data[0].embedding) if response.data[0].embedding else 0}")
            
            if response.data is None:
                raise ValueError("API returned None data")
            
            return [item.embedding for item in response.data]
    
    def _encode_openrouter(self, texts: List[str]) -> List[List[float]]:
        """Encode using OpenRouter API directly (bypass OpenAI client parser)"""
        import httpx
        import json
        
        logger.debug(f"Using OpenRouter direct API call for model: {self.model}")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "input": texts
        }
        
        # Use the same httpx client from the OpenAI client
        with httpx.Client(timeout=30) as client:
            response = client.post(
                f"{self.base_url}/embeddings",
                headers=headers,
                json=data
            )
            
            logger.debug(f"OpenRouter raw response status: {response.status_code}")
            
            if response.status_code != 200:
                raise ValueError(f"OpenRouter API error: {response.status_code} - {response.text}")
            
            result = response.json()
            
            # Handle different response structures
            if "data" in result and result["data"] is not None:
                embeddings_data = result["data"]
                logger.debug(f"OpenRouter response success: count={len(embeddings_data)}")
                if len(embeddings_data) > 0 and "embedding" in embeddings_data[0]:
                    logger.debug(f"Dimension of first vector: {len(embeddings_data[0]['embedding'])}")
                return [item["embedding"] for item in embeddings_data]
            elif "embeddings" in result and result["embeddings"] is not None:
                embeddings_data = result["embeddings"]
                logger.debug(f"OpenRouter response success: count={len(embeddings_data)}")
                if len(embeddings_data) > 0:
                    logger.debug(f"Dimension of first vector: {len(embeddings_data[0])}")
                return embeddings_data
            else:
                raise ValueError(f"Unexpected OpenRouter response structure: {result}")
    
    def _encode_multimodal(self, texts: List[str], images: List[str]) -> List[List[float]]:
        """Encode texts and images using multimodal embedding API"""
        import base64
        import httpx
        
        logger.debug(f"Using multimodal encoding for model: {self.model}")
        
        # Convert images to base64
        image_data_list = []
        for img_path in images:
            try:
                with open(img_path, 'rb') as f:
                    img_data = f.read()
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                image_data_list.append(img_base64)
            except Exception as e:
                logger.warning(f"Error converting image to base64: {e}")
                # Fallback: use empty string for failed images
                image_data_list.append("")
        
        # Build multimodal input payload
        inputs = []
        for text, img_data in zip(texts, image_data_list):
            input_item = {
                "type": "multimodal",
                "text": text,
                "image": img_data
            }
            inputs.append(input_item)
        
        # Call API
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "input": inputs
        }
        
        with httpx.Client(timeout=60) as client:  # Longer timeout for images
            response = client.post(
                f"{self.base_url}/embeddings",
                headers=headers,
                json=data
            )
            
            logger.debug(f"Multimodal API response status: {response.status_code}")
            
            if response.status_code != 200:
                raise ValueError(f"Multimodal API error: {response.status_code} - {response.text}")
            
            result = response.json()
            
            # Handle response structure
            if "data" in result and result["data"] is not None:
                embeddings_data = result["data"]
                logger.debug(f"Multimodal API response success: count={len(embeddings_data)}")
                if len(embeddings_data) > 0 and "embedding" in embeddings_data[0]:
                    logger.debug(f"Dimension of first vector: {len(embeddings_data[0]['embedding'])}")
                return [item["embedding"] for item in embeddings_data]
            elif "embeddings" in result and result["embeddings"] is not None:
                embeddings_data = result["embeddings"]
                logger.debug(f"Multimodal API response success: count={len(embeddings_data)}")
                if len(embeddings_data) > 0:
                    logger.debug(f"Dimension of first vector: {len(embeddings_data[0])}")
                return embeddings_data
            else:
                raise ValueError(f"Unexpected multimodal API response structure: {result}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test API connection"""
        logger.info(f"test_connection called for model: {self.model}")
        
        start = time.time()
        try:
            # Test by actually encoding a test text
            embeddings = self.encode(["test"])
            latency = (time.time() - start) * 1000
            return {
                "success": True,
                "message": f"API connection successful. Model: {self.model}",
                "latency_ms": latency,
                "model": self.model,
                "base_url": self.base_url
            }
        except Exception as e:
            logger.error(f"API connection failed for model {self.model}: {str(e)}")
            import traceback
            logger.debug(f"Traceback:\n{traceback.format_exc()}")
            return {
                "success": False,
                "message": f"API connection failed: {str(e)}",
                "latency_ms": (time.time() - start) * 1000,
                "base_url": self.base_url
            }


# ============================================
# Provider Factory & Encryption
# ============================================

class APIKeyEncryption:
    """Encrypt/decrypt API keys for storage"""
    
    def __init__(self):
        settings = get_settings()
        key = settings.encryption_key or os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("ENCRYPTION_KEY not set in environment")
        # Ensure key is bytes
        if isinstance(key, str):
            key = key.encode()
        self.cipher = Fernet(key)
    
    def encrypt(self, plain_text: str) -> str:
        """Encrypt API key"""
        if not plain_text:
            return ""
        return self.cipher.encrypt(plain_text.encode()).decode()
    
    def decrypt(self, encrypted: str) -> str:
        """Decrypt API key"""
        if not encrypted:
            return ""
        try:
            return self.cipher.decrypt(encrypted.encode()).decode()
        except Exception:
            return ""


class ProviderFactory:
    """Factory to create appropriate provider from config"""
    
    @staticmethod
    def create_provider(config: Dict[str, Any]) -> BaseLLMProvider:
        """Create LLM provider from config dict"""
        provider_type = config.get("provider", "local")
        
        if provider_type == "local":
            return LocalGGUFProvider(
                model_path=config["local_model_path"],
                context_length=config.get("local_context_length", 4096)
            )
        elif provider_type == "openrouter":
            # Decrypt API key if needed
            api_key = config.get("api_key", "")
            if api_key and not api_key.startswith("sk-"):
                # Assume encrypted, try decrypt
                try:
                    encryption = APIKeyEncryption()
                    api_key = encryption.decrypt(api_key)
                except:
                    pass  # Use as-is if decryption fails
            
            return OpenAICompatibleProvider(
                base_url=config["api_base_url"],
                api_key=api_key,
                model=config["api_model"],
                timeout=config.get("timeout", 30),
                max_retries=1
            )
        elif provider_type == "ollama":
            # Use native Ollama API for reliable local connections
            return OllamaProvider(
                base_url=config["api_base_url"],
                model=config["api_model"],
                timeout=config.get("timeout", 30)
            )
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")
    
    @staticmethod
    def create_embedding_provider(config: Dict[str, Any]) -> BaseEmbeddingProvider:
        """Create embedding provider from config dict"""
        provider_type = config.get("provider", "local")
        
        if provider_type == "local":
            return LocalEmbeddingProvider(
                model_name=config.get("embedding_model_name", "paraphrase-multilingual-MiniLM-L12-v2")
            )
        elif provider_type in ["openrouter", "ollama", "openai"]:
            # Decrypt API key if needed
            api_key = config.get("api_key", "")
            if api_key and not api_key.startswith("sk-"):
                try:
                    encryption = APIKeyEncryption()
                    api_key = encryption.decrypt(api_key)
                except:
                    pass
            
            print(f"[DEBUG ProviderFactory] API Key decryption result: {'Success' if api_key != config.get('api_key') else 'Failed/Bypassed'}")
            print(f"[DEBUG ProviderFactory] Final API Key starts with: {api_key[:10]}...")
            
            return OpenAIEmbeddingProvider(
                base_url=config["api_base_url"],
                api_key=api_key,
                model=config.get("api_model", "text-embedding-3-small"),
                timeout=config.get("timeout", 30),
                max_retries=1
            )
        else:
            raise ValueError(f"Unknown provider type: {provider_type}")
    
    @staticmethod
    def test_provider_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Test a provider configuration without creating persistent instance"""
        import traceback
        print(f"[DEBUG ProviderFactory] test_provider_config called with provider: {config.get('provider')}")
        try:
            print(f"[DEBUG ProviderFactory] Creating provider...")
            provider = ProviderFactory.create_provider(config)
            print(f"[DEBUG ProviderFactory] Provider created: {type(provider).__name__}")
            
            print(f"[DEBUG ProviderFactory] Calling test_connection...")
            result = provider.test_connection()
            print(f"[DEBUG ProviderFactory] test_connection result: {result}")
            return result
        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            print(f"[DEBUG ProviderFactory] ERROR creating/testing provider: {error_msg}")
            print(f"[DEBUG ProviderFactory] Traceback:\n{tb}")
            return {
                "success": False,
                "message": f"Failed to create provider: {error_msg}"
            }


# ============================================
# Provider Registry (Global cache)
# ============================================

class ProviderRegistry:
    """Registry to cache provider instances for both LLM and Embedding"""
    
    _llm_providers: Dict[str, BaseLLMProvider] = {}
    _embed_providers: Dict[str, BaseEmbeddingProvider] = {}
    _configs: Dict[str, Dict[str, Any]] = {}
    
    @classmethod
    def get_provider(cls, ai_type: str, config: Optional[Dict[str, Any]] = None) -> BaseLLMProvider:
        """Get or create LLM provider for AI type"""
        # Check if config changed
        if config and cls._configs.get(f"llm_{ai_type}") != config:
            cls._llm_providers[ai_type] = ProviderFactory.create_provider(config)
            cls._configs[f"llm_{ai_type}"] = config.copy()
        
        # Return cached or create new
        if ai_type not in cls._llm_providers:
            if config:
                cls._llm_providers[ai_type] = ProviderFactory.create_provider(config)
                cls._configs[f"llm_{ai_type}"] = config.copy()
            else:
                raise ValueError(f"No LLM provider cached for {ai_type} and no config provided")
        
        return cls._llm_providers[ai_type]

    @classmethod
    def get_embedding_provider(cls, ai_type: str, config: Optional[Dict[str, Any]] = None) -> BaseEmbeddingProvider:
        """Get or create embedding provider for AI type"""
        # Check if config changed
        if config and cls._configs.get(f"embed_{ai_type}") != config:
            cls._embed_providers[ai_type] = ProviderFactory.create_embedding_provider(config)
            cls._configs[f"embed_{ai_type}"] = config.copy()
        
        # Return cached or create new
        if ai_type not in cls._embed_providers:
            if config:
                cls._embed_providers[ai_type] = ProviderFactory.create_embedding_provider(config)
                cls._configs[f"embed_{ai_type}"] = config.copy()
            else:
                raise ValueError(f"No embedding provider cached for {ai_type} and no config provided")
        
        return cls._embed_providers[ai_type]
    
    @classmethod
    def clear_provider(cls, ai_type: str):
        """Clear cached provider"""
        cls._llm_providers.pop(ai_type, None)
        cls._embed_providers.pop(ai_type, None)
        cls._configs.pop(f"llm_{ai_type}", None)
        cls._configs.pop(f"embed_{ai_type}", None)
    
    @classmethod
    def clear_all(cls):
        """Clear all cached providers"""
        cls._llm_providers.clear()
        cls._embed_providers.clear()
        cls._configs.clear()


# Convenience functions
def get_llm_provider(ai_type: str, db_session=None) -> BaseLLMProvider:
    """Get LLM provider for AI type, loading config from DB if needed"""
    from sqlalchemy.orm import Session
    from app.models.models import AIProviderConfig
    
    # Try to get from registry first
    if ai_type in ProviderRegistry._llm_providers:
        return ProviderRegistry.get_provider(ai_type)
    
    # Load from database
    if db_session is None:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            config_row = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
        finally:
            db.close()
    else:
        config_row = db_session.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    
    if not config_row:
        # Initialize default config if not exists
        config_row = initialize_default_config(ai_type, db_session)
    
    # Convert to dict
    config = {
        "provider": config_row.provider,
        "local_model_path": config_row.local_model_path,
        "local_context_length": config_row.local_context_length,
        "api_base_url": config_row.api_base_url,
        "api_key": config_row.api_key,
        "api_model": config_row.custom_api_model if config_row.use_custom_model else config_row.api_model,
        "timeout": getattr(config_row, 'timeout', 30),
    }
    
    return ProviderRegistry.get_provider(ai_type, config)


def get_embedding_provider(db_session=None) -> BaseEmbeddingProvider:
    """Get embedding provider, loading config from DB if needed"""
    from sqlalchemy.orm import Session
    from app.models.models import AIProviderConfig
    
    ai_type = "embedding"
    
    # Try to get from registry first
    if ai_type in ProviderRegistry._embed_providers:
        return ProviderRegistry.get_embedding_provider(ai_type)
    
    # Load from database
    if db_session is None:
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            config_row = db.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
        finally:
            db.close()
    else:
        config_row = db_session.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
    
    if not config_row:
        # Initialize default config if not exists
        config_row = initialize_default_config(ai_type, db_session)
    
    # Convert to dict
    config = {
        "provider": config_row.provider,
        "api_base_url": config_row.api_base_url,
        "api_key": config_row.api_key,
        "api_model": config_row.custom_api_model if config_row.use_custom_model else config_row.api_model,
        "embedding_model_name": config_row.embedding_model_name,
        "timeout": getattr(config_row, 'timeout', 30),
    }
    
    return ProviderRegistry.get_embedding_provider(ai_type, config)


def initialize_default_config(ai_type: str, db_session=None):
    """Initialize default config for AI type if not exists in DB"""
    from app.models.models import AIProviderConfig
    from app.core.config import get_settings
    from sqlalchemy.orm import Session
    
    settings = get_settings()
    
    # Determine if we need to create a session
    close_session = False
    if db_session is None:
        from app.core.database import SessionLocal
        db_session = SessionLocal()
        close_session = True
    
    try:
        # Check if config already exists
        config = db_session.query(AIProviderConfig).filter(AIProviderConfig.ai_type == ai_type).first()
        if config:
            return config
        
        # Create default config based on AI type
        if ai_type == "chat":
            config = AIProviderConfig(
                ai_type="chat",
                provider="local",
                local_model_path=settings.model_path,
                local_context_length=settings.model_context_length,
                default_temperature=settings.model_temperature,
                default_max_tokens=settings.model_max_tokens
            )
        elif ai_type == "embedding":
            config = AIProviderConfig(
                ai_type="embedding",
                provider="local",
                embedding_model_name=settings.embedding_model
            )
        elif ai_type == "faq":
            config = AIProviderConfig(
                ai_type="faq",
                provider="local",
                local_model_path=settings.model_path,
                local_context_length=settings.model_context_length,
                use_rag_provider=True,  # Use RAG provider by default
                default_temperature=settings.model_temperature,
                default_max_tokens=settings.model_max_tokens
            )
        else:
            raise ValueError(f"Unknown AI type: {ai_type}")
        
        db_session.add(config)
        db_session.commit()
        db_session.refresh(config)
        
        return config
    finally:
        if close_session:
            db_session.close()
