import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, KeyRound, Smartphone, CheckCircle2, Mail, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { authApi } from "../lib/api";
import { Brand, Banner, PrimaryButton, SecondaryButton, PasswordField, ThemeToggle } from "../components/ui";

export default function Setup2fa() {
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
      navigate("/login", { replace: true });
      return;
    }
    if (user.emailVerified && (!user.totpRequired || user.totpEnabled)) {
      navigate(user.role === "ADMIN" ? "/admin" : "/checker", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Start TOTP enrollment is explicit (F1): the account password is required
  // before a new secret is minted — a stolen session alone can never enroll
  // a fresh second factor. No auto-fire on page load.

  const handleGenerateSecret = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await authApi.twoFactor.setup(password);
      setTotpSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start 2FA setup");
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
      const devUrl = await resendVerification();
      if (devUrl) {
        setEmailMessage(`Email not configured. Click to verify: ${devUrl}`);
      } else {
        setEmailMessage("Verification email sent — check your inbox (and spam).");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend verification email");
    }
  };

  const handleEnable = async () => {
    setError("");
    setBusy(true);
    try {
      const data = await authApi.twoFactor.enable(totpCode, password);
      setRecoveryCodes(data.recoveryCodes);
      setTotpCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    await refreshUser();
    navigate(user?.role === "ADMIN" ? "/admin" : "/checker", { replace: true });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Nothing to do here once fully secured — guard handles the redirect.
  if (authLoading || !user) return null;
  if (user.emailVerified && (!user.totpRequired || user.totpEnabled)) return null;

  const showingEmailStep = !user.emailVerified;

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5">
          <Brand sub={`${user.role} · SECURE SETUP`} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <div className="animate-enter">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-accent">
            <ShieldCheck size={15} /> REQUIRED STEPS
          </div>
          <h1 className="mt-2 text-[32px] font-bold tracking-tight text-ink sm:text-4xl">
            Secure your account
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-sub">
            {user.name}, {user.role.toLowerCase()} console access stays locked until you prove
            you&apos;re the real owner.
          </p>

          {/* Step indicator */}
          <ol className="mt-5 flex gap-2">
            <li
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold ${
                user.emailVerified ? "bg-good/[0.12] text-good-deep" : "bg-accent text-white shadow-[0_4px_14px_rgba(0,122,255,0.35)]"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[11px]">1</span>
              Email {user.emailVerified ? "✓" : ""}
            </li>
            <li
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold ${
                !needsTotp
                  ? "bg-good/[0.12] text-good-deep"
                  : showingEmailStep
                    ? "bg-fill text-faint"
                    : "bg-accent text-white shadow-[0_4px_14px_rgba(0,122,255,0.35)]"
              }`}
            >
              <span className="grid size-5 place-items-center rounded-full bg-white/25 text-[11px]">2</span>
              Authenticator {!needsTotp ? "✓" : ""}
            </li>
          </ol>
        </div>

        <div className="animate-enter-1 mt-6 rounded-[28px] border border-line/70 bg-card p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8">
          {error && (
            <div className="mb-5">
              <Banner tone="error">{error}</Banner>
            </div>
          )}

          {recoveryCodes ? (
            <div>
              <div className="text-xs font-semibold tracking-[0.12em] text-accent">SAVE THESE RECOVERY CODES</div>
              <p className="mt-2 text-sm leading-relaxed text-sub">
                Each code works once. Store them somewhere safe — you&apos;ll need one if you lose
                your authenticator app.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
                {recoveryCodes.map((code) => (
                  <div key={code} className="rounded-xl bg-fill px-3 py-2.5 text-center text-ink">
                    {code}
                  </div>
                ))}
              </div>
              <PrimaryButton onClick={handleDone} className="mt-5 w-full !py-3.5">
                <CheckCircle2 size={16} /> Enter {user.role.toLowerCase()} console
              </PrimaryButton>
            </div>
          ) : showingEmailStep ? (
            /* ------------------------- STEP 1: EMAIL ------------------------- */
            <div>
              <div className="text-xs font-semibold tracking-[0.12em] text-sub">VERIFY YOUR EMAIL</div>
              <p className="mt-2 text-sm leading-relaxed text-sub">
                We emailed a verification link to <span className="font-mono text-accent">{user.email}</span>.
                Click it to prove you control this inbox — this page advances on its own.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={handleResendEmail} disabled={busy}>
                  <RefreshCw size={15} /> {busy ? "Sending…" : "Resend email"}
                </SecondaryButton>
                <PrimaryButton
                  onClick={async () => {
                    try {
                      await refreshUser();
                    } catch {
                      /* poll will catch up */
                    }
                  }}
                >
                  <Mail size={15} /> I&apos;ve verified — continue
                </PrimaryButton>
              </div>
              {emailMessage && (
                <div className="mt-3 text-[13px] font-medium text-good-deep">
                  {emailMessage.startsWith("Email not configured") ? (
                    <span>
                      Email not configured.{" "}
                      <a
                        href={emailMessage.split("Click to verify: ")[1]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-accent hover:text-accent/80"
                      >
                        Click here to verify your email →
                      </a>
                    </span>
                  ) : (
                    emailMessage
                  )}
                </div>
              )}
              <div className="mt-6 flex items-center gap-2 text-xs text-faint">
                <ShieldCheck size={13} /> Inbox control is mandatory for {user.role.toLowerCase()} accounts.
              </div>
            </div>
          ) : (
            /* ------------------------- STEP 2: TOTP ------------------------- */
            <>
              {!totpSecret ? (
                <>
                  <div className="text-xs font-semibold tracking-[0.12em] text-sub">
                    STEP 2A — CONFIRM PASSWORD
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-sub">
                    Enrolling two-factor authentication is a security-critical change. Confirm your
                    account password to generate the enrollment secret.
                  </p>
                  <form
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      void handleGenerateSecret();
                    }}
                  >
                    <div className="flex-1">
                      <PasswordField
                        id="setup-password"
                        label=""
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your account password"
                      />
                    </div>
                    <PrimaryButton type="submit" disabled={busy || password.length < 1} className="shrink-0 !py-3">
                      <KeyRound size={15} /> {busy ? "Checking…" : "Generate secret"}
                    </PrimaryButton>
                  </form>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold tracking-[0.12em] text-sub">
                    STEP 2B — SCAN WITH AUTHENTICATOR
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-sub">
                    Point your authenticator app camera at this code — fastest. Manual entry below
                    if you prefer.
                  </p>
                  {otpauthUrl && (
                    <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl bg-fill p-6">
                      <div className="rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                        <QRCodeSVG value={otpauthUrl} size={184} level="M" />
                      </div>
                      <div className="text-[11px] font-semibold tracking-[0.14em] text-sub">
                        SCAN TO ENROLL INSTANTLY
                      </div>
                    </div>
                  )}
                  <div className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-sub">
                    OR ENTER MANUALLY
                  </div>
                  <div className="mt-2 break-all rounded-2xl bg-fill px-4 py-3 font-mono text-sm text-ink">
                    {totpSecret}
                  </div>

                  <div className="mt-5 text-xs font-semibold tracking-[0.12em] text-sub">
                    STEP 2C — CONFIRM A CODE
                  </div>
                  <p className="mt-2 text-sm text-sub">
                    Enter the 6-digit code currently shown in your authenticator app.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      aria-label="6-digit authenticator code"
                      className="w-full rounded-xl border border-line bg-card px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-ink outline-none transition-all placeholder:text-faint hover:border-sub/40 focus:border-accent focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)] sm:w-44"
                    />
                    <PrimaryButton onClick={handleEnable} disabled={busy || totpCode.length < 6}>
                      {busy ? <span className="spinner size-5" /> : <KeyRound size={15} />} Confirm &amp; enable
                    </PrimaryButton>
                  </div>
                </>
              )}

              <div className="mt-6 flex items-center gap-2 text-xs text-faint">
                <Smartphone size={13} /> Two-factor is mandatory for every {user.role.toLowerCase()} account.
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-sub transition-colors hover:text-ink">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
