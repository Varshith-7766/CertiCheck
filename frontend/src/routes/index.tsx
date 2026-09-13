import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CertiCheck — Certificate Verification" },
      {
        name: "description",
        content:
          "Upload, fingerprint, and verify certificates with a fast OCR and SHA-256 workflow.",
      },
      {
        property: "og:title",
        content: "CertiCheck — Certificate Verification",
      },
      {
        property: "og:description",
        content:
          "Upload, fingerprint, and verify certificates with a fast OCR and SHA-256 workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CertiCheck,
});

function CertiCheck() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink font-body text-foreground antialiased selection:bg-accent selection:text-primary-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="CertiCheck home">
            <div className="grid size-9 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-lg leading-none text-primary-foreground">V</span>
            </div>
            <div className="leading-none">
              <div className="font-display text-xl tracking-wide">CERTICHECK</div>
              <div className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">SHA-256 · OCR</div>
            </div>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-foreground/70 md:flex">
            <a className="transition-colors hover:text-foreground" href="#pipeline">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#roles">For admins</a>
            <Link className="transition-colors hover:text-foreground" to="/login">For checkers</Link>
            <a className="transition-colors hover:text-foreground" href="#security">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <span className="hidden font-mono text-[10px] text-true sm:block">
                {user.name.toUpperCase()} · {user.role}
              </span>
            ) : null}
            {isAuthenticated ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  to={user?.role === "ADMIN" ? "/admin" : "/checker"}
                  className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-foreground/50 transition-colors hover:text-foreground"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden text-sm font-medium text-foreground/70 transition-colors hover:text-foreground sm:block"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/register"
              className="skew-x-[-12deg] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              <span className="block skew-x-[12deg]">Get access</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="grid size-9 place-items-center border border-line text-foreground md:hidden"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-line bg-ink px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-3 text-sm font-medium text-foreground/70">
              <a href="#pipeline" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <a href="#roles" onClick={() => setMobileMenuOpen(false)}>For admins</a>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>For checkers</Link>
              <a href="#security" onClick={() => setMobileMenuOpen(false)}>Security</a>
              {isAuthenticated ? (
                <>
                  <Link to={user?.role === "ADMIN" ? "/admin" : "/checker"} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                  <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="text-left text-foreground/50">Sign out</button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-10 -top-40 select-none font-display text-[17rem] leading-none text-accent/5 sm:text-[22rem]">HA</div>
          <div className="pointer-events-none absolute right-[-10%] top-10 size-[420px] rounded-full bg-accent/15 blur-[120px]" />
          <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-6 sm:pt-16">
            <div className="max-w-3xl">
              <div className="anim-rise inline-flex items-center gap-2 border border-line bg-brand/60 px-3 py-1.5 font-mono text-xs text-foreground/60">
                <span className="size-2 rounded-full bg-true blink" /> LIVE LEDGER · SHA-256 FINGERPRINTS
              </div>
              <h1 className="anim-rise-1 mt-6 font-display text-[4.25rem] leading-[0.86] text-foreground sm:text-7xl lg:text-8xl">
                REAL OR FAKE.<br />
                <span className="inline-block -skew-x-6 bg-accent px-2 text-primary-foreground">IN 3</span>{" "}
                <span className="text-foreground/30">SECONDS.</span>
              </h1>
              <p className="anim-rise-2 mt-6 max-w-xl text-lg leading-relaxed text-foreground/60">
                Administrators upload certificates; OCR reads them and SHA-256 seals only the fingerprint in the cloud. Companies drop a copy in, and we verify it fast.
              </p>
              <div className="anim-rise-3 mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="sheen skew-x-[-12deg] bg-accent px-7 py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
                >
                  <span className="block skew-x-[12deg]">
                    Verify a certificate <ArrowRight className="ml-2 inline size-4" />
                  </span>
                </Link>
                <Link
                  to="/register"
                  className="skew-x-[-12deg] border border-line px-7 py-4 text-base font-semibold text-foreground transition-colors hover:bg-brand"
                >
                  <span className="block skew-x-[12deg]">Register as Admin</span>
                </Link>
              </div>
              <div className="anim-rise-3 mt-8 flex flex-wrap items-center gap-6 sm:gap-8">
                <Stat value="0.21s" label="AVG VERIFY TIME" />
                <div className="hidden h-10 w-px bg-line sm:block" />
                <Stat value="99.99%" label="MATCH ACCURACY" />
                <div className="hidden h-10 w-px bg-line sm:block" />
                <Stat value="-96%" label="CLOUD COST" />
              </div>
            </div>

          </div>
        </section>

        {/* Marquee */}
        <div className="overflow-hidden border-y border-line bg-brand py-4">
          <div className="marquee-track flex w-max whitespace-nowrap gap-10 font-display text-2xl tracking-wide text-foreground/25">
            <MarqueeItems />
            <MarqueeItems />
          </div>
        </div>

        {/* Pipeline */}
        <section id="pipeline" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-6">
          <SectionIntro eyebrow="THE PIPELINE" title="HOW A CERTIFICATE GETS PROVEN" copy="Two roles, one immutable fingerprint. The document does not live in the cloud — only its verification hash does." />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <PipelineCard number="01" letter="A" title="Admin uploads" copy="A college admin drops the real certificate as an image, DOC, or PDF. Multiple admins can work under one institution." meta="INPUT: .JPG · .PDF · .DOC" />
            <PipelineCard number="02" letter="B" title="OCR + hash" copy="OCR extracts the text in the background, then SHA-256 compresses the certificate into one 64-character fingerprint." meta="STORE: 32 BYTES ONLY" raised />
            <PipelineCard number="03" letter="C" title="Checker verifies" copy="A company uploads a copy. We re-hash it and compare: verified, altered, or not registered." meta="OUTPUT: VERDICT" />
          </div>
        </section>

        {/* Security / Verdicts */}
        <section id="security" className="border-y border-line bg-brand/40">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
            <SectionIntro eyebrow="EVERY OUTCOME, CLEARLY" title="THREE-WAY VERDICT" copy="A clear answer for every document, with no waiting on manual calls or email chains." />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <VerdictCard color="true" label="MATCH = 100%" title="VERIFIED" copy="Hash identical to the ledger. This is the original, unaltered certificate." />
              <VerdictCard color="accent" label="NEAR-MATCH" title="TAMPERED" copy="Even one edited letter shifts the hash. Close matches flag a tampered document." />
              <VerdictCard color="warn" label="NO RECORD" title="UNREGISTERED" copy="Hash not found in the ledger. No admin has uploaded this certificate yet." />
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-6">
          <div className="max-w-3xl">
            <SectionIntro eyebrow="DUAL CONSOLES" title={<>TWO ROLES.<br />ONE SOURCE OF TRUST.</>} copy="Admins mint the fingerprints, checkers test them. Both roles have separate multi-user access." />
            <ul className="mt-7 space-y-3 text-sm text-foreground/70">
              <li className="flex items-center gap-3"><span className="size-2 -skew-x-12 bg-accent" /> Role-based access for Admin &amp; Checker</li>
              <li className="flex items-center gap-3"><span className="size-2 -skew-x-12 bg-accent" /> Multiple users per institution</li>
              <li className="flex items-center gap-3"><span className="size-2 -skew-x-12 bg-accent" /> Background OCR — never blocks the UI</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="skew-x-[-12deg] bg-accent px-7 py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                <span className="block skew-x-[12deg]">Get started <ArrowRight className="ml-2 inline size-4" /></span>
              </Link>
              <Link
                to="/login"
                className="skew-x-[-12deg] border border-line px-7 py-4 text-base font-semibold text-foreground transition-colors hover:bg-brand"
              >
                <span className="block skew-x-[12deg]">Sign in</span>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-line">
          <div className="absolute inset-0 bg-accent" />
          <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-16 sm:px-6 md:flex-row md:items-center">
            <h2 className="font-display text-5xl leading-[0.9] text-primary-foreground md:text-6xl">STOP GUESSING.<br />START PROVING.</h2>
            <Link
              to="/register"
              className="sheen skew-x-[-12deg] bg-ink px-9 py-5 text-lg font-semibold text-foreground"
            >
              <span className="block skew-x-[12deg]">
                Launch CertiCheck <ArrowRight className="ml-2 inline size-5" />
              </span>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ink">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-10 sm:px-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="grid size-8 -skew-x-12 place-items-center bg-accent">
              <span className="skew-x-12 font-display text-primary-foreground">V</span>
            </div>
            <span className="font-display text-lg">CERTICHECK</span>
          </div>
          <div className="font-mono text-xs text-foreground/40">© 2026 CertiCheck · Hashed, not stored.</div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl text-foreground">{value}</div>
      <div className="font-mono text-xs tracking-wide text-foreground/40">{label}</div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: ReactNode;
  copy: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="font-mono text-xs tracking-[0.3em] text-accent">{eyebrow}</div>
      <h2 className="mt-3 font-display text-5xl leading-none text-foreground">{title}</h2>
      <p className="mt-4 leading-relaxed text-foreground/50">{copy}</p>
    </div>
  );
}

function PipelineCard({
  number,
  letter,
  title,
  copy,
  meta,
  raised,
}: {
  number: string;
  letter: string;
  title: string;
  copy: string;
  meta: string;
  raised?: boolean;
}) {
  return (
    <div className={`border border-line bg-brand/50 p-7 ${raised ? "md:-mt-6" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-accent">{number}</span>
        <span className="font-display text-5xl text-foreground/10">{letter}</span>
      </div>
      <h3 className="mt-6 font-display text-2xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-foreground/55">{copy}</p>
      <div className="mt-5 font-mono text-xs text-foreground/40">{meta}</div>
    </div>
  );
}

function VerdictCard({
  color,
  label,
  title,
  copy,
}: {
  color: "true" | "accent" | "warn";
  label: string;
  title: string;
  copy: string;
}) {
  const colorClass =
    color === "true"
      ? "border-true/40 bg-true/5 text-true"
      : color === "accent"
      ? "border-accent/40 bg-accent/5 text-accent"
      : "border-warn/40 bg-warn/5 text-warn";
  return (
    <div className={`border p-7 ${colorClass}`}>
      <div className="flex items-center gap-3">
        <span className="size-3 rounded-full bg-current blink" />
        <span className="font-mono text-sm tracking-widest">{label}</span>
      </div>
      <div className="mt-5 font-display text-4xl leading-none">{title}</div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/55">{copy}</p>
    </div>
  );
}

function MarqueeItems() {
  return (
    <>
      <span>BLOCKCHAIN LEDGER</span>
      <span className="text-accent">///</span>
      <span>OCR EXTRACTED</span>
      <span className="text-accent">///</span>
      <span>ZERO STORAGE BLOAT</span>
      <span className="text-accent">///</span>
      <span>TAMPER-PROOF</span>
      <span className="text-accent">///</span>
    </>
  );
}
