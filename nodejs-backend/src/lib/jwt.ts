import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "texmind_super_secret_jwt_key_change_in_production";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  stage?: string;
  buyerId?: string;
  title?: string;
  iat?: number;
  exp?: number;
}

/**
 * Returns cookie maxAge in milliseconds based on user role:
 * - Admin & Manager: 10 days
 * - All others (buyer, supervisor, process, viewer): 30 days
 */
export function cookieMaxAge(role: string): number {
  if (role === "admin" || role === "manager") {
    return 10 * 24 * 60 * 60 * 1000; // 10 days
  }
  return 30 * 24 * 60 * 60 * 1000; // 30 days
}

/**
 * Signs a JWT token with appropriate expiration time:
 * - Admin & Manager: 10 days ("10d")
 * - Others: 30 days ("30d")
 */
export function signToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  const expiresIn = payload.role === "admin" || payload.role === "manager" ? "10d" : "30d";
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifies a JWT token and returns the typed payload.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
