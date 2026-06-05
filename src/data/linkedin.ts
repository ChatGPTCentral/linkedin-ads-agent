import type {
  LinkedInAudience,
  AdCopyVariant,
  CreativeDirection,
  LandingPageBrief,
} from "@/types";

// =============================================================================
// LinkedIn Campaign Manager taxonomy reference (verified facet enumerations)
// + recommended audiences, copy, creative and landing-page brief, all derived
// from the AI Central converter analysis in src/data/seed.ts.
// Sources: LinkedIn Help (targeting options, audience-size best practices,
// single-image ad specs) & Microsoft Learn (seniorities, Industry Codes V2).
// =============================================================================

/** LinkedIn Job Seniorities (10) — exact facet values. */
export const JOB_SENIORITIES = [
  "Unpaid",
  "Training",
  "Entry",
  "Senior",
  "Manager",
  "Director",
  "VP",
  "CXO",
  "Partner",
  "Owner",
] as const;

/** LinkedIn Job Functions (26) — exact facet values. */
export const JOB_FUNCTIONS = [
  "Accounting",
  "Administrative",
  "Arts and Design",
  "Business Development",
  "Community and Social Services",
  "Consulting",
  "Education",
  "Engineering",
  "Entrepreneurship",
  "Finance",
  "Healthcare Services",
  "Human Resources",
  "Information Technology",
  "Legal",
  "Marketing",
  "Media and Communications",
  "Military and Protective Services",
  "Operations",
  "Product Management",
  "Program and Project Management",
  "Purchasing",
  "Quality Assurance",
  "Real Estate",
  "Research",
  "Sales",
  "Support",
] as const;

/** LinkedIn Company Size buckets — exact facet values. */
export const COMPANY_SIZES = [
  "Self-employed",
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
] as const;

/** Geo groupings used by the audience recommendations (from real LTV data). */
export const GEO_GROUPS = {
  tier1English: ["United States", "United Kingdom", "Canada", "Australia", "Ireland", "New Zealand"],
  highValueWestern: ["Switzerland", "Netherlands", "Singapore", "Germany", "Israel", "Belgium", "France", "Portugal"],
  lowLtvExclude: ["India", "Brazil"],
} as const;

