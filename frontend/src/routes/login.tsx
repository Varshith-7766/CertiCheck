import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LockKeyhole, Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, complete2FA, isAuthenticated, user, pending2FA, pending2FAEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (isAuthenticated && user) {
    navigate({ to: user.role === "ADMIN" ? "/admin" : "/checker" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      if (err.message === "EMAIL_NOT_VERIFIED") {
        setError("Please verify your email before signing in. Check your inbox.");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await complete2FA(otp);
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = () => {
    // Logout clears the pending cookie
    void import("../lib/api").then(async ({ authApi }) => {
      try { await authApi.logout(); } catch {}
    });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-ink font-body text-foreground antialiased">
      {/* Header */}
      <header className="border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label="CertiCheck home">
            <div className="grid size-9 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-lg leading-none text-primary-foreground">V</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-xl tracking-wide">CERTICHECK</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">SHA-256 · OCR</div>
            </div>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <div className="w-full max-w-md">
          {pending2FA ? (
            <>
              <div className="anim-rise">
                <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent">
                  <ShieldCheck size={14} /> TWO-FACTOR AUTHENTICATION
                </div>
                <h1 className="mt-3 font-display text-5xl leading-none text-foreground">ENTER CODE</h1>
                <p className="mt-4 text-sm leading-relaxed text-foreground/50">
                  Enter the 6-digit code from your authenticator app
                  {pending2FAEmail ? ` for ${pending2FAEmail}` : ""}.
                </p>
              </div>

              <form onSubmit={handle2FA} className="anim-rise-1 mt-8 border border-line bg-brand/70 p-6 sm:p-8">
                {error && (
                  <div className="mb-6 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">
                    {error}
                  </div>
                )}
                <label className="block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                  AUTHENTICATOR CODE
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    required
                    className="mt-2 w-full border border-line bg-ink px-3 py-3 font-mono text-lg tracking-[0.5em] text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="mt-6 flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-semibold text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="size-5 rounded-full border-2 border-current border-t-transparent sweep" />
                  ) : (
                    <>
                      Verify & Sign in <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={cancel2FA}
                  className="mt-4 w-full text-center text-sm text-foreground/50 hover:text-foreground"
                >
                  Cancel
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="anim-rise">
                <div className="font-mono text-xs tracking-[0.2em] text-accent">SECURE ACCESS</div>
                <h1 className="mt-3 font-display text-5xl leading-none text-foreground">SIGN IN</h1>
                <p className="mt-4 text-sm leading-relaxed text-foreground/50">
                  Access your certificate management console.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="anim-rise-1 mt-8 border border-line bg-brand/70 p-6 sm:p-8">
                {error && (
                  <div className="mb-6 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">
                    {error}
                  </div>
                )}

                <label className="block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                  EMAIL
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="name@institution.com"
                    required
                    className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                  />
                </label>

                <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                  PASSWORD
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      className="mt-2 w-full border border-line bg-ink px-3 py-3 pr-10 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[42px] text-foreground/30 hover:text-foreground/60"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <div className="mt-3 text-right">
                  <Link to="/forgot" className="text-xs text-foreground/50 hover:text-accent">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-semibold text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="size-5 rounded-full border-2 border-current border-t-transparent sweep" />
                  ) : (
                    <>
                      Sign in <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[10px] text-foreground/35">
                  <LockKeyhole size={13} /> SESSION · HTTPONLY COOKIE
                </div>
              </form>

              <div className="anim-rise-2 mt-6 text-center text-sm text-foreground/50">
                Don't have an account?{" "}
                <Link to="/register" className="text-accent hover:underline">
                  Register here
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}