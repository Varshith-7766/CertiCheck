import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../index.js";
import { hashPassword, verifyPassword } from "../services/auth.js";
import {
  authenticate,
  authenticateAllowPending2FA,
  AuthRequest,
} from "../middleware/auth.js";
import {
  createSession,
  revokeSession,
  revokeAllSessions,
  validateSession,
  confirmSession2FA,
  sessionCookieName,
  sessionCookieOptions,
} from "../services/session.js";
import {
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
  isPasswordBreached,
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
  encryptTotpSecret,
  decryptTotpSecret,
  isEncryptedTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  generateOpaqueToken,
  hashOpaqueToken,
} from "../services/security.js";
import { sendEmail, isDevMode } from "../services/mailer.js";
import { config } from "../config.js";
import {
  registerLimiter,
  loginLimiter,
  forgotLimiter,
  resetLimiter,
  emailVerifyLimiter,
  totpLimiter,
} from "../middleware/security.js";

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    name: z.string().min(2, "Name must be at least 2 characters"),
    role: z.enum(["ADMIN", "CHECKER"]),
    institution: z.string().optional(),
    inviteCode: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Admins must identify their institution — proves a real organization,
    // not just someone who found the invite code.
    if (data.role === "ADMIN") {
      if (!data.institution || data.institution.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Institution name is required for admin accounts",
          path: ["institution"],
        });
      }
    }
    const strength = validatePasswordStrength(data.password);
    for (const msg of strength.errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["password"] });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(PASSWORD_MIN_LENGTH),
  })
  .superRefine((data, ctx) => {
    const strength = validatePasswordStrength(data.password);
    for (const msg of strength.errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["password"] });
    }
  });

const codeSchema = z.object({
  code: z.string().min(4).max(12),
});

// Password re-auth is required to change 2FA state (F1): a stolen session
// alone must never be enough to enroll/route away the owner's second factor.
const passwordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const enable2faSchema = z.object({
  code: z.string().min(4).max(12),
  password: z.string().min(1, "Password is required"),
});

// Timing equalizer for the login enumeration resistance (F9): when the email
// doesn't exist we run a bcrypt-compare against this fixed hash so the
// response time matches the unknown-password path.
const DUMMY_BCRYPT_HASH = "$2b$12$faeFNUORZryV9M7oytwZBe/xLoPFf9XMMDysgLeP3VY0/NGefQiYC";

/**
 * Reads a user's TOTP secret in plaintext, decrypting the AES-256-GCM
 * envelope stored at rest (F4). Legacy plaintext rows are migrated lazily:
 * encrypted once and persisted so the DB never holds plaintext long-term.
 * Returns null when there is no secret or the envelope can't be opened
 * (wrong key / tampered — treated as "no usable secret").
 */
async function readTotpSecret(user: {
  id: string;
  totpSecret: string | null;
}): Promise<string | null> {
  if (!user.totpSecret) return null;
  let plain: string;
  try {
    plain = decryptTotpSecret(user.totpSecret);
  } catch {
    return null;
  }
  if (!isEncryptedTotpSecret(user.totpSecret)) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: { totpSecret: encryptTotpSecret(plain) },
      })
      .catch(() => {
        /* best-effort migration — never fail auth on a write */
      });
  }
  return plain;
}

/** Notifies the account owner about 2FA state changes (dev: mailer logs). */
async function notify2fa(to: string, subject: string, html: string, text: string) {
  await sendEmail({ to, subject, html, text }).catch((err) =>
    console.error("[2fa] notification email failed:", err)
  );
}

const setCookie = (res: Response, token: string) => {
  res.cookie(sessionCookieName, token, sessionCookieOptions());
};

const clearCookie = (res: Response) => {
  res.clearCookie(sessionCookieName, { path: "/" });
};

