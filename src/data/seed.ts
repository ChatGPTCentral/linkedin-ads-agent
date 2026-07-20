import type { SeedBundle } from "@/types";
import generated from "./insights.generated.json";

// Volatile aggregates refreshed daily by scripts/refresh-seed.mjs (GitHub
// Actions) → insights.generated.json. Curated ICP breakdowns, personas,
// coverage and source mix stay hand-reviewed. Each field falls back to the
// baked literal below if the generated file ever lacks a value.
const G = generated as Partial<{
  generatedAt: string;
  totalRecords: number;
  converters: number;
  leads: number;
  totalLtv: number;
  avgLtv: number;
  medianLtv: number;
  p90Ltv: number;
  p95Ltv: number;
  maxLtv: number;
  timeline: { ym: string; newCustomers: number; revenue: number }[];
}>;

// =============================================================================
// AGGREGATED, ANONYMIZED converter data for AI Central ("The Ultimate AI
// Library"). Source: the AI Central CRM enrichment pipeline output
// (Quiz Prod Supabase `submissions` table, read-only). Every figure below is a
// GROUP BY aggregate — no names, emails, IPs, or row-level records are stored.
// Apollo credits spent to build this: 0 (we reuse the existing pipeline).
// Refresh recipe: docs/PIPELINE.md.
// =============================================================================

