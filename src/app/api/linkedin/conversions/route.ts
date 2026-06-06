import { NextRequest, NextResponse } from "next/server";
import { getValidToken, liGet, liPost } from "@/lib/linkedin/client";
import { DEFAULT_AD_ACCOUNT_URN, AVG_LTV_USD } from "@/lib/linkedin/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** LinkedIn returns the created entity id in a response header. */
function createdId(res: Response): string | null {
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
}

interface Conversion {
  id?: number | string;
  name?: string;
  type?: string;
  enabled?: boolean;
}

// GET: list the account's conversion rules.
export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account") || DEFAULT_AD_ACCOUNT_URN;
  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liGet(`/conversions?q=account&account=${encodeURIComponent(account)}`, t.accessToken);
  const text = await res.text();
  if (!res.ok) return NextResponse.json({ step: "list", status: res.status, error: text.slice(0, 600) }, { status: 502 });

  let elements: Conversion[] = [];
  try {
    elements = (JSON.parse(text) as { elements?: Conversion[] }).elements ?? [];
  } catch {
    /* leave empty */
  }
  const conversions = elements.map((c) => ({
    id: c.id ?? null,
    urn: c.id != null ? `urn:li:conversion:${c.id}` : null,
    name: c.name ?? null,
    type: c.type ?? null,
    enabled: c.enabled ?? null,
  }));
  return NextResponse.json({ ok: true, account, count: conversions.length, conversions });
}

// POST: create a pixel (Insight Tag) conversion rule. kind = PURCHASE | SIGN_UP.
// Field names/enum casing are best-effort against the versioned API — the raw
// error is surfaced so we can iterate.
export async function POST(req: NextRequest) {
  const { kind, name, account: acct, value } = (await req.json()) as {
    kind?: "PURCHASE" | "SIGN_UP";
    name?: string;
    account?: string;
    value?: number;
  };
  const account = acct || DEFAULT_AD_ACCOUNT_URN;
  const type = kind === "SIGN_UP" ? "SIGN_UP" : "PURCHASE";

  const t = await getValidToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });

  const res = await liPost(
    "/conversions",
    {
      account,
      name: name?.trim() || (type === "PURCHASE" ? "Purchase — Ultimate AI Library" : "Sign up — Ultimate AI Library"),
      type,
      conversionMethod: "PIXEL",
      postClickAttributionWindowSize: 30,
      viewThroughAttributionWindowSize: 7,
      attributionType: "LAST_TOUCH_BY_CAMPAIGN",
      value: { currencyCode: "USD", amount: String(value ?? AVG_LTV_USD) },
    },
    t.accessToken
  );
  if (!res.ok) {
    return NextResponse.json({ step: "create", status: res.status, error: (await res.text()).slice(0, 600) }, { status: 502 });
  }
  const id = createdId(res);
  return NextResponse.json({
    ok: true,
    type,
    conversionId: id,
    conversionUrn: id ? `urn:li:conversion:${id}` : null,
    note: "Created a pixel conversion. In Campaign Manager, tie it to a landing-page URL rule (e.g. the purchase-confirmation URL). Pass conversionUrn when creating a WEBSITE_CONVERSION campaign to optimize for it.",
  });
}
