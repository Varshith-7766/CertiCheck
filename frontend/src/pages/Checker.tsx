import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  FileUp,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  HelpCircle,
  Settings as SettingsIcon,
  ScanLine,
  LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { verifyApi, statsApi, type Verdict } from "../lib/api";
import { Brand, Spinner, EmptyState, ThemeToggle } from "../components/ui";
import { AnimatePresence, motion } from "motion/react";
import { Ring, EASE } from "../components/motion";

function ChainTag({ chain }: { chain?: { enabled?: boolean; registered?: boolean; available?: boolean; blockNumber?: number | null; contractAddress?: string | null } | null }) {
  let label = "CHAIN UNAVAILABLE";
  let cls = "bg-fill text-sub";
  if (!chain || !chain.enabled) {
    label = "CHAIN DISABLED";
  } else if (chain.registered) {
    label = chain.blockNumber ? `ANCHORED · BLOCK #${chain.blockNumber}` : "ANCHORED ON-CHAIN";
    cls = "bg-good/[0.12] text-good-deep";
  } else if (chain.available) {
    label = "NOT ANCHORED";
    cls = "bg-warn/[0.15] text-[#9a6700] dark:text-warn";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-wide ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default function Checker() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictData, setVerdictData] = useState<{
    message?: string;
    similarity?: number;
    certificate?: { studentName?: string | null; institution?: string | null };
    submittedDetails?: { studentName?: string | null; institution?: string | null };
    chain?: { enabled?: boolean; registered?: boolean; available?: boolean; blockNumber?: number | null; contractAddress?: string | null };
    ocrProcessingTimeMs?: number;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<
    { id: string; result: string; similarityScore: number | null; fileName: string; createdAt: string }[]
  >([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "CHECKER") {
      navigate("/admin", { replace: true });
      return;
    }
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate("/setup-2fa", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [historyData] = await Promise.all([verifyApi.history(page), statsApi.get()]);
      setHistory(historyData.logs);
      setPagination(historyData.pagination);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !(!user.emailVerified || (user.totpRequired && !user.totpEnabled))) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  const handleVerify = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setVerifying(true);
    setVerdict(null);
    setVerdictData(null);
    setError("");

    try {
      const result = await verifyApi.verify(file);
      setVerdict(result.verdict);
      setVerdictData(result);
      loadData(); // Refresh history
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  if (authLoading || !user) return null;

  const verdictTone =
    verdict === "VERIFIED"
      ? { ring: "border-good/40", bg: "bg-good/[0.06]", text: "text-good-deep", icon: <ShieldCheck size={40} />, dial: "#34c759" }
      : verdict === "TAMPERED"
        ? { ring: "border-bad/40", bg: "bg-bad/[0.05]", text: "text-bad-deep", icon: <ShieldOff size={40} />, dial: "#ff3b30" }
        : { ring: "border-warn/40", bg: "bg-warn/[0.08]", text: "text-[#9a6700] dark:text-warn", icon: <HelpCircle size={40} />, dial: "#ff9f0a" };

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Brand sub="CHECKER CONSOLE" />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/checker"
              className="flex items-center gap-1.5 rounded-full bg-coal px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <ScanLine size={15} /> <span className="hidden sm:inline">Console</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              <SettingsIcon size={15} /> <span className="hidden sm:inline">Settings</span>
            </Link>
            <span className="ml-1 hidden rounded-full bg-fill px-3 py-1.5 font-mono text-[11px] text-sub md:block">
              {user.name.toUpperCase()} · CHECKER
            </span>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8">
        <div className="animate-enter flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-[0.12em] text-accent">VERIFY</div>
            <h1 className="mt-1 text-[32px] font-bold tracking-tight text-ink">Check certificate</h1>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-good-deep shadow-sm">
            <span className="live-dot size-2 rounded-full bg-good" /> ONLINE
          </span>
        </div>

        <div className="mt-6 grid items-start gap-5 xl:grid-cols-12">
          {/* Console */}
          <div className="animate-enter-1 rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-7 xl:col-span-7">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={verifying}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-line bg-canvas/60 p-4 text-left transition-all hover:border-accent/60 hover:bg-accent/[0.04] disabled:cursor-wait disabled:opacity-60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent transition-transform duration-200 group-hover:scale-105">
                  <FileUp size={21} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-ink">
                    {verifying ? "Processing…" : fileName || "Select certificate to verify"}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-sub">
                    {verifying ? "OCR + SHA-256 running" : "IMAGE · PDF · DOC · click to upload"}
                  </div>
                </div>
              </div>
              <ChevronDown size={17} className="shrink-0 text-faint" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleVerify}
              className="hidden"
            />

            {/* Progress */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-fill">
              <div
                className={`h-full rounded-full bg-accent transition-all duration-700 ${
                  !verifying && !verdict ? "w-full opacity-25" : verifying ? "w-2/3" : "w-full"
                }`}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.12em] text-faint">
              <span className={verifying || verdict ? "font-semibold text-good-deep" : ""}>
                OCR {verdict ? "✓" : verifying ? "…" : ""}
              </span>
              <span className={verdict ? "font-semibold text-good-deep" : ""}>SHA-256 {verdict ? "✓" : ""}</span>
              <span className={verdict ? "font-semibold text-good-deep" : ""}>COMPARE {verdict ? "✓" : ""}</span>
            </div>

            {verifying && !verdict && (
              <div className="mt-6 rounded-3xl bg-fill px-6 py-10 text-center">
                <Spinner className="mx-auto size-12 text-accent" />
                <div className="mt-4 text-lg font-bold tracking-tight text-ink">Scanning</div>
                <div className="mx-auto mt-1 max-w-sm truncate text-sm text-sub">
                  Running OCR + SHA-256 on &ldquo;{fileName}&rdquo;
                </div>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
            {verdict && !verifying && (
              <motion.div
                key={`${verdict}-${fileName}`}
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
                className={`mt-6 rounded-3xl border-2 p-8 text-center ${verdictTone.ring} ${verdictTone.bg}`}
              >
                <span className={`mx-auto grid size-20 place-items-center rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.10)] ${verdictTone.text}`}>
                  {verdictTone.icon}
                </span>
                <div className={`mt-4 text-[28px] font-bold tracking-tight ${verdictTone.text}`}>
                  {verdict === "VERIFIED" ? "Certificate verified" : verdict === "TAMPERED" ? "Document altered" : "Not in ledger"}
                </div>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sub">
                  {verdictData?.message}
                </p>
                {verdictData?.similarity != null && (
                  <div className="mt-5 flex flex-col items-center gap-1.5">
                    <div className="relative grid place-items-center">
                      <Ring value={verdictData.similarity} size={108} stroke={10} tone={verdictTone.dial} />
                      <span className="absolute text-xl font-bold tracking-tight text-ink">
                        {verdictData.similarity}%
                      </span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.16em] text-faint">
                      TEXT SIMILARITY
                    </span>
                  </div>
                )}
                <div className="mt-3 flex justify-center">
                  <ChainTag chain={verdictData?.chain} />
                </div>
                {(() => {
                  const details = verdictData?.certificate ?? verdictData?.submittedDetails ?? null;
                  return (
                    <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-2 text-left">
                      <div className="rounded-2xl bg-fill px-4 py-3">
                        <div className="text-[10px] font-semibold tracking-[0.12em] text-faint">STUDENT</div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-ink">
                          {details?.studentName || "Not detected"}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-fill px-4 py-3">
                        <div className="text-[10px] font-semibold tracking-[0.12em] text-faint">INSTITUTION</div>
                        <div className="mt-0.5 truncate text-sm font-semibold text-ink">
                          {details?.institution || "Not detected"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {verdictData?.ocrProcessingTimeMs != null && (
                  <div className="mt-3 font-mono text-[11px] text-faint">
                    OCR processed in {verdictData.ocrProcessingTimeMs}ms
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>

            {error && (
              <div className="mt-6 rounded-2xl border border-bad/25 bg-bad/[0.06] p-5">
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-bad-deep">
                  <AlertTriangle size={13} /> SOMETHING WENT WRONG
                </div>
                <p className="mt-1.5 text-sm text-sub">
                  Could not process this file. Nothing was concluded — please try again.
                </p>
                <p className="mt-1 font-mono text-[11px] text-sub">{error}</p>
              </div>
            )}

            {verdict && (
              <button
                onClick={() => {
                  setVerdict(null);
                  setVerdictData(null);
                  setFileName("");
                }}
                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line py-3 font-mono text-xs font-semibold tracking-[0.1em] text-sub transition-colors hover:border-accent hover:text-accent"
              >
                <RefreshCw size={14} /> VERIFY ANOTHER
              </button>
            )}
          </div>

          {/* History */}
          <div className="animate-enter-2 xl:col-span-5">
            <div className="text-xs font-semibold tracking-[0.12em] text-accent">HISTORY</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Verification log</h2>

            {loading ? (
              <div className="mt-6 flex items-center justify-center py-12">
                <Spinner className="size-7 text-accent" />
              </div>
            ) : history.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<FileCheck2 size={26} />}
                  title="No verifications yet"
                  sub="Upload a certificate to start"
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {history.map((log, i) => {
                  const tone =
                    log.result === "VERIFIED"
                      ? { text: "text-good-deep", bg: "bg-good/[0.10]", dot: "bg-good" }
                      : log.result === "TAMPERED"
                        ? { text: "text-bad-deep", bg: "bg-bad/[0.08]", dot: "bg-bad" }
                        : { text: "text-[#9a6700] dark:text-warn", bg: "bg-warn/[0.14]", dot: "bg-warn" };
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: 26 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: EASE }}
                      className="flex items-center gap-3 rounded-2xl border border-line/70 bg-card px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone.bg} ${tone.text}`}>
                        <span className={`size-2 rounded-full ${tone.dot}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${tone.text}`}>{log.result}</span>
                          {log.similarityScore != null && (
                            <span className="font-mono text-[10px] text-faint">{log.similarityScore}%</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-sub">{log.fileName}</div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] text-faint">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="cursor-pointer rounded-full border border-line bg-card px-4 py-2 font-mono text-xs text-sub transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  PREV
                </button>
                <span className="font-mono text-xs text-faint">
                  {page} / {pagination.pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="cursor-pointer rounded-full border border-line bg-card px-4 py-2 font-mono text-xs text-sub transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  NEXT
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 text-center font-mono text-[11px] tracking-[0.16em] text-faint">
          CHECKER CONSOLE · HASHED, NOT STORED
        </div>
      </main>
    </div>
  );
}
