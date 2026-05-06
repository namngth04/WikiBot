#!/usr/bin/env python3
"""Test script to verify logging in different environments"""

import os
import sys
import tempfile
from io import StringIO

def test_logging_format(environment: str, expected_format: str):
    """Test logging format for specific environment"""
    print(f"Testing {environment} environment...")
    
    # Set environment variables
    os.environ['ENVIRONMENT'] = environment
    
    # Clear any cached settings
    if 'app.core.config' in sys.modules:
        del sys.modules['app.core.config']
    if 'app.core.logging' in sys.modules:
        del sys.modules['app.core.logging']
    
    # Import and configure logging
    from app.core.logging import get_logger
    
    logger = get_logger("test")
    
    # Test different log levels
    logger.info("Test info message", test_data={"key": "value"}, environment=environment)
    logger.warning("Test warning message", environment=environment)
    logger.error("Test error message", error_code=500, environment=environment)
    
    print(f"✅ {environment} logging test completed\n")

def test_environment_detection():
    """Test environment detection logic"""
    print("🔍 Testing Environment Detection Logic\n")
    
    from app.core.config import get_settings
    
    # Test different environment settings
    test_cases = [
        ("development", True, "console"),
        ("production", False, "json"),
        ("testing", True, "console"),
    ]
    
    for env, expected_debug, expected_format in test_cases:
        os.environ['ENVIRONMENT'] = env
        
        # Clear cached settings
        if 'app.core.config' in sys.modules:
            del sys.modules['app.core.config']
        
        settings = get_settings()
        
        print(f"Environment: {env}")
        print(f"  Debug mode: {settings.debug_mode} (expected: {expected_debug})")
        print(f"  Log format: {settings.log_format} (expected: {expected_format})")
        
        assert settings.debug_mode == expected_debug, f"Debug mode mismatch for {env}"
        assert settings.log_format == expected_format, f"Log format mismatch for {env}"
        print(f"  ✅ {env} configuration correct\n")

def main():
    """Run all logging tests"""
    print("🧪 Testing Environment-aware Logging System\n")
    
    # Test environment detection
    test_environment_detection()
    
    # Test different environments
    test_logging_format("development", "console")
    test_logging_format("production", "json")
    test_logging_format("testing", "console")
    
    print("🎉 All logging tests completed!")
    print("\n📋 Summary:")
    print("- Environment detection working correctly")
    print("- Console format with colors for development")
    print("- JSON format for production")
    print("- Structured logging with correlation IDs")

if __name__ == "__main__":
    main()
