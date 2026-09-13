import crypto from "crypto";
import { prisma } from "../index.js";
import { config } from "../config.js";

const SESSION_COOKIE = "cc_session";

/** Generate an opaque, unguessable session token. */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Hash a token for storage — the raw token is never persisted. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
  pending2FA?: boolean;
}

/**
 * Create a session row and return the raw token to set as an httpOnly cookie.
 * The DB only ever holds the sha256 hash of the token.
 */
export async function createSession(
  userId: string,
  meta: SessionMeta = {}
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      pending2FA: meta.pending2FA ?? false,
    },
  });

  return token;
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  institution: string | null;
  totpEnabled: boolean;
  totpRequired: boolean;
}

export interface SessionInfo {
  sessionId: string;
  pending2FA: boolean;
  user: SessionUser;
}

/**
 * Validate a raw token against the sessions table.
 * Returns the session + freshly-loaded user (role always from the DB),
 * or null if the token is invalid, expired, revoked, or the user is gone.
 */
export async function validateSession(
  token: string
): Promise<SessionInfo | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revoked) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (!session.user) return null;

  // Refresh last-active timestamp (throttled to every 10 min to limit writes)
  if (Date.now() - session.lastActiveAt.getTime() > 10 * 60 * 1000) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() },
      })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    pending2FA: session.pending2FA,
    user: {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      emailVerified: session.user.emailVerified,
      institution: session.user.institution,
      totpEnabled: session.user.totpEnabled,
      totpRequired: session.user.totpRequired,
    },
  };
}

/** Delete a single session (logout of one device). */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Delete all sessions for a user (log out everywhere). */
export async function revokeAllSessions(userId: string, exceptId?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
}

/** Confirm a 2FA-pending session once the OTP/recovery code validates. */
export async function confirmSession2FA(sessionId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { pending2FA: false },
  });
}

export const sessionCookieName = SESSION_COOKIE;

export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000,
    path: "/",
  };
}