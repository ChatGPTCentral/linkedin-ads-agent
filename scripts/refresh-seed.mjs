// Daily insight refresh — re-query the live Quiz-Prod submissions table and
// write the volatile aggregates to src/data/insights.generated.json, which
// seed.ts overlays over its baked defaults. Run by .github/workflows/
// refresh-insights.yml on a daily cron; also runnable locally:
//   DATABASE_URL="postgres://…" node scripts/refresh-seed.mjs
//
// Only aggregates (counts / sums / percentiles) are written — never any
// row-level customer data. Converter = archived_at IS NULL AND lifetime_value_usd > 0.

import postgres from "postgres";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — aborting (baked values stay in place).");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1 });

try {
  const [h] = await sql`
    select
      count(*)::int as total_records,
      count(*) filter (where archived_at is null and lifetime_value_usd > 0)::int as converters,
      count(*) filter (where archived_at is null and coalesce(lifetime_value_usd, 0) = 0)::int as leads,
      round(sum(lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0)::numeric, 2)::float8 as total_ltv,
      round(avg(lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0)::numeric, 2)::float8 as avg_ltv,
      round((percentile_cont(0.5) within group (order by lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0))::numeric, 2)::float8 as median_ltv,
      round((percentile_cont(0.9) within group (order by lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0))::numeric, 2)::float8 as p90_ltv,
      round((percentile_cont(0.95) within group (order by lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0))::numeric, 2)::float8 as p95_ltv,
      round(max(lifetime_value_usd) filter (where archived_at is null and lifetime_value_usd > 0)::numeric, 2)::float8 as max_ltv
    from public.submissions`;

  const rows = await sql`
    select
      to_char(date_trunc('month', stripe_first_charge_at), 'YYYY-MM') as ym,
      count(*)::int as new_customers,
      round(sum(lifetime_value_usd)::numeric, 2)::float8 as revenue
    from public.submissions
    where archived_at is null and lifetime_value_usd > 0 and stripe_first_charge_at is not null
    group by 1
    order by 1`;

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    totalRecords: h.total_records,
    converters: h.converters,
    leads: h.leads,
    totalLtv: h.total_ltv,
    avgLtv: h.avg_ltv,
    medianLtv: h.median_ltv,
    p90Ltv: h.p90_ltv,
    p95Ltv: h.p95_ltv,
    maxLtv: h.max_ltv,
    timeline: rows.map((r) => ({ ym: r.ym, newCustomers: r.new_customers, revenue: r.revenue })),
  };

  const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "insights.generated.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`refreshed: ${out.converters} converters / ${out.totalRecords} records / $${out.totalLtv} LTV → ${dest}`);
} finally {
  await sql.end();
}
