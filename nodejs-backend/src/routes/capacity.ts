import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const rebalanceSchema = z.object({
  from_line_id: z.string().min(1, "Source line required"),
  to_line_id: z.string().min(1, "Destination line required"),
  operators_moved: z.number().int().min(1, "Must move at least 1 operator"),
  reason: z.string().optional(),
});

/**
 * GET /api/capacity/lines
 * Returns all active production lines with operator assignments, skill matrix, and efficiency
 */
router.get("/lines", (_req: Request, res: Response) => {
  const lines = db.prepare(`
    SELECT 
      pl.*,
      o.product as active_order_product,
      o.buyer as active_order_buyer
    FROM production_lines pl
    LEFT JOIN orders o ON pl.active_order_id = o.id
    ORDER BY pl.id ASC
  `).all() as any[];

  const parsedLines = lines.map((l) => ({
    id: l.id,
    name: l.name,
    stage: l.stage,
    operatorsAssigned: l.operators_assigned,
    operatorsOptimal: l.operators_optimal,
    efficiency: l.efficiency,
    targetHourly: l.target_hourly,
    actualHourly: l.actual_hourly,
    activeStyle: l.active_style,
    activeOrderId: l.active_order_id,
    activeOrderProduct: l.active_order_product || null,
    activeOrderBuyer: l.active_order_buyer || null,
    status: l.status,
    skillCoverage: (() => {
      try {
        return JSON.parse(l.skill_coverage);
      } catch {
        return {};
      }
    })(),
    aiRecommendation: l.ai_recommendation || null,
    updatedAt: l.updated_at,
  }));

  const totalOperators = parsedLines.reduce((acc, l) => acc + l.operatorsAssigned, 0);
  const avgEfficiency = parsedLines.length > 0
    ? Math.round(parsedLines.reduce((acc, l) => acc + l.efficiency, 0) / parsedLines.length)
    : 0;
  const bottlenecksCount = parsedLines.filter((l) => l.status === "Bottleneck").length;

  res.json({
    lines: parsedLines,
    summary: {
      totalOperators,
      avgEfficiency,
      bottlenecksCount,
      totalLines: parsedLines.length,
    },
  });
});

/**
 * POST /api/capacity/rebalance
 * Operator reallocation workflow between production lines
 */
router.post("/rebalance", (req: Request, res: Response) => {
  const parsed = rebalanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const { from_line_id, to_line_id, operators_moved, reason } = parsed.data;

  if (from_line_id === to_line_id) {
    res.status(400).json({ error: "Source and destination lines cannot be the same" });
    return;
  }

  const fromLine = db.prepare("SELECT * FROM production_lines WHERE id = ?").get(from_line_id) as any;
  const toLine = db.prepare("SELECT * FROM production_lines WHERE id = ?").get(to_line_id) as any;

  if (!fromLine) {
    res.status(404).json({ error: `Source line '${from_line_id}' not found` });
    return;
  }
  if (!toLine) {
    res.status(404).json({ error: `Destination line '${to_line_id}' not found` });
    return;
  }

  if (fromLine.operators_assigned < operators_moved) {
    res.status(422).json({
      error: `Cannot move ${operators_moved} operators; line '${fromLine.name}' only has ${fromLine.operators_assigned} assigned.`,
    });
    return;
  }

  const logId = `reb-${Date.now()}`;
  const userName = (req as any).user?.name || "Floor Supervisor";

  const txn = db.transaction(() => {
    const newFromAssigned = fromLine.operators_assigned - operators_moved;
    const newToAssigned = toLine.operators_assigned + operators_moved;

    // Recalculate statuses
    const newFromStatus = newFromAssigned < fromLine.operators_optimal * 0.8 ? "Underloaded" : "Optimal";
    const newToStatus = newToAssigned >= toLine.operators_optimal ? "Optimal" : toLine.status;

    db.prepare(`
      UPDATE production_lines 
      SET operators_assigned = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newFromAssigned, newFromStatus, from_line_id);

    db.prepare(`
      UPDATE production_lines 
      SET operators_assigned = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newToAssigned, newToStatus, to_line_id);

    db.prepare(`
      INSERT INTO line_rebalance_logs (
        id, from_line_id, to_line_id, operators_moved, reason, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      from_line_id,
      to_line_id,
      operators_moved,
      reason || "Floor supervisor rebalance",
      userName,
    );

    // Create notification
    db.prepare(`
      INSERT INTO notifications (id, type, title, body, time, read, tone, target_role)
      VALUES (?, ?, ?, ?, datetime('now'), 0, ?, ?)
    `).run(
      uuidv4(),
      "workforce_rebalance",
      "Workforce Reallocation Executed",
      `Transferred ${operators_moved} operators from ${fromLine.name} to ${toLine.name}.`,
      "info",
      "admin",
    );
  });

  txn();

  const updatedFrom = db.prepare("SELECT * FROM production_lines WHERE id = ?").get(from_line_id);
  const updatedTo = db.prepare("SELECT * FROM production_lines WHERE id = ?").get(to_line_id);

  res.json({
    success: true,
    rebalanceLogId: logId,
    transferred: operators_moved,
    fromLine: updatedFrom,
    toLine: updatedTo,
  });
});

export default router;
