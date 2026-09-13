import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { authApi } from "../lib/api";
import { AuthShell } from "../components/auth";
import { PasswordField, TextField, BigPrimaryButton, Banner, Spinner } from "../components/ui";

export default function Reset() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError("Password needs upper + lower case, a number, and a symbol.");
      return;
    }

    setLoading(true);
    try {
      await authApi.reset(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Invalid link"
        sub="This reset link is missing its token. Request a fresh one and try again."
        backTo="/login"
        backLabel="Back to sign in"
      >
        <Link to="/forgot">
          <BigPrimaryButton type="button">Get a new link</BigPrimaryButton>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      sub="Changing it signs out all devices."
      backTo="/login"
      backLabel="Back to sign in"
    >
      {done ? (
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-good/[0.12] text-good-deep">
            <CheckCircle2 size={28} />
          </span>
          <div className="mt-4 text-xl font-bold tracking-tight text-ink">Password updated</div>
          <p className="mt-2 text-sm leading-relaxed text-sub">
            Your password was changed and all sessions were revoked.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_20px_rgba(0,122,255,0.35)] transition-all hover:bg-accent-deep active:scale-[0.98]"
          >
            Sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Banner tone="error">{error}</Banner>}
          <PasswordField
            id="password"
            label="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            required
            autoFocus
          />
          <TextField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••"
            required
            hint="10+ characters with upper + lower case, a number and a symbol."
          />
          <BigPrimaryButton type="submit" disabled={loading}>
            {loading ? <Spinner /> : "Set new password"}
          </BigPrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
