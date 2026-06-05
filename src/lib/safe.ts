import { usd, num } from "./format";
import type { IcpDistributions, DistributionItem } from "@/types";

// Public-safe display mode. When NEXT_PUBLIC_SAFE_MODE=1 the app hides absolute
// dollars and customer counts (for a shareable public deploy) and shows only
// percentages, LTV indices, and relative bars. Default (unset) = full numbers.
export const SAFE_MODE = process.env.NEXT_PUBLIC_SAFE_MODE === "1";

export const HIDDEN = "•••";

/** Absolute USD — redacted in safe mode. */
export function money(v: number, cents = false): string {
  return SAFE_MODE ? HIDDEN : usd(v, { cents });
}

/** Absolute headcount — redacted in safe mode. */
export function headcount(v: number): string {
  return SAFE_MODE ? HIDDEN : num(v);
}

/** Comparative LTV as an index 0-100 (relative to max) — safe to show publicly. */
export function ltvIndex(v: number, max: number): number {
  return Math.round((v / Math.max(max, 1)) * 100);
}

/**
 * Sanitize a distribution for a client component in safe mode: strip raw counts
 * (set to 0; bars use `pct` instead) and replace dollar `avgLtv` with a 0-100
 * index. This guarantees no absolute figures end up in the serialized payload.
 */
export function safeDistribution<T extends DistributionItem>(items: T[]): T[] {
  const maxLtv = Math.max(...items.map((i) => i.avgLtv ?? 0), 1);
  return items.map((it) => ({
    ...it,
    count: 0,
    avgLtv: it.avgLtv != null ? ltvIndex(it.avgLtv, maxLtv) : null,
  }));
}

export function toSafeIcp(icp: IcpDistributions): IcpDistributions {
  return {
    geo: safeDistribution(icp.geo),
    seniority: safeDistribution(icp.seniority),
    industry: safeDistribution(icp.industry),
    goals: safeDistribution(icp.goals),
    contentPrefs: safeDistribution(icp.contentPrefs),
    personaMix: safeDistribution(icp.personaMix),
  };
}
