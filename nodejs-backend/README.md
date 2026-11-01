# TexMind Node.js Backend

A production-ready Express & TypeScript backend with SQLite (`better-sqlite3`), JWT cookie-based authentication, and role-based access control.

## 🔑 Cookie Expiry Policy
- **Admin & Manager**: 10 days (`10d`)
- **Other Users** (supervisor, viewer, buyer, process incharge): 30 days (`30d`)
- Stored as `httpOnly`, `sameSite: "strict"` cookie named `texmind_token`.

---

## 🚀 Quick Start

```bash
# 1. Navigate to directory
cd nodejs-backend

# 2. Install dependencies
npm install

# 3. Seed database with factory fixture data
npm run seed

# 4. Start in development mode (auto-reload)
npm run dev

# Or build & run production
npm run build
npm start
```

Default port: **`3001`** (configurable via `.env`)

---

## 🧪 Testing the API

```bash
# Run the automated test suite (tests all 28 modules across all roles, portals, intelligence engines, and Factory Operations)
npm test
```

---

## 🔐 Default Seed Credentials

| Role | Email | Password | Cookie Expiry | Scoped Data |
|------|-------|----------|---------------|-------------|
| **Admin** | `admin@texmind.in` | `texmind@admin` | **10 days** | Full factory |
| **Manager** | `manager@texmind.in` | `texmind` | **10 days** | Full factory |
| **Buyer** | `buyer@texmind.in` | `buyer@123` | **30 days** | `BUY-01` (ABC Fashion) only |
| **Process (Sewing)** | `sewing@texmind.in` | `sewing@123` | **30 days** | `sewing` stage |
| *(All other 8 stages)* | `<stage>@texmind.in` | `<stage>@123` | **30 days** | Respective stage |

---

## 📋 Comprehensive API Route Reference

### 1. Auth (`/api/auth`)
- `POST /api/auth/login` — Login, issues role-dependent JWT httpOnly cookie (10d for admin/manager, 30d for buyer/others)
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Get current user profile, role & buyerId/stage

### 2. Operational Decision Support Engine (`/api/operational`)
- `GET /api/operational/attention` — Prioritized risk attention queue matching `operational-client.ts` schema
- `GET /api/operational/orders/:orderId/risk` — Deterministic risk score & bottleneck signals for a specific order
- `GET /api/operational/proposals` — List all floor recovery proposals matching client schema
- `POST /api/operational/proposals/:proposalId/approve` — Human-in-the-loop approval of proposal (idempotent with 409 guard)
- `POST /api/operational/proposals/:proposalId/dismiss` — Operator dismissal of proposal with optional note

### 3. Orders & Delay Prediction Engine (`/api/orders`)
- `GET /api/orders` — List orders (filters: `status`, `buyer_id`, `stage`, `priority`, `search`)
- `GET /api/orders/:id` — Full order details with all 9 stage progress rows
- `GET /api/orders/:id/prediction` — ML Delay Prediction with `confidenceScore`, `predictedDelayDays`, stage pace gaps, root causes, and simulated recovery scenarios
- `POST /api/orders/:id/buyer-notice` — Dispatches approved milestone notice directly to Buyer Trust Portal
- `POST /api/orders/:id/recovery-scenarios/:scId/approve` — Approves and stages floor recovery action into production schedule
- `GET /api/orders/:id/inspection-report` — Formal physical/chemical textile lab certificate (AQL 1.5 pass, ISO/ASTM test specs)
- `POST /api/orders/:id/sync` — Synchronizes order telemetry with shop-floor biometric and machine sensors
- `POST /api/orders` — Create order + auto-generates 9 stages
- `PATCH /api/orders/:id` — Update order status, delivery date, progress
- `DELETE /api/orders/:id` — Archive / complete order

### 4. Production Floor & Work-Order Assignments (`/api/production`)
- `GET /api/production` — Summary of all 9 stages
- `GET /api/production/:stage` — Stage details, active orders, aggregate stats, recent events
- `GET /api/production/:stage/orders` — Orders currently at that stage
- `POST /api/production/events` — Submit completed / rejected count delta with audit trail
- `GET /api/production/assignments` — List released work-order assignments (supports `?order_id=...` filter)
- `POST /api/production/assignments` — Release work-order assignments across 9 stages in kg and pcs with stage incharge assignments

