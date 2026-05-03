import sqlite3
conn = sqlite3.connect('./data/wikibot.db')
cursor = conn.cursor()

# Check tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("All tables:", [t[0] for t in tables])
print("AI tables:", [t[0] for t in tables if t[0].startswith('ai_')])

# Check data in ai_safety_config
cursor.execute("SELECT * FROM ai_safety_config")
existing = cursor.fetchall()
print("\nAI Safety Config:", existing)

# Check data in ai_provider_config
cursor.execute("SELECT id, ai_type, provider, local_model_path, embedding_model_name, use_rag_provider FROM ai_provider_config")
existing2 = cursor.fetchall()
print("\nAI Provider Config:", existing2)

# Seed data if empty
if not existing:
    print("\nSeeding ai_safety_config...")
    cursor.execute("""
        INSERT INTO ai_safety_config (id, max_temperature_limit, max_context_length, max_tokens_limit,
                                    default_temperature, default_response_style)
        VALUES (1, 1.0, 8192, 2048, 0.2, 'concise')
    """)
    conn.commit()
    print("Done!")

if not existing2:
    print("\nSeeding ai_provider_config...")
    cursor.execute("""
        INSERT INTO ai_provider_config (id, ai_type, provider, local_model_path, 
            local_context_length, embedding_model_name, use_rag_provider,
            default_temperature, default_max_tokens)
        VALUES 
            (1, 'rag', 'local', './llm_models/qwen2.5-3b-instruct-q4_k_m.gguf', 4096, NULL, 0, 0.3, 512),
            (2, 'embedding', 'local', NULL, NULL, 'paraphrase-multilingual-MiniLM-L12-v2', 0, NULL, NULL),
            (3, 'faq', 'local', NULL, 4096, NULL, 1, 0.2, 256)
    """)
    conn.commit()
    print("Done!")
    
    # Verify
    cursor.execute("SELECT id, ai_type, provider FROM ai_provider_config")
    print("\nVerified AI Provider Config:", cursor.fetchall())

conn.close()
