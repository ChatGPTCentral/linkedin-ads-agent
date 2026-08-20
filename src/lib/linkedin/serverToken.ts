import { seal, open } from "./tokenStore";
import { getLinkedInEnv } from "./config";
import { refreshToken, toStored } from "./oauth";
import { getQuizDb } from "@/lib/quiz/db";
import type { StoredToken } from "./types";

// Server-side ("autonomous mode") LinkedIn token. The operator seeds it ONCE from
// the browser (the cookie token is copied here), then scheduled jobs and agent
// endpoints call LinkedIn WITHOUT a browser. Stored AES-256-GCM-sealed in
// Supabase (public.ops_linkedin_token, single row) — decryptable only with
// TOKEN_ENC_KEY, which lives in the Vercel env, never in the database.

const ROW_ID = "default";

/** Read the raw StoredToken from the server store, or null when absent/undecryptable. */
export async function readServerToken(): Promise<StoredToken | null> {
  const { env } = getLinkedInEnv();
  const db = getQuizDb();
  if (!env || !db) return null;
  try {
    const rows = await db`select sealed from public.ops_linkedin_token where id = ${ROW_ID}`;
    const sealed = rows[0]?.sealed as string | undefined;
    if (!sealed) return null;
    return open<StoredToken>(sealed, env.encKey);
  } catch {
    return null;
  }
}

/** Persist a StoredToken to the server store (sealed). */
export async function writeServerToken(tok: StoredToken): Promise<void> {
  const { env } = getLinkedInEnv();
  const db = getQuizDb();
  if (!env) throw new Error("missing_config");
  if (!db) throw new Error("no_db (set SUPABASE_DATABASE_URL)");
  const sealed = seal(tok, env.encKey);
  await db`
    insert into public.ops_linkedin_token (id, sealed, updated_at)
    values (${ROW_ID}, ${sealed}, now())
    on conflict (id) do update set sealed = excluded.sealed, updated_at = now()`;
}

/** Remove the server token — disables autonomous mode. */
export async function clearServerToken(): Promise<void> {
  const db = getQuizDb();
  if (!db) return;
  await db`delete from public.ops_linkedin_token where id = ${ROW_ID}`;
}

export type AgentTokenResult = { accessToken: string } | { error: string };

/**
 * Return a valid access token from the SERVER store, refreshing if needed. This
 * is the browser-less path used by autonomous jobs and agent endpoints. Mirrors
 * getValidToken (client.ts) but persists to Supabase instead of the cookie.
 */
export async function getAgentToken(): Promise<AgentTokenResult> {
  const { env, missing } = getLinkedInEnv();
  if (!env) return { error: `missing_config: ${missing.join(", ")}` };
  const tok = await readServerToken();
  if (!tok) return { error: "autonomous_not_enabled" };
  if (tok.expiresAt > Date.now() + 60_000) return { accessToken: tok.accessToken };
  if (tok.refreshToken && (!tok.refreshExpiresAt || tok.refreshExpiresAt > Date.now())) {
    try {
      const fresh = toStored(await refreshToken(env, tok.refreshToken));
      if (!fresh.refreshToken) fresh.refreshToken = tok.refreshToken;
      await writeServerToken(fresh);
      return { accessToken: fresh.accessToken };
    } catch (e) {
      return { error: `refresh_failed: ${(e as Error).message}` };
    }
  }
  return { error: "expired_reenable" };
}

/** Non-sensitive health of the server token (never returns the token itself). */
export async function serverTokenHealth(): Promise<{
  enabled: boolean;
  expiresAt?: number;
  expiresInDays?: number;
  canRefresh?: boolean;
  scopes?: string[];
}> {
  const tok = await readServerToken();
  if (!tok) return { enabled: false };
  return {
    enabled: true,
    expiresAt: tok.expiresAt,
    expiresInDays: Math.round((tok.expiresAt - Date.now()) / 86_400_000),
    canRefresh: Boolean(tok.refreshToken && (!tok.refreshExpiresAt || tok.refreshExpiresAt > Date.now())),
    scopes: (tok.scope ?? "").split(/[\s,]+/).filter(Boolean).sort(),
  };
}
