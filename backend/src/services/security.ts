import crypto from "crypto";
import fetch from "node-fetch";
import { generateSecret, generateURI, verifySync } from "otplib";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Password policy
// ---------------------------------------------------------------------------

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

export const PASSWORD_MIN_LENGTH = 10;

export function validatePasswordStrength(password: string): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain a symbol (!@#$% etc.)");
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Have I Been Pwned — breached password check (k-anonymity, privacy-safe)
// Only the first 5 hex chars of the SHA-1 hash ever leave this server.
// ---------------------------------------------------------------------------

const HIBP_API = "https://api.pwnedpasswords.com/range/";

export class HibpUnavailableError extends Error {
  constructor() {
    super("Breached-password service unavailable");
    this.name = "HibpUnavailableError";
  }
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  if (!config.hibpEnabled) return false;

  const sha1 = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`${HIBP_API}${prefix}`, {
      headers: {
        "User-Agent": "CertiCheck", // HIBP requires a UA identifying the service
        "api-version": "2",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new HibpUnavailableError();
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.split(":")[0].toUpperCase() === suffix);
  } catch (err) {
    // Fail-open: HIBP being down should never block registration.
    // Log the failure so ops can see it, but let the user through.
    console.warn("[hibp] lookup failed, failing open:", (err as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// TOTP 2FA (otplib v13 functional API — Google Authenticator compatible)
// ---------------------------------------------------------------------------

export function generateTotpSecret(): string {
  return generateSecret();
}

export function generateTotpUri(secret: string, email: string): string {
  return generateURI({ issuer: "CertiCheck", label: email, secret });
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return verifySync({ secret, token }).valid;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// TOTP secret encryption at rest (AES-256-GCM)
// The TOTP secret is the second factor's root key — it must never sit in the
// database as plaintext while every other credential (password, recovery
// codes, session tokens) is stored hashed/derived.
//
// Format:  v1:<b64 iv>:<b64 authTag>:<b64 ciphertext>
//   - iv/authTag are random per secret, so identical secrets never collide.
//   - TOTP_ENCRYPTION_KEY (32 random bytes, hex) must be set — the server
//     fails closed rather than silently degrade to plaintext.
//   - Legacy plaintext rows are migrated lazily: on read, a value without
//     the v1: prefix is decrypted as-is (identity) and immediately
//     re-encrypted + persisted by the caller.
// ---------------------------------------------------------------------------

export const TOTP_SECRET_ENCRYPTED_PREFIX = "v1:";

export function isEncryptedTotpSecret(stored: string): boolean {
  return stored.startsWith(TOTP_SECRET_ENCRYPTED_PREFIX);
}

function getTotpEncryptionKey(): Buffer {
  const hex = config.totpEncryptionKey;
  if (!hex) {
    throw new Error("TOTP_ENCRYPTION_KEY is not set — refusing to start 2FA.");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be 64 hex characters (32 random bytes).");
  }
  return key;
}

export function encryptTotpSecret(secret: string): string {
  const key = getTotpEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOTP_SECRET_ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/**
 * Decrypts a stored TOTP secret. Legacy plaintext is returned unchanged
 * (the caller migrates it). Throws on tamper/wrong-key so verification
 * can fail safe instead of trusting bad ciphertext.
 */
export function decryptTotpSecret(stored: string): string {
  if (!isEncryptedTotpSecret(stored)) return stored;
  const rest = stored.slice(TOTP_SECRET_ENCRYPTED_PREFIX.length);
  const [ivB64, tagB64, dataB64] = rest.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted TOTP secret");
  const key = getTotpEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Recovery codes (single-use, stored hashed)
// ---------------------------------------------------------------------------

export interface RecoveryCodePair {
  code: string; // shown once to the user
  hash: string; // sha256 stored in DB
}

export function generateRecoveryCodes(count = 8): RecoveryCodePair[] {
  const pairs: RecoveryCodePair[] = [];
  for (let i = 0; i < count; i++) {
    // 8 chars from a readable alphabet (no 0/O/1/I to avoid confusion)
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    const bytes = crypto.randomBytes(8);
    for (let j = 0; j < 8; j++) {
      code += alphabet[bytes[j] % alphabet.length];
    }
    pairs.push({
      code,
      hash: crypto.createHash("sha256").update(code).digest("hex"),
    });
  }
  return pairs;
}

export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// ---------------------------------------------------------------------------
// Generic one-time tokens (email verification / password reset)
// ---------------------------------------------------------------------------

export function generateOpaqueToken(length = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}