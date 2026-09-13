#!/usr/bin/env npx tsx
/**
 * Historical backfill — anchor every existing Certificate on-chain.
 * Safe to re-run: registerBatch is idempotent per hash, and rows that
 * already have txHash are skipped. Run once after the chain layer ships,
 * then again only if rows were added while the chain layer was off.
 *
 * Usage:
 *   npx tsx scripts/backfill-chain.ts           # live backfill
 *   npx tsx scripts/backfill-chain.ts --dry-run  # print counts only
 */
import { PrismaClient } from "@prisma/client";
import { anchorBatch, isChainEnabled, getChainStatus } from "../src/services/blockchain.js";

const BATCH_SIZE = 50; // hashes per chain tx (registerBatch)

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!isChainEnabled()) {
    console.error("✖ Chain layer is not configured (CHAIN_* env missing) — nothing to backfill.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    // 1. Certs that were never anchored at all (txHash is null).
    const unanchored = await prisma.certificate.findMany({
      where: { txHash: null },
      select: { id: true, sha256Hash: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // 2. Certs that lost their txHash but the chain may know them.
    //    (Defensive: normally this state doesn't arise, but covers schema
    //    migration edge cases.)
    const anchoredRows = await prisma.certificate.findMany({
      where: { txHash: null, blockNumber: { not: null } },
      select: { id: true, sha256Hash: true },
    });

    // Deduplicate the two sets.
    const anchorIds = new Set([
      ...unanchored.map((c) => c.id),
      ...anchoredRows.map((c) => c.id),
    ]);
    const pending = unanchored;

    console.log(`Found ${pending.length} certificate(s) to backfill.`);

    if (pending.length === 0) {
      console.log("Nothing to do — all certs are already anchored.");
      return;
    }

    if (dryRun) {
      console.log("[dry-run] Would anchor the following hashes:");
      pending.forEach((c) =>
        console.log(`  ${c.sha256Hash} (created ${c.createdAt.toISOString()})`)
      );
      const batches = Math.ceil(pending.length / BATCH_SIZE);
      console.log(`\n[dry-run] Would send ~${batches} chain tx(s) (${BATCH_SIZE} hashes each).`);
      return;
    }

    // Batch and anchor.
    let batchCount = 0;
    let anchoredCount = 0;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const hashes = batch.map((c) => c.sha256Hash);
      const batchNum = batchCount + 1;
      const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
      console.log(
        `[${batchNum}/${totalBatches}] Anchoring ${hashes.length} hash(es)…`
      );

      try {
        const result = await anchorBatch(hashes);
        console.log(
          `  ✔ Tx: ${result.txHash} (block #${result.blockNumber})`
        );

        // Update all rows in this batch with the chain details.
        const batchIds = batch.map((c) => c.id);
        await prisma.certificate.updateMany({
          where: { id: { in: batchIds } },
          data: {
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            chainId: result.chainId,
            anchoredAt: new Date(),
          },
        });
        batchCount++;
        anchoredCount += batch.length;
      } catch (err) {
        console.error(
          `  ✖ Batch ${batchNum} failed — skipping (certs remain un-anchored; retry to resume).`,
          err
        );
        // Continue to the next batch — registerBatch is idempotent, so
        // retrying the failed batch on the next run is safe.
      }
    }

    console.log(
      `\nBackfill complete: ${anchoredCount}/${pending.length} cert(s) anchored ` +
        `across ${batchCount} tx(s). Re-run to resume any failed batches.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✖ Backfill failed:", err?.message || err);
  process.exit(1);
});