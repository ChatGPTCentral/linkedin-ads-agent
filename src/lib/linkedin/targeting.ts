import { liGet } from "./client";
import type { LinkedInAudience } from "@/types";
import type { ResolvedFacet } from "./types";

// =============================================================================
// Facet -> URN resolution. LinkedIn targeting needs URNs, not display strings.
// - Seniorities & functions are standardized enums (static maps below).
// - Locations, industries, titles, skills are resolved via typeahead.
// NOTE: facet URNs and enum ids should be confirmed against the live API version
// once connected — these are the documented values but LinkedIn evolves them.
// =============================================================================

export const FACET = {
  locations: "urn:li:adTargetingFacet:locations",
  seniorities: "urn:li:adTargetingFacet:seniorities",
  jobFunctions: "urn:li:adTargetingFacet:jobFunctions",
  titles: "urn:li:adTargetingFacet:titles",
  industries: "urn:li:adTargetingFacet:industries",
  skills: "urn:li:adTargetingFacet:skills",
  staffCountRanges: "urn:li:adTargetingFacet:staffCountRanges",
  interests: "urn:li:adTargetingFacet:interests",
  // Matched/retargeting/customer-list audiences. Exact facet urn is version-
  // specific; audienceMatchingSegments is the documented one, dynamicSegments a fallback.
  audienceMatchingSegments: "urn:li:adTargetingFacet:audienceMatchingSegments",
  dynamicSegments: "urn:li:adTargetingFacet:dynamicSegments",
} as const;

// urn:li:seniority:N
export const SENIORITY_URN: Record<string, string> = {
  Unpaid: "urn:li:seniority:1",
  Training: "urn:li:seniority:2",
  Entry: "urn:li:seniority:3",
  Senior: "urn:li:seniority:4",
  Manager: "urn:li:seniority:5",
  Director: "urn:li:seniority:6",
  VP: "urn:li:seniority:7",
  CXO: "urn:li:seniority:8",
  Partner: "urn:li:seniority:9",
  Owner: "urn:li:seniority:10",
};

// urn:li:function:N — ordered to match the 26 standard functions.
const FUNCTIONS_ORDER = [
  "Accounting", "Administrative", "Arts and Design", "Business Development",
  "Community and Social Services", "Consulting", "Education", "Engineering",
  "Entrepreneurship", "Finance", "Healthcare Services", "Human Resources",
  "Information Technology", "Legal", "Marketing", "Media and Communications",
  "Military and Protective Services", "Operations", "Product Management",
  "Program and Project Management", "Purchasing", "Quality Assurance",
  "Real Estate", "Research", "Sales", "Support",
];
export const FUNCTION_URN: Record<string, string> = Object.fromEntries(
  FUNCTIONS_ORDER.map((name, i) => [name, `urn:li:function:${i + 1}`])
);

// Company size -> LinkedIn staff count range URN (best-effort; verify).
export const STAFF_COUNT_URN: Record<string, string> = {
  "Self-employed": "urn:li:staffCountRange:(1,1)",
  "1-10": "urn:li:staffCountRange:(2,10)",
  "11-50": "urn:li:staffCountRange:(11,50)",
  "51-200": "urn:li:staffCountRange:(51,200)",
  "201-500": "urn:li:staffCountRange:(201,500)",
  "501-1000": "urn:li:staffCountRange:(501,1000)",
  "1001-5000": "urn:li:staffCountRange:(1001,5000)",
  "5001-10000": "urn:li:staffCountRange:(5001,10000)",
  "10001+": "urn:li:staffCountRange:(10001,2147483647)",
};

// LinkedIn standard country geo URNs (urn:li:geo:N). These ids are stable and
// well-known, so we resolve locations directly instead of relying on the
// typeahead finder (which requires extra params and can silently return empty).
export const GEO_URN: Record<string, string> = {
  "United States": "urn:li:geo:103644278",
  "United Kingdom": "urn:li:geo:101165590",
  "Canada": "urn:li:geo:101174742",
  "Australia": "urn:li:geo:101452733",
  "Ireland": "urn:li:geo:104738515",
  "New Zealand": "urn:li:geo:105490917",
  "Switzerland": "urn:li:geo:106693272",
  "Netherlands": "urn:li:geo:102890719",
  "Singapore": "urn:li:geo:102454443",
  "Germany": "urn:li:geo:101282230",
  "Israel": "urn:li:geo:101620260",
  "Belgium": "urn:li:geo:100565514",
  "France": "urn:li:geo:105015875",
  "Portugal": "urn:li:geo:100364837",
  "India": "urn:li:geo:102713980",
  "Brazil": "urn:li:geo:106057199",
};

