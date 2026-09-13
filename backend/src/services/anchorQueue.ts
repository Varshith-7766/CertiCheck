import { prisma } from "../index.js";
import {
  anchorHash,
  getChainStatus,
  CERTIFICATE_CHAIN_ID,
} from "./blockchain.js";

// ---------------------------------------------------------------------------
// Background on-chain anchoring queue.
//
// Uploads return 201 as soon as the DB row is durable; anchoring happens here
// so requests never wait on Sepolia block times (~12s+/confirmation) or on
// each other (chain submission is globally serialized).
//
// Durability contract:
// - success                 -> row updated with txHash/blockNumber/chainId/anchoredAt
// - landed but unconfirmed  -> row updated from chain state (txHash unknown)
// - repeated failure        -> row left unanchored for scripts/backfill-chain.ts
//   (crash recovery between DB write and anchor is the backfill's job,
//   same as the boot integrity scan's un-anchored count).
// ---------------------------------------------------------------------------

type AnchorJob = {
  certificateId: string;
  sha256Hash: string;
  attempt: number;
};

const MAX_ATTEMPTS = 5;
// Backoff after each failed attempt (attempts counted from the first failure).
const RETRY_DELAYS_MS = [30_000, 60_000, 300_000, 900_000];

const queue: AnchorJob[] = [];
let processing = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Enqueue a hash for background anchoring. Deduped per certificate. Fire-and-forget safe. */
export function enqueueAnchor(certificateId: string, sha256Hash: string): void {
  if (queue.some((j) => j.certificateId === certificateId)) return;
  queue.push({ certificateId, sha256Hash, attempt: 0 });
  void pump();
}

/** Jobs waiting (excludes the one in flight). Ops visibility. */
export function anchorQueueDepth(): number {
  return queue.length;
}

async function pump(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      await settleJob(job);
    }
  } finally {
    processing = false;
  }
}

async function settleJob(job: AnchorJob): Promise<void> {
  try {
    const anchor = await anchorHash(job.sha256Hash);
    try {
      await prisma.certificate.update({
        where: { id: job.certificateId },
        data: {
          txHash: anchor.txHash,
          blockNumber: anchor.blockNumber,
          chainId: anchor.chainId,
          anchoredAt: new Date(),
        },
      });
    } catch (dbErr) {
      // Chain has it but the DB write failed — do NOT re-anchor (a duplicate
      // tx still costs gas). Reconcile via scripts/reconcile-chain.ts; the
      // row stays visibly unanchored until then.
      console.error(
        `[anchor] certificate ${job.certificateId} anchored on-chain (tx=${anchor.txHash}) but DB update failed — reconcile manually:`,
        dbErr
      );
      return;
    }
    console.log(
      `[anchor] certificate ${job.certificateId} anchored tx=${anchor.txHash} block=${anchor.blockNumber}`
    );
  } catch (err) {
    // The tx may have landed even though submission/confirmation threw.
    // Check chain state before retrying so we never stack a duplicate
    // anchor — and never silently drop a landed one.
    const status = await getChainStatus(job.sha256Hash).catch(() => null);
    if (status?.registered) {
      await prisma.certificate
        .update({
          where: { id: job.certificateId },
          data: {
            blockNumber: status.blockNumber,
            chainId: CERTIFICATE_CHAIN_ID,
            anchoredAt: new Date(),
          },
        })
        .catch((dbErr) =>
          console.error(
            `[anchor] certificate ${job.certificateId} registered on-chain but DB update failed:`,
            dbErr
          )
        );
      console.log(
        `[anchor] certificate ${job.certificateId} confirmed registered on-chain (tx hash unknown, block=${status.blockNumber})`
      );
      return;
    }

    job.attempt += 1;
    if (job.attempt >= MAX_ATTEMPTS) {
      console.error(
        `[anchor] certificate ${job.certificateId} failed ${MAX_ATTEMPTS} attempts — left unanchored for scripts/backfill-chain.ts:`,
        err
      );
      return;
    }
    const delay =
      RETRY_DELAYS_MS[Math.min(job.attempt - 1, RETRY_DELAYS_MS.length - 1)];
    console.warn(
      `[anchor] certificate ${job.certificateId} attempt ${job.attempt} failed, retrying in ${Math.round(delay / 1000)}s:`,
      (err as Error)?.message ?? err
    );
    await sleep(delay);
    queue.unshift(job);
  }
}
