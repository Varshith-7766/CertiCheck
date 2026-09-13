import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { authApi } from "../lib/api";
import { AuthShell } from "../components/auth";
import { TextField, BigPrimaryButton, Banner, Spinner } from "../components/ui";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.forgot(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      sub="Enter your email and we'll send a secure reset link. Links expire in 20 minutes."
      backTo="/login"
      backLabel="Back to sign in"
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-good/[0.12] text-good-deep">
            <MailCheck size={22} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-ink">Check your inbox</div>
            <p className="mt-1 text-sm leading-relaxed text-sub">
              If an account exists for that email, a reset link is on its way — including spam.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Banner tone="error">{error}</Banner>}
          <TextField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@institution.com"
            required
            autoFocus
          />
          <BigPrimaryButton type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Send reset link"}
          </BigPrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
