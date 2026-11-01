import os

QDRANT_HOST = os.getenv("QDRANT_HOST", "http://localhost:6333")
COLLECTION_NAME = "texmind_factory_kb"
VECTOR_DIM = 384

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b-cloud")
EMBED_MODEL_NAME = "BAAI/bge-small-en-v1.5"

# Operational API settings.  This is deliberately a development boundary, not a
# replacement for SSO: callers select a seeded user by header and the server
# resolves their permissions.  Production must set TEXMIND_AUTH_MODE=sso and
# replace this dependency with the organisation identity provider.
AUTH_MODE = os.getenv("TEXMIND_AUTH_MODE", "development")
DEV_AUTH_ENABLED = os.getenv("TEXMIND_DEV_AUTH_ENABLED", "true").lower() == "true"
OPERATIONAL_DB_PATH = os.getenv(
    "TEXMIND_OPERATIONAL_DB_PATH",
    os.path.join(os.path.dirname(__file__), "texmind_operational.sqlite3"),
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "TEXMIND_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:8080,http://localhost:8081,http://localhost:8082,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:8082,*"
    ).split(",")
    if origin.strip()
]
