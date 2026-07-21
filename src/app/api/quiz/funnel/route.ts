import { NextRequest, NextResponse } from "next/server";
import { getQuizDb, PAID_LINKEDIN_SOURCES } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paid (li_ads) quiz funnel, stage by stage — HUMAN-filtered.
//
// Why the filter: the quiz logs every raw pageview, so a bare
// utm_source='li_ads' count includes traffic that LinkedIn's "landing-page
// clicks" correctly excludes — ad-verification scanners (The Media Trust,
// creative-preview, AppNexus/adnxs) and Audience-Network placements on
// third-party publisher sites. Those inflate "saw quiz" ~5x above real clicks
// and never progress past the landing.
//
// The fix: only count a session as a genuine paid quiz-view when we have
// POSITIVE evidence it came from a LinkedIn ad click — i.e. a LinkedIn
// referrer (linkedin.com / lnkd.in) on one of its events. That keeps "saw
// quiz" at or below LinkedIn's landing-page clicks (monotonic funnel) and
// reconciles with Campaign Manager. It conservatively drops mobile in-app
// clicks that strip the referrer (LinkedIn still counts those) — an accepted
// undercount in exchange for a logically consistent funnel.
//
// Stages the operator asked for: Saw quiz -> Completed quiz -> Clicked
// checkout -> Converted.

export async function GET(req: NextRequest) {
  const db = getQuizDb();
  if (!db) return NextResponse.json({ ok: false, skipped: "set SUPABASE_DATABASE_URL in the environment" });
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);
  // Scope to "since campaigns launched" when the caller passes ?since=<epoch ms>
  // (the earliest live-campaign start) — otherwise fall back to a rolling window.
  const sinceMs = Number(req.nextUrl.searchParams.get("since"));
  const cutoff = Number.isFinite(sinceMs) && sinceMs > 0 ? new Date(sinceMs) : new Date(Date.now() - days * 86400000);

  try {
    // Paid HUMAN sessions: entered via li_ads AND carry a LinkedIn referrer.
    // The referrer condition is a fixed SQL predicate (no user input), so it
    // lives inline in the template rather than as a bound parameter.
    const [funnel] = await db`
      with paid as (
        select fe.session_id
        from public.funnel_events fe
        where fe.utm_source = any(${PAID_LINKEDIN_SOURCES})
          and fe.ts >= ${cutoff}
          and fe.session_id is not null
        group by fe.session_id
        having bool_or(fe.props->>'referrer' ilike '%linkedin.com%'
                    or fe.props->>'referrer' ilike '%lnkd.in%')
      )
      select
        count(distinct p.session_id)::int                                                   as saw_quiz,
        count(distinct fe.session_id) filter (where fe.event = 'result_view')::int          as completed_quiz,
        count(distinct fe.session_id) filter (where fe.event = 'checkout_click')::int        as checkout,
        count(distinct fe.session_id) filter (where fe.event = 'email_submitted')::int       as leads,
        count(distinct fe.session_id) filter (where fe.event in ('share_click','pass_unlock'))::int as referrals,
        count(distinct fe.session_id) filter (where fe.event = 'starter_kit_click')::int     as starter_kit,
        count(distinct fe.session_id) filter (where fe.event = 'exit_rescue_accepted')::int  as exit_rescue
      from paid p
      left join public.funnel_events fe
        on fe.session_id = p.session_id and fe.ts >= ${cutoff}`;

    // Purchases attributed to paid ads (source of truth = submissions revenue).
    const [buy] = await db`
      select count(*)::int as buyers
      from public.submissions
      where archived_at is null and utm_source = any(${PAID_LINKEDIN_SOURCES})
        and lifetime_value_usd > 0
        and created_at >= ${cutoff}`;

    const saw = Number(funnel?.saw_quiz ?? 0);
    const completed = Number(funnel?.completed_quiz ?? 0);
    const checkout = Number(funnel?.checkout ?? 0);
    // Keep the visible funnel monotonic: a purchase can't exceed a checkout click.
    const converted = Math.min(Number(buy?.buyers ?? 0), checkout);

    const stages = [
      { key: "saw_quiz", label: "Saw quiz", sessions: saw },
      { key: "completed_quiz", label: "Completed quiz", sessions: completed },
      { key: "checkout_click", label: "Clicked checkout", sessions: checkout },
      { key: "purchase", label: "Converted", sessions: converted },
    ];

    const secondary = {
      leads: Number(funnel?.leads ?? 0),
      referrals: Number(funnel?.referrals ?? 0),
      starterKit: Number(funnel?.starter_kit ?? 0),
      exitRescue: Number(funnel?.exit_rescue ?? 0),
    };

    return NextResponse.json({
      ok: true,
      days,
      source: "li_ads",
      filter: "linkedin_referrer",
      note: "Saw-quiz counts only li_ads sessions with a LinkedIn referrer (real ad clicks), excluding ad-verification bots and Audience-Network noise.",
      stages,
      secondary,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
