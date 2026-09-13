import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react";
import { authApi } from "../lib/api";

export const Route = createFileRoute("/reset")({
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset" }) as { token?: string };
  const token = search.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
        !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Password needs upper + lower case, a number, and a symbol");
      return;
    }

    setLoading(true);
    try {
      await authApi.reset(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink px-5">
        <div className="w-full max-w-md border border-line bg-brand/70 p-8 text-center">
          <div className="font-mono text-xs tracking-[0.2em] text-accent">INVALID LINK</div>
          <p className="mt-3 text-sm text-foreground/60">
            This reset link is missing its token. Request a new one.
          </p>
          <Link to="/forgot" className="mt-5 inline-block text-sm text-accent hover:underline">
            Get a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink font-body text-foreground antialiased">
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
          <Link to="/login" className="flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <div className="w-full max-w-md">
          <div className="anim-rise">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-accent">
              <KeyRound size={14} /> NEW PASSWORD
            </div>
            <h1 className="mt-3 font-display text-5xl leading-none text-foreground">RESET PASSWORD</h1>
            <p className="mt-4 text-sm leading-relaxed text-foreground/50">
              Choose a new password. Changing it signs out all devices.
            </p>
          </div>

          {done ? (
            <div className="anim-rise-1 mt-8 border border-line bg-brand/70 p-6 sm:p-8 text-center">
              <div className="font-mono text-xs tracking-[0.2em] text-accent">RESET COMPLETE</div>
              <p className="mt-3 text-sm text-foreground/60">
                Your password was changed and all sessions were revoked.
              </p>
              <Link to="/login" className="mt-5 inline-block bg-accent px-6 py-3 font-semibold text-primary-foreground">
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="anim-rise-1 mt-8 border border-line bg-brand/70 p-6 sm:p-8">
              {error && (
                <div className="mb-6 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">
                  {error}
                </div>
              )}

              <label className="block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                NEW PASSWORD
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    required
                    autoFocus
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

              <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                CONFIRM PASSWORD
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••••"
                  required
                  className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                />
              </label>

              <div className="mt-2 font-mono text-[10px] text-foreground/35">
                10+ chars, upper + lower + number + symbol
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-semibold text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="size-5 rounded-full border-2 border-current border-t-transparent sweep" />
                ) : (
                  "Set new password"
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}