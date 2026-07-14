import crypto from "node:crypto";

// AES-256-GCM seal/open for small secrets (OAuth tokens) stored in httpOnly
// cookies. Shared by the LinkedIn and Google integrations. The key is any
// string (TOKEN_ENC_KEY); it's hashed to 32 bytes.

function keyBytes(encKey: string): Buffer {
  return crypto.createHash("sha256").update(encKey).digest();
}

export function seal(obj: unknown, encKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes(encKey), iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64url");
}

export function open<T>(s: string, encKey: string): T | null {
  try {
    const buf = Buffer.from(s, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", keyBytes(encKey), iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]);
    return JSON.parse(pt.toString("utf8")) as T;
  } catch {
    return null;
  }
}
