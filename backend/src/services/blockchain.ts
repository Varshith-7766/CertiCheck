/**
 * Blockchain anchoring service (Sepolia testnet).
 *
 * CertiCheck's DB copy of a certificate is editable by design (it stores full
 * OCR text, private data, search indexes). This service makes every edit
 * *detectable*: each certificate's SHA-256 is registered on-chain in an
 * immutable CertificateRegistry contract, and verification cross-checks the
 * chain. Once anchored, a hash can never be removed or overwritten.
 *
 * Hash mapping: certificate sha256Hex (64 lowercase hex chars, the string as
 * ASCII) is keccak256-hashed to a bytes32 key. Everyone agrees on this one
 * deterministic mapping — see sha256ToBytes32().
 *
 * Degradation policy: when the chain layer is disabled (no CHAIN_* env) or an
 * RPC call fails, we NEVER silently downgrade a security verdict. Callers get
 * { available: false } (or null) and surface it as a warning to the user.
 */
import { ethers } from "ethers";
import { config, chainEnabled } from "../config.js";

export const CERTIFICATE_CHAIN_ID = 11155111; // Sepolia

// Minimal ABI — matches contracts/CertificateRegistry.sol exactly.
const CertificateRegistryABI = [
  "function register(bytes32 _hash) external",
  "function registerBatch(bytes32[] calldata _hashes) external",
  "function isRegistered(bytes32 _hash) external view returns (bool)",
  "function getRegisteredAt(bytes32 _hash) external view returns (uint256 registeredAt, uint256 blockNumber)",
  "function anchorVerification(bytes32 _submitted, bytes32 _cert, uint8 _result) external",
  "event Registered(bytes32 indexed hash, uint256 blockNumber)",
  "event VerificationAnchored(bytes32 indexed submittedHash, bytes32 indexed certificateHash, uint8 result, uint256 blockNumber)",
] as const;

export type VerificationResultCode = 0 | 1 | 2; // 0=VERIFIED 1=TAMPERED 2=UNREGISTERED

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  chainId: number;
}

export interface ChainStatus {
  registered: boolean;
  registeredAt: string | null; // ISO timestamp of the anchoring block, if registered
  blockNumber: number | null; // block where the hash was anchored
  chainId: number;
  available: boolean; // false when chain is disabled OR RPC unreachable
}

export interface NetworkInfo {
  chainId: number;
  blockNumber: number;
  available: boolean;
}

// ---------------------------------------------------------------------------
// Inner client (lazy singleton)
// ---------------------------------------------------------------------------

let client: {
  provider: ethers.JsonRpcProvider;
  signer: ethers.Wallet;
  contract: ethers.Contract;
} | null = null;

function getClient() {
  if (client) return client;
  if (!chainEnabled) {
    throw new Error("Chain layer is not configured (CHAIN_* env missing)");
  }
  const provider = new ethers.JsonRpcProvider(config.chain.rpcUrl);
  const signer = new ethers.Wallet(config.chain.signerKey, provider);
  const contract = new ethers.Contract(
    config.chain.contractAddress,
    CertificateRegistryABI,
    signer
  );
  client = { provider, signer, contract };
  return client;
}

// Outbound txs are serialized through a trivial in-process queue: a single
// admin uploading a handful of certificates never needs concurrency, and
// serialization dodges ethers nonce races entirely.
let sendQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = sendQueue.then(fn, fn);
  sendQueue = next.catch(() => {});
  return next;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * ethers v6's wait() can resolve a receipt whose blockNumber is still null on
 * some provider paths even though the tx is mined. When that happens, re-fetch
 * the receipt — the block is definitely known by then.
 */
async function resolveBlockNumber(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  fallback: number | null
): Promise<number | null> {
  if (fallback) return fallback;
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt?.blockNumber ?? null;
  } catch {
    return null;
  }
}

function sha256ToBytes32(sha256Hex: string): string {
  const h = sha256Hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error(`Invalid sha256 hash: ${h.slice(0, 12)}…`);
  }
  // keccak256 of the ASCII hex string — deterministic, documented mapping.
  return ethers.keccak256(ethers.toUtf8Bytes(h));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isChainEnabled(): boolean {
  return chainEnabled;
}

/** keccak256(ASCII sha256Hex) — the bytes32 key used on-chain. */
export { sha256ToBytes32 };

/**
 * Anchor a certificate hash on-chain. Throws on failure (caller rolls back
 * the DB record). On success the cache is seeded so future reads are free.
 */
export async function anchorHash(sha256Hex: string): Promise<AnchorResult> {
  if (!chainEnabled) throw new Error("Chain layer is not configured");
  const c = getClient();
  const key = sha256ToBytes32(sha256Hex);

  const receipt = await serialized(() =>
    withTimeout(
      c.contract.register(key, { gasLimit: 120000 }),
      config.chain.submitTimeoutMs,
      "anchor submit"
    )
  );
  await withTimeout(
    receipt.wait(config.chain.confirmations),
    config.chain.submitTimeoutMs,
    "anchor confirmation"
  );

  const blockNumber = await resolveBlockNumber(
    c.provider,
    receipt.hash,
    receipt.blockNumber
  );

  const result: AnchorResult = {
    txHash: receipt.hash,
    blockNumber: blockNumber ?? 0,
    chainId: CERTIFICATE_CHAIN_ID,
  };
  seedCache(sha256Hex, {
    registered: true,
    registeredAt: new Date().toISOString(),
    blockNumber,
    chainId: CERTIFICATE_CHAIN_ID,
    available: true,
  });
  return result;
}

