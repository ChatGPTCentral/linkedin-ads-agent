import { getAgentToken } from "./serverToken";
import { liGet, liPatch } from "./client";
import { DEFAULT_AD_ACCOUNT_URN } from "./config";
import { computeMetrics } from "./metrics";
import { getQuizDb } from "@/lib/quiz/db";

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

// ---- Action queue ----
const ALLOWED = new Set(["pause_creative", "resume_creative", "pause_campaign", "resume_campaign", "set_campaign_budget"]);
const MAX_DAILY_BUDGET_USD = 50; // hard guardrail

type Action = { id: number; kind: string; target_id: string; params: Record<string, unknown> | null };
type ApplyResult = { ok: boolean; rejected?: boolean; status?: number; error?: string };

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
    const res = await liPatch(`/adAccounts/${accountId}/adCampaigns/${id}`, { dailyBudget: { amount: String(amount), currencyCode: "USD" } }, token);
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
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
