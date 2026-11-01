import json
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny
from config import QDRANT_HOST, COLLECTION_NAME, OLLAMA_HOST, OLLAMA_MODEL
from embedding import get_embedding_model

class RagService:
    def __init__(self):
        self.qdrant = QdrantClient(url=QDRANT_HOST, check_compatibility=False)

    def build_role_filter(self, role: str, buyer_id: Optional[str] = None, stage: Optional[str] = None) -> Optional[Filter]:
        role = (role or "admin").lower()

        if role == "admin":
            # Admin has full visibility
            return None

        if role == "buyer":
            # Buyer can only see documents where buyer_id matches their ID
            buyer_val = buyer_id or "BUY-01"
            return Filter(
                must=[
                    FieldCondition(key="allowed_roles", match=MatchAny(any=["buyer"])),
                    FieldCondition(key="buyer_id", match=MatchValue(value=buyer_val)),
                ]
            )

        if role == "process":
            # Process incharge can see stage metrics, bottlenecks, and orders in their stage or process docs
            must_conditions = [
                FieldCondition(key="allowed_roles", match=MatchAny(any=["process"])),
            ]
            if stage:
                must_conditions.append(
                    FieldCondition(key="stage_key", match=MatchValue(value=stage.lower()))
                )
            return Filter(must=must_conditions)

        return None

    def retrieve_context(
        self,
        query: str,
        role: str,
        buyer_id: Optional[str] = None,
        stage: Optional[str] = None,
        top_k: int = 6
    ) -> List[Dict[str, Any]]:
        # Generate query embedding
        query_vector = list(get_embedding_model().embed([query]))[0].tolist()
        role_filter = self.build_role_filter(role, buyer_id, stage)

        try:
            # Query Qdrant
            results = self.qdrant.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=role_filter,
                limit=top_k,
                with_payload=True,
            )
            points = results.points
        except Exception as e:
            print("Qdrant query error, fallback to search:", e)
            try:
                points = self.qdrant.search(
                    collection_name=COLLECTION_NAME,
                    query_vector=query_vector,
                    query_filter=role_filter,
                    limit=top_k,
                )
            except Exception as search_err:
                print("Search failed:", search_err)
                points = []

        retrieved = []
        for p in points:
            payload = p.payload or {}
            retrieved.append({
                "id": str(p.id),
                "score": getattr(p, "score", 1.0),
                "title": payload.get("title", ""),
                "doc_type": payload.get("doc_type", ""),
                "text": payload.get("text", ""),
            })

        return retrieved

    def generate_system_prompt(self, role: str, buyer_id: Optional[str], stage: Optional[str]) -> str:
        base_role_info = f"Active User Role: {role.upper()}."
        if role == "buyer":
            base_role_info += f" Buyer ID: {buyer_id or 'BUY-01'}."
        elif role == "process":
            base_role_info += f" Stage: {stage.upper() if stage else 'General'}."

        return f"""You are the TexMind AI Factory Intelligence Assistant, an intelligent operations copilot for textile and garment manufacturing.
{base_role_info}

CRITICAL INSTRUCTIONS:
1. When the user asks for orders, stage metrics, materials, or lists, ALWAYS format the data into a clean, comprehensive GFM Markdown Table with relevant headers (e.g., | Order ID | Buyer | Product | Style | Stage | Quantity | Status | Delivery |).
2. For delayed orders or bottlenecks, provide concise root-cause analysis and actionable recommendations.
3. Keep responses authoritative, crisp, and data-driven.
4. Restrict your responses to the provided context and active role permissions. If the user is a buyer, never disclose internal factory costs or other buyers' data. If the user is a process incharge, focus on their specific stage.
5. Use bullet points for takeaways and bold text for key figures."""

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        role: str = "admin",
        buyer_id: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        user_query = messages[-1]["content"] if messages else ""
        context_docs = self.retrieve_context(user_query, role, buyer_id, stage, top_k=8)

        context_text = "\n\n---\n\n".join([
            f"[{d['doc_type'].upper()}] {d['title']}:\n{d['text']}"
            for d in context_docs
        ])

        system_prompt = self.generate_system_prompt(role, buyer_id, stage)
        augmented_prompt = f"""Factory Operational Context (Retrieved via RAG):
{context_text}

User Question:
{user_query}

Provide a helpful, direct response. If tabular data is appropriate, include a structured Markdown table."""

        ollama_messages = [
            {"role": "system", "content": system_prompt},
        ]
        # Include conversation history (last 4 turns)
        for msg in messages[:-1][-4:]:
            ollama_messages.append({"role": msg["role"], "content": msg["content"]})

        ollama_messages.append({"role": "user", "content": augmented_prompt})

        url = f"{OLLAMA_HOST}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": True,
            "options": {
                "temperature": 0.2,
            }
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
            except Exception as e:
                yield f"\n\n[Error generating response: {str(e)}]"

    async def complete_chat(
        self,
        messages: List[Dict[str, str]],
        role: str = "admin",
        buyer_id: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> Dict[str, Any]:
        user_query = messages[-1]["content"] if messages else ""
        context_docs = self.retrieve_context(user_query, role, buyer_id, stage, top_k=8)

        context_text = "\n\n---\n\n".join([
            f"[{d['doc_type'].upper()}] {d['title']}:\n{d['text']}"
            for d in context_docs
        ])

        system_prompt = self.generate_system_prompt(role, buyer_id, stage)
        augmented_prompt = f"""Factory Operational Context (Retrieved via RAG):
{context_text}

User Question:
{user_query}

Provide a helpful, direct response. If tabular data is appropriate, include a structured Markdown table."""

        ollama_messages = [
            {"role": "system", "content": system_prompt},
        ]
        for msg in messages[:-1][-4:]:
            ollama_messages.append({"role": msg["role"], "content": msg["content"]})
        ollama_messages.append({"role": "user", "content": augmented_prompt})

        url = f"{OLLAMA_HOST}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "messages": ollama_messages,
            "stream": False,
            "options": {
                "temperature": 0.2,
            }
        }

        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, json=payload)
            res_json = response.json()
            content = res_json.get("message", {}).get("content", "")
            return {
                "role": "ai",
                "content": content,
                "sources": [d["title"] for d in context_docs if d["title"]],
            }
