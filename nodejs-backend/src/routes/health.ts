import { Router, Request, Response } from "express";
import db from "../db/client";

const router = Router();

// GET /api/health
router.get("/", (_req: Request, res: Response) => {
  try {
    const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
    const orderCount = db.prepare("SELECT COUNT(*) as cnt FROM orders").get() as { cnt: number };

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        status: "ok",
        users: userCount.cnt,
        orders: orderCount.cnt,
      },
      version: "1.0.0",
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