const getClientMeta = (req: AuthRequest) => {
  const ua = req.headers["user-agent"];
  return {
    userAgent: typeof ua === "string" ? ua.slice(0, 255) : undefined,
    ip: typeof req.ip === "string" ? req.ip : undefined,
  };
};

const publicUser = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  institution: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
  totpRequired: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  institution: user.institution,
  emailVerified: user.emailVerified,
  totpEnabled: user.totpEnabled,
  totpRequired: user.totpRequired,
  createdAt: user.createdAt,
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
// Checkers register freely. ADMIN registration requires the invite code
// set in ADMIN_INVITE_CODE — only the website creator can mint admins.
router.post(
  "/register",
  registerLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = registerSchema.parse(req.body);

      // Website-creator gate: admins need the invite code.
      if (body.role === "ADMIN") {
        if (!config.adminInviteCode) {
          res.status(403).json({ error: "Admin registration is not configured. Set ADMIN_INVITE_CODE." });
          return;
        }
        if (body.inviteCode !== config.adminInviteCode) {
          res.status(403).json({ error: "Invalid admin invite code" });
          return;
        }
      }

      // Breached-password check (fail-open in dev, enforced in prod).
      // Runs before the account-existence check so probing an existing email
      // pays the same network cost as a fresh registration (F8).
      const breached = await isPasswordBreached(body.password);
      if (breached) {
        res.status(400).json({
          error: "This password has appeared in a known data breach. Please choose a different one.",
        });
        return;
      }

      const existing = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (existing) {
        // Anti-enumeration (F8): identical response shape to a first-time
        // registration request. No session is minted, no ownership implied —
        // the client shows the same "check your inbox" guidance either way.
        res.status(201).json({
          message: "If that email is available, a verification email has been sent.",
          emailVerificationSent: true,
        });
        return;
      }

      const passwordHash = await hashPassword(body.password);
      const verificationToken = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
          role: body.role,
          institution: body.institution ? body.institution.trim() : null,
          // When email verification is disabled, auto-verify so the user
          // goes straight to 2FA setup without hitting the email step.
          emailVerified: !config.requireEmailVerification,
          // Everyone with a console (admin + checker) must prove they're
          // real (and human) with 2FA before anything unlocks.
          totpRequired: true,
          verificationTokenHash: hashOpaqueToken(verificationToken),
          verificationTokenExpires: expiresAt,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          institution: true,
          emailVerified: true,
          totpEnabled: true,
          totpRequired: true,
          createdAt: true,
        },
      });

      // Email verification link (dev mode logs it to the console).
      const verifyUrl = `${config.appUrl}/verify-email?token=${verificationToken}`;
      await sendEmail({
        to: user.email,
        subject: "Verify your CertiCheck email",
        html: `<p>Hi ${user.name},</p><p>Confirm your email to activate your CertiCheck account:</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
        text: `Confirm your email at ${verifyUrl} (expires in 24h).`,
      }).catch((err) => console.error("[register] verification email failed:", err));

      // Auto-login via httpOnly session cookie.
      const token = await createSession(user.id, getClientMeta(req));
      setCookie(res, token);

      res.status(201).json({
        user: publicUser(user),
        emailVerified: user.emailVerified,
        totpSetupRequired: user.totpRequired && !user.totpEnabled,
        message: config.requireEmailVerification
          ? "Registration successful — check your inbox to verify your email."
          : "Registration successful — set up two-factor authentication to continue.",
        // Session token in body for cross-origin deploys where httpOnly
        // cookies may not be sent (separate Render frontend/backend domains).
        sessionToken: token,
        // When SMTP isn't configured, include the link directly so the user
        // can verify without digging through Render logs.
        ...(isDevMode() ? { devVerifyUrl: verifyUrl } : {}),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post(
  "/login",
  loginLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user) {
        // Timing equalization (F9): burn one bcrypt compare so the response
        // time doesn't reveal whether the email exists.
        await verifyPassword(body.password, DUMMY_BCRYPT_HASH);
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (config.requireEmailVerification && !user.emailVerified) {
        res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
        return;
      }

      // 2FA: create a pending session, require an OTP before anything else.
      if (user.totpEnabled && user.totpSecret) {
        const token = await createSession(user.id, {
          ...getClientMeta(req),
          pending2FA: true,
        });
        setCookie(res, token);
        res.json({
          requires2fa: true,
          email: user.email,
          message: "Two-factor authentication required",
          sessionToken: token,
        });
        return;
      }

      const token = await createSession(user.id, getClientMeta(req));
      setCookie(res, token);

      // Load fresh user data to return (role/enrollment flags from DB).
      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          institution: true,
          emailVerified: true,
          totpEnabled: true,
          totpRequired: true,
          createdAt: true,
        },
      });

      // Console users who haven't enrolled 2FA yet must do so before their
      // console unlocks (server also enforces via requireAdmin/requireChecker).
      res.json({
        user: publicUser(fresh!),
        totpSetupRequired: fresh!.totpRequired && !fresh!.totpEnabled,
        sessionToken: token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post("/logout", async (req: AuthRequest, res: Response) => {
  try {
    const token =
      req.cookies?.[sessionCookieName] ??
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);
    if (token) {
      const session = await validateSession(token);
      if (session) await revokeSession(session.sessionId);
    }
    clearCookie(res);
    res.json({ message: "Logged out" });
  } catch (error) {
    clearCookie(res);
    res.json({ message: "Logged out" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        institution: true,
        emailVerified: true,
        totpEnabled: true,
        totpRequired: true,
        createdAt: true,
        _count: {
          select: { certificates: true, verifications: true },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: { ...publicUser(user), counts: user._count },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-email
// ---------------------------------------------------------------------------
router.post(
  "/verify-email",
  emailVerifyLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = verifyEmailSchema.parse(req.body);
      const tokenHash = hashOpaqueToken(body.token);

      const user = await prisma.user.findFirst({
        where: {
          verificationTokenHash: tokenHash,
          verificationTokenExpires: { gt: new Date() },
        },
      });

      if (!user) {
        res.status(400).json({ error: "Invalid or expired verification link" });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationTokenHash: null,
          verificationTokenExpires: null,
        },
      });

      res.json({ message: "Email verified" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      console.error("Verify email error:", error);
      res.status(500).json({ error: "Email verification failed" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/resend-verification
// ---------------------------------------------------------------------------
router.post(
  "/resend-verification",
  authenticate,
  emailVerifyLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user!.emailVerified) {
        res.json({ message: "Email already verified" });
        return;
      }
      const token = generateOpaqueToken();
      await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          verificationTokenHash: hashOpaqueToken(token),
          verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const verifyUrl = `${config.appUrl}/verify-email?token=${token}`;
      await sendEmail({
        to: req.user!.email,
        subject: "Verify your CertiCheck email",
        html: `<p>Hi ${req.user!.name},</p><p>Confirm your email to activate your CertiCheck account:</p><p><a href="${verifyUrl}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
        text: `Confirm your email at ${verifyUrl} (expires in 24h).`,
      });
      res.json({
        message: "Verification email sent",
        ...(isDevMode() ? { devVerifyUrl: verifyUrl } : {}),
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/forgot
// ---------------------------------------------------------------------------
router.post(
  "/forgot",
  forgotLimiter,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = forgotSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: body.email } });
      // Always respond 200 to avoid user enumeration.
      if (!user) {
        res.json({ message: "If that email exists, a reset link was sent" });
        return;
      }

      const token = generateOpaqueToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: hashOpaqueToken(token),
          resetTokenExpires: new Date(Date.now() + 20 * 60 * 1000),
        },
      });

      const resetUrl = `${config.appUrl}/reset?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your CertiCheck password",
        html: `<p>Hi ${user.name},</p><p>Reset your password with this link (expires in 20 minutes):</p><p><a href="${resetUrl}">Reset password</a></p><p>If you didn't request this, ignore this email.</p>`,
        text: `Reset your password at ${resetUrl} (expires in 20 minutes). If you didn't request this, ignore this email.`,
      });

      res.json({ message: "If that email exists, a reset link was sent" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      console.error("Forgot error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/auth/reset
// ---------------------------------------------------------------------------
router.post("/reset", resetLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const body = resetSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(body.token);

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }

    const breached = await isPasswordBreached(body.password);
    if (breached) {
      res.status(400).json({
        error: "This password has appeared in a known data breach. Please choose a different one.",
      });
      return;
    }

    const passwordHash = await hashPassword(body.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpires: null,
        emailVerified: true, // they proved inbox control
      },
    });

    // Revoke all sessions — any stolen session dies with the password change.
    await revokeAllSessions(user.id);

    res.json({ message: "Password reset. You can now sign in." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error("Reset error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
});

// ---------------------------------------------------------------------------
// 2FA — TOTP setup / enable / disable / verify-at-login
// ---------------------------------------------------------------------------

// POST /api/auth/2fa/setup — generate a secret for the authenticator app
// F1: requires the account password (a stolen session alone cannot enroll a
// new factor) and is refused while 2FA is already enabled.
router.post("/2fa/setup", totpLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = passwordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (user.totpEnabled) {
      res.status(400).json({
        error: "Two-factor authentication is already enabled. Disable it first to change your authenticator.",
      });
      return;
    }

    const passwordOk = await verifyPassword(body.password, user.passwordHash);
    if (!passwordOk) {
      res.status(403).json({ error: "Incorrect password" });
      return;
    }

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: encryptTotpSecret(secret) },
    });
    res.json({
      secret,
      otpauthUrl: generateTotpUri(secret, user.email),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error("2FA setup error:", error);
    res.status(500).json({ error: "Failed to start 2FA setup" });
  }
});

