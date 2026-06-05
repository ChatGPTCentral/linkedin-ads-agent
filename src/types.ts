// Shared types for the LinkedIn Ads Campaign Designer.
// IMPORTANT: every value the app consumes is an AGGREGATE derived from the
// AI Central CRM enrichment pipeline (Quiz Prod Supabase). No row-level PII
// (names, emails, IPs) is ever stored in this repo.

export interface DistributionItem {
  /** raw bucket key */
  key: string;
  /** display label */
  label: string;
  /** number of records in this bucket */
  count: number;
  /** share within its distribution (0-100) */
  pct: number;
  /** average lifetime value (USD) for the bucket, when meaningful */
  avgLtv?: number | null;
  /** conversion rate (%) for lead-based dimensions */
  convRate?: number | null;
  /** flagged when the bucket sample is too small to be reliable */
  smallSample?: boolean;
  /** optional note shown in tooltips/legends */
  note?: string;
}

export type GeoTier = "tier1" | "western" | "emerging";

export interface GeoItem extends DistributionItem {
  totalLtv?: number;
  tier?: GeoTier;
}

export interface TimelinePoint {
  ym: string; // YYYY-MM
  newCustomers: number;
  revenue: number;
}

export interface SourceRow {
  key: string;
  label: string;
  rows: number;
  converters: number;
}

export interface ConversionSummary {
  converters: number;
  leads: number; // non-converting records in the pipeline
  totalRecords: number;
  totalLtv: number;
  avgLtv: number;
  medianLtv: number;
  p90Ltv: number;
  p95Ltv: number;
  maxLtv: number;
  timeline: TimelinePoint[];
  bySource: SourceRow[];
}

export interface IcpDistributions {
  geo: GeoItem[];
  seniority: DistributionItem[];
  industry: DistributionItem[];
  goals: DistributionItem[]; // self-reported motivation (lead + converter)
  contentPrefs: DistributionItem[]; // learning styles / content appetite
  personaMix: DistributionItem[]; // pipeline persona classification
}

export interface PersonaCard {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  evidence: string[]; // data points that back this persona
  motivations: string[];
  objections: string[];
  linkedin: {
    seniorities: string[];
    functions: string[];
    skills: string[];
  };
}

export interface CoverageRow {
  dimension: string;
  coveragePct: number; // % of records with a usable value
  basis: string;
  strength: "strong" | "moderate" | "thin";
}

export interface DatasetMeta {
  generatedAt: string; // ISO date the aggregates were baked
  source: string;
  currency: string;
  totalRecords: number;
  converters: number;
  totalLtv: number;
  enrichmentCaveat: string;
  coverage: CoverageRow[];
  notes: string[];
}

export interface SeedBundle {
  meta: DatasetMeta;
  conversions: ConversionSummary;
  icp: IcpDistributions;
  personas: PersonaCard[];
}

// ---------- LinkedIn campaign design ----------

export type CtaLabel =
  | "Learn more"
  | "Sign up"
  | "Download"
  | "Subscribe"
  | "Register"
  | "Get started";

export interface LinkedInFacets {
  jobSeniorities?: string[];
  jobFunctions?: string[];
  jobTitles?: string[];
  memberSkills?: string[];
  industries?: string[];
  companySizes?: string[];
  memberInterests?: string[];
}

export interface LinkedInAudience {
  id: string;
  name: string;
  intent: string;
  locations: string[];
  excludeLocations?: string[];
  facets: LinkedInFacets;
  audienceExpansion: boolean;
  estimatedSizeNote: string;
  budgetGuidance: string;
  warnings: string[];
  derivedFrom: string[]; // provenance to the real data
}

export interface AdCopyVariant {
  id: string;
  angle: string;
  pairsWith: string; // audience name
  introText: string; // LinkedIn intro/primary text
  headline: string; // LinkedIn headline
  cta: CtaLabel;
  rationale: string;
}

export interface CreativeConcept {
  title: string;
  visual: string;
  overlay?: string;
}

export interface CreativeDirection {
  primaryFormat: string;
  formats: string[];
  specNotes: string;
  concepts: CreativeConcept[];
  palette: { name: string; hex: string }[];
  tone: string;
  doList: string[];
  dontList: string[];
}

export interface LandingSection {
  name: string;
  purpose: string;
  points: string[];
}

export interface LandingPageBrief {
  goal: string;
  hero: { headline: string; subhead: string; cta: string };
  sections: LandingSection[];
  proof: string[];
  pricingFraming: string;
  measurement: string[];
}

// LinkedIn ad copy character limits (Single Image / Sponsored Content).
export const LINKEDIN_LIMITS = {
  /** intro/primary text: recommended before truncation, hard max */
  introRecommended: 150,
  introMax: 255,
  /** headline below the image */
  headlineMax: 70,
} as const;
