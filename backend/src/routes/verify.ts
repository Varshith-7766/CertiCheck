import { Router, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../index.js";
import { authenticate, requireChecker, AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { processFile } from "../services/ocr.js";
import { generateHash } from "../services/hash.js";
import { extractMetadata } from "../services/metadata.js";
import {
  anchorVerification,
  getChainStatus,
  isChainEnabled,
} from "../services/blockchain.js";
import { config } from "../config.js";

const router = Router();

/**
 * Anchor a verification outcome as a chain event (best-effort, never blocks
 * the verdict). Updates the log row with the result.
 */
async function anchorLog(
  logId: string,
  submittedHash: string,
  certificateHash: string | null,
  result: 0 | 1 | 2
): Promise<{ txHash: string | null; status: "ANCHORED" | "PENDING" }> {
  const anchor = await anchorVerification(submittedHash, certificateHash, result);
  const status = anchor ? "ANCHORED" : "PENDING";
  await prisma.verificationLog
    .update({
      where: { id: logId },
      data: { chainTxHash: anchor?.txHash ?? null, chainStatus: status },
    })
    .catch(() => {});
  return { txHash: anchor?.txHash ?? null, status };
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(
          dp[i - 1]![j - 1]!,
          dp[i]![j - 1]!,
          dp[i - 1]![j]!
        );
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Calculate text similarity (0-100%) between two strings.
 */
function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(a, b);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

// POST /api/verify - Checker uploads a document to verify
router.post(
  "/",
  authenticate,
  requireChecker,
  upload.single("certificate"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();

    try {
      // Step 1: OCR the submitted document
      const ocrResult = await processFile(filePath, fileType);

      if (!ocrResult.text || ocrResult.text.length < 10) {
        res.status(422).json({
          error: "Could not extract enough text from the document. Please ensure the image is clear.",
        });
        return;
      }

      // Step 2: Generate SHA-256 hash of the submitted document
      const submittedHash = generateHash(ocrResult.text);

      // Always extract a name/institution guess from the uploaded file
      // itself, so the checker sees details even for non-matching docs.
      const submittedDetails = extractMetadata(ocrResult.text);

      // Step 3: Check for exact hash match in the ledger
      const exactMatch = await prisma.certificate.findUnique({
        where: { sha256Hash: submittedHash },
        select: {
          id: true,
          sha256Hash: true,
          fileName: true,
          studentName: true,
          rollNumber: true,
          institution: true,
          createdAt: true,
          uploadedBy: {
            select: { institution: true },
          },
        },
      });

      if (exactMatch) {
        // EXACT MATCH — certificate found in the server ledger. Now the
        // tamper-evident check: is the hash actually anchored on-chain?
        // The chain is the source of truth; the DB is just an index.
        const chain = await getChainStatus(submittedHash);

        if (chain.available && !chain.registered) {
          // DB row exists but the chain has never seen this hash. A legitimate
          // cert is always anchored at upload (with rollback if the anchor
          // fails), so this is at best a broken/legacy record and at worst a
          // DB-injected fake. NEVER return VERIFIED here.
          let verificationId: string | null = null;
          try {
            const log = await prisma.verificationLog.create({
              data: {
                certificateHash: submittedHash,
                result: "UNVERIFIED",
                similarityScore: 100,
                submittedHash,
                ocrText: ocrResult.text,
                fileName: req.file.originalname,
                verifiedById: req.user!.userId,
              },
            });
            verificationId = log.id;
          } catch (logErr) {
            console.error("Failed to log UNVERIFIED verification (non-fatal):", logErr);
          }

          await fs.unlink(filePath).catch(() => {});

          res.json({
            verdict: "UNVERIFIED",
            message:
              "DATABASE COPY NOT ON CHAIN — this hash exists in the server database but is NOT anchored on the blockchain. A legitimate certificate is anchored at upload time. Treat this document as unverified.",
            similarity: 100,
            certificate: {
              id: exactMatch.id,
              sha256Hash: exactMatch.sha256Hash,
              fileName: exactMatch.fileName,
              studentName: exactMatch.studentName,
              rollNumber: exactMatch.rollNumber,
              institution:
                exactMatch.institution ??
                exactMatch.uploadedBy?.institution ??
                submittedDetails.institution,
              createdAt: exactMatch.createdAt,
            },
            chain: {
              enabled: isChainEnabled(),
              registered: false,
              available: true,
              contractAddress: isChainEnabled() ? config.chain.contractAddress : null,
            },
            submittedDetails,
            verificationId,
            ocrProcessingTimeMs: ocrResult.processingTimeMs,
          });
          return;
        }

        // VERIFIED (chain confirms the registration, or chain is disabled /
        // unreachable in which case the warning is surfaced, never hidden).
        let verificationId: string | null = null;
        try {
          const log = await prisma.verificationLog.create({
            data: {
              certificateHash: submittedHash,
              result: "VERIFIED",
              similarityScore: 100,
              submittedHash,
              ocrText: ocrResult.text,
              fileName: req.file.originalname,
              verifiedById: req.user!.userId,
            },
          });
          verificationId = log.id;

          // Anchor the verification outcome on-chain (best-effort audit event).
          const anchor = await anchorLog(log.id, submittedHash, submittedHash, 0);
          if (anchor.txHash) {
            // nothing else needed — chain fields are on the log row
            void anchor;
          }
        } catch (logErr) {
          // Audit logging must never block the verdict
          console.error("Failed to log VERIFIED verification (non-fatal):", logErr);
        }

        await fs.unlink(filePath).catch(() => {});

        res.json({
          verdict: "VERIFIED",
          message:
            chain.available && chain.registered
              ? `REAL CERTIFICATE — genuine, verified against the ledger, and anchored on-chain at block #${chain.blockNumber}`
              : "REAL CERTIFICATE — genuine and verified against the ledger (chain cross-check unavailable)",
          similarity: 100,
          certificate: {
            id: exactMatch.id,
            sha256Hash: exactMatch.sha256Hash,
            fileName: exactMatch.fileName,
            studentName: exactMatch.studentName,
            rollNumber: exactMatch.rollNumber,
            // Fall back to the issuing admin's institution, then to the
            // name guess from the uploaded file itself.
            institution:
              exactMatch.institution ??
              exactMatch.uploadedBy?.institution ??
              submittedDetails.institution,
            createdAt: exactMatch.createdAt,
          },
          chain: {
            enabled: isChainEnabled(),
            registered: chain.registered,
            available: chain.available,
            blockNumber: chain.blockNumber,
            registeredAt: chain.registeredAt,
            contractAddress: isChainEnabled() ? config.chain.contractAddress : null,
          },
          submittedDetails,
          verificationId,
          ocrProcessingTimeMs: ocrResult.processingTimeMs,
        });
        return;
      }

      // Step 4: No exact match — compare OCR text with stored certificates
      // to distinguish TAMPERED from UNREGISTERED
      const storedCerts = await prisma.certificate.findMany({
        select: {
          id: true,
          sha256Hash: true,
          ocrText: true,
          fileName: true,
          studentName: true,
          rollNumber: true,
          institution: true,
          uploadedBy: {
            select: { institution: true },
          },
        },
        take: 1000, // Limit for performance
      });

      let bestSimilarity = 0;
      let bestMatch = null;

      const normalizedSubmitted = ocrResult.text.toLowerCase().trim();

      for (const cert of storedCerts) {
        const normalizedStored = cert.ocrText.toLowerCase().trim();
        const similarity = textSimilarity(normalizedSubmitted, normalizedStored);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = cert;
        }
      }

      let result: "TAMPERED" | "UNREGISTERED";
      let message: string;

      if (bestSimilarity > 80) {
        // High text similarity but different hash = TAMPERED (FAKE)
        result = "TAMPERED";
        message = `FAKE CERTIFICATE — this document has been altered or tampered with (${bestSimilarity}% text similarity to a registered certificate, but the security hash does not match)`;
      } else {
        // Low similarity = UNREGISTERED (never uploaded)
        result = "UNREGISTERED";
        message = "NOT IN SERVER — no admin has ever uploaded this certificate to the ledger";
      }

      // Log the verification (non-fatal: logging must never block the verdict)
      let verificationId: string | null = null;
      try {
        const log = await prisma.verificationLog.create({
          data: {
            certificateHash: submittedHash,
            result,
            similarityScore: bestSimilarity,
            submittedHash,
            ocrText: ocrResult.text,
            fileName: req.file.originalname,
            verifiedById: req.user!.userId,
          },
        });
        verificationId = log.id;

        // Anchor the verification outcome on-chain (best-effort audit event).
        await anchorLog(
          log.id,
          submittedHash,
          (bestMatch?.sha256Hash as string | undefined) ?? null,
          result === "TAMPERED" ? 1 : 2
        );
      } catch (logErr) {
        console.error(`Failed to log ${result} verification (non-fatal):`, logErr);
      }

      await fs.unlink(filePath).catch(() => {});

      res.json({
        verdict: result,
        message,
        similarity: bestSimilarity,
        // For TAMPERED, include the registered certificate it resembles
        // (slim object — full OCR text stays server-side).
        certificate: bestMatch
          ? {
              id: bestMatch.id,
              fileName: bestMatch.fileName,
              studentName: bestMatch.studentName,
              rollNumber: bestMatch.rollNumber,
              institution:
                bestMatch.institution ??
                bestMatch.uploadedBy?.institution ??
                submittedDetails.institution,
            }
          : undefined,
        submittedDetails,
        verificationId,
        ocrProcessingTimeMs: ocrResult.processingTimeMs,
      });
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});
      console.error("Verification error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  }
);

// GET /api/verify/history - Checker's verification history
router.get(
  "/history",
  authenticate,
  requireChecker,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.verificationLog.findMany({
          where: { verifiedById: req.user!.userId },
          select: {
            id: true,
            certificateHash: true,
            result: true,
            similarityScore: true,
            submittedHash: true,
            fileName: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.verificationLog.count({
          where: { verifiedById: req.user!.userId },
        }),
      ]);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Verification history error:", error);
      res.status(500).json({ error: "Failed to fetch verification history" });
    }
  }
);

export default router;