### 5. Inventory Forecasts & Replenishment Reorders (`/api/inventory`)
- `GET /api/inventory` — Raw materials & accessories with computed availability & safety alerts
- `GET /api/inventory/forecasts` — Dynamic runout forecasts, burn rates, days of cover remaining, and projected stockout dates
- `POST /api/inventory/reorder` — Drafts replenishment purchase order (PO) triggered by low stock warnings
- `GET /api/inventory/reorders` — Lists all replenishment purchase orders with procurement statuses
- `PATCH /api/inventory/:name` — Update stock levels

### 6. Analytics, Risk Radar & Root Cause Dossiers (`/api/analytics`)
- `GET /api/analytics/risk-radar` — 5-Dimension Factory Risk Radar (Production, Delivery, Inventory, Quality, Bottleneck) with tones and scores
- `GET /api/analytics/root-causes` — Comprehensive list of active operational root cause dossiers
- `GET /api/analytics/root-causes/:id` — In-depth 5-Whys diagnostic dossier, telemetry signals, historical precedents, and corrective actions
- `GET /api/analytics/production-trend` — Output trend across stages
- `GET /api/analytics/stage-performance` — Stage efficiency metrics
- `GET /api/analytics/rejection-rates` — Scrap & defect rates per stage
- `GET /api/analytics/buyer-performance` — Buyer order fulfillment performance

### 7. AI Copilot & Streaming Chat (`/api/chat`)
- `POST /api/chat` — Factory Intelligence Assistant grounded in live SQLite database (delayed orders, inventory stockouts, QC defects, supporting Tamil/Tanglish)
- `POST /api/chat/stream` — Chunked token streaming endpoint for instant typewriter UI response in the chat modal

### 8. Reports & Export Engine (`/api/reports`)
- `GET /api/reports/types` — List 6 standard factory reports (Daily Production, Weekly Production, Order Performance, Delay Analysis, Material Inventory, Factory Efficiency & OEE)
- `POST /api/reports/generate` — Computes aggregate factory metrics across all 9 stages for the chosen report type
- `POST /api/reports/export` — Formatted CSV / JSON export engine for downloadable spreadsheets

### 9. Workforce & Capacity Planning (`/api/capacity`)
- `GET /api/capacity/lines` — List all production and sewing lines with operator staffing, skill distribution matrix, target vs actual hourly rates, and bottleneck status
- `POST /api/capacity/rebalance` — Rebalance operators between lines with over-capacity guardrails, status recalculation, and supervisor audit ledger

### 10. AI Multi-Agents Orchestrator (`/api/agents`)
- `GET /api/agents` — List multi-agents (Production, Inventory, Quality, Delivery, Knowledge, Report) with active tasks, confidence %, findings, and proposed actions
- `POST /api/agents/proposals/:id/approve` — Human-in-the-loop approval of an agent's operational proposal with notification broadcast
- `POST /api/agents/proposals/:id/dismiss` — Dismiss an agent's proposal with operator notes

### 11. AI Scenario Planner & Recovery Simulator (`/api/scenario`)
- `POST /api/scenario/simulate` — Interactive recovery simulator adjusting overtime hours, extra operators, and subcontracting quantity. Computes projected recovery date, days saved, labor costing (₹), and delivery feasibility risk score.

### 12. Factory Settings & Profile (`/api/settings`)
- `GET /api/settings` — Get factory profile (Tiruppur address, GST, daily capacity), 9-stage toggles, and notification preferences
- `PATCH /api/settings` — Update factory profile and preferences (Admin / Manager only)

### 13. Unified Global Search (`/api/search`)
- `GET /api/search?q=:query` — Indexed multi-entity search spanning across Orders, Buyers, Materials, Ingested Documents, and Quality Inspections (with automatic buyer-tenant scoping)

### 14. Quality Intelligence & Vision QC (`/api/qc`)
- `GET /api/qc/summary` — Factory-wide QC KPIs: total inspections, overall pass rate %, defect count, rework count
- `GET /api/qc/inspections` — List visual inspections (filters: `stage`, `result`, `order_id`, `line`)
- `GET /api/qc/inspections/:id` — Detailed inspection record with defect bounding boxes, confidence score, and primary defect
- `POST /api/qc/inspections` — Run AI visual scan on garment / fabric feed (computes result `PASS`/`FAIL`, defect tags, coordinates, and triggers supervisor alerts)
- `POST /api/qc/inspections/:id/disposition` — Operator / QA lead disposition decision (`ACCEPT`, `REWORK`, `SCRAP`) with notes
- `GET /api/qc/heatmap` — 9-stage defect density matrix for identifying trouble hotspots
- `GET /api/qc/pareto` — Pareto analysis of defect frequency & cumulative percentage (80/20 rule)
- `GET /api/qc/drilldowns` — Root cause breakdown by production line, defect anomalies, and repeat failure patterns

