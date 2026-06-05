import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLinkedInEnv } from "@/lib/linkedin/config";
import { buildAuthUrl } from "@/lib/linkedin/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { env, missing } = getLinkedInEnv();
  if (!env) return NextResponse.json({ error: "missing_config", missing }, { status: 400 });
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(env, state));
  res.cookies.set("li_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
