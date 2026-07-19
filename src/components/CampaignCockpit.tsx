"use client";

// Live campaign cockpit — the operator's home screen. Client-side (the LinkedIn
// token is a per-browser cookie, so reads must originate here), it polls the
// auditor (/api/linkedin/campaigns) + analytics (/api/linkedin/analytics),
// surfaces the settings that silently hurt performance, shows live spend/ROAS,
// and lets you pause/resume with one tap. Mobile-first for on-the-go checks.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, Stat, Chip, Callout, cn } from "./ui";
import { usd, num } from "@/lib/format";

type Money = { amount?: string; currencyCode?: string } | null;
type Audit = {
  audienceNetworkOn: boolean | null;
  audienceExpansionOn: boolean | null;
  targetsMatchedAudience: boolean;
};
type Campaign = {
  id: number | string;
  urn: string | null;
  name: string | null;
  status: string | null;
  objectiveType: string | null;
  costType: string | null;
  bid: Money;
  dailyBudget: Money;
  totalBudget: Money;
  campaignGroup: string | null;
  audit: Audit;
};
type Perf = {
  campaign: string | null;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  cpa: number | null;
  roas: number | null;
};
type Totals = { spend: number; conversions: number; revenue: number; cpa: number | null; roas: number | null };

const LIVE = new Set(["ACTIVE", "PAUSED", "DRAFT"]);
const REFRESH_MS = 60_000;

function money(m: Money): string {
  return m && m.amount ? `$${m.amount}` : "—";
}
function bidLabel(c: Campaign): string {
  if (!c.bid?.amount) return "—";
  const t = c.costType ? ` ${c.costType}` : "";
  return `$${c.bid.amount}${t}`;
}
function roasLabel(r: number | null): string {
  return r != null ? `${r.toFixed(1)}×` : "—";
}
function objLabel(o: string | null): string {
  if (!o) return "—";
  return o.replace("WEBSITE_", "").replace(/_/g, " ").toLowerCase();
}

/** The health flags that quietly wreck performance. Only warn on live campaigns. */
function issuesFor(c: Campaign): string[] {
  const out: string[] = [];
  if (c.status !== "ACTIVE") return out;
  if (!c.dailyBudget?.amount && !c.totalBudget?.amount)
    out.push("No budget on the campaign — confirm the group carries one, or it won't spend.");
  if (c.audit.audienceNetworkOn === true) out.push("Audience Network is ON — turn it off to keep spend on LinkedIn.");
  if (c.audit.audienceExpansionOn === true) out.push("Audience Expansion is ON — turn it off to keep the ICP tight.");
  if (c.costType === "CPC" && c.bid?.amount && parseFloat(c.bid.amount) < 2)
    out.push(`Manual CPC $${c.bid.amount} may be below the clearing price — watch impressions; raise if starved.`);
  return out;
}

