import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const STAGES = [
  "yarn",
  "knitting",
  "dyeing",
  "compacting",
  "cutting",
  "printing",
  "sewing",
  "ironing",
  "packing",
] as const;

type StageKey = (typeof STAGES)[number];

const STAGE_LABELS: Record<StageKey, string> = {
  yarn: "Yarn",
  knitting: "Knitting",
  dyeing: "Dyeing",
  compacting: "Compacting",
  cutting: "Cutting",
  printing: "Printing",
  sewing: "Sewing",
  ironing: "Ironing",
  packing: "Packing",
};

const quickLogSchema = z.object({
  order_id: z.string().min(1).max(64),
  stage: z.enum(STAGES),
  completed_delta: z.number().int().min(0).max(1_000_000).default(0),
  rejected_delta: z.number().int().min(0).max(1_000_000).default(0),
  line_no: z.string().max(64).optional(),
  shift: z.string().max(32).optional(),
  note: z.string().max(500).optional(),
  photo_url: z.string().max(500).optional(),
  voice_transcript: z.string().max(1000).optional(),
});

const batchSyncSchema = z.object({
  items: z.array(quickLogSchema).min(1).max(100),
});

const voiceParseSchema = z.object({
  transcript: z.string().min(1).max(1000),
});

const assignStageSchema = z.object({
  order_id: z.string().min(1),
  manager: z.string().min(1).optional(),
  expected: z.string().min(1).optional(),
  rate: z.number().int().min(0).optional(),
});

/**
 * Validates whether the caller has rights to log for this stage.
 * If role is 'process', they can only log for their assigned stage.
 */
