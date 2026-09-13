import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, ShieldCheck, KeyRound, Smartphone, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/auth";
import { authApi } from "../lib/api";

export const Route = createFileRoute("/setup-2fa")({
  component: Setup2FAPage,
});

function Setup2FAPage() {
  const { user, logout, loading: authLoading, refreshUser, resendVerification } = useAuth();
  const navigate = useNavigate();

  const [totpSecret, setTotpSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  const needsEmail = !!user && !user.emailVerified;
  const needsTotp = !!user && !!(user.totpRequired && !user.totpEnabled);

  // Auth guard: only console accounts (ADMIN/CHECKER) with unfinished
  // security belong here.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "ADMIN" && user.role !== "CHECKER") {
      navigate({ to: user.role === "ADMIN" ? "/admin" : "/checker" });
      return;
    }
    if (user.emailVerified && (!user.totpRequired || user.totpEnabled)) {
      navigate({ to: user.role === "ADMIN" ? "/admin" : "/checker" });
    }
  }, [user, authLoading, navigate]);

  // Start TOTP enrollment is now explicit (F1): the account password is
  // required before a new secret is minted, so a stolen session alone can
  // never enroll a fresh second factor. No auto-fire on page load.

  const handleGenerateSecret = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await authApi.twoFactor.setup(password);
      setTotpSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
    } catch (err: any) {
      setError(err.message || "Failed to start 2FA setup");
    } finally {
      setBusy(false);
    }
  };

  // While the email is unverified, poll so the page advances on its own
  // once the user clicks the verification link.
  useEffect(() => {
    if (!needsEmail) return;
    const id = setInterval(() => {
      refreshUser().catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [needsEmail, refreshUser]);

  const handleResendEmail = async () => {
    setEmailMessage("");
    try {
      await resendVerification();
      setEmailMessage("Verification email sent — check your inbox (dev: backend log).");
    } catch (err: any) {
      setError(err.message || "Failed to resend verification email");
    }
  };

  const handleEnable = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await authApi.twoFactor.enable(totpCode, password);
      setRecoveryCodes(data.recoveryCodes);
      setTotpCode("");
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    await refreshUser();
    navigate({ to: user?.role === "ADMIN" ? "/admin" : "/checker", replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  // Nothing to do here once fully secured — guard handles the redirect.
  if (authLoading || !user) return null;
  if (user.role !== "ADMIN" && user.role !== "CHECKER") return null;
  if (user.emailVerified && (!user.totpRequired || user.totpEnabled)) return null;

  const showingEmailStep = !user.emailVerified;

  return (
    <div className="min-h-screen bg-ink font-body text-foreground antialiased">
      {/* Header */}
      <header className="border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="CertiCheck home">
            <div className="grid size-9 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-lg leading-none text-primary-foreground">V</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-xl tracking-wide">CERTICHECK</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">{user.role} · SECURE SETUP</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={14} /> Back to home
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

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="anim-rise">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent">
              <ShieldCheck size={14} /> REQUIRED STEPS
            </div>
            <h1 className="mt-3 font-display text-5xl leading-none text-foreground">SECURE YOUR ACCOUNT</h1>
            <p className="mt-4 text-sm leading-relaxed text-foreground/50">
              {user.name}, {user.role.toLowerCase()} console access stays locked until you prove you're the real owner. Verify your
              email inbox, then register your phone's authenticator app.
            </p>

            {/* Step indicator */}
            <div className="mt-5 flex gap-2 font-mono text-[10px] tracking-[0.2em]">
              <span className={!showingEmailStep ? "border border-accent bg-accent/10 px-2 py-1 text-accent" : "border border-line bg-brand/50 px-2 py-1 text-foreground/50"}>
                STEP 1 · EMAIL {user.emailVerified ? "✓" : ""}
              </span>
              <span className={showingEmailStep ? "border border-line px-2 py-1 text-foreground/30" : "border border-accent bg-accent/10 px-2 py-1 text-accent"}>
                STEP 2 · 2FA {!needsTotp ? "✓" : ""}
              </span>
            </div>
          </div>

          <div className="anim-rise-1 mt-6 border border-line bg-brand/70 p-6 sm:p-8">
            {error && (
              <div className="mb-6 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">{error}</div>
            )}

            {recoveryCodes ? (
              <div className="border border-accent/40 bg-accent/10 p-4">
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
                  onClick={handleDone}
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-semibold text-primary-foreground transition-all hover:scale-[1.01]"
                >
                  <CheckCircle2 size={16} /> Setup complete — Enter {user.role.toLowerCase()} console
                </button>
              </div>
            ) : showingEmailStep ? (
              /* ------------------------- STEP 1: EMAIL ------------------------- */
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">VERIFY YOUR EMAIL</div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/60">
                  We emailed a verification link to <span className="font-mono text-accent">{user.email}</span>.
                  Click it to prove you control this inbox. Checking automatically…
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleResendEmail}
                    disabled={busy}
                    className="flex items-center gap-2 border border-line px-3 py-2 text-sm text-foreground/70 hover:border-accent disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> {busy ? "Sending…" : "Resend verification email"}
                  </button>
                  <button
                    onClick={async () => { try { await refreshUser(); } catch {} }}
                    className="flex items-center gap-2 bg-accent px-4 py-2 font-semibold text-primary-foreground"
                  >
                    <Mail size={14} /> I've verified — continue
                  </button>
                </div>
                {emailMessage && (
                  <div className="mt-4 font-mono text-[10px] text-accent">{emailMessage}</div>
                )}
                <div className="mt-6 flex items-center gap-2 font-mono text-[10px] text-foreground/35">
                  <ShieldCheck size={13} /> Inbox control is mandatory for {user.role.toLowerCase()} accounts.
                </div>
              </div>
            ) : (
              /* ------------------------- STEP 2: TOTP ------------------------- */
              <>
                {!totpSecret ? (
                  <>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">STEP 2A — CONFIRM PASSWORD</div>
                    <p className="mt-2 text-xs leading-relaxed text-foreground/60">
                      Enrolling two-factor authentication is a security-critical change. Confirm your
                      account password to generate the enrollment secret.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your account password"
                        autoComplete="current-password"
                        className="w-full border border-line bg-ink px-3 py-2 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                      />
                      <button
                        onClick={handleGenerateSecret}
                        disabled={busy || password.length < 1}
                        className="flex shrink-0 items-center gap-2 bg-accent px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <KeyRound size={14} /> {busy ? "Checking…" : "Generate secret"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-foreground/50">STEP 2B — SCAN WITH AUTHENTICATOR</div>
                    <p className="mt-2 text-xs text-foreground/60">
                      Open Google Authenticator (or any TOTP app), tap the + and enter this secret manually:
                    </p>
                    <div className="mt-3 break-all font-mono text-sm text-accent">{totpSecret}</div>
                    {otpauthUrl && (
                      <div className="mt-2 break-all font-mono text-[10px] text-foreground/35">{otpauthUrl}</div>
                    )}

                    <div className="mt-5 font-mono text-[10px] tracking-[0.2em] text-foreground/50">STEP 2C — CONFIRM A CODE</div>
                    <p className="mt-2 text-xs text-foreground/60">
                      Enter the 6-digit code currently shown in your authenticator app.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        inputMode="numeric"
                        className="w-32 border border-line bg-ink px-3 py-2 font-mono text-lg text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                      />
                      <button
                        onClick={handleEnable}
                        disabled={busy || totpCode.length < 6}
                        className="flex items-center gap-2 bg-accent px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <KeyRound size={14} /> Confirm & enable
                      </button>
                    </div>
                  </>
                )}

                <div className="mt-6 flex items-center gap-2 font-mono text-[10px] text-foreground/35">
                  <Smartphone size={13} /> Two-factor is mandatory for every {user.role.toLowerCase()} account — no way around it.
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}