import Link from "next/link";
import { seed } from "@/data/seed";
import { Card, Chip, CoverageBar, SectionTitle } from "@/components/ui";
import { IcpExplorer } from "@/components/IcpExplorer";
import { SAFE_MODE, toSafeIcp } from "@/lib/safe";
import type { PersonaCard } from "@/types";

function PersonaCardView({ p }: { p: PersonaCard }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{p.emoji}</span>
        <h3 className="text-base font-semibold text-zinc-900">{p.name}</h3>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{p.blurb}</p>

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Why (from the data)</div>
        <ul className="mt-1 space-y-1 text-sm text-zinc-600">
          {p.evidence.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Motivations</div>
          <ul className="mt-1 space-y-1 text-zinc-600">
            {p.motivations.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Objections</div>
          <ul className="mt-1 space-y-1 text-zinc-600">
            {p.objections.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-100 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">LinkedIn mapping</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.linkedin.seniorities.map((s) => (
            <Chip key={s} tone="indigo">
              {s}
            </Chip>
          ))}
          {p.linkedin.functions.map((s) => (
            <Chip key={s} tone="violet">
              {s}
            </Chip>
          ))}
          {p.linkedin.skills.map((s) => (
            <Chip key={s} tone="zinc">
              {s}
            </Chip>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function IcpPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">ICP Profile</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Who converts, in the dimensions that matter for LinkedIn targeting. Switch dimensions, sort by volume or lifetime value,
          and filter geographies. Everything here drives the{" "}
          <Link href="/audiences" className="font-medium text-indigo-600 underline">
            audience designs
          </Link>
          .
        </p>
      </div>

      <Card title="Data coverage (be honest)" subtitle="What's reliable vs. directional in the enrichment pipeline">
        <div className="space-y-2.5">
          {seed.meta.coverage.map((row) => (
            <div key={row.dimension} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-sm">
              <span className="text-zinc-700">{row.dimension}</span>
              <CoverageBar pct={row.coveragePct} strength={row.strength} />
              <span className="text-right text-xs capitalize text-zinc-400">{SAFE_MODE ? row.strength : row.basis}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">{seed.meta.enrichmentCaveat}</p>
      </Card>

      <Card title="Explore the ICP" subtitle="Converters only · % shares within each dimension">
        <IcpExplorer icp={SAFE_MODE ? toSafeIcp(seed.icp) : seed.icp} safe={SAFE_MODE} />
      </Card>

      <div>
        <SectionTitle sub="Three personas synthesized from the segments above — each with its LinkedIn facet mapping.">
          Personas
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          {seed.personas.map((p) => (
            <PersonaCardView key={p.id} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
