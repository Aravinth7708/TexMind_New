#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi

echo "Starting TexMind AI Backend on port 8008..."
exec .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8008
