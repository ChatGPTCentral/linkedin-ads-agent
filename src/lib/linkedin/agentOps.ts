import { getAgentToken } from "./serverToken";
import { liGet, liPost, liPut, liPatch } from "./client";
import { DEFAULT_AD_ACCOUNT_URN, LINKEDIN } from "./config";
import { computeMetrics, type CampaignMetric } from "./metrics";
import { sha256Email, normalizeConversionUrn } from "./capi";
import { GEO_URN, resolveAudienceFacets, resolveExcludedLocations, buildTargetingCriteria } from "./targeting";
import { AUDIENCES } from "@/data/linkedin";
import { getQuizDb } from "@/lib/quiz/db";

// Same core geography used across the app's cold/warm audiences (src/data/linkedin.ts
// GEO_GROUPS.tier1English) — kept as the default predictive-audience geo filter so
// lookalikes stay in the countries that actually convert.
const TIER1_ENGLISH = ["United States", "United Kingdom", "Canada", "Australia", "Ireland", "New Zealand"];

// Shared autonomous-ops logic, reused by /api/agent/report, /api/agent/execute
// and the /api/agent/tick cron. Everything here runs with the SERVER token
// (getAgentToken) — no browser.

const FIELDS = "impressions,clicks,landingPageClicks,costInUsd,externalWebsiteConversions,pivotValues";

function dateRange(days: number): string {
  const end = new Date();
  const start = new Date(Date.now() - days * 864e5);
  return (
    `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),` +
    `end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`
  );
}

async function analytics(account: string, pivot: string, days: number, token: string) {
  const base = `q=analytics&${dateRange(days)}&timeGranularity=ALL&pivot=${pivot}&accounts=List(${encodeURIComponent(account)})`;
  let res = await liGet(`/adAnalytics?${base}&fields=${FIELDS},conversionValueInLocalCurrency`, token);
  if (!res.ok) res = await liGet(`/adAnalytics?${base}&fields=${FIELDS}`, token);
  if (!res.ok) return { error: (await res.text()).slice(0, 300), computed: [] as unknown[] };
  const raw = (await res.json()) as { elements?: unknown[] };
  return computeMetrics(raw.elements ?? []);
}

/** Pull campaigns + campaign/creative analytics with the server token; store a snapshot. */
export async function takeSnapshot(days = 30) {
  const t = await getAgentToken();
  if ("error" in t) return { ok: false as const, error: t.error };
  const account = DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() ?? account;

  let campaigns: unknown[] = [];
  try {
    const cr = await liGet(`/adAccounts/${accountId}/adCampaigns?q=search&count=100`, t.accessToken);
    if (cr.ok) {
      const j = (await cr.json()) as { elements?: Record<string, unknown>[] };
      campaigns = (j.elements ?? []).map((c) => ({
        id: c.id ?? null,
        name: c.name ?? null,
        status: c.status ?? null,
        objectiveType: c.objectiveType ?? null,
        optimizationTargetType: c.optimizationTargetType ?? null,
        costType: c.costType ?? null,
        unitCost: c.unitCost ?? null,
        dailyBudget: c.dailyBudget ?? null,
        runSchedule: c.runSchedule ?? null,
      }));
    }
  } catch {
    /* keep empty */
  }

  const byCampaign = await analytics(account, "CAMPAIGN", days, t.accessToken);
  const byCreative = await analytics(account, "CREATIVE", days, t.accessToken);
  const takenAt = new Date().toISOString();
  const payload = { account, days, takenAt, campaigns, byCampaign, byCreative };

  let stored = false;
  try {
    const db = getQuizDb();
    if (db) {
      await db`insert into public.ops_snapshot (payload) values (${JSON.stringify(payload)}::jsonb)`;
      stored = true;
    }
  } catch {
    /* best-effort */
  }
  return { ok: true as const, stored, ...payload };
}

/** Read-only: current processing status of one or more DMP segments (Matched
 * Audiences / Predictive Audience parents). Takes up to 48h to reach READY —
 * this lets the operator check without guessing. No queue, no writes. */
