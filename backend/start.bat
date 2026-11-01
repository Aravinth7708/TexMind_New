@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    .venv\Scripts\pip install fastapi uvicorn httpx pydantic python-dotenv qdrant-client fastembed
)
echo Starting TexMind AI & RAG Backend on http://127.0.0.1:8008...
.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8008
pause
