import { Router, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../index.js";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { processFile } from "../services/ocr.js";
import { generateHash } from "../services/hash.js";
import { extractMetadata } from "../services/metadata.js";
import {
  getChainStatus,
  isChainEnabled,
  CERTIFICATE_CHAIN_ID,
} from "../services/blockchain.js";
import { enqueueAnchor } from "../services/anchorQueue.js";
import { config } from "../config.js";

const router = Router();

// POST /api/certificates/upload - Admin uploads a certificate
router.post(
  "/upload",
  authenticate,
  requireAdmin,
  upload.single("certificate"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();

    try {
      // Step 1: OCR the file
      const ocrResult = await processFile(filePath, fileType);

      if (!ocrResult.text || ocrResult.text.length < 10) {
        res.status(422).json({
          error: "Could not extract enough text from the document. Please ensure the image is clear and contains readable text.",
        });
        return;
      }

      // Step 2: Generate SHA-256 hash
      const sha256Hash = generateHash(ocrResult.text);

      // Step 3: Check if this hash already exists
      const existing = await prisma.certificate.findUnique({
        where: { sha256Hash },
      });

      if (existing) {
        res.status(409).json({
          error: "This certificate is already registered in the ledger",
          certificate: {
            id: existing.id,
            sha256Hash: existing.sha256Hash,
            createdAt: existing.createdAt,
          },
        });
        return;
      }

      // Step 4: Extract metadata from OCR text
      const metadata = extractMetadata(ocrResult.text);

      // Step 5: Store in database
      const certificate = await prisma.certificate.create({
        data: {
          sha256Hash,
          ocrText: ocrResult.text,
          fileName: req.file.originalname,
          fileType,
          fileSize: req.file.size,
          studentName: metadata.studentName,
          rollNumber: metadata.rollNumber,
          institution: metadata.institution,
          uploadedById: req.user!.userId,
        },
        select: {
          id: true,
          sha256Hash: true,
          fileName: true,
          fileType: true,
          studentName: true,
          rollNumber: true,
          institution: true,
          createdAt: true,
        },
      });

      // Step 5b: Anchor the hash on-chain ASYNCHRONOUSLY. The request returns
      // 201 as soon as the DB row is durable; a background worker
      // (services/anchorQueue.ts) submits the anchor tx with retry, so
      // uploads never wait on Sepolia block times or on each other.
      // Rows flip chainPending -> false once anchored; a crash between the
      // DB write and the anchor is recovered by scripts/backfill-chain.ts.
      const chainAnchor: {
        txHash: string | null;
        blockNumber: number | null;
        chainId: number | null;
        anchoredAt: Date | null;
        chainPending: boolean;
      } = {
        txHash: null,
        blockNumber: null,
        chainId: null,
        anchoredAt: null,
        chainPending: false,
      };

      if (isChainEnabled()) {
        chainAnchor.chainId = CERTIFICATE_CHAIN_ID;
        chainAnchor.chainPending = true;
        enqueueAnchor(certificate.id, sha256Hash);
      }

      // Step 6: Clean up uploaded file
      await fs.unlink(filePath).catch(() => {});

      res.status(201).json({
        message: "Certificate registered successfully",
        certificate: {
          ...certificate,
          chain: chainAnchor,
        },
        chain: {
          enabled: isChainEnabled(),
          contractAddress: isChainEnabled() ? config.chain.contractAddress : null,
          ...chainAnchor,
        },
        ocrProcessingTimeMs: ocrResult.processingTimeMs,
      });
    } catch (error) {
      // Clean up file on error
      await fs.unlink(filePath).catch(() => {});
      console.error("Certificate upload error:", error);
      res.status(500).json({ error: "Failed to process certificate" });
    }
  }
);

// GET /api/certificates - List admin's certificates
router.get(
  "/",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [certificates, total] = await Promise.all([
        prisma.certificate.findMany({
          where: { uploadedById: req.user!.userId },
          select: {
            id: true,
            sha256Hash: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            studentName: true,
            rollNumber: true,
            institution: true,
            createdAt: true,
            txHash: true,
            blockNumber: true,
            chainId: true,
            anchoredAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.certificate.count({
          where: { uploadedById: req.user!.userId },
        }),
      ]);

      res.json({
        certificates,
        chain: {
          enabled: isChainEnabled(),
          contractAddress: isChainEnabled() ? config.chain.contractAddress : null,
        },
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("List certificates error:", error);
      res.status(500).json({ error: "Failed to list certificates" });
    }
  }
);

// DELETE /api/certificates/:id - Remove a certificate
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const certificate = await prisma.certificate.findFirst({
        where: {
          id: String(req.params.id),
          uploadedById: req.user!.userId,
        },
      });

      if (!certificate) {
        res.status(404).json({ error: "Certificate not found" });
        return;
      }

      // Blockchain immutability: once a hash is anchored on-chain it can
      // never be removed — deleting the DB row would just create a
      // detectable divergence, so we refuse (409).
      if (certificate.txHash || certificate.blockNumber) {
        res.status(409).json({
          error:
            "This certificate is anchored on the blockchain and cannot be deleted. The chain is the tamper-evident source of truth.",
          certificate: {
            id: certificate.id,
            txHash: certificate.txHash,
            blockNumber: certificate.blockNumber,
          },
        });
        return;
      }

      // Belt-and-braces: also block when the chain knows the hash but the
      // row lost its anchor fields for some reason (never delete an
      // immutable hash — it would silently break verification).
      if (isChainEnabled()) {
        const chain = await getChainStatus(certificate.sha256Hash).catch(() => null);
        if (chain?.registered && chain.available) {
          res.status(409).json({
            error:
              "This certificate is anchored on the blockchain and cannot be deleted. The chain is the tamper-evident source of truth.",
            certificate: {
              id: certificate.id,
              blockNumber: chain.blockNumber,
            },
          });
          return;
        }
      }

      await prisma.certificate.delete({
        where: { id: String(req.params.id) },
      });

      res.json({ message: "Certificate removed from ledger" });
    } catch (error) {
      console.error("Delete certificate error:", error);
      res.status(500).json({ error: "Failed to delete certificate" });
    }
  }
);

export default router;
