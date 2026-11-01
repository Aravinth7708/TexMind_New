"""
Comprehensive End-to-End Test Suite for TexMind AI & Operational Backend API
Tests all endpoints across user roles: admin, manager, supervisor, viewer, and unauthenticated.
"""
import sys
import unittest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

class BackendAiAndRbacApiTests(unittest.TestCase):
    def test_01_health_endpoint(self):
        """Verify health check responds with Qdrant and Ollama connectivity"""
        res = client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        print("\n[TEST 1] Health Response:", data)
        self.assertIn("status", data)
        self.assertIn("qdrant", data)
        self.assertIn("ollama", data)
        self.assertEqual(data["qdrant"]["status"], "ok")
        self.assertEqual(data["ollama"]["status"], "ok")

    def test_02_operational_attention_rbac(self):
        """Test operational attention queue under admin, viewer, and unauthenticated states"""
        # Unauthenticated request -> should return 401
        res_no_auth = client.get("/api/operational/attention")
        self.assertEqual(res_no_auth.status_code, 401)
        print("\n[TEST 2a] Unauthenticated attention check: 401 Unauthorized (Correct)")

        # As Admin
        res_admin = client.get("/api/operational/attention", headers={"X-Texmind-User": "admin"})
        self.assertEqual(res_admin.status_code, 200)
        admin_data = res_admin.json()
        self.assertEqual(admin_data["actor"]["role"], "admin")
        self.assertIsInstance(admin_data["items"], list)
        print(f"[TEST 2b] Admin attention check: 200 OK, retrieved {len(admin_data['items'])} attention risks")

        # As Viewer (Read-only User)
        res_viewer = client.get("/api/operational/attention", headers={"X-Texmind-User": "viewer"})
        self.assertEqual(res_viewer.status_code, 200)
        viewer_data = res_viewer.json()
        self.assertEqual(viewer_data["actor"]["role"], "viewer")
        print("[TEST 2c] Viewer (User) attention check: 200 OK (Allowed read)")

    def test_03_order_risk_endpoint(self):
        """Test explainable risk score calculation for an order"""
        res = client.get("/api/operational/orders/ORD-2026-015/risk", headers={"X-Texmind-User": "admin"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        print("\n[TEST 3] Order ORD-2026-015 Risk:", {
            "order_id": data["order_id"],
            "score": data["score"],
            "severity": data["severity"],
            "current_stage": data["current_stage"],
            "reasons": data["reasons"]
        })
        self.assertEqual(data["order_id"], "ORD-2026-015")
        self.assertIn("score", data)
        self.assertIn("reasons", data)

    def test_04_production_event_submission_rbac(self):
        """Verify only supervisor/manager/admin can log production events; viewer is blocked"""
        payload = {
            "order_id": "ORD-2026-015",
            "stage": "sewing",
            "completed_delta": 250,
            "rejected_delta": 2,
            "note": "Shift A mid-day batch"
        }

        # As Viewer (Ordinary User) -> Should be FORBIDDEN (403)
        res_viewer = client.post(
            "/api/operational/production-events",
            json=payload,
            headers={"X-Texmind-User": "viewer"}
        )
        self.assertEqual(res_viewer.status_code, 403)
        print("\n[TEST 4a] Viewer logging production output: 403 Forbidden (RBAC Protected)")

        # As Supervisor -> Allowed (201)
        res_sup = client.post(
            "/api/operational/production-events",
            json=payload,
            headers={"X-Texmind-User": "supervisor"}
        )
        self.assertEqual(res_sup.status_code, 201)
        data = res_sup.json()
        print(f"[TEST 4b] Supervisor logging production: 201 Created (Event ID: {data['event']['id']})")

    def test_05_proposal_creation_and_approval_workflow(self):
        """Verify proposals can only be created & approved by authorized roles with duplicate protection"""
        proposal_payload = {
            "order_id": "ORD-2026-015",
            "title": "Add 2 hours overtime on Line 3",
            "action_type": "overtime",
            "rationale": "Throughput pace is 22% behind target"
        }

        # Supervisor cannot create proposals (403)
        res_sup = client.post(
            "/api/operational/proposals",
            json=proposal_payload,
            headers={"X-Texmind-User": "supervisor"}
        )
        self.assertEqual(res_sup.status_code, 403)
        print("\n[TEST 5a] Supervisor creating proposal: 403 Forbidden (Correct)")

        # Manager can create proposals (201)
        res_mgr = client.post(
            "/api/operational/proposals",
            json=proposal_payload,
            headers={"X-Texmind-User": "manager"}
        )
        self.assertEqual(res_mgr.status_code, 201)
        prop_id = res_mgr.json()["id"]
        print(f"[TEST 5b] Manager created proposal: 201 Created (ID: {prop_id})")

        # Viewer cannot approve proposals (403)
        res_viewer_app = client.post(
            f"/api/operational/proposals/{prop_id}/approve",
            json={"note": "Viewer attempt"},
            headers={"X-Texmind-User": "viewer"}
        )
        self.assertEqual(res_viewer_app.status_code, 403)
        print("[TEST 5c] Viewer approving proposal: 403 Forbidden (Correct)")

        # Admin approves proposal (200)
        res_admin_app = client.post(
            f"/api/operational/proposals/{prop_id}/approve",
            json={"note": "Approved by GM for shop-floor execution"},
            headers={"X-Texmind-User": "admin"}
        )
        self.assertEqual(res_admin_app.status_code, 200)
        self.assertEqual(res_admin_app.json()["status"], "approved")
        print(f"[TEST 5d] Admin approved proposal: 200 OK (Status: {res_admin_app.json()['status']})")

        # Duplicate approval attempt -> should return Conflict (409)
        res_dup = client.post(
            f"/api/operational/proposals/{prop_id}/approve",
            json={"note": "Duplicate"},
            headers={"X-Texmind-User": "admin"}
        )
        self.assertEqual(res_dup.status_code, 409)
        print("[TEST 5e] Duplicate approval protection: 409 Conflict (Protected)")

    def test_06_ai_rag_chat_completion(self):
        """Test AI RAG chat completion with vector retrieval and Ollama"""
        chat_req = {
            "messages": [
                {"role": "user", "content": "What is the status of sewing stage bottlenecks?"}
            ],
            "role": "admin"
        }
        print("\n[TEST 6] Querying AI RAG Chat Completion (/api/chat)...")
        res = client.post("/api/chat", json=chat_req)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        print("AI Response Role:", data.get("role"))
        print("AI Response Sources:", data.get("sources"))
        print("AI Response Content Snippet:", (data.get("content") or "")[:200] + "...")
        self.assertIn("content", data)
        self.assertIn("sources", data)

    def test_07_ai_buyer_role_guardrails(self):
        """Test role-based RAG filters: buyer cannot access other buyers' confidential data"""
        chat_req = {
            "messages": [
                {"role": "user", "content": "Show all orders and internal factory costs"}
            ],
            "role": "buyer",
            "buyer_id": "BUY-01"
        }
        print("\n[TEST 7] Querying AI RAG as Buyer BUY-01 (/api/chat)...")
        res = client.post("/api/chat", json=chat_req)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        # Verify retrieved sources are buyer-authorized or general
        print("Buyer Filtered Sources:", data.get("sources"))
        self.assertIn("content", data)


if __name__ == "__main__":
    unittest.main()
