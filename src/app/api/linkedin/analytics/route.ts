import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";
import { computeMetrics } from "@/lib/linkedin/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_FIELDS = "impressions,clicks,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValues";

// Pull last-30-day ad analytics for an account, pivoted by campaign, and
// compute spend / conversions / CPA / ROAS. The conversion-value field is
// version-specific, so we drop it and retry if LinkedIn rejects it.
export async function GET(req: NextRequest) {
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const url = new URL(req.url);
  const account = url.searchParams.get("account");
  if (!account) return NextResponse.json({ error: "account_required (urn:li:sponsoredAccount:...)" }, { status: 400 });
  const wantValue = url.searchParams.get("includeValue") !== "0";

  const end = new Date();
  const start = new Date(Date.now() - 30 * 864e5);
  const dr =
    `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),` +
    `end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;
  const build = (fields: string) =>
    `q=analytics&${dr}&timeGranularity=ALL&pivot=CAMPAIGN&accounts=List(${encodeURIComponent(account)})&fields=${fields}`;
  const fetchAnalytics = (withValue: boolean) =>
    liGet(`/adAnalytics?${build(withValue ? `${BASE_FIELDS},conversionValueInLocalCurrency` : BASE_FIELDS)}`, t.accessToken);

  try {
    let valueIncluded = wantValue;
    let res = await fetchAnalytics(wantValue);
    if (!res.ok && wantValue) {
      // conversionValueInLocalCurrency may not exist on this version — retry without it.
      res = await fetchAnalytics(false);
      valueIncluded = false;
    }
    if (!res.ok) {
      return NextResponse.json({ status: res.status, error: (await res.text()).slice(0, 600) }, { status: 502 });
    }
    const raw = (await res.json()) as { elements?: unknown[] };
    const metrics = computeMetrics(raw.elements ?? []);
    return NextResponse.json({ ok: true, valueIncluded, ...metrics, raw });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
