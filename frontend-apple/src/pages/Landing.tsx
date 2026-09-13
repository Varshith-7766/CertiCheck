import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  Menu,
  X,
  ScanLine,
  Fingerprint,
  Check,
  ShieldCheck,
  Zap,
  Lock,
  Upload,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Brand } from "../components/ui";
import { ThemeToggle } from "../components/ui";
import { Reveal, Words, Counter, Tilt, Ticker, EASE } from "../components/motion";

export default function Landing() {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroGlowY = useTransform(heroProgress, [0, 1], [0, 130]);
  const heroFade = useTransform(heroProgress, [0, 0.75], [1, 0]);
  const heroMockY = useTransform(heroProgress, [0, 1], [0, 70]);

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/70 backdrop-blur-xl dark:bg-black/60">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Brand sub="TRUST PROTOCOL" />
          <nav className="hidden items-center gap-1 text-sm font-medium text-sub md:flex">
            <a href="#how" className="rounded-full px-3.5 py-2 transition-colors hover:bg-fill hover:text-ink">
              How it works
            </a>
            <a href="#verdicts" className="rounded-full px-3.5 py-2 transition-colors hover:bg-fill hover:text-ink">
              Verdicts
            </a>
            <a href="#roles" className="rounded-full px-3.5 py-2 transition-colors hover:bg-fill hover:text-ink">
              Roles
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link
                  to={user.role === "ADMIN" ? "/admin" : "/checker"}
                  className="rounded-full bg-coal px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
                >
                  Open console
                </Link>
                <button
                  onClick={() => void logout()}
                  className="hidden cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-sub transition-colors hover:text-ink sm:block"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-full px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 sm:block"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(0,122,255,0.35)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
                >
                  Get started
                </Link>
              </>
            )}
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Menu"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-sub transition-colors hover:bg-fill md:hidden"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden border-t border-line/70 md:hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-3 text-[15px] font-medium">
                <a href="#how" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sub hover:bg-fill">How it works</a>
                <a href="#verdicts" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sub hover:bg-fill">Verdicts</a>
                <a href="#roles" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sub hover:bg-fill">Roles</a>
                {!isAuthenticated && (
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-accent">
                    Sign in
                  </Link>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero */}
        <section ref={heroRef} className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(55%_100%_at_50%_0%,rgba(0,122,255,0.10),transparent)]"
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-24 right-[8%] size-[380px] rounded-full bg-accent/[0.12] blur-[110px]"
            {...(reduce ? {} : { style: { y: heroGlowY } })}
          />
          <motion.div
            className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]"
            {...(reduce ? {} : { style: { opacity: heroFade } })}
          >
            <div>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-medium text-sub shadow-sm"
              >
                <span className="live-dot size-2 rounded-full bg-good" />
                Live ledger · SHA-256 fingerprints
              </motion.div>
              <h1 className="mt-5 text-5xl font-bold leading-[1.03] tracking-tight text-ink sm:text-6xl">
                <Words text="Real or fake." />
                <br />
                <span className="bg-gradient-to-r from-accent to-[#34c759] bg-clip-text text-transparent">
                  <Words text="Proven in seconds." delay={0.22} />
                </span>
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.45, ease: EASE }}
                className="mt-5 max-w-lg text-[17px] leading-relaxed text-sub"
              >
                Administrators seal certificates as tamper-evident fingerprints on-chain.
                Checkers drop in any copy and get a verdict — verified, tampered, or
                unregistered.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.58, ease: EASE }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(0,122,255,0.35)]"
                  >
                    Verify a certificate <ArrowRight size={17} />
                  </Link>
                </motion.span>
                <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-full bg-fill px-6 py-3.5 text-[15px] font-semibold text-accent transition-colors hover:bg-line"
                  >
                    Register as admin
                  </Link>
                </motion.span>
              </motion.div>
              <motion.dl
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.8 }}
                className="mt-10 flex flex-wrap gap-8"
              >
                {[
                  { v: 0.21, d: 2, s: "s", l: "Average verify time" },
                  { v: 100, d: 0, s: "%", l: "Hash match accuracy" },
                  { v: 32, d: 0, s: " B", l: "Stored per certificate" },
                ].map((s) => (
                  <div key={s.l}>
                    <dt className="sr-only">{s.l}</dt>
                    <dd className="text-[26px] font-bold tracking-tight text-ink">
                      <Counter to={s.v} decimals={s.d} suffix={s.s} />
                    </dd>
                    <dd className="mt-0.5 text-xs font-medium tracking-wide text-sub">{s.l}</dd>
                  </div>
                ))}
              </motion.dl>
            </div>

            {/* Tilting product mock */}
            <motion.div
              initial={{ opacity: 0, y: 36, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
              {...(reduce ? {} : { style: { y: heroMockY } })}
            >
              <Tilt max={6}>
                <div className="rounded-[28px] border border-line/70 bg-card p-5 shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="size-3 rounded-full bg-[#ff5f57]" />
                      <span className="size-3 rounded-full bg-[#febc2e]" />
                      <span className="size-3 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-good-deep">
                      <span className="live-dot size-1.5 rounded-full bg-good" /> LIVE
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-faint">
                    CHECK CONSOLE · TODAY
                  </div>
                  <div className="relative mt-2 space-y-2 overflow-hidden rounded-2xl">
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-transparent via-accent/15 to-transparent"
                      animate={{ top: ["-15%", "108%"] }}
                      transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
                    />
                    <MockRow
                      delay={0.75}
                      tone="good"
                      icon={<Check size={15} />}
                      title="VERIFIED · 100%"
                      sub="Jna…281.pdf · block #11,693,890"
                    />
                    <MockRow
                      delay={0.9}
                      tone="bad"
                      icon={<ShieldCheck size={15} />}
                      title="TAMPERED · 82%"
                      sub="cop…904.pdf · hash mismatch"
                    />
                    <MockRow
                      delay={1.05}
                      tone="warn"
                      icon={<Fingerprint size={15} />}
                      title="UNREGISTERED · 12%"
                      sub="new…117.pdf · no record"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-fill px-4 py-3 font-mono text-[11px] text-sub">
                    <span className="truncate">
                      a3f9…c41d → <span className="font-semibold text-good-deep">ANCHORED</span>
                    </span>
                    <span className="ml-3 shrink-0">sepolia</span>
                  </div>
                </div>
              </Tilt>
            </motion.div>
          </motion.div>
        </section>

        {/* Ticker */}
        <Ticker duration={30} className="border-y border-line/70 bg-white/60 py-3.5 font-mono text-xs tracking-[0.28em] text-faint dark:bg-white/[0.03]">
          <TickerItems />
        </Ticker>

        {/* Sticky how-it-works */}
        <HowItWorks />

        {/* Verdicts */}
        <section id="verdicts" className="border-y border-line/70 bg-white/60 dark:bg-white/[0.03]">
          <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
            <Reveal>
              <div className="text-xs font-semibold tracking-[0.14em] text-accent">EVERY OUTCOME, CLEARLY</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Three-way verdict</h2>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Reveal delay={0}>
                <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="h-full rounded-3xl border border-line/70 bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                  <Verdict tone="good" label="MATCH = 100%" title="Verified" copy="Hash identical to the ledger and anchored on-chain. The original certificate." />
                </motion.div>
              </Reveal>
              <Reveal delay={0.1}>
                <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="h-full rounded-3xl border border-line/70 bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                  <Verdict tone="bad" label="NEAR-MATCH" title="Tampered" copy="Even one edited letter shifts the hash. Close matches flag alteration." />
                </motion.div>
              </Reveal>
              <Reveal delay={0.2}>
                <motion.div whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="h-full rounded-3xl border border-line/70 bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                  <Verdict tone="warn" label="NO RECORD" title="Unregistered" copy="No admin has ever uploaded this certificate to the ledger." />
                </motion.div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Roles + CTA */}
        <section id="roles" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20">
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <Reveal>
              <div className="flex h-full flex-col rounded-3xl border border-line/70 bg-card p-8 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
                <Zap size={24} className="text-accent" />
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink">For admins</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-sub">
                  Own your institution&apos;s ledger. Upload once, anchor forever, watch verifications roll in.
                </p>
                <Link to="/register" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-coal px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]">
                  Get started <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-3xl bg-coal p-8 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                <Lock size={24} className="text-white/80" />
                <h3 className="mt-4 text-2xl font-bold tracking-tight">For checkers</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-white/70">
                  Hiring? Drop in the certificate and know in seconds whether to trust it.
                </p>
                <Link to="/login" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]">
                  Sign in to verify <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.05}>
            <div className="relative mt-4 overflow-hidden rounded-[28px] bg-coal px-8 py-12 text-center text-white sm:py-16">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_100%_at_50%_100%,rgba(0,122,255,0.28),transparent)]"
              />
              <h2 className="relative text-3xl font-bold tracking-tight sm:text-5xl">
                Stop guessing.
                <br />
                Start proving.
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-[15px] text-white/70">
                Create an account, upload your first certificate, and watch the ledger do the rest.
              </p>
              <Link
                to="/register"
                className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-black transition-transform hover:scale-[1.04] active:scale-[0.98]"
              >
                Launch CertiCheck <ArrowRight size={17} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[10px] bg-accent text-white">
              <ShieldCheck size={16} strokeWidth={2.25} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink">CertiCheck</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] font-medium text-sub">
            <a href="#how" className="transition-colors hover:text-ink">How it works</a>
            <Link to="/login" className="transition-colors hover:text-ink">Sign in</Link>
            <Link to="/register" className="transition-colors hover:text-ink">Register</Link>
          </div>
          <span className="text-[13px] text-faint">© 2026 CertiCheck · Hashed, not stored.</span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------- pieces -------------------------------- */

