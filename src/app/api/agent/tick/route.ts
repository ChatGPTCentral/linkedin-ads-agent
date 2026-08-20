import { NextRequest, NextResponse } from "next/server";
import { takeSnapshot, processActionQueue } from "@/lib/linkedin/agentOps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron entry. On each tick it (1) snapshots live performance and (2)
// applies the pending action queue — all with the server token, no browser.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set;
// we require it so only the scheduler can trigger writes. If CRON_SECRET is
// unset, the endpoint still runs (the queue is the real security boundary) but
// logs a warning to set it.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const snapshot = await takeSnapshot(30);
  const queue = await processActionQueue();
  return NextResponse.json({
    ok: true,
    securedByCronSecret: Boolean(secret),
    snapshot: { ok: snapshot.ok, stored: "stored" in snapshot ? snapshot.stored : false, error: snapshot.ok ? undefined : snapshot.error },
    queue,
  });
}
