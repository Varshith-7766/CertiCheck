import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileUp,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Files,
  Activity,
  AlertTriangle,
  LogOut,
  Settings as SettingsIcon,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { certificateApi, statsApi, systemApi } from "../lib/api";
import { Brand, Spinner, EmptyState, ThemeToggle } from "../components/ui";
import { motion } from "motion/react";
import { Reveal, Counter, EASE } from "../components/motion";

function ChainTag({
  enabled,
  registered,
  available,
  blockNumber,
}: {
  enabled?: boolean;
  registered?: boolean;
  available?: boolean;
  blockNumber?: number | null;
}) {
  let label = "CHAIN UNAVAILABLE";
  let cls = "bg-fill text-sub";
  if (!enabled) {
    label = "CHAIN DISABLED";
  } else if (registered) {
    label = blockNumber ? `ANCHORED · BLOCK #${blockNumber}` : "ANCHORED ON-CHAIN";
    cls = "bg-good/[0.12] text-good-deep";
  } else if (available) {
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

export default function Admin() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<
    {
      id: string;
      fileName: string;
      fileType?: string;
      sha256Hash: string;
      studentName?: string | null;
      rollNumber?: string | null;
      blockNumber?: number | null;
      anchoredAt?: string | null;
      txHash?: string | null;
    }[]
  >([]);
  const [stats, setStats] = useState<{
    totalCertificates: number;
    totalVerifications: number;
    verificationRate: number | null;
    tamperedCount: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    certificate: { fileName: string; sha256Hash: string; studentName?: string | null; rollNumber?: string | null };
    chain?: { enabled: boolean; contractAddress: string | null; txHash: string | null; blockNumber: number | null; chainPending: boolean };
    ocrProcessingTimeMs: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<{
    enabled?: boolean;
    contractAddress?: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if (user.role !== "ADMIN") {
      navigate("/checker", { replace: true });
      return;
    }
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate("/setup-2fa", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [certData, statsData, healthData] = await Promise.all([
        certificateApi.list(page),
        statsApi.get(),
        systemApi.health().catch(() => null),
      ]);
      setCertificates(certData.certificates);
      setPagination(certData.pagination);
      setStats(statsData.stats);
      setChainStatus(healthData?.chain ?? null);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      user &&
      !(user.role === "ADMIN" && (!user.emailVerified || (user.totpRequired && !user.totpEnabled)))
    ) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    setUploadError("");

    try {
      const result = await certificateApi.upload(file);
      setUploadResult(result);
      loadData(); // Refresh list
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this certificate from the ledger?")) return;
    setDeleting(id);
    try {
      await certificateApi.delete(id);
      loadData();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const truncateHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-8)}`;

  if (authLoading || !user) return null;

  const cards = [
    { icon: <Files size={20} />, label: "TOTAL CERTIFICATES", value: stats?.totalCertificates, tone: "bg-accent/10 text-accent" },
    { icon: <Activity size={20} />, label: "VERIFICATIONS", value: stats?.totalVerifications, tone: "bg-good/[0.12] text-good-deep" },
    {
      icon: <ShieldCheck size={20} />,
      label: "VERIFICATION RATE",
      value: stats?.verificationRate != null ? stats.verificationRate : null,
      suffix: "%",
      tone: "bg-accent/10 text-accent",
    },
    { icon: <AlertTriangle size={20} />, label: "TAMPERED DETECTED", value: stats?.tamperedCount, tone: "bg-bad/[0.08] text-bad-deep" },
  ];

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Brand sub="ADMIN CONSOLE" />
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/admin"
              className="flex items-center gap-1.5 rounded-full bg-coal px-3.5 py-2 text-[13px] font-semibold text-white"
            >
              <LayoutDashboard size={15} /> <span className="hidden sm:inline">Overview</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              <SettingsIcon size={15} /> <span className="hidden sm:inline">Settings</span>
            </Link>
            <span className="ml-1 hidden rounded-full bg-fill px-3 py-1.5 font-mono text-[11px] text-sub md:block">
              {user.name.toUpperCase()} · ADMIN
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
        <Reveal>
          <div className="text-xs font-semibold tracking-[0.12em] text-accent">LEDGER OVERVIEW</div>
          <h1 className="mt-1 text-[32px] font-bold tracking-tight text-ink">Admin console</h1>
        </Reveal>

        {/* Stats */}
        <div className="animate-enter-1 mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.08, ease: EASE }}
              className="rounded-3xl border border-line/70 bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)]"
            >
              <span className={`grid size-10 place-items-center rounded-2xl ${c.tone}`}>{c.icon}</span>
              <div className="mt-3 text-[28px] font-bold tracking-tight text-ink tabular-nums">
                {c.value == null ? "—" : <Counter to={c.value} suffix={"suffix" in c ? (c.suffix ?? "") : ""} />}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold tracking-[0.1em] text-sub">{c.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Upload */}
        <div className="animate-enter-2 mt-5 rounded-[28px] border border-line/70 bg-card p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-xs font-semibold tracking-[0.12em] text-accent">UPLOAD</div>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">Register certificate</h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-sub">
                Upload a certificate to OCR, hash and anchor in the ledger. Anchoring continues
                in the background.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-coal px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? <Spinner className="size-4" /> : <FileUp size={16} />}
              {uploading ? "Processing…" : "Upload file"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {uploadResult && (
            <motion.div
              key={uploadResult.certificate.sha256Hash}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="mt-6 rounded-3xl border border-good/30 bg-good/[0.06] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-good/[0.14] text-good-deep">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <div className="text-[15px] font-bold tracking-tight text-good-deep">
                    Registered successfully
                  </div>
                  <div className="mt-0.5 text-xs text-sub">
                    {uploadResult.certificate.fileName} · OCR took {uploadResult.ocrProcessingTimeMs}ms
                  </div>
                </div>
              </div>
              <div className="mt-3 break-all rounded-2xl bg-card px-4 py-3 font-mono text-[11px] text-sub">
                <span className="text-ink">sha256 →</span> {uploadResult.certificate.sha256Hash}
              </div>
              {uploadResult.chain && (
                <div className="mt-3">
                  <ChainTag
                    enabled={uploadResult.chain.enabled}
                    registered={!!uploadResult.chain.txHash}
                    available={uploadResult.chain.enabled}
                    blockNumber={uploadResult.chain.blockNumber}
                  />
                  {uploadResult.chain.chainPending && (
                    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-warn/[0.15] px-3 py-1 font-mono text-[11px] font-semibold text-[#9a6700] dark:text-warn">
                      ANCHORING…
                    </span>
                  )}
                </div>
              )}
              {uploadResult.certificate.studentName && (
                <div className="mt-2 font-mono text-xs text-sub">
                  Student: {uploadResult.certificate.studentName}
                  {uploadResult.certificate.rollNumber && ` · Roll: ${uploadResult.certificate.rollNumber}`}
                </div>
              )}
            </motion.div>
          )}

          {uploadError && (
            <div className="mt-5 rounded-2xl border border-bad/25 bg-bad/[0.06] px-4 py-3 font-mono text-xs text-bad-deep">
              {uploadError}
            </div>
          )}
        </div>

        {/* Ledger */}
        <div className="mt-10">
          <Reveal>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold tracking-[0.12em] text-accent">LEDGER</div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Registered certificates</h2>
            </div>
            <button
              onClick={() => void loadData()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-card px-4 py-2.5 font-mono text-xs text-sub shadow-sm transition-colors hover:text-ink"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          </Reveal>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="size-8 text-accent" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="mt-6">
              <EmptyState icon={<FileUp size={26} />} title="No certificates yet" sub="Upload your first certificate above" />
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {certificates.map((cert, i) => (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: EASE }}
                  className="rounded-3xl border border-line/70 bg-card p-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{cert.fileName}</span>
                        <span className="shrink-0 rounded-md bg-fill px-2 py-0.5 font-mono text-[10px] text-sub">
                          {cert.fileType}
                        </span>
                      </div>
                      <div className="mt-1.5 break-all font-mono text-[11px] text-faint">
                        <span className="text-sub">sha256:</span> {truncateHash(cert.sha256Hash)}
                      </div>
                      <div className="mt-2.5">
                        <ChainTag
                          enabled={chainStatus?.enabled}
                          registered={Boolean(cert.txHash)}
                          available={chainStatus?.enabled}
                          blockNumber={cert.blockNumber}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-sub">
                        {cert.studentName && (
                          <span>
                            Student: <span className="font-medium text-ink">{cert.studentName}</span>
                          </span>
                        )}
                        {cert.rollNumber && (
                          <span>
                            Roll: <span className="font-medium text-ink">{cert.rollNumber}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleDelete(cert.id)}
                      disabled={deleting === cert.id}
                      aria-label={`Delete ${cert.fileName}`}
                      className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-faint transition-colors hover:bg-bad/[0.08] hover:text-bad-deep disabled:cursor-wait disabled:opacity-50"
                    >
                      {deleting === cert.id ? <Spinner className="size-4" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
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

        <div className="mt-12 text-center font-mono text-[11px] tracking-[0.16em] text-faint">
          ADMIN CONSOLE · HASHED, NOT STORED
        </div>
      </main>
    </div>
  );
}