function Verdict({
  tone,
  label,
  title,
  copy,
}: {
  tone: "good" | "bad" | "warn";
  label: string;
  title: string;
  copy: string;
}) {
  const dot = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-warn";
  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className={`size-2.5 rounded-full ${dot}`} />
        <span className="font-mono text-xs font-semibold tracking-[0.12em] text-sub">{label}</span>
      </div>
      <div className="mt-3 text-[26px] font-bold tracking-tight text-ink">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-sub">{copy}</p>
    </>
  );
}

function MockRow({
  delay,
  tone,
  icon,
  title,
  sub,
}: {
  delay: number;
  tone: "good" | "bad" | "warn";
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  const styles =
    tone === "good"
      ? "bg-good/[0.08] text-good-deep"
      : tone === "bad"
        ? "bg-bad/[0.07] text-bad-deep"
        : "bg-warn/[0.12] text-[#9a6700] dark:text-warn";
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.55, ease: EASE }}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${styles}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-xs font-bold tracking-wide">{title}</span>
        <span className="block truncate font-mono text-[11px] opacity-80">{sub}</span>
      </span>
    </motion.div>
  );
}

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Admin uploads",
    copy: "A college admin drops in the real certificate — image, PDF or DOC. It is OCR-read on the spot.",
    visual: "admin",
  },
  {
    n: "02",
    icon: ScanLine,
    title: "Sealed in seconds",
    copy: "SHA-256 compresses it to one 64-character fingerprint, anchored on Sepolia. The file itself is deleted.",
    visual: "seal",
  },
  {
    n: "03",
    icon: Zap,
    title: "Anyone verifies",
    copy: "A company uploads any copy. We re-hash and compare — verified, tampered, or never registered.",
    visual: "verdict",
  },
];

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start center", "end center"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  if (reduce) {
    return (
      <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="text-xs font-semibold tracking-[0.14em] text-accent">HOW IT WORKS</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Three steps to trust</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-line/70 bg-card p-6">
              <div className="font-mono text-sm font-bold text-accent">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-sub">{s.copy}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const step = STEPS[active]!;
  const Icon = step.icon;

  return (
    <section id="how" className="scroll-mt-20">
      <div ref={ref} className="relative" style={{ height: "280vh" }}>
        <div className="sticky top-0 flex min-h-screen items-center overflow-hidden">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-2">
            <div>
              <div className="text-xs font-semibold tracking-[0.14em] text-accent">HOW IT WORKS</div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Three steps to trust
              </h2>
              <div className="mt-8 space-y-2">
                {STEPS.map((s, i) => {
                  const SIcon = s.icon;
                  const on = i === active;
                  const done = i < active;
                  return (
                    <button
                      key={s.n}
                      onClick={() => {
                        const el = ref.current;
                        if (!el) return;
                        const top = el.getBoundingClientRect().top + window.scrollY;
                        const h = el.offsetHeight - window.innerHeight;
                        window.scrollTo({ top: top + (h * (i + 0.5)) / STEPS.length, behavior: "smooth" });
                      }}
                      className={`flex w-full cursor-pointer items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-300 ${
                        on
                          ? "border-line bg-card shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
                          : "border-transparent opacity-45 hover:opacity-80"
                      }`}
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-2xl transition-colors duration-300 ${
                          on ? "bg-accent text-white" : done ? "bg-good/15 text-good-deep" : "bg-fill text-faint"
                        }`}
                      >
                        <SIcon size={19} />
                      </span>
                      <span>
                        <span className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em] text-faint">
                          STEP {s.n}
                        </span>
                        <span className="mt-0.5 block text-[17px] font-semibold tracking-tight text-ink">
                          {s.title}
                        </span>
                        <AnimatePresence initial={false}>
                          {on && (
                            <motion.span
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.35, ease: EASE }}
                              className="block overflow-hidden text-sm leading-relaxed text-sub"
                            >
                              <span className="block pt-1.5">{s.copy}</span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative hidden lg:block">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 26, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.98 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rounded-[28px] border border-line/70 bg-card p-8 shadow-[0_24px_70px_rgba(0,0,0,0.10)]"
                >
                  <StepVisual visual={step.visual} />
                  <div className="mt-5 flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-accent/10 text-accent">
                      <Icon size={21} />
                    </span>
                    <div>
                      <div className="font-mono text-[11px] font-bold tracking-[0.14em] text-faint">
                        STEP {step.n}
                      </div>
                      <div className="text-lg font-bold tracking-tight text-ink">{step.title}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-sub">{step.copy}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepVisual({ visual }: { visual: string }) {
  if (visual === "admin") {
    return (
      <div className="rounded-2xl bg-fill p-5">
        <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
          <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent">
            <ScanLine size={19} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">Degree_Certificate.pdf</div>
            <div className="font-mono text-[11px] text-sub">PDF · 2 pages · click to upload</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
          <motion.div
            className="h-full w-2/3 rounded-full bg-accent"
            animate={{ x: ["-110%", "320%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "32%" }}
          />
        </div>
      </div>
    );
  }
  if (visual === "seal") {
    return (
      <div className="rounded-2xl bg-coal p-5 text-white">
        <div className="font-mono text-[11px] tracking-[0.14em] text-white/50">SHA-256 FINGERPRINT</div>
        <div className="mt-2 break-all font-mono text-[13px] leading-relaxed text-white">
          a3f9<span className="text-accent">…</span>c41d
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-good">
          <span className="live-dot size-1.5 rounded-full bg-good" /> ANCHORED · SEPOLIA #11,693,890
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {[
        { t: "VERIFIED · 100%", c: "bg-good/[0.10] text-good-deep" },
        { t: "TAMPERED · 82%", c: "bg-bad/[0.08] text-bad-deep" },
        { t: "UNREGISTERED · 12%", c: "bg-warn/[0.14] text-[#9a6700] dark:text-warn" },
      ].map((r) => (
        <div key={r.t} className={`rounded-2xl px-4 py-3 font-mono text-xs font-bold tracking-wide ${r.c}`}>
          {r.t}
        </div>
      ))}
    </div>
  );
}

function TickerItems() {
  const items = ["SHA-256 SEALED", "OCR LIVE", "SEPOLIA ANCHORED", "ZERO STORAGE BLOAT", "TAMPER-EVIDENT"];
  return (
    <>
      {items.map((item) => (
        <span key={item} className="mx-7 flex items-center whitespace-nowrap">
          {item}
          <span className="ml-14 text-accent/50">◆</span>
        </span>
      ))}
    </>
  );
}
