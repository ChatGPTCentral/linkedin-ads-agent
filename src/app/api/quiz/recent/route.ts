import { NextRequest, NextResponse } from "next/server";
import { getQuizDb, PAID_LINKEDIN_SOURCES } from "@/lib/quiz/db";
import { getValidToken } from "@/lib/linkedin/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recent ad-driven quiz activity — the "what did that LinkedIn conversion count"
// feed. Each row maps to what LinkedIn attributes: a completed quiz = a "Quiz
// Completed" conversion; a buyer row = a purchase (CAPI) conversion.
//
// IDENTITY is gated: name / LinkedIn / company are included ONLY when the caller
// holds a valid LinkedIn operator session (the owner's per-browser cookie). An
// unauthenticated caller — e.g. the public alias, which bypasses SSO — gets the
// anonymized rows only (score, campaign tag, buyer flag). PII is never committed
// to the codebase; it's shown live to the authenticated owner only.
export async function GET(req: NextRequest) {
  const db = getQuizDb();
  if (!db) {
    return NextResponse.json({ ok: false, skipped: "set SUPABASE_DATABASE_URL in the environment" });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 15, 1), 50);
  const identified = !("error" in (await getValidToken()));

  try {
    const rows = await db`
      select
        id,
        (extract(epoch from created_at) * 1000)::bigint as at_ms,
        coalesce(nullif(utm_ref, ''), '(none)') as utm_ref,
        score,
        archetype,
        main_goal,
        (coalesce(lifetime_value_usd, 0) > 0) as is_buyer,
        coalesce(lifetime_value_usd, 0)::float8 as ltv,
        name,
        linkedin_url,
        company_name,
        coalesce(nullif(job_title_standardized, ''), job_title) as job_title
      from public.submissions
      where archived_at is null and utm_source = any(${PAID_LINKEDIN_SOURCES})
      order by created_at desc
      limit ${limit}`;

    return NextResponse.json({
      ok: true,
      identified,
      items: rows.map((r) => ({
        atMs: Number(r.at_ms),
        utmRef: r.utm_ref as string,
        score: (r.score as number | null) ?? null,
        archetype: (r.archetype as string | null) ?? null,
        goal: (r.main_goal as string | null) ?? null,
        isBuyer: r.is_buyer as boolean,
        ltv: Number(r.ltv),
        // Identity only for the authenticated operator.
        ...(identified
          ? {
              id: (r.id as string | null) ?? null,
              name: (r.name as string | null) ?? null,
              linkedinUrl: (r.linkedin_url as string | null) ?? null,
              company: (r.company_name as string | null) ?? null,
              jobTitle: (r.job_title as string | null) ?? null,
            }
          : {}),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
