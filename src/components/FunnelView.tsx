"use client";

// Paid-ads funnel, stage by stage — scoped to SINCE the current campaigns
// launched (earliest live-campaign start), so pre-launch li_ads traffic never
// pollutes it. Quiz stages from the quiz DB (session-attributed li_ads); ad
// impressions/clicks from LinkedIn (this browser's session, best-effort).

import { useCallback, useEffect, useState } from "react";
import { Card, Callout, cn } from "./ui";
import { num } from "@/lib/format";

const ACCOUNT = "urn:li:sponsoredAccount:510931916";
const LIVE = new Set(["ACTIVE", "PAUSED", "DRAFT"]);

type Stage = { key: string; label: string; sessions: number };
type Row = { label: string; n: number; kind: "ad" | "quiz" };
type Secondary = { referrals: number; starterKit: number; exitRescue: number };

export function FunnelView() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [secondary, setSecondary] = useState<Secondary | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Earliest live-campaign start → the funnel window; plus ad impressions/clicks.
      let sinceMs: number | null = null;
      const ad: Row[] = [];
      try {
        const cr = await fetch("/api/linkedin/campaigns", { cache: "no-store" });
        const cd = await cr.json();
        if (cd.ok && Array.isArray(cd.campaigns)) {
          const starts = cd.campaigns
            .filter((c: { status?: string }) => LIVE.has(String(c.status)))
            .map((c: { runSchedule?: { start?: number } }) => c.runSchedule?.start)
            .filter((x: unknown): x is number => typeof x === "number");
          if (starts.length) sinceMs = Math.min(...starts);

          const acct = String(cd.account ?? ACCOUNT);
          try {
            const ar = await fetch(`/api/linkedin/analytics?account=${encodeURIComponent(acct)}`, { cache: "no-store" });
            const adj = await ar.json();
            if (adj.ok && Array.isArray(adj.computed)) {
              const impr = adj.computed.reduce((s: number, c: { impressions?: number }) => s + (c.impressions ?? 0), 0);
              const clk = adj.computed.reduce((s: number, c: { clicks?: number }) => s + (c.clicks ?? 0), 0);
              if (impr > 0 || clk > 0) {
                ad.push({ label: "Ad impressions", n: impr, kind: "ad" });
                ad.push({ label: "Ad clicks", n: clk, kind: "ad" });
              }
            }
          } catch {
            /* skip ad rows */
          }
        }
      } catch {
        /* no campaigns / not connected — fall back to rolling window */
      }
      setSince(sinceMs);

      const qs = sinceMs ? `since=${sinceMs}` : "days=30";
      const fr = await fetch(`/api/quiz/funnel?${qs}`, { cache: "no-store" });
      const fd = await fr.json();
      if (!fd.ok) {
        setError(fd.skipped ?? fd.error ?? "funnel unavailable");
        setRows(null);
        return;
      }
      setSecondary(fd.secondary ?? null);
      const quizStages: Stage[] = fd.stages ?? [];
      setRows([...ad, ...quizStages.map((s) => ({ label: s.label, n: s.sessions, kind: "quiz" as const }))]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  // Biggest single-step drop (among stages with a non-zero predecessor).
  let worstIdx = -1;
  let worstStep = 101;
  if (rows) {
    rows.forEach((r, i) => {
      if (i === 0) return;
      const prev = rows[i - 1].n;
      if (prev > 0) {
        const step = (r.n / prev) * 100;
        if (step < worstStep) {
          worstStep = step;
          worstIdx = i;
        }
      }
    });
  }
  const top = rows && rows.length ? rows[0].n : 0;
  const sinceLabel = since ? new Date(since).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Funnel</h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Paid ads (li_ads) · ad → quiz → checkout · {sinceLabel ? `since campaigns launched (${sinceLabel})` : "current campaigns"}
        </p>
      </div>

      {error && (
        <Callout tone="amber" title="Funnel unavailable">
          {error.toUpperCase().includes("SUPABASE") ? "The quiz DB isn’t connected — set SUPABASE_DATABASE_URL in Vercel." : error}
        </Callout>
      )}
      {loading && !rows && <div className="py-16 text-center text-sm text-zinc-400">Loading funnel…</div>}

      {rows && (
        <Card className="!p-4 sm:!p-5">
          <div className="space-y-3">
            {rows.map((r, i) => {
              const prev = i > 0 ? rows[i - 1].n : null;
              const step = prev && prev > 0 ? (r.n / prev) * 100 : null;
              const width = top > 0 ? Math.max((r.n / top) * 100, 1.5) : 0;
              const worst = i === worstIdx;
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-zinc-700">
                      {r.kind === "ad" && <span className="mr-1 text-zinc-300">◆</span>}
                      {r.label}
                    </span>
                    <span className="tabular-nums text-zinc-900">
                      {num(r.n)}
                      {step != null && <span className="ml-2 text-xs text-zinc-400">{step.toFixed(0)}%</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-6 w-full bg-zinc-100">
                    <div
                      className={cn("h-6", worst ? "bg-rose-500" : r.kind === "ad" ? "bg-zinc-400" : "bg-indigo-600")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {worst && step != null && (
                    <div className="mt-1 text-xs font-medium text-rose-600">⚠ biggest drop — {(100 - step).toFixed(0)}% lost here</div>
                  )}
                </div>
              );
            })}
          </div>

          {secondary && (
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              <span>
                Referrals / shares: <strong className="text-zinc-700">{num(secondary.referrals)}</strong>
              </span>
              <span>
                Starter-kit clicks: <strong className="text-zinc-700">{num(secondary.starterKit)}</strong>
              </span>
              <span>
                Exit-rescue saves: <strong className="text-zinc-700">{num(secondary.exitRescue)}</strong>
              </span>
            </div>
          )}

          <p className="mt-3 text-[11px] text-zinc-400">
            Paid sessions traced by session_id from the quiz DB, since your current campaigns launched; ad impressions/clicks from
            LinkedIn (this browser’s session). % = of the previous stage.
          </p>
        </Card>
      )}
    </div>
  );
}
