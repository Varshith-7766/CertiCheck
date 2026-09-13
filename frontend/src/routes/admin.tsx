import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  FileUp,
  Trash2,
  LogOut,
  ShieldCheck,
  ChevronDown,
  RefreshCw,
  Clock,
  Hash,
  Users,
  Settings,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { certificateApi, statsApi, systemApi } from "../lib/api";
import { ChainBadge } from "../components/chain";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<{
    enabled?: boolean;
    contractAddress?: string | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth guard: wait for session, then enforce role / login redirect.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "ADMIN") {
      navigate({ to: "/checker" });
      return;
    }
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate({ to: "/setup-2fa" });
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
    } catch (err: any) {
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
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this certificate from the ledger?")) return;
    setDeleting(id);
    try {
      await certificateApi.delete(id);
      loadData();
    } catch (err: any) {
      alert(err.message || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const truncateHash = (hash: string) =>
    `${hash.slice(0, 8)}...${hash.slice(-8)}`;

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
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">ADMIN CONSOLE</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            {!user?.emailVerified && (
              <Link to="/settings" className="border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent hover:border-accent">
                VERIFY EMAIL
              </Link>
            )}
            <span className="hidden font-mono text-[10px] text-true sm:block">
              {user?.name?.toUpperCase()} · ADMIN
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
        {/* Stats Cards */}
        <div className="anim-rise grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<ShieldCheck size={20} />}
            label="TOTAL CERTIFICATES"
            value={stats?.totalCertificates ?? "—"}
            color="accent"
          />
          <StatCard
            icon={<Hash size={20} />}
            label="VERIFICATIONS"
            value={stats?.totalVerifications ?? "—"}
            color="true"
          />
          <StatCard
            icon={<Users size={20} />}
            label="VERIFICATION RATE"
            value={stats?.verificationRate != null ? `${stats.verificationRate}%` : "—"}
            color="true"
          />
          <StatCard
            icon={<Clock size={20} />}
            label="TAMPERED DETECTED"
            value={stats?.tamperedCount ?? "—"}
            color="accent"
          />
        </div>

        {/* Upload Section */}
        <section className="anim-rise-1 mt-10 border border-line bg-brand/70 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs tracking-[0.2em] text-accent">UPLOAD</div>
              <h2 className="mt-2 font-display text-3xl">REGISTER CERTIFICATE</h2>
              <p className="mt-2 text-sm text-foreground/50">
                Upload a certificate to OCR, hash, and store in the ledger.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="sheen skew-x-[-12deg] bg-accent px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03] disabled:opacity-50"
            >
              <span className="flex items-center gap-2 skew-x-[12deg]">
                {uploading ? (
                  <div className="size-4 rounded-full border-2 border-current border-t-transparent sweep" />
                ) : (
                  <FileUp size={16} />
                )}
                {uploading ? "PROCESSING..." : "UPLOAD FILE"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className="mt-6 border border-true/40 bg-true/10 p-4 anim-rise">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-true/20 text-true">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="font-display text-lg text-true">REGISTERED SUCCESSFULLY</div>
                  <div className="mt-1 text-xs text-foreground/50">
                    {uploadResult.certificate.fileName} · OCR took {uploadResult.ocrProcessingTimeMs}ms
                  </div>
                </div>
              </div>
                  <div className="mt-3 break-all font-mono text-[11px] text-foreground/45">
                    <span className="text-foreground/70">sha256 →</span> {uploadResult.certificate.sha256Hash}
                  </div>
                  {uploadResult.chain && (
                    <div className="mt-3">
                      <ChainBadge chain={uploadResult.chain} />
                    </div>
                  )}
                  {uploadResult.certificate.studentName && (
                <div className="mt-2 font-mono text-xs text-foreground/50">
                  Student: {uploadResult.certificate.studentName}
                  {uploadResult.certificate.rollNumber && ` · Roll: ${uploadResult.certificate.rollNumber}`}
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="mt-6 border border-accent/40 bg-accent/10 p-4 font-mono text-xs text-accent">
              {uploadError}
            </div>
          )}
        </section>

        {/* Certificate List */}
        <section className="anim-rise-2 mt-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs tracking-[0.2em] text-accent">LEDGER</div>
              <h2 className="mt-2 font-display text-3xl">REGISTERED CERTIFICATES</h2>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 border border-line px-4 py-2 font-mono text-xs text-foreground/60 hover:text-foreground transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-8 flex items-center justify-center py-20">
              <div className="size-8 rounded-full border-2 border-accent border-t-transparent sweep" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="mt-8 border border-line bg-brand/50 p-12 text-center">
              <FileUp size={40} className="mx-auto text-foreground/20" />
              <div className="mt-4 font-display text-xl text-foreground/40">NO CERTIFICATES YET</div>
              <div className="mt-2 text-sm text-foreground/30">Upload your first certificate above</div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {certificates.map((cert, i) => (
                <div
                  key={cert.id}
                  className="border border-line bg-brand/50 p-4 sm:p-5 transition-colors hover:border-accent/30"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="truncate text-sm font-semibold text-foreground">{cert.fileName}</span>
                        <span className="shrink-0 font-mono text-[10px] text-foreground/40">{cert.fileType}</span>
                      </div>
                      <div className="mt-2 break-all font-mono text-[11px] text-foreground/40">
                        <span className="text-foreground/60">sha256:</span> {truncateHash(cert.sha256Hash)}
                      </div>
                      <ChainBadge
                        chain={{
                          enabled: chainStatus?.enabled,
                          registered: Boolean(cert.txHash),
                          available: chainStatus?.enabled,
                          blockNumber: cert.blockNumber ?? null,
                          registeredAt: cert.anchoredAt ?? null,
                          contractAddress: chainStatus?.contractAddress ?? null,
                          txHash: cert.txHash ?? null,
                        }}
                        className="mt-3"
                      />
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-foreground/40">
                        {cert.studentName && <span>Student: {cert.studentName}</span>}
                        {cert.rollNumber && <span>Roll: {cert.rollNumber}</span>}
                    </div>
                    <button
                      onClick={() => handleDelete(cert.id)}
                      disabled={deleting === cert.id}
                      className="shrink-0 grid size-9 place-items-center border border-line text-foreground/30 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                    >
                      {deleting === cert.id ? (
                        <div className="size-4 rounded-full border-2 border-current border-t-transparent sweep" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
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
        </section>
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
          <div className="font-mono text-xs text-foreground/40">Admin Console · Hashed, not stored.</div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="border border-line bg-brand/50 p-5">
      <div className={`text-${color}`}>{icon}</div>
      <div className="mt-3 font-display text-3xl text-foreground">{value}</div>
      <div className="mt-1 font-mono text-[10px] tracking-wide text-foreground/40">{label}</div>
    </div>
  );
}
