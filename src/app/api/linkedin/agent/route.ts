import { NextResponse } from "next/server";
import { getValidToken } from "@/lib/linkedin/client";
import { getLinkedInEnv } from "@/lib/linkedin/config";
import { readStoredToken } from "@/lib/linkedin/tokenStore";
import { writeServerToken, clearServerToken, serverTokenHealth } from "@/lib/linkedin/serverToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autonomous mode = a server-side LinkedIn token so scheduled jobs/agent code can
// manage campaigns WITHOUT the operator's browser. Seeded once here from the
// logged-in cookie session.

// GET: non-sensitive health of autonomous mode (never returns the token).
export async function GET() {
  const health = await serverTokenHealth();
  return NextResponse.json({ ok: true, autonomous: health });
}

// POST: enable — copy the current (fresh) cookie token into the server store.
// Requires an active browser session, so only the operator can seed it.
export async function POST() {
  const { env, missing } = getLinkedInEnv();
  if (!env) return NextResponse.json({ error: `missing_config: ${missing.join(", ")}` }, { status: 500 });

  // Refresh the cookie token if needed, then read the full stored token to copy.
  const v = await getValidToken();
  if ("error" in v) return NextResponse.json({ error: v.error }, { status: 401 });
  const tok = await readStoredToken(env.encKey);
  if (!tok) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    await writeServerToken(tok);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  const health = await serverTokenHealth();
  return NextResponse.json({
    ok: true,
    enabled: true,
    autonomous: health,
    note: health.canRefresh
      ? "Autonomous mode on. The server token refreshes itself; no browser needed."
      : "Autonomous mode on, but no refresh token was returned — re-enable from the browser before it expires.",
  });
}

// DELETE: disable — remove the server token.
export async function DELETE() {
  const { env } = getLinkedInEnv();
  // Require an operator session so a random caller can't toggle it off.
  if (env) {
    const tok = await readStoredToken(env.encKey);
    if (!tok) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  try {
    await clearServerToken();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, enabled: false });
}
