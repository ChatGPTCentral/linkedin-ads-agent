import { NextRequest, NextResponse } from "next/server";
import { getGoogleEnv } from "@/lib/google/config";
import { exchangeCode, toStored, verifyState } from "@/lib/google/oauth";
import { seal } from "@/lib/tokenCrypto";
import { G_TOKEN_COOKIE } from "@/lib/google/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { env } = getGoogleEnv();
  const base = req.url;
  if (!env) return NextResponse.redirect(new URL("/connect?gerror=missing_config", base));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL(`/connect?gerror=${encodeURIComponent(err)}`, base));
  if (!code) return NextResponse.redirect(new URL("/connect?gerror=no_code", base));
  // Verify the signed CSRF state (HMAC); no cookie involved.
  if (!verifyState(env.encKey, state)) {
    return NextResponse.redirect(new URL("/connect?gerror=bad_state", base));
  }

  try {
    const tok = toStored(await exchangeCode(env, code));
    const res = NextResponse.redirect(new URL("/connect?gconnected=1", base));
    res.cookies.set(G_TOKEN_COOKIE, seal(tok, env.encKey), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/connect?gerror=${encodeURIComponent((e as Error).message.slice(0, 120))}`, base));
  }
}
