import { NextRequest, NextResponse } from "next/server";
import { getQuizDb } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Paid-LinkedIn quiz attribution: how many people completed the quiz from the
// ads, so the cockpit can compute cost-per-quiz (LinkedIn spend ÷ this count) —
// a "partial conversion" that lands far more often than a purchase.
//
// Attribution = the utm_source the ad URLs carry. Keep this to the PAID value
// only ("li_ads"); the bare "linkedin" source is organic posts and must not be
// counted here. Add more paid values if you introduce them.
const PAID_SOURCES = ["li_ads"];

export async function GET(req: NextRequest) {
  const db = getQuizDb();
  if (!db) {
    return NextResponse.json({ ok: false, skipped: "set SUPABASE_DATABASE_URL in the environment" });
  }
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 30, 1), 365);

  try {
    const rows = await db`
      select coalesce(nullif(utm_ref, ''), '(none)') as utm_ref, count(*)::int as fills
      from public.submissions
      where archived_at is null
        and utm_source = any(${PAID_SOURCES})
        and created_at >= now() - make_interval(days => ${days})
      group by 1
      order by fills desc`;
    const total = rows.reduce((s, r) => s + Number(r.fills), 0);
    return NextResponse.json({
      ok: true,
      days,
      sources: PAID_SOURCES,
      total,
      byRef: rows.map((r) => ({ utmRef: r.utm_ref, fills: Number(r.fills) })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