/**
 * Anchor many hashes in one tx (idempotent on-chain). Used by the
 * historical backfill. Returns tx info; row updates happen at the caller.
 */
export async function anchorBatch(sha256Hexes: string[]): Promise<AnchorResult> {
  if (!chainEnabled) throw new Error("Chain layer is not configured");
  if (sha256Hexes.length === 0) {
    throw new Error("anchorBatch requires at least one hash");
  }
  const c = getClient();
  const keys = sha256Hexes.map(sha256ToBytes32);

  const receipt = await serialized(() =>
    withTimeout(
      c.contract.registerBatch(keys, { gasLimit: 200000 + keys.length * 20000 }),
      config.chain.submitTimeoutMs,
      "batch anchor submit"
    )
  );
  await withTimeout(
    receipt.wait(config.chain.confirmations),
    config.chain.submitTimeoutMs,
    "batch anchor confirmation"
  );

  const blockNumber = await resolveBlockNumber(
    c.provider,
    receipt.hash,
    receipt.blockNumber
  );

  for (const h of sha256Hexes) {
    seedCache(h, {
      registered: true,
      registeredAt: new Date().toISOString(),
      blockNumber,
      chainId: CERTIFICATE_CHAIN_ID,
      available: true,
    });
  }
  return {
    txHash: receipt.hash,
    blockNumber: blockNumber ?? 0,
    chainId: CERTIFICATE_CHAIN_ID,
  };
}

/**
 * Anchor a verification outcome as an event-only tx (~2-4k gas). Never
 * throws: failures are logged and reported as chainStatus "PENDING" so the
 * caller can surface "audit event not yet on chain".
 */
export async function anchorVerification(
  submittedHash: string,
  certificateHash: string | null,
  result: VerificationResultCode
): Promise<AnchorResult | null> {
  if (!chainEnabled) return null;
  try {
    const c = getClient();
    const submitted = sha256ToBytes32(submittedHash);
    const cert = certificateHash
      ? sha256ToBytes32(certificateHash)
      : ethers.ZeroHash;
    const receipt = await serialized(() =>
      withTimeout(
        c.contract.anchorVerification(submitted, cert, result, { gasLimit: 80000 }),
        config.chain.submitTimeoutMs,
        "verification anchor submit"
      )
    );
    await withTimeout(
      receipt.wait(1),
      config.chain.submitTimeoutMs,
      "verification anchor confirmation"
    );
    const blockNumber = await resolveBlockNumber(
      c.provider,
      receipt.hash,
      receipt.blockNumber
    );
    return {
      txHash: receipt.hash,
      blockNumber: blockNumber ?? 0,
      chainId: CERTIFICATE_CHAIN_ID,
    };
  } catch (err) {
    console.error("Failed to anchor verification event (non-fatal):", err);
    return null;
  }
}

// Positive-results cache: chain registrations are append-only, so a cached
// "registered" can never go stale. New anchors seed the cache themselves.
const statusCache = new Map<string, ChainStatus>();

export function seedCache(sha256Hex: string, status: ChainStatus): void {
  if (status.registered && status.available) {
    statusCache.set(sha256Hex.trim().toLowerCase(), status);
  }
}

export function cacheSize(): number {
  return statusCache.size;
}

/**
 * Check whether a hash is registered on-chain. Returns available:false (never
 * throws) when the chain layer is disabled or the RPC is unreachable.
 */
export async function getChainStatus(sha256Hex: string): Promise<ChainStatus> {
  const h = sha256Hex.trim().toLowerCase();
  if (!chainEnabled) {
    return { registered: false, registeredAt: null, blockNumber: null, chainId: CERTIFICATE_CHAIN_ID, available: false };
  }
  const cached = statusCache.get(h);
  if (cached) return cached;

  try {
    const c = getClient();
    const key = sha256ToBytes32(h);
    const [isReg, at] = await withTimeout(
      Promise.all([
        (c.contract as unknown as { isRegistered: (k: string) => Promise<boolean> }).isRegistered(key),
        (c.contract as unknown as { getRegisteredAt: (k: string) => Promise<[bigint, bigint]> }).getRegisteredAt(key),
      ]),
      config.chain.rpcTimeoutMs,
      "chain status check"
    );
    const status: ChainStatus = {
      registered: isReg,
      registeredAt: isReg ? new Date(Number(at[0]) * 1000).toISOString() : null,
      blockNumber: isReg ? Number(at[1]) : null,
      chainId: CERTIFICATE_CHAIN_ID,
      available: true,
    };
    seedCache(h, status);
    return status;
  } catch (err) {
    console.error("Chain status check failed (flagged, not fatal):", err);
    return { registered: false, registeredAt: null, blockNumber: null, chainId: CERTIFICATE_CHAIN_ID, available: false };
  }
}

/**
 * Best-effort network info for the health endpoint / UI badges.
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  if (!chainEnabled) {
    return { chainId: CERTIFICATE_CHAIN_ID, blockNumber: 0, available: false };
  }
  try {
    const c = getClient();
    const [chainId, blockNumber] = await withTimeout(
      Promise.all([c.provider.getNetwork(), c.provider.getBlockNumber()]),
      config.chain.rpcTimeoutMs,
      "chain network info"
    );
    return { chainId: Number(chainId.chainId), blockNumber, available: true };
  } catch {
    return { chainId: CERTIFICATE_CHAIN_ID, blockNumber: 0, available: false };
  }
}