### 15. Document Intelligence & OCR (`/api/documents`)
- `GET /api/documents` — List all ingested documents (supports filter by `status` and `type`)
- `GET /api/documents/:id` — Single document specs with full size breakdowns and colorways
- `POST /api/documents/ingest` — Ingest Tech-Pack or PO, calculates AI confidence score (93–98%) with initial `Needs Review` status
- `PATCH /api/documents/:id` — Review-and-edit extracted specs before order commitment
- `POST /api/documents/:id/confirm` — **Review-and-Confirm Guardrail Action**: Marks document as `Verified`, initializes brand-new Production Order with all 9 stages in ERP, and links work order ID
- `DELETE /api/documents/:id` — Delete unconfirmed document

### 16. Supervisor & Process Mode (`/api/supervisor`)
- `POST /api/supervisor/voice-parse` — Intelligent parser for Tamil/Tanglish/English speech-to-text transcripts (extracts order, stage, completed/rejected pieces, line, shift)
- `POST /api/supervisor/quick-log` — Rapid shop-floor output entry (completed + rejected deltas, line, shift, photo, operator audit). *(Security: Process incharge can only log output for their assigned stage; cross-stage returns 403)*
- `POST /api/supervisor/batch-sync` — Syncs local offline queued production logs when shop-floor Wi-Fi reconnects
- `GET /api/supervisor/stage/:stage` — Live stage dashboard (target, completed, pending, rejected, efficiency %, line breakdown, recent events)
- `POST /api/supervisor/stage/:stage/assign` — Update stage manager, target run rate, and expected completion date

### 17. Buyer Portal (`/api/buyer`)
- `GET /api/buyer/dashboard` — Buyer-scoped KPIs, 7-day production trend, recent orders, milestone alerts
- `GET /api/buyer/orders` — List orders belonging **only** to the authenticated buyer (filter by `status`, `q`, `page`)
- `GET /api/buyer/orders/:id` — Single order detail with all 9 stages + verified milestone notice. *(Security: returns 403 if order belongs to another buyer)*
- `GET /api/buyer/orders/:id/inspection-report` — Scoped inspection certificate pass for buyer download
- `GET /api/buyer/profile` — Buyer company profile & lifetime order metrics
- `PATCH /api/buyer/profile` — Update company profile & contact info
- `GET /api/buyer/notifications` — Buyer-specific alerts & notifications
- `PATCH /api/buyer/notifications/:id/read` — Mark notification as read
- `PATCH /api/buyer/notifications/read-all` — Mark all buyer notifications read

### 18. Dashboard (`/api/dashboard`)
- `GET /api/dashboard/summary` — Factory KPIs (orders, health %, on-time rate, critical stock)
- `GET /api/dashboard/health-breakdown` — Order status breakdown
- `GET /api/dashboard/target-vs-actual` — Target vs actual output by stage
- `GET /api/dashboard/stage-performance` — Stage efficiency %
- `GET /api/dashboard/stage-summaries` — All 9 stages live workload & progress
- `GET /api/dashboard/production-trend` — Stage produced vs pending
- `GET /api/dashboard/insights` — Dynamic AI warning & alert cards
- `GET /api/dashboard/bottlenecks` — Bottleneck stages sorted by pending qty
- `GET /api/dashboard/order-status-split` — Order count by status

### 19. Buyers Management (`/api/buyers`)
- `GET /api/buyers` — List all buyers with stats
- `GET /api/buyers/:id` — Single buyer
- `GET /api/buyers/:id/orders` — All orders for a buyer
- `POST /api/buyers` — Register new buyer
- `PATCH /api/buyers/:id` — Update buyer details

### 20. Notifications (`/api/notifications`)
- `GET /api/notifications` — Admin-scoped notification list
- `PATCH /api/notifications/:id/read` — Mark notification read
- `PATCH /api/notifications/read-all` — Mark all read

### 21. Proposals (`/api/proposals`)
- `GET /api/proposals` — List recovery proposals
- `POST /api/proposals` — Create recovery proposal
- `POST /api/proposals/:id/approve` — One-way approval with identity audit
- `POST /api/proposals/:id/dismiss` — One-way dismissal with note

### 22. User Management (`/api/users`) — Admin Only
- `GET /api/users` — List system users
- `POST /api/users` — Create user with role validation
- `PATCH /api/users/:id` — Update user details or password
- `DELETE /api/users/:id` — Delete user

### 23. Health (`/api/health`)
- `GET /api/health` — DB connection & table counts
