"""Run with: python -m unittest test_operational.py"""
import os
import tempfile
import unittest

from operational import OperationalRepository
from risk_service import RiskService


class OperationalSliceTests(unittest.TestCase):
    def test_event_updates_deterministic_risk_and_proposal_requires_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = OperationalRepository(os.path.join(directory, "store.sqlite"))
            service = RiskService(repo, os.path.join(os.path.dirname(__file__), "factory_data.json"))
            before = service.risk_for_order("ORD-2026-001")
            repo.add_production_event({"order_id": "ORD-2026-001", "stage": "sewing", "completed_delta": 500, "rejected_delta": 0, "note": None}, "admin")
            after = service.risk_for_order("ORD-2026-001")
            self.assertLess(after["score"], before["score"])
            proposal = repo.create_proposal({"order_id": "ORD-2026-001", "title": "Add overtime", "action_type": "overtime", "rationale": "Recover output"}, "manager")
            self.assertEqual(repo.decide_proposal(proposal["id"], "approved", "admin", None)["status"], "approved")
            with self.assertRaises(ValueError):
                repo.decide_proposal(proposal["id"], "dismissed", "admin", None)


if __name__ == "__main__":
    unittest.main()
