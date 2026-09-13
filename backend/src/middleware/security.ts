import { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Rate limiting (in-memory store — suitable for single-instance deployments)
// ---------------------------------------------------------------------------

const standardHeaders = true;
const legacyHeaders = false;
const message = { error: "Too many attempts. Please try again later." };

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimits.login,
  standardHeaders,
  legacyHeaders,
  message,
  skipSuccessfulRequests: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.rateLimits.register,
  standardHeaders,
  legacyHeaders,
  message,
});

export const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders,
  legacyHeaders,
  message,
});

// Password-reset endpoint is the account-takeover choke point: slow it
// harder than login so stolen reset links / brute forcing reset tokens
// against the same IP becomes impractical (F10).
export const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders,
  legacyHeaders,
  message,
});

export const emailVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders,
  legacyHeaders,
  message,
});

export const totpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimits.totp,
  standardHeaders,
  legacyHeaders,
  message,
});

// Protect the expensive OCR verify endpoint from being hammered.
export const verifyUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders,
  legacyHeaders,
  message: { error: "Too many verification requests. Please slow down." },
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // CSP is only safe in production — the dev server needs inline scripts/HMR.
  if (config.nodeEnv === "production") {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }

  next();
}

// ---------------------------------------------------------------------------
// CSRF defense-in-depth for cookie auth
// Only meaningful for state-changing requests (cross-site forms/fetch).
// SameSite=Lax already blocks cookie attachment on cross-site POSTs, this
// rejects requests that carry a mismatched Origin header before they run.
// ---------------------------------------------------------------------------

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originCheck(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  if (!origin) {
    // Same-origin requests (curl, same-host SPA fetch) may omit Origin.
    next();
    return;
  }

  const allowed =
    origin === config.corsOrigin ||
    (config.corsOrigin.split(",").map((s) => s.trim()).includes(origin));

  if (!allowed) {
    res.status(403).json({ error: "Cross-origin request blocked" });
    return;
  }
  next();
}