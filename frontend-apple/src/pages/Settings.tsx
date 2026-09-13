import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  ShieldOff,
  Smartphone,
  KeyRound,
  Mail,
  Monitor,
  Trash2,
  LogOut,
  RefreshCw,
  LayoutDashboard,
  ScanLine,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { authApi, type SessionInfo } from "../lib/api";
import { Brand, Banner, PrimaryButton, SecondaryButton, ThemeToggle } from "../components/ui";

export default function Settings() {
  const { user, logout, loading: authLoading, refreshUser, resendVerification } = useAuth();
  const navigate = useNavigate();

  // 2FA state
  const [totpSecret, setTotpSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [twoFaMessage, setTwoFaMessage] = useState("");
  const [twoFaError, setTwoFaError] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsError, setSessionsError] = useState("");

  // Email verification
  const [emailMessage, setEmailMessage] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await authApi.sessions.list();
      setSessions(data.sessions);
      setSessionsError("");
    } catch (err: unknown) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load sessions");
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) void loadSessions();
  }, [user]);

  if (authLoading || !user) return null;

  const handle2FASetup = async () => {
    // F1: enrollment requires the account password — a stolen session alone
    // must not be able to enroll a new second factor.
    const password = window.prompt("Enter your account password to enable two-factor authentication:");
    if (!password) return;
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      const data = await authApi.twoFactor.setup(password);
      setTotpSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setTwoFaMessage("");
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handle2FAEnable = async () => {
    // F1: enabling confirms the password again (server-verified).
    const password = window.prompt("Confirm your account password to finish enabling two-factor authentication:");
    if (!password) return;
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      const data = await authApi.twoFactor.enable(totpCode, password);
      setRecoveryCodes(data.recoveryCodes);
      setTotpSecret("");
      setOtpauthUrl("");
      setTotpCode("");
      setTwoFaMessage(data.message);
      await refreshUser();
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Enable failed");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handle2FADisable = async () => {
    const code = window.prompt("Enter a current TOTP code (or a recovery code) to disable 2FA:");
    if (!code) return;
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      const data = await authApi.twoFactor.disable(code);
      setTwoFaMessage(data.message);
      setRecoveryCodes(null);
      await refreshUser();
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Disable failed");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handleResendEmail = async () => {
    setEmailBusy(true);
    setEmailMessage("");
    try {
      await resendVerification();
      setEmailMessage("Verification email sent — check your inbox (and spam).");
    } catch (err: unknown) {
      setTwoFaError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Sign out of all other devices?")) return;
    try {
      await authApi.sessions.revokeAll();
      await loadSessions();
    } catch (err: unknown) {
      setSessionsError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleRevokeOne = async (id: string) => {
    try {
      await authApi.sessions.revoke(id);
      await loadSessions();
    } catch (err: unknown) {
      setSessionsError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const home = user.role === "ADMIN" ? "/admin" : "/checker";
  const initials = (user.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Brand sub="SETTINGS" />
          <div className="flex items-center gap-1">
            <Link
              to={home}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              {user.role === "ADMIN" ? <LayoutDashboard size={15} /> : <ScanLine size={15} />}
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <div className="animate-enter">
          <div className="text-xs font-semibold tracking-[0.12em] text-accent">ACCOUNT SECURITY</div>
          <h1 className="mt-1 text-[32px] font-bold tracking-tight text-ink">Settings</h1>
        </div>

        {/* Profile */}
        <div className="animate-enter-1 mt-6 rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="grid size-13 shrink-0 place-items-center rounded-full bg-accent px-3.5 py-3 text-[15px] font-bold text-white">
                {initials}
              </span>
              <div>
                <div className="text-[17px] font-semibold tracking-tight text-ink">{user.name}</div>
                <div className="font-mono text-xs text-sub">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-fill px-3 py-1.5 font-mono text-[11px] font-semibold text-sub">
                {user.role}
              </span>
              {user.role === "ADMIN" && user.institution && (
                <span className="rounded-full bg-fill px-3 py-1.5 font-mono text-[11px] font-semibold text-sub">
                  {user.institution.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email */}
        <section className="animate-enter-2 mt-4 rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                <Mail size={18} />
              </span>
              <div>
                <div className="text-[15px] font-semibold text-ink">Email verification</div>
                <div className="mt-0.5 text-sm">
                  {user.emailVerified ? (
                    <span className="font-medium text-good-deep">Verified</span>
                  ) : (
                    <span className="text-sub">Not verified yet</span>
                  )}
                </div>
              </div>
            </div>
            {!user.emailVerified && (
              <div className="text-right">
                <SecondaryButton onClick={handleResendEmail} disabled={emailBusy}>
                  <RefreshCw size={14} /> Resend
                </SecondaryButton>
                {emailMessage && <div className="mt-2 text-xs font-medium text-good-deep">{emailMessage}</div>}
              </div>
            )}
          </div>
        </section>

        {/* 2FA */}
        <section className="animate-enter-2 mt-4 rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-good/[0.12] text-good-deep">
                <Smartphone size={18} />
              </span>
              <div>
                <div className="text-[15px] font-semibold text-ink">Two-factor authentication</div>
                <div className="mt-0.5 text-sm">
                  {user.totpEnabled ? (
                    <span className="font-medium text-good-deep">Enabled — authenticator app</span>
                  ) : (
                    <span className="text-sub">
                      Disabled{user.totpRequired ? ` — required for ${user.role.toLowerCase()}s` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!user.totpEnabled ? (
              <SecondaryButton onClick={handle2FASetup} disabled={twoFaBusy}>
                <ShieldCheck size={14} /> Enable 2FA
              </SecondaryButton>
            ) : (
              <SecondaryButton onClick={handle2FADisable} disabled={twoFaBusy}>
                <ShieldOff size={14} /> Disable 2FA
              </SecondaryButton>
            )}
          </div>

          {twoFaError && (
            <div className="mt-4">
              <Banner tone="error">{twoFaError}</Banner>
            </div>
          )}
          {twoFaMessage && !recoveryCodes && (
            <div className="mt-4 rounded-2xl bg-fill px-4 py-3 text-[13px] text-sub">{twoFaMessage}</div>
          )}

          {totpSecret && (
            <div className="mt-5 rounded-3xl bg-fill p-5">
              <div className="text-[11px] font-bold tracking-[0.12em] text-sub">STEP 1 — SCAN WITH AUTHENTICATOR</div>
              {otpauthUrl ? (
                <div className="mt-3 flex flex-col items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                    <QRCodeSVG value={otpauthUrl} size={168} level="M" />
                  </div>
                  <div className="text-[11px] font-semibold tracking-[0.12em] text-faint">
                    SCAN TO ENROLL · OR ENTER BELOW
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-sub">Add this secret to Google Authenticator:</p>
              )}
              <div className="mt-3 break-all rounded-2xl bg-card px-4 py-3 font-mono text-sm text-ink">
                {totpSecret}
              </div>

              <div className="mt-4 text-[11px] font-bold tracking-[0.12em] text-sub">STEP 2 — CONFIRM A CODE</div>
              <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  aria-label="6-digit authenticator code"
                  className="w-full rounded-xl border border-line bg-card px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-ink outline-none transition-all placeholder:text-faint hover:border-sub/40 focus:border-accent focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)] sm:w-44"
                />
                <PrimaryButton onClick={handle2FAEnable} disabled={twoFaBusy || totpCode.length < 6}>
                  <KeyRound size={15} /> Confirm &amp; enable
                </PrimaryButton>
              </div>
            </div>
          )}

          {recoveryCodes && (
            <div className="mt-5 rounded-3xl border border-good/30 bg-good/[0.06] p-5">
              <div className="text-[11px] font-bold tracking-[0.12em] text-good-deep">SAVE THESE RECOVERY CODES</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
                Each code works once. Store them somewhere safe.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code) => (
                  <div key={code} className="rounded-xl bg-card px-3 py-2.5 text-center text-ink shadow-sm">
                    {code}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setRecoveryCodes(null)}
                className="mt-4 cursor-pointer rounded-full border border-line bg-card px-4 py-2.5 text-[13px] font-semibold text-sub transition-colors hover:text-ink"
              >
                I&apos;ve saved them — close
              </button>
            </div>
          )}
        </section>

        {/* Sessions */}
        <section className="animate-enter-3 mt-4 rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.05)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
                <Monitor size={18} />
              </span>
              <div className="text-[15px] font-semibold text-ink">Active sessions</div>
            </div>
            <SecondaryButton onClick={handleRevokeAll}>
              <Trash2 size={14} /> Sign out other devices
            </SecondaryButton>
          </div>

          {sessionsError && (
            <div className="mt-4">
              <Banner tone="error">{sessionsError}</Banner>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {sessions.length === 0 && (
              <div className="px-2 py-3 font-mono text-xs text-faint">No active sessions</div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-fill px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    {s.current && <span className="font-bold text-accent">● THIS DEVICE</span>}
                    <span className="truncate text-sub">{s.userAgent || "Unknown device"}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-faint">
                    {s.ip || "—"} · last active {new Date(s.lastActiveAt).toLocaleString()}
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => void handleRevokeOne(s.id)}
                    className="shrink-0 cursor-pointer rounded-lg px-2 py-1 font-mono text-[10px] font-bold tracking-[0.1em] text-faint transition-colors hover:bg-bad/[0.08] hover:text-bad-deep"
                  >
                    REVOKE
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-faint">
          <SettingsIcon size={12} /> SIGNED IN AS {user.email.toUpperCase()}
        </div>
      </main>
    </div>
  );
}
