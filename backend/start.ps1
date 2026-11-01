Set-Location -Path $PSScriptRoot
if (!(Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    & "C:\Users\AAKASH\AppData\Local\Programs\Python\Python311\python.exe" -m venv .venv
    & .venv\Scripts\pip.exe install fastapi uvicorn httpx pydantic python-dotenv qdrant-client fastembed
}
Write-Host "Starting TexMind AI & RAG Backend on http://127.0.0.1:8008..." -ForegroundColor Green
& .venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8008
