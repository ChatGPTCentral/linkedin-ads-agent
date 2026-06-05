import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pull last-30-day ad analytics for an account, pivoted by campaign.
// Date-range / pivot encoding is version-specific — verify once connected.
export async function GET(req: NextRequest) {
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const account = new URL(req.url).searchParams.get("account");
  if (!account) return NextResponse.json({ error: "account_required (urn:li:sponsoredAccount:...)" }, { status: 400 });

  const end = new Date();
  const start = new Date(Date.now() - 30 * 864e5);
  const dr =
    `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),` +
    `end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;
  const params =
    `q=analytics&${dr}&timeGranularity=ALL&pivot=CAMPAIGN&accounts=List(${encodeURIComponent(account)})` +
    `&fields=impressions,clicks,costInUsd,externalWebsiteConversions,oneClickLeads`;

  let result: unknown;
  try {
    const res = await liGet(`/adAnalytics?${params}`, t.accessToken);
    result = res.ok ? await res.json() : { status: res.status, error: (await res.text()).slice(0, 600) };
  } catch (e) {
    result = { error: (e as Error).message };
  }
  return NextResponse.json({ result });
}
