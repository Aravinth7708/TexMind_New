import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import db from "../db/client";
import { signToken, cookieMaxAge } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();
const COOKIE_NAME = "texmind_token";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  stage: string | null;
  buyer_id: string | null;
  title: string | null;
};

// POST /api/auth/login
router.post("/login", (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid email or password format" });
    return;
  }
  const { email, password } = parsed.data;

  const user = db
    .prepare("SELECT id, email, password_hash, name, role, stage, buyer_id, title FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // If user role is buyer but buyer_id is unset, attempt to link with BUY-01 or matching contact
  let resolvedBuyerId = user.buyer_id;
  if (user.role === "buyer" && !resolvedBuyerId) {
    const matchedBuyer = db.prepare("SELECT id FROM buyers WHERE LOWER(contact) = ? OR id = 'BUY-01' LIMIT 1").get(user.email.toLowerCase()) as { id: string } | undefined;
    if (matchedBuyer) {
      resolvedBuyerId = matchedBuyer.id;
      db.prepare("UPDATE users SET buyer_id = ? WHERE id = ?").run(resolvedBuyerId, user.id);
    }
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    stage: user.stage ?? undefined,
    buyerId: resolvedBuyerId ?? undefined,
    title: user.title ?? undefined,
  };

  const token = signToken(payload);
  const maxAge = cookieMaxAge(user.role);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  });

  res.json({
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      stage: user.stage,
      buyer_id: resolvedBuyerId,
      title: user.title,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict" });
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req: Request, res: Response) => {
  const identity = req.identity!;
  const user = db
    .prepare("SELECT id, email, name, role, stage, buyer_id, title FROM users WHERE id = ?")
    .get(identity.userId) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      stage: user.stage,
      buyer_id: user.buyer_id,
      title: user.title,
    },
  });
});

export default router;
