import { NextRequest, NextResponse } from "next/server";
import { getQuizDb, PAID_LINKEDIN_SOURCES } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent ad-driven quiz activity — the "what did that LinkedIn conversion count"
// feed. Each row maps to what LinkedIn attributes: a completed quiz = a "Quiz
// Completed" conversion; a buyer row = a purchase (CAPI) conversion.
//
// Anonymized on purpose: only the quiz outcome (score/archetype/goal), the
// campaign tag (utm_ref), buyer flag + value, and the timestamp. No name/email/
// ip/linkedin_url/stripe ids ever leave the DB.
export async function GET(req: NextRequest) {
  const db = getQuizDb();
  if (!db) {
    return NextResponse.json({ ok: false, skipped: "set SUPABASE_DATABASE_URL in the environment" });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 15, 1), 50);

  try {
    const rows = await db`
      select
        (extract(epoch from created_at) * 1000)::bigint as at_ms,
        coalesce(nullif(utm_ref, ''), '(none)') as utm_ref,
        score,
        archetype,
        main_goal,
        (coalesce(lifetime_value_usd, 0) > 0) as is_buyer,
        coalesce(lifetime_value_usd, 0)::float8 as ltv
      from public.submissions
      where archived_at is null and utm_source = any(${PAID_LINKEDIN_SOURCES})
      order by created_at desc
      limit ${limit}`;

    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        atMs: Number(r.at_ms),
        utmRef: r.utm_ref as string,
        score: r.score as number | null,
        archetype: (r.archetype as string | null) ?? null,
        goal: (r.main_goal as string | null) ?? null,
        isBuyer: r.is_buyer as boolean,
        ltv: Number(r.ltv),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
