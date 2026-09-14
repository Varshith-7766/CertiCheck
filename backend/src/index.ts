import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config, chainEnabled } from "./config.js";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth.js";
import certificateRoutes from "./routes/certificates.js";
import verifyRoutes from "./routes/verify.js";
import statsRoutes from "./routes/stats.js";
import { securityHeaders, originCheck, verifyUploadLimiter } from "./middleware/security.js";
import { generateHash } from "./services/hash.js";
import { isDevMode, verifySmtp } from "./services/mailer.js";
import { prewarmOcr } from "./services/ocr.js";
import { getNetworkInfo, getChainStatus, isChainEnabled } from "./services/blockchain.js";

// Global crash guards — log worker/thread errors instead of dying.
// Individual requests may fail, but the server stays alive.
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception (server kept alive):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection (server kept alive):", reason);
});

// Initialize Prisma client
export const prisma = new PrismaClient();

const app = express();

// Behind a proxy (Render/Railway) Express sees internal http — without this,
// Secure cross-site session cookies are never set and login breaks in prod.
app.set("trust proxy", 1);

// Middleware
app.use(
  cors({
    // Comma-separated allow-list (see CORS_ORIGIN): the cors package only
    // matches arrays/RegExp per-origin — a raw comma string would never match.
    origin: config.corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(securityHeaders);
app.use(originCheck);

// Boot integrity job — re-hash every stored certificate and cross-check the
// chain, so silent DB tampering is detected at startup, not after the fact.
// Log-only by design: fixing drift (re-anchor, re-register) is the
// backfill script's job (scripts/backfill-chain.ts).
async function runBootIntegrityCheck() {
  try {
    const rows = await prisma.certificate.findMany({
      select: {
        id: true,
        sha256Hash: true,
        ocrText: true,
        txHash: true,
        blockNumber: true,
      },
    });

    let hashMismatches = 0;
    let notAnchored = 0;
    let chainMismatches = 0;
    const chainChecks = [];

    for (const row of rows) {
      // 1) Local integrity: does the stored hash still match the stored text?
      const reHash = generateHash(row.ocrText);
      if (reHash !== row.sha256Hash) {
        hashMismatches++;
        console.error(
          `[integrity] HASH MISMATCH certificate ${row.id}: stored=${row.sha256Hash} recomputed=${reHash}`
        );
      }

      // 2) Chain coverage: every cert should be anchored (txHash set).
      if (chainEnabled && !row.txHash) {
        notAnchored++;
      }

      // 3) Sample chain cross-check (rare — statuses are cached afterwards).
      if (chainEnabled && row.txHash && chainChecks.length < 10) {
        const status = await getChainStatus(row.sha256Hash).catch(() => null);
        if (status && status.available && !status.registered) {
          chainMismatches++;
          console.error(
            `[integrity] CHAIN MISMATCH certificate ${row.id} (${row.sha256Hash.slice(0, 12)}…): DB says anchored but chain says not registered`
          );
        } else if (status && status.available && status.registered) {
          chainChecks.push({ id: row.id, blockNumber: status.blockNumber });
        }
      }
    }

    console.log(
      `[integrity] Checked ${rows.length} certificate(s): ${hashMismatches} hash mismatch(es), ` +
        `${notAnchored} un-anchored (chain enabled — run backfill), ${chainMismatches} chain mismatch(es).`
    );
  } catch (err) {
    console.error("[integrity] Boot integrity check failed (non-fatal):", err);
  }
}

// Health check
app.get("/api/health", async (_req, res) => {
  const chain = await getNetworkInfo();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    chain: {
      enabled: isChainEnabled(),
      available: chain.available,
      chainId: chain.chainId,
      blockNumber: chain.blockNumber,
      contractAddress: config.chain.contractAddress || null,
    },
    smtp: {
      configured: !isDevMode(),
      host: config.smtp.host || null,
      user: config.smtp.user ? `${config.smtp.user.slice(0, 3)}***` : null,
    },
  });
});

// SMTP connectivity test — POST /api/test-smtp
app.post("/api/test-smtp", async (_req, res) => {
  if (isDevMode()) {
    res.json({ ok: false, error: "SMTP not configured — DEV MODE (no SMTP_HOST/SMTP_USER)" });
    return;
  }
  const result = await verifySmtp();
  if (result.ok) {
    res.json({ ok: true, message: "SMTP connection verified — Gmail accepted credentials" });
  } else {
    res.json({ ok: false, error: result.error });
  }
});

// SMTP send test — POST /api/test-smtp-send  { "to": "you@gmail.com" }
app.post("/api/test-smtp-send", async (req, res) => {
  if (isDevMode()) {
    res.json({ ok: false, error: "SMTP not configured — DEV MODE" });
    return;
  }
  const to = req.body?.to || config.smtp.user;
  try {
    const { sendEmail } = await import("./services/mailer.js");
    await sendEmail({
      to,
      subject: "CertiCheck SMTP Test",
      html: "<p>This is a test email from CertiCheck. If you see this, SMTP is working!</p>",
      text: "This is a test email from CertiCheck. If you see this, SMTP is working!",
    });
    res.json({ ok: true, message: `Test email sent to ${to}` });
  } catch (err: any) {
    console.error(`[test-smtp-send] FAILED: ${err.message}`);
    res.json({ ok: false, error: err.message, code: err.code, response: err.response });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyUploadLimiter, verifyRoutes);
app.use("/api/stats", statsRoutes);

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // Safe logging (F11): log the error type + message only — never the raw
    // request body (was up to 10MB of attacker-controlled data).
    const errLine = [
      err?.type ? `type=${err.type}` : null,
      err?.code ? `code=${err.code}` : null,
      err?.message ? `message=${String(err.message).slice(0, 300)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.error(`[error] ${errLine || "unknown error"}`);

    // body-parser / multer failures → client's fault, not a 500.
    if (err.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON in request body" });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large. Maximum size is 10MB." });
      return;
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large. Maximum size is 10MB." });
      return;
    }

    if (err.message?.includes("Unsupported file type")) {
      res.status(415).json({ error: err.message });
      return;
    }

    // Routes that attach their own status (validation, auth, etc.) should be
    // honored instead of being flattened into a 500.
    if (typeof err.status === "number" && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({
        error: typeof err.message === "string" ? err.message : "Request failed",
      });
      return;
    }
    if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
      res.status(err.statusCode).json({
        error: typeof err.message === "string" ? err.message : "Request failed",
      });
      return;
    }

    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
);

// Start server
async function start() {
  try {
    await prisma.$connect();
    console.log("Database connected");

    // Warm up the Tesseract worker pool now (non-blocking) so the first
    // upload skips engine spin-up.
    prewarmOcr();

    if (isChainEnabled()) {
      console.log(
        `Chain layer enabled — contract ${config.chain.contractAddress} on Sepolia`
      );
    } else {
      console.warn(
        "Chain layer DISABLED (CHAIN_* env missing) — certs will not be anchored."
      );
    }

    // Bind all interfaces: the host's routing mesh cannot reach a
    // localhost-only listener (deploys show Live yet serve nothing).
    app.listen(config.port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${config.port}`);
      console.log(`CORS origin: ${config.corsOrigin}`);
      console.log(`Node env: ${config.nodeEnv}`);
      console.log(`Auth: httpOnly cookie sessions, DB-backed revocation`);
      console.log(
        `Session cookie: Secure=${config.cookieSecure}; SameSite=${config.cookieSameSite === "none" ? "None" : "Lax"}`
      );
      console.log(
        `SMTP: ${isDevMode() ? "DEV MODE (no email sending)" : `configured — ${config.smtp.host}:${config.smtp.port} as ${config.smtp.user}`}`
      );
      if (config.cookieSameSite === "none" && !config.cookieSecure) {
        console.error(
          "[config] INVALID COOKIE COMBO: SameSite=None requires Secure — browsers will reject the session cookie and every login will 401. Set COOKIE_SECURE=true."
        );
      }
      if (config.nodeEnv === "production" && config.cookieSameSite !== "none") {
        console.error(
          "[config] PROD WARNING: split-domain deploy needs COOKIE_SAMESITE=none, otherwise cross-site logins will 401."
        );
      }
    });

    // Integrity scan runs after startup so it never delays first response.
    setTimeout(runBootIntegrityCheck, 1000);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();