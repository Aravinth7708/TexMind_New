import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: "Validation failed",
      details: err.issues.map((e) => ({ field: e.path.join("."), message: e.message })),
    });
    return;
  }

  if (err instanceof Error) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
