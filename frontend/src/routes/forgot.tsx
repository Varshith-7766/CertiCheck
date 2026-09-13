import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { authApi } from "../lib/api";

export const Route = createFileRoute("/forgot")({
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.forgot(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

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
              <KeyRound size={14} /> PASSWORD RESET
            </div>
            <h1 className="mt-3 font-display text-5xl leading-none text-foreground">FORGOT PASSWORD</h1>
            <p className="mt-4 text-sm leading-relaxed text-foreground/50">
              Enter your email and we'll send a secure reset link (expires in 20 minutes).
            </p>
          </div>

          {sent ? (
            <div className="anim-rise-1 mt-8 border border-line bg-brand/70 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <MailCheck size={22} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <div className="font-mono text-xs tracking-[0.2em] text-accent">EMAIL SENT</div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                    If an account exists for that email, a reset link is on its way.
                    Check your inbox (and spam).
                  </p>
                </div>
              </div>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-semibold text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="size-5 rounded-full border-2 border-current border-t-transparent sweep" />
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}