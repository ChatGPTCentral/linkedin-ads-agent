import type { SeedBundle } from "@/types";

// =============================================================================
// AGGREGATED, ANONYMIZED converter data for AI Central ("The Ultimate AI
// Library"). Source: the AI Central CRM enrichment pipeline output
// (Quiz Prod Supabase `submissions` table, read-only). Every figure below is a
// GROUP BY aggregate — no names, emails, IPs, or row-level records are stored.
// Apollo credits spent to build this: 0 (we reuse the existing pipeline).
// =============================================================================

export const seed: SeedBundle = {
  meta: {
    generatedAt: "2026-06-05",
    source: "AI Central CRM enrichment pipeline (Quiz Prod) — submissions",
    currency: "USD",
    totalRecords: 2767,
    converters: 1624,
    totalLtv: 76099.57,
    enrichmentCaveat:
      "Buyers overwhelmingly use personal email, so deep firmographic enrichment (exact job title, company) is thin. Geography, conversion value, self-reported goals, and seniority are the reliable signals — and they are what drive the audience design.",
    coverage: [
      { dimension: "Geography (country)", coveragePct: 81, basis: "2,229 / 2,767 records", strength: "strong" },
      { dimension: "Conversion value (LTV)", coveragePct: 100, basis: "Stripe joined into pipeline", strength: "strong" },
      { dimension: "Self-reported goal", coveragePct: 22, basis: "605 records (quiz)", strength: "moderate" },
      { dimension: "Seniority (job level)", coveragePct: 22, basis: "601 records (quiz)", strength: "moderate" },
      { dimension: "Industry", coveragePct: 23, basis: "631 records", strength: "moderate" },
      { dimension: "Exact job title", coveragePct: 6, basis: "178 records (Apollo)", strength: "thin" },
      { dimension: "Company size", coveragePct: 6, basis: "174 records (Apollo)", strength: "thin" },
    ],
    notes: [
      "Most enriched records are converters, with lifetime value tracked per customer.",
      "Reuses the AI Central CRM ('ai-central-quiz') enrichment pipeline output — zero new Apollo credits.",
      "Aggregated & anonymized: no individual customer data is stored in this app.",
    ],
  },

  conversions: {
    converters: 1624,
    leads: 1143,
    totalRecords: 2767,
    totalLtv: 76099.57,
    avgLtv: 46.86,
    medianLtv: 49.5,
    p90Ltv: 65.31,
    p95Ltv: 99.0,
    maxLtv: 322.43,
    bySource: [
      { key: "stripe", label: "Stripe import", rows: 1962, converters: 1563 },
      { key: "legacy", label: "Legacy / quiz", rows: 801, converters: 61 },
      { key: "survey", label: "New survey", rows: 4, converters: 0 },
    ],
    timeline: [
      { ym: "2023-11", newCustomers: 11, revenue: 616.52 },
      { ym: "2023-12", newCustomers: 21, revenue: 1187.13 },
      { ym: "2024-01", newCustomers: 34, revenue: 2484.24 },
      { ym: "2024-02", newCustomers: 17, revenue: 1281.06 },
      { ym: "2024-03", newCustomers: 22, revenue: 1244.58 },
      { ym: "2024-04", newCustomers: 25, revenue: 1548.55 },
      { ym: "2024-05", newCustomers: 38, revenue: 2175.92 },
      { ym: "2024-06", newCustomers: 12, revenue: 499.37 },
      { ym: "2024-07", newCustomers: 17, revenue: 856.56 },
      { ym: "2024-08", newCustomers: 21, revenue: 1232.16 },
      { ym: "2024-09", newCustomers: 17, revenue: 1075.41 },
      { ym: "2024-10", newCustomers: 39, revenue: 2301.38 },
      { ym: "2024-11", newCustomers: 61, revenue: 2882.74 },
      { ym: "2024-12", newCustomers: 71, revenue: 4081.25 },
      { ym: "2025-01", newCustomers: 61, revenue: 3325.79 },
      { ym: "2025-02", newCustomers: 34, revenue: 1824.61 },
      { ym: "2025-03", newCustomers: 33, revenue: 1759.82 },
      { ym: "2025-04", newCustomers: 87, revenue: 4745.7 },
      { ym: "2025-05", newCustomers: 81, revenue: 4344.7 },
      { ym: "2025-06", newCustomers: 43, revenue: 2383.34 },
      { ym: "2025-07", newCustomers: 39, revenue: 1916.78 },
      { ym: "2025-08", newCustomers: 90, revenue: 4474.69 },
      { ym: "2025-09", newCustomers: 100, revenue: 4973.3 },
      { ym: "2025-10", newCustomers: 87, revenue: 4233.37 },
      { ym: "2025-11", newCustomers: 140, revenue: 5307.95 },
      { ym: "2025-12", newCustomers: 127, revenue: 4272.26 },
      { ym: "2026-01", newCustomers: 79, revenue: 2948.8 },
      { ym: "2026-02", newCustomers: 40, revenue: 1743.06 },
      { ym: "2026-03", newCustomers: 59, revenue: 1964.9 },
      { ym: "2026-04", newCustomers: 49, revenue: 1392.59 },
      { ym: "2026-05", newCustomers: 57, revenue: 762.16 },
      { ym: "2026-06", newCustomers: 12, revenue: 258.88 },
    ],
  },

  icp: {
    // Share = % of converters with a known country (n = 1,574).
    geo: [
      { key: "US", label: "United States", count: 835, pct: 53.0, avgLtv: 48.95, totalLtv: 40873.56, tier: "tier1" },
      { key: "GB", label: "United Kingdom", count: 74, pct: 4.7, avgLtv: 42.59, totalLtv: 3151.37, tier: "tier1" },
      { key: "IN", label: "India", count: 68, pct: 4.3, avgLtv: 24.43, totalLtv: 1661.57, tier: "emerging" },
      { key: "CA", label: "Canada", count: 50, pct: 3.2, avgLtv: 51.25, totalLtv: 2562.66, tier: "tier1" },
      { key: "DE", label: "Germany", count: 46, pct: 2.9, avgLtv: 45.88, totalLtv: 2110.56, tier: "western" },
      { key: "AU", label: "Australia", count: 45, pct: 2.9, avgLtv: 50.85, totalLtv: 2288.2, tier: "tier1" },
      { key: "NL", label: "Netherlands", count: 28, pct: 1.8, avgLtv: 51.12, totalLtv: 1431.38, tier: "western" },
      { key: "FR", label: "France", count: 25, pct: 1.6, avgLtv: 44.44, totalLtv: 1111.06, tier: "western" },
      { key: "BR", label: "Brazil", count: 22, pct: 1.4, avgLtv: 32.52, totalLtv: 715.36, tier: "emerging" },
      { key: "ES", label: "Spain", count: 22, pct: 1.4, avgLtv: 40.8, totalLtv: 897.53, tier: "western" },
      { key: "CH", label: "Switzerland", count: 20, pct: 1.3, avgLtv: 60.3, totalLtv: 1206.06, tier: "western" },
      { key: "SA", label: "Saudi Arabia", count: 19, pct: 1.2, avgLtv: 38.42, totalLtv: 729.92, tier: "emerging" },
      { key: "SG", label: "Singapore", count: 18, pct: 1.1, avgLtv: 51.17, totalLtv: 921.07, tier: "western" },
      { key: "BE", label: "Belgium", count: 17, pct: 1.1, avgLtv: 47.9, totalLtv: 814.28, tier: "western" },
      { key: "AE", label: "United Arab Emirates", count: 15, pct: 1.0, avgLtv: 47.43, totalLtv: 711.41, tier: "emerging" },
      { key: "ZA", label: "South Africa", count: 13, pct: 0.8, avgLtv: 43.13, totalLtv: 560.75, tier: "emerging" },
      { key: "MY", label: "Malaysia", count: 11, pct: 0.7, avgLtv: 48.7, totalLtv: 535.75, tier: "emerging" },
      { key: "NZ", label: "New Zealand", count: 10, pct: 0.6, avgLtv: 40.81, totalLtv: 408.07, tier: "tier1" },
      { key: "IE", label: "Ireland", count: 10, pct: 0.6, avgLtv: 47.46, totalLtv: 474.62, tier: "tier1" },
      { key: "CH2", label: "Israel", count: 8, pct: 0.5, avgLtv: 61.86, totalLtv: 494.85, tier: "western" },
      { key: "PT", label: "Portugal", count: 7, pct: 0.4, avgLtv: 66.1, totalLtv: 462.7, tier: "western" },
    ],

    // Share = % of records with a known job level (n = 601). avgLtv = among
    // converters at that level. note = mapped LinkedIn seniority facet.
    seniority: [
      { key: "ic", label: "Individual contributor", count: 206, pct: 34.3, avgLtv: 41.51, note: "→ LinkedIn: Senior, Entry" },
      { key: "founder", label: "Founder", count: 111, pct: 18.5, avgLtv: 35.56, note: "→ LinkedIn: Owner" },
      { key: "csuite", label: "C-Suite", count: 100, pct: 16.6, avgLtv: 44.9, note: "→ LinkedIn: CXO" },
      { key: "manager", label: "Manager", count: 94, pct: 15.6, avgLtv: 58.03, note: "→ LinkedIn: Manager (highest LTV)" },
      { key: "other", label: "Other", count: 87, pct: 14.5, avgLtv: 46.04 },
      { key: "student", label: "Student / intern", count: 2, pct: 0.3, avgLtv: null, smallSample: true, note: "→ LinkedIn: Entry, Training" },
      { key: "vp", label: "VP / Director", count: 1, pct: 0.2, avgLtv: null, smallSample: true, note: "→ LinkedIn: Director, VP" },
    ],

    // Self-reported industry of converters (n = 68 — directional only).
    industry: [
      { key: "agency", label: "Agency or Consulting", count: 14, pct: 20.6, avgLtv: 41.01, smallSample: true },
      { key: "other", label: "Other", count: 8, pct: 11.8, avgLtv: 55.32, smallSample: true },
      { key: "finance", label: "Finance or Fintech", count: 7, pct: 10.3, avgLtv: 77.59, smallSample: true, note: "Highest LTV industry" },
      { key: "saas", label: "SaaS or Software", count: 7, pct: 10.3, avgLtv: 23.44, smallSample: true },
      { key: "education", label: "Education or Training", count: 7, pct: 10.3, avgLtv: 34.24, smallSample: true },
      { key: "healthcare", label: "Healthcare or Life Sciences", count: 6, pct: 8.8, avgLtv: 26.16, smallSample: true },
      { key: "media", label: "Media or Publishing", count: 3, pct: 4.4, avgLtv: 17.24, smallSample: true },
      { key: "ecommerce", label: "Ecommerce or DTC", count: 2, pct: 2.9, avgLtv: 23.87, smallSample: true },
      { key: "it", label: "IT & Services", count: 2, pct: 2.9, avgLtv: 52.31, smallSample: true },
      { key: "tail", label: "Other industries (1 each)", count: 12, pct: 17.6, smallSample: true, note: "Legal, Govt, Higher-Ed, Marketing, Manufacturing, Travel…" },
    ],

    // Self-reported main goal (lead + converter, n = 601). convRate & avgLtv
    // measured against actual conversions — the demand signal for messaging.
    goals: [
      { key: "build", label: "Develop AI products / workflows", count: 181, pct: 30.1, convRate: 13.3, avgLtv: 37.44, note: "Highest-volume goal" },
      { key: "current", label: "Stay up to date with AI", count: 123, pct: 20.5, convRate: 7.3, avgLtv: 47.49 },
      { key: "tools", label: "Choose the right AI tools", count: 98, pct: 16.3, convRate: 8.2, avgLtv: 35.65 },
      { key: "prompt", label: "Prompt engineering", count: 97, pct: 16.1, convRate: 7.2, avgLtv: 65.77, note: "Highest LTV goal" },
      { key: "team", label: "Train my team on AI", count: 70, pct: 11.6, convRate: 12.9, avgLtv: 46.74, note: "High conversion + B2B angle" },
      { key: "save", label: "Save money on AI tools", count: 19, pct: 3.2, convRate: 10.5, avgLtv: 23.87, smallSample: true },
      { key: "make", label: "Make money with AI", count: 13, pct: 2.2, convRate: 0.0, avgLtv: null, smallSample: true },
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

    // Pipeline persona classification of converters (n = 74 classified).
    personaMix: [
      { key: "decision_maker", label: "Decision-maker", count: 31, pct: 41.9, avgLtv: 39.13, smallSample: true },
      { key: "maker", label: "Maker / Builder", count: 23, pct: 31.1, avgLtv: 35.73, smallSample: true },
      { key: "operator", label: "Operator", count: 20, pct: 27.0, avgLtv: 38.41, smallSample: true },
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
        '"Develop AI products / workflows" is the #1 goal (30% of responses, 13.3% conversion)',
        "Individual contributors are 34% of those who report a job level",
        'Pipeline "maker" persona = 31% of classified converters',
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
        "Founders (18%) + C-Suite (17%) are a third of those reporting a job level",
        'Pipeline "decision_maker" persona = 42% of classified converters',
        "Premium markets (Switzerland, Israel, Portugal) over-index here",
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
        "Managers show the highest converter LTV of any job level",
        "Agency/Consulting (21%) and Education/Training (10%) lead industries",
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
