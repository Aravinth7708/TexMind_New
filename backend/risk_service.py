"""Deterministic, explainable order-risk calculation based on the shipped fixture."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from operational import OperationalRepository


class RiskService:
    def __init__(self, repository: OperationalRepository, fixture_path: str):
        self.repository = repository
        self.fixture_path = fixture_path

    def _orders(self) -> list[dict[str, Any]]:
        with open(self.fixture_path, encoding="utf-8") as fixture:
            return json.load(fixture).get("orders", [])

    def _order(self, order_id: str) -> dict[str, Any] | None:
        return next((order for order in self._orders() if order["id"] == order_id), None)

    def risk_for_order(self, order_id: str) -> dict[str, Any] | None:
        order = self._order(order_id)
        if order is None:
            return None
        current = next((stage for stage in order["stages"] if stage["key"] == order["currentStage"]), order["stages"][-1])
        completed_delta, rejected_delta = self.repository.production_totals(order_id, current["key"])
        completed = max(0, current["completed"] + completed_delta)
        target = max(1, current["target"])
        rejection_rate = (current["rejected"] + rejected_delta) / target
        progress = min(100, round((completed / target) * 100, 1))
        remaining_stages = sum(1 for stage in order["stages"] if stage["state"] != "completed")
        score = min(100, round((100 - progress) * 0.38 + rejection_rate * 100 * 1.5 + remaining_stages * 4))
        if order["status"] == "Delayed":
            score = max(score, 85)
        elif order["status"] == "At Risk":
            score = max(score, 65)
        severity = "critical" if score >= 80 else "high" if score >= 60 else "medium" if score >= 35 else "low"
        reasons = []
        if order["status"] in {"Delayed", "At Risk"}:
            reasons.append(f"Order is currently marked {order['status'].lower()} in the operational plan.")
        if progress < 50:
            reasons.append(f"{current['label']} is only {progress}% complete.")
        if rejection_rate >= 0.03:
            reasons.append(f"{current['label']} rejection rate is {rejection_rate:.1%}.")
        if remaining_stages >= 3:
            reasons.append(f"{remaining_stages} production stages still require completion.")
        if not reasons:
            reasons.append("Current stage progress and quality remain within the configured deterministic threshold.")
        return {
            "order_id": order_id, "buyer": order["buyer"], "current_stage": current["key"],
            "score": score, "severity": severity, "progress": progress,
            "rejection_rate": round(rejection_rate, 4), "reasons": reasons,
            "model": "deterministic-fixture-v1", "is_prediction": False,
        }

    def attention(self) -> list[dict[str, Any]]:
        risks = [risk for order in self._orders() if (risk := self.risk_for_order(order["id"]))]
        return sorted((risk for risk in risks if risk["severity"] in {"critical", "high"}), key=lambda risk: risk["score"], reverse=True)
