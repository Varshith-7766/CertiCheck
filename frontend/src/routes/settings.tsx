import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  KeyRound,
  Mail,
  Monitor,
  Trash2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { authApi, type SessionInfo } from "../lib/api";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, logout, refreshUser, resendVerification } = useAuth();
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
    } catch (err: any) {
      setSessionsError(err.message || "Failed to load sessions");
    }
  };

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  if (!user) {
    return null;
  }

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
    } catch (err: any) {
      setTwoFaError(err.message || "Setup failed");
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
    } catch (err: any) {
      setTwoFaError(err.message || "Enable failed");
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
    } catch (err: any) {
      setTwoFaError(err.message || "Disable failed");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handleResendEmail = async () => {
    setEmailBusy(true);
    setEmailMessage("");
    try {
      await resendVerification();
      setEmailMessage("Verification email sent (dev mode: see server console).");
    } catch (err: any) {
      setTwoFaError(err.message || "Failed to send");
    } finally {
      setEmailBusy(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Sign out of all other devices?")) return;
    try {
      await authApi.sessions.revokeAll();
      await loadSessions();
    } catch (err: any) {
      setSessionsError(err.message || "Failed");
    }
  };

  const handleRevokeOne = async (id: string) => {
    try {
      await authApi.sessions.revoke(id);
      await loadSessions();
    } catch (err: any) {
      setSessionsError(err.message || "Failed");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-ink font-body text-foreground antialiased">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid size-9 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-lg leading-none text-primary-foreground">V</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-xl tracking-wide">CERTICHECK</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">SECURITY SETTINGS</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={user.role === "ADMIN" ? "/admin" : "/checker"}
              className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-6">
        <div className="anim-rise">
          <div className="font-mono text-xs tracking-[0.2em] text-accent">ACCOUNT SECURITY</div>
          <h1 className="mt-3 font-display text-4xl leading-none text-foreground">SETTINGS</h1>
        </div>

        {/* Profile summary */}
        <div className="anim-rise-1 mt-6 border border-line bg-brand/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg">{user.name}</div>
              <div className="font-mono text-xs text-foreground/50">{user.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="border border-line px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-foreground/60">
                {user.role}
              </span>
              {user.role === "ADMIN" && user.institution && (
                <span className="border border-line px-2 py-1 font-mono text-[10px] tracking-[0.2em] text-foreground/60">
                  {user.institution.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Email verification */}
        <section className="anim-rise-1 mt-6 border border-line bg-brand/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail size={18} className="mt-0.5 text-foreground/40" />
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">EMAIL VERIFICATION</div>
                <div className="mt-1 text-sm">
                  {user.emailVerified ? (
                    <span className="text-accent">Verified</span>
                  ) : (
                    <span className="text-foreground/60">Not verified yet</span>
                  )}
                </div>
              </div>
            </div>
            {!user.emailVerified && (
              <div className="text-right">
                <button
                  onClick={handleResendEmail}
                  disabled={emailBusy}
                  className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground/70 hover:border-accent disabled:opacity-50"
                >
                  <RefreshCw size={14} className={emailBusy ? "sweep" : ""} />
                  Resend
                </button>
                {emailMessage && (
                  <div className="mt-2 font-mono text-[10px] text-accent">{emailMessage}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Two-factor authentication */}
        <section className="anim-rise-1 mt-6 border border-line bg-brand/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Smartphone size={18} className="mt-0.5 text-foreground/40" />
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">TWO-FACTOR AUTHENTICATION</div>
                <div className="mt-1 text-sm">
                  {user.totpEnabled ? (
                    <span className="text-accent">Enabled — authenticator app</span>
                  ) : (
                    <span className="text-foreground/60">
                      Disabled{user.totpRequired ? ` — required for ${user.role.toLowerCase()}s` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              {!user.totpEnabled && (
                <button
                  onClick={handle2FASetup}
                  disabled={twoFaBusy}
                  className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground/70 hover:border-accent disabled:opacity-50"
                >
                  <ShieldCheck size={14} /> Enable 2FA
                </button>
              )}
              {user.totpEnabled && (
                <button
                  onClick={handle2FADisable}
                  disabled={twoFaBusy}
                  className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground/70 hover:border-accent disabled:opacity-50"
                >
                  <ShieldOff size={14} /> Disable 2FA
                </button>
              )}
            </div>
          </div>

          {twoFaError && <div className="mt-4 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">{twoFaError}</div>}
          {twoFaMessage && !recoveryCodes && <div className="mt-4 border border-line px-4 py-3 font-mono text-xs text-foreground/60">{twoFaMessage}</div>}

          {totpSecret && (
            <div className="mt-5 border border-line bg-ink p-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">STEP 1 — SCAN WITH AUTHENTICATOR</div>
              <p className="mt-2 text-xs text-foreground/60">
                Add this secret to Google Authenticator (or scan the QR if one is shown in your app):
              </p>
              <div className="mt-3 break-all font-mono text-sm text-accent">{totpSecret}</div>
              <div className="mt-2 break-all font-mono text-[10px] text-foreground/35">{otpauthUrl}</div>

              <div className="mt-4 font-mono text-[10px] tracking-[0.2em] text-foreground/50">STEP 2 — CONFIRM A CODE</div>
              <div className="mt-2 flex gap-2">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className="w-32 border border-line bg-ink px-3 py-2 font-mono text-lg text-foreground outline-none placeholder:text-foreground/25 focus:border-accent"
                />
                <button
                  onClick={handle2FAEnable}
                  disabled={twoFaBusy || totpCode.length < 6}
                  className="flex items-center gap-2 bg-accent px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <KeyRound size={14} /> Confirm & enable
                </button>
              </div>
            </div>
          )}

          {recoveryCodes && (
            <div className="mt-5 border border-accent/40 bg-accent/10 p-4">
              <div className="font-mono text-[10px] tracking-[0.2em] text-accent">SAVE THESE RECOVERY CODES</div>
              <p className="mt-2 text-xs text-foreground/60">
                Each code works once. Store them somewhere safe — you'll need one if you lose your authenticator app.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-foreground">
                {recoveryCodes.map((code) => (
                  <div key={code} className="border border-line bg-ink px-3 py-2">{code}</div>
                ))}
              </div>
              <button
                onClick={() => setRecoveryCodes(null)}
                className="mt-4 border border-line px-3 py-2 text-xs text-foreground/70 hover:border-accent"
              >
                I've saved them — close
              </button>
            </div>
          )}
        </section>

        {/* Sessions */}
        <section className="anim-rise-1 mt-6 border border-line bg-brand/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Monitor size={18} className="text-foreground/40" />
              <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                ACTIVE SESSIONS
              </div>
            </div>
            <button
              onClick={handleRevokeAll}
              className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground/70 hover:border-accent"
            >
              <Trash2 size={14} /> Sign out other devices
            </button>
          </div>

          {sessionsError && <div className="mt-4 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">{sessionsError}</div>}

          <div className="mt-4 space-y-2">
            {sessions.length === 0 && (
              <div className="px-2 py-3 font-mono text-xs text-foreground/40">No active sessions</div>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border border-line bg-ink px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    {s.current && <span className="text-accent">● THIS DEVICE</span>}
                    <span className="truncate text-foreground/70">{s.userAgent || "Unknown device"}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-foreground/35">
                    {s.ip || "—"} · last active {new Date(s.lastActiveAt).toLocaleString()}
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => handleRevokeOne(s.id)}
                    className="shrink-0 font-mono text-[10px] text-foreground/50 hover:text-accent"
                  >
                    REVOKE
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}