import { NextRequest, NextResponse } from "next/server";
import { getValidGoogleToken, gGet, gPost } from "@/lib/google/client";
import { GOOGLE, LINKEDIN_INSIGHT_PARTNER_ID } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google Tag Manager API v2. READ inventory freely; WRITES are staged in a
// workspace and never go live until an explicit, confirm-gated publish.
// Hierarchy: accounts → containers → workspaces → tags/triggers/variables →
// versions (create from workspace) → publish.

// Reserved GTM built-in "All Pages" trigger id.
const ALL_PAGES_TRIGGER = "2147479553";

const base = GOOGLE.gtmBase;

function wsPath(a: string, c: string, w: string): string {
  return `${base}/accounts/${a}/containers/${c}/workspaces/${w}`;
}

async function pull(url: string, token: string): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  try {
    const r = await gGet(url, token);
    const text = await r.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, error: text.slice(0, 400) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** The standard LinkedIn Insight base snippet, as a GTM Custom HTML tag value. */
function insightSnippet(partnerId: string): string {
  return [
    `<script type="text/javascript">`,
    `_linkedin_partner_id = "${partnerId}";`,
    `window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];`,
    `window._linkedin_data_partner_ids.push(_linkedin_partner_id);`,
    `</script>`,
    `<script type="text/javascript">`,
    `(function(l) {`,
    `  if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}`,
    `  var s = document.getElementsByTagName("script")[0];`,
    `  var b = document.createElement("script");`,
    `  b.type = "text/javascript";b.async = true;`,
    `  b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";`,
    `  s.parentNode.insertBefore(b, s);})(window.lintrk);`,
    `</script>`,
  ].join("\n");
}

/** A ready-to-create GTM Custom HTML tag resource for the LinkedIn Insight Tag. */
function buildInsightTag(partnerId: string, firingTriggerId: string[]): Record<string, unknown> {
  return {
    name: "LinkedIn Insight Tag",
    type: "html",
    parameter: [
      { type: "template", key: "html", value: insightSnippet(partnerId) },
      { type: "boolean", key: "supportDocumentWrite", value: "false" },
    ],
    firingTriggerId,
  };
}

// ---- GET: inventory (cascades by which ids are supplied) --------------------
export async function GET(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });
  const token = t.accessToken;
  const q = new URL(req.url).searchParams;
  const accountId = q.get("accountId");
  const containerId = q.get("containerId");
  const workspaceId = q.get("workspaceId");

  if (!accountId) {
    const r = await pull(`${base}/accounts`, token);
    return NextResponse.json(r.ok ? { ok: true, level: "accounts", ...(r.data as object) } : r, { status: r.ok ? 200 : 502 });
  }
  if (!containerId) {
    const r = await pull(`${base}/accounts/${accountId}/containers`, token);
    return NextResponse.json(r.ok ? { ok: true, level: "containers", ...(r.data as object) } : r, { status: r.ok ? 200 : 502 });
  }
  if (!workspaceId) {
    const r = await pull(`${base}/accounts/${accountId}/containers/${containerId}/workspaces`, token);
    return NextResponse.json(
      r.ok ? { ok: true, level: "workspaces", hint: "Re-call with ?workspaceId= to inventory tags/triggers/variables.", ...(r.data as object) } : r,
      { status: r.ok ? 200 : 502 }
    );
  }

  const p = wsPath(accountId, containerId, workspaceId);
  const [tags, triggers, variables] = await Promise.all([
    pull(`${p}/tags`, token),
    pull(`${p}/triggers`, token),
    pull(`${p}/variables`, token),
  ]);
  return NextResponse.json({
    ok: true,
    level: "inventory",
    accountId,
    containerId,
    workspaceId,
    tags: tags.ok ? (tags.data as { tag?: unknown[] }).tag ?? [] : tags,
    triggers: triggers.ok ? (triggers.data as { trigger?: unknown[] }).trigger ?? [] : triggers,
    variables: variables.ok ? (variables.data as { variable?: unknown[] }).variable ?? [] : variables,
  });
}

