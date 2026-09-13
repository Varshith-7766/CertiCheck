import { createHash, createHmac } from "crypto";

/**
 * Normalize OCR text for consistent hashing.
 * - Lowercase
 * - Collapse whitespace
 * - Remove non-printable characters
 * - Trim
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\S\n]+/g, " ") // collapse whitespace but keep newlines
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
    .replace(/[^\x20-\x7E\n]/g, "") // remove non-printable chars
    .trim();
}

/**
 * Generate SHA-256 hash of normalized text.
 * Returns a 64-character hex string.
 */
export function generateHash(text: string): string {
  const normalized = normalizeText(text);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Compare two SHA-256 hashes for exact match.
 */
export function hashesMatch(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}
