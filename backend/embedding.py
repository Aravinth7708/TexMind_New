"""Lazy, serverless-safe loader for the FastEmbed model."""

from pathlib import Path
from threading import Lock

from fastembed import TextEmbedding

from config import EMBED_MODEL_NAME, FASTEMBED_CACHE_DIR

_model: TextEmbedding | None = None
_model_lock = Lock()


def get_embedding_model() -> TextEmbedding:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                if FASTEMBED_CACHE_DIR:
                    Path(FASTEMBED_CACHE_DIR).mkdir(parents=True, exist_ok=True)
                _model = TextEmbedding(
                    model_name=EMBED_MODEL_NAME,
                    cache_dir=FASTEMBED_CACHE_DIR,
                )
    return _model
