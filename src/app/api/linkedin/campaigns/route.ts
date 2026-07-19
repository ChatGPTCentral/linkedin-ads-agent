import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet, liPost, liPut, liPatch } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";
import { AUDIENCES, AD_COPY } from "@/data/linkedin";
import { resolveAudienceFacets, resolveExcludedLocations, buildTargetingCriteria } from "@/lib/linkedin/targeting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LinkedIn returns the created entity id in a response header. */
function createdId(res: Response): string | null {
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
}

// ---------------------------------------------------------------------------
// GET (audit) types + helpers. Read the live campaign config back from LinkedIn
// so we can verify what was actually set — especially the two settings that
// silently default the "wrong" way: LinkedIn Audience Network (offsiteDelivery)
// and Audience Expansion. Also surfaces manual bid, budget, and whether the
// campaign truly TARGETS a matched audience (retargeting) vs not.
// ---------------------------------------------------------------------------
type FacetMap = Record<string, string[]>;
interface TargetingCriteria {
  include?: { and?: { or?: FacetMap }[] };
  exclude?: { or?: FacetMap };
}
interface RawMoney {
  amount?: string;
  currencyCode?: string;
}
interface RawCampaign {
  id?: number | string;
  name?: string;
  status?: string;
  type?: string;
  format?: string;
  costType?: string;
  objectiveType?: string;
  optimizationTargetType?: string;
  unitCost?: RawMoney;
  dailyBudget?: RawMoney;
  totalBudget?: RawMoney;
  runSchedule?: { start?: number; end?: number };
  offsiteDeliveryEnabled?: boolean;
  audienceExpansionEnabled?: boolean;
  campaignGroup?: string;
  targetingCriteria?: TargetingCriteria;
}

// Contact lists / retargeting audiences live under these facets; their values
// are urn:li:adSegment / dmpSegment URNs. Presence in INCLUDE = true retargeting.
const MATCHED_AUDIENCE_FACETS = [
  "urn:li:adTargetingFacet:audienceMatchingSegments",
  "urn:li:adTargetingFacet:dynamicSegments",
];

function mergeOr(out: FacetMap, or: FacetMap | undefined): void {
  if (!or) return;
  for (const [facet, values] of Object.entries(or)) out[facet] = (out[facet] ?? []).concat(values ?? []);
}
function flattenInclude(inc: TargetingCriteria["include"]): FacetMap {
  const out: FacetMap = {};
  for (const g of inc?.and ?? []) mergeOr(out, g.or);
  return out;
}
function flattenExclude(exc: TargetingCriteria["exclude"]): FacetMap {
  const out: FacetMap = {};
  mergeOr(out, exc?.or);
  return out;
}
function humanizeFacets(m: FacetMap): FacetMap {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k.replace("urn:li:adTargetingFacet:", ""), v]));
}
function summarizeTargeting(tc: TargetingCriteria | undefined) {
  const includeRaw = flattenInclude(tc?.include);
  const excludeRaw = flattenExclude(tc?.exclude);
  return {
    include: humanizeFacets(includeRaw),
    exclude: humanizeFacets(excludeRaw),
    matchedAudienceSegments: {
      include: MATCHED_AUDIENCE_FACETS.flatMap((f) => includeRaw[f] ?? []),
      exclude: MATCHED_AUDIENCE_FACETS.flatMap((f) => excludeRaw[f] ?? []),
    },
  };
}
/** Tri-state: true/false when LinkedIn returns the flag, null when it's absent. */
function triState(v: boolean | undefined): boolean | null {
  return typeof v === "boolean" ? v : null;
}

