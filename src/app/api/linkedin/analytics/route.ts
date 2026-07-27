import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";
import { computeMetrics } from "@/lib/linkedin/metrics";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_FIELDS = "impressions,clicks,landingPageClicks,costInUsd,externalWebsiteConversions,oneClickLeads,pivotValues";

// Pull last-30-day ad analytics for an account, pivoted by campaign, and
// compute spend / conversions / CPA / ROAS. The conversion-value field is
// version-specific, so we drop it and retry if LinkedIn rejects it.
export async function GET(req: NextRequest) {
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const url = new URL(req.url);
  const account = url.searchParams.get("account") || DEFAULT_AD_ACCOUNT_URN;
  // Optionally narrow to specific campaigns (comma-separated ids or URNs). The
  // account is ALWAYS sent as the base scope — LinkedIn's adAnalytics needs it,
  // and returns empty if you pass campaigns alone.
  const campaignsParam = url.searchParams.get("campaigns");
  const wantValue = url.searchParams.get("includeValue") !== "0";
  // Pivot: CAMPAIGN (default) or CREATIVE for per-ad performance. pivotValues[0]
  // then holds the creative URN, so computed[].campaign is the creative id.
  const pivotParam = (url.searchParams.get("pivot") || "CAMPAIGN").toUpperCase();
  const pivot = ["CAMPAIGN", "CREATIVE", "CAMPAIGN_GROUP", "ACCOUNT"].includes(pivotParam) ? pivotParam : "CAMPAIGN";

  // Finder: always scope by account; add a campaigns filter on top when asked.
  const finderParts = [`accounts=List(${encodeURIComponent(account)})`];
  if (campaignsParam) {
    const camps = campaignsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => encodeURIComponent(s.startsWith("urn:") ? s : `urn:li:sponsoredCampaign:${s}`))
      .join(",");
    if (camps) finderParts.push(`campaigns=List(${camps})`);
  }
  const finder = finderParts.join("&");

  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
  const end = new Date();
  const start = new Date(Date.now() - days * 864e5);
  const dr =
    `dateRange=(start:(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()}),` +
    `end:(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()}))`;
  const build = (fields: string) =>
    `q=analytics&${dr}&timeGranularity=ALL&pivot=${pivot}&${finder}&fields=${fields}`;
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
    return NextResponse.json({ ok: true, pivot, days, valueIncluded, ...metrics, raw });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
