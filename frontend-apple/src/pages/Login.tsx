import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AuthShell } from "../components/auth";
import { TextField, PasswordField, BigPrimaryButton, Banner, Spinner } from "../components/ui";

export default function Login() {
  const { login, complete2FA, isAuthenticated, user, pending2FA, pending2FAEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) {
    navigate(user.role === "ADMIN" ? "/admin" : "/checker", { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message === "EMAIL_NOT_VERIFIED"
        ? "Please verify your email before signing in. Check your inbox."
        : message);
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await complete2FA(otp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = () => {
    void import("../lib/api").then(async ({ authApi }) => {
      try {
        await authApi.logout();
      } catch {
        /* cookie may already be gone */
      }
    });
    window.location.reload();
  };

  return (
    <AuthShell
      title={pending2FA ? "Check your authenticator" : "Welcome back"}
      sub={
        pending2FA
          ? `Enter the 6-digit code from your authenticator app${pending2FAEmail ? ` for ${pending2FAEmail}` : ""}.`
          : "Sign in to your certificate console."
      }
      footer={
        !pending2FA ? (
          <>
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-semibold text-accent hover:underline">
              Register
            </Link>
          </>
        ) : undefined
      }
    >
      {pending2FA ? (
        <form onSubmit={handle2FA} className="space-y-4">
          {error && <Banner tone="error">{error}</Banner>}
          <label htmlFor="otp" className="block">
            <span className="text-[13px] font-medium text-ink">Authenticator code</span>
            <input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              required
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-ink outline-none transition-all placeholder:text-faint hover:border-sub/40 focus:border-accent focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)]"
            />
          </label>
          <BigPrimaryButton type="submit" disabled={loading || otp.length < 6}>
                          {loading ? <Spinner /> : <>Verify &amp; sign in <ArrowRight size={17} /></>}</BigPrimaryButton>
          <button
            type="button"
            onClick={cancel2FA}
            className="w-full cursor-pointer py-1 text-center text-sm text-sub transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
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
          <div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="mt-2 text-right">
              <Link to="/forgot" className="text-[13px] font-medium text-accent hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
          <BigPrimaryButton type="submit" disabled={loading}>
                            {loading ? <Spinner /> : <>Sign in <ArrowRight size={17} /></>}</BigPrimaryButton>
          <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-faint">
            <LockKeyhole size={12} /> Protected by httpOnly session cookies
          </div>
        </form>
      )}
    </AuthShell>
  );
}
