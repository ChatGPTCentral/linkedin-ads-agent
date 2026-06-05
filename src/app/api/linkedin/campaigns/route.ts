import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liPost } from "@/lib/linkedin/client";
import { AUDIENCES, AD_COPY } from "@/data/linkedin";
import { resolveAudienceFacets, resolveExcludedLocations, buildTargetingCriteria } from "@/lib/linkedin/targeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LinkedIn returns the created entity id in a response header. */
function createdId(res: Response): string | null {
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
}

// Creates a Campaign Group + Campaign in PAUSED/DRAFT state. Never launches
// spend — a human reviews targeting + adds creative in Campaign Manager first.
export async function POST(req: NextRequest) {
  const { audienceId, copyId, adAccountUrn, dailyBudgetUsd } = (await req.json()) as {
    audienceId?: string;
    copyId?: string;
    adAccountUrn?: string;
    dailyBudgetUsd?: number;
  };

  const audience = AUDIENCES.find((a) => a.id === audienceId);
  if (!audience) return NextResponse.json({ error: "unknown_audience" }, { status: 400 });
  if (!adAccountUrn) return NextResponse.json({ error: "adAccountUrn_required" }, { status: 400 });

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  // 1) Campaign group (DRAFT)
  const cgRes = await liPost(
    "/adCampaignGroups",
    { account: adAccountUrn, name: `[Designer] ${audience.name}`, status: "DRAFT" },
    t.accessToken
  );
  if (!cgRes.ok) {
    return NextResponse.json({ step: "campaignGroup", status: cgRes.status, error: (await cgRes.text()).slice(0, 600) }, { status: 502 });
  }
  const campaignGroupUrn = createdId(cgRes);

  // 2) Targeting
  const include = await resolveAudienceFacets(audience, t.accessToken);
  const exclude = await resolveExcludedLocations(audience, t.accessToken);
  const targetingCriteria = buildTargetingCriteria(include, exclude);

  // 3) Campaign (PAUSED)
  const budget = Math.max(dailyBudgetUsd ?? 25, 10);
  const campaign = {
    account: adAccountUrn,
    campaignGroup: campaignGroupUrn,
    name: `[Designer] ${audience.name}`,
    type: "SPONSORED_UPDATES",
    costType: "CPM",
    dailyBudget: { amount: String(budget), currencyCode: "USD" },
    unitCost: { amount: "10", currencyCode: "USD" },
    locale: { country: "US", language: "en" },
    targetingCriteria,
    objectiveType: "WEBSITE_VISIT",
    status: "PAUSED",
  };
  const cRes = await liPost("/adCampaigns", campaign, t.accessToken);
  if (!cRes.ok) {
    return NextResponse.json(
      { step: "campaign", campaignGroupUrn, status: cRes.status, error: (await cRes.text()).slice(0, 600), targetingCriteria },
      { status: 502 }
    );
  }

  const copy = AD_COPY.find((v) => v.id === copyId);
  return NextResponse.json({
    ok: true,
    status: "PAUSED",
    created: { campaignGroupUrn, campaignUrn: createdId(cRes) },
    note: "Created PAUSED. Add a creative (copy below), review targeting, then launch in Campaign Manager.",
    suggestedCopy: copy ?? null,
    unresolvedFacets: include.flatMap((f) => f.unresolved ?? []),
    targetingCriteria,
  });
}
