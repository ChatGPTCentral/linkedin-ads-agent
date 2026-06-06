import { NextRequest, NextResponse } from "next/server";
import { getLinkedInEnv } from "@/lib/linkedin/config";
import { exchangeCode, toStored, verifyState } from "@/lib/linkedin/oauth";
import { seal, TOKEN_COOKIE } from "@/lib/linkedin/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { env } = getLinkedInEnv();
  const base = req.url;
  if (!env) return NextResponse.redirect(new URL("/connect?error=missing_config", base));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent(err)}`, base));

  if (!code) {
    return NextResponse.redirect(new URL("/connect?error=no_code", base));
  }
  // Verify the signed CSRF state (HMAC); no cookie involved.
  if (!verifyState(env.encKey, state)) {
    return NextResponse.redirect(new URL("/connect?error=bad_state", base));
  }

  try {
    const tok = toStored(await exchangeCode(env, code));
    const res = NextResponse.redirect(new URL("/connect?connected=1", base));
    res.cookies.set(TOKEN_COOKIE, seal(tok, env.encKey), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    res.cookies.delete("li_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/connect?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`, base));
  }
}
