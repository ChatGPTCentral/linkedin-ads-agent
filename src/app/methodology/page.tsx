import { seed } from "@/data/seed";
import { Card, Chip, CoverageBar, StackedBar } from "@/components/ui";
import { num, usd } from "@/lib/format";

const SOURCES = [
  ["Stripe", "Payments & lifetime value, joined into the pipeline per customer."],
  ["Apollo", "Firmographic enrichment (title, seniority, industry) — partial, cached in the pipeline."],
  ["beehiiv", "Newsletter status / attribution signal."],
  ["Quiz / survey", "Self-reported goals, job level, content preferences."],
] as const;

const TAXONOMY_SOURCES = [
  ["LinkedIn Help — Targeting options", "Job functions, seniorities, company size, skills, interests."],
  ["LinkedIn Help — Audience size best practices", "300-member minimum; ~50k recommended for Sponsored Content."],
  ["LinkedIn Help — Single image ad specs", "Intro ≤150 rec / 255 max; headline ≤70; image 1200×627."],
  ["Microsoft Learn — Seniorities & Industry Codes V2", "Canonical seniority list and industry taxonomy."],
] as const;

export default function MethodologyPage() {
  const funnelSegments = seed.conversions.bySource.map((s, i) => ({
    label: s.label,
    value: s.rows,
    color: ["bg-indigo-500", "bg-violet-400", "bg-zinc-300"][i] ?? "bg-zinc-300",
    hint: `${num(s.converters)} buyers`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Methodology</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          How this app was built, what the numbers mean, and how we protect customer privacy.
        </p>
      </div>

      <Card title="Data source & approach">
        <p className="text-sm text-zinc-600">
          The ICP is built by reusing the output of AI Central&apos;s existing CRM enrichment pipeline (the{" "}
          <span className="font-medium text-zinc-800">ai-central-quiz</span> project), read directly from its Supabase{" "}
          <span className="font-mono text-xs">submissions</span> table. We ran read-only <span className="font-mono text-xs">GROUP BY</span>{" "}
          aggregates only — <strong>no Apollo credits were spent</strong> and no row-level records were exported.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {SOURCES.map(([name, desc]) => (
            <div key={name} className="rounded-lg border border-zinc-200 p-3">
              <div className="text-sm font-semibold text-zinc-900">{name}</div>
              <div className="text-xs text-zinc-500">{desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="The funnel" subtitle={`${num(seed.meta.totalRecords)} enriched records → ${num(seed.meta.converters)} converters · ${usd(seed.meta.totalLtv)} tracked LTV`}>
        <StackedBar segments={funnelSegments} />
      </Card>

      <Card title="Coverage & reliability">
        <div className="space-y-2.5">
          {seed.meta.coverage.map((row) => (
            <div key={row.dimension} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
              <span className="text-zinc-700">{row.dimension}</span>
              <CoverageBar pct={row.coveragePct} strength={row.strength} />
              <span className="text-right text-xs text-zinc-400">{row.basis}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">{seed.meta.enrichmentCaveat}</p>
      </Card>

      <Card title="Privacy">
        <ul className="space-y-1.5 text-sm text-zinc-600">
          {seed.meta.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>{n}</span>
            </li>
          ))}
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>This repository contains only aggregates (counts, percentages, averages) — never names, emails, or IP addresses.</span>
          </li>
        </ul>
      </Card>

      <Card title="LinkedIn taxonomy sources">
        <ul className="space-y-2 text-sm">
          {TAXONOMY_SOURCES.map(([name, desc]) => (
            <li key={name}>
              <span className="font-medium text-zinc-900">{name}</span>
              <div className="text-xs text-zinc-500">{desc}</div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="indigo">Apollo seniority → LinkedIn seniority</Chip>
          <Chip tone="violet">Apollo function → nearest LinkedIn function</Chip>
          <Chip tone="zinc">Self-reported goal → member skills / interests</Chip>
          <Chip tone="green">Country → LinkedIn locations</Chip>
        </div>
      </Card>
    </div>
  );
}
