import { NextRequest, NextResponse } from "next/server";
import { getQuizDb, PAID_LINKEDIN_SOURCES } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paid (li_ads) quiz funnel, stage by stage — HUMAN-filtered at the top only.
//
// The problem: the quiz logs every raw pageview, so a bare utm_source='li_ads'
// count includes traffic LinkedIn's "landing-page clicks" correctly excludes —
// ad-verification scanners (The Media Trust, creative-preview, AppNexus/adnxs)
// and Audience-Network placements on third-party publisher sites. Those inflate
// "saw quiz" ~5x above real clicks and then bounce at the landing.
//
// The fix, and why it only touches the top stage:
//  - SAW QUIZ is bot-filtered: counted only when a session carries a LinkedIn
//    referrer (linkedin.com / lnkd.in) — positive proof of a real ad click.
//    That keeps it at/below LinkedIn's landing-page clicks (monotonic funnel).
//  - Every stage BELOW (started / completed / checkout) counts ALL li_ads
//    sessions with no referrer filter — bots never fill out a quiz, so those
//    counts are already real humans. Filtering them would wrongly drop real
//    people who arrived via mobile in-app or Audience-Network paths (no
//    linkedin referrer), which is what made "completed" look too low before.
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
    // One row per li_ads session, flagged for the LinkedIn referrer (bot filter)
    // and for each stage event. The utm only sticks to the entry event, so we
    // key off any li_ads event in the session then read ALL of its events.
    // The referrer predicate is a fixed string (no user input) so it lives
    // inline rather than as a bound parameter.
    const [funnel] = await db`
      with paid as (
        select distinct session_id
        from public.funnel_events
        where utm_source = any(${PAID_LINKEDIN_SOURCES})
          and ts >= ${cutoff}
          and session_id is not null
      ),
      sess as (
        select fe.session_id,
          bool_or(fe.props->>'referrer' ilike '%linkedin.com%'
               or fe.props->>'referrer' ilike '%lnkd.in%')            as li_ref,
          bool_or(fe.event = 'quiz_start')                            as started,
          bool_or(fe.event = 'result_view')                          as completed,
          bool_or(fe.event = 'checkout_click')                       as checkout,
          bool_or(fe.event = 'email_submitted')                      as leads,
          bool_or(fe.event in ('share_click','pass_unlock'))         as referrals,
          bool_or(fe.event = 'starter_kit_click')                    as starter_kit,
          bool_or(fe.event = 'exit_rescue_accepted')                 as exit_rescue
        from public.funnel_events fe
        join paid using (session_id)
        where fe.ts >= ${cutoff}
        group by fe.session_id
      )
      select
        count(*) filter (where li_ref)::int       as saw_quiz,
        count(*) filter (where started)::int       as started,
        count(*) filter (where completed)::int     as completed_quiz,
        count(*) filter (where checkout)::int       as checkout,
        count(*) filter (where leads)::int          as leads,
        count(*) filter (where referrals)::int      as referrals,
        count(*) filter (where starter_kit)::int    as starter_kit,
        count(*) filter (where exit_rescue)::int    as exit_rescue
      from sess`;

    // Purchases attributed to paid ads (source of truth = submissions revenue).
    const [buy] = await db`
      select count(*)::int as buyers
      from public.submissions
      where archived_at is null and utm_source = any(${PAID_LINKEDIN_SOURCES})
        and lifetime_value_usd > 0
        and created_at >= ${cutoff}`;

    const completed = Number(funnel?.completed_quiz ?? 0);
    // "Saw quiz" is the bot-filtered reach; guard so it can never read below a
    // downstream stage (keeps the displayed funnel monotonic without capping
    // any real count downward).
    const saw = Math.max(Number(funnel?.saw_quiz ?? 0), completed);
    const checkout = Number(funnel?.checkout ?? 0);
    // A purchase can't exceed a checkout click.
    const converted = Math.min(Number(buy?.buyers ?? 0), checkout);

    const stages = [
      { key: "saw_quiz", label: "Saw quiz", sessions: saw },
      { key: "completed_quiz", label: "Completed quiz", sessions: completed },
      { key: "checkout_click", label: "Clicked checkout", sessions: checkout },
      { key: "purchase", label: "Converted", sessions: converted },
    ];

    const secondary = {
      started: Number(funnel?.started ?? 0),
      leads: Number(funnel?.leads ?? 0),
      referrals: Number(funnel?.referrals ?? 0),
      starterKit: Number(funnel?.starter_kit ?? 0),
      exitRescue: Number(funnel?.exit_rescue ?? 0),
    };

    return NextResponse.json({
      ok: true,
      days,
      source: "li_ads",
      filter: "linkedin_referrer_top_only",
      note: "Saw-quiz counts only li_ads sessions with a LinkedIn referrer (real ad clicks, excluding ad-verification bots & Audience-Network noise). Completed/checkout count all real humans — bots never progress past the landing.",
      stages,
      secondary,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
