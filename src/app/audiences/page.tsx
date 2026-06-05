import Link from "next/link";
import { AUDIENCES, JOB_SENIORITIES, JOB_FUNCTIONS, COMPANY_SIZES } from "@/data/linkedin";
import { audienceToMarkdown } from "@/lib/export";
import { Card, Chip, Callout } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import type { LinkedInAudience } from "@/types";

type Tone = "zinc" | "indigo" | "green" | "amber" | "violet";

function FacetRow({ label, values, tone = "zinc" }: { label: string; values?: string[]; tone?: Tone }) {
  if (!values?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
      <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Chip key={v} tone={tone}>
            {v}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function AudienceCardView({ a }: { a: LinkedInAudience }) {
  return (
    <Card>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{a.name}</h3>
          <p className="mt-1 text-sm text-zinc-600">{a.intent}</p>
        </div>
        <CopyButton text={audienceToMarkdown(a)} label="Copy spec" className="no-print shrink-0" />
      </header>

      <div className="space-y-2.5">
        <FacetRow label="Locations" values={a.locations} tone="green" />
        <FacetRow label="Exclude" values={a.excludeLocations} tone="amber" />
        <FacetRow label="Job seniorities" values={a.facets.jobSeniorities} tone="indigo" />
        <FacetRow label="Job functions" values={a.facets.jobFunctions} tone="violet" />
        <FacetRow label="Job titles" values={a.facets.jobTitles} tone="indigo" />
        <FacetRow label="Member skills" values={a.facets.memberSkills} tone="zinc" />
        <FacetRow label="Industries" values={a.facets.industries} tone="zinc" />
        <FacetRow label="Company sizes" values={a.facets.companySizes} tone="zinc" />
        <FacetRow label="Member interests" values={a.facets.memberInterests} tone="zinc" />
        <FacetRow label="Audience expansion" values={[a.audienceExpansion ? "On" : "Off"]} tone="zinc" />
      </div>

      <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Budget</div>
          <p className="mt-1 text-zinc-600">{a.budgetGuidance}</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Estimated size</div>
          <p className="mt-1 text-zinc-600">{a.estimatedSizeNote}</p>
        </div>
      </div>

      {a.warnings.length > 0 && (
        <div className="mt-3">
          <Callout tone="amber" title="Watch-outs">
            <ul className="space-y-1">
              {a.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      <div className="mt-3 text-xs text-zinc-400">
        <span className="font-semibold uppercase tracking-wide">Derived from:</span> {a.derivedFrom.join(" · ")}
      </div>
    </Card>
  );
}

export default function AudiencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">LinkedIn Audience Design</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Three audiences mapped to real LinkedIn Campaign Manager facets, derived from the{" "}
          <Link href="/icp" className="font-medium text-indigo-600 underline">
            ICP analysis
          </Link>
          . Copy any spec straight into Campaign Manager.
        </p>
      </div>

      <Callout tone="indigo" title="Read this before you launch">
        The Ultimate AI Library is a low-ticket (~$47 LTV) product on a high-CPM, B2B platform. To keep CPA under control: start with
        the Core audience, point the High-LTV audience at the lifetime/yearly offer, exclude the lowest-LTV regions (India, Brazil),
        and remember LinkedIn needs ~300 members minimum and recommends ~50k for Sponsored Content. No LinkedIn Ads API is connected,
        so these are paste-ready specs, not an automated push.
      </Callout>

      <div className="space-y-4">
        {AUDIENCES.map((a) => (
          <AudienceCardView key={a.id} a={a} />
        ))}
      </div>

      <Card title="LinkedIn taxonomy reference" subtitle="The verified facet values these audiences draw from">
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Job seniorities ({JOB_SENIORITIES.length})</div>
            <p className="mt-1 text-zinc-600">{JOB_SENIORITIES.join(" · ")}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Job functions ({JOB_FUNCTIONS.length})</div>
            <p className="mt-1 text-zinc-600">{JOB_FUNCTIONS.join(" · ")}</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Company sizes ({COMPANY_SIZES.length})</div>
            <p className="mt-1 text-zinc-600">{COMPANY_SIZES.join(" · ")}</p>
          </div>
        </div>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          See <Link href="/methodology" className="font-medium text-indigo-600 underline">Methodology</Link> for sources and the
          Apollo→LinkedIn mapping logic.
        </p>
      </Card>
    </div>
  );
}
