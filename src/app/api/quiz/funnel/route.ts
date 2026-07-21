import { NextRequest, NextResponse } from "next/server";
import { getQuizDb, PAID_LINKEDIN_SOURCES } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paid (li_ads) quiz funnel, stage by stage. Sessions that entered via a paid
// LinkedIn ad are followed by session_id — the utm only sticks to the entry
// events, so session attribution is the correct way to trace the whole path.
const STAGES: { key: string; label: string }[] = [
  { key: "quiz_view", label: "Saw quiz" },
  { key: "quiz_start", label: "Started quiz" },
  { key: "email_submitted", label: "Gave email (lead)" },
  { key: "result_view", label: "Saw result" },
  { key: "checkout_click", label: "Clicked checkout" },
];

export async function GET(req: NextRequest) {
  const db = getQuizDb();
  if (!db) return NextResponse.json({ ok: false, skipped: "set SUPABASE_DATABASE_URL in the environment" });
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  // Scope to "since campaigns launched" when the caller passes ?since=<epoch ms>
  // (the earliest live-campaign start) — otherwise fall back to a rolling window.
  const sinceMs = Number(req.nextUrl.searchParams.get("since"));
  const cutoff = Number.isFinite(sinceMs) && sinceMs > 0 ? new Date(sinceMs) : new Date(Date.now() - days * 86400000);

  try {
    const rows = await db`
      with paid_sessions as (
        select distinct session_id
        from public.funnel_events
        where session_id is not null
          and utm_source = any(${PAID_LINKEDIN_SOURCES})
          and ts >= ${cutoff}
      )
      select fe.event, count(distinct fe.session_id)::int as sessions
      from public.funnel_events fe
      join paid_sessions ps using (session_id)
      where fe.ts >= ${cutoff}
      group by 1`;

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.event as string] = Number(r.sessions);

    // Purchases attributed to paid ads.
    const [buy] = await db`
      select count(*)::int as buyers
      from public.submissions
      where archived_at is null and utm_source = any(${PAID_LINKEDIN_SOURCES})
        and lifetime_value_usd > 0
        and created_at >= ${cutoff}`;

    const stages = [
      ...STAGES.map((s) => ({ key: s.key, label: s.label, sessions: counts[s.key] ?? 0 })),
      { key: "purchase", label: "Purchased", sessions: Number(buy?.buyers ?? 0) },
    ];

    const secondary = {
      referrals: (counts["share_click"] ?? 0) + (counts["pass_unlock"] ?? 0),
      starterKit: counts["starter_kit_click"] ?? 0,
      exitRescue: counts["exit_rescue_accepted"] ?? 0,
    };

    return NextResponse.json({ ok: true, days, source: "li_ads", stages, secondary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