export async function checkAudienceStatus(segmentIds: number[]) {
  const t = await getAgentToken();
  if ("error" in t) return { ok: false as const, error: t.error };
  if (!segmentIds.length) return { ok: false as const, error: "no_segment_ids" };
  const res = await liGet(`/dmpSegments?ids=List(${segmentIds.join(",")})`, t.accessToken);
  if (!res.ok) return { ok: false as const, error: (await res.text()).slice(0, 300) };
  const raw = (await res.json()) as {
    results?: Record<string, { name?: string; destinations?: { status?: string; audienceSize?: number; matchedCount?: number; destinationSegmentId?: string }[] }>;
  };
  const segments = Object.entries(raw.results ?? {}).map(([id, r]) => ({
    id: Number(id),
    name: r.name ?? null,
    status: r.destinations?.[0]?.status ?? null,
    audienceSize: r.destinations?.[0]?.audienceSize ?? null,
    matchedCount: r.destinations?.[0]?.matchedCount ?? null,
    adSegmentUrn: r.destinations?.[0]?.destinationSegmentId ?? null,
  }));
  return { ok: true as const, segments };
}

// ---- Action queue ----
const ALLOWED = new Set([
  "pause_creative",
  "resume_creative",
  "pause_campaign",
  "resume_campaign",
  "set_campaign_budget",
  "upload_creative",
  "upload_audience",
  "create_predictive_audience",
  "create_campaign",
  "attach_conversion",
]);
const MAX_DAILY_BUDGET_USD = 50; // hard guardrail, per campaign
// Hard guardrail across the WHOLE ad account: sum of every ACTIVE campaign's
// dailyBudget can never exceed this. This is the fixed cap the operator asked
// for after rejecting a variable cost-cap bid strategy — it bounds total
// possible daily spend regardless of how many campaigns exist or what any
// single one is set to. Covers the Sept plan (trial $12/day + quiz $22/day =
// $34/day, ~$1000/month) with headroom, not room for a surprise third campaign.
const MAX_TOTAL_DAILY_BUDGET_USD = 40;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://linkedin-ads-agent.vercel.app";

type Action = { id: number; kind: string; target_id: string; params: Record<string, unknown> | null };
type ApplyResult = {
  ok: boolean;
  rejected?: boolean;
  status?: number;
  error?: string;
  steps?: unknown[];
  creativeUrn?: string | null;
  segmentId?: number | null;
  predictiveAudienceId?: number | null;
  campaignUrn?: string | null;
};

// Sum of dailyBudget across every currently-ACTIVE campaign on the account,
// excluding one campaign id (used when re-budgeting an existing campaign so
// it isn't double-counted against itself). Backs MAX_TOTAL_DAILY_BUDGET_USD.
async function activeDailyBudgetTotal(accountId: string, token: string, excludeCampaignId?: string): Promise<number> {
  const res = await liGet(`/adAccounts/${accountId}/adCampaigns?q=search&search=(status:(values:List(ACTIVE)))&count=100`, token);
  if (!res.ok) return Infinity; // fail closed: if we can't verify, refuse to add more spend
  const j = (await res.json().catch(() => ({}))) as { elements?: { id?: number | string; dailyBudget?: { amount?: string } }[] };
  return (j.elements ?? [])
    .filter((c) => String(c.id) !== excludeCampaignId)
    .reduce((sum, c) => sum + (Number(c.dailyBudget?.amount) || 0), 0);
}