export const AUDIENCES: LinkedInAudience[] = [
  {
    id: "core",
    name: "Core ICP — AI Builders & Operators",
    intent:
      "The tightest match to who actually buys: AI-curious professionals in high-value English markets, skewing builders, founders and operators.",
    locations: [...GEO_GROUPS.tier1English],
    excludeLocations: [...GEO_GROUPS.lowLtvExclude],
    facets: {
      jobSeniorities: ["Owner", "CXO", "Director", "Manager", "Senior"],
      jobFunctions: [
        "Marketing",
        "Information Technology",
        "Engineering",
        "Operations",
        "Entrepreneurship",
        "Product Management",
      ],
      memberSkills: ["Artificial Intelligence", "Generative AI", "Prompt Engineering", "ChatGPT"],
      memberInterests: ["Artificial Intelligence", "Generative AI"],
    },
    audienceExpansion: false,
    estimatedSizeNote:
      "AI skills/interests are very broad on LinkedIn, so this should clear minimums comfortably — keep the skill+seniority AND-combination to avoid junk reach.",
    budgetGuidance: "Primary always-on audience. Start here with ~50–60% of test budget.",
    warnings: [
      "Exclude India & Brazil from this high-CPM campaign (lowest LTV: $24 / $32).",
      "Low-ticket product (~$47 avg LTV) on a high-CPM platform — watch CPA closely.",
    ],
    derivedFrom: [
      "Geo: US 53% + UK/CA/AU lead converters",
      "Seniority: Founder/IC/C-Suite/Manager skew (job-level data)",
      "Goals: build workflows (13% conv), choose tools, prompt engineering",
    ],
  },
  {
    id: "highltv",
    name: "High-LTV — Founders & Execs (Premium Markets)",
    intent:
      "Concentrate spend on the segments and geographies with the highest lifetime value — best fit for the yearly and lifetime offers.",
    locations: ["United States", "Switzerland", "Canada", "Australia", "Netherlands", "Singapore", "United Kingdom", "Israel"],
    facets: {
      jobSeniorities: ["Owner", "Partner", "CXO", "VP"],
      jobFunctions: ["Entrepreneurship", "Marketing", "Consulting", "Finance"],
      memberSkills: ["Artificial Intelligence", "Generative AI", "Prompt Engineering", "Business Strategy"],
      industries: ["Financial Services", "IT Services and IT Consulting", "Marketing Services"],
      companySizes: ["Self-employed", "1-10", "11-50"],
    },
    audienceExpansion: false,
    estimatedSizeNote:
      "Narrower by design. If reach is too low to deliver, drop the industry facet first, then broaden seniority to Director.",
    budgetGuidance: "~25–30% of budget. Point this audience at the lifetime/yearly offer for the best economics.",
    warnings: [
      "May approach the 300-member floor once filtered — monitor 'audience too narrow' warnings.",
      "Finance/Fintech buyers show the highest LTV ($78) but are a small sample — treat as a hypothesis to test.",
    ],
    derivedFrom: [
      "High-LTV geos: Switzerland $60, Israel $62, Portugal $66, US $49",
      "Seniority: Founder + C-Suite a third of job-level reporters",
      "Managers show highest converter LTV ($58)",
    ],
  },
  {
    id: "broad",
    name: "Broad / Lookalike — AI-Curious Professionals",
    intent:
      "Top-of-funnel reach across Western/English markets using interest + skill signals, with Audience Expansion on. Feeds retargeting.",
    locations: [...GEO_GROUPS.tier1English, ...GEO_GROUPS.highValueWestern],
    excludeLocations: [...GEO_GROUPS.lowLtvExclude],
    facets: {
      jobFunctions: ["Marketing", "Information Technology", "Engineering", "Operations", "Consulting", "Education"],
      memberSkills: ["Artificial Intelligence", "Generative AI", "ChatGPT", "Machine Learning", "Marketing Automation"],
      memberInterests: ["Artificial Intelligence", "Generative AI", "Technology"],
    },
    audienceExpansion: true,
    estimatedSizeNote:
      "Deliberately broad to exceed LinkedIn's ~50k recommended size for Sponsored Content and to gather retargeting/learnings.",
    budgetGuidance: "~15–20% of budget for reach + retargeting pool. Use cheapest formats (single image).",
    warnings: [
      "Cheapest reach but lowest intent — judge on cost-per-landing-page-visit, not conversions.",
      "Use as the seed for website-retargeting and lookalike audiences once the Insight Tag has data.",
    ],
    derivedFrom: [
      "Broad AI interest across the buyer base",
      "Content appetite: tutorials, prompt packs, tool comparisons",
    ],
  },
];

export const AD_COPY: AdCopyVariant[] = [
  {
    id: "builder-stack",
    angle: "Builder — one curated stack",
    pairsWith: "Core ICP — AI Builders & Operators",
    introText:
      "Stop duct-taping AI tools together. The Ultimate AI Library puts the best AI tools, prompts and workflows in one curated place — so you ship faster.",
    headline: "Your entire AI stack, curated",
    cta: "Learn more",
    rationale: '"Develop AI products/workflows" is the #1 goal and best-converting (13.3%).',
  },
  {
    id: "prompt-packs",
    angle: "Prompt engineering — highest LTV",
    pairsWith: "Core ICP — AI Builders & Operators",
    introText:
      "Better prompts, better output. Steal our prompt packs for marketing, coding and ops — copy-paste prompts that actually get results.",
    headline: "Prompt packs that get results",
    cta: "Download",
    rationale: "Prompt-engineering goal carries the highest LTV ($66) of any segment.",
  },
  {
    id: "team-upskill",
    angle: "Team enabler — upskill the team",
    pairsWith: "High-LTV — Founders & Execs (Premium Markets)",
    introText:
      "Get your team fluent in AI — fast. One subscription, tutorials, tool comparisons and ready-to-use workflows your whole team can apply today.",
    headline: "Upskill your team on AI",
    cta: "Sign up",
    rationale: '"Train my team on AI" converts at 12.9%; managers show the highest LTV ($58).',
  },
  {
    id: "lifetime",
    angle: "Founder — lifetime, no subscription fatigue",
    pairsWith: "High-LTV — Founders & Execs (Premium Markets)",
    introText:
      "Lifetime access, no subscription fatigue. Own the Ultimate AI Library for life — every future update included, one payment, forever.",
    headline: "Lifetime AI access",
    cta: "Get started",
    rationale: "Founder/operator segment over-indexes in high-LTV markets and on the lifetime offer.",
  },
  {
    id: "signal-noise",
    angle: "Stay current — signal not noise",
    pairsWith: "Broad / Lookalike — AI-Curious Professionals",
    introText:
      "New AI tools drop daily. The Ultimate AI Library keeps only the best — organized — so you never miss what matters or waste a weekend testing.",
    headline: "The signal, not the noise",
    cta: "Learn more",
    rationale: '"Stay up to date with AI" is the #2 goal (20% of responses).',
  },
];

