import { NextRequest, NextResponse } from "next/server";
import { getValidGoogleToken, gGet } from "@/lib/google/client";
import { GOOGLE } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lists every GA4 property's data streams + measurement IDs (Admin API), so we
// can pinpoint which stream actually collects the site — needed to create the
// Measurement Protocol secret on the right stream (roll-up/aggregate properties
// like 506824506 have no stream of their own).

async function toJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

export async function GET(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });
  const token = t.accessToken;

  const only = new URL(req.url).searchParams.get("propertyId");

  let props: { id: string; name?: string }[] = [];
  if (only) {
    props = [{ id: only.replace(/^properties\//, "") }];
  } else {
    const sumRes = await gGet(`${GOOGLE.gaAdminBase}/accountSummaries`, token);
    if (!sumRes.ok) {
      return NextResponse.json({ step: "accountSummaries", status: sumRes.status, error: (await sumRes.text()).slice(0, 400) }, { status: 502 });
    }
    const sum = (await sumRes.json()) as {
      accountSummaries?: Array<{ propertySummaries?: Array<{ property?: string; displayName?: string }> }>;
    };
    props = (sum.accountSummaries ?? [])
      .flatMap((a) => (a.propertySummaries ?? []).map((p) => ({ id: (p.property ?? "").replace(/^properties\//, ""), name: p.displayName })))
      .filter((p) => p.id);
  }

  const properties = await Promise.all(
    props.map(async (p) => {
      const r = await gGet(`${GOOGLE.gaAdminBase}/properties/${p.id}/dataStreams`, token);
      const data = (await toJson(r)) as {
        dataStreams?: Array<{ displayName?: string; type?: string; webStreamData?: { measurementId?: string; defaultUri?: string } }>;
      };
      const streams = r.ok
        ? (data.dataStreams ?? []).map((s) => ({
            displayName: s.displayName,
            type: s.type,
            measurementId: s.webStreamData?.measurementId ?? null,
            uri: s.webStreamData?.defaultUri ?? null,
          }))
        : { error: r.status, detail: data };
      return { propertyId: p.id, name: p.name, streams };
    })
  );

  return NextResponse.json({ ok: true, properties });
}
