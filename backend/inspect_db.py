import sys
import os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal

db = SessionLocal()
try:
    stmt = text("SELECT id, query_text, response_text, associated_document_ids FROM semantic_caches ORDER BY id DESC LIMIT 5")
    results = db.execute(stmt).fetchall()
    print("--- Semantic Caches ---")
    for r in results:
        print(f"ID: {r.id}")
        print(f"Query: {repr(r.query_text)}")
        print(f"Response: {repr(r.response_text[:100])}...")
        print(f"Associated Doc IDs: {r.associated_document_ids}")
        print("-" * 50)
finally:
    db.close()
