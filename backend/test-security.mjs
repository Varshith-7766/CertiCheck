import { generateSync } from "otplib";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "http://localhost:3001/api";
const cookieJar = new Map();

function jarKey(origin) {
  if (!cookieJar.has(origin)) cookieJar.set(origin, new Map());
  return cookieJar.get(origin);
}

async function req(path, opts = {}) {
  const method = opts.method || "GET";
  const origin = opts.origin || "http://localhost:3000";
  // opts.jar — named cookie jar (defaults to the origin string) so tests can
  // hold multiple simultaneous sessions for the same account (e.g. a second
  // device used by the F2 session-revocation check).
  const jarName = opts.jar || origin;
  const cookies = jarKey(jarName);

  const headers = {};
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, opts.headers || {});
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers["Origin"] = origin;
  }

  const cookieHeader = [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body:
      opts.body instanceof FormData
        ? opts.body
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
  });

  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const pair = sc.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }

  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, setCookies, headers: res.headers };
}

const uid = Date.now().toString(36);
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? " — " + extra : ""}`); }
};

// ---------------------------------------------------------------------------
console.log("\n1. ADMIN GATE");
// ---------------------------------------------------------------------------
let r = await req("/auth/register", {
  method: "POST",
  body: { email: `admin-nocode-${uid}@t.com`, password: "SecurePass#2026", name: "NoCode", role: "ADMIN", institution: "Test University" },
});
check("admin register without invite code → 403", r.status === 403, `got ${r.status}`);

r = await req("/auth/register", {
  method: "POST",
  body: { email: `admin-badcode-${uid}@t.com`, password: "SecurePass#2026", name: "BadCode", role: "ADMIN", inviteCode: "wrong-code", institution: "Test University" },
});
check("admin register with wrong invite code → 403", r.status === 403, `got ${r.status}`);

r = await req("/auth/register", {
  method: "POST",
  body: { email: `admin-noinst-${uid}@t.com`, password: "SecurePass#2026", name: "NoInst", role: "ADMIN", inviteCode: "cc-admin-2026" },
});
check("admin register without institution → 400", r.status === 400, `got ${r.status} ${JSON.stringify(r.data)}`);

r = await req("/auth/register", {
  method: "POST",
  body: { email: `admin-ok-${uid}@t.com`, password: "SecurePass#2026", name: "OkAdmin", role: "ADMIN", inviteCode: "cc-admin-2026", institution: "Test University" },
});
check("admin register with correct invite code → 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
check("admin register sets httpOnly cookie", r.setCookies.some((s) => s.toLowerCase().includes("httponly")));
check("admin register flags totpSetupRequired", r.data?.totpSetupRequired === true);
check("admin user carries totpRequired=true", r.data?.user?.totpRequired === true);

r = await req("/certificates");
check("unverified+unenrolled admin blocked → 403 EMAIL_NOT_VERIFIED", r.status === 403 && r.data?.error === "EMAIL_NOT_VERIFIED", `got ${r.status} ${JSON.stringify(r.data)}`);

// Verify the admin's email via the dev-mailer link in backend.log.
const fsv = await import("fs");
const logV = fsv.readFileSync("C:/Users/Varshith/AppData/Local/Temp/backend.log", "utf8");
const verifyMatch = logV.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
check("admin verification email logged by dev mailer", !!verifyMatch, "no verify token in log");
if (verifyMatch) {
  r = await req("/auth/verify-email", { method: "POST", body: { token: verifyMatch[1] } });
  check("admin verify email → 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await req("/certificates");
  check("verified admin still needs TOTP → 403 TOTP_SETUP_REQUIRED", r.status === 403 && r.data?.error === "TOTP_SETUP_REQUIRED", `got ${r.status} ${JSON.stringify(r.data)}`);
}

r = await req("/auth/2fa/setup", { method: "POST" });
check("F1: 2fa setup without password → 400", r.status === 400, `got ${r.status} ${JSON.stringify(r.data)}`);

r = await req("/auth/2fa/setup", { method: "POST", body: { password: "WrongPass#2026" } });
check("F1: 2fa setup wrong password → 403", r.status === 403 && r.data?.error === "Incorrect password", `got ${r.status} ${JSON.stringify(r.data)}`);

r = await req("/auth/2fa/setup", { method: "POST", body: { password: "SecurePass#2026" } });
check("admin 2fa setup (password re-auth) → secret", r.status === 200 && r.data?.secret, `got ${r.status}`);
if (r.data?.secret) {
  const aCode = generateSync({ secret: r.data.secret });
  r = await req("/auth/2fa/enable", { method: "POST", body: { code: aCode, password: "WrongPass#2026" } });
  check("F1: 2fa enable wrong password → 403", r.status === 403 && r.data?.error === "Incorrect password", `got ${r.status} ${JSON.stringify(r.data)}`);
  r = await req("/auth/2fa/enable", { method: "POST", body: { code: aCode, password: "SecurePass#2026" } });
  check("admin 2fa enable → 8 recovery codes", r.status === 200 && r.data?.recoveryCodes?.length === 8, `got ${r.status}`);
  r = await req("/auth/2fa/setup", { method: "POST", body: { password: "SecurePass#2026" } });
  check("F1: 2fa setup blocked while already enabled → 400", r.status === 400 && String(r.data?.error || "").includes("already enabled"), `got ${r.status} ${JSON.stringify(r.data)}`);
  r = await req("/certificates");
  check("verified + enrolled admin console unlocked → 200", r.status === 200, `got ${r.status}`);
}

// ---------------------------------------------------------------------------
console.log("\n2. PASSWORD POLICY");
// ---------------------------------------------------------------------------
r = await req("/auth/register", {
  method: "POST",
  body: { email: `weak-${uid}@t.com`, password: "short", name: "Weak", role: "CHECKER" },
});
check("weak password rejected → 400", r.status === 400, `got ${r.status}`);

r = await req("/auth/register", {
  method: "POST",
  body: { email: `strong-${uid}@t.com`, password: "alllowercase1", name: "NoUpper", role: "CHECKER" },
});
check("missing uppercase rejected → 400", r.status === 400, `got ${r.status}`);

// HIBP — informational (may fail open offline)
r = await req("/auth/register", {
  method: "POST",
  body: { email: `hibp-${uid}@t.com`, password: "Password123", name: "Hibp", role: "CHECKER" },
});
console.log(`      HIBP breached check on "Password123": ${r.status} ${JSON.stringify(r.data)}  (400 = blocked, 201 = fail-open offline)`);

// ---------------------------------------------------------------------------
console.log("\n3. CHECKER ACCOUNT + COOKIE SESSION");
// ---------------------------------------------------------------------------
const checkerEmail = `checker-${uid}@t.com`;
r = await req("/auth/register", {
  method: "POST",
  body: { email: checkerEmail, password: "SecurePass#2026", name: "Checker One", role: "CHECKER" },
});
check("checker register (no invite) → 201", r.status === 201, `got ${r.status}`);
check("checker register → totpSetupRequired=true", r.data?.totpSetupRequired === true, `got ${r.data?.totpSetupRequired}`);
check("checker register → user.totpRequired=true", r.data?.user?.totpRequired === true, `got ${r.data?.user?.totpRequired}`);

// F8 — registering an existing address must return the same 201 shape
// (no user, no session) instead of a 409 that leaks the account existence.
r = await req("/auth/register", {
  method: "POST",
  body: { email: checkerEmail, password: "SecurePass#2026", name: "Dup", role: "CHECKER" },
});
check("F8: re-register existing email → 201, no user", r.status === 201 && !r.data?.user && r.data?.emailVerificationSent === true, `got ${r.status} ${JSON.stringify(r.data)}`);
check("F8: re-register existing email → no session cookie", r.setCookies.length === 0, `got ${r.setCookies.length} cookies`);

// F2 fixture — a second device session created BEFORE 2FA enrollment.
r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "SecurePass#2026" }, jar: "pre2fa" });
check("second-device login before enroll → 200", r.status === 200 && !r.data?.requires2fa, `got ${r.status}`);
r = await req("/auth/me", { jar: "pre2fa" });
check("pre-enroll session alive on second device", r.status === 200, `got ${r.status}`);

r = await req("/auth/me");
check("me() works with httpOnly cookie", r.status === 200, `got ${r.status}`);
check("me() returns role=CHECKER", r.data?.user?.role === "CHECKER", `got ${r.data?.user?.role}`);
check("me() returns emailVerified", r.data?.user?.emailVerified !== undefined);

r = await req("/auth/logout", { method: "POST" });
jarKey("http://localhost:3000").clear();
check("logout then me() → 401", (await req("/auth/me")).status === 401);

r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "WrongPass#2026" } });
check("wrong password → 401 generic", r.status === 401 && r.data?.error === "Invalid email or password");
r = await req("/auth/login", { method: "POST", body: { email: `ghost-${uid}@t.com`, password: "WrongPass#2026" } });
check("unknown email → identical 401 message", r.status === 401 && r.data?.error === "Invalid email or password");

// ---------------------------------------------------------------------------
console.log("\n4. ROLE ENFORCEMENT");
// ---------------------------------------------------------------------------
r = await req("/certificates/upload", { method: "POST", body: new FormData() });
check("upload without session → 401", r.status === 401, `got ${r.status}`);

r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "SecurePass#2026" } });
check("checker login → 200 (no OTP until enrolled)", r.status === 200 && !r.data?.requires2fa);

r = await req("/certificates", {});
check("checker hitting admin list → 403", r.status === 403);
r = await req("/verify/history", {});
check("unverified checker history → 403 EMAIL_NOT_VERIFIED", r.status === 403 && r.data?.error === "EMAIL_NOT_VERIFIED", `got ${r.status} ${JSON.stringify(r.data)}`);

// Verify the checker's email via the dev-mailer link in backend.log.
const fsc = await import("fs");
const logC = fsc.readFileSync("C:/Users/Varshith/AppData/Local/Temp/backend.log", "utf8");
const verifyAll = logC.match(/verify-email\?token=([A-Za-z0-9_-]+)/g) || [];
const checkerVerify = verifyAll.length ? verifyAll[verifyAll.length - 1].split("token=")[1] : null;
check("checker verification email logged by dev mailer", !!checkerVerify, "no verify token in log");
if (checkerVerify) {
  r = await req("/auth/verify-email", { method: "POST", body: { token: checkerVerify } });
  check("checker verify email → 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await req("/verify/history", {});
  check("verified checker still needs TOTP → 403 TOTP_SETUP_REQUIRED", r.status === 403 && r.data?.error === "TOTP_SETUP_REQUIRED", `got ${r.status} ${JSON.stringify(r.data)}`);
}

// Enroll 2FA now so the console unlocks (email + TOTP both done).
r = await req("/auth/2fa/setup", { method: "POST", body: { password: "SecurePass#2026" } });
check("checker 2fa setup (password re-auth) → secret", r.status === 200 && r.data?.secret, `got ${r.status}`);
const secret = r.data?.secret;

const code = generateSync({ secret });
r = await req("/auth/2fa/enable", { method: "POST", body: { code, password: "SecurePass#2026" } });
check("checker 2fa enable → 8 recovery codes", r.status === 200 && r.data?.recoveryCodes?.length === 8, `got ${r.status}`);
const recoveryCodes = r.data?.recoveryCodes || [];

// F2 — enabling 2FA must kill every pre-enrollment session (except current).
r = await req("/auth/me", { jar: "pre2fa" });
check("F2: pre-enrollment session revoked on enable → 401", r.status === 401, `got ${r.status}`);
r = await req("/auth/me");
check("enrolling session survives enable", r.status === 200, `got ${r.status}`);

// F4 — the TOTP secret must be encrypted at rest (AES-256-GCM envelope),
// never stored as the plaintext secret the setup endpoint returned.
const dbUser = await prisma.user.findUnique({ where: { email: checkerEmail } });
check("F4: totpSecret encrypted at rest (v1: prefix)", String(dbUser?.totpSecret || "").startsWith("v1:"), `got ${String(dbUser?.totpSecret).slice(0, 12)}`);
check("F4: stored ciphertext != plaintext secret", !!secret && dbUser?.totpSecret !== secret);

r = await req("/verify/history", {});
check("verified + enrolled checker history → 200", r.status === 200, `got ${r.status}`);

// ---------------------------------------------------------------------------
console.log("\n5. TWO-FACTOR AUTHENTICATION");
// ---------------------------------------------------------------------------
await req("/auth/logout", { method: "POST" });
jarKey("http://localhost:3000").clear();
r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "SecurePass#2026" } });
check("login after 2FA → requires2fa", r.status === 200 && r.data?.requires2fa === true);

r = await req("/auth/me");
check("me() blocked while 2FA pending → 401", r.status === 401, `got ${r.status}`);

r = await req("/auth/2fa/verify", { method: "POST", body: { code: "000000" } });
check("wrong TOTP → 401", r.status === 401);

const code2 = generateSync({ secret });
r = await req("/auth/2fa/verify", { method: "POST", body: { code: code2 } });
check("correct TOTP → user returned", r.status === 200 && r.data?.user?.email === checkerEmail, `got ${r.status}`);
check("me() works after 2FA confirmed", (await req("/auth/me")).status === 200);

// Recovery code path
await req("/auth/logout", { method: "POST" });
jarKey("http://localhost:3000").clear();
r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "SecurePass#2026" } });
check("login again → requires2fa", r.status === 200 && r.data?.requires2fa === true);
r = await req("/auth/2fa/verify", { method: "POST", body: { code: recoveryCodes[0] } });
check("recovery code works → 200", r.status === 200, `got ${r.status}`);

// ---------------------------------------------------------------------------
console.log("\n6. SESSIONS (revocable)");
// ---------------------------------------------------------------------------
r = await req("/auth/sessions");
check("session list → 200, ≥1 session", r.status === 200 && (r.data?.sessions?.length || 0) >= 1, `got ${r.status} count=${r.data?.sessions?.length}`);
const before = r.data?.sessions?.length || 0;
check("session list marks current device", r.data?.sessions?.some((s) => s.current));

r = await req("/auth/sessions", { method: "DELETE" });
check("revoke-all → 200", r.status === 200);
check("current session survives revoke-all", (await req("/auth/me")).status === 200);
const after = await req("/auth/sessions");
check("revoke-all pruned other sessions", (after.data?.sessions?.length || 0) === 1, `count=${after.data?.sessions?.length}`);

// ---------------------------------------------------------------------------
console.log("\n7. FORGOT + RESET");
// ---------------------------------------------------------------------------
r = await req("/auth/forgot", { method: "POST", body: { email: checkerEmail } });
check("forgot → generic 200", r.status === 200 && String(r.data?.message || "").includes("If that email exists"));
r = await req("/auth/forgot", { method: "POST", body: { email: `ghost2-${uid}@t.com` } });
check("forgot unknown email → same generic message", r.status === 200 && String(r.data?.message || "").includes("If that email exists"));

const fs = await import("fs");
const log = fs.readFileSync("C:/Users/Varshith/AppData/Local/Temp/backend.log", "utf8");
const resetMatch = log.match(/reset\?token=([A-Za-z0-9_-]+)/);
check("reset link logged by dev mailer", !!resetMatch, "no reset token in log");

if (resetMatch) {
  const token = resetMatch[1];
  r = await req("/auth/reset", { method: "POST", body: { token, password: "NewStrongPass#2026" } });
  check("reset → 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);

  r = await req("/auth/me");
  check("session revoked after password reset → 401", r.status === 401, `got ${r.status}`);

  r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "SecurePass#2026" } });
  check("old password rejected after reset", r.status === 401);

  r = await req("/auth/login", { method: "POST", body: { email: checkerEmail, password: "NewStrongPass#2026" } });
  check("new password works → requires2fa", r.status === 200 && r.data?.requires2fa === true, `got ${r.status}`);
}

// F10 — the /reset endpoint must be rate-limited (11th+ request in the hour
// from the same IP gets 429) so reset-token brute force is impractical.
let lastReset = null;
for (let i = 0; i < 12; i++) {
  lastReset = await req("/auth/reset", { method: "POST", body: { token: `faketoken-${i}-${uid}`, password: "StrongPass#2026" } });
}
check("F10: reset endpoint rate-limited → 429", lastReset.status === 429, `got ${lastReset.status}`);

// ---------------------------------------------------------------------------
console.log("\n8. RATE LIMITING (login)");
// ---------------------------------------------------------------------------
const limiterEmail = `ratelimit-${uid}@t.com`;
await req("/auth/register", { method: "POST", body: { email: limiterEmail, password: "SecurePass#2026", name: "Rate", role: "CHECKER" } });
let last = null;
for (let i = 0; i < 120; i++) {
  last = await req("/auth/login", { method: "POST", body: { email: limiterEmail, password: "WrongPass#2026" } });
}
check("120th failed login → 429 rate-limited", last.status === 429, `got ${last.status}`);

// ---------------------------------------------------------------------------
console.log("\n9. SECURITY HEADERS + ORIGIN CHECK");
// ---------------------------------------------------------------------------
r = await req("/api/health");
check("nosniff header present", String(r.headers.get("x-content-type-options") || "").includes("nosniff"));

r = await req("/auth/login", { method: "POST", body: { email: limiterEmail, password: "WrongPass#2026" }, origin: "http://evil.example.com" });
check("cross-origin POST blocked → 403", r.status === 403, `got ${r.status} ${JSON.stringify(r.data)}`);

// F11 — malformed JSON body must be a client error (400), not a 500.
{
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
    body: '{"email": "b@t.com", "password": "invalid-json', // unclosed brace
  });
  check("F11: malformed JSON body → 400 (not 500)", res.status === 400, `got ${res.status}`);
}

// ---------------------------------------------------------------------------
console.log("\n10. TOTP LIMITER (2fa setup/enable)");
// ---------------------------------------------------------------------------
// F1 — the 2FA enrollment endpoints share the TOTP limiter; after 5 attempts
// the setup endpoint itself should start returning 429.
let lastTotp = null;
for (let i = 0; i < 7; i++) {
  lastTotp = await req("/auth/2fa/setup", { method: "POST", body: { password: "SecurePass#2026" } });
}
check("F1: 2fa setup rate-limited after burst → 429", lastTotp.status === 429, `got ${lastTotp.status}`);

// ---------------------------------------------------------------------------
console.log(`\n==============================`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log(`==============================`);
process.exit(fail > 0 ? 1 : 0);