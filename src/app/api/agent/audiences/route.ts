import { NextRequest, NextResponse } from "next/server";
import { checkAudienceStatus } from "@/lib/linkedin/agentOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only status of DMP segments (Matched Audiences / Predictive Audiences).
// ?ids=77964062,77972559,78001706 — pass the segment ids to check.
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const r = await checkAudienceStatus(ids);
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}
