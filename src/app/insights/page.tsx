import Link from "next/link";
import type { Metadata } from "next";
import { seed } from "@/data/seed";
import { usd, num, monthLabel } from "@/lib/format";
import { SAFE_MODE } from "@/lib/safe";
import { Stat, Card, BarList, TimelineChart, Callout, type BarItem } from "@/components/ui";

export const metadata: Metadata = { title: "Conversion Insights — AI Central" };

export default function InsightsPage() {
  const c = seed.conversions;
  const convRatePct = Math.round((c.converters / c.totalRecords) * 100);

  const timeline = c.timeline.map((t) => ({ label: monthLabel(t.ym), value: t.newCustomers }));

  const topMarkets: BarItem[] = seed.icp.geo.slice(0, 8).map((g) => ({
    label: g.label,
    value: g.count,
    right: `${g.pct}%`,
    sub: SAFE_MODE ? undefined : `${usd(g.avgLtv ?? 0)} avg LTV`,
  }));

  const goals: BarItem[] = [...seed.icp.goals]
    .sort((a, b) => (b.convRate ?? 0) - (a.convRate ?? 0))
    .map((g) => ({
      label: g.label,
      value: g.convRate ?? 0,
      right: `${g.convRate ?? 0}%`,
      sub: SAFE_MODE ? `${g.pct}% of goals` : `${g.count} ppl · ${g.avgLtv != null ? `${usd(g.avgLtv)} LTV` : "—"}`,
      muted: g.smallSample,
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Conversion Insights</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Who actually buys <span className="font-medium text-zinc-700">The Ultimate AI Library</span> — the foundation for every
          LinkedIn audience and ad in this app.{" "}
          {SAFE_MODE ? "Built from the AI Central CRM enrichment pipeline." : `Built from ${num(seed.meta.totalRecords)} enriched records via the AI Central CRM pipeline.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SAFE_MODE ? (
          <>
            <Stat label="Conversion rate" value={`${convRatePct}%`} sub="of enriched records buy" accent />
            <Stat label="Markets" value={`${seed.icp.geo.length}+`} sub="countries with buyers" />
            <Stat label="Top market" value="US" sub="53% of converters" />
            <Stat label="Best-converting goal" value="13%" sub="Develop AI workflows" />
          </>
        ) : (
          <>
            <Stat label="Converters" value={num(c.converters)} sub={`of ${num(c.totalRecords)} enriched records`} accent />
            <Stat label="Tracked LTV" value={usd(c.totalLtv)} sub="lifetime value, all converters" />
            <Stat label="Avg LTV" value={usd(c.avgLtv, { cents: true })} sub={`median ${usd(c.medianLtv, { cents: true })}`} />
            <Stat label="Top 10% LTV" value={usd(c.p90Ltv, { cents: true })} sub={`max ${usd(c.maxLtv, { cents: true })}`} />
          </>
        )}
      </div>

      <Callout tone="amber" title="The economics that shape this campaign">
        {SAFE_MODE
          ? "Average order value is low"
          : `Average LTV is ${usd(c.avgLtv, { cents: true })}`}{" "}
        — a low-ticket product on a high-CPM platform. Keep CPA below LTV by leaning LinkedIn spend toward the{" "}
        <strong>yearly &amp; lifetime offers</strong> and the highest-value markets, and excluding the lowest-LTV regions. The{" "}
        <Link href="/audiences" className="font-medium text-amber-900 underline">
          audience designs
        </Link>{" "}
        do exactly that.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="New customers over time" subtitle="Relative monthly converters, Nov 2023 – Jun 2026" className="lg:col-span-2">
          <TimelineChart data={timeline} />
          <p className="mt-3 text-xs text-zinc-500">
            {SAFE_MODE
              ? "Steady growth with a late-2025 peak. Recent months are still settling as charges import."
              : "Steady growth with a late-2025 peak (Nov 2025: 140 new customers). Recent months are still settling as charges import."}
          </p>
        </Card>

        <Card
          title="Top markets"
          subtitle="Share of converters"
          right={
            <Link href="/icp" className="text-xs font-medium text-indigo-600">
              Explore →
            </Link>
          }
        >
          <BarList items={topMarkets} />
        </Card>
      </div>

      <Card title="What buyers want — and what converts" subtitle="Self-reported goal, ranked by conversion rate">
        <BarList items={goals} accent="bg-violet-500" />
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          “Develop AI products/workflows” and “Train my team on AI” convert best; “Prompt engineering” drives the highest LTV. These
          become the{" "}
          <Link href="/brief" className="font-medium text-indigo-600 underline">
            ad angles
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
