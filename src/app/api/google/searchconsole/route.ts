import { NextRequest, NextResponse } from "next/server";
import { getValidGoogleToken, gGet, gPost } from "@/lib/google/client";
import { GOOGLE, DEFAULT_SC_SITE_URL } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Search Console Search Analytics — organic context (which queries/pages bring
// traffic) alongside the paid funnel.

interface ScRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

function daysAgoISO(n: number): string {
  // Compute a YYYY-MM-DD string n days before today (UTC), no Date.now surprises.
  const ms = Date.now() - n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });
  const token = t.accessToken;
  const q = new URL(req.url).searchParams;
  const siteUrl = q.get("siteUrl") || DEFAULT_SC_SITE_URL;

  // No site → list the sites this account can access.
  if (!siteUrl) {
    const r = await gGet(`${GOOGLE.searchConsoleBase}/sites`, token);
    const text = await r.text();
    if (!r.ok) return NextResponse.json({ status: r.status, error: text.slice(0, 400) }, { status: 502 });
    return NextResponse.json({ ok: true, ...(JSON.parse(text) as object), hint: "Re-call with ?siteUrl= (e.g. sc-domain:thecentral.ai or https://thecentral.ai/)." });
  }

  const days = Math.min(Math.max(parseInt(q.get("days") || "28", 10) || 28, 1), 480);
  const dimension = q.get("dimensions") || "query";
  const rowLimit = Math.min(Math.max(parseInt(q.get("rowLimit") || "25", 10) || 25, 1), 1000);

  const body = {
    startDate: daysAgoISO(days),
    endDate: daysAgoISO(1),
    dimensions: dimension.split(",").map((d) => d.trim()).filter(Boolean),
    rowLimit,
  };
  const res = await gPost(`${GOOGLE.searchConsoleBase}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, body, token);
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ status: res.status, error: text.slice(0, 600) }, { status: 502 });

  const data = JSON.parse(text) as { rows?: ScRow[] };
  const rows = (data.rows ?? []).map((r) => ({
    keys: r.keys ?? [],
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? null,
  }));
  return NextResponse.json({ ok: true, siteUrl, range: { start: body.startDate, end: body.endDate }, dimensions: body.dimensions, count: rows.length, rows });
}
