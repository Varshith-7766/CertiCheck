import {
  resolveChainConfig,
  type ChainResult,
} from "../lib/chain";

/**
 * ChainBadge — a compact on-chain evidence tag used in the checker verdict
 * panel and the admin console.
 *
 * Consumers just pass the raw `chain` object the backend returns
 * (from `/verify` → `chain`, or the ledger/list `chain` + `chainAnchor`).
 * All label/tone/color logic lives in lib/chain so BFZH applies everywhere:
 * badges can never claim "ANCHORED" unless the ledger says so.
 */
export function ChainBadge({
  chain,
  className = "",
}: {
  chain?: ChainResult | null;
  className?: string;
}) {
  const cfg = resolveChainConfig(chain);
  return (
    <div
      className={`inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] ${cfg.border} ${cfg.bg} ${cfg.text} ${className}`}
      data-chain-label={cfg.label}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      <span className="tracking-[0.15em]">{cfg.label}</span>
      {cfg.sublabel && (
        <span className="text-foreground/40">· {cfg.sublabel}</span>
      )}
    </div>
  );
}
