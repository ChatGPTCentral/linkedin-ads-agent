import { NextRequest, NextResponse } from "next/server";
import { getLinkedInEnv, LINKEDIN } from "@/lib/linkedin/config";
import { makeState } from "@/lib/linkedin/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-off diagnostic: builds a LinkedIn consent URL with the app's normal
// scopes PLUS one extra scope to test (?scope=rw_dmp_segments), WITHOUT
// touching LINKEDIN.scopes in config. Safe: if the extra scope isn't granted
// to the app, LinkedIn errors out on its own consent screen and nothing here
// is affected (our stored token is only overwritten if the flow completes,
// which only happens when the scope IS valid). If it IS granted and the
// operator completes consent, the normal /api/linkedin/callback exchanges the
// code as usual — the resulting cookie token will already carry the extra
// scope, so this doubles as enabling it for real.
export async function GET(req: NextRequest) {
  const extra = req.nextUrl.searchParams.get("scope");
  if (!extra) return NextResponse.json({ error: "pass ?scope=rw_dmp_segments (or another scope) to test" }, { status: 400 });

  const { env, missing } = getLinkedInEnv();
  if (!env) return NextResponse.json({ error: "missing_config", missing }, { status: 400 });

  const scopes = Array.from(new Set([...LINKEDIN.scopes, extra]));
  const p = new URLSearchParams({
    response_type: "code",
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    scope: scopes.join(" "),
    state: makeState(env.encKey),
  });
  const url = `${LINKEDIN.authBase}/authorization?${p.toString()}`;

  const wantsRedirect = req.nextUrl.searchParams.get("go") === "1";
  if (wantsRedirect) return NextResponse.redirect(url);
  return NextResponse.json({
    ok: true,
    testing: extra,
    note: "Open `url` in the SAME browser you use for the cockpit. If LinkedIn shows the normal consent screen (listing this permission) and lets you approve, the scope IS granted to the app — and completing it also enables it for real. If LinkedIn errors out immediately, it is NOT granted yet.",
    url,
  });
}
