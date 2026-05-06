"""
Structured Logging Configuration for WikiBot
Provides correlation ID tracking and JSON formatted logs
"""

import structlog
import uuid
import logging
import logging.config
from contextvars import ContextVar
from typing import Any, Dict
from functools import lru_cache

from app.core.config import get_settings

# Context variable for correlation ID tracking
correlation_id: ContextVar[str] = ContextVar('correlation_id', default='')

def get_correlation_id() -> str:
    """Get current correlation ID or generate new one"""
    current_id = correlation_id.get()
    if not current_id:
        current_id = str(uuid.uuid4())
        correlation_id.set(current_id)
    return current_id

def set_correlation_id(cid: str) -> None:
    """Set correlation ID for current context"""
    correlation_id.set(cid)

@lru_cache()
def configure_logging():
    """Configure structured logging with JSON output"""
    settings = get_settings()
    
    # Configure standard logging first
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.processors.JSONRenderer(),
            },
            "console": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.dev.ConsoleRenderer(
                    colors=settings.debug_mode,
                    exception_formatter=structlog.dev.plain_traceback
                ),
            },
            "uvicorn_console": {
                "format": "%(levelprefix)s %(message)s",
                "use_colors": settings.debug_mode,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json" if settings.log_format == "json" else "console",
                "level": settings.log_level,
            },
            "uvicorn": {
                "class": "logging.StreamHandler",
                "formatter": "uvicorn_console",
                "level": "INFO",
            },
        },
        "loggers": {
            "": {
                "handlers": ["console"],
                "level": settings.log_level,
                "propagate": True,
            },
            "uvicorn": {
                "handlers": ["uvicorn"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["uvicorn"],
                "level": "INFO",
                "propagate": False,
            },
            "sqlalchemy": {
                "handlers": ["console"],
                "level": "WARNING",
                "propagate": False,
            },
        },
    }
    
    logging.config.dictConfig(logging_config)
    
    # Configure structlog
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]
    
    # Add correlation ID processor
    def add_correlation_id(logger, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
        event_dict["correlation_id"] = get_correlation_id()
        return event_dict
    
    processors.insert(-1, add_correlation_id)
    
    # Final processor based on format
    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=settings.debug_mode))
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get structured logger with correlation ID support"""
    return structlog.get_logger(name)

class LoggingMixin:
    """Mixin class to add logging capabilities to any class"""
    
    @property
    def logger(self) -> structlog.stdlib.BoundLogger:
        """Get logger for this class"""
        return get_logger(self.__class__.__module__ + "." + self.__class__.__name__)

# Performance timing decorator
def log_performance(logger_name: str = None):
    """Decorator to log function performance"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            import time
            start_time = time.time()
            
            logger = get_logger(logger_name or func.__module__)
            
            try:
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                logger.info("function_completed",
                           function=func.__name__,
                           execution_time=execution_time,
                           success=True)
                
                return result
                
            except Exception as e:
                execution_time = time.time() - start_time
                
                logger.error("function_failed",
                           function=func.__name__,
                           execution_time=execution_time,
                           error=str(e),
                           success=False,
                           exc_info=True)
                
                raise
                
        return wrapper
    return decorator

# Initialize logging on import
configure_logging()