// Creates an ACTIVE campaign group (an empty container never spends) holding a
// PAUSED campaign. Never launches spend — spend is gated at the campaign level,
// and a human reviews targeting + adds creative in Campaign Manager first.
// NOTE: LinkedIn rejects a PAUSED campaign under a DRAFT group
// (CONDITIONAL_INVALID_VALUE), so the group must be ACTIVE, not DRAFT.
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

  // 1) Campaign group (ACTIVE container — the campaign inside stays PAUSED, so
  //    nothing spends; LinkedIn forbids a PAUSED campaign under a DRAFT group).
  const cgRes = await liPost(
    `/adAccounts/${accountId}/adCampaignGroups`,
    {
      account,
      name: `[Designer] ${audience.name}`,
      status: "ACTIVE",
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

// GET: read-only auditor. Lists the account's campaigns with the config that
// matters for a launch review — objective, manual bid, budget, Audience-Network
// + Audience-Expansion flags, targeting (incl. matched-audience retargeting),
// and attached conversions. Never mutates anything.
export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account") || DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() ?? account;

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liGet(`/adAccounts/${accountId}/adCampaigns?q=search&count=100`, t.accessToken);
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ step: "list", status: res.status, error: text.slice(0, 600) }, { status: 502 });
  }
  let elements: RawCampaign[] = [];
  try {
    elements = (JSON.parse(text) as { elements?: RawCampaign[] }).elements ?? [];
  } catch {
    return NextResponse.json({ error: "bad_json_from_linkedin", sample: text.slice(0, 300) }, { status: 502 });
  }

  const LIVE = new Set(["ACTIVE", "PAUSED", "DRAFT"]);
  const campaigns = await Promise.all(
    elements.map(async (c) => {
      const urn = c.id != null ? `urn:li:sponsoredCampaign:${c.id}` : null;
      const targeting = summarizeTargeting(c.targetingCriteria);

      // Best-effort conversion associations (only for live campaigns; never
      // fail the whole response on a hiccup).
      let conversions: unknown = null;
      if (urn && LIVE.has(String(c.status))) {
        try {
          const cr = await liGet(`/campaignConversions?q=campaign&campaign=${encodeURIComponent(urn)}`, t.accessToken);
          if (cr.ok) {
            const cj = (await cr.json()) as { elements?: { conversion?: string }[] };
            conversions = (cj.elements ?? []).map((e) => e.conversion).filter(Boolean);
          } else {
            conversions = { status: cr.status };
          }
        } catch (e) {
          conversions = { error: (e as Error).message };
        }
      } else {
        conversions = { skipped: c.status ?? null };
      }

      return {
        id: c.id ?? null,
        urn,
        name: c.name ?? null,
        status: c.status ?? null,
        type: c.type ?? null,
        format: c.format ?? null,
        objectiveType: c.objectiveType ?? null,
        optimizationTargetType: c.optimizationTargetType ?? null,
        costType: c.costType ?? null,
        bid: c.unitCost ?? null,
        dailyBudget: c.dailyBudget ?? null,
        totalBudget: c.totalBudget ?? null,
        runSchedule: c.runSchedule ?? null,
        campaignGroup: c.campaignGroup ?? null,
        conversions,
        // Quick verdicts against the stated launch intent.
        audit: {
          audienceNetworkOn: triState(c.offsiteDeliveryEnabled), // want false (no LinkedIn Audience Network)
          audienceExpansionOn: triState(c.audienceExpansionEnabled), // want false (keep the ICP tight)
          targetsMatchedAudience: targeting.matchedAudienceSegments.include.length > 0, // want true for warm retargeting
        },
        targeting,
      };
    })
  );

  return NextResponse.json({ ok: true, account, count: campaigns.length, campaigns });
}

// PATCH: rename + change status (PAUSED / ACTIVE / ARCHIVED) on campaigns and/or
// campaign groups, batched. Used to apply a naming convention and archive/clean
// up without rebuilding anything. Body:
//   { updates: [{ type: "campaign"|"group", id, name?, status? }, ...], account? }
export async function PATCH(req: NextRequest) {
  const { account: acct, updates } = (await req.json()) as {
    account?: string;
    updates?: { type?: "campaign" | "group"; id: number | string; name?: string; status?: string }[];
  };
  if (!updates?.length) return NextResponse.json({ error: "no_updates" }, { status: 400 });

  const account = acct || DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() ?? account;

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const results = await Promise.all(
    updates.map(async (u) => {
      const set: Record<string, unknown> = {};
      if (typeof u.name === "string" && u.name.trim()) set.name = u.name.trim();
      if (typeof u.status === "string" && u.status.trim()) set.status = u.status.trim().toUpperCase();
      if (!Object.keys(set).length) return { id: u.id, ok: false, error: "nothing_to_update" };

      const coll = u.type === "group" ? "adCampaignGroups" : "adCampaigns";
      try {
        const res = await liPatch(`/adAccounts/${accountId}/${coll}/${u.id}`, set, t.accessToken);
        return res.ok
          ? { id: u.id, type: u.type ?? "campaign", ok: true, applied: set }
          : { id: u.id, type: u.type ?? "campaign", ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
      } catch (e) {
        return { id: u.id, type: u.type ?? "campaign", ok: false, error: (e as Error).message };
      }
    })
  );

  return NextResponse.json({ ok: true, account, results });
}
