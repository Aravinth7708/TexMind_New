"""Small, dependency-free operational store for the first TexMind vertical slice."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class OperationalRepository:
    def __init__(self, database_path: str):
        self.database_path = database_path
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS production_events (
                    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, stage TEXT NOT NULL,
                    completed_delta INTEGER NOT NULL, rejected_delta INTEGER NOT NULL,
                    note TEXT, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS proposals (
                    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, title TEXT NOT NULL,
                    action_type TEXT NOT NULL, rationale TEXT NOT NULL,
                    status TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
                    decided_by TEXT, decided_at TEXT, decision_note TEXT
                );
                """
            )

    def production_totals(self, order_id: str, stage: str) -> tuple[int, int]:
        with self._connect() as connection:
            row = connection.execute(
                """SELECT COALESCE(SUM(completed_delta), 0) AS completed,
                          COALESCE(SUM(rejected_delta), 0) AS rejected
                   FROM production_events WHERE order_id = ? AND stage = ?""",
                (order_id, stage),
            ).fetchone()
        return int(row["completed"]), int(row["rejected"])

    def add_production_event(self, payload: dict[str, Any], recorded_by: str) -> dict[str, Any]:
        event = {"id": f"evt_{uuid4().hex[:12]}", **payload, "recorded_by": recorded_by, "recorded_at": utc_now()}
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO production_events VALUES
                (:id, :order_id, :stage, :completed_delta, :rejected_delta, :note, :recorded_by, :recorded_at)""",
                event,
            )
        return event

    def create_proposal(self, payload: dict[str, Any], created_by: str) -> dict[str, Any]:
        proposal = {
            "id": f"prp_{uuid4().hex[:12]}", **payload, "status": "pending",
            "created_by": created_by, "created_at": utc_now(), "decided_by": None,
            "decided_at": None, "decision_note": None,
        }
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO proposals VALUES
                (:id, :order_id, :title, :action_type, :rationale, :status, :created_by,
                 :created_at, :decided_by, :decided_at, :decision_note)""",
                proposal,
            )
        return proposal

    def list_proposals(self, order_id: str | None = None) -> list[dict[str, Any]]:
        sql = "SELECT * FROM proposals"
        params: tuple[str, ...] = ()
        if order_id:
            sql += " WHERE order_id = ?"
            params = (order_id,)
        sql += " ORDER BY created_at DESC"
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(sql, params).fetchall()]

    def decide_proposal(self, proposal_id: str, status: str, decided_by: str, note: str | None) -> dict[str, Any] | None:
        with self._connect() as connection:
            existing = connection.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone()
            if existing is None:
                return None
            if existing["status"] != "pending":
                raise ValueError("Only pending proposals can be decided")
            connection.execute(
                """UPDATE proposals SET status = ?, decided_by = ?, decided_at = ?, decision_note = ?
                   WHERE id = ?""",
                (status, decided_by, utc_now(), note, proposal_id),
            )
            return dict(connection.execute("SELECT * FROM proposals WHERE id = ?", (proposal_id,)).fetchone())
