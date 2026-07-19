import Link from "next/link";
import type { Metadata } from "next";
import { seed } from "@/data/seed";

export const metadata: Metadata = { title: "Settings — AI Central" };

const GROUPS: { heading: string; items: { href: string; title: string; desc: string }[] }[] = [
  {
    heading: "Connections & control",
    items: [
      { href: "/connect", title: "Connections", desc: "Connect LinkedIn & Google, run performance, create/list conversions & audiences." },
    ],
  },
  {
    heading: "Audience insights",
    items: [
      { href: "/insights", title: "Conversion Insights", desc: "Who buys — converters, LTV, growth, top markets, what converts." },
      { href: "/icp", title: "ICP Profile", desc: "Interactive explorer: geo, seniority, goals, industry, personas." },
      { href: "/audiences", title: "Audiences", desc: "Paste-ready LinkedIn audiences on verified targeting facets." },
      { href: "/brief", title: "Campaign Brief", desc: "Ad-copy variants, creative direction, landing-page brief." },
      { href: "/methodology", title: "Methodology", desc: "Sources, coverage, privacy, taxonomy references." },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Connections and the audience-insight tools that power the campaigns. The{" "}
          <Link href="/" className="font-medium text-indigo-600 underline">
            cockpit
          </Link>{" "}
          is where you run them.
        </p>
      </div>

      {GROUPS.map((g) => (
        <div key={g.heading}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.heading}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-900">{it.title}</span>
                  <span className="text-zinc-300">→</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{it.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-zinc-400">Insight data baked {seed.meta.generatedAt} · aggregated & anonymized · no customer PII stored.</p>
    </div>
  );
}
