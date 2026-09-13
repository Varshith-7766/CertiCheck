import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, LockKeyhole, Eye, EyeOff, ArrowLeft, ShieldCheck, FileCheck2 } from "lucide-react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "CHECKER" as "ADMIN" | "CHECKER",
    institution: "",
    inviteCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) {
    // Every console account goes through email verify + 2FA setup first.
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate({ to: "/setup-2fa" });
    } else {
      navigate({ to: user.role === "ADMIN" ? "/admin" : "/checker" });
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.role === "ADMIN" && !formData.institution.trim()) {
      setError("Institution name is required for admin accounts");
      return;
    }

    if (formData.password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }

    if (!/[a-z]/.test(formData.password) || !/[A-Z]/.test(formData.password) ||
        !/[0-9]/.test(formData.password) || !/[^A-Za-z0-9]/.test(formData.password)) {
      setError("Password needs upper + lower case, a number, and a symbol");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        ...(formData.role === "ADMIN" ? { institution: formData.institution.trim() } : {}),
        ...(formData.role === "ADMIN" && formData.inviteCode
          ? { inviteCode: formData.inviteCode }
          : {}),
      });
      // Anti-enumeration response: the address is already registered, so no
      // session was minted. Show the same neutral guidance and stay put.
      if (!result.user) {
        setNotice(
          result.message || "If that email is available, a verification email has been sent."
        );
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
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

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <div className="anim-rise">
            <div className="font-mono text-xs tracking-[0.2em] text-accent">CREATE ACCOUNT</div>
            <h1 className="mt-3 font-display text-5xl leading-none text-foreground">REGISTER</h1>
            <p className="mt-4 text-sm leading-relaxed text-foreground/50">
              Choose your role and start verifying or managing certificates.
            </p>
          </div>

          {/* Role Selection */}
          <div className="anim-rise-1 mt-8 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: "ADMIN" })}
              className={`border p-5 text-left transition-all ${
                formData.role === "ADMIN"
                  ? "border-accent bg-accent/10"
                  : "border-line bg-brand/50 hover:border-line"
              }`}
            >
              <ShieldCheck size={24} className={formData.role === "ADMIN" ? "text-accent" : "text-foreground/30"} />
              <div className="mt-3 font-display text-lg">ADMIN</div>
              <div className="mt-1 text-xs text-foreground/40">Upload & manage certificates</div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: "CHECKER" })}
              className={`border p-5 text-left transition-all ${
                formData.role === "CHECKER"
                  ? "border-accent bg-accent/10"
                  : "border-line bg-brand/50 hover:border-line"
              }`}
            >
              <FileCheck2 size={24} className={formData.role === "CHECKER" ? "text-accent" : "text-foreground/30"} />
              <div className="mt-3 font-display text-lg">CHECKER</div>
              <div className="mt-1 text-xs text-foreground/40">Verify certificates</div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="anim-rise-2 mt-6 border border-line bg-brand/70 p-6 sm:p-8">
            {error && (
              <div className="mb-6 border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-xs text-accent">
                {error}
              </div>
            )}
            {notice && (
              <div className="mb-6 border border-line bg-ink/60 px-4 py-3 font-mono text-xs text-foreground/70">
                {notice}
              </div>
            )}

            <label className="block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
              FULL NAME
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                type="text"
                placeholder="John Doe"
                required
                className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
              />
            </label>

            <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
              EMAIL
              <input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                type="email"
                placeholder="name@institution.com"
                required
                className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
              />
            </label>

            {formData.role === "ADMIN" && (
              <>
                <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                  INSTITUTION
                  <input
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    type="text"
                    placeholder="University of Technology"
                    required
                    minLength={2}
                    className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                  />
                  <span className="mt-1 block font-mono text-[10px] text-accent/80">
                    Required — admin accounts must identify their institution
                  </span>
                </label>

                <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
                  ADMIN INVITE CODE
                  <input
                    value={formData.inviteCode}
                    onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                    type="text"
                    placeholder="Required to create an admin account"
                    required
                    className="mt-2 w-full border border-line bg-ink px-3 py-3 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                  />
                </label>
                <p className="mt-2 font-mono text-[10px] text-foreground/35">
                  Admins are created only by the website owner via a secret invite code, and must verify with 2FA after registering.
                </p>
              </>
            )}

            <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
              PASSWORD
              <div className="relative mt-2">
                <input
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={10}
                  className="w-full border border-line bg-ink px-3 py-3 pr-10 font-body text-sm text-foreground outline-none placeholder:text-foreground/25 focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="mt-4 block font-mono text-[10px] tracking-[0.2em] text-foreground/50">
              CONFIRM PASSWORD
              <input
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                type="password"
                placeholder="••••••••"
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
                <>
                  Create Account <ArrowRight size={17} />
                </>
              )}
            </button>

            <div className="mt-4 flex flex-col gap-1 font-mono text-[10px] text-foreground/35">
                <span>PASSWORD RULES: 10+ chars, upper + lower + number + symbol</span>
                <span className="flex items-center gap-2"><LockKeyhole size={13} /> SESSION · HTTPONLY COOKIE</span>
              </div>
          </form>

          <div className="anim-rise-3 mt-6 text-center text-sm text-foreground/50">
            Already have an account?{" "}
            <Link to="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
