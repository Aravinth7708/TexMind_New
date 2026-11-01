#!/usr/bin/env tsx
/**
 * TexMind API Test Suite
 * Tests all endpoints: Admin, Buyer Portal, Supervisor Mode, Document OCR, and Vision QC sequentially.
 * Run: npx tsx src/test/api.test.ts
 */

import "dotenv/config";

const BASE = `http://localhost:${process.env.PORT || 3001}`;
let COOKIE = "";
let BUYER_COOKIE = "";
let PROCESS_SEWING_COOKIE = "";
let createdOrderId = "";
let createdProposalId = "";
let createdUserId = "";
let createdDocId = "";
let createdInspectionId = "";

type Result = { ok: boolean; status: number; body: any };

async function req(method: string, path: string, body?: unknown, cookieStr?: string): Promise<Result> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookieStr) headers["Cookie"] = cookieStr;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: data };
}

function pass(label: string, detail?: string) {
  console.log(`  ✅ PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label: string, status: number, body: unknown) {
  console.error(`  ❌ FAIL  ${label} [HTTP ${status}]`, JSON.stringify(body));
  process.exitCode = 1;
}
function section(name: string) {
  console.log(`\n${"─".repeat(55)}\n  ${name}\n${"─".repeat(55)}`);
}

async function run() {
  console.log(`\n🧪 TexMind API Test Suite  →  ${BASE}\n`);
  try {
    const initDb = (await import("../db/client")).default;
    initDb.prepare("UPDATE orders SET current_stage = 'sewing' WHERE id = 'ORD-2026-001'").run();
    initDb.prepare("UPDATE production_lines SET operators_assigned = 26 WHERE id = 'line-1'").run();
    initDb.prepare("UPDATE production_lines SET operators_assigned = 26 WHERE id = 'line-3'").run();
  } catch {}

  try {
    const check = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) });
    if (!check.ok) throw new Error("not ok");
  } catch {
    console.log(`  ℹ️  Server not running on ${BASE}. Auto-starting server in-process for tests...`);
    await import("../index");
    await new Promise((r) => setTimeout(r, 600));
  }

  // ── Health ────────────────────────────────────────────────────────────────
  section("1. Health Check");
  {
    const r = await req("GET", "/api/health");
    r.ok ? pass("GET /api/health", `status=${r.body?.status}`) : fail("GET /api/health", r.status, r.body);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  section("2. Auth");
  {
    // Bad login
    const bad = await req("POST", "/api/auth/login", { email: "nobody@x.com", password: "wrong" });
    bad.status === 401 ? pass("POST /api/auth/login — invalid creds → 401") : fail("Bad login should be 401", bad.status, bad.body);

    // Good admin login
    const good = await req("POST", "/api/auth/login", { email: "manager@texmind.in", password: "texmind" });
    if (good.ok) {
      pass("POST /api/auth/login — manager login");
    } else {
      fail("POST /api/auth/login — manager login", good.status, good.body);
    }

    // Extract set-cookie from login response
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "manager@texmind.in", password: "texmind" }),
    });
    COOKIE = loginRes.headers.get("set-cookie") || "";
    console.log(`     🍪 Admin Cookie set: ${COOKIE ? "yes (10d)" : "none"}`);

    // /me
    const me = await req("GET", "/api/auth/me", undefined, COOKIE);
    me.ok ? pass("GET /api/auth/me", `role=${me.body?.user?.role}`) : fail("GET /api/auth/me", me.status, me.body);

    // No cookie → 401
    const noCookie = await req("GET", "/api/auth/me");
    noCookie.status === 401 ? pass("GET /api/auth/me without cookie → 401") : fail("Should be 401", noCookie.status, noCookie.body);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  section("3. Dashboard");
  const dashEndpoints = [
    "/api/dashboard/summary",
    "/api/dashboard/health-breakdown",
    "/api/dashboard/target-vs-actual",
    "/api/dashboard/stage-performance",
    "/api/dashboard/stage-summaries",
    "/api/dashboard/production-trend",
    "/api/dashboard/insights",
    "/api/dashboard/bottlenecks",
    "/api/dashboard/order-status-split",
  ];
  for (const ep of dashEndpoints) {
    const r = await req("GET", ep, undefined, COOKIE);
    r.ok ? pass(`GET ${ep}`) : fail(`GET ${ep}`, r.status, r.body);
  }

  // ── Orders ────────────────────────────────────────────────────────────────
  section("4. Orders");
  {
    const list = await req("GET", "/api/orders", undefined, COOKIE);
    list.ok ? pass("GET /api/orders", `total=${list.body?.meta?.total}`) : fail("GET /api/orders", list.status, list.body);

    // Filter by status
    const filtered = await req("GET", "/api/orders?status=Delayed", undefined, COOKIE);
    filtered.ok ? pass("GET /api/orders?status=Delayed") : fail("GET /api/orders?status=Delayed", filtered.status, filtered.body);

    // Get single order
    const one = await req("GET", "/api/orders/ORD-2026-001", undefined, COOKIE);
    one.ok ? pass("GET /api/orders/ORD-2026-001", `stages=${one.body?.stages?.length}`) : fail("GET /api/orders/ORD-2026-001", one.status, one.body);

    // 404
    const missing = await req("GET", "/api/orders/ORD-FAKE-999", undefined, COOKIE);
    missing.status === 404 ? pass("GET /api/orders/ORD-FAKE-999 → 404") : fail("Should be 404", missing.status, missing.body);

    // Create order
    const create = await req("POST", "/api/orders", {
      buyer_id: "BUY-01",
      buyer: "ABC Fashion",
      product: "Test Hoodie",
      category: "Knitwear",
      style_no: "STY-TEST-01",
      po_no: "PO-TEST-01",
      quantity: 500,
      fabric: "Fleece 320 GSM",
      color: "Black",
      start_date: "1 Oct 2026",
      delivery_date: "30 Nov 2026",
      priority: "Medium",
    }, COOKIE);
    if (create.ok && create.body?.id) {
      createdOrderId = create.body.id as string;
      pass("POST /api/orders", `id=${createdOrderId}`);
    } else {
      fail("POST /api/orders", create.status, create.body);
    }

    // Update order
    if (createdOrderId) {
      const upd = await req("PATCH", `/api/orders/${createdOrderId}`, { status: "At Risk" }, COOKIE);
      upd.ok ? pass(`PATCH /api/orders/${createdOrderId}`) : fail(`PATCH /api/orders/${createdOrderId}`, upd.status, upd.body);
    }
  }

  // ── Buyers ────────────────────────────────────────────────────────────────
  section("5. Buyers");
  {
    const list = await req("GET", "/api/buyers", undefined, COOKIE);
    list.ok ? pass("GET /api/buyers", `count=${list.body?.length}`) : fail("GET /api/buyers", list.status, list.body);

    const one = await req("GET", "/api/buyers/BUY-01", undefined, COOKIE);
    one.ok ? pass("GET /api/buyers/BUY-01") : fail("GET /api/buyers/BUY-01", one.status, one.body);

    const orders = await req("GET", "/api/buyers/BUY-01/orders", undefined, COOKIE);
    orders.ok ? pass("GET /api/buyers/BUY-01/orders", `count=${orders.body?.length}`) : fail("GET /api/buyers/BUY-01/orders", orders.status, orders.body);

    const randomBuyerId = `BUY-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const create = await req("POST", "/api/buyers", {
      id: randomBuyerId,
      name: "Test Contact",
      company: "Test Buyer Co",
      country: "India",
      contact: "test@testbuyer.com",
    }, COOKIE);
    create.ok ? pass("POST /api/buyers", `id=${randomBuyerId}`) : fail("POST /api/buyers", create.status, create.body);
  }

  // ── Production ────────────────────────────────────────────────────────────
  section("6. Production");
  {
    const all = await req("GET", "/api/production", undefined, COOKIE);
    all.ok ? pass("GET /api/production", `stages=${all.body?.length}`) : fail("GET /api/production", all.status, all.body);

    const sewing = await req("GET", "/api/production/sewing", undefined, COOKIE);
    sewing.ok ? pass("GET /api/production/sewing") : fail("GET /api/production/sewing", sewing.status, sewing.body);

    const invalid = await req("GET", "/api/production/invalid-stage", undefined, COOKIE);
    invalid.status === 400 ? pass("GET /api/production/invalid-stage → 400") : fail("Should be 400", invalid.status, invalid.body);

    // Submit event
    const event = await req("POST", "/api/production/events", {
      order_id: "ORD-2026-001",
      stage: "sewing",
      completed_delta: 100,
      rejected_delta: 5,
      note: "Test event from API test suite",
    }, COOKIE);
    event.ok ? pass("POST /api/production/events") : fail("POST /api/production/events", event.status, event.body);

    // Wrong stage
    const wrongStage = await req("POST", "/api/production/events", {
      order_id: "ORD-2026-001",
      stage: "cutting",
      completed_delta: 100,
      rejected_delta: 0,
    }, COOKIE);
    wrongStage.status === 422 ? pass("POST /api/production/events wrong stage → 422") : fail("Should be 422", wrongStage.status, wrongStage.body);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────
  section("7. Inventory");
  {
    const list = await req("GET", "/api/inventory", undefined, COOKIE);
    list.ok ? pass("GET /api/inventory", `items=${list.body?.length}`) : fail("GET /api/inventory", list.status, list.body);

    const upd = await req("PATCH", "/api/inventory/Cotton%20Yarn%2030s%20Combed", { stock: 5000 }, COOKIE);
    upd.ok ? pass("PATCH /api/inventory/Cotton Yarn 30s Combed") : fail("PATCH /api/inventory", upd.status, upd.body);
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  section("8. Notifications");
  {
    const list = await req("GET", "/api/notifications", undefined, COOKIE);
    list.ok ? pass("GET /api/notifications", `count=${list.body?.length}`) : fail("GET /api/notifications", list.status, list.body);

    const all = list.body as { id: string }[];
    if (Array.isArray(all) && all.length > 0) {
      const markOne = await req("PATCH", `/api/notifications/${all[0].id}/read`, undefined, COOKIE);
      markOne.ok ? pass(`PATCH /api/notifications/${all[0].id}/read`) : fail("PATCH read", markOne.status, markOne.body);
    }

    const markAll = await req("PATCH", "/api/notifications/read-all", undefined, COOKIE);
    markAll.ok ? pass("PATCH /api/notifications/read-all") : fail("PATCH read-all", markAll.status, markAll.body);
  }

  // ── Proposals ─────────────────────────────────────────────────────────────
  section("9. Proposals");
  {
    const list = await req("GET", "/api/proposals", undefined, COOKIE);
    list.ok ? pass("GET /api/proposals") : fail("GET /api/proposals", list.status, list.body);

    const create = await req("POST", "/api/proposals", {
      order_id: "ORD-2026-001",
      title: "Expedite Yarn Delivery",
      action_type: "expedite_material",
      rationale: "Cotton yarn stock is critically low. Expediting delivery from supplier to prevent production halt.",
    }, COOKIE);
    if (create.ok && create.body?.id) {
      createdProposalId = create.body.id as string;
      pass("POST /api/proposals", `id=${createdProposalId}`);
    } else {
      fail("POST /api/proposals", create.status, create.body);
    }

    if (createdProposalId) {
      const approve = await req("POST", `/api/proposals/${createdProposalId}/approve`, { note: "Approved by test" }, COOKIE);
      approve.ok ? pass(`POST /api/proposals/${createdProposalId}/approve`) : fail("approve proposal", approve.status, approve.body);

      // Second approve should 409
      const double = await req("POST", `/api/proposals/${createdProposalId}/approve`, {}, COOKIE);
      double.status === 409 ? pass("Double approve → 409") : fail("Should be 409", double.status, double.body);
    }
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  section("10. Users (Admin only)");
  {
    const list = await req("GET", "/api/users", undefined, COOKIE);
    list.ok ? pass("GET /api/users", `count=${list.body?.length}`) : fail("GET /api/users", list.status, list.body);

    const create = await req("POST", "/api/users", {
      email: `test-${Date.now()}@texmind.in`,
      password: "testpass123",
      name: "Test User",
      role: "supervisor",
      title: "Test Supervisor",
    }, COOKIE);
    if (create.ok && create.body?.id) {
      createdUserId = create.body.id as string;
      pass("POST /api/users", `id=${createdUserId}`);
    } else {
      fail("POST /api/users", create.status, create.body);
    }

    if (createdUserId) {
      const upd = await req("PATCH", `/api/users/${createdUserId}`, { name: "Updated Name" }, COOKIE);
      upd.ok ? pass(`PATCH /api/users/${createdUserId}`) : fail("PATCH user", upd.status, upd.body);

      const del = await req("DELETE", `/api/users/${createdUserId}`, undefined, COOKIE);
      del.ok ? pass(`DELETE /api/users/${createdUserId}`) : fail("DELETE user", del.status, del.body);
    }
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  section("11. Analytics");
  {
    const analyticsEndpoints = [
      "/api/analytics/production-trend",
      "/api/analytics/stage-performance",
      "/api/analytics/order-status-split",
      "/api/analytics/rejection-rates",
      "/api/analytics/buyer-performance",
      "/api/analytics/operational/attention",
      "/api/analytics/operational/risk/ORD-2026-001",
    ];
    for (const ep of analyticsEndpoints) {
      const r = await req("GET", ep, undefined, COOKIE);
      r.ok ? pass(`GET ${ep}`) : fail(`GET ${ep}`, r.status, r.body);
    }
  }

  // ── Buyer Portal ──────────────────────────────────────────────────────────
  section("12. Buyer Portal (Phase 2)");
  {
    // Buyer Login with 30-day token
    const buyerLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "buyer@texmind.in", password: "buyer@123" }),
    });
    BUYER_COOKIE = buyerLoginRes.headers.get("set-cookie") || "";
    console.log(`     🍪 Buyer Cookie set: ${BUYER_COOKIE ? "yes (30d expiry)" : "none"}`);

    // Verify buyer role and buyer_id
    const buyerMe = await req("GET", "/api/auth/me", undefined, BUYER_COOKIE);
    buyerMe.ok && buyerMe.body?.user?.role === "buyer"
      ? pass("GET /api/auth/me as buyer", `buyer_id=${buyerMe.body?.user?.buyer_id}`)
      : fail("Buyer /me", buyerMe.status, buyerMe.body);

    // Buyer cannot access admin-only users route
    const buyerUsers = await req("GET", "/api/users", undefined, BUYER_COOKIE);
    buyerUsers.status === 403 ? pass("GET /api/users as buyer → 403 Forbidden") : fail("Should be 403", buyerUsers.status, buyerUsers.body);

    // Buyer Dashboard
    const bDash = await req("GET", "/api/buyer/dashboard", undefined, BUYER_COOKIE);
    bDash.ok && bDash.body?.metrics?.totalOrders !== undefined
      ? pass("GET /api/buyer/dashboard", `totalOrders=${bDash.body.metrics.totalOrders}, pieces=${bDash.body.metrics.totalPieces}`)
      : fail("GET /api/buyer/dashboard", bDash.status, bDash.body);

    // Buyer Orders list
    const bOrders = await req("GET", "/api/buyer/orders", undefined, BUYER_COOKIE);
    bOrders.ok && Array.isArray(bOrders.body?.data)
      ? pass("GET /api/buyer/orders", `orders=${bOrders.body.data.length}`)
      : fail("GET /api/buyer/orders", bOrders.status, bOrders.body);

    // Buyer Orders with filter
    const bOrdersFiltered = await req("GET", "/api/buyer/orders?status=Delayed", undefined, BUYER_COOKIE);
    bOrdersFiltered.ok ? pass("GET /api/buyer/orders?status=Delayed") : fail("Filtered buyer orders", bOrdersFiltered.status, bOrdersFiltered.body);

    // Single order detail that belongs to buyer (ORD-2026-001 belongs to BUY-01)
    const bOrder1 = await req("GET", "/api/buyer/orders/ORD-2026-001", undefined, BUYER_COOKIE);
    bOrder1.ok && bOrder1.body?.stages?.length === 9
      ? pass("GET /api/buyer/orders/ORD-2026-001", `milestone=${bOrder1.body?.milestoneNotice?.title}`)
      : fail("GET /api/buyer/orders/ORD-2026-001", bOrder1.status, bOrder1.body);

    // 🛡️ Security Check: ORD-2026-002 belongs to BUY-02 (Northline Apparel).
    // Accessing it as BUY-01 buyer MUST return 403!
    const bCrossOrder = await req("GET", "/api/buyer/orders/ORD-2026-002", undefined, BUYER_COOKIE);
    bCrossOrder.status === 403
      ? pass("🛡️ Cross-buyer access check: GET /api/buyer/orders/ORD-2026-002 → 403 Forbidden")
      : fail("Cross-buyer access should be 403", bCrossOrder.status, bCrossOrder.body);

    // Buyer Profile
    const bProfile = await req("GET", "/api/buyer/profile", undefined, BUYER_COOKIE);
    bProfile.ok && bProfile.body?.profile?.company
      ? pass("GET /api/buyer/profile", `company=${bProfile.body.profile.company}`)
      : fail("GET /api/buyer/profile", bProfile.status, bProfile.body);

    // Update Buyer Profile
    const bUpdate = await req("PATCH", "/api/buyer/profile", { country: "United Kingdom (HQ)" }, BUYER_COOKIE);
    bUpdate.ok ? pass("PATCH /api/buyer/profile") : fail("PATCH /api/buyer/profile", bUpdate.status, bUpdate.body);

    // Buyer Notifications
    const bNotifs = await req("GET", "/api/buyer/notifications", undefined, BUYER_COOKIE);
    bNotifs.ok ? pass("GET /api/buyer/notifications", `count=${bNotifs.body?.length}`) : fail("GET /api/buyer/notifications", bNotifs.status, bNotifs.body);

    // Mark all read
    const bMarkAll = await req("PATCH", "/api/buyer/notifications/read-all", undefined, BUYER_COOKIE);
    bMarkAll.ok ? pass("PATCH /api/buyer/notifications/read-all") : fail("Mark read all", bMarkAll.status, bMarkAll.body);
  }

  // ── Supervisor & Stage Incharge ───────────────────────────────────────────
  section("13. Supervisor & Process Incharge (Phase 3)");
  {
    // Login as Sewing Incharge (role: "process", stage: "sewing", 30-day token)
    const procLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sewing@texmind.in", password: "sewing@123" }),
    });
    PROCESS_SEWING_COOKIE = procLoginRes.headers.get("set-cookie") || "";
    console.log(`     🍪 Process Incharge (Sewing) Cookie set: ${PROCESS_SEWING_COOKIE ? "yes (30d expiry)" : "none"}`);

    const procMe = await req("GET", "/api/auth/me", undefined, PROCESS_SEWING_COOKIE);
    procMe.ok && procMe.body?.user?.stage === "sewing"
      ? pass("GET /api/auth/me as sewing incharge", `stage=${procMe.body?.user?.stage}`)
      : fail("Process incharge /me", procMe.status, procMe.body);

    // 1. Tamil/Tanglish Voice Parser
    const voice1 = await req("POST", "/api/supervisor/voice-parse", {
      transcript: "Sewing line three output today 2,400 pieces.",
    }, PROCESS_SEWING_COOKIE);
    voice1.ok && voice1.body?.parsed?.stage === "sewing" && voice1.body?.parsed?.completed_delta === 2400
      ? pass("POST /api/supervisor/voice-parse (English)", `stage=${voice1.body.parsed.stage}, qty=${voice1.body.parsed.completed_delta}, line=${voice1.body.parsed.line_no}`)
      : fail("Voice parse English", voice1.status, voice1.body);

    const voice2 = await req("POST", "/api/supervisor/voice-parse", {
      transcript: "ORD-2026-011 dyeing reject 15 pieces.",
    }, PROCESS_SEWING_COOKIE);
    voice2.ok && voice2.body?.parsed?.order_id === "ORD-2026-011" && voice2.body?.parsed?.rejected_delta === 15
      ? pass("POST /api/supervisor/voice-parse (Tanglish)", `order=${voice2.body.parsed.order_id}, reject=${voice2.body.parsed.rejected_delta}`)
      : fail("Voice parse Tanglish", voice2.status, voice2.body);

    // 2. Quick Log — authorized sewing stage update
    const quickLog = await req("POST", "/api/supervisor/quick-log", {
      order_id: "ORD-2026-001",
      stage: "sewing",
      completed_delta: 200,
      rejected_delta: 4,
      line_no: "Line 3",
      shift: "Shift A",
      note: "Voice logged output from Line 3 Shift A",
      photo_url: "/placeholder.svg",
    }, PROCESS_SEWING_COOKIE);
    quickLog.ok && quickLog.body?.success
      ? pass("POST /api/supervisor/quick-log", `event_id=${quickLog.body?.event?.id}, completed=${quickLog.body?.stage?.completed}`)
      : fail("Supervisor quick-log", quickLog.status, quickLog.body);

    // 3. 🛡️ Stage Scope Security Check: Sewing incharge CANNOT log for dyeing!
    const crossStage = await req("POST", "/api/supervisor/quick-log", {
      order_id: "ORD-2026-011",
      stage: "dyeing",
      completed_delta: 50,
      rejected_delta: 0,
    }, PROCESS_SEWING_COOKIE);
    crossStage.status === 403
      ? pass("🛡️ Cross-stage security check: Sewing incharge logging for dyeing → 403 Forbidden")
      : fail("Cross-stage check should be 403", crossStage.status, crossStage.body);

    // 4. Offline Queue Batch Sync
    const batchSync = await req("POST", "/api/supervisor/batch-sync", {
      items: [
        {
          order_id: "ORD-2026-001",
          stage: "sewing",
          completed_delta: 150,
          rejected_delta: 2,
          line_no: "Line 2",
          shift: "Shift B",
          note: "Offline queue sync item 1",
        },
        {
          order_id: "ORD-2026-001",
          stage: "sewing",
          completed_delta: 100,
          rejected_delta: 1,
          line_no: "Line 1",
          shift: "Shift B",
          note: "Offline queue sync item 2",
        },
      ],
    }, PROCESS_SEWING_COOKIE);
    batchSync.ok && batchSync.body?.synced_count === 2
      ? pass("POST /api/supervisor/batch-sync", `synced=${batchSync.body?.synced_count}, failed=${batchSync.body?.failed_count}`)
      : fail("Batch sync", batchSync.status, batchSync.body);

    // 5. Stage Portal Dashboard
    const stageDash = await req("GET", "/api/supervisor/stage/sewing", undefined, PROCESS_SEWING_COOKIE);
    stageDash.ok && stageDash.body?.kpis?.totalTarget !== undefined
      ? pass("GET /api/supervisor/stage/sewing", `efficiency=${stageDash.body.kpis.efficiency}%, activeOrders=${stageDash.body.kpis.activeOrdersCount}`)
      : fail("GET stage dashboard", stageDash.status, stageDash.body);

    // 6. Stage Assignment
    const stageAssign = await req("POST", "/api/supervisor/stage/sewing/assign", {
      order_id: "ORD-2026-001",
      manager: "Muthu Velan",
      expected: "14 Sep 2026",
      rate: 3200,
    }, PROCESS_SEWING_COOKIE);
    stageAssign.ok && stageAssign.body?.stage?.manager === "Muthu Velan"
      ? pass("POST /api/supervisor/stage/sewing/assign", `manager=${stageAssign.body.stage.manager}, expected=${stageAssign.body.stage.expected}`)
      : fail("Stage assign", stageAssign.status, stageAssign.body);
  }

  // ── Document Intelligence (Phase 4) ───────────────────────────────────────
  section("14. Document Intelligence & Tech-Pack OCR (Phase 4)");
  {
    // 1. List ingested documents
    const docList = await req("GET", "/api/documents", undefined, COOKIE);
    docList.ok && Array.isArray(docList.body?.data) && docList.body?.data.length >= 2
      ? pass("GET /api/documents", `count=${docList.body.data.length}`)
      : fail("List documents", docList.status, docList.body);

    // 2. Get single document
    const singleDoc = await req("GET", "/api/documents/doc-tp-01", undefined, COOKIE);
    singleDoc.ok && singleDoc.body?.confidenceScore === 97.4
      ? pass("GET /api/documents/doc-tp-01", `filename=${singleDoc.body.filename}, conf=${singleDoc.body.confidenceScore}%`)
      : fail("Get doc-tp-01", singleDoc.status, singleDoc.body);

    // 3. Ingest a new Tech-Pack document (Simulated AI OCR Extraction)
    const ingestRes = await req("POST", "/api/documents/ingest", {
      filename: "TechPack_Winter_Hoodie_2026.pdf",
      type: "Tech-Pack",
      buyer_name: "ABC Fashion",
      po_number: "PO-9950",
      style_code: "STY-900",
      product_name: "Fleece Zip Hoodie",
      fabric: "380 GSM Heavy French Terry",
      gsm: 380,
      total_quantity: 4000,
      delivery_date: "15 Nov 2026",
      size_breakdown: [
        { size: "M", quantity: 2000 },
        { size: "L", quantity: 1500 },
        { size: "XL", quantity: 500 },
      ],
      colorways: [
        { color: "Vintage Black", qty: 2500 },
        { color: "Washed Olive", qty: 1500 },
      ],
      special_instructions: "YKK antique brass zipper, herringbone tape inside neck.",
    }, COOKIE);

    if (ingestRes.ok && ingestRes.body?.document?.id) {
      createdDocId = ingestRes.body.document.id;
      pass("POST /api/documents/ingest", `id=${createdDocId}, status=${ingestRes.body.document.status}, conf=${ingestRes.body.document.confidenceScore}%`);
    } else {
      fail("Ingest document", ingestRes.status, ingestRes.body);
    }

    // 4. Operator Review-and-Edit (Guardrail)
    if (createdDocId) {
      const editDoc = await req("PATCH", `/api/documents/${createdDocId}`, {
        totalQuantity: 4200,
        specialInstructions: "YKK antique brass zipper, herringbone tape, custom silicone wash.",
      }, COOKIE);
      editDoc.ok && editDoc.body?.document?.extractedFields?.totalQuantity === 4200
        ? pass(`PATCH /api/documents/${createdDocId} (Operator review)`, `newQty=${editDoc.body.document.extractedFields.totalQuantity}`)
        : fail("Edit document", editDoc.status, editDoc.body);

      // 5. Review-and-Confirm Guardrail Action → Create production order from Tech-Pack
      const confirmDoc = await req("POST", `/api/documents/${createdDocId}/confirm`, {}, COOKIE);
      confirmDoc.ok && confirmDoc.body?.order?.id && confirmDoc.body?.document?.status === "Verified"
        ? pass(`POST /api/documents/${createdDocId}/confirm (Create Work Order)`, `orderId=${confirmDoc.body.order.id}, stages=${confirmDoc.body.order.stages?.length}`)
        : fail("Confirm document to order", confirmDoc.status, confirmDoc.body);

      // Double confirm should return existing created order
      const doubleConfirm = await req("POST", `/api/documents/${createdDocId}/confirm`, {}, COOKIE);
      doubleConfirm.ok ? pass("Double confirm doc → safe idempotence") : fail("Double confirm should be ok", doubleConfirm.status, doubleConfirm.body);
    }
  }

  // ── Quality Intelligence & Vision QC (Phase 5) ───────────────────────────
  section("15. Quality Intelligence & Vision QC (Phase 5)");
  {
    // 1. QC Summary KPIs
    const qcSummary = await req("GET", "/api/qc/summary", undefined, COOKIE);
    qcSummary.ok && qcSummary.body?.totalInspections >= 3
      ? pass("GET /api/qc/summary", `inspections=${qcSummary.body.totalInspections}, passRate=${qcSummary.body.passRate}%, defects=${qcSummary.body.totalDefects}`)
      : fail("QC summary", qcSummary.status, qcSummary.body);

    // 2. List Inspections with defect bounding boxes
    const inspList = await req("GET", "/api/qc/inspections", undefined, COOKIE);
    inspList.ok && Array.isArray(inspList.body?.data) && inspList.body?.data.length >= 3
      ? pass("GET /api/qc/inspections", `count=${inspList.body.data.length}`)
      : fail("List inspections", inspList.status, inspList.body);

    // Filter by result
    const failList = await req("GET", "/api/qc/inspections?result=FAIL", undefined, COOKIE);
    failList.ok ? pass("GET /api/qc/inspections?result=FAIL") : fail("Filter inspections", failList.status, failList.body);

    // 3. Get single inspection (vqc-001 has 2 defects)
    const singleInsp = await req("GET", "/api/qc/inspections/vqc-001", undefined, COOKIE);
    singleInsp.ok && singleInsp.body?.defects?.length === 2
      ? pass("GET /api/qc/inspections/vqc-001", `defects=${singleInsp.body.defects.length}, result=${singleInsp.body.overallResult}, primary=${singleInsp.body.defects[0].label}`)
      : fail("Get inspection vqc-001", singleInsp.status, singleInsp.body);

    // 4. Record new Optical Inspection Scan (AI simulated defect scan)
    const scanRes = await req("POST", "/api/qc/inspections", {
      order_id: "ORD-2026-001",
      stage: "sewing",
      item_name: "Collar Hem Stitch Alignment",
      image_url: "/placeholder.svg",
      defects: [
        {
          label: "Skipped Stitch",
          category: "Stitch",
          confidence: 96.4,
          coordinates: { x: 42, y: 35, width: 20, height: 15 },
          severity: "High",
          recommendedAction: "Undo and restitch using SES ball point needle",
        },
      ],
    }, COOKIE);

    if (scanRes.ok && scanRes.body?.inspection?.id) {
      createdInspectionId = scanRes.body.inspection.id;
      pass("POST /api/qc/inspections (Run AI Visual Scan)", `id=${createdInspectionId}, result=${scanRes.body.inspection.overallResult}`);
    } else {
      fail("Create inspection", scanRes.status, scanRes.body);
    }

    // 5. Manager QC Disposition override / confirmation
    if (createdInspectionId) {
      const disp = await req("POST", `/api/qc/inspections/${createdInspectionId}/disposition`, {
        disposition: "REWORK",
        note: "Send to rework station 2 for restitching collar band.",
      }, COOKIE);
      disp.ok && disp.body?.inspection?.disposition === "REWORK"
        ? pass(`POST /api/qc/inspections/${createdInspectionId}/disposition`, `disposition=${disp.body.inspection.disposition}`)
        : fail("Disposition override", disp.status, disp.body);
    }

    // 6. Defect Frequency Heatmap
    const heatmap = await req("GET", "/api/qc/heatmap", undefined, COOKIE);
    heatmap.ok && Array.isArray(heatmap.body) && heatmap.body.length >= 9
      ? pass("GET /api/qc/heatmap", `stages=${heatmap.body.length}`)
      : fail("QC Heatmap", heatmap.status, heatmap.body);

    // 7. Pareto 80/20 Defect Analysis
    const pareto = await req("GET", "/api/qc/pareto", undefined, COOKIE);
    pareto.ok && Array.isArray(pareto.body)
      ? pass("GET /api/qc/pareto", `topDefect=${pareto.body[0]?.defect}`)
      : fail("QC Pareto", pareto.status, pareto.body);

    // 8. Machine Drift & Shift Correlation Ledger
    const drilldowns = await req("GET", "/api/qc/drilldowns", undefined, COOKIE);
    drilldowns.ok && Array.isArray(drilldowns.body) && drilldowns.body.length >= 5
      ? pass("GET /api/qc/drilldowns", `entries=${drilldowns.body.length}, anomalyCount=${drilldowns.body.filter((d: any) => d.anomalyDetected).length}`)
      : fail("QC Drilldowns", drilldowns.status, drilldowns.body);
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  // ── Workforce & Capacity Planning (Phase 6) ─────────────────────────
  section("16. Workforce & Capacity Planning (Phase 6)");
  {
    // 1. Get lines
    const linesRes = await req("GET", "/api/capacity/lines", undefined, COOKIE);
    linesRes.ok && linesRes.body?.lines?.length >= 5
      ? pass("GET /api/capacity/lines", `lines=${linesRes.body.lines.length}, totalOperators=${linesRes.body.summary?.totalOperators}`)
      : fail("Get lines", linesRes.status, linesRes.body);

    // 2. Rebalance operators: Line 1 -> Line 3
    const reb = await req("POST", "/api/capacity/rebalance", {
      from_line_id: "line-1",
      to_line_id: "line-3",
      operators_moved: 2,
      reason: "Shift balancing to clear fleece polo backlog",
    }, COOKIE);
    reb.ok && reb.body?.transferred === 2
      ? pass("POST /api/capacity/rebalance", `moved=${reb.body.transferred}, logId=${reb.body.rebalanceLogId}`)
      : fail("Rebalance operators", reb.status, reb.body);

    // 3. Validation: Over-capacity guard
    const invalidReb = await req("POST", "/api/capacity/rebalance", {
      from_line_id: "line-4",
      to_line_id: "line-1",
      operators_moved: 999,
    }, COOKIE);
    invalidReb.status === 422
      ? pass("POST /api/capacity/rebalance over-capacity guard → 422")
      : fail("Invalid rebalance should be 422", invalidReb.status, invalidReb.body);
  }

  // ── AI Multi-Agents Orchestrator (Phase 6) ───────────────────────────
  section("17. AI Multi-Agents Orchestrator (Phase 6)");
  {
    // Reset test proposals for idempotent test runs
    const { default: dbClient } = await import("../db/client");
    dbClient.prepare("UPDATE agent_proposals SET approved = 0, dismissed = 0, decided_by = NULL, decided_at = NULL, decision_note = NULL WHERE id IN ('prop-p1', 'prop-d1')").run();

    // 1. List agents
    const agentsRes = await req("GET", "/api/agents", undefined, COOKIE);
    agentsRes.ok && Array.isArray(agentsRes.body) && agentsRes.body.length >= 6
      ? pass("GET /api/agents", `agents=${agentsRes.body.length}, first=${agentsRes.body[0]?.name}`)
      : fail("Get agents", agentsRes.status, agentsRes.body);

    // 2. Approve proposal: prop-p1
    const approveRes = await req("POST", "/api/agents/proposals/prop-p1/approve", {
      note: "Approved by Shift Operations Lead",
    }, COOKIE);
    approveRes.ok && approveRes.body?.proposal?.approved === 1
      ? pass("POST /api/agents/proposals/prop-p1/approve", `approved=${approveRes.body.proposal.approved}`)
      : fail("Approve proposal", approveRes.status, approveRes.body);

    // 3. Double approve -> 409
    const doubleApprove = await req("POST", "/api/agents/proposals/prop-p1/approve", {}, COOKIE);
    doubleApprove.status === 409
      ? pass("Double approve agent proposal → 409 Conflict")
      : fail("Double approve should be 409", doubleApprove.status, doubleApprove.body);

    // 4. Dismiss proposal: prop-d1
    const dismissRes = await req("POST", "/api/agents/proposals/prop-d1/dismiss", {
      note: "Will communicate with buyer manually",
    }, COOKIE);
    dismissRes.ok && dismissRes.body?.proposal?.dismissed === 1
      ? pass("POST /api/agents/proposals/prop-d1/dismiss", `dismissed=${dismissRes.body.proposal.dismissed}`)
      : fail("Dismiss proposal", dismissRes.status, dismissRes.body);
  }

  // ── AI Scenario Simulator (Phase 6) ──────────────────────────────────
  section("18. AI Scenario Simulator (Phase 6)");
  {
    const simRes = await req("POST", "/api/scenario/simulate", {
      order_id: "ORD-2026-015",
      overtime_hours: 2,
      added_operators: 6,
      subcontract_qty: 500,
    }, COOKIE);
    simRes.ok && simRes.body?.daysSaved !== undefined && simRes.body?.financials?.totalAddedCost > 0
      ? pass("POST /api/scenario/simulate", `daysSaved=${simRes.body.daysSaved}, cost=₹${simRes.body.financials.totalAddedCost}, risk=${simRes.body.feasibilityRisk}`)
      : fail("Scenario simulation", simRes.status, simRes.body);

    // 2. Order not found -> 404
    const badSim = await req("POST", "/api/scenario/simulate", {
      order_id: "ORD-NONEXISTENT",
      overtime_hours: 1,
    }, COOKIE);
    badSim.status === 404
      ? pass("POST /api/scenario/simulate non-existent order → 404")
      : fail("Bad sim order should be 404", badSim.status, badSim.body);
  }

  // ── Factory Settings & Preferences (Phase 6) ─────────────────────────
  section("19. Factory Settings & Preferences (Phase 6)");
  {
    // 1. Get settings
    const getSet = await req("GET", "/api/settings", undefined, COOKIE);
    getSet.ok && getSet.body?.factoryName === "TexMind Knits Pvt Ltd"
      ? pass("GET /api/settings", `factory=${getSet.body.factoryName}, capacity=${getSet.body.dailyCapacity}`)
      : fail("Get settings", getSet.status, getSet.body);

    // 2. Update settings (Admin)
    const patchSet = await req("PATCH", "/api/settings", {
      daily_capacity: 7200,
      contact_phone: "+91 98430 99999",
      alerts_config: { delayAlerts: true, aiDailyDigest: true },
    }, COOKIE);
    patchSet.ok && patchSet.body?.settings?.dailyCapacity === 7200
      ? pass("PATCH /api/settings", `newCapacity=${patchSet.body.settings.dailyCapacity}`)
      : fail("Patch settings", patchSet.status, patchSet.body);

    // 3. Buyer cannot update settings -> 403 Forbidden
    const buyerPatch = await req("PATCH", "/api/settings", {
      daily_capacity: 1000,
    }, BUYER_COOKIE);
    buyerPatch.status === 403
      ? pass("🛡️ Role guard: Buyer PATCH /api/settings → 403 Forbidden")
      : fail("Buyer patch settings should be 403", buyerPatch.status, buyerPatch.body);
  }

  // ── Unified Global Search (Phase 6) ──────────────────────────────────
  section("20. Unified Global Search (Phase 6)");
  {
    // 1. Search keyword \"polo\"
    const searchRes = await req("GET", "/api/search?q=polo", undefined, COOKIE);
    searchRes.ok && searchRes.body?.totalHits >= 1
      ? pass("GET /api/search?q=polo", `totalHits=${searchRes.body.totalHits}, orders=${searchRes.body.counts?.orders}`)
      : fail("Global search", searchRes.status, searchRes.body);

    // 2. Search keyword \"cotton\" (inventory/material hits)
    const searchMat = await req("GET", "/api/search?q=cotton", undefined, COOKIE);
    searchMat.ok && searchMat.body?.counts?.inventory >= 1
      ? pass("GET /api/search?q=cotton", `inventoryHits=${searchMat.body.counts?.inventory}`)
      : fail("Search materials", searchMat.status, searchMat.body);

    // 3. Search as Buyer (tenant scoped)
    const buyerSearch = await req("GET", "/api/search?q=t-shirt", undefined, BUYER_COOKIE);
    buyerSearch.ok && buyerSearch.body?.counts?.buyers === 0
      ? pass("🛡️ Tenant search: Buyer cannot see competitor buyer records in search hits")
      : fail("Buyer search scoping", buyerSearch.status, buyerSearch.body);
  }

  // ── Reports & Export Engine (Phase 7) ────────────────────────────────
  section("21. Reports & Export Engine (Phase 7)");
  {
    // 1. Report types
    const typesRes = await req("GET", "/api/reports/types", undefined, COOKIE);
    typesRes.ok && typesRes.body?.total === 6
      ? pass("GET /api/reports/types", `types=${typesRes.body.total}`)
      : fail("Report types", typesRes.status, typesRes.body);

    // 2. Generate Daily Production Report
    const dailyRep = await req("POST", "/api/reports/generate", {
      report_type: "daily-production",
    }, COOKIE);
    dailyRep.ok && dailyRep.body?.data?.stageBreakdown?.length === 9
      ? pass("POST /api/reports/generate (daily-production)", `stages=${dailyRep.body.data.stageBreakdown.length}, produced=${dailyRep.body.data.summary?.totalProduced}`)
      : fail("Generate daily report", dailyRep.status, dailyRep.body);

    // 3. Generate Delay & Root Cause Report
    const delayRep = await req("POST", "/api/reports/generate", {
      report_type: "delay-report",
    }, COOKIE);
    delayRep.ok && Array.isArray(delayRep.body?.data?.delayedOrders)
      ? pass("POST /api/reports/generate (delay-report)", `delayedCount=${delayRep.body.data.delayedOrderCount}`)
      : fail("Generate delay report", delayRep.status, delayRep.body);

    // 4. Export report payload
    const exportRep = await req("POST", "/api/reports/export", {
      report_type: "inventory-report",
      format: "json",
    }, COOKIE);
    exportRep.ok && exportRep.body?.status === "READY"
      ? pass("POST /api/reports/export (json)", `downloadUrl=${exportRep.body.downloadUrl}`)
      : fail("Export report", exportRep.status, exportRep.body);
  }

  // ── AI Copilot & Streaming Chat (Phase 7) ───────────────────────────
  section("22. AI Copilot & Streaming Chat (Phase 7)");
  {
    // 1. Complete response (Admin context)
    const chatAdmin = await req("POST", "/api/chat", {
      messages: [{ role: "user", content: "What is the status of delayed orders in the factory?" }],
      role: "admin",
    });
    chatAdmin.ok && chatAdmin.body?.content && chatAdmin.body?.sources?.length > 0
      ? pass("POST /api/chat (Admin intelligence)", `sources=${chatAdmin.body.sources.length}, preview=${chatAdmin.body.content.slice(0, 45)}...`)
      : fail("Chat admin", chatAdmin.status, chatAdmin.body);

    // 2. Buyer scoped copilot query
    const chatBuyer = await req("POST", "/api/chat", {
      messages: [{ role: "user", content: "When will my order be delivered?" }],
      role: "buyer",
      buyer_id: "BUY-01",
    });
    chatBuyer.ok && chatBuyer.body?.content
      ? pass("POST /api/chat (Buyer tenant copilot)", `contentLength=${chatBuyer.body.content.length}`)
      : fail("Chat buyer", chatBuyer.status, chatBuyer.body);

    // 3. Tamil / Tanglish Voice query
    const chatTamil = await req("POST", "/api/chat", {
      messages: [{ role: "user", content: "factory status enna bro?" }],
      role: "admin",
    });
    chatTamil.ok && chatTamil.body?.content?.includes("வணக்கம்")
      ? pass("POST /api/chat (Tamil / Tanglish)", `tamilResponse=true`)
      : fail("Chat Tamil", chatTamil.status, chatTamil.body);

    // 4. Chunked streaming endpoint
    const streamRes = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Give me cotton yarn stock" }],
        role: "admin",
      }),
    });
    if (streamRes.ok && streamRes.body) {
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedText += decoder.decode(value);
      }
      streamedText.length > 20
        ? pass("POST /api/chat/stream (Token streaming)", `streamedTokensLength=${streamedText.length}`)
        : fail("Stream chat", 500, { streamedText });
    } else {
      fail("Stream chat", streamRes.status, {});
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────
  // ── Operational Decision Support Engine (Phase 8 Gap Fill) ──
  section("23. Operational Decision Support Engine");
  {
    // 1. Operational Attention Queue
    const attn = await req("GET", "/api/operational/attention");
    attn.ok && Array.isArray(attn.body?.items)
      ? pass("GET /api/operational/attention", `itemsCount=${attn.body.items.length}, source=${attn.body.source}`)
      : fail("Operational attention queue", attn.status, attn.body);

    // 2. Deterministic Risk Score
    const risk = await req("GET", "/api/operational/orders/ORD-2026-001/risk");
    risk.ok && typeof risk.body?.score === "number"
      ? pass("GET /api/operational/orders/:orderId/risk", `score=${risk.body.score}, severity=${risk.body.severity}`)
      : fail("Operational order risk", risk.status, risk.body);

    // 3. Operational Proposals List
    const props = await req("GET", "/api/operational/proposals");
    props.ok && Array.isArray(props.body)
      ? pass("GET /api/operational/proposals", `count=${props.body.length}`)
      : fail("Operational proposals list", props.status, props.body);

    // 4. Create and Approve Proposal via Operational Router
    const newProp = await req("POST", "/api/proposals", {
      order_id: "ORD-2026-001",
      title: "Operational Shift Redistribution",
      action_type: "line_reallocation",
      rationale: "Rebalance floor capacity to prevent bottleneck in sewing.",
    }, COOKIE);

    if (newProp.ok && newProp.body?.id) {
      const pId = newProp.body.id;
      const approveRes = await req("POST", `/api/operational/proposals/${pId}/approve`, {
        note: "Approved via automated operations harness",
      }, COOKIE);
      approveRes.ok && approveRes.body?.status === "approved"
        ? pass(`POST /api/operational/proposals/${pId}/approve`, `status=${approveRes.body.status}`)
        : fail("Operational proposal approve", approveRes.status, approveRes.body);

      // Subsequent approve should 409
      const doubleApprove = await req("POST", `/api/operational/proposals/${pId}/approve`, {}, COOKIE);
      doubleApprove.status === 409
        ? pass("Operational duplicate approval → 409 Conflict")
        : fail("Operational duplicate approval check", doubleApprove.status, doubleApprove.body);
    } else {
      fail("Create proposal for operational test", newProp.status, newProp.body);
    }
  }

  // ── Order Prediction & Notice Dispatch Engine ────────────────
  section("24. Order Prediction & Notice Dispatch Engine");
  {
    // 1. ML Delay Prediction
    const pred = await req("GET", "/api/orders/ORD-2026-001/prediction", undefined, COOKIE);
    pred.ok && pred.body?.orderId === "ORD-2026-001" && Array.isArray(pred.body?.rootCauses)
      ? pass("GET /api/orders/:id/prediction", `predictedDelayDays=${pred.body.predictedDelayDays}, confidenceScore=${pred.body.confidenceScore}`)
      : fail("Order prediction", pred.status, pred.body);

    // 2. Buyer Notice Dispatch
    const notice = await req("POST", "/api/orders/ORD-2026-001/buyer-notice", {
      subject: "Fabric Inspection Gate Passed",
      body: "Batch #TX-291 has cleared GSM and tensile strength validation with 0 defect density.",
    }, COOKIE);
    notice.ok && notice.body?.notificationId
      ? pass("POST /api/orders/:id/buyer-notice", `notificationId=${notice.body.notificationId}`)
      : fail("Buyer notice dispatch", notice.status, notice.body);

    // 3. Floor Recovery Scenario Approval
    const recov = await req("POST", "/api/orders/ORD-2026-001/recovery-scenarios/1/approve", undefined, COOKIE);
    recov.ok && recov.body?.scenarioId === "1"
      ? pass("POST /api/orders/:id/recovery-scenarios/:scId/approve", `proposalId=${recov.body.proposalId}`)
      : fail("Approve recovery scenario", recov.status, recov.body);

    // 4. Lab Inspection Certificate (Admin / Operations scope)
    const inspReport = await req("GET", "/api/orders/ORD-2026-001/inspection-report", undefined, COOKIE);
    inspReport.ok && inspReport.body?.complianceStatus === "PASSED (AQL 1.5)"
      ? pass("GET /api/orders/:id/inspection-report", `reportId=${inspReport.body.reportId}, tests=${inspReport.body.tests?.length}`)
      : fail("Order inspection report", inspReport.status, inspReport.body);

    // 5. Lab Inspection Certificate (Buyer Portal scope)
    const buyerInsp = await req("GET", "/api/buyer/orders/ORD-2026-001/inspection-report", undefined, BUYER_COOKIE);
    buyerInsp.ok && buyerInsp.body?.complianceStatus === "PASSED (AQL 1.5)"
      ? pass("GET /api/buyer/orders/:id/inspection-report", `reportId=${buyerInsp.body.reportId}, digitalStamp=${buyerInsp.body.digitalStamp}`)
      : fail("Buyer order inspection report", buyerInsp.status, buyerInsp.body);

    // 6. Shop-floor Telemetry Sync
    const syncRes = await req("POST", "/api/orders/ORD-2026-001/sync", undefined, COOKIE);
    syncRes.ok && syncRes.body?.success
      ? pass("POST /api/orders/:id/sync", `syncedOrder=${syncRes.body.order?.id}`)
      : fail("Order telemetry sync", syncRes.status, syncRes.body);
  }

  // ── Production Floor Assignments ─────────────────────────────
  section("25. Production Floor Assignments");
  {
    // 1. Create Production Assignment (Work Order Release)
    const targetOrderId = createdOrderId || "ORD-2026-001";
    const createAssign = await req("POST", "/api/production/assignments", {
      order_id: targetOrderId,
      stage: "dyeing",
      assigned_to: "Dyeing Master Murugan",
      quantity: 2500,
      unit: "kg",
      priority: "high",
      start_date: "2026-09-15",
      due_date: "2026-09-22",
      notes: "Release yarn lot #88 for soft-flow reactive dyeing",
    }, COOKIE);
    createAssign.ok && createAssign.body?.id
      ? pass("POST /api/production/assignments", `id=${createAssign.body.id}, stage=${createAssign.body.startStage}`)
      : fail("Create production assignment", createAssign.status, createAssign.body);

    // 2. List Production Assignments
    const listAssign = await req("GET", "/api/production/assignments", undefined, COOKIE);
    listAssign.ok && Array.isArray(listAssign.body) && listAssign.body.length > 0
      ? pass("GET /api/production/assignments", `count=${listAssign.body.length}`)
      : fail("List production assignments", listAssign.status, listAssign.body);

    // 3. Filter Production Assignments by Order ID
    const filterAssign = await req("GET", `/api/production/assignments?order_id=${targetOrderId}`, undefined, COOKIE);
    filterAssign.ok && Array.isArray(filterAssign.body) && filterAssign.body.length > 0
      ? pass(`GET /api/production/assignments?order_id=${targetOrderId}`, `filteredCount=${filterAssign.body.length}`)
      : fail("Filter production assignments", filterAssign.status, filterAssign.body);
  }

  // ── Inventory Forecasts & Replenishment Reorders ──────────────
  section("26. Inventory Forecasts & Replenishment Reorders");
  {
    // 1. Runout Forecasts & Reorder Urgency
    const forecasts = await req("GET", "/api/inventory/forecasts", undefined, COOKIE);
    forecasts.ok && Array.isArray(forecasts.body) && forecasts.body.length > 0
      ? pass("GET /api/inventory/forecasts", `forecastCount=${forecasts.body.length}, topMaterial=${forecasts.body[0].materialName}`)
      : fail("Inventory forecasts", forecasts.status, forecasts.body);

    // 2. Draft Replenishment Reorder PO
    const reorder = await req("POST", "/api/inventory/reorder", {
      material_name: "Cotton Yarn 30s",
      quantity: 5000,
      unit: "kg",
      supplier: "Tiruppur Spinners Ltd",
      estimated_cost: 1225000,
    }, COOKIE);
    reorder.ok && reorder.body?.purchaseOrder?.id
      ? pass("POST /api/inventory/reorder", `poNumber=${reorder.body.purchaseOrder.id}, material=${reorder.body.purchaseOrder.material_name}`)
      : fail("Draft inventory reorder", reorder.status, reorder.body);

    // 3. List Reorders
    const listReorders = await req("GET", "/api/inventory/reorders", undefined, COOKIE);
    listReorders.ok && Array.isArray(listReorders.body) && listReorders.body.length > 0
      ? pass("GET /api/inventory/reorders", `count=${listReorders.body.length}`)
      : fail("List inventory reorders", listReorders.status, listReorders.body);
  }

  // ── Analytics Risk Radar & Root Causes Analysis ──────────────
  section("27. Analytics Risk Radar & Root Causes Analysis");
  {
    // 1. 5-Dimension Factory Risk Radar
    const radar = await req("GET", "/api/analytics/risk-radar", undefined, COOKIE);
    radar.ok && Array.isArray(radar.body) && radar.body.length === 5
      ? pass("GET /api/analytics/risk-radar", `dimensionsCount=${radar.body.length}, topRisk=${radar.body[0].label}`)
      : fail("Analytics risk radar", radar.status, radar.body);

    // 2. Root Cause Dossiers List
    const rootCauses = await req("GET", "/api/analytics/root-causes", undefined, COOKIE);
    rootCauses.ok && Array.isArray(rootCauses.body) && rootCauses.body.length > 0
      ? pass("GET /api/analytics/root-causes", `dossiersCount=${rootCauses.body.length}`)
      : fail("List root causes", rootCauses.status, rootCauses.body);

    // 3. Single Root Cause Dossier (Deep Dive)
    const singleRC = await req("GET", "/api/analytics/root-causes/ins-1", undefined, COOKIE);
    singleRC.ok && singleRC.body?.id === "ins-1" && singleRC.body?.primaryCause
      ? pass("GET /api/analytics/root-causes/:id", `id=${singleRC.body.id}, category=${singleRC.body.category}`)
      : fail("Single root cause dossier", singleRC.status, singleRC.body);
  }

  section("28. Logout");
  {
    const logout = await req("POST", "/api/auth/logout", undefined, COOKIE);
    logout.ok ? pass("POST /api/auth/logout") : fail("POST /api/auth/logout", logout.status, logout.body);
  }

  console.log(`\n${"═".repeat(55)}`);
  if (process.exitCode === 1) {
    console.error("⚠️  Some tests FAILED. See above for details.\n");
    process.exit(1);
  } else {
    console.log("🎉 All tests PASSED!\n");
    process.exit(0);
  }
}

run().catch((e) => {
  console.error("💥 Fatal error:", e);
  process.exit(1);
});
