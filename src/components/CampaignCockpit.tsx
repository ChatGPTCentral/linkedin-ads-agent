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
  optimizationTargetType: string | null;
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
  revenue: number;
  cpa: number | null;
  roas: number | null;
};
type RecentItem = {
  atMs: number;
  utmRef: string;
  score: number | null;
  archetype: string | null;
  goal: string | null;
  isBuyer: boolean;
  ltv: number;
  // Identity — present only for the authenticated operator (gated server-side).
  id?: string | null;
  name?: string | null;
  linkedinUrl?: string | null;
  company?: string | null;
  jobTitle?: string | null;
};

// Quiz-CRM record URL template. Defaults to the admin/people record view; the
// {id} is the submission id. Override with NEXT_PUBLIC_QUIZ_CRM_RECORD_URL if
// the route differs. Each lead in the feed links to their CRM record.
const CRM_RECORD_TMPL = process.env.NEXT_PUBLIC_QUIZ_CRM_RECORD_URL || "https://quiz.thecentral.ai/admin/submissions/{id}";
function crmRecordUrl(id?: string | null): string | null {
  return id ? CRM_RECORD_TMPL.replace("{id}", id) : null;
}

const LIVE = new Set(["ACTIVE", "PAUSED", "DRAFT"]);
const REFRESH_MS = 60_000;

function money(m: Money): string {
  return m && m.amount ? `$${m.amount}` : "—";
}
/** Human bid-strategy from the API fields: Manual CPC vs Cost cap vs Max delivery. */
function bidStrategy(c: Campaign): string {
  const amt = c.bid?.amount ? `$${c.bid.amount}` : "";
  const ot = (c.optimizationTargetType ?? "").toUpperCase();
  const maxClicks = ot.includes("MAXIMIZE_CLICK");
  if (ot.includes("CAP_COST")) return `Cost cap ${amt}${maxClicks ? " · max clicks" : ""}`.trim();
  if (c.costType === "CPC") return amt ? `Manual CPC ${amt}/click` : "Manual CPC";
  if (c.costType === "CPM" && (ot === "NONE" || ot === "" || ot.startsWith("MAX")))
    return amt ? `Max delivery · ${amt} CPM` : "Max delivery";
  return amt ? `${c.costType ?? ""} ${amt}`.trim() : c.costType ?? "—";
}
function roasLabel(r: number | null): string {
  return r != null ? `${r.toFixed(1)}×` : "—";
}
function objLabel(o: string | null): string {
  if (!o) return "—";
  if (o === "WEBSITE_VISIT") return "Website Visits · landing-page clicks";
  if (o === "WEBSITE_CONVERSION") return "Website Conversions";
  return o.replace(/_/g, " ").toLowerCase();
}
function budgetLabel(c: Campaign): string {
  return c.dailyBudget?.amount ? `${money(c.dailyBudget)}/day` : c.totalBudget?.amount ? `${money(c.totalBudget)} total` : "group budget";
}

/** The health flags that quietly wreck performance. Only warn on live campaigns. */
function issuesFor(c: Campaign): string[] {
  const out: string[] = [];
  if (c.status !== "ACTIVE") return out;
  // Only the unambiguous config killers — no noisy heuristics. Budget lives at
  // the campaign-group level (not readable here), so we don't false-flag it; and
  // delivery/bid is visible directly in each card's Clicks/Quiz numbers.
  if (c.audit.audienceNetworkOn === true) out.push("Audience Network is ON — turn it off to keep spend on LinkedIn.");
  if (c.audit.audienceExpansionOn === true) out.push("Audience Expansion is ON — turn it off to keep the ICP tight.");
  return out;
}

/** Map a campaign to its quiz utm_ref via the naming convention (Cold/Warm). */
function refForCampaign(name: string | null): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("warm")) return "warm";
  if (n.includes("cold")) return "cold";
  return null;
}

