import { NextResponse } from "next/server";
import { getAgentToken } from "@/lib/linkedin/serverToken";
import { liGet } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";
import { computeMetrics } from "@/lib/linkedin/metrics";
import { getQuizDb } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent report — pulls live LinkedIn campaign + creative performance with the
// SERVER token (no browser), stores a snapshot in Supabase, and returns it. This
// is the read half of autonomous mode: it lets the agent analyze performance on
// demand. NOTE: returns ad-metrics only (no PII, no token); gate with a key
// before exposing widely.

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

export async function GET() {
  const t = await getAgentToken();
  if ("error" in t) return NextResponse.json({ ok: false, error: t.error }, { status: 401 });

  const account = DEFAULT_AD_ACCOUNT_URN;
  const accountId = account.split(":").pop() ?? account;
  const days = 30;

  // Campaigns (config).
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
    /* snapshot is best-effort */
  }

  return NextResponse.json({ ok: true, stored, ...payload });
}