// Full single-image Sponsored Content upload: image asset -> dark post -> creative
// linked to the campaign (PAUSED). Returns per-step results so one test pinpoints
// any API-shape issue. LinkedIn's creative API is finicky; expect to iterate.
async function uploadCreative(a: Action, accountId: string, token: string): Promise<ApplyResult> {
  const steps: Record<string, unknown>[] = [];
  const p = a.params ?? {};
  const campaignId = a.target_id.split(":").pop();
  const imageFile = String(p.image ?? "");
  const text = String(p.text ?? "");
  const altText = String(p.altText ?? "AI Central — AI readiness quiz").slice(0, 290);
  if (!imageFile) return { ok: false, rejected: true, error: "missing_image", steps };

  // A) organization URN (the ad's author / image owner)
  const acctRes = await liGet(`/adAccounts/${accountId}`, token);
  const acct = (await acctRes.json().catch(() => ({}))) as { reference?: string };
  const orgUrn = acct.reference;
  steps.push({ step: "account", ok: acctRes.ok && !!orgUrn, orgUrn, status: acctRes.status });
  if (!orgUrn) return { ok: false, error: "no_org_urn", steps };

  // B) initialize image upload
  const initRes = await liPost(`/images?action=initializeUpload`, { initializeUploadRequest: { owner: orgUrn } }, token);
  const init = (await initRes.json().catch(() => ({}))) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  steps.push({ step: "initImage", ok: initRes.ok && !!uploadUrl, imageUrn, status: initRes.status, error: initRes.ok ? undefined : JSON.stringify(init).slice(0, 300) });
  if (!uploadUrl || !imageUrn) return { ok: false, error: "init_image_failed", steps };

  // C) upload the bytes (fetched from our own deployed public URL)
  const imgRes = await fetch(`${BASE_URL}/creatives/${imageFile}`);
  if (!imgRes.ok) {
    steps.push({ step: "fetchImage", ok: false, status: imgRes.status });
    return { ok: false, error: "image_fetch_failed", steps };
  }
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  const up = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" }, body: bytes });
  steps.push({ step: "uploadBytes", ok: up.ok, status: up.status, bytes: bytes.length, error: up.ok ? undefined : (await up.text()).slice(0, 200) });
  if (!up.ok) return { ok: false, error: "upload_bytes_failed", steps };

  // give LinkedIn a moment to process the image before referencing it
  await new Promise((r) => setTimeout(r, 3000));

  // D) create a dark post (feedDistribution NONE) with the image. Direct
  // Sponsored Content posts must declare which ad account they belong to via
  // adContext.dscAdAccount (LinkedIn: MISSING_REQUIRED_FIELD_FOR_DSC otherwise).
  const postRes = await liPost(
    `/posts`,
    {
      author: orgUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "NONE", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: imageUrn, altText } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      adContext: { dscAdAccount: `urn:li:sponsoredAccount:${accountId}` },
    },
    token
  );
  const postUrn = postRes.headers.get("x-restli-id") || postRes.headers.get("x-linkedin-id");
  steps.push({ step: "createPost", ok: postRes.ok && !!postUrn, postUrn, status: postRes.status, error: postRes.ok ? undefined : (await postRes.text()).slice(0, 300) });
  if (!postUrn) return { ok: false, error: "create_post_failed", steps };

  // E) create the creative under the campaign. intendedStatus is required but
  // can't be PAUSED/ACTIVE pre-review ("transition not allowed from null" until
  // reviewStatus is APPROVED) — DRAFT is the valid pre-review starting state and
  // guarantees no delivery until the operator reviews + launches it.
  const campaignUrn = `urn:li:sponsoredCampaign:${campaignId}`;
  const crRes = await liPost(`/adAccounts/${accountId}/creatives`, { campaign: campaignUrn, content: { reference: postUrn }, intendedStatus: "DRAFT" }, token);
  const creativeUrn = crRes.headers.get("x-restli-id") || crRes.headers.get("x-linkedin-id");
  steps.push({ step: "createCreative", ok: crRes.ok, creativeUrn, status: crRes.status, error: crRes.ok ? undefined : (await crRes.text()).slice(0, 300) });
  if (!crRes.ok) return { ok: false, error: "create_creative_failed", steps };
  return { ok: true, steps, creativeUrn };
}

