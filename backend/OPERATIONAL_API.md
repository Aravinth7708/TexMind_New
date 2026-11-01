# TexMind operational API (first vertical slice)

This API turns the shipped `factory_data.json` fixture into an explainable
operational-risk demo.  It is not a statistical delivery-date model: every
risk response identifies itself as `deterministic-fixture-v1` and
`is_prediction: false`.

## Development identity boundary

Operational routes require `X-Texmind-User` to be one of `admin`, `manager`,
`supervisor`, or `viewer`. The server resolves the role; a role in a request
body is never trusted. This is only suitable for local development.

Before production, set `TEXMIND_AUTH_MODE=sso` and replace `current_identity`
in `main.py` with verified organisation SSO/JWT claims. Leaving that setting
enabled without the replacement intentionally returns `503` for operational
routes. Chat endpoints retain their prior contract for compatibility.

## Routes

- `GET /api/operational/attention` — prioritised high/critical order risks.
- `GET /api/operational/orders/{order_id}/risk` — score, severity, evidence,
  and current-stage progress.
- `POST /api/operational/production-events` — manager, admin, or supervisor;
  writes a positive completed/rejected delta only to the current stage.
- `GET /api/operational/proposals` — lists recovery proposals.
- `POST /api/operational/proposals` — manager or admin creates a proposal.
- `POST /api/operational/proposals/{id}/approve` and `/dismiss` — manager or
  admin records a one-way decision with an audit identity and timestamp.

Events and proposals are stored in the SQLite file configured by
`TEXMIND_OPERATIONAL_DB_PATH` (default: `backend/texmind_operational.sqlite3`).
For a production rollout replace it with the team's managed transactional data
store, migrations, backups, and immutable audit logging.

## Local test

Run `./.venv/bin/python -m unittest test_operational.py` from `backend/`.
