import { Request, Response, NextFunction } from "express";
import {
  validateSession,
  sessionCookieName,
  SessionUser,
} from "../services/session.js";

export interface AuthRequest extends Request {
  user?: SessionUser;
  sessionId?: string;
}

/**
 * Middleware to authenticate via the httpOnly session cookie
 * (Authorization: Bearer <token> also accepted for API clients).
 * Resolves the user fresh from the DB on every request — role is never
 * trusted from a client-supplied token.
 */
export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token =
    req.cookies?.[sessionCookieName] ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  validateSession(token)
    .then((session) => {
      if (!session) {
        res.status(401).json({ error: "Session invalid or expired" });
        return;
      }
      if (session.pending2FA) {
        res.status(401).json({ error: "Two-factor verification required" });
        return;
      }
      req.user = session.user;
      req.sessionId = session.sessionId;
      next();
    })
    .catch((err) => {
      console.error("Auth middleware error:", err);
      res.status(500).json({ error: "Authentication failed" });
    });
}

/**
 * Middleware that authenticates but permits 2FA-pending sessions —
 * used only by the 2FA verification endpoint.
 */
export function authenticateAllowPending2FA(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const token =
    req.cookies?.[sessionCookieName] ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  validateSession(token)
    .then((session) => {
      if (!session) {
        res.status(401).json({ error: "Session invalid or expired" });
        return;
      }
      req.user = session.user;
      req.sessionId = session.sessionId;
      next();
    })
    .catch((err) => {
      console.error("Auth middleware error:", err);
      res.status(500).json({ error: "Authentication failed" });
    });
}

/** Require the admin role (server-side enforcement). */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  // Admins must prove inbox control before the console unlocks.
  if (!req.user.emailVerified) {
    res.status(403).json({
      error: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before using the admin console.",
    });
    return;
  }
  // Admins must complete 2FA enrollment before touching admin APIs.
  if (req.user.totpRequired && !req.user.totpEnabled) {
    res.status(403).json({
      error: "TOTP_SETUP_REQUIRED",
      message: "Two-factor authentication must be enabled before using the admin console.",
    });
    return;
  }
  next();
}

/** Require the checker role (server-side enforcement). */
export function requireChecker(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role.toUpperCase() !== "CHECKER") {
    res.status(403).json({ error: "Checker access required" });
    return;
  }
  // Checkers must prove inbox control before the console unlocks.
  if (!req.user.emailVerified) {
    res.status(403).json({
      error: "EMAIL_NOT_VERIFIED",
      message: "Verify your email before using the checker console.",
    });
    return;
  }
  // Checkers must complete 2FA enrollment before touching checker APIs.
  if (req.user.totpRequired && !req.user.totpEnabled) {
    res.status(403).json({
      error: "TOTP_SETUP_REQUIRED",
      message: "Two-factor authentication must be enabled before using the checker console.",
    });
    return;
  }
  next();
}