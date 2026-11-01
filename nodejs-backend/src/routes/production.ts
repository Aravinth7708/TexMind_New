import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const STAGES = ["yarn", "knitting", "dyeing", "compacting", "cutting", "printing", "sewing", "ironing", "packing"];

const STAGE_LABELS: Record<string, string> = {
  yarn: "Yarn & Raw Material",
  knitting: "Knitting",
  dyeing: "Fabric Dyeing",
  compacting: "Heat Setting & Compacting",
  cutting: "Automated Cutting",
  printing: "Chest Printing & Embroidery",
  sewing: "Stitching & Assembly",
  ironing: "Steam Ironing & Finishing",
  packing: "Carton Barcode Packing",
};

const productionEventSchema = z.object({
  order_id: z.string().min(1),
  stage: z.string().min(1),
  completed_delta: z.number().int().min(0).default(0),
  rejected_delta: z.number().int().min(0).default(0),
  note: z.string().optional(),
});

const assignmentSchema = z.object({
  orderId: z.string().min(1).optional(),
  order_id: z.string().min(1).optional(),
  buyer: z.string().min(1).optional(),
  pieces: z.number().int().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  kg: z.number().min(0).default(0),
  startStage: z.string().min(1).optional(),
  start_stage: z.string().min(1).optional(),
  stage: z.string().min(1).optional(),
  dueDate: z.string().min(1).optional(),
  due_date: z.string().min(1).optional(),
  note: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
  priority: z.string().optional(),
  unit: z.string().optional(),
  plan: z.array(z.object({
    key: z.string(),
    label: z.string(),
    qty: z.number(),
    unit: z.enum(["kg", "pcs"]),
    incharge: z.string(),
  })).default([]),
}).transform((val) => {
  const orderId = val.orderId || val.order_id || "";
  const orderRow = orderId ? db.prepare("SELECT buyer, quantity FROM orders WHERE id = ?").get(orderId) as any : undefined;
  return {
    orderId,
    buyer: val.buyer || orderRow?.buyer || "Default Buyer",
    pieces: val.pieces || val.quantity || orderRow?.quantity || 1000,
    kg: val.kg || (val.unit === "kg" && val.quantity ? val.quantity : 0),
    startStage: val.startStage || val.start_stage || val.stage || "yarn",
    dueDate: val.dueDate || val.due_date || new Date(Date.now() + 7*86400000).toISOString().split("T")[0],
    note: val.note || val.notes || null,
    plan: val.plan,
  };
}).refine((val) => val.orderId.length > 0, {
  message: "orderId is required",
});

// GET /api/production/assignments
router.get("/assignments", (req: Request, res: Response) => {
  const orderId = (req.query.order_id || req.query.orderId) as string | undefined;
  let rows: any[];
  if (orderId) {
    rows = db.prepare("SELECT * FROM production_assignments WHERE order_id = ? ORDER BY created_at DESC").all(orderId) as any[];
  } else {
    rows = db.prepare("SELECT * FROM production_assignments ORDER BY created_at DESC").all() as any[];
  }

  const formatted = rows.map((r) => ({
    id: r.id,
    orderId: r.order_id,
    buyer: r.buyer,
    pieces: r.pieces,
    kg: r.kg,
    startStage: r.start_stage,
    dueDate: r.due_date,
    note: r.note || null,
    plan: (() => {
      try {
        return JSON.parse(r.plan_json);
      } catch {
        return [];
      }
    })(),
    assignedBy: r.assigned_by,
    createdAt: r.created_at,
  }));
  res.json(formatted);
});

// POST /api/production/assignments — admin/manager only
router.post("/assignments", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(d.orderId) as any;
  if (!order) {
    res.status(404).json({ error: `Order '${d.orderId}' not found` });
    return;
  }

  const assignmentId = `asgn-${uuidv4().slice(0, 8)}`;
  const userName = (req as any).user?.name || "Factory Manager";

  db.transaction(() => {
    db.prepare(`
      INSERT INTO production_assignments (
        id, order_id, buyer, pieces, kg, start_stage, due_date, note, plan_json, assigned_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assignmentId,
      d.orderId,
      d.buyer,
      d.pieces,
      d.kg,
      d.startStage,
      d.dueDate,
      d.note || null,
      JSON.stringify(d.plan),
      userName,
    );

    // Update current stage in order
    db.prepare(`
      UPDATE orders
      SET current_stage = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(d.startStage, d.orderId);

    // Notify stage incharges
    db.prepare(`
      INSERT INTO notifications (id, type, title, body, time, read, tone, target_role)
      VALUES (?, 'process_assignment', ?, ?, datetime('now'), 0, 'info', 'supervisor')
    `).run(
      uuidv4(),
      `Work-Order Assigned: ${d.orderId}`,
      `Released ${d.pieces.toLocaleString()} pcs (${d.kg.toLocaleString()} kg) starting from ${d.startStage}. Due date: ${d.dueDate}.`,
    );
  })();

  res.status(201).json({
    id: assignmentId,
    orderId: d.orderId,
    buyer: d.buyer,
    pieces: d.pieces,
    kg: d.kg,
    startStage: d.startStage,
    dueDate: d.dueDate,
    note: d.note || null,
    plan: d.plan,
    assignedBy: userName,
  });
});

