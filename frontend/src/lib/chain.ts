// Chain status helpers for the frontend.
//
// The backend surfaces on-chain anchoring evidence on verify responses
// (`chain: { enabled, registered, available, blockNumber, registeredAt,
// contractAddress }`) and on certificate uploads / list rows (`txHash,
// blockNumber, chainId, anchoredAt`). These helpers turn that raw payload
// into the label + color a ChainBadge should render.

export type ChainResult = {
  enabled?: boolean | undefined;
  registered?: boolean | undefined;
  available?: boolean | undefined;
  blockNumber?: number | null | undefined;
  registeredAt?: string | null | undefined;
  contractAddress?: string | null | undefined;
  txHash?: string | null | undefined;
  chainPending?: boolean | undefined;
};

export type ChainBadgeConfig = {
  label: string;
  sublabel: string;
  tone: "true" | "warn" | "muted";
  border: string;
  bg: string;
  text: string;
  dot: string;
};

/** Truncate a 0x address/hash to a displayable form: 0x1234...cdef */
export function truncateAddress(value?: string | null): string {
  if (!value) return "";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

/**
 * Resolve the display config for a chain evidence object.
 *
 * Priority:
 *  1. Chain disabled         -> muted "CHAIN DISABLED"
 *  2. Registered on-chain    -> true "ANCHORED · BLOCK #N"
 *  3. Available + unregister -> warn "NOT REGISTERED"
 *  4. No chain info          -> muted "NO CHAIN EVIDENCE"
 */
export function resolveChainConfig(chain?: ChainResult | null): ChainBadgeConfig {
  if (!chain || !chain.enabled) {
    return {
      label: "CHAIN DISABLED",
      sublabel: "Ledger only · not anchored",
      tone: "muted",
      border: "border-line",
      bg: "bg-ink/60",
      text: "text-foreground/40",
      dot: "bg-foreground/30",
    };
  }

  if (chain.registered) {
    return {
      label: chain.blockNumber
        ? `ANCHORED · BLOCK #${chain.blockNumber}`
        : "ANCHORED ON-CHAIN",
      sublabel: chain.contractAddress ? truncateAddress(chain.contractAddress) : "Registered on ledger chain",
      tone: "true",
      border: "border-true/40",
      bg: "bg-true/10",
      text: "text-true",
      dot: "bg-true",
    };
  }

  if (chain.chainPending) {
    return {
      label: "ANCHORING",
      sublabel: "Hash stored · confirming on-chain",
      tone: "warn",
      border: "border-warn/40",
      bg: "bg-warn/10",
      text: "text-warn",
      dot: "bg-warn",
    };
  }

  if (chain.available) {
    return {
      label: "NOT REGISTERED",
      sublabel: "Chain available · hash not anchored",
      tone: "warn",
      border: "border-warn/40",
      bg: "bg-warn/10",
      text: "text-warn",
      dot: "bg-warn",
    };
  }

  return {
    label: "CHAIN UNAVAILABLE",
    sublabel: "No on-chain cross-check",
    tone: "muted",
    border: "border-line",
    bg: "bg-ink/60",
    text: "text-foreground/40",
    dot: "bg-foreground/30",
  };
}

/** Build a chain badge config from the admin list top-level chain object. */
export function resolveLedgerChainConfig(chain?: { enabled?: boolean; contractAddress?: string | null } | null): ChainBadgeConfig {
  return resolveChainConfig({
    enabled: chain?.enabled,
    registered: false,
    available: chain?.enabled,
    contractAddress: chain?.contractAddress,
  });
}

/**
 * Build a chain badge config for an admin list ROW, where the ledger returns
 * a flattened `{ txHash, blockNumber, chainId, anchoredAt }` on the row.
 *
 * → anchored config when txHash is present, otherwise the ledger availability
 *   indicates whether the chain is simply un-upploaded or unavailable.
 */
export function resolveLedgerRowConfig(row?: {
  txHash?: string | null;
  blockNumber?: number | null;
  chainId?: number | null;
  anchoredAt?: string | null;
  chainEnabled?: boolean;
  contractAddress?: string | null;
} | null): ChainBadgeConfig {
  if (row?.txHash) {
    return {
      label: row.blockNumber ? `ANCHORED · BLOCK #${row.blockNumber}` : "ANCHORED ON-CHAIN",
      sublabel: truncateAddress(row.txHash),
      tone: "true",
      border: "border-true/40",
      bg: "bg-true/10",
      text: "text-true",
      dot: "bg-true",
    };
  }
  if (row?.chainEnabled) {
    return {
      label: "NOT ANCHORED",
      sublabel: "Ledger available · no on-chain tx",
      tone: "warn",
      border: "border-warn/40",
      bg: "bg-warn/10",
      text: "text-warn",
      dot: "bg-warn",
    };
  }
  return {
    label: "CHAIN DISABLED",
    sublabel: "Ledger only",
    tone: "muted",
    border: "border-line",
    bg: "bg-ink/60",
    text: "text-foreground/40",
    dot: "bg-foreground/30",
  };
}

/** Pretty format a txHash/blockNumber for admin list rows. */
export function formatBlockRef(chain?: { blockNumber?: number | null } | null, txHash?: string | null): string {
  const parts: string[] = [];
  if (chain?.blockNumber != null) parts.push(`BLOCK #${chain.blockNumber}`);
  if (txHash) parts.push(truncateAddress(txHash));
  return parts.join(" · ");
}