// ---- POST: staged writes ----------------------------------------------------
// Actions:
//  build_insight_tag  → returns the Insight tag payload (does NOT create it)
//  create_tag         → creates `tag` in the workspace (draft; not live)
//  create_version     → snapshots the workspace into a container version
//  publish            → publishes a version LIVE (requires confirm:true)
export async function POST(req: NextRequest) {
  const t = await getValidGoogleToken();
  if ("error" in t) return NextResponse.json({ error: t.error }, { status: 401 });
  const token = t.accessToken;
  const body = (await req.json()) as {
    action?: string;
    accountId?: string;
    containerId?: string;
    workspaceId?: string;
    versionId?: string;
    tag?: unknown;
    name?: string;
    notes?: string;
    partnerId?: string;
    firingTriggerId?: string[];
    confirm?: boolean;
  };
  const action = body.action;

  if (action === "build_insight_tag") {
    const tag = buildInsightTag(body.partnerId || LINKEDIN_INSIGHT_PARTNER_ID, body.firingTriggerId || [ALL_PAGES_TRIGGER]);
    return NextResponse.json({
      ok: true,
      preview: true,
      tag,
      note: "Non-mutating preview. To create it: POST { action:'create_tag', accountId, containerId, workspaceId, tag } — then create_version, then publish (confirm:true).",
    });
  }

  const { accountId, containerId, workspaceId } = body;

  if (action === "create_tag") {
    if (!accountId || !containerId || !workspaceId || !body.tag) {
      return NextResponse.json({ error: "need accountId, containerId, workspaceId, tag" }, { status: 400 });
    }
    const res = await gPost(`${wsPath(accountId, containerId, workspaceId)}/tags`, body.tag, token);
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ step: "create_tag", status: res.status, error: text.slice(0, 600) }, { status: 502 });
    return NextResponse.json({ ok: true, action, created: JSON.parse(text), note: "Tag created in the workspace (DRAFT — not live). Next: create_version, then publish." });
  }

  if (action === "create_version") {
    if (!accountId || !containerId || !workspaceId) {
      return NextResponse.json({ error: "need accountId, containerId, workspaceId" }, { status: 400 });
    }
    const res = await gPost(`${wsPath(accountId, containerId, workspaceId)}:create_version`, { name: body.name || "Nexus update", notes: body.notes || "Created via LinkedIn Ads Agent" }, token);
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ step: "create_version", status: res.status, error: text.slice(0, 600) }, { status: 502 });
    const parsed = JSON.parse(text) as { containerVersion?: { containerVersionId?: string } };
    return NextResponse.json({
      ok: true,
      action,
      containerVersionId: parsed.containerVersion?.containerVersionId ?? null,
      created: parsed,
      note: "Version created (NOT live). To go live: POST { action:'publish', accountId, containerId, versionId, confirm:true }.",
    });
  }

  if (action === "publish") {
    if (!accountId || !containerId || !body.versionId) {
      return NextResponse.json({ error: "need accountId, containerId, versionId" }, { status: 400 });
    }
    if (body.confirm !== true) {
      return NextResponse.json({
        needsConfirm: true,
        warning: `Publishing version ${body.versionId} changes the LIVE tags on the site. Re-send with confirm:true to proceed.`,
      });
    }
    const res = await gPost(`${base}/accounts/${accountId}/containers/${containerId}/versions/${body.versionId}:publish`, {}, token);
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ step: "publish", status: res.status, error: text.slice(0, 600) }, { status: 502 });
    return NextResponse.json({ ok: true, action, published: JSON.parse(text), note: "Published live. Verify the tag fires (GA4 realtime / Tag Assistant)." });
  }

  return NextResponse.json({ error: "unknown_action", actions: ["build_insight_tag", "create_tag", "create_version", "publish"] }, { status: 400 });
}
