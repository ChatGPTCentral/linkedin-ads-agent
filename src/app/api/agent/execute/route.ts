import { NextResponse } from "next/server";
import { getAgentToken } from "@/lib/linkedin/serverToken";
import { liPatch } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";
import { getQuizDb } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent executor — applies queued management actions with the SERVER token, under
// guardrails. Actions are queued in public.ops_action (only the operator/agent
// can write there, via MCP), so this trigger only ever runs pre-approved rows.
// Nothing here creates campaigns or raises spend past the cap; those stay manual.

const ALLOWED = new Set(["pause_creative", "resume_creative", "pause_campaign", "resume_campaign", "set_campaign_budget"]);
const MAX_DAILY_BUDGET_USD = 50; // hard guardrail — reject any budget above this

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
    const res = await liPatch(
      `/adAccounts/${accountId}/adCampaigns/${id}`,
      { dailyBudget: { amount: String(amount), currencyCode: "USD" } },
      token
    );
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: (await res.text()).slice(0, 300) };
  }

  return { ok: false, rejected: true, error: "unhandled" };
}

// POST: process the pending action queue.
export async function POST() {
  const t = await getAgentToken();
  if ("error" in t) return NextResponse.json({ ok: false, error: t.error }, { status: 401 });
  const db = getQuizDb();
  if (!db) return NextResponse.json({ ok: false, error: "no_db (set SUPABASE_DATABASE_URL)" }, { status: 500 });

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

  return NextResponse.json({ ok: true, processed: results.length, results });
}

// GET: read-only preview of the queue (no writes).
export async function GET() {
  const db = getQuizDb();
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 500 });
  const rows = await db`select id, created_at, kind, target_id, params, status, result, applied_at from public.ops_action order by id desc limit 50`;
  return NextResponse.json({ ok: true, actions: rows });
}
