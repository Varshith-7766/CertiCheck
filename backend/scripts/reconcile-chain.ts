#!/usr/bin/env npx tsx
/**
 * Reconcile DB anchor fields against the chain.
 *
 * Fixes rows where:
 *   - txHash is set but blockNumber is null (ethers v6 wait() quirk that
 *     could previously leave blockNumber null), and
 *   - txHash is null but the chain says the hash IS registered (re-anchor
 *     state repair: DB says un-anchored, chain is ground truth) — rows get
 *     the chain's blockNumber + chainId (txHash stays null = "confirmed by
 *     chain, tx id unknown").
 *
 * Read-only toward the chain (no txs sent). Safe to re-run.
 *
 * Usage:  npx tsx scripts/reconcile-chain.ts
 */
import { PrismaClient } from "@prisma/client";
import { getChainStatus, isChainEnabled } from "../src/services/blockchain.js";

async function main() {
  if (!isChainEnabled()) {
    console.error("✖ Chain layer is not configured — nothing to reconcile.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.certificate.findMany({
      select: { id: true, sha256Hash: true, txHash: true, blockNumber: true, chainId: true },
    });

    let missingBlock = 0;
    let chainKnowsButDbDoesnt = 0;
    let updated = 0;

    for (const row of rows) {
      const status = await getChainStatus(row.sha256Hash);
      if (!status.available) {
        console.log(`  ⏳ ${row.sha256Hash.slice(0, 12)}… chain unreachable — skipped`);
        continue;
      }

      if (row.txHash && row.blockNumber === null && status.registered && status.blockNumber) {
        // Case 1: tx landed, block known on-chain, DB field was lost.
        await prisma.certificate.update({
          where: { id: row.id },
          data: { blockNumber: status.blockNumber, chainId: status.chainId },
        });
        missingBlock++;
        updated++;
        console.log(
          `  ✔ ${row.sha256Hash.slice(0, 12)}… blockNumber → #${status.blockNumber}`
        );
      } else if (!row.txHash && status.registered) {
        // Case 2: DB row un-anchored but chain knows the hash.
        await prisma.certificate.update({
          where: { id: row.id },
          data: {
            blockNumber: status.blockNumber,
            chainId: status.chainId,
            anchoredAt: status.registeredAt ? new Date(status.registeredAt) : new Date(),
          },
        });
        chainKnowsButDbDoesnt++;
        updated++;
        console.log(
          `  ✔ ${row.sha256Hash.slice(0, 12)}… chain KNOWS this hash — row marked anchored (block #${status.blockNumber})`
        );
      }
    }

    console.log(
      `\nReconcile done: ${updated} row(s) updated ` +
        `(${missingBlock} fixed blockNumber, ${chainKnowsButDbDoesnt} chain-known-but-unmarked).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("✖ Reconcile failed:", err?.message || err);
  process.exit(1);
});