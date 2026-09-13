import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, Info, CheckCircle2, Sun, Moon } from "lucide-react";
import { useScrolled } from "./motion";
import { useTheme } from "../lib/theme";

/* ---------------------------------- Brand ---------------------------------- */

export function Brand({ sub }: { sub?: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="CertiCheck home">
      <img src="/logo.png" alt="CertiCheck logo" className="size-9 rounded-xl object-cover dark:invert" />
      <span className="leading-none">
        <span className="block text-[17px] font-semibold tracking-tight text-ink">CertiCheck</span>
        {sub && (
          <span className="mt-0.5 block text-[10px] font-medium tracking-[0.14em] text-sub">{sub}</span>
        )}
      </span>
    </Link>
  );
}

/* ------------------------------- Theme toggle ------------------------------- */

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid size-9 cursor-pointer place-items-center rounded-full text-sub transition-colors hover:bg-fill hover:text-ink ${className}`}
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

/* -------------------------------- Site nav --------------------------------- */

export function SiteNav({ children }: { children?: ReactNode }) {
  const scrolled = useScrolled(12);
  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled
          ? "border-line bg-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:bg-black/70"
          : "border-line/50 bg-white/60 dark:bg-black/40"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Brand sub="TRUST PROTOCOL" />
        <div className="flex items-center gap-2 sm:gap-3">{children}</div>
      </div>
    </header>
  );
}

export function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-3.5 py-2 text-sm font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
    >
      {children}
    </Link>
  );
}

/* --------------------------------- Buttons --------------------------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export function PrimaryButton({ children, className = "", ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`${btnBase} bg-accent px-5 py-2.5 text-white shadow-[0_4px_14px_rgba(0,122,255,0.35)] hover:bg-accent-deep ${className}`}
    >
      {children}
    </button>
  );
}

export function BigPrimaryButton({ children, className = "", ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`${btnBase} w-full bg-accent px-5 py-3.5 text-[15px] text-white shadow-[0_6px_20px_rgba(0,122,255,0.35)] hover:bg-accent-deep ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`${btnBase} bg-fill px-5 py-2.5 text-accent hover:bg-line ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- Fields ---------------------------------- */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  id: string;
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none transition-all placeholder:text-faint hover:border-sub/40 focus:border-accent focus:shadow-[0_0_0_4px_rgba(0,122,255,0.15)]";

export function TextField({ label, hint, id, className = "", ...rest }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <input id={id} {...rest} className={`${inputClass} ${className}`} />
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-sub">{hint}</span>}
    </label>
  );
}

export function PasswordField({
  label,
  hint,
  id,
  className = "",
  show: controlledShow,
  onToggle,
  ...rest
}: FieldProps & { show?: boolean; onToggle?: () => void }) {
  const [internal, setInternal] = useState(false);
  const show = controlledShow ?? internal;
  const toggle = onToggle ?? (() => setInternal(!internal));
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="relative mt-1.5">
        <input
          id={id}
          {...rest}
          type={show ? "text" : "password"}
          className={`${inputClass} mt-0 pr-11 ${className}`}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-faint transition-colors hover:text-sub"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-sub">{hint}</span>}
    </label>
  );
}

/* ------------------------------ Segmented role ------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; title: string; sub: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Account role"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-fill p-1.5"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={`cursor-pointer rounded-xl px-4 py-3 text-left transition-all duration-200 ${
              active
                ? "bg-card text-ink shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
                : "text-sub hover:text-ink"
            }`}
          >
            <span className={`block text-[15px] font-semibold ${active ? "text-accent" : ""}`}>
              {opt.title}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-sub">{opt.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Banners --------------------------------- */

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "info" | "success";
  children: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-bad/25 bg-bad/[0.07] text-bad-deep"
      : tone === "success"
        ? "border-good/30 bg-good/[0.09] text-good-deep"
        : "border-accent/25 bg-accent/[0.07] text-accent-deep";
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${styles}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* --------------------------------- Surfaces --------------------------------- */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-line/70 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-[0.12em] text-accent">{eyebrow}</div>
      <h1 className="mt-1.5 text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {sub && <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-sub">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/60 px-6 py-12 text-center dark:bg-white/[0.03]">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-fill text-faint">{icon}</div>
      <div className="mt-3 text-[15px] font-semibold text-ink">{title}</div>
      <div className="mt-1 text-[13px] text-sub">{sub}</div>
    </div>
  );
}

export function Spinner({ className = "size-5 text-white" }: { className?: string }) {
  return <span className={`spinner ${className}`} aria-label="Loading" />;
}
