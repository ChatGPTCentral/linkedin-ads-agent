import Link from "next/link";
import { AUDIENCES, AD_COPY, CREATIVE, LANDING_PAGE } from "@/data/linkedin";
import { campaignBriefToMarkdown, adCopyToMarkdown } from "@/lib/export";
import { LINKEDIN_LIMITS, type AdCopyVariant } from "@/types";
import { Card, Chip, cn } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { PrintButton } from "@/components/PrintButton";

function CharCount({ len, max, rec }: { len: number; max: number; rec?: number }) {
  const over = len > max;
  const warn = rec != null && len > rec && !over;
  return (
    <span className={cn("text-xs tabular-nums", over ? "text-red-600" : warn ? "text-amber-600" : "text-zinc-400")}>
      {len}/{max}
      {rec != null && len <= max ? ` (rec ≤${rec})` : ""}
    </span>
  );
}

function AdCopyCard({ v }: { v: AdCopyVariant }) {
  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{v.angle}</h3>
          <div className="mt-1">
            <Chip tone="indigo">{v.pairsWith}</Chip>
          </div>
        </div>
        <CopyButton text={adCopyToMarkdown(v)} label="Copy" className="no-print shrink-0" />
      </header>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Intro text</span>
            <CharCount len={v.introText.length} max={LINKEDIN_LIMITS.introMax} rec={LINKEDIN_LIMITS.introRecommended} />
          </div>
          <p className="rounded-md bg-zinc-50 p-2.5 text-sm text-zinc-800">{v.introText}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Headline</span>
            <CharCount len={v.headline.length} max={LINKEDIN_LIMITS.headlineMax} />
          </div>
          <p className="rounded-md bg-zinc-50 p-2.5 text-sm font-medium text-zinc-900">{v.headline}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">CTA</span>
          <Chip tone="green">{v.cta}</Chip>
        </div>
        <p className="border-t border-zinc-100 pt-2 text-xs text-zinc-500">{v.rationale}</p>
      </div>
    </Card>
  );
}

export default function BriefPage() {
  const fullBrief = campaignBriefToMarkdown(AUDIENCES, AD_COPY, CREATIVE, LANDING_PAGE);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Campaign Brief</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Ad copy, creative direction and a landing-page brief — generated from the{" "}
            <Link href="/icp" className="font-medium text-indigo-600 underline">
              ICP
            </Link>{" "}
            and paired to the{" "}
            <Link href="/audiences" className="font-medium text-indigo-600 underline">
              audiences
            </Link>
            . Character counts respect LinkedIn Single Image limits.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <CopyButton text={fullBrief} label="Copy full brief" />
          <PrintButton />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900">Ad copy variants</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {AD_COPY.map((v) => (
            <AdCopyCard key={v.id} v={v} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900">Creative direction</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Concepts" subtitle={CREATIVE.primaryFormat}>
            <ul className="space-y-3">
              {CREATIVE.concepts.map((c, i) => (
                <li key={i}>
                  <div className="text-sm font-medium text-zinc-900">{c.title}</div>
                  <div className="text-sm text-zinc-600">{c.visual}</div>
                  {c.overlay && <div className="mt-0.5 text-xs italic text-zinc-500">Overlay: “{c.overlay}”</div>}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">{CREATIVE.specNotes}</p>
          </Card>

          <Card title="Look & voice">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Palette</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {CREATIVE.palette.map((p) => (
                <div key={p.hex} className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded border border-zinc-200" style={{ background: p.hex }} />
                  <span className="text-xs text-zinc-600">
                    {p.name} <span className="text-zinc-400">{p.hex}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm text-zinc-700">{CREATIVE.tone}</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-green-600">Do</div>
                <ul className="mt-1 space-y-1 text-zinc-600">
                  {CREATIVE.doList.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Don&apos;t</div>
                <ul className="mt-1 space-y-1 text-zinc-600">
                  {CREATIVE.dontList.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-zinc-900">Landing-page brief</h2>
        <Card>
          <div className="rounded-lg bg-indigo-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Hero</div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">{LANDING_PAGE.hero.headline}</div>
            <div className="mt-1 text-sm text-zinc-600">{LANDING_PAGE.hero.subhead}</div>
            <div className="mt-2">
              <Chip tone="indigo">CTA: {LANDING_PAGE.hero.cta}</Chip>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Page sections</div>
              <ol className="mt-2 space-y-2 text-sm">
                {LANDING_PAGE.sections.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-zinc-900">{s.name}</span>{" "}
                    <span className="text-zinc-500">— {s.purpose}</span>
                    <div className="text-xs text-zinc-500">{s.points.join(" · ")}</div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Pricing framing</div>
                <p className="mt-1 text-zinc-600">{LANDING_PAGE.pricingFraming}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Measurement</div>
                <ul className="mt-1 space-y-1 text-zinc-600">
                  {LANDING_PAGE.measurement.map((m, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-indigo-400">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Goal</div>
                <p className="mt-1 text-zinc-600">{LANDING_PAGE.goal}</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