export const CREATIVE: CreativeDirection = {
  primaryFormat: "Single image (Sponsored Content)",
  formats: ["Single image 1200×627", "Carousel (tool/prompt showcase)", "Document ad (sample prompt pack)"],
  specNotes:
    "Single image: 1200×627 (1.91:1), PNG/JPG < 5MB. Lead with single image for cheapest reach; test a Document ad offering a free sample prompt pack as a lead magnet.",
  concepts: [
    {
      title: "The organized library",
      visual: "A clean grid/shelf of recognizable AI tool logos and prompt cards, neatly organized.",
      overlay: "1,000+ AI tools, prompts & workflows — in one place",
    },
    {
      title: "Before / after the chaos",
      visual: "Split image: a messy wall of 40 browser tabs vs. one tidy library dashboard.",
      overlay: "From 40 tabs to one library",
    },
    {
      title: "Prompt pack peek",
      visual: "A realistic product screenshot of a copy-paste prompt pack with a 'Copy' button.",
      overlay: "Steal these prompts",
    },
  ],
  palette: [
    { name: "Ink", hex: "#0A0A0A" },
    { name: "Indigo", hex: "#4F46E5" },
    { name: "Violet", hex: "#7C3AED" },
    { name: "Paper", hex: "#FFFFFF" },
    { name: "Mist", hex: "#F4F4F5" },
  ],
  tone: "Confident, practical, jargon-free. Speak to busy professionals who want leverage, not hype.",
  doList: [
    "Show the actual product UI and specific numbers (1,000+ tools)",
    "Lead with the benefit (ship faster / save the weekend)",
    "Match the creative to the audience's goal (build / prompt / train team)",
  ],
  dontList: [
    "No generic robot / glowing-brain stock imagery",
    "Avoid words like 'revolutionary' or 'game-changing'",
    "Don't bury the offer — make the lifetime / free-trial angle obvious",
  ],
};

export const LANDING_PAGE: LandingPageBrief = {
  goal: "Convert LinkedIn clicks into a free-trial start or a lifetime purchase, matched to the ad's angle.",
  hero: {
    headline: "Every AI tool, prompt & workflow worth knowing — in one library.",
    subhead:
      "The Ultimate AI Library curates the best of AI so you can build faster, choose the right tools, and keep your skills sharp. Join thousands of AI-curious professionals.",
    cta: "Start your free month",
  },
  sections: [
    { name: "Hero", purpose: "Match the ad's promise within 3 seconds", points: ["Benefit-led headline", "Single primary CTA", "Trust line: 'X,000+ members'"] },
    { name: "What's inside", purpose: "Make the value concrete", points: ["1,000+ vetted AI tools", "Copy-paste prompt packs", "Step-by-step workflows", "Updated continuously"] },
    { name: "Use cases by goal", purpose: "Mirror the visitor's quiz goal", points: ["Build AI products/workflows", "Choose the right tools", "Train your team", "Stay up to date"] },
    { name: "Social proof", purpose: "Reduce risk", points: ["Aggregate member count", "Testimonials (no PII)", "Logos / press if available"] },
    { name: "Pricing", purpose: "Frame sub vs lifetime", points: ["Anchor lifetime against recurring", "Show free-trial path", "Money-back / cancel-anytime reassurance"] },
    { name: "FAQ + final CTA", purpose: "Handle objections, close", points: ["'Is this just another list?'", "Refund/guarantee", "Repeat primary CTA"] },
  ],
  proof: [
    "Use aggregate proof only (e.g. 'thousands of members', star ratings) — never individual customer names from the data.",
    "Lead with the goals that convert best: building workflows and training teams.",
  ],
  pricingFraming:
    "Average LTV is ~$47, so protect CPA: push the higher-value yearly and lifetime offers in premium markets, and use the $4.99 trial as the low-friction entry from broad audiences.",
  measurement: [
    "Install the LinkedIn Insight Tag on the landing page for conversion tracking + retargeting.",
    "Track: landing-page view, trial start, purchase, and value — split by audience and UTM.",
    "Feed purchasers back as an excluded audience and as a lookalike seed.",
  ],
};
