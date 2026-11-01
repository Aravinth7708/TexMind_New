import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createProposalSchema = z.object({
  order_id: z.string().min(1).max(64),
  title: z.string().min(3).max(160),
  action_type: z.enum(["overtime", "line_reallocation", "expedite_material", "buyer_update", "other"]),
  rationale: z.string().min(3).max(1000),
});

const decisionSchema = z.object({
  note: z.string().max(500).optional(),
});

// GET /api/proposals
router.get("/", (req: Request, res: Response) => {
  const { order_id, status } = req.query as { order_id?: string; status?: string };
  let query = "SELECT * FROM proposals WHERE 1=1";
  const params: unknown[] = [];

  if (order_id) { query += " AND order_id = ?"; params.push(order_id); }
  if (status) { query += " AND status = ?"; params.push(status); }
  query += " ORDER BY created_at DESC";

  const proposals = db.prepare(query).all(...params as []);
  res.json({ items: proposals });
});

// POST /api/proposals
router.post("/", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const parsed = createProposalSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const d = parsed.data;
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(d.order_id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const id = uuidv4();
  const createdBy = req.identity!.userId;

  db.prepare(`
    INSERT INTO proposals (id, order_id, title, action_type, rationale, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, d.order_id, d.title, d.action_type, d.rationale, createdBy);

  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
  res.status(201).json(proposal);
});

// POST /api/proposals/:id/approve
router.post("/:id/approve", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed" }); return; }

  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as { status: string } | undefined;
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }
  if (proposal.status !== "pending") { res.status(409).json({ error: `Proposal is already ${proposal.status}` }); return; }

  db.prepare(`
    UPDATE proposals SET status = 'approved', decided_by = ?, decided_at = datetime('now'), decision_note = ?
    WHERE id = ?
  `).run(req.identity!.userId, parsed.data.note ?? null, id);

  res.json(db.prepare("SELECT * FROM proposals WHERE id = ?").get(id));
});

// POST /api/proposals/:id/dismiss
router.post("/:id/dismiss", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed" }); return; }

  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as { status: string } | undefined;
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }
  if (proposal.status !== "pending") { res.status(409).json({ error: `Proposal is already ${proposal.status}` }); return; }

  db.prepare(`
    UPDATE proposals SET status = 'dismissed', decided_by = ?, decided_at = datetime('now'), decision_note = ?
    WHERE id = ?
  `).run(req.identity!.userId, parsed.data.note ?? null, id);

  res.json(db.prepare("SELECT * FROM proposals WHERE id = ?").get(id));
});

export default router;
