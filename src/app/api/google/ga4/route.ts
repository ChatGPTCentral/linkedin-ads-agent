import { NextRequest, NextResponse } from "next/server";
import { getValidGoogleToken, gPost } from "@/lib/google/client";
import { GOOGLE, DEFAULT_GA4_PROPERTY_ID } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GA4 Data API (runReport). This is the independent source of truth for the
// funnel: does GA4 record purchases at all, and where do paid clicks land/drop?

interface Report {
  dimensions: string[];
  metrics: string[];
  orderBy?: string;
  limit?: number;
}

// Purchase-oriented metrics; keyEvents replaced "conversions" in GA4 (2024).
const FUNNEL_METRICS = ["sessions", "activeUsers", "keyEvents", "ecommercePurchases", "purchaseRevenue"];
// Retry set if a property rejects one of the richer metrics.
const SAFE_METRICS = ["sessions", "activeUsers"];

const PRESETS: Record<string, Report> = {
  channels: { dimensions: ["sessionSourceMedium"], metrics: FUNNEL_METRICS, orderBy: "sessions", limit: 25 },
  campaigns: { dimensions: ["sessionCampaignName", "sessionSourceMedium"], metrics: FUNNEL_METRICS, orderBy: "sessions", limit: 25 },
  landing: { dimensions: ["landingPagePlusQueryString"], metrics: FUNNEL_METRICS, orderBy: "sessions", limit: 25 },
  events: { dimensions: ["eventName"], metrics: ["eventCount", "eventCountPerUser"], orderBy: "eventCount", limit: 50 },
};

interface GaHeader {
  name?: string;
}
interface GaValue {
  value?: string;
}
interface GaRow {
  dimensionValues?: GaValue[];
  metricValues?: GaValue[];
}
interface GaReport {
  dimensionHeaders?: GaHeader[];
  metricHeaders?: GaHeader[];
  rows?: GaRow[];
  rowCount?: number;
}

function buildBody(r: Report, days: number, metrics: string[]): Record<string, unknown> {
  return {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: r.dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    ...(r.orderBy && metrics.includes(r.orderBy)
      ? { orderBys: [{ metric: { metricName: r.orderBy }, desc: true }] }
      : {}),
    limit: String(r.limit ?? 25),
  };
}

function shape(data: GaReport) {
  const dimHeaders = (data.dimensionHeaders ?? []).map((h) => h.name ?? "");
  const metHeaders = (data.metricHeaders ?? []).map((h) => h.name ?? "");
  const rows = (data.rows ?? []).map((row) => {
    const o: Record<string, string> = {};
    (row.dimensionValues ?? []).forEach((v, i) => {
      o[dimHeaders[i]] = v.value ?? "";
    });
    (row.metricValues ?? []).forEach((v, i) => {
      o[metHeaders[i]] = v.value ?? "";
    });
    return o;
  });
  return { columns: [...dimHeaders, ...metHeaders], rowCount: data.rowCount ?? rows.length, rows };
}

function runReport(propertyId: string, body: unknown, token: string): Promise<Response> {
  return gPost(`${GOOGLE.ga4Base}/properties/${propertyId}:runReport`, body, token);
}

function normalizeId(raw: string): string {
  return raw.replace(/^properties\//, "");
}

export async function GET(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const url = new URL(req.url);
  const propertyId = normalizeId(url.searchParams.get("propertyId") || DEFAULT_GA4_PROPERTY_ID);
  if (!propertyId) {
    return NextResponse.json(
      { error: "propertyId_required", hint: "Pass ?propertyId=123456789 (see /api/google/status ga4Properties) or set GA4_PROPERTY_ID." },
      { status: 400 }
    );
  }
  const preset = url.searchParams.get("preset") || "channels";
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30", 10) || 30, 1), 365);
  const r = PRESETS[preset];
  if (!r) return NextResponse.json({ error: "unknown_preset", presets: Object.keys(PRESETS) }, { status: 400 });

  let metrics = r.metrics;
  let res = await runReport(propertyId, buildBody(r, days, metrics), t.accessToken);
  if (!res.ok && res.status === 400 && metrics !== SAFE_METRICS) {
    // A metric may not exist on this property — retry with the safe set.
    metrics = SAFE_METRICS;
    res = await runReport(propertyId, buildBody(r, days, metrics), t.accessToken);
  }
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ status: res.status, error: text.slice(0, 600) }, { status: 502 });
  return NextResponse.json({ ok: true, propertyId, preset, days, metricsUsed: metrics, ...shape(JSON.parse(text) as GaReport) });
}

// POST: run an arbitrary runReport body (power use). Body: { propertyId, report }
// where `report` is a GA4 runReport request object.
export async function POST(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });
  const body = (await req.json()) as { propertyId?: string; report?: unknown };
  const propertyId = normalizeId(body.propertyId || DEFAULT_GA4_PROPERTY_ID);
  if (!propertyId) return NextResponse.json({ error: "propertyId_required" }, { status: 400 });
  if (!body.report) return NextResponse.json({ error: "report_required", hint: "Send { propertyId, report: <GA4 runReport body> }" }, { status: 400 });
  const res = await runReport(propertyId, body.report, t.accessToken);
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ status: res.status, error: text.slice(0, 600) }, { status: 502 });
  return NextResponse.json({ ok: true, propertyId, ...shape(JSON.parse(text) as GaReport) });
}
