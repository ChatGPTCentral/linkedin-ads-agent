import { NextResponse } from "next/server";
import { clearGoogleToken } from "@/lib/google/tokenStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearGoogleToken();
  return NextResponse.json({ ok: true });
}
