import { Router, Request, Response } from "express";
import db from "../db/client";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /api/notifications
router.get("/", (req: Request, res: Response) => {
  const role = req.identity!.role;
  const target = role === "buyer" ? "buyer" : "admin";

  const notifications = db
    .prepare("SELECT * FROM notifications WHERE target_role = ? ORDER BY created_at DESC")
    .all(target);

  res.json(notifications);
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", (req: Request, res: Response) => {
  const notif = db.prepare("SELECT id FROM notifications WHERE id = ?").get(req.params.id);
  if (!notif) { res.status(404).json({ error: "Notification not found" }); return; }

  db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(req.params.id);
  res.json({ message: "Marked as read" });
});

// PATCH /api/notifications/read-all
router.patch("/read-all", (req: Request, res: Response) => {
  const role = req.identity!.role;
  const target = role === "buyer" ? "buyer" : "admin";
  db.prepare("UPDATE notifications SET read = 1 WHERE target_role = ?").run(target);
  res.json({ message: "All notifications marked as read" });
});

export default router;