export function CampaignCockpit() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [perf, setPerf] = useState<Perf[]>([]);
  const [roasEstimated, setRoasEstimated] = useState(false);
  const [quiz, setQuiz] = useState<{ total: number; byRef?: Record<string, number>; skipped?: string } | null>(null);
  const [recent, setRecent] = useState<RecentItem[] | null>(null);
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
            setRoasEstimated(!!ad.roasEstimated);
          }
        } catch {
          /* analytics is best-effort; config still renders */
        }
      }

      // Quiz completions from the ads (cross-source — uses the app's own quiz-DB
      // credential, not the LinkedIn cookie). Powers cost-per-quiz.
      try {
        const qr = await fetch("/api/quiz/attribution?days=30", { cache: "no-store" });
        const qd = await qr.json();
        if (qd.ok) {
          const byRef: Record<string, number> = {};
          for (const r of (qd.byRef ?? []) as { utmRef: string; fills: number }[]) byRef[r.utmRef] = r.fills;
          setQuiz({ total: qd.total ?? 0, byRef });
        } else {
          setQuiz({ total: 0, skipped: qd.skipped ?? qd.error });
        }
      } catch {
        /* non-fatal */
      }

      // Recent ad-driven quiz activity (anonymized) — the conversion-diagnosis feed.
      try {
        const rr = await fetch("/api/quiz/recent?limit=12", { cache: "no-store" });
        const rd = await rr.json();
        if (rd.ok) setRecent(rd.items ?? []);
      } catch {
        /* non-fatal */
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

  const relTime = (ms: number): string => {
    if (now == null) return "";
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

  const perfFor = (urn: string | null): Perf | undefined =>
    urn ? perf.find((p) => p.campaign === urn) : undefined;

  const allIssues = campaigns.flatMap((c) => issuesFor(c).map((msg) => ({ name: c.name ?? String(c.id), msg })));

  // Time-zero at the current campaigns: sum ONLY the live campaigns' rows so the
  // pre-launch "era" (old/removed campaigns) never shows up in the top-line.
  const liveUrns = new Set(campaigns.map((c) => c.urn).filter((u): u is string => !!u));
  const scoped = perf.filter((p) => p.campaign && liveUrns.has(p.campaign));
  const agg = scoped.reduce(
    (a, p) => ({
      spend: a.spend + p.spend,
      clicks: a.clicks + p.clicks,
      conversions: a.conversions + p.conversions,
      revenue: a.revenue + (p.revenue ?? 0),
    }),
    { spend: 0, clicks: 0, conversions: 0, revenue: 0 }
  );
  const aggRoas = agg.spend > 0 ? agg.revenue / agg.spend : null;
  const hasData = scoped.length > 0;

  // Cost per quiz completion (the "partial conversion"): LinkedIn spend on these
  // campaigns ÷ ad-attributed quiz-takers from the quiz DB.
  const quizTakers = quiz && !quiz.skipped ? quiz.total : null;
  const costPerQuiz = quizTakers && quizTakers > 0 && agg.spend > 0 ? agg.spend / quizTakers : null;

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
            Live · current campaigns only · updated {agoLabel}
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
          {/* Summary — scoped to the current campaigns only */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Spend" value={hasData ? usd(agg.spend, { cents: true }) : "—"} sub="these campaigns" accent />
            <Stat label="Clicks" value={hasData ? num(agg.clicks) : "—"} sub="to the quiz" />
            <Stat label="Quiz-takers" value={quizTakers != null ? num(quizTakers) : "—"} sub="from the ads · 30d" accent />
            <Stat label="Cost / quiz" value={costPerQuiz != null ? usd(costPerQuiz, { cents: true }) : "—"} sub="partial conversion" />
          </div>
          <p className="-mt-2 text-xs text-zinc-400">
            Purchases {hasData ? num(agg.conversions) : "—"} · ROAS {hasData ? roasLabel(aggRoas) : "—"}
            {roasEstimated ? " (est.)" : ""}
            {quiz?.skipped ? " · set SUPABASE_DATABASE_URL in Vercel to light up cost-per-quiz" : ""}
          </p>

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
              const ref = refForCampaign(c.name);
              const fills = ref && quiz?.byRef ? quiz.byRef[ref] ?? 0 : null;
              const cpq = fills != null && fills > 0 && p && p.spend > 0 ? p.spend / fills : null;
              return (
                <Card key={String(c.id)} className="!p-4">
                  {/* title row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="break-words text-sm font-semibold text-zinc-900">{c.name ?? c.id}</div>
                    <Chip tone={c.status === "ACTIVE" ? "green" : c.status === "PAUSED" ? "amber" : "zinc"}>{c.status}</Chip>
                  </div>

                  {/* strategy summary — objective / bidding / budget */}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-y border-zinc-100 py-2.5 text-[13px]">
                    <dt className="text-zinc-400">Objective</dt>
                    <dd className="text-right font-medium text-zinc-700">{objLabel(c.objectiveType)}</dd>
                    <dt className="text-zinc-400">Bidding</dt>
                    <dd className="text-right font-medium text-zinc-700">{bidStrategy(c)}</dd>
                    <dt className="text-zinc-400">Budget</dt>
                    <dd className="text-right font-medium text-zinc-700">{budgetLabel(c)}</dd>
                  </dl>

                  {/* audience chips */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Chip tone={c.audit.audienceNetworkOn ? "amber" : "green"}>Network {c.audit.audienceNetworkOn ? "ON" : "off"}</Chip>
                    <Chip tone={c.audit.audienceExpansionOn ? "amber" : "green"}>Expansion {c.audit.audienceExpansionOn ? "ON" : "off"}</Chip>
                    {c.audit.targetsMatchedAudience ? <Chip tone="violet">Retargeting</Chip> : <Chip tone="indigo">Cold ICP</Chip>}
                  </div>

                  {/* per-campaign funnel: clicks → quiz, and cost per quiz */}
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-zinc-50 p-2.5 text-center">
                    <Metric label="Clicks" value={p ? num(p.clicks) : "—"} />
                    <Metric label="Quiz" value={fills != null ? num(fills) : "—"} />
                    <Metric label="Spend" value={p ? usd(p.spend, { cents: true }) : "—"} />
                    <Metric label="Cost / quiz" value={cpq != null ? usd(cpq, { cents: true }) : "—"} />
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

          {/* Recent ad-driven quiz activity — what each LinkedIn conversion maps to */}
          {recent && recent.length > 0 && (
            <Card title="Recent quiz activity" subtitle="From the ads — what each LinkedIn conversion maps to" className="!p-4">
              <div className="divide-y divide-zinc-100">
                {recent.map((it, i) => {
                  const href = crmRecordUrl(it.id) ?? it.linkedinUrl ?? null;
                  return (
                    <div key={i} className="flex items-center gap-2 py-2 text-sm">
                      <Chip tone={it.utmRef === "cold" ? "indigo" : it.utmRef === "warm" ? "violet" : "zinc"}>
                        {it.utmRef === "(none)" ? "li_ads" : it.utmRef}
                      </Chip>
                      {it.score != null && <span className="tabular-nums font-semibold text-zinc-800">{it.score}</span>}
                      <span className="min-w-0 flex-1 truncate text-zinc-600">
                        {it.name ? (
                          href ? (
                            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                              {it.name}
                            </a>
                          ) : (
                            <span className="font-medium text-zinc-800">{it.name}</span>
                          )
                        ) : (
                          it.archetype ?? it.goal ?? "completed the quiz"
                        )}
                        {it.company && <span className="text-zinc-400"> · {it.company}</span>}
                      </span>
                      {it.isBuyer && <Chip tone="green">bought ${Math.round(it.ltv)}</Chip>}
                      <span className="shrink-0 text-xs text-zinc-400">{relTime(it.atMs)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                Each completed quiz = a “Quiz Completed” conversion; a “bought” row = a purchase (CAPI) conversion. Names/LinkedIn show only to you (your logged-in session) — never on the public URL, never stored in code.
              </p>
            </Card>
          )}

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
