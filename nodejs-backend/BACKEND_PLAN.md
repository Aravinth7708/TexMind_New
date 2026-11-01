# TexMind Node.js Backend — Build Plan

## Stack
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **DB**: SQLite (via better-sqlite3) — mirrors existing Python backend pattern
- **Auth**: JWT (cookie-based) — 30 days for user/buyer/process roles, 10 days for admin
- **Validation**: Zod
- **Password hashing**: bcrypt

---

## Phase 1: Admin APIs (current scope)

### Auth & Session
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/login | Login, set httpOnly JWT cookie |
| POST | /api/auth/logout | Clear cookie |
| GET | /api/auth/me | Get current session identity |

### Dashboard
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/dashboard/summary | totals, health, onTimeRate |
| GET | /api/dashboard/health-breakdown | pie chart data |
| GET | /api/dashboard/target-vs-actual | bar chart data |
| GET | /api/dashboard/stage-performance | stage load % |
| GET | /api/dashboard/stage-summaries | per-stage summary |
| GET | /api/dashboard/production-trend | trend lines |
| GET | /api/dashboard/insights | AI insight cards |
| GET | /api/dashboard/bottlenecks | bottleneck list |

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/orders | List all orders (filter: status, buyer, stage, priority, search) |
| GET | /api/orders/:id | Get single order with stages |
| POST | /api/orders | Create new order |
| PATCH | /api/orders/:id | Update order fields |
| DELETE | /api/orders/:id | Soft-delete order |

### Buyers
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/buyers | List all buyers |
| GET | /api/buyers/:id | Get single buyer |
| POST | /api/buyers | Create buyer |
| PATCH | /api/buyers/:id | Update buyer |
| GET | /api/buyers/:id/orders | Orders for a buyer |

### Production / Stages
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/production | All stage summaries |
| GET | /api/production/:stage | Stage detail + orders in that stage |
| GET | /api/production/:stage/orders | Orders currently at a stage |
| POST | /api/production/events | Submit production event (completed/rejected delta) |

### Inventory / Materials
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/inventory | List all materials |
| PATCH | /api/inventory/:name | Update stock levels |

### Notifications
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/notifications | All admin notifications |
| PATCH | /api/notifications/:id/read | Mark as read |
| PATCH | /api/notifications/read-all | Mark all read |

### Proposals (Operational)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/proposals | List proposals |
| POST | /api/proposals | Create proposal |
| POST | /api/proposals/:id/approve | Approve proposal |
| POST | /api/proposals/:id/dismiss | Dismiss proposal |

### Users Management (Admin only)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/users | List all system users |
| POST | /api/users | Create user |
| PATCH | /api/users/:id | Update user |
| DELETE | /api/users/:id | Delete user |

### Analytics & Reports
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/analytics/production-trend | Historical trend |
| GET | /api/analytics/stage-performance | Stage efficiency |
| GET | /api/analytics/order-status-split | Status breakdown |

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/health | Server + DB status |

---

## DB Schema (SQLite)

### users
```sql
id TEXT PK, email TEXT UNIQUE, password_hash TEXT, name TEXT, 
role TEXT (admin|manager|supervisor|viewer|buyer|process),
stage TEXT (nullable, for process role), title TEXT, 
created_at TEXT, updated_at TEXT
```

### orders
```sql
id TEXT PK, buyer_id TEXT, buyer TEXT, product TEXT, category TEXT,
style_no TEXT, po_no TEXT, quantity INTEGER, fabric TEXT, color TEXT,
start_date TEXT, delivery_date TEXT, priority TEXT, status TEXT,
current_stage TEXT, progress INTEGER, created_at TEXT, updated_at TEXT
```

### order_stages
```sql
id INTEGER PK, order_id TEXT FK, stage_key TEXT, label TEXT,
state TEXT, target INTEGER, completed INTEGER, pending INTEGER,
rejected INTEGER, progress INTEGER, rate INTEGER, manager TEXT,
expected TEXT, updated_at TEXT
```

### buyers
```sql
id TEXT PK, name TEXT, company TEXT, country TEXT, contact TEXT,
active INTEGER, completed INTEGER, delayed INTEGER, total INTEGER,
last_order TEXT, created_at TEXT
```

### materials
```sql
id INTEGER PK, name TEXT, category TEXT, stock REAL, reserved REAL,
min REAL, unit TEXT, updated_at TEXT
```

### notifications
```sql
id TEXT PK, type TEXT, title TEXT, body TEXT, time TEXT,
read INTEGER DEFAULT 0, tone TEXT, target_role TEXT, created_at TEXT
```

### production_events
```sql
id TEXT PK, order_id TEXT, stage TEXT, completed_delta INTEGER,
rejected_delta INTEGER, note TEXT, created_by TEXT, created_at TEXT
```

### proposals
```sql
id TEXT PK, order_id TEXT, title TEXT, action_type TEXT, rationale TEXT,
status TEXT DEFAULT 'pending', created_by TEXT, created_at TEXT,
decided_by TEXT, decided_at TEXT, decision_note TEXT
```

---

## Project Structure
```
nodejs-backend/
├── src/
│   ├── index.ts           ← Express app entry
│   ├── db/
│   │   ├── client.ts      ← better-sqlite3 singleton
│   │   ├── migrations.ts  ← schema creation + seed
│   │   └── seed.ts        ← seed from factory_data.json
│   ├── middleware/
│   │   ├── auth.ts        ← JWT cookie verify + role guard
│   │   └── error.ts       ← Global error handler
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── dashboard.ts
│   │   ├── orders.ts
│   │   ├── buyers.ts
│   │   ├── production.ts
│   │   ├── inventory.ts
│   │   ├── notifications.ts
│   │   ├── proposals.ts
│   │   ├── users.ts
│   │   ├── analytics.ts
│   │   └── health.ts
│   └── lib/
│       ├── jwt.ts         ← sign/verify helpers
│       └── risk.ts        ← deterministic risk scoring
├── package.json
├── tsconfig.json
└── .env.example
```

---

## JWT Token Expiry
- **admin role** → 10 days
- **all other roles** (manager, supervisor, viewer, buyer, process) → 30 days
- Stored as httpOnly, sameSite=strict cookie named `texmind_token`
