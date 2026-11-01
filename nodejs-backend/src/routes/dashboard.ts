import { Router, Request, Response } from "express";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();

// All dashboard routes require auth
router.use(requireAuth);

// Single range-aware payload for dashboard clients. The current ledger lacks dated
// stage snapshots, so range is echoed for cache/query semantics while aggregates are live.
router.get("/overview", (req: Request, res: Response) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as any[];
  const stages = db.prepare("SELECT * FROM order_stages").all() as any[];
  const materials = db.prepare("SELECT * FROM materials").all() as any[];
  const total = orders.length;
  const inProduction = orders.filter((o) => o.status !== "Completed").length;
  const producedQty = stages.reduce((sum, s) => sum + Number(s.completed || 0), 0);
  const pendingQty = stages.reduce((sum, s) => sum + Number(s.pending || 0), 0);
  res.json({
    range: String(req.query.range || "Last 7 Days"),
    totals: { orders: total, inProduction, completed: orders.filter((o) => o.status === "Completed").length, delayed: orders.filter((o) => ["Delayed", "At Risk"].includes(o.status)).length, producedQty, pendingQty, onTimeRate: total ? Math.round(orders.filter((o) => o.status === "On Track" || o.status === "Completed").length * 100 / total) : 100, health: inProduction ? Math.round(orders.filter((o) => o.status !== "Completed").reduce((n, o) => n + o.progress, 0) / inProduction) : 100 },
    healthBreakdown: ["Production", "Delivery", "Quality", "Inventory", "Efficiency"].map((label) => ({ label, value: 100 })),
    productionTrend: stages.map((s) => ({ day: s.updated_at, output: s.completed, target: s.target })),
    orders,
    materials,
  });
});

type OrderRow = { status: string; progress: number };
type MaterialRow = { stock: number; min: number; reserved: number };
type StageRow = { stage_key: string; state: string; completed: number; pending: number; progress: number; label: string };

// GET /api/dashboard/summary
router.get("/summary", (_req: Request, res: Response) => {
  const orders = db.prepare("SELECT status, progress FROM orders").all() as OrderRow[];

  const total = orders.length;
  const inProduction = orders.filter((o) => o.status !== "Completed").length;
  const completed = orders.filter((o) => o.status === "Completed").length;
  const delayed = orders.filter((o) => o.status === "Delayed" || o.status === "At Risk").length;
  const onTrack = orders.filter((o) => o.status === "On Track").length;
  const onTimeRate = total > 0 ? Math.round((onTrack / total) * 100) : 0;

  // Health = average progress of in-production orders
  const inProd = orders.filter((o) => o.status !== "Completed");
  const health = inProd.length > 0 ? Math.round(inProd.reduce((a, o) => a + o.progress, 0) / inProd.length) : 100;

  // Inventory health
  const mats = db.prepare("SELECT stock, min, reserved FROM materials").all() as MaterialRow[];
  const criticalMaterials = mats.filter((m) => m.stock - m.reserved < m.min).length;

  res.json({
    orders: total,
    inProduction,
    completed,
    delayed,
    onTimeRate,
    health,
    criticalMaterials,
  });
});

// GET /api/dashboard/health-breakdown
router.get("/health-breakdown", (_req: Request, res: Response) => {
  const orders = db.prepare("SELECT status FROM orders").all() as { status: string }[];
  const groups = ["On Track", "Delayed", "At Risk", "Completed"];
  const data = groups.map((label) => ({
    label,
    value: orders.filter((o) => o.status === label).length,
  }));
  res.json(data);
});

// GET /api/dashboard/target-vs-actual
router.get("/target-vs-actual", (_req: Request, res: Response) => {
  // Group by current_stage and compare target vs completed
  const rows = db.prepare(`
    SELECT o.current_stage as name,
           SUM(os.target) as target,
           SUM(os.completed) as actual
    FROM orders o
    JOIN order_stages os ON o.id = os.order_id AND o.current_stage = os.stage_key
    WHERE o.status != 'Completed'
    GROUP BY o.current_stage
    ORDER BY o.current_stage
  `).all() as { name: string; target: number; actual: number }[];

  res.json(rows);
});