export function CampaignCockpit() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [perf, setPerf] = useState<Perf[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [roasEstimated, setRoasEstimated] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const cr = await fetch("/api/linkedin/campaigns", { cache: "no-store" });
      const cd = await cr.json();
      if (cd.error || !cd.ok) {
        setConnected(false);
        setError(cd.error ? String(cd.error) : "could not load campaigns");
        return;
      }
      setConnected(true);
      setError(null);
      const live: Campaign[] = (cd.campaigns ?? []).filter((c: Campaign) => LIVE.has(String(c.status)));
      // Active first, then paused/draft; stable otherwise.
      live.sort((a, b) => (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1));
      setCampaigns(live);

      const acct = String(cd.account ?? "");
      if (acct) {
        try {
          const ar = await fetch(`/api/linkedin/analytics?account=${encodeURIComponent(acct)}`, { cache: "no-store" });
          const ad = await ar.json();
          if (ad.ok) {
            setPerf(ad.computed ?? []);
            setTotals(ad.totals ?? null);
            setRoasEstimated(!!ad.roasEstimated);
          }
        } catch {
          /* analytics is best-effort; config still renders */
        }
      }
      const t = Date.now();
      setUpdated(t);
      setNow(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  // Initial fetch — deferred a tick so the effect body itself doesn't setState.
  useEffect(() => {
    const id = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [auto, load]);

  // "updated Xs ago" ticker (setState only from the interval callback)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const ago =
    updated != null && now != null ? Math.max(0, Math.round((now - updated) / 1000)) : null;
  const agoLabel = ago == null ? "—" : ago < 5 ? "just now" : ago < 90 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`;

  const perfFor = (urn: string | null): Perf | undefined =>
    urn ? perf.find((p) => p.campaign === urn) : undefined;

  const allIssues = campaigns.flatMap((c) => issuesFor(c).map((msg) => ({ name: c.name ?? String(c.id), msg })));

  async function changeStatus(c: Campaign, status: "PAUSED" | "ACTIVE") {
    const verb = status === "PAUSED" ? "Pause" : "Resume";
    if (typeof window !== "undefined" && !window.confirm(`${verb} “${c.name ?? c.id}”?`)) return;
    setBusy(String(c.id));
    try {
      await fetch("/api/linkedin/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ type: "campaign", id: c.id, status }] }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Campaign Cockpit</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Live from LinkedIn · updated {agoLabel}
            {refreshing && <span className="ml-1 text-indigo-500">· refreshing…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-3.5 w-3.5 accent-indigo-600" />
            Auto
          </label>
          <button
            onClick={() => load()}
            disabled={refreshing}
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3.5 text-sm font-medium text-white active:scale-95 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Not connected */}
      {connected === false && (
        <Callout tone="amber" title="Not connected on this device">
          {error === "not_connected"
            ? "Your LinkedIn session isn't on this browser/host. "
            : `Couldn't load LinkedIn (${error}). `}
          Go to{" "}
          <Link href="/settings" className="font-medium underline">
            Settings → Connections
          </Link>{" "}
          and connect, then reload.
        </Callout>
      )}

      {loading && connected == null && <div className="py-16 text-center text-sm text-zinc-400">Loading live campaigns…</div>}

      {connected && (
        <>
          {/* Account summary (30d) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Spend · 30d" value={totals ? usd(totals.spend, { cents: true }) : "—"} accent />
            <Stat label="Conversions" value={totals ? num(totals.conversions) : "—"} sub="30-day, on-platform" />
            <Stat label="CPA" value={totals?.cpa != null ? usd(totals.cpa, { cents: true }) : "—"} />
            <Stat label="ROAS" value={roasLabel(totals?.roas ?? null)} sub={roasEstimated ? "est. (avg LTV)" : "actual value"} />
          </div>

          {/* Needs attention */}
          {allIssues.length > 0 && (
            <Callout tone="amber" title={`${allIssues.length} thing${allIssues.length > 1 ? "s" : ""} to check`}>
              <ul className="mt-1 space-y-1.5">
                {allIssues.map((it, i) => (
                  <li key={i} className="text-[13px] leading-snug">
                    <span className="font-medium">{it.name}:</span> {it.msg}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          {/* Live campaigns */}
          <div className="space-y-4">
            {campaigns.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400">
                No live campaigns. Create one from{" "}
                <Link href="/settings" className="underline">
                  Settings → Connections
                </Link>
                .
              </div>
            )}
            {campaigns.map((c) => {
              const p = perfFor(c.urn);
              const issues = issuesFor(c);
              return (
                <Card key={String(c.id)} className="!p-4">
                  {/* title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-semibold text-zinc-900">{c.name ?? c.id}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">{objLabel(c.objectiveType)}</div>
                    </div>
                    <Chip tone={c.status === "ACTIVE" ? "green" : c.status === "PAUSED" ? "amber" : "zinc"}>{c.status}</Chip>
                  </div>

                  {/* config chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{bidLabel(c)}</Chip>
                    <Chip tone={!c.dailyBudget?.amount && !c.totalBudget?.amount && c.status === "ACTIVE" ? "amber" : "zinc"}>
                      {c.dailyBudget?.amount ? `${money(c.dailyBudget)}/day` : c.totalBudget?.amount ? `${money(c.totalBudget)} total` : "no budget"}
                    </Chip>
                    <Chip tone={c.audit.audienceNetworkOn ? "amber" : "green"}>Network {c.audit.audienceNetworkOn ? "ON" : "off"}</Chip>
                    <Chip tone={c.audit.audienceExpansionOn ? "amber" : "green"}>Expansion {c.audit.audienceExpansionOn ? "ON" : "off"}</Chip>
                    {c.audit.targetsMatchedAudience && <Chip tone="violet">Retargeting</Chip>}
                  </div>

                  {/* perf mini-grid */}
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-zinc-50 p-2.5 text-center">
                    <Metric label="Impr" value={p ? num(p.impressions) : "—"} />
                    <Metric label="Clicks" value={p ? num(p.clicks) : "—"} />
                    <Metric label="Spend" value={p ? usd(p.spend, { cents: true }) : "—"} />
                    <Metric label="CPA" value={p?.cpa != null ? usd(p.cpa, { cents: true }) : "—"} />
                  </div>

                  {/* inline issues */}
                  {issues.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {issues.map((m, i) => (
                        <li key={i} className="flex gap-1.5 text-xs leading-snug text-amber-700">
                          <span aria-hidden>⚠</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* actions */}
                  <div className="mt-3 flex gap-2">
                    {c.status === "ACTIVE" ? (
                      <button
                        onClick={() => changeStatus(c, "PAUSED")}
                        disabled={busy === String(c.id)}
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy === String(c.id) ? "…" : "Pause"}
                      </button>
                    ) : (
                      <button
                        onClick={() => changeStatus(c, "ACTIVE")}
                        disabled={busy === String(c.id)}
                        className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-green-600 text-sm font-medium text-white active:scale-[0.98] disabled:opacity-50"
                      >
                        {busy === String(c.id) ? "…" : "Resume"}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="pt-1 text-center text-[11px] text-zinc-400">
            Config is live from LinkedIn; performance is last-30-day and can lag a few hours. Conversions attach + creatives are managed in Campaign Manager.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums text-zinc-900")}>{value}</div>
    </div>
  );
}
