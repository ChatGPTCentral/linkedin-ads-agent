import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liPost, liPut } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";
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
  const {
    audienceId,
    copyId,
    adAccountUrn,
    dailyBudgetUsd,
    objective,
    conversionUrn,
    optimizationTargetType,
    includeSegments,
    excludeSegments,
  } = (await req.json()) as {
    audienceId?: string;
    copyId?: string;
    adAccountUrn?: string;
    dailyBudgetUsd?: number;
    objective?: "WEBSITE_CONVERSION" | "WEBSITE_VISIT";
    conversionUrn?: string;
    optimizationTargetType?: string;
    includeSegments?: string[];
    excludeSegments?: string[];
  };

  const audience = AUDIENCES.find((a) => a.id === audienceId);
  if (!audience) return NextResponse.json({ error: "unknown_audience" }, { status: 400 });
  const account = adAccountUrn || DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() ?? account; // numeric id for path-scoped endpoints

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  // Scheduled to start tomorrow; the campaign stays PAUSED so nothing spends.
  // Satisfies LinkedIn's required runSchedule field.
  const startAt = Date.now() + 24 * 60 * 60 * 1000;

  // 1) Campaign group (DRAFT)
  const cgRes = await liPost(
    `/adAccounts/${accountId}/adCampaignGroups`,
    {
      account,
      name: `[Designer] ${audience.name}`,
      status: "DRAFT",
      runSchedule: { start: startAt },
    },
    t.accessToken
  );
  if (!cgRes.ok) {
    return NextResponse.json({ step: "campaignGroup", status: cgRes.status, error: (await cgRes.text()).slice(0, 600) }, { status: 502 });
  }
  const campaignGroupId = createdId(cgRes);
  const campaignGroupUrn = campaignGroupId ? `urn:li:sponsoredCampaignGroup:${campaignGroupId}` : null;

  // 2) Targeting
  const include = await resolveAudienceFacets(audience, t.accessToken);
  const exclude = await resolveExcludedLocations(audience, t.accessToken);
  const targetingCriteria = buildTargetingCriteria(include, exclude, { includeSegments, excludeSegments });

  // 3) Campaign (PAUSED). Default objective optimizes for conversions
  // (purchases); falls back to traffic (WEBSITE_VISIT) if requested.
  const budget = Math.max(dailyBudgetUsd ?? 25, 10);
  const objectiveType = objective === "WEBSITE_VISIT" ? "WEBSITE_VISIT" : "WEBSITE_CONVERSION";
  const campaign: Record<string, unknown> = {
    account,
    campaignGroup: campaignGroupUrn,
    name: `[Designer] ${audience.name}`,
    type: "SPONSORED_UPDATES",
    costType: "CPM",
    dailyBudget: { amount: String(budget), currencyCode: "USD" },
    unitCost: { amount: "10", currencyCode: "USD" },
    locale: { country: "US", language: "en" },
    runSchedule: { start: startAt },
    targetingCriteria,
    objectiveType,
    offsiteDeliveryEnabled: false,
    politicalIntent: "NOT_POLITICAL",
    status: "PAUSED",
  };
  if (objectiveType === "WEBSITE_CONVERSION") {
    campaign.optimizationTargetType = optimizationTargetType || "MAX_CONVERSION";
  }
  const cRes = await liPost(`/adAccounts/${accountId}/adCampaigns`, campaign, t.accessToken);
  if (!cRes.ok) {
    return NextResponse.json(
      { step: "campaign", campaignGroupUrn, status: cRes.status, error: (await cRes.text()).slice(0, 600), targetingCriteria },
      { status: 502 }
    );
  }

  const campaignId = createdId(cRes);
  const campaignUrn = campaignId ? `urn:li:sponsoredCampaign:${campaignId}` : null;

  // 4) Associate the conversion so the campaign can optimize for purchases.
  let conversionAssociation: { ok: boolean; status?: number; error?: string } | null = null;
  if (campaignUrn && conversionUrn) {
    const key = `(campaign:${encodeURIComponent(campaignUrn)},conversion:${encodeURIComponent(conversionUrn)})`;
    const aRes = await liPut(`/campaignConversions/${key}`, {}, t.accessToken);
    conversionAssociation = aRes.ok
      ? { ok: true }
      : { ok: false, status: aRes.status, error: (await aRes.text()).slice(0, 300) };
  }

  const copy = AD_COPY.find((v) => v.id === copyId);
  return NextResponse.json({
    ok: true,
    status: "PAUSED",
    objectiveType,
    created: { campaignGroupUrn, campaignUrn },
    conversionAssociation,
    note: "Created PAUSED. Add a creative (copy below), review targeting + conversion, then launch in Campaign Manager.",
    suggestedCopy: copy ?? null,
    unresolvedFacets: include.flatMap((f) => f.unresolved ?? []),
    targetingCriteria,
  });
}
