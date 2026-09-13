import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { authApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AuthShell } from "../components/auth";
import { Banner, Spinner, SecondaryButton } from "../components/ui";

type Phase = "verifying" | "ok" | "error";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<Phase>("verifying");
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
    } catch (err: unknown) {
      setState("error");
      setError(err instanceof Error ? err.message : "Verification failed");
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title={state === "ok" ? "Email verified" : state === "error" ? "Hmm, that didn't work" : "Verifying…"}
      sub={
        state === "ok"
          ? "Your email is confirmed. You're all set."
          : state === "error"
            ? "We couldn't verify that link."
            : "Confirming your token with the ledger…"
      }
      backTo="/login"
      backLabel="Back to sign in"
    >
      {state === "verifying" && (
        <div className="flex flex-col items-center py-6">
          <Spinner className="size-9 text-accent" />
          <p className="mt-4 text-sm text-sub">One moment…</p>
        </div>
      )}

      {state === "ok" && (
        <div className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-good/[0.12] text-good-deep">
            <MailCheck size={30} />
          </span>
          <Link
            to="/"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(0,122,255,0.35)] transition-all hover:bg-accent-deep active:scale-[0.98]"
          >
            Continue
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-4">
          <Banner tone="error">
            <span className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </span>
          </Banner>
          {user && !user.emailVerified && (
            <>
              <SecondaryButton onClick={handleResend} disabled={resending} className="w-full">
                <RefreshCw size={15} />
                Resend verification email
              </SecondaryButton>
              {resent && <Banner tone="success">Sent! Check your inbox (and spam).</Banner>}
            </>
          )}
          <div className="text-center">
            <Link to="/login" className="text-sm font-semibold text-accent hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
