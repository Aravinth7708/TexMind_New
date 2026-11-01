import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/jwt";

// Extend Express Request with identity
declare global {
  namespace Express {
    interface Request {
      identity?: TokenPayload;
    }
  }
}

const COOKIE_NAME = "texmind_token";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;

  if (!token) {
    res.status(401).json({ error: "Not authenticated. Please log in." });
    return;
  }

  try {
    req.identity = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.identity) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    if (!roles.includes(req.identity.role)) {
      res.status(403).json({ error: `Access denied. Required role(s): ${roles.join(", ")}` });
      return;
    }
    next();
  };
}
