# Pipeline runbook — how the seed aggregates were produced

The app reads only `src/data/seed.ts`. That file is produced by running
read-only aggregate queries against the **AI Central CRM enrichment pipeline**
output and hand-baking the results. No row-level data is exported or committed.

## Source

- Supabase project: **AI Central // Quiz (Prod)** (`jcciwvaqbkxwtufvtiog`)
- Table: `public.submissions` (2,768 rows; the `ai-central-quiz` pipeline output)
- Already contains: Apollo enrichment, Stripe conversion join
  (`lifetime_value_usd`, products, subscription tier), self-reported quiz
  fields, and CRM segment/stage/persona classification.

## Definitions

- **Converter** = `archived_at IS NULL AND lifetime_value_usd > 0` (1,624 rows).
- Empty strings are treated as missing (`NULLIF(col,'')`).

## Aggregates pulled (read-only `GROUP BY`)

1. Totals & LTV percentiles for converters.
2. Geography (`country`) — share + avg/total LTV per country.
3. Seniority (`job_level`) and self-reported industry (`company_industry`).
4. Motivation (`main_goal`) — count, conversion rate, avg LTV.
5. Content appetite (`learning_style`) — top response patterns.
6. Pipeline persona classification (`persona`).
7. Monthly new customers / revenue from `stripe_first_charge_at`.
8. Source mix (`source`).

## Privacy rules

- Only counts, percentages, and averages are written to `src/data/`.
- No `email`, `name`, `ip`, `linkedin_url`, or `stripe_customer_id` values are stored.
- Small buckets are flagged (`smallSample`) and shown as "<5" where relevant.
- `/.pipeline-scratch/` is git-ignored for any local working data.

## Refreshing

Re-run the aggregate queries against `submissions` and update the literals in
`src/data/seed.ts`. (A future phase could move this to a live Supabase read +
build-time generation; intentionally out of scope for v1.)