// POST /api/auth/2fa/enable — confirm the code, turn 2FA on, mint recovery codes
// F1: password re-auth required. F2: every pre-enrollment session (other than
// this device) is revoked so a bypass window can't outlive the enrollment.
router.post("/2fa/enable", totpLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = enable2faSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.totpSecret) {
      res.status(400).json({ error: "Run 2FA setup first" });
      return;
    }
    if (user.totpEnabled) {
      res.status(400).json({ error: "Two-factor authentication is already enabled" });
      return;
    }

    const passwordOk = await verifyPassword(body.password, user.passwordHash);
    if (!passwordOk) {
      res.status(403).json({ error: "Incorrect password" });
      return;
    }

    const secret = await readTotpSecret(user);
    if (!secret) {
      res.status(400).json({ error: "Unable to read the TOTP secret — run 2FA setup again" });
      return;
    }
    if (!verifyTotp(body.code, secret)) {
      res.status(400).json({ error: "Invalid code" });
      return;
    }

    const recoveryCodes = generateRecoveryCodes(8);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true },
      }),
      prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
      prisma.recoveryCode.createMany({
        data: recoveryCodes.map((rc) => ({
          userId: user.id,
          codeHash: rc.hash,
        })),
      }),
    ]);

    await revokeAllSessions(user.id, req.sessionId);

    await notify2fa(
      user.email,
      "Two-factor authentication enabled",
      `<p>Hi ${user.name},</p><p>Two-factor authentication was just enabled on your CertiCheck account. If this wasn't you, reset your password immediately and contact support.</p>`,
      "Two-factor authentication was enabled on your CertiCheck account. If this wasn't you, reset your password immediately."
    );

    res.json({
      message: "Two-factor authentication enabled",
      recoveryCodes: recoveryCodes.map((rc) => rc.code),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error("2FA enable error:", error);
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
});

