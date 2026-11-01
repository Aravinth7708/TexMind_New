import { Router, Request, Response } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import db from "../db/client";
import { requireAuth, requireRoles } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRoles("admin"));

const STAGES = ["yarn","knitting","dyeing","compacting","cutting","printing","sewing","ironing","packing"];

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(["admin", "manager", "supervisor", "viewer", "buyer", "process"]),
  stage: z.string().optional(),
  title: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "manager", "supervisor", "viewer", "buyer", "process"]).optional(),
  stage: z.string().optional(),
  title: z.string().optional(),
  password: z.string().min(6).optional(),
});

// GET /api/users
router.get("/", (_req: Request, res: Response) => {
  const users = db.prepare("SELECT id, email, name, role, stage, title, created_at FROM users ORDER BY created_at DESC").all();
  res.json(users);
});

// GET /api/users/:id
router.get("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const user = db.prepare("SELECT id, email, name, role, stage, title, created_at FROM users WHERE id = ?").get(id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// POST /api/users
router.post("/", (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const d = parsed.data;

  // Validate stage for process role
  if (d.role === "process" && (!d.stage || !STAGES.includes(d.stage))) {
    res.status(422).json({ error: `Process role requires a valid stage: ${STAGES.join(", ")}` });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(d.email.toLowerCase());
  if (existing) { res.status(409).json({ error: "Email already registered" }); return; }

  const id = uuidv4();
  const hash = bcrypt.hashSync(d.password, 10);
  const stageLabel = d.stage ? d.stage.charAt(0).toUpperCase() + d.stage.slice(1) : null;
  const title = d.title ?? (d.role === "process" && stageLabel ? `${stageLabel} Process Portal` : `${d.role.charAt(0).toUpperCase() + d.role.slice(1)}`);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, stage, title)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, d.email.toLowerCase(), hash, d.name, d.role, d.stage ?? null, title);

  res.status(201).json(db.prepare("SELECT id, email, name, role, stage, title, created_at FROM users WHERE id = ?").get(id));
});

// PATCH /api/users/:id
router.patch("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const fields = parsed.data;
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (fields.password) {
    sets.push("password_hash = ?");
    vals.push(bcrypt.hashSync(fields.password, 10));
  }
  for (const [k, v] of Object.entries(fields)) {
    if (k === "password" || v === undefined) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (sets.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }

  sets.push("updated_at = datetime('now')");
  vals.push(id);
  db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals as []);

  res.json(db.prepare("SELECT id, email, name, role, stage, title, created_at FROM users WHERE id = ?").get(id));
});

// DELETE /api/users/:id
router.delete("/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (req.identity!.userId === id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ message: "User deleted successfully" });
});

export default router;
