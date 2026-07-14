import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liPost } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LinkedIn returns the created entity id in a response header. */
function createdId(res: Response): string | null {
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
}

// POST: best-effort Predictive Audience from a source DMP segment.
// Classic Lookalikes were retired (Feb 2024); Predictive Audiences are the
// replacement but are gated behind LinkedIn's Matched Audiences private API
// program. We attempt creation and surface the raw error + a fallback note.
export async function POST(req: NextRequest) {
  const { sourceSegmentUrn, name, account: acct } = (await req.json()) as {
    sourceSegmentUrn?: string;
    name?: string;
    account?: string;
  };
  if (!sourceSegmentUrn) return NextResponse.json({ error: "sourceSegmentUrn_required" }, { status: 400 });
  const account = acct || DEFAULT_AD_ACCOUNT_URN;

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liPost(
    "/dmpSegments",
    {
      account,
      name: name?.trim() || "Predictive — converters",
      type: "PREDICTIVE",
      sourceSegment: sourceSegmentUrn,
      destinations: [{ destination: "LINKEDIN" }],
      accessPolicy: "PRIVATE",
    },
    t.accessToken
  );
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      {
        step: "create",
        status: res.status,
        error: text.slice(0, 600),
        ...(res.status === 403
          ? {
              hint: "Missing scope rw_dmp_segments (Matched Audiences). Request it for the app on developer.linkedin.com, add it back to LINKEDIN.scopes, then Disconnect → Connect to re-consent.",
            }
          : {}),
        note: "Predictive Audiences may require LinkedIn's Matched Audiences private API access. Fallback: Campaign Manager → Audiences → Create → Predictive → source = this segment / a conversion, then target it via the 'Target' action.",
      },
      { status: 502 }
    );
  }
  const id = createdId(res);
  return NextResponse.json({
    ok: true,
    segmentId: id,
    segmentUrn: id ? `urn:li:dmpSegment:${id}` : null,
    note: "Predictive audience requested. It needs time to build + a minimum source size; target it once status is READY.",
  });
}
