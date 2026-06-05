// Small, dependency-free formatting helpers shared across the app.

export function usd(value: number, opts: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(value);
}

export function num(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

/** Format a YYYY-MM key as a short month label, e.g. "Nov '23". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${mon} '${String(y).slice(2)}`;
}

/** Suppress exact counts below a small-sample threshold. */
export function safeCount(count: number, smallSample?: boolean): string {
  if (smallSample && count < 5) return "<5";
  return num(count);
}