// Matched Audience (DMP Segment) upload — streaming method, not CSV. Reads a
// prepared, deduped email list from public.ops_audience_seed (list_name =
// params.listName), creates an empty USER segment, waits 5s (LinkedIn
// requirement), then streams every email — hashed SHA-256 — in ONE batch (our
// lists are all under the 5000-per-batch cap). LinkedIn takes up to 48h to
// match + approve the segment before it's usable in campaign targeting.
async function uploadAudience(a: Action, accountId: string, token: string): Promise<ApplyResult> {
  const steps: Record<string, unknown>[] = [];
  const p = a.params ?? {};
  const listName = String(p.listName ?? "");
  const name = String(p.name ?? listName);
  const account = `urn:li:sponsoredAccount:${accountId}`;
  if (!listName) return { ok: false, rejected: true, error: "missing_listName", steps };

  const db = getQuizDb();
  if (!db) return { ok: false, error: "no_db", steps };
  const rows = (await db`select email from public.ops_audience_seed where list_name = ${listName}`) as unknown as { email: string }[];
  const emails = rows.map((r) => r.email).filter(Boolean);
  steps.push({ step: "readSeedList", ok: emails.length > 0, count: emails.length });
  if (!emails.length) return { ok: false, error: "empty_list", steps };
  if (emails.length > 5000) return { ok: false, rejected: true, error: "list_too_large_for_single_batch", steps };

  // A) create the empty segment
  const segRes = await liPost(
    "/dmpSegments",
    { name, account, type: "USER", sourcePlatform: "DIRECT_API", destinations: [{ destination: "LINKEDIN" }] },
    token
  );
  const segIdRaw = segRes.headers.get("x-restli-id") || segRes.headers.get("x-linkedin-id");
  const segmentId = segIdRaw ? Number(segIdRaw) : null;
  steps.push({ step: "createSegment", ok: segRes.ok && !!segmentId, segmentId, status: segRes.status, error: segRes.ok ? undefined : (await segRes.text()).slice(0, 300) });
  if (!segmentId) return { ok: false, error: "create_segment_failed", steps };

  // B) LinkedIn requires a short wait before the segment accepts users. In
  // practice propagation can occasionally exceed the documented 5s, so retry
  // once with a longer wait if the first attempt reports "not found".
  const elements = emails.map((email) => ({ action: "ADD", userIds: [{ idType: "SHA256_EMAIL", idValue: sha256Email(email) }] }));
  const streamUsers = () =>
    fetch(`${LINKEDIN.apiBase}/dmpSegments/${segmentId}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": LINKEDIN.version,
        "X-Restli-Protocol-Version": "2.0.0",
        "X-RestLi-Method": "BATCH_CREATE",
      },
      body: JSON.stringify({ elements }),
    });

  await new Promise((r) => setTimeout(r, 5000));
  let usersRes = await streamUsers();
  if (usersRes.status === 404) {
    steps.push({ step: "streamUsers", ok: false, status: 404, note: "segment not yet propagated — retrying after a longer wait" });
    await new Promise((r) => setTimeout(r, 15000));
    usersRes = await streamUsers();
  }

  const usersOk = usersRes.ok;
  steps.push({ step: "streamUsers", ok: usersOk, status: usersRes.status, sent: elements.length, error: usersOk ? undefined : (await usersRes.text()).slice(0, 400) });
  if (!usersOk) return { ok: false, error: "stream_users_failed", steps, segmentId };

  return { ok: true, steps, segmentId };
}

// Predictive Audience (LinkedIn's lookalike). Two-step, because a Predictive
// Audience must live under its OWN parent DMP segment — one whose
// sourcePlatform is specifically LINKEDIN_BUSINESS_OBJECTIVE_BASED_AUDIENCES
// (a plain contact-list segment like our "buyers" one can't host it directly).
// That parent segment is then given a "seed" pointing at our real buyers
// segment (urn:li:dmpSegment:<seedSegmentId>) and LinkedIn's model finds
// similar members. A geo filter is mandatory — defaults to the same
// tier1English countries used across the app's cold/warm audiences.
async function createPredictiveAudience(a: Action, accountId: string, token: string): Promise<ApplyResult> {
  const steps: Record<string, unknown>[] = [];
  const p = a.params ?? {};
  const seedSegmentId = Number(p.seedSegmentId);
  const name = String(p.name ?? "Predictive Audience — Buyers lookalike");
  const locations: string[] = Array.isArray(p.locations) && p.locations.length ? (p.locations as string[]) : TIER1_ENGLISH;
  const account = `urn:li:sponsoredAccount:${accountId}`;
  if (!seedSegmentId) return { ok: false, rejected: true, error: "missing_seedSegmentId", steps };

  const geoUrns = locations.map((l) => GEO_URN[l]).filter(Boolean);
  if (!geoUrns.length) return { ok: false, rejected: true, error: "no_resolvable_locations", steps };

  // A) create the parent container segment
  const parentRes = await liPost(
    "/dmpSegments",
    { name, account, type: "USER", sourcePlatform: "LINKEDIN_BUSINESS_OBJECTIVE_BASED_AUDIENCES", destinations: [{ destination: "LINKEDIN" }] },
    token
  );
  const parentIdRaw = parentRes.headers.get("x-restli-id") || parentRes.headers.get("x-linkedin-id");
  const parentSegmentId = parentIdRaw ? Number(parentIdRaw) : null;
  steps.push({ step: "createParentSegment", ok: parentRes.ok && !!parentSegmentId, parentSegmentId, status: parentRes.status, error: parentRes.ok ? undefined : (await parentRes.text()).slice(0, 300) });
  if (!parentSegmentId) return { ok: false, error: "create_parent_segment_failed", steps };

  // B) same propagation lag as regular segments — wait, retry once on 404
  const createBOBA = () =>
    liPost(
      `/dmpSegments/${parentSegmentId}/businessObjectiveBasedAudiences`,
      {
        targetingFilter: { include: { and: [{ or: { "urn:li:adTargetingFacet:locations": geoUrns } }] } },
        seeds: [`urn:li:dmpSegment:${seedSegmentId}`],
      },
      token
    );

  await new Promise((r) => setTimeout(r, 5000));
  let paRes = await createBOBA();
  if (paRes.status === 404) {
    steps.push({ step: "createPredictiveAudience", ok: false, status: 404, note: "parent segment not yet propagated — retrying after a longer wait" });
    await new Promise((r) => setTimeout(r, 15000));
    paRes = await createBOBA();
  }
  const paIdRaw = paRes.headers.get("x-restli-id") || paRes.headers.get("x-linkedin-id");
  const predictiveAudienceId = paIdRaw ? Number(paIdRaw) : null;
  steps.push({ step: "createPredictiveAudience", ok: paRes.ok && !!predictiveAudienceId, predictiveAudienceId, status: paRes.status, error: paRes.ok ? undefined : (await paRes.text()).slice(0, 300) });
  if (!predictiveAudienceId) return { ok: false, error: "create_predictive_audience_failed", steps, segmentId: parentSegmentId };

  return { ok: true, steps, segmentId: parentSegmentId, predictiveAudienceId };
}

// Attach one or more conversions to an existing campaign. campaignConversions
// keys conversions under the urn:lla:llaPartnerConversion namespace — not
// urn:li:conversion, which 400s here ("Compound key parameter value ... is
// invalid") even though it's the id format Campaign Manager displays.
// normalizeConversionUrn (capi.ts) converts either form to the right one. The
// PUT body must also explicitly repeat both URNs — LinkedIn rejects an empty
// body even though the pair is already in the URL's compound key. Shared by
// createCampaign's step 4 and the standalone attach_conversion action (used
// to repair a campaign created before a conversion association failed, or to
// add tracking-only conversions after the fact).
//
// A campaign attached immediately after creation can 404 ("Requester does not
// have permission to UPDATE the resource") purely from propagation lag — the
// same class of issue as the DMP segment 5s wait elsewhere in this file, not
// a real permission gap (confirmed: retrying the identical call moments later
// succeeds). Retry once with a short wait on 404 before giving up.
async function attachConversionsToCampaign(campaignUrn: string, conversions: string[], token: string): Promise<Record<string, unknown>[]> {
  const steps: Record<string, unknown>[] = [];
  for (const conv of conversions) {
    const conversionUrnNormalized = normalizeConversionUrn(conv);
    const key = `(campaign:${encodeURIComponent(campaignUrn)},conversion:${encodeURIComponent(conversionUrnNormalized)})`;
    const body = { campaign: campaignUrn, conversion: conversionUrnNormalized };
    let aRes = await liPut(`/campaignConversions/${key}`, body, token);
    let retried = false;
    if (!aRes.ok && aRes.status === 404) {
      await new Promise((r) => setTimeout(r, 8000));
      aRes = await liPut(`/campaignConversions/${key}`, body, token);
      retried = true;
    }
    steps.push({ step: "attachConversion", conversion: conversionUrnNormalized, ok: aRes.ok, status: aRes.status, retried, error: aRes.ok ? undefined : (await aRes.text()).slice(0, 200) });
  }
  return steps;
}

async function attachConversion(a: Action, token: string): Promise<ApplyResult> {
  const campaignUrn = a.target_id.startsWith("urn:") ? a.target_id : `urn:li:sponsoredCampaign:${a.target_id}`;
  const p = a.params ?? {};
  const conversionUrn = p.conversionUrn ? String(p.conversionUrn) : undefined;
  const conversionUrns = Array.isArray(p.conversionUrns) ? (p.conversionUrns as string[]) : [];
  const allConversions = Array.from(new Set([conversionUrn, ...conversionUrns].filter(Boolean))) as string[];
  if (!allConversions.length) return { ok: false, rejected: true, error: "missing_conversionUrn", steps: [] };
  const steps = await attachConversionsToCampaign(campaignUrn, allConversions, token);
  const allOk = steps.every((s) => Boolean((s as { ok?: boolean }).ok));
  return { ok: allOk, steps, error: allOk ? undefined : "one_or_more_associations_failed" };
}

// Full campaign creation with the SERVER token — mirrors the browser-token
// route (/api/linkedin/campaigns POST) exactly (same group->campaign->
// conversion-association flow), so the operator no longer has to click
// "Create" in the browser for every new campaign. ALWAYS creates PAUSED —
// nothing spends until the operator explicitly resumes it (a separate,
// deliberate action).
async function createCampaign(a: Action, accountId: string, token: string): Promise<ApplyResult> {
  const steps: Record<string, unknown>[] = [];
  const p = a.params ?? {};
  const audienceId = String(p.audienceId ?? "");
  const audience = AUDIENCES.find((x) => x.id === audienceId);
  if (!audience) return { ok: false, rejected: true, error: "unknown_audience", steps };

  const account = `urn:li:sponsoredAccount:${accountId}`;
  const name = String(p.name ?? `[Agent] ${audience.name}`);
  const dailyBudgetUsd = Math.max(Number(p.dailyBudgetUsd) || 25, 10);
  if (dailyBudgetUsd > MAX_DAILY_BUDGET_USD) return { ok: false, rejected: true, error: `over_cap_${MAX_DAILY_BUDGET_USD}`, steps };
  // Campaigns are created PAUSED (below), but check the account-wide cap now
  // against what WOULD be active once this one is turned on, so the operator
  // never has to remember to check before resuming it.
  const currentTotal = await activeDailyBudgetTotal(accountId, token);
  if (currentTotal + dailyBudgetUsd > MAX_TOTAL_DAILY_BUDGET_USD) {
    return { ok: false, rejected: true, error: `over_account_cap_${MAX_TOTAL_DAILY_BUDGET_USD}_current_${currentTotal}`, steps };
  }
  const objectiveType = p.objective === "WEBSITE_VISIT" ? "WEBSITE_VISIT" : "WEBSITE_CONVERSION";
  const conversionUrn = p.conversionUrn ? String(p.conversionUrn) : undefined;
  const conversionUrns = Array.isArray(p.conversionUrns) ? (p.conversionUrns as string[]) : [];
  const includeSegments = Array.isArray(p.includeSegments) ? (p.includeSegments as string[]) : undefined;
  const excludeSegments = Array.isArray(p.excludeSegments) ? (p.excludeSegments as string[]) : undefined;

  const startAt = Date.now() + 10 * 60 * 1000;

  // 1) Campaign group (ACTIVE container; the campaign inside stays PAUSED).
  const cgRes = await liPost(`/adAccounts/${accountId}/adCampaignGroups`, { account, name, status: "ACTIVE", runSchedule: { start: startAt } }, token);
  const campaignGroupId = cgRes.headers.get("x-restli-id") || cgRes.headers.get("x-linkedin-id");
  const campaignGroupUrn = campaignGroupId ? `urn:li:sponsoredCampaignGroup:${campaignGroupId}` : null;
  steps.push({ step: "createCampaignGroup", ok: cgRes.ok && !!campaignGroupUrn, campaignGroupUrn, status: cgRes.status, error: cgRes.ok ? undefined : (await cgRes.text()).slice(0, 300) });
  if (!campaignGroupUrn) return { ok: false, error: "create_group_failed", steps };

  // 2) Targeting
  const include = await resolveAudienceFacets(audience, token);
  const exclude = await resolveExcludedLocations(audience, token);
  const targetingCriteria = buildTargetingCriteria(include, exclude, { includeSegments, excludeSegments });

  // 3) Campaign — always PAUSED
  const campaign: Record<string, unknown> = {
    account,
    campaignGroup: campaignGroupUrn,
    name,
    type: "SPONSORED_UPDATES",
    costType: "CPM",
    dailyBudget: { amount: String(dailyBudgetUsd), currencyCode: "USD" },
    unitCost: { amount: "10", currencyCode: "USD" },
    locale: { country: "US", language: "en" },
    runSchedule: { start: startAt },
    targetingCriteria,
    objectiveType,
    offsiteDeliveryEnabled: false,
    politicalIntent: "NOT_POLITICAL",
    status: "PAUSED",
  };
  if (objectiveType === "WEBSITE_CONVERSION") campaign.optimizationTargetType = String(p.optimizationTargetType ?? "MAX_CONVERSION");

  const cRes = await liPost(`/adAccounts/${accountId}/adCampaigns`, campaign, token);
  const campaignId = cRes.headers.get("x-restli-id") || cRes.headers.get("x-linkedin-id");
  const campaignUrn = campaignId ? `urn:li:sponsoredCampaign:${campaignId}` : null;
  steps.push({ step: "createCampaign", ok: cRes.ok && !!campaignUrn, campaignUrn, status: cRes.status, error: cRes.ok ? undefined : (await cRes.text()).slice(0, 300), targetingCriteria });
  if (!campaignUrn) return { ok: false, error: "create_campaign_failed", steps };

  // 4) Attach conversions (optimize target first, rest tracked).
  const allConversions = Array.from(new Set([conversionUrn, ...conversionUrns].filter(Boolean))) as string[];
  steps.push(...(await attachConversionsToCampaign(campaignUrn, allConversions, token)));

  return { ok: true, steps, campaignUrn };
}

async function applyAction(a: Action, accountId: string, token: string): Promise<ApplyResult> {
  if (!ALLOWED.has(a.kind)) return { ok: false, rejected: true, error: "kind_not_allowed" };

  if (a.kind === "pause_creative" || a.kind === "resume_creative") {
    const intendedStatus = a.kind === "pause_creative" ? "PAUSED" : "ACTIVE";
    const urn = a.target_id.startsWith("urn:") ? a.target_id : `urn:li:sponsoredCreative:${a.target_id}`;
    const res = await liPatch(`/adAccounts/${accountId}/creatives/${encodeURIComponent(urn)}`, { intendedStatus }, token);
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  }
  if (a.kind === "pause_campaign" || a.kind === "resume_campaign") {
    const status = a.kind === "pause_campaign" ? "PAUSED" : "ACTIVE";
    const id = a.target_id.split(":").pop();
    const res = await liPatch(`/adAccounts/${accountId}/adCampaigns/${id}`, { status }, token);
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  }
  if (a.kind === "set_campaign_budget") {
    const amount = Number((a.params ?? {}).dailyUsd);
    if (!(amount > 0)) return { ok: false, rejected: true, error: "bad_amount" };
    if (amount > MAX_DAILY_BUDGET_USD) return { ok: false, rejected: true, error: `over_cap_${MAX_DAILY_BUDGET_USD}` };
    const id = a.target_id.split(":").pop();
    const currentTotal = await activeDailyBudgetTotal(accountId, token, id);
    if (currentTotal + amount > MAX_TOTAL_DAILY_BUDGET_USD) {
      return { ok: false, rejected: true, error: `over_account_cap_${MAX_TOTAL_DAILY_BUDGET_USD}_current_${currentTotal}` };
    }
    const res = await liPatch(`/adAccounts/${accountId}/adCampaigns/${id}`, { dailyBudget: { amount: String(amount), currencyCode: "USD" } }, token);
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  }
  if (a.kind === "upload_creative") {
    return uploadCreative(a, accountId, token);
  }
  if (a.kind === "upload_audience") {
    return uploadAudience(a, accountId, token);
  }
  if (a.kind === "create_predictive_audience") {
    return createPredictiveAudience(a, accountId, token);
  }
  if (a.kind === "create_campaign") {
    return createCampaign(a, accountId, token);
  }
  if (a.kind === "attach_conversion") {
    return attachConversion(a, token);
  }
  return { ok: false, rejected: true, error: "unhandled" };
}

/** Apply all pending rows in public.ops_action under the guardrails; log each. */
export async function processActionQueue() {
  const t = await getAgentToken();
  if ("error" in t) return { ok: false as const, error: t.error };
  const db = getQuizDb();
  if (!db) return { ok: false as const, error: "no_db (set SUPABASE_DATABASE_URL)" };

  const accountId = DEFAULT_AD_ACCOUNT_URN.split(":").pop() as string;
  const pending = (await db`select id, kind, target_id, params from public.ops_action where status = 'pending' order by id asc limit 25`) as unknown as Action[];

  const results: Array<{ id: number; kind: string; target: string; outcome: string } & ApplyResult> = [];
  for (const a of pending) {
    let r: ApplyResult;
    try {
      r = await applyAction(a, accountId, t.accessToken);
    } catch (e) {
      r = { ok: false, error: (e as Error).message };
    }
    const outcome = r.rejected ? "rejected" : r.ok ? "done" : "failed";
    await db`update public.ops_action set status = ${outcome}, result = ${JSON.stringify(r)}::jsonb, applied_at = now() where id = ${a.id}`;
    results.push({ id: a.id, kind: a.kind, target: a.target_id, outcome, ...r });
  }
  return { ok: true as const, processed: results.length, results };
}

// ---- Self-learning pass ----
const OPTIMIZATION_WINDOW_DAYS = 3;
const OPTIMIZATION_CPA_MULTIPLIER = 2; // auto-pause once trailing CPA passes this many times the target

/**
 * The continuous-optimization half of the agent, run every hour by the cron
 * tick alongside the action queue. Reads per-campaign CPA targets from
 * public.ops_campaign_target, compares each ACTIVE campaign's trailing
 * 3-day cost-per-conversion (real CAPI conversions, not clicks) against its
 * target, and — only when spend has crossed the campaign's min_spend_usd
 * floor, so one unlucky day of clicks can't trigger it — queues a
 * pause_campaign action for anything running at more than 2x its target.
 * The queued action is executed by the SAME tick's processActionQueue() call
 * (see /api/agent/tick), so a bad campaign is paused within the hour it
 * crosses the line, not the next time someone happens to check.
 *
 * Every campaign with a target gets a logged decision every pass — paused,
 * left alone (on target / not enough spend yet / not active) — in
 * public.ops_optimization_log, so "what did the agent decide and why" is a
 * queryable history, not something the operator has to take on faith.
 *
 * Deliberately one-directional: this never resumes a paused campaign, never
 * raises a budget, and never creates a campaign. Auto-pause is the only
 * autonomous lever because it can only ever reduce spend — unlike an
 * auto-increase, it can't compound into a surprise bill. Turning a campaign
 * back on, raising its budget, or launching a new one always goes through
 * an explicit queued ops_action the operator reviews.
 */
export async function runOptimizationPass() {
  const t = await getAgentToken();
  if ("error" in t) return { ok: false as const, error: t.error };
  const db = getQuizDb();
  if (!db) return { ok: false as const, error: "no_db (set SUPABASE_DATABASE_URL)" };

  const targets = (await db`select campaign_urn, label, target_cpa_usd, min_spend_usd from public.ops_campaign_target where enabled = true`) as unknown as {
    campaign_urn: string;
    label: string | null;
    target_cpa_usd: string | number;
    min_spend_usd: string | number;
  }[];
  if (!targets.length) return { ok: true as const, checked: 0, decisions: [] };

  const account = DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() as string;

  const statusRes = await liGet(`/adAccounts/${accountId}/adCampaigns?q=search&count=100`, t.accessToken);
  const statusJson = statusRes.ok
    ? ((await statusRes.json().catch(() => ({}))) as { elements?: { id?: number | string; status?: string }[] })
    : { elements: [] as { id?: number | string; status?: string }[] };
  const statusById = new Map((statusJson.elements ?? []).map((c) => [`urn:li:sponsoredCampaign:${c.id}`, c.status ?? null]));

  const perf = await analytics(account, "CAMPAIGN", OPTIMIZATION_WINDOW_DAYS, t.accessToken);
  const perfComputed: CampaignMetric[] = "computed" in perf ? (perf.computed as CampaignMetric[]) : [];
  const byCampaign = new Map<string | null, CampaignMetric>(perfComputed.map((m) => [m.campaign, m]));

  const decisions: Array<{ campaignUrn: string; label: string | null; decision: string; reason: string; metrics: Record<string, unknown> }> = [];

  for (const target of targets) {
    const status = statusById.get(target.campaign_urn) ?? null;
    const m = byCampaign.get(target.campaign_urn);
    const spend = m?.spend ?? 0;
    const conversions = m?.conversions ?? 0;
    const cpa = m?.cpa ?? null;
    const targetCpa = Number(target.target_cpa_usd);
    const minSpend = Number(target.min_spend_usd);
    const metrics = { windowDays: OPTIMIZATION_WINDOW_DAYS, spend, conversions, cpa, targetCpa, minSpend, status };

    let decision: string;
    let reason: string;

    if (status !== "ACTIVE") {
      decision = "skipped_not_active";
      reason = `campaign status is ${status ?? "unknown"}, nothing to evaluate`;
    } else if (spend < minSpend) {
      decision = "left_alone_below_min_spend";
      reason = `spent $${spend.toFixed(2)} of the $${minSpend} minimum needed before judging — too early to call`;
    } else if (cpa !== null && cpa > targetCpa * OPTIMIZATION_CPA_MULTIPLIER) {
      decision = "paused";
      reason = `trailing ${OPTIMIZATION_WINDOW_DAYS}d CPA $${cpa.toFixed(2)} is over ${OPTIMIZATION_CPA_MULTIPLIER}x the $${targetCpa} target (${conversions} conversions on $${spend.toFixed(2)} spend)`;
      await db`insert into public.ops_action (kind, target_id, params, status)
                values ('pause_campaign', ${target.campaign_urn}, ${JSON.stringify({ reason: `auto: ${reason}`, source: "runOptimizationPass" })}::jsonb, 'pending')`;
    } else {
      decision = "left_alone_on_target";
      reason = cpa === null
        ? `$${spend.toFixed(2)} spent past the min-spend floor with 0 conversions yet in the window — watching`
        : `trailing CPA $${cpa.toFixed(2)} is within ${OPTIMIZATION_CPA_MULTIPLIER}x of the $${targetCpa} target`;
    }

    decisions.push({ campaignUrn: target.campaign_urn, label: target.label, decision, reason, metrics });
    await db`insert into public.ops_optimization_log (campaign_urn, decision, reason, metrics)
              values (${target.campaign_urn}, ${decision}, ${reason}, ${JSON.stringify(metrics)}::jsonb)`;
  }

  return { ok: true as const, checked: targets.length, decisions };
}
