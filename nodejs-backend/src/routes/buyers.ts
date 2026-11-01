import { Router, Request, Response } from "express";
import { z } from "zod";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const createBuyerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  company: z.string().min(1),
  country: z.string().min(1),
  contact: z.string().email(),
});

const updateBuyerSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  contact: z.string().email().optional(),
});

// GET /api/buyers
router.get("/", (_req: Request, res: Response) => {
  const buyers = db.prepare("SELECT * FROM buyers ORDER BY company").all();
  res.json(buyers);
});

// GET /api/buyers/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const buyer = db.prepare("SELECT * FROM buyers WHERE id = ?").get(id);
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }
  res.json(buyer);
});

// GET /api/buyers/:id/orders
router.get("/:id/orders", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const buyer = db.prepare("SELECT id FROM buyers WHERE id = ?").get(id);
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }

  const orders = db.prepare("SELECT * FROM orders WHERE buyer_id = ? ORDER BY created_at DESC").all(id);
  res.json(orders);
});

// POST /api/buyers
router.post("/", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const parsed = createBuyerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const d = parsed.data;
  const existing = db.prepare("SELECT id FROM buyers WHERE id = ?").get(d.id);
  if (existing) { res.status(409).json({ error: "Buyer ID already exists" }); return; }

  db.prepare("INSERT INTO buyers (id, name, company, country, contact) VALUES (?, ?, ?, ?, ?)").run(d.id, d.name, d.company, d.country, d.contact);
  const buyer = db.prepare("SELECT * FROM buyers WHERE id = ?").get(d.id);
  res.status(201).json(buyer);
});

// PATCH /api/buyers/:id
router.patch("/:id", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateBuyerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const buyer = db.prepare("SELECT id FROM buyers WHERE id = ?").get(id);
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  vals.push(id);
  db.prepare(`UPDATE buyers SET ${sets.join(", ")} WHERE id = ?`).run(...vals as []);
  res.json(db.prepare("SELECT * FROM buyers WHERE id = ?").get(id));
});

// DELETE /api/buyers/:id
router.delete("/:id", requireRoles("admin", "manager"), (req: Request, res: Response) => {
  const id = String(req.params.id);
  const buyer = db.prepare("SELECT id FROM buyers WHERE id = ?").get(id);
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }

  // Check if buyer has orders
  const hasOrders = db.prepare("SELECT id FROM orders WHERE buyer_id = ? LIMIT 1").get(id);
  if (hasOrders) {
    res.status(409).json({ error: "Cannot delete buyer with existing production orders" });
    return;
  }

  db.prepare("DELETE FROM buyers WHERE id = ?").run(id);
  res.json({ success: true, message: "Buyer deleted" });
});

export default router;
