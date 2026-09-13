import { Router, Response } from "express";
import { prisma } from "../index.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/stats - Dashboard statistics
router.get(
  "/",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === "ADMIN";

      const [
        totalCertificates,
        totalVerifications,
        verifiedCount,
        tamperedCount,
        unregisteredCount,
      ] = await Promise.all([
        isAdmin
          ? prisma.certificate.count({
              where: { uploadedById: userId },
            })
          : prisma.certificate.count(),
        prisma.verificationLog.count({
          where: { verifiedById: userId },
        }),
        prisma.verificationLog.count({
          where: { verifiedById: userId, result: "VERIFIED" },
        }),
        prisma.verificationLog.count({
          where: { verifiedById: userId, result: "TAMPERED" },
        }),
        prisma.verificationLog.count({
          where: { verifiedById: userId, result: "UNREGISTERED" },
        }),
      ]);

      res.json({
        stats: {
          totalCertificates,
          totalVerifications,
          verifiedCount,
          tamperedCount,
          unregisteredCount,
          verificationRate:
            totalVerifications > 0
              ? Math.round((verifiedCount / totalVerifications) * 100)
              : 0,
        },
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  }
);

export default router;
