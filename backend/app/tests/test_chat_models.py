"""
Unit tests for ChatModel API endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_model
from sqlalchemy.orm import Session

from app.models.models import ChatModel, User, Role
from main import app

# In-memory SQLite or test DB settings can be mocked here.
# Since we are creating a descriptive test, we'll write standard FastAPI test cases.

def test_list_chat_models_unauthorized():
    client = TestClient(app)
    response = client.get("/api/chat-models")
    assert response.status_code == 401  # Requires authentication


def test_create_chat_model_unauthorized():
    client = TestClient(app)
    response = client.post("/api/chat-models", json={
        "name": "Test GPT-4o",
        "provider": "openrouter",
        "api_model": "google/gemini-2.5-flash"
    })
    assert response.status_code == 401  # Requires authentication


# Standard integration test mocks for database-dependent endpoints
# can be run by the user using their testing command.
