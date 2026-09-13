import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Brand } from "./ui";
import { ThemeToggle } from "./ui";

/**
 * Centered Apple-style auth shell: soft radial backdrop, brand mark,
 * glass-white card. Used by login / register / forgot / reset.
 */
export function AuthShell({
  title,
  sub,
  backTo,
  backLabel,
  footer,
  children,
}: {
  title: string;
  sub: string;
  backTo?: string;
  backLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas font-sans text-ink antialiased">
      {/* soft backdrop wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(0,122,255,0.10),transparent)]"
      />
      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-sub transition-colors hover:bg-fill hover:text-ink"
          >
            <ArrowLeft size={15} /> {backLabel ?? "Back"}
          </Link>
          )}
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[430px] px-5 pb-16 pt-6 sm:pt-10">
        <div className="animate-enter text-center">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-sub">{sub}</p>
        </div>
        <div className="animate-enter-1 mt-6 rounded-[28px] border border-line/70 bg-card p-6 shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8">
          {children}
        </div>
        {footer && (
          <div className="animate-enter-2 mt-5 text-center text-sm text-sub">{footer}</div>
        )}
      </main>
    </div>
  );
}
