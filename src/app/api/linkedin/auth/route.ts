import { NextResponse } from "next/server";
import { getLinkedInEnv } from "@/lib/linkedin/config";
import { buildAuthUrl, makeState } from "@/lib/linkedin/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { env, missing } = getLinkedInEnv();
  if (!env) return NextResponse.json({ error: "missing_config", missing }, { status: 400 });
  // Signed, stateless CSRF state — no cookie to be stripped by Vercel protection.
  return NextResponse.redirect(buildAuthUrl(env, makeState(env.encKey)));
}
