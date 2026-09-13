import {
  motion,
  useReducedMotion,
  useSpring,
  useInView,
  useMotionValue,
  animate,
} from "motion/react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/**
 * Shared Apple-style motion kit: soft expo reveals, masked headline staggers,
 * count-ups, mouse tilt, infinite tickers and progress rings.
 * Every loop honors prefers-reduced-motion.
 */

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* --------------------------------- Reveal --------------------------------- */

export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ Word stagger ------------------------------ */

export function Words({
  text,
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text} role="text">
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden pb-[0.1em] -mb-[0.1em] align-bottom"
        >
          <motion.span
            aria-hidden
            className="inline-block will-change-transform"
            initial={{ y: "112%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.75, delay: delay + i * stagger, ease: EASE }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

/* --------------------------------- Counter --------------------------------- */

export function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.7,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------- Mouse tilt ------------------------------- */

export function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 20 });
  const sry = useSpring(ry, { stiffness: 180, damping: 20 });
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1100 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------------- Ticker ---------------------------------- */

export function Ticker({
  children,
  duration = 30,
  className = "",
}: {
  children: ReactNode;
  /** seconds per full loop */
  duration?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const wrap = wrapRef.current;
    if (!track || !wrap) return;

    let raf = 0;
    let x = 0;
    let last = performance.now();
    let half = track.scrollWidth / 2;
    let running = true;

    const measure = () => {
      half = track.scrollWidth / 2;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    const syncRunning = () => {
      running = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", syncRunning);

    const io = new IntersectionObserver(
      ([entry]) => {
        running = !!entry?.isIntersecting && !document.hidden;
        last = performance.now();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (running && half > 0 && duration > 0) {
        x -= (half / (duration * 1000)) * dt;
        if (-x >= half) x += half;
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", syncRunning);
    };
  }, [duration]);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className}`}>
      <div ref={trackRef} className="flex w-max will-change-transform">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Progress ring ------------------------------ */

export function Ring({
  value,
  size = 120,
  stroke = 10,
  tone = "#007aff",
  track = "#e5e5ea",
  duration = 1.1,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: string;
  track?: string;
  duration?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: target }}
        viewport={{ once: true }}
        transition={{ duration, ease: EASE }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* ------------------------------ Scroll state ------------------------------ */

export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