// GET /api/production
router.get("/", (_req: Request, res: Response) => {
  const summaries = STAGES.map((key) => {
    const agg = db.prepare(`
      SELECT
        COUNT(DISTINCT order_id) as active_orders,
        SUM(target) as total_target,
        SUM(completed) as total_completed,
        SUM(pending) as total_pending,
        SUM(rejected) as total_rejected,
        ROUND(AVG(progress)) as avg_progress,
        ROUND(AVG(rate)) as avg_rate
      FROM order_stages
      WHERE stage_key = ?
    `).get(key) as Record<string, number>;

    const recentEvent = db.prepare(`
      SELECT pe.created_at, u.name as supervisor
      FROM production_events pe
      LEFT JOIN users u ON pe.created_by = u.id
      WHERE pe.stage = ?
      ORDER BY pe.created_at DESC
      LIMIT 1
    `).get(key) as { created_at: string; supervisor: string } | undefined;

    return {
      key,
      label: STAGE_LABELS[key] || key,
      activeOrders: agg.active_orders || 0,
      target: agg.total_target || 0,
      completed: agg.total_completed || 0,
      pending: agg.total_pending || 0,
      rejected: agg.total_rejected || 0,
      progress: agg.avg_progress || 0,
      rate: agg.avg_rate || 0,
      efficiency: agg.total_target > 0 ? Math.round((agg.total_completed / agg.total_target) * 100) : 100,
      lastUpdate: recentEvent?.created_at ? new Date(recentEvent.created_at).toLocaleTimeString() : "No updates",
      manager: recentEvent?.supervisor || "Assigned Manager",
    };
  });

  res.json(summaries);
});

// GET /api/production/:stage
router.get("/:stage", (req: Request, res: Response) => {
  const stage = String(req.params.stage);
  if (!STAGES.includes(stage)) {
    res.status(400).json({ error: `Invalid stage. Valid stages: ${STAGES.join(", ")}` });
    return;
  }

  const label = STAGE_LABELS[stage] || stage;

  const activeOrders = db.prepare(`
    SELECT o.id, o.buyer, o.product, o.delivery_date, o.priority, o.status,
           os.target, os.completed, os.pending, os.rejected, os.progress, os.rate, os.state, os.expected
    FROM orders o
    JOIN order_stages os ON o.id = os.order_id AND os.stage_key = ?
    WHERE o.status != 'Completed'
    ORDER BY o.priority DESC, o.delivery_date ASC
  `).all(stage);

  const agg = db.prepare(`
    SELECT SUM(target) as target, SUM(completed) as completed, SUM(pending) as pending,
           SUM(rejected) as rejected, ROUND(AVG(progress)) as progress, ROUND(AVG(rate)) as rate
    FROM order_stages WHERE stage_key = ?
  `).get(stage) as Record<string, number>;

  const recentEvents = db.prepare(`
    SELECT pe.*, u.name as logged_by_name
    FROM production_events pe
    LEFT JOIN users u ON pe.created_by = u.id
    WHERE pe.stage = ?
    ORDER BY pe.created_at DESC
    LIMIT 20
  `).all(stage);

  res.json({
    key: stage,
    label,
    activeOrders,
    aggregate: agg,
    recentEvents,
  });
});

// GET /api/production/:stage/orders
router.get("/:stage/orders", (req: Request, res: Response) => {
  const stage = String(req.params.stage);
  if (!STAGES.includes(stage)) {
    res.status(400).json({ error: `Invalid stage. Valid stages: ${STAGES.join(", ")}` });
    return;
  }

  const orders = db.prepare(`
    SELECT o.*, os.target, os.completed as stage_completed, os.pending as stage_pending,
           os.rejected as stage_rejected, os.progress as stage_progress, os.rate,
           os.manager, os.expected, os.state as stage_state
    FROM orders o
    JOIN order_stages os ON o.id = os.order_id AND os.stage_key = ?
    ORDER BY o.priority DESC, o.delivery_date ASC
  `).all(stage);

  res.json(orders);
});

