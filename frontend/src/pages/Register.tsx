import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import type { RegisterPayload } from "../lib/api";
import { AuthShell } from "../components/auth";
import { TextField, PasswordField, BigPrimaryButton, Banner, Spinner, Segmented } from "../components/ui";

export default function Register() {
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user) {
    // Every console account goes through email verify + 2FA setup first.
    if (!user.emailVerified || (user.totpRequired && !user.totpEnabled)) {
      navigate("/setup-2fa", { replace: true });
    } else {
      navigate(user.role === "ADMIN" ? "/admin" : "/checker", { replace: true });
    }
    return null;
  }

  const set = (patch: Partial<typeof formData>) => setFormData((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.role === "ADMIN" && !formData.institution.trim()) {
      setError("Institution name is required for admin accounts.");
      return;
    }
    if (formData.password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (
      !/[a-z]/.test(formData.password) ||
      !/[A-Z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password) ||
      !/[^A-Za-z0-9]/.test(formData.password)
    ) {
      setError("Password needs upper + lower case, a number, and a symbol.");
      return;
    }

    setLoading(true);
    try {
      const payload: RegisterPayload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        ...(formData.role === "ADMIN" ? { institution: formData.institution.trim() } : {}),
        ...(formData.role === "ADMIN" && formData.inviteCode ? { inviteCode: formData.inviteCode } : {}),
      };
      const result = await register(payload);
      // Anti-enumeration: already-registered addresses get the same neutral
      // shape with no user — show identical guidance and stay put.
      if (!result.user) {
        setNotice(result.message || "If that email is available, a verification email has been sent.");
      }
      // Dev mode: when SMTP isn't configured, the verify link comes back
      // in the response — show it so the user can verify immediately.
      if (result.devVerifyUrl) {
        setDevVerifyUrl(result.devVerifyUrl);
        setNotice("Email not configured on this server — use the link below to verify.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      sub="Pick a role to get started. Every account is email-verified and 2FA-secured."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}
        {notice && (
          <Banner tone="info">
            {notice}
            {devVerifyUrl && (
              <>
                {" "}
                <a
                  href={devVerifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Click here to verify your email →
                </a>
              </>
            )}
          </Banner>
        )}

        <Segmented
          value={formData.role}
          onChange={(role) => set({ role })}
          options={[
            { id: "ADMIN", title: "Admin", sub: "Upload & manage certificates" },
            { id: "CHECKER", title: "Checker", sub: "Verify certificates" },
          ]}
        />

        <TextField
          id="name"
          label="Full name"
          value={formData.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="John Doe"
          required
          autoFocus
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="name@institution.com"
          required
        />

        {formData.role === "ADMIN" && (
          <>
            <TextField
              id="institution"
              label="Institution"
              value={formData.institution}
              onChange={(e) => set({ institution: e.target.value })}
              placeholder="University of Technology"
              required
              minLength={2}
              hint="Admin accounts must identify their institution."
            />
            <TextField
              id="inviteCode"
              label="Admin invite code"
              value={formData.inviteCode}
              onChange={(e) => set({ inviteCode: e.target.value })}
              placeholder="Issued by the website owner"
              required
            />
          </>
        )}

        <PasswordField
          id="password"
          label="Password"
          value={formData.password}
          onChange={(e) => set({ password: e.target.value })}
          placeholder="••••••••"
          required
          minLength={10}
        />
        <TextField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => set({ confirmPassword: e.target.value })}
          placeholder="••••••••"
          required
          hint="10+ characters with upper + lower case, a number and a symbol."
        />

        <BigPrimaryButton type="submit" disabled={loading}>
                      {loading ? <Spinner /> : <>Create account <ArrowRight size={17} /></>}</BigPrimaryButton>
      </form>
    </AuthShell>
  );
}