// POST /api/auth/2fa/disable — requires a valid TOTP or recovery code
// F1: kept behind the second factor itself (a TOTP/recovery code proof).
router.post("/2fa/disable", totpLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = codeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.totpSecret || !user.totpEnabled) {
      res.status(400).json({ error: "Two-factor authentication is not enabled" });
      return;
    }

    const secret = await readTotpSecret(user);
    const totpOk = secret ? verifyTotp(body.code, secret) : false;
    let recoveryOk = false;
    if (!totpOk) {
      const codeHash = hashRecoveryCode(body.code);
      const used = await prisma.recoveryCode.updateMany({
        where: { userId: user.id, codeHash, usedAt: null },
        data: { usedAt: new Date() },
      });
      recoveryOk = used.count > 0;
    }

    if (!totpOk && !recoveryOk) {
      res.status(400).json({ error: "Invalid code" });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null },
      }),
      prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    ]);

    await notify2fa(
      user.email,
      "Two-factor authentication disabled",
      `<p>Hi ${user.name},</p><p>Two-factor authentication was just disabled on your CertiCheck account. If this wasn't you, reset your password immediately and contact support.</p>`,
      "Two-factor authentication was disabled on your CertiCheck account. If this wasn't you, reset your password immediately."
    );

    res.json({ message: "Two-factor authentication disabled" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error("2FA disable error:", error);
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
});