export const seed: SeedBundle = {
  meta: {
    generatedAt: G.generatedAt ?? "2026-07-15",
    source: "AI Central CRM enrichment pipeline (Quiz Prod) — submissions",
    currency: "USD",
    totalRecords: G.totalRecords ?? 3225,
    converters: G.converters ?? 1694,
    totalLtv: G.totalLtv ?? 80875.72,
    enrichmentCaveat:
      "Buyers overwhelmingly use personal email, so deep firmographic enrichment (exact job title, company) is only partial. Geography, conversion value, self-reported goals, and seniority are the reliable signals — and they are what drive the audience design.",
    coverage: [
      { dimension: "Geography (country)", coveragePct: 83, basis: "2,669 / 3,225 records", strength: "strong" },
      { dimension: "Conversion value (LTV)", coveragePct: 100, basis: "Stripe joined into pipeline", strength: "strong" },
      { dimension: "Self-reported goal", coveragePct: 19, basis: "605 records (quiz)", strength: "moderate" },
      { dimension: "Seniority (job level)", coveragePct: 32, basis: "1,029 records (quiz)", strength: "moderate" },
      { dimension: "Industry", coveragePct: 28, basis: "912 records", strength: "moderate" },
      { dimension: "Exact job title", coveragePct: 17, basis: "561 records (Apollo)", strength: "moderate" },
      { dimension: "Company size", coveragePct: 14, basis: "459 records (Apollo)", strength: "thin" },
    ],
    notes: [
      "Most enriched records are converters, with lifetime value tracked per customer.",
      "Reuses the AI Central CRM ('ai-central-quiz') enrichment pipeline output — zero new Apollo credits.",
      "Aggregated & anonymized: no individual customer data is stored in this app.",
    ],
  },

  conversions: {
    converters: G.converters ?? 1694,
    leads: G.leads ?? 1531,
    totalRecords: G.totalRecords ?? 3225,
    totalLtv: G.totalLtv ?? 80875.72,
    avgLtv: G.avgLtv ?? 47.74,
    medianLtv: G.medianLtv ?? 49.5,
    p90Ltv: G.p90Ltv ?? 68.54,
    p95Ltv: G.p95Ltv ?? 99.25,
    maxLtv: G.maxLtv ?? 322.43,
    bySource: [
      { key: "stripe", label: "Stripe import", rows: 1996, converters: 1590 },
      { key: "legacy", label: "Legacy / quiz", rows: 1225, converters: 104 },
      { key: "survey", label: "New survey", rows: 4, converters: 0 },
    ],
    timeline: G.timeline ?? [
      { ym: "2023-11", newCustomers: 11, revenue: 616.52 },
      { ym: "2023-12", newCustomers: 21, revenue: 1187.13 },
      { ym: "2024-01", newCustomers: 34, revenue: 2489.23 },
      { ym: "2024-02", newCustomers: 17, revenue: 1281.06 },
      { ym: "2024-03", newCustomers: 22, revenue: 1244.58 },
      { ym: "2024-04", newCustomers: 25, revenue: 1548.55 },
      { ym: "2024-05", newCustomers: 38, revenue: 2230.66 },
      { ym: "2024-06", newCustomers: 12, revenue: 499.37 },
      { ym: "2024-07", newCustomers: 17, revenue: 886.31 },
      { ym: "2024-08", newCustomers: 21, revenue: 1232.16 },
      { ym: "2024-09", newCustomers: 17, revenue: 1075.41 },
      { ym: "2024-10", newCustomers: 39, revenue: 2301.38 },
      { ym: "2024-11", newCustomers: 61, revenue: 2942.49 },
      { ym: "2024-12", newCustomers: 71, revenue: 4141.0 },
      { ym: "2025-01", newCustomers: 61, revenue: 3325.79 },
      { ym: "2025-02", newCustomers: 34, revenue: 1824.61 },
      { ym: "2025-03", newCustomers: 33, revenue: 1759.82 },
      { ym: "2025-04", newCustomers: 87, revenue: 4761.68 },
      { ym: "2025-05", newCustomers: 81, revenue: 4389.64 },
      { ym: "2025-06", newCustomers: 43, revenue: 2423.29 },
      { ym: "2025-07", newCustomers: 39, revenue: 1924.77 },
      { ym: "2025-08", newCustomers: 90, revenue: 4474.69 },
      { ym: "2025-09", newCustomers: 100, revenue: 4973.3 },
      { ym: "2025-10", newCustomers: 87, revenue: 4332.85 },
      { ym: "2025-11", newCustomers: 140, revenue: 5307.95 },
      { ym: "2025-12", newCustomers: 127, revenue: 4327.0 },
      { ym: "2026-01", newCustomers: 79, revenue: 3020.71 },
      { ym: "2026-02", newCustomers: 40, revenue: 1827.55 },
      { ym: "2026-03", newCustomers: 59, revenue: 2009.64 },
      { ym: "2026-04", newCustomers: 49, revenue: 1556.58 },
      { ym: "2026-05", newCustomers: 57, revenue: 2704.1 },
      { ym: "2026-06", newCustomers: 49, revenue: 1887.24 },
      { ym: "2026-07", newCustomers: 33, revenue: 368.66 },
    ],
  },

  icp: {
    // Share = % of converters with a known country (n = 1,643).
    geo: [
      { key: "US", label: "United States", count: 877, pct: 53.4, avgLtv: 49.66, totalLtv: 43548.4, tier: "tier1" },
      { key: "GB", label: "United Kingdom", count: 76, pct: 4.6, avgLtv: 43.04, totalLtv: 3270.85, tier: "tier1" },
      { key: "IN", label: "India", count: 73, pct: 4.4, avgLtv: 23.1, totalLtv: 1686.52, tier: "emerging" },
      { key: "CA", label: "Canada", count: 50, pct: 3.0, avgLtv: 52.84, totalLtv: 2642.16, tier: "tier1" },
      { key: "DE", label: "Germany", count: 48, pct: 2.9, avgLtv: 44.28, totalLtv: 2125.53, tier: "western" },
      { key: "AU", label: "Australia", count: 46, pct: 2.8, avgLtv: 53.75, totalLtv: 2472.44, tier: "tier1" },
      { key: "NL", label: "Netherlands", count: 29, pct: 1.8, avgLtv: 52.96, totalLtv: 1535.87, tier: "western" },
      { key: "FR", label: "France", count: 25, pct: 1.5, avgLtv: 44.44, totalLtv: 1111.06, tier: "western" },
      { key: "BR", label: "Brazil", count: 24, pct: 1.5, avgLtv: 35.2, totalLtv: 844.84, tier: "emerging" },
      { key: "ES", label: "Spain", count: 23, pct: 1.4, avgLtv: 39.24, totalLtv: 902.52, tier: "western" },
      { key: "CH", label: "Switzerland", count: 21, pct: 1.3, avgLtv: 60.28, totalLtv: 1265.79, tier: "western" },
      { key: "SA", label: "Saudi Arabia", count: 19, pct: 1.2, avgLtv: 41.56, totalLtv: 789.67, tier: "emerging" },
      { key: "SG", label: "Singapore", count: 18, pct: 1.1, avgLtv: 52.06, totalLtv: 937.05, tier: "western" },
      { key: "BE", label: "Belgium", count: 17, pct: 1.0, avgLtv: 47.9, totalLtv: 814.28, tier: "western" },
      { key: "AE", label: "United Arab Emirates", count: 15, pct: 0.9, avgLtv: 55.39, totalLtv: 830.91, tier: "emerging" },
      { key: "ZA", label: "South Africa", count: 14, pct: 0.9, avgLtv: 43.96, totalLtv: 615.49, tier: "emerging" },
      { key: "MY", label: "Malaysia", count: 11, pct: 0.7, avgLtv: 48.7, totalLtv: 535.75, tier: "emerging" },
      { key: "NZ", label: "New Zealand", count: 10, pct: 0.6, avgLtv: 46.78, totalLtv: 467.82, tier: "tier1" },
      { key: "IE", label: "Ireland", count: 10, pct: 0.6, avgLtv: 47.46, totalLtv: 474.62, tier: "tier1" },
      { key: "IL", label: "Israel", count: 8, pct: 0.5, avgLtv: 77.42, totalLtv: 619.34, tier: "western" },
      { key: "PT", label: "Portugal", count: 7, pct: 0.4, avgLtv: 66.1, totalLtv: 462.7, tier: "western" },
    ],

    // Share = % of records with a known job level (n = 1,029). avgLtv = among
    // converters at that level. note = mapped LinkedIn seniority facet.
    seniority: [
      { key: "ic", label: "Individual contributor", count: 288, pct: 28.0, avgLtv: 46.74, note: "→ LinkedIn: Senior, Entry" },
      { key: "founder", label: "Founder", count: 217, pct: 21.1, avgLtv: 40.82, note: "→ LinkedIn: Owner" },
      { key: "manager", label: "Manager", count: 166, pct: 16.1, avgLtv: 45.43, note: "→ LinkedIn: Manager" },
      { key: "other", label: "Other", count: 148, pct: 14.4, avgLtv: 34.37 },
      { key: "csuite", label: "C-Suite", count: 128, pct: 12.4, avgLtv: 41.09, note: "→ LinkedIn: CXO" },
      { key: "vp", label: "VP / Director", count: 58, pct: 5.6, avgLtv: 29.74, note: "→ LinkedIn: Director, VP" },
      { key: "student", label: "Student / intern", count: 24, pct: 2.3, avgLtv: null, smallSample: true, note: "→ LinkedIn: Entry, Training" },
    ],

    // Self-reported industry of converters (n = 85 — directional only).
    industry: [
      { key: "agency", label: "Agency or Consulting", count: 15, pct: 17.6, avgLtv: 41.93, smallSample: true },
      { key: "other", label: "Other", count: 8, pct: 9.4, avgLtv: 55.32, smallSample: true },
      { key: "finance", label: "Finance or Fintech", count: 7, pct: 8.2, avgLtv: 78.31, smallSample: true, note: "Highest LTV industry" },
      { key: "education", label: "Education or Training", count: 7, pct: 8.2, avgLtv: 45.59, smallSample: true },
      { key: "saas", label: "SaaS or Software", count: 7, pct: 8.2, avgLtv: 31.97, smallSample: true },
      { key: "healthcare", label: "Healthcare or Life Sciences", count: 6, pct: 7.1, avgLtv: 26.99, smallSample: true },
      { key: "it", label: "IT & Services", count: 4, pct: 4.7, avgLtv: 41.09, smallSample: true },
      { key: "media", label: "Media or Publishing", count: 3, pct: 3.5, avgLtv: 30.49, smallSample: true },
      { key: "ecommerce", label: "Ecommerce or DTC", count: 2, pct: 2.4, avgLtv: 23.87, smallSample: true },
      { key: "tail", label: "Other industries (1–2 each)", count: 26, pct: 30.6, smallSample: true, note: "Finance, Legal, Govt, Higher-Ed, Manufacturing, Travel…" },
    ],

    // Self-reported main goal (lead + converter, n = 605). convRate & avgLtv
    // measured against actual conversions — the demand signal for messaging.
    goals: [
      { key: "build", label: "Develop AI products / workflows", count: 181, pct: 29.9, convRate: 13.8, avgLtv: 43.11, note: "Highest-volume goal" },
      { key: "current", label: "Stay up to date with AI", count: 124, pct: 20.5, convRate: 7.3, avgLtv: 47.49 },
      { key: "tools", label: "Choose the right AI tools", count: 98, pct: 16.2, convRate: 8.2, avgLtv: 35.65 },
      { key: "prompt", label: "Prompt engineering", count: 97, pct: 16.0, convRate: 7.2, avgLtv: 75.02, note: "Highest LTV goal" },
      { key: "team", label: "Train my team on AI", count: 70, pct: 11.6, convRate: 12.9, avgLtv: 46.74, note: "High conversion + B2B angle" },
      { key: "save", label: "Save money on AI tools", count: 19, pct: 3.1, convRate: 10.5, avgLtv: 23.87, smallSample: true },
      { key: "make", label: "Make money with AI", count: 13, pct: 2.1, convRate: 0.0, avgLtv: null, smallSample: true },
    ],

    // Content appetite — multi-select quiz answers (n = 566). Top response
    // patterns; how-to tutorials, prompt packs & tool comparisons dominate.
    contentPrefs: [
      { key: "all", label: "All content types", count: 105, pct: 18.6, note: "multi-select" },
      { key: "all_tools", label: "Everything + tool comparisons", count: 101, pct: 17.8, note: "multi-select" },
      { key: "tut_prompt_tools", label: "Tutorials + prompt packs + tool comparisons", count: 41, pct: 7.2, note: "multi-select" },
      { key: "tut_deep_prompt", label: "Tutorials + deep-dives + prompt packs", count: 39, pct: 6.9, note: "multi-select" },
      { key: "tut_all_tools", label: "Tutorials + everything + tool comparisons", count: 30, pct: 5.3, note: "multi-select" },
      { key: "tutorials", label: "How-to tutorials", count: 24, pct: 4.2, note: "multi-select" },
    ],

    // Pipeline persona classification of converters (n = 118 classified).
    personaMix: [
      { key: "decision_maker", label: "Decision-maker", count: 61, pct: 51.7, avgLtv: 40.29, smallSample: true },
      { key: "maker", label: "Maker / Builder", count: 35, pct: 29.7, avgLtv: 44.64, smallSample: true },
      { key: "operator", label: "Operator", count: 22, pct: 18.6, avgLtv: 43.74, smallSample: true },
    ],
  },

  personas: [
    {
      id: "builder",
      name: "The AI Builder",
      emoji: "🛠️",
      blurb:
        "An individual contributor or early founder who wants to ship AI products and workflows faster. The single biggest and best-converting segment.",
      evidence: [
        '"Develop AI products / workflows" is the #1 goal (30% of responses, 13.8% conversion)',
        "Individual contributors are 28% of those who report a job level",
        'Pipeline "maker" persona = 30% of classified converters',
      ],
      motivations: [
        "Build and ship faster without rabbit-holing on tooling",
        "Find vetted prompts & workflows that actually work",
        "Keep up with new models and features",
      ],
      objections: ["Already has scattered free resources", "Skeptical of 'another AI list'"],
      linkedin: {
        seniorities: ["Senior", "Entry", "Manager"],
        functions: ["Engineering", "Information Technology", "Product Management"],
        skills: ["Artificial Intelligence", "Generative AI", "Prompt Engineering", "Machine Learning"],
      },
    },
    {
      id: "founder",
      name: "The Founder / Operator",
      emoji: "🚀",
      blurb:
        "A founder, owner, or C-suite operator at a small company who wants AI leverage and ROI — and is most receptive to the lifetime offer.",
      evidence: [
        "Founders (21%) + C-Suite (12%) are a third of those reporting a job level",
        'Pipeline "decision_maker" persona = 52% of classified converters',
        "Premium markets (Switzerland $60, Israel $77, Portugal $66) over-index here",
      ],
      motivations: [
        "Turn AI into business leverage and cost savings",
        "Own a curated system, avoid subscription fatigue (lifetime deal)",
        "Stay ahead of competitors",
      ],
      objections: ["Time-poor", "Wants proof of ROI before buying"],
      linkedin: {
        seniorities: ["Owner", "CXO", "Partner"],
        functions: ["Entrepreneurship", "Operations", "Marketing", "Consulting"],
        skills: ["Artificial Intelligence", "Generative AI", "Business Strategy", "Marketing Automation"],
      },
    },
    {
      id: "enabler",
      name: "The Team Enabler",
      emoji: "📚",
      blurb:
        "A manager or director responsible for upskilling a team on AI. Smaller in volume but a strong-converting, higher-ACV B2B angle.",
      evidence: [
        '"Train my team on AI" converts at 12.9% — second-highest of any goal',
        "Managers are 16% of reporters and convert at a solid ~$45 LTV",
        "Agency/Consulting (18%) and Education/Training (8%) lead converter industries",
      ],
      motivations: [
        "Get a whole team fluent in AI quickly",
        "One trusted, organized resource instead of chaos",
        "Demonstrate L&D value",
      ],
      objections: ["Needs team-friendly licensing", "Must justify to finance"],
      linkedin: {
        seniorities: ["Manager", "Director", "VP"],
        functions: ["Operations", "Human Resources", "Consulting", "Marketing"],
        skills: ["Artificial Intelligence", "Generative AI", "Team Leadership", "Learning & Development"],
      },
    },
  ],
};