// POST /api/production/events — submit production update
router.post("/events", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const parsed = productionEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const d = parsed.data;
  if (d.completed_delta === 0 && d.rejected_delta === 0) {
    res.status(422).json({ error: "At least one delta must be non-zero" });
    return;
  }

  const order = db.prepare("SELECT current_stage, status FROM orders WHERE id = ?").get(d.order_id) as { current_stage: string; status: string } | undefined;
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (d.stage !== order.current_stage) {
    res.status(422).json({ error: "Production events may only update the current order stage" });
    return;
  }

  const eventId = uuidv4();
  const createdBy = req.identity!.userId;

  db.transaction(() => {
    // Insert event
    db.prepare(`
      INSERT INTO production_events (id, order_id, stage, completed_delta, rejected_delta, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, d.order_id, d.stage, d.completed_delta, d.rejected_delta, d.note ?? null, createdBy);

    // Update order_stages
    db.prepare(`
      UPDATE order_stages
      SET completed = completed + ?,
          rejected = rejected + ?,
          pending = MAX(0, pending - ?),
          progress = ROUND(CAST(completed + ? AS REAL) / NULLIF(target,0) * 100),
          updated_at = datetime('now')
      WHERE order_id = ? AND stage_key = ?
    `).run(d.completed_delta, d.rejected_delta, d.completed_delta, d.completed_delta, d.order_id, d.stage);

    // Recalculate overall order progress
    const stageAgg = db.prepare(`
      SELECT ROUND(AVG(progress)) as avg_progress FROM order_stages WHERE order_id = ?
    `).get(d.order_id) as { avg_progress: number };

    db.prepare("UPDATE orders SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(stageAgg.avg_progress || 0, d.order_id);
  })();

  const event = db.prepare("SELECT * FROM production_events WHERE id = ?").get(eventId);
  const updatedStage = db.prepare("SELECT * FROM order_stages WHERE order_id = ? AND stage_key = ?").get(d.order_id, d.stage);

  res.status(201).json({ event, updated_stage: updatedStage });
});

// Idempotent counterpart for operational UIs that report cumulative quantities.
const absoluteStageUpdateSchema = z.object({
  completed: z.number().int().min(0),
  rejected: z.number().int().min(0).optional(),
  state: z.enum(["completed", "current", "pending", "delayed"]),
  note: z.string().max(2000).optional(),
});

router.patch("/stages/:orderId/:stage", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const orderId = String(req.params.orderId);
  const stage = String(req.params.stage);
  if (!STAGES.includes(stage)) { res.status(400).json({ error: "Invalid stage" }); return; }
  const parsed = absoluteStageUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const existing = db.prepare("SELECT * FROM order_stages WHERE order_id = ? AND stage_key = ?").get(orderId, stage) as any;
  if (!existing) { res.status(404).json({ error: "Order stage not found" }); return; }
  const d = parsed.data;
  if (d.completed > existing.target) { res.status(422).json({ error: "Completed quantity cannot exceed target" }); return; }
  const rejected = d.rejected ?? existing.rejected;
  const delta = d.completed - existing.completed;
  const eventId = uuidv4();
  db.transaction(() => {
    db.prepare(`UPDATE order_stages SET completed = ?, rejected = ?, pending = ?, progress = ?, state = ?, updated_at = datetime('now')
      WHERE order_id = ? AND stage_key = ?`).run(d.completed, rejected, existing.target - d.completed, Math.round(d.completed * 100 / existing.target), d.state, orderId, stage);
    db.prepare(`INSERT INTO production_events (id, order_id, stage, completed_delta, rejected_delta, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(eventId, orderId, stage, delta, rejected - existing.rejected, d.note ?? "Cumulative stage update", req.identity!.userId);
    const aggregate = db.prepare("SELECT ROUND(AVG(progress)) AS progress FROM order_stages WHERE order_id = ?").get(orderId) as { progress: number };
    db.prepare("UPDATE orders SET progress = ?, current_stage = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(aggregate.progress || 0, stage, d.state === "delayed" ? "Delayed" : d.state === "completed" && d.completed === existing.target ? "Completed" : "On Track", orderId);
  })();
  res.json({ eventId, stage: db.prepare("SELECT * FROM order_stages WHERE order_id = ? AND stage_key = ?").get(orderId, stage), order: db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) });
});

export default router;
