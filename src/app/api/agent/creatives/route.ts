import { NextRequest, NextResponse } from "next/server";
import { checkCampaignCreatives } from "@/lib/linkedin/agentOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only: which creatives (if any) are attached to given campaign ids, and
// their intendedStatus/review status. ?campaigns=871211116,871071176
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("campaigns") || "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const r = await checkCampaignCreatives(ids);
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}