function assertStagePermission(req: Request, targetStage: string): { allowed: boolean; reason?: string } {
  const identity = req.identity!;
  if (["admin", "manager", "supervisor"].includes(identity.role)) {
    return { allowed: true };
  }
  if (identity.role === "process") {
    if (identity.stage && identity.stage.toLowerCase() === targetStage.toLowerCase()) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Process incharge (${identity.stage}) cannot log updates for ${targetStage} stage`,
    };
  }
  return { allowed: false, reason: "Unauthorized role for supervisor operations" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/supervisor/quick-log
// ─────────────────────────────────────────────────────────────────────────────
router.post("/quick-log", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const parsed = quickLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;

  // 🛡️ Stage permission check for process incharge
  const perm = assertStagePermission(req, d.stage);
  if (!perm.allowed) {
    res.status(403).json({ error: perm.reason });
    return;
  }

  if (d.completed_delta === 0 && d.rejected_delta === 0) {
    res.status(422).json({ error: "At least one delta (completed or rejected) must be non-zero" });
    return;
  }

  const order = db.prepare("SELECT id, current_stage, status FROM orders WHERE id = ?").get(d.order_id) as
    | { id: string; current_stage: string; status: string }
    | undefined;

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const eventId = `evt-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const createdBy = req.identity!.userId;

  db.transaction(() => {
    // 1. Insert into production_events
    db.prepare(`
      INSERT INTO production_events (
        id, order_id, stage, completed_delta, rejected_delta,
        line_no, shift, photo_url, voice_transcript, note, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      d.order_id,
      d.stage,
      d.completed_delta,
      d.rejected_delta,
      d.line_no ?? null,
      d.shift ?? "Shift A",
      d.photo_url ?? null,
      d.voice_transcript ?? null,
      d.note ?? null,
      createdBy,
    );

    // 2. Update order_stages
    db.prepare(`
      UPDATE order_stages
      SET completed = completed + ?,
          rejected = rejected + ?,
          pending = MAX(0, pending - ?),
          progress = ROUND(CAST(completed + ? AS REAL) / NULLIF(target,0) * 100),
          updated_at = datetime('now')
      WHERE order_id = ? AND stage_key = ?
    `).run(d.completed_delta, d.rejected_delta, d.completed_delta, d.completed_delta, d.order_id, d.stage);

    // 3. Recalculate order overall progress
    const avg = db.prepare("SELECT ROUND(AVG(progress)) as p FROM order_stages WHERE order_id = ?").get(d.order_id) as {
      p: number;
    };
    db.prepare("UPDATE orders SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(avg.p || 0, d.order_id);
  })();

  const event = db.prepare("SELECT * FROM production_events WHERE id = ?").get(eventId);
  const updatedStage = db.prepare("SELECT * FROM order_stages WHERE order_id = ? AND stage_key = ?").get(d.order_id, d.stage);
  const updatedOrder = db.prepare("SELECT id, current_stage, progress, status FROM orders WHERE id = ?").get(d.order_id);

  res.status(201).json({
    success: true,
    message: `Logged ${d.completed_delta} completed pcs and ${d.rejected_delta} rejects for ${d.order_id} at ${STAGE_LABELS[d.stage]}`,
    event,
    stage: updatedStage,
    order: updatedOrder,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/supervisor/batch-sync
// ─────────────────────────────────────────────────────────────────────────────
router.post("/batch-sync", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const parsed = batchSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { items } = parsed.data;
  let synced = 0;
  const errors: { index: number; error: string }[] = [];
  const createdEvents: unknown[] = [];

  const syncAll = db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      const perm = assertStagePermission(req, d.stage);
      if (!perm.allowed) {
        errors.push({ index: i, error: perm.reason || "Unauthorized stage" });
        continue;
      }

      const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(d.order_id);
      if (!order) {
        errors.push({ index: i, error: `Order ${d.order_id} not found` });
        continue;
      }

      const eventId = `evt-${Date.now()}-${i}-${Math.floor(Math.random() * 900 + 100)}`;
      db.prepare(`
        INSERT INTO production_events (
          id, order_id, stage, completed_delta, rejected_delta,
          line_no, shift, photo_url, voice_transcript, note, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        d.order_id,
        d.stage,
        d.completed_delta,
        d.rejected_delta,
        d.line_no ?? null,
        d.shift ?? "Shift A",
        d.photo_url ?? null,
        d.voice_transcript ?? null,
        d.note ?? null,
        req.identity!.userId,
      );

      db.prepare(`
        UPDATE order_stages
        SET completed = completed + ?,
            rejected = rejected + ?,
            pending = MAX(0, pending - ?),
            progress = ROUND(CAST(completed + ? AS REAL) / NULLIF(target,0) * 100),
            updated_at = datetime('now')
        WHERE order_id = ? AND stage_key = ?
      `).run(d.completed_delta, d.rejected_delta, d.completed_delta, d.completed_delta, d.order_id, d.stage);

      const avg = db.prepare("SELECT ROUND(AVG(progress)) as p FROM order_stages WHERE order_id = ?").get(d.order_id) as {
        p: number;
      };
      db.prepare("UPDATE orders SET progress = ?, updated_at = datetime('now') WHERE id = ?").run(avg.p || 0, d.order_id);

      synced++;
      createdEvents.push(eventId);
    }
  });

  syncAll();

  res.json({
    synced_count: synced,
    failed_count: errors.length,
    errors,
    events: createdEvents,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/supervisor/voice-parse
// ─────────────────────────────────────────────────────────────────────────────
router.post("/voice-parse", (req: Request, res: Response) => {
  const parsed = voiceParseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Transcript is required" });
    return;
  }

  const text = parsed.data.transcript;
  const lower = text.toLowerCase();

  // 1. Detect Stage
  let stage: StageKey | null = null;
  if (/yarn|நூல்/i.test(text)) stage = "yarn";
  else if (/knitting|பின்னல்/i.test(text)) stage = "knitting";
  else if (/dyeing|டை|dye/i.test(text)) stage = "dyeing";
  else if (/compacting|காம்பேக்டிங்/i.test(text)) stage = "compacting";
  else if (/cutting|வெட்டு|கட்டிங்/i.test(text)) stage = "cutting";
  else if (/printing|அச்சிடுதல்|பிரிண்டிங்/i.test(text)) stage = "printing";
  else if (/sewing|தையல்|தையல்/i.test(text)) stage = "sewing";
  else if (/ironing|அயர்னிங்|தேய்த்தல்/i.test(text)) stage = "ironing";
  else if (/packing|பேக்கிங்|பொதிசெய்தல்/i.test(text)) stage = "packing";

  // 2. Detect Order ID (e.g. ORD-2026-015 or 015 or 011)
  let orderId: string | null = null;
  const orderMatch = text.match(/ORD-\d{4}-\d{3}/i);
  if (orderMatch) {
    orderId = orderMatch[0].toUpperCase();
  } else {
    // Try matching shorthand like "011" or "015"
    const numMatch = text.match(/\b(0\d{2})\b/);
    if (numMatch) {
      const match = db.prepare("SELECT id FROM orders WHERE id LIKE ? ORDER BY id LIMIT 1").get(`%-${numMatch[1]}`) as { id: string } | undefined;
      orderId = match?.id ?? null;
    }
  }

  // 3. Detect Completed Quantity
  let completedDelta = 0;
  // Match numbers with optional commas like 2,400 or 450
  const qtyMatch = text.match(/(\b\d{1,3}(,\d{3})+\b|\b\d{2,6}\b)/);
  if (qtyMatch) {
    completedDelta = parseInt(qtyMatch[0].replace(/,/g, ""), 10);
  }

  // 4. Detect Line
  let lineNo: string | null = null;
  const lineMatch = text.match(/line\s*([0-9A-Za-z]+)/i);
  if (lineMatch) {
    lineNo = `Line ${lineMatch[1]}`;
  }

  // 5. Detect Rejection
  let rejectedDelta = 0;
  const rejectMatch = text.match(/(?:reject|ரிஜக்ட்|சேதம்)\D*(\d+)/i);
  if (rejectMatch) {
    rejectedDelta = parseInt(rejectMatch[1], 10);
  }

  res.json({
    raw_transcript: text,
    parsed: {
      order_id: orderId,
      stage,
      stage_label: stage ? STAGE_LABELS[stage] : null,
      completed_delta: completedDelta,
      rejected_delta: rejectedDelta,
      line_no: lineNo,
      shift: "Shift A",
      intent: stage ? `Log ${completedDelta} pieces in ${STAGE_LABELS[stage]}${orderId ? ` for ${orderId}` : ""}` : "Could not identify a production stage",
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/supervisor/stage/:stage
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stage/:stage", (req: Request, res: Response) => {
  const stage = String(req.params.stage).toLowerCase() as StageKey;
  if (!STAGES.includes(stage)) {
    res.status(400).json({ error: `Invalid stage. Valid stages: ${STAGES.join(", ")}` });
    return;
  }

  const label = STAGE_LABELS[stage];

  // Stage aggregates
  const agg = db.prepare(`
    SELECT SUM(target) as totalTarget,
           SUM(completed) as totalCompleted,
           SUM(pending) as totalPending,
           SUM(rejected) as totalRejected,
           ROUND(AVG(CASE WHEN target > 0 THEN CAST(completed AS REAL)/target*100 ELSE 0 END), 1) as efficiency,
           manager
    FROM order_stages
    WHERE stage_key = ?
    GROUP BY stage_key
  `).get(stage) as {
    totalTarget: number;
    totalCompleted: number;
    totalPending: number;
    totalRejected: number;
    efficiency: number;
    manager: string;
  } | undefined;

  const totalCompleted = agg?.totalCompleted || 0;
  const totalRejected = agg?.totalRejected || 0;
  const rejectionRate = totalCompleted > 0 ? Math.round((totalRejected / totalCompleted) * 1000) / 10 : 0;

  // Active orders currently in this stage
  const activeOrders = db.prepare(`
    SELECT o.id, o.buyer, o.product, o.quantity, o.delivery_date, o.priority, o.status,
           os.target, os.completed, os.pending, os.rejected, os.progress, os.rate, os.manager, os.expected
    FROM orders o
    JOIN order_stages os ON o.id = os.order_id AND os.stage_key = ?
    WHERE o.current_stage = ? AND o.status != 'Completed'
    ORDER BY o.priority DESC, o.delivery_date ASC
  `).all(stage, stage);

  // Recent production events logged at this stage
  const recentEvents = db.prepare(`
    SELECT pe.*, u.name as operator_name, o.product, o.buyer
    FROM production_events pe
    LEFT JOIN users u ON pe.created_by = u.id
    LEFT JOIN orders o ON pe.order_id = o.id
    WHERE pe.stage = ?
    ORDER BY pe.created_at DESC
    LIMIT 15
  `).all(stage);

  // Line performance breakdown (simulated across Line 1, 2, 3, 4)
  const lineBreakdown = [
    { line: "Line 1", capacity: 3000, output: Math.round(totalCompleted * 0.28), efficiency: 92 },
    { line: "Line 2", capacity: 3200, output: Math.round(totalCompleted * 0.31), efficiency: 89 },
    { line: "Line 3", capacity: 2800, output: Math.round(totalCompleted * 0.24), efficiency: 76 },
    { line: "Line 4", capacity: 2500, output: Math.round(totalCompleted * 0.17), efficiency: 85 },
  ];

  res.json({
    stage,
    label,
    manager: agg?.manager || "Stage Incharge",
    kpis: {
      totalTarget: agg?.totalTarget || 0,
      totalCompleted,
      totalPending: agg?.totalPending || 0,
      totalRejected,
      efficiency: agg?.efficiency || 0,
      rejectionRate,
      activeOrdersCount: (activeOrders as unknown[]).length,
    },
    activeOrders,
    recentEvents,
    lineBreakdown,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /api/supervisor/stage/:stage/assign
// ─────────────────────────────────────────────────────────────────────────────
router.post("/stage/:stage/assign", requireRoles("admin", "manager", "supervisor", "process"), (req: Request, res: Response) => {
  const stage = String(req.params.stage).toLowerCase() as StageKey;
  if (!STAGES.includes(stage)) {
    res.status(400).json({ error: `Invalid stage. Valid stages: ${STAGES.join(", ")}` });
    return;
  }

  const perm = assertStagePermission(req, stage);
  if (!perm.allowed) {
    res.status(403).json({ error: perm.reason });
    return;
  }

  const parsed = assignStageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const stageRow = db.prepare("SELECT id FROM order_stages WHERE order_id = ? AND stage_key = ?").get(d.order_id, stage);
  if (!stageRow) {
    res.status(404).json({ error: `Order ${d.order_id} has no ${stage} stage record` });
    return;
  }

  const sets: string[] = [];
  const vals: unknown[] = [];

  if (d.manager) { sets.push("manager = ?"); vals.push(d.manager); }
  if (d.expected) { sets.push("expected = ?"); vals.push(d.expected); }
  if (d.rate !== undefined) { sets.push("rate = ?"); vals.push(d.rate); }

  if (sets.length === 0) {
    res.status(400).json({ error: "No assign fields provided" });
    return;
  }

  sets.push("updated_at = datetime('now')");
  vals.push(d.order_id, stage);

  db.prepare(`UPDATE order_stages SET ${sets.join(", ")} WHERE order_id = ? AND stage_key = ?`).run(...vals as []);

  const updated = db.prepare("SELECT * FROM order_stages WHERE order_id = ? AND stage_key = ?").get(d.order_id, stage);
  res.json({ message: "Stage allocation updated successfully", stage: updated });
});

export default router;