// POST /api/auth/2fa/verify — login step 2: confirm a pending session
router.post(
  "/2fa/verify",
  totpLimiter,
  authenticateAllowPending2FA,
  async (req: AuthRequest, res: Response) => {
    try {
      const body = codeSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user || !user.totpSecret || !user.totpEnabled) {
        res.status(400).json({ error: "Two-factor authentication is not enabled" });
        return;
      }

      const secret = await readTotpSecret(user);
      const totpOk = secret ? verifyTotp(body.code, secret) : false;
      let recoveryOk = false;
      if (!totpOk) {
        const codeHash = hashRecoveryCode(body.code);
        const used = await prisma.recoveryCode.updateMany({
          where: { userId: user.id, codeHash, usedAt: null },
          data: { usedAt: new Date() },
        });
        recoveryOk = used.count > 0;
      }

      if (!totpOk && !recoveryOk) {
        res.status(401).json({ error: "Invalid authentication code" });
        return;
      }

      await confirmSession2FA(req.sessionId!);

      const fresh = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          institution: true,
          emailVerified: true,
          totpEnabled: true,
          totpRequired: true,
          createdAt: true,
        },
      });

      res.json({ user: publicUser(fresh!) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      console.error("2FA verify error:", error);
      res.status(500).json({ error: "Two-factor verification failed" });
    }
  }
);

// ---------------------------------------------------------------------------
// Session management (revocable sessions)
// ---------------------------------------------------------------------------

// GET /api/auth/sessions — list active sessions for the user
router.get("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastActiveAt: true,
        userAgent: true,
        ip: true,
        pending2FA: true,
      },
      orderBy: { lastActiveAt: "desc" },
    });
    res.json({
      sessions: sessions.map((s) => ({
        ...s,
        current: s.id === req.sessionId,
      })),
    });
  } catch (error) {
    console.error("List sessions error:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// DELETE /api/auth/sessions — log out everywhere (except current device)
router.delete("/sessions", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await revokeAllSessions(req.user!.userId, req.sessionId);
    res.json({ message: "All other sessions revoked" });
  } catch (error) {
    console.error("Revoke all sessions error:", error);
    res.status(500).json({ error: "Failed to revoke sessions" });
  }
});

// DELETE /api/auth/sessions/:id — revoke one session
router.delete("/sessions/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!session || session.userId !== req.user!.userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await revokeSession(session.id);
    res.json({ message: "Session revoked" });
  } catch (error) {
    console.error("Revoke session error:", error);
    res.status(500).json({ error: "Failed to revoke session" });
  }
});

export default router;