import { NextResponse } from "next/server";
import { takeSnapshot } from "@/lib/linkedin/agentOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agent report — live campaign + creative performance via the server token
// (no browser). Stores a snapshot in Supabase and returns it. Ad-metrics only.
export async function GET() {
  const r = await takeSnapshot(30);
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}
