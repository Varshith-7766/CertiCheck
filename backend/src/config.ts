import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",

  // HttpOnly session cookie
  sessionTtlDays: parseInt(process.env.SESSION_TTL_DAYS || "7", 10),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  // Split-domain deploys (frontend + API on different hosts) are cross-site:
  // browsers reject SameSite=Lax cookies on the login POST. COOKIE_SAMESITE=none
  // (+ Secure) is required in prod; keep "lax" for local same-site dev.
  cookieSameSite: (process.env.COOKIE_SAMESITE === "none" ? "none" : "lax") as "lax" | "none",

  // 64 hex chars (32 random bytes) — AES-256-GCM key for TOTP secrets at rest.
  // Sessions are opaque DB-backed tokens; no JWT is used anywhere.
  totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY || "",

  // Admin creation gate
  adminInviteCode: process.env.ADMIN_INVITE_CODE || "",

  // Email verification behaviour
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",

  // SMTP (email verification + password reset). When unset, mailer
  // runs in "dev mode" and logs links instead of sending.
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "CertiCheck <no-reply@certicheck.local>",
  },

  // HIBP breached-password check
  hibpEnabled: process.env.HIBP_ENABLED !== "false",
  // When true, HIBP failures fail closed (reject registration).
  // When false (and not production), network errors fail open so dev works offline.
  hibpStrict: process.env.HIBP_STRICT === "true",

  // Rate-limit tuning (secure defaults, overridable for testing)
  rateLimits: {
    login: parseInt(process.env.LOGIN_RATE_LIMIT || "10", 10),
    register: parseInt(process.env.REGISTER_RATE_LIMIT || "20", 10),
    totp: parseInt(process.env.TOTP_RATE_LIMIT || "5", 10),
  },

  // Blockchain anchoring (Sepolia testnet — see services/blockchain.ts).
  // Leave CHAIN_* empty to run the app without chain features (graceful
  // degraded mode: every endpoint still works, chain fields report disabled).
  chain: {
    rpcUrl: process.env.CHAIN_RPC_URL || "",
    signerKey: process.env.CHAIN_SIGNER_KEY || "",
    contractAddress: process.env.CONTRACT_ADDRESS || "",
    // Max time a chain view call may take before we treat the RPC as
    // unreachable (affects verification cross-checks).
    rpcTimeoutMs: parseInt(process.env.CHAIN_RPC_TIMEOUT_MS || "8000", 10),
    // Max time an anchor submit may take before the upload is failed + rolled back.
    submitTimeoutMs: parseInt(process.env.CHAIN_SUBMIT_TIMEOUT_MS || "45000", 10),
    // Confirmations waited before an anchor is considered durable.
    confirmations: parseInt(process.env.CHAIN_CONFIRMATIONS || "1", 10),
  },
};

/**
 * True when the chain layer is fully configured. When false, every chain
 * service function degrades gracefully (returns disabled/available:false)
 * instead of throwing — the app keeps working without the chain.
 */
export const chainEnabled =
  Boolean(config.chain.rpcUrl) &&
  Boolean(config.chain.signerKey) &&
  Boolean(config.chain.contractAddress);