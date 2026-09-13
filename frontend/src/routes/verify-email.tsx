import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { authApi } from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/verify-email" }) as { token?: string };
  const token = search.token || "";

  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<"verifying" | "ok" | "error">("verifying");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const verify = useCallback(async () => {
    if (!token) {
      setState("error");
      setError("Missing verification token. Use the link from your email.");
      return;
    }
    setState("verifying");
    try {
      await authApi.verifyEmail(token);
      setState("ok");
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      setState("error");
      setError(err.message || "Verification failed");
    }
  }, [token, refreshUser]);

  useEffect(() => {
    verify();
  }, [verify]);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await authApi.resendVerification();
      setResent(true);
    } catch (err: any) {
      setError(err.message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-md anim-rise border border-line bg-brand/70 p-8">
        {state === "verifying" && (
          <div className="text-center">
            <div className="mx-auto size-8 rounded-full border-2 border-accent border-t-transparent sweep" />
            <div className="mt-4 font-mono text-xs tracking-[0.2em] text-accent">VERIFYING…</div>
          </div>
        )}

        {state === "ok" && (
          <div className="text-center">
            <MailCheck size={36} className="mx-auto text-accent" />
            <div className="mt-3 font-display text-3xl text-foreground">EMAIL VERIFIED</div>
            <p className="mt-3 text-sm text-foreground/60">
              Your email is confirmed. You're all set.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block bg-accent px-6 py-3 font-semibold text-primary-foreground"
            >
              Continue
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <div className="font-mono text-xs tracking-[0.2em] text-accent">VERIFICATION ISSUE</div>
            <p className="mt-3 text-sm text-foreground/60">{error}</p>

            {user && !user.emailVerified && (
              <>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="mt-5 flex items-center gap-2 bg-accent px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <RefreshCw size={15} className={resending ? "sweep" : ""} />
                  Resend verification email
                </button>
                {resent && (
                  <p className="mt-3 font-mono text-[10px] text-accent">
                    Sent! Check your inbox (dev mode: see server console).
                  </p>
                )}
              </>
            )}

            <div className="mt-4">
              <Link to="/login" className="text-sm text-accent hover:underline">
                Back to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}