import { NextResponse } from "next/server";
import { getGoogleEnv } from "@/lib/google/config";
import { buildAuthUrl, makeState } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { env, missing } = getGoogleEnv();
  if (!env) return NextResponse.json({ error: "missing_config", missing }, { status: 400 });
  // Signed, stateless CSRF state — survives Vercel Deployment Protection.
  return NextResponse.redirect(buildAuthUrl(env, makeState(env.encKey)));
}
