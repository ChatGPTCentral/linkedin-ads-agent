# AI Central — LinkedIn Ads Campaign Designer

A simple web app that turns AI Central's **real conversion data** into a
**high-converting LinkedIn Ads campaign design**: who actually buys *The
Ultimate AI Library*, mapped onto LinkedIn's targeting taxonomy, with
paste-ready audiences, ad copy, creative direction and a landing-page brief.

## How it works

The ICP is built by **reusing the output of AI Central's existing CRM
enrichment pipeline** (the `ai-central-quiz` project) — read directly from its
Supabase `submissions` table with read-only `GROUP BY` aggregates.

- **Zero new Apollo credits** — we consume the pipeline's already-enriched data.
- **Aggregated & anonymized** — this repo stores only counts, percentages and
  averages. No names, emails, or IP addresses are ever committed.
- Stripe conversions are already joined into the pipeline, so the ICP is built
  from **1,624 actual converters** ($76k tracked LTV), not guesses.

## What's inside

| Page | What it shows |
|------|----------------|
| `/` Dashboard | Conversion overview: customers, LTV, growth, top markets, what converts |
| `/icp` ICP Profile | Interactive explorer (geo, seniority, goals, industry, personas) + data-coverage honesty |
| `/audiences` Audience Design | 3 LinkedIn audiences with paste-ready Campaign Manager facet specs |
| `/brief` Campaign Brief | Ad copy (with char limits), creative direction, landing-page brief — exportable |
| `/methodology` | Sources, privacy, taxonomy references, caveats |

## Key findings (from the real data)

- **Geo:** US is 53% of converters; highest-LTV markets are Switzerland ($60),
  Israel ($62) and Portugal ($66); India ($24) and Brazil ($32) are
  high-volume but low-value → excluded from the high-CPM campaigns.
- **Seniority:** skews Individual Contributor / Founder / C-Suite; managers
  convert at the highest LTV ($58).
- **Motivation:** "Develop AI products/workflows" (13% conv) and "Train my team
  on AI" (13%) convert best; "Prompt engineering" drives the highest LTV.
- **Economics:** ~$47 average LTV on a high-CPM platform → spend leans to the
  yearly/lifetime offers and premium markets.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4. Pages render
statically from committed aggregate seed data (`src/data/seed.ts`) — **no
runtime API keys or database**. Charts are dependency-free (SVG/CSS).

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (typecheck + compile)
npm run lint
```

## Data & privacy

| File | Contents |
|------|----------|
| `src/data/seed.ts` | Aggregated converter analysis (no PII) |
| `src/data/linkedin.ts` | LinkedIn taxonomy + recommended audiences, copy, creative, LP brief |
| `src/types.ts` | Shared types (no row-level customer arrays by design) |
| `docs/PIPELINE.md` | How the aggregates were produced (runbook) |

No LinkedIn Ads API is connected, so audiences are delivered as **paste-ready
specs** for LinkedIn Campaign Manager, not an automated push.
