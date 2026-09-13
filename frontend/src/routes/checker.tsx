import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  FileUp,
  LogOut,
  FileCheck2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldOff,
  HelpCircle,
  Settings,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { verifyApi, statsApi } from "../lib/api";
import { ChainBadge } from "../components/chain";

type Verdict = "VERIFIED" | "TAMPERED" | "UNREGISTERED" | null;

export const Route = createFileRoute("/checker")({
  component: CheckerDashboard,
});

function CheckerDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [verdictData, setVerdictData] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth guard: wait for session, then enforce role / login redirect.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "CHECKER") {
      navigate({ to: "/admin" });
      return;
    }
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate({ to: "/setup-2fa" });
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [historyData, statsData] = await Promise.all([
        verifyApi.history(page),
        statsApi.get(),
      ]);
      setHistory(historyData.logs);
      setPagination(historyData.pagination);
      setStats(statsData.stats);
    } catch (err: any) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      user &&
      !(!user.emailVerified || (user.totpRequired && !user.totpEnabled))
    ) {
      loadData();
    }
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
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const truncateHash = (hash: string) =>
    `${hash.slice(0, 8)}...${hash.slice(-8)}`;

  const verdictConfig = {
    VERIFIED: {
      title: "CERTIFICATE VERIFIED",
      subtitle: "Hash matched on ledger · 0 tamper flags",
      icon: <ShieldCheck size={48} />,
      borderColor: "border-true/40",
      bgColor: "bg-true/10",
      textColor: "text-true",
      glowColor: "shadow-[0_0_40px_rgba(72,187,120,0.15)]",
    },
    TAMPERED: {
      title: "DOCUMENT ALTERED",
      subtitle: "Hash mismatch · document appears tampered",
      icon: <ShieldOff size={48} />,
      borderColor: "border-accent/40",
      bgColor: "bg-accent/10",
      textColor: "text-accent",
      glowColor: "shadow-[0_0_40px_rgba(239,68,68,0.15)]",
    },
    UNREGISTERED: {
      title: "NOT IN LEDGER",
      subtitle: "No matching certificate found",
      icon: <HelpCircle size={48} />,
      borderColor: "border-warn/40",
      bgColor: "bg-warn/10",
      textColor: "text-warn",
      glowColor: "shadow-[0_0_40px_rgba(234,179,8,0.15)]",
    },
  };

  return (
    <div className="min-h-screen bg-ink font-body text-foreground antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-9 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-lg leading-none text-primary-foreground">V</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-xl tracking-wide">CERTICHECK</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">CHECKER CONSOLE</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {!user?.emailVerified && (
              <Link to="/settings" className="border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent hover:border-accent">
                VERIFY EMAIL
              </Link>
            )}
            <span className="hidden font-mono text-[10px] text-true sm:block">
              {user?.name?.toUpperCase()} · CHECKER
            </span>
            <Link to="/settings" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors">
              <Settings size={14} /> Settings
            </Link>
            <button
              onClick={() => { logout(); navigate({ to: "/" }); }}
              className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Verification Console */}
          <div className="lg:col-span-7">
            <div className="anim-rise border border-line bg-brand/70 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs tracking-[0.2em] text-accent">VERIFY</div>
                  <h2 className="mt-2 font-display text-3xl">CHECK CERTIFICATE</h2>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-true">
                  <span className="size-2 rounded-full bg-true blink" /> ONLINE
                </div>
              </div>

              {/* Upload Area */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={verifying}
                className="mt-6 flex w-full items-center justify-between border border-line bg-ink/60 p-4 text-left transition-colors hover:border-accent/60 disabled:opacity-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent/15 font-display text-lg text-accent">
                    <FileUp size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {verifying ? "PROCESSING..." : fileName || "Select certificate to verify"}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-foreground/40">
                      {verifying ? "OCR + SHA-256 running" : "IMAGE · PDF · DOC · click to upload"}
                    </div>
                  </div>
                </div>
                <ChevronDown size={17} className="shrink-0 text-foreground/40" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleVerify}
                className="hidden"
              />

              {/* Processing Steps */}
              <div className="mt-4 h-1 w-full overflow-hidden bg-line">
                <div
                  className={`h-full bg-accent transition-all duration-700 ${
                    !verifying && !verdict ? "w-full" : verifying ? "w-2/3" : "w-full"
                  }`}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-foreground/40">
                <span className={verifying || verdict ? "text-true" : ""}>
                  OCR {verdict ? "✓" : verifying ? "…" : ""}
                </span>
                <span className={verdict ? "text-true" : ""}>
                  SHA-256 {verdict ? "✓" : ""}
                </span>
                <span className={verdict ? "text-true" : ""}>
                  COMPARE {verdict ? "✓" : ""}
                </span>
              </div>

              {/* Verdict Display */}
              {verifying && !verdict && (
                <div className="mt-6 border border-line bg-ink/60 p-6 text-center anim-rise">
                  <div className="mx-auto size-16 rounded-full border-2 border-accent border-t-transparent sweep" />
                  <div className="mt-4 font-display text-2xl text-foreground/80">SCANNING</div>
                  <div className="mt-2 text-sm text-foreground/40">
                    Running OCR + SHA-256 on "{fileName}"
                  </div>
                </div>
              )}

              {verdict && (
                <div
                  className={`mt-6 border-2 p-8 text-center ${verdictConfig[verdict].borderColor} ${verdictConfig[verdict].bgColor} ${verdictConfig[verdict].glowColor} verdict-entrance`}
                >
                  <div
                    className={`mx-auto size-20 rounded-full flex items-center justify-center ${verdictConfig[verdict].bgColor} ${verdictConfig[verdict].textColor} verdict-icon-pop`}
                  >
                    {verdictConfig[verdict].icon}
                  </div>
                  <div
                    className={`mt-5 font-display text-4xl ${verdictConfig[verdict].textColor} verdict-title-slide`}
                  >
                    {verdictConfig[verdict].title}
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground/80">
                    {verdictData?.message ?? verdictConfig[verdict].subtitle}
                  </div>

                  {verdictData?.similarity != null && (
                    <div className="mt-4 inline-flex items-center gap-2 border border-line bg-ink/60 px-4 py-2 font-mono text-xs text-foreground/60">
                      <span className="text-foreground/40">SIMILARITY:</span>
                      <span className={`font-bold ${verdictConfig[verdict].textColor}`}>
                        {verdictData.similarity}%
                      </span>
                    </div>
                  )}

                  <div className="mt-4">
                    <ChainBadge chain={verdictData?.chain} />
                  </div>

                  {(() => {
                    const details =
                      verdictData?.certificate ?? verdictData?.submittedDetails ?? null;
                    return (
                      <div className="mt-4 border border-line bg-ink/40 p-3 font-mono text-xs text-foreground/50">
                        <div>Student: {details?.studentName || "Not detected"}</div>
                        <div>Institution: {details?.institution || "Not detected"}</div>
                      </div>
                    );
                  })()}

                  {verdictData?.ocrProcessingTimeMs && (
                    <div className="mt-3 font-mono text-[10px] text-foreground/30">
                      OCR processed in {verdictData.ocrProcessingTimeMs}ms
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-6 border border-dashed border-foreground/30 bg-ink/60 p-5">
                  <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-foreground/40">
                    <AlertTriangle size={13} /> SYSTEM ERROR — NOT A VERDICT
                  </div>
                  <div className="mt-2 text-sm text-foreground/70">
                    Could not process this file. Nothing was concluded about the certificate — please try again.
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-foreground/35">{error}</div>
                </div>
              )}

              {verdict && (
                <button
                  onClick={() => { setVerdict(null); setVerdictData(null); setFileName(""); }}
                  className="mt-6 flex w-full items-center justify-center gap-2 border border-line py-3 font-mono text-xs text-foreground/50 hover:text-foreground hover:border-accent/50 transition-colors"
                >
                  <RefreshCw size={14} /> VERIFY ANOTHER
                </button>
              )}
            </div>
          </div>

          {/* Right: History */}
          <div className="lg:col-span-5">
            <div className="anim-rise-1">
              <div className="font-mono text-xs tracking-[0.2em] text-accent">HISTORY</div>
              <h3 className="mt-2 font-display text-2xl">VERIFICATION LOG</h3>
            </div>

            {loading ? (
              <div className="mt-6 flex items-center justify-center py-12">
                <div className="size-6 rounded-full border-2 border-accent border-t-transparent sweep" />
              </div>
            ) : history.length === 0 ? (
              <div className="mt-6 border border-line bg-brand/50 p-8 text-center">
                <FileCheck2 size={32} className="mx-auto text-foreground/20" />
                <div className="mt-3 font-display text-lg text-foreground/40">NO VERIFICATIONS YET</div>
                <div className="mt-1 text-xs text-foreground/30">Upload a certificate to start</div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {history.map((log, i) => {
                  const config =
                    log.result === "VERIFIED"
                      ? { color: "text-true", bg: "bg-true/10", border: "border-true/30", icon: <Check size={14} /> }
                      : log.result === "TAMPERED"
                      ? { color: "text-accent", bg: "bg-accent/10", border: "border-accent/30", icon: <X size={14} /> }
                      : { color: "text-warn", bg: "bg-warn/10", border: "border-warn/30", icon: <AlertTriangle size={14} /> };

                  return (
                    <div
                      key={log.id}
                      className={`border ${config.border} ${config.bg} p-3 anim-rise`}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid size-7 shrink-0 place-items-center rounded-full ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs font-bold ${config.color}`}>
                              {log.result}
                            </span>
                            {log.similarityScore != null && (
                              <span className="font-mono text-[10px] text-foreground/40">
                                {log.similarityScore}%
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-foreground/40">{log.fileName}</div>
                        </div>
                        <div className="shrink-0 font-mono text-[10px] text-foreground/30">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="border border-line px-3 py-1.5 font-mono text-xs text-foreground/50 hover:text-foreground disabled:opacity-30"
                >
                  PREV
                </button>
                <span className="font-mono text-xs text-foreground/40">
                  {page} / {pagination.pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="border border-line px-3 py-1.5 font-mono text-xs text-foreground/50 hover:text-foreground disabled:opacity-30"
                >
                  NEXT
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-line bg-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-8 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-primary-foreground">V</span>
            </div>
            <span className="font-display text-lg">CERTICHECK</span>
          </div>
          <div className="font-mono text-xs text-foreground/40">Checker Console · Hashed, not stored.</div>
        </div>
      </footer>
    </div>
  );
}