// GET /api/dashboard/stage-performance
router.get("/stage-performance", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT stage_key as name,
           ROUND(AVG(CASE WHEN target > 0 THEN CAST(completed AS REAL) / target * 100 ELSE 0 END), 1) as value
    FROM order_stages
    GROUP BY stage_key
    ORDER BY stage_key
  `).all() as { name: string; value: number }[];

  res.json(rows);
});

// GET /api/dashboard/stage-summaries
router.get("/stage-summaries", (_req: Request, res: Response) => {
  const stages = ["yarn","knitting","dyeing","compacting","cutting","printing","sewing","ironing","packing"];

  const summaries = stages.map((key) => {
    const stageLabel = key.charAt(0).toUpperCase() + key.slice(1);
    const activeOrders = db.prepare(
      "SELECT COUNT(*) as cnt FROM orders WHERE current_stage = ? AND status != 'Completed'"
    ).get(key) as { cnt: number };

    const aggregates = db.prepare(`
      SELECT SUM(completed) as completedQty, SUM(pending) as pendingQty,
             ROUND(AVG(CASE WHEN target > 0 THEN CAST(completed AS REAL)/target*100 ELSE 0 END),1) as progress
      FROM order_stages WHERE stage_key = ?
    `).get(key) as { completedQty: number; pendingQty: number; progress: number };

    const load = Math.min(Math.round((activeOrders.cnt / 15) * 100), 100);

    return {
      key,
      label: stageLabel,
      orders: activeOrders.cnt,
      completedQty: aggregates.completedQty || 0,
      pendingQty: aggregates.pendingQty || 0,
      progress: aggregates.progress || 0,
      load,
    };
  });

  res.json(summaries);
});

// GET /api/dashboard/production-trend
router.get("/production-trend", (_req: Request, res: Response) => {
  // Derive a weekly trend from order stage data
  // Returns simulated trend based on completed quantities grouped by stage
  const rows = db.prepare(`
    SELECT stage_key as name, SUM(completed) as produced, SUM(pending) as pending
    FROM order_stages
    GROUP BY stage_key
    ORDER BY stage_key
  `).all() as { name: string; produced: number; pending: number }[];

  res.json(rows);
});

// GET /api/dashboard/insights
router.get("/insights", (_req: Request, res: Response) => {
  // Return AI-style insights derived from live DB state
  const delayedOrders = db.prepare("SELECT id, buyer, current_stage, delivery_date FROM orders WHERE status IN ('Delayed','At Risk') LIMIT 5").all() as {
    id: string; buyer: string; current_stage: string; delivery_date: string;
  }[];

  const criticalMaterials = db.prepare(`
    SELECT name, stock, reserved, min, unit FROM materials
    WHERE stock - reserved < min
  `).all() as { name: string; stock: number; reserved: number; min: number; unit: string }[];

  const insights = [];

  for (const o of delayedOrders) {
    insights.push({
      id: `insight-delay-${o.id}`,
      kind: "warning",
      title: `${o.id} — Delivery Risk`,
      body: `Order at ${o.current_stage} stage risks missing delivery on ${o.delivery_date} for ${o.buyer}.`,
      risk: "high",
      impact: "Buyer relationship affected if not addressed.",
    });
  }

  for (const m of criticalMaterials) {
    const available = m.stock - m.reserved;
    insights.push({
      id: `insight-mat-${m.name.replace(/\s+/g, "-")}`,
      kind: "alert",
      title: `Low Stock — ${m.name}`,
      body: `Available: ${available}${m.unit} (minimum: ${m.min}${m.unit}). Reorder needed.`,
      risk: "critical",
      impact: "Production may halt without restock.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "insight-healthy",
      kind: "success",
      title: "Factory Health: Good",
      body: "All orders are on track and inventory levels are within safe thresholds.",
      risk: "low",
      impact: "None",
    });
  }

  res.json(insights);
});

// GET /api/dashboard/bottlenecks
router.get("/bottlenecks", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT stage_key as stage, SUM(pending) as pending, SUM(target) as capacity
    FROM order_stages
    WHERE state IN ('current','pending','delayed')
    GROUP BY stage_key
    HAVING pending > 0
    ORDER BY pending DESC
    LIMIT 6
  `).all() as { stage: string; pending: number; capacity: number }[];

  const bottlenecks = rows.map((r) => ({
    stage: r.stage.charAt(0).toUpperCase() + r.stage.slice(1),
    pending: r.pending,
    capacity: r.capacity,
    required: r.pending,
    risk: r.pending > 5000 ? "critical" : r.pending > 2000 ? "high" : "medium",
  }));

  res.json(bottlenecks);
});

// GET /api/dashboard/order-status-split
router.get("/order-status-split", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT status as name, COUNT(*) as value FROM orders GROUP BY status
  `).all();
  res.json(rows);
});

export default router;
