import crypto from "node:crypto";

// --- Stateless signed CSRF state (no cookie needed) --------------------------
// state = base64url(payload) + "." + base64url(HMAC-SHA256(encKey, payload)),
// where payload = `${timestamp}.${nonce}`. Verified by recomputing the HMAC, so
// forgery is infeasible without the secret and nothing is stored — Vercel
// Deployment Protection can't break it by stripping cookies. Shared by the
// LinkedIn and Google OAuth flows.

export function makeState(encKey: string): string {
  const payload = `${Date.now()}.${crypto.randomBytes(9).toString("base64url")}`;
  const sig = crypto.createHmac("sha256", encKey).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(encKey: string, state: string | null, maxAgeMs = 600_000): boolean {
  if (!state) return false;
  const dot = state.lastIndexOf(".");
  if (dot < 1) return false;
  let payload: string;
  try {
    payload = Buffer.from(state.slice(0, dot), "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = crypto.createHmac("sha256", encKey).update(payload).digest("base64url");
  const a = Buffer.from(state.slice(dot + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const ts = Number(payload.split(".")[0]);
  return Number.isFinite(ts) && Date.now() - ts <= maxAgeMs && ts <= Date.now() + 60_000;
}
