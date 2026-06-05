import type { ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-zinc-200 bg-white p-5 shadow-sm", className)}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", accent ? "text-indigo-600" : "text-zinc-900")}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{children}</h2>
      {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
    </div>
  );
}

export function Chip({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "indigo" | "green" | "amber" | "violet" }) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Callout({ children, tone = "amber", title }: { children: ReactNode; tone?: "amber" | "indigo" | "green"; title?: string }) {
  const tones: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    green: "border-green-200 bg-green-50 text-green-900",
  };
  return (
    <div className={cn("rounded-lg border p-3 text-sm", tones[tone])}>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      {children}
    </div>
  );
}

export type BarItem = { label: string; value: number; right?: string; sub?: string; muted?: boolean };

export function BarList({ items, accent = "bg-indigo-500" }: { items: BarItem[]; accent?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm text-zinc-700">{it.label}</div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100">
              <div
                className={cn("h-2 rounded-full", it.muted ? "bg-zinc-300" : accent)}
                style={{ width: `${Math.max((it.value / max) * 100, 2)}%` }}
              />
            </div>
          </div>
          <div className="text-right text-sm tabular-nums text-zinc-900">
            {it.right ?? it.value}
            {it.sub && <div className="text-xs font-normal text-zinc-400">{it.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StackedBar({ segments }: { segments: { label: string; value: number; color: string; hint?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div key={i} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", s.color)} />
            <span>{s.label}</span>
            <span className="font-medium text-zinc-900">{Math.round((s.value / total) * 100)}%</span>
            {s.hint && <span className="text-zinc-400">{s.hint}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lightweight SVG bar chart (no dependencies). */
export function TimelineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const slot = 100 / n;
  const barW = slot * 0.62;
  const labelEvery = Math.ceil(n / 6);
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="New customers per month">
        {data.map((d, i) => {
          const h = (d.value / max) * 38;
          return (
            <rect
              key={i}
              x={i * slot + (slot - barW) / 2}
              y={40 - h}
              width={barW}
              height={h}
              rx={0.4}
              className="fill-indigo-500"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        {data.map((d, i) => (i % labelEvery === 0 ? <span key={i}>{d.label}</span> : null))}
      </div>
    </div>
  );
}

export function CoverageBar({ pct, strength }: { pct: number; strength: "strong" | "moderate" | "thin" }) {
  const color = strength === "strong" ? "bg-green-500" : strength === "moderate" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">{pct}%</span>
    </div>
  );
}
