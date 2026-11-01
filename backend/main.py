from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
import httpx
from qdrant_client import QdrantClient
from config import (AUTH_MODE, COLLECTION_NAME, CORS_ORIGINS, DEV_AUTH_ENABLED,
                    OLLAMA_HOST, OLLAMA_MODEL, OPERATIONAL_DB_PATH, QDRANT_HOST)
from rag_service import RagService
from indexer import index_factory_kb
from operational import OperationalRepository
from risk_service import RiskService

app = FastAPI(title="TexMind AI & RAG Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Credentials and wildcard origins are an unsafe combination.  Explicit
    # origins are configurable for local frontend development and deployment.
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RagService()
operational_repository = OperationalRepository(OPERATIONAL_DB_PATH)
risk_service = RiskService(operational_repository, str(Path(__file__).with_name("factory_data.json")))

# Development identities are server-owned.  A client may choose an identity by
# header but cannot submit an arbitrary role.  Replace this map with SSO claims
# before production (TEXMIND_AUTH_MODE=sso intentionally rejects this mode).
DEV_USERS = {
    "admin": {"id": "admin", "role": "admin"},
    "manager": {"id": "manager", "role": "manager"},
    "supervisor": {"id": "supervisor", "role": "supervisor"},
    "viewer": {"id": "viewer", "role": "viewer"},
}


class Identity(BaseModel):
    id: str
    role: str


def current_identity(x_texmind_user: str | None = Header(default=None)) -> Identity:
    if AUTH_MODE != "development" or not DEV_AUTH_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Operational authentication is not configured")
    user = DEV_USERS.get((x_texmind_user or "").lower())
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Provide a valid X-Texmind-User development identity")
    return Identity(**user)


def require_roles(*allowed_roles: str):
    def dependency(identity: Identity = Depends(current_identity)) -> Identity:
        if identity.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your role cannot perform this operational action")
        return identity
    return dependency

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    role: Optional[str] = "admin"
    buyer_id: Optional[str] = None
    stage: Optional[str] = None


class ProductionEventRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=64)
    stage: str = Field(min_length=1, max_length=64)
    completed_delta: int = Field(default=0, ge=0, le=1_000_000)
    rejected_delta: int = Field(default=0, ge=0, le=1_000_000)
    note: str | None = Field(default=None, max_length=500)


class ProposalRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=3, max_length=160)
    action_type: Literal["overtime", "line_reallocation", "expedite_material", "buyer_update", "other"]
    rationale: str = Field(min_length=3, max_length=1000)


class ProposalDecisionRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)

@app.get("/api/health")
async def health():
    qdrant_ok = False
    ollama_ok = False
    points_count = 0

    # Test Qdrant
    try:
        client = QdrantClient(url=QDRANT_HOST, check_compatibility=False)
        coll = client.get_collection(COLLECTION_NAME)
        qdrant_ok = True
        points_count = coll.points_count or 0
    except Exception as e:
        print("Health check Qdrant error:", e)

    # Test Ollama
    try:
        async with httpx.AsyncClient(timeout=3.0) as http:
            res = await http.get(f"{OLLAMA_HOST}/api/tags")
            ollama_ok = res.status_code == 200
    except Exception as e:
        print("Health check Ollama error:", e)

    return {
        "status": "healthy" if (qdrant_ok and ollama_ok) else "degraded",
        "qdrant": {
            "status": "ok" if qdrant_ok else "error",
            "collection": COLLECTION_NAME,
            "indexed_points": points_count,
        },
        "ollama": {
            "status": "ok" if ollama_ok else "error",
            "model": OLLAMA_MODEL,
        }
    }

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    result = await rag_service.complete_chat(
        messages=msgs,
        role=req.role or "admin",
        buyer_id=req.buyer_id,
        stage=req.stage,
    )
    return result

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty")

    msgs = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_generator():
        async for chunk in rag_service.stream_chat(
            messages=msgs,
            role=req.role or "admin",
            buyer_id=req.buyer_id,
            stage=req.stage,
        ):
            yield chunk

    return StreamingResponse(event_generator(), media_type="text/plain")


@app.get("/api/operational/attention")
async def operational_attention(identity: Identity = Depends(current_identity)):
    """Prioritized, explainable attention items derived from the fixture + event ledger."""
    return {"items": risk_service.attention(), "actor": identity.model_dump(), "source": "fixture-and-event-ledger"}


@app.get("/api/operational/orders/{order_id}/risk")
async def order_risk(order_id: str, _: Identity = Depends(current_identity)):
    risk = risk_service.risk_for_order(order_id)
    if risk is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return risk


@app.post("/api/operational/production-events", status_code=status.HTTP_201_CREATED)
async def submit_production_event(
    payload: ProductionEventRequest,
    identity: Identity = Depends(require_roles("admin", "manager", "supervisor")),
):
    if payload.completed_delta == 0 and payload.rejected_delta == 0:
        raise HTTPException(status_code=422, detail="At least one production delta must be non-zero")
    risk = risk_service.risk_for_order(payload.order_id)
    if risk is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.stage != risk["current_stage"]:
        raise HTTPException(status_code=422, detail="Production events may only update the current order stage")
    event = operational_repository.add_production_event(payload.model_dump(), identity.id)
    return {"event": event, "updated_risk": risk_service.risk_for_order(payload.order_id)}


@app.get("/api/operational/proposals")
async def list_proposals(order_id: str | None = None, _: Identity = Depends(current_identity)):
    return {"items": operational_repository.list_proposals(order_id)}


@app.post("/api/operational/proposals", status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload: ProposalRequest,
    identity: Identity = Depends(require_roles("admin", "manager")),
):
    if risk_service.risk_for_order(payload.order_id) is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return operational_repository.create_proposal(payload.model_dump(), identity.id)


@app.post("/api/operational/proposals/{proposal_id}/approve")
async def approve_proposal(
    proposal_id: str,
    payload: ProposalDecisionRequest,
    identity: Identity = Depends(require_roles("admin", "manager")),
):
    try:
        proposal = operational_repository.decide_proposal(proposal_id, "approved", identity.id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


@app.post("/api/operational/proposals/{proposal_id}/dismiss")
async def dismiss_proposal(
    proposal_id: str,
    payload: ProposalDecisionRequest,
    identity: Identity = Depends(require_roles("admin", "manager")),
):
    try:
        proposal = operational_repository.decide_proposal(proposal_id, "dismissed", identity.id, payload.note)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal

@app.post("/api/reindex")
async def reindex():
    try:
        count = index_factory_kb()
        return {"status": "success", "indexed_points": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
