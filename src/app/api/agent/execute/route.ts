import { NextResponse } from "next/server";
import { processActionQueue } from "@/lib/linkedin/agentOps";
import { getQuizDb } from "@/lib/quiz/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: process the pending action queue with the server token (guardrails live
// in agentOps). The queue is writable only via MCP/the app, so this only ever
// runs pre-approved rows.
export async function POST() {
  const r = await processActionQueue();
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}

// GET: read-only preview of the queue (no writes).
export async function GET() {
  const db = getQuizDb();
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 500 });
  const rows = await db`select id, created_at, kind, target_id, params, status, result, applied_at from public.ops_action order by id desc limit 50`;
  return NextResponse.json({ ok: true, actions: rows });
}
