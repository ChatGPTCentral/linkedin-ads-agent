import postgres from "postgres";

// Runtime read connection to the AI Central Quiz (Prod) Postgres, used for
// cross-source measurement — LinkedIn ad spend ÷ quiz completions. Reads
// SUPABASE_DATABASE_URL (use the Supabase *pooler* / "Transaction" connection
// string for serverless). Returns null when unset so routes degrade gracefully.
//
// prepare:false is required for the pgBouncer transaction pooler; max:1 keeps
// each serverless invocation to a single short-lived connection.

// utm_source value(s) your PAID LinkedIn ads carry. Keep to the paid value only
// ("li_ads") — the bare "linkedin" source is organic posts and must not count.
export const PAID_LINKEDIN_SOURCES = ["li_ads"];

let client: ReturnType<typeof postgres> | null = null;

export function getQuizDb(): ReturnType<typeof postgres> | null {
  const url = process.env.SUPABASE_DATABASE_URL;
  if (!url) return null;
  if (!client) {
    client = postgres(url, { ssl: "require", max: 1, idle_timeout: 20, prepare: false });
  }
  return client;
}
