import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getValidToken, liGet, liPost } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN } from "@/lib/linkedin/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LinkedIn returns the created entity id in a response header. */
function createdId(res: Response): string | null {
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
}

interface DmpSegment {
  id?: number | string;
  name?: string;
  type?: string;
  status?: string;
  audienceSize?: { lowerBound?: number; upperBound?: number };
}

// GET: list the account's saved / Matched Audiences (DMP segments).
export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account") || DEFAULT_AD_ACCOUNT_URN;
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liGet(`/dmpSegments?q=account&account=${encodeURIComponent(account)}`, t.accessToken);
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ step: "list", status: res.status, error: text.slice(0, 600) }, { status: 502 });

  let elements: DmpSegment[] = [];
  try {
    elements = (JSON.parse(text) as { elements?: DmpSegment[] }).elements ?? [];
  } catch {
    /* leave empty if the body isn't the expected shape */
  }
  const segments = elements.map((s) => ({
    id: s.id ?? null,
    name: s.name ?? null,
    type: s.type ?? null,
    status: s.status ?? null,
    size: s.audienceSize?.lowerBound ?? null,
  }));
  return NextResponse.json({ ok: true, account, count: segments.length, segments });
}

// POST: create a list-based Matched Audience and optionally upload hashed emails.
// Emails are normalized + SHA-256 hashed server-side; only hashes go to LinkedIn.
export async function POST(req: NextRequest) {
  const { name, emails, account: acct } = (await req.json()) as {
    name?: string;
    emails?: string[];
    account?: string;
  };
  if (!name?.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const account = acct || DEFAULT_AD_ACCOUNT_URN;

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  // 1) Create the segment (a list of users matched into LinkedIn).
  const createRes = await liPost(
    "/dmpSegments",
    { account, name: name.trim(), type: "USER", destinations: [{ destination: "LINKEDIN" }], accessPolicy: "PRIVATE" },
    t.accessToken
  );
  if (!createRes.ok) {
    return NextResponse.json(
      { step: "create", status: createRes.status, error: (await createRes.text()).slice(0, 600) },
      { status: 502 }
    );
  }
  const segmentId = createdId(createRes);

  // 2) Upload hashed emails (optional), in batches.
  let uploaded = 0;
  const clean = [...new Set((emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (segmentId && clean.length) {
    const elements = clean.map((e) => ({
      action: "ADD",
      userIds: [{ idType: "SHA256_EMAIL", idValue: createHash("sha256").update(e).digest("hex") }],
    }));
    for (let i = 0; i < elements.length; i += 100) {
      const batch = elements.slice(i, i + 100);
      const upRes = await liPost(`/dmpSegments/${segmentId}/users`, { elements: batch }, t.accessToken);
      if (!upRes.ok) {
        return NextResponse.json(
          { step: "upload", segmentId, uploaded, status: upRes.status, error: (await upRes.text()).slice(0, 600) },
          { status: 502 }
        );
      }
      uploaded += batch.length;
    }
  }

  return NextResponse.json({
    ok: true,
    segmentId,
    uploaded,
    note: "Created a PRIVATE list-based Matched Audience. LinkedIn needs time to match members and enforces a minimum match count before it's usable in targeting. Find it under Audiences in Campaign Manager.",
  });
}