interface TypeaheadEntity {
  urn?: string;
  id?: string;
  name?: string;
}

/** Resolve a single value via the ad targeting typeahead endpoint. */
export async function typeahead(facetUrn: string, query: string, token: string): Promise<string | null> {
  // RestLi-encoded finder; verify exact shape against the live API version.
  const q = `q=typeahead&query=(facet:${encodeURIComponent(facetUrn)},query:${encodeURIComponent(query)})`;
  const res = await liGet(`/adTargetingEntities?${q}`, token);
  if (!res.ok) return null;
  const data = (await res.json()) as { elements?: TypeaheadEntity[] };
  const first = data.elements?.[0];
  return first?.urn ?? first?.id ?? null;
}

async function resolveMany(facetUrn: string, values: string[] | undefined, token: string): Promise<ResolvedFacet | null> {
  if (!values?.length) return null;
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const v of values) {
    const urn = await typeahead(facetUrn, v, token);
    if (urn) resolved.push(urn);
    else unresolved.push(v);
  }
  return { facetUrn, values: resolved, unresolved: unresolved.length ? unresolved : undefined };
}

function staticFacet(facetUrn: string, values: string[] | undefined, map: Record<string, string>): ResolvedFacet | null {
  if (!values?.length) return null;
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const v of values) (map[v] ? resolved : unresolved).push(map[v] ?? v);
  return { facetUrn, values: resolved, unresolved: unresolved.length ? unresolved : undefined };
}

/** Resolve locations from the static country map first, then typeahead fallback. */
async function resolveLocations(values: string[] | undefined, token: string): Promise<ResolvedFacet | null> {
  if (!values?.length) return null;
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const v of values) {
    const staticUrn = GEO_URN[v];
    if (staticUrn) {
      resolved.push(staticUrn);
      continue;
    }
    const urn = await typeahead(FACET.locations, v, token);
    if (urn) resolved.push(urn);
    else unresolved.push(v);
  }
  return { facetUrn: FACET.locations, values: resolved, unresolved: unresolved.length ? unresolved : undefined };
}

/** Resolve all of an audience's facets into URN groups. */
export async function resolveAudienceFacets(audience: LinkedInAudience, token: string): Promise<ResolvedFacet[]> {
  const out: (ResolvedFacet | null)[] = [];
  out.push(await resolveLocations(audience.locations, token));
  out.push(staticFacet(FACET.seniorities, audience.facets.jobSeniorities, SENIORITY_URN));
  out.push(staticFacet(FACET.jobFunctions, audience.facets.jobFunctions, FUNCTION_URN));
  out.push(audience.facets.jobTitles ? await resolveMany(FACET.titles, audience.facets.jobTitles, token) : null);
  out.push(audience.facets.industries ? await resolveMany(FACET.industries, audience.facets.industries, token) : null);
  out.push(audience.facets.memberSkills ? await resolveMany(FACET.skills, audience.facets.memberSkills, token) : null);
  out.push(staticFacet(FACET.staffCountRanges, audience.facets.companySizes, STAFF_COUNT_URN));
  out.push(audience.facets.memberInterests ? await resolveMany(FACET.interests, audience.facets.memberInterests, token) : null);
  return out.filter((x): x is ResolvedFacet => x !== null && x.values.length > 0);
}

/** Resolve excluded locations only (used for the exclude block). */
export async function resolveExcludedLocations(audience: LinkedInAudience, token: string): Promise<ResolvedFacet | null> {
  return audience.excludeLocations ? resolveLocations(audience.excludeLocations, token) : null;
}

/**
 * Build the RestLi targetingCriteria object from resolved facets, plus optional
 * matched-audience segments to target (include) or exclude (e.g. existing
 * customers). Segments are AND'd into include / OR'd into exclude.
 */
export function buildTargetingCriteria(
  include: ResolvedFacet[],
  exclude: ResolvedFacet | null,
  opts?: { includeSegments?: string[]; excludeSegments?: string[] }
) {
  const criteria: {
    include: { and: { or: Record<string, string[]> }[] };
    exclude?: { or: Record<string, string[]> };
  } = {
    include: { and: include.map((f) => ({ or: { [f.facetUrn]: f.values } })) },
  };
  if (opts?.includeSegments?.length) {
    criteria.include.and.push({ or: { [FACET.audienceMatchingSegments]: opts.includeSegments } });
  }
  const excludeOr: Record<string, string[]> = {};
  if (exclude && exclude.values.length) excludeOr[exclude.facetUrn] = exclude.values;
  if (opts?.excludeSegments?.length) excludeOr[FACET.audienceMatchingSegments] = opts.excludeSegments;
  if (Object.keys(excludeOr).length) criteria.exclude = { or: excludeOr };
  return criteria;
}
