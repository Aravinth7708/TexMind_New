import { Router, Request, Response } from "express";
import { z } from "zod";
import db from "../db/client";
import { computeRisk, getAttentionItems } from "../lib/risk";

const router = Router();

const decideSchema = z.object({
  note: z.string().optional(),
});

/**
 * GET /api/operational/attention
 * Returns prioritized risk attention queue directly matching operational-client.ts schema
 */
router.get("/attention", (_req: Request, res: Response) => {
  const items = getAttentionItems();
  res.json({
    items,
    source: "deterministic-operational-engine-v1",
  });
});

/**
 * GET /api/operational/orders/:orderId/risk
 * Returns deterministic risk score for single order
 */
router.get("/orders/:orderId/risk", (req: Request, res: Response) => {
  const orderId = String(req.params.orderId);
  const risk = computeRisk(orderId);
  if (!risk) {
    res.status(404).json({ error: `Order '${orderId}' not found` });
    return;
  }
  res.json(risk);
});

/**
 * GET /api/operational/proposals
 * Returns all proposals matching proposalSchema
 */
router.get("/proposals", (_req: Request, res: Response) => {
  const rows = db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as any[];
  res.json(rows);
});

/**
 * POST /api/operational/proposals/:proposalId/approve
 * Human-in-the-loop approval of proposal matching operational-client.ts
 */
router.post("/proposals/:proposalId/approve", (req: Request, res: Response) => {
  const proposalId = String(req.params.proposalId);
  const parsed = decideSchema.safeParse(req.body);
  const note = parsed.success ? parsed.data.note : undefined;

  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId) as any;
  if (!proposal) {
    res.status(404).json({ error: `Proposal '${proposalId}' not found` });
    return;
  }

  if (proposal.status !== "pending") {
    res.status(409).json({ error: `Proposal already ${proposal.status}` });
    return;
  }

  const actor = (req as any).user?.name || req.header("X-Texmind-User") || "Factory Manager";

  db.prepare(`
    UPDATE proposals
    SET status = 'approved',
        decided_by = ?,
        decided_at = datetime('now'),
        decision_note = ?
    WHERE id = ?
  `).run(actor, note || "Approved via Command Centre", proposalId);

  const updated = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId);
  res.json(updated);
});

/**
 * POST /api/operational/proposals/:proposalId/dismiss
 * Dismiss proposal matching operational-client.ts
 */
router.post("/proposals/:proposalId/dismiss", (req: Request, res: Response) => {
  const proposalId = String(req.params.proposalId);
  const parsed = decideSchema.safeParse(req.body);
  const note = parsed.success ? parsed.data.note : undefined;

  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId) as any;
  if (!proposal) {
    res.status(404).json({ error: `Proposal '${proposalId}' not found` });
    return;
  }

  if (proposal.status !== "pending") {
    res.status(409).json({ error: `Proposal already ${proposal.status}` });
    return;
  }

  const actor = (req as any).user?.name || req.header("X-Texmind-User") || "Factory Manager";

  db.prepare(`
    UPDATE proposals
    SET status = 'dismissed',
        decided_by = ?,
        decided_at = datetime('now'),
        decision_note = ?
    WHERE id = ?
  `).run(actor, note || "Dismissed by operator", proposalId);

  const updated = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId);
  res.json(updated);
});

export default router;
