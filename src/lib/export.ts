import type { LinkedInAudience, AdCopyVariant, CreativeDirection, LandingPageBrief } from "@/types";

/** Paste-ready Markdown for a single LinkedIn audience, in Campaign Manager order. */
export function audienceToMarkdown(a: LinkedInAudience): string {
  const f = a.facets;
  const out: string[] = [`## ${a.name}`, "", a.intent, "", `**Locations:** ${a.locations.join(", ")}`];
  if (a.excludeLocations?.length) out.push(`**Exclude locations:** ${a.excludeLocations.join(", ")}`);
  if (f.jobSeniorities?.length) out.push(`**Job seniorities:** ${f.jobSeniorities.join(", ")}`);
  if (f.jobFunctions?.length) out.push(`**Job functions:** ${f.jobFunctions.join(", ")}`);
  if (f.jobTitles?.length) out.push(`**Job titles:** ${f.jobTitles.join(", ")}`);
  if (f.memberSkills?.length) out.push(`**Member skills:** ${f.memberSkills.join(", ")}`);
  if (f.industries?.length) out.push(`**Industries:** ${f.industries.join(", ")}`);
  if (f.companySizes?.length) out.push(`**Company sizes:** ${f.companySizes.join(", ")}`);
  if (f.memberInterests?.length) out.push(`**Member interests:** ${f.memberInterests.join(", ")}`);
  out.push(`**Audience Expansion:** ${a.audienceExpansion ? "On" : "Off"}`, "", `**Budget:** ${a.budgetGuidance}`, `**Size note:** ${a.estimatedSizeNote}`);
  if (a.warnings.length) {
    out.push("", "**Warnings:**");
    a.warnings.forEach((w) => out.push(`- ${w}`));
  }
  return out.join("\n");
}

export function adCopyToMarkdown(v: AdCopyVariant): string {
  return [
    `### ${v.angle}`,
    `- **Pairs with:** ${v.pairsWith}`,
    `- **Intro text:** ${v.introText}`,
    `- **Headline:** ${v.headline}`,
    `- **CTA:** ${v.cta}`,
    `- **Why:** ${v.rationale}`,
  ].join("\n");
}

/** Whole campaign brief as one Markdown document. */
export function campaignBriefToMarkdown(
  audiences: LinkedInAudience[],
  copy: AdCopyVariant[],
  creative: CreativeDirection,
  landing: LandingPageBrief
): string {
  const out: string[] = [
    "# AI Central — LinkedIn Campaign Brief",
    "_Generated from converter analysis (The Ultimate AI Library). Aggregated & anonymized._",
    "",
    "## Audiences",
    "",
    ...audiences.map(audienceToMarkdown),
    "",
    "## Ad copy",
    "",
    ...copy.map(adCopyToMarkdown),
    "",
    "## Creative direction",
    `- **Primary format:** ${creative.primaryFormat}`,
    `- **Specs:** ${creative.specNotes}`,
    `- **Tone:** ${creative.tone}`,
    "- **Concepts:**",
    ...creative.concepts.map((c) => `  - ${c.title}: ${c.visual}${c.overlay ? ` (overlay: "${c.overlay}")` : ""}`),
    `- **Do:** ${creative.doList.join("; ")}`,
    `- **Don't:** ${creative.dontList.join("; ")}`,
    "",
    "## Landing page brief",
    `- **Goal:** ${landing.goal}`,
    `- **Hero headline:** ${landing.hero.headline}`,
    `- **Hero subhead:** ${landing.hero.subhead}`,
    `- **Hero CTA:** ${landing.hero.cta}`,
    "- **Sections:**",
    ...landing.sections.map((s) => `  - ${s.name} — ${s.purpose}`),
    `- **Pricing framing:** ${landing.pricingFraming}`,
    "- **Measurement:**",
    ...landing.measurement.map((m) => `  - ${m}`),
  ];
  return out.join("\n");
}
