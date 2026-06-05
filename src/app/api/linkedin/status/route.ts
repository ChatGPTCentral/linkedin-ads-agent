import { NextResponse } from "next/server";
import { getValidToken, liGet } from "@/lib/linkedin/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ connected: false, reason: t.error });

  let accounts: unknown = null;
  try {
    const res = await liGet("/adAccounts?q=search", t.accessToken);
    accounts = res.ok ? await res.json() : { status: res.status, error: (await res.text()).slice(0, 400) };
  } catch (e) {
    accounts = { error: (e as Error).message };
  }
  return NextResponse.json({ connected: true, accounts });
}
