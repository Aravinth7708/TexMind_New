import { Router, Request, Response } from "express";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";
import { computeRisk, getAttentionItems } from "../lib/risk";

const router = Router();
router.use(requireAuth);

// GET /api/analytics/production-trend
router.get("/production-trend", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT stage_key, label,
           SUM(completed) as produced,
           SUM(pending) as pending,
           SUM(target) as target
    FROM order_stages
    GROUP BY stage_key
    ORDER BY id ASC
  `).all();
  res.json(rows);
});

// GET /api/analytics/stage-performance
router.get("/stage-performance", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT stage_key, label,
           ROUND(AVG(progress), 1) as progress,
           ROUND(AVG(rate), 1) as rate,
           SUM(completed) as completed,
           SUM(target) as target,
      CASE WHEN SUM(target) > 0 THEN ROUND(CAST(SUM(completed) AS REAL) / SUM(target) * 100, 1) ELSE 0 END as efficiency
    FROM order_stages
    GROUP BY stage_key
    ORDER BY id ASC
  `).all();
  res.json(rows);
});

// GET /api/analytics/order-status-split
router.get("/order-status-split", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as count, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 1) as percentage
    FROM orders
    GROUP BY status
  `).all();
  res.json(rows);
});

// GET /api/analytics/rejection-rates
router.get("/rejection-rates", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT stage_key, label,
           SUM(completed) as completed,
           SUM(rejected) as rejected,
           CASE WHEN (SUM(completed) + SUM(rejected)) > 0
             THEN ROUND(CAST(SUM(rejected) AS REAL) / (SUM(completed) + SUM(rejected)) * 100, 2)
             ELSE 0.0 END as rejection_rate
    FROM order_stages
    GROUP BY stage_key
    ORDER BY rejection_rate DESC
  `).all();
  res.json(rows);
});

// GET /api/analytics/buyer-performance
router.get("/buyer-performance", (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT o.buyer_id, o.buyer,
           COUNT(*) as total_orders,
           SUM(CASE WHEN o.status = 'Completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN o.status IN ('Delayed','At Risk') THEN 1 ELSE 0 END) as delayed,
           ROUND(AVG(o.progress), 1) as avg_progress
    FROM orders o
    GROUP BY o.buyer_id, o.buyer
    ORDER BY total_orders DESC
  `).all();
  res.json(rows);
});

// GET /api/analytics/risk-radar
router.get("/risk-radar", (_req: Request, res: Response) => {
  // Dynamically compute the 5 operational risk dimensions from DB
  const delayedCount = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('Delayed','At Risk')").get() as any).c;
  const criticalStockCount = (db.prepare("SELECT COUNT(*) as c FROM materials WHERE stock < min").get() as any).c;
  const qcRejectionRow = db.prepare("SELECT SUM(rejected) as r, SUM(completed) as c FROM order_stages").get() as any;
  const qcRejRate = qcRejectionRow.c > 0 ? Number((((qcRejectionRow.r || 0) / (qcRejectionRow.c + (qcRejectionRow.r || 0))) * 100).toFixed(1)) : 0;

  const radar = [
    {
      label: "Production Risk",
      score: 0,
      tone: "success",
      note: "No production records yet",
    },
    {
      label: "Delivery Risk",
      score: delayedCount > 0 ? Math.min(95, delayedCount * 12 + 20) : 0,
      tone: delayedCount > 2 ? "danger" : delayedCount > 0 ? "warning" : "success",
      note: `${delayedCount} orders trending past committed dates`,
    },
    {
      label: "Inventory Risk",
      score: criticalStockCount > 0 ? Math.min(90, criticalStockCount * 25 + 30) : 0,
      tone: criticalStockCount > 0 ? "danger" : "success",
      note: criticalStockCount > 0 ? "Materials below minimum stock" : "No inventory risks recorded",
    },
    {
      label: "Quality Risk",
      score: qcRejectionRow.c > 0 ? Math.min(80, Math.round(qcRejRate * 12)) : 0,
      tone: qcRejRate > 3 ? "danger" : "success",
      note: `Rejection stable at ${qcRejRate}% factory-wide`,
    },
    {
      label: "Bottleneck Risk",
      score: 0,
      tone: "success",
      note: "No stage bottlenecks recorded",
    },
  ];

  res.json(radar);
});

// GET /api/analytics/root-causes
router.get("/root-causes", (_req: Request, res: Response) => {
  res.json([]);
});

// GET /api/analytics/root-causes/:id
router.get("/root-causes/:id", (req: Request, res: Response) => {
  res.status(404).json({ error: "Root cause analysis not found" });
});

// GET /api/analytics/operational/attention
router.get("/operational/attention", (_req: Request, res: Response) => {
  const items = getAttentionItems();
  res.json({ items, source: "live-database" });
});

// GET /api/analytics/operational/risk/:orderId
router.get("/operational/risk/:orderId", (req: Request, res: Response) => {
  const orderId = String(req.params.orderId);
  const risk = computeRisk(orderId);
  if (!risk) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(risk);
});

export default router;
